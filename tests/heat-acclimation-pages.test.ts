import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	DAILY_PROGRESS,
	HEAT_ACCLIMATION,
	HEAT_ACCLIMATION_HELP,
	HEAT_THRESHOLD,
	NO_DATA,
	heatCopy,
	trendLine,
} from "../src/dashboard/heat-acclimation-copy";
import {
	HEAT_TICKS,
	HEAT_TICK_LABELS,
	heatAcclimationView,
	heatChart,
	heatRowOn,
	trendGlyph,
	type HeatAcclimationContext,
	type HeatAcclimationRoute,
	type HeatDayView,
	type HeatPeriodView,
} from "../src/dashboard/heat-acclimation-pages";
import { daysBetween, offsetOfDay } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { shiftDate } from "../src/sync/day-index";
import { HEAT_ACCLIMATION_INDEX, type HeatAcclimationRow } from "../src/sync/heat-acclimation-index";
import { BY_DATE, HEAT_ROWS, OCT_12_ROW, TODAY } from "./heat-acclimation-fixture";

/**
 * Golden numbers from ref/performance-stats/heat-acclimation/README.md: the
 * phone shots of Sunday 2026-10-11 21:18, the web of 22:46 and the payloads
 * of 2026-10-12 11:05–11:13 — the spec's 53 checks
 * (golden-heat-acclimation.py) that reach the page, and its predicted views
 * (ha_infer.py) for what the phone has not shown. The 7d and 4w windows roll
 * daily, so they only reproduce with today pinned.
 */

const CTX: HeatAcclimationContext = { today: TODAY, complete: true, units: "metric" };

function view(route: HeatAcclimationRoute, opts: { ctx?: Partial<HeatAcclimationContext>; rows?: readonly HeatAcclimationRow[] } = {}) {
	return heatAcclimationView(route, opts.rows ?? HEAT_ROWS, { ...CTX, ...opts.ctx });
}
const day = (offset: number, opts: Parameters<typeof view>[1] = {}) => view({ range: "1d", offset }, opts) as HeatDayView;
/** 1d on a day, as a 1d step or a day card would open it. */
const on = (date: string, opts: Parameters<typeof view>[1] = {}) => day(offsetOfDay(date, opts.ctx?.today ?? TODAY), opts);
const period = (range: "7d" | "4w", offset = 0, opts: Parameters<typeof view>[1] = {}) => view({ range, offset }, opts) as HeatPeriodView;
const values = (v: HeatPeriodView) => v.chart!.points.map((p) => p.value);
const repeat = (value: number, n: number) => Array.from({ length: n }, () => value);

/** The phone's copy, its four lines as the shot breaks them. */
const COPY = [
	"Keep training outdoors at temperatures of 22°C",
	"or higher to continue trending up. Your training",
	"status is automatically adjusted for changes in",
	"temperature.",
].join(" ");

describe("the fixture", () => {
	it("is the whole history: 431 rows from 2025-08-02 to the capture day, 2026-01-05..09 without a row", () => {
		assert.equal(HEAT_ROWS.length, 431);
		assert.deepEqual([HEAT_ROWS[0]!.date, HEAT_ROWS[HEAT_ROWS.length - 1]!.date], ["2025-08-02", TODAY]);
		const missing: string[] = [];
		for (let d = "2025-08-02"; d <= TODAY; d = shiftDate(d, 1)) if (!BY_DATE.has(d)) missing.push(d);
		assert.deepEqual(missing, ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
		// 152 rows in 2025 and 279 in 2026: two year files.
		assert.deepEqual([HEAT_ROWS.filter((r) => r.date < "2026").length, HEAT_ROWS.filter((r) => r.date >= "2026").length], [152, 279]);
		assert.ok(HEAT_ROWS.every((r) => HEAT_ACCLIMATION_INDEX.normalize(r) !== null && Number.isInteger(r.pct) && r.pct! >= 0 && r.pct! <= 100));
	});

	it("bears out Garmin's trend: null exactly at 0 %, ACCLIMATIZING exactly when the % rose, ACCLIMATIZED on every level day; two falling days say ACCLIMATIZED", () => {
		const count = (trend: string | undefined) => HEAT_ROWS.filter((r) => r.trend === trend).length;
		assert.deepEqual([count("ACCLIMATIZING"), count("ACCLIMATIZED"), count("DEACCLIMATIZING"), count(undefined)], [49, 117, 105, 160]);
		const odd: string[] = [];
		for (const r of HEAT_ROWS) {
			assert.equal(r.pct === 0, r.trend === undefined, r.date);
			assert.equal(r.pct! > r.prev!, r.trend === "ACCLIMATIZING", r.date);
			if (r.pct! > 0 && r.pct === r.prev) assert.equal(r.trend, "ACCLIMATIZED", r.date);
			if (r.pct! > 0 && r.pct! < r.prev! && r.trend !== "DEACCLIMATIZING") odd.push(r.date);
		}
		assert.deepEqual(odd, ["2025-11-02", "2026-07-11"]);
	});

	it("has the reading before as yesterday's % on 428 of 429 days: not on 2026-08-30, 100 from 100 after a 75", () => {
		const pairs = HEAT_ROWS.filter((r) => BY_DATE.has(shiftDate(r.date, -1)));
		const other = pairs.filter((r) => r.prev !== BY_DATE.get(shiftDate(r.date, -1))!.pct).map((r) => r.date);
		assert.deepEqual([pairs.length, other], [429, ["2026-08-30"]]);
	});
});

describe("1d — Today, Sunday 2026-10-11 (the phone's shot)", () => {
	const v = day(0);

	it("shows the up glyph, '97%', 'Trending up from 79%.' and the copy with 22°C", () => {
		assert.deepEqual([v.label, v.date, v.value, v.glyph, v.trendLine], ["Today", TODAY, "97%", "up", "Trending up from 79%."]);
		assert.equal(v.copy, COPY);
		assert.equal(v.empty, undefined);
	});

	it("reads 'from 79%' off the row's reading before (Oct 10's 79 here), and Garmin's trend as sent", () => {
		assert.deepEqual(v.row, { date: TODAY, pct: 97, prev: 79, trend: "ACCLIMATIZING" });
		assert.equal(BY_DATE.get("2026-10-10")!.pct, 79);
	});

	it("has '<' and no '>': older days exist, and today is the newest", () => {
		assert.deepEqual([v.canGoBack, v.canGoForward], [true, false]);
	});

	it("says 72°F for an imperial account (Inferred: 22 °C is 71.6 °F)", () => {
		assert.equal(day(0, { ctx: { units: "imperial" } }).copy, COPY.replace("22°C", "72°F"));
		// Units left out read metric.
		assert.equal(day(0, { ctx: { units: undefined } }).copy, COPY);
	});
});

describe("1d — other days", () => {
	it("−1 'Saturday, October 10': 79%, up, 'Trending up from 68%.', the same copy; '>' back to today", () => {
		const v = day(-1);
		assert.deepEqual([v.label, v.value, v.glyph, v.trendLine, v.canGoBack, v.canGoForward], ["Saturday, October 10", "79%", "up", "Trending up from 68%.", true, true]);
		assert.equal(v.copy, COPY);
	});

	it("−2 'Friday, October 9': 68%, down, 'Trending down from 100%.' and no copy (Inferred)", () => {
		const v = day(-2);
		assert.deepEqual([v.label, v.value, v.glyph, v.trendLine, v.copy], ["Friday, October 9", "68%", "down", "Trending down from 100%.", undefined]);
	});

	it("−3 'Thursday, October 8': 100%, flat, 'Maintaining acclimation.' (Home's card sentence) and no copy (Inferred)", () => {
		const v = day(-3);
		assert.deepEqual([v.label, v.value, v.glyph, v.trendLine, v.copy], ["Thursday, October 8", "100%", "flat", "Maintaining acclimation.", undefined]);
	});

	it("a 0 % day (Sunday, July 26): '0%' in an empty disc, no line and no copy (Inferred)", () => {
		const v = on("2026-07-26");
		assert.deepEqual([v.label, v.value, v.glyph, v.trendLine, v.copy, v.empty], ["Sunday, July 26", "0%", undefined, undefined, undefined, undefined]);
	});

	it("shows Garmin's trend as sent: two falling days that say ACCLIMATIZED read flat", () => {
		for (const [date, value] of [["2025-11-02", "85%"], ["2026-07-11", "33%"]] as const) {
			const v = on(date);
			assert.deepEqual([v.value, v.glyph, v.trendLine], [value, "flat", "Maintaining acclimation."], date);
		}
	});

	it("2026-08-30: the row's own reading before, 100, not yesterday's 75", () => {
		const v = on("2026-08-30");
		assert.deepEqual([v.row?.prev, BY_DATE.get("2026-08-29")!.pct, v.trendLine], [100, 75, "Maintaining acclimation."]);
	});

	it("a day without a row (Wednesday, January 7): the newest earlier row, Jan 4's, under the day viewed (Inferred)", () => {
		const v = on("2026-01-07");
		assert.deepEqual([v.label, v.date, v.row?.date, v.value, v.glyph], ["Wednesday, January 7", "2026-01-07", "2026-01-04", "0%", undefined]);
	});

	it("today before the watch syncs (Oct 12, 00:01): the overnight decay, 95% down from 97% (Inferred)", () => {
		const v = day(0, { rows: [...HEAT_ROWS, OCT_12_ROW], ctx: { today: "2026-10-12" } });
		assert.deepEqual([v.label, v.value, v.glyph, v.trendLine, v.copy], ["Today", "95%", "down", "Trending down from 97%.", undefined]);
		// Oct 11 is then yesterday, as the phone would step to it.
		assert.equal(day(-1, { rows: [...HEAT_ROWS, OCT_12_ROW], ctx: { today: "2026-10-12" } }).label, "Sunday, October 11");
	});

	it("the history's first day stops '<' once the index is whole; before it, the empty line (Inferred)", () => {
		const first = on("2025-08-02");
		assert.deepEqual([first.label, first.value, first.canGoBack], ["Saturday, August 2, 2025", "0%", false]);
		assert.equal(on("2025-08-02", { ctx: { complete: false } }).canGoBack, true);
		const before = on("2025-08-01");
		assert.deepEqual([before.empty, before.row, before.value, before.glyph, before.trendLine, before.copy, before.canGoBack], [NO_DATA, undefined, undefined, undefined, undefined, undefined, false]);
	});

	it("no rows ever: the empty line in place of the disc, '<' while the history may still come (Inferred)", () => {
		const v = day(0, { rows: [] });
		assert.deepEqual([v.label, v.empty, v.value], ["Today", NO_DATA, undefined]);
		assert.equal(day(0, { rows: [], ctx: { complete: false } }).canGoBack, true);
		assert.equal(v.canGoBack, false);
	});
});

describe("7d — Oct 5 – 11 (the phone's shot)", () => {
	const v = period("7d");

	it("is 'Oct 5 - 11', the current period: '<' and no '>'", () => {
		assert.deepEqual([v.range, v.label, v.from, v.to, v.canGoBack, v.canGoForward], ["7d", "Oct 5 - 11", "2026-10-05", TODAY, true, false]);
	});

	it("titles 'Daily Progress' and keys 'Heat Acclimation', on the fixed 100% … 0% axis in 25s", () => {
		assert.deepEqual([v.title, v.chart!.legend], [DAILY_PROGRESS, HEAT_ACCLIMATION]);
		assert.deepEqual([v.chart!.ticks, v.chart!.tickLabels], [[100, 75, 50, 25, 0], ["100%", "75%", "50%", "25%", "0%"]]);
		assert.equal(v.empty, undefined);
	});

	it("plots every day's %: 100 100 100 100 68 79 97, a dot a day at its slot", () => {
		assert.deepEqual(values(v), [100, 100, 100, 100, 68, 79, 97]);
		assert.deepEqual(v.chart!.points.map((p) => [p.date, p.x]), Array.from({ length: 7 }, (_, i) => [shiftDate("2026-10-05", i), i / 6]));
	});

	it("puts the dots where the phone has them: y 319.33 ×4, 366.0, 350.0, 324.0 and x 53.78 pt apart, within 0.35 pt (the Garmin page's frame)", () => {
		// The phone's plot (ref README, Chart): x 46.17 → 368.83, y 465.17 at 0 % less 1.4567 pt a %.
		const measured = [319.33, 319.33, 319.33, 319.33, 366.0, 350.0, 324.0];
		v.chart!.points.forEach((p, i) => {
			assert.ok(Math.abs(465.17 - 1.4567 * p.value - measured[i]!) <= 0.35, `${p.date} y`);
			assert.ok(Math.abs(46.17 + 322.67 * p.x - (46.17 + 53.78 * i)) <= 0.05, `${p.date} x`);
		});
	});

	it("has an axis dot a day, the ends large and labelled '10-05' and '10-11'", () => {
		const { dots, labels } = v.chart!.axis;
		assert.deepEqual(dots.map((d) => d.large), [true, false, false, false, false, false, true]);
		assert.deepEqual(dots.map((d) => d.x), [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]);
		assert.deepEqual(labels, [
			{ x: 0, text: "10-05" },
			{ x: 1, text: "10-11" },
		]);
	});
});

describe("4w — Sep 14 – Oct 11 (the phone's shot)", () => {
	const v = period("4w");

	it("is 'Sep 14 - Oct 11', the current period", () => {
		assert.deepEqual([v.range, v.label, v.from, v.to, v.canGoBack, v.canGoForward], ["4w", "Sep 14 - Oct 11", "2026-09-14", TODAY, true, false]);
	});

	it("plots 100 for 25 days, then 68, 79 and 97, a dot a day 1/27 of the plot apart", () => {
		assert.deepEqual(values(v), [...repeat(100, 25), 68, 79, 97]);
		assert.deepEqual(v.chart!.points.map((p) => p.x), Array.from({ length: 28 }, (_, i) => i / 27));
	});

	it("has 28 axis dots, the ends large and labelled '09-14' and '10-11'", () => {
		const { dots, labels } = v.chart!.axis;
		assert.equal(dots.length, 28);
		assert.deepEqual(dots.filter((d) => d.large).map((d) => d.x), [0, 1]);
		assert.deepEqual(labels.map((l) => l.text), ["09-14", "10-11"]);
	});
});

describe("previous periods (Inferred)", () => {
	it("7d − 1 is 'Sep 28 - Oct 4': 100 ×7, '09-28' / '10-04', with '>'", () => {
		const v = period("7d", -1);
		assert.deepEqual([v.label, v.from, v.to, v.canGoBack, v.canGoForward], ["Sep 28 - Oct 4", "2026-09-28", "2026-10-04", true, true]);
		assert.deepEqual(values(v), repeat(100, 7));
		assert.deepEqual(v.chart!.axis.labels.map((l) => l.text), ["09-28", "10-04"]);
	});

	it("4w − 1 is 'Aug 17 - Sep 13': the fall to 17, back to 100 on Aug 30", () => {
		const v = period("4w", -1);
		assert.deepEqual([v.label, v.from, v.to], ["Aug 17 - Sep 13", "2026-08-17", "2026-09-13"]);
		assert.deepEqual(values(v), [84, 67, 52, 38, 19, 17, 34, 57, 57, 53, 52, 50, 75, ...repeat(100, 15)]);
		assert.deepEqual(v.chart!.axis.labels.map((l) => l.text), ["08-17", "09-13"]);
	});

	it("4w − 2 is 'Jul 20 - Aug 16': a week of 0 % on the 0 % line, then the climb", () => {
		const v = period("4w", -2);
		assert.deepEqual([v.label, v.from, v.to], ["Jul 20 - Aug 16", "2026-07-20", "2026-08-16"]);
		assert.deepEqual(values(v), [...repeat(0, 7), 25, 25, 25, 50, 50, 75, 75, 75, 75, 75, 73, 91, ...repeat(100, 9)]);
	});

	it("a period over Jan 5–9: no dot on those days, the others at their own slots (the line bridges the gap)", () => {
		// Dec 15 – Jan 11, the spec's phone to-do.
		const chart = heatChart(HEAT_ROWS, { from: "2025-12-15", to: "2026-01-11" })!;
		assert.equal(chart.points.length, 23);
		assert.equal(chart.axis.dots.length, 28);
		const xs = chart.points.map((p) => Math.round(p.x * 27));
		assert.deepEqual(xs, [...Array.from({ length: 21 }, (_, i) => i), 26, 27]);
		// 4w − 9 starts on the gap: nothing comes in from before the period.
		const v = period("4w", -9);
		assert.deepEqual([v.label, v.chart!.points[0]!.date, v.chart!.points[0]!.x], ["Jan 5 - Feb 1", "2026-01-10", 5 / 27]);
	});

	it("the period holding the first day ends '<' once the index is whole; the one before it is the empty line", () => {
		const first = period("4w", -15);
		assert.deepEqual([first.label, first.chart!.points[0]!.date, first.canGoBack], ["Jul 21-Aug 17, 2025", "2025-08-02", false]);
		assert.equal(first.chart!.points[0]!.x, daysBetween("2025-07-21", "2025-08-02") / 27);
		const before = period("4w", -16);
		assert.deepEqual([before.label, before.chart, before.empty, before.title, before.canGoBack, before.canGoForward], ["Jun 23-Jul 20, 2025", null, NO_DATA, DAILY_PROGRESS, false, true]);
		// While the history walk is still out, '<' stays.
		assert.equal(period("4w", -16, { ctx: { complete: false } }).canGoBack, true);
	});

	it("no rows ever: the empty line on both ranges (Inferred)", () => {
		for (const range of ["7d", "4w"] as const) {
			const v = period(range, 0, { rows: [] });
			assert.deepEqual([v.chart, v.empty, v.canGoBack], [null, NO_DATA, false]);
		}
	});

	it("today before the watch syncs, 7d ends on the decay row: Oct 6 – 12 (Inferred)", () => {
		const v = period("7d", 0, { rows: [...HEAT_ROWS, OCT_12_ROW], ctx: { today: "2026-10-12" } });
		assert.deepEqual([v.label, values(v)], ["Oct 6 - 12", [100, 100, 100, 68, 79, 97, 95]]);
	});
});

describe("the parts", () => {
	it("the registry's page: 1d · 7d · 4w, its default spans, the index's group, opened from Training Status and Home's Heat card", () => {
		const stat = PERFORMANCE_REGISTRY.page("heat-acclimation")!;
		assert.deepEqual([stat.ranges, stat.defaultRange, stat.hub, stat.group, stat.glance, stat.spans], [["1d", "7d", "4w"], "1d", false, HEAT_ACCLIMATION_INDEX.group, ["heat"], undefined]);
		assert.equal(stat.title, HEAT_ACCLIMATION);
	});

	it("a row on or before a day: the newest with a %, rows oldest first", () => {
		assert.equal(heatRowOn(HEAT_ROWS, TODAY)?.date, TODAY);
		assert.equal(heatRowOn(HEAT_ROWS, "2026-10-20")?.date, TODAY);
		assert.equal(heatRowOn(HEAT_ROWS, "2026-01-09")?.date, "2026-01-04");
		assert.equal(heatRowOn(HEAT_ROWS, "2025-08-01"), undefined);
		assert.equal(heatRowOn([{ date: "2026-10-10", pct: 79 }, { date: "2026-10-11", altitude: 0 }], TODAY)?.date, "2026-10-10");
	});

	it("a glyph a trend: up, flat, down; none at 0 % or for a word never seen", () => {
		assert.deepEqual(["ACCLIMATIZING", "ACCLIMATIZED", "DEACCLIMATIZING", "acclimatizing", undefined, "MAXIMUM"].map(trendGlyph), ["up", "flat", "down", "up", undefined, undefined]);
	});

	it("a trend line: up and down from the reading before, Home's words without one; none at 0 %", () => {
		assert.equal(trendLine("ACCLIMATIZING", 79), "Trending up from 79%.");
		assert.equal(trendLine("DEACCLIMATIZING", 100), "Trending down from 100%.");
		assert.equal(trendLine("ACCLIMATIZED", 100), "Maintaining acclimation.");
		assert.deepEqual([trendLine("ACCLIMATIZING", undefined), trendLine("DEACCLIMATIZING", undefined)], ["Improving acclimation.", "Losing acclimation."]);
		assert.deepEqual([trendLine(undefined, 0), trendLine("MAXIMUM", 50)], [undefined, undefined]);
	});

	it("copy for ACCLIMATIZING only, the threshold in the account's units", () => {
		assert.equal(heatCopy("ACCLIMATIZING"), COPY);
		assert.equal(heatCopy("ACCLIMATIZING", "imperial"), COPY.replace("22°C", "72°F"));
		assert.deepEqual(["ACCLIMATIZED", "DEACCLIMATIZING", undefined].map((t) => heatCopy(t)), [undefined, undefined, undefined]);
		assert.deepEqual(HEAT_THRESHOLD, { metric: "22°C", imperial: "72°F" });
	});

	it("the Help sheet: the Training Status help's Heat Acclimation section, with its '22°C or greater'", () => {
		assert.equal(HEAT_ACCLIMATION_HELP.length, 1);
		const [section] = HEAT_ACCLIMATION_HELP;
		assert.equal(section!.title, HEAT_ACCLIMATION);
		assert.deepEqual(section!.parts.map((p) => p.heading), ["Adjusting to the Heat", "Acclimation Basics", "How to Acclimate"]);
		assert.ok(section!.parts[1]!.paragraphs[0]!.includes("When you train in the heat (22°C or greater)"));
	});

	it("ticks fixed at 0–100 % in 25s, whatever the period holds", () => {
		assert.deepEqual([HEAT_TICKS, HEAT_TICK_LABELS], [[100, 75, 50, 25, 0], ["100%", "75%", "50%", "25%", "0%"]]);
		assert.deepEqual(period("4w", -2).chart!.ticks, HEAT_TICKS);
	});
});
