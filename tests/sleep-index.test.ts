import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	mergeNights,
	parseSleepMeta,
	parseSleepYear,
	rowsFromSleepStats,
	serializeSleepMeta,
	serializeSleepYear,
	type SleepRow,
} from "../src/sync/sleep-index";
import { mapSleepDetail } from "../src/sync/intraday";

/** 2026-10-04 as `/sleep-service/stats/sleep/daily` sent it (the phone showed 98, 8h 16m, 11:35 PM – 7:56 AM). */
const OCT_4 = {
	calendarDate: "2026-10-04",
	values: {
		remTime: 6720,
		restingHeartRate: 47,
		respiration: 13.92,
		localSleepEndTimeInMillis: 1791100574000,
		awakeTime: 300,
		spO2: null,
		localSleepStartTimeInMillis: 1791070514000,
		sleepAlignmentOswStart: -30,
		sleepAlignmentStatus: "ALIGNED",
		hrvStatus: "BALANCED",
		sleepAlignmentOswEnd: 390,
		sleepScore: 98,
		lightTime: 16260,
		avgOvernightHrv: 84,
		totalSleepTimeInSeconds: 29760,
		deepTime: 6780,
		sleepScoreQuality: "EXCELLENT",
		sleepNeed: 420,
		bodyBatteryChange: 66,
		skinTempF: -0.5,
		skinTempC: -0.3,
		avgHeartRate: 50,
		hrv7dAverage: 80,
	},
};

describe("rowsFromSleepStats", () => {
	it("keeps Garmin's figures and puts bed and wake on the day's own clock", () => {
		const [row] = rowsFromSleepStats([OCT_4]);
		assert.deepEqual(row, {
			date: "2026-10-04",
			score: 98,
			quality: "EXCELLENT",
			seconds: 29760,
			deep: 6780,
			light: 16260,
			rem: 6720,
			awake: 300,
			need: 420,
			// 11:35:14 PM the evening before, and 7:56:14 AM.
			bed: -1486,
			wake: 28574,
			hr: 50,
			rhr: 47,
			bb: 66,
			resp: 13.92,
			skinC: -0.3,
			skinF: -0.5,
			hrv: 84,
			hrv7d: 80,
			alignStart: -30,
			alignEnd: 390,
			hrvStatus: "BALANCED",
			align: "ALIGNED",
		});
	});

	it("counts a daytime sleep from the same midnight", () => {
		const [row] = rowsFromSleepStats([
			{ calendarDate: "2026-09-25", values: { sleepScore: 50, totalSleepTimeInSeconds: 12780, localSleepStartTimeInMillis: Date.parse("2026-09-25T12:18:00Z"), localSleepEndTimeInMillis: Date.parse("2026-09-25T15:58:00Z") } },
		]);
		assert.equal(row!.bed, 12 * 3600 + 18 * 60);
		assert.equal(row!.wake, 15 * 3600 + 58 * 60);
	});

	it("drops a night with neither a score nor a duration, and anything malformed", () => {
		const rows = rowsFromSleepStats([
			{ calendarDate: "2026-10-05", values: { sleepNeed: 390 } },
			{ calendarDate: "Oct 5", values: { sleepScore: 80 } },
			{ calendarDate: "2026-10-06", values: null },
			OCT_4,
		]);
		assert.deepEqual(
			rows.map((r) => r.date),
			["2026-10-04"],
		);
	});
});

describe("mergeNights", () => {
	const night = (date: string, score: number): SleepRow => ({ date, score, seconds: 25000 });

	it("replaces the days a batch asked about and drops the ones it found empty", () => {
		const held = [night("2026-10-01", 91), night("2026-10-02", 75), night("2026-10-03", 73)];
		const merged = mergeNights(held, { rows: [night("2026-10-02", 76), night("2026-10-04", 98)], dates: ["2026-10-02", "2026-10-03", "2026-10-04"] });
		assert.deepEqual(
			merged.map((r) => [r.date, r.score]),
			[
				["2026-10-01", 91],
				["2026-10-02", 76],
				["2026-10-04", 98],
			],
		);
	});
});

describe("year files", () => {
	it("round-trip, one night a line, and survive a hand edit's junk", () => {
		const rows = rowsFromSleepStats([OCT_4]);
		const text = serializeSleepYear("2026", rows);
		assert.match(text, /\n\t\t\{"date":"2026-10-04","score":98,"quality":"EXCELLENT",/);
		assert.deepEqual(parseSleepYear(text), rows);
		assert.deepEqual(parseSleepYear('{"nights":[{"date":"x"},null,{"date":"2026-01-01","score":"high","seconds":100}]}'), [{ date: "2026-01-01", seconds: 100 }]);
		assert.deepEqual(parseSleepYear("not json"), []);
	});

	it("keep the index's reach and completeness", () => {
		const meta = { version: 1 as const, from: "2025-08-02", to: "2026-10-07", complete: true };
		assert.deepEqual(parseSleepMeta(serializeSleepMeta(meta)), meta);
		assert.equal(parseSleepMeta('{"version":2,"complete":true}'), null);
	});
});

describe("mapSleepDetail", () => {
	const payload = {
		dailySleepDTO: {
			sleepTimeSeconds: 29760,
			deepSleepSeconds: 6780,
			lightSleepSeconds: 16260,
			remSleepSeconds: 6720,
			awakeSleepSeconds: 300,
			sleepStartTimestampGMT: 1791056114000,
			sleepEndTimestampGMT: 1791086174000,
			sleepStartTimestampLocal: 1791070514000,
			averageRespirationValue: 13,
			lowestRespirationValue: 8,
			awakeCount: 0,
			avgSleepStress: 8,
			avgHeartRate: 50,
			sleepScoreFeedback: "POSITIVE_HIGHLY_RECOVERING",
			sleepScoreInsight: "NONE",
			sleepScorePersonalizedInsight: "HARD_EXERCISE_POS_EXCELLENT_OR_GOOD_SLEEP_HARD_CLOSE_BED",
			sleepScores: {
				overall: { value: 98, qualifierKey: "EXCELLENT" },
				totalDuration: { qualifierKey: "EXCELLENT", optimalStart: 25200, optimalEnd: 25200 },
				deepPercentage: { value: 23, qualifierKey: "EXCELLENT", optimalStart: 16, optimalEnd: 33, idealStartInSeconds: 4761.6, idealEndInSeconds: 9820.8 },
			},
			sleepNeed: { baseline: 420, actual: 420, feedback: "NO_CHANGE_NO_ADJUSTMENTS", sleepHistoryAdjustment: "NO_CHANGE" },
			sleepAlignment: { status: "ALIGNED", optimalSleepWindowStartMins: -30, optimalSleepWindowEndMins: 390, optimalSleepWindowMidpointMins: 180, lastSleepMidpointMins: 226 },
		},
		restlessMomentsCount: 53,
		restingHeartRate: 47,
		bodyBatteryChange: 66,
		avgOvernightHrv: 84,
		hrvStatus: "BALANCED",
		avgSkinTempDeviationC: -0.3,
		avgSkinTempDeviationF: -0.5,
		sleepRestlessMoments: [{ value: 1, startGMT: 1791057194000 }],
		sleepHeartRate: [
			{ value: 51, startGMT: 1791056040000 },
			{ value: 50, startGMT: 1791056160000 },
			{ value: 70, startGMT: 1791099999000 },
		],
		wellnessEpochRespirationAveragesList: [
			{ epochEndTimestampGmt: 1791057600000, respirationAverageValue: -2 },
			{ epochEndTimestampGmt: 1791061200000, respirationAverageValue: 14.23 },
		],
	};

	it("reads the night's figures from the DTO and from beside it", () => {
		const d = mapSleepDetail(payload)!;
		assert.equal(d.score, 98);
		assert.equal(d.quality, "EXCELLENT");
		assert.equal(d.offset, 4 * 3_600_000);
		assert.equal(d.restingHr, 47);
		assert.equal(d.restlessCount, 53);
		assert.equal(d.bodyBatteryChange, 66);
		assert.equal(d.skinC, -0.3);
		assert.equal(d.hrvStatus, "BALANCED");
		assert.equal(d.feedback, "POSITIVE_HIGHLY_RECOVERING");
		assert.equal(d.insight, undefined, "NONE is no insight");
		assert.equal(d.personal, "HARD_EXERCISE_POS_EXCELLENT_OR_GOOD_SLEEP_HARD_CLOSE_BED");
		assert.deepEqual(d.factors?.deep, { qualifier: "EXCELLENT", value: 23, optimalStart: 16, optimalEnd: 33, idealStart: 4761.6, idealEnd: 9820.8 });
		assert.deepEqual(d.need, { baseline: 420, actual: 420, feedback: "NO_CHANGE_NO_ADJUSTMENTS", history: "NO_CHANGE" });
		assert.deepEqual(d.alignment, { status: "ALIGNED", start: -30, end: 390, mid: 180, last: 226 });
	});

	it("keeps the overnight series inside the night, gaps as null", () => {
		const d = mapSleepDetail(payload)!;
		assert.deepEqual(d.heartRate, [
			[1791056040000, 51],
			[1791056160000, 50],
		]);
		assert.deepEqual(d.respiration, [
			[1791057600000, null],
			[1791061200000, 14.23],
		]);
		assert.deepEqual(d.restless, [[1791057194000, 1]]);
	});

	it("is null without a night", () => {
		assert.equal(mapSleepDetail({ dailySleepDTO: { sleepTimeSeconds: null } }), null);
	});
});
