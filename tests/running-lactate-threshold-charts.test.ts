import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	AXIS_DOT,
	GRID_INSET,
	INSET_LABELS,
	LABEL_CHAR,
	LEFT_SIDE,
	LINE_WIDTH,
	LT_FRAMES,
	MARKER,
	PANE_BOX_TOP,
	PHONE_BOX_TOP,
	gridInset,
	leftSide,
	ltPlot,
	markerPath,
	type LtPlot,
} from "../src/dashboard/running-lactate-threshold-charts";
import { runningLactateThresholdView, type LtChipId, type LtData, type LtPeriodView } from "../src/dashboard/running-lactate-threshold-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { FTP_INDEX, rowsOfRanges } from "../src/sync/ftp-index";
import { LACTATE_THRESHOLD_INDEX, thresholdRows } from "../src/sync/lactate-threshold-index";
import { wattsPayload, wkgPayload } from "./ftp-fixture";
import { hrPayload, speedPayload } from "./running-lactate-threshold-fixture";

/*
 * The chart's geometry against the Obsidian twin (Figma page 430:6126) on
 * the capture day: the phone frames at 402 (4w 755:154 / 755:344 / 755:536,
 * 12w 755:728, 1y 755:1648, 12w −1 755:2208, 4w empty 755:2418) and the
 * panes' 748 pt chart column (12w Pace 758:1092, 1y Power 758:1230). The box
 * starts at the title's foot: the tests add 196.86 (phone) or 171 (pane) to
 * compare with the twin's page y.
 */
const TODAY = "2026-10-11";
const DATA: LtData = {
	lt: thresholdRows(hrPayload("2024-10-08", TODAY), speedPayload("2024-10-08", TODAY)).map((r) => LACTATE_THRESHOLD_INDEX.normalize(r)!),
	power: rowsOfRanges(wattsPayload("2024-10-08", TODAY), wkgPayload("2024-10-08", TODAY)).map((r) => FTP_INDEX.normalize(r)!),
};

const view = (range: "4w" | "12w" | "1y", chip: LtChipId, opts: { offset?: number; today?: string } = {}) =>
	runningLactateThresholdView(
		{ range, offset: opts.offset ?? 0, ...(chip === "pace" ? {} : { sub: chip }) },
		DATA,
		{ today: opts.today ?? TODAY, complete: { lt: true, power: true } },
	) as LtPeriodView;

const plot = (range: "4w" | "12w" | "1y", chip: LtChipId, opts: { offset?: number; today?: string; pane?: boolean } = {}) => {
	const v = view(range, chip, opts);
	return ltPlot(v.chart, range, opts.pane ? PANE_COLUMN : PHONE, opts.pane);
};

/** Close to the twin's number: its positions carry the phone's pixel rounding. */
const near = (got: number, want: number, tol = 0.02, what = "") => assert.ok(Math.abs(got - want) <= tol, `${what} ${got} vs ${want}`);

/** A plot's y as the twin's page y. */
const page = (y: number, pane = false) => y + (pane ? PANE_BOX_TOP : PHONE_BOX_TOP);

/** The markers of a series as [x, page y]. */
const markers = (p: LtPlot, i: 0 | 1, pane = false) => p.series[i]!.markers.map((m) => [m.x, page(m.y, pane)]);

/** The twin's marker frames are 16 pt, placed at (x − 8, y − 8): their centres. */
const centres = (frames: Array<[number, number]>) => frames.map(([x, y]) => [x + 8, y + 8]);

function sameMarkers(got: number[][], frames: Array<[number, number]>, tol = 0.02, what = "") {
	const want = centres(frames);
	assert.equal(got.length, want.length, `${what}: ${got.length} markers, the twin ${want.length}`);
	got.forEach(([x, y], i) => {
		near(x!, want[i]![0]!, tol, `${what} #${i} x`);
		near(y!, want[i]![1]!, tol, `${what} #${i} y`);
	});
}

describe("the frames", () => {
	it("start at the title's foot and end at the legend on a phone (500.67), at the x axis' foot in a pane", () => {
		assert.equal(PHONE_BOX_TOP, 174.86 + 22);
		assert.equal(PANE_BOX_TOP, 149 + 22);
		for (const range of ["4w", "12w", "1y"] as const) near(page(LT_FRAMES[range].height), 500.67, 0.001, range);
		// 4w's x axis frame ends at 469 + 25, 12w's and 1y's at 449 + 50; the pane's 12w chart frame at 210.47 + 262.67.
		near(page(LT_FRAMES["4w"].paneHeight), 494, 0.001);
		near(page(LT_FRAMES["12w"].paneHeight), 499, 0.001);
		near(page(LT_FRAMES["1y"].paneHeight, true), 210.47 + 262.67, 0.001);
	});

	it("keeps the twin's insets: heart rate's side by its labels, the right side by range and chip", () => {
		assert.deepEqual(LEFT_SIDE, { narrow: { labelRight: 27.12, gridLeft: 43 }, wide: { labelRight: 29.78, gridLeft: 45 } });
		assert.deepEqual(GRID_INSET, { "4w": { pace: 49, power: 45, wkg: 36 }, "12w": { pace: 48, power: 45, wkg: 31 }, "1y": { pace: 48, power: 45, wkg: 31 } });
		assert.deepEqual([leftSide(["195", "190", "185", "180", "175"], "12w"), leftSide(["200", "195", "190", "185", "180"], "4w")], [LEFT_SIDE.narrow, LEFT_SIDE.wide]);
		assert.deepEqual([leftSide(undefined, "4w"), leftSide([], "1y")], [LEFT_SIDE.narrow, LEFT_SIDE.wide]);
		// W/kg's "9" ends where 12w's does, 5 pt a character; a mile's "10:05" one character further left.
		assert.equal(LABEL_CHAR, 5);
		assert.deepEqual([gridInset("4w", "wkg", ["9", "8", "7", "6", "5"]), gridInset("12w", "wkg", ["10", "8", "6", "4", "2"])], [31, 36]);
		assert.equal(gridInset("1y", "pace", ["9:40", "10:00", "10:20", "10:40", "11:00"]), 53);
		assert.equal(gridInset("4w", "power", undefined), 45);
		assert.deepEqual(INSET_LABELS["4w"], { pace: "4:45", power: "370", wkg: "10" });
	});

	it("draws the twin's Chart Marker shapes: circle Ø 8, square 8, triangle 7 × 5.67 by its centroid, diamond 7.33; 1.67 pt lines", () => {
		assert.deepEqual(MARKER, { circle: 4, square: 8, diamond: 7.33, triangle: { width: 7, height: 5.67 } });
		assert.equal(markerPath("square", 10, 20), "M6 16H14V24H6Z");
		assert.equal(markerPath("triangle", 10, 20), "M10 16.22L13.5 21.89H6.5Z");
		assert.equal(markerPath("diamond", 10, 20), "M10 16.34L13.67 20L10 23.67L6.34 20Z");
		assert.equal(markerPath("circle", 10, 20), "M6 20A4 4 0 1 0 14 20A4 4 0 1 0 6 20Z");
		assert.equal(LINE_WIDTH, 1.67);
	});
});

describe("4w at 402 (755:154, 755:344, 755:536)", () => {
	it("Pace: gridlines 247.67 + 49.33k from 43 to 353, heart rate's labels at 27.12, the pace's at 367.88", () => {
		const p = plot("4w", "pace");
		[247.67, 297, 346.33, 395.66, 444.99].forEach((y, i) => near(page(p.grid[i]!.y), y, 0.02, `grid ${i}`));
		assert.ok(p.grid.every((g) => g.x1 === 43 && g.x2 === 353));
		assert.deepEqual([p.leftLabels.x, p.rightLabels.x], [27.12, 367.88]);
		assert.deepEqual(p.leftLabels.ticks.map((t) => t.text), ["195", "190", "185", "180", "175"]);
		assert.deepEqual(p.rightLabels.ticks.map((t) => t.text), ["4:25", "4:30", "4:35", "4:40", "4:45"]);
		// Each label centred half a point above its line: the twin's label boxes sit at the line's top edge − 7.
		p.leftLabels.ticks.forEach((t, i) => near(t.y, p.grid[i]!.y - 0.5, 0.011));
	});

	it("Pace: the plot from 50.33 to 345.33; 28 dots at 474.83, the ends Ø 7.67; '09-14' and '10-11' under them at 487.97", () => {
		const p = plot("4w", "pace");
		assert.deepEqual([p.left, p.right], [50.33, 345.33]);
		assert.equal(p.dots.length, 28);
		assert.deepEqual([p.dots[0]!.x, p.dots[27]!.x], [50.33, 345.33]);
		near(page(p.dots[0]!.y), 474.83);
		assert.deepEqual(p.dots.map((d) => d.r).filter((r) => r === AXIS_DOT.large).length, 2);
		assert.deepEqual([AXIS_DOT.small * 2, AXIS_DOT.large * 2], [3.67, 7.67]);
		// The twin's day dots: 61.25 (dot 2's 59.42 + 1.835) … 334.41.
		near(p.dots[1]!.x, 59.42 + 1.835, 0.03);
		near(p.dots[26]!.x, 332.57 + 1.835, 0.03);
		assert.deepEqual(p.labels.map((l) => [l.x, l.text, l.rotated]), [[50.33, "09-14", false], [345.33, "10-11", false]]);
		near(page(p.labels[0]!.y), 12.97 + 469 + 6);
	});

	it("Pace: one heart rate circle and one pace square on Sep 19, no line", () => {
		const p = plot("4w", "pace");
		sameMarkers(markers(p, 0), [[96.96, 367.93]], 0.02, "HR");
		sameMarkers(markers(p, 1), [[96.96, 275.76]], 0.02, "pace");
		assert.deepEqual([p.series[0]!.line, p.series[1]!.line], ["", ""]);
		assert.deepEqual(p.series.map((s) => s.shape), ["circle", "square"]);
	});

	it("Power: the gridlines end at 357, the labels at 371.88; a flat line from Sep 19 to Oct 8", () => {
		const p = plot("4w", "power");
		assert.deepEqual([p.grid[0]!.x2, p.rightLabels.x, p.right], [357, 371.88, 349.33]);
		sameMarkers(markers(p, 0), [[97.7, 367.93]], 0.02, "HR");
		sameMarkers(markers(p, 1), [[97.7, 397.53], [308.11, 397.53]], 0.02, "power");
		assert.equal(p.series[1]!.line, "M105.7 208.67 L316.11 208.67");
		near(page(208.67), 405.53);
		assert.equal(p.series[1]!.shape, "triangle");
	});

	it("W/kg: the gridlines end at 366 for '10', the labels at 380.88; the twin's W/kg plot, a third of a point off the phone's pixels", () => {
		const p = plot("4w", "wkg");
		assert.deepEqual([p.grid[0]!.x2, p.rightLabels.x, p.right], [366, 380.88, 358.33]);
		assert.deepEqual(p.rightLabels.ticks.map((t) => t.text), ["10", "8", "6", "4", "2"]);
		// The twin's W/kg frame carries the shot's own rounding: its plot runs 50.67 → 358.0 and its labels start at 380.55.
		sameMarkers(markers(p, 0), [[99.57, 367.93]], 0.27, "HR");
		sameMarkers(markers(p, 1), [[99.57, 357.92], [315.85, 357.92]], 0.27, "W/kg");
		near(p.rightLabels.x, 402 - 21.45, 0.34);
		assert.equal(p.series[1]!.shape, "diamond");
	});
});

describe("12w at 402 (755:728)", () => {
	const p = plot("12w", "pace");

	it("gridlines 246.33 → 431.33 from 45 to 354; heart rate's labels at 29.78, the pace's at 368.88", () => {
		[246.33, 292.58, 338.83, 385.08, 431.33].forEach((y, i) => near(page(p.grid[i]!.y), y, 0.02, `grid ${i}`));
		// The twin's own lines (246.33, 292.67, 339, 385, 431.33) keep the shot's pixel rounding: within 0.17.
		[246.33, 292.67, 339, 385, 431.33].forEach((y, i) => near(page(p.grid[i]!.y), y, 0.18, `twin grid ${i}`));
		assert.ok(p.grid.every((g) => g.x1 === 45 && g.x2 === 354));
		assert.deepEqual([p.leftLabels.x, p.rightLabels.x, p.left, p.right], [29.78, 368.88, 52.33, 346.33]);
		assert.deepEqual(p.leftLabels.ticks.map((t) => t.text), ["200", "195", "190", "185", "180"]);
	});

	it("13 dots at 456.83, the block starts and today; labels on end centred 479.5, half a point left of their dot", () => {
		const twin = [48.49, 73.29, 98.08, 122.89, 147.68, 172.48, 197.26, 222.07, 246.85, 271.65, 296.45, 321.24, 342.49].map((x) => x + 3.835);
		assert.equal(p.dots.length, 13);
		p.dots.forEach((d, i) => near(d.x, twin[i]!, 0.02, `dot ${i}`));
		assert.ok(p.dots.every((d) => d.r === AXIS_DOT.large));
		near(page(p.dots[0]!.y), 456.83);
		const labels = [51.83, 76.63, 101.42, 126.22, 151.01, 175.81, 200.6, 225.4, 250.19, 274.99, 299.78, 324.58, 345.83];
		p.labels.forEach((l, i) => near(l.x, labels[i]!, 0.02, `label ${i}`));
		assert.ok(p.labels.every((l) => l.rotated));
		near(page(p.labels[0]!.y), 449 + 10.5 + 20);
	});

	it("heart rate 182 · 184 · 186 · 184 · 182 and pace on the same days, each line through its markers", () => {
		const days: Array<[number, number]> = [[69.13, 0], [139.97, 0], [164.76, 0], [224.98, 0], [260.4, 0]];
		sameMarkers(markers(p, 0), days.map(([x], i) => [x, [404.83, 386.33, 367.83, 386.33, 404.83][i]!]), 0.02, "HR");
		sameMarkers(markers(p, 1), days.map(([x], i) => [x, [272.16, 290.85, 309.81, 272.16, 272.16][i]!]), 0.03, "pace");
		// The twin's line vectors start at the first marker's centre: x 77.13.
		assert.ok(p.series[0]!.line.startsWith("M77.13 "));
		assert.equal(p.series[0]!.line.split("L").length, 5);
	});
});

describe("1y at 402 (755:1648)", () => {
	const p = plot("1y", "power");

	it("gridlines from 45 to 357, the labels at 371.88; the plot from 52.33 to 349.33", () => {
		assert.deepEqual([p.grid[0]!.x1, p.grid[0]!.x2, p.rightLabels.x, p.left, p.right], [45, 357, 371.88, 52.33, 349.33]);
		assert.deepEqual(p.rightLabels.ticks.map((t) => t.text), ["420", "400", "380", "360", "340"]);
	});

	it("heart rate's 12 months and power's 12, each at its own day", () => {
		const hr: Array<[number, number]> = [
			[44.33, 349.33], [67.24, 367.83], [89.33, 395.58], [130.24, 377.08], [151.51, 358.58], [179.33, 386.33],
			[200.6, 377.08], [231.69, 367.83], [256.24, 377.08], [279.15, 404.83], [301.24, 367.83], [323.33, 404.83],
		];
		const power: Array<[number, number]> = [
			[44.33, 330.83], [67.24, 310.02], [130.24, 323.89], [151.51, 335.45], [179.33, 363.2], [200.6, 356.27],
			[231.69, 363.2], [243.15, 377.08], [279.15, 390.95], [301.24, 400.2], [323.33, 390.95], [338.88, 390.95],
		];
		sameMarkers(markers(p, 0), hr, 0.02, "HR");
		sameMarkers(markers(p, 1), power, 0.02, "power");
	});

	it("puts the first month dot 2 days left of the plot: today − 12 months", () => {
		near(p.dots[0]!.x, 52.33 - (2 / 363) * 297, 0.01);
		assert.equal(p.dots[12]!.x, 349.33);
		assert.deepEqual(p.labels.map((l) => l.text), ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
	});
});

describe("the Inferred frames", () => {
	it("12w −1 (755:2208): HR 187 · 186 · 187 · 184 and pace 4:15 · 4:19 · 4:23 · 4:19 on their own days", () => {
		const p = plot("12w", "pace", { offset: -1 });
		sameMarkers(markers(p, 0), [[115.17, 358.58], [161.22, 367.83], [210.81, 358.58], [278.11, 386.33]], 0.02, "HR");
		sameMarkers(markers(p, 1), [[115.17, 287.54], [161.22, 321.52], [210.81, 356.49], [278.11, 321.52]], 0.03, "pace");
	});

	it("4w with no point (755:2418): the bare box, its no-data line centred on 346.33, the legend still at 500.67", () => {
		const v = view("4w", "pace", { today: "2026-01-04" });
		assert.equal(v.label, "Dec 8, 2025 - Jan 4, 2026");
		assert.equal(v.chart, null);
		const p = ltPlot(v.chart, "4w", PHONE);
		assert.deepEqual([p.grid, p.series, p.dots], [[], [], []]);
		// The twin's line: a 20 pt box at 336.33.
		near(page(p.middle), 336.33 + 10, 0.02);
		near(page(p.height), 500.67, 0.001);
	});

	it("a side without a point keeps its gridlines and leaves its labels out", () => {
		const p = plot("4w", "power", { today: "2026-10-31" });
		assert.equal(p.grid.length, 5);
		assert.deepEqual([p.leftLabels.ticks, p.series[0]!.markers], [[], []]);
		assert.equal(p.rightLabels.ticks.length, 5);
		// Without heart rate's labels the left side keeps 4w's twin value.
		assert.equal(p.grid[0]!.x1, 43);
	});
});

describe("the panes' 748 pt column", () => {
	it("12w Pace (758:1092): gridlines 45 → 700, the plot 52.33 → 692.33, the top line 49.47 under the title's foot", () => {
		const p = plot("12w", "pace", { pane: true });
		assert.equal(p.width, 748);
		assert.deepEqual([p.grid[0]!.x1, p.grid[0]!.x2, p.left, p.right], [45, 700, 52.33, 692.33]);
		near(page(p.grid[0]!.y, true), 210.47 + 10);
		near(page(p.height, true), 473.14, 0.001);
		const dots = [48.495, 102.4814, 156.446, 210.4324, 264.397, 318.3835, 372.348, 426.3345, 480.2991, 534.2855, 588.2501, 642.2365, 688.495].map((x) => x + 3.835);
		p.dots.forEach((d, i) => near(d.x, dots[i]!, 0.02, `dot ${i}`));
		near(page(p.dots[0]!.y, true), 210.47 + 212.67 + 3.995 + 3.835);
		const twin = (frames: Array<[number, number]>) => frames.map(([x, y]) => [x, y + 210.47] as [number, number]);
		sameMarkers(markers(p, 0, true), twin([[98.316, 168.5], [252.526, 150], [306.491, 131.5], [437.582, 150], [514.686, 168.5]]), 0.02, "HR");
		sameMarkers(markers(p, 1, true), twin([[98.316, 35.83], [252.526, 54.52], [306.491, 73.48], [437.582, 35.83], [514.686, 35.83]]), 0.03, "pace");
	});

	it("1y Power (758:1230): gridlines 45 → 703, the plot 52.33 → 695.33, the first dot at 48.78", () => {
		const p = plot("1y", "power", { pane: true });
		assert.deepEqual([p.grid[0]!.x2, p.left, p.right, p.rightLabels.x], [703, 52.33, 695.33, 717.88]);
		near(p.dots[0]!.x, 44.944 + 3.835, 0.02);
		near(p.dots[12]!.x, 691.495 + 3.835, 0.02);
		const twin = (frames: Array<[number, number]>) => frames.map(([x, y]) => [x, y + 210.47] as [number, number]);
		sameMarkers(
			markers(p, 1, true),
			twin([
				[44.33, 94.5], [93.93, 73.69], [230.324, 87.56], [276.373, 99.12], [336.603, 126.87], [382.652, 119.94],
				[449.961, 126.87], [474.772, 140.75], [552.711, 154.62], [600.536, 163.87], [648.36, 154.62], [682.026, 154.62],
			]),
			0.02,
			"power",
		);
	});
});
