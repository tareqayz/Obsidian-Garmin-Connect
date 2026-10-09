import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FixtureHttpClient, type FixtureRule } from "./support/fixture-http";
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

	it("builds the intraday steps call with the display name", async () => {
		const { http, client } = await api([profile, { url: "/dailySummaryChart", text: "" }]);
		assert.deepEqual(await client.stepsChart("2026-09-12"), []);
		assert.match(http.urls.at(-1)!, /dailySummaryChart\/abc-123\?date=2026-09-12$/);
	});

	it("builds the Body Battery events and fitness age calls", async () => {
		const { http, client } = await api([
			{ url: "/bodyBattery/events", json: [] },
			{ url: "/fitnessage-service", json: {} },
		]);
		await client.bodyBatteryEvents("2026-09-12");
		await client.fitnessAge("2026-09-12");
		assert.deepEqual(http.urls.slice(-2), [
			"https://connectapi.garmin.com/wellness-service/wellness/bodyBattery/events/2026-09-12",
			"https://connectapi.garmin.com/fitnessage-service/fitnessage/2026-09-12",
		]);
	});

	it("keeps the whole profile for the account file", async () => {
		const { client } = await api([
			{ url: "/userprofile-service/socialProfile", json: { displayName: "abc", profileImageUrlLarge: "u" } },
		]);
		await client.socialProfile();
		assert.equal(client.profile?.profileImageUrlLarge, "u");
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

describe("Health Stats URLs", () => {
	const HOST = "https://connectapi.garmin.com";

	it("builds the daily and weekly stats ranges without the profile", async () => {
		const { http, client } = await api([{ url: "/stats/", json: [] }]);
		await client.stressDaily("2026-09-11", "2026-10-08");
		await client.stressWeekly("2026-10-08");
		await client.bodyBatteryDaily("2026-09-11", "2026-10-08");
		await client.heartRateDaily("2026-09-11", "2026-10-08");
		await client.heartRateWeekly("2026-10-08", 26);
		await client.respirationDaily("2026-09-08", "2026-10-08");
		await client.fitnessAgeDaily("2026-09-10", "2026-10-08");
		await client.fitnessAgeWeekly("2026-10-08");
		assert.deepEqual(http.urls.slice(-8), [
			`${HOST}/usersummary-service/stats/stress/daily/2026-09-11/2026-10-08`,
			`${HOST}/usersummary-service/stats/stress/weekly/2026-10-08/52`,
			`${HOST}/usersummary-service/stats/bodybattery/daily/2026-09-11/2026-10-08`,
			`${HOST}/usersummary-service/stats/heartRate/daily/2026-09-11/2026-10-08`,
			`${HOST}/usersummary-service/stats/heartRate/weekly/2026-10-08/26`,
			`${HOST}/usersummary-service/stats/respiration/daily/2026-09-08/2026-10-08`,
			`${HOST}/fitnessage-service/stats/daily/2026-09-10/2026-10-08`,
			`${HOST}/fitnessage-service/stats/weekly/2026-10-08/52`,
		]);
		assert.equal(http.urls.filter((u) => u.includes("socialProfile")).length, 0);
	});

	it("rejects a week count or page that cannot be a path segment", async () => {
		const { client } = await api([]);
		await assert.rejects(() => client.stressWeekly("2026-10-08", 0), TypeError);
		await assert.rejects(() => client.heartRateWeekly("2026-10-08", 1.5), TypeError);
		await assert.rejects(() => client.healthSnapshotList("2026-10-08", 0), TypeError);
		await assert.rejects(() => client.stressDaily("2026-9-11", "2026-10-08"), TypeError);
	});

	it("builds the day routes, heart rate zones with the web's trailing slash", async () => {
		const { http, client } = await api([{ url: HOST, json: {} }]);
		await client.heartRateZones();
		await client.respiration("2026-10-07");
		await client.healthStatusSummary("2026-10-07");
		await client.spo2Acclimation("2026-10-07");
		await client.bloodPressureDay("2026-10-07");
		await client.lifestyleLog("2026-10-07");
		await client.wellnessActivities("2026-09-24");
		await client.weightLatest("2026-10-08");
		assert.deepEqual(http.urls.slice(-8), [
			`${HOST}/biometric-service/heartRateZones/`,
			`${HOST}/wellness-service/wellness/daily/respiration/2026-10-07`,
			`${HOST}/healthstatus-service/healthstatus/summary/2026-10-07`,
			`${HOST}/wellness-service/wellness/daily/spo2acclimation/2026-10-07`,
			`${HOST}/bloodpressure-service/bloodpressure/dayview/2026-10-07`,
			`${HOST}/lifestylelogging-service/dailyLog/2026-10-07`,
			`${HOST}/wellnessactivity-service/activity/summary/2026-09-24`,
			`${HOST}/weight-service/weight/latest?date=2026-10-08&ignorePriority=true`,
		]);
	});

	it("builds the date-pair ranges", async () => {
		const { http, client } = await api([{ url: HOST, json: {} }]);
		await client.healthStatusRange("2026-10-02", "2026-10-08");
		await client.hrvDaily("2026-10-02", "2026-10-08");
		await client.weighIns("2025-10-10", "2026-10-08");
		await client.weightWeekly("2025-10-10", "2026-10-08");
		await client.weightGoal("2025-10-10", "2026-10-08");
		await client.acclimationDaily("2026-10-02", "2026-10-08");
		await client.bloodPressureRange("2026-10-02", "2026-10-08");
		await client.bloodPressureWeekly("2025-10-10", "2026-10-08");
		await client.bloodPressureLast("2026-10-08", "2026-10-08");
		assert.deepEqual(http.urls.slice(-9), [
			`${HOST}/healthstatus-service/healthstatus/summary/2026-10-02/2026-10-08`,
			`${HOST}/hrv-service/hrv/daily/2026-10-02/2026-10-08`,
			`${HOST}/weight-service/weight/range/2025-10-10/2026-10-08?includeAll=true`,
			`${HOST}/weight-service/weight/weeklyRange/2025-10-10/2026-10-08`,
			`${HOST}/goal-service/goal/user/effective/weightgoal/2025-10-10/2026-10-08`,
			`${HOST}/wellness-service/stats/daily/acclimation?fromDate=2026-10-02&untilDate=2026-10-08`,
			`${HOST}/bloodpressure-service/bloodpressure/range/2026-10-02/2026-10-08?includeAll=true`,
			`${HOST}/bloodpressure-service/bloodpressure/weeklyRange/2025-10-10/2026-10-08`,
			`${HOST}/bloodpressure-service/bloodpressure/daily/last/2026-10-08/2026-10-08`,
		]);
	});

	it("reads an empty body (HTTP 204) as no data", async () => {
		const { client } = await api([{ url: HOST, text: "" }]);
		assert.equal(await client.healthStatusSummary("2026-10-08"), null);
		assert.equal(await client.hrvDaily("2026-10-08", "2026-10-08"), null);
		assert.equal(await client.healthSnapshotDetail("2026-10-07", "x"), null);
		assert.deepEqual(await client.stressDaily("2026-10-09", "2026-10-15"), []);
		assert.deepEqual(await client.bloodPressureLast("2026-10-08", "2026-10-08"), []);
		assert.deepEqual(await client.naps("2026-10-07"), []);
	});

	it("builds the Health Snapshot calls, paging from 1 and encoding the id", async () => {
		const { http, client } = await api([{ url: "/wellnessactivity-service", json: [] }]);
		await client.healthSnapshotList("2026-10-08");
		await client.healthSnapshotList("2026-10-08", 21);
		await client.healthSnapshotDetail("2026-09-24", "0e1f-2a3b");
		await client.healthSnapshotEpochs("../x?y");
		assert.deepEqual(http.urls.slice(-4), [
			`${HOST}/wellnessactivity-service/activity/summary/list?limit=20&start=1&until=2026-10-08`,
			`${HOST}/wellnessactivity-service/activity/summary/list?limit=20&start=21&until=2026-10-08`,
			`${HOST}/wellnessactivity-service/activity/summary/2026-09-24/0e1f-2a3b`,
			`${HOST}/wellnessactivity-service/activity/epoch/..%2Fx%3Fy`,
		]);
		await assert.rejects(() => client.healthSnapshotEpochs(""), TypeError);
	});

	it("builds the 1d timeline overlays, two of them with the display name", async () => {
		const { http, client } = await api([profile, { url: HOST, json: [] }]);
		await client.naps("2026-10-07");
		await client.dailyEvents("2026-10-07");
		await client.activitiesForDay("2026-10-07");
		assert.deepEqual(http.urls.filter((u) => !u.includes("socialProfile")).slice(-3), [
			`${HOST}/sleep-service/sleep/naps/2026-10-07?includeOverlaps=true`,
			`${HOST}/wellness-service/wellness/dailyEvents/abc-123?calendarDate=2026-10-07`,
			`${HOST}/activitylist-service/activities/fordailysummary/abc-123?calendarDate=2026-10-07`,
		]);
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
