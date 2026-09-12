import { Platform, apiVersion } from "obsidian";
import { CookieJar, parseJson, type HttpClient } from "./http";
import { ProbeLog, redactEmail, snippet } from "./log";
import type { GarminDomain } from "./garmin/constants";
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
	log.section("Platform");
	log.kv("when", new Date().toISOString());
	log.kv("obsidian api", apiVersion);
	log.kv("isDesktopApp", Platform.isDesktopApp);
	log.kv("isMobileApp", Platform.isMobileApp);
	log.kv("isIosApp", Platform.isIosApp);
	log.kv("isAndroidApp", Platform.isAndroidApp);
	log.kv("isMacOS / isWin", `${Platform.isMacOS} / ${Platform.isWin}`);
	log.kv("webview UA", snippet(navigator.userAgent, 120));
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
	log.section("Network fingerprint (tls.peet.ws)");
	log.kv("sends", "the iOS User-Agent only — no credentials");

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
	log.kv("public IP", maskIp(fp.ip));
	log.kv("HTTP version", fp.http_version ?? "(unknown)");
	log.kv("UA server saw", snippet(fp.user_agent ?? "(none)", 110));
	log.kv("JA3 hash", fp.tls?.ja3_hash ?? "(unknown)");
	log.kv("JA4", fp.tls?.ja4 ?? "(unknown)");
	log.kv("HTTP/2 akamai", fp.http2?.akamai_fingerprint_hash ?? "(n/a)");
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

	log.section("Step 0 — is the login endpoint reachable? (no credentials)");
	log.kv("account", redactEmail(opts.email));
	log.kv("domain", opts.domain);
	await probeSsoReachability(ctx);

	log.section("Step 1 — SSO login (mobile/iOS flow)");
	let outcome: LoginOutcome = await mobileLogin(ctx, opts.email, opts.password);

	if (outcome.kind === "mfa") {
		log.section("Step 2 — MFA");
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

	log.section("Step 3 — service ticket → DI bearer token");
	const tokens = await exchangeServiceTicket(ctx, outcome.ticket);
	if (!tokens) return summarise(log, "failed");

	log.section("Step 4 — authenticated API call");
	const accepted = await verifyToken(ctx, tokens.accessToken);
	if (!accepted) return summarise(log, "failed");

	log.kv("cookies collected", ctx.jar.size ? ctx.jar.names().join(", ") : "(none)");
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
	log.section("Verdict");
	log.kv("result", verdict.toUpperCase());
	if (outcome && "detail" in outcome && outcome.detail) log.kv("detail", outcome.detail);
	log.line();
	for (const line of ADVICE[verdict]) log.line(`  ${line}`);
	return verdict;
}

function maskIp(ip: string | undefined): string {
	if (!ip) return "(unknown)";
	const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
	return v4 ? `${v4[1]}.x` : "(captured, masked)";
}
