import { CookieJar, parseJson, type HttpClient } from "../http";
import { silentLog, snippet, type Log } from "../log";
import { endpointOf, RequestStats } from "./request-stats";
import { Throttle, type ThrottleLimits } from "./throttle";
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
	/** Injectable so a test does not actually sleep through a retry. */
	wait?: (ms: number) => Promise<void>;
	/** Injectable so a test can drive the clock the timings read. */
	now?: () => number;
	/** The pace for every request; see `throttle.ts`. Defaults to `DEFAULT_LIMITS`. */
	limits?: ThrottleLimits;
}

/**
 * Attempts per request, counting the first.
 *
 * Garmin's edge drops connections and returns 502s often enough that a single
 * failed call is usually not news — but a sync of 400 days makes thousands of
 * calls, so "usually" turns into a metric missing from a handful of notes with
 * nothing to show why. Three attempts costs at most 1.6s on a genuinely dead
 * endpoint and rescues the common case.
 */
export const MAX_ATTEMPTS = 3;

/**
 * The pace when nobody chose one — the "Normal" sync speed. See
 * `docs/garmin-api.md` for the ramp that measured where Garmin objects.
 */
export const DEFAULT_LIMITS: ThrottleLimits = { rate: 20, burst: 27, concurrency: 27 };

/**
 * A 429 is retried this many times, each after Garmin's `Retry-After` (or 30s,
 * then 60s, without one), with the whole client paused meanwhile. Past that, or
 * past `MAX_RATE_LIMIT_WAIT_MS`, the run stops: a sync hung for an hour helps
 * nobody, and the next one picks up where it left off.
 */
export const RATE_LIMIT_RETRIES = 2;
export const RATE_LIMIT_BACKOFF_MS = 30_000;
export const MAX_RATE_LIMIT_WAIT_MS = 5 * 60_000;

/** Doubling, with jitter so a burst of parallel day requests does not resynchronise. */
export function backoffMs(attempt: number, random = Math.random): number {
	return Math.round(400 * 2 ** (attempt - 1) * (0.75 + random() * 0.5));
}

/** Worth trying again: nothing came back, or Garmin's own side broke. */
export function isTransient(status: number): boolean {
	return status === 0 || (status >= 500 && status < 600);
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
	private readonly wait: (ms: number) => Promise<void>;
	private readonly now: () => number;
	/** Every attempt's endpoint, status and duration — see `request-stats.ts`. */
	readonly stats = new RequestStats();
	readonly throttle: Throttle;
	/** Told when a 429 pauses the client, with the epoch ms it resumes at. */
	onSlowDown: ((resumesAt: number) => void) | null = null;

	private auth: PersistedAuth | null = null;
	private access: AccessToken | null = null;
	private refreshInFlight: Promise<AccessToken> | null = null;
	/** Values a request path carries about the account, and the placeholder logs and errors show instead. */
	private readonly hidden = new Map<string, string>();

	constructor(opts: GarminClientOptions) {
		this.http = opts.http;
		this.store = opts.store;
		this.domain = opts.domain ?? "garmin.com";
		this.log = opts.log ?? silentLog;
		this.wait = opts.wait ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
		this.now = opts.now ?? Date.now;
		// `wait` paces the throttle only alongside an injected clock: an instant
		// `wait` against the real one would spin until real time caught up.
		this.throttle = new Throttle({
			...(opts.limits ?? DEFAULT_LIMITS),
			now: this.now,
			wait: opts.now ? this.wait : undefined,
		});
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

	/** Keeps `value` — the display name, the account id — out of logs and error messages, written as `as`. */
	protected hideInLogs(value: string | number | null | undefined, as: string): void {
		const text = value === null || value === undefined ? "" : String(value);
		if (text.length >= 3) this.hidden.set(text, as);
	}

	/** A request path as logs and error messages show it: no query, nothing that names the account. */
	protected safePath(path: string): string {
		let out = path.split("?")[0]!;
		for (const [value, as] of this.hidden) out = out.split(encodeURIComponent(value)).join(as).split(value).join(as);
		return out;
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
					outcome.detail.startsWith("SESSION_EXPIRED")
						? outcome.detail
						: `Garmin's sign-in answered with ${outcome.detail}, which this version doesn't handle. ` +
								"Sign in at connect.garmin.com in a browser first: Garmin may want something from the account, " +
								"such as unlocking it, a new password or new terms. Then try again.",
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
		let res = await this.sendWithRetry(path, opts, token);

		if (res.status === 401) {
			const fresh = await this.ensureAccessToken(token);
			if (fresh !== token) res = await this.sendWithRetry(path, opts, fresh);
		}

		return this.unwrap<T>(res, path);
	}

	/**
	 * Retries a request that failed in a way that says nothing about the request.
	 *
	 * Transport failures and 5xx straight away, with a short backoff: a 400 means
	 * the same thing however many times it is asked. A 429 is Garmin telling us
	 * to stop, so it pauses every request this client makes — not just this one —
	 * for as long as Garmin asked, slows the pace, and only then tries again.
	 */
	private async sendWithRetry(path: string, opts: RequestOptions, token: string) {
		let res = await this.send(path, opts, token, 1);
		let attempt = 1;
		for (let tries = 1; tries < MAX_ATTEMPTS && isTransient(res.status); tries++) {
			const pause = backoffMs(tries);
			this.log.detail(this.safePath(path), `HTTP ${res.status || "no response"} — retrying in ${pause}ms`);
			await this.wait(pause);
			res = await this.send(path, opts, token, ++attempt);
		}
		for (let n = 1; n <= RATE_LIMIT_RETRIES && res.status === 429; n++) {
			const after = retryAfter(res.headers);
			const pause = after !== undefined ? after * 1000 : RATE_LIMIT_BACKOFF_MS * 2 ** (n - 1);
			if (pause > MAX_RATE_LIMIT_WAIT_MS) break;
			this.throttle.slowDown(pause);
			this.log.warn(
				`${this.safePath(path)}: rate limited by Garmin — pausing ${Math.round(pause / 1000)}s, ` +
					`then ${this.throttle.rate} requests/s`,
			);
			this.onSlowDown?.(this.throttle.resumesAt);
			res = await this.send(path, opts, token, ++attempt);
		}
		return res;
	}

	private send(path: string, opts: RequestOptions, token: string, attempt: number) {
		return this.throttle.run(() => this.sendNow(path, opts, token, attempt));
	}

	private async sendNow(path: string, opts: RequestOptions, token: string, attempt: number) {
		const started = this.now();
		const res = await this.http.request({
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
		this.stats.record({
			endpoint: endpointOf(path),
			status: res.status,
			ms: this.now() - started,
			attempt,
			at: started,
		});
		if (res.status >= 200 && res.status < 300) this.throttle.succeeded();
		return res;
	}

	private unwrap<T>(res: { status: number; headers: Record<string, string>; text: string; error?: string }, path: string): T {
		const at = this.safePath(path);
		if (res.status === 0) {
			throw new GarminNetworkError(`${at}: could not reach Garmin (${res.error})`);
		}
		if (res.status === 429) {
			throw new GarminRateLimitError(`${at}: rate limited by Garmin`, retryAfter(res.headers));
		}
		if (res.status === 401) {
			throw new GarminAuthError(`${at}: Garmin rejected the token. Sign in again.`);
		}
		if (res.status === 403) {
			// A JSON 403 is the API declining. A non-JSON 403 is the edge declining,
			// which is a different problem with a different fix.
			const isJson = (res.headers["content-type"] ?? "").includes("json");
			if (!isJson) {
				throw new GarminBlockedError(
					`${at}: Garmin's edge refused the request (bot challenge, not credentials)`,
					403,
				);
			}
			// The API declining this endpoint for this account. Not a dead session:
			// a 401 says that, and signing in again would not change this answer.
			throw new GarminApiError(`${at}: forbidden — ${snippet(res.text, 120)}`, 403, snippet(res.text, 200));
		}
		if (res.status < 200 || res.status >= 300) {
			throw new GarminApiError(`${at}: HTTP ${res.status}`, res.status, snippet(res.text, 200));
		}

		if (!res.text.trim()) return null as T;

		const data = parseJson<T>(res.text);
		if (data === null) {
			throw new GarminApiError(
				`${at}: expected JSON, got ${snippet(res.text, 80)}`,
				res.status,
				snippet(res.text, 200),
			);
		}
		return data;
	}
}
