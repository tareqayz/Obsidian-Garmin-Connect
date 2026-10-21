import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { DailySummary } from "../src/garmin/endpoints";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";
import { defineDayIndex, extendSpan, rowsByYear, type DayIndexBatch, type DayIndexDef, type DayIndexSpec } from "../src/sync/day-index";
import { feedIndex, syncRange, walkHistory, type DayIndexRuntime, type DayTarget, type SyncSource } from "../src/sync/engine";

interface StressRow {
	date: string;
	avg?: number;
	max?: number;
}

const SPEC: DayIndexSpec<StressRow> = {
	kind: "stress",
	title: "stress",
	folder: "stress",
	version: 1,
	columns: { avg: {}, max: {} },
	keepOld: false,
	group: "stress",
	windowDays: 7,
	emptyWindowsToStop: 2,
	fetchWindow: async () => [],
};

const day = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A window fetch over the days `from..to`, recording what it was asked for. */
function windows(from: string, to: string, opts: { failAt?: { call: number; err: unknown }; empty?: Set<string> } = {}) {
	const calls: string[] = [];
	return {
		calls,
		fetch: async (start: string, end: string) => {
			calls.push(`${start} ${end}`);
			if (opts.failAt && calls.length === opts.failAt.call) throw opts.failAt.err;
			const rows: Array<Record<string, unknown>> = [];
			for (let d = start; d <= end; d = day(d, 1)) {
				if (d < from || d > to) continue;
				// A day Garmin lists without a reading is not a row.
				rows.push(opts.empty?.has(d) ? { date: d, avg: -1 } : { date: d, avg: 30, max: 80 });
			}
			return rows;
		},
	};
}

describe("walkHistory", () => {
	const def = defineDayIndex(SPEC);

	it("walks back a window at a time until windows come back empty", async () => {
		const source = windows("2026-09-20", "2026-10-04");
		const reached: string[] = [];
		const got = await walkHistory(def, source.fetch, { until: "2026-10-04", onWindow: (d) => reached.push(d) });
		assert.deepEqual(source.calls, [
			"2026-09-28 2026-10-04",
			"2026-09-21 2026-09-27",
			"2026-09-14 2026-09-20",
			"2026-09-07 2026-09-13",
			"2026-08-31 2026-09-06",
		]);
		assert.deepEqual(reached, ["2026-09-28", "2026-09-21", "2026-09-14", "2026-09-07", "2026-08-31"]);
		assert.equal(got.complete, true);
		assert.equal(got.requests, 5);
		assert.equal(got.batch.rows.length, 15);
		assert.equal(got.batch.dates.length, 35);
		assert.deepEqual(got.covered, { from: "2026-08-31", to: "2026-10-04" });
	});

	it("books each window as the definition's requests: two a window for one that asks two routes", async () => {
		const source = windows("2026-09-20", "2026-10-04");
		const twice = defineDayIndex({ ...SPEC, requestsPerWindow: 2 });
		const got = await walkHistory(twice, source.fetch, { until: "2026-10-04" });
		assert.equal(source.calls.length, 5);
		assert.equal(got.requests, 10);
	});

	it("does not count a window of sentinels as a window with data", async () => {
		const empty = new Set(["2026-09-28", "2026-09-29"]);
		const source = windows("2026-09-28", "2026-09-29", { empty });
		const got = await walkHistory(def, source.fetch, { until: "2026-10-04" });
		assert.equal(got.requests, 2);
		assert.equal(got.batch.rows.length, 0);
		assert.equal(got.complete, true);
	});

	it("walked in segments, asks, keeps and finishes as one walk, the empty streak carried across", async () => {
		const one = windows("2026-09-20", "2026-10-04");
		const whole = await walkHistory(def, one.fetch, { until: "2026-10-04" });

		const segmented = windows("2026-09-20", "2026-10-04");
		const rows: unknown[] = [];
		let until = "2026-10-04";
		let emptyStreak = 0;
		let complete = false;
		let from: string | undefined;
		for (let n = 0; n < 10 && !complete; n++) {
			const got = await walkHistory(def, segmented.fetch, { until, emptyStreak, maxWindows: 2 });
			rows.push(...got.batch.rows);
			({ complete, emptyStreak } = got);
			from = got.covered!.from;
			until = day(from, -1);
		}
		// The boundary falls between the two empty windows that end the walk: without the streak a third would be asked.
		assert.deepEqual(segmented.calls, one.calls);
		assert.deepEqual(rows, whole.batch.rows);
		assert.equal(from, whole.covered!.from);
		assert.equal(complete, whole.complete);
	});

	it("says how many empty windows it ended on", async () => {
		const source = windows("2026-09-28", "2026-10-04");
		assert.equal((await walkHistory(def, source.fetch, { until: "2026-10-04", maxWindows: 2 })).emptyStreak, 1);
		assert.equal((await walkHistory(def, source.fetch, { until: "2026-10-04", maxWindows: 1 })).emptyStreak, 0);
	});

	it("keeps walking through empty windows newer than the oldest activity", async () => {
		const source = windows("2026-09-28", "2026-10-04");
		const got = await walkHistory(def, source.fetch, { until: "2026-10-04", notBefore: "2026-09-01" });
		assert.equal(got.complete, true);
		assert.equal(got.covered?.from, "2026-08-31");
		assert.equal(source.calls.length, 5);
	});

	it("stops where Garmin stops keeping the stat, counted from today", async () => {
		const capped = defineDayIndex({ ...SPEC, maxHistoryDays: 10 });
		const source = windows("2026-01-01", "2026-10-04");
		const got = await walkHistory(capped, source.fetch, { until: "2026-10-04", today: "2026-10-04" });
		// Ten days back from today is Sep 25: the second window is cut there.
		assert.deepEqual(source.calls, ["2026-09-28 2026-10-04", "2026-09-25 2026-09-27"]);
		assert.equal(got.complete, true);
		assert.deepEqual(got.covered, { from: "2026-09-25", to: "2026-10-04" });

		const resumed = windows("2026-01-01", "2026-10-04");
		const again = await walkHistory(capped, resumed.fetch, { until: "2026-09-24", today: "2026-10-04" });
		assert.deepEqual(resumed.calls, []);
		assert.equal(again.complete, true);
		assert.equal(again.requests, 0);
	});

	it("stops on a 429, keeping the windows before it", async () => {
		const source = windows("2026-01-01", "2026-10-04", { failAt: { call: 2, err: new GarminRateLimitError("rate limited") } });
		const got = await walkHistory(def, source.fetch, { until: "2026-10-04" });
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.equal(got.complete, false);
		assert.equal(got.requests, 2);
		assert.equal(got.batch.rows.length, 7);
		assert.deepEqual(got.covered, { from: "2026-09-28", to: "2026-10-04" });
	});

	it("reports any other failure without calling it fatal", async () => {
		const source = windows("2026-01-01", "2026-10-04", { failAt: { call: 1, err: new GarminApiError("bad gateway", 502, "") } });
		const got = await walkHistory(def, source.fetch, { until: "2026-10-04" });
		assert.equal(got.fatal, undefined);
		assert.match(got.error ?? "", /2026-09-28\.\.2026-10-04: bad gateway/);
		assert.equal(got.covered, null);
	});

	it("can be stopped between windows, pausing between them", async () => {
		const source = windows("2026-01-01", "2026-10-04");
		const pauses: number[] = [];
		let n = 0;
		const got = await walkHistory(def, source.fetch, {
			until: "2026-10-04",
			pause: 250,
			wait: async (ms) => void pauses.push(ms),
			shouldStop: () => ++n > 3,
		});
		assert.equal(got.requests, 3);
		assert.deepEqual(pauses, [250, 250, 250]);
		assert.equal(got.complete, false);
	});
});

/** A sink that remembers what it was given. */
class FakeSink {
	held: { from?: string; to?: string } | null = null;
	merged: Array<{ batch: DayIndexBatch<StressRow>; covered: { from: string; to: string } | null }> = [];
	fail: unknown = null;
	coverageFails = false;
	async coverage() {
		if (this.coverageFails) throw new Error("unreadable");
		return this.held;
	}
	async merge(batch: DayIndexBatch<StressRow>, covered: { from: string; to: string } | null) {
		if (this.fail) throw this.fail;
		this.merged.push({ batch, covered });
		return 2;
	}
}

/**
 * A sink that keeps each file's text, as the vault store does, and counts the
 * files whose text changed: what a merge would really write.
 */
class TextSink {
	rows: StressRow[] = [];
	files = new Map<string, string>();
	held: { from?: string; to?: string } | null = null;
	constructor(private def: DayIndexDef<StressRow>) {}
	async coverage() {
		return this.held;
	}
	async merge(batch: DayIndexBatch<StressRow>, covered: { from: string; to: string } | null) {
		this.rows = this.def.merge(this.rows, batch);
		if (covered) this.held = extendSpan(this.held, covered.from, covered.to);
		const texts = new Map<string, string>();
		for (const [year, list] of rowsByYear(this.rows)) texts.set(`${year}.json`, this.def.serializeYear(year, list));
		texts.set("index.json", this.def.serializeMeta({ version: this.def.version, complete: false, ...this.held }));
		let written = 0;
		for (const [name, text] of texts) {
			if (this.files.get(name) === text) continue;
			this.files.set(name, text);
			written += 1;
		}
		return written;
	}
}

function runtime(spec: Partial<DayIndexSpec<StressRow>>, fetch: (start: string, end: string) => Promise<ReadonlyArray<Record<string, unknown>>>) {
	const sink = new FakeSink();
	const def = defineDayIndex({ ...SPEC, ...spec });
	const rt: DayIndexRuntime<StressRow> = { def, sink, fetchWindow: fetch };
	return { rt, sink };
}

describe("feedIndex", () => {
	const summaries = (dates: string[]) => ({
		rows: dates.map((date) => ({ date, avg: 25 })),
		dates,
	});

	it("costs nothing when the summaries covered the run and the index is current", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-09" };
		const got = await feedIndex(rt, summaries(["2026-09-10", "2026-09-11", "2026-09-12"]), "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, []);
		assert.equal(got.requests, 0);
		assert.equal(got.written, 2);
		assert.deepEqual(sink.merged[0]!.batch.rows.map((r) => r.date), ["2026-09-10", "2026-09-11", "2026-09-12"]);
		assert.deepEqual(sink.merged[0]!.covered, { from: "2026-09-10", to: "2026-09-12" });
	});

	it("with windowToo, asks the window for the run's own days too, and keeps both rows' columns", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ keepOld: true, windowToo: true }, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-09" };
		// The summary has the average (25); the window has the average (30) and the maximum (80).
		const got = await feedIndex(rt, summaries(["2026-09-10", "2026-09-11"]), "2026-09-10", "2026-09-11", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-10 2026-09-11"]);
		assert.equal(got.requests, 1);
		// One row a day, the summary's average kept and the window's maximum added.
		const batch = sink.merged[0]!.batch;
		assert.deepEqual(
			[...batch.rows].sort((a, b) => (a.date < b.date ? -1 : 1)),
			[{ date: "2026-09-10", avg: 25, max: 80 }, { date: "2026-09-11", avg: 25, max: 80 }],
		);
	});

	it("asks one window for a run's days when the index reads no summaries", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-10 2026-09-12"]);
		assert.equal(got.requests, 1);
		assert.equal(sink.merged[0]!.batch.rows.length, 3);
		assert.deepEqual([...sink.merged[0]!.batch.dates].sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
	});

	it("books a window as the definition's requests", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt } = runtime({ requestsPerWindow: 2 }, source.fetch);
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-10 2026-09-12"]);
		assert.equal(got.requests, 2);
	});

	it("fills the stretch since the index's newest day, a window at a time", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ windowDays: 28 }, source.fetch);
		sink.held = { from: "2026-07-01", to: "2026-08-01" };
		await feedIndex(rt, summaries(["2026-09-10", "2026-09-11", "2026-09-12"]), "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-08-02 2026-08-29", "2026-08-30 2026-09-09"]);
		assert.deepEqual(sink.merged[0]!.covered, { from: "2026-08-02", to: "2026-09-12" });
	});

	it("asks only for the days the summaries missed, a request per stretch", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt } = runtime({}, source.fetch);
		await feedIndex(rt, summaries(["2026-09-10", "2026-09-12", "2026-09-14"]), "2026-09-10", "2026-09-15", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-11 2026-09-11", "2026-09-13 2026-09-13", "2026-09-15 2026-09-15"]);
	});

	it("keeps what it got, without claiming coverage, when a window fails", async () => {
		const source = windows("2026-01-01", "2026-12-31", { failAt: { call: 1, err: new GarminApiError("bad gateway", 502, "") } });
		const { rt, sink } = runtime({ windowDays: 2 }, source.fetch);
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.equal(got.fatal, undefined);
		assert.equal(got.requests, 2);
		assert.match(got.warnings[0] ?? "", /2026-09-10\.\.2026-09-11: bad gateway/);
		assert.deepEqual(sink.merged[0]!.batch.dates, ["2026-09-12"]);
		assert.equal(sink.merged[0]!.covered, null);
	});

	it("stops on a 429 and still keeps what came before it", async () => {
		const source = windows("2026-01-01", "2026-12-31", { failAt: { call: 2, err: new GarminRateLimitError("rate limited") } });
		const { rt, sink } = runtime({ windowDays: 2 }, source.fetch);
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-08", "2026-09-13", { fetchMissing: true });
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.equal(source.calls.length, 2);
		assert.deepEqual([...sink.merged[0]!.batch.dates].sort(), ["2026-09-08", "2026-09-09"]);
		assert.equal(sink.merged[0]!.covered, null);
	});

	it("fetches nothing when told not to, and still keeps the summaries' rows", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		const got = await feedIndex(rt, summaries(["2026-09-12"]), "2026-09-10", "2026-09-12", { fetchMissing: false });
		assert.deepEqual(source.calls, []);
		assert.equal(got.requests, 0);
		assert.deepEqual(sink.merged[0]!.batch.dates, ["2026-09-12"]);
		assert.equal(sink.merged[0]!.covered, null);
	});

	it("carries on from the run's start when the index cannot say where it ends, and says so", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		sink.coverageFails = true;
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-10 2026-09-12"]);
		assert.deepEqual(got.warnings, ["unreadable"]);
	});

	it("asks the last refreshDays days again on every sync, held or not", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ refreshDays: 5 }, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-12" };
		await feedIndex(rt, summaries(["2026-09-12"]), "2026-09-12", "2026-09-12", { fetchMissing: true });
		assert.deepEqual(source.calls, ["2026-09-08 2026-09-11"]);
		assert.deepEqual(sink.merged[0]!.covered, { from: "2026-09-08", to: "2026-09-12" });
		// Without it, the same sync asks nothing.
		const plain = runtime({}, windows("2026-01-01", "2026-12-31").fetch);
		plain.sink.held = { from: "2026-01-01", to: "2026-09-12" };
		assert.equal((await feedIndex(plain.rt, summaries(["2026-09-12"]), "2026-09-12", "2026-09-12", { fetchMissing: true })).requests, 0);
	});

	it("writes nothing when the days it asked again come back the same, and the one Garmin rescored when one moved", async () => {
		const def = defineDayIndex({ ...SPEC, refreshDays: 5 });
		const sink = new TextSink(def);
		const held = (await windows("2026-09-01", "2026-09-12").fetch("2026-09-01", "2026-09-12")) as unknown as StressRow[];
		await sink.merge({ rows: held, dates: held.map((r) => r.date) }, { from: "2026-09-01", to: "2026-09-12" });
		const same = await feedIndex({ def, sink, fetchWindow: windows("2026-09-01", "2026-09-12").fetch }, { rows: [], dates: [] }, "2026-09-12", "2026-09-12", { fetchMissing: true });
		assert.equal(same.requests, 1);
		assert.equal(same.written, 0);
		const rescored = async (start: string, end: string) =>
			(await windows("2026-09-01", "2026-09-12").fetch(start, end)).map((r) => (r.date === "2026-09-09" ? { ...r, avg: 31 } : r));
		const moved = await feedIndex({ def, sink, fetchWindow: rescored }, { rows: [], dates: [] }, "2026-09-12", "2026-09-12", { fetchMissing: true });
		assert.equal(moved.written, 1);
		assert.equal(sink.rows.find((r) => r.date === "2026-09-09")?.avg, 31);
	});

	it("reports a sink that cannot write without failing", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		sink.fail = new Error("disk full");
		const got = await feedIndex(rt, { rows: [], dates: [] }, "2026-09-10", "2026-09-12", { fetchMissing: true });
		assert.equal(got.written, 0);
		assert.deepEqual(got.warnings, ["disk full"]);
	});
});

/* ------------------------------------------------------------------ */
/*  Through syncRange                                                  */
/* ------------------------------------------------------------------ */

/** Only the daily summary answers; nothing else is asked for with the stress group alone. */
function summarySource(calls: string[], fail?: unknown): SyncSource {
	return new Proxy({} as SyncSource, {
		get: (_, name: string) => async (date?: string) => {
			calls.push(`${name}:${date ?? ""}`);
			if (name !== "dailySummary") throw new Error(`unexpected ${name}`);
			if (fail) throw fail;
			return { calendarDate: date, averageStressLevel: 31, maxStressLevel: 88 } satisfies DailySummary;
		},
	});
}

class EveryDay implements DayTarget {
	exists(): boolean {
		return true;
	}
	async write(): Promise<"written"> {
		return "written";
	}
}

const fromSummary = (s: DailySummary) => ({ avg: s.averageStressLevel, max: s.maxStressLevel });

describe("syncRange — registered day indexes", () => {
	const base = { from: "2026-09-10", to: "2026-09-12", units: "metric" as const, wait: async () => {} };

	it("feeds an index from the summaries the run fetched anyway", async () => {
		const calls: string[] = [];
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ fromSummary }, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-09" };
		const report = await syncRange(summarySource(calls), new EveryDay(), { ...base, groups: ["stress"], indexes: [rt] });
		assert.deepEqual(source.calls, []);
		assert.equal(report.requests, 3);
		assert.deepEqual(report.indexFilesWritten, { stress: 2 });
		assert.deepEqual(
			sink.merged[0]!.batch.rows.map((r) => [r.date, r.avg, r.max]),
			[
				["2026-09-12", 31, 88],
				["2026-09-11", 31, 88],
				["2026-09-10", 31, 88],
			],
		);
	});

	it("leaves an index alone while its group is off", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({}, source.fetch);
		const report = await syncRange(summarySource([]), new EveryDay(), { ...base, groups: ["heart"], indexes: [rt] });
		assert.deepEqual(source.calls, []);
		assert.deepEqual(sink.merged, []);
		assert.deepEqual(report.indexFilesWritten, {});
	});

	it("feeds an index even when no day in the range can be written", async () => {
		const calls: string[] = [];
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ fromSummary }, source.fetch);
		const nowhere: DayTarget = { exists: () => false, write: async () => "missing" };
		const report = await syncRange(summarySource(calls), nowhere, { ...base, groups: ["stress"], indexes: [rt] });
		assert.deepEqual(calls, []);
		assert.deepEqual(source.calls, ["2026-09-10 2026-09-12"]);
		assert.equal(report.requests, 1);
		assert.equal(sink.merged[0]!.batch.rows.length, 3);
	});

	it("counts an index's window in the report as the requests it costs, other indexes' as one", async () => {
		const nowhere: DayTarget = { exists: () => false, write: async () => "missing" };
		const one = runtime({ fromSummary }, windows("2026-01-01", "2026-12-31").fetch);
		const two = runtime({ kind: "two-routes", folder: "two-routes", fromSummary, requestsPerWindow: 2 }, windows("2026-01-01", "2026-12-31").fetch);
		const report = await syncRange(summarySource([]), nowhere, { ...base, groups: ["stress"], indexes: [one.rt, two.rt] });
		assert.equal(report.requests, 3);
	});

	it("stops the run on a 429 from an index's window", async () => {
		const source = windows("2026-01-01", "2026-12-31", { failAt: { call: 1, err: new GarminRateLimitError("rate limited", 60) } });
		const { rt } = runtime({}, source.fetch);
		const report = await syncRange(summarySource([]), new EveryDay(), { ...base, groups: ["stress"], indexes: [rt] });
		assert.match(report.stoppedEarly ?? "", /rate limited/);
	});

	it("keeps the summaries' rows, and fetches nothing more, when a 429 ends the days", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ fromSummary }, source.fetch);
		const report = await syncRange(summarySource([], new GarminRateLimitError("rate limited", 60)), new EveryDay(), {
			...base,
			groups: ["stress"],
			indexes: [rt],
		});
		assert.match(report.stoppedEarly ?? "", /rate limited/);
		assert.deepEqual(source.calls, []);
		// The summary that failed gave nothing, so there was nothing to merge.
		assert.deepEqual(sink.merged, []);
	});

	it("changes nothing for a run without indexes", async () => {
		const report = await syncRange(summarySource([]), new EveryDay(), { ...base, groups: ["stress"] });
		assert.deepEqual(report.indexFilesWritten, {});
		assert.equal(report.requests, 3);
	});
});

/* ------------------------------------------------------------------ */
/*  fromDay: rows from the day payloads a sync fetched anyway          */
/* ------------------------------------------------------------------ */

/** The training group alone: training status per day, running tolerance for the range. */
function trainingSource(calls: string[], failOn?: string): SyncSource {
	return new Proxy({} as SyncSource, {
		get: (_, name: string) => async (a?: string, b?: string) => {
			calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
			if (name === "runningTolerance") return [];
			if (name !== "trainingStatus") throw new Error(`unexpected ${name}`);
			if (a === failOn) throw new GarminApiError("server error", 500, "");
			return { load: a === "2026-09-11" ? 410 : 400 };
		},
	});
}

const fromTraining = {
	needs: ["training"] as const,
	read: (day: { training?: unknown }) => ({ avg: (day.training as { load?: number } | null)?.load }),
};

describe("syncRange — fromDay", () => {
	const base = { from: "2026-09-10", to: "2026-09-12", units: "metric" as const, wait: async () => {} };

	it("feeds an index from the day payloads the run fetched anyway, at no request", async () => {
		const calls: string[] = [];
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ group: "training", fromDay: fromTraining }, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-09" };
		const report = await syncRange(trainingSource(calls), new EveryDay(), { ...base, groups: ["training"], indexes: [rt] });
		assert.deepEqual(source.calls, []);
		assert.equal(report.requests, 4);
		assert.deepEqual(
			sink.merged[0]!.batch.rows.map((r) => [r.date, r.avg]),
			[
				["2026-09-12", 400],
				["2026-09-11", 410],
				["2026-09-10", 400],
			],
		);
	});

	it("leaves a day whose part failed to the window fetch, so a held row is not lost", async () => {
		const source = windows("2026-01-01", "2026-12-31");
		const { rt, sink } = runtime({ group: "training", fromDay: fromTraining }, source.fetch);
		sink.held = { from: "2026-01-01", to: "2026-09-09" };
		await syncRange(trainingSource([], "2026-09-11"), new EveryDay(), { ...base, groups: ["training"], indexes: [rt] });
		assert.deepEqual(source.calls, ["2026-09-11 2026-09-11"]);
		const batch = sink.merged[0]!.batch;
		assert.deepEqual([...batch.dates].sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
		assert.equal(batch.rows.find((r) => r.date === "2026-09-11")?.avg, 30);
	});

	it("refuses a definition fed both ways, or by nothing", () => {
		assert.throws(() => defineDayIndex({ ...SPEC, fromSummary, fromDay: fromTraining }), /cannot both feed/);
		assert.throws(() => defineDayIndex({ ...SPEC, fromDay: { needs: [], read: () => null } }), /at least one part/);
	});
});
