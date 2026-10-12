import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	BARS_ACROSS,
	BARS_LAYOUT,
	CATEGORY_COLORS,
	DAY_LAYOUT,
	LEGEND,
	LEGEND_WIDTH,
	RING,
	SCORE_FRAME,
	SCORE_LAYOUT,
	barsDown,
	barsPlot,
	categoryColor,
	legendRowWidth,
	legendRows,
	paneRows,
	pillPath,
	ringArcs,
	scorePlot,
} from "../src/dashboard/endurance-score-charts";
import { enduranceScoreView, type EnduranceDayView, type EndurancePeriodView, type EnduranceScoreContext } from "../src/dashboard/endurance-score-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { DIAL_KINDS, dialPoint } from "../src/dashboard/stat-dial";
import { enduranceRows } from "./endurance-score-fixture";

/**
 * The page's geometry against the Obsidian twin (Figma page 430:6128): the
 * phones at PHONE = 402 (581:9, 581:110, 581:222, 582:108105, 582:108657,
 * 582:109643) and the panes' 748 pt column (585:1793, 585:1917, 585:110129,
 * 585:110509, 584:1723, 584:1770), with today pinned to the capture day.
 * Positions are the twin's frame coordinates; a chart's are in its own box.
 */
const TODAY = "2026-10-11";
const ROWS = enduranceRows();
const CTX: EnduranceScoreContext = { today: TODAY, complete: true };
const period = (range: "12w" | "1y", tab: string, offset = 0) => enduranceScoreView({ range, offset, tab }, ROWS, CTX) as EndurancePeriodView;
const day = (tab: string) => enduranceScoreView({ range: "1d", offset: 0, tab }, ROWS, CTX) as EnduranceDayView;
const near = (a: number, b: number, within: number, what: string) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a}, the twin's ${b}`);

/** The tabs' foot: y 172.33 + 55 on the phone, 148 + 55 in a pane. */
const TABS_FOOT = { phone: 227.33, pane: 203 };

describe("1d — the dial and the copy (581:9, pane 584:1723)", () => {
	it("puts the endurance dial's 196 box 16.01 under the tabs: (103, 243.34) on the phone, centre y 341.34 as the Stat Dial's notes give it", () => {
		assert.equal(r2(TABS_FOOT.phone + DAY_LAYOUT.dialTop), 243.34);
		assert.equal(r2(TABS_FOOT.pane + DAY_LAYOUT.dialTop), 219.01);
		assert.deepEqual([DIAL_KINDS.endurance.radius, DIAL_KINDS.endurance.width, DIAL_KINDS.endurance.gap], [85.6, 6, 1.85]);
	});

	it("starts the copy's 20.11 lines 8.47 under the dial's box, the twin's 22 pt boxes from 446.86; in a pane 79.19 under the tabs' top (226.24)", () => {
		const first = TABS_FOOT.phone + DAY_LAYOUT.dialTop + 196 + DAY_LAYOUT.copyGap;
		near(first - (22 - DAY_LAYOUT.copyLine) / 2, 446.86, 0.01, "phone copy");
		[446.86, 466.98, 487.08, 507.2].forEach((y, i) => near(446.86 + i * DAY_LAYOUT.copyLine, y, 0.02, `line ${i + 1}`));
		near(148 + DAY_LAYOUT.copyTopPane - (22 - DAY_LAYOUT.copyLine) / 2, 226.24, 0.01, "pane copy");
	});
});

describe("1d — the ring, its legend and the list (581:110, pane 584:1770)", () => {
	const v = day("contributors");

	it("draws the ring in the dial's 196 box: its 180 box at (110.84, 251.18), R 90, 8 wide, centre (200.84, 341.18)", () => {
		const top = TABS_FOOT.phone + RING.top;
		assert.equal(r2(top + 98), 341.18);
		assert.equal(r2(top + 8), 251.18);
		assert.equal(r2(TABS_FOOT.pane + RING.top + 8), 226.85);
		assert.deepEqual([RING.radius, RING.width], [90, 8]);
		// The score and the class: the twin's 303.87 and 360 on the phone, 279.54 and 335.67 in a pane.
		assert.equal(r2(top + RING.valueTop), 303.87);
		assert.equal(r2(top + RING.labelTop), 360);
		assert.equal(r2(TABS_FOOT.pane + RING.top + RING.valueTop), 279.54);
	});

	it("runs each slice's arc on the centreline (86) between its angles, in its category's colour", () => {
		const arcs = ringArcs(v.ring);
		assert.deepEqual(arcs.map((a) => a.color), ["var(--color-orange)", "var(--color-yellow)", "var(--text-faint)"]);
		const [x0, y0] = dialPoint(86, v.ring[0]!.from);
		const [x1, y1] = dialPoint(86, v.ring[0]!.to);
		assert.equal(arcs[0]!.d, `M${r2(x0)} ${r2(y0)}A86 86 0 1 1 ${r2(x1)} ${r2(y1)}`);
		// Gym and Miscellaneous are short arcs.
		assert.match(arcs[1]!.d, /A86 86 0 0 1 /);
		assert.match(arcs[2]!.d, /A86 86 0 0 1 /);
	});

	it("breaks the phone's legend after Gym & Fitness Equipment (rows at 455 and 476.33, x 87 and 155); a pane's keeps one row at x 238", () => {
		const rows = legendRows(v.legend, LEGEND_WIDTH.day);
		assert.deepEqual(rows.map((r) => r.map((i) => i.title)), [["Running", "Gym & Fitness Equipment"], ["Miscellaneous"]]);
		assert.deepEqual(rows.map((r) => r2((PHONE - legendRowWidth(r)) / 2)), [87, 155]);
		const top = TABS_FOOT.phone + RING.top + 196 + RING.legendGap;
		assert.equal(r2(top), 455);
		assert.equal(r2(top + LEGEND.pitch), 476.33);
		const pane = legendRows(v.legend, PANE_COLUMN);
		assert.equal(pane.length, 1);
		assert.equal(r2(32 + (PANE_COLUMN - legendRowWidth(pane[0]!)) / 2), 238);
		assert.equal(r2(TABS_FOOT.pane + RING.top + 196 + RING.legendGap), 430.67);
	});

	it("starts the list 23.67 under the legend (514); a pane's card level with the ring's top", () => {
		assert.equal(r2(455 + LEGEND.pitch + LEGEND.row + RING.listGap), 514);
		assert.equal(r2(148 + RING.listTopPane), 226.85);
	});
});

describe("12w — the score tab's chart (581:222, pane 585:1793)", () => {
	const v = period("12w", "score");
	const p = scorePlot(v.line, PHONE);

	it("puts the box 66.84 under the tabs (294.17) and Avg / Max 16 under it (561.33)", () => {
		assert.equal(r2(TABS_FOOT.phone + SCORE_LAYOUT.offset), 294.17);
		assert.equal(r2(TABS_FOOT.phone + SCORE_LAYOUT.offset + SCORE_FRAME.height + SCORE_LAYOUT.statsGap), 561.33);
		assert.equal(p.height, 251.16);
	});

	it("lays five gridlines from x 52 to 372.67 at the twin's 7.0 … 181.33, labelled right-aligned at 36.17", () => {
		assert.deepEqual(p.grid.map((g) => g.y), [7, 50.58, 94.17, 137.75, 181.33]);
		assert.deepEqual(p.grid.map((g) => g.label), ["7,092", "6,780", "6,469", "6,157", "5,845"]);
		assert.ok(p.grid.every((g) => g.x1 === 52 && g.x2 === 372.67));
		assert.equal(p.labelRight, 36.17);
	});

	it("places the points by days to Oct 12, within 0.4 of the twin's dots, a 2 pt line through them", () => {
		const twin: Array<[number, number]> = [
			[52.0, 76.59],
			[78.77, 85.69],
			[105.52, 90.3],
			[132.27, 90.72],
			[159.04, 99.38],
			[185.79, 104.27],
			[212.55, 111.13],
			[239.3, 105.95],
			[266.07, 106.09],
			[292.82, 106.38],
			[319.57, 101.9],
			[346.33, 102.31],
		];
		assert.equal(p.points.length, 12);
		// The twin set its dots at the shot's pixel reads, ~2 above the floored averages: 0.31 pt.
		p.points.forEach((pt, i) => {
			near(pt.x, twin[i]![0], 0.4, `x ${i}`);
			near(pt.y, twin[i]![1], 0.35, `y ${i}`);
		});
		assert.equal(p.pointRadius, 3.835);
		assert.match(p.line, /^M52 76\.9\d* L/);
	});

	it("draws an 8 pt dot under each Monday at 208.16 and its label on end centred at 230.83", () => {
		assert.equal(p.dots.length, 12);
		assert.ok(p.dots.every((d) => d.y === 208.16 && d.r === 4));
		p.dots.forEach((d, i) => near(d.x, 51.83 + 26.757 * i, 0.45, `tick ${i}`));
		assert.ok(p.labels.every((l) => l.y === 230.83 && l.rotated));
		assert.equal(p.labels[0]!.text, "07-20");
	});

	it("stretches in a pane: gridlines to 718.67, the points within 1 pt of the twin's", () => {
		const pane = scorePlot(v.line, PANE_COLUMN);
		assert.ok(pane.grid.every((g) => g.x1 === 52 && g.x2 === 718.67));
		const twin = [52.0, 107.63, 163.25, 218.88, 274.51, 330.13, 385.76, 441.39, 497.03, 552.64, 608.28, 663.91];
		pane.points.forEach((pt, i) => near(pt.x, twin[i]!, 0.85, `x ${i}`));
		// Avg / Max level with the top gridline: their rule's top at 276.34.
		assert.equal(r2(148 + 55 + SCORE_LAYOUT.offset + SCORE_FRAME.top - 0.5), 276.34);
	});
});

describe("1y — the score tab's chart (Inferred 582:109260, pane 585:1917)", () => {
	it("puts each month at its 1st by days from Oct 1, 2025 to Oct 12, 2026: the twin's pane points", () => {
		const v = period("1y", "score");
		const pane = scorePlot(v.line, PANE_COLUMN);
		const twin = [52.0, 106.97, 160.15, 215.12, 270.09, 319.73, 374.7, 427.88, 482.85, 536.05, 591.02, 645.97, 699.17];
		pane.points.forEach((pt, i) => near(pt.x, twin[i]!, 0.02, `month ${i}`));
		assert.deepEqual(pane.grid.map((g) => g.label), ["9,022", "8,236", "7,450", "6,663", "5,877"]);
		near(pane.points[0]!.y, 34.41, 0.35, "October");
	});

	it("keeps the bare box for a period without a point", () => {
		const empty = scorePlot(null, PHONE);
		assert.deepEqual([empty.grid, empty.points, empty.line, empty.height], [[], [], "", 251.16]);
	});
});

describe("12w — the contributors tab's bars (582:108105, pane 585:110129)", () => {
	const v = period("12w", "contributors");
	const rows = legendRows(v.legend, LEGEND_WIDTH.period);
	const p = barsPlot(v.bars, "12w", PHONE, rows.length);

	it("keys a one-row legend at x 33, so the box is 48 under the tabs and 234.67 tall; the Stats stay at 553.33, the list at 637.33", () => {
		assert.equal(rows.length, 1);
		assert.equal(r2((PHONE - legendRowWidth(rows[0]!)) / 2), 33);
		const down = barsDown(1);
		assert.equal(r2(TABS_FOOT.phone + down.offset), 275.33);
		assert.equal(p.height, 234.67);
		const legend = TABS_FOOT.phone + down.offset + down.height + BARS_LAYOUT.legendGap;
		assert.equal(r2(legend), 516.67);
		const stats = legend + LEGEND.row + BARS_LAYOUT.statsGap;
		assert.equal(r2(stats), 553.33);
		assert.equal(r2(stats + 51 + BARS_LAYOUT.listGap), 637.33);
	});

	it("lays the gridlines from 0 at the twin's 7.0 … 184.17, x 53.33 to 371.33", () => {
		[7, 51.29, 95.58, 139.88, 184.17].forEach((y, i) => near(p.grid[i]!.y, y, 0.02, `gridline ${i + 1}`));
		assert.deepEqual(p.grid.map((g) => g.label), ["7,100", "5,325", "3,550", "1,775", "0"]);
		assert.ok(p.grid.every((g) => g.x1 === 53.33 && g.x2 === 371.33));
		assert.ok(p.dots.every((d) => d.y === 191.67) && p.labels.every((l) => l.y === 214.34 && l.rotated));
	});

	it("centres each 9.33 bar on its Monday, 26.5 apart, and stacks Miscellaneous, Gym, Running with ½ pt gaps, a pill on top", () => {
		const twinX = [53.325, 79.845, 106.355, 132.875, 159.385, 185.905, 212.425, 238.935, 265.445, 291.965, 318.475, 344.995];
		const twinTop = [18.85, 20.47, 21.29, 21.37, 22.92, 23.77, 25.01, 24.02, 24.11, 24.16, 23.36, 23.44];
		assert.equal(p.bars.length, 12);
		p.bars.forEach((bar, i) => {
			near(bar.x, twinX[i]!, 0.2, `bar ${i}`);
			assert.deepEqual([bar.width, bar.radius], [9.33, 4.665]);
			// The twin's bars end 0.17 under the zero line.
			near(bar.rects[bar.rects.length - 1]!.y, twinTop[i]!, 0.2, `top ${i}`);
		});
		const oct5 = p.bars[11]!;
		assert.deepEqual(oct5.rects.map((r) => r.category), ["misc", "gym", "running"]);
		// Heights: the twin's 3.42, 7.43 and 149.05.
		assert.deepEqual(oct5.rects.map((r) => r.height), [3.42, 7.43, 149.05]);
		// Each gap ½ pt: the segment above starts that much higher.
		assert.equal(r2(oct5.rects[0]!.y - (oct5.rects[1]!.y + oct5.rects[1]!.height)), BARS_ACROSS["12w"].gap);
		assert.equal(r2(oct5.rects[0]!.y + oct5.rects[0]!.height), 184.17);
		assert.ok(oct5.rects[2]!.d?.startsWith(`M${r2(oct5.x - 4.665)} `));
		assert.equal(oct5.rects[0]!.d, undefined);
	});

	it("stretches in a pane: gridlines to 717.33, the bars within 0.4 of the twin's, its own one-row box", () => {
		const pane = barsPlot(v.bars, "12w", PANE_COLUMN, paneRows("12w"));
		assert.ok(pane.grid.every((g) => g.x2 === 717.33));
		const twin = [53.32, 108.69, 164.05, 219.42, 274.78, 330.15, 385.53, 440.88, 496.24, 551.61, 606.97, 662.34];
		pane.bars.forEach((bar, i) => near(bar.x, twin[i]!, 0.4, `bar ${i}`));
		assert.equal(pane.height, 234.67);
		// Avg / Max level with the top gridline (257.5), the legend 22.67 under them (331.17), the blocks 30 under the box (515.67).
		const down = barsDown(paneRows("12w"));
		assert.equal(r2(148 + 55 + down.offset + down.top - 0.5), 257.5);
		assert.equal(r2(257.5 + 51 + BARS_LAYOUT.paneLegendGap), 331.17);
		assert.equal(r2(TABS_FOOT.pane + down.offset + down.height + BARS_LAYOUT.paneBlocksGap), 515.67);
	});
});

describe("1y — the contributors tab's bars (582:108657, pane 585:110509)", () => {
	const v = period("1y", "contributors");
	const rows = legendRows(v.legend, LEGEND_WIDTH.period);
	const p = barsPlot(v.bars, "1y", PHONE, rows.length);

	it("breaks the legend into two rows at x 50.5 and 77.5, so the box is 48.67 under the tabs and 212.67 tall", () => {
		assert.deepEqual(rows.map((r) => r.map((i) => i.title)), [["Running", "Cycling", "Gym & Fitness Equipment"], ["Swimming", "Hiking", "Miscellaneous"]]);
		assert.deepEqual(rows.map((r) => r2((PHONE - legendRowWidth(r)) / 2)), [50.5, 77.5]);
		const down = barsDown(2);
		assert.equal(r2(TABS_FOOT.phone + down.offset), 276);
		assert.equal(p.height, 212.67);
		const legend = TABS_FOOT.phone + down.offset + down.height + BARS_LAYOUT.legendGap;
		near(legend, 495.33, 0.01, "legend row 1");
		assert.equal(r2(legend + LEGEND.pitch + LEGEND.row + BARS_LAYOUT.statsGap), 553.33);
	});

	it("lays the gridlines 7.0 … 162.33 from x 54.33 to 375.67, labelled at 38.17", () => {
		assert.deepEqual(p.grid.map((g) => g.y), [7, 45.83, 84.67, 123.5, 162.33]);
		assert.deepEqual(p.grid.map((g) => g.label), ["9,000", "6,750", "4,500", "2,250", "0"]);
		assert.ok(p.grid.every((g) => g.x1 === 54.33 && g.x2 === 375.67));
		assert.equal(p.labelRight, 38.17);
		assert.ok(p.dots.every((d) => d.y === 169.67) && p.labels.every((l) => l.y === 192.34));
	});

	it("centres each 9 bar on its month's 1st by days, within 0.25 of the twin; ⅓ pt gaps, the October bar's top at 14.25", () => {
		const twinX = [54.83, 81.5, 107.0, 133.5, 159.83, 183.83, 210.17, 235.83, 262.17, 287.83, 314.17, 340.83, 366.33];
		assert.equal(p.bars.length, 13);
		p.bars.forEach((bar, i) => near(bar.x, twinX[i]!, 0.25, `month ${i}`));
		const october = p.bars[0]!;
		assert.deepEqual(october.rects.map((r) => r.category), ["misc", "swimming", "cycling", "running"]);
		near(october.rects[3]!.y, 14.25, 0.02, "October's top");
		// The twin's segments: 7.89, 12.01, 38.08, 89.11.
		[7.89, 12.01, 38.08, 89.11].forEach((h, i) => near(october.rects[i]!.height, h, 0.02, `segment ${i}`));
		assert.equal(BARS_ACROSS["1y"].gap, 1 / 3);
		assert.deepEqual([october.width, october.radius], [9, 4.5]);
	});

	it("stretches in a pane: gridlines to 721.67, the twin's own two-row box, its bars within 1 pt", () => {
		const pane = barsPlot(v.bars, "1y", PANE_COLUMN, paneRows("1y"));
		assert.ok(pane.grid.every((g) => g.x2 === 721.67));
		assert.equal(pane.height, 212.67);
		const twin = [55.37, 110.76, 163.71, 218.75, 273.43, 323.27, 377.97, 431.26, 485.97, 539.26, 593.96, 649.33, 702.28];
		pane.bars.forEach((bar, i) => near(bar.x, twin[i]!, 1, `month ${i}`));
		const down = barsDown(paneRows("1y"));
		assert.equal(r2(148 + 55 + down.offset + down.top - 0.5), 258.17);
		assert.equal(r2(TABS_FOOT.pane + down.offset + down.height + BARS_LAYOUT.paneBlocksGap), 494.34);
		// The side column's legend wraps as the phone's: Running, Cycling, Gym / Swimming, Hiking, Miscellaneous.
		assert.equal(legendRows(v.legend, LEGEND_WIDTH.period).length, 2);
	});
});

describe("12w −1 — a two-row legend on 12w (Inferred 582:109643)", () => {
	it("keeps the 12w's bars across and takes the 1y's box down: legend rows at x 53.5 and 155", () => {
		const v = period("12w", "contributors", -1);
		const rows = legendRows(v.legend, LEGEND_WIDTH.period);
		assert.deepEqual(rows.map((r) => r.map((i) => i.title)), [["Running", "Gym & Fitness Equipment", "Hiking"], ["Miscellaneous"]]);
		assert.deepEqual(rows.map((r) => r2((PHONE - legendRowWidth(r)) / 2)), [53.5, 155]);
		const p = barsPlot(v.bars, "12w", PHONE, rows.length);
		assert.equal(p.height, 212.67);
		near(p.bars[0]!.x, 53.33, 0.01, "first bar");
		// The twin's 04-27 bar: 144.66 tall from 17.67, its zero line at 162.33.
		near(p.bars[0]!.rects[p.bars[0]!.rects.length - 1]!.y, 17.67, 0.2, "04-27 top");
	});

	it("moves the box 0.67 down and takes 22 off it for each row past two, as the second row does (Inferred)", () => {
		const three = barsDown(3);
		assert.deepEqual([three.offset, three.height, three.baseline, three.dotY, three.labelY], [49.34, 190.67, 140.33, 147.67, 170.34]);
		assert.equal(r2(three.offset + three.height + BARS_LAYOUT.legendGap + LEGEND.row + 2 * LEGEND.pitch + BARS_LAYOUT.statsGap), 326);
		assert.equal(barsDown(0), barsDown(1));
	});
});

describe("colours and shapes", () => {
	it("binds each category to the twin's variable; an activity type of its own takes pink (Inferred)", () => {
		assert.deepEqual(CATEGORY_COLORS, {
			running: "var(--color-orange)",
			gym: "var(--color-yellow)",
			cycling: "var(--color-green)",
			swimming: "var(--color-blue)",
			hiking: "var(--color-red)",
			misc: "var(--text-faint)",
			multisport: "var(--color-purple)",
		});
		assert.equal(categoryColor("type-9"), "var(--color-pink)");
	});

	it("draws a pill top rounded by half the bar, never more than its height", () => {
		assert.equal(pillPath(0, 10, 9, 100, 4.5), "M0 110V14.5A4.5 4.5 0 0 1 4.5 10H4.5A4.5 4.5 0 0 1 9 14.5V110Z");
		assert.equal(pillPath(0, 10, 9, 2, 4.5), "M0 12V12A2 2 0 0 1 2 10H7A2 2 0 0 1 9 12V12Z");
	});

	it("wraps an unseen category by an estimate of its width", () => {
		const rows = legendRows(
			[
				{ category: "running", title: "Running" },
				{ category: "type-9", title: "Walking" },
				{ category: "misc", title: "Miscellaneous" },
			],
			200,
		);
		assert.deepEqual(rows.map((r) => r.map((i) => i.category)), [["running", "type-9"], ["misc"]]);
		assert.equal(legendRowWidth(rows[0]!), 61 + 16 + 61);
	});
});

function r2(n: number): number {
	return Math.round(n * 100) / 100;
}
