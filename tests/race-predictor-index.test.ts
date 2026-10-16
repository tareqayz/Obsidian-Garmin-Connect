import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, RacePrediction } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import type { Log } from "../src/log";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import type { DayData } from "../src/sync/metrics";
import { RACE_PREDICTIONS_INDEX, raceDateOf, rowOfRace, type RacePredictionRow } from "../src/sync/race-predictor-index";

/*
 * `racepredictions/daily` rows as Garmin sent them at 04:03–04:11 on
 * 2026-10-12 (ref/performance-stats/race-predictor/api-samples/), the user
 * id left out. Every row echoes the asked span as fromCalendarDate /
 * toCalendarDate.
 */

const day = (calendarDate: string, span: [string, string], times: [number, number, number, number] | null): RacePrediction => ({
	fromCalendarDate: span[0],
	toCalendarDate: span[1],
	calendarDate,
	time5K: times ? times[0] : null,
	time10K: times ? times[1] : null,
	timeHalfMarathon: times ? times[2] : null,
	timeMarathon: times ? times[3] : null,
});

/** probe-daily-future-2026-10-10_2026-10-14: the days still to come are null rows. */
const FUTURE_SPAN: [string, string] = ["2026-10-10", "2026-10-14"];
const FUTURE: RacePrediction[] = [
	day("2026-10-10", FUTURE_SPAN, [1277, 2741, 6259, 13802]),
	// The capture day: the phone's 21:15 · 45:32 · 1:43:54 · 3:49:34.
	day("2026-10-11", FUTURE_SPAN, [1275, 2732, 6234, 13774]),
	// Already there at 04:03, before any run that day.
	day("2026-10-12", FUTURE_SPAN, [1275, 2733, 6237, 13778]),
	day("2026-10-13", FUTURE_SPAN, null),
	day("2026-10-14", FUTURE_SPAN, null),
];

/** probe-daily-first-2025-08-01_2025-08-20, Aug 7–10: null up to the history's first day. */
const FIRST_SPAN: [string, string] = ["2025-08-01", "2025-08-20"];
const FIRST: RacePrediction[] = [
	day("2025-08-07", FIRST_SPAN, null),
	day("2025-08-08", FIRST_SPAN, null),
	day("2025-08-09", FIRST_SPAN, [1132, 2477, 5683, 12691]),
	day("2025-08-10", FIRST_SPAN, [1132, 2477, 5683, 12691]),
];

/** The history: a row every day from 2025-08-09 to 2026-10-12, 430 of them. */
const FIRST_DAY = "2025-08-09";
const NEWEST = "2026-10-12";

function daysFrom(from: string, to: string): string[] {
	const out: string[] = [];
	for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
	return out;
}

/**
 * Garmin's daily route as the probes found it: a window over a calendar year
 * is HTTP 400; one holding any prediction sends every day, null-filled; one
 * holding none sends [].
 */
function garminDaily(asked: string[]): (start: string, end: string) => Promise<RacePrediction[]> {
	return async (start, end) => {
		asked.push(`${start} ${end}`);
		if (end > `${Number(start.slice(0, 4)) + 1}${start.slice(4)}`) throw new GarminApiError("HTTP 400", 400, "");
		const days = daysFrom(start, end);
		const has = (d: string) => d >= FIRST_DAY && d <= NEWEST;
		if (!days.some(has)) return [];
		return days.map((d) => day(d, [start, end], has(d) ? [1200, 2600, 5800, 12800] : null));
	};
}

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => RACE_PREDICTIONS_INDEX.normalize(r));

describe("RACE_PREDICTIONS_INDEX — the definition", () => {
	it("is the race-predictions index of the races group: a year a window, the last two days refreshed, fed by the day sync's races", () => {
		const def = RACE_PREDICTIONS_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], ["race-predictions", "race-predictions", "race predictions", "races", 1, "days"]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld], [365, 2, 1, false]);
		assert.equal(def.maxHistoryDays, undefined);
		// Four whole seconds, in this order.
		assert.deepEqual(def.keys, ["time5k", "time10k", "half", "marathon"]);
		assert.deepEqual(def.fromDay?.needs, ["races"]);
		assert.equal(def.fromSummary, undefined);
	});

	it("writes a year file a row a line: the spec's example row", () => {
		const rows = FUTURE.slice(0, 2).map((r) => RACE_PREDICTIONS_INDEX.normalize({ date: raceDateOf(r), ...rowOfRace(r) })!) as RacePredictionRow[];
		const text = RACE_PREDICTIONS_INDEX.serializeYear("2026", rows);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-10","time5k":1277,"time10k":2741,"half":6259,"marathon":13802},\n' +
				'\t\t{"date":"2026-10-11","time5k":1275,"time10k":2732,"half":6234,"marathon":13774}\n\t]\n}\n',
		);
		assert.deepEqual(RACE_PREDICTIONS_INDEX.parseYear(text), rows);
	});
});

describe("RACE_PREDICTIONS_INDEX — a window", () => {
	it("asks the daily route for the window; the null-filled days to come are no rows", async () => {
		const asked: string[] = [];
		const api = { racePredictions: async (start: string, end: string) => (asked.push(`${start} ${end}`), FUTURE) } as unknown as GarminApi;
		const rows = normalized(await RACE_PREDICTIONS_INDEX.fetchWindow(api, "2026-10-10", "2026-10-14"));
		assert.deepEqual(asked, ["2026-10-10 2026-10-14"]);
		assert.deepEqual(rows, [
			{ date: "2026-10-10", time5k: 1277, time10k: 2741, half: 6259, marathon: 13802 },
			{ date: "2026-10-11", time5k: 1275, time10k: 2732, half: 6234, marathon: 13774 },
			{ date: "2026-10-12", time5k: 1275, time10k: 2733, half: 6237, marathon: 13778 },
			null,
			null,
		]);
	});

	it("starts at the history's first day: the days before it in the window are no rows", async () => {
		const api = { racePredictions: async () => FIRST } as unknown as GarminApi;
		const rows = normalized(await RACE_PREDICTIONS_INDEX.fetchWindow(api, "2025-08-01", "2025-08-20"));
		assert.deepEqual(rows.map((r) => r?.date ?? null), [null, null, "2025-08-09", "2025-08-10"]);
		assert.deepEqual(rows[2], { date: "2025-08-09", time5k: 1132, time10k: 2477, half: 5683, marathon: 12691 });
	});

	it("finds nothing in a window without a prediction, which Garmin sends as []", async () => {
		// probe-daily-before-2025-07-01_2025-07-31 and probe-daily-future-only-2026-10-13_2026-10-20.
		const api = { racePredictions: async () => [] } as unknown as GarminApi;
		assert.deepEqual(await RACE_PREDICTIONS_INDEX.fetchWindow(api, "2025-07-01", "2025-07-31"), []);
	});

	it("dates a row by its calendar day, and drops what Garmin sends as null", () => {
		assert.equal(raceDateOf({ calendarDate: "2026-10-11" }), "2026-10-11");
		assert.equal(raceDateOf({ calendarDate: "2026-10-11T00:00:00.0" }), "2026-10-11");
		assert.equal(raceDateOf({}), undefined);
		assert.equal(raceDateOf(null), undefined);
		assert.deepEqual(RACE_PREDICTIONS_INDEX.normalize({ date: "2026-01-01", ...rowOfRace({ time5K: 1110, time10K: null, timeHalfMarathon: 5337 }) }), {
			date: "2026-01-01",
			time5k: 1110,
			half: 5337,
		});
		assert.equal(RACE_PREDICTIONS_INDEX.normalize({ date: "2026-01-01", ...rowOfRace(null) }), null);
	});

	it("walks the history in two requests once the newest year is in, and three from today, every window inside the year cap", async () => {
		assert.equal(daysFrom(FIRST_DAY, NEWEST).length, 430);
		const calls: string[] = [];
		const api = { racePredictions: garminDaily(calls) } as unknown as GarminApi;
		const fetch = (start: string, end: string) => RACE_PREDICTIONS_INDEX.fetchWindow(api, start, end);

		const walk = await walkHistory(RACE_PREDICTIONS_INDEX, fetch, { until: "2025-10-12" });
		// The spec's walk: 365 days back from Oct 12, 2025 hold 65 predictions, then an empty year ([]) ends it.
		assert.deepEqual(calls, ["2024-10-13 2025-10-12", "2023-10-14 2024-10-12"]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete, walk.error], [2, 65, true, undefined]);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], FIRST_DAY);
		// The null-filled days were asked about: covered, with no row.
		assert.ok(walk.batch.dates.includes("2025-08-08"));

		calls.length = 0;
		const whole = await walkHistory(RACE_PREDICTIONS_INDEX, fetch, { until: "2026-10-11" });
		assert.deepEqual(calls, ["2025-10-12 2026-10-11", "2024-10-12 2025-10-11", "2023-10-13 2024-10-11"]);
		assert.deepEqual([whole.requests, whole.batch.rows.length, whole.complete, whole.error], [3, 429, true, undefined]);
		assert.deepEqual(whole.covered, { from: "2023-10-13", to: "2026-10-11" });
		// The route refuses 367 days (2025-10-11..2026-10-12 was HTTP 400): no window came near it.
		await assert.rejects(garminDaily([])("2025-10-11", "2026-10-12"), GarminApiError);
	});
});

describe("RACE_PREDICTIONS_INDEX — the day sync", () => {
	const read = (data: DayData, date: string) => {
		const row = RACE_PREDICTIONS_INDEX.fromDay!.read(data, date);
		return row ? RACE_PREDICTIONS_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's races row", () => {
		assert.deepEqual(read({ races: FUTURE[1]! }, "2026-10-11"), { date: "2026-10-11", time5k: 1275, time10k: 2732, half: 6234, marathon: 13774 });
	});

	it("finds no row on a null-filled day, or one the range call sent nothing for", () => {
		assert.equal(read({ races: FUTURE[3]! }, "2026-10-13"), null);
		assert.equal(read({ races: null }, "2026-10-13"), null);
		assert.equal(read({}, "2026-10-13"), null);
	});

	/** The races group alone: one range call for the run, nothing a day. */
	function racesSource(calls: string[], daily = garminDaily(calls)): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				if (name === "racePredictions") return daily(a!, b!);
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<RacePredictionRow> {
		constructor(public held: { from?: string; to?: string } | null) {}
		merged: Array<DayIndexBatch<RacePredictionRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<RacePredictionRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	it("is fed by a routine sync at no request of its own: the run's days cover the two it refreshes", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-09" });
		const report = await syncRange(racesSource(calls), target, {
			from: "2026-10-10",
			to: "2026-10-12",
			groups: ["races"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RACE_PREDICTIONS_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		assert.deepEqual(calls, ["2026-10-10 2026-10-12"]);
		assert.equal(report.requests, 1);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows.map((r) => r.date), ["2026-10-12", "2026-10-11", "2026-10-10"]);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-10", "2026-10-11", "2026-10-12"]);
	});

	it("covers today with no row before the watch syncs, and asks one window for yesterday", async () => {
		const calls: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-12" });
		const api = { racePredictions: garminDaily([]) } as unknown as GarminApi;
		const report = await syncRange(racesSource(calls), target, {
			from: "2026-10-13",
			to: "2026-10-13",
			groups: ["races"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RACE_PREDICTIONS_INDEX, sink, fetchWindow: (start, end) => (calls.push(`window ${start} ${end}`), RACE_PREDICTIONS_INDEX.fetchWindow(api, start, end)) }],
		});
		// Oct 13 alone holds no prediction yet: Garmin sends [].
		assert.deepEqual(calls, ["2026-10-13 2026-10-13", "window 2026-10-12 2026-10-12"]);
		assert.equal(report.requests, 2);
		assert.deepEqual(sink.merged[0]!.rows.map((r) => r.date), ["2026-10-12"]);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-12", "2026-10-13"]);
		// An account without predictions isn't a problem: no warning.
		assert.ok(!report.warnings.some((w) => w.startsWith("race predictions")));
	});

	it("counts only the days with a prediction: a window reaching the history's start null-fills the days before it", async () => {
		const details: Array<[string, unknown]> = [];
		const log: Log = { step() {}, detail: (key, value) => void details.push([key, value]), ok() {}, warn() {}, fail() {} };
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-12" });
		const report = await syncRange(racesSource([]), target, {
			from: "2025-08-05",
			to: "2025-08-10",
			groups: ["races"],
			units: "metric",
			wait: async () => {},
			log,
			indexes: [{ def: RACE_PREDICTIONS_INDEX, sink, fetchWindow: async () => [] }],
		});
		assert.deepEqual(details.filter(([key]) => key === "race prediction days"), [["race prediction days", 2]]);
		assert.equal(report.warnings.length, 0);
		// Six days covered, two rows: the null-filled four lose any row the index held.
		assert.deepEqual(sink.merged[0]!.rows.map((r) => r.date).sort(), ["2025-08-09", "2025-08-10"]);
		assert.equal(sink.merged[0]!.dates.length, 6);
	});

	it("notes a range whose rows are all null as one without predictions", async () => {
		const nulls = async (start: string, end: string) => daysFrom(start, end).map((d) => day(d, [start, end], null));
		const report = await syncRange(racesSource([], nulls), target, {
			from: "2026-10-13",
			to: "2026-10-14",
			groups: ["races"],
			units: "metric",
			wait: async () => {},
		});
		assert.deepEqual(report.warnings, []);
	});
});
