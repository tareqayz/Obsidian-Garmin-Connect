import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { TOLERANCE_HELP, TOLERANCE_HELP_INTRO, TOLERANCE_HELP_TITLE, TOLERANCE_PHRASE_KEYS, tolerancePhrase } from "../src/dashboard/running-tolerance-copy";
import {
	CURRENT_MAX_AGE,
	DISTANCE_CHIP,
	TOLERANCE_CHIPS,
	distanceOn,
	movedRoute,
	runningToleranceView,
	tenthsText,
	toleranceTicks,
	weekHeader,
	wholeText,
	withDistance,
	type RunningToleranceContext,
	type RunningToleranceData,
	type RunningToleranceRoute,
	type ToleranceCurrentView,
	type TolerancePeriodView,
	type ToleranceWeekBlock,
} from "../src/dashboard/running-tolerance-pages";
import { NO_READING } from "../src/dashboard/vo2-max-pages";
import type { RunningToleranceRow, RunningToleranceWeekRow } from "../src/sync/running-tolerance-index";
import { dayRows, weekRows } from "./running-tolerance-fixture";

/**
 * Golden numbers from ref/performance-stats/running-tolerance/README.md: the
 * phone shots of Sunday 2026-10-11 21:25–21:26, the web report of 23:01, and
 * the API samples of Oct 11–12 (`golden-running-tolerance.py`: 54 checks, 0
 * fail; `inferred.py` for the previous periods). The 12w and 1y spans move
 * every Sunday, so they reproduce only with today pinned.
 */
const TODAY = "2026-10-11";

const WEEKS = weekRows();
const DAYS = dayRows();
const DATA: RunningToleranceData = { days: DAYS, weeks: WEEKS };
const CTX: RunningToleranceContext = { today: TODAY, complete: true };

const current = (ctx: RunningToleranceContext = CTX, data: RunningToleranceData = DATA) => runningToleranceView({ range: "1d", offset: 0 }, data, ctx) as ToleranceCurrentView;
const period = (route: RunningToleranceRoute, ctx: RunningToleranceContext = CTX, data: RunningToleranceData = DATA) => runningToleranceView(route, data, ctx) as TolerancePeriodView;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
/** The phone's plots: 12w's slot centres at 40.5 + 30k, 1y's at 34.5 + 6.745k. */
const phone12w = (x: number) => 40.5 + 330 * x;
const phone1y = (x: number) => 34.5 + 344 * x;
const slotOf = (x: number, n: number) => Math.round(x * (n - 1));
const block = (b: ToleranceWeekBlock) => `${b.title} · ${b.rows.map((r) => r.value).join(" · ")}`;
const near = (a: number, b: number, within: number, what: string) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a}, the shot's ${b}`);
const levels = (v: TolerancePeriodView) => v.chart.tolerance.runs.map((run) => (v.chart.tolerance.shape === "step" ? run.filter((_, i) => i % 2 === 0) : run).map((p) => p.value));

const TWELVE_WEEKS = period({ range: "12w", offset: 0 });
const YEAR = period({ range: "1y", offset: 0 });

describe("the fixture", () => {
	it("is Garmin's history: 61 Sunday weeks from 2025-08-17, the current one Oct 11 alone; the daily rows of Oct 5–12", () => {
		assert.equal(WEEKS.length, 61);
		assert.deepEqual([WEEKS[0]!.date, WEEKS.at(-1)!.date], ["2025-08-17", TODAY]);
		assert.deepEqual(WEEKS.at(-1), { date: TODAY, from: TODAY, to: TODAY, load: 14150, distance: 12469, tolerance: 37070 });
		assert.deepEqual(DAYS.map((d) => d.date), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]);
	});
});

describe("Current, Sunday 2026-10-11", () => {
	const view = current();

	it("shows today's row, with no stepper", () => {
		assert.deepEqual([view.label, view.date, view.canGoBack, view.canGoForward, view.empty], ["Today", TODAY, false, false, undefined]);
	});

	it("rings the acute load against the tolerance in raw metres: 28158 / 37070 → 273.45°, measured 273.6°", () => {
		const ring = view.ring!;
		assert.deepEqual([ring.value, ring.label], ["28.2 km", "37 km/w"]);
		assert.equal(ring.share, 28158 / 37070);
		assert.equal(ring.progress, ring.share);
		assert.equal(r2(ring.angle), 273.45);
		near(ring.angle, 273.6, 0.3, "the arc's end");
		// The rounded figures would give 274.38°, off the shot.
		assert.ok(Math.abs((28.2 / 37) * 360 - 273.6) > 0.6);
	});

	it("titles the phrase and gives its copy, then the three figures with their units apart", () => {
		assert.equal(view.phrase, "MEDIUM_LOAD");
		assert.equal(view.title, "Medium impact load");
		assert.equal(view.copy, "Your impact load is within a good range. If you want to build tolerance, focus on increasing running distance or intensity gradually over time.");
		assert.deepEqual(view.figures, [
			{ value: "28.2", unit: "km", label: "Acute Impact Load" },
			{ value: "37", unit: "km", label: "Weekly Tolerance" },
			{ value: "22.5", unit: "km", label: "Actual 7d Distance" },
		]);
	});
});

describe("12w, Jul 26 – Oct 11", () => {
	const view = TWELVE_WEEKS;
	const chart = view.chart;

	it("is the 12 Sunday weeks to today, the last one today alone", () => {
		assert.deepEqual([view.range, view.label, view.span], ["12w", "Jul 26 - Oct 11", { from: "2026-07-26", to: TODAY }]);
		assert.equal(chart.slots.length, 12);
		assert.deepEqual([chart.slots[0]!.week, chart.slots[11]!.week], ["2026-07-26", TODAY]);
		assert.deepEqual([view.canGoBack, view.canGoForward, view.chip], [true, false, false]);
	});

	it("draws Garmin's totalImpactLoad, unrounded, a bar a week at 40.5 + 30k: Garmin's twin weeks too", () => {
		assert.deepEqual(chart.bars.map((b) => r2(b.value)), [21.45, 24.58, 11.46, 40.53, 24.58, 29.06, 29.06, 18.23, 23.08, 28.14, 10.59, 14.15]);
		// Bars 2 and 5 both 24.6, bars 6 and 7 both 29.1, as the phone drew them.
		assert.equal(chart.bars[1]!.value, chart.bars[4]!.value);
		assert.equal(chart.bars[5]!.value, chart.bars[6]!.value);
		chart.bars.forEach((b, k) => near(phone12w(b.x), 40.5 + 30 * k, 0.01, `bar ${k}`));
	});

	it("turns only Aug 16–22 orange: 40530 ≥ 36968", () => {
		assert.deepEqual(chart.bars.filter((b) => b.tone === "above").map((b) => b.week), ["2026-08-16"]);
		assert.ok(chart.bars.every((b) => b.tone === (b.week === "2026-08-16" ? "above" : "load")));
	});

	it("steps the tolerance at whole km, risers half way between the slots, from the first slot's centre to the last's", () => {
		assert.equal(chart.tolerance.shape, "step");
		assert.deepEqual(levels(view), [[37, 36, 36, 37, 36, 38, 37, 38, 38, 37, 38, 37]]);
		// Weeks 2–3 level at 36 for Garmin's 35752 and 36050.
		const run = chart.tolerance.runs[0]!;
		assert.equal(run.length, 24);
		for (let k = 0; k < 11; k++) {
			near(phone12w(run[2 * k + 1]!.x), 55.5 + 30 * k, 0.01, `riser ${k}`);
			assert.equal(run[2 * k + 1]!.x, run[2 * k + 2]!.x);
		}
		assert.deepEqual([run[0]!.x, run.at(-1)!.x], [0, 1]);
	});

	it("runs the y axis 0 / 11 / 22 / 33 / 44: 4 × ceil(40.53 / 4)", () => {
		assert.deepEqual(chart.ticks, [44, 33, 22, 11, 0]);
		assert.deepEqual(chart.labels, ["44", "33", "22", "11", "0"]);
	});

	it("dots every week, the ends large and labelled with their rows' last days, 08-01 and 10-11", () => {
		assert.deepEqual(
			chart.axis.dots.map((d) => d.large),
			Array.from({ length: 12 }, (_, k) => k === 0 || k === 11),
		);
		assert.deepEqual(chart.axis.labels, [
			{ x: 0, text: "08-01" },
			{ x: 1, text: "10-11" },
		]);
	});

	it("keys the chart: Tolerance and Impact Load, then At/Above Tolerance; no distance line with the chip off", () => {
		assert.deepEqual(
			view.legend.map((row) => row.map((i) => `${i.label}:${i.mark}:${i.tone}`)),
			[["Tolerance:line:tolerance", "Impact Load:dot:load"], ["At/Above Tolerance:dot:above"]],
		);
		assert.equal(chart.distance, null);
	});

	it("lists the weeks newest first: TODAY, then each week's days, with Tolerance, Impact Load and Actual Distance", () => {
		assert.deepEqual(view.weeks.map(block), [
			"TODAY · 37 km · 14.2 km · 12.5 km",
			"OCT 4 - 10 · 38 km · 10.6 km · 10 km",
			"SEP 27 - OCT 3 · 37 km · 28.1 km · 25.2 km",
			"SEP 20 - 26 · 38 km · 23.1 km · 20.7 km",
			"SEP 13 - 19 · 38 km · 18.2 km · 16.4 km",
			// The rest, as the web's Show More lists them (half up: 21450 → 21.5).
			"SEP 6 - 12 · 37 km · 29.1 km · 21.2 km",
			"AUG 30 - SEP 5 · 38 km · 29.1 km · 21.2 km",
			"AUG 23 - 29 · 36 km · 24.6 km · 23.1 km",
			"AUG 16 - 22 · 37 km · 40.5 km · 37.5 km",
			"AUG 9 - 15 · 36 km · 11.5 km · 10.3 km",
			"AUG 2 - 8 · 36 km · 24.6 km · 23.1 km",
			"JUL 26 - AUG 1 · 37 km · 21.5 km · 20.2 km",
		]);
		assert.deepEqual(view.weeks[0]!.rows.map((r) => r.label), ["Tolerance", "Impact Load", "Actual Distance"]);
	});
});

describe("12w with Actual Distance", () => {
	const view = period({ range: "12w", offset: 0, sub: DISTANCE_CHIP });

	it("greys every bar and lays totalDistance over them, a dot a week", () => {
		assert.equal(view.chip, true);
		assert.ok(view.chart.bars.every((b) => b.tone === "muted"));
		assert.deepEqual(view.chart.bars.map((b) => b.value), TWELVE_WEEKS.chart.bars.map((b) => b.value));
		assert.deepEqual(
			view.chart.distance!.points.map((p) => r1(p.value!)),
			[20.2, 23.1, 10.3, 37.5, 23.1, 21.2, 21.2, 16.4, 20.7, 25.2, 10, 12.5],
		);
		assert.equal(view.chart.distance!.dots, true);
	});

	it("keeps the axis, the tolerance line and the list; the legend goes on one row", () => {
		assert.deepEqual(view.chart.ticks, [44, 33, 22, 11, 0]);
		assert.deepEqual(view.chart.tolerance, TWELVE_WEEKS.chart.tolerance);
		assert.deepEqual(view.weeks, TWELVE_WEEKS.weeks);
		assert.deepEqual(
			view.legend.map((row) => row.map((i) => `${i.label}:${i.mark}:${i.tone}`)),
			[["Tolerance:line:tolerance", "Impact Load:dot:muted", "Actual Distance:line-dot:distance"]],
		);
	});
});

describe("1y, Oct 19, 2025 – Oct 11, 2026", () => {
	const view = YEAR;
	const chart = view.chart;
	const slots = (weeks: readonly string[]) => weeks.map((w) => chart.slots.findIndex((s) => s.week === w));

	it("is the 52 Sunday weeks to today", () => {
		assert.deepEqual([view.label, view.span], ["Oct 19, 2025 - Oct 11, 2026", { from: "2025-10-19", to: TODAY }]);
		assert.equal(chart.slots.length, 52);
		assert.ok(chart.slots.every((s) => s.row));
	});

	it("draws 49 bars on 52 slots at 34.5 + 6.745k: none for the three weeks without a run", () => {
		assert.equal(chart.bars.length, 49);
		const drawn = new Set(chart.bars.map((b) => slotOf(b.x, 52)));
		const empty = chart.slots.map((_, k) => k).filter((k) => !drawn.has(k));
		assert.deepEqual(empty, [11, 18, 19]);
		assert.deepEqual(slots(["2026-01-04", "2026-02-22", "2026-03-01"]), [11, 18, 19]);
		chart.bars.forEach((b) => near(phone1y(b.x), 34.5 + 6.745 * slotOf(b.x, 52), 0.02, b.week));
	});

	it("turns Mar 22, Apr 5, Apr 19 and Aug 16 orange", () => {
		assert.deepEqual(chart.bars.filter((b) => b.tone === "above").map((b) => b.week), ["2026-03-22", "2026-04-05", "2026-04-19", "2026-08-16"]);
	});

	it("runs the y axis 0 / 26 / 52 / 78 / 104 from Nov 9's tolerance, 102.103", () => {
		assert.deepEqual(chart.ticks, [104, 78, 52, 26, 0]);
	});

	it("dots and names each week holding a month's 1st, Nov … Oct, standing on end", () => {
		assert.deepEqual(chart.axis.dots.map((d) => slotOf(d.x, 52)), [1, 6, 10, 15, 19, 23, 27, 32, 36, 40, 45, 49]);
		assert.ok(chart.axis.dots.every((d) => d.large));
		assert.deepEqual(chart.axis.labels.map((l) => l.text).join(" "), "Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
		assert.ok(chart.axis.labels.every((l) => l.rotated));
		const measured = [41.17, 74.83, 101.83, 135.5, 162.5, 189.5, 216.5, 250.5, 277.5, 304.5, 338.17, 365.17];
		chart.axis.dots.forEach((d, i) => near(phone1y(d.x), measured[i]!, 0.25, `month dot ${i}`));
	});

	it("draws the tolerance as one polyline at whole km through every slot, on across the weeks without a run, peaking at 102", () => {
		assert.equal(chart.tolerance.shape, "line");
		assert.equal(chart.tolerance.runs.length, 1);
		const values = levels(view)[0]!;
		assert.equal(values.length, 52);
		assert.deepEqual(values.slice(0, 4), [94, 91, 89, 102]);
		assert.equal(Math.max(...values), 102);
		assert.deepEqual([values[11], values[18], values[19]], [64, 48, 44]);
		assert.deepEqual(chart.tolerance.runs[0]!.map((p) => p.x), chart.slots.map((s) => s.x));
	});

	it("lists all 52 weeks newest first, the weeks without a run as 0 km, last year's in the web's spacing", () => {
		assert.equal(view.weeks.length, 52);
		assert.deepEqual(view.weeks.slice(0, 2).map(block), ["TODAY · 37 km · 14.2 km · 12.5 km", "OCT 4 - 10 · 38 km · 10.6 km · 10 km"]);
		// The web's 1y table opens with the 12w's rows.
		assert.deepEqual(view.weeks.slice(0, 12), TWELVE_WEEKS.weeks);
		const by = (week: string) => block(view.weeks.find((b) => b.week === week)!);
		assert.equal(by("2026-01-04"), "JAN 4 - 10 · 64 km · 0 km · 0 km");
		// Inferred: across New Year with both years; an earlier year as the web spaces it.
		assert.equal(by("2025-12-28"), "DEC 28, 2025 - JAN 3, 2026 · 67 km · 29.7 km · 25.3 km");
		assert.equal(by("2025-10-26"), "OCT 26 - NOV 1, 2025 · 91 km · 44.1 km · 35.3 km");
		assert.equal(block(view.weeks.at(-1)!), "OCT 19-25, 2025 · 94 km · 32.6 km · 26.4 km");
	});
});

describe("1y with Actual Distance", () => {
	const view = period({ range: "1y", offset: 0, sub: DISTANCE_CHIP });

	it("breaks the distance line at the three weeks without a run, and draws no dots", () => {
		const points = view.chart.distance!.points;
		assert.deepEqual(points.flatMap((p, k) => (p.value === null ? [k] : [])), [11, 18, 19]);
		assert.equal(view.chart.distance!.dots, false);
		assert.ok(view.chart.bars.every((b) => b.tone === "muted"));
		assert.deepEqual(view.legend[0]!.map((i) => `${i.label}:${i.mark}`), ["Tolerance:line", "Impact Load:dot", "Actual Distance:line"]);
		assert.deepEqual(view.chart.ticks, YEAR.chart.ticks);
	});
});

describe("previous periods (the web's; the phone's Inferred)", () => {
	it("12w −1 is May 3 – Jul 25: no week at the line, so no At/Above item; 0 / 12 / 24 / 36 / 48", () => {
		const view = period({ range: "12w", offset: -1 });
		assert.deepEqual([view.label, view.span, view.canGoBack, view.canGoForward], ["May 3 - Jul 25", { from: "2026-05-03", to: "2026-07-25" }, true, true]);
		assert.deepEqual(view.chart.ticks, [48, 36, 24, 12, 0]);
		assert.deepEqual(view.chart.bars.map((b) => tenthsText(Math.round(b.value * 1000))), ["26.6", "21.8", "21.9", "22.3", "12.3", "18.4", "23.6", "5.1", "32.5", "13.7", "7.8", "30"]);
		assert.ok(view.chart.bars.every((b) => b.tone === "load"));
		assert.deepEqual(levels(view), [[48, 46, 45, 44, 42, 40, 40, 39, 40, 40, 39, 36]]);
		assert.deepEqual(view.chart.axis.labels.map((l) => l.text), ["05-09", "07-25"]);
		assert.deepEqual(view.legend.map((row) => row.map((i) => i.id)), [["tolerance", "load"]]);
		// The web's six rows (`text-12w-prev.txt`), the phone's way: Jul 19–25 is Garmin's week with no run.
		assert.deepEqual(view.weeks.slice(0, 6).map(block), [
			"JUL 19 - 25 · 36 km · 30 km · 20 km",
			"JUL 12 - 18 · 39 km · 7.8 km · 6.5 km",
			"JUL 5 - 11 · 40 km · 13.7 km · 11.7 km",
			"JUN 28 - JUL 4 · 40 km · 32.5 km · 26.7 km",
			"JUN 21 - 27 · 39 km · 5.1 km · 4.5 km",
			"JUN 14 - 20 · 40 km · 23.6 km · 20.5 km",
		]);
		assert.equal(block(view.weeks.at(-1)!), "MAY 3 - 9 · 48 km · 26.6 km · 24.9 km");
	});

	it("1y −1 is Oct 20, 2024 – Oct 18, 2025: nine weeks at the right of the year, the first orange; 0 / 25 / 50 / 75 / 100", () => {
		const view = period({ range: "1y", offset: -1 });
		assert.deepEqual([view.label, view.span], ["Oct 20, 2024 - Oct 18, 2025", { from: "2024-10-20", to: "2025-10-18" }]);
		// The history starts inside it, and the index is whole: no "<".
		assert.deepEqual([view.canGoBack, view.canGoForward], [false, true]);
		assert.deepEqual(view.chart.slots.flatMap((s, k) => (s.row ? [k] : [])), [43, 44, 45, 46, 47, 48, 49, 50, 51]);
		assert.deepEqual(view.chart.bars.map((b) => tenthsText(Math.round(b.value * 1000))), ["70.2", "75.7", "77.8", "71.1", "68.3", "51", "68.6", "50.4", "72.8"]);
		assert.deepEqual(view.chart.bars.map((b) => b.tone), ["above", "load", "load", "load", "load", "load", "load", "load", "load"]);
		assert.deepEqual(levels(view), [[63, 79, 89, 96, 99, 100, 96, 98, 95]]);
		assert.deepEqual(view.chart.ticks, [100, 75, 50, 25, 0]);
		assert.deepEqual(view.chart.axis.dots.map((d) => slotOf(d.x, 52)), [1, 6, 10, 14, 18, 23, 27, 32, 36, 40, 45, 49]);
		assert.deepEqual(view.weeks.map(block), [
			"OCT 12-18, 2025 · 95 km · 72.8 km · 68.6 km",
			// Oct 11, 2025 has no daily row, so Garmin's week ends on the 10th.
			"OCT 5-10, 2025 · 98 km · 50.4 km · 41.9 km",
			"SEP 28 - OCT 4, 2025 · 96 km · 68.6 km · 49.1 km",
			"SEP 21-27, 2025 · 100 km · 51 km · 42.6 km",
			"SEP 14-20, 2025 · 99 km · 68.3 km · 61.2 km",
			"SEP 7-13, 2025 · 96 km · 71.1 km · 57.9 km",
			"AUG 31 - SEP 6, 2025 · 89 km · 77.8 km · 61.9 km",
			"AUG 24-30, 2025 · 79 km · 75.7 km · 69.3 km",
			"AUG 17-23, 2025 · 63 km · 70.2 km · 60.3 km",
		]);
	});
});

describe("a weekday, Monday 2026-10-12 (Inferred: unseen on the phone)", () => {
	const MONDAY = "2026-10-12";
	// `probe-weekly-today-2026-10-04_2026-10-12.json`: this week so far is Oct 11–12.
	const weeks: RunningToleranceWeekRow[] = [...WEEKS.slice(0, -1), { date: TODAY, from: TODAY, to: MONDAY, load: 14150, distance: 12469, tolerance: 37070 }];
	const ctx: RunningToleranceContext = { today: MONDAY, complete: true };

	it("12w runs Jul 26 – Oct 12; the current week reads OCT 11 - 12, the right label 10-12", () => {
		const view = period({ range: "12w", offset: 0 }, ctx, { days: DAYS, weeks });
		assert.deepEqual([view.label, view.chart.slots.length], ["Jul 26 - Oct 12", 12]);
		assert.deepEqual(view.chart.axis.labels.map((l) => l.text), ["08-01", "10-12"]);
		assert.equal(block(view.weeks[0]!), "OCT 11 - 12 · 37 km · 14.2 km · 12.5 km");
	});

	it("Current is Monday's row: the load decayed with no run, the 7-day distance held", () => {
		const view = current(ctx);
		assert.deepEqual([view.label, view.ring!.value, view.ring!.label, view.figures[2]!.value], ["Today", "25.1 km", "37 km/w", "22.5"]);
	});
});

describe("other states (Inferred)", () => {
	it("today without a row yet: the newest row of the last 7 days, under its day", () => {
		const tuesday = current({ today: "2026-10-13", complete: true });
		assert.deepEqual([tuesday.label, tuesday.date, tuesday.ring!.value], ["Monday, October 12", "2026-10-12", "25.1 km"]);
		assert.equal(current({ today: "2026-10-19", complete: true }).date, "2026-10-12");
		const later = current({ today: "2026-10-20", complete: true });
		assert.equal(CURRENT_MAX_AGE, 7);
		assert.deepEqual([later.label, later.ring, later.figures, later.empty, later.date], ["Today", null, [], NO_READING, undefined]);
	});

	it("over the tolerance: the ring is full and the phrase is Garmin's, whatever the share", () => {
		// 2026-08-24: MEDIUM_LOAD at 1.16 of the tolerance.
		const medium: RunningToleranceRow = { date: "2026-08-24", load: 42615, distance: 29203, tolerance: 36602, phrase: "MEDIUM_LOAD" };
		const view = current({ today: medium.date, complete: true }, { days: [medium], weeks: [] });
		assert.ok(view.ring!.share > 1.16);
		assert.deepEqual([view.ring!.progress, view.ring!.angle, view.title], [1, 360, "Medium impact load"]);
		// 2025-08-28: ABOVE_TOLERANCE, whose words are unseen: the key, no title, no copy.
		const above: RunningToleranceRow = { date: "2025-08-28", load: 96763, distance: 94763, tolerance: 79244, phrase: "ABOVE_TOLERANCE" };
		const over = current({ today: above.date, complete: true }, { days: [above], weeks: [] });
		assert.deepEqual([over.phrase, over.title, over.copy], ["ABOVE_TOLERANCE", undefined, undefined]);
		assert.deepEqual(over.figures.map((f) => f.value), ["96.8", "79", "94.8"]);
	});

	it("before the history: Current's no-data line; a range's empty slots, an axis of 0–4 and no list", () => {
		const none: RunningToleranceData = { days: [], weeks: [] };
		assert.equal(current(CTX, none).empty, NO_READING);
		const view = period({ range: "12w", offset: 0 }, CTX, none);
		assert.deepEqual([view.chart.slots.length, view.chart.bars, view.chart.tolerance.runs, view.weeks], [12, [], [], []]);
		assert.deepEqual(view.chart.ticks, [4, 3, 2, 1, 0]);
		// A dot a week still, the ends unlabelled (twin 697:1580).
		assert.deepEqual([view.chart.axis.dots.length, view.chart.axis.labels], [12, []]);
		assert.deepEqual(view.legend.map((row) => row.map((i) => i.id)), [["tolerance", "load"]]);
		// "<" while the history may still be coming; not once the index is whole.
		assert.deepEqual([view.canGoBack, period({ range: "12w", offset: 0 }, { today: TODAY, complete: false }, none).canGoBack], [false, true]);
	});

	it("a week the index has no row for: an empty slot, every line broken across it, no block", () => {
		const weeks = WEEKS.filter((w) => w.date !== "2026-08-09");
		const view = period({ range: "12w", offset: 0, sub: DISTANCE_CHIP }, CTX, { days: DAYS, weeks });
		assert.equal(view.chart.bars.length, 11);
		assert.deepEqual(levels(view), [[37, 36], [37, 36, 38, 37, 38, 38, 37, 38, 37]]);
		// The step line stops and starts at the midpoints either side of the empty slot.
		const [before, after] = view.chart.tolerance.runs;
		assert.deepEqual([r2(phone12w(before!.at(-1)!.x)), r2(phone12w(after![0]!.x))], [85.5, 115.5]);
		assert.equal(view.chart.distance!.points[2]!.value, null);
		assert.equal(view.weeks.length, 11);
		const year = period({ range: "1y", offset: 0 }, CTX, { days: DAYS, weeks });
		assert.deepEqual(year.chart.tolerance.runs.map((run) => run.length), [42, 9]);
	});

	it("imperial: miles, the same rounding, whole miles for the axis and the tolerance", () => {
		const ctx: RunningToleranceContext = { today: TODAY, complete: true, units: "imperial" };
		const now = current(ctx);
		assert.deepEqual([now.ring!.value, now.ring!.label], ["17.5 mi", "23 mi/w"]);
		assert.deepEqual(now.figures.map((f) => `${f.value} ${f.unit}`), ["17.5 mi", "23 mi", "14 mi"]);
		const view = period({ range: "12w", offset: 0 }, ctx);
		// 40530 m is 25.18 mi: 4 × ceil(25.18 / 4) = 28.
		assert.deepEqual(view.chart.ticks, [28, 21, 14, 7, 0]);
		assert.deepEqual(levels(view)[0]!.slice(0, 4), [23, 22, 22, 23]);
		assert.equal(block(view.weeks[0]!), "TODAY · 23 mi · 8.8 mi · 7.7 mi");
	});
});

describe("numbers", () => {
	it("prints tenths rounded half up on the metres, a trailing .0 dropped", () => {
		assert.deepEqual([tenthsText(28158), tenthsText(22478), tenthsText(14150), tenthsText(10009), tenthsText(0)], ["28.2", "22.5", "14.2", "10", "0"]);
		// The web's 21450 m → "21.5", where toFixed(1) on the km float says 21.4.
		assert.equal(tenthsText(21450), "21.5");
		assert.equal((21450 / 1000).toFixed(1), "21.4");
		// Why the index keeps metres: the day files' 22.45 km (22449 m) rounds the other way.
		assert.deepEqual([tenthsText(22449), tenthsText(22.45 * 1000)], ["22.4", "22.5"]);
	});

	it("prints the tolerance in whole km", () => {
		assert.deepEqual([wholeText(37070), wholeText(37734), wholeText(35752), wholeText(102103)], ["37", "38", "36", "102"]);
	});

	it("tops the axis at 4 × ceil(max / 4), with no headroom for a multiple of 4", () => {
		assert.deepEqual([40.53, 102.103, 47.735, 99.691].map((max) => toleranceTicks([max])[0]), [44, 104, 48, 100]);
		assert.deepEqual(toleranceTicks([44]), [44, 33, 22, 11, 0]);
		assert.deepEqual(toleranceTicks([]), [4, 3, 2, 1, 0]);
	});

	it("heads a week block as the phone does, and Inferred for the rest", () => {
		const head = (from: string, to: string, today = TODAY) => weekHeader(from, to, today);
		assert.deepEqual([head(TODAY, TODAY), head("2026-10-04", "2026-10-10"), head("2026-09-27", "2026-10-03")], ["TODAY", "OCT 4 - 10", "SEP 27 - OCT 3"]);
		// A weekday's current week; last year's in the web's spacing; across New Year with both years.
		assert.equal(head(TODAY, "2026-10-12", "2026-10-12"), "OCT 11 - 12");
		assert.deepEqual([head("2025-10-05", "2025-10-10"), head("2025-09-28", "2025-10-04")], ["OCT 5-10, 2025", "SEP 28 - OCT 4, 2025"]);
		assert.equal(head("2025-12-28", "2026-01-03"), "DEC 28, 2025 - JAN 3, 2026");
		// A week of one day that is not today: the web's "Oct 11".
		assert.deepEqual([head(TODAY, TODAY, "2026-10-12"), head("2025-10-11", "2025-10-11")], ["OCT 11", "OCT 11, 2025"]);
	});
});

describe("the chip and the words", () => {
	it("keeps Actual Distance in the route's sub, off by default", () => {
		assert.deepEqual(TOLERANCE_CHIPS, [{ id: "distance", label: "Actual Distance" }]);
		assert.deepEqual([distanceOn(undefined), distanceOn("distance"), distanceOn("month:2026-03")], [false, true, false]);
		const route: RunningToleranceRoute = { range: "12w", offset: -1 };
		assert.deepEqual(withDistance(route, true), { range: "12w", offset: -1, sub: "distance" });
		assert.deepEqual(withDistance(withDistance(route, true), false), route);
	});

	it("keeps the chip on through a period step and turns it off with a range switch (Inferred)", () => {
		const on: RunningToleranceRoute = { range: "12w", offset: 0, sub: DISTANCE_CHIP };
		assert.deepEqual(movedRoute(on, { range: "12w", offset: -1, sub: DISTANCE_CHIP }), { range: "12w", offset: -1, sub: DISTANCE_CHIP });
		assert.deepEqual(movedRoute(on, { range: "1y", offset: 0, sub: DISTANCE_CHIP }), { range: "1y", offset: 0 });
		assert.deepEqual(movedRoute(on, { range: "1d", offset: 0, sub: DISTANCE_CHIP }), { range: "1d", offset: 0 });
	});

	it("knows MEDIUM_LOAD's words of the eight keys Garmin sends, and none for the rest", () => {
		assert.equal(TOLERANCE_PHRASE_KEYS.length, 8);
		assert.equal(tolerancePhrase("MEDIUM_LOAD")?.title, "Medium impact load");
		assert.deepEqual(TOLERANCE_PHRASE_KEYS.filter((key) => tolerancePhrase(key)), ["MEDIUM_LOAD"]);
		assert.equal(tolerancePhrase(undefined), undefined);
	});

	it("carries the web's Help: its title, intro and three sections", () => {
		assert.equal(TOLERANCE_HELP_TITLE, "Running Tolerance");
		assert.match(TOLERANCE_HELP_INTRO, /^Running tolerance tracks your capacity/);
		assert.deepEqual(TOLERANCE_HELP.map((s) => s.title), ["About Running Tolerance", "Weekly Tolerance", "What Is Impact Load?"]);
		assert.deepEqual(TOLERANCE_HELP[2]!.parts.map((p) => p.heading), ["Understanding Impact Load", "Impact Load and Actual Distance", "Acute Impact Load"]);
	});
});
