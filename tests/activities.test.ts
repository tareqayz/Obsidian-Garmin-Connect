import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	allActivities,
	axisTicks,
	categoryOf,
	categoryView,
	dateTimeLabel,
	formatMetric,
	glyphOf,
	monthView,
	periodFor,
	recordsView,
	subTypeOptions,
	summaryStats,
	type CategoryInput,
} from "../src/dashboard/activities";
import type { ActivityRow } from "../src/sync/activity-index";

const TODAY = "2026-10-03";

let nextId = 1;
/** A run at a local time; the GMT stamp only orders rows. */
function activity(start: string, over: Partial<ActivityRow> = {}): ActivityRow {
	return {
		id: nextId++,
		name: "Morning Run",
		type: "running",
		typeId: 1,
		parentTypeId: 17,
		start,
		begin: Date.parse(`${start}Z`),
		...over,
	};
}

const run = (start: string, km: number, seconds: number, over: Partial<ActivityRow> = {}) =>
	activity(start, { distance: km * 1000, duration: seconds, ...over });

const input = (rows: ActivityRow[], over: Partial<CategoryInput> = {}): CategoryInput => ({
	rows,
	category: "running",
	sub: null,
	range: "7d",
	offset: 0,
	metric: "distance",
	today: TODAY,
	units: "metric",
	...over,
});

describe("periodFor", () => {
	it("is the week, the four weeks or the twelve months ending now", () => {
		const week = periodFor("7d", 0, TODAY);
		assert.equal(week.label, "Sep 27 - Oct 3");
		assert.deepEqual([week.from, week.to], ["2026-09-27", "2026-10-03"]);
		assert.deepEqual([week.slots[0]!.label, week.slots[6]!.label], ["09-27", "10-03"]);

		assert.equal(periodFor("4w", 0, TODAY).label, "Sep 6 - Oct 3");
		assert.equal(periodFor("4w", 0, TODAY).slots.length, 28);

		const year = periodFor("1y", 0, TODAY);
		assert.equal(year.label, "Nov 2025 - Oct 2026");
		assert.deepEqual([year.from, year.to], ["2025-11-01", "2026-10-31"]);
		assert.deepEqual(year.slots.map((s) => s.label), ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
	});

	it("steps back one whole period at a time", () => {
		assert.equal(periodFor("7d", -1, TODAY).label, "Sep 20 - Sep 26");
		assert.equal(periodFor("4w", -1, TODAY).label, "Aug 9 - Sep 5");
		assert.equal(periodFor("1y", -1, TODAY).label, "Nov 2024 - Oct 2025");
	});

	it("names the year once a period is not this year's", () => {
		assert.equal(periodFor("7d", 0, "2026-01-02").label, "Dec 27 - Jan 2");
		assert.equal(periodFor("7d", -1, "2026-01-02").label, "Dec 20 - Dec 26, 2025");
		assert.equal(periodFor("4w", -1, "2026-01-20").label, "Nov 26 - Dec 23, 2025");
		assert.equal(periodFor("4w", -13, "2027-01-20").label, "Dec 25, 2025 - Jan 21, 2026");
		assert.equal(periodFor("1y", 0, "2026-01-15").label, "Feb 2025 - Jan 2026");
	});

	it("has no future", () => {
		assert.equal(periodFor("7d", 2, TODAY).label, "Sep 27 - Oct 3");
	});
});

describe("axisTicks", () => {
	it("takes five whole steps from zero, as the app's axes do", () => {
		assert.deepEqual(axisTicks(11.09), [0, 3, 6, 9, 12]);
		assert.deepEqual(axisTicks(214.06), [0, 54, 108, 162, 216]);
		assert.deepEqual(axisTicks(113), [0, 29, 58, 87, 116]);
		assert.deepEqual(axisTicks(0), [0, 1, 2, 3, 4]);
	});
});

describe("categoryView — the phone's numbers", () => {
	// The week the phone showed on 2026-10-03: two runs, a gap, a run today.
	const week = [
		run("2026-10-03T14:59:19", 8.00875, 2493.64),
		run("2026-09-28T08:03:00", 11.09, 3709),
		run("2026-09-27T16:05:00", 6.08, 1840),
		run("2026-09-20T07:00:00", 5, 1500),
		activity("2026-10-01T18:00:00", { type: "road_biking", typeId: 10, parentTypeId: 2, distance: 40000 }),
	];

	it("totals the week by day and averages it over seven", () => {
		const view = categoryView(input(week));
		assert.deepEqual(view.chart.values.map((v) => Math.round(v * 100) / 100), [6.08, 11.09, 0, 0, 0, 0, 8.01]);
		assert.deepEqual(view.chart.ticks, [0, 3, 6, 9, 12]);
		assert.deepEqual(view.stats, [
			{ value: "25.2 km", label: "Total Distance" },
			{ value: "3.6 km", label: "Avg Daily" },
		]);
		assert.equal(view.title, "All Running");
		assert.equal(view.listTitle, "Running Activities");
		assert.deepEqual(view.activities.map((a) => a.value), ["8 km", "11.1 km", "6.1 km"]);
		assert.equal(view.activities[0]!.when, "2026-10-03, 2:59 PM");
		assert.ok(view.canGoBack, "a run the week before");
	});

	it("shows the selected metric in the list", () => {
		const view = categoryView(input(week, { metric: "time" }));
		assert.deepEqual(view.activities.map((a) => a.value), ["41:34", "1:01:49", "30:40"]);
		// Minutes on a day's axis.
		assert.deepEqual(view.chart.ticks, [0, 16, 32, 48, 64]);
		assert.deepEqual(view.stats.map((s) => s.value), ["2:14:03", "19:09"]);
	});

	it("averages four weeks per day and per week, a year per week and per month", () => {
		assert.deepEqual(summaryStats(83_569, "4w", "distance", "metric").map((s) => s.value), ["83.6 km", "3 km", "20.9 km"]);
		assert.deepEqual(summaryStats(1_168_940, "1y", "distance", "metric"), [
			{ value: "1,168.9 km", label: "Total Distance" },
			{ value: "22.5 km", label: "Avg Weekly" },
			{ value: "97.4 km", label: "Avg Monthly" },
		]);
	});

	it("sums raw metres, so rounding each run first cannot drift the total", () => {
		// 100 runs of 11.6894 km: 1,168.94 km raw, 1,169 km from rows rounded to 0.01.
		const rows = Array.from({ length: 100 }, (_, i) => run(`2026-0${1 + (i % 9)}-1${i % 10}T07:00:00`, 11.6894, 3600));
		const view = categoryView(input(rows, { range: "1y" }));
		assert.equal(view.stats[0]!.value, "1,168.9 km");
	});

	it("lists a year by month, only the months with activities, newest first", () => {
		const view = categoryView(input([...week, run("2026-07-04T06:00:00", 10, 3000), run("2025-10-31T06:00:00", 3, 900)], { range: "1y" }));
		assert.deepEqual(view.activities, []);
		assert.deepEqual(view.months, [
			{ month: "2026-10", title: "October 2026", count: "1 activity", value: "8 km" },
			{ month: "2026-09", title: "September 2026", count: "3 activities", value: "22.2 km" },
			{ month: "2026-07", title: "July 2026", count: "1 activity", value: "10 km" },
		]);
		// Hours on a month's axis.
		assert.equal(categoryView(input(week, { range: "1y", metric: "time" })).chart.values[11], 2493.64 / 3600);
	});

	it("narrows to one sub-type", () => {
		const rows = [...week, run("2026-10-02T21:06:00", 5.44, 1566, { type: "treadmill_running", typeId: 18, parentTypeId: 1 })];
		const view = categoryView(input(rows, { sub: 18 }));
		assert.equal(view.title, "Treadmill Running");
		assert.equal(view.listTitle, "Treadmill Running Activities");
		assert.deepEqual(view.stats[0], { value: "5.4 km", label: "Total Distance" });
	});

	it("falls back to the category's first tab and says when nothing is older", () => {
		const view = categoryView(input([activity("2026-10-01T06:00:00", { type: "yoga", typeId: 163, parentTypeId: 29, duration: 1800 })], { category: "gym" }));
		assert.equal(view.metric, "time");
		assert.equal(view.canGoBack, false);
		assert.deepEqual(view.stats.map((s) => s.value), ["30:00", "4:17"]);
	});

	it("reads an empty period as zeroes", () => {
		const view = categoryView(input([], { category: "gym", metric: "time" }));
		assert.deepEqual(view.stats.map((s) => s.value), ["0:00", "0:00"]);
		assert.deepEqual(view.chart.ticks, [0, 1, 2, 3, 4]);
		assert.deepEqual(view.activities, []);
	});
});

describe("formatMetric", () => {
	it("writes each metric the way the app does", () => {
		assert.equal(formatMetric(2493.64, "time", "metric"), "41:34");
		assert.equal(formatMetric(3709, "time", "metric"), "1:01:49");
		assert.equal(formatMetric(201.6, "ascent", "metric"), "202 m");
		assert.equal(formatMetric(1715.2, "calories", "metric"), "1,715 kcal");
		assert.equal(formatMetric(8008.75, "distance", "imperial"), "5 mi");
		assert.equal(formatMetric(100, "ascent", "imperial"), "328 ft");
	});

	it("dates an activity with a 12-hour clock", () => {
		assert.equal(dateTimeLabel("2026-10-03T14:59:19"), "2026-10-03, 2:59 PM");
		assert.equal(dateTimeLabel("2026-09-28T08:03:00"), "2026-09-28, 8:03 AM");
		assert.equal(dateTimeLabel("2026-09-28T00:05:00"), "2026-09-28, 12:05 AM");
		assert.equal(dateTimeLabel("2026-09-28T12:30:00"), "2026-09-28, 12:30 PM");
	});
});

describe("categories", () => {
	it("follows Garmin's tree, one level up", () => {
		assert.equal(categoryOf({ type: "treadmill_running", typeId: 18, parentTypeId: 1 }), "running");
		assert.equal(categoryOf({ type: "yoga", typeId: 163, parentTypeId: 29 }), "gym");
		assert.equal(categoryOf({ type: "stair_climbing", typeId: 31, parentTypeId: 29 }), "gym");
		assert.equal(categoryOf({ type: "open_water_swimming", typeId: 28, parentTypeId: 26 }), "swimming");
		assert.equal(categoryOf({ type: "rucking", typeId: 257, parentTypeId: 3 }), "hiking");
		assert.equal(categoryOf({ type: "multi_sport", typeId: 89, parentTypeId: 17 }), "multisport");
		assert.equal(categoryOf({ type: "meditation", typeId: 202, parentTypeId: 4 }), "other");
		assert.equal(categoryOf({ type: "walking", typeId: 9, parentTypeId: 17 }), "other");
		assert.equal(categoryOf({ type: "trail_running" }), "running", "a row without ids goes by its key");
	});

	it("offers the sub-types the account has, most used first", () => {
		const rows = [
			run("2026-09-01T07:00:00", 5, 1500),
			run("2026-09-02T07:00:00", 5, 1500),
			run("2026-09-03T07:00:00", 5, 1500, { type: "track_running", typeId: 8, parentTypeId: 1 }),
			run("2026-09-04T07:00:00", 5, 1500, { type: "trail_running", typeId: 6, parentTypeId: 1 }),
			run("2026-09-05T07:00:00", 5, 1500, { type: "treadmill_running", typeId: 18, parentTypeId: 1 }),
			run("2026-09-06T07:00:00", 5, 1500, { type: "treadmill_running", typeId: 18, parentTypeId: 1 }),
		];
		assert.deepEqual(subTypeOptions(rows, "running").map((o) => o.label), ["All Running", "Treadmill Running", "Trail Running", "Track Running"]);
		assert.deepEqual(subTypeOptions([], "gym").map((o) => o.label), ["All Gym & Fitness Equipment"]);
	});

	it("draws each activity with its sport's figure", () => {
		assert.equal(glyphOf({ type: "treadmill_running", typeId: 18, parentTypeId: 1 }), "treadmill");
		assert.equal(glyphOf({ type: "trail_running", typeId: 6, parentTypeId: 1 }), "run");
		assert.equal(glyphOf({ type: "lap_swimming", typeId: 27, parentTypeId: 26 }), "swimming");
		assert.equal(glyphOf({ type: "mobility", typeId: 255, parentTypeId: 29 }), "stretching");
		assert.equal(glyphOf({ type: "golf", typeId: 88, parentTypeId: 4 }), "activity");
	});
});

describe("monthView", () => {
	it("lists the month's activities under a count and a total", () => {
		const rows = [run("2026-09-28T08:03:00", 11.09, 3709), run("2026-09-12T19:00:00", 3.8, 1300), run("2026-10-01T07:00:00", 5, 1500)];
		const view = monthView({ rows, category: "running", sub: null, month: "2026-09", metric: "distance", units: "metric" });
		assert.equal(view.title, "September 2026");
		assert.equal(view.summary, "2 Running Activities · 14.9 km");
		assert.deepEqual(view.activities.map((a) => a.when), ["2026-09-28, 8:03 AM", "2026-09-12, 7:00 PM"]);
	});
});

describe("allActivities", () => {
	it("lists everything newest first, with the time and a two-decimal distance", () => {
		const rows = [
			run("2026-09-14T23:50:00", 1.1, 1900, { name: "Pool Swim", type: "lap_swimming", typeId: 27, parentTypeId: 26 }),
			run("2026-10-03T14:59:19", 8.00875, 2493.64),
			activity("2026-09-30T06:10:00", { name: "Yoga", type: "yoga", typeId: 163, parentTypeId: 29, duration: 1800 }),
		];
		assert.deepEqual(allActivities(rows, "metric"), [
			{ id: rows[1]!.id, name: "Morning Run", when: "2026-10-03, 2:59 PM", glyph: "run", time: "41:34", distance: "8.01 km" },
			{ id: rows[2]!.id, name: "Yoga", when: "2026-09-30, 6:10 AM", glyph: "yoga", time: "30:00" },
			{ id: rows[0]!.id, name: "Pool Swim", when: "2026-09-14, 11:50 PM", glyph: "swimming", time: "31:40", distance: "1.10 km" },
		]);
	});
});

describe("recordsView", () => {
	const records = [
		{ type: "run_1k", typeId: 1, value: 162.502, date: "2026-03-09" },
		{ type: "run_1mile", typeId: 2, value: 324.862, date: "2026-03-09" },
		{ type: "run_5k", typeId: 3, value: 1108.811, date: "2025-10-08" },
		{ type: "run_10k", typeId: 4, value: 2624.221, date: "2025-09-12" },
		// Written before type ids were kept: found by name.
		{ type: "run_half_marathon", value: 6333.795, date: "2025-08-17" },
		{ type: "run_farthest", typeId: 7, value: 32559.32, date: "2025-09-16" },
		{ type: "steps_best_day", typeId: 12, value: 44502, date: "2025-09-16" },
		{ type: "steps_longest_streak", typeId: 15, value: 6, date: "2025-08-20" },
		{ type: "ride_max_elevation", typeId: 9, value: 1165.8, date: "2025-09-13" },
		{ type: "ride_max_power", typeId: 10, value: 211, date: "2025-10-20" },
		{ type: "swim_longest_pool", typeId: 17, value: 1925, date: "2025-12-11" },
	];

	it("fills the tab's slots, rounding times to the second", () => {
		assert.deepEqual(recordsView(records, "running", "metric"), [
			{ typeId: 1, title: "1 km", value: "2:43", date: "2026-03-09" },
			{ typeId: 2, title: "1 mi", value: "5:25", date: "2026-03-09" },
			{ typeId: 3, title: "5K", value: "18:29", date: "2025-10-08" },
			{ typeId: 4, title: "10K", value: "43:44", date: "2025-09-12" },
			{ typeId: 5, title: "Half Marathon", value: "1:45:34", date: "2025-08-17" },
			{ typeId: 6, title: "Marathon" },
			{ typeId: 7, title: "Longest Run", value: "32.56 km", date: "2025-09-16" },
		]);
	});

	it("writes steps, streaks, climbs, power and swims in their own units", () => {
		const steps = recordsView(records, "steps", "metric");
		assert.equal(steps[0]!.value, "44,502");
		assert.equal(steps[3]!.value, "6 days");
		const cycling = recordsView(records, "cycling", "metric");
		assert.deepEqual(cycling.map((r) => r.value), [undefined, "1,166 m", "211 W", undefined]);
		assert.equal(recordsView(records, "swimming", "metric")[0]!.value, "1,925 m");
		assert.equal(recordsView(records, "strength", "metric").length, 12);
	});
});
