import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	dayLabel,
	dayStartOf,
	floorsTicks,
	intensityDayTicks,
	intensityTicks,
	kLabel,
	seriesDays,
	statsView,
	stepsTicks,
	weekLabel,
	weekStartOf,
	type StatsData,
	type StatsRoute,
} from "../src/dashboard/stats-pages";
import type { DailyStatsRow } from "../src/sync/daily-stats";
import type { DaySeries } from "../src/sync/intraday";

/** A Sunday, as on the day the app was measured. */
const TODAY = "2026-10-04";

function day(offset: number): string {
	return new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

function data(rows: DailyStatsRow[], over: Partial<StatsData> = {}): StatsData {
	return { rows: [...rows].sort((a, b) => a.date.localeCompare(b.date)), complete: true, units: "metric", weekStart: 1, calories: {}, ...over };
}

const route = (over: Partial<StatsRoute>): StatsRoute => ({ stat: "steps", range: "1d", offset: 0, totals: "monthly", ...over });

/** Local epoch ms for a clock time on a day, as series files store them. */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`).getTime();

describe("axes", () => {
	it("give steps four steps of a quarter of the top, rounded up to 500, then 1,000", () => {
		assert.deepEqual(stepsTicks(7270), [0, 2000, 4000, 6000, 8000]);
		assert.deepEqual(stepsTicks(17027), [0, 4500, 9000, 13500, 18000]);
		assert.deepEqual(stepsTicks(21196), [0, 5500, 11000, 16500, 22000]);
		assert.deepEqual(stepsTicks(353795), [0, 89000, 178000, 267000, 356000]);
		assert.deepEqual(stepsTicks(105062), [0, 27000, 54000, 81000, 108000]);
		assert.deepEqual([4500, 13500, 89000, 356000, 0].map(kLabel), ["4.5k", "13.5k", "89k", "356k", "0"]);
	});

	it("give floors two steps each side, rounded up to 5 then 50, the goal never on the edge", () => {
		assert.deepEqual(floorsTicks(66, 10), [-70, -35, 0, 35, 70]);
		assert.deepEqual(floorsTicks(293), [-300, -150, 0, 150, 300]);
		assert.deepEqual(floorsTicks(29, 10), [-30, -15, 0, 15, 30]);
		// One floor up, two down, a goal of ten: the app draws 20/10/0, not 10/5/0.
		assert.deepEqual(floorsTicks(10, 10), [-20, -10, 0, 10, 20]);
	});

	it("give intensity minutes three steps of fifty, never below the goal", () => {
		assert.deepEqual(intensityTicks(245, 150), [0, 100, 200, 300]);
		assert.deepEqual(intensityTicks(458, 150), [0, 200, 400, 600]);
		assert.deepEqual(intensityTicks(1269, 150), [0, 450, 900, 1350]);
		assert.deepEqual(intensityTicks(111, 150), [0, 50, 100, 150]);
	});

	it("fit a day's week-to-date line and the goal on fifty-minute lines", () => {
		assert.deepEqual(intensityDayTicks(245, 245, 150), [150, 200, 250]);
		assert.deepEqual(intensityDayTicks(142, 245, 150), [100, 150, 200, 250]);
		assert.deepEqual(intensityDayTicks(150, 150, 150), [150, 200]);
	});
});

describe("labels", () => {
	it("name a day as the app does", () => {
		assert.equal(dayLabel(TODAY, TODAY), "Today");
		assert.equal(dayLabel(day(-1), TODAY), "Yesterday");
		assert.equal(dayLabel("2026-10-01", TODAY), "Thu, Oct 1");
		assert.equal(dayLabel("2025-10-01", TODAY), "Wed, Oct 1, 2025");
	});

	it("name a week within a month and across two", () => {
		assert.equal(weekLabel("2026-09-21"), "Sep 21 - 27");
		assert.equal(weekLabel("2026-09-28"), "Sep 28 - Oct 4");
	});

	it("start weeks on the account's day", () => {
		assert.equal(weekStartOf("2026-10-04", 1), "2026-09-28");
		assert.equal(weekStartOf("2026-10-04", 0), "2026-10-04");
		assert.equal(weekStartOf("2026-09-30", 0), "2026-09-27");
	});
});

/* ------------------------------------------------------------------ */

const STEPS = [12001, 3000, 5000, 4000, 6000, 9000, 2000];
const GOALS = [9000, 9500, 9800, 8300, 7500, 6800, 7300];
const week: DailyStatsRow[] = STEPS.map((steps, i) => ({ date: day(i - 6), steps, stepGoal: GOALS[i]!, distance: steps * 0.8 }));

describe("Steps", () => {
	it("leave today out of a week's average, rounding down", () => {
		const view = statsView({ data: data(week), route: route({ range: "7d" }), today: TODAY });
		assert.equal(view.label, "Sep 28 - Oct 4");
		assert.deepEqual(
			view.stats.map((s) => [s.label, s.value]),
			[
				["Total Steps", "41,001"],
				["Total Distance", "32.8 km"],
				// (41,001 - 2,000) ÷ 6 = 6,500.17
				["Avg Daily", "6,500"],
			],
		);
		assert.deepEqual(view.chart.ticks, [0, 3500, 7000, 10500, 14000]);
		assert.equal(view.records, true);
	});

	it("draw a met goal as one green bar, a missed one as grey behind blue", () => {
		const view = statsView({ data: data(week), route: route({ range: "7d" }), today: TODAY });
		const first = view.chart.bars.filter((b) => b.x === 0);
		assert.deepEqual(first.map((b) => b.tone), ["green"]);
		const second = view.chart.bars.filter((b) => Math.abs(b.x - 1 / 6) < 1e-9);
		assert.deepEqual(second.map((b) => [b.tone, b.to]), [["goal", 9500], ["blue", 3000]]);
		assert.deepEqual(view.chart.xLabels.map((l) => l.text), ["9-28", "10-04"]);
	});

	it("list the week newest first, with each day's share of its goal", () => {
		const view = statsView({ data: data(week), route: route({ range: "7d" }), today: TODAY });
		assert.deepEqual(view.cards[0], {
			key: TODAY,
			title: "Sunday",
			detail: "October 4 • 27%",
			value: "2,000",
			ring: { fraction: 2000 / 7300, complete: false },
			day: TODAY,
		});
		assert.equal(view.cards[6]!.detail, "September 28 • 133%");
		assert.equal(view.cards[6]!.ring!.complete, true);
	});

	it("give four weeks an average week of the days before today", () => {
		const rows = Array.from({ length: 28 }, (_, i) => ({ date: day(i - 27), steps: 1000 + i, stepGoal: 5000 }));
		const view = statsView({ data: data(rows), route: route({ range: "4w" }), today: TODAY });
		assert.equal(view.label, "Sep 7 - Oct 4");
		const done = rows.slice(0, 27).reduce((s, r) => s + r.steps, 0);
		assert.deepEqual(
			view.stats.slice(2).map((s) => s.value),
			[Math.floor(done / 27).toLocaleString(), Math.floor(done / 4).toLocaleString()],
		);
	});

	it("show a day's ring, distance on foot, and calories from the note when the index has none", () => {
		const view = statsView({
			data: data([{ date: TODAY, steps: 1988, stepGoal: 7270, distance: 1529 }], { calories: { [TODAY]: 974 } }),
			route: route({}),
			today: TODAY,
		});
		assert.equal(view.label, "Today");
		assert.deepEqual(view.ring, { value: "1,988", goal: "7,270", fraction: 1988 / 7270, complete: false, caption: "27% of Goal" });
		assert.deepEqual(
			view.stats.map((s) => s.value),
			["1.5 km", "974"],
		);
		assert.deepEqual(view.chart.ticks, [0, 2000, 4000, 6000, 8000]);
	});

	it("climb a day's line through its 15-minute buckets and mark when the night ended", () => {
		const series: DaySeries = {
			steps: [
				{ start: at(TODAY, "08:15"), end: at(TODAY, "08:30"), steps: 179 },
				{ start: at(TODAY, "08:30"), end: at(TODAY, "08:45"), steps: 77 },
			],
			sleepLevels: [{ start: at(day(-1), "23:00"), end: at(TODAY, "07:56"), level: 1 }],
		};
		const view = statsView({
			data: data([{ date: TODAY, steps: 256, stepGoal: 7270 }]),
			route: route({}),
			today: TODAY,
			series: new Map([[TODAY, series]]),
		});
		const line = view.chart.lines[0]!;
		assert.deepEqual(line.points.at(-1), [8.75 / 24, 256]);
		assert.equal(line.area, true);
		const wake = view.chart.markers.find((m) => m.kind === "wake");
		assert.ok(wake && Math.abs(wake.x * 24 - (7 + 56 / 60)) < 1e-9);
	});

	it("give a year of months with an average over the days with data", () => {
		const rows: DailyStatsRow[] = [
			{ date: "2025-11-01", steps: 10000, distance: 8000 },
			{ date: "2026-10-01", steps: 4000, distance: 3000 },
			{ date: "2026-10-02", steps: 3000, distance: 2000 },
		];
		const view = statsView({ data: data(rows), route: route({ range: "1y" }), today: TODAY });
		assert.equal(view.label, "Nov 2025 - Oct 2026");
		assert.deepEqual(
			view.stats.map((s) => s.value),
			["17,000", "13 km", "5,666", "1,416"],
		);
		assert.deepEqual(view.rows[0], { key: "2026-10", label: "October", value: "7,000" });
		assert.equal(view.rows.length, 12);
		assert.ok(view.chart.bars.every((b) => b.tone === "green"));
		// Each month's bar stands at its first day: October is 334 of the year's 364 days in.
		assert.ok(Math.abs(view.chart.bars.at(-1)!.x - 334 / 364) < 1e-9);
	});

	it("give a year of weeks from the account's week start", () => {
		const view = statsView({ data: data(week), route: route({ range: "1y", totals: "weekly" }), today: TODAY });
		assert.equal(view.label, "Oct 6, 2025 - Oct 4, 2026");
		assert.equal(view.chart.bars.length, 52);
		assert.deepEqual(view.rows[0], { key: "2026-09-28", label: "Sep 28 - Oct 4", value: "41,001" });
		assert.equal(view.stats.at(-1)!.label, "Avg Weekly");
		assert.equal(view.chart.xLabels.length, 13);
	});

	it("go back a whole period, and only as far as there is data", () => {
		const view = statsView({ data: data(week), route: route({ range: "7d", offset: -1 }), today: TODAY });
		assert.equal(view.label, "Sep 21 - 27");
		assert.equal(view.canGoBack, false);
		assert.equal(statsView({ data: data(week), route: route({ range: "1d" }), today: TODAY }).canGoBack, true);
	});
});

describe("Floors", () => {
	const rows: DailyStatsRow[] = [
		{ date: day(-6), floorsUp: 57, floorsDown: 66, floorsGoal: 10 },
		{ date: day(-1), floorsUp: 32, floorsDown: 18, floorsGoal: 10 },
		{ date: TODAY, floorsUp: 1, floorsDown: 2, floorsGoal: 10 },
	];

	it("average a week to the nearest floor, today included", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "floors", range: "7d" }), today: TODAY });
		assert.deepEqual(
			view.stats.map((s) => [s.label, s.value]),
			[
				["Daily Avg Climbed", "13"],
				["Total Climbed", "90"],
				["Daily Avg Descended", "12"],
				["Total Descended", "86"],
			],
		);
		assert.deepEqual(view.chart.ticks, [-70, -35, 0, 35, 70]);
		assert.equal(view.chart.goal, 10);
		assert.deepEqual(view.chart.legend, ["climbed", "descended", "goal"]);
		assert.deepEqual(view.cards[0]!.value, "1↑");
	});

	it("draw descents below the line, faded", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "floors", range: "7d" }), today: TODAY });
		assert.deepEqual(
			view.chart.bars.filter((b) => b.x === 0).map((b) => [b.tone, b.to]),
			[
				["blue", 57],
				["faded", -66],
			],
		);
	});

	it("total a year by the week, with one-line week cards", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "floors", range: "1y" }), today: TODAY });
		assert.equal(view.chart.goal, undefined);
		assert.deepEqual(view.cards[0], { key: "2026-09-28", title: "Sep 28 - Oct 4", value: "90↑" });
		assert.equal(view.stats[0]!.label, "Weekly Avg Climbed");
	});

	it("count a day's floors from the summary but chart the buckets", () => {
		const series: DaySeries = {
			floors: [
				{ start: at(day(-1), "09:00"), end: at(day(-1), "09:15"), up: 20, down: 0 },
				{ start: at(day(-1), "18:00"), end: at(day(-1), "18:15"), up: 9, down: 16 },
			],
		};
		const view = statsView({ data: data(rows), route: route({ stat: "floors", offset: -1 }), today: TODAY, series: new Map([[day(-1), series]]) });
		assert.equal(view.label, "Yesterday");
		assert.deepEqual(view.ring?.complete, true);
		assert.deepEqual(view.stats.map((s) => s.value), ["32", "18"]);
		// The buckets add up to 29: the axis follows the line, not the day's total.
		assert.deepEqual(view.chart.ticks, [-30, -15, 0, 15, 30]);
		assert.deepEqual(view.chart.lines.map((l) => l.points.at(-1)), [[1, -16], [1, 29]]);
	});
});

describe("Intensity Minutes", () => {
	const rows: DailyStatsRow[] = [
		{ date: day(-6), moderate: 31, vigorous: 55, intensityGoal: 150 },
		{ date: day(-1), moderate: 0, vigorous: 52, intensityGoal: 150 },
		{ date: TODAY, moderate: 0, vigorous: 0, intensityGoal: 150 },
	];

	it("count vigorous twice and say when the week's goal is met", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "intensity", range: "7d" }), today: TODAY });
		assert.equal(view.label, "Sep 28 - Oct 4");
		assert.deepEqual(view.ring, { value: "245", goal: "150", fraction: 1, complete: true, caption: "163% of Goal" });
		assert.equal(view.message, "Nice! You reached your weekly goal.");
		assert.deepEqual(
			view.stats.map((s) => [s.label, s.value, s.badge ?? false]),
			[
				["Moderate", "31 min", false],
				["Vigorous", "107 min", true],
			],
		);
		assert.deepEqual(view.chart.ticks, [0, 100, 200, 300]);
		assert.deepEqual(view.chart.xLabels.map((l) => l.text), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
		// Without the days' series, each day's minutes go in at its start; Saturday crosses 150.
		assert.deepEqual(view.chart.markers, [{ kind: "goal", x: 5 / 7, value: 150 }]);
	});

	it("leave out the message and turn the ring blue on a week short of the goal", () => {
		const view = statsView({
			data: data([{ date: "2026-01-15", moderate: 0, vigorous: 34, intensityGoal: 150 }, { date: "2026-01-16", moderate: 3, vigorous: 20, intensityGoal: 150 }]),
			route: route({ stat: "intensity", range: "7d", offset: -37 }),
			today: TODAY,
		});
		assert.equal(view.label, "Jan 12 - 18");
		assert.equal(view.ring?.complete, false);
		assert.equal(view.ring?.caption, "74% of Goal");
		assert.equal(view.message, undefined);
		assert.deepEqual(view.chart.ticks, [0, 50, 100, 150]);
	});

	it("run four calendar weeks, each total restarting on its first day", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "intensity", range: "4w" }), today: TODAY });
		assert.equal(view.label, "Sep 7 - Oct 4");
		assert.equal(view.chart.lines.length, 4);
		assert.deepEqual(view.chart.xLabels.map((l) => l.text), ["09-07", "10-04"]);
		assert.deepEqual(view.stats.map((s) => s.value), ["1 min", "3 min", "8 min"]);
		assert.equal(view.cards.length, 28);
	});

	it("plot a day from the week's total before it", () => {
		const series: DaySeries = { intensity: [[at(day(-1), "15:00"), 1], [at(day(-1), "15:15"), 103]] };
		const view = statsView({
			data: data(rows),
			route: route({ stat: "intensity", offset: -1 }),
			today: TODAY,
			series: new Map([[day(-1), series]]),
		});
		const line = view.chart.lines[0]!.points;
		assert.deepEqual(line[0], [0, 141]);
		assert.deepEqual(line.at(-1), [1, 245]);
		assert.deepEqual(view.chart.ticks, [100, 150, 200, 250]);
		assert.equal(view.chart.markers.find((m) => m.kind === "goal")?.x, 15.25 / 24);
		assert.deepEqual(view.stats.map((s) => s.value), ["0 min", "52 min", "104 min"]);
	});

	it("give a year of weeks green at goal, grey behind blue below it", () => {
		const view = statsView({ data: data(rows), route: route({ stat: "intensity", range: "1y" }), today: TODAY });
		const last = view.chart.bars.filter((b) => Math.abs(b.x - 51 / 51.74) < 1e-9);
		assert.deepEqual(last.map((b) => b.tone), ["green"]);
		const empty = view.chart.bars.filter((b) => b.x === 0);
		assert.deepEqual(empty.map((b) => [b.tone, b.to]), [["goal", 150]]);
		assert.deepEqual(view.cards[0], {
			key: "2026-09-28",
			title: "Sep 28 - Oct 4",
			detail: "163% of Goal",
			value: "245",
			ring: { fraction: 1, complete: true },
		});
	});
});

describe("seriesDays", () => {
	it("asks for the day of a 1d page, and Intensity's week up to today", () => {
		assert.deepEqual(seriesDays(route({ offset: -2 }), TODAY, 1), ["2026-10-02"]);
		assert.deepEqual(seriesDays(route({ stat: "intensity", range: "7d" }), "2026-09-30", 1), ["2026-09-28", "2026-09-29", "2026-09-30"]);
		assert.deepEqual(seriesDays(route({ range: "4w" }), TODAY, 1), []);
	});
});

describe("dayStartOf", () => {
	const local = new Date(`${TODAY}T00:00:00`).getTime();
	it("takes the watch's midnight from the series, or this computer's", () => {
		assert.equal(dayStartOf(TODAY, { dayStart: local - 3_600_000 }), local - 3_600_000);
		// A step chart need not start at midnight: it says nothing about when the day did.
		assert.equal(dayStartOf(TODAY, { steps: [{ start: local + 8 * 3_600_000, end: local + 8.25 * 3_600_000, steps: 0 }] }), local);
		assert.equal(dayStartOf(TODAY, null), local);
	});

	it("ignores a start that is not this day's", () => {
		assert.equal(dayStartOf(TODAY, { dayStart: local - 30 * 3_600_000 }), local);
	});

	it("places a day's readings on the watch's clock", () => {
		// The watch's midnight an hour before this computer's: a bucket ending
		// at 09:15 on the watch is 08:15 here, and is drawn at 09:15.
		const start = local - 3_600_000;
		const view = statsView({
			data: data([{ date: TODAY, floorsUp: 2, floorsGoal: 10 }]),
			route: route({ stat: "floors" }),
			today: TODAY,
			series: new Map([
				[
					TODAY,
					{
						dayStart: start,
						steps: [{ start: start + 11.75 * 3_600_000, end: start + 12 * 3_600_000, steps: 40 }],
						floors: [{ start: start + 9 * 3_600_000, end: start + 9.25 * 3_600_000, up: 2, down: 0 }],
					},
				],
			]),
		});
		const up = view.chart.lines.find((l) => l.tone === "normal")!.points;
		assert.deepEqual(up[2], [9.25 / 24, 2]);
		// Today runs to the newest reading of any kind: the steps' at noon.
		assert.deepEqual(up.at(-1), [12 / 24, 2]);
	});
});
