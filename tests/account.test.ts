import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fetchAccount, mapAccount, mergeAccount, type AccountSource } from "../src/sync/account";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";
import { LATEST_2026_10_11 } from "./ftp-fixture";

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

	it("joins the lactate threshold rows and reads speed in tenths, kept to 5 dp as the index keeps it", () => {
		const account = mapAccount({ lactate }, "metric")!;
		assert.deepEqual(account.lactateThreshold, {
			date: "2026-09-19",
			heartRate: 182,
			speed: 3.72221,
			pace: "4:29",
		});
		assert.equal(mapAccount({ lactate }, "imperial")!.lactateThreshold?.pace, "7:12");
	});

	it("falls back to user settings for the threshold heart rate", () => {
		const account = mapAccount(
			{ lactate: [{ speed: 0.37 }], settings: { userData: { lactateThresholdHeartRate: 180 } } },
			"metric",
		)!;
		assert.equal(account.lactateThreshold?.heartRate, 180);
	});

	it("reads the sex Garmin grades VO2 Max and FTP by, and nothing else from settings", () => {
		assert.deepEqual(mapAccount({ settings: { userData: { gender: "MALE", birthDate: "2003-01-01", height: 169 } } }), {
			sex: "male",
		});
		assert.equal(mapAccount({ settings: { userData: { gender: "FEMALE" } } })?.sex, "female");
		assert.equal(mapAccount({ settings: { userData: { gender: "OTHER" } } }), null);
	});

	it("files each power-to-weight row under its sport, cross-country skiing included", () => {
		const account = mapAccount({
			ftp: [
				{ sport: "CYCLING", calendarDate: "2025-11-02T23:00:11.5", functionalThresholdPower: 274, powerToWeight: 4.0294 },
				{ sport: "CROSS_COUNTRY_SKIING", calendarDate: "2025-11-02T23:00:11.5", functionalThresholdPower: 111, powerToWeight: 1.6324, isStale: true },
				{ sport: "RUNNING", calendarDate: "2026-09-19T11:22:14.0", functionalThresholdPower: 354, powerToWeight: 5.2059 },
				{ sport: "ROWING", functionalThresholdPower: 200 },
			],
		})!;
		assert.deepEqual(account.ftp, {
			cycling: { date: "2025-11-02", watts: 274, wattsPerKg: 4.03 },
			xcSkiing: { date: "2025-11-02", watts: 111, wattsPerKg: 1.63, stale: true },
			running: { date: "2026-09-19", watts: 354, wattsPerKg: 5.21 },
		});
	});

	it("keeps what the FTP page's Current needs: the FTP's own day, the weight and its day, Garmin's staleness", () => {
		assert.deepEqual(mapAccount({ ftp: [...LATEST_2026_10_11] })!.ftp, {
			// "Thursday, October 8" · "4.03" · "Cycling FTP 274 W Oct 13, 2025" · "Weight 68.0 kg Oct 8".
			cycling: { date: "2026-10-08", watts: 274, wattsPerKg: 4.03, ftpDate: "2025-10-13", weight: 68, weightDate: "2026-10-08", stale: false },
			// Set 2025-08-02, more than a year old: "No Cross Country Skiing FTP data in the past year".
			xcSkiing: { date: "2026-10-08", watts: 111, wattsPerKg: 1.63, ftpDate: "2025-08-02", weight: 68, weightDate: "2026-10-08", stale: true },
			running: { date: "2026-10-08", watts: 354, wattsPerKg: 5.21, ftpDate: "2026-09-19", weight: 68, weightDate: "2026-10-08", stale: false },
		});
	});

	it("rounds W/kg half up to 2 dp (4.0294 → 4.03, where truncating gives 4.02) and the weight to 1 dp", () => {
		assert.equal(mapAccount({ ftp: [LATEST_2026_10_11[1]!] })!.ftp!.cycling!.wattsPerKg, 4.03);
		const oct13 = mapAccount({ ftp: [{ sport: "CYCLING", functionalThresholdPower: 274, powerToWeight: 274 / 67.199, weight: 67.199 }] })!.ftp!.cycling!;
		assert.deepEqual([oct13.wattsPerKg, oct13.weight], [4.08, 67.2]);
	});

	it("dates an as-of answer by its own times: latest/2026-10-07 is the 2025-11-02 weigh-in's, running's FTP newer than it", () => {
		// ref/performance-stats/ftp/api-samples/p2w-latest-2026-10-07.json (origin "power" on the running row).
		const ftp = mapAccount({
			ftp: [
				{ calendarDate: "2025-11-02T23:00:11.5", origin: "weight", sport: "CYCLING", functionalThresholdPower: 274, weight: 68, powerToWeight: 4.029411764705882, ftpCreateTime: "2025-10-13T11:09:17.547", weightCreateTime: "2025-11-02T23:00:11.5", isStale: false },
				{ calendarDate: "2026-09-19T11:22:14.0", origin: "power", sport: "RUNNING", functionalThresholdPower: 354, weight: 68, powerToWeight: 5.205882352941177, ftpCreateTime: "2026-09-19T11:22:14.0", weightCreateTime: "2025-11-02T23:00:11.5", isStale: false },
			],
		})!.ftp!;
		assert.deepEqual(ftp.cycling, { date: "2025-11-02", watts: 274, wattsPerKg: 4.03, ftpDate: "2025-10-13", weight: 68, weightDate: "2025-11-02", stale: false });
		assert.deepEqual([ftp.running!.date, ftp.running!.ftpDate, ftp.running!.weightDate], ["2026-09-19", "2026-09-19", "2025-11-02"]);
	});

	it("leaves out what Garmin sends as null or nonsense", () => {
		const cycling = mapAccount({ ftp: [{ sport: "CYCLING", functionalThresholdPower: 274, weight: null, ftpCreateTime: null, weightCreateTime: "", isStale: "yes" }] })!.ftp!.cycling;
		assert.deepEqual(cycling, { watts: 274 });
		assert.deepEqual(mapAccount({ ftp: [{ sport: "CYCLING", functionalThresholdPower: 274, weight: 0 }] })!.ftp!.cycling, { watts: 274 });
	});

	it("maps FTP, economy, ability, device, events and records", () => {
		const account = mapAccount({
			device: { lastUsedDeviceName: "Forerunner 970", imageUrl: "https://res/x.png", lastUsedDeviceUploadTime: 0 },
			ftp: [{ sport: "RUNNING", calendarDate: "2026-09-19T11:22:14.0", functionalThresholdPower: 354, powerToWeight: 5.2058 }],
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
				{
					typeId: 5,
					value: 6333.795,
					activityStartDateTimeLocalFormatted: "2025-08-17T17:10:02.0",
					actStartDateTimeInGMTFormatted: "2025-08-18T00:10:02.0",
					activityId: 9,
				},
				{ typeId: 30, value: 100, prStartTimeLocalFormatted: "2026-01-02T08:00:00.0", activityId: 11 },
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
			{ type: "run_5k", typeId: 3, value: 1180.4, date: "2026-03-09", activityId: 7 },
			{ type: "steps_best_day", typeId: 12, value: 44502, date: "2025-09-16" },
			// The local day, not the GMT one: the app shows the 17th.
			{ type: "run_half_marathon", typeId: 5, value: 6333.795, date: "2025-08-17", activityId: 9 },
			{ type: "strength_squat", typeId: 30, value: 100, date: "2026-01-02", activityId: 11 },
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
		// One unfiltered power-to-weight call serves every sport's FTP.
		assert.equal(got.requests, 9);
		assert.equal(src.calls, 9);
		assert.equal(got.account?.lactateThreshold?.heartRate, 182);
	});

	it("takes the watch the sync already asked for, rather than asking again", async () => {
		const src = source();
		const got = await fetchAccount(src, "2026-09-25", "metric", undefined, { device: { lastUsedDeviceName: "Forerunner 965" } });
		assert.equal(got.requests, 8);
		assert.equal(src.calls, 8);
		assert.equal(got.account?.device?.name, "Forerunner 965");
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

	it("reports a rate limit as fatal, keeping what the other requests brought", async () => {
		// Asked all at once, so the rest are already on their way when one 429s;
		// the client's throttle is what holds them back while Garmin wants a pause.
		const got = await fetchAccount(
			source({ userSettings: async () => { throw new GarminRateLimitError("slow down"); } }),
			"2026-09-25",
			"metric",
		);
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.ok(got.account, "the payloads that came back are still mapped");
	});
});

describe("mergeAccount", () => {
	const previous = {
		displayName: "abc",
		device: { name: "Forerunner 965", lastUpload: "2026-10-20T06:00:00.000Z" },
		personalRecords: [{ type: "fastest_5k", value: 1_380 }],
		lactateThreshold: { heartRate: 182 },
	};

	it("keeps the fields of a request that failed as the file had them", async () => {
		const got = await fetchAccount(
			source({ lastUsedDevice: async () => { throw new GarminApiError("HTTP 500", 500, ""); }, personalRecords: async () => { throw new GarminApiError("HTTP 502", 502, ""); } }),
			"2026-09-25",
			"metric",
		);
		assert.deepEqual([...got.failed].sort(), ["device", "records"]);
		const merged = mergeAccount(previous, got.account, got.failed)!;
		assert.deepEqual(merged.device, previous.device);
		assert.deepEqual(merged.personalRecords, previous.personalRecords);
		// What came back is the new answer.
		assert.equal(merged.lactateThreshold?.heartRate, 182);
	});

	it("keeps the lactate threshold when the settings it needs failed, and takes the answer whole when nothing did", () => {
		assert.deepEqual(mergeAccount(previous, { displayName: "abc" }, new Set(["settings"]))!.lactateThreshold, { heartRate: 182 });
		assert.deepEqual(mergeAccount(previous, { displayName: "new" }, new Set()), { displayName: "new" });
		assert.deepEqual(mergeAccount(null, { displayName: "new" }, new Set(["device"])), { displayName: "new" });
	});
});

