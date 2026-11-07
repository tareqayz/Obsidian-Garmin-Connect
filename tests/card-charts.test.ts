import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { activityCard, pickActivities } from "../src/embeds/activity-cards";
import { buildChart, routeOf, spanEnding, trendOf, type ChartInputs } from "../src/embeds/chart-models";
import { chartByName } from "../src/embeds/charts";
import { trendNoticeFor } from "../src/embeds/status";
import type { ActivityRow } from "../src/sync/activity-index";
import type { DayRow as IndexRow } from "../src/sync/day-index";
import { heartDayOfSeries } from "../src/sync/heart-rate-index";
import type { DaySeries } from "../src/sync/intraday";
import { stressDayOfSeries, type StressRow } from "../src/sync/stress-index";

const TODAY = "2026-10-30";
const MIN = 60_000;
/** Midnight of Oct 28 on the watch's clock. */
const START = Date.parse("2026-10-28T00:00:00Z");

/** What the vault holds, for `buildChart`: index rows by kind and series files by day. */
function inputs(indexes: Record<string, IndexRow[]>, series: Record<string, DaySeries> = {}): ChartInputs {
	return {
		index: async <R extends IndexRow>(kind: string) => ({ rows: (indexes[kind] ?? []) as R[], meta: null }),
		series: async (date) => series[date] ?? null,
		days: async () => [],
		activities: async () => ({ rows: [], meta: null }),
	};
}

describe("chart cards: a day's readings from the points the sync keeps", () => {
	const series: DaySeries = {
		dayStart: START,
		stress: [
			[START, 20],
			[START + 3 * MIN, null],
			[START + 6 * MIN, 60],
		],
		bodyBattery: [
			[START, 40],
			[START + 3 * MIN, 41],
		],
		heartRate: [
			[START, 52],
			[START + 2 * MIN, null],
			[START + 4 * MIN, 58],
		],
	};

	it("lays stress and Body Battery on the three-minute steps, to the next midnight on a past day", () => {
		const day = stressDayOfSeries(series, false)!;
		assert.deepEqual([day.start, day.step, day.end - day.start], [START, 3 * MIN, 24 * 3_600_000]);
		assert.deepEqual(day.levels, [20, null, 60]);
		assert.deepEqual(day.battery, [40, 41]);
		// A day still going ends at its newest reading.
		assert.equal(stressDayOfSeries(series, true)!.end, START + 9 * MIN);
	});

	it("lays heart rate on the two-minute steps", () => {
		const day = heartDayOfSeries(series, false)!;
		assert.deepEqual([day.start, day.step, day.values], [START, 2 * MIN, [52, null, 58]]);
	});

	it("has nothing without the day's start or a reading", () => {
		assert.equal(stressDayOfSeries({ stress: series.stress }, false), null);
		assert.equal(heartDayOfSeries({ dayStart: START }, false), null);
		assert.equal(stressDayOfSeries(null, false), null);
	});
});

describe("chart cards: a trend's days", () => {
	const rows = [
		{ date: "2026-10-22", level: 20 },
		{ date: "2026-10-25", level: 40 },
		{ date: "2026-10-28", level: 30 },
		{ date: "2026-10-29", level: 90 },
	];

	it("takes a value a day on 7d, ending on the block's day", () => {
		assert.deepEqual(spanEnding("7d", "2026-10-28"), { from: "2026-10-22", to: "2026-10-28" });
		assert.deepEqual(trendOf(rows, (r) => r.level, "7d", "2026-10-28"), [20, null, null, 40, null, null, 30]);
	});

	it("takes 52 weeks on 1y, each week's mean or sum", () => {
		const year = trendOf(rows, (r) => r.level, "1y", "2026-10-28");
		assert.equal(year.length, 52);
		assert.deepEqual(year.slice(-1), [30]);
		assert.deepEqual(year.slice(-2, -1), [null]);
		const summed = trendOf([...rows, { date: "2026-10-27", level: 5 }], (r) => r.level, "1y", "2026-10-28", "sum");
		assert.deepEqual(summed.slice(-1), [20 + 40 + 5 + 30]);
	});
});

describe("chart cards: the page a chart opens", () => {
	it("opens the day's page on 1d, and the period holding the day on a trend", () => {
		assert.deepEqual(routeOf("stress", "1d", "2026-10-28", TODAY), { page: "health-stat", stat: "stress", range: "1d", offset: -2 });
		assert.deepEqual(routeOf("stress", "7d", "2026-10-28", TODAY), { page: "health-stat", stat: "stress", range: "7d", offset: 0 });
		assert.deepEqual(routeOf("stress", "7d", "2026-10-20", TODAY), { page: "health-stat", stat: "stress", range: "7d", offset: -1 });
		assert.deepEqual(routeOf("sleep", "4w", "2026-10-28", TODAY), { page: "sleep", range: "4w", offset: 0, tab: "score" });
		assert.deepEqual(routeOf("intensity-minutes", "1d", TODAY, TODAY), { page: "stats", stat: "intensity", range: "1d", offset: 0, totals: "monthly" });
		assert.equal(routeOf("hrv-status", "7d", "2026-10-28", TODAY).page, "performance-stat");
	});
});

describe("chart cards: building a chart from the vault", () => {
	const stress = chartByName("stress")!;
	const rows: StressRow[] = [
		{ date: "2026-10-26", level: 30 },
		{ date: "2026-10-27", level: 40 },
		{ date: "2026-10-28", level: 20 },
	];

	it("draws a trend from the index, its period and its figure, and a small card's line", async () => {
		const built = await buildChart(stress, "7d", "2026-10-28", TODAY, inputs({ stress: rows }));
		assert.equal(built.model?.chart, "stress-period");
		assert.equal(built.period, "Oct 22 - 28");
		assert.match(built.figures[0]!.label, /Avg/);
		assert.deepEqual(built.trend?.values, [null, null, null, null, 30, 40, 20]);
		assert.equal(built.trend?.value, "30");
	});

	it("says when a trend's period has nothing", async () => {
		const built = await buildChart(stress, "7d", "2026-09-28", TODAY, inputs({ stress: rows }));
		assert.equal(built.model, null);
		assert.equal(built.none, "Nothing recorded Sep 22 - 28.");
	});

	it("sends a day without its readings to its page, and says when Garmin had none", async () => {
		const missing = await buildChart(stress, "1d", "2026-10-28", TODAY, inputs({ stress: rows }, { "2026-10-28": {} }));
		assert.equal(missing.model, null);
		assert.equal(missing.none, "Open Stress to load this day’s readings.");
		assert.equal(missing.value, "20");
		const none = await buildChart(stress, "1d", "2026-10-28", TODAY, inputs({ stress: rows }, { "2026-10-28": { checked: ["stressDay"] } }));
		assert.equal(none.none, "No stress readings on Wed, Oct 28.");
	});

	it("draws a day from the points the sync keeps when its page never loaded it", async () => {
		const series: DaySeries = { dayStart: START, stress: [[START, 20], [START + 3 * MIN, 30]] };
		const built = await buildChart(stress, "1d", "2026-10-28", TODAY, inputs({ stress: rows }, { "2026-10-28": series }));
		assert.equal(built.model?.chart, "stress-day");
	});

	it("says a trend ending before the history, or on a day to come, instead of drawing it", () => {
		const facts = { setUp: true, first: "2026-10-01", last: "2026-10-29", hasRow: false };
		assert.equal(trendNoticeFor("2026-10-29", TODAY, facts), null);
		assert.equal(trendNoticeFor(TODAY, TODAY, facts), null);
		assert.match(trendNoticeFor("2026-09-01", TODAY, facts)!.text, /history starts/);
		assert.match(trendNoticeFor("2026-11-02", TODAY, facts)!.text, /hasn’t happened yet/);
	});
});

describe("activity cards", () => {
	const row = (id: number, start: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({ id, type: "running", start, begin: Date.parse(`${start}Z`), ...extra });
	const rows = [row(3, "2026-10-28T18:00:00", { name: "Evening Run" }), row(2, "2026-10-28T06:10:00"), row(1, "2026-10-27T07:00:00")];

	it("picks the day's latest, all of the day's newest first, or one by its id", () => {
		assert.deepEqual(pickActivities(rows, { kind: "latest" }, "2026-10-28").map((r) => r.id), [3]);
		assert.deepEqual(pickActivities(rows, { kind: "all" }, "2026-10-28").map((r) => r.id), [3, 2]);
		assert.deepEqual(pickActivities(rows, { kind: "id", id: 1 }, "2026-10-28").map((r) => r.id), [1]);
		assert.deepEqual(pickActivities(rows, { kind: "latest" }, "2026-10-26"), []);
	});

	it("words an activity from its index row until its page has loaded its details", () => {
		const card = activityCard(9, row(9, "2026-10-28T06:10:00", { name: "Morning Run", distance: 10_010, duration: 3_361, calories: 694 }), null, "metric", TODAY)!;
		assert.equal(card.title, "Morning Run");
		assert.equal(card.when, "Oct 28 @ 6:10 AM");
		assert.deepEqual(
			card.figures.map((f) => `${f.value} ${f.label}`),
			["10.01 km Distance", "56:01 Total Time", "5:36 /km Avg Pace", "694 Total Calories"],
		);
		assert.equal(card.detail, null);
		assert.equal(card.mapNote, "Open the activity to load its map.");
		assert.deepEqual(card.route, { page: "activity", id: 9, tab: "overview", axis: "time" });
	});

	it("promises no map for an activity that never has one", () => {
		assert.equal(activityCard(5, row(5, "2026-10-28T06:10:00", { type: "treadmill_running" }), null, "metric", TODAY)!.mapNote, undefined);
		assert.equal(activityCard(6, row(6, "2026-10-28T06:10:00", { type: "strength_training" }), null, "metric", TODAY)!.mapNote, undefined);
		assert.equal(activityCard(7, undefined, null, "metric", TODAY), null);
	});
});
