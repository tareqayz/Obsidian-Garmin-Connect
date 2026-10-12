import type { CurveVertex, CyclingPowerCurveView } from "./cycling-power-curve-pages";
import { r2 } from "./stat-charts";

/**
 * The Cycling Power Curve chart's geometry, measured off the Obsidian twin
 * (Figma page 430:6118: phones 780:131509 (4w), 780:131658 (3m) and
 * 780:131806 (1y), the Inferred 780:131957 (4w with rides), 780:132107
 * (4w −1), 780:132258 (1y −1) and 780:132411 (a 5-hour record); panes
 * 783:1986 (1y) and 783:2325 (4w); the Chart Axes component 779:28).
 *
 * The chart's box is 244 pt tall at any width: the phone's page y 240, a
 * pane's (32, 197.14) in its 748 pt column. A pane keeps the phone's insets,
 * so one frame serves both and the plot stretches between them.
 *
 * - The plot runs from x 50 to 21 short of the box's right edge (381 on the
 *   phone, 727 in a pane's column, page 759), the 15 durations in equal
 *   steps: x = 50 + i·span/14, 2 hr at 357.36 on the phone.
 * - Watts run up from 177.78 down the box (0) to 7.835 (the axis' top T):
 *   0.24278 pt a watt with T = 700, so y = 177.78 − 0.24278·W (page 417.78
 *   on the phone, 374.92 in a pane). The twin draws the curves in a clip
 *   box 177.67 tall; here the areas stand on its foot, so none is needed.
 * - Gridlines 0.33 pt from x 50 to the plot's end at every tick, the 0 line
 *   at 24 % and inside the clip box (centred 177.5), so the areas cover it;
 *   the labels (Axis 10) right-aligned to x 37.2, centred 0.33 above their
 *   lines.
 * - Under the plot: a Ø 8 dot centred 184.67 down at every duration; its
 *   label on end, centred 207.2 down and 0.8 left of the dot (the twin's
 *   text box, whose glyphs then sit on the dot); "Interval Length" (Caption
 *   11) centred 234.34 down, 153.5 / 331 of the way across the plot (203.5
 *   on the phone, 363.96 in a pane's column).
 * - The Record: an area from its first value to its last, straight down to
 *   the clip box's foot there, under a 2 pt line through its values. The
 *   period's line and area the same, drawn over it.
 *
 * Pure.
 */

/** The chart's box, in its own coordinates: y from its top, x from its left edge. */
export const POWER_FRAME = {
	height: 244,
	/** The plot's first duration and the gridlines' left end; both end `inset` short of the box's right edge. */
	left: 50,
	inset: 21,
	/** Where the axis' top and 0 W sit: a value is drawn `value / top` of the way between. */
	top: 7.835,
	zero: 177.78,
	/** The curves' clip box ends here: the areas' foot. */
	foot: 177.67,
	/** The gridlines' width, and the 0 line's centre: inside the clip box (the twin's 177.33–177.66), where y(0) is 177.78. */
	grid: 0.33,
	zeroLine: 177.5,
	/** The y labels' right edge, and how far above its line each label's centre sits. */
	labelRight: 37.2,
	labelLift: 0.33,
	/** The axis' dots: Ø 8, centred. */
	dotY: 184.67,
	dotR: 4,
	/** A duration's label on end: its centre, and how far left of its dot. */
	durationY: 207.2,
	durationShift: 0.8,
	/** "Interval Length": its centre, and where across the plot. */
	titleY: 234.34,
	titleAt: 153.5 / 331,
} as const;

/** A curve as drawn: its points, the line through them and the area under it. */
export interface PowerCurvePaths {
	/** Each duration with a value, left to right. */
	points: Array<{ x: number; y: number }>;
	/** Straight segments through the points; "" without one. A lone point is a zero-length segment, which a round cap draws as a dot. */
	line: string;
	/** The points, down to the clip box's foot at the last and back along it to the first; "" without one. */
	area: string;
}

/** The chart laid out at a width. */
export interface PowerPlot {
	width: number;
	height: number;
	/** The plot's first and last duration. */
	left: number;
	right: number;
	/** The clip box's foot. */
	foot: number;
	/** Top first: each tick's line (the 0 line faint) and its label's centre. */
	grid: Array<{ y: number; x1: number; x2: number; label: string; labelY: number; zero: boolean }>;
	labelRight: number;
	/** A dot at every duration. */
	dots: Array<{ x: number; y: number; r: number }>;
	/** Every duration's name, on end, reading bottom to top, centred on its point. */
	labels: Array<{ x: number; y: number; text: string }>;
	/** "Interval Length", centred on its point. */
	title: { x: number; y: number; text: string };
	/** The Record, drawn first, and the period's curve over it. */
	record: PowerCurvePaths;
	period: PowerCurvePaths;
}

/** What the chart draws of the page's view. */
export type PowerPlotInput = Pick<CyclingPowerCurveView, "top" | "ticks" | "axis" | "axisTitle" | "record" | "period">;

/** A curve's points, line and area, given where its points go. */
function curvePaths(vertices: readonly CurveVertex[], place: (v: CurveVertex) => { x: number; y: number }, foot: number): PowerCurvePaths {
	const points = vertices.map(place);
	if (!points.length) return { points, line: "", area: "" };
	const first = points[0]!;
	const last = points[points.length - 1]!;
	const along = (from: number) => points.slice(from).map((p) => `L${p.x} ${p.y}`);
	return {
		points,
		line: [`M${first.x} ${first.y}`, ...(points.length > 1 ? along(1) : along(0))].join(" "),
		area: [`M${first.x} ${foot}`, ...along(0), `L${last.x} ${foot}`, "Z"].join(" "),
	};
}

/** The chart at `width`: its box, axes and the two curves. */
export function powerPlot(view: PowerPlotInput, width: number): PowerPlot {
	const f = POWER_FRAME;
	const right = Math.max(f.left + 60, width - f.inset);
	const span = right - f.left;
	const x = (fraction: number) => r2(f.left + fraction * span);
	const top = view.top > 0 ? view.top : 1;
	// Linear and unclamped: the ticks always reach past the Record.
	const yOf = (watts: number) => f.zero - (watts / top) * (f.zero - f.top);
	const place = (v: CurveVertex) => ({ x: x(v.x), y: r2(yOf(v.watts)) });
	return {
		width,
		height: f.height,
		left: f.left,
		right: r2(right),
		foot: f.foot,
		grid: view.ticks.map((tick) => ({
			y: tick === 0 ? f.zeroLine : r2(yOf(tick)),
			x1: f.left,
			x2: r2(right),
			label: String(tick),
			labelY: r2(yOf(tick) - f.labelLift),
			zero: tick === 0,
		})),
		labelRight: f.labelRight,
		dots: view.axis.dots.map((d) => ({ x: x(d.x), y: f.dotY, r: f.dotR })),
		labels: view.axis.labels.map((l) => ({ x: r2(f.left + l.x * span - f.durationShift), y: f.durationY, text: l.text })),
		title: { x: x(f.titleAt), y: f.titleY, text: view.axisTitle },
		record: curvePaths(view.record, place, f.foot),
		period: curvePaths(view.period, place, f.foot),
	};
}
