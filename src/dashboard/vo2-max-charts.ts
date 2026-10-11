import type { PeriodAxis } from "./periods";
import { r2 } from "./stat-charts";
import type { Vo2Chart } from "./vo2-max-pages";

/**
 * The VO₂ Max line chart, measured off the Obsidian twin (Figma page
 * 430:6112: phone 4w 472:131, 12w 472:316, 6m 472:472; pane 473:889,
 * 473:1024, 473:1131; the local Y Axis 470:33, X Axis 470:104 and Chart Dot
 * 470:4). Its box starts at the tabs' bottom and is 304 pt tall at any
 * width: the phone's 402 and a pane's 748 pt column keep the same insets, so
 * one frame serves both and the plot stretches between them.
 *
 * - Five gridlines 41 pt apart, from 104 to 268 in the box (y 302.33 to
 *   466.33 on the phone), from x 39 to 16 short of the box's right edge; the
 *   tick labels end at x 22.8, each centred on its line.
 * - The plot runs from the period's first day at x 39 to its last at the
 *   gridlines' right end: x(d) = 39 + (width − 55)·d / (days − 1).
 * - Under it, the axis row: 4 pt dots centred 278 and 8 pt ones 280.17 (both
 *   top-aligned at 276 in the twin), and "MM-DD" labels centred 295.85.
 * - The readings: 8 pt dots joined by a 1 pt line.
 *
 * `linePlot` is the part any such chart could share: a frame, the ticks, an
 * axis and points as fractions of the plot.
 *
 * Pure.
 */

/** A line chart's box, measured off a twin. */
export interface LineChartFrame {
	/** The plot's first x, and its last one's inset from the box's right edge; the gridlines run the same. */
	left: number;
	inset: number;
	/** The top and the bottom gridline. */
	top: number;
	baseline: number;
	/** The y labels' right edge. */
	labelRight: number;
	/** The axis' dots under the plot: a day's (small) and an end's or a labelled day's (large), centre and radius. */
	axisDots: { small: { y: number; r: number }; large: { y: number; r: number } };
	/** The axis labels' centre. */
	labelY: number;
	/** A reading's dot. */
	pointRadius: number;
	/** The box's height, down to whatever follows the chart. */
	height: number;
}

export const VO2_FRAME: LineChartFrame = {
	left: 39,
	inset: 16,
	top: 104,
	baseline: 268,
	labelRight: 22.8,
	axisDots: { small: { y: 278, r: 2 }, large: { y: 280.17, r: 4 } },
	labelY: 295.85,
	pointRadius: 4,
	height: 304,
};

export interface LinePlot {
	width: number;
	height: number;
	/** The plot's ends. */
	left: number;
	right: number;
	top: number;
	baseline: number;
	labelRight: number;
	/** Top first. */
	grid: Array<{ y: number; x1: number; x2: number; label: string }>;
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
	points: Array<{ x: number; y: number }>;
	/** The points joined straight, in order; empty for fewer than two. */
	line: string;
	pointRadius: number;
}

/** What a line chart draws: ticks top first, the axis' marks and the points as fractions of the plot. */
export interface LineInput {
	ticks: readonly number[];
	axis: PeriodAxis;
	points: ReadonlyArray<{ x: number; value: number }>;
}

/** A line chart at `width`, its box laid out by `frame`. A value off the ticks is drawn at the nearest one. */
export function linePlot(frame: LineChartFrame, width: number, input: LineInput): LinePlot {
	const right = Math.max(frame.left + 60, width - frame.inset);
	const span = right - frame.left;
	const lo = input.ticks.length ? Math.min(...input.ticks) : 0;
	const hi = input.ticks.length ? Math.max(...input.ticks) : 1;
	const x = (fraction: number) => r2(frame.left + fraction * span);
	const y = (value: number) => r2(frame.baseline - ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo || 1)) * (frame.baseline - frame.top));
	const points = input.points.map((p) => ({ x: x(p.x), y: y(p.value) }));
	return {
		width,
		height: frame.height,
		left: frame.left,
		right: r2(right),
		top: frame.top,
		baseline: frame.baseline,
		labelRight: frame.labelRight,
		grid: input.ticks.map((v) => ({ y: y(v), x1: frame.left, x2: r2(right), label: String(v) })),
		dots: input.axis.dots.map((d) => {
			const dot = d.large ? frame.axisDots.large : frame.axisDots.small;
			return { x: x(d.x), y: dot.y, r: dot.r };
		}),
		labels: input.axis.labels.map((l) => ({ x: x(l.x), y: frame.labelY, text: l.text })),
		points,
		line: points.length > 1 ? points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "",
		pointRadius: frame.pointRadius,
	};
}

/** A VO₂ Max range's chart at `width`; for a period without a reading, the bare box the no-data line sits in. */
export function vo2Plot(chart: Vo2Chart | null, width: number): LinePlot {
	return linePlot(VO2_FRAME, width, chart ?? { ticks: [], axis: { dots: [], labels: [] }, points: [] });
}
