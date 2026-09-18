import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	MFA_MAX_ATTEMPTS,
	loginWithMfa,
	mfaCodeSource,
	verifyMfa,
	type AuthContext,
	type MfaChallenge,
	type MfaPrompt,
} from "../src/garmin/auth";
import { CookieJar } from "../src/http";
import { silentLog } from "../src/log";
import { FixtureHttpClient, type FixtureRule } from "../src/testing/fixture-http";

function contextWith(rules: FixtureRule[]) {
	const http = new FixtureHttpClient(rules);
	const ctx: AuthContext = { http, jar: new CookieJar(), log: silentLog, domain: "garmin.com" };
	return { http, ctx };
}

/** Garmin accepted the password and wants a code, and sets the SSO cookies here. */
const mfaDemanded: FixtureRule = {
	url: "/mobile/api/login",
	times: 1,
	headers: { "Set-Cookie": "GARMIN-SSO-GUID=abc123; Path=/; Secure, SESSION=s-9; Path=/" },
	json: {
		responseStatus: { type: "MFA_REQUIRED" },
		customerMfaInfo: { mfaLastMethodUsed: "EMAIL" },
	},
};
const codeAccepted: FixtureRule = {
	url: "/mobile/api/mfa/verifyCode",
	times: 1,
	json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-MFA" },
};
const codeRefused: FixtureRule = {
	url: "/mobile/api/mfa/verifyCode",
	times: 1,
	json: { responseStatus: { type: "INVALID_MFA_CODE" } },
};

const answerWith = (code: string | null): MfaPrompt => async () => code;

describe("verifyMfa", () => {
	it("returns the service ticket Garmin issues for a good code", async () => {
		const { ctx } = contextWith([codeAccepted]);
		assert.deepEqual(await verifyMfa(ctx, "123456", "EMAIL"), {
			kind: "ticket",
			ticket: "ST-MFA",
		});
	});

	it("sends the code and the method Garmin named", async () => {
		const { ctx, http } = contextWith([codeAccepted]);
		await verifyMfa(ctx, "123456", "EMAIL");

		const body = JSON.parse(http.requests.at(-1)!.body!);
		assert.equal(body.mfaVerificationCode, "123456");
		assert.equal(body.mfaMethod, "EMAIL");
	});

	it("reports a refused code as retryable, carrying Garmin's own word for it", async () => {
		const { ctx } = contextWith([codeRefused]);
		assert.deepEqual(await verifyMfa(ctx, "000000", "EMAIL"), {
			kind: "bad-mfa-code",
			detail: "INVALID_MFA_CODE",
			attempts: 1,
		});
	});

	it("still says something useful when the refusal names no reason", async () => {
		const { ctx } = contextWith([
			{ url: "verifyCode", status: 400, json: { error: { "status-code": "400" } } },
		]);
		const outcome = await verifyMfa(ctx, "000000", "EMAIL");
		assert.equal(outcome.kind, "bad-mfa-code");
		assert.match((outcome as { detail: string }).detail, /400/);
	});

	// The three below are the refusals a fresh code would not fix, so they must
	// not be mistaken for a mistyped one.
	it("reads a challenge page as the edge refusing, not a bad code", async () => {
		const { ctx } = contextWith([
			{ url: "verifyCode", status: 403, text: "<html>Just a moment…</html>" },
		]);
		const outcome = await verifyMfa(ctx, "123456", "EMAIL");
		assert.equal(outcome.kind, "blocked");
	});

	it("reads a 429 as rate limiting, by status and from inside the body", async () => {
		const { ctx: byStatus } = contextWith([{ url: "verifyCode", status: 429, text: "" }]);
		assert.equal((await verifyMfa(byStatus, "123456", "EMAIL")).kind, "rate-limited");

		const { ctx: byBody } = contextWith([
			{ url: "verifyCode", json: { error: { "status-code": "429" } } },
		]);
		assert.equal((await verifyMfa(byBody, "123456", "EMAIL")).kind, "rate-limited");
	});

	it("reads an unreachable network as transport, not a bad code", async () => {
		const { ctx } = contextWith([{ url: "verifyCode", error: "offline" }]);
		assert.equal((await verifyMfa(ctx, "123456", "EMAIL")).kind, "transport");
	});
});

describe("loginWithMfa", () => {
	it("passes a login that needs no code straight through", async () => {
		const { ctx, http } = contextWith([
			{
				url: "/mobile/api/login",
				json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-1" },
			},
		]);
		assert.deepEqual(await loginWithMfa(ctx, "u", "p", answerWith("123456")), {
			kind: "ticket",
			ticket: "ST-1",
		});
		assert.equal(http.urls.filter((u) => u.includes("verifyCode")).length, 0);
	});

	it("returns the challenge untouched when there is nobody to ask", async () => {
		const { ctx } = contextWith([mfaDemanded]);
		assert.deepEqual(await loginWithMfa(ctx, "u", "p"), { kind: "mfa", method: "EMAIL" });
	});

	it("carries the SSO cookies from the login POST into the verify POST", async () => {
		const { ctx, http } = contextWith([mfaDemanded, codeAccepted]);
		await loginWithMfa(ctx, "u", "p", answerWith("123456"));

		// This is the leg the whole flow hinges on: requestUrl keeps no jar of its
		// own, so without CookieJar the verify POST arrives with no session.
		const cookie = http.requests.at(-1)!.headers!["Cookie"] ?? "";
		assert.match(cookie, /GARMIN-SSO-GUID=abc123/);
		assert.match(cookie, /SESSION=s-9/);
	});

	it("asks again after a refusal, and does not spend a second login attempt", async () => {
		const { ctx, http } = contextWith([mfaDemanded, codeRefused, codeAccepted]);
		const seen: MfaChallenge[] = [];

		const outcome = await loginWithMfa(ctx, "u", "p", async (challenge) => {
			seen.push(challenge);
			return challenge.attempt === 1 ? "000000" : "123456";
		});

		assert.equal(outcome.kind, "ticket");
		assert.equal(seen.length, 2);
		assert.deepEqual(
			seen.map((c) => c.attempt),
			[1, 2],
		);
		assert.equal(seen[0]!.error, undefined);
		assert.match(seen[1]!.error!, /INVALID_MFA_CODE/);
		assert.equal(http.urls.filter((u) => u.includes("/mobile/api/login")).length, 1);
	});

	it("stops at the attempt cap rather than working towards a locked account", async () => {
		const { ctx, http } = contextWith([
			mfaDemanded,
			{ url: "verifyCode", json: { responseStatus: { type: "INVALID_MFA_CODE" } } },
		]);
		let asked = 0;

		const outcome = await loginWithMfa(ctx, "u", "p", async () => {
			asked++;
			return "000000";
		});

		assert.deepEqual(outcome, {
			kind: "bad-mfa-code",
			detail: "INVALID_MFA_CODE",
			attempts: MFA_MAX_ATTEMPTS,
		});
		assert.equal(asked, MFA_MAX_ATTEMPTS);
		assert.equal(http.urls.filter((u) => u.includes("verifyCode")).length, MFA_MAX_ATTEMPTS);
	});

	it("abandons a refusal a new code could not fix, without using the rest of the budget", async () => {
		const { ctx } = contextWith([mfaDemanded, { url: "verifyCode", status: 429, text: "" }]);
		let asked = 0;

		const outcome = await loginWithMfa(ctx, "u", "p", async () => {
			asked++;
			return "123456";
		});

		assert.equal(outcome.kind, "rate-limited");
		assert.equal(asked, 1);
	});

	it("treats a cancelled prompt, and an empty answer, as the same quiet stop", async () => {
		for (const answer of [null, "", "   "]) {
			const { ctx, http } = contextWith([mfaDemanded]);
			assert.deepEqual(await loginWithMfa(ctx, "u", "p", answerWith(answer)), {
				kind: "mfa-cancelled",
			});
			assert.equal(http.urls.filter((u) => u.includes("verifyCode")).length, 0);
		}
	});

	it("trims the code before sending it", async () => {
		const { ctx, http } = contextWith([mfaDemanded, codeAccepted]);
		await loginWithMfa(ctx, "u", "p", answerWith(" 123456 "));
		assert.equal(JSON.parse(http.requests.at(-1)!.body!).mfaVerificationCode, "123456");
	});
});

describe("mfaCodeSource", () => {
	it("names where the code is, whatever case Garmin uses", () => {
		assert.equal(mfaCodeSource("EMAIL"), "your email");
		assert.equal(mfaCodeSource("email"), "your email");
		assert.equal(mfaCodeSource("SMS"), "the text message Garmin just sent");
		assert.equal(mfaCodeSource("TOTP"), "your authenticator app");
		assert.equal(mfaCodeSource("AUTHENTICATOR_APP"), "your authenticator app");
	});

	it("repeats a channel it does not know rather than guessing at one", () => {
		// The account holder knows where their codes arrive; a confident wrong
		// answer would send them looking in the wrong place.
		assert.match(mfaCodeSource("PUSH_NOTIFICATION"), /PUSH_NOTIFICATION/);
	});
});
