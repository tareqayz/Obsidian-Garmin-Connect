import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	ALL_GROUPS,
	applyPrefix,
	bucketWorkoutsByDate,
	endpointsFor,
	keysFor,
	localDateOf,
	mapDay,
	toLocalDateTime,
	type DayData,
	type MapOptions,
} from "../src/sync/metrics";

const opts = (over: Partial<MapOptions> = {}): MapOptions => ({
	groups: ALL_GROUPS,
	units: "metric",
	...over,
});

describe("mapDay — absent data", () => {
	it("produces nothing at all for an empty day", () => {
		assert.deepEqual(mapDay({}, opts()), {});
	});

	it("omits keys rather than writing nulls", () => {
		const props = mapDay({ summary: { totalSteps: 8000, totalKilocalories: null } }, opts());
		assert.equal(props.steps, 8000);
		assert.ok(!("calories" in props));
	});
});

describe("mapDay — Garmin's sentinels", () => {
	it("drops averageStressLevel: -1 instead of writing it as a score", () => {
		const props = mapDay({ summary: { averageStressLevel: -1 } }, opts());
		assert.ok(!("stress_avg" in props));
	});

	it("keeps a genuine zero", () => {
		const props = mapDay({ summary: { totalSteps: 0 } }, opts());
		assert.equal(props.steps, 0);
	});

	it("drops a negative resting heart rate", () => {
		const props = mapDay({ summary: { restingHeartRate: -1 } }, opts());
		assert.ok(!("resting_hr" in props));
	});
});

describe("mapDay — units", () => {
	it("converts metres to kilometres", () => {
		const props = mapDay({ summary: { totalDistanceMeters: 8234 } }, opts());
		assert.equal(props.distance_km, 8.23);
		assert.ok(!("distance_mi" in props));
	});

	it("converts metres to miles, under a different key", () => {
		const props = mapDay(
			{ summary: { totalDistanceMeters: 8234 } },
			opts({ units: "imperial" }),
		);
		assert.equal(props.distance_mi, 5.12);
		assert.ok(!("distance_km" in props));
	});
});

describe("mapDay — intensity minutes", () => {
	it("weights vigorous minutes double, as Garmin does", () => {
		const props = mapDay(
			{ summary: { moderateIntensityMinutes: 30, vigorousIntensityMinutes: 10 } },
			opts(),
		);
		assert.equal(props.intensity_moderate, 30);
		assert.equal(props.intensity_vigorous, 10);
		assert.equal(props.intensity_minutes, 50);
	});

	it("does not invent a total when neither figure is present", () => {
		const props = mapDay({ summary: { totalSteps: 1 } }, opts());
		assert.ok(!("intensity_minutes" in props));
	});
});

describe("mapDay — sleep", () => {
	it("converts seconds to hours and reads the score out of its nested shape", () => {
		const data: DayData = {
			sleep: {
				dailySleepDTO: {
					sleepTimeSeconds: 27000,
					deepSleepSeconds: 5400,
					remSleepSeconds: 4500,
					sleepScores: { overall: { value: 82 } },
				},
			},
		};
		const props = mapDay(data, opts());
		assert.equal(props.sleep_hours, 7.5);
		assert.equal(props.sleep_deep_hours, 1.5);
		assert.equal(props.sleep_rem_hours, 1.25);
		assert.equal(props.sleep_score, 82);
	});

	it("survives a sleep payload with no DTO", () => {
		assert.deepEqual(mapDay({ sleep: {} }, opts({ groups: ["sleep"] })), {});
	});
});

describe("mapDay — groups", () => {
	it("writes only the groups that are switched on", () => {
		const data: DayData = {
			summary: { totalSteps: 100, restingHeartRate: 50, averageStressLevel: 30 },
		};
		const props = mapDay(data, opts({ groups: ["heart"] }));
		assert.deepEqual(Object.keys(props), ["resting_hr"]);
	});

});

describe("mapDay — workouts", () => {
	it("maps an activity into a compact row", () => {
		const props = mapDay(
			{
				workouts: [
					{
						activityName: "Morning Run",
						activityType: { typeKey: "running" },
						startTimeLocal: "2026-09-12 07:31:00",
						duration: 1830,
						distance: 5120,
						calories: 412.7,
						averageHR: 148.4,
					},
				],
			},
			opts(),
		);
		assert.deepEqual(props.workouts, [
			{
				name: "Morning Run",
				type: "running",
				start: "2026-09-12T07:31",
				minutes: 31,
				distance_km: 5.12,
				calories: 413,
				avg_hr: 148,
			},
		]);
	});

	it("writes no key when there were no workouts", () => {
		assert.ok(!("workouts" in mapDay({ workouts: [] }, opts())));
	});
});

describe("toLocalDateTime", () => {
	it("renders epoch millis as a local datetime property", () => {
		const ms = new Date(2026, 8, 12, 23, 14).getTime();
		assert.equal(toLocalDateTime(ms), "2026-09-12T23:14");
	});

	it("returns nothing for a missing timestamp", () => {
		assert.equal(toLocalDateTime(undefined), undefined);
	});
});

describe("localDateOf", () => {
	it("takes the calendar day out of a Garmin local timestamp", () => {
		assert.equal(localDateOf("2026-09-12 07:31:00"), "2026-09-12");
		assert.equal(localDateOf(undefined), undefined);
		assert.equal(localDateOf("not a date"), undefined);
	});
});

describe("bucketWorkoutsByDate", () => {
	it("groups activities by the day they started", () => {
		const buckets = bucketWorkoutsByDate([
			{ startTimeLocal: "2026-09-12 07:31:00", activityName: "a" },
			{ startTimeLocal: "2026-09-12 18:02:00", activityName: "b" },
			{ startTimeLocal: "2026-09-11 06:00:00", activityName: "c" },
			{ activityName: "undated" },
		]);
		assert.equal(buckets.get("2026-09-12")!.length, 2);
		assert.equal(buckets.get("2026-09-11")!.length, 1);
		assert.equal(buckets.size, 2);
	});
});

describe("endpointsFor", () => {
	it("asks for the summary only when something needs it", () => {
		assert.equal(endpointsFor(["sleep"]).summary, false);
		assert.equal(endpointsFor(["heart"]).summary, true);
		assert.equal(endpointsFor(["stress"]).summary, true);
	});

	it("requests nothing when every group is off", () => {
		assert.deepEqual(endpointsFor([]), {
			summary: false,
			sleep: false,
			hrv: false,
			readiness: false,
			endurance: false,
			maxMetrics: false,
			races: false,
			workouts: false,
		});
	});

	it("pulls VO2 Max and endurance from one group but different endpoints", () => {
		const wanted = endpointsFor(["fitness"]);
		assert.equal(wanted.maxMetrics, true, "VO2 Max comes from a range endpoint");
		assert.equal(wanted.endurance, true, "endurance score is per day");
		assert.equal(wanted.races, false);
	});
});

describe("applyPrefix", () => {
	it("namespaces every key", () => {
		assert.deepEqual(applyPrefix({ steps: 1, resting_hr: 2 }, "garmin_"), {
			garmin_steps: 1,
			garmin_resting_hr: 2,
		});
	});

	it("returns the same object untouched when there is no prefix", () => {
		const props = { steps: 1 };
		assert.equal(applyPrefix(props, ""), props);
	});
});

describe("keysFor", () => {
	it("lists keys grouped and in a stable order", () => {
		assert.deepEqual(keysFor(["heart"]), ["resting_hr", "min_hr", "max_hr"]);
	});

	it("orders groups consistently regardless of how they are passed in", () => {
		assert.deepEqual(keysFor(["heart", "activity"]), keysFor(["activity", "heart"]));
	});

	it("covers every key mapDay can produce for a group", () => {
		// Guards against a new metric being mapped but never reaching the table.
		const produced = Object.keys(
			mapDay(
				{
					summary: {
						totalSteps: 1,
						dailyStepGoal: 1,
						totalDistanceMeters: 1,
						totalKilocalories: 1,
						activeKilocalories: 1,
						floorsAscended: 1,
						moderateIntensityMinutes: 1,
						vigorousIntensityMinutes: 1,
					},
				},
				opts({ groups: ["activity"] }),
			),
		);
		const known = new Set(keysFor(["activity"]));
		for (const key of produced) assert.ok(known.has(key), `keysFor is missing "${key}"`);
	});
});

describe("mapDay — fitness", () => {
	it("prefers the precise VO2 Max over the rounded one", () => {
		const props = mapDay(
			{ maxMetrics: { generic: { vo2MaxPreciseValue: 48.6, vo2MaxValue: 49 } } },
			opts({ groups: ["fitness"] }),
		);
		assert.equal(props.vo2max, 48.6);
	});

	it("falls back to the rounded value when there is no precise one", () => {
		const props = mapDay(
			{ maxMetrics: { generic: { vo2MaxValue: 49 } } },
			opts({ groups: ["fitness"] }),
		);
		assert.equal(props.vo2max, 49);
	});

	it("keeps running and cycling VO2 Max apart", () => {
		const props = mapDay(
			{
				maxMetrics: {
					generic: { vo2MaxPreciseValue: 48.6 },
					cycling: { vo2MaxPreciseValue: 42.1 },
				},
			},
			opts({ groups: ["fitness"] }),
		);
		assert.equal(props.vo2max, 48.6);
		assert.equal(props.vo2max_cycling, 42.1);
	});

	it("writes nothing when Garmin has no max metrics for the day", () => {
		assert.deepEqual(mapDay({ maxMetrics: null }, opts({ groups: ["fitness"] })), {});
	});
});

describe("mapDay — race predictions", () => {
	it("stores seconds, which chart and sort where a formatted time cannot", () => {
		const props = mapDay(
			{ races: { time5K: 1471, time10K: 3060, timeHalfMarathon: 6780, timeMarathon: 14400 } },
			opts({ groups: ["races"] }),
		);
		assert.deepEqual(props, {
			race_5k: 1471,
			race_10k: 3060,
			race_half: 6780,
			race_marathon: 14400,
		});
	});

	it("omits a distance Garmin has no prediction for", () => {
		const props = mapDay({ races: { time5K: 1471 } }, opts({ groups: ["races"] }));
		assert.deepEqual(Object.keys(props), ["race_5k"]);
	});
});
