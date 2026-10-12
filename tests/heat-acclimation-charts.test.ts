import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CHART_RHYTHM, DAY_RHYTHM, HEAT_FRAME, LINE_WIDTH, TREND_DISC, TREND_GLYPHS, heatPlot } from "../src/dashboard/heat-acclimation-charts";
import { heatAcclimationView, type HeatPeriodView } from "../src/dashboard/heat-acclimation-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { HEAT_ROWS, TODAY } from "./heat-acclimation-fixture";

/**
 * The Heat Acclimation page's geometry against the Obsidian twin (Figma page
 * 430:6104): phone 7d 630:34, 4w 630:146, 4w − 1 630:439 and the 1d frames
 * 630:9 / 630:423; panes 631:561, 631:591, 631:679. Positions are the
 * twin's node boxes as `get_metadata` reports them, a dot's centre its box
 * plus 4 (Ø 8) or 2 (Ø 4), and the series' own SVG export for the 7d line.
 * The phone's box sits at y 244 under the shell's 165 pt header, the pane's
 * at (32, 218.14) under the 116 pt one.
 */

const PHONE_BOX = { x: 0, y: 244 };
const PANE_BOX = { x: 32, y: 218.14 };

const near = (got: number, want: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(got - want) <= tolerance, `${what}: ${got} vs ${want} (± ${tolerance})`);
const nearAll = (got: readonly number[], want: readonly number[], tolerance: number, what: string) => {
	assert.equal(got.length, want.length, `${what}: count`);
	got.forEach((v, i) => near(v, want[i]!, tolerance, `${what}[${i}]`));
};

function period(range: "7d" | "4w", offset = 0): HeatPeriodView {
	return heatAcclimationView({ range, offset }, HEAT_ROWS, { today: TODAY, complete: true }) as HeatPeriodView;
}

/** A plot's marks in the page's coordinates. */
function onPage(range: "7d" | "4w", offset: number, width: number, box: { x: number; y: number }) {
	const p = heatPlot(period(range, offset).chart, width);
	return {
		p,
		grid: p.grid.map((g) => g.y + box.y),
		gridX: p.grid.map((g) => [g.x1 + box.x, g.x2 + box.x]),
		px: p.points.map((pt) => pt.x + box.x),
		py: p.points.map((pt) => pt.y + box.y),
		dots: p.dots.map((d) => ({ x: d.x + box.x, y: d.y + box.y, r: d.r })),
		labels: p.labels.map((l) => ({ x: l.x + box.x, y: l.y + box.y, text: l.text })),
	};
}

/** The twin's 4w day centres, 1/27 of the plot apart. */
const PHONE_4W_X = [
	46.17, 58.12, 70.07, 82.02, 93.97, 105.92, 117.87, 129.83, 141.78, 153.73, 165.68, 177.63, 189.58, 201.53, 213.48, 225.43, 237.38, 249.33, 261.28, 273.23,
	285.18, 297.14, 309.09, 321.04, 332.99, 344.94, 356.89, 368.84,
];
const PANE_4W_X = [
	46.17, 70.94, 95.7, 120.47, 145.23, 170, 194.76, 219.53, 244.29, 269.06, 293.83, 318.59, 343.36, 368.12, 392.89, 417.65, 442.42, 467.18, 491.95, 516.72,
	541.48, 566.25, 591.01, 615.78, 640.54, 665.31, 690.07, 714.84,
];

describe("Daily Progress on the phone (402)", () => {
	const seven = onPage("7d", 0, PHONE, PHONE_BOX);

	it("is one 211 pt box with five 1 pt gridlines 263.5 + 36.42k, x 46.17 → 368.83, labelled 100% … 0% to x 30.4", () => {
		assert.equal(seven.p.height, 211);
		nearAll(seven.grid, [0, 1, 2, 3, 4].map((k) => 263.5 + 36.42 * k), 0.05, "gridlines");
		// The twin's gridline nodes snap to thirds of a point: within a quarter.
		nearAll(seven.grid, [263.5, 299.83, 336.17, 372.5, 409.17], 0.25, "gridline nodes");
		assert.ok(seven.gridX.every(([a, b]) => a === 46.17 && b === 368.83));
		assert.deepEqual(seven.p.grid.map((g) => g.label), ["100%", "75%", "50%", "25%", "0%"]);
		assert.equal(seven.p.labelRight, 30.4);
	});

	it("7d (630:34): the series' dots and line where the twin exports them, y = 409.17 − 1.4567·%", () => {
		nearAll(seven.px, [46.17, 99.948, 153.727, 207.505, 261.283, 315.062, 368.84], 0.02, "x");
		nearAll(seven.py, [263.5, 263.5, 263.5, 263.5, 310.11, 294.09, 267.87], 0.02, "y");
		assert.equal(seven.p.pointRadius, 4);
		// The line through every dot, in order (M46.17 263.5 H… L261.283 310.114 L315.062 294.091 L368.84 267.87).
		const line = [...seven.p.line.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]) + PHONE_BOX.x, Number(m[2]) + PHONE_BOX.y]);
		assert.deepEqual(line, seven.px.map((x, i) => [x, seven.py[i]]));
		assert.equal(LINE_WIDTH, 2);
	});

	it("7d's axis: a dot a day centred y 435, Ø 8 at the ends and Ø 4 between; '10-05' and '10-11' centred 447.97 under the ends", () => {
		nearAll(seven.dots.map((d) => d.x), [46.17, 99.948, 153.727, 207.505, 261.283, 315.062, 368.84], 0.02, "axis x");
		assert.ok(seven.dots.every((d) => d.y === 435));
		assert.deepEqual(seven.dots.map((d) => d.r), [4, 2, 2, 2, 2, 2, 4]);
		assert.deepEqual(seven.labels.map((l) => l.text), ["10-05", "10-11"]);
		// The twin's labels sit 0.17 and 0.33 left of the end dots (46, 368.5), as the phone's.
		nearAll(seven.labels.map((l) => l.x), [46, 368.5], 0.35, "label x");
		assert.ok(seven.labels.every((l) => Math.abs(l.y - 447.97) < 0.001));
	});

	it("4w (630:146): 28 dots 1/27 of the plot apart, 25 at 263.5 then 310.11, 294.09, 267.87; 28 axis dots", () => {
		const four = onPage("4w", 0, PHONE, PHONE_BOX);
		nearAll(four.px, PHONE_4W_X, 0.02, "x");
		nearAll(four.py, [...Array.from({ length: 25 }, () => 263.5), 310.11, 294.09, 267.87], 0.02, "y");
		assert.deepEqual(four.dots.map((d) => d.r), [4, ...Array.from({ length: 26 }, () => 2), 4]);
		nearAll(four.dots.map((d) => d.x), PHONE_4W_X, 0.02, "axis x");
		assert.deepEqual(four.labels.map((l) => l.text), ["09-14", "10-11"]);
	});

	it("4w − 1 (630:439, Inferred): Aug 17 – Sep 13 where the twin draws it", () => {
		const prev = onPage("4w", -1, PHONE, PHONE_BOX);
		nearAll(prev.px, PHONE_4W_X, 0.02, "x");
		nearAll(
			prev.py,
			[286.81, 311.57, 333.42, 353.82, 381.49, 384.41, 359.64, 326.14, 326.14, 331.96, 333.42, 336.33, 299.92, ...Array.from({ length: 15 }, () => 263.5)],
			0.02,
			"y",
		);
	});

	it("a period without a row keeps the bare box: no gridlines, axis or dots", () => {
		const empty = heatPlot(period("4w", -16).chart, PHONE);
		assert.deepEqual([empty.height, empty.grid, empty.dots, empty.points, empty.line], [211, [], [], [], ""]);
		// The empty line sits between the top and bottom gridlines' places.
		assert.deepEqual([empty.top, empty.baseline], [19.5, 165.17]);
	});
});

describe("Daily Progress in a pane (748 pt column at x 32)", () => {
	it("keeps the phone's insets: gridlines x 78.17 → 746.83 centred 237.64 + 36.42k", () => {
		const seven = onPage("7d", 0, PANE_COLUMN, PANE_BOX);
		assert.equal(seven.p.height, 211);
		nearAll(seven.grid, [0, 1, 2, 3, 4].map((k) => 237.64 + 36.42 * k), 0.05, "gridlines");
		assert.ok(seven.gridX.every(([a, b]) => Math.abs(a - 78.17) < 0.001 && Math.abs(b - 746.83) < 0.001));
	});

	it("7d (631:591): dots at x = 78.17 + 668.67·i/6, y = 383.31 − 1.4567·%; the twin's nodes within 0.02", () => {
		const seven = onPage("7d", 0, PANE_COLUMN, PANE_BOX);
		nearAll(seven.px, [0, 1, 2, 3, 4, 5, 6].map((i) => 78.17 + (668.67 * i) / 6), 0.02, "x formula");
		nearAll(seven.py, [100, 100, 100, 100, 68, 79, 97].map((pct) => 383.31 - 1.4567 * pct), 0.02, "y formula");
		// The chart frame's own nodes (box-relative).
		nearAll(seven.p.points.map((p) => p.x), [46.17, 157.62, 269.06, 380.51, 491.95, 603.4, 714.84], 0.02, "x nodes");
		nearAll(seven.p.points.map((p) => p.y), [19.5, 19.5, 19.5, 19.5, 66.11, 50.09, 23.87], 0.02, "y nodes");
	});

	it("7d's axis at y 409.14, its labels under the ends (x 46 and 714.5 in the box)", () => {
		const seven = onPage("7d", 0, PANE_COLUMN, PANE_BOX);
		assert.ok(seven.dots.every((d) => Math.abs(d.y - 409.14) < 0.001));
		nearAll(seven.p.dots.map((d) => d.x), [46.17, 157.62, 269.06, 380.51, 491.95, 603.4, 714.84], 0.02, "axis x");
		nearAll(seven.p.labels.map((l) => l.x), [46, 714.5], 0.35, "label x");
		assert.ok(seven.p.labels.every((l) => Math.abs(l.y - 203.97) < 0.001));
	});

	it("4w (631:679): 28 dots 24.77 apart, the last three at 66.11, 50.09, 23.87", () => {
		const four = onPage("4w", 0, PANE_COLUMN, PANE_BOX);
		nearAll(four.p.points.map((p) => p.x), PANE_4W_X, 0.02, "x");
		nearAll(four.p.points.map((p) => p.y).slice(-3), [66.11, 50.09, 23.87], 0.02, "y");
		nearAll(four.p.dots.map((d) => d.x), PANE_4W_X, 0.02, "axis x");
	});
});

describe("the 1d disc", () => {
	/** A path's ink box: its M, L, H and V points. */
	function inkBox(d: string): [number, number, number, number] {
		const xs: number[] = [];
		const ys: number[] = [];
		let x = 0;
		let y = 0;
		for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
			const n = args!.trim() ? args!.trim().split(/[\s,]+/).map(Number) : [];
			if (cmd === "M" || cmd === "L") [x, y] = [n[0]!, n[1]!];
			else if (cmd === "H") x = n[0]!;
			else if (cmd === "V") y = n[0]!;
			else continue;
			xs.push(x);
			ys.push(y);
		}
		return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
	}
	const round = (box: number[]) => box.map((v) => Math.round(v * 100) / 100);

	it("is Ø 64; up and down ink 32 × 19.2 at (185, 210.73), flat 30.4 × 12.8 at (186.6, 213.93) with the disc at (169, 188.33)", () => {
		assert.equal(TREND_DISC, 64);
		const disc = { x: 169, y: 188.33 };
		for (const trend of ["up", "down"] as const) {
			const [x0, y0, x1, y1] = inkBox(TREND_GLYPHS[trend]);
			assert.deepEqual(round([x1 - x0, y1 - y0, disc.x + x0, disc.y + y0]), [32, 19.2, 185, 210.73], trend);
		}
		const [x0, y0, x1, y1] = inkBox(TREND_GLYPHS.flat);
		assert.deepEqual(round([x1 - x0, y1 - y0, disc.x + x0, disc.y + y0]), [30.4, 12.8, 186.6, 213.93]);
	});

	it("is Material's 24 pt trending_up at 1.6× in a 38.4 pt box centred in the disc", () => {
		// trending_up: M16 6 l2.29 2.29 -4.88 4.88 -4 -4 L2 16.59 3.41 18 l6 -6 4 4 6.3 -6.29 L22 12 V6 z.
		const material = [[16, 6], [18.29, 8.29], [13.41, 13.17], [9.41, 9.17], [2, 16.59], [3.41, 18], [9.41, 12], [13.41, 16], [19.71, 9.71], [22, 12], [22, 6]];
		const twin = [...TREND_GLYPHS.up.matchAll(/L([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
		const scaled = material.slice(1, 10).map(([x, y]) => [Math.round((12.8 + 1.6 * x!) * 1000) / 1000, Math.round((12.8 + 1.6 * y!) * 1000) / 1000]);
		assert.deepEqual(twin, scaled);
	});
});

describe("the page's rhythm", () => {
	const r = (y: number) => Math.round(y * 100) / 100;

	it("1d on the phone (630:9): the disc 188.33, '97%' 269.06, the trend line 324.74, the copy's 22 pt lines 371.83 + 20.33k", () => {
		const R = DAY_RHYTHM;
		const disc = 165 + R.discTop;
		const percent = disc + TREND_DISC + R.percentGap;
		const trend = percent + R.percent + R.trendGap;
		const copy = trend + R.trend + R.copyGap;
		assert.deepEqual([disc, percent, trend].map(r), [188.33, 269.06, 324.74]);
		// A 20.33 pt line box centred where the twin's 22 pt one is.
		const centres = [0, 1, 2, 3].map((k) => r(copy + R.copyLine / 2 + R.copyLine * k));
		assert.deepEqual(centres, [371.83, 392.16, 412.49, 432.82].map((top) => r(top + 11)));
		// Without a row (630:423): the line at 210.33.
		assert.equal(r(165 + R.emptyTop), 210.33);
	});

	it("1d in a pane (631:561): the same 23.33 under the rule, the copy's first box at 134.16, the pane 324 tall", () => {
		const R = DAY_RHYTHM;
		const disc = 116 + R.discTop;
		const percent = disc + TREND_DISC + R.percentGap;
		const trend = percent + R.percent + R.trendGap;
		assert.deepEqual([disc, percent, trend].map(r), [139.33, 220.06, 275.74]);
		const centres = [0, 1, 2, 3].map((k) => r(116 + R.copyTopPane + R.copyLine / 2 + R.copyLine * k));
		assert.deepEqual(centres, [134.16, 154.49, 174.82, 195.15].map((top) => r(top + 11)));
		// The shell's 32 pt under the trend line's foot.
		assert.equal(Math.round(trend + R.trend + 32), 324);
	});

	it("7d / 4w on the phone (630:34): the title 174.86, the box 244, the key 465.67", () => {
		const C = CHART_RHYTHM;
		const title = 165 + C.titleTop;
		const box = title + C.title + C.boxGap;
		assert.deepEqual([title, box, box + HEAT_FRAME.height + C.legendGap].map(r), [174.86, 244, 465.67]);
		assert.equal(box, PHONE_BOX.y);
	});

	it("7d / 4w in a pane (631:591): the title 149, the box 218.14, the key level with the top gridline (237.14), the pane 461 tall", () => {
		const C = CHART_RHYTHM;
		const title = 116 + C.titleTopPane;
		const box = title + C.title + C.boxGap;
		assert.deepEqual([title, box].map(r), [149, 218.14]);
		assert.equal(r(box), PANE_BOX.y);
		assert.equal(r(116 + C.legendTopPane), r(box + HEAT_FRAME.top - 0.5));
		assert.equal(r(116 + C.legendTopPane), 237.14);
		assert.equal(Math.round(box + HEAT_FRAME.height + 32), 461);
	});
});
