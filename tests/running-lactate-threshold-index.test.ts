import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { daysBetween } from "../src/dashboard/periods";
import type { BiometricChange, GarminApi } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import { LACTATE_THRESHOLD_INDEX, thresholdRows, type LactateThresholdRow } from "../src/sync/lactate-threshold-index";
import { CHANGES, hrPayload, specRows, speedPayload } from "./running-lactate-threshold-fixture";

/*
 * The lactate threshold index against the routes as Garmin answered them on
 * 2026-10-12 (ref/performance-stats/running-lactate-threshold/README.md,
 * "Data plan"; the rows in running-lactate-threshold-fixture.ts).
 */

const INDEX = LACTATE_THRESHOLD_INDEX;

/**
 * The two routes as Garmin answers them: the fixture's rows for the window,
 * and HTTP 400 past the cap (end − start ≤ 366 days), as the probes found.
 */
function ltApi(calls: string[], fail?: "hr" | "speed"): GarminApi {
	const cap = (start: string, end: string) => {
		if (daysBetween(start, end) > 366) throw new GarminApiError("HTTP 400", 400, "");
	};
	return {
		lactateThresholdHeartRateRange: async (start: string, end: string) => {
			calls.push(`hr ${start} ${end}`);
			cap(start, end);
			if (fail === "hr") throw new GarminApiError("HTTP 500", 500, "");
			return hrPayload(start, end);
		},
		lactateThresholdSpeedRange: async (start: string, end: string) => {
			calls.push(`speed ${start} ${end}`);
			cap(start, end);
			if (fail === "speed") throw new GarminApiError("HTTP 500", 500, "");
			return speedPayload(start, end);
		},
	} as unknown as GarminApi;
}

const window = async (start: string, end: string, calls: string[] = []) =>
	(await INDEX.fetchWindow(ltApi(calls), start, end)).map((r) => INDEX.normalize(r)!);

/** The spec's example row: the newest change, the one Current shows. */
const SEP_19: LactateThresholdRow = { date: "2026-09-19", hr: 182, speed: 3.72221 };

describe("LACTATE_THRESHOLD_INDEX — the definition", () => {
	it("is the lactate-threshold index of the fitness group: 367 days a window, two empty windows end the walk, nothing refreshed", () => {
		assert.deepEqual(
			[INDEX.kind, INDEX.folder, INDEX.title, INDEX.group, INDEX.version, INDEX.listKey],
			["lactate-threshold", "lactate-threshold", "lactate threshold", "fitness", 1, "days"],
		);
		assert.deepEqual([INDEX.windowDays, INDEX.refreshDays, INDEX.emptyWindowsToStop, INDEX.keepOld], [367, 0, 2, false]);
		// Each window asks two routes, and is booked as two requests.
		assert.equal(INDEX.requestsPerWindow, 2);
		assert.equal(INDEX.maxHistoryDays, undefined);
		// The day sync never asks these routes: no free feed.
		assert.equal(INDEX.fromDay, undefined);
		assert.equal(INDEX.fromSummary, undefined);
		assert.deepEqual(INDEX.keys, ["hr", "speed"]);
	});

	it("writes a year file a row a line, the heart rate whole and the speed in m/s to 5 dp", () => {
		const rows = thresholdRows(hrPayload("2026-09-10", "2026-10-11"), speedPayload("2026-09-10", "2026-10-11")).map((r) => INDEX.normalize(r)!);
		const text = INDEX.serializeYear("2026", rows);
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n\t\t{"date":"2026-09-19","hr":182,"speed":3.72221}\n\t]\n}\n');
		assert.deepEqual(INDEX.parseYear(text), [SEP_19]);
	});

	it("keeps every pace within 0.0004 s/km at 5 dp: 0.37222118 → 3.72221 m/s, 268.6576 s/km against 268.6575", () => {
		const exact = 1000 / (0.37222118000000004 * 10);
		assert.ok(Math.abs(exact - 268.6575) < 0.0001);
		assert.ok(Math.abs(1000 / SEP_19.speed! - exact) < 0.0004);
		for (const [, , raw] of CHANGES) {
			const kept = INDEX.normalize({ date: "2026-01-01", speed: raw * 10 })!.speed!;
			assert.ok(Math.abs(1000 / kept - 1000 / (raw * 10)) < 0.0004, String(raw));
		}
	});
});

describe("LACTATE_THRESHOLD_INDEX — a window", () => {
	it("asks the heart rate, then the speed, for the same window", async () => {
		const calls: string[] = [];
		await window("2025-10-10", "2026-10-11", calls);
		assert.deepEqual(calls, ["hr 2025-10-10 2026-10-11", "speed 2025-10-10 2026-10-11"]);
	});

	it("merges the two routes by day: one row a day, the heart rate and the speed × 10 side by side", async () => {
		const rows = await window("2025-10-10", "2026-10-11");
		assert.equal(rows.length, 28);
		assert.deepEqual(rows.at(-1), SEP_19);
		assert.deepEqual(rows.slice(0, 2), [
			{ date: "2025-10-12", hr: 186, speed: 4.1111 },
			{ date: "2025-10-13", hr: 188, speed: 4.1111 },
		]);
		// The slowest speed, the history's first row: 0.35833233 → 3.58332 m/s, 279.07 s/km.
		const [first] = await window("2024-10-08", "2025-10-09");
		assert.deepEqual(first, { date: "2025-08-03", hr: 176, speed: 3.58332 });
		assert.ok(Math.abs(1000 / first!.speed! - 279.071) < 0.001);
	});

	it("holds the whole history as the spec's fixture has it: 40 days from 2025-08-03, 17 in 2025, 23 in 2026", async () => {
		const older = await window("2024-10-08", "2025-10-09");
		const newer = await window("2025-10-10", "2026-10-11");
		const rows = [...older, ...newer];
		assert.deepEqual([older.length, newer.length], [12, 28]);
		assert.deepEqual(rows, specRows());
		assert.deepEqual([rows.length, rows.filter((r) => r.date < "2026").length, rows[0]!.date], [40, 17, "2025-08-03"]);
	});

	it("keeps change points: both routes on the same days, a value that repeats on its own day", async () => {
		const rows = [...(await window("2024-10-08", "2025-10-09")), ...(await window("2025-10-10", "2026-10-11"))];
		assert.ok(rows.every((r) => r.hr !== undefined && r.speed !== undefined));
		assert.deepEqual(
			rows.filter((r) => r.hr === 168).map((r) => r.date),
			["2025-09-01", "2025-09-06", "2025-09-15"],
		);
		// 14 distinct speeds, 3.58332 (4:39 /km) to 4.13888 m/s (4:02 /km).
		const speeds = [...new Set(rows.map((r) => r.speed!))].sort((a, b) => a - b);
		assert.deepEqual([speeds.length, speeds[0], speeds.at(-1)], [14, 3.58332, 4.13888]);
		// The longest stretch without a change: 2025-12-07 → 2026-01-15, 39 days.
		const gaps = rows.slice(1).map((r, i) => daysBetween(rows[i]!.date, r.date));
		assert.equal(Math.max(...gaps), 39);
		assert.equal(rows[gaps.indexOf(39)]!.date, "2025-12-07");
	});

	it("finds no row in a window without a change, and carries nothing in", async () => {
		// The gap probe: Oct 14 – Nov 4, 2025, between the Oct 13 and Nov 5 changes.
		assert.deepEqual(await window("2025-10-14", "2025-11-04"), []);
		// Before the history: 367 calendar days across Feb 29, 2024.
		assert.deepEqual(await window("2023-10-11", "2024-10-11"), []);
	});

	it("fails the whole window if either request fails, so the window is asked again", async () => {
		const calls: string[] = [];
		await assert.rejects(() => INDEX.fetchWindow(ltApi(calls, "hr"), "2025-10-10", "2026-10-11"), GarminApiError);
		// One after the other: the speed isn't asked once the heart rate failed.
		assert.deepEqual(calls, ["hr 2025-10-10 2026-10-11"]);
		await assert.rejects(() => INDEX.fetchWindow(ltApi([], "speed"), "2025-10-10", "2026-10-11"), GarminApiError);
	});

	it("is refused past the cap, as Garmin refuses 368 calendar days", async () => {
		await assert.rejects(() => INDEX.fetchWindow(ltApi([]), "2025-10-09", "2026-10-11"), GarminApiError);
		assert.equal(daysBetween("2025-10-10", "2026-10-11") + 1, INDEX.windowDays);
	});
});

describe("thresholdRows", () => {
	const at = (day: string, value: unknown, extra: Partial<BiometricChange> = {}) =>
		({ from: day, until: day, series: "running", value, updatedDate: day, ...extra }) as BiometricChange;

	it("dates a row by its from, else its updatedDate, and keeps the speed in m/s (× 10)", () => {
		const rows = thresholdRows([at("2026-09-19", 182)], [{ series: "running", value: 0.37222118000000004, updatedDate: "2026-09-19T11:29:57.527" }]);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]!.hr, 182);
		assert.ok(Math.abs((rows[0]!.speed as number) - 3.7222118) < 1e-12);
		assert.deepEqual(INDEX.normalize(rows[0]), SEP_19);
	});

	it("reads the series case-insensitively and leaves out another sport's rows, a row without a day, and what is null", () => {
		const rows = thresholdRows(
			[at("2026-09-19", 182, { series: "RUNNING" }), at("2026-09-19", 150, { series: "cycling" }), at("2026-09-20", null), { value: 180 }, null],
			[at("2026-09-19", 0.37222118000000004, { series: undefined })],
		).map((r) => INDEX.normalize(r));
		assert.deepEqual(rows, [SEP_19, null]);
		assert.deepEqual(thresholdRows(null, undefined), []);
	});

	it("keeps a day only one route has, with what it gave", () => {
		const rows = thresholdRows([at("2026-09-19", 182)], []).map((r) => INDEX.normalize(r));
		assert.deepEqual(rows, [{ date: "2026-09-19", hr: 182 }]);
	});
});

describe("LACTATE_THRESHOLD_INDEX — the history walk", () => {
	it("walks the whole history in four windows, eight requests: two with rows, then two empty", async () => {
		const calls: string[] = [];
		const api = ltApi(calls);
		const windows: string[] = [];
		const found: number[] = [];
		const walk = await walkHistory(
			INDEX,
			async (start, end) => {
				windows.push(`${start} ${end}`);
				const rows = await INDEX.fetchWindow(api, start, end);
				found.push(rows.length);
				return rows;
			},
			{ until: "2026-10-11" },
		);
		assert.deepEqual(windows, ["2025-10-10 2026-10-11", "2024-10-08 2025-10-09", "2023-10-07 2024-10-07", "2022-10-05 2023-10-06"]);
		assert.deepEqual(found, [28, 12, 0, 0]);
		// Every window is 367 calendar days, inside the cap — across Feb 29, 2024 too.
		for (const w of windows) assert.equal(daysBetween(w.slice(0, 10), w.slice(11)), 366);
		assert.deepEqual([walk.complete, walk.error, walk.batch.rows.length], [true, undefined, 40]);
		// Two requests a window, booked as such.
		assert.equal(calls.length, 8);
		assert.equal(walk.requests, 8);
		assert.deepEqual(walk.covered, { from: "2022-10-05", to: "2026-10-11" });
	});
});

describe("LACTATE_THRESHOLD_INDEX — a routine sync", () => {
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

	class Sink implements DayIndexSink<LactateThresholdRow> {
		merged: Array<DayIndexBatch<LactateThresholdRow>> = [];
		constructor(public held: { from?: string; to?: string } | null) {}
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<LactateThresholdRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	async function sync(from: string, to: string, held: { from?: string; to?: string } | null, groups: Array<"fitness" | "sleep"> = ["fitness"]) {
		const source: string[] = [];
		const api: string[] = [];
		const sink = new Sink(held);
		const lt = ltApi(api);
		const report = await syncRange(groups.includes("fitness") ? fitnessSource(source) : new Proxy({} as SyncSource, { get: () => async () => null }), target, {
			from,
			to,
			groups,
			units: "metric",
			wait: async () => {},
			indexes: [{ def: INDEX, sink, fetchWindow: (start, end) => INDEX.fetchWindow(lt, start, end) }],
		});
		return { report, sink, api, source };
	}

	it("asks one window for the run's days: two requests, the heart rate and the speed", async () => {
		const { report, sink, api, source } = await sync("2026-09-15", "2026-09-21", { from: "2025-08-03", to: "2026-09-14" });
		assert.deepEqual(api, ["hr 2026-09-15 2026-09-21", "speed 2026-09-15 2026-09-21"]);
		// The report counts both: the day sync's own requests, then the index's two.
		assert.equal(report.requests - source.length, 2);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [SEP_19]);
		// Every day of the window was asked: a day without a change holds no row.
		const dates = [...sink.merged[0]!.dates].sort();
		assert.deepEqual([dates.length, dates[0], dates.at(-1)], [7, "2026-09-15", "2026-09-21"]);
	});

	it("reaches back to the index's newest day after a vault was left closed, still in one window", async () => {
		const { api } = await sync("2026-10-05", "2026-10-11", { from: "2025-08-03", to: "2026-09-20" });
		assert.deepEqual(api, ["hr 2026-09-21 2026-10-11", "speed 2026-09-21 2026-10-11"]);
	});

	it("asks nothing while the fitness group is off", async () => {
		const { api, sink } = await sync("2026-10-11", "2026-10-11", null, ["sleep"]);
		assert.deepEqual(api, []);
		assert.equal(sink.merged.length, 0);
	});
});
