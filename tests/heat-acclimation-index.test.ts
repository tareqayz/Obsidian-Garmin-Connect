import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Acclimation, GarminApi, TrainingStatus } from "../src/garmin/endpoints";
import { RESERVED_INDEX_NAMES, defineDayIndex, type DayIndexBatch } from "../src/sync/day-index";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import {
	HEAT_ACCLIMATION_INDEX,
	acclimationDateOf,
	rowOfAcclimation,
	rowOfDay,
	rowsOfDaily,
	type HeatAcclimationRow,
} from "../src/sync/heat-acclimation-index";
import type { DayData, MetricGroup } from "../src/sync/metrics";
import { HEAT_ROWS, OCT_12_ROW } from "./heat-acclimation-fixture";

/*
 * Payloads as Garmin sent them on 2026-10-11/12
 * (ref/performance-stats/heat-acclimation/api-samples/ and the Training
 * Status spec's heat-*.json and aggregated-*.json).
 */

/** Every row has these 16 keys; the ones the index leaves out are here. */
const ZERO: Acclimation = {
	altitudeAcclimation: 0,
	previousAltitudeAcclimation: 0,
	heatAcclimationPercentage: 0,
	previousHeatAcclimationPercentage: 0,
	heatTrend: null,
	altitudeTrend: null,
	currentAltitude: 0,
	previousAltitude: 0,
	acclimationPercentage: 0,
	previousAcclimationPercentage: 0,
};

/** The capture day (`daily-28-…`, `heat-latest-2026-10-11.json`): the phone's "97%" and "Trending up from 79%.". */
const OCT_11: Acclimation = {
	...ZERO,
	calendarDate: "2026-10-11",
	altitudeAcclimationDate: "2026-10-11",
	previousAltitudeAcclimationDate: "2026-10-11",
	heatAcclimationDate: "2026-10-11",
	previousHeatAcclimationDate: "2026-10-10",
	heatAcclimationPercentage: 97,
	previousHeatAcclimationPercentage: 79,
	heatTrend: "ACCLIMATIZING",
	altitudeAcclimationLocalTimestamp: "2026-10-11T23:57:25.0",
};

/** Oct 10: 79 from 68. */
const OCT_10: Acclimation = {
	...ZERO,
	calendarDate: "2026-10-10",
	heatAcclimationDate: "2026-10-10",
	heatAcclimationPercentage: 79,
	previousHeatAcclimationPercentage: 68,
	heatTrend: "ACCLIMATIZING",
	altitudeAcclimationLocalTimestamp: "2026-10-10T23:58:23.0",
};

/** Oct 9 (`aggregated-2026-10-09.json`): 68 from 100, Garmin's reading date a day behind its calendar day. */
const OCT_09: Acclimation = {
	...ZERO,
	calendarDate: "2026-10-09",
	altitudeAcclimationDate: "2026-10-09",
	heatAcclimationDate: "2026-10-08",
	previousHeatAcclimationDate: "2026-10-07",
	heatAcclimationPercentage: 68,
	previousHeatAcclimationPercentage: 100,
	heatTrend: "DEACCLIMATIZING",
	currentAltitude: 136,
	altitudeAcclimationLocalTimestamp: "2026-10-09T23:56:22.0",
};

/** Oct 12 at 00:01:42 (`probe-daily-future-…`), before the watch synced: the overnight decay, dated a day ahead of its reading. */
const OCT_12: Acclimation = {
	...ZERO,
	calendarDate: "2026-10-12",
	altitudeAcclimationDate: "2026-10-11",
	heatAcclimationDate: "2026-10-11",
	previousHeatAcclimationDate: "2026-10-11",
	heatAcclimationPercentage: 95,
	previousHeatAcclimationPercentage: 97,
	heatTrend: "DEACCLIMATIZING",
	altitudeAcclimationLocalTimestamp: "2026-10-12T00:01:42.0",
};

/** `aggregated-2026-07-23-zero.json`'s row: 0 %, no trend. */
const JUL_23: Acclimation = { ...ZERO, calendarDate: "2026-07-23", heatAcclimationDate: "2026-07-23", altitudeAcclimationLocalTimestamp: "2026-07-23T23:54:20.0" };

/** The gap window's two rows (`probe-daily-gap-2026-01-04_2026-01-10.json`); Jan 4 is what Jan 7's aggregated payload carries. */
const JAN_04: Acclimation = { ...ZERO, calendarDate: "2026-01-04", altitudeAcclimationLocalTimestamp: "2026-01-04T00:02:59.0" };
const JAN_10: Acclimation = { ...ZERO, calendarDate: "2026-01-10", heatAcclimationDate: "2026-01-11", currentAltitude: 433 };

/** 2025-08-18: the first day at altitude, 850 m from 0 at 2041 m. */
const AUG_18_2025: Acclimation = {
	...ZERO,
	calendarDate: "2025-08-18",
	altitudeAcclimation: 850,
	heatAcclimationPercentage: 19,
	previousHeatAcclimationPercentage: 16,
	heatTrend: "ACCLIMATIZING",
	altitudeTrend: "ACCLIMATIZING",
	currentAltitude: 2041,
	acclimationPercentage: 4,
};

/** 2025-08-21: heat up, altitude down from 1150 m. */
const AUG_21_2025: Acclimation = {
	...ZERO,
	calendarDate: "2025-08-21",
	altitudeAcclimation: 1100,
	previousAltitudeAcclimation: 1150,
	heatAcclimationPercentage: 23,
	previousHeatAcclimationPercentage: 18,
	heatTrend: "ACCLIMATIZING",
	altitudeTrend: "DEACCLIMATIZING",
	currentAltitude: 654,
	previousAltitude: 609,
	previousAcclimationPercentage: 33,
};

/** The spec's example row. */
const OCT_11_ROW: HeatAcclimationRow = { date: "2026-10-11", pct: 97, prev: 79, trend: "ACCLIMATIZING", altitude: 0, altitudePrev: 0, altitudeNow: 0 };
const OCT_10_ROW: HeatAcclimationRow = { date: "2026-10-10", pct: 79, prev: 68, trend: "ACCLIMATIZING", altitude: 0, altitudePrev: 0, altitudeNow: 0 };
const OCT_12_INDEX_ROW: HeatAcclimationRow = { ...OCT_12_ROW, altitude: 0, altitudePrev: 0, altitudeNow: 0 };

/** `trainingstatus/aggregated/{date}` as the day sync fetches it, the day's heat under `mostRecentVO2Max`. */
const aggregated = (heat: Acclimation | null): TrainingStatus => ({
	mostRecentVO2Max: heat ? { generic: { calendarDate: "2026-10-03", vo2MaxPreciseValue: 54.7, vo2MaxValue: 55, fitnessAge: null }, cycling: null, heatAltitudeAcclimation: heat } : null,
	mostRecentTrainingLoadBalance: null,
	mostRecentTrainingStatus: null,
	heatAltitudeAcclimationDTO: null,
});
/** Today before the watch syncs (`aggregated-2026-10-12.json`, 05:27): every part null, while the daily route has the decay row. */
const NOTHING: TrainingStatus = { mostRecentVO2Max: null, mostRecentTrainingLoadBalance: null, mostRecentTrainingStatus: null, heatAltitudeAcclimationDTO: null };

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => HEAT_ACCLIMATION_INDEX.normalize(r));
const dailyApi = (answer: (start: string, end: string) => unknown, asked: string[] = []) =>
	({ heatAltitudeAcclimationDaily: async (start: string, end: string) => (asked.push(`${start} ${end}`), answer(start, end)) }) as unknown as GarminApi;

/** A fixture row back as the daily route sends it. */
const payloadOf = (row: HeatAcclimationRow): Acclimation => ({
	...ZERO,
	calendarDate: row.date,
	heatAcclimationPercentage: row.pct ?? null,
	previousHeatAcclimationPercentage: row.prev ?? null,
	heatTrend: row.trend ?? null,
});

describe("HEAT_ACCLIMATION_INDEX — the definition", () => {
	it("is the heat-acclimation index of the fitness group: a year a window, the last two days refreshed, rows whole, fed by the day sync's training status", () => {
		assert.deepEqual(
			[HEAT_ACCLIMATION_INDEX.kind, HEAT_ACCLIMATION_INDEX.folder, HEAT_ACCLIMATION_INDEX.title, HEAT_ACCLIMATION_INDEX.group, HEAT_ACCLIMATION_INDEX.version, HEAT_ACCLIMATION_INDEX.listKey],
			["heat-acclimation", "heat-acclimation", "heat acclimation", "fitness", 1, "days"],
		);
		assert.deepEqual(
			[HEAT_ACCLIMATION_INDEX.windowDays, HEAT_ACCLIMATION_INDEX.refreshDays, HEAT_ACCLIMATION_INDEX.emptyWindowsToStop, HEAT_ACCLIMATION_INDEX.keepOld],
			[365, 2, 1, false],
		);
		assert.equal(HEAT_ACCLIMATION_INDEX.maxHistoryDays, undefined);
		// The heat columns the page reads, then the altitude ones a later page will.
		assert.deepEqual(HEAT_ACCLIMATION_INDEX.keys, ["pct", "prev", "trend", "altitude", "altitudePrev", "altitudeTrend", "altitudeNow"]);
		assert.deepEqual([HEAT_ACCLIMATION_INDEX.columns.trend, HEAT_ACCLIMATION_INDEX.columns.altitudeTrend], [{ text: true }, { text: true }]);
		assert.deepEqual(HEAT_ACCLIMATION_INDEX.fromDay?.needs, ["training"]);
		assert.equal(HEAT_ACCLIMATION_INDEX.fromSummary, undefined);
	});

	it("takes a kind and a folder no registered index and no store folder uses", () => {
		for (const def of DAY_INDEXES) {
			if (def === HEAT_ACCLIMATION_INDEX) continue;
			assert.notEqual(def.kind, HEAT_ACCLIMATION_INDEX.kind);
			assert.notEqual(def.folder, HEAT_ACCLIMATION_INDEX.folder);
		}
		assert.equal(RESERVED_INDEX_NAMES.includes(HEAT_ACCLIMATION_INDEX.folder), false);
	});

	it("writes the spec's example row a line and reads it back: no reading dates, no timestamp, no unknown percentages", () => {
		const row = HEAT_ACCLIMATION_INDEX.normalize(rowOfAcclimation(OCT_11))!;
		assert.deepEqual(row, OCT_11_ROW);
		const text = HEAT_ACCLIMATION_INDEX.serializeYear("2026", [row]);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-11","pct":97,"prev":79,"trend":"ACCLIMATIZING","altitude":0,"altitudePrev":0,"altitudeNow":0}\n\t]\n}\n',
		);
		assert.deepEqual(HEAT_ACCLIMATION_INDEX.parseYear(text), [row]);
	});

	it("keeps 0 % as a reading without a trend, and the altitude columns for a later page", () => {
		assert.deepEqual(normalized([rowOfAcclimation(JUL_23), rowOfAcclimation(AUG_18_2025), rowOfAcclimation(AUG_21_2025)]), [
			{ date: "2026-07-23", pct: 0, prev: 0, altitude: 0, altitudePrev: 0, altitudeNow: 0 },
			{ date: "2025-08-18", pct: 19, prev: 16, trend: "ACCLIMATIZING", altitude: 850, altitudePrev: 0, altitudeTrend: "ACCLIMATIZING", altitudeNow: 2041 },
			{ date: "2025-08-21", pct: 23, prev: 18, trend: "ACCLIMATIZING", altitude: 1100, altitudePrev: 1150, altitudeTrend: "DEACCLIMATIZING", altitudeNow: 654 },
		]);
	});

	it("dates a row by its calendarDate, never by Garmin's reading dates, which drift a day either side", () => {
		assert.deepEqual(HEAT_ACCLIMATION_INDEX.normalize(rowOfAcclimation(OCT_09)), { date: "2026-10-09", pct: 68, prev: 100, trend: "DEACCLIMATIZING", altitude: 0, altitudePrev: 0, altitudeNow: 136 });
		assert.deepEqual(HEAT_ACCLIMATION_INDEX.normalize(rowOfAcclimation(OCT_12)), OCT_12_INDEX_ROW);
		assert.equal(acclimationDateOf({ calendarDate: "2026-10-11" }), "2026-10-11");
		assert.equal(acclimationDateOf({ calendarDate: "2026-10-11T00:00:00.0" }), "2026-10-11");
		assert.equal(acclimationDateOf({}), undefined);
		assert.equal(acclimationDateOf(null), undefined);
		// A row without a day is no row.
		assert.equal(HEAT_ACCLIMATION_INDEX.normalize(rowOfAcclimation({ heatAcclimationPercentage: 50 })), null);
	});
});

describe("HEAT_ACCLIMATION_INDEX — a window", () => {
	it("asks the daily route for the window and keeps a row a day: the gap window holds Jan 4 and Jan 10 only", async () => {
		const asked: string[] = [];
		const rows = normalized(await HEAT_ACCLIMATION_INDEX.fetchWindow(dailyApi(() => [JAN_04, JAN_10], asked), "2026-01-04", "2026-01-10"));
		assert.deepEqual(asked, ["2026-01-04 2026-01-10"]);
		assert.deepEqual(rows, [
			{ date: "2026-01-04", pct: 0, prev: 0, altitude: 0, altitudePrev: 0, altitudeNow: 0 },
			{ date: "2026-01-10", pct: 0, prev: 0, altitude: 0, altitudePrev: 0, altitudeNow: 433 },
		]);
	});

	it("reads a window before the history ([]) or a null answer as no rows, and fails a window on anything but a list", async () => {
		assert.deepEqual(await HEAT_ACCLIMATION_INDEX.fetchWindow(dailyApi(() => []), "2024-10-13", "2025-08-01"), []);
		assert.deepEqual(rowsOfDaily(null, "2024-10-13", "2025-08-01"), []);
		// Read as days without data, a changed payload would delete the rows the index holds.
		await assert.rejects(HEAT_ACCLIMATION_INDEX.fetchWindow(dailyApi(() => ({ rows: [OCT_11] })), "2026-10-11", "2026-10-11"), /did not send a list/);
	});

	it("keeps only the window's days, and drops what is not a row", () => {
		const rows = normalized(rowsOfDaily([OCT_10, OCT_11, OCT_12, null, "x", { heatAcclimationPercentage: 3 }], "2026-10-11", "2026-10-12"));
		assert.deepEqual(rows, [OCT_11_ROW, OCT_12_INDEX_ROW]);
	});

	it("walks the whole history in three requests, a year each: 360 rows, 72 from 2025-08-02, then the empty year", async () => {
		const history = [...HEAT_ROWS, OCT_12_ROW];
		assert.equal(history.length, 432);
		const calls: string[] = [];
		const api = dailyApi((start, end) => (calls.push(`${start} ${end}`), history.filter((r) => r.date >= start && r.date <= end).map(payloadOf)));
		const walk = await walkHistory(HEAT_ACCLIMATION_INDEX, (start, end) => HEAT_ACCLIMATION_INDEX.fetchWindow(api, start, end), { until: "2026-10-12" });
		// The Data plan's windows, from the morning of Oct 12 (today's decay row already in).
		assert.deepEqual(calls, ["2025-10-13 2026-10-12", "2024-10-13 2025-10-12", "2023-10-14 2024-10-12"]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete, walk.error], [3, 432, true, undefined]);
		assert.equal(walk.batch.rows.filter((r) => r.date >= "2025-10-13").length, 360);
		assert.equal(walk.batch.rows.filter((r) => r.date <= "2025-10-12").length, 72);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], "2025-08-02");
		assert.deepEqual(walk.covered, { from: "2023-10-14", to: "2026-10-12" });
		// The gap inside the history is days asked about and found empty.
		for (const day of ["2026-01-05", "2026-01-09"]) {
			assert.ok(walk.batch.dates.includes(day));
			assert.equal(walk.batch.rows.some((r) => r.date === day), false);
		}
		// Two year files of about 105 bytes a row, 45 KB; the real altitudes make it 47 KB (110 a row).
		const merged = HEAT_ACCLIMATION_INDEX.merge([], walk.batch);
		const size = ["2025", "2026"].reduce((n, year) => n + HEAT_ACCLIMATION_INDEX.serializeYear(year, merged.filter((r) => r.date.startsWith(year))).length, 0);
		assert.ok(size > 40_000 && size < 50_000, `${size} bytes`);
	});
});

describe("HEAT_ACCLIMATION_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = HEAT_ACCLIMATION_INDEX.fromDay!.read(day, date);
		return row ? HEAT_ACCLIMATION_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the aggregated payload's heat row when it is the day's: Oct 11, Oct 9 and a 0 % day", () => {
		assert.deepEqual(read({ training: aggregated(OCT_11) }, "2026-10-11"), OCT_11_ROW);
		assert.deepEqual(read({ training: aggregated(OCT_09) }, "2026-10-09"), { date: "2026-10-09", pct: 68, prev: 100, trend: "DEACCLIMATIZING", altitude: 0, altitudePrev: 0, altitudeNow: 136 });
		assert.deepEqual(read({ training: aggregated(JUL_23) }, "2026-07-23"), { date: "2026-07-23", pct: 0, prev: 0, altitude: 0, altitudePrev: 0, altitudeNow: 0 });
		assert.deepEqual(rowOfDay({ training: aggregated(OCT_11) }, "2026-10-11"), rowOfAcclimation(OCT_11));
	});

	it("throws, never returns null, for anything but the day's own row", () => {
		const fromDay = HEAT_ACCLIMATION_INDEX.fromDay!;
		// The morning before the watch syncs: every part null.
		assert.throws(() => fromDay.read({ training: NOTHING }, "2026-10-12"), /no row of 2026-10-12/);
		assert.throws(() => fromDay.read({ training: null }, "2026-10-12"), /no row of 2026-10-12/);
		assert.throws(() => fromDay.read({}, "2026-10-12"), /no row of 2026-10-12/);
		// A day without a row carries the newest earlier one (aggregated-2026-01-07-missing.json).
		assert.throws(() => fromDay.read({ training: aggregated(JAN_04) }, "2026-01-07"), /no row of 2026-01-07 .*carries 2026-01-04's/);
		assert.throws(() => fromDay.read({ training: aggregated(OCT_11) }, "2026-10-12"), /carries 2026-10-11's/);
		assert.throws(() => fromDay.read({ training: aggregated({ ...OCT_11, calendarDate: undefined }) }, "2026-10-11"), /no row of 2026-10-11/);
	});

	/** The fitness group (and the training group, for the aggregated status a day): range calls answer nothing. */
	function source(calls: string[], days: Record<string, TrainingStatus | null>): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "trainingStatus") return days[a!] ?? null;
				if (name === "maxMetrics" || name === "hillScores" || name === "runningTolerance") return [];
				if (name === "enduranceScore" || name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<HeatAcclimationRow> {
		constructor(public held: { from?: string; to?: string } | null) {}
		merged: Array<DayIndexBatch<HeatAcclimationRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<HeatAcclimationRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };
	const BOTH: MetricGroup[] = ["fitness", "training"];
	/** The daily route on the morning of Oct 12: rows to today's decay row. */
	const MORNING = [OCT_09, OCT_10, OCT_11, OCT_12];

	async function run(def: typeof HEAT_ACCLIMATION_INDEX, from: string, to: string, days: Record<string, TrainingStatus | null>, held: { from?: string; to?: string } | null, groups = BOTH, daily = MORNING) {
		const windows: string[] = [];
		const sink = new Sink(held);
		await syncRange(source([], days), target, {
			from,
			to,
			groups,
			units: "metric",
			wait: async () => {},
			indexes: [{ def, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), rowsOfDaily(daily, start, end)) }],
		});
		const batch = sink.merged[0] ?? { rows: [], dates: [] };
		const rows = [...batch.rows].sort((a, b) => (a.date < b.date ? -1 : 1));
		return { windows, rows, dates: [...batch.dates].sort() };
	}

	it("is fed by a routine sync at no request of its own once the watch has synced: the run's days cover the two it refreshes", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-10-10", "2026-10-11", { "2026-10-10": aggregated(OCT_10), "2026-10-11": aggregated(OCT_11) }, { from: "2025-08-02", to: "2026-10-09" });
		assert.deepEqual(got.windows, []);
		assert.deepEqual(got.rows, [OCT_10_ROW, OCT_11_ROW]);
		assert.deepEqual(got.dates, ["2026-10-10", "2026-10-11"]);
	});

	it("asks the daily route for today when the morning's payload has no heat: the overnight decay row lands", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-10-11", "2026-10-12", { "2026-10-11": aggregated(OCT_11), "2026-10-12": NOTHING }, { from: "2025-08-02", to: "2026-10-10" });
		// Oct 11 came free; Oct 12 was left to one window of that day.
		assert.deepEqual(got.windows, ["2026-10-12 2026-10-12"]);
		assert.deepEqual(got.rows, [OCT_11_ROW, OCT_12_INDEX_ROW]);
		assert.deepEqual(got.dates, ["2026-10-11", "2026-10-12"]);
	});

	it("would lose that row with a null read: the engine counts null as covered and asks no window", async () => {
		// The same index, its read returning null where the real one throws.
		const nullRead = defineDayIndex<HeatAcclimationRow>({
			kind: "heat-acclimation-null-read",
			title: "heat acclimation",
			folder: "heat-acclimation-null-read",
			version: 1,
			columns: HEAT_ACCLIMATION_INDEX.columns,
			keepOld: false,
			group: "fitness",
			windowDays: 365,
			refreshDays: 2,
			emptyWindowsToStop: 1,
			fetchWindow: HEAT_ACCLIMATION_INDEX.fetchWindow,
			fromDay: {
				needs: ["training"],
				read: (day, date) => {
					try {
						return rowOfDay(day, date);
					} catch {
						return null;
					}
				},
			},
		});
		const got = await run(nullRead, "2026-10-11", "2026-10-12", { "2026-10-11": aggregated(OCT_11), "2026-10-12": NOTHING }, { from: "2025-08-02", to: "2026-10-10" });
		assert.deepEqual(got.windows, []);
		assert.deepEqual(got.rows, [OCT_11_ROW]);
		// Oct 12 counted as a day without data: a row the index held for it would go too.
		assert.deepEqual(got.dates, ["2026-10-11", "2026-10-12"]);
	});

	it("asks one window for both refresh days when the run is today alone and its payload is empty", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-10-12", "2026-10-12", { "2026-10-12": NOTHING }, { from: "2025-08-02", to: "2026-10-11" });
		assert.deepEqual(got.windows, ["2026-10-11 2026-10-12"]);
		assert.deepEqual(got.rows, [OCT_11_ROW, OCT_12_INDEX_ROW]);
	});

	it("never keeps an earlier day's row as the day's: Jan 7 carries Jan 4's, and the window finds none", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-01-07", "2026-01-07", { "2026-01-07": aggregated(JAN_04) }, { from: "2025-08-02", to: "2026-01-06" }, BOTH, [JAN_04, JAN_10]);
		assert.deepEqual(got.windows, ["2026-01-06 2026-01-07"]);
		assert.deepEqual(got.rows, []);
		assert.deepEqual(got.dates, ["2026-01-06", "2026-01-07"]);
	});

	it("with the training group off, the window covers the run's days", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-10-10", "2026-10-11", {}, { from: "2025-08-02", to: "2026-10-09" }, ["fitness"]);
		assert.deepEqual(got.windows, ["2026-10-10 2026-10-11"]);
		assert.deepEqual(got.rows, [OCT_10_ROW, OCT_11_ROW]);
	});

	it("is left alone with the fitness group off", async () => {
		const got = await run(HEAT_ACCLIMATION_INDEX, "2026-10-10", "2026-10-11", { "2026-10-10": aggregated(OCT_10), "2026-10-11": aggregated(OCT_11) }, null, ["training"]);
		assert.deepEqual([got.windows, got.rows, got.dates], [[], [], []]);
	});

	it("makes the same row of a day whichever source brought it", () => {
		for (const row of [...HEAT_ROWS.slice(-3), OCT_12_ROW]) {
			const fromWindow = HEAT_ACCLIMATION_INDEX.normalize(rowOfAcclimation(payloadOf(row)));
			const fromDay = read({ training: aggregated(payloadOf(row)) }, row.date);
			assert.deepEqual(fromDay, fromWindow, row.date);
			assert.equal(fromDay?.date, row.date);
		}
	});
});
