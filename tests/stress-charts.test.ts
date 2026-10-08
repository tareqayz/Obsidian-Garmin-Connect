import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CARD_RING, DAY_RING, RING_GAP, linePlot, ringArcs, ringTrack, timelinePlot } from "../src/dashboard/stress-charts";
import { ringOf, stressPeriodView, timelineOf, type StressData, type StressRoute } from "../src/dashboard/stress-pages";
import type { StressRow } from "../src/sync/stress-index";

/**
 * Positions are the Figma frames' (Garmin / Stress, page 239:10) at the
 * phone's 402pt, less the bottom of each chart's title, where its box starts:
 * 270.56 on 7d (255:17), 4w (258:421) and 1y (259:1265), 691.06 on 1d (260:1478).
 */
const PHONE = 402;
const TITLE = 270.56;
const DAY_TITLE = 691.06;

const near = (actual: number, expected: number, tolerance = 0.01) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01) => {
	assert.equal(actual.length, expected.length);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance));
};

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The levels of Sep 11 – Oct 8 (stats/stress/daily, live at 01:43). */
const SEP_11 = [21, 43, 27, 30, 28, 30, 26, 22, 30, 40, 35, 26, 26, 29, 26, 20, 28, 29, 21, 28, 29, 22, 28, 27, 22, 26, 27, 28];
const rows: StressRow[] = SEP_11.map((level, i) => ({ date: shift("2026-09-11", i), level }));
const view = (range: StressRoute["range"], list: StressRow[] = rows, today = "2026-10-08") =>
	stressPeriodView({ data: { rows: list, complete: true } as StressData, route: { range, offset: 0 }, today });

describe("Daily Averages: 7d", () => {
	const plot = linePlot(view("7d"), PHONE);

	it("spans Figma's plot: 0 to 100 every 25, gridlines from 46 to 368.5", () => {
		nearAll(
			plot.grid.map((g) => g.y + TITLE),
			[323.5, 368.8125, 414.125, 459.4375, 504.75],
		);
		assert.deepEqual(plot.grid.map((g) => g.label), ["100", "75", "50", "25", "0"]);
		assert.deepEqual([plot.grid[0]!.x1, plot.grid[0]!.x2], [46, 368.5]);
		assert.equal(plot.labelRight, 28);
		near(plot.height + TITLE, 595.5);
	});

	it("puts each day's dot where Figma has Oct 2 – 7's, the ends large", () => {
		nearAll(
			plot.dots.map((d) => d.x),
			[46, 99.708, 153.416, 207.124, 260.832, 314.54, 368.248],
		);
		assert.deepEqual(plot.dots.map((d) => d.r), [4, 1.75, 1.75, 1.75, 1.75, 1.75, 4]);
		near(plot.dots[0]!.y + TITLE, 538);
		assert.deepEqual(
			plot.labels.map((l) => [l.text, l.x, l.rotated]),
			[
				["10-02", 46, false],
				["10-08", 368.25, false],
			],
		);
		near(plot.labels[0]!.y + TITLE, 550.6);
	});

	it("puts the line's points where Figma's are, and today's partial day after them", () => {
		const figma: Array<[number, number]> = [
			[46, 464.875],
			[99.708, 454],
			[153.416, 455.8125],
			[207.124, 464.875],
			[260.832, 457.625],
			[314.54, 455.8125],
		];
		plot.points.slice(0, 6).forEach((p, i) => {
			near(p.x, figma[i]![0]);
			near(p.y + TITLE, figma[i]![1]);
		});
		// Oct 8 at 28: the phone, shot before 04:00, had no point there yet.
		near(plot.points[6]!.y + TITLE, 454);
		assert.equal(plot.pointRadius, 4);
		assert.equal(plot.lineWidth, 2);
		assert.equal(plot.line.match(/M/g)?.length, 1);
	});

	it("stretches its plot with the pane, keeping the insets", () => {
		const wide = linePlot(view("7d"), 800);
		assert.equal(wide.right, 766.25);
		assert.equal(wide.grid[0]!.x2, 766.5);
	});
});

describe("Daily Averages: 4w", () => {
	it("spreads 28 days from 46 to 368.25, as Figma's 4w frame does", () => {
		const plot = linePlot(view("4w"), PHONE);
		assert.equal(plot.dots.length, 28);
		nearAll(
			[plot.dots[0]!.x, plot.dots[1]!.x, plot.dots[13]!.x, plot.dots[27]!.x],
			[46, 57.935, 201.155, 368.245],
		);
		// Sep 11 at 21, Sep 12 at 43, Oct 7 at 27: Figma's first, second and last points.
		near(plot.points[0]!.y + TITLE, 466.6875);
		near(plot.points[1]!.y + TITLE, 426.8125);
		near(plot.points[26]!.x, 356.31);
		near(plot.points[26]!.y + TITLE, 455.8125);
		assert.equal(plot.pointRadius, 4);
	});

	it("breaks the line at a day without a level: no dot, no segment to either side", () => {
		const gap = rows.filter((r) => r.date !== "2026-09-15");
		const plot = linePlot(view("4w", gap), PHONE);
		assert.equal(plot.points.length, 27);
		assert.equal(plot.line.match(/M/g)?.length, 2);
		assert.ok(!plot.points.some((p) => Math.abs(p.x - (46 + 4 * 11.935)) < 0.01));
	});
});

describe("Weekly Averages: 1y", () => {
	// A year of 30s, but the week starting Jan 23 at 43: Figma's highest vertex.
	const year: StressRow[] = Array.from({ length: 364 }, (_, i) => {
		const date = shift("2025-10-10", i);
		return { date, level: date >= "2026-01-23" && date <= "2026-01-29" ? 43 : 30 };
	});
	const plot = linePlot(view("1y", year), PHONE);

	it("spans Figma's 1y plot: taller, gridlines from 36 to 356.5", () => {
		nearAll(
			plot.grid.map((g) => g.y + TITLE),
			[303.75, 354.7125, 405.675, 456.6375, 507.6],
		);
		assert.deepEqual([plot.grid[0]!.x1, plot.grid[0]!.x2], [36, 356.5]);
		assert.equal(plot.labelRight, 26.3);
	});

	it("puts a dot on the 10th of each month, within the phone's measured half point", () => {
		nearAll(
			plot.dots.map((d) => d.x),
			[35.75, 63.5, 89.5, 117, 144.5, 169.25, 196.5, 223, 250.5, 277, 304.25, 331.5, 358],
			0.5,
		);
		assert.ok(plot.dots.every((d) => d.r === 4));
		near(plot.dots[0]!.y + TITLE, 520);
		assert.deepEqual(
			plot.labels.map((l) => l.text),
			["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
		);
		assert.ok(plot.labels.every((l) => l.rotated));
		near(plot.labels[0]!.y + TITLE, 552.6);
	});

	it("draws a bare line, a week a vertex at Figma's step, stopping short of the right edge", () => {
		assert.deepEqual(plot.points, []);
		const vertices = [...plot.line.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
		assert.equal(vertices.length, 52);
		near(vertices[0]![0], 35.75);
		near(vertices[1]![0] - vertices[0]![0], 6.174, 0.01);
		near(vertices[51]![0], 350.94);
		const top = vertices.reduce((a, b) => (b[1] < a[1] ? b : a));
		near(top[1] + TITLE, 419.945);
	});
});

describe("Daily Timeline: 1d", () => {
	const H = 3_600_000;
	const start = Date.parse("2026-10-06T21:00:00Z");
	// 6:00 AM: a 27, a 0, then two readings too active to measure.
	const levels: Array<number | null> = Array.from({ length: 480 }, () => null);
	levels.splice(120, 4, 27, 0, -2, -2);
	const t = timelineOf({ start, end: start + 24 * H, startOffset: 3 * H, endOffset: 3 * H, step: 180_000, levels }, 24_720);
	const plot = timelinePlot(t, PHONE);

	it("spans Figma's timeline: gridlines from 729 to 916.25, x 38 to 376.5", () => {
		nearAll(
			plot.grid.map((g) => g.y + DAY_TITLE),
			[729, 775.8125, 822.625, 869.4375, 916.25],
		);
		assert.deepEqual([plot.left, plot.right, plot.grid[0]!.x2], [38, 376.5, 376.5]);
		assert.equal(plot.labelRight, 28);
		near(plot.height + DAY_TITLE, 982.4);
	});

	it("puts a dot an hour where Figma's are, every fourth large and labelled", () => {
		assert.equal(plot.dots.length, 25);
		nearAll(
			plot.dots.filter((d) => d.r === 4).map((d) => d.x),
			[38, 94.4167, 150.833, 207.25, 263.667, 320.083, 376.5],
		);
		nearAll(
			plot.dots.slice(1, 4).map((d) => d.x),
			[52.104, 66.208, 80.3125],
		);
		near(plot.dots[0]!.y + DAY_TITLE, 943.5);
		assert.deepEqual(
			plot.labels.map((l) => l.text),
			["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"],
		);
		near(plot.labels[1]!.x, 94.42);
		near(plot.labels[0]!.y + DAY_TITLE, 956.14);
	});

	it("draws a reading as a bar three minutes wide, up from 0 to its level", () => {
		const [bar, zero] = plot.bars;
		assert.deepEqual([bar!.tone, zero!.tone], ["stress", "rest"]);
		near(bar!.x, 122.63);
		near(bar!.w, 0.71);
		near(bar!.y + DAY_TITLE, 865.69);
		near(bar!.h, 50.56);
		// A 0 still shows a sliver: 1% of the plot.
		near(zero!.h, 1.87);
		assert.deepEqual(plot.active, [{ x: 124.04, y: 37.94, w: 1.41, h: 187.25 }]);
	});

	it("puts the clock marker where the night ended, on the dot row", () => {
		near(plot.marker!.x, 38 + (24_720 / 86_400) * 338.5);
		assert.deepEqual([plot.marker!.y, plot.marker!.r], [plot.dots[0]!.y, 9.5]);
		assert.equal(timelinePlot(timelineOf(null), PHONE).marker, undefined);
	});
});

describe("rings", () => {
	const oct7 = ringOf({ rest: 39420, low: 15300, medium: 5880, high: 3540 });

	it("are Figma's: 3.6° gaps centred on each boundary, twelve o'clock's too", () => {
		assert.equal(RING_GAP, 3.6);
		const arcs = ringArcs(oct7, DAY_RING.size, DAY_RING.thickness);
		assert.deepEqual(
			arcs.map((a) => a.part),
			["rest", "low", "medium", "high"],
		);
		// Figma's arcData on the 1d ring and every card's mini ring, Oct 7.
		const figma = [
			[-88.2, 129.456],
			[133.056, 215.316],
			[218.916, 248.328],
			[251.928, 268.2],
		];
		arcs.forEach((a, i) => {
			near(a.start, figma[i]![0]!, 0.02);
			near(a.end, figma[i]![1]!, 0.02);
		});
		assert.match(arcs[0]!.d, /^M93\.93 4\.19 A87\.05 87\.05 0 1 1 /);
		assert.deepEqual(
			ringArcs(oct7, CARD_RING.size, CARD_RING.thickness).map((a) => [a.start, a.end]),
			arcs.map((a) => [a.start, a.end]),
		);
	});

	it("are 182.4pt across and 8.3 thick on 1d, 26 and 4 on a card", () => {
		// Figma's inner radii: 0.909 of 91.2, and 9 of 13.
		assert.deepEqual(ringTrack(DAY_RING.size, DAY_RING.thickness), { c: 91.2, r: 87.05 });
		assert.deepEqual(ringTrack(CARD_RING.size, CARD_RING.thickness), { c: 13, r: 11 });
	});

	it("split a card's ring where the phone measured Oct 4's boundaries", () => {
		const arcs = ringArcs(ringOf({ rest: 36360, low: 6840, medium: 4140, high: 7140 }), CARD_RING.size, CARD_RING.thickness);
		// Clockwise from twelve: measured 240 / 284.5 / 315, the shares 240.3 / 285.5 / 312.8.
		nearAll(
			arcs.slice(0, 3).map((a) => a.end + RING_GAP / 2 + 90),
			[240.26, 285.46, 312.82],
			0.01,
		);
	});

	it("close the circle for a single category, skip one with no time, and draw nothing for a day without any", () => {
		const one = ringArcs(ringOf({ rest: 3600 }), DAY_RING.size, DAY_RING.thickness);
		assert.deepEqual(one.map((a) => [a.part, a.start, a.end]), [["rest", -90, 270]]);
		assert.equal(one[0]!.d.match(/A/g)?.length, 2);
		// Jan 28: no rest and no low stress at all.
		assert.deepEqual(
			ringArcs(ringOf({ medium: 1200, high: 2580 }), DAY_RING.size, DAY_RING.thickness).map((a) => a.part),
			["medium", "high"],
		);
		assert.deepEqual(ringArcs(ringOf(undefined), DAY_RING.size, DAY_RING.thickness), []);
	});
});

/**
 * The panes (279:3157, 279:3298, 279:41765) put each chart in a 748pt column
 * whose left edge is at x 32, its title's bottom at y 171.
 */
describe("pane frames", () => {
	const COLUMN = 748;
	const LEFT = 32;
	const PANE_TITLE = 171;

	it("7d: gridlines from 200.05 to 440.05 across the column, the days from 64 to 779.44", () => {
		const plot = linePlot(view("7d"), COLUMN, true);
		nearAll(
			plot.grid.map((g) => g.y + PANE_TITLE),
			[200.05, 260.05, 320.05, 380.05, 440.05],
		);
		assert.deepEqual([plot.grid[0]!.x1 + LEFT, plot.grid[0]!.x2 + LEFT], [64, 780]);
		nearAll(
			plot.dots.map((d) => d.x + LEFT),
			[64, 183.24, 302.48, 421.72, 540.96, 660.2, 779.44],
		);
		near(plot.dots[0]!.y + PANE_TITLE, 473.3);
		near(plot.labels[1]!.x + LEFT, 779.44);
		near(plot.labels[0]!.y + PANE_TITLE, 485.9);
		assert.equal(plot.labelRight + LEFT, 56);
		// Oct 2 at 22, Oct 3 at 28: the pane's first points, within the twin's rounding.
		near(plot.points[0]!.y + PANE_TITLE, 387.33, 0.1);
		near(plot.points[1]!.y + PANE_TITLE, 372.93, 0.1);
		// The cards follow 30pt under the chart, at 524.
		near(plot.height + PANE_TITLE + 30, 524);
	});

	it("1y: the months from 63.44 to 783.35, their dots on 452.45", () => {
		const plot = linePlot(view("1y", rows), COLUMN, true);
		near(plot.dots[0]!.x + LEFT, 63.44);
		near(plot.dots[12]!.x + LEFT, 783.35);
		near(plot.dots[0]!.y + PANE_TITLE, 452.45);
		near(plot.labels[0]!.y + PANE_TITLE, 485.05);
		near(plot.height + PANE_TITLE + 30, 529);
	});

	it("1d: x 64 to 760, the dot row on 467.3 and its labels on 479.94, the legend at 506.2", () => {
		const plot = timelinePlot(timelineOf(null), COLUMN, true);
		assert.deepEqual([plot.left + LEFT, plot.right + LEFT], [64, 760]);
		nearAll(
			plot.grid.map((g) => g.y + PANE_TITLE),
			[200.05, 260.05, 320.05, 380.05, 440.05],
		);
		assert.equal(plot.dots.length, 25);
		nearAll([plot.dots[0]!.x + LEFT, plot.dots[1]!.x + LEFT, plot.dots[24]!.x + LEFT], [64, 93, 760]);
		near(plot.dots[0]!.y + PANE_TITLE, 467.3);
		near(plot.labels[0]!.y + PANE_TITLE, 479.94);
		near(plot.height + PANE_TITLE, 506.2);
	});
});
