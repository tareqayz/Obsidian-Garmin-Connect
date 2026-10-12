import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, MaxMetrics } from "../src/garmin/endpoints";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import type { DayData } from "../src/sync/metrics";
import { VO2_MAX_INDEX, rowOfMaxMetrics, vo2DateOf, type Vo2MaxRow } from "../src/sync/vo2-max-index";

/*
 * `maxmet/daily` rows as Garmin sent them on 2026-10-11
 * (ref/performance-stats/vo2-max/api-samples/probe-daily-3660-2016-10-14_2026-10-11.json),
 * some acclimation blocks trimmed.
 */

/** A day with both readings; the cycling one is 2025's first. */
const SEP_1_2025: MaxMetrics = {
	userId: 136055941,
	generic: { calendarDate: "2025-09-01", vo2MaxPreciseValue: 55.6, vo2MaxValue: 56, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 0 },
	cycling: { calendarDate: "2025-09-01", vo2MaxPreciseValue: 55.9, vo2MaxValue: 56, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 1 },
	heatAltitudeAcclimation: {
		calendarDate: "2025-09-01",
		altitudeAcclimationDate: "2025-09-02",
		previousAltitudeAcclimationDate: "2025-09-01",
		heatAcclimationDate: "2025-09-02",
		previousHeatAcclimationDate: "2025-09-01",
		altitudeAcclimation: 850,
		previousAltitudeAcclimation: 850,
		heatAcclimationPercentage: 50,
		previousHeatAcclimationPercentage: 56,
		heatTrend: "DEACCLIMATIZING",
		altitudeTrend: "ACCLIMATIZED",
		currentAltitude: 72,
		previousAltitude: 73,
		acclimationPercentage: 0,
		previousAcclimationPercentage: 0,
		altitudeAcclimationLocalTimestamp: "2025-09-01T19:22:02.0",
	},
};

/** A ride only: `generic` is null, and Garmin's integer for 56.5 is 56. */
const SEP_10_2025: MaxMetrics = {
	userId: 136055941,
	generic: null,
	cycling: { calendarDate: "2025-09-10", vo2MaxPreciseValue: 56.5, vo2MaxValue: 56, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 1 },
	heatAltitudeAcclimation: { calendarDate: "2025-09-10", heatAcclimationPercentage: 24, previousHeatAcclimationPercentage: 28, heatTrend: "DEACCLIMATIZING", currentAltitude: 92 },
};

/** The newest cycling reading, Current's on the Cycling tab. */
const OCT_15_2025: MaxMetrics = {
	userId: 136055941,
	generic: { calendarDate: "2025-10-15", vo2MaxPreciseValue: 56.1, vo2MaxValue: 56, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 0 },
	cycling: { calendarDate: "2025-10-15", vo2MaxPreciseValue: 57.4, vo2MaxValue: 57, fitnessAge: 20, fitnessAgeDescription: null, maxMetCategory: 1 },
	heatAltitudeAcclimation: { calendarDate: "2025-10-15", heatAcclimationPercentage: 72, previousHeatAcclimationPercentage: 47, heatTrend: "ACCLIMATIZING" },
};

const OCT_10: MaxMetrics = {
	userId: 136055941,
	generic: { calendarDate: "2026-10-10", vo2MaxPreciseValue: 54.8, vo2MaxValue: 55, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 0 },
	cycling: null,
	heatAltitudeAcclimation: { calendarDate: "2026-10-10", heatAcclimationPercentage: 79, previousHeatAcclimationPercentage: 68, heatTrend: "ACCLIMATIZING" },
};

/** The capture day: the phone's "Today · 55 · Excellent". */
const OCT_11: MaxMetrics = {
	userId: 136055941,
	generic: { calendarDate: "2026-10-11", vo2MaxPreciseValue: 54.9, vo2MaxValue: 55, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 0 },
	cycling: null,
	heatAltitudeAcclimation: {
		calendarDate: "2026-10-11",
		altitudeAcclimationDate: "2026-10-11",
		previousAltitudeAcclimationDate: "2026-10-11",
		heatAcclimationDate: "2026-10-11",
		previousHeatAcclimationDate: "2026-10-10",
		altitudeAcclimation: 0,
		previousAltitudeAcclimation: 0,
		heatAcclimationPercentage: 97,
		previousHeatAcclimationPercentage: 79,
		heatTrend: "ACCLIMATIZING",
		altitudeTrend: null,
		currentAltitude: 0,
		previousAltitude: 0,
		acclimationPercentage: 0,
		previousAcclimationPercentage: 0,
		altitudeAcclimationLocalTimestamp: "2026-10-11T09:41:08.0",
	},
};

/** `maxmet/weekly/2026-07-20/2026-10-11`'s first row: its acclimation block is a day later than its reading. */
const WEEKLY_AUG_1: MaxMetrics = {
	userId: 136055941,
	generic: { calendarDate: "2026-08-01", vo2MaxPreciseValue: 55.1, vo2MaxValue: 55, fitnessAge: null, fitnessAgeDescription: null, maxMetCategory: 0 },
	cycling: null,
	heatAltitudeAcclimation: { calendarDate: "2026-08-02", heatAcclimationDate: "2026-08-01", heatAcclimationPercentage: 75, currentAltitude: 308 },
};

/** Every day of the history with a reading: 161 rows, 2025-08-03 → 2026-10-11, by month. */
const HISTORY_DAYS = [
	"2025-08: 03 05 06 07 08 11 15 16 17 19 21 22 23 25 26 27 28 31",
	"2025-09: 01 02 03 05 06 07 08 09 10 12 13 15 16 18 21 25 26 27 29",
	"2025-10: 01 04 05 08 09 12 13 15 16 17 18 22 25 29",
	"2025-11: 01 03 04 05 09 10 15 16 19 21 23 25",
	"2025-12: 02 07 13 28",
	"2026-01: 01 15 16 23 24 26 28 30",
	"2026-02: 03 07 10 13 14 17 21",
	"2026-03: 08 09 12 17 18 22 24 27 28 30 31",
	"2026-04: 04 06 08 10 12 16 18 19 22 23 24 25 26 28",
	"2026-05: 01 02 03 07 08 10 12 17 21 24 28 30 31",
	"2026-06: 01 07 08 13 15 17 19 26 29 30",
	"2026-07: 02 11 18 27 30",
	"2026-08: 01 07 08 09 10 16 23 24 29 30 31",
	"2026-09: 03 05 07 09 12 15 16 19 23 25 27 28",
	"2026-10: 03 10 11",
].flatMap((line) => {
	const [month, days] = line.split(": ");
	return days!.split(" ").map((d) => `${month}-${d}`);
});

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => VO2_MAX_INDEX.normalize(r));

describe("VO2_MAX_INDEX — the definition", () => {
	it("is the vo2-max index of the fitness group: a year a window, fed by the day sync's maxMetrics", () => {
		assert.deepEqual(
			[VO2_MAX_INDEX.kind, VO2_MAX_INDEX.folder, VO2_MAX_INDEX.title, VO2_MAX_INDEX.group, VO2_MAX_INDEX.version, VO2_MAX_INDEX.listKey],
			["vo2-max", "vo2-max", "VO₂ max", "fitness", 1, "days"],
		);
		assert.deepEqual([VO2_MAX_INDEX.windowDays, VO2_MAX_INDEX.refreshDays, VO2_MAX_INDEX.emptyWindowsToStop, VO2_MAX_INDEX.keepOld], [365, 0, 1, false]);
		assert.equal(VO2_MAX_INDEX.maxHistoryDays, undefined);
		// Four columns in this order, and no heat or altitude: those days have no row here.
		assert.deepEqual(VO2_MAX_INDEX.keys, ["vo2", "vo2Value", "cycling", "cyclingValue"]);
		assert.deepEqual(VO2_MAX_INDEX.fromDay?.needs, ["maxMetrics"]);
		assert.equal(VO2_MAX_INDEX.fromSummary, undefined);
	});

	it("writes a year file a row a line, the precise values to 1 dp and Garmin's integers whole", () => {
		const rows = [rowOfMaxMetrics(SEP_1_2025), rowOfMaxMetrics(SEP_10_2025)].map((r) => VO2_MAX_INDEX.normalize(r)!) as Vo2MaxRow[];
		const text = VO2_MAX_INDEX.serializeYear("2025", rows);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2025,\n\t"days": [\n' +
				'\t\t{"date":"2025-09-01","vo2":55.6,"vo2Value":56,"cycling":55.9,"cyclingValue":56},\n' +
				'\t\t{"date":"2025-09-10","cycling":56.5,"cyclingValue":56}\n\t]\n}\n',
		);
		assert.deepEqual(VO2_MAX_INDEX.parseYear(text), rows);
	});
});

describe("VO2_MAX_INDEX — a window", () => {
	it("asks maxmet/daily for the window and keeps each day's readings, without the acclimation block", async () => {
		const asked: string[] = [];
		const api = { maxMetrics: async (start: string, end: string) => (asked.push(`${start} ${end}`), [SEP_1_2025, SEP_10_2025, OCT_15_2025, OCT_10, OCT_11]) } as unknown as GarminApi;
		const rows = normalized(await VO2_MAX_INDEX.fetchWindow(api, "2025-10-12", "2026-10-11"));
		assert.deepEqual(asked, ["2025-10-12 2026-10-11"]);
		assert.deepEqual(rows, [
			{ date: "2025-09-01", vo2: 55.6, vo2Value: 56, cycling: 55.9, cyclingValue: 56 },
			// A ride only: the day is the cycling reading's.
			{ date: "2025-09-10", cycling: 56.5, cyclingValue: 56 },
			{ date: "2025-10-15", vo2: 56.1, vo2Value: 56, cycling: 57.4, cyclingValue: 57 },
			{ date: "2026-10-10", vo2: 54.8, vo2Value: 55 },
			{ date: "2026-10-11", vo2: 54.9, vo2Value: 55 },
		]);
	});

	it("dates a row by its reading, never by its acclimation block", () => {
		assert.equal(vo2DateOf(WEEKLY_AUG_1), "2026-08-01");
		assert.equal(vo2DateOf(SEP_10_2025), "2025-09-10");
		assert.equal(vo2DateOf({ generic: null, cycling: null }), undefined);
		assert.equal(vo2DateOf(null), undefined);
		// A row with no reading is no row, whatever its acclimation says.
		assert.equal(VO2_MAX_INDEX.normalize(rowOfMaxMetrics({ generic: null, cycling: null })), null);
	});

	it("drops what Garmin sends as null, keeping the rest of the day", () => {
		const row = rowOfMaxMetrics({ generic: { calendarDate: "2026-01-01", vo2MaxPreciseValue: null, vo2MaxValue: 58 }, cycling: null });
		assert.deepEqual(VO2_MAX_INDEX.normalize(row), { date: "2026-01-01", vo2Value: 58 });
	});

	it("walks the history in two requests once the newest year is in, and three from today", async () => {
		const api = {
			maxMetrics: async (start: string, end: string): Promise<MaxMetrics[]> =>
				HISTORY_DAYS.filter((d) => d >= start && d <= end).map((d) => ({ generic: { calendarDate: d, vo2MaxPreciseValue: 55, vo2MaxValue: 55 }, cycling: null, heatAltitudeAcclimation: { calendarDate: d } })),
		} as unknown as GarminApi;
		const calls: string[] = [];
		const fetch = (start: string, end: string) => (calls.push(`${start} ${end}`), VO2_MAX_INDEX.fetchWindow(api, start, end));

		const walk = await walkHistory(VO2_MAX_INDEX, fetch, { until: "2025-10-11" });
		// The spec's walk: 42 rows, then an empty year ends it.
		assert.deepEqual(calls, ["2024-10-12 2025-10-11", "2023-10-13 2024-10-11"]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete], [2, 42, true]);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], "2025-08-03");

		calls.length = 0;
		const whole = await walkHistory(VO2_MAX_INDEX, fetch, { until: "2026-10-11" });
		assert.deepEqual(calls, ["2025-10-12 2026-10-11", "2024-10-12 2025-10-11", "2023-10-13 2024-10-11"]);
		assert.deepEqual([whole.requests, whole.batch.rows.length, whole.complete], [3, 161, true]);
		assert.deepEqual(whole.covered, { from: "2023-10-13", to: "2026-10-11" });
	});
});

describe("VO2_MAX_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = VO2_MAX_INDEX.fromDay!.read(day, date);
		return row ? VO2_MAX_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's maxMetrics row, both sports", () => {
		assert.deepEqual(read({ maxMetrics: OCT_11 }, "2026-10-11"), { date: "2026-10-11", vo2: 54.9, vo2Value: 55 });
		assert.deepEqual(read({ maxMetrics: OCT_15_2025 }, "2025-10-15"), { date: "2025-10-15", vo2: 56.1, vo2Value: 56, cycling: 57.4, cyclingValue: 57 });
		assert.deepEqual(read({ maxMetrics: SEP_10_2025 }, "2025-09-10"), { date: "2025-09-10", cycling: 56.5, cyclingValue: 56 });
	});

	it("finds no row on a day without a reading: the range call sent none for it", () => {
		assert.equal(read({ maxMetrics: null }, "2026-10-09"), null);
		assert.equal(read({}, "2026-10-09"), null);
	});

	/** The fitness group alone: max metrics and hill scores for the run, endurance and fitness age a day. */
	function fitnessSource(calls: string[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "maxMetrics") return [OCT_10, OCT_11].filter((r) => r.generic!.calendarDate! >= a! && r.generic!.calendarDate! <= b!);
				if (name === "hillScores") return [];
				if (name === "enduranceScore" || name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<Vo2MaxRow> {
		held: { from?: string; to?: string } | null = { from: "2025-08-03", to: "2026-10-07" };
		merged: Array<DayIndexBatch<Vo2MaxRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<Vo2MaxRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	it("is fed by a routine sync at no request of its own, every day of the run covered", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink();
		const target: DayTarget = { exists: () => true, write: async () => "written" };
		const report = await syncRange(fitnessSource(calls), target, {
			from: "2026-10-08",
			to: "2026-10-11",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: VO2_MAX_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		assert.equal(calls.filter((c) => c.startsWith("maxMetrics")).length, 1);
		// One range call each for max metrics and hill scores, two calls a day for four days.
		assert.equal(report.requests, 10);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [
			{ date: "2026-10-11", vo2: 54.9, vo2Value: 55 },
			{ date: "2026-10-10", vo2: 54.8, vo2Value: 55 },
		]);
		// Oct 8 and 9 had heat but no reading: covered, with no row.
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
	});
});
