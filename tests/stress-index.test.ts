import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { timelineOf } from "../src/dashboard/stress-pages";
import type { DailyStatRow, DailyStress, DailySummary, GarminApi } from "../src/garmin/endpoints";
import { DAY_INDEXES, dayIndex } from "../src/sync/day-indexes";
import { walkHistory } from "../src/sync/engine";
import { serializeSeries, type DaySeries } from "../src/sync/intraday";
import { INTRADAY_EXTRAS } from "../src/sync/intraday-extras";
import { SERIES_KEYS, loadDay } from "../src/sync/intraday-registry";
import { STRESS_DAY, STRESS_DAY_KEY, STRESS_INDEX, batteryDayIn, rowOfStat, stressDayIn, stressDayOf, type StressRow } from "../src/sync/stress-index";

/** `stats/stress/daily` rows as Garmin sent them (api-samples, Aug 14 – Sep 10 and Jan 2 – 29 windows). */
const WINDOW: DailyStatRow[] = [
	{ calendarDate: "2026-08-17", values: { highStressDuration: 3960, lowStressDuration: 7440, overallStressLevel: 31, restStressDuration: 30480, mediumStressDuration: 11100 } },
	// The watch synced and measured nothing.
	{ calendarDate: "2026-08-18", values: { highStressDuration: null, lowStressDuration: null, overallStressLevel: -1, restStressDuration: null, mediumStressDuration: null } },
	{ calendarDate: "2026-08-19", values: { highStressDuration: 1080, lowStressDuration: 15480, overallStressLevel: 31, restStressDuration: 25200, mediumStressDuration: 6780 } },
	// No high stress at all: null, not 0.
	{ calendarDate: "2026-09-08", values: { highStressDuration: null, lowStressDuration: 25980, overallStressLevel: 23, restStressDuration: 48960, mediumStressDuration: 2100 } },
];

/** The Jan 2 – 29 window: Jan 4 at −1, Jan 5 – 9 left out altogether. */
const JANUARY: DailyStatRow[] = [
	{ calendarDate: "2026-01-03", values: { highStressDuration: 1020, lowStressDuration: 20580, overallStressLevel: 27, restStressDuration: 45540, mediumStressDuration: 6480 } },
	{ calendarDate: "2026-01-04", values: { highStressDuration: null, lowStressDuration: null, overallStressLevel: -1, restStressDuration: null, mediumStressDuration: null } },
	{ calendarDate: "2026-01-10", values: { highStressDuration: 120, lowStressDuration: 300, overallStressLevel: 23, restStressDuration: 2940, mediumStressDuration: 300 } },
];

/** The stress fields of the Oct 8 summary the web fetched at 01:07, the rest left out. */
const SUMMARY_OCT_8: DailySummary = {
	calendarDate: "2026-10-08",
	averageStressLevel: 29,
	maxStressLevel: 85,
	stressDuration: 1620,
	restStressDuration: 1740,
	activityStressDuration: null,
	uncategorizedStressDuration: 120,
	totalStressDuration: 3480,
	lowStressDuration: 1320,
	mediumStressDuration: 240,
	highStressDuration: 60,
	stressQualifier: "UNKNOWN",
};

const day = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
function datesOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = day(d, 1)) out.push(d);
	return out;
}

describe("STRESS_INDEX — the definition", () => {
	it("is registered as the stress index: its folder, its group, 28 days a window", () => {
		assert.equal(dayIndex("stress"), STRESS_INDEX);
		assert.ok(DAY_INDEXES.includes(STRESS_INDEX));
		assert.deepEqual(
			[STRESS_INDEX.kind, STRESS_INDEX.folder, STRESS_INDEX.title, STRESS_INDEX.group, STRESS_INDEX.windowDays, STRESS_INDEX.version],
			["stress", "stress", "stress", "stress", 28, 1],
		);
		assert.deepEqual(STRESS_INDEX.keys, ["level", "rest", "low", "medium", "high", "qualifier"]);
		assert.equal(STRESS_INDEX.keepOld, true);
	});
});

describe("STRESS_INDEX — a history window", () => {
	it("asks stats/stress/daily for the window and maps its rows", async () => {
		const asked: string[] = [];
		const api = { stressDaily: async (start: string, end: string) => (asked.push(`${start} ${end}`), WINDOW) } as unknown as GarminApi;
		const rows = (await STRESS_INDEX.fetchWindow(api, "2026-08-14", "2026-09-10")).map((r) => STRESS_INDEX.normalize(r));
		assert.deepEqual(asked, ["2026-08-14 2026-09-10"]);
		assert.deepEqual(rows, [
			{ date: "2026-08-17", level: 31, rest: 30480, low: 7440, medium: 11100, high: 3960 },
			null,
			{ date: "2026-08-19", level: 31, rest: 25200, low: 15480, medium: 6780, high: 1080 },
			{ date: "2026-09-08", level: 23, rest: 48960, low: 25980, medium: 2100 },
		]);
		assert.deepEqual(rowOfStat(null), { date: undefined, level: undefined, rest: undefined, low: undefined, medium: undefined, high: undefined });
	});

	it("takes both kinds of empty day out of the index: a −1 row and a day left out", () => {
		const held: StressRow[] = [
			{ date: "2026-01-03", level: 30 },
			{ date: "2026-01-04", level: 25, qualifier: "BALANCED" },
			{ date: "2026-01-06", level: 22 },
		];
		const merged = STRESS_INDEX.merge(held, { rows: JANUARY.map(rowOfStat) as StressRow[], dates: datesOf("2026-01-02", "2026-01-29") });
		assert.deepEqual(merged, [
			{ date: "2026-01-03", level: 27, rest: 45540, low: 20580, medium: 6480, high: 1020 },
			{ date: "2026-01-10", level: 23, rest: 2940, low: 300, medium: 300, high: 120 },
		]);
	});

	it("keeps the qualifier a day's summary gave when a window brings the day back", () => {
		const held: StressRow[] = [{ date: "2026-10-07", level: 27, rest: 39420, low: 15300, medium: 5880, high: 3540, qualifier: "BALANCED" }];
		const fresh = rowOfStat({ calendarDate: "2026-10-07", values: { overallStressLevel: 27, restStressDuration: 39420, lowStressDuration: 15300, mediumStressDuration: 5880, highStressDuration: 3540 } });
		assert.deepEqual(STRESS_INDEX.merge(held, { rows: [fresh as StressRow], dates: ["2026-10-07"] }), held);
	});

	it("walks back to the account's first day, and stops after two empty windows", async () => {
		const calls: string[] = [];
		const fetch = async (start: string, end: string) => {
			calls.push(`${start} ${end}`);
			return datesOf(start, end)
				.filter((d) => d >= "2025-08-02")
				.map((d) => rowOfStat({ calendarDate: d, values: { overallStressLevel: 30, restStressDuration: 36000 } }));
		};
		const walk = await walkHistory(STRESS_INDEX, fetch, { until: "2025-09-11" });
		// The windows the history was captured in, then one more past its start.
		assert.deepEqual(calls, ["2025-08-15 2025-09-11", "2025-07-18 2025-08-14", "2025-06-20 2025-07-17", "2025-05-23 2025-06-19"]);
		assert.equal(walk.complete, true);
		assert.equal(walk.batch.rows.length, 41);
		assert.equal(walk.batch.rows[0]!.date, "2025-08-15");
	});
});

describe("STRESS_INDEX — the daily summary", () => {
	const fromSummary = (summary: DailySummary, date: string) => {
		const row = STRESS_INDEX.fromSummary!(summary, date);
		return row ? STRESS_INDEX.normalize({ ...row, date }) : null;
	};

	it("makes the run's own day from its summary, qualifier and all", () => {
		assert.deepEqual(fromSummary(SUMMARY_OCT_8, "2026-10-08"), {
			date: "2026-10-08",
			level: 29,
			rest: 1740,
			low: 1320,
			medium: 240,
			high: 60,
			// UNKNOWN beside a real level: the copy follows the qualifier, the ring the durations.
			qualifier: "UNKNOWN",
		});
	});

	it("finds no day in a summary that measured nothing, whatever its qualifier", () => {
		const empty: DailySummary = { averageStressLevel: -1, restStressDuration: null, lowStressDuration: null, mediumStressDuration: null, highStressDuration: null, stressQualifier: "UNKNOWN" };
		assert.equal(fromSummary(empty, "2026-08-18"), null);
		assert.equal(fromSummary({}, "2026-08-18"), null);
	});

	it("keeps a summary's measured time even without a level", () => {
		assert.deepEqual(fromSummary({ averageStressLevel: -1, restStressDuration: 600, stressQualifier: "UNKNOWN" }, "2026-10-09"), {
			date: "2026-10-09",
			rest: 600,
			qualifier: "UNKNOWN",
		});
	});
});

/* ------------------------------------------------------------------ */

const H = 3_600_000;
const STEP = 180_000;

/**
 * Oct 7's 460 readings, as dailyStress sent them: a 23-hour day that began
 * at UTC+3 and ended at UTC+4 (api-samples/dailyStress-2026-10-07.json).
 */
const OCT_7_LEVELS = `8 12 10 13 13 7 6 8 8 5 7 5 10 6 8 6 6 5 11 4 12 6 7 8 9 17 13 15 17 18 16 9 4 6 7 8 6 9 8 8 9 5 6 7 6 10 8 9 8 9 8 8 5 5 10 8 8 8 7 10 9 8 6 8 8 13
11 16 19 15 5 5 5 5 6 6 8 4 7 12 12 9 5 7 8 10 9 11 10 8 4 6 8 7 8 5 6 6 6 6 6 6 8 7 5 8 11 7 6 10 7 8 6 3 5 5 6 9 15 6 8 7 9 8 8 8 7 7 5 5 5 6 5 5 4
6 4 8 18 21 24 24 22 24 21 22 -1 39 -1 17 19 19 18 20 20 20 22 23 31 23 20 22 24 19 21 24 42 -1 34 51 54 82 -1 -2 -2 -1 -2 -2 -2 -1 -2 -1 22 20 19 21
18 23 28 34 24 23 28 25 47 53 24 22 25 25 24 21 18 -1 -2 -2 -2 -1 58 48 19 25 19 -1 -1 19 21 22 25 -2 -2 -1 90 29 25 19 19 28 19 37 25 24 23 17 37 25
23 20 34 31 -1 -1 -1 53 -1 -1 -1 72 20 17 -1 -1 57 37 -1 -1 17 25 31 23 25 29 32 24 34 24 28 33 26 27 32 29 31 50 25 23 57 25 44 69 28 24 25 -1 -1 41
23 25 28 34 38 25 32 31 24 25 30 30 25 49 47 34 33 41 40 30 35 36 25 52 70 49 39 24 32 36 44 49 58 45 35 35 43 20 22 24 37 31 38 46 32 46 24 24 77 -2
-2 87 -2 -1 -2 -1 -1 94 -1 66 38 42 54 75 67 46 46 50 32 27 23 23 23 21 23 37 31 -1 30 55 -1 -2 -1 -1 38 43 41 43 -1 -1 63 -2 -1 -1 -1 -1 -1 -1 -1 -1
-1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -2 -1 92 90 88 -2 -2 90 79 84 82 87 83 70 79 73 76 71 -2 -1 74 76 55
-2 -1 62 60 -1 72 -2 -2 73 -2 -1 65 49 52 48 38 51 46 46 24 42 40 34 47`
	.split(/\s+/)
	.map(Number);

/** Oct 7's Body Battery, one reading for each stress reading (dailyStress-2026-10-07.json). */
const OCT_7_BATTERY = `82 82 82 83 83 84 85 85 85 86 86 87 88 88 89 89 89 90 90 91 92 92 92 93 93 94 94 94 94 95 95 95 96 96 96 97 98 98 99 99 99 99 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 99 99 99 99 99 98 98 97 97 97 97 97 97 97 97 97 97 97 96 96 96 96 96 95 95
95 95 94 94 94 93 92 91 90 90 90 89 89 88 88 88 88 88 88 88 88 87 87 86 86 86 86 86 85 85 85 85 84 84 84 84 84 84 84 83 83 83 82 82 82 82 82 82 81 81
80 80 80 80 79 79 78 78 77 77 77 77 77 77 77 77 77 77 77 77 76 76 76 75 75 74 74 74 74 74 73 73 73 73 73 73 73 72 72 72 72 71 71 71 71 70 70 70 70 70
70 70 70 70 69 69 69 68 68 68 67 67 67 66 66 66 66 66 66 65 65 65 65 65 64 64 64 64 63 63 63 63 63 63 62 62 62 62 62 62 61 61 61 61 60 60 60 59 59 59
58 58 58 57 57 57 57 57 57 57 57 57 56 56 56 56 55 55 55 54 54 54 54 53 53 53 53 52 52 51 51 51 51 50 50 50 49 49 49 49 49 49 49 49 49 49 48 48 48 48
48 48 48 48 47 47 47 47 46 46 46 45 45 45 45 45 45 45 45 45 45 44 44 44 44 43 43 43 43 43 42 42 41 41 41 41 40 39 39 39 39 39 39 39 38 38 38 38 38 37
37 36 36 36 36 35 35 34 34 34 33 33 33 32 32 32 32 31 31 31 31 31 31 30 30 30 29 29 29 29 29 28 28 28 28 28 28 28 28 28 27 27 27 27`
	.split(/\s+/)
	.map(Number);

/** Oct 7's estimated stretches: 16:00–16:36 and 16:51–17:33 UTC, 28 readings. */
const OCT_7_STATUS = (i: number) => ((i >= 380 && i < 393) || (i >= 397 && i < 412) ? "MODELED" : "MEASURED");

/** Body Battery's descriptors, under their own key names, as Garmin sends them. */
const BATTERY_COLUMNS = ["timestamp", "bodyBatteryStatus", "bodyBatteryLevel", "bodyBatteryVersion"].map((key, index) => ({
	bodyBatteryValueDescriptorIndex: index,
	bodyBatteryValueDescriptorKey: key,
}));

/** The payload with a Body Battery curve: `[timestamp, status, level, version]` a reading, from the day's start. */
function withBattery(day: DailyStress, levels: readonly number[], status: (i: number) => string, columns = BATTERY_COLUMNS): DailyStress {
	const start = Date.parse(`${day.startTimestampGMT}Z`);
	const at = (key: string) => columns.find((c) => c.bodyBatteryValueDescriptorKey === key)!.bodyBatteryValueDescriptorIndex;
	return {
		...day,
		bodyBatteryValueDescriptorsDTOList: columns,
		bodyBatteryValuesArray: levels.map((v, i) => {
			const row: Array<number | string> = [];
			row[at("timestamp")] = start + i * STEP;
			row[at("bodyBatteryStatus")] = status(i);
			row[at("bodyBatteryLevel")] = v;
			row[at("bodyBatteryVersion")] = 3;
			return row;
		}),
	};
}

/** A dailyStress payload: the day's bounds, its readings every three minutes from `start`. */
function payload(bounds: [string, string, string, string], levels: readonly number[], descriptors = [{ key: "timestamp", index: 0 }, { key: "stressLevel", index: 1 }]): DailyStress {
	const start = Date.parse(`${bounds[0]}Z`);
	const timeAt = descriptors.find((d) => d.key === "timestamp")!.index;
	return {
		calendarDate: bounds[2].slice(0, 10),
		startTimestampGMT: bounds[0],
		endTimestampGMT: bounds[1],
		startTimestampLocal: bounds[2],
		endTimestampLocal: bounds[3],
		avgStressLevel: 27,
		stressValueDescriptorsDTOList: descriptors,
		stressValuesArray: levels.map((v, i) => (timeAt === 0 ? [start + i * STEP, v] : [v, start + i * STEP])),
	};
}

const OCT_7 = withBattery(
	payload(["2026-10-06T21:00:00.0", "2026-10-07T20:00:00.0", "2026-10-07T00:00:00.0", "2026-10-08T00:00:00.0"], OCT_7_LEVELS),
	OCT_7_BATTERY,
	OCT_7_STATUS,
);

/** Today at 01:08: 23 readings, the newest unmeasurable (dailyStress-2026-10-08.json). */
const OCT_8_LEVELS = [40, 30, 30, 23, 26, 25, 30, 20, 20, 25, 23, 28, 20, 46, 49, 30, 52, 21, 22, 20, 22, 24, -1];
const OCT_8 = payload(["2026-10-07T20:00:00.0", "2026-10-07T21:08:00.0", "2026-10-08T00:00:00.0", "2026-10-08T01:08:00.0"], OCT_8_LEVELS);

/** A day the watch never synced, verbatim (dailyStress-2026-01-06.json). */
const JAN_6 = JSON.parse(
	'{"userProfilePK":1,"calendarDate":"2026-01-06","startTimestampGMT":null,"endTimestampGMT":null,"startTimestampLocal":null,"endTimestampLocal":null,"maxStressLevel":null,"avgStressLevel":null,"stressChartValueOffset":null,"stressChartYAxisOrigin":null,"stressValueDescriptorsDTOList":[],"stressValuesArray":[]}',
) as DailyStress;

const count = (levels: ReadonlyArray<number | null>, test: (v: number) => boolean) => levels.filter((v) => v !== null && test(v)).length;

describe("STRESS_DAY — the day's readings", () => {
	it("is an extra of its own, under the stress group, fetching dailyStress for the day", async () => {
		assert.equal(STRESS_DAY.key, STRESS_DAY_KEY);
		assert.equal(STRESS_DAY.key, "stressDay");
		assert.equal(STRESS_DAY.group, "stress");
		assert.ok(!SERIES_KEYS.has(STRESS_DAY.key));
		assert.ok(INTRADAY_EXTRAS.includes(STRESS_DAY));
		const asked: string[] = [];
		const api = { stress: async (date: string) => (asked.push(date), OCT_7) } as unknown as GarminApi;
		assert.equal(await STRESS_DAY.fetch(api, "2026-10-07"), OCT_7);
		assert.deepEqual(asked, ["2026-10-07"]);
	});

	it("keeps a 23-hour day's bounds, both offsets, and every reading with −1 and −2 apart", () => {
		const block = stressDayOf(OCT_7)!;
		assert.equal(block.start, Date.parse("2026-10-06T21:00:00Z"));
		assert.equal(block.end, Date.parse("2026-10-07T20:00:00Z"));
		assert.deepEqual([block.startOffset, block.endOffset, block.step], [3 * H, 4 * H, STEP]);
		assert.equal(block.levels.length, 460);
		assert.deepEqual(block.levels, OCT_7_LEVELS);
		assert.deepEqual(
			[count(block.levels, (v) => v >= 0), count(block.levels, (v) => v === -1), count(block.levels, (v) => v === -2)],
			[361, 74, 25],
		);
	});

	it("draws Oct 7 as 23 hours: a bar a reading, the unscored runs merged", () => {
		const t = timelineOf(stressDayOf(OCT_7));
		assert.equal(t.hours, 23);
		assert.equal(t.ticks.length, 24);
		assert.deepEqual(t.zones, { start: "GMT +03:00", end: "GMT +04:00" });
		assert.equal(t.bars.length, 361);
		assert.deepEqual(
			[t.bars.filter((b) => b.tone === "rest").length, t.bars.filter((b) => b.tone === "stress").length],
			[228, 133],
		);
		assert.deepEqual([t.unmeasurable.length, t.active.length], [29, 16]);
		assert.equal(t.bars.at(-1)!.x1, 1);
	});

	it("keeps today's partial day up to its newest reading", () => {
		const block = stressDayOf(OCT_8)!;
		assert.equal(block.end, Date.parse("2026-10-07T21:08:00Z"));
		assert.deepEqual(block.levels, OCT_8_LEVELS);
		assert.deepEqual([block.startOffset, block.endOffset], [4 * H, 4 * H]);
	});

	it("has nothing for a day Garmin had nothing for, and keeps a day of nothing but −1 and −2", () => {
		assert.equal(stressDayOf(JAN_6), null);
		assert.equal(stressDayOf(null), null);
		// Aug 18: the watch synced 480 readings and scored none of them.
		const blank = Array.from({ length: 480 }, (_, i) => (i % 9 === 0 ? -2 : -1));
		const block = stressDayOf(payload(["2026-08-17T21:00:00.0", "2026-08-18T21:00:00.0", "2026-08-18T00:00:00.0", "2026-08-19T00:00:00.0"], blank))!;
		assert.equal(block.levels.length, 480);
		assert.equal(count(block.levels, (v) => v >= 0), 0);
	});

	it("finds the columns by Garmin's descriptors, and leaves a missing reading's step empty", () => {
		const swapped = payload(
			["2026-10-07T20:00:00.0", "2026-10-07T20:12:00.0", "2026-10-08T00:00:00.0", "2026-10-08T00:12:00.0"],
			[12, 40],
			[{ key: "stressLevel", index: 0 }, { key: "timestamp", index: 1 }],
		);
		assert.deepEqual(stressDayOf(swapped)!.levels, [12, 40]);
		// The step is the readings' usual gap, so one missing reading leaves its step empty.
		const gappy = payload(["2026-10-07T20:00:00.0", "2026-10-07T20:15:00.0", "2026-10-08T00:00:00.0", "2026-10-08T00:15:00.0"], [12, 40, 7, 9, 11]);
		gappy.stressValuesArray!.splice(2, 1);
		const block = stressDayOf(gappy)!;
		assert.equal(block.step, STEP);
		assert.deepEqual(block.levels, [12, 40, null, 9, 11]);
	});

	it("keeps Oct 7's Body Battery on the same steps, its 28 estimated readings as two stretches", () => {
		const block = stressDayOf(OCT_7)!;
		assert.deepEqual(block.battery, OCT_7_BATTERY);
		assert.deepEqual(block.batteryRuns, [
			["MODELED", 380, 13],
			["MODELED", 397, 15],
		]);
		const battery = batteryDayIn({ extra: { stressDay: block } })!;
		assert.deepEqual([battery.start, battery.end, battery.step, battery.startOffset, battery.endOffset], [block.start, block.end, STEP, 3 * H, 4 * H]);
		assert.deepEqual([battery.levels[0], Math.max(...(battery.levels as number[])), battery.levels[459]], [82, 100, 27]);
		assert.deepEqual(battery.runs, [
			{ status: "MODELED", from: 380, to: 393 },
			{ status: "MODELED", from: 397, to: 412 },
		]);
	});

	it("keeps the clock change's ADJUSTED and RESET, and finds the battery's columns by its own descriptor keys", () => {
		// Oct 6: ADJUSTED from midnight to 02:45, then one RESET.
		const status = (i: number) => (i < 56 ? "ADJUSTED" : i === 56 ? "RESET" : "MEASURED");
		const swapped = [...BATTERY_COLUMNS].reverse().map((c, index) => ({ ...c, bodyBatteryValueDescriptorIndex: index }));
		const oct6 = withBattery(
			payload(["2026-10-05T21:00:00.0", "2026-10-06T21:00:00.0", "2026-10-06T00:00:00.0", "2026-10-07T00:00:00.0"], Array.from({ length: 480 }, () => 20)),
			Array.from({ length: 480 }, (_, i) => 57 + (i % 3)),
			status,
			swapped,
		);
		const block = stressDayOf(oct6)!;
		assert.deepEqual(block.batteryRuns, [
			["ADJUSTED", 0, 56],
			["RESET", 56, 1],
		]);
		assert.deepEqual(block.battery!.slice(0, 4), [57, 58, 59, 57]);
	});

	it("keeps a day with only Body Battery, whose stress chart is then empty, and a day without the curve", () => {
		const onlyBattery = withBattery(payload(["2026-05-10T20:00:00.0", "2026-05-11T20:00:00.0", "2026-05-11T00:00:00.0", "2026-05-12T00:00:00.0"], []), [60, 61, 61], () => "MEASURED");
		const block = stressDayOf(onlyBattery)!;
		assert.deepEqual([block.levels, block.battery, block.batteryRuns], [[], [60, 61, 61], undefined]);
		assert.equal(timelineOf(block).state, "empty");
		// Aug 18: readings at −1 and −2 and no Body Battery array at all.
		const aug18 = stressDayOf(payload(["2026-08-17T21:00:00.0", "2026-08-18T21:00:00.0", "2026-08-18T00:00:00.0", "2026-08-19T00:00:00.0"], [-1, -2, -1]))!;
		assert.equal(aug18.battery, undefined);
		assert.equal(batteryDayIn({ extra: { stressDay: aug18 } }), null);
	});

	it("stays small: Oct 7's two curves come to about three kilobytes", () => {
		const text = JSON.stringify(stressDayOf(OCT_7));
		assert.ok(text.length < 3_500, `${text.length} characters`);
	});

	it("reads the block back from the series file, and nothing from one it cannot read", () => {
		const block = stressDayOf(OCT_7)!;
		const series = JSON.parse(serializeSeries("2026-10-07", { extra: { stressDay: block } })) as DaySeries;
		assert.deepEqual(stressDayIn(series), block);
		const bent = stressDayIn({ extra: { stressDay: { ...block, battery: [1, "x", null], batteryRuns: [["MODELED", 3, 2], ["RESET", -1, 1], ["ADJUSTED", 2], "x"] } } })!;
		assert.deepEqual([bent.battery, bent.batteryRuns], [[1, null, null], [["MODELED", 3, 2]]]);
		assert.equal(stressDayIn({ extra: { stressDay: { start: "soon", end: 1, step: 1, levels: [] } } }), null);
		assert.equal(stressDayIn({ extra: { stressDay: { start: 2, end: 1, step: STEP, levels: [] } } }), null);
		assert.equal(stressDayIn({ stress: [[1, 20]] }), null);
		assert.equal(stressDayIn(null), null);
	});

	it("loads on view into the day's series file, one request under the stress group", async () => {
		const files = new Map<string, string>();
		const store = {
			read: async (date: string) => {
				const text = files.get(date);
				if (!text) return null;
				const { date: _d, version: _v, ...series } = JSON.parse(text) as Record<string, unknown>;
				return series as DaySeries;
			},
			write: async (date: string, series: DaySeries) => (files.set(date, serializeSeries(date, series)), "written" as const),
		};
		const asked: string[] = [];
		const api = { stress: async (date: string) => (asked.push(date), date === "2026-01-06" ? JAN_6 : OCT_7) } as unknown as GarminApi;
		const opts = { signedIn: true, groups: ["stress"] as const, extras: INTRADAY_EXTRAS, today: "2026-10-08" };

		const load = await loadDay(api, store, "2026-10-07", [STRESS_DAY.key], { ...opts, groups: [...opts.groups] });
		assert.deepEqual(asked, ["2026-10-07"]);
		assert.deepEqual(load.missing, []);
		assert.deepEqual(stressDayIn(load.series)?.levels.length, 460);
		assert.deepEqual(load.series?.checked, ["stressDay"]);

		// Garmin had nothing: checked, so the day is not asked again.
		const empty = await loadDay(api, store, "2026-01-06", [STRESS_DAY.key], { ...opts, groups: [...opts.groups] });
		assert.equal(stressDayIn(empty.series), null);
		assert.deepEqual(empty.missing, []);
		assert.equal((await loadDay(api, store, "2026-01-05", [STRESS_DAY.key], { ...opts, groups: ["intraday"] })).reason, "off");
		assert.deepEqual(asked, ["2026-10-07", "2026-01-06"]);
	});
});
