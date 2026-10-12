import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { vo2Scale } from "../src/dashboard/gauges";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { DIAL_CENTRE, dialGeometry } from "../src/dashboard/stat-dial";
import { VO2_FRAME, linePlot, vo2Plot, type LinePlot } from "../src/dashboard/vo2-max-charts";
import { vo2Chart, vo2DialGauge, type Vo2Reading } from "../src/dashboard/vo2-max-pages";

/*
 * The Obsidian twin (Figma page 430:6112): each chart's box starts at the
 * tabs' foot — y 198.33 on the phone frames (4w 472:131, 12w 472:316, 6m
 * 472:472), (32, 162) in the panes (473:889, 473:1024, 473:1131). Positions
 * below are the twin's nodes in the box: a dot's box corner plus half its
 * size. The readings are the golden dots of ref/performance-stats/vo2-max
 * (TODAY 2026-10-11).
 */

const readings = (list: string): Vo2Reading[] =>
	list.split(" · ").map((item) => {
		const [day, value] = item.split(" ");
		return { date: `2026-${day}`, value: Number(value), shown: Math.round(Number(value)) };
	});

const R4W = readings("09-15 55.1 · 09-16 54.9 · 09-19 55.3 · 09-23 54.7 · 09-25 55.0 · 09-27 55.1 · 09-28 54.8 · 10-03 54.9 · 10-10 54.8 · 10-11 54.9");
const R12W = readings("08-01 55.1 · 08-09 55.1 · 08-16 54.5 · 08-23 53.8 · 08-30 53.8 · 09-05 54.2 · 09-12 55.5 · 09-19 55.3 · 09-27 55.1 · 10-03 54.9 · 10-11 54.9");
const R6M = readings(
	"04-19 55.2 · 04-26 55.3 · 05-03 56.2 · 05-10 56.2 · 05-17 55.6 · 05-24 55.6 · 05-31 55.0 · 06-07 55.0 · 06-13 54.2 · 06-19 54.4 · 06-26 54.1 · 07-02 55.8 · 07-11 55.6 · " +
		"07-18 55.6 · 08-01 55.1 · 08-09 55.1 · 08-16 54.5 · 08-23 53.8 · 08-30 53.8 · 09-05 54.2 · 09-12 55.5 · 09-19 55.3 · 09-27 55.1 · 10-03 54.9 · 10-11 54.9",
);

const plot4w = (width: number) => vo2Plot(vo2Chart("4w", R4W, { from: "2026-09-14", to: "2026-10-11" }), width);
const plot12w = (width: number) => vo2Plot(vo2Chart("12w", R12W, { from: "2026-07-20", to: "2026-10-11" }), width);
const plot6m = (width: number) => vo2Plot(vo2Chart("6m", R6M, { from: "2026-04-13", to: "2026-10-11" }), width);

/** The twin's chart dots, box corner + 4, in the box. */
const corner = (xs: readonly number[], ys: readonly number[], top = 0) => xs.map((x, i) => [x + 4, ys[i]! - top + 4] as const);

function sameDots(p: LinePlot, twin: ReadonlyArray<readonly [number, number]>) {
	assert.equal(p.points.length, twin.length);
	p.points.forEach((pt, i) => {
		const [x, y] = twin[i]!;
		assert.ok(Math.abs(pt.x - x) <= 0.01 && Math.abs(pt.y - y) <= 0.01, `dot ${i} at (${pt.x}, ${pt.y}), the twin's (${x.toFixed(2)}, ${y.toFixed(2)})`);
	});
}

const PHONE_TOP = 198.33;

describe("the VO₂ Max chart's box, on the phone and in a pane", () => {
	it("keeps the twin's insets at both widths: gridlines 41 apart from 104, x 39 to 16 short of the edge", () => {
		for (const [width, right] of [[PHONE, 386], [PANE_COLUMN, 732]] as const) {
			const p = plot4w(width);
			assert.equal(p.height, 304);
			assert.deepEqual(
				p.grid.map((g) => [g.label, g.y, g.x1, g.x2]),
				[["58", 104, 39, right], ["57", 145, 39, right], ["56", 186, 39, right], ["55", 227, 39, right], ["54", 268, 39, right]],
			);
			assert.equal(p.labelRight, 22.8);
			assert.deepEqual([p.left, p.right], [39, right]);
		}
		// On the phone: y 302.33 to 466.33, as the twin's Y Axis (470:33) places its lines.
		assert.deepEqual([(PHONE_TOP + VO2_FRAME.top).toFixed(2), (PHONE_TOP + VO2_FRAME.baseline).toFixed(2)], ["302.33", "466.33"]);
	});

	it("4w: ten dots, a small axis dot a day and the two labelled ends, phone (472:131)", () => {
		const p = plot4w(PHONE);
		sameDots(p, corner([47.85, 60.7, 99.26, 150.67, 176.37, 202.07, 214.93, 279.19, 369.15, 382], [417.23, 425.43, 409.03, 433.63, 421.33, 417.23, 429.53, 425.43, 429.53, 425.43], PHONE_TOP));
		assert.equal(p.dots.length, 28);
		// The X Axis (470:44): 4 pt day dots centred 278, 8 pt ends 280.17 (both top-aligned at 276).
		assert.deepEqual(p.dots[1], { x: 51.85, y: 278, r: 2 });
		assert.deepEqual([p.dots[0], p.dots[27]], [{ x: 39, y: 280.17, r: 4 }, { x: 386, y: 280.17, r: 4 }]);
		assert.deepEqual(p.labels, [{ x: 39, y: 295.85, text: "09-14" }, { x: 386, y: 295.85, text: "10-11" }]);
		// The line runs from the first dot to the last, 1 pt; the dots are 8 pt.
		assert.ok(p.line.startsWith("M51.85 222.9 L64.7 231.1 "));
		assert.ok(p.line.endsWith("L386 231.1"));
		assert.equal(p.pointRadius, 4);
	});

	it("4w in a pane (473:889): the same dots across 693 pt", () => {
		const p = plot4w(PANE_COLUMN);
		sameDots(p, corner([60.67, 86.33, 163.33, 266, 317.33, 368.67, 394.33, 522.67, 702.33, 728], [218.9, 227.1, 210.7, 235.3, 223, 218.9, 231.2, 227.1, 231.2, 227.1]));
		assert.deepEqual(p.dots[1], { x: 64.67, y: 278, r: 2 });
		assert.deepEqual(p.labels.map((l) => l.x), [39, 732]);
	});

	it("12w: eleven dots on 57–53, phone (472:316) and pane (473:1024)", () => {
		sameDots(
			plot12w(PHONE),
			corner(
				[85.17, 118.61, 147.88, 177.14, 206.41, 231.49, 260.76, 290.02, 323.47, 348.55, 382],
				[376.23, 376.23, 400.83, 429.53, 429.53, 413.13, 359.83, 368.03, 376.23, 384.43, 384.43],
				PHONE_TOP,
			),
		);
		const pane = plot12w(PANE_COLUMN);
		sameDots(
			pane,
			corner([135.19, 201.99, 260.43, 318.88, 377.33, 427.42, 485.87, 544.31, 611.11, 661.2, 728], [177.9, 177.9, 202.5, 231.2, 231.2, 214.8, 161.5, 169.7, 177.9, 186.1, 186.1]),
		);
		// Every 7th day small, the ends large: the pane's day 7 at 95.45 + 2.
		assert.deepEqual(pane.dots.slice(0, 2), [{ x: 39, y: 280.17, r: 4 }, { x: 97.45, y: 278, r: 2 }]);
		assert.deepEqual(pane.dots.at(-1), { x: 732, y: 280.17, r: 4 });
	});

	it("6m: twenty-five dots and six labelled ticks, phone (472:472) and pane (473:1131)", () => {
		sameDots(
			plot6m(PHONE),
			corner(
				[46.5, 59.92, 73.34, 86.76, 100.18, 113.6, 127.02, 140.44, 151.94, 163.45, 176.87, 188.37, 205.62, 219.04, 245.88, 261.22, 274.64, 288.06, 301.48, 312.98, 326.4, 339.82, 355.16, 366.66, 382],
				[372.13, 368.03, 331.13, 331.13, 355.73, 355.73, 380.33, 380.33, 413.13, 404.93, 417.23, 347.53, 355.73, 355.73, 376.23, 376.23, 400.83, 429.53, 429.53, 413.13, 359.83, 368.03, 376.23, 384.43, 384.43],
				PHONE_TOP,
			),
		);
		const pane = plot6m(PANE_COLUMN);
		sameDots(
			pane,
			corner(
				[57.97, 84.77, 111.57, 138.38, 165.18, 191.98, 218.78, 245.58, 268.55, 291.52, 318.33, 341.3, 375.76, 402.56, 456.16, 486.79, 513.59, 540.39, 567.19, 590.17, 616.97, 643.77, 674.4, 697.37, 728],
				[173.8, 169.7, 132.8, 132.8, 157.4, 157.4, 182, 182, 214.8, 206.6, 218.9, 149.2, 157.4, 157.4, 177.9, 177.9, 202.5, 231.2, 231.2, 214.8, 161.5, 169.7, 177.9, 186.1, 186.1],
			),
		);
		assert.deepEqual(pane.dots.map((d) => [d.x, d.r]), [[39, 4], [176.83, 4], [314.67, 4], [452.5, 4], [590.34, 4], [732, 4]]);
		assert.deepEqual(
			pane.labels.map((l) => [l.x, l.text]),
			[[39, "04-13"], [176.83, "05-19"], [314.67, "06-24"], [452.5, "07-30"], [590.34, "09-04"], [732, "10-11"]],
		);
	});

	it("keeps the bare box for a period without a reading: the no-data line centres on the plot, y 384.33", () => {
		const p = vo2Plot(null, PHONE);
		assert.deepEqual([p.height, p.grid, p.dots, p.points, p.line], [304, [], [], [], ""]);
		assert.equal((PHONE_TOP + (p.top + p.baseline) / 2).toFixed(2), "384.33");
	});

	it("draws a lone dot without a line", () => {
		const p = linePlot(VO2_FRAME, PHONE, { ticks: [61, 60, 59, 58, 57], axis: { dots: [], labels: [] }, points: [{ x: 2 / 181, value: 57.4 }] });
		assert.deepEqual([p.points.length, p.line], [1, ""]);
		assert.equal(p.points[0]!.y, 268 - (0.4 / 4) * 164);
	});
});

describe("the Current dial on the twin's Stat Dial (442:1349, kind vo2)", () => {
	const scale = vo2Scale(23, "male");
	const dist = (a: { x: number; y: number }, b: readonly [number, number]) => Math.hypot(a.x - b[0], a.y - b[1]);

	it("draws the page's measured bands, the gaps split either side of each boundary", () => {
		const g = dialGeometry("vo2", vo2DialGauge({ value: 54.9, shown: 55 }, scale));
		assert.deepEqual(
			g.bands.map((b) => [Number(b.from.toFixed(2)), Number(b.to.toFixed(2)), b.tone]),
			[[-150, -30.95, "red"], [-29.05, 14.05, "orange"], [15.95, 59.05, "green"], [60.95, 104.05, "blue"], [105.95, 150, "purple"]],
		);
		assert.ok(g.separators);
	});

	it("puts Cycling's 57.4 within 0.3 pt of the twin's marker (472:49, 116.1°): centre (273, 329.33) on the phone", () => {
		const g = dialGeometry("vo2", vo2DialGauge({ value: 57.4, shown: 57 }, scale));
		// The dial frame sits at (103, 195.84): the twin's marker centre in the 196 box.
		assert.ok(dist(g.marker!, [273 - 103, 329.33 - 195.84]) < 0.3, `marker at (${g.marker!.x}, ${g.marker!.y})`);
		assert.equal(g.marker!.tone, "purple");
	});

	it("puts the running 54.9 3° short of the twin's, which drew the shot's 102.8° (the rule's in-band place is Inferred)", () => {
		const g = dialGeometry("vo2", vo2DialGauge({ value: 54.9, shown: 55 }, scale));
		assert.ok(Math.abs(g.marker!.angle - 99.77) < 0.01, `at ${g.marker!.angle}°`);
		// The twin's marker (442:1182): its 24 pt box at (164.01, 103.72) in the dial.
		const twin = [164.01 + 12, 103.72 + 12] as const;
		assert.ok(Math.abs(dist(g.marker!, twin) - 4.2) < 0.1, `${dist(g.marker!, twin)} pt from the twin's`);
		assert.equal(g.marker!.tone, "blue");
		assert.equal(DIAL_CENTRE, 98);
	});
});
