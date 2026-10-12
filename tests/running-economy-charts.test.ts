import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ECONOMY_FRAME, economyPlot, type EconomyPlot } from "../src/dashboard/running-economy-charts";
import { runningEconomyView, type RunningEconomyView } from "../src/dashboard/running-economy-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { DIAL_CENTRE, DIAL_KINDS, dialGeometry } from "../src/dashboard/stat-dial";
import { ROWS } from "./running-economy-fixture";

/*
 * The charts and the dial against the Obsidian twin (Figma page 430:6114):
 * the phones 752:3253 (Current), 752:3318 (4w), 752:3488 (12w), 752:3620
 * (1y) and 752:3925 (an empty 4w), and the panes 757:614 (12w) and 757:700
 * (1y), each node's box plus half its size. A phone chart's box sits at page
 * y 244, a pane's at (32, 195), so the twin's page values are the box's plus
 * those. Today is the capture day.
 */
const TODAY = "2026-10-11";
const view = (range: "1d" | "4w" | "12w" | "1y", offset = 0): RunningEconomyView =>
	runningEconomyView({ range, offset }, ROWS, { today: TODAY, complete: true });
const plot = (range: "4w" | "12w" | "1y", width: number, offset = 0): EconomyPlot => economyPlot(view(range, offset).chart, width);

const near = (actual: number, expected: number, tolerance = 0.01, what = "") =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${what} ${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01, what = "") => {
	assert.equal(actual.length, expected.length, `${what}: ${actual.length} values, not ${expected.length}`);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance, `${what} ${i}`));
};

/** The phone's chart box, page y. */
const BOX = 244;
/** The twin's gridlines (1 pt rects from page 262.83, 39.76 apart, as measured line by line) and its Chart Dot boxes, centred. */
const TWIN_GRID = [262.83, 302.62, 342.32, 382.04, 421.87].map((top) => top + 0.5 - BOX);

describe("the chart's box", () => {
	it("is 236 pt tall at any width, the plot from x 39 to 16 short of its right edge", () => {
		for (const width of [PHONE, PANE_COLUMN]) {
			const p = plot("4w", width);
			assert.deepEqual([p.height, p.left, p.right], [236, 39, width - 16]);
		}
		assert.deepEqual([ECONOMY_FRAME.top, ECONOMY_FRAME.baseline, ECONOMY_FRAME.labelRight], [19.33, 178.37, 22.5]);
	});

	it("draws five gridlines where the twin has them, 39.76 apart, labels right-aligned to 22.5 and centred on them", () => {
		const p = plot("4w", PHONE);
		nearAll(
			p.grid.map((g) => g.y),
			TWIN_GRID,
			0.08,
			"gridline",
		);
		assert.deepEqual(p.grid.map((g) => g.y), [19.33, 59.09, 98.85, 138.61, 178.37]);
		assert.deepEqual(p.grid.map((g) => g.label), ["225", "224", "223", "222", "221"]);
		assert.ok(p.grid.every((g) => g.x1 === 39 && g.x2 === 386));
		// In a pane's 748 pt column they run on to 732 (page 764).
		assert.ok(plot("12w", PANE_COLUMN).grid.every((g) => g.x1 === 39 && g.x2 === 732));
	});
});

describe("4w at 402 (752:3318)", () => {
	const p = plot("4w", PHONE);

	it("puts each reading's Ø 8 dot where the twin's Chart Dot is, in its class's colour", () => {
		const twin: Array<[number, number]> = [[47.85, 134.61], [60.7, 94.85], [150.67, 55.09], [176.37, 94.85], [202.07, 94.85], [214.93, 55.09]];
		nearAll(p.points.map((q) => q.x), twin.map(([x]) => x + 4), 0.01, "x");
		nearAll(p.points.map((q) => q.y), twin.map(([, y]) => y + 4), 0.01, "y");
		assert.ok(p.points.every((q) => q.tone === "orange"));
		assert.deepEqual([p.pointDots, p.pointRadius], [true, 4]);
		assert.ok(p.line.startsWith("M51.85 138.61 L64.7 98.85 L154.67 59.09"));
		// One class: one band, the whole box and beyond.
		assert.deepEqual(p.bands, [{ tone: "orange", y0: -236, y1: 472 }]);
	});

	it("marks a day a dot, Ø 4 centred 190.33 and the ends Ø 8 at 190.67, and labels the ends 9-14 and 10-11 at 206.34", () => {
		assert.equal(p.dots.length, 28);
		assert.deepEqual(p.dots[0], { x: 39, y: 190.67, r: 4 });
		// The twin's tick 1 at 49.85, Ø 4; 12.85 apart.
		assert.deepEqual(p.dots[1], { x: 51.85, y: 190.33, r: 2 });
		assert.deepEqual(p.dots[27], { x: 386, y: 190.67, r: 4 });
		near(p.dots[26]!.x, 371.15 + 2, 0.01, "tick 26");
		assert.deepEqual(p.labels, [
			{ x: 39, y: 206.34, text: "9-14", rotated: false },
			{ x: 386, y: 206.34, text: "10-11", rotated: false },
		]);
		// Page y: the dots at 434.67 / 434.33, the labels' boxes from 443.34.
		nearAll([BOX + p.dots[0]!.y, BOX + p.dots[1]!.y, BOX + p.labels[0]!.y - 7], [434.67, 434.33, 443.34], 1e-9, "page y");
	});
});

describe("12w at 402 (752:3488)", () => {
	const p = plot("12w", PHONE);

	it("puts the blocks' dots at their first days, 29.27 apart, 224 to 220", () => {
		const twin: Array<[number, number]> = [[64.27, 134.61], [269.12, 94.85], [298.39, 55.09], [327.65, 15.33]];
		nearAll(p.points.map((q) => q.x), twin.map(([x]) => x + 4), 0.01, "x");
		nearAll(p.points.map((q) => q.y), twin.map(([, y]) => y + 4), 0.01, "y");
		assert.deepEqual(p.grid.map((g) => g.label), ["224", "223", "222", "221", "220"]);
	});

	it("marks the block starts and the last day: 13 dots, the ends large, 7-20 and 10-11", () => {
		const ticks = [66.27, 95.53, 124.8, 154.06, 183.33, 212.59, 241.86, 271.12, 300.39, 329.65, 358.92];
		nearAll(p.dots.map((d) => d.x), [39, ...ticks.map((t) => t + 2), 386], 0.01, "tick");
		assert.deepEqual(p.dots.map((d) => d.r), [4, ...Array(11).fill(2), 4]);
		assert.deepEqual(p.labels.map((l) => [l.x, l.text]), [[39, "7-20"], [386, "10-11"]]);
	});
});

describe("1y at 402 (752:3620)", () => {
	const p = plot("1y", PHONE);

	it("runs the line without dots from Oct 13's 214 to Sep 28's 224: the twin's line box 50.41, 67.04, 332.74 × 79.52", () => {
		assert.equal(p.pointDots, false);
		const xs = p.points.map((q) => q.x);
		const ys = p.points.map((q) => q.y);
		near(Math.min(...xs), 50.41, 0.01, "left");
		near(Math.max(...xs) - Math.min(...xs), 332.74, 0.01, "width");
		near(Math.min(...ys), 67.04, 0.01, "top");
		near(Math.max(...ys) - Math.min(...ys), 79.52, 0.01, "height");
		assert.deepEqual(p.grid.map((g) => g.label), ["230", "225", "220", "215", "210"]);
	});

	it("colours the line orange down to y(214.5), the twin's Trained zone top at 142.59, and light orange below it", () => {
		assert.deepEqual(p.bands, [
			{ tone: "orange", y0: -236, y1: 142.59 },
			{ tone: "yellow", y0: 142.59, y1: 472 },
		]);
		// The two 214s sit inside the light orange band, everything else above it.
		assert.deepEqual(
			p.points.filter((q) => q.y > 142.59).map((q) => q.tone),
			["yellow", "yellow"],
		);
	});

	it("marks each month start with a Ø 8 dot and its name on end, centred 206.5", () => {
		const ticks = [35, 64.47, 92.99, 122.46, 151.93, 178.55, 208.02, 236.55, 266.02, 294.54, 324.01, 353.48, 382];
		nearAll(p.dots.map((d) => d.x), ticks.map((t) => t + 4), 0.01, "month");
		assert.ok(p.dots.every((d) => d.r === 4 && d.y === 190.67));
		assert.ok(p.labels.every((l, i) => l.rotated && l.y === 206.5 && l.x === p.dots[i]!.x));
		assert.deepEqual(p.labels.map((l) => l.text).join(" "), "Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
	});
});

describe("a period without a reading (752:3925)", () => {
	it("keeps the box and centres the web's line on the middle gridline: its 20 pt box from page 332.82", () => {
		const p = economyPlot(view("4w", -1).chart, PHONE);
		assert.deepEqual([p.grid, p.points, p.dots, p.line, p.bands], [[], [], [], "", []]);
		near(BOX + p.middle - 10, 332.82, 0.05, "empty line");
	});
});

describe("the pane's 748 pt column (757:614, 757:700)", () => {
	/** A pane's plot: x' = 39 + (x − 39)·693/347. */
	const wide = (x: number) => 39 + ((x - 39) * 693) / 347;

	it("12w: the dots and the axis stretched across 693 pt, the gridlines and the y scale as on the phone", () => {
		const p = plot("12w", PANE_COLUMN);
		const twin: Array<[number, number]> = [[93.45, 134.61], [502.57, 94.85], [561.01, 55.09], [619.46, 15.33]];
		nearAll(p.points.map((q) => q.x), twin.map(([x]) => x + 4), 0.01, "x");
		nearAll(p.points.map((q) => q.y), twin.map(([, y]) => y + 4), 0.01, "y");
		nearAll(p.points.map((q) => q.x), plot("12w", PHONE).points.map((q) => wide(q.x)), 0.02, "stretched");
		const ticks = [95.45, 153.89, 212.34, 270.78, 329.23, 387.67, 446.12, 504.57, 563.01, 621.46, 679.9];
		nearAll(p.dots.map((d) => d.x), [39, ...ticks.map((t) => t + 2), 732], 0.01, "tick");
		assert.deepEqual(p.labels.map((l) => l.x), [39, 732]);
	});

	it("1y: the line from 61.78, 664.52 wide, its Trained band from the same 142.59, the month dots stretched", () => {
		const p = plot("1y", PANE_COLUMN);
		const xs = p.points.map((q) => q.x);
		near(Math.min(...xs), 61.78, 0.01, "left");
		near(Math.max(...xs) - Math.min(...xs), 664.52, 0.02, "width");
		assert.deepEqual(p.bands.map((b) => [b.tone, b.y0, b.y1]), [["orange", -236, 142.59], ["yellow", 142.59, 472]]);
		const ticks = [35, 93.86, 150.82, 209.67, 268.53, 321.69, 380.55, 437.51, 496.37, 553.33, 612.18, 671.04, 728];
		nearAll(p.dots.map((d) => d.x), ticks.map((t) => t + 4), 0.01, "month");
	});
});

describe("the dial (751:9924, on Current 752:3253)", () => {
	const current = view("1d").current!;
	const g = dialGeometry("economy", current.dial.gauge);

	it("rings 92.45 → 82.55 round the dial's centre, its round caps where the twin's are", () => {
		assert.deepEqual([g.rc, g.width], [87.5, 9.9]);
		// The twin's caps: 9.9 pt boxes at (49.3, 168.83) and (136.8, 168.83).
		near(g.caps[0]!.x, 49.3 + 4.95);
		near(g.caps[0]!.y, 168.83 + 4.95);
		near(g.caps[1]!.x, 136.8 + 4.95);
		assert.deepEqual([g.caps[0]!.r, g.caps[0]!.tone, g.caps[1]!.tone], [4.95, "red", "pink"]);
		// The page: the dial's box at (102.98, 173.24), its centre (200.98, 271.24), centred on the 402.
		near(PHONE / 2 - DIAL_CENTRE, 102.98, 0.03, "dial");
	});

	it("marks 224 with a Ø 15 orange disc in a 3 pt ring at the twin's marker (its 21 pt box at 0, 87.59)", () => {
		const m = g.marker!;
		assert.deepEqual([m.r, m.outline, m.tone], [7.5, 3, "orange"]);
		// The twin places it at the shot's −90.06°; the linear map says −90.00: 0.09 pt apart.
		near(m.x, 10.5, 0.01, "marker x");
		near(m.y, 87.59 + 10.5, 0.1, "marker y");
	});

	it("sets the number's 170 pt box at 76.2 in Display 35/42, and nothing under it", () => {
		assert.deepEqual(DIAL_KINDS.economy.value, { top: 76.2, size: 35, line: 42 });
		assert.equal(current.dial.gauge.value, "224");
		assert.equal(current.dial.gauge.label, undefined);
		// The page's "224" box at (115.98, 249.44): 13 and 76.2 into the dial's box.
		near(102.98 + 13, 115.98);
		near(173.24 + 76.2, 249.44);
	});
});
