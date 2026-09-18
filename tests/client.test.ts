import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FixtureHttpClient, fakeJwt, type FixtureRule } from "../src/testing/fixture-http";
import { GarminClient, MAX_ATTEMPTS, backoffMs, isTransient } from "../src/garmin/client";
import {
	GarminApiError,
	GarminAuthError,
	GarminBlockedError,
	GarminMfaCancelledError,
	GarminMfaRequiredError,
	GarminNetworkError,
	GarminRateLimitError,
} from "../src/garmin/errors";
import { MFA_MAX_ATTEMPTS } from "../src/garmin/auth";
import { MemoryTokenStore } from "../src/garmin/tokens";

function clientWith(rules: FixtureRule[]) {
	const http = new FixtureHttpClient(rules);
	const store = new MemoryTokenStore();
	// Retries never actually sleep in a test; the waits are recorded instead.
	const waits: number[] = [];
	const wait = async (ms: number) => void waits.push(ms);
	return { http, store, waits, client: new GarminClient({ http, store, wait }) };
}

// Single-use: a later rule for the same URL is meant to take over, which is how
// sequences like "401, then refresh, then success" are expressed.
const loginOk: FixtureRule = {
	url: "/mobile/api/login",
	times: 1,
	json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST-0001" },
};
const diOk: FixtureRule = {
	url: "diauth",
	times: 1,
	json: { access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 },
};

describe("login", () => {
	it("stores the refresh token and nothing else", async () => {
		const { client, store } = clientWith([loginOk, diOk]);
		await client.login("user@example.com", "hunter2");

		const saved = await store.load();
		assert.ok(saved);
		assert.equal(saved.refreshToken, "refresh-1");
		// The password and the access token must never reach the store.
		assert.deepEqual(Object.keys(saved).sort(), ["diClientId", "refreshToken", "savedAt"]);
		assert.equal(client.isAuthenticated, true);
	});

	it("never puts the password anywhere but the login body", async () => {
		const { client, http } = clientWith([loginOk, diOk]);
		await client.login("user@example.com", "hunter2");

		const withPassword = http.requests.filter((r) => (r.body ?? "").includes("hunter2"));
		assert.equal(withPassword.length, 1);
		assert.match(withPassword[0]!.resolvedUrl, /\/mobile\/api\/login/);
	});

	it("falls through DI client IDs until one is accepted", async () => {
		const { client, http } = clientWith([
			loginOk,
			{ url: "diauth", status: 400, times: 1, json: { error: "unknown client" } },
			diOk,
		]);
		await client.login("user@example.com", "pw");
		assert.equal(http.requests.filter((r) => r.resolvedUrl.includes("diauth")).length, 2);
	});

	it("surfaces bad credentials as an auth error", async () => {
		const { client } = clientWith([
			{ url: "/mobile/api/login", json: { responseStatus: { type: "INVALID_USERNAME_PASSWORD" } } },
		]);
		await assert.rejects(() => client.login("u", "p"), GarminAuthError);
	});

	it("distinguishes an edge block from a credential problem", async () => {
		const { client } = clientWith([
			{ url: "/mobile/api/login", status: 403, text: "<html>Just a moment…</html>" },
		]);
		await assert.rejects(
			() => client.login("u", "p"),
			(err: unknown) => err instanceof GarminBlockedError && err.status === 403,
		);
	});

	it("reports rate limiting without discarding the attempt as a failure", async () => {
		const { client } = clientWith([{ url: "/mobile/api/login", status: 429, text: "" }]);
		await assert.rejects(() => client.login("u", "p"), GarminRateLimitError);
	});

	it("raises a distinct error when MFA is demanded and nothing can ask for a code", async () => {
		const { client } = clientWith([
			{
				url: "/mobile/api/login",
				json: {
					responseStatus: { type: "MFA_REQUIRED" },
					customerMfaInfo: { mfaLastMethodUsed: "email" },
				},
			},
		]);
		await assert.rejects(
			() => client.login("u", "p"),
			(err: unknown) => err instanceof GarminMfaRequiredError && err.method === "email",
		);
	});

	it("leaves a working session intact when a re-login fails", async () => {
		const { client, store } = clientWith([
			loginOk,
			diOk,
			{ url: "/mobile/api/login", status: 429, text: "" },
		]);
		await client.login("a@example.com", "pw");
		await assert.rejects(() => client.login("b@example.com", "pw"), GarminRateLimitError);

		// A 429 on a re-login should not sign the user out of the session they had.
		assert.equal(client.isAuthenticated, true);
		assert.equal((await store.load())!.refreshToken, "refresh-1");
	});
});

describe("login with MFA", () => {
	const mfaDemanded: FixtureRule = {
		url: "/mobile/api/login",
		times: 1,
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
		json: { responseStatus: { type: "INVALID_MFA_CODE" } },
	};

	it("stores the same narrow session a passwordless account would", async () => {
		const { client, store } = clientWith([mfaDemanded, codeAccepted, diOk]);
		await client.login("user@example.com", "hunter2", {
			onMfaRequired: async () => "123456",
		});

		const saved = await store.load();
		assert.equal(saved!.refreshToken, "refresh-1");
		assert.deepEqual(Object.keys(saved!).sort(), ["diClientId", "refreshToken", "savedAt"]);
		assert.equal(client.isAuthenticated, true);
	});

	it("never puts the code anywhere but the verify body", async () => {
		const { client, http } = clientWith([mfaDemanded, codeAccepted, diOk]);
		await client.login("u", "pw", { onMfaRequired: async () => "123456" });

		const withCode = http.requests.filter((r) => (r.body ?? "").includes("123456"));
		assert.equal(withCode.length, 1);
		assert.match(withCode[0]!.resolvedUrl, /\/mobile\/api\/mfa\/verifyCode/);
	});

	it("reports a cancelled prompt as its own error, having committed nothing", async () => {
		const { client, store, http } = clientWith([mfaDemanded]);
		await assert.rejects(
			() => client.login("u", "pw", { onMfaRequired: async () => null }),
			GarminMfaCancelledError,
		);

		assert.equal(client.isAuthenticated, false);
		assert.equal(await store.load(), null);
		assert.equal(http.urls.filter((u) => u.includes("diauth")).length, 0);
	});

	it("leaves a working session intact when a re-login is abandoned at the prompt", async () => {
		const { client, store } = clientWith([loginOk, diOk, mfaDemanded]);
		await client.login("a@example.com", "pw");
		await assert.rejects(
			() => client.login("b@example.com", "pw", { onMfaRequired: async () => null }),
			GarminMfaCancelledError,
		);

		assert.equal(client.isAuthenticated, true);
		assert.equal((await store.load())!.refreshToken, "refresh-1");
	});

	it("surfaces an exhausted attempt budget as an auth failure that names the reason", async () => {
		const { client } = clientWith([mfaDemanded, codeRefused]);
		await assert.rejects(
			() => client.login("u", "pw", { onMfaRequired: async () => "000000" }),
			(err: unknown) =>
				err instanceof GarminAuthError &&
				err.message.includes(String(MFA_MAX_ATTEMPTS)) &&
				err.message.includes("INVALID_MFA_CODE"),
		);
	});

	it("still distinguishes rate limiting from a bad code", async () => {
		const { client } = clientWith([
			mfaDemanded,
			{ url: "/mobile/api/mfa/verifyCode", status: 429, text: "" },
		]);
		await assert.rejects(
			() => client.login("u", "pw", { onMfaRequired: async () => "123456" }),
			GarminRateLimitError,
		);
	});
});

describe("restore", () => {
	it("loads a session from the store without touching the network", async () => {
		const store = new MemoryTokenStore();
		await store.save({ refreshToken: "r", diClientId: "c", savedAt: 1 });
		const http = new FixtureHttpClient([]);
		const client = new GarminClient({ http, store });

		assert.equal(await client.restore(), true);
		assert.equal(client.isAuthenticated, true);
		assert.equal(http.requests.length, 0);
	});

	it("reports no session when the store is empty", async () => {
		const { client } = clientWith([]);
		assert.equal(await client.restore(), false);
	});
});

describe("request", () => {
	async function signedIn(rules: FixtureRule[]) {
		const ctx = clientWith([loginOk, diOk, ...rules]);
		await ctx.client.login("u", "p");
		// Requests made during login, so assertions can count only what follows.
		return { ...ctx, afterLogin: ctx.http.requests.length };
	}

	const diauthCalls = (http: { urls: string[] }, from: number) =>
		http.urls.slice(from).filter((u) => u.includes("diauth")).length;

	it("sends a bearer token and the native app headers", async () => {
		const { client, http } = await signedIn([{ url: "/userprofile-service", json: { ok: 1 } }]);
		await client.request("/userprofile-service/socialProfile");

		const call = http.requests.at(-1)!;
		assert.equal(call.headers!["Authorization"], "Bearer access-1");
		assert.equal(call.headers!["X-Garmin-Client-Platform"], "Android");
		assert.match(call.resolvedUrl, /^https:\/\/connectapi\.garmin\.com\//);
	});

	it("refreshes once and retries when the API returns 401", async () => {
		const { client, http } = await signedIn([
			{ url: "/userprofile-service", status: 401, times: 1, json: { message: "expired" } },
			{ url: "diauth", json: { access_token: "access-2", expires_in: 3600 } },
			{ url: "/userprofile-service", json: { displayName: "someone" } },
		]);
		const profile = await client.request<{ displayName: string }>(
			"/userprofile-service/socialProfile",
		);
		assert.equal(profile.displayName, "someone");
		assert.equal(http.requests.at(-1)!.headers!["Authorization"], "Bearer access-2");
	});

	it("gives up after one retry rather than looping", async () => {
		const { client, http, afterLogin } = await signedIn([
			{ url: "/userprofile-service", status: 401, json: { message: "expired" } },
			{ url: "diauth", json: { access_token: "access-2", expires_in: 3600 } },
		]);
		await assert.rejects(() => client.request("/userprofile-service/socialProfile"), GarminAuthError);
		assert.equal(diauthCalls(http, afterLogin), 1, "refreshed exactly once, then stopped");
	});

	it("refreshes once for concurrent callers, not once each", async () => {
		const store = new MemoryTokenStore();
		await store.save({ refreshToken: "r", diClientId: "c", savedAt: 1 });
		const http = new FixtureHttpClient([
			{ url: "diauth", json: { access_token: "access-1", expires_in: 3600 } },
			{ url: "/wellness-service", json: { ok: true } },
		]);
		const client = new GarminClient({ http, store });
		await client.restore();

		await Promise.all([
			client.request("/wellness-service/a"),
			client.request("/wellness-service/b"),
			client.request("/wellness-service/c"),
		]);
		assert.equal(http.requests.filter((r) => r.resolvedUrl.includes("diauth")).length, 1);
	});

	it("signs out when the refresh token is itself rejected", async () => {
		const { client, store } = await signedIn([
			{ url: "/userprofile-service", status: 401, json: {} },
			{ url: "diauth", status: 400, json: { error: "invalid_grant" } },
		]);
		await assert.rejects(() => client.request("/userprofile-service/socialProfile"), GarminAuthError);
		assert.equal(await store.load(), null);
		assert.equal(client.isAuthenticated, false);
	});

	it("reads a JSON 403 as the API declining", async () => {
		const { client } = await signedIn([
			{ url: "/wellness-service", status: 403, json: { message: "forbidden" } },
		]);
		await assert.rejects(() => client.request("/wellness-service/x"), GarminAuthError);
	});

	it("reads a non-JSON 403 as the edge declining", async () => {
		const { client } = await signedIn([
			{ url: "/wellness-service", status: 403, text: "<html>Just a moment…</html>" },
		]);
		await assert.rejects(
			() => client.request("/wellness-service/x"),
			(err: unknown) => err instanceof GarminBlockedError,
		);
	});

	it("surfaces 429 with Retry-After", async () => {
		const { client } = await signedIn([
			{ url: "/wellness-service", status: 429, headers: { "Retry-After": "30" }, text: "" },
		]);
		await assert.rejects(
			() => client.request("/wellness-service/x"),
			(err: unknown) => err instanceof GarminRateLimitError && err.retryAfter === 30,
		);
	});

	it("surfaces other failures with the status and body", async () => {
		const { client } = await signedIn([
			{ url: "/wellness-service", status: 500, text: "boom" },
		]);
		await assert.rejects(
			() => client.request("/wellness-service/x"),
			(err: unknown) => err instanceof GarminApiError && err.status === 500,
		);
	});

	it("reports an unreachable network distinctly", async () => {
		const { client } = await signedIn([{ url: "/wellness-service", error: "offline" }]);
		await assert.rejects(() => client.request("/wellness-service/x"), GarminNetworkError);
	});

	it("returns null for an empty body rather than failing to parse", async () => {
		const { client } = await signedIn([{ url: "/wellness-service", status: 204, text: "" }]);
		assert.equal(await client.request("/wellness-service/x"), null);
	});

	it("does not reuse an access token past its lifetime", async () => {
		const { client, http } = await signedIn([
			{ url: "diauth", json: { access_token: "access-2", expires_in: 3600 } },
			{ url: "/wellness-service", json: { ok: true } },
		]);
		// The login token was issued with expires_in 3600, inside the 5 min margin
		// only at the very end; force the boundary by expiring it explicitly.
		await client.refreshNow();
		await client.request("/wellness-service/x");
		assert.equal(http.requests.at(-1)!.headers!["Authorization"], "Bearer access-2");
	});
});

describe("logout", () => {
	it("clears memory and disk", async () => {
		const { client, store } = clientWith([loginOk, diOk]);
		await client.login("u", "p");
		await client.logout();
		assert.equal(client.isAuthenticated, false);
		assert.equal(client.session, null);
		assert.equal(await store.load(), null);
	});
});

describe("session", () => {
	it("exposes the DI client id taken from the access token", async () => {
		const token = fakeJwt({ client_id: "GARMIN_CONNECT_MOBILE_IOS_DI" });
		const { client, store } = clientWith([
			loginOk,
			{ url: "diauth", json: { access_token: token, refresh_token: "r", expires_in: 60 } },
		]);
		await client.login("u", "p");
		assert.equal((await store.load())!.diClientId, "GARMIN_CONNECT_MOBILE_IOS_DI");
		assert.ok(client.session!.accessExpiresAt! > Date.now());
	});
});


describe("retrying a transient failure", () => {
	const signedIn: FixtureRule[] = [loginOk, diOk];

	it("computes a growing backoff with jitter inside a known band", () => {
		for (let attempt = 1; attempt <= 3; attempt++) {
			const base = 400 * 2 ** (attempt - 1);
			for (let i = 0; i < 50; i++) {
				const ms = backoffMs(attempt);
				assert.ok(ms >= base * 0.75 - 1 && ms <= base * 1.25 + 1, `${ms} out of band`);
			}
		}
		// Deterministic when the randomness is: the jitter is the only variable.
		assert.equal(backoffMs(1, () => 0.5), 400);
		assert.equal(backoffMs(2, () => 0.5), 800);
	});

	it("treats a dropped connection and a 5xx as worth retrying, and nothing else", () => {
		assert.equal(isTransient(0), true);
		assert.equal(isTransient(502), true);
		assert.equal(isTransient(503), true);
		for (const status of [200, 400, 401, 403, 404, 429]) {
			assert.equal(isTransient(status), false, `${status} should not be retried`);
		}
	});

	it("retries a 502 and returns the answer that follows", async () => {
		const { client, http, waits } = clientWith([
			...signedIn,
			{ url: "/usersummary-service", times: 2, status: 502, text: "bad gateway" },
			{ url: "/usersummary-service", json: { totalSteps: 8000 } },
		]);
		await client.login("user@example.com", "hunter2");

		const body = await client.request<{ totalSteps: number }>("/usersummary-service/x");
		assert.equal(body.totalSteps, 8000);
		assert.equal(http.urls.filter((u) => u.includes("/usersummary-service")).length, 3);
		assert.equal(waits.length, 2);
	});

	it("retries a dropped connection", async () => {
		const { client, http } = clientWith([
			...signedIn,
			{ url: "/hrv-service", times: 1, error: "socket hang up" },
			{ url: "/hrv-service", json: { hrvSummary: { lastNightAvg: 42 } } },
		]);
		await client.login("user@example.com", "hunter2");

		await client.request("/hrv-service/2026-09-12");
		assert.equal(http.urls.filter((u) => u.includes("/hrv-service")).length, 2);
	});

	it("gives up after MAX_ATTEMPTS rather than hammering a dead endpoint", async () => {
		const { client, http } = clientWith([
			...signedIn,
			{ url: "/metrics-service", status: 503, text: "down" },
		]);
		await client.login("user@example.com", "hunter2");

		await assert.rejects(() => client.request("/metrics-service/x"), GarminApiError);
		assert.equal(http.urls.filter((u) => u.includes("/metrics-service")).length, MAX_ATTEMPTS);
	});

	it("does not retry a rate limit, which is Garmin asking us to stop", async () => {
		const { client, http } = clientWith([
			...signedIn,
			{ url: "/wellness-service", status: 429, headers: { "retry-after": "60" } },
		]);
		await client.login("user@example.com", "hunter2");

		await assert.rejects(() => client.request("/wellness-service/x"), GarminRateLimitError);
		assert.equal(http.urls.filter((u) => u.includes("/wellness-service")).length, 1);
	});
});
