import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	CURRENT_LAYOUT,
	PERIOD_LAYOUT,
	TOLERANCE_COLORS,
	WEEK_BLOCK,
	barColor,
	legendColor,
	paneLegendTop,
	ringColor,
	tolerancePlot,
	toleranceDown,
} from "../src/dashboard/running-tolerance-charts";
import { DISTANCE_CHIP, runningToleranceView, type RunningToleranceContext, type RunningToleranceRoute, type TolerancePeriodView } from "../src/dashboard/running-tolerance-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { dayRows, weekRows } from "./running-tolerance-fixture";

/**
 * The charts against the Obsidian twin (Figma page 430:6124): the phone's
 * 12w (695:109), 12w with Actual Distance (695:649), 1y (695:903) and 1y with
 * Actual Distance (697:489) chart frames at 402, and the panes' (701:1894,
 * 702:2115) at the 748 column, on Sunday 2026-10-11. Positions are in the
 * chart's box (its top-left at (0, 224) on the phone, (32, 189.51) in a pane).
 */
const CTX: RunningToleranceContext = { today: "2026-10-11", complete: true };
const DATA = { days: dayRows(), weeks: weekRows() };
const view = (route: RunningToleranceRoute) => runningToleranceView(route, DATA, CTX) as TolerancePeriodView;

const W12 = view({ range: "12w", offset: 0 });
const W12_CHIP = view({ range: "12w", offset: 0, sub: DISTANCE_CHIP });
const Y1 = view({ range: "1y", offset: 0 });
const Y1_CHIP = view({ range: "1y", offset: 0, sub: DISTANCE_CHIP });

/** The phone's plot for a view, its legend's rows as the phone has them. */
const phone = (v: TolerancePeriodView) => tolerancePlot(v.chart, v.range, PHONE, v.legend.length);
/** A pane's: the two-row box whatever the legend. */
const pane = (v: TolerancePeriodView) => tolerancePlot(v.chart, v.range, PANE_COLUMN, 2);

const near = (a: number, b: number, within: number, what: string) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a}, the twin's ${b}`);
const nearAll = (got: readonly number[], want: readonly number[], within: number, what: string) => {
	assert.equal(got.length, want.length, `${what}: ${got.length} against ${want.length}`);
	got.forEach((g, i) => near(g, want[i]!, within, `${what} ${i}`));
};
/** A path's points, "M1 2L3 4…" → [[1, 2], [3, 4]]. */
const pointsOf = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
const subpaths = (d: string) => d.split("M").filter(Boolean).length;

/** The twin's bar tops on 12w (695:109), oldest first; the feet at 204.67. */
const TOPS_12W = [113.5, 100.22, 155.88, 32.55, 100.22, 81.21, 81.21, 127.16, 106.6, 85.12, 159.57, 144.47];

describe("12w at 402, two legend rows (695:109)", () => {
	const p = phone(W12);

	it("draws five gridlines from x 40.67 to 370.33, their lines' tops at 241.33 + 46.67k on the page, labelled 44 … 0 at x 23.2", () => {
		nearAll(p.grid.map((g) => g.y - 0.5 + 224), [241.33, 288, 334.66, 381.33, 428], 0.01, "gridline");
		assert.ok(p.grid.every((g) => g.x1 === 40.67 && g.x2 === 370.33));
		assert.deepEqual(p.grid.map((g) => g.label), ["44", "33", "22", "11", "0"]);
		assert.deepEqual([p.labelRight, p.height], [23.2, 250]);
	});

	it("centres a 9.67 bar on 40.5 + 30k, from its load to 0.17 under the zero line, a pill on top", () => {
		assert.deepEqual(p.bars.map((b) => b.x), Array.from({ length: 12 }, (_, k) => 40.5 + 30 * k));
		nearAll(p.bars.map((b) => b.top), TOPS_12W, 0.01, "bar top");
		assert.ok(p.bars.every((b) => b.foot === 204.67));
		// The twin's bar 4: x 125.665, 9.67 wide, its corners rounded by 4.835.
		assert.match(p.bars[3]!.d, /^M125\.67 204\.67V37\.39A4\.84 4\.84 0 0 1 130\.5 32\.55H130\.5A4\.84 4\.84 0 0 1 135\.34 37\.39V204\.67Z$/);
		assert.deepEqual(
			p.bars.map((b) => b.color),
			TOPS_12W.map((_, k) => (k === 3 ? TOLERANCE_COLORS.above : TOLERANCE_COLORS.load)),
		);
	});

	it("steps the tolerance at 43.29 (38), 47.53 (37) and 51.77 (36), its risers at 55.5 + 30k, from the first slot's centre to the last's", () => {
		assert.equal(subpaths(p.tolerance), 1);
		const points = pointsOf(p.tolerance);
		assert.equal(points.length, 24);
		assert.deepEqual([...new Set(points.map(([, y]) => y))].sort(), [43.29, 47.53, 51.77]);
		for (let k = 0; k < 11; k++) assert.deepEqual([points[2 * k + 1]![0], points[2 * k + 2]![0]], [55.5 + 30 * k, 55.5 + 30 * k]);
		// The twin's vector runs 40.67 → 370.33: 0.17 inside the end slots' centres.
		assert.deepEqual([points[0]![0], points.at(-1)![0]], [40.5, 370.5]);
		assert.equal(p.distance, "");
	});

	it("dots every slot at y 219.67, Ø 8 at the ends and Ø 4 between, and labels the ends 08-01 and 10-11", () => {
		assert.deepEqual(
			p.dots.map((d) => [d.x, d.y, d.r]),
			Array.from({ length: 12 }, (_, k) => [40.5 + 30 * k, 219.67, k === 0 || k === 11 ? 4 : 2]),
		);
		assert.deepEqual(p.labels, [
			{ x: 40.5, y: 232.37, text: "08-01", rotated: false },
			{ x: 370.5, y: 232.37, text: "10-11", rotated: false },
		]);
	});
});

describe("12w at 402 with Actual Distance: one legend row (695:649)", () => {
	const p = phone(W12_CHIP);

	it("grows the plot 21.33 into the legend's second row: gridlines 52.06 apart from 240.75, the axis at 241", () => {
		assert.equal(W12_CHIP.legend.length, 1);
		nearAll(p.grid.map((g) => g.y - 0.5 + 224), [240.75, 292.81, 344.88, 396.94, 449], 0.01, "gridline");
		assert.deepEqual([p.height, p.dots[0]!.y, p.labels[0]!.y], [271.33, 241, 253.7]);
		// The scale stays 0–44 with the chip on.
		assert.deepEqual(p.grid.map((g) => g.label), ["44", "33", "22", "11", "0"]);
	});

	it("greys every bar, the same loads on the taller plot", () => {
		nearAll(p.bars.map((b) => b.top), [123.98, 109.16, 171.26, 33.67, 109.16, 87.96, 87.96, 139.22, 116.28, 92.31, 175.38, 158.53], 0.01, "bar top");
		assert.ok(p.bars.every((b) => b.foot === 225.67 && b.color === TOLERANCE_COLORS.muted));
	});

	it("lays the distance line through a Ø 8 dot a week, and keeps the step line", () => {
		const dots = [129.97, 116.26, 176.58, 48.24, 116.26, 124.94, 124.94, 147.75, 127.5, 106.3, 178.13, 166.48];
		assert.deepEqual(p.distanceDots.map((d) => d.x), Array.from({ length: 12 }, (_, k) => 40.5 + 30 * k));
		nearAll(p.distanceDots.map((d) => d.y), dots, 0.01, "distance dot");
		assert.equal(subpaths(p.distance), 1);
		nearAll(pointsOf(p.distance).map(([, y]) => y), dots, 0.01, "distance line");
		// Its box in the twin: 40.5 → 370.5, 48.24 → 178.13.
		assert.deepEqual([pointsOf(p.distance)[0]![0], pointsOf(p.distance).at(-1)![0]], [40.5, 370.5]);
		assert.deepEqual([...new Set(pointsOf(p.tolerance).map(([, y]) => y))].sort(), [45.65, 50.38, 55.11]);
	});
});

/** The twin's 49 bar tops on 1y (695:903), oldest first, slots 11, 18 and 19 without a bar; the feet at 184.75. */
const TOPS_1Y = [
	135.13, 117.76, 88.66, 97.13, 110.98, 117.4, 132.54, 127.44, 164.1, 172.75, 139.59, 168.44, 129.66, 122.5, 153.61, 145.13, 122.36, 130.75, 148.71, 110.7, 128.46,
	115.32, 124.7, 92.19, 115.93, 144.19, 151.47, 151.39, 150.71, 165.94, 156.66, 148.86, 176.83, 135.34, 163.84, 172.75, 139.01, 152.04, 147.3, 167.2, 123.1, 147.3,
	140.5, 140.5, 156.93, 149.58, 141.9, 168.52, 163.12,
];

describe("1y at 402, two legend rows (695:903)", () => {
	const p = phone(Y1);

	it("draws five gridlines from x 34.67 to 378.33, their tops at 250.33 + 39.44k on the page, labelled 104 … 0 at x 25.2", () => {
		nearAll(p.grid.map((g) => g.y - 0.5 + 224), [250.33, 289.77, 329.21, 368.64, 408.08], 0.01, "gridline");
		assert.ok(p.grid.every((g) => g.x1 === 34.67 && g.x2 === 378.33));
		assert.deepEqual(p.grid.map((g) => g.label), ["104", "78", "52", "26", "0"]);
		assert.equal(p.labelRight, 25.2);
	});

	it("centres a 5 pt bar on 34.5 + 6.745k for each week with a run", () => {
		assert.equal(p.bars.length, 49);
		const slots = p.bars.map((b) => Math.round((b.x - 34.5) / 6.745));
		assert.deepEqual(Array.from({ length: 52 }, (_, k) => k).filter((k) => !slots.includes(k)), [11, 18, 19]);
		p.bars.forEach((b, i) => near(b.x, 34.5 + 6.745 * slots[i]!, 0.01, `bar ${i}`));
		nearAll(p.bars.map((b) => b.top), TOPS_1Y, 0.01, "bar top");
		assert.ok(p.bars.every((b) => b.foot === 184.75));
		// The twin's bar 1: x 32, 5 wide, its top a 2.5 pill.
		assert.match(p.bars[0]!.d, /^M32 184\.75V137\.63A2\.5 2\.5 0 0 1 34\.5 135\.13H34\.5A2\.5 2\.5 0 0 1 37 137\.63V184\.75Z$/);
	});

	it("draws the tolerance through every slot's centre at whole km, from 34.5 to 378.5, peaking at 29.86 (102)", () => {
		assert.equal(subpaths(p.tolerance), 1);
		const points = pointsOf(p.tolerance);
		assert.equal(points.length, 52);
		points.forEach(([x], k) => near(x, 34.5 + 6.745 * k, 0.01, `point ${k}`));
		// The twin's vector: 34.5 → 378.5 across, 29.86 → 129.97 down.
		assert.deepEqual([points[0]![0], points.at(-1)![0]], [34.5, 378.5]);
		nearAll([Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([, y]) => y))], [29.86, 129.97], 0.01, "tolerance's extent");
	});

	it("puts a Ø 8 dot at y 196.67 under each week holding a 1st, its month on end 0.8 to the left, centred at 219.27", () => {
		const ticks = [41.25, 74.97, 101.95, 135.68, 162.66, 189.64, 216.62, 250.34, 277.32, 304.3, 338.03, 365.01];
		// The twin's Month Tick instances: x 33.245 + 8 … 357.005 + 8.
		nearAll(p.dots.map((d) => d.x), ticks, 0.01, "month dot");
		nearAll(ticks, [41.245, 74.97, 101.95, 135.675, 162.655, 189.635, 216.615, 250.34, 277.32, 304.3, 338.025, 365.005], 0.01, "the twin's ticks");
		assert.ok(p.dots.every((d) => d.y === 196.67 && d.r === 4));
		assert.deepEqual(p.labels.map((l) => l.text).join(" "), "Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
		p.labels.forEach((l, i) => {
			near(l.x, ticks[i]! - 0.8, 0.011, `label ${i}`);
			assert.deepEqual([l.y, l.rotated], [219.27, true]);
		});
	});
});

describe("1y at 402 with Actual Distance (697:489)", () => {
	const p = phone(Y1_CHIP);

	it("grows the plot 21.33: gridlines 44.63 apart from 250.83, the feet at 206, the months at 218", () => {
		nearAll(p.grid.map((g) => g.y - 0.5 + 224), [250.83, 295.46, 340.08, 384.71, 429.33], 0.01, "gridline");
		near(p.bars[0]!.top, 149.88, 0.01, "bar 1");
		near(p.bars[2]!.top, 97.29, 0.01, "bar 3");
		near(p.bars.at(-1)!.top, 181.54, 0.01, "bar 52");
		assert.ok(p.bars.every((b) => b.foot === 206 && b.color === TOLERANCE_COLORS.muted));
		assert.deepEqual([p.dots[0]!.y, p.labels[0]!.y], [218, 240.6]);
	});

	it("breaks the distance line at the three weeks without a run, with no dots; its box 107.5 → 198.1 as the twin's", () => {
		assert.equal(subpaths(p.distance), 3);
		assert.deepEqual(p.distanceDots, []);
		const ys = pointsOf(p.distance).map(([, y]) => y);
		nearAll([Math.min(...ys), Math.max(...ys)], [107.5, 198.1], 0.01, "distance's extent");
		assert.deepEqual([pointsOf(p.distance)[0]![0], pointsOf(p.distance).at(-1)![0]], [34.5, 378.5]);
	});
});

describe("the panes' charts at 748 (701:1894, 702:2115)", () => {
	it("12w stretches the slots to 716.5 and keeps the bars' width, the phone's heights and the gridlines' insets", () => {
		const p = pane(W12);
		const lefts = [35.665, 97.12, 158.574, 220.029, 281.483, 342.938, 404.392, 465.847, 527.301, 588.756, 650.21, 711.665];
		nearAll(p.bars.map((b) => b.x - 9.67 / 2), lefts, 0.01, "bar left");
		nearAll(p.bars.map((b) => b.top), TOPS_12W, 0.01, "bar top");
		assert.ok(p.grid.every((g) => g.x1 === 40.67 && g.x2 === 716.33));
		nearAll(p.dots.map((d) => d.x), lefts.map((l) => l + 4.835), 0.01, "axis dot");
		assert.deepEqual(p.labels.map((l) => [l.x, l.text]), [[40.5, "08-01"], [716.5, "10-11"]]);
		// The twin stretches the phone's line to 40.85 → 716.15; it runs slot centre to slot centre here.
		const points = pointsOf(p.tolerance);
		assert.deepEqual([points[0]![0], points.at(-1)![0]], [40.5, 716.5]);
		near(points[1]![0], 40.5 + 676 / 22, 0.01, "the first riser");
	});

	it("1y stretches its 52 slots to 724.5, the months with them", () => {
		const p = pane(Y1);
		near(p.bars[0]!.x, 34.5, 0.01, "bar 1");
		near(p.bars.at(-1)!.x, 724.49, 0.01, "bar 52");
		near(p.bars[1]!.x, 48.03, 0.01, "bar 2");
		assert.ok(p.grid.every((g) => g.x1 === 34.67 && g.x2 === 724.33));
		nearAll([p.dots[0]!.x, p.dots[1]!.x, p.dots.at(-1)!.x], [48.03, 115.68, 697.43], 0.015, "month dot");
		const points = pointsOf(p.tolerance);
		assert.deepEqual([points[0]![0], points.at(-1)![0]], [34.5, 724.5]);
	});

	it("keeps the two-row box with the chip on: the legend stands beside the chart", () => {
		const p = pane(W12_CHIP);
		assert.deepEqual([p.height, p.dots[0]!.y], [250, 219.67]);
		nearAll(p.bars.map((b) => b.top), TOPS_12W, 0.01, "bar top");
	});
});

describe("an empty span (697:1580)", () => {
	it("keeps the gridlines 0–4 and the dots, without bars, lines or end labels", () => {
		const none = runningToleranceView({ range: "12w", offset: 0 }, { days: [], weeks: [] }, CTX) as TolerancePeriodView;
		const p = phone(none);
		assert.deepEqual(p.grid.map((g) => g.label), ["4", "3", "2", "1", "0"]);
		// One legend row: the taller plot.
		nearAll(p.grid.map((g) => g.y - 0.5 + 224), [240.75, 292.81, 344.88, 396.94, 449], 0.01, "gridline");
		assert.deepEqual([p.bars, p.tolerance, p.distance, p.labels, p.dots.length], [[], "", "", [], 12]);
	});
});

describe("colours and the page's rhythm", () => {
	it("binds the marks to Obsidian's colours", () => {
		assert.deepEqual([barColor("load"), barColor("above"), barColor("muted")], ["var(--color-blue)", "var(--color-orange)", "var(--background-modifier-border)"]);
		assert.deepEqual(
			W12_CHIP.legend[0]!.map((item) => legendColor(item)),
			["var(--text-normal)", "var(--background-modifier-border)", "var(--color-cyan)"],
		);
		// The ring is blue under the tolerance, orange at or over it (Inferred, 697:1250).
		assert.deepEqual([ringColor({ share: 0.7596 }), ringColor({ share: 1 }), ringColor({ share: 1.16 })], ["var(--color-blue)", "var(--color-orange)", "var(--color-orange)"]);
	});

	it("places Current as the twin does from the header's foot (165) and a pane's rule (116)", () => {
		const L = CURRENT_LAYOUT;
		const ring = 165 + L.ringTop;
		const title = ring + 196 + L.titleGap;
		const copy = title + 22 + L.copyGap;
		const figures = copy + 3 * L.copyLine + L.figuresGap;
		// 695:22: the ring's box at 157.88 (centre 255.88), the title 390.49, the copy's 20 pt lines from 428.88, the rules 517.33 / 584.33.
		nearAll([ring, ring + 98, title, copy + 1, figures, figures + L.figurePitch], [157.88, 255.88, 390.49, 428.88, 517.33, 584.33], 0.01, "phone");
		assert.equal(16 + L.figureWidth + L.figureColumnGap, 209);
		// 700:1865: the ring's box at 134, the title 143.19, the copy from 181.58, the rules 270.03 / 337.03.
		const paneTitle = 116 + L.titleTopPane;
		const paneCopy = paneTitle + 22 + L.copyGap;
		const paneFigures = paneCopy + 3 * L.copyLine + L.figuresGap;
		nearAll([116 + L.ringTopPane, paneTitle, paneCopy + 1, paneFigures, paneFigures + L.figurePitch], [134, 143.19, 181.58, 270.03, 337.03], 0.01, "pane");
	});

	it("places 12w and 1y as the twin does: title, chart, legend, chip and blocks", () => {
		const L = PERIOD_LAYOUT;
		const title = 165 + L.titleTop;
		const chart = title + 22 + L.chartGap;
		const legend = (rows: 1 | 2, range: "12w" | "1y" = "12w") => chart + toleranceDown(range, rows).height + L.legendGap;
		// 695:103: "Weekly Totals" at 182.49, the box at 224, the legend at 479.33 / 500.67, the chip at 530.33, the blocks from 582.33.
		const chip = legend(2) + 21.33 + 14 + L.chipGap;
		nearAll([title, chart, legend(2), legend(2) + 21.33, chip, chip + 36 + L.blocksGap], [182.49, 224, 479.33, 500.67, 530.33, 582.33], 0.02, "two rows");
		// 695:643: one row at 500.67 and the chip where it was.
		nearAll([legend(1), legend(1) + 14 + L.chipGap, legend(1, "1y")], [500.67, 530.33, 500.67], 0.02, "one row");
		// The panes: the title at 148, the box at 189.51, the legend at 203.85 (12w) / 212.85 (1y), the chip at 255.18 / 264.18, the blocks at 469.51, 185.67 apart.
		const paneChart = 116 + L.titleTopPane + 22 + L.chartGap;
		const paneLegend = (range: "12w" | "1y") => paneChart + paneLegendTop(range);
		nearAll(
			[paneChart, paneLegend("12w"), paneLegend("1y"), paneLegend("12w") + 21.33 + 14 + L.chipGapPane, paneLegend("1y") + 21.33 + 14 + L.chipGapPane, paneChart + 250 + L.blocksGapPane],
			[189.51, 203.85, 212.85, 255.18, 264.18, 469.51],
			0.01,
			"pane",
		);
		near(WEEK_BLOCK.height + 16, 185.67, 0.001, "the panes' block pitch");
		near(WEEK_BLOCK.band + WEEK_BLOCK.rows.reduce((a, b) => a + b, 0) + 4 * WEEK_BLOCK.rule, WEEK_BLOCK.height, 0.001, "a block's height");
	});
});
