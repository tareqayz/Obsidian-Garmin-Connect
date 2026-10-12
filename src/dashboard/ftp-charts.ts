import type { FtpChart, FtpUnit } from "./ftp-pages";
import { r2 } from "./stat-charts";

/**
 * The FTP charts' geometry, measured off the Obsidian twin (Figma page
 * 430:6120: phones 727:178 / 727:342 (4w), 727:502 / 727:652 (12w),
 * 727:800 / 727:957 (1y), 727:1112 (Cross Country Skiing 1y), the Inferred
 * 728:732 (1y −1, labels on the gridlines) and 728:885 (Cross Country Skiing
 * 4w); the 12w panes 730:1988 / 730:2104; the local Y Axis 726:34, X Axis
 * 726:99 and Chart Dot 726:31).
 *
 * A chart's box starts at the Y Axis' top — 36.71 under the chart's title,
 * on the phone and in a pane alike — and runs to the foot of the date axis.
 * Its insets don't change with its width, so one frame per range serves the
 * phone's 402 and a pane's 748 pt column; the plot stretches between them.
 *
 * - Five gridlines, 1 pt, at the quarters of [lo, hi]: centres 15 → 223.33
 *   in the box on 4w, 13.67 → 209.67 on 12w and 1y; from x 40 on Watts or 37
 *   on W/kg to 25.33 (4w), 29.67 (12w) or 32.67 (1y) short of the box's right
 *   edge.
 * - The labels stand apart from the gridlines: each is centred 0.6 above its
 *   own value, right-aligned on 32 (Watts) or 29.67 (W/kg). On [100, 300]
 *   they happen to sit on the gridlines.
 * - The plot runs from the period's first day at x 48 (Watts) or 45 (W/kg)
 *   to its last 33.33 short of the right edge: 368.67 on the phone, 714.67 in
 *   the pane's column.
 * - The date axis: 4w a dot a day centred 254.17 (Ø 4, the ends Ø 8) and
 *   "MM-DD" under the ends, centred 267.34; 12w and 1y Ø 8 dots centred
 *   236.17 and their labels on end, centred 259, half a point left of each
 *   dot.
 * - The readings: Ø 8 dots joined by a 1 pt line.
 *
 * Pure.
 */

export type FtpRange = "4w" | "12w" | "1y";

/** One range's box, measured off its twin: the y values are the box's, from the Y Axis' top. */
export interface FtpChartFrame {
	/** The top and the bottom gridline's centres. */
	top: number;
	baseline: number;
	/** The gridlines' right end, short of the box's right edge. */
	gridInset: number;
	/** The date axis: its dots' centre, and its labels'. */
	dotY: number;
	labelY: number;
	/** The labels stand on end, reading upwards (12w, 1y). */
	rotated: boolean;
	/** Down to the date axis' foot. */
	height: number;
}

export const FTP_FRAMES: Readonly<Record<FtpRange, FtpChartFrame>> = {
	"4w": { top: 15, baseline: 223.33, gridInset: 25.33, dotY: 254.17, labelY: 267.34, rotated: false, height: 276 },
	"12w": { top: 13.67, baseline: 209.67, gridInset: 29.67, dotY: 236.17, labelY: 259, rotated: true, height: 282 },
	"1y": { top: 13.67, baseline: 209.67, gridInset: 32.67, dotY: 236.17, labelY: 259, rotated: true, height: 282 },
};

/** Where the plot, the gridlines and the labels start, by unit: W/kg's labels are a digit narrower. */
export const FTP_X: Readonly<Record<FtpUnit, { plot: number; grid: number; labelRight: number }>> = {
	watts: { plot: 48, grid: 40, labelRight: 32 },
	wkg: { plot: 45, grid: 37, labelRight: 29.67 },
};

/** The plot's last day, short of the box's right edge. */
export const PLOT_INSET = 33.33;
/** A y label's centre over its value. */
export const LABEL_LIFT = 0.6;
/** A label on end sits this much left of its dot. */
export const ROTATED_SHIFT = 0.49;
/** The readings' dots, and the date axis' small (a day) and large dots. */
export const POINT_RADIUS = 4;
export const AXIS_DOT = { small: 2, large: 4 } as const;

export interface FtpPlot {
	width: number;
	height: number;
	/** Top first. */
	grid: Array<{ y: number; x1: number; x2: number }>;
	/** The y labels, top first, each at its own value. */
	ticks: Array<{ y: number; text: string }>;
	labelRight: number;
	/** The date axis. */
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	points: Array<{ x: number; y: number }>;
	/** The points joined straight, in order; empty for fewer than two. */
	line: string;
	pointRadius: number;
	/** Halfway between the top and the bottom gridline: where the no-data line goes. */
	middle: number;
}

/**
 * A range's chart at `width`, its box laid out by the range's frame and the
 * unit's insets. A period without a row is the bare box, `middle` for its
 * no-data line.
 */
export function ftpPlot(chart: FtpChart | null, range: FtpRange, unit: FtpUnit, width: number): FtpPlot {
	const frame = FTP_FRAMES[range];
	const inset = FTP_X[unit];
	const right = Math.max(inset.plot + 60, width - PLOT_INSET);
	const plot: FtpPlot = {
		width,
		height: frame.height,
		grid: [],
		ticks: [],
		labelRight: inset.labelRight,
		dots: [],
		labels: [],
		points: [],
		line: "",
		pointRadius: POINT_RADIUS,
		middle: r2((frame.top + frame.baseline) / 2),
	};
	if (!chart) return plot;
	const { lo, hi } = chart.y;
	const x = (fraction: number) => r2(inset.plot + fraction * (right - inset.plot));
	const y = (value: number) => frame.baseline - ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo || 1)) * (frame.baseline - frame.top);
	const gridRight = r2(Math.max(inset.grid + 60, width - frame.gridInset));
	plot.grid = chart.y.grid.map((v) => ({ y: r2(y(v)), x1: inset.grid, x2: gridRight }));
	plot.ticks = chart.y.labels.map((l) => ({ y: r2(y(l.value) - LABEL_LIFT), text: l.text }));
	plot.dots = chart.axis.dots.map((d) => ({ x: x(d.x), y: frame.dotY, r: d.large ? AXIS_DOT.large : AXIS_DOT.small }));
	plot.labels = chart.axis.labels.map((l) => ({
		x: frame.rotated ? r2(x(l.x) - ROTATED_SHIFT) : x(l.x),
		y: frame.labelY,
		text: l.text,
		rotated: frame.rotated,
	}));
	plot.points = chart.points.map((p) => ({ x: x(p.x), y: r2(y(p.value)) }));
	plot.line = plot.points.length > 1 ? plot.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "";
	return plot;
}
