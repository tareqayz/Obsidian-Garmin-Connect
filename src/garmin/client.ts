import { CookieJar, parseJson, type HttpClient } from "../http";
import { silentLog, snippet, type Log } from "../log";
import { endpoints, nativeHeaders, type GarminDomain } from "./constants";
import {
	exchangeServiceTicket,
	loginWithMfa,
	type AuthContext,
	type MfaPrompt,
} from "./auth";
import {
	GarminApiError,
	GarminAuthError,
	GarminBlockedError,
	GarminMfaCancelledError,
	GarminMfaRequiredError,
	GarminNetworkError,
	GarminRateLimitError,
} from "./errors";
import {
	isFresh,
	refreshAccessToken,
	retryAfter,
	type AccessToken,
	type PersistedAuth,
	type TokenStore,
} from "./tokens";

export interface GarminClientOptions {
	http: HttpClient;
	store: TokenStore;
	domain?: GarminDomain;
	log?: Log;
}

export interface LoginOptions {
	/**
	 * Called when Garmin demands a verification code. Return the code, or `null`
	 * to abandon the sign-in. It is called again — with `error` set — each time
	 * Garmin refuses one, up to `MFA_MAX_ATTEMPTS`.
	 *
	 * Omit it and an MFA challenge raises `GarminMfaRequiredError`, which is the
	 * right answer for a caller with nobody to ask.
	 */
	onMfaRequired?: MfaPrompt;
}

export interface RequestOptions {
	method?: "GET" | "POST";
	query?: Record<string, string>;
	headers?: Record<string, string>;
	body?: string;
}

/**
 * Authentication and authenticated transport. Endpoint wrappers live in
 * `endpoints.ts`, which extends this — one object for callers, two files as the
 * endpoint list grows.
 */
export class GarminClient {
	readonly domain: GarminDomain;
	protected readonly http: HttpClient;
	protected log: Log;
	private readonly store: TokenStore;

	private auth: PersistedAuth | null = null;
	private access: AccessToken | null = null;
	private refreshInFlight: Promise<AccessToken> | null = null;

	constructor(opts: GarminClientOptions) {
		this.http = opts.http;
		this.store = opts.store;
		this.domain = opts.domain ?? "garmin.com";
		this.log = opts.log ?? silentLog;
	}

/** Swap the narrator — the probe attaches its own, the plugin runs silent. */
	setLog(log: Log): void {
		this.log = log;
	}

	get isAuthenticated(): boolean {
		return this.auth !== null;
	}

	/** For a settings screen: when the session was last written, and token state. */
	get session(): { savedAt: number; accessExpiresAt: number | null } | null {
		if (!this.auth) return null;
		return { savedAt: this.auth.savedAt, accessExpiresAt: this.access?.expiresAt ?? null };
	}

	/* ---------------------------------------------------------------- */
	/*  Session lifecycle                                                */
	/* ---------------------------------------------------------------- */

	/** Load a persisted session. Does no network — the refresh happens lazily. */
	async restore(): Promise<boolean> {
		this.auth = await this.store.load();
		this.access = null;
		return this.auth !== null;
	}

	/**
	 * Log in with credentials. The password is used for this call and never
	 * stored, referenced, or logged.
	 *
	 * When the account has MFA switched on, `opts.onMfaRequired` is what turns the
	 * challenge into a code. The cookie jar below is why that has to happen inside
	 * this call rather than through a second public method: Garmin's verify POST
	 * only counts if it carries the session cookies the login POST set, and a jar
	 * scoped to the call cannot be left stranded half-open by a closed modal.
	 */
	async login(email: string, password: string, opts: LoginOptions = {}): Promise<void> {
		// Deliberately not clearing the current session first. A re-login that
		// fails on a 429 or a network blip should leave a working session alone;
		// the new one is committed only once it is complete.
		const ctx: AuthContext = {
			http: this.http,
			jar: new CookieJar(),
			log: this.log,
			domain: this.domain,
		};

		const outcome = await loginWithMfa(ctx, email, password, opts.onMfaRequired);
		switch (outcome.kind) {
			case "ticket":
				break;
			case "mfa":
				throw new GarminMfaRequiredError(outcome.method);
			case "mfa-cancelled":
				throw new GarminMfaCancelledError();
			case "bad-mfa-code":
				throw new GarminAuthError(
					`Garmin refused ${outcome.attempts} verification ` +
						`${outcome.attempts === 1 ? "code" : "codes"} (${outcome.detail}). ` +
						"Sign in again to have a new one sent.",
				);
			case "bad-credentials":
				throw new GarminAuthError("Garmin rejected the email or password");
			case "rate-limited":
				throw new GarminRateLimitError(`Garmin is rate limiting: ${outcome.detail}`);
			case "captcha":
				throw new GarminBlockedError("Garmin demanded a CAPTCHA", 403);
			case "blocked":
				throw new GarminBlockedError(
					`Garmin's edge refused the login request (HTTP ${outcome.status})`,
					outcome.status,
				);
			case "transport":
				throw new GarminNetworkError(`Could not reach Garmin: ${outcome.detail}`);
			default:
				throw new GarminApiError(
					"Unexpected login response",
					outcome.status,
					outcome.detail,
				);
		}

		const tokens = await exchangeServiceTicket(ctx, outcome.ticket);
		if (!tokens) {
			throw new GarminAuthError(
				"Service ticket could not be exchanged for a token. Garmin may have " +
					"rotated its DI client IDs.",
			);
		}

		this.refreshInFlight = null;
		this.auth = {
			refreshToken: tokens.refreshToken ?? "",
			diClientId: tokens.clientId,
			savedAt: Date.now(),
		};
		this.access = {
			token: tokens.accessToken,
			expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
		};

		if (!this.auth.refreshToken) {
			// Without one the session dies at the first expiry with no way back.
			this.log.warn("Garmin issued no refresh token; this session will not survive expiry");
		}
		await this.store.save(this.auth);
	}

	/** Drop the session everywhere, including on disk. */
	async logout(): Promise<void> {
		await this.forget();
		await this.store.clear();
	}

	private async forget(): Promise<void> {
		this.auth = null;
		this.access = null;
		this.refreshInFlight = null;
	}

	/** Force a refresh now — what a "Test connection" button should call. */
	async refreshNow(): Promise<void> {
		this.access = null;
		await this.ensureAccessToken();
	}

	/* ---------------------------------------------------------------- */
	/*  Token plumbing                                                   */
	/* ---------------------------------------------------------------- */

	private async ensureAccessToken(staleToken?: string): Promise<string> {
		if (staleToken !== undefined) {
			// Arriving here from a 401. If a concurrent request already refreshed
			// past the token that failed, use theirs instead of refreshing again.
			if (this.access && this.access.token !== staleToken) return this.access.token;
			this.access = null;
		}
		const current = this.access;
		if (isFresh(current)) return current.token;

		if (!this.refreshInFlight) {
			this.refreshInFlight = this.doRefresh().finally(() => {
				this.refreshInFlight = null;
			});
		}
		return (await this.refreshInFlight).token;
	}

	private async doRefresh(): Promise<AccessToken> {
		if (!this.auth) throw new GarminAuthError("Not signed in to Garmin Connect");
		try {
			const result = await refreshAccessToken(this.http, this.domain, this.auth, this.log);
			this.auth = result.auth;
			this.access = result.access;
			// Persist immediately: Garmin rotates refresh tokens, and losing the
			// new one would strand the session on the next launch.
			await this.store.save(result.auth);
			return result.access;
		} catch (err) {
			if (err instanceof GarminAuthError) await this.logout();
			throw err;
		}
	}

	/* ---------------------------------------------------------------- */
	/*  Authenticated requests                                           */
	/* ---------------------------------------------------------------- */

	async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
		const token = await this.ensureAccessToken();
		let res = await this.send(path, opts, token);

		if (res.status === 401) {
			const fresh = await this.ensureAccessToken(token);
			if (fresh !== token) res = await this.send(path, opts, fresh);
		}

		return this.unwrap<T>(res, path);
	}

	private send(path: string, opts: RequestOptions, token: string) {
		return this.http.request({
			url: `${endpoints(this.domain).connectApi}${path}`,
			method: opts.method ?? "GET",
			query: opts.query,
			headers: nativeHeaders({
				Authorization: `Bearer ${token}`,
				Accept: "application/json",
				...opts.headers,
			}),
			body: opts.body,
		});
	}

	private unwrap<T>(res: { status: number; headers: Record<string, string>; text: string; error?: string }, path: string): T {
		if (res.status === 0) {
			throw new GarminNetworkError(`${path}: could not reach Garmin (${res.error})`);
		}
		if (res.status === 429) {
			throw new GarminRateLimitError(`${path}: rate limited by Garmin`, retryAfter(res.headers));
		}
		if (res.status === 401) {
			throw new GarminAuthError(`${path}: Garmin rejected the token. Sign in again.`);
		}
		if (res.status === 403) {
			// A JSON 403 is the API declining. A non-JSON 403 is the edge declining,
			// which is a different problem with a different fix.
			const isJson = (res.headers["content-type"] ?? "").includes("json");
			if (!isJson) {
				throw new GarminBlockedError(
					`${path}: Garmin's edge refused the request (bot challenge, not credentials)`,
					403,
				);
			}
			throw new GarminAuthError(`${path}: forbidden — ${snippet(res.text, 120)}`);
		}
		if (res.status < 200 || res.status >= 300) {
			throw new GarminApiError(`${path}: HTTP ${res.status}`, res.status, snippet(res.text, 200));
		}

		if (!res.text.trim()) return null as T;

		const data = parseJson<T>(res.text);
		if (data === null) {
			throw new GarminApiError(
				`${path}: expected JSON, got ${snippet(res.text, 80)}`,
				res.status,
				snippet(res.text, 200),
			);
		}
		return data;
	}
}
