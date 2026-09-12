import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FixtureHttpClient, type FixtureRule } from "../src/testing/fixture-http";
import { GarminApi, assertIsoDate, toIsoDate } from "../src/garmin/endpoints";
import { GarminAuthError } from "../src/garmin/errors";
import { MemoryTokenStore } from "../src/garmin/tokens";

const profile: FixtureRule = {
	url: "/userprofile-service/socialProfile",
	json: { displayName: "abc-123", fullName: "A Runner" },
};

async function api(rules: FixtureRule[]) {
	const http = new FixtureHttpClient([
		{ url: "/mobile/api/login", times: 1, json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST" } },
		{ url: "diauth", times: 1, json: { access_token: "a", refresh_token: "r", expires_in: 3600 } },
		...rules,
	]);
	const client = new GarminApi({ http, store: new MemoryTokenStore() });
	await client.login("u", "p");
	return { http, client };
}

describe("toIsoDate", () => {
	it("uses the local calendar date, not UTC", () => {
		assert.equal(toIsoDate(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
		assert.equal(toIsoDate(new Date(2026, 11, 31, 0, 15)), "2026-12-31");
	});
});

describe("assertIsoDate", () => {
	it("rejects anything Garmin would answer with an opaque 400", () => {
		assert.throws(() => assertIsoDate("2026-1-5"), TypeError);
		assert.throws(() => assertIsoDate("05/01/2026"), TypeError);
		assert.equal(assertIsoDate("2026-01-05"), "2026-01-05");
	});
});

describe("display name", () => {
	it("is fetched once and reused across calls", async () => {
		const { http, client } = await api([
			profile,
			{ url: "/usersummary-service", json: { calendarDate: "2026-09-12" } },
			{ url: "/wellness-service/wellness/dailySleepData", json: {} },
		]);
		await client.dailySummary("2026-09-12");
		await client.sleep("2026-09-12");
		const profileCalls = http.urls.filter((u) => u.includes("socialProfile"));
		assert.equal(profileCalls.length, 1);
	});

	it("is URL-encoded into the path so a hostile profile cannot inject segments", async () => {
		const { http, client } = await api([
			{ url: "/userprofile-service/socialProfile", json: { displayName: "../../admin?x=1" } },
			{ url: "/usersummary-service", json: {} },
		]);
		await client.dailySummary("2026-09-12");
		const call = http.urls.at(-1)!;
		assert.ok(call.includes("%2F"), `expected encoded slashes in ${call}`);
		assert.ok(!call.includes("/../"), `path traversal leaked into ${call}`);
	});

	it("is cleared on logout so a second account cannot inherit it", async () => {
		const { http, client } = await api([
			profile,
			{ url: "/usersummary-service", json: {} },
		]);
		await client.dailySummary("2026-09-12");
		await client.logout();
		assert.equal(client.name, null);
		assert.equal(http.urls.filter((u) => u.includes("socialProfile")).length, 1);
	});
});

describe("endpoint URLs", () => {
	it("builds the daily summary call", async () => {
		const { http, client } = await api([profile, { url: "/usersummary-service", json: {} }]);
		await client.dailySummary("2026-09-12");
		assert.equal(
			http.urls.at(-1),
			"https://connectapi.garmin.com/usersummary-service/usersummary/daily/abc-123" +
				"?calendarDate=2026-09-12",
		);
	});

	it("builds the sleep call with the non-sleep buffer Garmin expects", async () => {
		const { http, client } = await api([profile, { url: "/dailySleepData", json: {} }]);
		await client.sleep("2026-09-12");
		assert.equal(
			http.urls.at(-1),
			"https://connectapi.garmin.com/wellness-service/wellness/dailySleepData/abc-123" +
				"?date=2026-09-12&nonSleepBufferMinutes=60",
		);
	});

	it("builds the heart rate call", async () => {
		const { http, client } = await api([profile, { url: "/dailyHeartRate", json: {} }]);
		await client.heartRate("2026-09-12");
		assert.match(http.urls.at(-1)!, /dailyHeartRate\/abc-123\?date=2026-09-12$/);
	});

	it("builds day-scoped calls that need no display name", async () => {
		const { http, client } = await api([
			{ url: "/dailyStress", json: {} },
			{ url: "/hrv-service", json: {} },
			{ url: "/trainingreadiness", json: [] },
		]);
		await client.stress("2026-09-12");
		await client.hrv("2026-09-12");
		await client.trainingReadiness("2026-09-12");
		assert.deepEqual(http.urls.slice(-3), [
			"https://connectapi.garmin.com/wellness-service/wellness/dailyStress/2026-09-12",
			"https://connectapi.garmin.com/hrv-service/hrv/2026-09-12",
			"https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/2026-09-12",
		]);
		// None of them should have needed the profile.
		assert.equal(http.urls.filter((u) => u.includes("socialProfile")).length, 0);
	});

	it("defaults a body battery range to a single day", async () => {
		const { http, client } = await api([{ url: "/bodyBattery", json: [] }]);
		await client.bodyBattery("2026-09-12");
		assert.match(http.urls.at(-1)!, /startDate=2026-09-12&endDate=2026-09-12$/);
	});

	it("builds the resting heart rate call with metricId 60", async () => {
		const { http, client } = await api([profile, { url: "/userstats-service", json: {} }]);
		await client.restingHeartRate("2026-09-12");
		assert.match(http.urls.at(-1)!, /fromDate=2026-09-12&untilDate=2026-09-12&metricId=60$/);
	});
});

describe("activities", () => {
	it("passes paging through and tolerates a null body", async () => {
		const { http, client } = await api([{ url: "/activitylist-service", text: "" }]);
		assert.deepEqual(await client.activities(20, 10), []);
		assert.match(http.urls.at(-1)!, /\?start=20&limit=10$/);
	});

	it("rejects nonsense paging before it reaches Garmin", async () => {
		const { client } = await api([]);
		await assert.rejects(() => client.activities(-1), TypeError);
		await assert.rejects(() => client.activities(0, 0), TypeError);
	});
});

describe("privacy-protected summaries", () => {
	it("are reported as an auth problem, not as empty data", async () => {
		const { client } = await api([
			profile,
			{ url: "/usersummary-service", json: { privacyProtected: true } },
		]);
		await assert.rejects(() => client.dailySummary("2026-09-12"), GarminAuthError);
	});
});
