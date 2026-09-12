import { parseJson, type HttpClient } from "../http";
import { redactToken, silentLog, type Log } from "../log";
import { basicAuth, endpoints, nativeHeaders, type GarminDomain } from "./constants";
import { GarminAuthError, GarminNetworkError, GarminRateLimitError } from "./errors";

/**
 * What survives a restart.
 *
 * The password is never here, and neither is the access token. Keeping only the
 * refresh token means one long-lived secret at rest instead of two, and the
 * refresh-on-load it forces is a feature: you learn the session is dead when the
 * plugin starts, not midway through a sync.
 */
export interface PersistedAuth {
	refreshToken: string;
	/** DI client the refresh must be presented to — Garmin rotates these. */
	diClientId: string;
	/** Epoch ms, for display and diagnostics only. */
	savedAt: number;
}

/** Held in memory only, for the life of the session. */
export interface AccessToken {
	token: string;
	/** Epoch ms. */
	expiresAt: number;
}

export interface TokenStore {
	load(): Promise<PersistedAuth | null>;
	save(auth: PersistedAuth): Promise<void>;
	clear(): Promise<void>;
}

/** For tests and for callers that deliberately want no persistence. */
export class MemoryTokenStore implements TokenStore {
	private auth: PersistedAuth | null = null;

	async load(): Promise<PersistedAuth | null> {
		return this.auth;
	}

	async save(auth: PersistedAuth): Promise<void> {
		this.auth = auth;
	}

	async clear(): Promise<void> {
		this.auth = null;
	}
}

/**
 * Refresh ahead of expiry rather than on failure. Phase 0 measured `expires_in`
 * at 66341 s on one run and 97344 s on another, so the lifetime is not fixed and
 * must always be read from the response.
 */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function isFresh(access: AccessToken | null, now = Date.now()): access is AccessToken {
	return access !== null && access.expiresAt - now > REFRESH_MARGIN_MS;
}

export interface RefreshResult {
	access: AccessToken;
	/** Present when Garmin rotated the refresh token — persist it or the next refresh fails. */
	auth: PersistedAuth;
}

/**
 * Exchange a refresh token for a new access token.
 *
 * Same DI endpoint as the initial ticket exchange, with `grant_type=refresh_token`.
 */
export async function refreshAccessToken(
	http: HttpClient,
	domain: GarminDomain,
	auth: PersistedAuth,
	log: Log = silentLog,
): Promise<RefreshResult> {
	const { diToken } = endpoints(domain);
	log.detail("POST", `${diToken} (refresh)`);

	const res = await http.request({
		url: diToken,
		method: "POST",
		headers: nativeHeaders({
			Authorization: basicAuth(auth.diClientId),
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			"Cache-Control": "no-cache",
		}),
		body: new URLSearchParams({
			grant_type: "refresh_token",
			client_id: auth.diClientId,
			refresh_token: auth.refreshToken,
		}).toString(),
	});

	if (res.status === 0) {
		throw new GarminNetworkError(`Token refresh could not reach Garmin: ${res.error}`);
	}
	if (res.status === 429) {
		throw new GarminRateLimitError("Token refresh was rate limited", retryAfter(res.headers));
	}
	if (res.status === 400 || res.status === 401 || res.status === 403) {
		// The refresh token is spent, revoked, or was issued to a client ID
		// Garmin has since retired. Either way the user must log in again.
		throw new GarminAuthError(`Refresh token rejected (HTTP ${res.status}). Log in again.`);
	}
	if (res.status < 200 || res.status >= 300) {
		throw new GarminAuthError(`Token refresh failed with HTTP ${res.status}`);
	}

	const data = parseJson<{
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	}>(res.text);

	if (!data?.access_token) {
		throw new GarminAuthError("Token refresh returned no access_token");
	}

	const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
	log.ok(`refreshed — ${redactToken(data.access_token)}, valid ${expiresIn}s`);
	if (data.refresh_token && data.refresh_token !== auth.refreshToken) {
		log.detail("refresh token", "rotated by Garmin; persisting the new one");
	}

	return {
		access: { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 },
		auth: {
			// Garmin may rotate the refresh token on use. Dropping the new one
			// would make the *next* refresh fail, days later, for no visible reason.
			refreshToken: data.refresh_token ?? auth.refreshToken,
			diClientId: jwtClientId(data.access_token) ?? auth.diClientId,
			savedAt: Date.now(),
		},
	};
}

export function retryAfter(headers: Record<string, string>): number | undefined {
	const raw = headers["retry-after"];
	if (!raw) return undefined;
	const seconds = Number(raw);
	return Number.isFinite(seconds) ? seconds : undefined;
}

/** The DI client id is echoed in the JWT payload; prefer it for later refreshes. */
export function jwtClientId(token: string): string | null {
	try {
		const payload = token.split(".")[1];
		if (!payload) return null;
		const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
			client_id?: string;
		};
		return claims.client_id ?? null;
	} catch {
		return null;
	}
}
