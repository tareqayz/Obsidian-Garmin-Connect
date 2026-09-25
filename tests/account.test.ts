import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fetchAccount, mapAccount, type AccountSource } from "../src/sync/account";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";

/* Shapes as captured from connect.garmin.com on 2026-09-25, names and ids changed. */
const lactate = [
	{ calendarDate: "2026-09-19T11:29:57.527", speed: 0.37222118, hearRate: null },
	{ calendarDate: "2026-09-19T11:29:57.527", hearRate: 182 },
];

describe("mapAccount", () => {
	it("keeps the name and avatar URLs and nothing else from the profile", () => {
		assert.deepEqual(
			mapAccount({
				profile: {
					displayName: "abc",
					fullName: "A Runner",
					userName: "someone@example.com",
					profileImageUrlLarge: "https://x/l.png",
					profileId: 42,
				},
			}),
			{ displayName: "abc", fullName: "A Runner", avatar: { large: "https://x/l.png" } },
		);
		assert.equal(mapAccount({}), null);
	});

	it("joins the lactate threshold rows and reads speed in tenths", () => {
		const account = mapAccount({ lactate }, "metric")!;
		assert.deepEqual(account.lactateThreshold, {
			date: "2026-09-19",
			heartRate: 182,
			speed: 3.722,
			pace: "4:29",
		});
	});

	it("falls back to user settings for the threshold heart rate", () => {
		const account = mapAccount(
			{ lactate: [{ speed: 0.37 }], settings: { userData: { lactateThresholdHeartRate: 180 } } },
			"metric",
		)!;
		assert.equal(account.lactateThreshold?.heartRate, 180);
	});

	it("maps FTP, economy, ability, device, events and records", () => {
		const account = mapAccount({
			device: { lastUsedDeviceName: "Forerunner 970", imageUrl: "https://res/x.png", lastUsedDeviceUploadTime: 0 },
			ftpRunning: [{ calendarDate: "2026-09-19T11:22:14.0", functionalThresholdPower: 354, powerToWeight: 5.2058 }],
			runningEconomy: { calendarDate: "2026-09-25", score: 223, classification: "INTERMEDIATE" },
			cyclingAbility: { calendarDate: "2026-09-25", aerobicEndurance: 18, profileType: "NOT_AVAILABLE", deviceId: null },
			plans: {
				trainingPlanList: [
					{ name: "Old", trainingStatus: { statusKey: "Completed" } },
					{ name: "Current", trainingStatus: { statusKey: "Active" }, trainingType: { typeKey: "Triathlon" }, durationInWeeks: 12 },
				],
			},
			events: [
				{
					eventName: "70.3",
					date: "2026-10-24",
					eventType: "multi_sport_triathlon",
					completionTarget: { value: 113000, unit: "meter" },
					eventCustomization: { isPrimaryEvent: false, customGoal: { value: 20700, unit: "second" } },
				},
			],
			records: [
				{ typeId: 3, value: 1180.4, actStartDateTimeInGMTFormatted: "2026-03-09T16:16:11.0", activityId: 7 },
				{ typeId: 12, value: 44502, actStartDateTimeInGMTFormatted: "2025-09-16T00:00:00.0", activityId: 0 },
			],
		})!;
		assert.deepEqual(account.device, {
			name: "Forerunner 970",
			imageUrl: "https://res/x.png",
			lastUpload: "1970-01-01T00:00:00.000Z",
		});
		assert.deepEqual(account.ftp, { running: { date: "2026-09-19", watts: 354, wattsPerKg: 5.21 } });
		assert.deepEqual(account.runningEconomy, { date: "2026-09-25", score: 223, classification: "INTERMEDIATE" });
		assert.deepEqual(account.cyclingAbility, { date: "2026-09-25", aerobicEndurance: 18, profileType: "NOT_AVAILABLE" });
		assert.deepEqual(account.trainingPlans, [{ name: "Current", type: "Triathlon", status: "Active", weeks: 12 }]);
		assert.deepEqual(account.events, [
			{ name: "70.3", date: "2026-10-24", type: "multi_sport_triathlon", primary: false, distanceMetres: 113000, goalSeconds: 20700 },
		]);
		assert.deepEqual(account.personalRecords, [
			{ type: "run_5k", value: 1180.4, date: "2026-03-09", activityId: 7 },
			{ type: "steps_best_day", value: 44502, date: "2025-09-16" },
		]);
	});
});

function source(over: Partial<AccountSource> = {}): AccountSource & { calls: number } {
	const s = {
		calls: 0,
		profile: { displayName: "abc" },
		async socialProfile() { s.calls++; return { displayName: "abc" }; },
		async userSettings() { s.calls++; return {}; },
		async lastUsedDevice() { s.calls++; return null; },
		async lactateThreshold() { s.calls++; return lactate; },
		async powerToWeight() { s.calls++; return []; },
		async runningEconomy() { s.calls++; return null; },
		async cyclingAbility() { s.calls++; return null; },
		async trainingPlans() { s.calls++; return null; },
		async upcomingEvents() { s.calls++; return []; },
		async personalRecords() { s.calls++; return []; },
		...over,
	};
	return s;
}

describe("fetchAccount", () => {
	it("reuses the session's profile and counts only real requests", async () => {
		const src = source();
		const got = await fetchAccount(src, "2026-09-25", "metric");
		assert.equal(got.requests, 10);
		assert.equal(src.calls, 10);
		assert.equal(got.account?.lactateThreshold?.heartRate, 182);
	});

	it("keeps going past one failing endpoint", async () => {
		const got = await fetchAccount(
			source({ runningEconomy: async () => { throw new GarminApiError("HTTP 500", 500, ""); } }),
			"2026-09-25",
			"metric",
		);
		assert.equal(got.fatal, undefined);
		assert.match(got.warnings.join(), /runningEconomy/);
		assert.ok(got.account?.lactateThreshold);
	});

	it("stops at a rate limit", async () => {
		const got = await fetchAccount(
			source({ userSettings: async () => { throw new GarminRateLimitError("slow down"); } }),
			"2026-09-25",
			"metric",
		);
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.equal(got.requests, 1);
	});
});
