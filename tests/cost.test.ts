import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Task } from "../src/sync/backfill";
import {
	asObserved,
	chunkDays,
	costContext,
	dayUnit,
	detailBatch,
	detailRequests,
	detailUnit,
	freshHour,
	listRequests,
	nextUnit,
	observe,
	requestsPerDay,
	ROW_BYTES,
	timeFor,
	unitsOf,
	type CostContext,
	type Unit,
} from "../src/sync/cost";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { ALL_GROUPS } from "../src/sync/metrics";
import { MEASURED } from "./support/account-fixture";

const ctx = (over: Partial<Parameters<typeof costContext>[0]> = {}): CostContext =>
	costContext({ today: MEASURED.today, groups: ALL_GROUPS, scan: MEASURED.scan, charts: new Map(), activities: MEASURED.activities, detailFiles: new Map(), ...over });

const requestsOf = (units: readonly Unit[]) => units.reduce((n, u) => n + u.requests, 0);

describe("cost — requests", () => {
	it("counts a day's requests from the groups on, and sizes a chunk to about ten seconds", () => {
		assert.equal(requestsPerDay(ALL_GROUPS), 15);
		assert.equal(requestsPerDay(["activity", "heart", "stress", "respiration", "spo2"]), 1);
		assert.equal(requestsPerDay(["intraday"]), 6);
		assert.equal(chunkDays(ALL_GROUPS), 13);
	});

	it("lists the activities a hundred a page, the count first, until a page comes back short", () => {
		assert.deepEqual([0, 99, 100, 344, 3_000].map(listRequests), [2, 2, 3, 5, 32]);
	});

	it("prices an activity's page by what it records", () => {
		assert.deepEqual(
			[detailRequests("run"), detailRequests("indoorRun"), detailRequests("ride", true), detailRequests("ride"), detailRequests("gpsOther"), detailRequests("pool"), detailRequests("gym"), detailRequests("other")],
			[11, 10, 11, 9, 9, 8, 8, 10],
		);
	});

	it("prices a chunk of 13 days: their requests, the activities by date, and the range routes once", () => {
		const unit = dayUnit("2026-10-01", "2026-10-13", ctx());
		assert.deepEqual([unit.days, unit.requests], [13, 13 * 15 + 1 + 5]);
		// The 195 day requests set the pace, 9.75 s, after the list and the range routes.
		assert.ok(Math.abs(unit.seconds - (0.6 + 0.6 + 9.75 + 0.3)) < 1e-9, String(unit.seconds));
	});

	it("downloads activities' pages a batch of about ten seconds at a time, three side by side", () => {
		const runs = MEASURED.activities.filter((a) => a.profile === "run").map((a) => a.id);
		const batch = detailBatch(runs, ctx());
		// Fifteen runs: five rounds of three, two trips each at 0.85 s, 8.8 s with the unit's own work.
		assert.equal(batch.length, 15);
		assert.ok(Math.abs(detailUnit(batch, ctx()).seconds - 8.8) < 1e-9);
		assert.deepEqual(detailBatch(runs.slice(0, 1), ctx()), runs.slice(0, 1));
	});

	it("asks two requests, and writes nothing new, for a run an older version saved", () => {
		const run = MEASURED.activities.find((a) => a.profile === "run")!;
		const unit = detailUnit([run.id], ctx({ detailFiles: new Map([[run.id, 5]]) }));
		assert.deepEqual([unit.requests, unit.bytes], [2, 0]);
	});
});

describe("cost — history walks", () => {
	// 446 days of history: the windows that reach its first day, then the empty ones that end the walk.
	const walk = (store: string, c = ctx()) => requestsOf(unitsOf([{ kind: "walk", store }], c));

	it("walks each index back to the history's start", () => {
		assert.equal(walk("daily-stats"), 16 * 3 + 4);
		assert.equal(walk("sleep"), 16 + 4);
		assert.equal(walk("index:stress"), 16 + 2);
		assert.equal(walk("index:body-battery"), (16 + 2) * 2);
		assert.equal(walk("index:respiration"), 15 + 2);
		assert.equal(walk("index:fitness-age"), 16 + 1);
		assert.equal(walk("index:health-status"), 1 + 1);
		assert.equal(walk("index:weight"), (1 + 1) * 2);
		assert.equal(walk("index:hrv-status"), 2 + 1);
		assert.equal(walk("index:ftp"), (2 + 2) * 2);
	});

	it("asks nothing of a complete index, and carries on from where one stopped", () => {
		assert.equal(walk("index:stress", ctx({ charts: new Map([["index:stress", { complete: true }]]) })), 0);
		// 2025-08-02 → 2025-12-31 is 152 days: six windows of 28, then the two empty ones.
		assert.equal(walk("index:stress", ctx({ charts: new Map([["index:stress", { complete: false, from: "2026-01-01" }]]) })), 6 + 2);
	});

	it("runs the walks three at a time, a segment each, as the runner does", () => {
		const tasks: Task[] = ["daily-stats", "sleep", "index:stress", "index:heart-rate"].map((store) => ({ kind: "walk", store }));
		const units = unitsOf(tasks, ctx());
		assert.deepEqual(
			units.map((u) => (u.kind === "walk" ? u.stores : [])),
			[["daily-stats", "sleep", "index:stress"], ["daily-stats", "sleep", "index:stress"], ["index:heart-rate"], ["index:heart-rate"]],
		);
		assert.equal(nextUnit(tasks, ctx())?.requests, units[0]!.requests);
		// A segment of 14 windows: daily stats' 42 requests with steps, sleep's 14, stress's 14.
		assert.equal(units[0]!.requests, 42 + 14 + 14);
	});

	it("has a size for every chart store", () => {
		for (const def of DAY_INDEXES) assert.ok(def.kind in ROW_BYTES, def.kind);
		assert.ok("daily-stats" in ROW_BYTES && "sleep" in ROW_BYTES);
	});
});

describe("cost — time under the hourly budget", () => {
	const now = Date.parse("2026-10-21T08:00:00Z");
	const units = (n: number, requests: number, seconds: number): Unit[] => Array.from({ length: n }, () => ({ kind: "activities", requests, bytes: 0, seconds }));

	it("adds the units up while the hour has room", () => {
		assert.equal(timeFor(units(8, 1_000, 10), freshHour(), now), 80);
	});

	it("waits for the hour to free up past 8,000", () => {
		// The ninth unit waits for the first to leave the hour, 3,610 s in; the tenth fits after it.
		assert.equal(timeFor(units(10, 1_000, 10), freshHour(), now), 3_630);
	});

	it("starts from what the hour spent already", () => {
		const spent = { entries: [{ at: now - 600_000, requests: 7_500 }], perHour: 8_000 };
		// 1,000 more needs the 7,500 to leave the hour: 50 minutes, then the unit's 10 s.
		assert.equal(timeFor(units(1, 1_000, 10), spent, now), 3_010);
	});

	it("holds half the hour while a 429's halving lasts", () => {
		const halved = { entries: [], perHour: 8_000, halvedUntil: now + 24 * 3_600_000 };
		assert.equal(timeFor(units(5, 1_000, 10), halved, now), 3_620);
	});
});

describe("cost — the time left, from the download's own pace", () => {
	const unit: Unit = { kind: "days", from: "2026-10-01", to: "2026-10-13", days: 13, requests: 201, bytes: 0, seconds: 10 };

	it("takes the first unit's run as it came, then leans toward the latest", () => {
		let seen = observe({}, unit, 8, 201);
		assert.deepEqual(seen.days, { time: 0.8, requests: 1 });
		seen = observe(seen, unit, 12, 201);
		assert.ok(Math.abs(seen.days!.time - (0.8 + 0.3 * (1.2 - 0.8))) < 1e-9);
		// A unit of another kind says nothing about these.
		assert.equal(seen.details, undefined);
	});

	it("keeps a wild run within a factor of four, and reads units as they have been running", () => {
		const seen = observe({}, unit, 100, 2_000);
		assert.deepEqual(seen.days, { time: 4, requests: 4 });
		const [got] = asObserved([unit], observe({}, unit, 5, 201));
		assert.deepEqual([got!.seconds, got!.requests], [5, 201]);
		assert.deepEqual(asObserved([unit], {}), [unit]);
	});
});

