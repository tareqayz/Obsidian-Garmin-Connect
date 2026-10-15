import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { shiftDate } from "../src/sync/day-index";
import { chunkDays, estimate, formatBytes, formatDuration, requestsPerChunk, requestsPerDay, withBudget, type EstimateInput } from "../src/sync/estimate";
import { ALL_GROUPS } from "../src/sync/metrics";
import type { AccountScan } from "../src/sync/scan";

const TODAY = "2026-10-14";

/** An account with data every day for `days` days up to today, weeks ending today. */
function account(days: number, activities = 0): AccountScan {
	const first = shiftDate(TODAY, -(days - 1));
	const weeks: Array<[string, number]> = [];
	for (let end = TODAY; end >= first; end = shiftDate(end, -7)) {
		const week = shiftDate(end, -6);
		weeks.unshift([week, week >= first ? 7 : Math.round((Date.parse(end) - Date.parse(first)) / 86_400_000) + 1]);
	}
	return { scannedAt: "2026-10-14T06:00:00.000Z", firstDay: first, days, weeks, activities, complete: true };
}

const input = (over: Partial<EstimateInput> = {}): EstimateInput => ({
	today: TODAY,
	groups: ALL_GROUPS,
	speed: "normal",
	scan: account(4000),
	dayDetails: "new",
	activityDetails: "opened",
	activities: [],
	...over,
});

const set = (got: ReturnType<typeof estimate>, id: string) => got.sets.find((s) => s.id === id)!;

describe("estimates — the request arithmetic", () => {
	it("counts a day's requests and a chunk's from the groups on", () => {
		assert.equal(requestsPerDay(ALL_GROUPS), 15);
		assert.equal(requestsPerDay(["activity"]), 1);
		assert.equal(requestsPerDay(["activity", "heart", "stress", "respiration", "spo2"]), 1);
		assert.equal(requestsPerDay(["intraday"]), 6);
		assert.equal(requestsPerChunk(ALL_GROUPS), 6);
		assert.equal(requestsPerChunk(["activity"]), 0);
	});

	it("sizes a chunk to about ten seconds at the speed", () => {
		assert.deepEqual([chunkDays(ALL_GROUPS, "gentle"), chunkDays(ALL_GROUPS, "normal"), chunkDays(ALL_GROUPS, "fast")], [5, 13, 21]);
	});

	it("holds a long backfill to the hourly budget", () => {
		assert.equal(withBudget(9_000, 600, "normal"), 600);
		// 25,000 at Normal: two full hours, then the last 5,000 at the pace.
		assert.equal(withBudget(25_000, 1_250, "normal"), 2 * 3600 + 250);
		assert.equal(withBudget(25_000, 1_250, "fast"), 3600 + 500);
	});
});

describe("estimates — Day details", () => {
	it("90 days: 1,392 requests, 3.93 MB, about a minute", () => {
		const day = set(estimate(input({ dayDetails: "90d" })), "day-details");
		assert.deepEqual([day.units, day.requests, day.bytes], [90, 1_392, 3_933_000]);
		assert.ok(Math.abs(day.seconds - 69.6) < 0.05, String(day.seconds));
		assert.equal(day.bytesPerYear, 15_950_500);
	});

	it("a year: 5,649 requests, 15.95 MB", () => {
		const day = set(estimate(input({ dayDetails: "1y" })), "day-details");
		assert.deepEqual([day.units, day.requests, day.bytes], [365, 5_649, 15_950_500]);
	});

	it("ten years: 56,436 requests, held by the budget to about five hours", () => {
		const day = set(estimate(input({ scan: account(3_650), dayDetails: "all" })), "day-details");
		assert.deepEqual([day.units, day.requests], [3_650, 56_436]);
		assert.equal(formatDuration(day.seconds), "about 5 hours");
	});

	it("counts only days with data, and not the days already held at today's version", () => {
		// The history starts 60 days ago: a 90-day range has 60 days to fetch.
		assert.equal(set(estimate(input({ scan: account(60), dayDetails: "90d" })), "day-details").units, 60);
		const held = { daySpans: [[shiftDate(TODAY, -29), TODAY, 1] as const, [shiftDate(TODAY, -59), shiftDate(TODAY, -30), 0] as const] };
		// Thirty held now; the thirty held at an older version still count.
		assert.equal(set(estimate(input({ dayDetails: "90d", held })), "day-details").units, 60);
		assert.equal(set(estimate(input({ dayDetails: "new" })), "day-details").units, 0);
	});

	it("without intraday a day is its file alone, a request a day for the summary groups", () => {
		const day = set(estimate(input({ groups: ["activity"], dayDetails: "90d" })), "day-details");
		assert.deepEqual([day.requests, day.bytes, day.bytesPerYear], [90, 333_000, 1_350_500]);
	});
});

describe("estimates — Activity details and Charts", () => {
	const activities = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, date: shiftDate(TODAY, -i * 3), run: i % 2 === 0 }));

	it("120 activities: 1,200 requests, 18.5 MB, about six minutes", () => {
		const run = set(estimate(input({ activities: activities.slice(0, 120), activityDetails: "all" })), "activity-details");
		assert.deepEqual([run.units, run.requests, run.bytes], [120, 1_200, 18_480_000]);
		assert.ok(Math.abs(run.seconds - 342) < 0.01);
	});

	it("takes the range's activities without a file of today's version, and nothing for those opened", () => {
		const held = { details: new Map([[1, 5], [2, 1]]) };
		// The last 90 days hold activities 1..30; 1 is current, 2's file is old.
		assert.equal(set(estimate(input({ activities, activityDetails: "90d", held })), "activity-details").units, 29);
		const opened = set(estimate(input({ activities, activityDetails: "opened" })), "activity-details");
		assert.deepEqual([opened.units, opened.bytesPerYear], [0, 0]);
		// Downloading new activities grows the vault by the activities of a year, every sport.
		assert.equal(set(estimate(input({ activities, activityDetails: "all" })), "activity-details").bytesPerYear, 122 * 154_000);
	});

	it("walks every chart index over the history it lacks, and nothing over one already complete", () => {
		const charts = set(estimate(input({ scan: account(365, 300) })), "charts");
		assert.ok(charts.requests > 100 && charts.requests < 200, String(charts.requests));
		assert.ok(charts.bytes > 800_000 && charts.bytes < 1_100_000, String(charts.bytes));
		// Critical Swim Speed is the workouts group's index.
		const all = new Map<string, { complete: boolean }>(["activities", "daily-stats", "sleep", "index:critical-swim-speed"].map((store) => [store, { complete: true }]));
		const done = set(estimate(input({ scan: account(365, 300), groups: ["activity", "sleep", "workouts"], held: { charts: all } })), "charts");
		assert.deepEqual([done.requests, done.bytes], [0, 0]);
	});

	it("adds the sets up, the budget over the whole backfill", () => {
		const got = estimate(input({ scan: account(3_650, 2_000), activities, dayDetails: "all", activityDetails: "all" }));
		assert.equal(got.requests, got.sets.reduce((n, s) => n + s.requests, 0));
		assert.ok(got.seconds >= Math.max(...got.sets.map((s) => s.seconds)));
		assert.equal(got.largestFile, 365 * 3_700);
	});
});

describe("estimates — how they read", () => {
	it("writes sizes and times as the setup shows them", () => {
		assert.deepEqual([0, 600, 3_933_000, 15_950_500, 2_500_000_000].map(formatBytes), ["0 KB", "< 1 KB", "3.9 MB", "16 MB", "2.5 GB"]);
		assert.deepEqual([20, 70, 1_000, 3_700, 9_000, 50_000].map(formatDuration), ["under a minute", "about 1 minute", "about 17 minutes", "about 1 hour", "about 2.5 hours", "about 14 hours"]);
	});
});
