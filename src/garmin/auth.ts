import { CookieJar, parseJson, type HttpClient } from "../http";
import { redactToken, snippet, type Log } from "../log";
import { jwtClientId } from "./tokens";
import {
	DI_CLIENT_IDS,
	DI_GRANT_TYPE,
	IOS_LOGIN_UA,
	IOS_SSO_CLIENT_ID,
	basicAuth,
	endpoints,
	nativeHeaders,
	type GarminDomain,
} from "./constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type LoginOutcome =
	| { kind: "ticket"; ticket: string }
	/** Garmin wants a code, and this caller was given no way to ask for one. */
	| { kind: "mfa"; method: string }
	/** The person closed the code prompt. Nothing failed. */
	| { kind: "mfa-cancelled" }
	/** Garmin refused the code. `attempts` is how many it refused. */
	| { kind: "bad-mfa-code"; detail: string; attempts: number }
	| { kind: "bad-credentials" }
	| { kind: "captcha" }
	| { kind: "rate-limited"; detail: string }
	/** Non-JSON body or 403 — almost always a Cloudflare bot challenge. */
	| { kind: "blocked"; status: number; detail: string }
	| { kind: "transport"; detail: string }
	| { kind: "unexpected"; status: number; detail: string };

export interface DiTokens {
	accessToken: string;
	refreshToken?: string;
	clientId: string;
	expiresIn?: number;
}

interface SsoResponse {
	responseStatus?: { type?: string };
	serviceTicketId?: string;
	customerMfaInfo?: { mfaLastMethodUsed?: string };
	error?: { "status-code"?: string };
}

export interface AuthContext {
	http: HttpClient;
	jar: CookieJar;
	log: Log;
	domain: GarminDomain;
}

export interface MfaChallenge {
	/** Garmin's own token for the channel. Echoed back on the verify POST. */
	method: string;
	/** 1 for the first code asked for, 2 after one was refused, and so on. */
	attempt: number;
	/** Why the previous code was refused. Absent on the first ask. */
	error?: string;
}

/**
 * Asks a human for the code. Resolving with `null` — or with nothing but
 * whitespace — abandons the sign-in, which is how both prompts in this plugin
 * already report a cancel.
 */
export type MfaPrompt = (challenge: MfaChallenge) => Promise<string | null>;

/**
 * Codes are typed by hand and get typed wrong, so one refusal must not cost a
 * whole login attempt against a rate-limited endpoint. Three is room for a typo
 * and a re-read; asking forever is how an account gets locked.
 */
export const MFA_MAX_ATTEMPTS = 3;

/* ------------------------------------------------------------------ */
/*  Step 0 — is the SSO host reachable at all from this platform?       */
/* ------------------------------------------------------------------ */

/**
 * Credential-free reachability check against the exact endpoint we need.
 *
 * `/mobile/api/login` is POST-only, so a GET is answered by Garmin's origin
 * with a JSON 405. A Cloudflare bot challenge answers with 403 HTML instead.
 * That difference tells us whether this HTTP stack reaches Garmin at all, and
 * it costs no login attempt and no rate-limit budget.
 *
 * Context worth knowing when reading the result: the human-facing sign-in page
 * at /portal/sso/en-US/sign-in returns a 403 "Just a moment…" challenge even to
 * plain curl, while this API path lets curl straight through. The two live in
 * different protection buckets, so a challenge here would be a real signal.
 */
export async function probeSsoReachability(ctx: AuthContext): Promise<boolean> {
	const { sso, iosService } = endpoints(ctx.domain);
	const url = `${sso}/mobile/api/login`;
	ctx.log.detail("GET", `${url} (POST-only; a JSON 405 is the pass)`);

	// Same query and headers as the real login POST, so this exercises the exact
	// request shape Cloudflare will score in step 1 — only the method differs.
	const res = await ctx.http.request({
		url,
		query: { clientId: IOS_SSO_CLIENT_ID, locale: "en-US", service: iosService },
		headers: {
			"User-Agent": IOS_LOGIN_UA,
			Accept: "application/json, text/plain, */*",
			Origin: sso,
		},
	});

	if (res.status === 0) {
		ctx.log.fail(`transport error: ${res.error}`);
		return false;
	}

	ctx.log.detail("status", res.status);
	ctx.log.detail("content-type", res.headers["content-type"] ?? "(none)");
	ctx.log.detail("server", res.headers["server"] ?? "(none)");
	ctx.log.detail("cf-ray", res.headers["cf-ray"] ?? "(none)");

	const cookies = ctx.jar.ingest(res.headers);
	ctx.log.detail("set-cookie", cookies.length ? cookies.join(", ") : "(none)");

	const body = parseJson<{ title?: string; error?: string; status?: number }>(res.text);

	// Any JSON error from the origin means we got past the edge — which is the
	// only thing this step is asking. 405 is the expected one.
	if (body && res.status !== 403 && res.status !== 429) {
		const label = body.title ?? body.error ?? String(res.status);
		ctx.log.ok(`reached Garmin's origin — "${label}"`);
		if (res.status !== 405) {
			ctx.log.warn(`expected 405, got ${res.status} — endpoint contract may have moved`);
		}
		return true;
	}
	if (res.status === 403) {
		ctx.log.fail("403 — Cloudflare is challenging this HTTP client on the API path");
		ctx.log.detail("body", snippet(res.text, 160));
		return false;
	}
	if (res.status === 429) {
		ctx.log.fail("429 — this IP is rate limited; wait 15-30 min before retrying");
		return false;
	}
	ctx.log.fail("non-JSON response — a challenge page, most likely");
	ctx.log.detail("body", snippet(res.text, 160));
	return false;
}

/* ------------------------------------------------------------------ */
/*  Step 1 — mobile SSO login                                          */
/* ------------------------------------------------------------------ */

export async function mobileLogin(
	ctx: AuthContext,
	email: string,
	password: string,
): Promise<LoginOutcome> {
	const { sso, iosService } = endpoints(ctx.domain);
	const url = `${sso}/mobile/api/login`;
	ctx.log.detail("POST", url);
	ctx.log.detail("clientId", IOS_SSO_CLIENT_ID);
	ctx.log.detail("service", iosService);

	const res = await ctx.http.request({
		url,
		method: "POST",
		query: { clientId: IOS_SSO_CLIENT_ID, locale: "en-US", service: iosService },
		headers: withCookies(ctx, {
			"User-Agent": IOS_LOGIN_UA,
			Accept: "application/json, text/plain, */*",
			"Content-Type": "application/json",
			Origin: sso,
		}),
		body: JSON.stringify({ username: email, password, rememberMe: true, captchaToken: "" }),
	});

	if (res.status === 0) {
		ctx.log.fail(`transport error: ${res.error}`);
		return { kind: "transport", detail: res.error ?? "unknown" };
	}

	ctx.log.detail("status", res.status);
	ctx.log.detail("content-type", res.headers["content-type"] ?? "(none)");
	ctx.log.detail("cf-ray", res.headers["cf-ray"] ?? "(none)");
	const cookies = ctx.jar.ingest(res.headers);
	ctx.log.detail("set-cookie", cookies.length ? cookies.join(", ") : "(none)");

	if (res.status === 429) {
		ctx.log.fail("429 — Garmin is rate limiting this IP");
		return { kind: "rate-limited", detail: "HTTP 429 on login" };
	}
	if (res.status === 403) {
		ctx.log.fail("403 — Cloudflare bot challenge. This is the TLS-fingerprint wall.");
		return { kind: "blocked", status: 403, detail: snippet(res.text, 160) };
	}

	const body = parseJson<SsoResponse>(res.text);
	if (!body) {
		ctx.log.fail("response was not JSON — an HTML challenge page, most likely");
		ctx.log.detail("body", snippet(res.text, 200));
		return { kind: "blocked", status: res.status, detail: snippet(res.text, 200) };
	}

	const type = body.responseStatus?.type;
	ctx.log.detail("responseStatus.type", type ?? "(missing)");

	if (type === "MFA_REQUIRED") {
		const method = body.customerMfaInfo?.mfaLastMethodUsed ?? "email";
		ctx.log.ok(`credentials accepted; MFA required via "${method}"`);
		return { kind: "mfa", method };
	}
	if (type === "SUCCESSFUL" && body.serviceTicketId) {
		ctx.log.ok(`service ticket issued: ${body.serviceTicketId.slice(0, 8)}…`);
		return { kind: "ticket", ticket: body.serviceTicketId };
	}
	if (type === "INVALID_USERNAME_PASSWORD") {
		ctx.log.fail("Garmin rejected the email/password");
		return { kind: "bad-credentials" };
	}
	if (body.error?.["status-code"] === "429") {
		ctx.log.fail("429 reported inside the JSON body");
		return { kind: "rate-limited", detail: "429 in JSON body" };
	}
	if (type === "CAPTCHA_REQUIRED") {
		ctx.log.fail("CAPTCHA required — Garmin classified this client as a bot");
		return { kind: "captcha" };
	}

	ctx.log.warn(`unhandled response: ${snippet(res.text, 200)}`);
	return { kind: "unexpected", status: res.status, detail: snippet(res.text, 200) };
}

/* ------------------------------------------------------------------ */
/*  Step 2 — MFA                                                       */
/* ------------------------------------------------------------------ */

export async function verifyMfa(
	ctx: AuthContext,
	code: string,
	method: string,
): Promise<LoginOutcome> {
	const { sso, iosService } = endpoints(ctx.domain);
	const url = `${sso}/mobile/api/mfa/verifyCode`;
	ctx.log.detail("POST", url);
	ctx.log.detail("cookies sent", ctx.jar.size ? ctx.jar.names().join(", ") : "(none)");

	if (ctx.jar.size === 0) {
		ctx.log.warn("no SSO cookies captured — this leg needs session continuity");
	}

	const res = await ctx.http.request({
		url,
		method: "POST",
		query: { clientId: IOS_SSO_CLIENT_ID, locale: "en-US", service: iosService },
		headers: withCookies(ctx, {
			"User-Agent": IOS_LOGIN_UA,
			Accept: "application/json, text/plain, */*",
			"Content-Type": "application/json",
			Origin: sso,
		}),
		body: JSON.stringify({
			mfaMethod: method,
			mfaVerificationCode: code,
			// Sent because the app sends it, but it buys nothing across sessions:
			// Garmin answers it with a cookie, and the jar holding that cookie lives
			// only for this sign-in. Keeping it would put a second long-lived secret
			// on disk beside the refresh token to save one code entry every few
			// weeks — see the note on PersistedAuth in tokens.ts for why that trade
			// goes the other way here.
			rememberMyBrowser: true,
			reconsentList: [],
			mfaSetup: false,
		}),
	});

	if (res.status === 0) {
		ctx.log.fail(`transport error: ${res.error}`);
		return { kind: "transport", detail: res.error ?? "unknown" };
	}

	ctx.log.detail("status", res.status);
	ctx.jar.ingest(res.headers);

	if (res.status === 429) return rateLimited(ctx, "HTTP 429 on MFA verify");

	const body = parseJson<SsoResponse>(res.text);
	if (!body) {
		ctx.log.fail("MFA response was not JSON — an HTML challenge page, most likely");
		ctx.log.detail("body", snippet(res.text, 200));
		return { kind: "blocked", status: res.status, detail: snippet(res.text, 200) };
	}
	if (body.error?.["status-code"] === "429") return rateLimited(ctx, "429 in JSON body");

	const type = body.responseStatus?.type;
	ctx.log.detail("responseStatus.type", type ?? "(missing)");

	if (type === "SUCCESSFUL" && body.serviceTicketId) {
		ctx.log.ok(`service ticket issued: ${body.serviceTicketId.slice(0, 8)}…`);
		return { kind: "ticket", ticket: body.serviceTicketId };
	}

	// Anything else here is Garmin refusing the code. The credentials were
	// accepted at step 1 and the code is the only new input, so a refusal is a
	// wrong or expired code far more often than it is anything else — and calling
	// it retryable is what lets a typo cost a re-type instead of a second login
	// attempt. The refusals that are *not* retryable (429, a challenge page, a
	// dead transport) were caught above by their shape rather than by guessing at
	// Garmin's vocabulary, and `resolveMfa`'s attempt cap bounds whatever is left
	// — a dead SSO session, say, which no fresh code would fix either.
	const detail = refusalDetail(body, res.text);
	ctx.log.fail(`Garmin refused the code — ${detail}`);
	return { kind: "bad-mfa-code", detail, attempts: 1 };
}

/* ------------------------------------------------------------------ */
/*  Steps 1 + 2 — sign-in, MFA included                                */
/* ------------------------------------------------------------------ */

/**
 * The whole sign-in: the credential POST, then the MFA leg when Garmin demands
 * one. Both callers that sign in — the plugin's client and the probe — come
 * through here, so the retry budget, and the cookie continuity the verify POST
 * depends on, are defined in one place.
 *
 * Without a `prompt` the `mfa` outcome is returned untouched: that is how a
 * caller with nobody to ask learns it cannot go on.
 */
export async function loginWithMfa(
	ctx: AuthContext,
	email: string,
	password: string,
	prompt?: MfaPrompt,
): Promise<LoginOutcome> {
	const outcome = await mobileLogin(ctx, email, password);
	if (outcome.kind !== "mfa" || !prompt) return outcome;
	return resolveMfa(ctx, outcome.method, prompt);
}

async function resolveMfa(
	ctx: AuthContext,
	method: string,
	prompt: MfaPrompt,
): Promise<LoginOutcome> {
	let error: string | undefined;
	let detail = "no reason given";

	for (let attempt = 1; attempt <= MFA_MAX_ATTEMPTS; attempt++) {
		const code = (await prompt({ method, attempt, error }))?.trim();
		if (!code) {
			ctx.log.warn("cancelled at the MFA prompt");
			return { kind: "mfa-cancelled" };
		}

		const outcome = await verifyMfa(ctx, code, method);
		if (outcome.kind !== "bad-mfa-code") return outcome;

		detail = outcome.detail;
		error = `Garmin did not accept that code (${detail}).`;
	}

	ctx.log.fail(
		`${MFA_MAX_ATTEMPTS} codes refused — stopping here rather than working ` +
			"towards a locked account",
	);
	return { kind: "bad-mfa-code", detail, attempts: MFA_MAX_ATTEMPTS };
}

/** Where someone should go looking for their code. */
export function mfaCodeSource(method: string): string {
	switch (method.trim().toLowerCase().replace(/[\s_-]/g, "")) {
		case "email":
			return "your email";
		case "sms":
		case "text":
		case "phone":
			return "the text message Garmin just sent";
		case "totp":
		case "authenticator":
		case "authenticatorapp":
			return "your authenticator app";
		default:
			// Garmin's own word for a channel we have not seen. The account holder
			// knows where their codes arrive; a confident wrong guess would only send
			// them looking in the wrong place.
			return `Garmin's ${method} method`;
	}
}

/** The shortest true thing we can say about why a code bounced. */
function refusalDetail(body: SsoResponse, raw: string): string {
	const type = body.responseStatus?.type;
	if (type) return type;
	const status = body.error?.["status-code"];
	if (status) return `status-code ${status}`;
	return snippet(raw, 80) || "no reason given";
}

/* ------------------------------------------------------------------ */
/*  Step 3 — service ticket → DI bearer tokens                         */
/* ------------------------------------------------------------------ */

export async function exchangeServiceTicket(
	ctx: AuthContext,
	ticket: string,
): Promise<DiTokens | null> {
	const { diToken, iosService } = endpoints(ctx.domain);
	ctx.log.detail("POST", diToken);

	for (const clientId of DI_CLIENT_IDS) {
		const res = await ctx.http.request({
			url: diToken,
			method: "POST",
			headers: nativeHeaders({
				Authorization: basicAuth(clientId),
				Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
				"Content-Type": "application/x-www-form-urlencoded",
				"Cache-Control": "no-cache",
			}),
			body: new URLSearchParams({
				client_id: clientId,
				service_ticket: ticket,
				grant_type: DI_GRANT_TYPE,
				// Must match the service URL used at login, or DI rejects the ticket.
				service_url: iosService,
			}).toString(),
		}).catch((err: unknown) => ({
			status: 0,
			headers: {},
			text: "",
			error: String(err),
		}));

		if (res.status === 0) {
			ctx.log.fail(`${clientId} → transport error: ${res.error}`);
			continue;
		}
		if (res.status === 429) {
			ctx.log.fail(`${clientId} → 429, rate limited`);
			return null;
		}
		if (res.status < 200 || res.status >= 300) {
			ctx.log.fail(`${clientId} → ${res.status} ${snippet(res.text, 120)}`);
			continue;
		}

		const data = parseJson<{
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
		}>(res.text);
		if (!data?.access_token) {
			ctx.log.fail(`${clientId} → 200 but no access_token`);
			continue;
		}

		ctx.log.ok(`${clientId} → 200`);
		ctx.log.detail("access_token", redactToken(data.access_token));
		ctx.log.detail("refresh_token", redactToken(data.refresh_token));
		ctx.log.detail("expires_in", data.expires_in ?? "(not reported)");
		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			clientId: jwtClientId(data.access_token) ?? clientId,
			expiresIn: data.expires_in,
		};
	}

	ctx.log.fail("every DI client ID was rejected");
	return null;
}

/* ------------------------------------------------------------------ */
/*  Step 4 — does the API tier actually accept the token?              */
/* ------------------------------------------------------------------ */

/**
 * A token can come back 200 from the auth host and still be refused by
 * connectapi (account/region dependent), so success is only real once a live
 * call succeeds.
 */
export async function verifyToken(ctx: AuthContext, accessToken: string): Promise<boolean> {
	const { connectApi } = endpoints(ctx.domain);
	const url = `${connectApi}/userprofile-service/socialProfile`;
	ctx.log.detail("GET", url);

	const res = await ctx.http.request({
		url,
		headers: nativeHeaders({ Authorization: `Bearer ${accessToken}`, Accept: "application/json" }),
	});

	if (res.status === 0) {
		ctx.log.fail(`transport error: ${res.error}`);
		return false;
	}
	ctx.log.detail("status", res.status);

	if (res.status === 401 || res.status === 403) {
		ctx.log.fail("API tier rejected the token");
		return false;
	}
	if (res.status !== 200) {
		ctx.log.warn(`inconclusive: ${snippet(res.text, 160)}`);
		return false;
	}

	const profile = parseJson<{ displayName?: string; userName?: string; fullName?: string }>(res.text);
	ctx.log.ok("API tier accepted the token");
	ctx.log.detail("displayName", profile?.displayName ?? "(absent)");
	ctx.log.detail("fullName", profile?.fullName ? "(present)" : "(absent)");
	return true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function withCookies(ctx: AuthContext, headers: Record<string, string>): Record<string, string> {
	const cookie = ctx.jar.header();
	return cookie ? { ...headers, Cookie: cookie } : headers;
}

function rateLimited(ctx: AuthContext, detail: string): LoginOutcome {
	ctx.log.fail(detail);
	return { kind: "rate-limited", detail };
}
