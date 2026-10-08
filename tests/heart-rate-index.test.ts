import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { timelineOf } from "../src/dashboard/heart-rate-pages";
import { linePath } from "../src/dashboard/stat-charts";
import type { DailyStatRow, DailySummary, GarminApi, HeartRateData } from "../src/garmin/endpoints";
import { DAY_INDEXES, dayIndex } from "../src/sync/day-indexes";
import { walkHistory } from "../src/sync/engine";
import {
	HEART_DAY,
	HEART_DAY_KEY,
	HEART_RATE_INDEX,
	heartDayIn,
	heartDayOf,
	rowOfStat,
	type HeartRateRow,
} from "../src/sync/heart-rate-index";
import { serializeSeries, type DaySeries } from "../src/sync/intraday";
import { INTRADAY_EXTRAS } from "../src/sync/intraday-extras";
import { SERIES_KEYS, loadDay } from "../src/sync/intraday-registry";

/**
 * `stats/heartRate/daily` rows as Garmin sent them: the Jan 2 – 29 window
 * (api-samples/history), with Jan 5 – 9 left out and Jan 21's resting value
 * null although the day has heart rate.
 */
const JANUARY: DailyStatRow[] = [
	{ calendarDate: "2026-01-02", values: { restingHR: 51, wellnessMaxAvgHR: 110, wellnessMinAvgHR: 49 } },
	{ calendarDate: "2026-01-03", values: { restingHR: 49, wellnessMaxAvgHR: 110, wellnessMinAvgHR: 47 } },
	// A full row here, though Stress has a −1 row for the day.
	{ calendarDate: "2026-01-04", values: { restingHR: 53, wellnessMaxAvgHR: 89, wellnessMinAvgHR: 57 } },
	{ calendarDate: "2026-01-10", values: { restingHR: 52, wellnessMaxAvgHR: 87, wellnessMinAvgHR: 47 } },
	{ calendarDate: "2026-01-21", values: { restingHR: null, wellnessMaxAvgHR: 115, wellnessMinAvgHR: 45 } },
];

/** The heart fields of the Oct 8 summary the web fetched at 01:17 (web body 28), the rest left out. */
const SUMMARY_OCT_8: DailySummary = {
	calendarDate: "2026-10-08",
	includesWellnessData: true,
	// The raw extremes, which the daily note keeps as min_hr / max_hr.
	minHeartRate: 57,
	maxHeartRate: 84,
	restingHeartRate: 52,
	lastSevenDaysAvgRestingHeartRate: 48,
	// The two-minute extremes: the page's low and High.
	minAvgHeartRate: 59,
	maxAvgHeartRate: 76,
	abnormalHeartRateAlertsCount: null,
};

const day = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
function datesOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = day(d, 1)) out.push(d);
	return out;
}

describe("HEART_RATE_INDEX — the definition", () => {
	it("is registered as the heart rate index: its folder, the heart group, 28 days a window", () => {
		assert.equal(dayIndex("heart-rate"), HEART_RATE_INDEX);
		assert.ok(DAY_INDEXES.includes(HEART_RATE_INDEX));
		assert.deepEqual(
			[HEART_RATE_INDEX.kind, HEART_RATE_INDEX.folder, HEART_RATE_INDEX.title, HEART_RATE_INDEX.group, HEART_RATE_INDEX.windowDays, HEART_RATE_INDEX.version],
			["heart-rate", "heart-rate", "heart rate", "heart", 28, 1],
		);
		assert.deepEqual(HEART_RATE_INDEX.keys, ["resting", "high", "low", "avg7"]);
		assert.deepEqual([HEART_RATE_INDEX.keepOld, HEART_RATE_INDEX.emptyWindowsToStop, HEART_RATE_INDEX.refreshDays], [true, 2, 0]);
		assert.equal(typeof HEART_RATE_INDEX.fromSummary, "function");
	});
});

describe("HEART_RATE_INDEX — a history window", () => {
	it("asks stats/heartRate/daily for the window and maps its rows, a null resting value dropped", async () => {
		const asked: string[] = [];
		const api = { heartRateDaily: async (start: string, end: string) => (asked.push(`${start} ${end}`), JANUARY) } as unknown as GarminApi;
		const rows = (await HEART_RATE_INDEX.fetchWindow(api, "2026-01-02", "2026-01-29")).map((r) => HEART_RATE_INDEX.normalize(r));
		assert.deepEqual(asked, ["2026-01-02 2026-01-29"]);
		assert.deepEqual(rows, [
			{ date: "2026-01-02", resting: 51, high: 110, low: 49 },
			{ date: "2026-01-03", resting: 49, high: 110, low: 47 },
			{ date: "2026-01-04", resting: 53, high: 89, low: 57 },
			{ date: "2026-01-10", resting: 52, high: 87, low: 47 },
			{ date: "2026-01-21", high: 115, low: 45 },
		]);
		assert.deepEqual(rowOfStat(null), { date: undefined, resting: undefined, high: undefined, low: undefined });
	});

	it("takes a day the window left out of the index, and keeps a day without a resting value", () => {
		const held: HeartRateRow[] = [
			{ date: "2026-01-04", resting: 50, high: 120, low: 48 },
			{ date: "2026-01-06", resting: 49, high: 100, low: 47 },
			{ date: "2026-01-21", high: 110, low: 44 },
		];
		const merged = HEART_RATE_INDEX.merge(held, { rows: JANUARY.map(rowOfStat) as HeartRateRow[], dates: datesOf("2026-01-02", "2026-01-29") });
		assert.deepEqual(merged, [
			{ date: "2026-01-02", resting: 51, high: 110, low: 49 },
			{ date: "2026-01-03", resting: 49, high: 110, low: 47 },
			{ date: "2026-01-04", resting: 53, high: 89, low: 57 },
			{ date: "2026-01-10", resting: 52, high: 87, low: 47 },
			{ date: "2026-01-21", high: 115, low: 45 },
		]);
	});

	it("keeps the seven-day average a day's summary gave when a window brings the day back", () => {
		const held: HeartRateRow[] = [{ date: "2026-10-07", resting: 49, high: 108, low: 46, avg7: 48 }];
		const fresh = rowOfStat({ calendarDate: "2026-10-07", values: { restingHR: 49, wellnessMaxAvgHR: 108, wellnessMinAvgHR: 46 } });
		assert.deepEqual(HEART_RATE_INDEX.merge(held, { rows: [fresh as HeartRateRow], dates: ["2026-10-07"] }), held);
	});

	it("walks back to the account's first day, 2025-08-02, and stops after two empty windows", async () => {
		const calls: string[] = [];
		const fetch = async (start: string, end: string) => {
			calls.push(`${start} ${end}`);
			return datesOf(start, end)
				.filter((d) => d >= "2025-08-02")
				.map((d) => rowOfStat({ calendarDate: d, values: { restingHR: 50, wellnessMaxAvgHR: 150, wellnessMinAvgHR: 45 } }));
		};
		const walk = await walkHistory(HEART_RATE_INDEX, fetch, { until: "2025-09-11" });
		// The windows the history was captured in (api-samples/history), then one more past its start.
		assert.deepEqual(calls, ["2025-08-15 2025-09-11", "2025-07-18 2025-08-14", "2025-06-20 2025-07-17", "2025-05-23 2025-06-19"]);
		assert.equal(walk.complete, true);
		assert.equal(walk.batch.rows.length, 41);
		assert.equal(walk.batch.rows[0]!.date, "2025-08-15");
	});
});

describe("HEART_RATE_INDEX — the daily summary", () => {
	const fromSummary = (summary: DailySummary, date: string) => {
		const row = HEART_RATE_INDEX.fromSummary!(summary, date);
		return row ? HEART_RATE_INDEX.normalize({ ...row, date }) : null;
	};

	it("makes the run's own day from its summary: the two-minute extremes, never the raw ones, and the seven-day average", () => {
		assert.deepEqual(fromSummary(SUMMARY_OCT_8, "2026-10-08"), { date: "2026-10-08", resting: 52, high: 76, low: 59, avg7: 48 });
	});

	it("keeps a day without a resting value, whose seven-day average is null too (2026-01-21)", () => {
		const jan21: DailySummary = { restingHeartRate: null, lastSevenDaysAvgRestingHeartRate: null, maxAvgHeartRate: 115, minAvgHeartRate: 45, maxHeartRate: 121, minHeartRate: 44 };
		assert.deepEqual(fromSummary(jan21, "2026-01-21"), { date: "2026-01-21", high: 115, low: 45 });
	});

	it("finds no day in a summary without heart rate", () => {
		const aug18: DailySummary = { includesWellnessData: false, restingHeartRate: null, lastSevenDaysAvgRestingHeartRate: null, maxAvgHeartRate: null, minAvgHeartRate: null };
		assert.equal(fromSummary(aug18, "2026-08-18"), null);
		assert.equal(fromSummary({}, "2026-08-18"), null);
		// The raw extremes alone are not the page's figures.
		assert.equal(fromSummary({ maxHeartRate: 90, minHeartRate: 50 }, "2026-08-18"), null);
	});
});

/* ------------------------------------------------------------------ */

const H = 3_600_000;
const STEP = 120_000;

/**
 * Oct 7, as dailyHeartRate sent it: a 23-hour day that began at UTC+3 and
 * ended at UTC+4 (api-samples/dailyHeartRate-2026-10-07.json). A cell a
 * two-minute slot from 21:00Z: a sample, "n" for a null sample, "-" for a
 * slot Garmin left out. 644 samples.
 */
const OCT_7_GRID = `50 53 49 51 50 50 51 52 52 48 50 50 56 49 48 47 52 49 47 50 53 50 51 51 51 52 50 51 57 49
50 59 49 51 51 52 53 54 55 60 54 58 55 57 61 56 56 54 49 50 51 51 50 52 50 49 51 50 51 51
52 51 50 51 51 51 51 50 51 51 51 56 48 51 49 50 49 50 49 50 47 48 51 48 49 49 51 51 50 50
51 51 50 50 50 51 50 51 50 58 57 52 61 58 66 48 52 48 48 50 52 49 49 51 52 51 49 46 51 54
56 54 55 52 51 50 51 51 53 53 52 52 53 52 56 49 49 51 48 48 49 49 48 49 48 49 48 48 49 51
51 51 50 49 51 50 49 48 49 52 57 49 54 51 56 51 52 51 52 51 48 49 51 49 48 51 53 50 61 51
53 52 51 52 52 53 52 52 52 52 52 51 52 51 50 50 51 51 51 50 50 51 50 53 49 48 49 59 58 60
64 65 65 62 61 60 66 61 59 61 74 71 77 76 55 55 58 55 59 57 56 56 59 60 57 63 63 58 62 63
58 60 61 60 63 59 55 59 62 64 75 81 78 69 77 63 78 87 94 86 93 98 90 86 68 82 76 86 85 79
67 71 78 65 60 61 58 57 57 58 57 60 60 66 63 66 60 67 57 65 63 62 67 76 76 60 61 59 64 62
63 60 65 60 61 56 77 87 91 90 91 90 78 75 71 70 57 59 62 57 67 72 75 57 58 58 60 62 60 75
89 87 88 92 95 85 65 61 61 54 59 61 65 56 63 69 64 65 62 62 57 57 68 69 60 62 57 62 67 64
64 74 83 81 74 75 71 76 n 86 93 86 77 61 59 54 67 77 76 73 74 64 69 81 81 56 62 61 64 60
62 62 63 61 65 61 65 65 64 60 61 66 65 64 60 63 68 62 64 68 68 73 64 64 60 75 69 60 74 98
74 62 63 66 63 70 82 79 79 65 61 64 63 68 64 71 68 63 64 67 65 62 62 62 61 63 62 68 65 74
69 72 77 68 66 64 70 68 65 67 66 69 67 62 71 77 81 75 71 72 66 60 66 71 67 68 71 73 73 76
66 65 68 74 72 60 63 62 63 67 66 66 64 68 71 67 66 68 72 63 67 72 83 90 88 94 99 91 92 98
98 92 90 92 105 107 101 91 91 70 66 70 70 71 82 78 75 71 71 72 69 72 68 60 64 59 62 60 62 55
64 60 62 68 62 62 69 67 69 79 88 80 82 75 74 84 69 69 71 72 71 69 81 80 79 75 79 80 n -
- - - - - - - - - - - - - - - - - - - - 73 n - 78 n - - - - -
- - - - - - - - - - - - - - - - - - - 76 80 85 88 98 99 98 94 90 107 107
108 103 92 82 93 91 89 92 91 87 80 86 87 80 77 88 83 100 97 93 84 80 81 77 78 82 95 82 75 75
90 100 83 83 96 88 90 78 86 93 94 77 74 73 72 73 71 72 69 73 73 72 70 64 65 72 71 65 67 70`.split(/\s+/);

/** Today at 01:06 local: 34 samples (dailyHeartRate-2026-10-08.json). */
const OCT_8_VALUES = [72, 70, 66, 67, 67, 67, 66, 68, 65, 62, 66, 61, 63, 64, 65, 64, 63, 68, 63, 61, 62, 76, 70, 64, 74, 75, 62, 61, 61, 62, 60, 60, 59, 60];

const DESCRIPTORS = [
	{ index: 0, key: "timestamp" },
	{ index: 1, key: "heartrate" },
];

/** A dailyHeartRate payload: the day's bounds, its figures, a sample every two minutes from `start` per the grid. */
function payload(
	bounds: [string | null, string | null, string | null, string | null],
	grid: readonly string[],
	figures: { resting?: number | null; avg7?: number | null; max?: number | null; min?: number | null } = {},
	descriptors: typeof DESCRIPTORS | null = DESCRIPTORS,
): HeartRateData {
	const start = bounds[0] ? Date.parse(`${bounds[0]}Z`) : 0;
	const timeAt = descriptors?.find((d) => d.key === "timestamp")?.index ?? 0;
	const values = grid.flatMap((cell, i) => {
		if (cell === "-") return [];
		const v = cell === "n" ? null : Number(cell);
		return [timeAt === 0 ? [start + i * STEP, v] : [v, start + i * STEP]];
	});
	return {
		calendarDate: bounds[2]?.slice(0, 10),
		startTimestampGMT: bounds[0],
		endTimestampGMT: bounds[1],
		startTimestampLocal: bounds[2],
		endTimestampLocal: bounds[3],
		maxHeartRate: figures.max ?? null,
		minHeartRate: figures.min ?? null,
		restingHeartRate: figures.resting ?? null,
		lastSevenDaysAvgRestingHeartRate: figures.avg7 ?? null,
		heartRateValueDescriptors: grid.length ? descriptors : null,
		heartRateValues: grid.length ? (values as Array<[number, number | null]>) : null,
	};
}

const OCT_7 = payload(["2026-10-06T21:00:00.0", "2026-10-07T20:00:00.0", "2026-10-07T00:00:00.0", "2026-10-08T00:00:00.0"], OCT_7_GRID, {
	resting: 49,
	avg7: 48,
	max: 108,
	min: 46,
});

/** Today: its GMT end is the last sync (21:08Z), its local end the next midnight. */
const OCT_8 = payload(["2026-10-07T20:00:00.0", "2026-10-07T21:08:00.0", "2026-10-08T00:00:00.0", "2026-10-09T00:00:00.0"], OCT_8_VALUES.map(String), {
	resting: 52,
	avg7: 48,
	max: 76,
	min: 59,
});

/** A day the watch never synced, verbatim (dailyHeartRate-2026-01-06.json). */
const JAN_6 = JSON.parse(
	'{"userProfilePK":1,"calendarDate":"2026-01-06","startTimestampGMT":null,"endTimestampGMT":null,"startTimestampLocal":null,"endTimestampLocal":null,"maxHeartRate":null,"minHeartRate":null,"restingHeartRate":null,"lastSevenDaysAvgRestingHeartRate":null,"heartRateValueDescriptors":null,"heartRateValues":null}',
) as HeartRateData;

/** A day without data, which still has its bounds, verbatim (dailyHeartRate-2026-08-18.json). */
const AUG_18 = JSON.parse(
	'{"userProfilePK":1,"calendarDate":"2026-08-18","startTimestampGMT":"2026-08-17T21:00:00.0","endTimestampGMT":"2026-08-18T21:00:00.0","startTimestampLocal":"2026-08-18T00:00:00.0","endTimestampLocal":"2026-08-19T00:00:00.0","maxHeartRate":null,"minHeartRate":null,"restingHeartRate":null,"lastSevenDaysAvgRestingHeartRate":null,"heartRateValueDescriptors":null,"heartRateValues":null}',
) as HeartRateData;

/** Before the samples start: the 35-hour day the watch flew west, resting and the seven-day average only (dailyHeartRate-2025-10-31.json). */
const OCT_31_2025 = JSON.parse(
	'{"userProfilePK":1,"calendarDate":"2025-10-31","startTimestampGMT":"2025-10-30T20:00:00.0","endTimestampGMT":"2025-11-01T07:00:00.0","startTimestampLocal":"2025-10-31T00:00:00.0","endTimestampLocal":"2025-11-01T00:00:00.0","maxHeartRate":null,"minHeartRate":null,"restingHeartRate":54,"lastSevenDaysAvgRestingHeartRate":50,"heartRateValueDescriptors":null,"heartRateValues":null}',
) as HeartRateData;

/** No resting value: dailyHeartRate sends the raw minimum, 44, where the summary and the stats row are null (dailyHeartRate-2026-01-21.json). */
const JAN_21 = JSON.parse(
	'{"userProfilePK":1,"calendarDate":"2026-01-21","startTimestampGMT":"2026-01-21T08:00:00.0","endTimestampGMT":"2026-01-22T03:52:00.0","startTimestampLocal":"2026-01-21T00:00:00.0","endTimestampLocal":"2026-01-22T00:00:00.0","maxHeartRate":null,"minHeartRate":null,"restingHeartRate":44,"lastSevenDaysAvgRestingHeartRate":null,"heartRateValues":null,"heartRateValueDescriptors":null}',
) as HeartRateData;

const cellValue = (cell: string) => (cell === "-" || cell === "n" ? null : Number(cell));
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);

describe("HEART_DAY — the day's samples", () => {
	it("is an extra of its own, under the heart group, fetching dailyHeartRate for the day", async () => {
		assert.equal(HEART_DAY.key, HEART_DAY_KEY);
		assert.equal(HEART_DAY.key, "heartDay");
		assert.equal(HEART_DAY.group, "heart");
		assert.ok(!SERIES_KEYS.has(HEART_DAY.key));
		assert.ok(INTRADAY_EXTRAS.includes(HEART_DAY));
		const asked: string[] = [];
		const api = { heartRate: async (date: string) => (asked.push(date), OCT_7) } as unknown as GarminApi;
		assert.equal(await HEART_DAY.fetch(api, "2026-10-07"), OCT_7);
		assert.deepEqual(asked, ["2026-10-07"]);
	});

	it("rebuilds Oct 7's payload as captured: 644 samples, four null, three jumps", () => {
		const samples = OCT_7.heartRateValues!;
		assert.equal(samples.length, 644);
		assert.deepEqual(samples.filter(([, v]) => v === null).map(([t]) => clock(t)), ["09:16", "15:56", "16:42", "16:48"]);
		const jumps = samples.flatMap(([t], i) => (i > 0 && t - samples[i - 1]![0] > STEP ? [`${clock(samples[i - 1]![0])} ${clock(t)}`] : []));
		assert.deepEqual(jumps, ["15:56 16:40", "16:42 16:46", "16:48 17:38"]);
	});

	it("keeps a 23-hour day's bounds, both offsets, Garmin's figures and every sample on a two-minute grid", () => {
		const block = heartDayOf(OCT_7)!;
		assert.equal(block.start, Date.parse("2026-10-06T21:00:00Z"));
		assert.equal(block.end, Date.parse("2026-10-07T20:00:00Z"));
		assert.deepEqual([block.startOffset, block.endOffset, block.step], [3 * H, 4 * H, STEP]);
		assert.deepEqual([block.resting, block.avg7, block.high, block.low], [49, 48, 108, 46]);
		// 23 hours of slots, up to the last sample at 19:58Z.
		assert.equal(block.values.length, 690);
		assert.deepEqual(block.values, OCT_7_GRID.map(cellValue));
		assert.deepEqual([block.values.filter((v) => v !== null).length, block.values.filter((v) => v === null).length], [640, 50]);
		// Garmin's High and low are the highest and lowest samples on this day.
		const measured = block.values.filter((v): v is number => v !== null);
		assert.deepEqual([Math.max(...measured), Math.min(...measured)], [108, 46]);
	});

	it("draws Oct 7 as 23 hours, broken at every null and jump, its highest sample 108 at 18:00Z and lowest 46 at 00:54Z", () => {
		const t = timelineOf(heartDayOf(OCT_7));
		assert.equal(t.state, "drawn");
		assert.equal(t.hours, 23);
		assert.equal(t.ticks.length, 24);
		assert.deepEqual(t.timeZones, { start: "GMT +03:00", end: "GMT +04:00" });
		assert.equal(t.points.length, 690);
		assert.deepEqual([clock(t.highest!.at), t.highest!.value, clock(t.lowest!.at), t.lowest!.value], ["18:00", 108, "00:54", 46]);
		assert.equal(t.highest!.x, (630 * STEP) / (23 * H));
		// Five runs: 21:00Z–09:14Z, 09:18Z–15:54Z, the lone 16:40Z and 16:46Z, which draw nothing, and 17:38Z–19:58Z.
		const path = linePath(t.points.map((p) => [p.x * 1000, p.value]));
		const runs = path.split("M").slice(1).map((run) => run.trim().split(" L").length);
		assert.deepEqual(runs, [368, 199, 1, 1, 71]);
	});

	it("keeps today's partial day to the last sync, without an end offset: its end is not a midnight", () => {
		const block = heartDayOf(OCT_8)!;
		assert.deepEqual([block.start, block.end], [Date.parse("2026-10-07T20:00:00Z"), Date.parse("2026-10-07T21:08:00Z")]);
		assert.deepEqual([block.startOffset, block.endOffset], [4 * H, undefined]);
		assert.deepEqual(block.values, OCT_8_VALUES);
		assert.deepEqual([block.resting, block.avg7, block.high, block.low], [52, 48, 76, 59]);
		const t = timelineOf(block, true);
		assert.deepEqual([t.hours, t.ticks.length, t.points.length, t.timeZones], [24, 25, 34, undefined]);
		assert.deepEqual([clock(t.highest!.at), t.highest!.value, clock(t.lowest!.at), t.lowest!.value], ["20:42", 76, "21:04", 59]);
	});

	it("keeps a day before the samples start: its figures, its 35-hour bounds and no samples", () => {
		const block = heartDayOf(OCT_31_2025)!;
		assert.deepEqual(block, {
			start: Date.parse("2025-10-30T20:00:00Z"),
			end: Date.parse("2025-11-01T07:00:00Z"),
			startOffset: 4 * H,
			endOffset: -7 * H,
			step: STEP,
			values: [],
			resting: 54,
			avg7: 50,
		});
		const t = timelineOf(block);
		assert.deepEqual([t.state, t.hours, t.points, t.highest], ["empty", 35, [], undefined]);
		assert.deepEqual(t.timeZones, { start: "GMT +04:00", end: "GMT -07:00" });
	});

	it("keeps the raw minimum dailyHeartRate sends as resting on a day Garmin has none: the page prefers the index's", () => {
		const block = heartDayOf(JAN_21)!;
		assert.deepEqual([block.resting, block.avg7, block.high, block.low, block.values], [44, undefined, undefined, undefined, []]);
	});

	it("keeps Garmin's High where the samples run past it (2026-06-18: 105, the samples to 168)", () => {
		const grid = ["51", "55", "n", "105", "168", "112"];
		const block = heartDayOf(payload(["2026-06-17T21:00:00.0", "2026-06-18T21:00:00.0", "2026-06-18T00:00:00.0", "2026-06-19T00:00:00.0"], grid, { resting: 43, max: 105, min: 45 }))!;
		assert.deepEqual([block.high, block.low, block.resting, block.avg7], [105, 45, 43, undefined]);
		assert.deepEqual(block.values, [51, 55, null, 105, 168, 112]);
	});

	it("has nothing for a day Garmin had nothing for, bounds or not", () => {
		assert.equal(heartDayOf(JAN_6), null);
		assert.equal(heartDayOf(AUG_18), null);
		assert.equal(heartDayOf(null), null);
	});

	it("finds the columns by Garmin's descriptors, and leaves a missing sample's slot empty", () => {
		const bounds: [string, string, string, string] = ["2026-10-07T20:00:00.0", "2026-10-07T20:12:00.0", "2026-10-08T00:00:00.0", "2026-10-09T00:00:00.0"];
		const swapped = payload(bounds, ["72", "70"], {}, [
			{ index: 1, key: "timestamp" },
			{ index: 0, key: "heartrate" },
		]);
		assert.deepEqual(heartDayOf(swapped)!.values, [72, 70]);
		const block = heartDayOf(payload(bounds, ["72", "70", "-", "67", "n", "65"], {}, null))!;
		assert.equal(block.step, STEP);
		assert.deepEqual(block.values, [72, 70, null, 67, null, 65]);
	});

	it("stays small: Oct 7's 690 slots come to about two kilobytes", () => {
		const text = JSON.stringify(heartDayOf(OCT_7));
		assert.ok(text.length < 2_400, `${text.length} characters`);
	});

	it("reads the block back from the series file, and nothing from one it cannot read", () => {
		const block = heartDayOf(OCT_7)!;
		const series = JSON.parse(serializeSeries("2026-10-07", { extra: { heartDay: block } })) as DaySeries;
		assert.deepEqual(heartDayIn(series), block);
		const bent = heartDayIn({ extra: { heartDay: { ...block, values: [60, "x", -1, null], resting: "49", avg7: null } } })!;
		assert.deepEqual([bent.values, bent.resting, bent.avg7, bent.high], [[60, null, null, null], undefined, undefined, 108]);
		assert.equal(heartDayIn({ extra: { heartDay: { start: "soon", end: 1, step: 1, values: [] } } }), null);
		assert.equal(heartDayIn({ extra: { heartDay: { start: 2, end: 1, step: STEP, values: [] } } }), null);
		assert.equal(heartDayIn({ heartRate: [[1, 60]] }), null);
		assert.equal(heartDayIn(null), null);
	});

	it("loads on view into the day's series file, one request under the heart group", async () => {
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
		const api = { heartRate: async (date: string) => (asked.push(date), date === "2026-01-06" ? JAN_6 : OCT_7) } as unknown as GarminApi;
		const opts = { signedIn: true, extras: INTRADAY_EXTRAS, today: "2026-10-08" };

		const load = await loadDay(api, store, "2026-10-07", [HEART_DAY.key], { ...opts, groups: ["heart"] });
		assert.deepEqual(asked, ["2026-10-07"]);
		assert.deepEqual(load.missing, []);
		assert.equal(heartDayIn(load.series)?.values.length, 690);
		assert.deepEqual(load.series?.checked, ["heartDay"]);

		// Garmin had nothing: checked, so the day is not asked again.
		const empty = await loadDay(api, store, "2026-01-06", [HEART_DAY.key], { ...opts, groups: ["heart"] });
		assert.equal(heartDayIn(empty.series), null);
		assert.deepEqual(empty.missing, []);
		assert.deepEqual((await loadDay(api, store, "2026-01-06", [HEART_DAY.key], { ...opts, groups: ["heart"] })).missing, []);
		assert.equal((await loadDay(api, store, "2026-01-05", [HEART_DAY.key], { ...opts, groups: ["intraday"] })).reason, "off");
		assert.deepEqual(asked, ["2026-10-07", "2026-01-06"]);
	});
});
