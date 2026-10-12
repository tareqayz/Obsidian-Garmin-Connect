import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { POWER_FRAME, powerPlot, type PowerPlot } from "../src/dashboard/cycling-power-curve-charts";
import { cyclingPowerCurveView, type CyclingPowerCurveView, type PowerCurveRange } from "../src/dashboard/cycling-power-curve-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import type { ActivityRow } from "../src/sync/activity-index";
import { RIDES, TODAY } from "./cycling-power-curve-fixture";

/*
 * The chart against the Obsidian twin (Figma page 430:6118): the phones
 * 780:131509 (4w), 780:131806 (1y), 780:132258 (1y −1) and 780:132411 (a
 * 5-hour record), and the pane 783:1986 (1y), from each node's box. A
 * phone's chart box sits at page (0, 240), a pane's at (32, 197.14) in its
 * 748 pt column, so the twin's page values are the box's plus those. Today
 * is the capture day.
 */
const view = (range: PowerCurveRange, opts: { offset?: number; rows?: readonly ActivityRow[] } = {}): CyclingPowerCurveView =>
	cyclingPowerCurveView({ range, offset: opts.offset ?? 0 }, opts.rows ?? RIDES, { today: TODAY, complete: true });
const plot = (range: PowerCurveRange, width: number, opts: Parameters<typeof view>[1] = {}): PowerPlot => powerPlot(view(range, opts), width);

const near = (actual: number, expected: number, tolerance = 0.01, what = "") =>
	assert.ok(Math.abs(actual - expected) <= tolerance + 1e-9, `${what} ${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01, what = "") => {
	assert.equal(actual.length, expected.length, `${what}: ${actual.length} values, not ${expected.length}`);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance, `${what} ${i}`));
};

/** The phone's chart box, page y; the pane's, page x and y. */
const PHONE_BOX = 240;
const PANE_BOX = { x: 32, y: 197.14 };

/** The Chart Axes component (779:28), box coordinates: 0.33 pt gridlines' tops, Axis labels' 12 pt boxes' tops, Ø 8 dots' boxes. */
const TWIN = {
	gridTops: [7.67, 31.95, 56.22, 80.5, 104.78, 129.06, 153.34, 177.33],
	labelTops: [1.51, 25.79, 50.07, 74.35, 98.63, 122.9, 147.18, 171.46],
	phoneDots: [46, 69.64, 93.29, 116.93, 140.57, 164.21, 187.86, 211.5, 235.14, 258.79, 282.43, 306.07, 329.71, 353.36, 377],
	phoneLabels: [49.2, 72.84, 96.49, 120.13, 143.77, 167.41, 191.06, 214.7, 238.34, 261.99, 285.63, 309.27, 332.91, 356.56, 380.2],
	paneDots: [46, 94.36, 142.71, 191.07, 239.43, 287.79, 336.14, 384.5, 432.86, 481.21, 529.57, 577.93, 626.29, 674.64, 723],
	paneLabels: [49.2, 97.56, 145.91, 194.27, 242.63, 290.99, 339.34, 387.7, 436.06, 484.41, 532.77, 581.13, 629.49, 677.84, 726.2],
};

/** A path's corners, "x y" pairs in order. */
const corners = (d: string) => [...d.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

describe("the chart's box", () => {
	it("is 244 pt tall at any width, the plot from x 50 to 21 short of its right edge: 381 on the phone, 727 in a pane (page 759)", () => {
		for (const width of [PHONE, PANE_COLUMN]) {
			const p = plot("4w", width);
			assert.deepEqual([p.height, p.left, p.right, p.foot], [244, 50, width - 21, 177.67]);
		}
		assert.equal(PANE_BOX.x + plot("1y", PANE_COLUMN).right, 759);
		assert.deepEqual([POWER_FRAME.top, POWER_FRAME.zero, POWER_FRAME.labelRight], [7.835, 177.78, 37.2]);
	});

	it("maps watts as the twin does: y = 177.78 − 0.24278·W in the box, page 417.78 − 0.24278·W on the phone, 374.92 − 0.24278·W in a pane", () => {
		const p = plot("1y", PHONE);
		// The Record's 1 s 687 W and 2 hr 167 W; the period's 1 s 671 W.
		for (const [y, watts] of [
			[p.record.points[0]!.y, 687],
			[p.record.points[13]!.y, 167],
			[p.period.points[0]!.y, 671],
		] as const) {
			near(PHONE_BOX + y, 417.78 - 0.24278 * watts, 0.01, `${watts} W`);
			near(PANE_BOX.y + y, 374.92 - 0.24278 * watts, 0.01, `${watts} W in a pane`);
		}
	});

	it("draws a gridline at every tick, 24.28 apart from page 247.67, the 0 line faint and inside the plot's foot", () => {
		const p = plot("4w", PHONE);
		nearAll(
			p.grid.map((g) => g.y),
			TWIN.gridTops.map((top) => top + 0.165),
			0.01,
			"gridline",
		);
		assert.deepEqual(p.grid.map((g) => g.label), ["700", "600", "500", "400", "300", "200", "100", "0"]);
		assert.deepEqual(p.grid.map((g) => g.zero), [false, false, false, false, false, false, false, true]);
		assert.ok(p.grid.every((g) => g.x1 === 50 && g.x2 === 381));
		near(PHONE_BOX + p.grid[0]!.y - 0.165, 247.67, 0.01, "top gridline's top");
		near(p.grid[1]!.y - p.grid[0]!.y, 24.28, 0.01, "pitch");
		// The 0 line sits inside the clip box, so the areas cover it.
		assert.ok(p.grid[7]!.y + POWER_FRAME.grid / 2 <= p.foot);
		// In a pane's column they run on to 727 (page 759).
		assert.ok(plot("1y", PANE_COLUMN).grid.every((g) => g.x1 === 50 && g.x2 === 727));
	});

	it("labels the gridlines right-aligned to x 37.2, each centred 0.33 above its line", () => {
		const p = plot("4w", PHONE);
		assert.equal(p.labelRight, 37.2);
		nearAll(
			p.grid.map((g) => g.labelY),
			TWIN.labelTops.map((top) => top + 6),
			0.01,
			"y label",
		);
	});
});

describe("the axis under the plot", () => {
	it("on the phone: a Ø 8 dot at every duration, 23.64 apart from x 50, centred 184.67 (page 424.67)", () => {
		const p = plot("4w", PHONE);
		nearAll(
			p.dots.map((d) => d.x),
			TWIN.phoneDots.map((left) => left + 4),
			0.01,
			"dot",
		);
		assert.ok(p.dots.every((d) => d.y === 184.67 && d.r === 4));
		near(PHONE_BOX + p.dots[0]!.y, 424.67, 0.001, "page y");
		// 2 hr at 357.36, 5 hr at 381, as the coordinator's x = 50 + i·331/14.
		assert.deepEqual([p.dots[13]!.x, p.dots[14]!.x], [357.36, 381]);
	});

	it("on the phone: each duration's name on end, centred 207.2 down at the twin's text box, 0.8 left of its dot; Interval Length at (203.5, 234.34)", () => {
		const p = plot("4w", PHONE);
		nearAll(
			p.labels.map((l) => l.x),
			TWIN.phoneLabels,
			0.01,
			"label",
		);
		assert.ok(p.labels.every((l) => l.y === 207.2));
		assert.deepEqual(
			p.labels.map((l) => l.text),
			["1 sec", "2 sec", "5 sec", "10 sec", "20 sec", "30 sec", "1 min", "2 min", "5 min", "10 min", "20 min", "30 min", "1 hr", "2 hr", "5 hr"],
		);
		assert.deepEqual(p.title, { x: 203.5, y: 234.34, text: "Interval Length" });
		// Its page box: a 120 pt Caption box, 14 tall, at (143.5, 467.34).
		nearAll([p.title.x - 60, PHONE_BOX + p.title.y - 7], [143.5, 467.34], 0.001, "Interval Length's box");
	});

	it("in a pane's column: the dots 48.36 apart (page x = 82 + i·677/14), the labels with them, Interval Length at 363.96", () => {
		const p = plot("1y", PANE_COLUMN);
		nearAll(
			p.dots.map((d) => d.x),
			TWIN.paneDots.map((left) => left + 4),
			0.01,
			"dot",
		);
		nearAll(
			p.dots.map((d) => PANE_BOX.x + d.x),
			p.dots.map((_, i) => 82 + (i * 677) / 14),
			0.01,
			"page x",
		);
		nearAll(
			p.labels.map((l) => l.x),
			TWIN.paneLabels,
			0.01,
			"label",
		);
		near(p.title.x, 363.96, 0.01, "Interval Length");
		assert.deepEqual([p.dots[0]!.y, p.labels[0]!.y, p.title.y], [184.67, 207.2, 234.34]);
	});
});

describe("the curves", () => {
	it("4w: the Record alone, its area from 1 sec to 2 hr standing on the plot's foot, as the twin's record area and line (780:131570)", () => {
		const p = plot("4w", PHONE);
		assert.deepEqual([p.period.line, p.period.area, p.period.points], ["", "", []]);
		assert.equal(p.record.points.length, 14);
		// The twin's vectors, in the plot (50, 240): the area 307.357 × 166.68 from (0, 10.99), the line 126.246 tall.
		const area = corners(p.record.area);
		near(Math.min(...area.map(([x]) => x)) - 50, 0, 0.01, "area left");
		near(Math.max(...area.map(([x]) => x)) - 50, 307.357, 0.01, "area right");
		near(Math.min(...area.map(([, y]) => y)), 10.99, 0.01, "area top");
		near(Math.max(...area.map(([, y]) => y)), 177.67, 0.01, "area foot");
		const line = corners(p.record.line);
		near(Math.max(...line.map(([, y]) => y)) - Math.min(...line.map(([, y]) => y)), 126.246, 0.01, "line height");
		assert.equal(line.length, 14);
	});

	it("draws the area down the last value's x and back along the foot: no point at 5 hr", () => {
		const p = plot("4w", PHONE);
		assert.ok(p.record.area.startsWith("M50 177.67 L50 10.99 L73.64 "));
		assert.ok(p.record.area.endsWith("L357.36 137.24 L357.36 177.67 Z"));
		assert.ok(p.record.line.startsWith("M50 10.99 L73.64 "));
		assert.ok(p.record.line.endsWith("L357.36 137.24"));
	});

	it("1y: the period's area and line over the Record's, from 671 W (y 14.875) to 167 W, as the twin's (780:131867)", () => {
		const p = plot("1y", PHONE);
		const area = corners(p.period.area);
		near(Math.min(...area.map(([, y]) => y)), 14.875, 0.01, "period area top");
		near(Math.max(...area.map(([, y]) => y)), 177.67, 0.01, "period area foot");
		const line = corners(p.period.line);
		near(Math.max(...line.map(([, y]) => y)) - Math.min(...line.map(([, y]) => y)), 122.361, 0.01, "period line height");
		near(line.at(-1)![0] - 50, 307.357, 0.01, "period line right");
		// The Record shows above it at 1 s, 2 s, 1 min and 2 min only.
		const above = p.record.points.map((r, i) => (r.y < p.period.points[i]!.y ? i : -1)).filter((i) => i >= 0);
		assert.deepEqual(above, [0, 1, 6, 7]);
	});

	it("1y −1: the period from 687 W to 146 W, its line 131.344 tall (780:132258)", () => {
		const p = plot("1y", PHONE, { offset: -1 });
		const line = corners(p.period.line);
		near(line[0]![1], 10.99, 0.01, "first");
		near(line.at(-1)![1], 10.99 + 131.344, 0.01, "last");
	});

	it("a 5-hour record runs the curves to 5 hr, x 381, the plot's end (Inferred, 780:132411)", () => {
		const long: ActivityRow = { id: 9100, type: "road_biking", typeId: 10, parentTypeId: 2, start: "2026-10-04T07:00:00", begin: Date.parse("2026-10-04T03:00:00Z"), power: { "1": 600, "7200": 170, "18000": 150 } };
		const p = plot("4w", PHONE, { rows: [...RIDES, long] });
		assert.equal(p.record.points.at(-1)!.x, 381);
		assert.ok(p.record.area.endsWith("L381 177.67 Z"));
		assert.equal(p.period.points.at(-1)!.x, 381);
	});

	it("keeps the top tick at 7.835 for a higher axis: a 720 W record gives 0–800, 700 W at 29.08", () => {
		const strong: ActivityRow = { id: 9101, type: "road_biking", typeId: 10, parentTypeId: 2, start: "2026-10-04T07:00:00", begin: Date.parse("2026-10-04T03:00:00Z"), power: { "1": 720 } };
		const p = plot("4w", PHONE, { rows: [...RIDES, strong] });
		assert.deepEqual(p.grid.map((g) => g.label), ["800", "700", "600", "500", "400", "300", "200", "100", "0"]);
		near(p.grid[0]!.y, 7.835, 0.01, "800");
		near(p.grid[1]!.y, 177.78 - (700 / 800) * (177.78 - 7.835), 0.01, "700");
		near(p.grid[1]!.y, 29.08, 0.01, "700");
	});

	it("without a ride at all: no curve, the axis 0–100 with its dots and labels", () => {
		const p = plot("1y", PHONE, { rows: [] });
		assert.deepEqual([p.record.line, p.record.area, p.period.line], ["", "", ""]);
		assert.deepEqual(p.grid.map((g) => [g.label, g.y]), [["100", 7.84], ["0", 177.5]]);
		assert.equal(p.dots.length, 15);
		assert.equal(p.labels.length, 15);
	});

	it("draws a lone value as a zero-length segment, which its round cap makes a dot", () => {
		const lone: ActivityRow = { id: 9102, type: "road_biking", typeId: 10, parentTypeId: 2, start: "2026-10-11T07:00:00", begin: Date.parse("2026-10-11T03:00:00Z"), power: { "1": 350 } };
		const p = plot("4w", PHONE, { rows: [lone] });
		assert.equal(p.period.line, `M50 ${p.period.points[0]!.y} L50 ${p.period.points[0]!.y}`);
		assert.equal(p.period.area, `M50 177.67 L50 ${p.period.points[0]!.y} L50 177.67 Z`);
	});
});
