import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HRV_STRESS_HELP, HRV_STRESS_LEVELS, HRV_STRESS_TITLE, LEVEL_TABLE, NO_DATA_AVAILABLE } from "../src/dashboard/hrv-stress-copy";
import { HRV_STRESS_Y, hrvStressLevel, hrvStressView, type HrvStressContext, type HrvStressView } from "../src/dashboard/hrv-stress-pages";
import { daysBetween, type PeriodRange } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { performanceStatRoute } from "../src/dashboard/routes";
import { HRV_STRESS_INDEX, rowsOfHrvStress, type HrvStressRow } from "../src/sync/hrv-stress-index";

/**
 * Golden numbers from ref/performance-stats/hrv-stress/README.md: the phone
 * shots of Sunday 2026-10-11 21:30, the web report of 23:06 and the route as
 * Garmin answered it on Oct 12. The account has never run a test, so the
 * index is complete and empty and both ranges are the bare empty page; the
 * bars are Inferred and tested on synthetic tests through the index's own
 * mapper. The windows roll daily, so the spans reproduce only with today
 * pinned.
 */
const TODAY = "2026-10-11";
const EMPTY: HrvStressContext = { today: TODAY, complete: true };

const view = (range: PeriodRange, opts: { offset?: number; rows?: readonly HrvStressRow[]; ctx?: Partial<HrvStressContext> } = {}): HrvStressView =>
	hrvStressView({ range, offset: opts.offset ?? 0 }, opts.rows ?? [], { ...EMPTY, ...opts.ctx });

/** The phone's day axis runs from x 26.83 to 376.83: wider than Critical Swim Speed's, there being no y labels. */
const AXIS = { left: 26.83, right: 376.83 } as const;
const axisX = (fraction: number) => AXIS.left + fraction * (AXIS.right - AXIS.left);

/** Synthetic tests (Inferred shape), through the index's mapper as a window would bring them. */
const TESTS: HrvStressRow[] = rowsOfHrvStress([
	{ calendarDate: "2026-09-01", stressLevel: 50 },
	{ calendarDate: "2026-10-06", stressLevel: 20 },
	{ calendarDate: "2026-10-08", timestampLocal: "2026-10-08T07:00:00.0", stressLevel: 40 },
	{ calendarDate: "2026-10-08", timestampLocal: "2026-10-08T21:00:00.0", stressLevel: 75 },
	{ calendarDate: "2026-10-11", stressLevel: 95 },
]).map((r) => HRV_STRESS_INDEX.normalize(r)!);

describe("7d, Oct 5 – Oct 11, no test ever", () => {
	const v = view("7d");

	it('"Oct 5 - 11", seven days: daily-2026-10-05_2026-10-11 is []', () => {
		assert.deepEqual([v.range, v.label, v.span], ["7d", "Oct 5 - 11", { from: "2026-10-05", to: "2026-10-11" }]);
		assert.equal(daysBetween(v.span.from, v.span.to) + 1, 7);
	});

	it('is almost bare: "No data available", no bars, no y axis', () => {
		assert.deepEqual([v.empty, v.bars, v.y], ["No data available", [], null]);
		assert.equal(NO_DATA_AVAILABLE, "No data available");
	});

	it('keeps the day axis: 7 dots, the ends large and labelled "10-05" "10-11", 58.33 pt apart', () => {
		const { dots, labels } = v.axis;
		assert.equal(dots.length, 7);
		assert.deepEqual(dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 6]);
		assert.deepEqual(labels, [{ x: 0, text: "10-05" }, { x: 1, text: "10-11" }]);
		dots.forEach((d, i) => assert.ok(Math.abs(axisX(d.x) - (26.83 + 58.33 * i)) <= 0.34, `dot ${i}`));
	});

	it('turns "<" off once the index is complete with no test (DECISION: Blood Pressure\'s canStepBack, not the phone\'s always-on "<")', () => {
		assert.equal(v.canGoBack, false);
		assert.equal(view("7d", { ctx: { complete: false } }).canGoBack, true);
	});
});

describe("4w, Sep 14 – Oct 11, no test ever", () => {
	const v = view("4w");

	it('"Sep 14 - Oct 11", the phone\'s rolling 28 days (daily-2026-09-14_2026-10-11 is []), not the web\'s Sunday block', () => {
		assert.deepEqual([v.range, v.label, v.span], ["4w", "Sep 14 - Oct 11", { from: "2026-09-14", to: "2026-10-11" }]);
		assert.equal(daysBetween(v.span.from, v.span.to) + 1, 28);
		// The web's 4w, daily-web4w-2026-09-20_2026-10-11 (also []), is not followed.
		assert.notEqual(v.label, "Sep 20 - Oct 11");
	});

	it('"No data available" and 28 dots, the ends large and labelled "09-14" "10-11", 12.96 pt apart', () => {
		assert.deepEqual([v.empty, v.bars, v.y, v.canGoBack], [NO_DATA_AVAILABLE, [], null, false]);
		assert.equal(v.axis.dots.length, 28);
		assert.deepEqual(v.axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 27]);
		assert.deepEqual(v.axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
		v.axis.dots.forEach((d, i) => assert.ok(Math.abs(axisX(d.x) - (26.83 + (350 / 27) * i)) <= 0.3, `dot ${i}`));
		assert.ok(Math.abs(350 / 27 - 12.96) < 0.01);
	});
});

describe("the registry and the route", () => {
	it("are 7d and 4w, opening on 7d, on the hrv group the index belongs to", () => {
		const stat = PERFORMANCE_REGISTRY.page("hrv-stress")!;
		assert.deepEqual([stat.title, stat.ranges, stat.defaultRange, stat.group, stat.spans], ["HRV Stress", ["7d", "4w"], "7d", "hrv", undefined]);
		assert.equal(HRV_STRESS_INDEX.group, stat.group);
		assert.equal(hrvStressView(performanceStatRoute("hrv-stress"), [], EMPTY).range, "7d");
	});

	it("open on 7d for a range the page doesn't have", () => {
		assert.deepEqual(view("1y"), view("7d"));
		assert.deepEqual(view("1d"), view("7d"));
	});
});

describe("previous periods (Inferred: unseen, each the bare empty page)", () => {
	it('7d −1 "Sep 28 - Oct 4", 09-28 / 10-04; 4w −1 "Aug 17 - Sep 13", 08-17 / 09-13: the samples for both are []', () => {
		const week = view("7d", { offset: -1 });
		assert.deepEqual([week.label, week.span, week.axis.labels.map((l) => l.text)], ["Sep 28 - Oct 4", { from: "2026-09-28", to: "2026-10-04" }, ["09-28", "10-04"]]);
		const month = view("4w", { offset: -1 });
		assert.deepEqual([month.label, month.span, month.axis.labels.map((l) => l.text)], ["Aug 17 - Sep 13", { from: "2026-08-17", to: "2026-09-13" }, ["08-17", "09-13"]]);
		for (const v of [week, month]) assert.deepEqual([v.empty, v.bars, v.canGoBack], [NO_DATA_AVAILABLE, [], false]);
	});
});

describe("the Help sheet (the web dialog's; the phone's unseen)", () => {
	it('is titled "HRV Stress", its sections the web\'s', () => {
		assert.equal(HRV_STRESS_HELP.title, HRV_STRESS_TITLE);
		assert.deepEqual(HRV_STRESS_HELP.sections.map((s) => s.title), [undefined, "What Is HRV Stress?", "About Your Readings", "How to Get a Measurement"]);
		assert.deepEqual(HRV_STRESS_HELP.sections.flatMap((s) => s.parts.map((p) => p.heading ?? "")), ["", "A One-Time Stress Reading", "Using Your HRV Stress Reading", "Receiving a Reading"]);
		assert.equal(
			HRV_STRESS_HELP.sections[0]!.parts[0]!.paragraphs[0],
			"The HRV Stress test gives you a baseline stress reading to determine if your body is ready for training.",
		);
	});

	it('rates 0 to 100, lower readier, in the table "Low 1-34 Moderate 35-69 High 70-89 Very High 90-100"', () => {
		const about = HRV_STRESS_HELP.sections[2]!.parts[0]!;
		assert.equal(about.paragraphs[1], "HRV stress is rated on a scale of 0 to 100. In general, lower HRV stress scores indicate a greater preparedness for high-impact training.");
		assert.equal(about.note, "Low 1-34 Moderate 35-69 High 70-89 Very High 90-100");
		assert.equal(LEVEL_TABLE, about.note);
		assert.deepEqual(HRV_STRESS_LEVELS.map((l) => [l.label, l.min, l.max]), [["Low", 1, 34], ["Moderate", 35, 69], ["High", 70, 89], ["Very High", 90, 100]]);
	});

	it("grades a score by the table's lower ends; a 0 (below the table) reads as Low", () => {
		assert.deepEqual(
			[0, 1, 34, 35, 69, 70, 89, 90, 100].map(hrvStressLevel),
			["low", "low", "low", "moderate", "moderate", "high", "high", "very-high", "very-high"],
		);
	});
});

describe("with tests (Inferred)", () => {
	it("7d: a bar a day with a test, its last score on 0–100 in its level, at its day's dot", () => {
		const v = view("7d", { rows: TESTS });
		assert.deepEqual(
			v.bars.map((b) => [b.date, Math.round(b.x * 6), b.score, b.n, b.level]),
			[
				["2026-10-06", 1, 20, 1, "low"],
				// Two tests on Oct 8: the evening's 75 wins.
				["2026-10-08", 3, 75, 2, "high"],
				["2026-10-11", 6, 95, 1, "very-high"],
			],
		);
		assert.deepEqual([v.y, v.empty, v.canGoBack], [HRV_STRESS_Y, undefined, true]);
		assert.deepEqual(HRV_STRESS_Y, { max: 100, ticks: [100, 75, 50, 25, 0] });
	});

	it("4w: the same bars on the 28-day axis; 4w −1 holds Sep 1's and is where '<' stops", () => {
		const v = view("4w", { rows: TESTS });
		assert.deepEqual(v.bars.map((b) => [b.date, Math.round(b.x * 27)]), [["2026-10-06", 22], ["2026-10-08", 24], ["2026-10-11", 27]]);
		const before = view("4w", { offset: -1, rows: TESTS });
		assert.deepEqual(before.bars.map((b) => [b.date, Math.round(b.x * 27), b.level]), [["2026-09-01", 15, "moderate"]]);
		assert.equal(before.canGoBack, false);
		assert.equal(view("4w", { offset: -1, rows: TESTS, ctx: { complete: false } }).canGoBack, true);
	});

	it("a period between tests is the bare empty page, '<' still on", () => {
		const v = view("7d", { offset: -2, rows: TESTS });
		assert.deepEqual([v.label, v.bars, v.y, v.empty, v.canGoBack], ["Sep 21 - 27", [], null, NO_DATA_AVAILABLE, true]);
	});
});
