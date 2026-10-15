import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	heldElsewhere,
	LEASE_MS,
	nextChunk,
	parseBackfill,
	planBackfill,
	rateLimitWait,
	RequestBudget,
	serializeBackfill,
	stillPaused,
	type ChartMeta,
	type PlanInput,
} from "../src/sync/backfill";
import type { Span } from "../src/sync/coverage";
import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_STORE, ACTIVITY_DETAILS_VERSION, chartKeys, consentKey, LEGACY_RUNS_STORE } from "../src/sync/datasets";
import { shiftDate } from "../src/sync/day-index";
import type { AccountScan } from "../src/sync/scan";

const TODAY = "2026-10-14";
const GROUPS = ["activity", "sleep", "workouts", "intraday"] as const;

/** Data every day from `first` to today, in weeks ending today. */
function scan(first: string, scannedAt = TODAY): AccountScan {
	const weeks: Array<[string, number]> = [];
	for (let end = scannedAt; end >= first; end = shiftDate(end, -7)) {
		const week = shiftDate(end, -6);
		weeks.unshift([week, week >= first ? 7 : Math.round((Date.parse(end) - Date.parse(first)) / 86_400_000) + 1]);
	}
	return { scannedAt: `${scannedAt}T06:00:00.000Z`, firstDay: first, days: 0, weeks, activities: 3, complete: true };
}

const complete: ChartMeta = { complete: true };

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
	today: TODAY,
	groups: [...GROUPS],
	accepted: [],
	dayDetails: "30d",
	activityDetails: "opened",
	scan: scan("2025-08-02"),
	daySpans: [],
	charts: new Map(),
	activities: [],
	detailFiles: new Map(),
	...over,
});

/** Run details agreed to at today's version, and at the one before: from when only runs had a page. */
const RUNS_NOW = consentKey(LEGACY_RUNS_STORE, ACTIVITY_DETAILS_VERSION);
const RUNS_BEFORE = consentKey(LEGACY_RUNS_STORE, ACTIVITY_DETAILS_VERSION - 1);
const DETAILS_BEFORE = consentKey(ACTIVITY_DETAILS_STORE, ACTIVITY_DETAILS_VERSION - 1);

describe("backfill plan", () => {
	it("plans nothing that was not agreed to", () => {
		assert.deepEqual(planBackfill(input()), []);
	});

	it("lists the activities first, then the chart walks, then days newest first, then activity details", () => {
		const accepted = [...chartKeys(GROUPS), "days@1", ACTIVITY_DETAILS_KEY];
		const activities = [
			{ id: 3, date: "2026-10-12", run: true },
			{ id: 2, date: "2026-09-01", run: false },
			{ id: 1, date: "2025-09-01", run: true },
		];
		const tasks = planBackfill(input({ accepted, activityDetails: "1y", activities, daySpans: [[shiftDate(TODAY, -9), TODAY, 1]] }));
		assert.deepEqual(
			tasks.map((t) => t.kind),
			["activities", "walk", "walk", "walk", "days", "details"],
		);
		assert.deepEqual(tasks[4], { kind: "days", from: shiftDate(TODAY, -29), to: shiftDate(TODAY, -10) });
		assert.deepEqual(tasks[5], { kind: "details", ids: [3, 2] });
	});

	it("skips a chart index whose history is complete, and walks one that a version bump reset", () => {
		const accepted = chartKeys(GROUPS);
		const charts = new Map<string, ChartMeta | null>([
			["activities", complete],
			["daily-stats", complete],
			["sleep", null],
			["index:critical-swim-speed", { complete: false, from: "2026-01-01" }],
		]);
		assert.deepEqual(planBackfill(input({ accepted, charts })), [
			{ kind: "walk", store: "sleep" },
			{ kind: "walk", store: "index:critical-swim-speed" },
		]);
		// A new index's key not agreed to yet: nothing until it is.
		assert.deepEqual(planBackfill(input({ accepted: accepted.filter((k) => k !== "sleep@1"), charts })), [{ kind: "walk", store: "index:critical-swim-speed" }]);
	});

	it("fetches missing days and those of an older version, only where the account has data", () => {
		const daySpans: Span[] = [
			[shiftDate(TODAY, -29), shiftDate(TODAY, -20), 0],
			[shiftDate(TODAY, -19), TODAY, 1],
		];
		assert.deepEqual(planBackfill(input({ accepted: ["days@1"], daySpans })), [{ kind: "days", from: shiftDate(TODAY, -29), to: shiftDate(TODAY, -20) }]);
		// The history starts ten days ago: nothing older is asked.
		assert.deepEqual(planBackfill(input({ accepted: ["days@1"], scan: scan(shiftDate(TODAY, -9)) })), [{ kind: "days", from: shiftDate(TODAY, -9), to: TODAY }]);
		// A day after the scan is asked: the scan could not see it.
		assert.deepEqual(planBackfill(input({ accepted: ["days@1"], scan: scan(shiftDate(TODAY, -40), shiftDate(TODAY, -5)), daySpans: [[shiftDate(TODAY, -29), shiftDate(TODAY, -6), 1]] })), [
			{ kind: "days", from: shiftDate(TODAY, -5), to: TODAY },
		]);
	});

	it("leaves a gap in the account's history out, newest stretch first", () => {
		const gapped = scan("2026-08-01");
		// No data in the week of Sep 10–16.
		gapped.weeks = gapped.weeks.map(([week, days]) => [week, week >= "2026-09-10" && week <= "2026-09-16" ? 0 : days]);
		const days = planBackfill(input({ accepted: ["days@1"], dayDetails: "90d", scan: gapped })).filter((t) => t.kind === "days");
		assert.equal(days.length, 2);
		const [newer, older] = days as Array<{ from: string; to: string }>;
		const gapWeek = gapped.weeks.find(([, d]) => d === 0)![0];
		assert.equal(newer!.from, shiftDate(gapWeek, 7));
		assert.equal(older!.to, shiftDate(gapWeek, -1));
	});

	it("starts New days only at the setup, so a gap since it is filled without asking", () => {
		const daySpans: Span[] = [[shiftDate(TODAY, -2), TODAY, 1]];
		assert.deepEqual(planBackfill(input({ accepted: ["days@1"], dayDetails: "new", since: shiftDate(TODAY, -6), daySpans })), [
			{ kind: "days", from: shiftDate(TODAY, -6), to: shiftDate(TODAY, -3) },
		]);
		assert.deepEqual(planBackfill(input({ accepted: ["days@1"], dayDetails: "new" })), []);
	});

	it("fetches missing activities under an older agreement, and those of an older file only under today's", () => {
		const activities = [
			{ id: 3, date: "2026-10-02", run: false },
			{ id: 2, date: "2026-10-01", run: true },
			{ id: 1, date: "2026-09-01", run: false },
		];
		const detailFiles = new Map([[1, 1]]);
		assert.deepEqual(planBackfill(input({ accepted: [DETAILS_BEFORE], activityDetails: "all", activities, detailFiles })), [{ kind: "details", ids: [3, 2] }]);
		assert.deepEqual(planBackfill(input({ accepted: [ACTIVITY_DETAILS_KEY], activityDetails: "all", activities, detailFiles })), [{ kind: "details", ids: [3, 2, 1] }]);
		assert.deepEqual(planBackfill(input({ accepted: [ACTIVITY_DETAILS_KEY], activityDetails: "opened", activities, detailFiles })), []);
	});

	it("keeps fetching runs, and only runs, under Run details until Activity details is agreed to", () => {
		const activities = [
			{ id: 4, date: "2026-10-03", run: false },
			{ id: 3, date: "2026-10-02", run: true },
			{ id: 2, date: "2026-10-01", run: false },
			{ id: 1, date: "2026-09-01", run: true },
		];
		const detailFiles = new Map([[1, 1]]);
		// Gaps only under an older Run details, and old files too at today's version.
		assert.deepEqual(planBackfill(input({ accepted: [RUNS_BEFORE], activityDetails: "all", activities, detailFiles })), [{ kind: "details", ids: [3] }]);
		assert.deepEqual(planBackfill(input({ accepted: [RUNS_NOW], activityDetails: "all", activities, detailFiles })), [{ kind: "details", ids: [3, 1] }]);
		// Activity details agreed to: every sport, whatever Run details said.
		assert.deepEqual(
			planBackfill(input({ accepted: [RUNS_BEFORE, ACTIVITY_DETAILS_KEY], activityDetails: "all", activities, detailFiles })),
			[{ kind: "details", ids: [4, 3, 2, 1] }],
		);
		assert.deepEqual(planBackfill(input({ accepted: [RUNS_NOW], activityDetails: "opened", activities, detailFiles })), []);
	});

	it("leaves out what failed this session", () => {
		const activities = [{ id: 2, date: "2026-10-01", run: true }];
		const plan = planBackfill(
			input({ accepted: ["days@1", ACTIVITY_DETAILS_KEY], activityDetails: "all", activities, dayDetails: "30d", skip: { days: new Set([TODAY]), details: new Set([2]) } }),
		);
		assert.deepEqual(plan, [{ kind: "days", from: shiftDate(TODAY, -29), to: shiftDate(TODAY, -1) }]);
	});

	it("takes a chunk off the newest end of a stretch", () => {
		assert.deepEqual(nextChunk({ from: "2026-10-01", to: "2026-10-14" }, 13), { from: "2026-10-02", to: "2026-10-14" });
		assert.deepEqual(nextChunk({ from: "2026-10-10", to: "2026-10-14" }, 13), { from: "2026-10-10", to: "2026-10-14" });
	});
});

describe("backfill.json", () => {
	const now = Date.parse("2026-10-14T06:00:00Z");

	it("round-trips, and reads anything else as nothing", () => {
		const state = { paused: { reason: "rate-limit" as const, until: "2026-10-14T06:05:00.000Z" }, lease: { device: "mac", label: "Mac", heartbeat: "2026-10-14T05:59:00.000Z" } };
		assert.deepEqual(parseBackfill(serializeBackfill(state)), state);
		assert.deepEqual(parseBackfill("nope"), {});
		assert.deepEqual(parseBackfill(JSON.stringify({ version: 1, paused: { reason: "bored" } })), {});
	});

	it("leaves the backfill to another device while its lease is fresh, and takes over a stale one", () => {
		const lease = (minutesAgo: number) => ({ lease: { device: "phone", label: "iPhone", heartbeat: new Date(now - minutesAgo * 60_000).toISOString() } });
		assert.equal(heldElsewhere(lease(2), "mac", now)?.label, "iPhone");
		assert.equal(heldElsewhere(lease(LEASE_MS / 60_000 + 1), "mac", now), null);
		assert.equal(heldElsewhere(lease(2), "phone", now), null);
		assert.equal(heldElsewhere({}, "mac", now), null);
	});

	it("holds a pause until it is lifted or its time is up", () => {
		assert.equal(stillPaused({ paused: { reason: "user" } }, now), true);
		assert.equal(stillPaused({ paused: { reason: "rate-limit", until: "2026-10-14T06:05:00.000Z" } }, now), true);
		assert.equal(stillPaused({ paused: { reason: "rate-limit", until: "2026-10-14T05:55:00.000Z" } }, now), false);
		assert.equal(stillPaused({}, now), false);
	});

	it("waits longer after each 429 in a row, up to an hour", () => {
		assert.deepEqual([1, 2, 3, 4, 5, 9].map((n) => rateLimitWait(n) / 60_000), [5, 10, 20, 40, 60, 60]);
	});
});

describe("hourly budget", () => {
	it("lets a unit go while the hour has room, and says how long until it has", () => {
		const budget = new RequestBudget(() => 100);
		const t0 = Date.parse("2026-10-14T06:00:00Z");
		budget.add(60, t0);
		budget.add(30, t0 + 600_000);
		assert.equal(budget.used(t0 + 700_000), 90);
		assert.equal(budget.waitFor(10, t0 + 700_000), 0);
		// 20 more needs the first unit's 60 to drop out of the hour.
		assert.equal(budget.waitFor(20, t0 + 700_000), 3_600_000 - 700_000);
		assert.equal(budget.used(t0 + 3_600_001), 30);
	});
});
