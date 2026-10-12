import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { daysBetween } from "../src/dashboard/periods";
import { GarminApi, type CriticalSwimSpeedRange } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import { MemoryTokenStore } from "../src/garmin/tokens";
import {
	CRITICAL_SWIM_SPEED_INDEX,
	CSS_DATE_KEYS,
	CSS_VALUE_KEYS,
	rowsOfCriticalSwimSpeed,
	swimSpeedOf,
	type CriticalSwimSpeedRow,
} from "../src/sync/critical-swim-speed-index";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import { FixtureHttpClient, type FixtureRule } from "./support/fixture-http";

/*
 * The Critical Swim Speed index against the route as Garmin answered it on
 * 2026-10-12 (ref/performance-stats/critical-swim-speed/README.md, "Data
 * plan"): the account has never had a result, so every window is the empty
 * body below. The mapper's field names are Inferred; its tests use
 * synthetic entries.
 */

const HOST = "https://connectapi.garmin.com";

/** Garmin's answer for a window without a result: the request's days echoed, both lists empty. */
const empty = (from: string, until: string): CriticalSwimSpeedRange => ({ from, until, criticalSwimSpeedDTOList: [], aggregatedResults: [] });

const normalized = (payload: CriticalSwimSpeedRange | null | undefined) =>
	rowsOfCriticalSwimSpeed(payload).map((r) => CRITICAL_SWIM_SPEED_INDEX.normalize(r));

/**
 * The route as a stub: the given results inside each window (the body's
 * shape Inferred), the empty body otherwise, and HTTP 400 past the cap
 * (end − start ≤ 366 days) or for a reversed window, as the probes found.
 */
function cssApi(calls: string[], results: Array<Record<string, unknown>> = []): GarminApi {
	return {
		criticalSwimSpeedRange: async (start: string, end: string, aggregation?: string) => {
			calls.push(`range ${start} ${end}${aggregation ? ` ${aggregation}` : ""}`);
			if (start > end || daysBetween(start, end) > 366) throw new GarminApiError("HTTP 400", 400, "");
			const inside = results.filter((r) => typeof r.calendarDate === "string" && r.calendarDate >= start && r.calendarDate <= end);
			return { ...empty(start, end), criticalSwimSpeedDTOList: inside };
		},
	} as unknown as GarminApi;
}

/** A signed-in client on canned responses; retries don't wait. */
async function liveApi(rules: FixtureRule[]) {
	const http = new FixtureHttpClient([
		{ url: "/mobile/api/login", times: 1, json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST" } },
		{ url: "diauth", times: 1, json: { access_token: "a", refresh_token: "r", expires_in: 3600 } },
		...rules,
	]);
	const api = new GarminApi({ http, store: new MemoryTokenStore(), wait: async () => {} });
	await api.login("u", "p");
	return { http, api, asked: () => http.urls.filter((u) => u.includes("criticalSwimSpeed")) };
}

describe("CRITICAL_SWIM_SPEED_INDEX — the definition", () => {
	it("is the critical-swim-speed index of the workouts group: 367 days a window, two empty windows end the walk, nothing refreshed", () => {
		const def = CRITICAL_SWIM_SPEED_INDEX;
		assert.deepEqual(
			[def.kind, def.folder, def.title, def.group, def.version, def.listKey],
			["critical-swim-speed", "critical-swim-speed", "critical swim speed", "workouts", 1, "days"],
		);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld, def.requestsPerWindow], [367, 0, 2, false, 1]);
		assert.equal(def.maxHistoryDays, undefined);
		// The day sync never asks this route: no free feed.
		assert.equal(def.fromDay, undefined);
		assert.equal(def.fromSummary, undefined);
		assert.deepEqual(def.keys, ["speed"]);
	});

	it("writes the spec's example row to 4 dp: 1.0256 m/s, 97.5 s per 100 m", () => {
		const row = CRITICAL_SWIM_SPEED_INDEX.normalize({ date: "2026-10-08", speed: 1.025641 })!;
		assert.deepEqual(row, { date: "2026-10-08", speed: 1.0256 });
		const text = CRITICAL_SWIM_SPEED_INDEX.serializeYear("2026", [row]);
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n\t\t{"date":"2026-10-08","speed":1.0256}\n\t]\n}\n');
		assert.deepEqual(CRITICAL_SWIM_SPEED_INDEX.parseYear(text), [row]);
		// 4 dp keeps the pace within 0.01 s: 100 ÷ 1.025641 = 97.500, 100 ÷ 1.0256 = 97.504.
		assert.ok(Math.abs(100 / 1.0256 - 100 / 1.025641) < 0.01);
	});
});

describe("CRITICAL_SWIM_SPEED_INDEX — no result vs an error", () => {
	it("maps every empty answer the account gave to no rows: the four-key body, and a null body", () => {
		for (const [from, until] of [
			["2026-10-05", "2026-10-11"],
			["2026-09-28", "2026-10-04"],
			["2026-07-20", "2026-10-11"],
			["2025-10-13", "2026-10-11"],
			["2025-10-10", "2026-10-11"],
			["2023-10-11", "2024-10-11"],
			["2026-10-11", "2026-10-11"],
		] as const) {
			assert.deepEqual(rowsOfCriticalSwimSpeed(empty(from, until)), [], `${from}..${until}`);
		}
		assert.deepEqual(rowsOfCriticalSwimSpeed(null), []);
		assert.deepEqual(rowsOfCriticalSwimSpeed(undefined), []);
		assert.deepEqual(rowsOfCriticalSwimSpeed({ criticalSwimSpeedDTOList: null, aggregatedResults: null }), []);
	});

	it("asks the bare daily path once a window, and reads Garmin's empty body and a 204 as a window without a result", async () => {
		const { api, asked } = await liveApi([
			{ url: "/criticalSwimSpeed/range/2025-10-10/", times: 1, json: empty("2025-10-10", "2026-10-11") },
			{ url: "/criticalSwimSpeed/range/2024-10-08/", times: 1, status: 204, text: "" },
		]);
		assert.deepEqual(await CRITICAL_SWIM_SPEED_INDEX.fetchWindow(api, "2025-10-10", "2026-10-11"), []);
		assert.deepEqual(await CRITICAL_SWIM_SPEED_INDEX.fetchWindow(api, "2024-10-08", "2025-10-09"), []);
		assert.deepEqual(asked(), [
			`${HOST}/biometric-service/criticalSwimSpeed/range/2025-10-10/2026-10-11`,
			`${HOST}/biometric-service/criticalSwimSpeed/range/2024-10-08/2025-10-09`,
		]);
	});

	it("throws for an error rather than reading it as no result: HTTP 400 once, a 5xx after two retries", async () => {
		const refused = await liveApi([{ url: "/criticalSwimSpeed/range/", status: 400, text: '{"message":"bad range"}' }]);
		await assert.rejects(() => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(refused.api, "2025-10-09", "2026-10-11"), GarminApiError);
		assert.equal(refused.asked().length, 1);
		const broken = await liveApi([{ url: "/criticalSwimSpeed/range/", status: 502, text: "" }]);
		await assert.rejects(() => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(broken.api, "2025-10-10", "2026-10-11"), GarminApiError);
		assert.equal(broken.asked().length, 3);
	});

	it("keeps a failed walk incomplete, its window not covered, where an empty one is covered and complete", async () => {
		const failed = await walkHistory(CRITICAL_SWIM_SPEED_INDEX, async () => {
			throw new GarminApiError("HTTP 500", 500, "");
		}, { until: "2026-10-11" });
		assert.deepEqual([failed.complete, failed.batch.rows, failed.batch.dates.length, failed.covered], [false, [], 0, null]);
		assert.match(failed.error!, /^2025-10-10\.\.2026-10-11: /);
		const quiet = await walkHistory(CRITICAL_SWIM_SPEED_INDEX, (start, end) => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(cssApi([]), start, end), { until: "2026-10-11" });
		assert.deepEqual([quiet.complete, quiet.batch.rows, quiet.batch.dates.length], [true, [], 734]);
	});
});

describe("rowsOfCriticalSwimSpeed — the Inferred mapper", () => {
	it("reads a result's day from calendarDate, else updatedDate, else from", () => {
		assert.deepEqual(CSS_DATE_KEYS, ["calendarDate", "updatedDate", "from"]);
		assert.deepEqual(
			normalized({
				criticalSwimSpeedDTOList: [
					{ calendarDate: "2026-10-08", updatedDate: "2026-10-09T07:00:00.0", speed: 1.0256 },
					{ updatedDate: "2026-09-01T18:30:12.0", from: "2026-08-31", speed: 1.1 },
					{ from: "2026-07-20T00:00:00", speed: 1.2 },
					{ until: "2026-07-01", speed: 1.3 },
				],
			}),
			[
				{ date: "2026-07-20", speed: 1.2 },
				{ date: "2026-09-01", speed: 1.1 },
				{ date: "2026-10-08", speed: 1.0256 },
			],
		);
	});

	it("reads the first number among criticalSwimSpeed, speed, value, swimSpeed", () => {
		assert.deepEqual(CSS_VALUE_KEYS, ["criticalSwimSpeed", "speed", "value", "swimSpeed"]);
		const at = (entry: Record<string, unknown>) => normalized({ criticalSwimSpeedDTOList: [{ calendarDate: "2026-10-08", ...entry }] })[0]?.speed;
		assert.equal(at({ criticalSwimSpeed: 1.25, speed: 1.1 }), 1.25);
		assert.equal(at({ criticalSwimSpeed: null, speed: "1.3", value: 1.1, swimSpeed: 1.2 }), 1.1);
		assert.equal(at({ swimSpeed: 0.95 }), 0.95);
		assert.equal(at({ pace: 97.5 }), undefined);
	});

	it("reads the value by its size: m/s, tenths of m/s, or seconds per 100 m; anything else is dropped", () => {
		// 1.0256 m/s, 0.10256 tenths (the lactate threshold speed's quirk), 97.5 s per 100 m: the same pace.
		assert.equal(swimSpeedOf(1.0256), 1.0256);
		assert.ok(Math.abs(swimSpeedOf(0.10256)! - 1.0256) < 1e-12);
		assert.ok(Math.abs(swimSpeedOf(97.5)! - 1.025641) < 1e-6);
		// The edges: 0:40 to 5:33 per 100 m in m/s, and 0:40 to 5:20 in seconds.
		assert.deepEqual([0.3, 2.5, 0.03, 0.25, 40, 320].map((v) => swimSpeedOf(v) !== undefined), [true, true, true, true, true, true]);
		assert.deepEqual([0.29, 2.6, 0.02, 0.26, 39, 321, 0, -1, Number.NaN, Infinity, "1.0"].map(swimSpeedOf), Array(11).fill(undefined));
		const rows = normalized({ criticalSwimSpeedDTOList: [{ calendarDate: "2026-10-08", speed: 2.7 }, { calendarDate: "2026-10-09", value: 97.5 }] });
		assert.deepEqual(rows, [{ date: "2026-10-09", speed: 1.0256 }]);
	});

	it("keeps a day's last result, oldest day first, and skips what has no day or no speed", () => {
		const rows = normalized({
			criticalSwimSpeedDTOList: [
				{ calendarDate: "2026-10-08", speed: 1.0 },
				null,
				"result",
				{ calendarDate: "2026-09-01", speed: 1.1 },
				{ calendarDate: "2026-10-08", speed: 1.05 },
				{ calendarDate: "2026-10-08", speed: null },
				{ speed: 1.2 },
			] as unknown as Array<Record<string, unknown>>,
		});
		assert.deepEqual(rows, [
			{ date: "2026-09-01", speed: 1.1 },
			{ date: "2026-10-08", speed: 1.05 },
		]);
	});

	it("falls back to aggregatedResults only when criticalSwimSpeedDTOList has nothing", () => {
		const week = { from: "2026-10-05", until: "2026-10-11", speed: 1.0 };
		assert.deepEqual(normalized({ criticalSwimSpeedDTOList: [], aggregatedResults: [week] }), [{ date: "2026-10-05", speed: 1 }]);
		assert.deepEqual(normalized({ aggregatedResults: [week] }), [{ date: "2026-10-05", speed: 1 }]);
		assert.deepEqual(normalized({ criticalSwimSpeedDTOList: [{ calendarDate: "2026-10-08", speed: 1.0256 }], aggregatedResults: [week] }), [
			{ date: "2026-10-08", speed: 1.0256 },
		]);
	});
});

describe("CRITICAL_SWIM_SPEED_INDEX — the history walk", () => {
	it("is complete with no rows after two requests on the recording account: two empty 367-day windows", async () => {
		const calls: string[] = [];
		const api = cssApi(calls);
		const walk = await walkHistory(CRITICAL_SWIM_SPEED_INDEX, (start, end) => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(api, start, end), { until: "2026-10-11" });
		assert.deepEqual(calls, ["range 2025-10-10 2026-10-11", "range 2024-10-08 2025-10-09"]);
		// Each window is end − start = 366 days, inside the cap.
		for (const call of calls) assert.equal(daysBetween(call.slice(6, 16), call.slice(17)), 366);
		assert.deepEqual([walk.complete, walk.error, walk.batch.rows, walk.requests], [true, undefined, [], 2]);
		assert.deepEqual(walk.covered, { from: "2024-10-08", to: "2026-10-11" });
	});

	it("walks on past a year without a test: a result in the second window takes two more empty ones (Inferred)", async () => {
		const calls: string[] = [];
		const api = cssApi(calls, [{ calendarDate: "2025-03-01", speed: 1.0256 }]);
		const walk = await walkHistory(CRITICAL_SWIM_SPEED_INDEX, (start, end) => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(api, start, end), { until: "2026-10-11" });
		assert.deepEqual(calls, ["range 2025-10-10 2026-10-11", "range 2024-10-08 2025-10-09", "range 2023-10-07 2024-10-07", "range 2022-10-05 2023-10-06"]);
		// Across Feb 29, 2024 too, every window stays inside the cap.
		for (const call of calls) assert.equal(daysBetween(call.slice(6, 16), call.slice(17)), 366);
		assert.deepEqual([walk.complete, walk.batch.rows], [true, [{ date: "2025-03-01", speed: 1.0256 }]]);
	});
});

describe("CRITICAL_SWIM_SPEED_INDEX — a routine sync", () => {
	/** The workouts group's own sync: the activity list, one page, empty. */
	function workoutsSource(calls: string[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: unknown, b?: unknown) => {
				calls.push(`${name}:${String(a ?? "")}${b !== undefined ? ` ${String(b)}` : ""}`);
				if (name === "activities") return [];
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<CriticalSwimSpeedRow> {
		merged: Array<DayIndexBatch<CriticalSwimSpeedRow>> = [];
		constructor(public held: { from?: string; to?: string } | null) {}
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<CriticalSwimSpeedRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	async function sync(from: string, to: string, held: { from?: string; to?: string } | null, groups: Array<"workouts" | "sleep"> = ["workouts"]) {
		const source: string[] = [];
		const api: string[] = [];
		const sink = new Sink(held);
		const css = cssApi(api, [{ calendarDate: "2026-10-08", speed: 1.0256 }]);
		const report = await syncRange(groups.includes("workouts") ? workoutsSource(source) : new Proxy({} as SyncSource, { get: () => async () => null }), target, {
			from,
			to,
			groups,
			units: "metric",
			wait: async () => {},
			indexes: [{ def: CRITICAL_SWIM_SPEED_INDEX, sink, fetchWindow: (start, end) => CRITICAL_SWIM_SPEED_INDEX.fetchWindow(css, start, end) }],
		});
		return { report, sink, api, source };
	}

	it("asks one window for the run's days: one request, the bare path", async () => {
		const { report, sink, api, source } = await sync("2026-10-05", "2026-10-11", { from: "2024-10-08", to: "2026-10-10" });
		assert.deepEqual(api, ["range 2026-10-05 2026-10-11"]);
		assert.equal(report.requests - source.length, 1);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [{ date: "2026-10-08", speed: 1.0256 }]);
		// Every day of the window was asked: a day without a result holds no row.
		const dates = [...sink.merged[0]!.dates].sort();
		assert.deepEqual([dates.length, dates[0], dates.at(-1)], [7, "2026-10-05", "2026-10-11"]);
	});

	it("reaches back to the index's newest day after a vault was left closed, still in one window", async () => {
		const { api } = await sync("2026-10-05", "2026-10-11", { from: "2024-10-08", to: "2026-06-30" });
		assert.deepEqual(api, ["range 2026-07-01 2026-10-11"]);
	});

	it("asks nothing while the workouts group is off", async () => {
		const { api, sink } = await sync("2026-10-11", "2026-10-11", null, ["sleep"]);
		assert.deepEqual(api, []);
		assert.equal(sink.merged.length, 0);
	});
});
