import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FixtureHttpClient, fakeJwt } from "../src/testing/fixture-http";
import { GarminAuthError, GarminNetworkError, GarminRateLimitError } from "../src/garmin/errors";
import {
	MemoryTokenStore,
	REFRESH_MARGIN_MS,
	isFresh,
	refreshAccessToken,
	type PersistedAuth,
} from "../src/garmin/tokens";

const auth: PersistedAuth = {
	refreshToken: "refresh-1",
	diClientId: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2",
	savedAt: 0,
};

describe("isFresh", () => {
	it("treats a token inside the refresh margin as stale", () => {
		const now = 1_000_000;
		assert.equal(isFresh({ token: "t", expiresAt: now + REFRESH_MARGIN_MS - 1 }, now), false);
		assert.equal(isFresh({ token: "t", expiresAt: now + REFRESH_MARGIN_MS + 1 }, now), true);
		assert.equal(isFresh(null, now), false);
	});
});

describe("refreshAccessToken", () => {
	it("exchanges a refresh token and reads expires_in from the response", async () => {
		const http = new FixtureHttpClient([
			{ url: "diauth", json: { access_token: "access-1", expires_in: 66341 } },
		]);
		const before = Date.now();
		const result = await refreshAccessToken(http, "garmin.com", auth);

		assert.equal(result.access.token, "access-1");
		// Phase 0 saw 18h and 27h lifetimes: it must come from the payload.
		assert.ok(result.access.expiresAt >= before + 66341 * 1000);

		const sent = http.requests[0]!;
		assert.equal(sent.method, "POST");
		assert.match(sent.body!, /grant_type=refresh_token/);
		assert.match(sent.body!, /refresh_token=refresh-1/);
		assert.ok(sent.headers!["Authorization"]!.startsWith("Basic "));
	});

	it("keeps the old refresh token when Garmin does not rotate it", async () => {
		const http = new FixtureHttpClient([
			{ url: "diauth", json: { access_token: "access-1", expires_in: 3600 } },
		]);
		const result = await refreshAccessToken(http, "garmin.com", auth);
		assert.equal(result.auth.refreshToken, "refresh-1");
	});

	it("persists a rotated refresh token", async () => {
		const http = new FixtureHttpClient([
			{
				url: "diauth",
				json: { access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 },
			},
		]);
		const result = await refreshAccessToken(http, "garmin.com", auth);
		assert.equal(result.auth.refreshToken, "refresh-2");
	});

	it("prefers the client_id claimed by the new access token", async () => {
		const token = fakeJwt({ client_id: "GARMIN_CONNECT_MOBILE_ANDROID_DI_2026Q1" });
		const http = new FixtureHttpClient([
			{ url: "diauth", json: { access_token: token, expires_in: 3600 } },
		]);
		const result = await refreshAccessToken(http, "garmin.com", auth);
		assert.equal(result.auth.diClientId, "GARMIN_CONNECT_MOBILE_ANDROID_DI_2026Q1");
	});

	it("defaults the lifetime when Garmin omits expires_in", async () => {
		const http = new FixtureHttpClient([{ url: "diauth", json: { access_token: "a" } }]);
		const result = await refreshAccessToken(http, "garmin.com", auth);
		assert.ok(result.access.expiresAt > Date.now());
	});

	for (const status of [400, 401, 403]) {
		it(`treats HTTP ${status} as a dead session`, async () => {
			const http = new FixtureHttpClient([{ url: "diauth", status, json: { error: "no" } }]);
			await assert.rejects(
				() => refreshAccessToken(http, "garmin.com", auth),
				GarminAuthError,
			);
		});
	}

	it("reports rate limiting separately, with Retry-After", async () => {
		const http = new FixtureHttpClient([
			{ url: "diauth", status: 429, headers: { "Retry-After": "120" }, text: "slow down" },
		]);
		await assert.rejects(
			() => refreshAccessToken(http, "garmin.com", auth),
			(err: unknown) => err instanceof GarminRateLimitError && err.retryAfter === 120,
		);
	});

	it("reports a transport failure as a network error, not an auth error", async () => {
		const http = new FixtureHttpClient([{ url: "diauth", error: "offline" }]);
		await assert.rejects(
			() => refreshAccessToken(http, "garmin.com", auth),
			GarminNetworkError,
		);
	});

	it("rejects a 200 with no access_token", async () => {
		const http = new FixtureHttpClient([{ url: "diauth", json: { token_type: "Bearer" } }]);
		await assert.rejects(() => refreshAccessToken(http, "garmin.com", auth), GarminAuthError);
	});
});

describe("MemoryTokenStore", () => {
	it("round-trips and clears", async () => {
		const store = new MemoryTokenStore();
		assert.equal(await store.load(), null);
		await store.save(auth);
		assert.deepEqual(await store.load(), auth);
		await store.clear();
		assert.equal(await store.load(), null);
	});
});
