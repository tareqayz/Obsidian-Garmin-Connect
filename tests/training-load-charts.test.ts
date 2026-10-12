import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import {
	ACUTE_FRAME,
	EXERCISE_FRAME,
	FOCUS_ROW,
	GROUP_COLOR,
	LOAD_LAYOUT,
	RATIO_FRAME,
	acutePlot,
	bandPath,
	exercisePlot,
	focusBarPath,
	focusRowPlot,
	ratioPlot,
} from "../src/dashboard/training-load-charts";
import {
	CHRONIC_SUB,
	RATIO_SUB,
	trainingLoadView,
	type AcuteChart,
	type ExerciseTabView,
	type FocusTabView,
	type RatioChart,
	type TrainingLoadContext,
	type TrainingTabView,
} from "../src/dashboard/training-load-pages";
import { ACTIVITIES, DAYS, STATUS, TODAY } from "./training-load-fixture";

/**
 * Load's geometry against the Obsidian twin (Figma 430:6102): phones 603:10,
 * 604:37, 606:454, 606:659, 606:894 and 604:405 at 402 pt, panes 609:1438,
 * 609:1511, 610:1571 and 610:1745 with their 748 pt columns. Positions are
 * the twin's nodes', in each chart's own box.
 */

const CTX: TrainingLoadContext = { today: TODAY, units: "metric", days: DAYS, activities: ACTIVITIES, activitiesComplete: true, status: STATUS, statusComplete: true };
const view = (tab: string, sub?: string, offset = 0) => trainingLoadView({ range: "4w", offset, tab, ...(sub ? { sub } : {}) }, CTX);
const focus = () => view("focus") as FocusTabView;
const exercise = (offset = 0) => view("exercise", undefined, offset) as ExerciseTabView;
const acute = (sub?: string) => (view("training", sub) as TrainingTabView).chart as AcuteChart;
const ratio = () => (view("training", RATIO_SUB) as TrainingTabView).chart as RatioChart;

const near = (actual: number, expected: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (±${tolerance})`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance: number, what: string) => {
	assert.equal(actual.length, expected.length, `${what}: count`);
	actual.forEach((a, i) => near(a, expected[i]!, tolerance, `${what} ${i}`));
};

/** The phone's track and a pane's: the row's content less the 185 pt before the bar. */
const TRACK = { phone: PHONE - 32 - FOCUS_ROW.trackLeft, pane: PANE_COLUMN - FOCUS_ROW.trackLeft };

describe("Load Focus rows", () => {
	it("starts the track at x 201 on the phone (185 long) and 217 in a pane (563)", () => {
		assert.deepEqual([16 + FOCUS_ROW.trackLeft, TRACK.phone, 32 + FOCUS_ROW.trackLeft, TRACK.pane], [201, 185, 217, 563]);
		assert.deepEqual([FOCUS_ROW.height, FOCUS_ROW.pitch, FOCUS_ROW.barTop, FOCUS_ROW.barHeight], [40, 44, 16, 8]);
	});

	it("draws High Aerobic full, Low Aerobic as a pill and Anaerobic as a lens, as the twin (603:22–34)", () => {
		const rows = focus().bars.map((b) => focusRowPlot(b, TRACK.phone));
		assert.deepEqual(
			rows.map((r) => [r.bucket, r.bar.kind, r.color]),
			[
				["anaerobic", "lens", "var(--color-purple)"],
				["highAerobic", "pill", "var(--color-orange)"],
				["lowAerobic", "pill", "var(--color-cyan)"],
			],
		);
		// The twin's from Garmin's floats: 2.415 / 185 / 27.885; the day files' integers move them under 0.05.
		nearAll(
			rows.map((r) => r.bar.width),
			[2.415, 185, 27.885],
			0.05,
			"bar",
		);
	});

	it("makes a short bar's lens as tall as its two caps allow: 5.72 pt on the phone, 7.97 in a pane", () => {
		const lens = (width: number) => {
			const [, top, foot] = /^M[\d.]+ ([\d.]+)A4 4 0 0 1 [\d.]+ ([\d.]+)A/.exec(focusBarPath(width).d)!;
			return Number(foot) - Number(top);
		};
		near(lens(2.415), 5.724, 0.01, "phone lens");
		near(lens(7.351), 7.971, 0.01, "pane lens");
		assert.equal(focusBarPath(0).kind, "none");
		assert.equal(focusBarPath(8).kind, "pill");
		assert.equal(focusBarPath(185).d, "M4 0H181A4 4 0 0 1 181 8H4A4 4 0 0 1 4 0Z");
	});

	it("spans each Optimal Range box on the bars' scale: the phone's 209.73–237.84 … and the pane's 244.42–327.92 …", () => {
		const phone = focus().bars.map((b) => focusRowPlot(b, TRACK.phone).box!);
		// The twin's phone boxes were placed by eye on the shot's strokes (±0.6); its pane boxes are the scale's (±0.1).
		nearAll(
			phone.flatMap((b) => [201 + b.x, 201 + b.x + b.width]),
			[209.73, 237.84, 255.75, 320.17, 255.34, 310.75],
			0.6,
			"phone box",
		);
		const pane = focus().bars.map((b) => focusRowPlot(b, TRACK.pane).box!);
		nearAll(
			pane.flatMap((b) => [217 + b.x, 217 + b.x + b.width]),
			[244.42, 327.92, 384.0, 578.0, 382.75, 549.33],
			0.1,
			"pane box",
		);
		const bars = focus().bars.map((b) => focusRowPlot(b, TRACK.pane).bar.width);
		nearAll(bars, [7.351, 563, 84.86], 0.15, "pane bar");
	});
});

describe("Exercise Load — Daily Totals", () => {
	const twinX = [43.17, 55.38, 67.59, 104.22, 140.85, 153.06, 177.48, 201.9, 214.11, 275.16, 360.63, 372.84];
	const twinHeights = [28.495, 40.59, 32.198, 28.317, 61.245, 64.587, 75.856, 55.365, 89.361, 75.226, 78.326, 93.073];

	it("puts the 12 bars on their slots, 12.21 apart from 43.17, 8.5 wide, feet at 119.67 (604:48–70)", () => {
		const p = exercisePlot(exercise().chart, PHONE);
		nearAll(
			p.bars.map((b) => b.x),
			twinX,
			0.01,
			"x",
		);
		assert.ok(p.bars.every((b) => b.width === 8.5));
		nearAll(
			p.bars.map((b) => b.rects[0]!.height),
			twinHeights,
			0.01,
			"height",
		);
		nearAll(
			p.bars.map((b) => b.rects[0]!.y + b.rects[0]!.height),
			p.bars.map(() => EXERCISE_FRAME.baseline),
			0.01,
			"foot",
		);
	});

	it("rounds each bar's top by half its width, and colours it by its group", () => {
		const p = exercisePlot(exercise().chart, PHONE);
		const first = p.bars[0]!;
		assert.equal(first.rects[0]!.color, GROUP_COLOR.lowAerobic);
		assert.match(first.rects[0]!.d!, /A4\.25 4\.25 0 0 1/);
		assert.equal(p.bars[3]!.rects[0]!.color, GROUP_COLOR.highAerobic);
	});

	it("labels 225 / 150 / 75 / 0 at their values, right-aligned at 32 (604:44–47, ±0.2)", () => {
		const p = exercisePlot(exercise().chart, PHONE);
		assert.deepEqual(
			p.ticks.map((t) => [t.text, t.x]),
			[
				["225", 32],
				["150", 32],
				["75", 32],
				["0", 32],
			],
		);
		nearAll(
			p.ticks.map((t) => t.y),
			[16.8, 51.04, 85.28, 119.53],
			0.2,
			"tick",
		);
	});

	it("dots the 28 days at y 129.67, the ends 8 pt and labelled at 142.64 (602:95)", () => {
		const p = exercisePlot(exercise().chart, PHONE);
		assert.equal(p.dots.length, 28);
		assert.deepEqual([p.dots[0], p.dots[1], p.dots[27]], [
			{ x: 43.17, y: 129.67, r: 4 },
			{ x: 55.38, y: 129.67, r: 2 },
			{ x: 372.84, y: 129.67, r: 4 },
		]);
		assert.deepEqual(p.labels, [
			{ x: 43.17, y: 142.64, text: "09-14" },
			{ x: 372.84, y: 142.64, text: "10-11" },
		]);
	});

	it("stretches the slots ×2.0495 across a pane's 748 (609:1520–1542, 609:1764)", () => {
		const p = exercisePlot(exercise().chart, PANE_COLUMN);
		near(p.bars[1]!.x - p.bars[0]!.x, 25.025, 0.01, "pitch");
		nearAll(
			p.bars.map((b) => b.x - 4.25),
			[38.92, 63.94, 88.97, 164.04, 239.12, 264.14, 314.19, 364.24, 389.27, 514.39, 689.57, 714.59],
			0.02,
			"pane left",
		);
		nearAll(
			p.dots.slice(0, 2).map((d) => d.x),
			[43.17, 68.19],
			0.01,
			"pane dot",
		);
	});

	it("stacks Aug 23 High under Low with no gap, only the top rounded (604:418)", () => {
		const p = exercisePlot(exercise(-1).chart, PHONE);
		const aug23 = p.bars.find((b) => b.date === "2026-08-23")!;
		assert.deepEqual(
			aug23.rects.map((r) => [r.color, r.y, r.height, r.d === undefined]),
			[
				[GROUP_COLOR.highAerobic, 66.14, 53.53, true],
				[GROUP_COLOR.lowAerobic, 49.37, 16.77, false],
			],
		);
		// The twin: high 16.77 + 49.365 = 66.135, low from 49.365, 53.533 and 16.772 tall.
		near(aug23.rects[1]!.y + aug23.rects[1]!.height, aug23.rects[0]!.y, 0.01, "no gap");
	});
});

describe("Training Load — Acute Load", () => {
	const twinDots = [
		107.62, 92.72, 91.24, 101.96, 110.95, 110.33, 118.83, 127.32, 114.76, 99.12, 107.99, 90.63, 99.62, 88.53, 67.72, 80.53, 92.48, 104.3, 116.24, 100.23,
		110.33, 120.55, 128.06, 135.58, 141.24, 143.83, 119.57, 92.84,
	];

	it("draws the gridlines from 44 to 25 short of the edge at the domain's thirds (606:462–465, ±0.25)", () => {
		const p = acutePlot(acute(), PHONE);
		nearAll(
			p.grid.map((g) => g.y),
			[24.5, 67.5, 110.83, 154.17],
			0.25,
			"line",
		);
		assert.deepEqual([p.grid[0]!.x1, p.grid[0]!.x2], [44, 377]);
		assert.equal(acutePlot(acute(), PANE_COLUMN).grid[0]!.x2, 723);
	});

	it("sets the labels at their own values, 1.1k above the top line, right-aligned at 37 (606:466–469, ±0.3)", () => {
		const p = acutePlot(acute(), PHONE);
		assert.deepEqual(
			p.ticks.map((t) => t.text),
			["1.1k", "750", "375", "0"],
		);
		nearAll(
			p.ticks.map((t) => t.y),
			[15.34, 61.52, 107.7, 153.88],
			0.3,
			"label",
		);
		assert.ok(p.ticks[0]!.y < p.grid[0]!.y - 8);
		assert.equal(p.ticks[0]!.x, ACUTE_FRAME.labelRight);
	});

	it("puts a dot a day 11.753 apart from 51.9, at the twin's heights (606:472–499)", () => {
		const p = acutePlot(acute(), PHONE);
		nearAll(
			p.points.map((pt) => pt.x),
			Array.from({ length: 28 }, (_, i) => 51.9 + 11.753 * i),
			0.02,
			"x",
		);
		nearAll(
			p.points.map((pt) => pt.y),
			twinDots,
			0.01,
			"y",
		);
		assert.match(p.line, /^M51\.9 107\.62 L63\.65 92\.72 /);
	});

	it("bands 0.8× to 1.5× chronic from the first day to the last, as the twin's vector (606:470: 51.9, 70.49, 317.33 × 49.89)", () => {
		const p = acutePlot(acute(), PHONE);
		const numbers = p.band.match(/-?[\d.]+/g)!.map(Number);
		const xs = numbers.filter((_, i) => i % 2 === 0);
		const ys = numbers.filter((_, i) => i % 2 === 1);
		near(Math.min(...xs), 51.9, 0.01, "left");
		near(Math.max(...xs), 369.23, 0.01, "right");
		near(Math.min(...ys), 70.49, 0.02, "top");
		near(Math.max(...ys), 120.38, 0.02, "foot");
		assert.equal((p.band.match(/M/g) ?? []).length, 1);
	});

	it("adds the chronic line and its squares with the chip on, nothing moving (606:676–704)", () => {
		const off = acutePlot(acute(), PHONE);
		const on = acutePlot(acute(CHRONIC_SUB), PHONE);
		assert.equal(off.chronic, undefined);
		assert.deepEqual([on.points, on.band, on.grid], [off.points, off.band, off.grid]);
		nearAll(
			on.chronic!.squares.slice(0, 3).map((s) => s.y),
			[101.04 + 3.5, 98.09 + 3.5, 97.47 + 3.5],
			0.02,
			"square",
		);
		nearAll(
			on.chronic!.squares.slice(0, 3).map((s) => s.x),
			[51.9, 63.65, 75.41],
			0.02,
			"square x",
		);
	});

	it("dots the axis at y 178 and labels its ends at 190.97 (602:164)", () => {
		const p = acutePlot(acute(), PHONE);
		assert.deepEqual([p.dots.length, p.dots[0]!.y, p.dots[0]!.r, p.dots[1]!.r], [28, 178, 4, 2]);
		assert.deepEqual(
			p.labels.map((l) => [l.text, l.y]),
			[
				["09-14", 190.97],
				["10-11", 190.97],
			],
		);
	});

	it("stretches across a pane: days 24.57 apart, the last at 715.23 (610:1587–1614)", () => {
		const p = acutePlot(acute(), PANE_COLUMN);
		near(p.points[1]!.x - p.points[0]!.x, 24.57, 0.01, "pitch");
		near(p.points[27]!.x, 715.23, 0.01, "last");
		near(p.points[14]!.y, 63.72 + 4, 0.01, "Sep 28");
	});

	it("breaks the band at a day without a chronic load, and draws no band for a lone day", () => {
		const x = (f: number) => f * 100;
		const y = (v: number) => v;
		assert.equal(bandPath([{ x: 0, low: 1, high: 2 }, null, { x: 0.5, low: 1, high: 2 }, { x: 1, low: 1, high: 3 }], x, y), "M50 2L100 3L100 1L50 1Z");
	});
});

describe("Training Load — Load Ratio", () => {
	it("draws 0 … 2.3 over 133.33 pt, its lines and labels together from 42 (606:902–909)", () => {
		const p = ratioPlot(ratio(), PHONE);
		nearAll(
			p.grid.map((g) => g.y),
			[20.83, 67.17, 107.83, 154.17],
			0.05,
			"line",
		);
		nearAll(
			p.ticks.map((t) => t.y),
			[20.34, 67.01, 107.51, 153.84],
			0.55,
			"label",
		);
		assert.deepEqual(
			p.ticks.map((t) => t.text),
			["2+", "1.5", "0.8", "0"],
		);
		assert.deepEqual([p.grid[0]!.x1, p.grid[0]!.x2, p.ticks[0]!.x], [42, 377, RATIO_FRAME.labelRight]);
	});

	it("puts the ratio a day 11.827 apart from 50 (606:912–939), and the band across the days from 1.5 down to 0.8", () => {
		const p = ratioPlot(ratio(), PHONE);
		near(p.points[1]!.x - p.points[0]!.x, 11.827, 0.01, "pitch");
		nearAll(
			p.points.slice(0, 3).map((pt) => pt.y),
			[98 + 4, 86.4 + 4, 86.4 + 4],
			0.01,
			"y",
		);
		assert.equal(p.band, "M50 67.22H369.33V107.79H50Z");
		const pane = ratioPlot(ratio(), PANE_COLUMN);
		near(pane.points[27]!.x, 715.33, 0.01, "pane last");
		assert.equal(pane.grid[0]!.x2, 723);
	});

	it("pins a ratio past 2.3 to the top line (Inferred)", () => {
		const chart = ratio();
		const high: RatioChart = { ...chart, ratio: chart.ratio.map((p, i) => (i === 0 ? { ...p, value: 2.6 } : p)) };
		assert.equal(ratioPlot(high, PHONE).points[0]!.y, ratioPlot(high, PHONE).grid[0]!.y);
	});
});

describe("the page's rhythm", () => {
	it("lands the phone's blocks where the twin has them, from a header ending at 160.33", () => {
		const H = 160.33;
		const f = LOAD_LAYOUT.focus;
		const title = H + f.title;
		const copy = title + 28 + f.copy;
		const rows = copy + 60 + f.rows;
		near(title, 179.01, 0.01, "focus title");
		near(copy - 1, 213.52, 0.01, "focus copy");
		near(rows, 299, 0.01, "focus rows");
		near(rows + 2 * FOCUS_ROW.pitch + FOCUS_ROW.height + f.legend, 438.67, 0.01, "focus legend");

		const e = LOAD_LAYOUT.exercise;
		const heading = H + e.heading;
		const chart = heading + 22 + e.chart;
		const legend = chart + EXERCISE_FRAME.height + e.legend;
		const list = legend + 16 + e.legendRow + 16 + e.list;
		assert.deepEqual([heading, chart, legend, list].map((v) => Math.round(v * 100) / 100), [166.86, 214, 374.33, 417.33]);
		near(list + 12 * 57 + e.bottom, 1135.33, 0.01, "exercise frame");

		const t = LOAD_LAYOUT.training;
		const segmented = H + t.segmented;
		const tTitle = segmented + 32 + t.title;
		const tChart = tTitle + 22 + t.chart;
		const tLegend = tChart + 200 + t.legend;
		const chip = tLegend + 16 + t.chip;
		const status = chip + 36 + t.status;
		assert.deepEqual([segmented, tTitle, tChart, tLegend, chip, status, status + 28 + t.copy - 1].map((v) => Math.round(v * 100) / 100), [183.33, 253.86, 314, 522.67, 544.33, 616.68, 651.19]);
		const rule = tLegend + 16 + t.figures;
		const value = rule + 1 + t.figureValue;
		const ratioStatus = rule + 1 + t.figureValue + 26 + 16 + t.figuresStatus;
		assert.deepEqual([rule, value, ratioStatus, ratioStatus + 28 + t.copy - 1].map((v) => Math.round(v * 100) / 100), [569.33, 575.68, 641.68, 676.19]);
	});

	it("lands a pane's columns where the twin has them, from a body starting at 117", () => {
		const B = 117;
		const f = LOAD_LAYOUT.focus;
		assert.deepEqual([B + f.paneTop, B + f.paneTitle, B + f.paneTitle + 28 + f.copy - 1].map((v) => Math.round(v * 100) / 100), [148, 154.34, 188.85]);
		const e = LOAD_LAYOUT.exercise;
		const chart = B + e.paneTop + 22 + e.chart;
		assert.deepEqual([chart, B + e.paneLegend, B + e.paneLegend + 16 + e.legendRow, chart + 150 + e.paneList].map((v) => Math.round(v * 100) / 100), [195.14, 203.94, 225.28, 375.14]);
		const t = LOAD_LAYOUT.training;
		const segmented = B + t.paneTop;
		const legend = segmented + 32 + t.paneLegend;
		const chip = legend + 16 + t.paneChip;
		const status = chip + 36 + t.status;
		const rule = legend + 16 + t.figures;
		const ratioStatus = rule + 1 + t.figureValue + 26 + 16 + t.figuresStatus;
		assert.deepEqual(
			[B + t.paneTop + 22 + t.chart, legend, chip - 1, status, status + 28 + t.copy - 1, rule, ratioStatus, ratioStatus + 28 + t.copy - 1].map((v) => Math.round(v * 100) / 100),
			[208.14, 204, 236, 309.35, 343.86, 250.66, 323.01, 357.52],
		);
	});
});
