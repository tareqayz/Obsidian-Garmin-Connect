import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HEALTH_STATS } from "../src/dashboard/health-stats";
import {
	addMonths,
	axisDay,
	canStepBack,
	cardDate,
	dayAxis,
	dayCardRoute,
	dayLabel,
	dayOf,
	daysOf,
	defaultSpan,
	meanOf,
	monthAxis,
	monthEndsOf,
	monthLabel,
	monthsLabel,
	offsetOfDay,
	PERIOD_RANGES,
	periodLabel,
	periodOf,
	rangeLabel,
	rollingWeeks,
	spanOf,
	stepRoute,
	switchRange,
	weekCardRoute,
	weekOffset,
	weekStartOf,
	weekTitle,
	weekdayOf,
	weeksOf,
	yearLabel,
	type PeriodRange,
	type PeriodRoute,
	type SpanRule,
} from "../src/dashboard/periods";
import { shiftDate } from "../src/dashboard/series";
import { spanRuleOf } from "../src/dashboard/stat-registry";

/** The day Stress was measured, which these rules come from. */
const TODAY = "2026-10-08";

describe("spans", () => {
	it("roll back from today a whole period at a time", () => {
		assert.deepEqual(periodOf("7d", 0, TODAY), { from: "2026-10-02", to: "2026-10-08" });
		assert.deepEqual(periodOf("7d", -1, TODAY), { from: "2026-09-25", to: "2026-10-01" });
		assert.deepEqual(periodOf("4w", 0, TODAY), { from: "2026-09-11", to: "2026-10-08" });
		assert.deepEqual(periodOf("4w", -1, TODAY), { from: "2026-08-14", to: "2026-09-10" });
		assert.deepEqual(periodOf("1y", 0, TODAY), { from: "2025-10-10", to: "2026-10-08" });
		assert.deepEqual(periodOf("1y", -1, TODAY), { from: "2024-10-11", to: "2025-10-09" });
		// A later period than now is the current one.
		assert.deepEqual(periodOf("7d", 3, TODAY), periodOf("7d", 0, TODAY));
		assert.equal(daysOf(periodOf("4w", 0, TODAY)).length, 28);
	});

	it("give a year fifty-two rolling weeks ending on its last day, never calendar weeks", () => {
		const weeks = rollingWeeks(TODAY);
		assert.equal(weeks.length, 52);
		assert.deepEqual(weeks[0], { from: "2025-10-10", to: "2025-10-16" });
		assert.deepEqual(weeks[51], { from: "2026-10-02", to: "2026-10-08" });
		assert.deepEqual(rollingWeeks(TODAY, 2), [
			{ from: "2026-09-25", to: "2026-10-01" },
			{ from: "2026-10-02", to: "2026-10-08" },
		]);
	});

	it("days and offsets: today is 0, never −0, a day to come is today", () => {
		assert.equal(dayOf({ offset: -1 }, TODAY), "2026-10-07");
		assert.equal(dayOf({ offset: 2 }, TODAY), TODAY);
		assert.ok(Object.is(offsetOfDay(TODAY, TODAY), 0));
		assert.equal(offsetOfDay("2026-10-05", TODAY), -3);
		assert.equal(offsetOfDay("2026-10-09", TODAY), 0);
		assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
		assert.equal(addMonths("2025-10-10", 12), "2026-10-10");
	});

	it("can step back while history exists, or may: the index is still coming", () => {
		assert.equal(canStepBack("2025-08-02", true, "2025-08-01"), false);
		assert.equal(canStepBack("2025-08-02", true, "2025-08-03"), true);
		assert.equal(canStepBack(undefined, true, TODAY), false);
		assert.equal(canStepBack(undefined, false, TODAY), true);
	});
});

describe("routes", () => {
	it("1d reopens on the day it last showed; the other ranges on the current period", () => {
		const day: PeriodRoute = { range: "1d", offset: -3 };
		const week = switchRange(day, "7d", TODAY);
		assert.deepEqual(week, { range: "7d", offset: 0, date: "2026-10-05" });
		assert.deepEqual(switchRange(stepRoute(week, -2), "4w", TODAY), { range: "4w", offset: 0, date: "2026-10-05" });
		assert.deepEqual(switchRange(week, "1d", TODAY), day);
		assert.deepEqual(switchRange({ range: "4w", offset: -1 }, "1d", TODAY), { range: "1d", offset: 0 });
		assert.equal(switchRange(day, "1d", TODAY), day);
	});

	it("step a whole period, never past the current one, never to −0", () => {
		assert.deepEqual(stepRoute({ range: "7d", offset: 0 }, -1), { range: "7d", offset: -1 });
		assert.ok(Object.is(stepRoute({ range: "7d", offset: -1 }, 1).offset, 0));
		assert.equal(stepRoute({ range: "7d", offset: 0 }, 1).offset, 0);
	});

	it("switch the page in place from a card: a day to 1d, a week to 7d", () => {
		assert.deepEqual(dayCardRoute("2026-10-05", TODAY), { range: "1d", offset: -3 });
		assert.equal(weekOffset("2025-10-22", "2026-10-07"), -50);
		assert.deepEqual(weekCardRoute({ range: "1y", offset: 0, date: "2026-10-05" }, "2026-10-01", TODAY), { range: "7d", offset: -1, date: "2026-10-05" });
	});
});

describe("labels", () => {
	it("name a day, a week, four weeks and a year the app's way", () => {
		assert.deepEqual(
			["2026-10-08", "2026-10-07", "2025-10-22"].map((d) => dayLabel(d, TODAY)),
			["Today", "Wednesday, October 7", "Wednesday, October 22, 2025"],
		);
		assert.equal(periodLabel("2026-10-02", "2026-10-08", TODAY), "Oct 2 - 8");
		assert.equal(periodLabel("2026-09-25", "2026-10-01", TODAY), "Sep 25 - Oct 1");
		assert.equal(periodLabel("2025-10-16", "2025-10-22", TODAY), "Oct 16-22, 2025");
		assert.equal(periodLabel("2025-09-25", "2025-10-01", TODAY), "Sep 25-Oct 1, 2025");
		assert.equal(periodLabel("2025-12-29", "2026-01-04", TODAY), "Dec 29, 2025 - Jan 4, 2026");
		assert.equal(yearLabel("2025-10-10", TODAY), "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(rangeLabel("1d", { from: TODAY, to: TODAY }, TODAY), "Today");
		assert.equal(rangeLabel("7d", periodOf("7d", 0, TODAY), TODAY), "Oct 2 - 8");
		assert.equal(rangeLabel("1y", periodOf("1y", 0, TODAY), TODAY), "Oct 10, 2025 - Oct 8, 2026");
	});

	it("title a week card in the phone's four ways, the year by the week's last day", () => {
		const title = (from: string, to: string) => weekTitle(from, to, TODAY);
		assert.equal(title("2026-10-01", "2026-10-07"), "October 1 - 7");
		assert.equal(title("2026-08-27", "2026-09-02"), "Aug 27 - Sep 2");
		assert.equal(title("2025-12-25", "2025-12-31"), "December 25 - 31, 2025");
		assert.equal(title("2025-11-27", "2025-12-03"), "Nov 27 - 3, 2025");
		// Across New Year, the week belongs to the year it ends in.
		assert.equal(title("2025-12-31", "2026-01-06"), "Dec 31 - Jan 6");
	});

	it("date a card and an axis end", () => {
		assert.equal(weekdayOf("2026-10-07"), "Wednesday");
		assert.equal(cardDate("2026-10-07", TODAY), "October 7");
		assert.equal(cardDate("2025-10-22", TODAY), "October 22, 2025");
		assert.equal(axisDay("2026-09-11"), "09-11");
	});
});

describe("axes", () => {
	it("put a dot a day across the plot, the ends large and labelled", () => {
		const axis = dayAxis(daysOf(periodOf("7d", 0, TODAY)));
		assert.deepEqual(axis.dots.map((d) => d.large), [true, false, false, false, false, false, true]);
		assert.deepEqual(axis.dots.map((d) => Math.round(d.x * 6)), [0, 1, 2, 3, 4, 5, 6]);
		assert.deepEqual(axis.labels, [
			{ x: 0, text: "10-02" },
			{ x: 1, text: "10-08" },
		]);
	});

	it("lay a year over twelve calendar months from its first day, its last week short of the end", () => {
		const { axis, x } = monthAxis("2025-10-10");
		assert.equal(axis.dots.length, 13);
		assert.deepEqual(
			axis.labels.map((l) => l.text),
			["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
		);
		assert.ok(axis.labels.every((l) => l.rotated));
		assert.equal(x("2026-10-02"), 357 / 365);
		// A year starting on the 31st puts its dots on each month's last day.
		assert.equal(monthAxis("2026-01-31").axis.dots[1]!.x, 28 / 365);
	});
});

describe("means", () => {
	it("floor for Stress, round half up for Body Battery, Heart Rate and Respiration", () => {
		assert.equal(meanOf([22, 28, 27, 22, 26, 27, 29], "floor"), 25);
		assert.equal(meanOf([22, 28, 27, 22, 26, 27, 29], "round"), 26);
		assert.equal(meanOf([30, 31], "floor"), 30);
		assert.equal(meanOf([30, 31], "round"), 31);
		assert.equal(meanOf([], "round"), undefined);
	});

	it("make a week the rounded mean of its own days, today's included, and leave out a week without any", () => {
		const rows = [
			{ date: "2026-10-02", v: 30 },
			{ date: "2026-10-03", v: 31 },
			{ date: "2026-10-08", v: 33 },
			{ date: "2026-09-27", v: 10 },
		];
		const floor = weeksOf(rows, TODAY, (r) => r.v, "floor");
		const round = weeksOf(rows, TODAY, (r) => r.v, "round");
		assert.deepEqual(floor[51], { from: "2026-10-02", to: "2026-10-08", value: 31, days: 3 });
		assert.equal(round[51]!.value, 31);
		assert.deepEqual(round[50], { from: "2026-09-25", to: "2026-10-01", value: 10, days: 1 });
		assert.deepEqual(floor[0], { from: "2025-10-10", to: "2025-10-16", days: 0 });
		assert.equal(weeksOf([{ date: "2026-10-08", v: 30 }, { date: "2026-10-07", v: 31 }], TODAY, (r) => r.v, "round")[51]!.value, 31);
	});
});

/** The day of the Performance Stats shots, a Sunday: every span rule below is checked on it. */
const SHOT_DAY = "2026-10-11";

describe("span rules, today 2026-10-11", () => {
	const span = (rule: SpanRule, offset = 0) => spanOf(rule, offset, SHOT_DAY);

	it("list the ranges in the range control's order, Performance's among Health's", () => {
		assert.deepEqual(PERIOD_RANGES, ["1d", "7d", "4w", "12w", "3m", "6m", "1y"]);
	});

	it("count days ending today by default: 7d 7, 4w 28, 12w 84, 6m 182, 1y 364; 3m counts months", () => {
		assert.deepEqual(
			(["7d", "4w", "12w", "3m", "6m", "1y"] as const).map(defaultSpan),
			[{ days: 7 }, { days: 28 }, { days: 84 }, { months: 3 }, { days: 182 }, { days: 364 }],
		);
		assert.deepEqual(periodOf("7d", 0, SHOT_DAY), { from: "2026-10-05", to: "2026-10-11" });
		assert.deepEqual(periodOf("4w", 0, SHOT_DAY), { from: "2026-09-14", to: "2026-10-11" });
		assert.deepEqual(periodOf("12w", 0, SHOT_DAY), { from: "2026-07-20", to: "2026-10-11" });
		assert.deepEqual(periodOf("12w", -1, SHOT_DAY), { from: "2026-04-27", to: "2026-07-19" });
		assert.deepEqual(periodOf("3m", 0, SHOT_DAY), { from: "2026-07-12", to: "2026-10-11" });
		assert.deepEqual(periodOf("6m", 0, SHOT_DAY), { from: "2026-04-13", to: "2026-10-11" });
		assert.deepEqual(periodOf("1y", 0, SHOT_DAY), { from: "2025-10-13", to: "2026-10-11" });
		assert.equal(rangeLabel("6m", periodOf("6m", 0, SHOT_DAY), SHOT_DAY), "Apr 13 - Oct 11");
	});

	it("weeks: the week so far, then whole weeks back from its first day", () => {
		const sundays = { weeks: 12, weekStart: 0 };
		assert.deepEqual(span(sundays), { from: "2026-07-26", to: "2026-10-11" });
		assert.deepEqual(span(sundays, -1), { from: "2026-05-03", to: "2026-07-25" });
		assert.equal(daysOf(span(sundays, -1)).length, 84);
		assert.deepEqual(span({ weeks: 52, weekStart: 0 }), { from: "2025-10-19", to: "2026-10-11" });
		// Monday weeks end on this Sunday: the same twelve weeks as 84 days.
		assert.deepEqual(span({ weeks: 12, weekStart: 1 }), span({ days: 84 }));
		// Wednesday weeks have five days of this one so far.
		assert.deepEqual(span({ weeks: 2, weekStart: 3 }), { from: "2026-09-30", to: "2026-10-11" });
		assert.deepEqual(span({ weeks: 2, weekStart: 3 }, -1), { from: "2026-09-16", to: "2026-09-29" });
	});

	it("months: from n months back, plus a day, to today", () => {
		assert.deepEqual(span({ months: 3 }), { from: "2026-07-12", to: "2026-10-11" });
		assert.deepEqual(span({ months: 3 }, -1), { from: "2026-04-12", to: "2026-07-11" });
		assert.deepEqual(span({ months: 12 }), { from: "2025-10-12", to: "2026-10-11" });
		assert.deepEqual(span({ months: 12 }, -1), { from: "2024-10-12", to: "2025-10-11" });
	});

	it("calendar months: this month so far and the whole months before it", () => {
		const calendar = { months: 12, calendar: true };
		assert.deepEqual(span(calendar), { from: "2025-11-01", to: "2026-10-11" });
		assert.deepEqual(span(calendar, -1), { from: "2024-11-01", to: "2025-10-31" });
		assert.equal(monthsLabel(span(calendar).from, span(calendar).to), "Nov 2025 - Oct 2026");
		assert.equal(monthsLabel(span(calendar, -1).from, span(calendar, -1).to), "Nov 2024 - Oct 2025");
		assert.deepEqual(span({ months: 1, calendar: true }), { from: "2026-10-01", to: "2026-10-11" });
	});

	it("month ends: a point on each month end before this month, and today", () => {
		assert.deepEqual(span({ monthEnds: 6 }), { from: "2026-05-31", to: "2026-10-11" });
		assert.deepEqual(monthEndsOf(span({ monthEnds: 6 })), ["2026-05-31", "2026-06-30", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-11"]);
		assert.deepEqual(span({ monthEnds: 12 }), { from: "2025-11-30", to: "2026-10-11" });
		assert.equal(monthEndsOf(span({ monthEnds: 12 })).length, 12);
		// A past period ends on a month end, so it has no today point.
		assert.deepEqual(span({ monthEnds: 6 }, -1), { from: "2025-11-30", to: "2026-04-30" });
		assert.deepEqual(monthEndsOf(span({ monthEnds: 6 }, -1)), ["2025-11-30", "2025-12-31", "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
	});

	it("step back a whole rule at a time, each period ending the day before the next begins", () => {
		const rules: SpanRule[] = [
			{ days: 7 },
			{ days: 182 },
			{ weeks: 12, weekStart: 0 },
			{ weeks: 3, weekStart: 3 },
			{ months: 3 },
			{ months: 12 },
			{ months: 12, calendar: true },
		];
		for (const rule of rules) {
			for (const offset of [0, -1, -2, -7]) {
				assert.equal(shiftDate(span(rule, offset - 1).to, 1), span(rule, offset).from, `${JSON.stringify(rule)} at ${offset}`);
			}
			// A later period than now is the current one.
			assert.deepEqual(span(rule, 2), span(rule), JSON.stringify(rule));
		}
		// Month-end periods follow on from point to point.
		const before = monthEndsOf(span({ monthEnds: 6 }, -2));
		assert.equal(before[before.length - 1], "2025-10-31");
		assert.equal(span({ monthEnds: 6 }, -1).from, "2025-11-30");
		assert.deepEqual(span({ monthEnds: 6 }, 2), span({ monthEnds: 6 }));
	});

	it("find a week's first day for any week start", () => {
		assert.equal(weekStartOf(SHOT_DAY, 0), "2026-10-11");
		assert.equal(weekStartOf(SHOT_DAY, 1), "2026-10-05");
		assert.equal(weekStartOf(SHOT_DAY, 3), "2026-10-07");
		assert.equal(weekStartOf(SHOT_DAY, 6), "2026-10-10");
	});

	it("name a month and a run of calendar months", () => {
		assert.equal(monthLabel("2026-03"), "March 2026");
		assert.equal(monthLabel(SHOT_DAY), "October 2026");
		assert.equal(monthsLabel("2025-11-01", SHOT_DAY), "Nov 2025 - Oct 2026");
		assert.equal(periodLabel("2026-05-31", SHOT_DAY, SHOT_DAY), "May 31 - Oct 11");
	});

	it("switch and step a Performance page's route through its own ranges", () => {
		const route: PeriodRoute<PeriodRange> = { range: "12w", offset: -1 };
		assert.deepEqual(stepRoute(route, -1), { range: "12w", offset: -2 });
		assert.deepEqual(switchRange(route, "3m", SHOT_DAY), { range: "3m", offset: 0 });
		assert.deepEqual(switchRange({ range: "1d", offset: -2 }, "6m", SHOT_DAY), { range: "6m", offset: 0, date: "2026-10-09" });
		assert.deepEqual(weekCardRoute(route, "2026-10-04", SHOT_DAY), { range: "7d", offset: -1 });
	});
});

describe("Health's spans, today 2026-10-11", () => {
	it("are the defaults, so every Health page pages as it did", () => {
		for (const stat of HEALTH_STATS) {
			assert.equal(stat.spans, undefined, stat.id);
			for (const range of stat.ranges) {
				if (range === "1d") continue;
				for (const offset of [0, -1, -9]) {
					assert.deepEqual(spanOf(spanRuleOf(stat, range), offset, SHOT_DAY), periodOf(range, offset, SHOT_DAY), `${stat.id} ${range} ${offset}`);
				}
			}
		}
		assert.deepEqual(periodOf("7d", -1, SHOT_DAY), { from: "2026-09-28", to: "2026-10-04" });
		assert.deepEqual(periodOf("4w", -1, SHOT_DAY), { from: "2026-08-17", to: "2026-09-13" });
		assert.deepEqual(periodOf("1y", -1, SHOT_DAY), { from: "2024-10-14", to: "2025-10-12" });
	});
});
