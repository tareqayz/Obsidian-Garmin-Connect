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
						maxHR: 171,
						elevationGain: 42.4,
						aerobicTrainingEffect: 3.42,
						movingDuration: 1800,
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
				max_hr: 171,
				elevation_gain_m: 42,
				training_effect: 3.4,
				pace: "5:52",
			},
		]);
	});

	it("paces on moving time and in the reader's units", () => {
		const run = {
			activityName: "Run",
			distance: 5000,
			duration: 1800,
			movingDuration: 1500,
		};
		assert.equal(
			(mapDay({ workouts: [run] }, opts()).workouts as Array<Record<string, unknown>>)[0]!.pace,
			"5:00",
		);
		assert.equal(
			(
				mapDay({ workouts: [run] }, opts({ units: "imperial" })).workouts as Array<
					Record<string, unknown>
				>
			)[0]!.pace,
			"8:03",
		);
	});

	it("omits a pace for an activity that has no distance to pace", () => {
		const row = (
			mapDay({ workouts: [{ activityName: "Strength", duration: 1800 }] }, opts())
				.workouts as Array<Record<string, unknown>>
		)[0]!;
		assert.ok(!("pace" in row));
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
			training: false,
			body: false,
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
		assert.deepEqual(keysFor(["heart"]), ["resting_hr", "resting_hr_7d", "min_hr", "max_hr"]);
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


describe("mapDay — metrics that cost nothing extra", () => {
	// Every field below arrives in a response the sync already makes, which is
	// what makes them worth mapping: more properties, no more requests.
	const summary = {
		bmrKilocalories: 1680,
		floorsDescended: 9,
		userFloorsAscendedGoal: 10,
		intensityMinutesGoal: 150,
		activeSeconds: 17400,
		highlyActiveSeconds: 1800,
		sedentarySeconds: 39600,
		lastSevenDaysAvgRestingHeartRate: 49,
		maxStressLevel: 88,
		stressQualifier: "BALANCED",
		restStressDuration: 21600,
		highStressDuration: 1800,
		bodyBatteryChargedValue: 62,
		bodyBatteryDrainedValue: 58,
		bodyBatteryMostRecentValue: 41,
		avgWakingRespirationValue: 14.6,
		lowestRespirationValue: 10.2,
		highestRespirationValue: 19.4,
		averageSpo2: 96,
		lowestSpo2: 89,
		latestSpo2: 97,
	};

	it("splits the day into activity bands, in minutes", () => {
		const props = mapDay({ summary }, opts({ groups: ["activity"] }));
		assert.equal(props.active_minutes, 290);
		assert.equal(props.highly_active_minutes, 30);
		assert.equal(props.sedentary_minutes, 660);
		assert.equal(props.calories_bmr, 1680);
		assert.equal(props.floors_goal, 10);
		assert.equal(props.intensity_goal, 150);
	});

	it("keeps Garmin's own seven-day resting rate beside the daily one", () => {
		assert.equal(mapDay({ summary }, opts({ groups: ["heart"] })).resting_hr_7d, 49);
	});

	it("carries the stress bands and both directions of Body Battery", () => {
		const props = mapDay({ summary }, opts({ groups: ["stress"] }));
		assert.equal(props.stress_max, 88);
		assert.equal(props.stress_qualifier, "BALANCED");
		assert.equal(props.stress_rest_minutes, 360);
		assert.equal(props.stress_high_minutes, 30);
		assert.equal(props.body_battery_charged, 62);
		assert.equal(props.body_battery_drained, 58);
		assert.equal(props.body_battery_latest, 41);
		assert.ok(!("stress_low_minutes" in props), "an absent band is not a zero");
	});

	it("reads respiration and pulse ox out of the same summary", () => {
		assert.equal(mapDay({ summary }, opts({ groups: ["respiration"] })).respiration_avg, 14.6);
		assert.equal(mapDay({ summary }, opts({ groups: ["spo2"] })).spo2_low, 89);
		// Neither group costs a request, so neither may leak into the other's keys.
		assert.ok(!("spo2_avg" in mapDay({ summary }, opts({ groups: ["respiration"] }))));
	});

	it("takes the night's own physiology off the sleep response", () => {
		const props = mapDay(
			{
				sleep: {
					dailySleepDTO: {
						sleepScores: { overall: { value: 82, qualifierKey: "GOOD" } },
						restingHeartRate: 47,
						avgSleepStress: 16,
						awakeCount: 2,
						restlessMomentsCount: 14,
						averageRespirationValue: 13.4,
						averageSpO2Value: 95,
						lowestSpO2Value: 88,
						bodyBatteryChange: 44,
						napTimeSeconds: 1800,
					},
				},
			},
			opts({ groups: ["sleep"] }),
		);
		assert.equal(props.sleep_quality, "GOOD");
		assert.equal(props.sleep_resting_hr, 47);
		assert.equal(props.sleep_restless_moments, 14);
		assert.equal(props.sleep_spo2_low, 88);
		assert.equal(props.sleep_body_battery_change, 44);
		assert.equal(props.nap_hours, 0.5);
	});

	it("keeps a negative overnight Body Battery change, which is real", () => {
		// A night that drained rather than recharged is information, not a sentinel.
		const props = mapDay(
			{ sleep: { dailySleepDTO: { bodyBatteryChange: -6 } } },
			opts({ groups: ["sleep"] }),
		);
		assert.equal(props.sleep_body_battery_change, -6);
	});

	it("carries the HRV baseline that makes last night's number readable", () => {
		const props = mapDay(
			{
				hrv: {
					hrvSummary: {
						lastNightAvg: 44,
						baseline: { balancedLow: 38, balancedUpper: 58, lowUpper: 34 },
					},
				},
			},
			opts({ groups: ["hrv"] }),
		);
		assert.equal(props.hrv_baseline_low, 38);
		assert.equal(props.hrv_baseline_high, 58);
	});

	it("turns recovery minutes into the hours anyone reads them in", () => {
		const props = mapDay(
			{ readiness: [{ score: 70, recoveryTime: 1290, sleepScore: 81, acuteLoad: 640 }] },
			opts({ groups: ["readiness"] }),
		);
		assert.equal(props.recovery_time_hours, 21.5);
		assert.equal(props.readiness_sleep_score, 81);
		assert.equal(props.acute_load, 640);
	});
});

describe("mapDay — body composition", () => {
	const body = {
		totalAverage: { weight: 78400, bmi: 23.46789, bodyFat: 17.4321, muscleMass: 33200, boneMass: 3100 },
		dateWeightList: [{ weight: 99000 }],
	};

	it("prefers Garmin's own daily average over the first weigh-in", () => {
		// Stepping on the scale twice should read as the day, not as whichever
		// reading happened to come first.
		assert.equal(mapDay({ body }, opts({ groups: ["body"] })).weight_kg, 78.4);
	});

	it("falls back to the first reading when there is no average", () => {
		const props = mapDay(
			{ body: { dateWeightList: [{ weight: 78400 }] } },
			opts({ groups: ["body"] }),
		);
		assert.equal(props.weight_kg, 78.4);
	});

	it("converts grams to pounds under an imperial setting, under a different key", () => {
		const props = mapDay({ body }, opts({ groups: ["body"], units: "imperial" }));
		assert.equal(props.weight_lb, 172.8);
		assert.equal(props.muscle_mass_lb, 73.2);
		assert.ok(!("weight_kg" in props));
	});

	it("rounds the percentages Garmin sends to six decimals", () => {
		const props = mapDay({ body }, opts({ groups: ["body"] }));
		assert.equal(props.bmi, 23.47);
		assert.equal(props.body_fat_pct, 17.43);
	});

	it("writes nothing at all on a day with no weigh-in", () => {
		assert.deepEqual(mapDay({ body: { dateWeightList: [] } }, opts({ groups: ["body"] })), {});
	});
});

describe("mapDay — training load", () => {
	it("reads the status out of whichever device reported it", () => {
		// The map is keyed by device id, and an account with a watch and a bike
		// computer has several — none of them knowable in advance.
		const props = mapDay(
			{
				training: {
					latestTrainingStatusData: {
						"3418285688": { trainingStatusFeedbackPhrase: "PRODUCTIVE_1", weeklyTrainingLoad: 712 },
					},
				},
			},
			opts({ groups: ["training"] }),
		);
		assert.equal(props.training_status, "PRODUCTIVE_1");
		assert.equal(props.training_load_weekly, 712);
	});

	it("takes the ratio directly when Garmin sends it", () => {
		const props = mapDay(
			{
				training: {
					acuteTrainingLoadDTO: {
						dailyTrainingLoadAcute: 900,
						dailyTrainingLoadChronic: 1050,
						dailyAcuteChronicWorkloadRatio: 0.857,
						acwrStatus: "OPTIMAL",
					},
				},
			},
			opts({ groups: ["training"] }),
		);
		assert.equal(props.training_load_acute, 900);
		assert.equal(props.training_load_chronic, 1050);
		assert.equal(props.training_load_ratio, 0.86);
		assert.equal(props.training_load_status, "OPTIMAL");
	});

	it("derives the ratio from the percentage when that is all there is", () => {
		const props = mapDay(
			{ training: { acuteTrainingLoadDTO: { acwrPercent: 86 } } },
			opts({ groups: ["training"] }),
		);
		assert.equal(props.training_load_ratio, 0.86);
	});

	it("writes nothing for an account Garmin has no training status for", () => {
		assert.deepEqual(mapDay({ training: {} }, opts({ groups: ["training"] })), {});
	});
});
