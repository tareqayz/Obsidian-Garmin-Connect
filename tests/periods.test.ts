import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
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
	meanOf,
	monthAxis,
	offsetOfDay,
	periodLabel,
	periodOf,
	periodSeriesDays,
	rangeLabel,
	rollingWeeks,
	stepRoute,
	switchRange,
	weekCardRoute,
	weekOffset,
	weekTitle,
	weekdayOf,
	weeksOf,
	yearLabel,
	type PeriodRoute,
} from "../src/dashboard/periods";

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
		assert.deepEqual(periodSeriesDays({ range: "1d", offset: -1 }, TODAY), ["2026-10-07"]);
		assert.deepEqual(periodSeriesDays({ range: "1y", offset: 0 }, TODAY), []);
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
