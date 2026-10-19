import { yFraction, type LtChart, type LtChipId, type LtLine, type LtRange, type LtSeriesId, type LtShape, type LtYAxis } from "./running-lactate-threshold-pages";
import { r2 } from "./stat-charts";

/**
 * The Running Lactate Threshold chart's geometry, measured off the Obsidian
 * twin (Figma page 430:6126: phones 755:154 / 755:344 / 755:536 (4w Pace /
 * Power / W/kg), 755:728 / 755:938 / 755:1153 (12w), 755:1368 / 755:1648 /
 * 755:1928 (1y), the Inferred 755:2208 (12w −1) and 755:2418 (4w empty);
 * panes 758:1092 (12w Pace) and 758:1230 (1y Power); the local Y Axes
 * 754:607, X Axis 754:704 and Chart Marker 754:543). The twin is the phone's
 * shots, 56 pt higher.
 *
 * A chart's box starts at the foot of its "Heart Rate" title (y 196.86 on
 * the phone, 171 in a pane) and runs down to the legend on a phone (y
 * 500.67), to the x axis' foot in a pane, whose legend and chips stand beside
 * the chart. The left side keeps its insets at any width and the right side
 * keeps its own from the box's right edge, so the plot stretches between
 * them: one frame a range serves the phone's 402 and a pane's 748 pt column.
 *
 * - Five 1 pt gridlines, linear from the top one to the bottom one: 4w
 *   49.33 apart from 50.81 in the box (y 247.67 on the phone), 12w and 1y
 *   46.25 apart from 49.47 (246.33 – 431.33).
 * - Heart rate's labels on the left, right-aligned at 27.12 when every one is
 *   a narrow "1xx" (4w's 195 … 175) and at 29.78 otherwise (12w's 200 …
 *   180), the gridlines starting 15.88 / 15.22 pt to their right, at 43 or
 *   45. The chip's labels on the right, left-aligned 14.88 past the
 *   gridlines' end. Each label is centred half a point above its line.
 * - The right column is as wide as its widest label, so the gridlines end
 *   short of the box's edge by the twin's inset for the range and chip —
 *   Pace 49 (4w) / 48, Power 45, W/kg 36 for "10" (4w) / 31 for one digit —
 *   moved 5 pt a character the widest label has more or fewer (W/kg's "9"
 *   on 4w ends at 371 as 12w's does).
 * - The plot runs from 7.33 pt inside the gridlines' start (the period's
 *   first day) to 7.67 pt inside their end (its last), linear in days; 1y's
 *   first axis dot (today − 12 months) falls left of it.
 * - The x axis: 4w a Ø 3.67 dot a day, the ends Ø 7.67, centred 277.97 down,
 *   "MM-DD" under the ends centred 291.11 down; 12w and 1y Ø 7.67 dots
 *   centred 259.97 down and their labels on end, reading upwards, centred
 *   282.64 down and half a point left of their dot. Axis 10/12.
 * - The series: a 1.67 pt line through a series' points, then its markers,
 *   heart rate under the chip's series: circle Ø 8, square 8, triangle
 *   7 × 5.67 apex up with its centroid on the value, diamond 7.33 across.
 * - A period where neither series has a point keeps the box, its no-data
 *   line centred halfway down the gridlines (755:2418), so the legend and
 *   the chips stay put.
 *
 * Pure.
 */

/** One range's box, from the title's foot. */
export interface LtFrame {
	/** The top and the bottom gridline's centres. */
	top: number;
	baseline: number;
	/** The x axis' dots' centre, and its labels' centre. */
	dotY: number;
	labelY: number;
	/** The labels stand on end, reading upwards (12w, 1y). */
	rotated: boolean;
	/** On a phone the box runs down to the legend. */
	height: number;
	/** In a pane it ends at the x axis' foot, the legend and chips standing beside it. */
	paneHeight: number;
}

export const LT_FRAMES: Readonly<Record<LtRange, LtFrame>> = {
	// 755:154: the y axes at 237.67, gridlines 247.67 + 49.33k; the x axis at 469 (dots 474.83, labels 487.97); the legend at 500.67.
	"4w": { top: 50.81, baseline: 248.13, dotY: 277.97, labelY: 291.11, rotated: false, height: 303.81, paneHeight: 297.14 },
	// 755:728: the y axes at 236.33, gridlines 246.33 → 431.33; the x axis at 449 (dots 456.83, labels on end centred 479.5).
	"12w": { top: 49.47, baseline: 234.47, dotY: 259.97, labelY: 282.64, rotated: true, height: 303.81, paneHeight: 302.14 },
	// 755:1648: as 12w.
	"1y": { top: 49.47, baseline: 234.47, dotY: 259.97, labelY: 282.64, rotated: true, height: 303.81, paneHeight: 302.14 },
};

/** The title's foot, where the box starts, on the 402 pt phone twin (y 174.86 + 22) and in a pane (149 + 22). */
export const PHONE_BOX_TOP = 196.86;
export const PANE_BOX_TOP = 171;

/**
 * The heart rate side: where its labels end and the gridlines start, by
 * whether every label is a narrow "1xx" (4w's 195 … 175: 27.12 and 43) or
 * not (12w's and 1y's 200 … 180: 29.78 and 45).
 */
export const LEFT_SIDE = {
	narrow: { labelRight: 27.12, gridLeft: 43 },
	wide: { labelRight: 29.78, gridLeft: 45 },
} as const;

/**
 * The gridlines' end, short of the box's right edge, by range and chip, as
 * the twin draws it with its own labels (`INSET_LABELS`): Pace 353 / 354,
 * Power 357, W/kg 366 for "10" and 371 for "9", on the phone.
 */
export const GRID_INSET: Readonly<Record<LtRange, Readonly<Record<LtChipId, number>>>> = {
	"4w": { pace: 49, power: 45, wkg: 36 },
	"12w": { pace: 48, power: 45, wkg: 31 },
	"1y": { pace: 48, power: 45, wkg: 31 },
};

/** The widest right label each inset was measured with: "4:45", "370", "10" on 4w; "4:45" / "4:40", "365" / "420", "9" on 12w and 1y. */
export const INSET_LABELS: Readonly<Record<LtRange, Readonly<Record<LtChipId, string>>>> = {
	"4w": { pace: "4:45", power: "370", wkg: "10" },
	"12w": { pace: "4:45", power: "365", wkg: "9" },
	"1y": { pace: "4:40", power: "420", wkg: "9" },
};

/** A character more in the widest right label moves the gridlines' end this far left: W/kg's "10" ends at 366, "9" at 371. */
export const LABEL_CHAR = 5;
/** The right labels start this far past the gridlines' end. */
export const RIGHT_LABEL_GAP = 14.88;
/** The plot's first day sits this far inside the gridlines' start, its last this far inside their end. */
export const PLOT_START = 7.33;
export const PLOT_END = 7.67;
/** A label sits this far above its gridline's centre. */
export const LABEL_LIFT = 0.5;
/** The x axis' dots, radius: a day's on 4w, an end's and every 12w or 1y one. */
export const AXIS_DOT = { small: 1.835, large: 3.835 } as const;
/** 12w's and 1y's labels on end sit this far left of their dot. */
export const ROTATED_SHIFT = 0.5;
/** The series' lines. */
export const LINE_WIDTH = 1.67;

/**
 * The Chart Marker's shapes (754:543), centred on the value: a circle Ø 8, a
 * square 8, a diamond 7.33 across, and a triangle 7 wide and 5.67 tall,
 * apex up, its centroid on the value (3.78 above it, 1.89 below).
 */
export const MARKER = { circle: 4, square: 8, diamond: 7.33, triangle: { width: 7, height: 5.67 } } as const;

/** A series' marker as a path, centred on (x, y). */
export function markerPath(shape: LtShape, x: number, y: number): string {
	switch (shape) {
		case "circle": {
			const r = MARKER.circle;
			return `M${r2(x - r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x + r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x - r)} ${r2(y)}Z`;
		}
		case "square": {
			const h = MARKER.square / 2;
			return `M${r2(x - h)} ${r2(y - h)}H${r2(x + h)}V${r2(y + h)}H${r2(x - h)}Z`;
		}
		case "diamond": {
			const h = MARKER.diamond / 2;
			return `M${r2(x)} ${r2(y - h)}L${r2(x + h)} ${r2(y)}L${r2(x)} ${r2(y + h)}L${r2(x - h)} ${r2(y)}Z`;
		}
		case "triangle": {
			const { width, height } = MARKER.triangle;
			return `M${r2(x)} ${r2(y - (height * 2) / 3)}L${r2(x + width / 2)} ${r2(y + height / 3)}H${r2(x - width / 2)}Z`;
		}
	}
}

/** The heart rate side for its labels: narrow when every one starts with a "1"; a side without labels keeps the range's twin value. */
export function leftSide(labels: readonly string[] | undefined, range: LtRange): { labelRight: number; gridLeft: number } {
	if (!labels?.length) return range === "4w" ? LEFT_SIDE.narrow : LEFT_SIDE.wide;
	return labels.every((l) => l.startsWith("1")) ? LEFT_SIDE.narrow : LEFT_SIDE.wide;
}

/** The gridlines' end's inset from the box's right edge: the twin's for the range and chip, moved by the widest label's characters. */
export function gridInset(range: LtRange, chip: LtChipId, labels: readonly string[] | undefined): number {
	const base = GRID_INSET[range][chip];
	if (!labels?.length) return base;
	const widest = Math.max(...labels.map((l) => l.length));
	return base + LABEL_CHAR * (widest - INSET_LABELS[range][chip].length);
}

/** A series as the chart draws it. */
export interface LtPlotSeries {
	id: LtSeriesId;
	shape: LtShape;
	/** Its points joined straight, in order; empty for fewer than two. */
	line: string;
	/** A marker on every point. */
	markers: Array<{ x: number; y: number; d: string }>;
}

/** A chart at a width. */
export interface LtPlot {
	width: number;
	height: number;
	/** The plot's first and last day. */
	left: number;
	right: number;
	/** Top first. */
	grid: Array<{ y: number; x1: number; x2: number }>;
	/** Heart rate's labels, right-aligned on `x`, top first; none when it has no point. */
	leftLabels: { x: number; ticks: Array<{ y: number; text: string }> };
	/** The chip's labels, left-aligned on `x`, top first; none when it has no point. */
	rightLabels: { x: number; ticks: Array<{ y: number; text: string }> };
	/** The x axis. */
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	/** Heart rate, then the chip's series, in drawing order. */
	series: LtPlotSeries[];
	/** Halfway down the gridlines: where the no-data line is centred. */
	middle: number;
}

function ticksOf(axis: LtYAxis | null, y: (fraction: number) => number): Array<{ y: number; text: string }> {
	if (!axis) return [];
	return axis.ticks.map((value, i) => ({ y: r2(y(yFraction(axis, value)) - LABEL_LIFT), text: axis.labels[i] }));
}

function seriesOf(line: LtLine, x: (fraction: number) => number, y: (fraction: number) => number): LtPlotSeries {
	const at = line.y ? line.points.map((p) => ({ x: r2(x(p.x)), y: r2(y(yFraction(line.y!, p.value))) })) : [];
	return {
		id: line.id,
		shape: line.shape,
		line: at.length > 1 ? at.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "",
		markers: at.map((p) => ({ x: p.x, y: p.y, d: markerPath(line.shape, p.x, p.y) })),
	};
}

/**
 * A range's chart at `width`: the box laid out by the range's frame, the
 * heart rate side by its labels and the right side by the chip and its
 * labels. On a phone the box runs down to the legend, in a pane to the x
 * axis' foot. A period without a point is the bare box, `middle` for its
 * no-data line.
 */
export function ltPlot(chart: LtChart | null, range: LtRange, width: number, pane = false): LtPlot {
	const frame = LT_FRAMES[range];
	const plot: LtPlot = {
		width,
		height: pane ? frame.paneHeight : frame.height,
		left: 0,
		right: 0,
		grid: [],
		leftLabels: { x: 0, ticks: [] },
		rightLabels: { x: 0, ticks: [] },
		dots: [],
		labels: [],
		series: [],
		middle: r2((frame.top + frame.baseline) / 2),
	};
	if (!chart) return plot;
	const side = leftSide(chart.left.y?.labels, range);
	const chip = chart.right.id as LtChipId;
	const gridRight = Math.max(side.gridLeft + 60, width - gridInset(range, chip, chart.right.y?.labels));
	const left = side.gridLeft + PLOT_START;
	const right = gridRight - PLOT_END;
	const x = (fraction: number) => left + fraction * (right - left);
	const y = (fraction: number) => frame.top + fraction * (frame.baseline - frame.top);
	plot.left = r2(left);
	plot.right = r2(right);
	plot.grid = [0, 1, 2, 3, 4].map((k) => ({ y: r2(y(k / 4)), x1: side.gridLeft, x2: r2(gridRight) }));
	plot.leftLabels = { x: side.labelRight, ticks: ticksOf(chart.left.y, y) };
	plot.rightLabels = { x: r2(gridRight + RIGHT_LABEL_GAP), ticks: ticksOf(chart.right.y, y) };
	plot.dots = chart.axis.dots.map((d) => ({ x: r2(x(d.x)), y: frame.dotY, r: d.large ? AXIS_DOT.large : AXIS_DOT.small }));
	plot.labels = chart.axis.labels.map((l) => ({
		x: r2(x(l.x) - (frame.rotated ? ROTATED_SHIFT : 0)),
		y: frame.labelY,
		text: l.text,
		rotated: frame.rotated,
	}));
	plot.series = [seriesOf(chart.left, x, y), seriesOf(chart.right, x, y)];
	return plot;
}
