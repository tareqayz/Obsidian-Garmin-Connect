import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CHART_COLOURS } from "../src/dashboard/activity-chart-pages";
import { PHONE } from "../src/dashboard/stat-charts";
import { TE_CHART, TE_DETAIL, TE_LAYOUT, discColour, teScaleRow, trainingEffectPlot, type TePlot } from "../src/dashboard/training-effect-charts";
import { activitySub, trainingEffectView, type TeChart, type TrainingEffectDetailView, type TrainingEffectPeriodView } from "../src/dashboard/training-effect-pages";
import { ACTIVITIES, TODAY, idAt } from "./training-effect-fixture";

/**
 * Training Effect's geometry against the Obsidian twin (Figma page
 * 430:6116), node by node: the phones at 402 pt (684:33 7d, 684:118544 4w,
 * 684:119241 a week with several a day, 684:119391 4w before, the detail
 * pages 684:118813, 684:118933 and 684:119704) and the panes at 1190
 * (686:1120 7d and 686:1218 4w, each chart 559 wide; 686:119854 the detail,
 * its cells 748 wide). The twin keeps Garmin's geometry, 56 pt higher on the
 * page; the pages tests hold the same plot to the phone's own positions.
 */

const PANE_HALF = 559;
const PANE_COLUMN = 748;

const period = (range: "7d" | "4w", offset = 0) => trainingEffectView({ range, offset }, ACTIVITIES, { today: TODAY, complete: true }) as TrainingEffectPeriodView;
const detail = (start: string) => trainingEffectView({ range: "7d", offset: 0, sub: activitySub(idAt(start)) }, ACTIVITIES, { today: TODAY, complete: true }) as TrainingEffectDetailView;

const near = (actual: number, expected: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(actual - expected) <= tolerance + 1e-9, `${what}: ${actual} vs ${expected} (±${tolerance})`);

/** The twin's bars in a plot frame at (27, 31) in its chart: x and y in the plot, as Figma lists them. */
function twinBars(plot: TePlot, twin: ReadonlyArray<readonly [x: number, y: number, height: number]>, width: number, what: string) {
	assert.equal(plot.bars.length, twin.length, `${what}: bar count`);
	plot.bars.forEach((bar, i) => {
		const [x, y, height] = twin[i]!;
		near(bar.x, TE_CHART.left + x, 0.01, `${what} ${bar.date} x`);
		near(bar.y, TE_CHART.top + y, 0.01, `${what} ${bar.date} y`);
		near(bar.height, height, 0.01, `${what} ${bar.date} height`);
		near(bar.width, width, 0.01, `${what} ${bar.date} width`);
	});
}

const plotOf = (chart: TeChart, width: number) => trainingEffectPlot(chart, width);

describe("the chart's box (Chart 683:217)", () => {
	const p = plotOf(period("7d").charts[0], PHONE);

	it("puts the plot 27 in and 25 short of the edge, 128 tall from 31: 5 is 25.6 pt a unit", () => {
		assert.deepEqual([p.left, p.right, p.top, p.baseline, p.width, p.height], [27, 377, 31, 159, 402, 190]);
		assert.deepEqual(p.title, { x: 201, y: 6 });
	});

	it("labels 5 down to 0 right-aligned at 14.33, each centred on its value (the twin's 12 pt boxes from 25.01)", () => {
		const tops = [25.01, 50.61, 76.21, 101.81, 127.41, 153.01];
		p.ticks.forEach((t, i) => {
			assert.equal(t.x, 14.33);
			near(t.y, tops[i]! + 6, 0.02, `label ${t.text}`);
		});
		assert.deepEqual(
			p.ticks.map((t) => t.text),
			["5", "4", "3", "2", "1", "0"],
		);
	});

	it("draws a dot a day 10 under the feet, Ø 3.67 and 7.67 at the ends, and MM-DD 12.84 under them", () => {
		assert.deepEqual(
			p.dots.map((d) => [d.y, d.r]),
			[[169, 3.835], ...Array(5).fill([169, 1.835]), [169, 3.835]],
		);
		assert.deepEqual(
			p.labels.map((l) => [l.text, l.y]),
			[
				["10-05", 181.84],
				["10-11", 181.84],
			],
		);
	});
});

describe("the phone's charts at 402 pt", () => {
	it("7d (684:39, 684:43): 36.57 pt bars 52.24 apart, Oct 10's 4.3 and Oct 11's 4.5, the 0.2 a 2.56 pt cap", () => {
		const v = period("7d");
		const aerobic = plotOf(v.charts[0], PHONE);
		assert.deepEqual([aerobic.pitch, aerobic.barWidth], [52.24, 36.57]);
		twinBars(
			aerobic,
			[
				[261.194, 17.92, 110.08],
				[313.433, 12.8, 115.2],
			],
			36.567,
			"aerobic",
		);
		assert.deepEqual(
			aerobic.bars.map((b) => b.radius),
			[18.28, 18.28],
		);
		const anaerobic = plotOf(v.charts[1], PHONE);
		twinBars(anaerobic, [[313.433, 122.88, 5.12]], 36.567, "anaerobic");
		assert.equal(anaerobic.bars[0]!.radius, 2.56);
	});

	it("7d: the end labels centred on the end slots, the twin's (683:135, 683:136) within 0.36 pt", () => {
		const p = plotOf(period("7d").charts[0], PHONE);
		assert.deepEqual(
			p.dots.map((d) => d.x),
			[45.28, 97.52, 149.76, 202, 254.24, 306.48, 358.72],
		);
		near(p.labels[0]!.x, 45.31, 0.04, "10-05");
		near(p.labels[1]!.x, 359.08, 0.36, "10-11");
	});

	it("4w (684:118550, 684:118564): 8.84 pt bars 12.635 apart on the 12 days, the swim's on Sep 14's slot at the plot's edge", () => {
		const v = period("4w");
		const aerobic = plotOf(v.charts[0], PHONE);
		assert.deepEqual([aerobic.pitch, aerobic.barWidth], [12.64, 8.84]);
		twinBars(
			aerobic,
			[
				[0, 66.56, 61.44],
				[12.635, 46.08, 81.92],
				[25.271, 51.2, 76.8],
				[63.177, 56.32, 71.68],
				[101.083, 33.28, 94.72],
				[113.718, 30.72, 97.28],
				[138.989, 23.04, 104.96],
				[164.26, 35.84, 92.16],
				[176.895, 15.36, 112.64],
				[240.072, 23.04, 104.96],
				[328.52, 17.92, 110.08],
				[341.155, 12.8, 115.2],
			],
			8.845,
			"aerobic",
		);
		twinBars(
			plotOf(v.charts[1], PHONE),
			[
				[0, 89.6, 38.4],
				[176.895, 122.88, 5.12],
				[341.155, 122.88, 5.12],
			],
			8.845,
			"anaerobic",
		);
		// The twin's end labels (683:214, 683:215).
		near(aerobic.labels[0]!.x, 31.41, 0.02, "09-14");
		near(aerobic.labels[1]!.x, 372.94, 0.36, "10-11");
	});

	it("a week with several a day, Sep 7 - 13 (684:119241): each chart's day maximum on its slot", () => {
		const v = period("7d", -4);
		assert.equal(v.label, "Sep 7 - 13");
		twinBars(
			plotOf(v.charts[0], PHONE),
			[
				[0, 48.64, 79.36],
				[104.478, 43.52, 84.48],
				[261.194, 46.08, 81.92],
			],
			36.567,
			"aerobic",
		);
		twinBars(plotOf(v.charts[1], PHONE), [[261.194, 69.12, 58.88]], 36.567, "anaerobic");
		assert.equal(v.cards.length, 6);
	});

	it("4w before, Aug 17 - Sep 13 (684:119391): the 0.1 bar a 1.28 pt cap", () => {
		const v = period("4w", -1);
		twinBars(
			plotOf(v.charts[0], PHONE),
			[
				[63.177, 38.4, 89.6],
				[75.812, 38.4, 89.6],
				[88.448, 33.28, 94.72],
				[138.989, 53.76, 74.24],
				[151.625, 69.12, 58.88],
				[164.26, 38.4, 89.6],
				[176.895, 30.72, 97.28],
				[214.801, 48.64, 79.36],
				[227.437, 56.32, 71.68],
				[240.072, 43.52, 84.48],
				[265.343, 48.64, 79.36],
				[290.614, 43.52, 84.48],
				[328.52, 46.08, 81.92],
			],
			8.845,
			"aerobic",
		);
		const anaerobic = plotOf(v.charts[1], PHONE);
		twinBars(
			anaerobic,
			[
				[63.177, 102.4, 25.6],
				[138.989, 125.44, 2.56],
				[164.26, 69.12, 58.88],
				[240.072, 122.88, 5.12],
				[328.52, 69.12, 58.88],
			],
			8.845,
			"anaerobic",
		);
		assert.deepEqual(
			anaerobic.bars.map((b) => b.radius),
			[4.42, 1.28, 4.42, 2.56, 4.42],
		);
	});

	it("rounds a bar's top by half its width or half its height, its feet square: Oct 11's 4.5 and 0.2 as paths", () => {
		const [tall] = plotOf(period("7d").charts[0], PHONE).bars.slice(1);
		assert.equal(tall!.d, "M340.43 159V62.08A18.28 18.28 0 0 1 358.72 43.8H358.72A18.28 18.28 0 0 1 377 62.08V159Z");
		const [cap] = plotOf(period("7d").charts[1], PHONE).bars;
		assert.equal(cap!.d, "M340.43 159V156.44A2.56 2.56 0 0 1 342.99 153.88H374.44A2.56 2.56 0 0 1 377 156.44V159Z");
	});

	it("keeps both charts' axes for a period without activities", () => {
		const empty = trainingEffectView({ range: "7d", offset: 0 }, [], { today: TODAY, complete: true }) as TrainingEffectPeriodView;
		const p = plotOf(empty.charts[0], PHONE);
		assert.deepEqual([p.bars.length, p.dots.length, p.ticks.length, p.labels.length], [0, 7, 6, 2]);
	});
});

describe("the pane's charts, 559 pt each (686:1147, 686:1186)", () => {
	it("7d: the same band scale across 507 pt — 52.97 pt bars 75.67 apart", () => {
		const v = period("7d");
		const aerobic = plotOf(v.charts[0], PANE_HALF);
		assert.deepEqual([aerobic.right, aerobic.pitch, aerobic.barWidth], [534, 75.67, 52.97]);
		twinBars(
			aerobic,
			[
				[378.358, 17.92, 110.08],
				[454.03, 12.8, 115.2],
			],
			52.97,
			"aerobic",
		);
		twinBars(plotOf(v.charts[1], PANE_HALF), [[454.03, 122.88, 5.12]], 52.97, "anaerobic");
		// Dots (686:1156 …): their boxes' centres; labels (686:1163, 686:1164) centred on them.
		const twinDots = [49.65, 127.3217, 202.9934, 278.665, 354.3366, 430.0083, 503.6799].map((x, i) => x + (i === 0 || i === 6 ? 3.835 : 1.835));
		aerobic.dots.forEach((d, i) => near(d.x, twinDots[i]!, 0.01, `dot ${i}`));
		near(aerobic.labels[0]!.x, 33.485 + 20, 0.01, "10-05");
		near(aerobic.labels[1]!.x, 487.515 + 20, 0.01, "10-11");
		assert.deepEqual(aerobic.title, { x: 279.5, y: 6 });
	});

	it("4w: 12.81 pt bars 18.30 apart (686:1305, 686:1396)", () => {
		const v = period("4w");
		const aerobic = plotOf(v.charts[0], PANE_HALF);
		assert.deepEqual([aerobic.pitch, aerobic.barWidth], [18.3, 12.81]);
		twinBars(
			aerobic,
			[
				[0, 66.56, 61.44],
				[18.303, 46.08, 81.92],
				[36.606, 51.2, 76.8],
				[91.516, 56.32, 71.68],
				[146.426, 33.28, 94.72],
				[164.729, 30.72, 97.28],
				[201.336, 23.04, 104.96],
				[237.942, 35.84, 92.16],
				[256.245, 15.36, 112.64],
				[347.762, 23.04, 104.96],
				[475.884, 17.92, 110.08],
				[494.188, 12.8, 115.2],
			],
			12.812,
			"aerobic",
		);
		twinBars(
			plotOf(v.charts[1], PANE_HALF),
			[
				[0, 89.6, 38.4],
				[256.245, 122.88, 5.12],
				[494.188, 122.88, 5.12],
			],
			12.812,
			"anaerobic",
		);
		near(aerobic.dots[1]!.x, 49.8744 + 1.835, 0.01, "dot 2");
		near(aerobic.dots[27]!.x, 523.7589 + 3.835, 0.01, "dot 28");
	});
});

describe("the page's rhythm", () => {
	it("stacks the phone's charts at 140 and 327.33 and starts the cards at 537.33, 90 apart (684:33)", () => {
		const header = 140;
		const second = header + TE_CHART.height - TE_LAYOUT.chartOverlap;
		near(second, 327.33, 0.001, "Anaerobic");
		near(second + TE_CHART.height + TE_LAYOUT.list, 537.33, 0.001, "first card");
		// The band ends 8 under the last card (709.33 with two).
		near(537.33 + 90 + 74 + TE_LAYOUT.listBottom, 521.33 + 188, 0.001, "band");
		// Empty (684:119826): the line's 60 pt 16 over the 92 pt band's end.
		near(537.33 + 60 + TE_LAYOUT.emptyBottom, 521.33 + 92, 0.001, "empty band");
	});

	it("puts a pane's charts 32 under the header row's 116, the cards 20 under them (686:1120)", () => {
		const charts = 116 + TE_LAYOUT.paneTop;
		assert.equal(charts, 148);
		assert.equal(charts + TE_CHART.height + TE_LAYOUT.list, 358);
		assert.equal(2 * PANE_HALF + TE_LAYOUT.paneGap, 1126);
	});
});

describe("the detail page (684:118813, 684:118933, 684:119704; pane 686:119854)", () => {
	const D = TE_DETAIL;
	const benefitCell = (lines: number) => D.cellTop + D.title + (lines ? D.benefitGap + 20 * lines : 0) + D.benefitBottom;
	const scaleCell = (lines: number) => D.cellTop + D.title + D.scaleRow + 22 * lines + D.scaleBottom;

	it("stacks the sections under the bar: headers at 44.33, 206, 435 and 642, the related card at 683.67", () => {
		const v = detail("2026-10-11T08:21");
		const lines = { benefit: 3, aerobic: v.scales[0]!.copyLines!.length, anaerobic: v.scales[1]!.copyLines!.length };
		assert.deepEqual([lines.aerobic, lines.anaerobic], [3, 2]);
		const benefit = 44 + D.top;
		const aerobic = benefit + D.header + benefitCell(lines.benefit);
		const anaerobic = aerobic + D.header + scaleCell(lines.aerobic);
		const related = anaerobic + D.header + scaleCell(lines.anaerobic);
		[benefit, aerobic, anaerobic, related, related + D.header].forEach((y, i) => near(y, [44.33, 206, 435, 642, 683.67][i]!, 0.001, `section ${i}`));
		near(benefitCell(3), 120, 0.001, "benefit cell");
		near(scaleCell(3), 187.33, 0.001, "aerobic cell");
		near(scaleCell(2), 165.33, 0.001, "anaerobic cell");
	});

	it("shortens the cells without copy, as the swim's: headers at 138.51, 301.51, 464.51", () => {
		const v = detail("2026-09-14T23:50");
		assert.deepEqual([v.benefit.copy, v.scales[0]!.copyLines, v.scales[1]!.copyLines], [undefined, undefined, undefined]);
		const aerobic = 44 + D.top + D.header + benefitCell(0);
		const anaerobic = aerobic + D.header + scaleCell(0);
		const related = anaerobic + D.header + scaleCell(0);
		near(aerobic, 138.51, 0.001, "AEROBIC");
		near(anaerobic, 301.51, 0.001, "ANAEROBIC");
		near(related, 464.51, 0.001, "RELATED ACTIVITY");
		near(related + D.header, 506.18, 0.001, "card");
	});

	it("draws the run page's scale across a phone's cell: 66.53 pt segments 6 apart and the 7.33 cap, 16 to 386", () => {
		const row = teScaleRow(detail("2026-10-11T08:21").scales[0]!, PHONE);
		assert.deepEqual(
			row.segments.map((s) => [s.x, s.width, s.colour]),
			[
				[16, 66.53, "grey"],
				[88.53, 66.53, "grey"],
				[161.07, 66.53, "blue"],
				[233.6, 66.53, "green"],
				[306.14, 66.53, "orange"],
				[378.67, 7.33, "red"],
			],
		);
		// The run page's colours, not the twin's variables: the two pages match.
		assert.equal(CHART_COLOURS[row.knob.colour], "#fd9d39");
	});

	it("puts the knobs and values where the twin does: 349 / 30.8 (684:118821, 684:118825), 334.2 / 16 (684:118941, 684:118945)", () => {
		const knobs = (start: string) => detail(start).scales.map((s) => teScaleRow(s, PHONE));
		const oct11 = knobs("2026-10-11T08:21");
		assert.deepEqual(
			oct11.map((r) => [r.knob.x, r.value.x, r.value.text]),
			[
				[349, 349, "4.5"],
				[30.8, 30.8, "0.2"],
			],
		);
		// The twin's knob boxes are 28 wide: 335 and 16.8 are their left edges; the values' 40 pt boxes start 20 before.
		near(oct11[0]!.knob.x - D.knob / 2, 335, 0.001, "aerobic knob");
		near(oct11[1]!.knob.x - D.knob / 2, 16.8, 0.001, "anaerobic knob");
		const oct10 = knobs("2026-10-10T08:19");
		assert.deepEqual(
			oct10.map((r) => [r.knob.x, r.value.x]),
			[
				[334.2, 334.2],
				[16, 16],
			],
		);
		// 0.0's value is centred on the scale's start, half of it in the margin (684:118946 at x −4).
		near(oct10[1]!.value.x - 20, -4, 0.001, "0.0's box");
		// The swim (684:119712, 684:119716): 2.4 and 1.5.
		assert.deepEqual(
			knobs("2026-09-14T23:50").map((r) => r.knob.x),
			[193.6, 127],
		);
	});

	it("sets the knob 9 above the scale's top and the value 22.57 under it: 293 and 324.57 in the aerobic cell", () => {
		const scaleTop = 206 + D.header + D.cellTop + D.title + D.scaleTop;
		near(scaleTop, 302, 0.001, "scale");
		near(scaleTop + D.knobTop, 293, 0.001, "knob");
		near(scaleTop + D.valueTop, 324.57, 0.001, "value");
		near(435 + D.header + D.cellTop + D.title + D.scaleTop, 531, 0.001, "anaerobic scale");
	});

	it("draws a pane's scale 716 wide in its 748 pt cell: segments 135.73, the knobs at 660.4 and 44.64 (686:119887, 686:119894)", () => {
		const v = detail("2026-10-11T08:21");
		const [aerobic, anaerobic] = v.scales.map((s) => teScaleRow(s, PANE_COLUMN));
		assert.deepEqual(
			aerobic!.segments.map((s) => [s.x, s.width]),
			[
				[16, 135.73],
				[157.73, 135.73],
				[299.47, 135.73],
				[441.2, 135.73],
				[582.94, 135.73],
				[724.67, 7.33],
			],
		);
		assert.deepEqual([aerobic!.knob.x, anaerobic!.knob.x], [660.4, 44.64]);
		near(aerobic!.knob.x - D.knob / 2, 646.4, 0.001, "aerobic knob");
		near(anaerobic!.value.x - 20, 24.64, 0.001, "anaerobic value");
	});

	it("lays a pane's sections at 76, 253.67 and 498.67 in the 748 column and the related one at (788, 76)", () => {
		const top = 44 + D.paneTop;
		const aerobic = top + D.header + benefitCell(3) + D.paneGap;
		const anaerobic = aerobic + D.header + scaleCell(3) + D.paneGap;
		near(top, 76, 0.001, "PRIMARY BENEFIT");
		near(aerobic, 253.67, 0.001, "AEROBIC");
		near(anaerobic, 498.67, 0.001, "ANAEROBIC");
		assert.equal(32 + PANE_COLUMN + D.paneColumnGap, 788);
		near(D.header + D.related, 133, 0.001, "related section");
	});

	it("places the related activity's disc, figure and three lines as the twin (683:282 …, 686:119937)", () => {
		assert.deepEqual([D.disc.left, D.disc.top, D.disc.size, D.disc.glyph], [16, 25.67, 40, 24]);
		// The figure is centred in the disc: 24 pt at (24, 33.67).
		assert.deepEqual([D.disc.left + (D.disc.size - D.disc.glyph) / 2, D.disc.top + (D.disc.size - D.disc.glyph) / 2], [24, 33.67]);
		assert.deepEqual([D.text.left, D.text.name, D.text.when, D.text.subtitle, D.related], [68.25, 15.68, 40.67, 58.34, 91.33]);
	});

	it("colours the disc by sport: a run's orange, a swim's blue, the rest neutral (Inferred)", () => {
		assert.deepEqual(discColour("running"), { fill: "var(--color-orange)", glyph: "var(--text-on-accent)" });
		assert.deepEqual(discColour("swimming"), { fill: "var(--color-blue)", glyph: "var(--text-on-accent)" });
		assert.deepEqual(discColour("cycling"), { fill: "var(--background-modifier-border)", glyph: "var(--text-muted)" });
	});
});
