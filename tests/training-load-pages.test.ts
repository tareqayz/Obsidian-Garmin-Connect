import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { primaryBenefit } from "../src/dashboard/activity-labels";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { activityRoute, performanceStatRoute, statTabs } from "../src/dashboard/routes";
import { acuteAxis, loadLabel, stepUp, type MarkedAxis } from "../src/dashboard/stat-charts";
import {
	FOCUS_COPY,
	FOCUS_COPY_LINES,
	FOCUS_HELP,
	LOAD_COPY,
	LOAD_COPY_LINES,
	LOAD_HELP,
	focusCopy,
	focusTitle,
	loadCopy,
} from "../src/dashboard/training-load-copy";
import {
	BAND,
	CHRONIC_SUB,
	RATIO_AXIS,
	RATIO_SUB,
	benefitName,
	chronicOf,
	exerciseSubtitle,
	exerciseTicks,
	focusBars,
	focusSpan,
	legendOf,
	listDate,
	loadGroup,
	loadTab,
	ratioValue,
	segmentOf,
	sportWord,
	trainingLoadView,
	withTrainingView,
	type AcuteChart,
	type ExerciseTabView,
	type FocusTabView,
	type RatioChart,
	type TrainingLoadContext,
	type TrainingLoadRoute,
	type TrainingTabView,
} from "../src/dashboard/training-load-pages";
import { NO_DATA } from "../src/dashboard/training-status-copy";
import type { ActivityRow } from "../src/sync/activity-index";
import { ACTIVITIES, BALANCES, DAYS, PHONE, STATUS, TODAY, dayOf } from "./training-load-fixture";

/**
 * Golden numbers from ref/performance-stats/training-load/README.md: the
 * phone shots of Sunday 2026-10-11 21:17–21:18, the web of 22:43–22:45 and
 * the payloads of 2026-10-12 09:41–09:43 — the spec's 31 checks
 * (golden-training-load.py) that reach the page, with the shots' own
 * positions for the values the charts will draw. Every span rolls daily, so
 * they reproduce only with today pinned.
 */

const CTX: TrainingLoadContext = {
	today: TODAY,
	units: "metric",
	days: DAYS,
	activities: ACTIVITIES,
	activitiesComplete: true,
	status: STATUS,
	statusComplete: true,
};

function view(tab: string, opts: { offset?: number; sub?: string; ctx?: Partial<TrainingLoadContext> } = {}) {
	const route: TrainingLoadRoute = { range: "4w", offset: opts.offset ?? 0, tab, ...(opts.sub ? { sub: opts.sub } : {}) };
	return trainingLoadView(route, { ...CTX, ...opts.ctx });
}
const focus = (opts: Parameters<typeof view>[1] = {}) => view("focus", opts) as FocusTabView;
const exercise = (opts: Parameters<typeof view>[1] = {}) => view("exercise", opts) as ExerciseTabView;
const training = (opts: Parameters<typeof view>[1] = {}) => view("training", opts) as TrainingTabView;
const acuteChart = (v: TrainingTabView) => v.chart as AcuteChart;
const ratioChart = (v: TrainingTabView) => v.chart as RatioChart;

/** A value at `at` of its axis on a chart running `height` pt up from `baseline`. */
const yAt = (at: number, baseline: number, top: number) => baseline - at * (baseline - top);
const near = (actual: number, expected: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (±${tolerance})`);
const worst = (pairs: ReadonlyArray<readonly [number, number]>) => Math.max(...pairs.map(([a, b]) => Math.abs(a - b)));

describe("the fixture", () => {
	it("is the 30 newest activities as the index keeps them: loads to the hundredth, the swim on its local day", () => {
		assert.equal(ACTIVITIES.length, 30);
		assert.deepEqual([ACTIVITIES[0]!.start, ACTIVITIES[29]!.start], ["2026-10-11T08:21:37", "2026-08-23T10:53:10"]);
		const swim = ACTIVITIES.find((a) => a.type === "lap_swimming")!;
		assert.deepEqual([swim.start, swim.load, swim.benefit, swim.distance], ["2026-09-14T23:50:17", 62.41, "RECOVERY", 1100]);
		// The stair climbing's distance of 0 is no distance.
		assert.equal(ACTIVITIES.find((a) => a.type === "stair_climbing")!.distance, undefined);
	});

	it("keeps Garmin's Load Focus loads as the day files do, rounded half up: 17.6895 is 18, not floor's 17", () => {
		const day = DAYS.find((d) => d.date === TODAY)!;
		assert.deepEqual(
			["load_anaerobic", "load_aerobic_high", "load_aerobic_low"].map((k) => day.values[k]),
			[18, 1355, 204],
		);
		assert.equal(Math.floor(BALANCES[TODAY]!.monthlyLoadAnaerobic as number), 17);
		assert.deepEqual(
			["anaerobic", "aerobic_high", "aerobic_low"].map((k) => [day.values[`load_${k}_target_min`], day.values[`load_${k}_target_max`]]),
			[
				[66, 267],
				[402, 869],
				[399, 800],
			],
		);
		assert.equal(day.text?.load_focus, "AEROBIC_LOW_SHORTAGE");
		// Oct 12 before the watch synced: the aggregated route's map is null, so the day has no Load Focus.
		assert.equal(DAYS.find((d) => d.date === "2026-10-12")!.values.load_aerobic_high, undefined);
	});

	it("has the Training Status index whole on Aug 17 – Oct 11", () => {
		const inSpan = STATUS.filter((r) => r.date >= "2026-08-17" && r.date <= TODAY);
		assert.equal(inSpan.length, 56);
		assert.ok(inSpan.every((r) => r.acute !== undefined && r.chronic !== undefined && r.ratio !== undefined && r.acwrFeedback !== undefined));
		assert.equal(STATUS[0]!.date, "2025-08-02");
	});
});

describe("the page", () => {
	it("is the registry's hidden Load: 4w only, tabs Load Focus · Exercise Load · Training Load", () => {
		const stat = PERFORMANCE_REGISTRY.page("training-load")!;
		assert.deepEqual([stat.title, stat.ranges, stat.hub], ["Load", ["4w"], false]);
		const route = performanceStatRoute("training-load");
		assert.deepEqual(
			statTabs(route).map((t) => [t.id, t.label, t.on]),
			[
				["focus", "Load Focus", true],
				["exercise", "Exercise Load", false],
				["training", "Training Load", false],
			],
		);
		assert.deepEqual(["focus", "exercise", "training", undefined, "other"].map(loadTab), ["focus", "exercise", "training", "focus", "focus"]);
	});

	it("draws each tab from its own source", () => {
		assert.equal(view("focus").tab, "focus");
		assert.equal(view("exercise").tab, "exercise");
		assert.equal(view("training").tab, "training");
		assert.equal(view("nonsense").tab, "focus");
	});
});

describe("Load Focus — Sunday 2026-10-11", () => {
	it("labels the record's own 28 days, Sep 14 - Oct 11, with no stepper", () => {
		const v = focus();
		assert.deepEqual([v.label, v.date, v.span], ["Sep 14 - Oct 11", TODAY, { from: "2026-09-14", to: TODAY }]);
		assert.deepEqual([v.steppers, v.canGoBack, v.canGoForward], [false, false, false]);
		assert.equal(v.empty, undefined);
	});

	it("shows Garmin's three loads, half up and grouped: 18, 1,355, 204", () => {
		const v = focus();
		assert.deepEqual(
			v.bars.map((b) => [b.label, b.text]),
			[
				["Anaerobic", "18"],
				["High Aerobic", "1,355"],
				["Low Aerobic", "204"],
			],
		);
	});

	it("titles AEROBIC_LOW_SHORTAGE and gives its copy word for word (phone = web)", () => {
		const v = focus();
		assert.equal(v.title, "Low Aerobic Shortage");
		assert.equal(
			v.copy,
			"Try working in some more low aerobic activities like easy runs or rides. These will aid recovery and balance your higher intensity activities.",
		);
		assert.equal(v.legend, "Optimal Range");
	});

	it("runs each bar to its share of the largest value or target maximum: ends x 203.33 / 386.00 / 229.00", () => {
		const v = focus();
		assert.equal(v.scale, 1355);
		const ends = v.bars.map((b) => PHONE.focus.x + PHONE.focus.width * b.fraction);
		// The spec's from Garmin's floats, 201 + 185·v / 1355.26: 203.41 / 386.00 / 228.88 — the day files' integers move them under 0.04 pt.
		[203.41, 386.0, 228.88].forEach((x, i) => near(ends[i]!, x, 0.05, `bar ${i}`));
		PHONE.focus.ends.forEach((x, i) => near(ends[i]!, x, 0.5, `bar ${i} on the phone`));
	});

	it("spans each Optimal Range box from TargetMin to TargetMax on the same scale", () => {
		const v = focus();
		assert.deepEqual(
			v.bars.map((b) => [b.target!.min, b.target!.max]),
			[
				[66, 267],
				[402, 869],
				[399, 800],
			],
		);
		const boxes = v.bars.map((b) => [PHONE.focus.x + PHONE.focus.width * b.target!.from, PHONE.focus.x + PHONE.focus.width * b.target!.to]);
		// The spec's 210.01–237.45, 255.88–319.62, 255.47–310.20, against the shot's outer stroke edges (±0.8).
		[
			[210.01, 237.45],
			[255.88, 319.62],
			[255.47, 310.2],
		].forEach(([from, to], i) => {
			near(boxes[i]![0]!, from!, 0.05, `box ${i} from`);
			near(boxes[i]![1]!, to!, 0.05, `box ${i} to`);
		});
		PHONE.focus.boxes.forEach(([from, to], i) => {
			near(boxes[i]![0]!, from, 0.8, `box ${i} from, on the phone`);
			near(boxes[i]![1]!, to, 0.8, `box ${i} to, on the phone`);
		});
	});

	it("reads Oct 10's record on Oct 10: the web's ‹ day, High Aerobic 1154, labelled by the phone's rule", () => {
		const v = focus({ ctx: { today: "2026-10-10" } });
		assert.deepEqual(
			v.bars.map((b) => b.text),
			["18", "1,154", "204"],
		);
		// The web dialog calls the same numbers "Sep 12 - Oct 10": it labels a day more than the phone.
		assert.equal(v.label, "Sep 13 - Oct 10");
	});

	it("shows yesterday's record before the watch syncs, and ignores the period and the sub-page", () => {
		const v = focus({ ctx: { today: "2026-10-12" } });
		assert.deepEqual([v.date, v.label, v.bars[1]!.text], [TODAY, "Sep 14 - Oct 11", "1,355"]);
		assert.deepEqual(focus({ offset: -3, sub: RATIO_SUB }), focus());
	});

	it("titles the other phrases in Training Status's words, with no copy where the words are unseen", () => {
		const sep12 = focus({ ctx: { today: "2026-09-12" } });
		assert.deepEqual([sep12.title, sep12.copy, sep12.label], ["Anaerobic Shortage", undefined, "Aug 16 - Sep 12"]);
		assert.deepEqual(
			sep12.bars.map((b) => [b.text, b.target!.min, b.target!.max]),
			[
				["84", 109, 327],
				["1,095", 327, 655],
				["575", 273, 600],
			],
		);
		assert.equal(sep12.scale, 1095);
		const first = focus({ ctx: { today: "2025-08-09" } });
		assert.deepEqual([first.title, first.label, first.scale], ["High Aerobic Shortage", "Jul 13 - Aug 9", 538]);
		assert.deepEqual(
			["ANAEROBIC_SHORTAGE", "AEROBIC_HIGH_FOCUS", "BALANCED", "AEROBIC_LOW_FOCUS", "ABOVE_TARGETS", "AEROBIC_HIGH_SHORTAGE", "SOMETHING_NEW"].map(focusTitle),
			["Anaerobic Shortage", "High Aerobic Focus", "Balanced", "Low Aerobic Focus", "Above Targets", "High Aerobic Shortage", "Something New"],
		);
		assert.deepEqual(Object.keys(FOCUS_COPY), ["AEROBIC_LOW_SHORTAGE"]);
		assert.equal(focusCopy("BALANCED"), undefined);
	});

	it("shows the shared empty line without any record, labelled with today's window (Inferred)", () => {
		const v = focus({ ctx: { today: "2025-08-08" } });
		assert.deepEqual([v.empty, v.bars, v.title, v.copy, v.date], [NO_DATA, [], undefined, undefined, undefined]);
		assert.equal(v.label, "Jul 12 - Aug 8");
		assert.equal(focus({ ctx: { days: [] } }).empty, NO_DATA);
	});

	it("draws no bar for a zero load (Inferred), and keeps a bar without targets", () => {
		const { bars, scale } = focusBars({ date: TODAY, values: { load_anaerobic: 0, load_aerobic_high: 120, load_aerobic_low: 30, load_aerobic_low_target_min: 50, load_aerobic_low_target_max: 150 } });
		assert.equal(scale, 150);
		assert.deepEqual(
			bars.map((b) => [b.fraction, b.target === undefined]),
			[
				[0, true],
				[0.8, true],
				[0.2, false],
			],
		);
		assert.deepEqual(focusSpan("2026-03-01"), { from: "2026-02-02", to: "2026-03-01" });
	});
});

describe("Exercise Load — Sep 14 – Oct 11", () => {
	it("is the 4w period, Sep 14 - Oct 11, stepping back while the index has older activities", () => {
		const v = exercise();
		assert.deepEqual([v.label, v.from, v.to, v.range, v.steppers], ["Sep 14 - Oct 11", "2026-09-14", TODAY, "4w", true]);
		assert.deepEqual([v.canGoBack, v.canGoForward], [true, false]);
		assert.equal(v.title, "Daily Totals");
	});

	it("draws 12 bars on the activities' local start days: the Sep 14 23:50 swim is Sep 14's", () => {
		const v = exercise();
		assert.deepEqual(
			v.chart.bars.map((b) => [b.date.slice(5), b.total, b.segments.map((s) => s.group).join("+")]),
			[
				["09-14", 62.41, "lowAerobic"],
				["09-15", 88.9, "lowAerobic"],
				["09-16", 70.52, "lowAerobic"],
				["09-19", 62.02, "highAerobic"],
				["09-22", 134.14, "highAerobic"],
				["09-23", 141.46, "highAerobic"],
				["09-25", 166.14, "highAerobic"],
				["09-27", 121.26, "highAerobic"],
				["09-28", 195.72, "highAerobic"],
				["10-03", 164.76, "highAerobic"],
				["10-10", 171.55, "highAerobic"],
				["10-11", 203.85, "highAerobic"],
			],
		);
		// Centred on their days' dots: Sep 14 the first of 28, Oct 11 the last.
		assert.deepEqual([v.chart.bars[0]!.x, v.chart.bars[11]!.x], [0, 1]);
		assert.equal(v.chart.bars[3]!.x, 5 / 27);
	});

	it("scales them 0 … 3S over the phone's 102.73 pt: every height within 0.34 pt", () => {
		const v = exercise();
		assert.equal(v.chart.top, 225);
		const heights = v.chart.bars.map((b) => (PHONE.exercise.height * b.total) / v.chart.top);
		assert.ok(worst(heights.map((h, i) => [h, PHONE.exercise.heights[i]!])) <= 0.35, `max ${worst(heights.map((h, i) => [h, PHONE.exercise.heights[i]!]))}`);
	});

	it("labels the y axis 0 / 75 / 150 / 225, S = ⌈203.85 / 3 / 25⌉ × 25, each at its value", () => {
		const v = exercise();
		assert.deepEqual(v.chart.ticks, [225, 150, 75, 0]);
		v.chart.ticks.forEach((t, i) => near(PHONE.exercise.baseline - (PHONE.exercise.height * t) / v.chart.top, PHONE.exercise.labels[i]!, 0.5, `label ${t}`));
	});

	it("marks the 28 days, the ends large and labelled 09-14 and 10-11; the legend has all four groups", () => {
		const v = exercise();
		assert.equal(v.chart.axis.dots.length, 28);
		assert.deepEqual(
			v.chart.axis.dots.filter((d) => d.large).map((d) => d.x),
			[0, 1],
		);
		assert.deepEqual(
			v.chart.axis.labels.map((l) => l.text),
			["09-14", "10-11"],
		);
		assert.deepEqual(
			v.legend.map((l) => l.label),
			["Anaerobic", "High Aerobic", "Low Aerobic", "Unknown"],
		);
	});

	it("lists the period's 12 activities newest first, word for word as the phone's six visible rows and seven dates", () => {
		const v = exercise();
		assert.equal(v.list.length, 12);
		assert.deepEqual(
			v.list.slice(0, 6).map((r) => `${r.date} / ${r.subtitle}`),
			[
				"Oct 11, 2026 / 12.5 km run • Load: 204 • Benefit: Threshold",
				"Oct 10, 2026 / 10.0 km run • Load: 172 • Benefit: Threshold",
				"Oct 3, 2026 / 8.0 km run • Load: 165 • Benefit: Threshold",
				"Sep 28, 2026 / 11.1 km run • Load: 196 • Benefit: Threshold",
				"Sep 27, 2026 / 6.1 km run • Load: 121 • Benefit: Threshold",
				"Sep 25, 2026 / 7.8 km run • Load: 166 • Benefit: VO₂ Max",
			],
		);
		assert.equal(v.list[6]!.date, "Sep 23, 2026");
	});

	it("words the rows the phone did not reach as the spec predicts (Inferred)", () => {
		const v = exercise();
		assert.deepEqual(
			v.list.slice(6).map((r) => `${r.date} / ${r.subtitle}`),
			[
				"Sep 23, 2026 / 7.5 km run • Load: 141 • Benefit: Threshold",
				"Sep 22, 2026 / 5.4 km run • Load: 134 • Benefit: Tempo",
				"Sep 19, 2026 / 2.6 km run • Load: 62 • Benefit: Tempo",
				"Sep 16, 2026 / 4.7 km run • Load: 71 • Benefit: Base",
				"Sep 15, 2026 / 9.2 km run • Load: 89 • Benefit: Base",
				"Sep 14, 2026 / 1.1 km swim • Load: 62 • Benefit: Recovery",
			],
		);
	});

	it("opens every activity's page: the runs, the treadmill run and the swim", () => {
		const v = exercise();
		assert.deepEqual(v.list[0]!.route, activityRoute(24680971010));
		assert.deepEqual(v.list[7]!.route, activityRoute(24454826243));
		assert.deepEqual(v.list[11]!.route, activityRoute(v.list[11]!.id));
		assert.ok(v.list.every((r) => r.route !== undefined));
	});

	it("agrees with the web's Activity List for Sep 20 – Oct 11: 8 rows, loads and benefits [web only]", () => {
		const web = [
			["Oct 11", 204, "Threshold"],
			["Oct 10", 172, "Threshold"],
			["Oct 3", 165, "Threshold"],
			["Sep 28", 196, "Threshold"],
			["Sep 27", 121, "Threshold"],
			["Sep 25", 166, "VO₂ Max"],
			["Sep 23", 141, "Threshold"],
			["Sep 22", 134, "Tempo"],
		];
		const rows = exercise().list.slice(0, 8);
		assert.deepEqual(
			rows.map((r) => {
				const [, load, benefit] = /Load: (\d+) • Benefit: (.+)$/.exec(r.subtitle)!;
				return [r.date.replace(", 2026", ""), Number(load), benefit];
			}),
			web,
		);
	});

	it("names VO2MAX with the subscript, as the activity pages now do", () => {
		assert.equal(primaryBenefit("VO2MAX")?.name, "VO₂ Max");
		assert.deepEqual(
			["LACTATE_THRESHOLD", "VO2MAX", "TEMPO", "AEROBIC_BASE", "RECOVERY", "ANAEROBIC_CAPACITY", "SPEED", "SPRINT", "UNKNOWN", undefined].map(benefitName),
			["Threshold", "VO₂ Max", "Tempo", "Base", "Recovery", "Anaerobic Capacity", "Sprint", "Sprint", "Unknown", "Unknown"],
		);
		assert.deepEqual(
			["RECOVERY", "AEROBIC_BASE", "TEMPO", "LACTATE_THRESHOLD", "VO2MAX", "ANAEROBIC_CAPACITY", "SPEED", "SPRINT", "UNKNOWN", "NO_BENEFIT", undefined].map(loadGroup),
			["lowAerobic", "lowAerobic", "highAerobic", "highAerobic", "highAerobic", "anaerobic", "anaerobic", "anaerobic", "unknown", "unknown", "unknown"],
		);
	});
});

describe("Exercise Load — the period before, Aug 17 – Sep 13 (Inferred)", () => {
	it("steps 28 days back, with > to return", () => {
		const v = exercise({ offset: -1 });
		assert.deepEqual([v.label, v.from, v.to, v.canGoForward], ["Aug 17 - Sep 13", "2026-08-17", "2026-09-13", true]);
	});

	it("scales by Sep 12's 257.94 (Base 88.96 + Tempo 49.28 + 119.70): S = 100", () => {
		const v = exercise({ offset: -1 });
		const sep12 = v.chart.bars.find((b) => b.date === "2026-09-12")!;
		assert.equal(sep12.total, 257.94);
		assert.deepEqual(v.chart.ticks, [300, 200, 100, 0]);
	});

	it("stacks Aug 23's High Aerobic 156.33 under its Low Aerobic 48.98, in the legend's order", () => {
		const v = exercise({ offset: -1 });
		assert.deepEqual(v.chart.bars.find((b) => b.date === "2026-08-23")!.segments, [
			{ group: "highAerobic", value: 156.33, from: 0, to: 156.33 },
			{ group: "lowAerobic", value: 48.98, from: 156.33, to: 205.31 },
		]);
	});

	it("lists the sample's 18 activities of the period newest first, Sep 12's three together, the stair climbing without a distance", () => {
		const v = exercise({ offset: -1 });
		// The 30-activity sample stops at Aug 23; the index has one more on Aug 17 – 22.
		assert.equal(v.list.length, 18);
		assert.deepEqual(
			v.list.slice(0, 3).map((r) => r.subtitle),
			["3.8 km run • Load: 120 • Benefit: Tempo", "1.7 km run • Load: 49 • Benefit: Tempo", "5.5 km run • Load: 89 • Benefit: Base"],
		);
		const stairs = v.list.find((r) => r.date === "Aug 28, 2026")!;
		assert.deepEqual([stairs.subtitle, stairs.route], ["stair climbing • Load: 62 • Benefit: Base", activityRoute(stairs.id)]);
	});
});

describe("Exercise Load — edges", () => {
	it("draws an empty chart 0 … 75 and no rows for a period without activities (Inferred)", () => {
		const v = exercise({ ctx: { activities: [] } });
		assert.deepEqual([v.chart.bars, v.chart.ticks, v.chart.top, v.list, v.empty], [[], [75, 50, 25, 0], 75, [], undefined]);
		assert.deepEqual(exerciseTicks(0), [75, 50, 25, 0]);
	});

	it("stops at the index's oldest activity once it is complete, and steps on while it is not", () => {
		// The sample's oldest is Aug 23: the period Aug 17 – Sep 13 holds it.
		assert.equal(exercise({ offset: -1 }).canGoBack, false);
		assert.equal(exercise({ offset: -1, ctx: { activitiesComplete: false } }).canGoBack, true);
	});

	it("words other sports and imperial distances, and counts a row without load or benefit as 0 and Unknown (Inferred)", () => {
		const row = (r: Partial<ActivityRow>): ActivityRow => ({ id: 1, type: "running", start: "2026-10-11T07:00:00", begin: 0, ...r });
		assert.equal(exerciseSubtitle(row({ distance: 12469.47, load: 203.85, benefit: "LACTATE_THRESHOLD" }), "imperial"), "7.7 mi run • Load: 204 • Benefit: Threshold");
		assert.deepEqual(
			[
				{ type: "treadmill_running", typeId: 18, parentTypeId: 1 },
				{ type: "lap_swimming", typeId: 27, parentTypeId: 26 },
				{ type: "road_biking", typeId: 10, parentTypeId: 2 },
				{ type: "stair_climbing", typeId: 31, parentTypeId: 29 },
				{ type: "strength_training", typeId: 13, parentTypeId: 29 },
			].map(sportWord),
			["run", "swim", "ride", "stair climbing", "strength training"],
		);
		const yoga = row({ id: 2, type: "yoga", typeId: 43, parentTypeId: 29 });
		assert.equal(exerciseSubtitle(yoga, "metric"), "yoga • Load: 0 • Benefit: Unknown");
		const v = exercise({ ctx: { activities: [yoga, row({ id: 3, load: 40 })] } });
		assert.deepEqual(
			v.chart.bars.map((b) => [b.total, b.segments.map((s) => s.group)]),
			[[40, ["unknown"]]],
		);
		assert.deepEqual(
			v.list.map((r) => r.id),
			[3, 2],
		);
		assert.equal(listDate("2025-12-31T23:59:00"), "Dec 31, 2025");
	});
});

describe("Training Load — Acute Load, Sep 14 – Oct 11", () => {
	it("is the 4w period on Acute Load, the chip off, under 4-Week Timeline", () => {
		const v = training();
		assert.deepEqual([v.label, v.from, v.to, v.segment, v.title, v.steppers], ["Sep 14 - Oct 11", "2026-09-14", TODAY, "acute", "4-Week Timeline", true]);
		assert.deepEqual(
			v.segments.map((s) => [s.label, s.on]),
			[
				["Acute Load", true],
				["Load Ratio", false],
			],
		);
		assert.deepEqual(v.chip, { label: "Chronic Load", on: false });
		assert.deepEqual([v.canGoBack, v.canGoForward], [true, false]);
	});

	it("scales 0 … 1.5 × 702: lines at its thirds 351 / 702 / 1053, labels 375 / 750 / 1.1k at their own values", () => {
		const { axis } = acuteChart(training());
		assert.equal(axis.top, 1053);
		assert.deepEqual(
			axis.grid.map((g) => g.value),
			[1053, 702, 351, 0],
		);
		assert.deepEqual(
			axis.labels.map((l) => [l.value, l.text]),
			[
				[1125, "1.1k"],
				[750, "750"],
				[375, "375"],
				[0, "0"],
			],
		);
		// On the phone: the lines 394.50 / 437.72 / 480.95 / 524.17 (measured .50 / .50 / .83 / .17) …
		const y = (at: number) => yAt(at, PHONE.acute.baseline, PHONE.acute.top);
		[394.5, 437.72, 480.95, 524.17].forEach((g, i) => near(y(axis.grid[i]!.at), g, 0.01, `line ${i}`));
		axis.grid.forEach((g, i) => near(y(g.at), PHONE.acute.grid[i]!, 0.25, `line ${i} on the phone`));
		// … and the labels 385.63 / 431.81 / 477.99 / 524.17 (measured 385.33 / 431.50 / 477.83 / 523.83): "1.1k" 9 pt over the top line.
		[385.63, 431.81, 477.99, 524.17].forEach((l, i) => near(y(axis.labels[i]!.at), l, 0.01, `label ${i}`));
		axis.labels.forEach((l, i) => near(y(l.at), PHONE.acute.labels[i]!, 0.35, `label ${l.text} on the phone`));
		near(PHONE.acute.top - y(axis.labels[0]!.at), 9, 0.2, "1.1k over the top line");
	});

	it("puts a dot a day at the acute load: all 28 within 0.66 pt of the phone's", () => {
		const chart = acuteChart(training());
		assert.deepEqual(
			chart.acute.map((p) => p.value),
			[378, 499, 511, 424, 351, 356, 287, 218, 320, 447, 375, 516, 443, 533, 702, 598, 501, 405, 308, 438, 356, 273, 212, 151, 105, 84, 281, 498],
		);
		assert.deepEqual([chart.acute[0]!.x, chart.acute[27]!.x], [0, 1]);
		const ys = chart.acute.map((p) => yAt(p.value! / chart.axis.top, PHONE.acute.baseline, PHONE.acute.top));
		assert.ok(worst(ys.map((y, i) => [y, PHONE.acute.dots[i]!])) <= 0.67, `max ${worst(ys.map((y, i) => [y, PHONE.acute.dots[i]!]))}`);
		assert.deepEqual(
			chart.axisX.labels.map((l) => l.text),
			["09-14", "10-11"],
		);
	});

	it("bands 0.8× to 1.5× each day's chronic load: tops within 0.84 pt on 27 slots, clean bottoms within 0.23", () => {
		const chart = acuteChart(training());
		assert.deepEqual(chart.band[0], { x: 0, low: 322.4, high: 604.5 });
		assert.deepEqual(chart.band[27], { x: 1, low: 314.4, high: 589.5 });
		const y = (v: number) => yAt(v / chart.axis.top, PHONE.acute.baseline, PHONE.acute.top);
		const tops = PHONE.acute.band.map(([top], i) => [y(chart.band[i]!.high), top] as const);
		const bottoms = PHONE.acute.band.flatMap(([, bottom, clean], i) => (clean ? [[y(chart.band[i]!.low), bottom] as const] : []));
		assert.equal(bottoms.length, 20);
		assert.ok(worst(tops) <= 0.84, `tops ${worst(tops)}`);
		assert.ok(worst(bottoms) <= 0.23, `bottoms ${worst(bottoms)}`);
		assert.equal(chart.muted, false);
		assert.equal(chart.chronic, undefined);
	});

	it("ends on Oct 11's 498 - Optimal and FEEDBACK_2's acute copy; the legend is Optimal Range and Acute Load", () => {
		const v = training();
		assert.deepEqual([v.date, v.status], [TODAY, "498 - Optimal"]);
		assert.equal(v.copy, "Your acute load is in the optimal range to maintain or improve your fitness.");
		assert.deepEqual(
			v.legend.map((l) => [l.label, l.shape, l.muted]),
			[
				["Optimal Range", "dot", false],
				["Acute Load", "dot", false],
			],
		);
		assert.equal(v.figures, undefined);
	});
});

describe("Training Load — the Chronic Load chip", () => {
	it("adds the chronic series where the phone draws its squares (19 whole ones within 0.24 pt)", () => {
		const chart = acuteChart(training({ sub: CHRONIC_SUB }));
		assert.equal(chart.chronic!.length, 28);
		const y = (v: number) => yAt(v / chart.axis.top, PHONE.acute.baseline, PHONE.acute.top);
		const pairs = PHONE.acute.chronic.map(([slot, at]) => [y(chart.chronic![slot]!.value!), at] as const);
		assert.ok(worst(pairs) <= 0.24, `max ${worst(pairs)}`);
	});

	it("greys the band and the acute series without moving them, and leaves the axis, status and copy", () => {
		const off = training();
		const on = training({ sub: CHRONIC_SUB });
		const chart = acuteChart(on);
		assert.equal(chart.muted, true);
		assert.deepEqual([chart.acute, chart.band, chart.axis], [acuteChart(off).acute, acuteChart(off).band, acuteChart(off).axis]);
		const ys = chart.acute.map((p) => yAt(p.value! / chart.axis.top, PHONE.acute.baseline, PHONE.acute.top));
		assert.ok(worst(ys.map((y, i) => [y, PHONE.acute.grey[i]!])) <= 0.67);
		assert.deepEqual([on.status, on.copy, on.chip], [off.status, off.copy, { label: "Chronic Load", on: true }]);
		assert.deepEqual(
			on.legend.map((l) => [l.label, l.shape, l.muted]),
			[
				["Optimal Range", "dot", true],
				["Acute Load", "dot", true],
				["Chronic Load", "square", false],
			],
		);
	});

	it("survives a period step (Inferred), as the route's sub", () => {
		const v = training({ sub: CHRONIC_SUB, offset: -1 });
		assert.deepEqual([v.label, v.chip?.on, acuteChart(v).chronic?.length], ["Aug 17 - Sep 13", true, 28]);
	});
});

describe("Training Load — Load Ratio, Sep 14 – Oct 11", () => {
	it("is linear 0 … 2.3, its lines and labels together at 0, 0.8, 1.5 and 2+", () => {
		const v = training({ sub: RATIO_SUB });
		const chart = ratioChart(v);
		assert.equal(chart.axis, RATIO_AXIS);
		assert.deepEqual(
			chart.axis.labels.map((l) => [l.value, l.text]),
			[
				[2.3, "2+"],
				[1.5, "1.5"],
				[0.8, "0.8"],
				[0, "0"],
			],
		);
		const top = PHONE.ratio.baseline - PHONE.ratio.height;
		chart.axis.grid.forEach((g, i) => near(yAt(g.at, PHONE.ratio.baseline, top), PHONE.ratio.grid[i]!, 0.06, `line ${i}`));
		assert.deepEqual(chart.band, { low: 0.8, high: 1.5 });
		assert.deepEqual(BAND, { low: 0.8, high: 1.5 });
	});

	it("plots Garmin's 1 dp ratio, not acute ÷ chronic: 28 dots within 0.67 pt, where the quotient misses by 5.37", () => {
		const chart = ratioChart(training({ sub: RATIO_SUB }));
		const top = PHONE.ratio.baseline - PHONE.ratio.height;
		const y = (r: number) => yAt(Math.min(r, 2.3) / 2.3, PHONE.ratio.baseline, top);
		const sent = chart.ratio.map((p, i) => [y(p.value!), PHONE.ratio.dots[i]!] as const);
		assert.ok(worst(sent) <= 0.67, `sent ${worst(sent)}`);
		const rows = STATUS.filter((r) => r.date >= "2026-09-14" && r.date <= TODAY);
		assert.deepEqual(
			rows.map((r) => r.ratio),
			chart.ratio.map((p) => p.value),
		);
		const quotient = rows.map((r, i) => [y(r.acute! / r.chronic!), PHONE.ratio.dots[i]!] as const);
		near(worst(quotient), 5.37, 0.01, "acute ÷ chronic");
	});

	it("shows Oct 11's 498 and 393 over Acute Load and Chronic Load, then 1.2 - Optimal and the ratio copy", () => {
		const v = training({ sub: RATIO_SUB });
		assert.deepEqual(v.figures, [
			{ value: "498", label: "Acute Load" },
			{ value: "393", label: "Chronic Load" },
		]);
		// 498 / 393 is 1.267: Garmin truncates to 1.2.
		assert.equal(v.status, "1.2 - Optimal");
		assert.equal(v.copy, "Your load ratio is in the optimal range to maintain or improve your fitness.");
	});

	it("has no chip, and a grey Optimal Range dot in the legend though its band is green", () => {
		const v = training({ sub: RATIO_SUB });
		assert.equal(v.chip, undefined);
		assert.deepEqual(
			v.segments.map((s) => s.on),
			[false, true],
		);
		assert.deepEqual(
			v.legend.map((l) => [l.label, l.muted]),
			[
				["Optimal Range", true],
				["Load Ratio", false],
			],
		);
	});
});

describe("Training Load — the period before, Aug 17 – Sep 13 (Inferred)", () => {
	it("scales by Aug 31's 604: lines 302 / 604 / 906, labels 325 / 650 / 975", () => {
		const v = training({ offset: -1 });
		assert.deepEqual([v.label, v.canGoForward, v.canGoBack], ["Aug 17 - Sep 13", true, true]);
		const { axis } = acuteChart(v);
		assert.deepEqual(
			axis.grid.map((g) => g.value),
			[906, 604, 302, 0],
		);
		assert.deepEqual(
			axis.labels.map((l) => l.text),
			["975", "650", "325", "0"],
		);
	});

	it("ends on Sep 13: 458 - Optimal, 1.1 - Optimal, figures 458 / 412; its highest ratio 1.7", () => {
		const acute = training({ offset: -1 });
		const ratio = training({ offset: -1, sub: RATIO_SUB });
		assert.deepEqual([acute.date, acute.status, ratio.status], ["2026-09-13", "458 - Optimal", "1.1 - Optimal"]);
		assert.deepEqual(
			ratio.figures!.map((f) => f.value),
			["458", "412"],
		);
		assert.equal(Math.max(...ratioChart(ratio).ratio.map((p) => p.value!)), 1.7);
		assert.equal(acute.copy, LOAD_COPY.acute.FEEDBACK_2);
	});
});

describe("Training Load — edges", () => {
	it("leaves today's slot empty before the watch syncs, the status speaking for yesterday's row", () => {
		const v = training({ ctx: { today: "2026-10-12" } });
		const chart = acuteChart(v);
		assert.deepEqual([v.label, v.date, v.status], ["Sep 15 - Oct 12", TODAY, "498 - Optimal"]);
		assert.deepEqual([chart.acute[27]!.value, chart.band[27], chart.acute[26]!.value], [null, null, 498]);
	});

	it("shows the shared empty line for a period without rows, and stops stepping at the index's start", () => {
		let offset = 0;
		while (training({ offset }).canGoBack) offset -= 1;
		const first = training({ offset });
		// The period holding the index's first row, 2025-08-02.
		assert.ok(first.from <= "2025-08-02" && first.to >= "2025-08-02", `${first.from} – ${first.to}`);
		const before = training({ offset: offset - 1 });
		assert.deepEqual([before.empty, before.chart, before.status, before.copy, before.figures], [NO_DATA, null, undefined, undefined, undefined]);
		assert.deepEqual(before.chip, { label: "Chronic Load", on: false });
		assert.equal(training({ offset: offset - 1, ctx: { statusComplete: false } }).canGoBack, true);
	});

	it("words the other statuses: Low with no copy (unseen), the number alone for NONE, -- without a ratio", () => {
		const oct10 = training({ ctx: { today: "2026-10-10" } });
		assert.deepEqual([oct10.status, oct10.copy], ["281 - Low", undefined]);
		const sep28 = training({ ctx: { today: "2026-09-28" }, sub: RATIO_SUB });
		assert.deepEqual([sep28.status, sep28.copy], ["1.5 - High", undefined]);
		assert.equal(ratioValue({ ratio: 2, acwr: "VERY_HIGH" }), "2.0 - Very High");
		assert.equal(ratioValue({ ratio: 0.9, acwr: "NONE" }), "0.9");
		assert.equal(ratioValue({ acwr: "OPTIMAL" }), "--");
		assert.equal(ratioValue(undefined), "--");
	});

	it("breaks the ratio line at a day without one (Inferred), and hands a ratio past 2.3 on for the chart to pin to the top", () => {
		const rows = STATUS.map((r) => (r.date === "2026-10-01" ? { ...r, ratio: undefined } : r.date === "2026-10-02" ? { ...r, ratio: 2.6 } : r));
		const chart = ratioChart(training({ sub: RATIO_SUB, ctx: { status: rows } }));
		assert.deepEqual(
			chart.ratio.slice(17, 19).map((p) => p.value),
			[null, 2.6],
		);
	});
});

describe("Training Load — the route's sub", () => {
	it("names the view: none is Acute Load, chronic adds the chip, ratio is Load Ratio", () => {
		assert.deepEqual([undefined, CHRONIC_SUB, RATIO_SUB, "other"].map(segmentOf), ["acute", "acute", "ratio", "acute"]);
		assert.deepEqual([undefined, CHRONIC_SUB, RATIO_SUB].map(chronicOf), [false, true, false]);
	});

	it("swaps the segment and the chip, keeping the rest of the route", () => {
		const route = performanceStatRoute("training-load", { tab: "training", offset: -1 });
		assert.deepEqual(withTrainingView(route, "ratio"), { ...route, sub: "ratio" });
		assert.deepEqual(withTrainingView({ ...route, sub: "ratio" }, "acute"), route);
		assert.deepEqual(withTrainingView(route, "acute", true), { ...route, sub: "chronic" });
		// Load Ratio has no chip.
		assert.deepEqual(withTrainingView({ ...route, sub: "chronic" }, "ratio", true), { ...route, sub: "ratio" });
		assert.equal(training({ sub: CHRONIC_SUB }).segment, "acute");
	});

	it("is ignored by the other tabs", () => {
		assert.deepEqual(exercise({ sub: RATIO_SUB }), exercise());
	});

	it("legends each view", () => {
		assert.deepEqual(
			legendOf("acute", false).map((l) => l.key),
			["optimal", "acute"],
		);
		assert.deepEqual(
			legendOf("acute", true).map((l) => l.key),
			["optimal", "acute", "chronic"],
		);
		assert.deepEqual(
			legendOf("ratio", true).map((l) => l.key),
			["optimal", "ratio"],
		);
	});
});

describe("acuteAxis (stat-charts.ts), shared with Training Readiness' Acute Load sheet", () => {
	const at = (axis: MarkedAxis, baseline: number, top: number) => ({
		grid: axis.grid.map((g) => yAt(g.at, baseline, top)),
		labels: new Map(axis.labels.map((l) => [l.value, yAt(l.at, baseline, top)])),
	});

	it("draws the sheet's taller frame by the same rule: lines at thirds of 1053, labels at their values", () => {
		const [top, , , baseline] = PHONE.readiness.grid;
		const { grid, labels } = at(acuteAxis(702), baseline!, top!);
		grid.forEach((g, i) => near(g, PHONE.readiness.grid[i]!, 0.4, `line ${i}`));
		for (const [value, y] of PHONE.readiness.labels) near(labels.get(value)!, y, 0.6, `label ${value}`);
	});

	it("is the web's 4 Weeks axis too, which labels the lines at its own 350 step [web only]", () => {
		assert.deepEqual(
			acuteAxis(702).grid.map((g) => Math.round(g.value / 50) * 50),
			[1050, 700, 350, 0],
		);
	});

	it("counts in 25s, and falls back to 0 … 75 with nothing to scale by (Inferred)", () => {
		assert.deepEqual([stepUp(351), stepUp(350), stepUp(0), stepUp(67.95)], [375, 350, 25, 75]);
		for (const none of [undefined, 0, -5, Number.NaN]) {
			const axis = acuteAxis(none);
			assert.deepEqual([axis.top, axis.grid.map((g) => g.value), axis.labels.map((l) => l.at)], [75, [75, 50, 25, 0], [1, 2 / 3, 1 / 3, 0]]);
		}
		assert.deepEqual([0, 375, 999, 1000, 1125, 1500, 2250].map(loadLabel), ["0", "375", "999", "1k", "1.1k", "1.5k", "2.3k"]);
	});
});

describe("Load's words", () => {
	it("breaks the copy where the phone does, which the twin keeps in a pane", () => {
		assert.deepEqual(focus().copyLines, [
			"Try working in some more low aerobic activities",
			"like easy runs or rides. These will aid recovery",
			"and balance your higher intensity activities.",
		]);
		assert.deepEqual(training().copyLines, ["Your acute load is in the optimal range to", "maintain or improve your fitness."]);
		assert.deepEqual(training({ sub: RATIO_SUB }).copyLines, ["Your load ratio is in the optimal range to", "maintain or improve your fitness."]);
		assert.equal(training({ ctx: { today: "2026-10-10" } }).copyLines, undefined);
		assert.deepEqual(FOCUS_COPY_LINES.AEROBIC_LOW_SHORTAGE!.join(" "), FOCUS_COPY.AEROBIC_LOW_SHORTAGE);
		assert.deepEqual(LOAD_COPY_LINES.ratio.FEEDBACK_2!.join(" "), LOAD_COPY.ratio.FEEDBACK_2);
	});

	it("hands the row its subtitle's three parts, for the spaced bullets", () => {
		const rows = exercise().list;
		assert.deepEqual(rows[0]!.parts, ["12.5 km run", "Load: 204", "Benefit: Threshold"]);
		assert.ok(rows.every((r) => r.parts.join(" • ") === r.subtitle));
	});

	it("keeps only the copy it has seen", () => {
		assert.deepEqual(Object.keys(LOAD_COPY.acute), ["FEEDBACK_2"]);
		assert.deepEqual(Object.keys(LOAD_COPY.ratio), ["FEEDBACK_2"]);
		assert.equal(loadCopy("acute", "FEEDBACK_3"), undefined);
		assert.equal(loadCopy("ratio", undefined), undefined);
	});

	it("builds Help from the web's Acute Training Load and Training Load Focus sections and the bars' popovers (Inferred)", () => {
		assert.equal(LOAD_HELP.title, "Load");
		assert.deepEqual(
			LOAD_HELP.sections.map((s) => s.title),
			["Acute Training Load", "Training Load Focus", "Load Focus"],
		);
		assert.ok(LOAD_HELP.sections[0]!.parts[0]!.paragraphs[0]!.startsWith("Acute training load is a measurement of your effort"));
		assert.equal(FOCUS_HELP.highAerobic, "Activities with a primary benefit of VO₂ Max, threshold or tempo contribute to high aerobic load.");
		assert.deepEqual(
			LOAD_HELP.sections[2]!.parts.map((p) => p.heading),
			["Anaerobic", "High Aerobic", "Low Aerobic"],
		);
	});

	it("reads the fixture's Oct 11 day through the same mapper whatever else the day holds", () => {
		assert.deepEqual(dayOf(TODAY, BALANCES[TODAY]!, { steps: 9000 }).values.load_aerobic_high, 1355);
	});
});
