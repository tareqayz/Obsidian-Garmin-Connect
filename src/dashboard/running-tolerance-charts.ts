import { pillPath } from "./endurance-score-charts";
import type { ToleranceChart, ToleranceLegendItem, ToleranceRing, ToleranceTone } from "./running-tolerance-pages";
import { linePath, r2 } from "./stat-charts";

/**
 * The Running Tolerance page's geometry, measured off the Obsidian twin
 * (Figma page 430:6124: phones 695:22 Current, 695:103 12w, 695:643 12w with
 * Actual Distance, 695:897 1y, 697:483 1y with Actual Distance; Inferred
 * 697:770 / 697:1000 previous periods, 697:1250 over the tolerance, 697:1546
 * and 697:1580 without data; panes 700:1865, 701:1890, 702:2111; components
 * 692:2 — Bar 692:20, Distance Dot 692:27, Axis Dot 692:29, X Axis 12w
 * 692:34, Month Tick 692:49, Y Axis 692:52, Legend Item 692:97, Week Block
 * 692:123, Figure 692:139).
 *
 * The chart's box sits 19.51 under "Weekly Totals" and is 250 tall with the
 * phone's two-row legend under it. A one-row legend (the chip on, or no week
 * at the line) gives the plot its row: the zero line and the axis 21.33
 * lower, the top line as the twin has it (0.58 higher on 12w, 0.5 lower on
 * 1y, as the shots measured). A pane keeps the two-row box whatever the
 * legend, which stands beside the chart.
 *
 * Across, a slot per week: 12w's first centre at 40.5 and its last 31.5 short
 * of the box's edge (40.5 + 30k on the phone), 1y's at 34.5 and 23.5 short
 * (34.5 + 6.745k); a pane stretches the slots and keeps the bars' widths. The
 * gridlines run 0.17 inside the end slots' centres. Values go to y on the
 * gridlines' centres; a bar runs from its value to 0.17 under the zero
 * line's centre, its top a pill.
 *
 * Pure.
 */

/** Each mark's colour, as the twin binds it. */
export const TOLERANCE_COLORS = {
	/** A week's bar, under the line. */
	load: "var(--color-blue)",
	/** At or over the tolerance: the bar, and the ring (Inferred, 697:1250). */
	above: "var(--color-orange)",
	/** Every bar with the Actual Distance chip on; the Impact Load key then. */
	muted: "var(--background-modifier-border)",
	/** The Actual Distance line and its dots (Garmin's #15AABF). */
	distance: "var(--color-cyan)",
	/** The tolerance line (Garmin's white). */
	tolerance: "var(--text-normal)",
} as const;

/** A bar's colour. */
export function barColor(tone: ToleranceTone): string {
	return TOLERANCE_COLORS[tone];
}

/** The ring's fill: blue under the tolerance, orange at or over it (Inferred, like the bars). */
export function ringColor(ring: Pick<ToleranceRing, "share">): string {
	return ring.share >= 1 ? TOLERANCE_COLORS.above : TOLERANCE_COLORS.load;
}

/* ------------------------------------------------------------------ */
/*  The chart                                                          */
/* ------------------------------------------------------------------ */

/** A range's marks across the box: the slots, the gridlines, the y labels and a bar's width. */
export interface ToleranceAcross {
	/** The first slot's centre. */
	first: number;
	/** The last slot's centre, short of the box's right edge. */
	lastInset: number;
	/** The gridlines' ends: from `gridLeft` to `gridInset` short of the right edge (Y Axis 692:52). */
	gridLeft: number;
	gridInset: number;
	/** The y labels' right edge. */
	labelRight: number;
	/** Bar 692:20: 9.67 on 12w, 5 on 1y. */
	barWidth: number;
}

export const TOLERANCE_ACROSS: Readonly<Record<"12w" | "1y", ToleranceAcross>> = {
	"12w": { first: 40.5, lastInset: 31.5, gridLeft: 40.67, gridInset: 31.67, labelRight: 23.2, barWidth: 9.67 },
	"1y": { first: 34.5, lastInset: 23.5, gridLeft: 34.67, gridInset: 23.67, labelRight: 25.2, barWidth: 5 },
};

/** The box down: the top and zero gridlines (each line's top edge), the axis' dots and labels, the box's height. */
export interface ToleranceDown {
	gridTop: number;
	gridBottom: number;
	/** The axis dots' centre: 12w's dot a week, 1y's month ticks. */
	dotY: number;
	/** The axis labels' centre: 12w's "MM-DD", 1y's month on end. */
	labelY: number;
	height: number;
}

/**
 * By range, for a legend of one row (first) and of two: 695:643 / 695:109 on
 * 12w (gridlines 52.06 / 46.67 apart), 697:483 / 695:903 on 1y (44.63 /
 * 39.44 apart).
 */
export const TOLERANCE_DOWN: Readonly<Record<"12w" | "1y", readonly [ToleranceDown, ToleranceDown]>> = {
	"12w": [
		{ gridTop: 16.75, gridBottom: 225, dotY: 241, labelY: 253.7, height: 271.33 },
		{ gridTop: 17.33, gridBottom: 204, dotY: 219.67, labelY: 232.37, height: 250 },
	],
	"1y": [
		{ gridTop: 26.83, gridBottom: 205.33, dotY: 218, labelY: 240.6, height: 271.33 },
		{ gridTop: 26.33, gridBottom: 184.08, dotY: 196.67, labelY: 219.27, height: 250 },
	],
};

/** A gridline's stroke, and how far a bar runs under the zero line's centre. */
export const GRID_LINE = 1;
export const BAR_FOOT = 0.17;

/** Axis Dot 692:29: Ø8 at 12w's ends and under 1y's months, Ø4 between. Distance Dot 692:27: Ø8. */
export const AXIS_DOT = { large: 4, small: 2 } as const;
export const DISTANCE_DOT = 4;

/** Both lines are 2 pt. */
export const LINE_WIDTH = 2;

/** Month Tick 692:49: its upright name 0.8 left of the dot's centre. */
export const MONTH_LABEL_SHIFT = -0.8;

/** The box for a legend of `rows` rows under it: one row, or two and more; a pane passes 2. */
export function toleranceDown(range: "12w" | "1y", rows: number): ToleranceDown {
	return TOLERANCE_DOWN[range][rows <= 1 ? 0 : 1];
}

export interface TolerancePlot {
	width: number;
	height: number;
	labelRight: number;
	/** Top first: each gridline's centre and its label. */
	grid: Array<{ y: number; x1: number; x2: number; label: string }>;
	/** Each bar: its centre, top and foot, its pill-topped outline and colour. */
	bars: Array<{ week: string; x: number; top: number; foot: number; d: string; color: string }>;
	/** The tolerance line: a subpath a run. */
	tolerance: string;
	/** The Actual Distance line, broken at 0 km weeks and empty slots; "" with the chip off. */
	distance: string;
	/** Its dots: 12w's, with the chip on. */
	distanceDots: Array<{ x: number; y: number }>;
	/** The axis' dots. */
	dots: Array<{ x: number; y: number; r: number }>;
	/** Centred on (x, y); a rotated one reads upwards. */
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
}

/**
 * The chart at `width` (402 on the phone, the pane's 748 column), its box for
 * a legend of `rows` rows: the gridlines with their ticks, the bars, the
 * tolerance line as the view runs it (steps on 12w, a polyline on 1y), the
 * Actual Distance line and dots when the chip is on, and the axis.
 */
export function tolerancePlot(chart: ToleranceChart, range: "12w" | "1y", width: number, rows: number): TolerancePlot {
	const across = TOLERANCE_ACROSS[range];
	const down = toleranceDown(range, rows);
	const last = Math.max(across.first + 60, width - across.lastInset);
	const x = (fraction: number) => across.first + fraction * (last - across.first);
	const top = down.gridTop + GRID_LINE / 2;
	const zero = down.gridBottom + GRID_LINE / 2;
	const lo = Math.min(...chart.ticks);
	const hi = Math.max(...chart.ticks);
	const y = (value: number) => zero - ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo || 1)) * (zero - top);
	const n = chart.ticks.length;
	const path = (points: ReadonlyArray<{ x: number; value: number }>) => points.map((p, i) => `${i ? "L" : "M"}${r2(x(p.x))} ${r2(y(p.value))}`).join("");
	const distance = chart.distance;
	return {
		width,
		height: down.height,
		labelRight: across.labelRight,
		grid: chart.ticks.map((_, i) => ({
			y: r2(top + (n > 1 ? (i * (zero - top)) / (n - 1) : 0)),
			x1: across.gridLeft,
			x2: r2(Math.max(across.gridLeft + 60, width - across.gridInset)),
			label: chart.labels[i] ?? String(chart.ticks[i]),
		})),
		bars: chart.bars.map((bar) => {
			const cx = x(bar.x);
			const yTop = y(bar.value);
			return {
				week: bar.week,
				x: r2(cx),
				top: r2(yTop),
				foot: r2(zero + BAR_FOOT),
				d: pillPath(cx - across.barWidth / 2, yTop, across.barWidth, zero + BAR_FOOT - yTop, across.barWidth / 2),
				color: barColor(bar.tone),
			};
		}),
		tolerance: chart.tolerance.runs.filter((run) => run.length > 1).map(path).join(""),
		distance: distance ? linePath(distance.points.map((p) => [x(p.x), p.value === null ? null : y(p.value)])) : "",
		distanceDots: distance?.dots ? distance.points.flatMap((p) => (p.value === null ? [] : [{ x: r2(x(p.x)), y: r2(y(p.value)) }])) : [],
		dots: chart.axis.dots.map((d) => ({ x: r2(x(d.x)), y: down.dotY, r: d.large ? AXIS_DOT.large : AXIS_DOT.small })),
		labels: chart.axis.labels.map((l) => ({
			x: r2(x(l.x) + (l.rotated ? MONTH_LABEL_SHIFT : 0)),
			y: down.labelY,
			text: l.text,
			rotated: l.rotated === true,
		})),
	};
}

/* ------------------------------------------------------------------ */
/*  The legend                                                         */
/* ------------------------------------------------------------------ */

/**
 * Legend Item 692:97: a 12 pt marker 5.33 before its name in Caption
 * (11/14); items 16 apart, rows 14 tall and 21.33 apart. The tolerance's
 * marker is a 12 × 2 line; the loads' a Ø 12 dot; 12w's Actual Distance a
 * 12 × 2 line through a Ø 6 dot, 1y's the line alone.
 */
export const LEGEND = { marker: 12, gap: 5.33, itemGap: 16, row: 14, pitch: 21.33, line: 2, lineDot: 3 } as const;

/** A legend item's marker colour. */
export function legendColor(item: Pick<ToleranceLegendItem, "tone">): string {
	return TOLERANCE_COLORS[item.tone];
}

/* ------------------------------------------------------------------ */
/*  The pages                                                          */
/* ------------------------------------------------------------------ */

/**
 * Current, on the phone (695:22) from the header's foot (y 165): the ring's
 * 196 box 7.12 over it (157.88: its centre at 255.88, the no-data line
 * centred there too), the title 36.61 under the box (Nav Title 17/22), the
 * copy 15.39 under the title (Body 15 on a 22 pt line, tracking −0.3), the
 * figures 23.45 under the copy: Figure 692:139, 177 wide, 16 apart, rows 67
 * apart (rules at 517.33 and 584.33). In a pane (700:1865) the ring's box is
 * 18 under the header's rule, centred in the 748 column, and the title 27.19
 * under the rule in the 370 one, the copy and the figures under it as on the
 * phone.
 */
export const CURRENT_LAYOUT = {
	ringTop: -7.12,
	ringTopPane: 18,
	titleGap: 36.61,
	titleTopPane: 27.19,
	copyGap: 15.39,
	copyLine: 22,
	figuresGap: 23.45,
	figureWidth: 177,
	figureColumnGap: 16,
	figurePitch: 67,
} as const;

/**
 * 12w and 1y on the phone (695:103) from the header's foot: "Weekly Totals"
 * (Value M 17/22) 17.49 under it at x 16, the chart's box 19.51 under the
 * title (y 224), the legend 5.33 under the box, centred (479.33 / 500.67),
 * the chip 15.66 under the legend at x 15 (530.33), the week blocks 16 under
 * the chip (582.33), and 34 under the last. In a pane (701:1890, 702:2111)
 * the title 32 under the header's rule at x 16 in the 748 column, the chart
 * as on the phone, the legend in the 370 column from its left edge, its
 * first row 2.99 over the top gridline's line, the chip 16 under it, and the
 * blocks 30 under the chart: 370 wide, three a row 8 apart and 16 between
 * rows, from y 469.51.
 */
export const PERIOD_LAYOUT = {
	titleTop: 17.49,
	titleTopPane: 32,
	chartGap: 19.51,
	legendGap: 5.33,
	chipGap: 15.66,
	chipGapPane: 16,
	blocksGap: 16,
	blocksGapPane: 30,
	bottom: 34,
	legendOverGrid: 2.99,
} as const;

/** The pane's legend top, from the chart's box top: 2.99 over the top gridline (14.34 on 12w, 23.34 on 1y). */
export function paneLegendTop(range: "12w" | "1y"): number {
	return r2(toleranceDown(range, 2).gridTop - PERIOD_LAYOUT.legendOverGrid);
}

/**
 * Week Block 692:123: a 25.67 band with the week in Group Label (13/16) at
 * x 16, 4.61 down, then three rows 47, 47 and 46 tall under 1 pt rules, the
 * label (List Item 17/22) and the value (Nav Title, right at 16 in) 11.82
 * down each; a rule at the foot. All on `--background-secondary`, the rules
 * `--background-modifier-border`. 169.67 tall; a pane's block drops its foot
 * rule and rounds its corners.
 */
export const WEEK_BLOCK = { band: 25.67, rows: [47, 47, 46], rule: 1, height: 169.67, headerTop: 4.61, rowText: 11.82 } as const;
