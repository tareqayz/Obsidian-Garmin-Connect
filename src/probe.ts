import { Platform, apiVersion } from "obsidian";
import { CookieJar, parseJson, type HttpClient } from "./http";
import { ProbeLog, redactEmail, silentLog, snippet } from "./log";
import type { GarminDomain } from "./garmin/constants";
import type { GarminApi } from "./garmin/endpoints";
import { toIsoDate } from "./garmin/endpoints";
import {
	GarminAuthError,
	GarminBlockedError,
	GarminMfaRequiredError,
	GarminRateLimitError,
} from "./garmin/errors";
import { IOS_LOGIN_UA } from "./garmin/constants";
import {
	exchangeServiceTicket,
	mobileLogin,
	probeSsoReachability,
	verifyMfa,
	verifyToken,
	type AuthContext,
	type LoginOutcome,
} from "./garmin/auth";

export type Verdict =
	| "success"
	| "blocked"
	| "rate-limited"
	| "bad-credentials"
	| "cancelled"
	| "failed";

/* ------------------------------------------------------------------ */
/*  Platform report                                                    */
/* ------------------------------------------------------------------ */

export function reportPlatform(log: ProbeLog): void {
	log.step("Platform");
	log.detail("when", new Date().toISOString());
	log.detail("obsidian api", apiVersion);
	log.detail("isDesktopApp", Platform.isDesktopApp);
	log.detail("isMobileApp", Platform.isMobileApp);
	log.detail("isIosApp", Platform.isIosApp);
	log.detail("isAndroidApp", Platform.isAndroidApp);
	log.detail("isMacOS / isWin", `${Platform.isMacOS} / ${Platform.isWin}`);
	log.detail("webview UA", snippet(navigator.userAgent, 120));
	log.line();
	log.line(
		Platform.isMobileApp
			? "  Running on the mobile app: HTTP goes through the OS network stack."
			: "  Running on the desktop app: HTTP goes through Electron/Chromium.",
	);
}

/* ------------------------------------------------------------------ */
/*  Network fingerprint                                                */
/* ------------------------------------------------------------------ */

interface PeetResponse {
	ip?: string;
	http_version?: string;
	user_agent?: string;
	tls?: { ja3_hash?: string; ja4?: string; peetprint_hash?: string };
	http2?: { akamai_fingerprint_hash?: string };
}

/**
 * Asks a third-party echo service what this platform's HTTP stack looks like on
 * the wire. Sends no credentials — only the iOS User-Agent we would use against
 * Garmin. This is what decides the project: Garmin's edge fingerprints TLS, and
 * python-garminconnect needs curl_cffi to forge it. We cannot forge anything
 * from Obsidian, so the question is whether what we send passes as-is.
 */
export async function runFingerprintProbe(http: HttpClient, log: ProbeLog): Promise<void> {
	log.step("Network fingerprint (tls.peet.ws)");
	log.detail("sends", "the iOS User-Agent only — no credentials");

	const res = await http.request({
		url: "https://tls.peet.ws/api/all",
		headers: { "User-Agent": IOS_LOGIN_UA, Accept: "application/json" },
	});

	if (res.status === 0) {
		log.fail(`transport error: ${res.error}`);
		return;
	}
	if (res.status !== 200) {
		log.fail(`HTTP ${res.status} — ${snippet(res.text, 160)}`);
		return;
	}

	const fp = parseJson<PeetResponse>(res.text);
	if (!fp) {
		log.fail("response was not JSON");
		return;
	}

	const uaMatches = fp.user_agent === IOS_LOGIN_UA;
	log.detail("public IP", maskIp(fp.ip));
	log.detail("HTTP version", fp.http_version ?? "(unknown)");
	log.detail("UA server saw", snippet(fp.user_agent ?? "(none)", 110));
	log.detail("JA3 hash", fp.tls?.ja3_hash ?? "(unknown)");
	log.detail("JA4", fp.tls?.ja4 ?? "(unknown)");
	log.detail("HTTP/2 akamai", fp.http2?.akamai_fingerprint_hash ?? "(n/a)");
	log.line();

	if (uaMatches) {
		log.ok("requestUrl honoured our User-Agent override");
	} else {
		log.fail("requestUrl did NOT honour the User-Agent override");
		log.line("    Garmin will see Obsidian, not the iOS app. Expect a challenge.");
	}
	log.line("    Record the JA4 on each platform — a desktop/mobile mismatch here is");
	log.line("    the likeliest explanation for one working and the other not.");
}

/* ------------------------------------------------------------------ */
/*  Garmin login                                                       */
/* ------------------------------------------------------------------ */

export interface GarminProbeOptions {
	email: string;
	password: string;
	domain: GarminDomain;
	/** Resolve with the code, or null if the user cancels. */
	requestMfaCode: (method: string) => Promise<string | null>;
}

export async function runGarminProbe(
	http: HttpClient,
	log: ProbeLog,
	opts: GarminProbeOptions,
): Promise<Verdict> {
	const ctx: AuthContext = { http, jar: new CookieJar(), log, domain: opts.domain };

	log.step("Step 0 — is the login endpoint reachable? (no credentials)");
	log.detail("account", redactEmail(opts.email));
	log.detail("domain", opts.domain);
	await probeSsoReachability(ctx);

	log.step("Step 1 — SSO login (mobile/iOS flow)");
	let outcome: LoginOutcome = await mobileLogin(ctx, opts.email, opts.password);

	if (outcome.kind === "mfa") {
		log.step("Step 2 — MFA");
		const code = await opts.requestMfaCode(outcome.method);
		if (!code) {
			log.warn("cancelled at the MFA prompt");
			return "cancelled";
		}
		outcome = await verifyMfa(ctx, code.trim(), outcome.method);
	}

	if (outcome.kind !== "ticket") {
		return summarise(log, verdictFor(outcome), outcome);
	}

	log.step("Step 3 — service ticket → DI bearer token");
	const tokens = await exchangeServiceTicket(ctx, outcome.ticket);
	if (!tokens) return summarise(log, "failed");

	log.step("Step 4 — authenticated API call");
	const accepted = await verifyToken(ctx, tokens.accessToken);
	if (!accepted) return summarise(log, "failed");

	log.detail("cookies collected", ctx.jar.size ? ctx.jar.names().join(", ") : "(none)");
	return summarise(log, "success");
}

/* ------------------------------------------------------------------ */
/*  Verdict                                                            */
/* ------------------------------------------------------------------ */

function verdictFor(outcome: LoginOutcome): Verdict {
	switch (outcome.kind) {
		case "bad-credentials":
			return "bad-credentials";
		case "rate-limited":
			return "rate-limited";
		case "captcha":
		case "blocked":
			return "blocked";
		default:
			return "failed";
	}
}

const ADVICE: Record<Verdict, string[]> = {
	success: [
		"Obsidian's HTTP stack can authenticate against Garmin on this platform.",
		"Run the same probe on the other platform before committing to the design.",
	],
	blocked: [
		"Garmin's edge refused this HTTP client — the TLS/bot wall, not your password.",
		"This is the outcome the project hinges on. Two things to check:",
		"  - Did step 0 pass? If step 0 got a 405 but step 1 got a 403, the path is open",
		"    and it is the credential POST that is being scored. Retrying will not help;",
		"    the request needs to look more like the app (headers, HTTP version, TLS).",
		"  - Compare the JA4 from the fingerprint probe on desktop vs mobile. If only one",
		"    platform is blocked, ship for that one first.",
	],
	"rate-limited": [
		"Rate limited (429). Not a verdict — wait 15-30 minutes and re-run.",
		"Repeated attempts from one IP make this worse, so do not retry in a loop.",
	],
	"bad-credentials": [
		"Garmin rejected the email/password. Note that repeated failures can lock the",
		"account, so fix the credentials before running again.",
	],
	cancelled: ["Stopped at the MFA prompt. Re-run when you have the code to hand."],
	failed: [
		"Login did not complete. Read the step that failed above.",
		"If step 3 failed but step 1 succeeded, the DI client IDs have rotated —",
		"re-check DI_CLIENT_IDS against python-garminconnect master.",
	],
};

function summarise(log: ProbeLog, verdict: Verdict, outcome?: LoginOutcome): Verdict {
	log.step("Verdict");
	log.detail("result", verdict.toUpperCase());
	if (outcome && "detail" in outcome && outcome.detail) log.detail("detail", outcome.detail);
	log.line();
	for (const line of ADVICE[verdict]) log.line(`  ${line}`);
	return verdict;
}

function maskIp(ip: string | undefined): string {
	if (!ip) return "(unknown)";
	const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
	return v4 ? `${v4[1]}.x` : "(captured, masked)";
}

/* ------------------------------------------------------------------ */
/*  Session persistence                                                */
/* ------------------------------------------------------------------ */

/**
 * Exercises everything phase 1 added, against the live service: the token store,
 * a simulated cold start, a refresh performed from the refresh token alone, and
 * a typed endpoint call on the other side of it.
 *
 * Fixtures can prove the logic; only this can prove Garmin agrees.
 */
export async function runPersistenceProbe(
	api: GarminApi,
	log: ProbeLog,
	credentials: { email: string; password: string },
): Promise<Verdict> {
	api.setLog(log);
	try {
		log.step("Step A — look for a saved session");
		let restored = await api.restore();
		if (restored) {
			log.ok("found a saved refresh token — no sign-in needed");
		} else {
			log.warn("no saved session");
			log.step("Step B — sign in (costs one login attempt)");
			if (!credentials.email || !credentials.password) {
				log.fail("email and password are required for the first run");
				return "cancelled";
			}
			log.detail("account", redactEmail(credentials.email));
			await api.login(credentials.email, credentials.password);
			log.ok("signed in; refresh token written to data.json");
			restored = true;
		}

		log.step("Step C — simulate a cold start");
		await api.restore();
		log.ok("in-memory access token discarded; only the stored refresh token remains");
		log.detail("session saved at", new Date(api.session?.savedAt ?? 0).toLocaleString());

		log.step("Step D — refresh from the refresh token alone");
		await api.refreshNow();
		const expiresAt = api.session?.accessExpiresAt;
		log.detail(
			"access token valid until",
			expiresAt ? new Date(expiresAt).toLocaleString() : "(unknown)",
		);

		log.step("Step E — authenticated calls after the refresh");
		const profile = await api.socialProfile();
		log.ok(`socialProfile → displayName ${profile.displayName ? "present" : "absent"}`);

		const today = toIsoDate();
		const summary = await api.dailySummary(today);
		log.ok(`dailySummary(${today}) → ${summary.calendarDate ?? "(no calendarDate)"}`);
		log.detail("steps", summary.totalSteps ?? "(none)");
		log.detail("resting HR", summary.restingHeartRate ?? "(none)");

		log.step("Verdict");
		log.detail("result", "SUCCESS");
		log.line();
		log.line("  A stored refresh token survives a restart and mints working access");
		log.line("  tokens. The sync engine can be built on this.");
		return "success";
	} catch (err) {
		return classifyFailure(err, log);
	} finally {
		api.setLog(silentLog);
	}
}

function classifyFailure(err: unknown, log: ProbeLog): Verdict {
	log.step("Verdict");
	if (err instanceof GarminRateLimitError) {
		log.fail(err.message);
		log.line();
		log.line("  Wait 15-30 minutes. Not a verdict on the design.");
		return "rate-limited";
	}
	if (err instanceof GarminBlockedError) {
		log.fail(err.message);
		log.line();
		log.line("  Garmin's edge refused the client. Re-run the fingerprint check and");
		log.line("  compare the JA4 against the values recorded in the README.");
		return "blocked";
	}
	if (err instanceof GarminMfaRequiredError) {
		log.fail(err.message);
		log.line();
		log.line("  MFA is on this account and the MFA leg is not wired up yet.");
		return "failed";
	}
	if (err instanceof GarminAuthError) {
		log.fail(err.message);
		return "bad-credentials";
	}
	log.fail(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
	return "failed";
}
