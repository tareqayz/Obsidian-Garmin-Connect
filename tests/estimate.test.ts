import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ACTIVITY_DETAILS_KEY, chartKeys, DAY_DETAILS_KEY } from "../src/sync/datasets";
import { shiftDate } from "../src/sync/day-index";
import { estimate, estimateDelta, estimateRange, formatBytes, formatDuration, type EstimateInput } from "../src/sync/estimate";
import { ALL_GROUPS } from "../src/sync/metrics";
import { MEASURED, TEN_YEARS } from "./support/account-fixture";

const NOW = Date.parse("2026-10-21T08:00:00Z");
const EVERYTHING = [...chartKeys(ALL_GROUPS), DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY];

/** A fresh setup of an account like `account`, downloading all of it. */
const input = (account: typeof MEASURED, over: Partial<EstimateInput> = {}): EstimateInput => ({
	today: account.today,
	groups: ALL_GROUPS,
	accepted: EVERYTHING,
	dayDetails: "all",
	activityDetails: "all",
	since: account.today,
	scan: account.scan,
	daySpans: [],
	charts: new Map(),
	activities: account.activities,
	detailFiles: new Map(),
	now: NOW,
	...over,
});

const set = (got: ReturnType<typeof estimate>, id: string) => got.sets.find((s) => s.id === id)!;

describe("estimates — the measured vault, from scratch", () => {
	const got = estimate(input(MEASURED));

	it("asks what the download asks: the charts, 445 days, 344 activities", () => {
		// The list (5) and every walk; the days through yesterday, 15 each — 11 past the timelines' horizon,
		// where Garmin keeps no stress, heart rate, floors or intensity — and 6 a chunk (36: the chunks are
		// cut where the last 90 days and the year before meet); each activity by its sport.
		assert.deepEqual([set(got, "charts").requests, set(got, "day-details").units, set(got, "day-details").requests], [248, 445, 140 * 15 + 305 * 11 + 36 * 6]);
		assert.deepEqual([set(got, "activity-details").units, set(got, "activity-details").requests], [344, 3_498]);
	});

	it("comes to what that vault holds: 55.1 MB against 55.3 MB on disk", () => {
		// Days: 140 recent ones with every timeline, 300 older without them, and the five empty ones.
		assert.equal(set(got, "day-details").bytes, 140 * (4_780 + 52_100) + 300 * (4_780 + 9_300) + 5 * 1_560);
		assert.equal(set(got, "activity-details").bytes, 41_804_800);
		assert.equal(set(got, "charts").bytes, 441 * 2_382);
		assert.equal(formatBytes(got.bytes), "55 MB");
	});

	it("takes about an hour: one hour's 8,000 requests, then the few minutes the rest take", () => {
		assert.equal(got.requests, 9_417);
		assert.equal(formatDuration(got.seconds), "about 1 hour");
		assert.ok(got.seconds > 3_600 && got.seconds < 3_600 + 15 * 60, String(got.seconds));
	});
});

describe("estimates — ten years and 3,000 activities", () => {
	it("holds the download to the budget across every set, not set by set", () => {
		const got = estimate(input(TEN_YEARS));
		assert.equal(set(got, "day-details").units, 3_649);
		assert.equal(set(got, "activity-details").requests, 30_506);
		assert.equal(got.requests, got.sets.reduce((n, s) => n + s.requests, 0));
		// Each set alone fits more of itself into its first hour than the whole download does.
		assert.ok(got.seconds > Math.max(...got.sets.map((s) => s.seconds)));
		assert.equal(formatDuration(got.seconds), formatDuration((Math.ceil(got.requests / 8_000) - 1) * 3_600 + 600));
	});
});

describe("estimates — choices and what the vault holds", () => {
	it("counts only what is chosen", () => {
		const none = estimate(input(MEASURED, { dayDetails: "new", activityDetails: "opened" }));
		assert.deepEqual([set(none, "day-details").units, set(none, "activity-details").units], [0, 0]);
		const recent = estimate(input(MEASURED, { dayDetails: "90d", activityDetails: "90d" }));
		// The last 90 days end yesterday: 89 of them.
		assert.equal(set(recent, "day-details").units, 89);
		assert.ok(set(recent, "activity-details").units > 50 && set(recent, "activity-details").units < 80);
	});

	it("leaves out what the vault holds at today's version, and counts what an older one saved", () => {
		const yesterday = shiftDate(MEASURED.today, -1);
		const daySpans = [[shiftDate(MEASURED.today, -30), yesterday, 1] as const, [shiftDate(MEASURED.today, -60), shiftDate(MEASURED.today, -31), 0] as const];
		assert.equal(set(estimate(input(MEASURED, { dayDetails: "90d", daySpans })), "day-details").units, 89 - 30);
		const held = new Map(MEASURED.activities.slice(0, 100).map((a) => [a.id, 6]));
		assert.equal(set(estimate(input(MEASURED, { detailFiles: held })), "activity-details").units, 244);
	});

	it("plans no activity pages with Workouts off", () => {
		const got = estimate(input(MEASURED, { groups: ALL_GROUPS.filter((g) => g !== "workouts") }));
		assert.equal(set(got, "activity-details").units, 0);
	});

	it("prices an update's line by what it adds, and its lines together as one download", () => {
		const base = input(MEASURED, { accepted: [...chartKeys(ALL_GROUPS), DAY_DETAILS_KEY] });
		const details = estimateDelta(base, [ACTIVITY_DETAILS_KEY]);
		assert.deepEqual([details.requests, details.bytes], [3_498, 41_804_800]);
		// Agreed already: nothing to add.
		assert.equal(estimateDelta(base, [DAY_DETAILS_KEY]).requests, 0);
		const both = estimateDelta(input(MEASURED, { accepted: [] }), [DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY]);
		assert.equal(both.requests, 140 * 15 + 305 * 11 + 36 * 6 + 3_498);
	});
});

describe("estimates — how they read", () => {
	it("writes sizes and times as the setup shows them", () => {
		assert.deepEqual([0, 600, 3_933_000, 15_950_500, 2_500_000_000].map(formatBytes), ["0 KB", "< 1 KB", "3.9 MB", "16 MB", "2.5 GB"]);
		assert.deepEqual([20, 70, 1_000, 3_700, 9_000, 50_000].map(formatDuration), ["under a minute", "about 1 minute", "about 17 minutes", "about 1 hour", "about 2.5 hours", "about 14 hours"]);
	});
});

describe("estimates — a date range", () => {
	const set = input(MEASURED);

	it("syncs a short range at once, every route and timeline asked", () => {
		const got = estimateRange(set, "2026-10-10", MEASURED.today, { download: true });
		// Twelve days of 15 requests in one chunk, its activity page and its five range calls.
		assert.deepEqual([got.background, got.days, got.requests], [false, 12, 12 * 15 + 1 + 5]);
		assert.equal(got.bytes, 12 * (4_780 + 52_100));
		assert.equal(formatDuration(got.seconds), "under a minute");
	});

	it("sends a long range to the download, which leaves out the timelines Garmin no longer keeps", () => {
		const atOnce = estimateRange(set, "2025-10-21", "2026-10-20", { download: false });
		const later = estimateRange(set, "2025-10-21", "2026-10-20", { download: true });
		assert.deepEqual([atOnce.background, later.background], [false, true]);
		// 225 of its days are past the horizon: four timelines fewer each. Either way, the same days come back.
		assert.equal(atOnce.requests - later.requests, 225 * 4);
		assert.equal(later.bytes, atOnce.bytes);
	});

	it("runs until the range is done: after the walks and the ranges queued before it, held to the hour", () => {
		const alone = estimateRange(input(MEASURED, { accepted: [] }), "2025-10-21", "2026-10-20", { download: true });
		const afterWalks = estimateRange(set, "2025-10-21", "2026-10-20", { download: true });
		const queued = [{ from: "2025-01-01", to: "2025-06-30", next: "2025-06-30", at: "2026-10-21T07:00:00.000Z" }];
		const behind = estimateRange(input(MEASURED, { accepted: [], ranges: queued }), "2025-10-21", "2026-10-20", { download: true });
		assert.ok(afterWalks.seconds > alone.seconds && behind.seconds > alone.seconds, `${alone.seconds} ${afterWalks.seconds} ${behind.seconds}`);
		assert.deepEqual([behind.requests, behind.bytes], [alone.requests, alone.bytes]);
		// Ten years' worth is more than an hour's budget.
		assert.ok(estimateRange(input(TEN_YEARS), shiftDate(TEN_YEARS.today, -3_000), shiftDate(TEN_YEARS.today, -1), { download: true }).seconds > 3_600);
	});
});
