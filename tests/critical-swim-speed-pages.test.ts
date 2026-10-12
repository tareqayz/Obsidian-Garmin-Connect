import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	CSS_TITLE,
	CURRENT_COPY,
	CURRENT_COPY_LINES,
	DAILY_RESULTS,
	EMPTY_RESULT,
	NO_CSS_DATA,
	PACE_LABEL,
	PACE_UNIT,
	RESULTS_HEADER,
	RESULTS_TITLE,
	WEEKLY_RESULTS,
} from "../src/dashboard/critical-swim-speed-copy";
import {
	DEFAULT_PACES,
	criticalSwimSpeedView,
	cssCurrent,
	cssPace,
	cssYAxis,
	cssYFraction,
	newestResult,
	paceText,
	type CriticalSwimSpeedView,
	type CssContext,
	type CssCurrentView,
	type CssPeriodView,
} from "../src/dashboard/critical-swim-speed-pages";
import { daysBetween, type PeriodRange } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { performanceStatRoute } from "../src/dashboard/routes";
import { CRITICAL_SWIM_SPEED_INDEX, rowsOfCriticalSwimSpeed, type CriticalSwimSpeedRow } from "../src/sync/critical-swim-speed-index";

/**
 * Golden numbers from ref/performance-stats/critical-swim-speed/README.md:
 * the phone shots of Sunday 2026-10-11 21:25, the web report of 23:00 and
 * the routes as Garmin answered them on Oct 12. The account has never had a
 * result, so the index is complete and empty, and every value on screen is
 * the empty state; the populated forms are Inferred and tested on
 * synthetic rows through the index's own mapper. The windows roll daily, so
 * the spans reproduce only with today pinned.
 */
const TODAY = "2026-10-11";
const EMPTY: CssContext = { today: TODAY, complete: true };

const view = (range: PeriodRange, opts: { offset?: number; rows?: readonly CriticalSwimSpeedRow[]; ctx?: Partial<CssContext> } = {}): CriticalSwimSpeedView =>
	criticalSwimSpeedView({ range, offset: opts.offset ?? 0 }, opts.rows ?? [], { ...EMPTY, ...opts.ctx });
const current = (opts: Parameters<typeof view>[1] = {}) => view("1d", opts) as CssCurrentView;
const period = (range: "7d" | "12w" | "1y", opts: Parameters<typeof view>[1] = {}) => view(range, opts) as CssPeriodView;

/** The phone's plot runs from the period's first day at x 48.83 to its last at 369.17 (FTP's to 0.5–0.8 pt). */
const PLOT = { left: 48.83, right: 369.17 } as const;
const plotX = (fraction: number) => PLOT.left + fraction * (PLOT.right - PLOT.left);

const labels = (v: CssPeriodView) => v.chart.axis.labels.map((l) => l.text);

/** Synthetic results (Inferred shape), through the index's mapper as a window would bring them. */
const RESULTS: CriticalSwimSpeedRow[] = rowsOfCriticalSwimSpeed({
	criticalSwimSpeedDTOList: [
		{ calendarDate: "2025-03-01", speed: 0.9524 },
		{ calendarDate: "2026-08-30", speed: 1.0 },
		{ calendarDate: "2026-09-02", speed: 1.0101 },
		{ calendarDate: "2026-09-05", speed: 1.0204 },
		{ calendarDate: "2026-10-08", speed: 1.0256 },
	],
}).map((r) => CRITICAL_SWIM_SPEED_INDEX.normalize(r)!);

describe("Current, no result ever", () => {
	const c = current();

	it('"Critical Swim Speed", a "--" date line, "--" over "Pace (min/100m)": latest/2026-10-11 and 10-12 are HTTP 204', () => {
		assert.deepEqual([c.range, c.title, c.line, c.value, c.unit, c.date], ["1d", "Critical Swim Speed", "--", "--", "Pace (min/100m)", undefined]);
		assert.deepEqual([CSS_TITLE, PACE_LABEL], ["Critical Swim Speed", "Pace (min/100m)"]);
	});

	it("has no period row and no stepper; an offset is not a day", () => {
		assert.deepEqual([c.label, c.canGoBack], [null, false]);
		assert.deepEqual(current({ offset: -5 }), c);
		// Still incomplete: Current has no "<" either way.
		assert.equal(current({ ctx: { complete: false } }).canGoBack, false);
	});

	it("sets the copy in the phone's six lines: the web Help's 'Swimming Aerobic Threshold' paragraph word for word", () => {
		assert.deepEqual(c.copyLines, [
			"Your critical swim speed (CSS) represents the fastest",
			"swimming pace that you can maintain without",
			"exhaustion, which is your aerobic threshold for",
			"swimming. Once you determine your CSS, you can",
			"use it to guide your training and to measure how",
			"you’re improving.",
		]);
		assert.equal(
			c.copy,
			"Your critical swim speed (CSS) represents the fastest swimming pace that you can maintain without exhaustion, which is your aerobic threshold for swimming. Once you determine your CSS, you can use it to guide your training and to measure how you’re improving.",
		);
		assert.deepEqual([c.copy, c.copyLines], [CURRENT_COPY, CURRENT_COPY_LINES]);
	});

	it("opens first: the registry's Current, on the workouts group the index belongs to", () => {
		const stat = PERFORMANCE_REGISTRY.page("critical-swim-speed")!;
		assert.deepEqual([stat.ranges, stat.defaultRange, stat.rangeLabels?.["1d"], stat.group], [["1d", "7d", "12w", "1y"], "1d", "Current", "workouts"]);
		assert.equal(CRITICAL_SWIM_SPEED_INDEX.group, stat.group);
		assert.equal(criticalSwimSpeedView(performanceStatRoute("critical-swim-speed"), [], EMPTY).range, "1d");
	});
});

describe("7d, Oct 5 – Oct 11, no result", () => {
	const v = period("7d");

	it('"Oct 5 - 11", seven days: range-daily-2026-10-05_2026-10-11 has two empty lists', () => {
		assert.deepEqual([v.range, v.label, v.span], ["7d", "Oct 5 - 11", { from: "2026-10-05", to: "2026-10-11" }]);
		assert.equal(daysBetween(v.span.from, v.span.to) + 1, 7);
	});

	it('"Daily Results" over the frame: "0:40 1:50 3:00 4:10 5:20", the fastest at the top, and "No Critical Swim Speed data"', () => {
		assert.equal(v.title, "Daily Results");
		assert.deepEqual(v.chart.y, { ticks: [40, 110, 180, 250, 320], labels: ["0:40", "1:50", "3:00", "4:10", "5:20"] });
		assert.deepEqual([v.chart.points, v.empty], [[], "No Critical Swim Speed data"]);
		assert.equal(NO_CSS_DATA, "No Critical Swim Speed data");
	});

	it('marks a dot a day, the ends large and "10-05" "10-11" under them, 53.39 pt apart on the phone\'s plot', () => {
		const { dots, labels: ends } = v.chart.axis;
		assert.equal(dots.length, 7);
		assert.deepEqual(dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 6]);
		assert.deepEqual(ends, [{ x: 0, text: "10-05" }, { x: 1, text: "10-11" }]);
		dots.forEach((d, i) => assert.ok(Math.abs(plotX(d.x) - (48.83 + 53.39 * i)) <= 0.3, `dot ${i}`));
	});

	it('has the results table with one "--:--" · "--" row under "Pace" (min/100m) · "Date"', () => {
		assert.deepEqual(v.table, { title: "Critical Swim Speed Results", header: ["Pace", "Date"], unit: "min/100m", rows: [{ key: "empty", cells: ["--:--", "--"] }] });
		assert.deepEqual([RESULTS_TITLE, RESULTS_HEADER, PACE_UNIT, EMPTY_RESULT], ["Critical Swim Speed Results", ["Pace", "Date"], "min/100m", ["--:--", "--"]]);
	});

	it('turns "<" off once the index is complete with no row (DECISION: Blood Pressure\'s canStepBack, not the phone\'s always-on "<")', () => {
		assert.equal(v.canGoBack, false);
		assert.equal(period("7d", { ctx: { complete: false } }).canGoBack, true);
	});
});

describe("12w, Jul 20 – Oct 11, no result", () => {
	const v = period("12w");

	it('"Jul 20 - Oct 11", 84 days in 12 blocks: range-weekly-slash-2026-07-20_2026-10-11 is empty', () => {
		assert.deepEqual([v.label, v.span], ["Jul 20 - Oct 11", { from: "2026-07-20", to: "2026-10-11" }]);
		assert.equal(daysBetween(v.span.from, v.span.to) + 1, 84);
	});

	it('"Weekly Results", the same y labels and line, and the one-row table', () => {
		assert.equal(v.title, "Weekly Results");
		assert.deepEqual(v.chart.y.labels, ["0:40", "1:50", "3:00", "4:10", "5:20"]);
		assert.equal(v.empty, NO_CSS_DATA);
		assert.deepEqual(v.table.rows.map((r) => r.cells), [["--:--", "--"]]);
		assert.equal(v.canGoBack, false);
	});

	it('marks the 12 block starts, all large, "7-20" … "10-05" on end, 27.0 pt (7 days) apart', () => {
		const { dots } = v.chart.axis;
		assert.equal(dots.length, 12);
		assert.ok(dots.every((d) => d.large));
		assert.deepEqual(labels(v), ["7-20", "7-27", "8-03", "8-10", "8-17", "8-24", "8-31", "9-07", "9-14", "9-21", "9-28", "10-05"]);
		assert.ok(v.chart.axis.labels.every((l) => l.rotated));
		dots.forEach((d, i) => assert.ok(Math.abs(plotX(d.x) - (48.83 + 27.0 * i)) <= 0.3, `dot ${i}`));
	});
});

describe("1y, Oct 13, 2025 – Oct 11, 2026, no result", () => {
	const v = period("1y");

	it('"Oct 13, 2025 - Oct 11, 2026", 364 days: range-weekly-slash-2025-10-13_2026-10-11 is empty', () => {
		assert.deepEqual([v.label, v.span], ["Oct 13, 2025 - Oct 11, 2026", { from: "2025-10-13", to: "2026-10-11" }]);
		assert.equal(daysBetween(v.span.from, v.span.to) + 1, 364);
		assert.deepEqual([v.title, v.empty, v.chart.y.labels.join(" ")], ["Weekly Results", NO_CSS_DATA, "0:40 1:50 3:00 4:10 5:20"]);
	});

	it("marks the period's first day each month on, Oct … Sep on end, within 0.3 pt of the shot's dots", () => {
		assert.deepEqual(labels(v), ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]);
		assert.ok(v.chart.axis.dots.every((d) => d.large) && v.chart.axis.labels.every((l) => l.rotated));
		const shot = [48.83, 76.17, 102.83, 130.17, 157.5, 182.17, 209.5, 236.0, 263.17, 289.5, 317.0, 344.17];
		v.chart.axis.dots.forEach((d, i) => assert.ok(Math.abs(plotX(d.x) - shot[i]!) <= 0.3, `month ${i}: ${plotX(d.x).toFixed(2)}`));
	});
});

describe("the y axis", () => {
	it("is 40 + 70k seconds without a result, labelled m:ss", () => {
		assert.deepEqual(DEFAULT_PACES, [0, 1, 2, 3, 4].map((k) => 40 + 70 * k));
		assert.deepEqual(cssYAxis([]), { ticks: [40, 110, 180, 250, 320], labels: ["0:40", "1:50", "3:00", "4:10", "5:20"] });
	});

	it("puts the fastest pace at the top: 0 at 0:40, 1 at 5:20", () => {
		const y = cssYAxis([]);
		assert.deepEqual([cssYFraction(y, 40), cssYFraction(y, 180), cssYFraction(y, 320)], [0, 0.5, 1]);
		assert.ok(Math.abs(cssYFraction(y, 97.5) - 57.5 / 280) < 1e-12);
	});

	it("follows Running Lactate Threshold's pace axis once a result draws (Inferred): 1:38 alone is 1:35 … 1:55", () => {
		assert.deepEqual(cssYAxis([cssPace(1.0256)]), { ticks: [95, 100, 105, 110, 115], labels: ["1:35", "1:40", "1:45", "1:50", "1:55"] });
		// 1:00 and 2:30, padded 5 % each way: 10 s and 20 s steps fall short, 50 s reaches.
		assert.deepEqual(cssYAxis([60, 150]).labels, ["0:50", "1:40", "2:30", "3:20", "4:10"]);
	});
});

describe("previous periods (the web's, every one empty)", () => {
	it("are the spans the web asked at offset −1", () => {
		const spans = (["7d", "12w", "1y"] as const).flatMap((r) => [0, -1].map((offset) => period(r, { offset }).span));
		assert.deepEqual(spans.map((s) => `${s.from}..${s.to}`), [
			"2026-10-05..2026-10-11",
			"2026-09-28..2026-10-04",
			"2026-07-20..2026-10-11",
			"2026-04-27..2026-07-19",
			"2025-10-13..2026-10-11",
			"2024-10-14..2025-10-12",
		]);
	});

	it('7d −1 "Sep 28 - Oct 4", 09-28 / 10-04; 12w −1 "Apr 27 - Jul 19", 4-27 … 7-13; 1y −1 "Oct 14, 2024 - Oct 12, 2025", Oct … Sep', () => {
		const week = period("7d", { offset: -1 });
		assert.deepEqual([week.label, labels(week)], ["Sep 28 - Oct 4", ["09-28", "10-04"]]);
		const twelve = period("12w", { offset: -1 });
		assert.deepEqual([twelve.label, labels(twelve)], ["Apr 27 - Jul 19", ["4-27", "5-04", "5-11", "5-18", "5-25", "6-01", "6-08", "6-15", "6-22", "6-29", "7-06", "7-13"]]);
		const year = period("1y", { offset: -1 });
		assert.deepEqual([year.label, labels(year).join(" ")], ["Oct 14, 2024 - Oct 12, 2025", "Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep"]);
		for (const v of [week, twelve, year]) assert.deepEqual([v.empty, v.table.rows.length, v.canGoBack], [NO_CSS_DATA, 1, false]);
	});

	it("open on 7d for a range the page doesn't have", () => {
		assert.deepEqual(view("4w"), view("7d"));
	});
});

describe("with results (Inferred)", () => {
	it("rounds a pace half up to the second: 1.0256 m/s is 97.504 s, 1:38; 1.0257 is 97.494 s, 1:37", () => {
		assert.ok(Math.abs(cssPace(1.0256) - 97.5039) < 1e-4);
		assert.deepEqual([paceText(cssPace(1.0256)), paceText(cssPace(1.0257)), paceText(60), paceText(320)], ["1:38", "1:37", "1:00", "5:20"]);
	});

	it("Current: the newest result on or before today, its day and its pace", () => {
		const c = current({ rows: RESULTS });
		assert.deepEqual([c.line, c.date, c.value, c.unit], ["Thursday, October 8", "2026-10-08", "1:38", "Pace (min/100m)"]);
		assert.equal(current({ rows: RESULTS, ctx: { today: "2026-10-08" } }).line, "Today");
		// A result from the future (a clock behind the watch's) waits for its day.
		assert.equal(current({ rows: RESULTS, ctx: { today: "2026-10-07" } }).value, "1:38");
		assert.equal(newestResult(RESULTS, "2026-10-07")!.date, "2026-09-05");
	});

	it("Current shows a result however old, with its year", () => {
		const c = cssCurrent(RESULTS.slice(0, 1), TODAY);
		assert.deepEqual([c.line, c.value], ["Saturday, March 1, 2025", "1:45"]);
	});

	it("7d: a dot at the result's day, the axis around it, the table's row, no empty line, and '<' to the older results", () => {
		const v = period("7d", { rows: RESULTS });
		assert.deepEqual(v.chart.points.map((p) => [p.date, p.day, p.x, paceText(p.pace)]), [["2026-10-08", "2026-10-08", 0.5, "1:38"]]);
		assert.deepEqual(v.chart.y.labels, ["1:35", "1:40", "1:45", "1:50", "1:55"]);
		assert.deepEqual(v.table.rows, [{ key: "2026-10-08", date: "2026-10-08", cells: ["1:38", "Oct 8, 2026"] }]);
		assert.deepEqual([v.empty, v.canGoBack, v.title], [undefined, true, DAILY_RESULTS]);
	});

	it("12w: each 7-day block's last result at the block's first day; the table lists every result, newest first", () => {
		const v = period("12w", { rows: RESULTS });
		assert.deepEqual(
			v.chart.points.map((p) => [p.date, p.day, Math.round(p.x * 83), paceText(p.pace)]),
			[
				["2026-08-30", "2026-08-24", 35, "1:40"],
				// Sep 2 (1:39) and Sep 5 (1:38) share the Aug 31 block: the last wins.
				["2026-09-05", "2026-08-31", 42, "1:38"],
				["2026-10-08", "2026-10-05", 77, "1:38"],
			],
		);
		assert.deepEqual(v.table.rows.map((r) => r.cells), [["1:38", "Oct 8, 2026"], ["1:38", "Sep 5, 2026"], ["1:39", "Sep 2, 2026"], ["1:40", "Aug 30, 2026"]]);
		assert.deepEqual([v.title, v.empty], [WEEKLY_RESULTS, undefined]);
	});

	it("1y: the same blocks counted from Oct 13, 2025; 1y −1 holds the 2025 result, dated with its year, and is where '<' stops", () => {
		const v = period("1y", { rows: RESULTS });
		assert.deepEqual(v.chart.points.map((p) => [p.day, Math.round(p.x * 363)]), [["2026-08-24", 315], ["2026-08-31", 322], ["2026-10-05", 357]]);
		assert.equal(v.canGoBack, true);
		const before = period("1y", { offset: -1, rows: RESULTS });
		assert.deepEqual(before.chart.points.map((p) => [p.date, p.day, paceText(p.pace)]), [["2025-03-01", "2025-02-24", "1:45"]]);
		assert.deepEqual(before.table.rows.map((r) => r.cells), [["1:45", "Mar 1, 2025"]]);
		assert.equal(before.canGoBack, false);
		assert.equal(period("1y", { offset: -1, rows: RESULTS, ctx: { complete: false } }).canGoBack, true);
	});

	it("a period between results is the empty frame, '<' still on", () => {
		const v = period("7d", { offset: -2, rows: RESULTS });
		assert.deepEqual([v.label, v.chart.points, v.empty, v.table.rows.map((r) => r.cells), v.canGoBack], ["Sep 21 - 27", [], NO_CSS_DATA, [["--:--", "--"]], true]);
		assert.deepEqual(v.chart.y.labels, ["0:40", "1:50", "3:00", "4:10", "5:20"]);
	});
});
