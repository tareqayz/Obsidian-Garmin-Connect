import type { CssChart, CssRange } from "./critical-swim-speed-pages";
import { r2 } from "./stat-charts";

/**
 * The Critical Swim Speed charts' geometry, measured off the Obsidian twin
 * (Figma page 430:6122: phones 800:53 (7d), 800:158 (12w), 800:291 (1y) and
 * the Inferred 800:467 (12w with results); the 12w pane 802:480; the local
 * Y Axis 799:20, X Axis 799:54 and Chart Dot 799:18).
 *
 * A chart's box starts at the Y Axis' top — page y 244 on the phone, (32,
 * 200.71) in a pane's 748 pt column — and is 254 pt tall on every range, so
 * the results table follows 51.67 under it wherever the axis' labels end.
 * Its insets don't change with its width: one frame per range serves the
 * phone's 402 and the pane's 748, the plot stretching between them.
 *
 * - Five gridlines, 1 pt, evenly between the top and the bottom one's
 *   centres: 20.83 → 199.17 on 7d (44.585 apart; the twin's, measured off
 *   the phone, are within 0.17), 19.5 → 185.5 on 12w and 1y (41.5 apart);
 *   from x 41 to 25 (7d), 29.33 (12w) or 32.33 (1y) short of the box's
 *   right edge.
 * - The y labels (Caption 11) right-aligned on 33.5, each centred 0.5 above
 *   its gridline's centre (the twin's lie 0.39 to 0.73 above).
 * - The plot runs from the period's first day at x 48.83 to its last 32.83
 *   short of the right edge: 369.17 on the phone, 715.17 in the pane.
 * - The date axis: 7d a dot a day centred 227 (Ø 4, the ends Ø 8) with
 *   "MM-DD" under the ends, centred 239.37; 12w and 1y Ø 8 dots centred 209
 *   and their labels on end, centred 231.6, 1.13 (12w) or 0.96 (1y) left of
 *   each dot.
 * - "No Critical Swim Speed data" in a 16 pt box 100.41 down, inset 16 from
 *   both sides; on 7d the middle gridline crosses it, as on the phone.
 * - Results (Inferred): Ø 8 dots joined by a 1 pt line.
 *
 * Pure.
 */

/** One range's box, measured off its twin: the y values are the box's, from the Y Axis' top. */
export interface CssChartFrame {
	/** The top and the bottom gridline's centres. */
	top: number;
	baseline: number;
	/** The gridlines' right end, short of the box's right edge. */
	gridInset: number;
	/** The date axis: its dots' centre, and its labels'. */
	dotY: number;
	labelY: number;
	/** The labels stand on end, reading upwards (12w, 1y), this far left of their dots. */
	rotated: boolean;
	labelShift: number;
}

export const CSS_FRAMES: Readonly<Record<CssRange, CssChartFrame>> = {
	"7d": { top: 20.83, baseline: 199.17, gridInset: 25, dotY: 227, labelY: 239.37, rotated: false, labelShift: 0 },
	"12w": { top: 19.5, baseline: 185.5, gridInset: 29.33, dotY: 209, labelY: 231.6, rotated: true, labelShift: 1.13 },
	"1y": { top: 19.5, baseline: 185.5, gridInset: 32.33, dotY: 209, labelY: 231.6, rotated: true, labelShift: 0.96 },
};

/** What every range's box shares. */
export const CSS_BOX = {
	/** Down to the foot of the date axis' area, 12w's and 1y's labels on end included. */
	height: 254,
	/** The plot's first day; its last is `plotInset` short of the box's right edge. */
	plotLeft: 48.83,
	plotInset: 32.83,
	/** The gridlines' left end. */
	gridLeft: 41,
	/** The y labels' right edge, and how far above its gridline's centre each label's centre sits. */
	labelRight: 33.5,
	labelLift: 0.5,
	/** The empty line's 16 pt box, inset from both sides. */
	emptyTop: 100.41,
	emptyHeight: 16,
	emptyInset: 16,
	/** The date axis' dots: the days between the ends on 7d, and the rest. */
	dot: { small: 2, large: 4 },
	/** A result's dot (the twin's Chart Dot, Ø 8). */
	pointRadius: 4,
} as const;

export interface CssPlot {
	width: number;
	height: number;
	/** Top first. */
	grid: Array<{ y: number; x1: number; x2: number }>;
	/** The y labels, top first, each beside its gridline. */
	ticks: Array<{ y: number; text: string }>;
	labelRight: number;
	/** The date axis. */
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	/** The results, oldest first. */
	points: Array<{ x: number; y: number }>;
	/** The points joined straight, in order; empty for fewer than two. */
	line: string;
	pointRadius: number;
	/** The empty line's box. */
	empty: { top: number; height: number; left: number; right: number };
}

/**
 * A range's chart at `width`: its box laid out by the range's frame. The
 * frame is drawn with or without a result; a pace is placed on the chart's
 * own axis, the fastest at the top, clamped to its ends.
 */
export function cssPlot(chart: CssChart, range: CssRange, width: number): CssPlot {
	const f = CSS_FRAMES[range];
	const b = CSS_BOX;
	const right = Math.max(b.plotLeft + 60, width - b.plotInset);
	const x = (fraction: number) => r2(b.plotLeft + fraction * (right - b.plotLeft));
	const ticks = chart.y.ticks;
	const first = ticks[0];
	const last = ticks[ticks.length - 1];
	const step = (f.baseline - f.top) / Math.max(1, ticks.length - 1);
	const lo = Math.min(first, last);
	const hi = Math.max(first, last);
	const y = (pace: number) => f.top + ((Math.min(hi, Math.max(lo, pace)) - first) / (last - first || 1)) * (f.baseline - f.top);
	const gridRight = r2(Math.max(b.gridLeft + 60, width - f.gridInset));
	const points = chart.points.map((p) => ({ x: x(p.x), y: r2(y(p.pace)) }));
	return {
		width,
		height: b.height,
		grid: ticks.map((_, i) => ({ y: r2(f.top + i * step), x1: b.gridLeft, x2: gridRight })),
		ticks: chart.y.labels.map((text, i) => ({ y: r2(f.top + i * step - b.labelLift), text })),
		labelRight: b.labelRight,
		dots: chart.axis.dots.map((d) => ({ x: x(d.x), y: f.dotY, r: d.large ? b.dot.large : b.dot.small })),
		labels: chart.axis.labels.map((l) => ({ x: r2(x(l.x) - (f.rotated ? f.labelShift : 0)), y: f.labelY, text: l.text, rotated: f.rotated })),
		points,
		line: points.length > 1 ? points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "",
		pointRadius: b.pointRadius,
		empty: { top: b.emptyTop, height: b.emptyHeight, left: b.emptyInset, right: r2(width - b.emptyInset) },
	};
}
