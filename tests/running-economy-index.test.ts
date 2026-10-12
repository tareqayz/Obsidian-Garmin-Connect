import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { addMonths, daysBetween } from "../src/dashboard/periods";
import type { GarminApi, RunningEconomyScore } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import { shiftDate, type DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import { RUNNING_ECONOMY_INDEX, economyDateOf, rowsOfEconomy, type RunningEconomyRow } from "../src/sync/running-economy-index";
import { ROWS, dailyPayload } from "./running-economy-fixture";

/*
 * The running economy index against the daily route as Garmin answered it on
 * 2026-10-12 (ref/performance-stats/running-economy/README.md, "Data plan";
 * the readings in running-economy-fixture.ts).
 */

/** The daily route as Garmin answers it (`dailyPayload`), each call logged. */
function economyApi(calls: string[], fail = false): GarminApi {
	return {
		runningEconomyDaily: async (start: string, end: string) => {
			calls.push(`${start} ${end}`);
			if (fail) throw new GarminApiError("HTTP 500", 500, "");
			return dailyPayload(start, end);
		},
	} as unknown as GarminApi;
}

const window = async (start: string, end: string, calls: string[] = []) =>
	(await RUNNING_ECONOMY_INDEX.fetchWindow(economyApi(calls), start, end)).map((r) => RUNNING_ECONOMY_INDEX.normalize(r)!);

/** The spec's example row: Current's reading. */
const SEP_28: RunningEconomyRow = { date: "2026-09-28", score: 224, classification: "INTERMEDIATE" };

describe("RUNNING_ECONOMY_INDEX — the definition", () => {
	it("is the running-economy index of the fitness group: 366 days a window, an empty one ends the walk, 2 days refreshed", () => {
		const def = RUNNING_ECONOMY_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], ["running-economy", "running-economy", "running economy", "fitness", 1, "days"]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld, def.requestsPerWindow], [366, 2, 1, false, 1]);
		assert.equal(def.maxHistoryDays, undefined);
		// The day sync never asks the route: no free feed, so a routine sync asks a window.
		assert.equal(def.fromDay, undefined);
		assert.equal(def.fromSummary, undefined);
		assert.deepEqual(def.keys, ["score", "classification"]);
	});

	it("writes a year file a row a line, Garmin's word kept as sent", () => {
		const text = RUNNING_ECONOMY_INDEX.serializeYear("2026", [SEP_28, { date: "2026-09-27", score: 223, classification: "INTERMEDIATE" }]);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-09-27","score":223,"classification":"INTERMEDIATE"},\n' +
				'\t\t{"date":"2026-09-28","score":224,"classification":"INTERMEDIATE"}\n\t]\n}\n',
		);
		assert.deepEqual(RUNNING_ECONOMY_INDEX.parseYear(text).at(-1), SEP_28);
	});

	it("holds the history in two year files of about 3 KB each: 43 rows in 2025 and 44 in 2026", () => {
		const bytes = ["2025", "2026"].map((year) => RUNNING_ECONOMY_INDEX.serializeYear(year, ROWS.filter((r) => r.date.startsWith(year))).length);
		assert.deepEqual([ROWS.filter((r) => r.date < "2026").length, ROWS.filter((r) => r.date >= "2026").length], [43, 44]);
		// 5987 bytes: about 69 a row with Garmin's word (the spec's "about 4 KB" left the word out).
		assert.equal(bytes[0]! + bytes[1]!, 5987);
	});
});

describe("RUNNING_ECONOMY_INDEX — a window", () => {
	it("asks the daily route for the window, startDate and endDate as given", async () => {
		const calls: string[] = [];
		await window("2025-10-11", "2026-10-11", calls);
		assert.deepEqual(calls, ["2025-10-11 2026-10-11"]);
	});

	it("keeps the days with a reading and drops the null rows: the 4w's 28 rows are 6", async () => {
		const payload = dailyPayload("2026-09-14", "2026-10-11");
		assert.equal(payload.length, 28);
		assert.deepEqual(payload[0], { calendarDate: "2026-09-14", score: null, classification: null });
		const rows = await window("2026-09-14", "2026-10-11");
		assert.deepEqual(
			rows.map((r) => `${r.date.slice(5)} ${r.score}`),
			["09-15 222", "09-16 223", "09-23 224", "09-25 223", "09-27 223", "09-28 224"],
		);
		assert.deepEqual(rows.at(-1), SEP_28);
	});

	it("holds the whole history in two year windows: 65 rows, then 22 from 2025-08-16", async () => {
		const newer = await window("2025-10-11", "2026-10-11");
		const older = await window("2024-10-10", "2025-10-10");
		assert.deepEqual([newer.length, older.length, older[0]!.date], [65, 22, "2025-08-16"]);
		assert.deepEqual([...older, ...newer], ROWS);
		// TRAINED and INTERMEDIATE only, as sent.
		assert.deepEqual([...new Set(ROWS.map((r) => r.classification))].sort(), ["INTERMEDIATE", "TRAINED"]);
	});

	it("finds nothing in a window without a reading: the route sends []", async () => {
		assert.deepEqual(dailyPayload("2026-08-17", "2026-09-13"), []);
		assert.deepEqual(await window("2026-08-17", "2026-09-13"), []);
		assert.deepEqual(await window("2023-10-11", "2024-10-10"), []);
	});

	it("sends nothing it can't keep: a null row, a day without a date, a score that isn't one", () => {
		const rows: Array<RunningEconomyScore | null> = [
			{ calendarDate: "2026-09-28T00:00:00.0", score: 224, classification: "INTERMEDIATE" },
			{ calendarDate: "2026-09-29", score: null, classification: null },
			{ calendarDate: "2026-09-30", score: null, classification: "INTERMEDIATE" },
			{ score: 222, classification: "INTERMEDIATE" },
			{ calendarDate: "2026-10-01", score: "223" as unknown as number, classification: "INTERMEDIATE" },
			{ calendarDate: "2026-10-02", score: 222 },
			null,
		];
		const kept = rowsOfEconomy(rows)
			.map((r) => RUNNING_ECONOMY_INDEX.normalize(r))
			.filter((r) => r !== null);
		assert.deepEqual(kept, [SEP_28, { date: "2026-10-02", score: 222 }]);
		assert.deepEqual(rowsOfEconomy(null), []);
		assert.equal(economyDateOf({ calendarDate: "2026-09-28T00:00:00.0" }), "2026-09-28");
		assert.equal(economyDateOf({ calendarDate: "Sep 28" }), undefined);
	});

	it("fits the one-year cap from any day: 366 calendar days always pass, 367 only across Feb 29", () => {
		// The probes: 366 days → 200; 367 → HTTP 400, except 2023-10-11..2024-10-11 (Feb 29) → 200; 368 → 400.
		assert.equal(dailyPayload("2025-10-11", "2026-10-11").length, 366);
		assert.throws(() => dailyPayload("2025-10-10", "2026-10-11"), GarminApiError);
		assert.deepEqual(dailyPayload("2023-10-11", "2024-10-11"), []);
		assert.throws(() => dailyPayload("2023-10-10", "2024-10-11"), GarminApiError);
		// A window of the index's size from every day of four years, Feb 29, 2024 among them.
		for (let from = "2023-01-01"; from < "2027-01-01"; from = shiftDate(from, 1)) {
			const end = shiftDate(from, RUNNING_ECONOMY_INDEX.windowDays - 1);
			assert.ok(end <= addMonths(from, 12), `${from}..${end}`);
		}
		// One day more would not fit from 2025-10-10.
		assert.equal(daysBetween("2025-10-10", "2026-10-11") + 1, RUNNING_ECONOMY_INDEX.windowDays + 1);
	});

	it("fails the window on an HTTP error, so the window is asked again", async () => {
		await assert.rejects(() => RUNNING_ECONOMY_INDEX.fetchWindow(economyApi([], true), "2025-10-11", "2026-10-11"), GarminApiError);
	});
});

describe("RUNNING_ECONOMY_INDEX — the history walk", () => {
	async function walk(until: string) {
		const calls: string[] = [];
		const api = economyApi(calls);
		const result = await walkHistory(RUNNING_ECONOMY_INDEX, (start, end) => RUNNING_ECONOMY_INDEX.fetchWindow(api, start, end), { until });
		return { calls, result };
	}

	it("walks the whole history in three requests from the spec's day: 65 rows, 22, then an empty year", async () => {
		const { calls, result } = await walk("2026-10-12");
		assert.deepEqual(calls, ["2025-10-12 2026-10-12", "2024-10-11 2025-10-11", "2023-10-11 2024-10-10"]);
		assert.deepEqual([result.complete, result.error, result.requests, result.batch.rows.length], [true, undefined, 3, 87]);
		assert.deepEqual(result.covered, { from: "2023-10-11", to: "2026-10-12" });
		// Every window is 366 calendar days, inside the cap, across Feb 29, 2024 too.
		for (const call of calls) assert.ok(call.slice(11) <= addMonths(call.slice(0, 10), 12), call);
	});

	it("and from the capture day, the same three", async () => {
		const { calls, result } = await walk("2026-10-11");
		assert.deepEqual(calls, ["2025-10-11 2026-10-11", "2024-10-10 2025-10-10", "2023-10-10 2024-10-09"]);
		assert.deepEqual([result.complete, result.requests], [true, 3]);
		assert.deepEqual(
			result.batch.rows.map((r) => r.date).sort(),
			ROWS.map((r) => r.date),
		);
	});
});

describe("RUNNING_ECONOMY_INDEX — a routine sync", () => {
	/** The fitness group's own day sync: max metrics and hill scores for the run, endurance and fitness age a day. */
	function fitnessSource(calls: string[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "maxMetrics" || name === "hillScores") return [];
				if (name === "enduranceScore" || name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<RunningEconomyRow> {
		merged: Array<{ batch: DayIndexBatch<RunningEconomyRow>; covered: { from: string; to: string } | null }> = [];
		constructor(public held: { from?: string; to?: string } | null) {}
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<RunningEconomyRow>, covered: { from: string; to: string } | null) {
			this.merged.push({ batch, covered });
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	async function sync(from: string, to: string, held: { from?: string; to?: string } | null, groups: Array<"fitness" | "sleep"> = ["fitness"]) {
		const source: string[] = [];
		const api: string[] = [];
		const sink = new Sink(held);
		const economy = economyApi(api);
		const report = await syncRange(groups.includes("fitness") ? fitnessSource(source) : new Proxy({} as SyncSource, { get: () => async () => null }), target, {
			from,
			to,
			groups,
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RUNNING_ECONOMY_INDEX, sink, fetchWindow: (start, end) => RUNNING_ECONOMY_INDEX.fetchWindow(economy, start, end) }],
		});
		return { report, sink, api, source };
	}

	it("asks one window for the run's days: one request", async () => {
		const { report, sink, api, source } = await sync("2026-09-22", "2026-09-28", { from: "2025-08-16", to: "2026-09-27" });
		assert.deepEqual(api, ["2026-09-22 2026-09-28"]);
		assert.equal(report.requests - source.length, 1);
		assert.equal(sink.merged.length, 1);
		const { batch, covered } = sink.merged[0]!;
		assert.deepEqual(batch.rows.map((r) => `${r.date.slice(5)} ${r.score}`), ["09-23 224", "09-25 223", "09-27 223", "09-28 224"]);
		// Every day of the window was asked: a day without a reading holds no row.
		assert.equal(batch.dates.length, 7);
		assert.deepEqual(covered, { from: "2026-09-22", to: "2026-09-28" });
	});

	it("asks yesterday again on a one-day sync, held or not: a reading lands when the watch syncs", async () => {
		const { api, sink } = await sync("2026-10-12", "2026-10-12", { from: "2025-08-16", to: "2026-10-12" });
		assert.deepEqual(api, ["2026-10-11 2026-10-12"]);
		// Neither day has a reading: both are covered, without a row.
		assert.deepEqual([sink.merged[0]!.batch.rows, [...sink.merged[0]!.batch.dates].sort()], [[], ["2026-10-11", "2026-10-12"]]);
	});

	it("reaches back to the index's newest day after a vault was left closed, still in one window", async () => {
		const { api } = await sync("2026-10-05", "2026-10-11", { from: "2025-08-16", to: "2026-09-20" });
		assert.deepEqual(api, ["2026-09-21 2026-10-11"]);
	});

	it("asks nothing while the fitness group is off", async () => {
		const { api, sink } = await sync("2026-10-11", "2026-10-11", null, ["sleep"]);
		assert.deepEqual(api, []);
		assert.equal(sink.merged.length, 0);
	});
});
