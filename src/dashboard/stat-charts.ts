import type { PeriodAxis } from "./periods";

/**
 * Chart geometry the Health Stats pages share: a chart's frame, measured off
 * a stat's Figma frames at the phone's width and in a pane's column, and the
 * marks every one of their charts has — gridlines with their labels, the x
 * axis' dots and labels — placed in the chart's own box, whose top is the
 * bottom of the chart's title. A stat's own module keeps its frames and
 * places its marks with the box's scale (`stress-charts.ts`).
 *
 * Each chart keeps the phone's insets and heights and stretches its plot
 * across whatever width it gets; a pane, where the chart sits in a 748pt
 * column, has a frame of its own.
 *
 * Pure.
 */

/** The phone frames' width. */
export const PHONE = 402;
/** A pane's chart column: 1126pt of content, less the 370pt column and the 8pt gap. */
export const PANE_COLUMN = 748;

/** The axis' dots: the small ones a day, the large ones at the ends or a month. */
export const DOT = { small: 1.75, large: 4 } as const;

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Where a chart's marks go in its box, measured off a stat's Figma frame. */
export interface ChartFrame {
	/** Where the data runs: from `left` to `inset` short of the box's right edge. */
	left: number;
	inset: number;
	/** The gridlines' own ends, the same way. */
	gridLeft: number;
	gridInset: number;
	/** The first and last tick's lines. */
	top: number;
	baseline: number;
	/** The y labels' right edge; each label is centred on its gridline. */
	labelRight: number;
	/** The x axis' dot row. */
	dotY: number;
	/** The x labels' centre, or the foot of upright ones. */
	labelY: number;
	/** The box's height, down to whatever follows the chart. */
	height: number;
}

/** What every chart draws, in its box. */
export interface PlotBox {
	width: number;
	height: number;
	left: number;
	right: number;
	top: number;
	baseline: number;
	labelRight: number;
	grid: Array<{ y: number; x1: number; x2: number; label: string }>;
	/** The axis' dots. */
	dots: Array<{ x: number; y: number; r: number }>;
	/** Centred on `x`; a rotated label stands on end, reading up from `y`. */
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
}

/** How a stat places its own marks in the box. */
export interface PlotScale {
	/** A fraction of the plot, 0..1, as x. */
	x(fraction: number): number;
	/** A value as y, clamped to the ticks. */
	y(value: number): number;
	/** The plot's width. */
	span: number;
}

/**
 * A chart's box at `width`: gridlines at `ticks`, top first (the first on the
 * frame's `top`, the last on its `baseline`), labelled with `labels` or the
 * ticks themselves, the axis under it, and the scale for the stat's marks.
 */
export function plotBox(
	frame: ChartFrame,
	width: number,
	ticks: readonly number[],
	axis: PeriodAxis,
	labels: readonly string[] = ticks.map(String),
): { box: PlotBox; scale: PlotScale } {
	const right = Math.max(frame.left + 60, width - frame.inset);
	const gridRight = Math.max(frame.gridLeft + 60, width - frame.gridInset);
	const span = right - frame.left;
	const lo = Math.min(...ticks);
	const hi = Math.max(...ticks);
	const x = (fraction: number) => frame.left + fraction * span;
	const y = (value: number) => frame.baseline - ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo || 1)) * (frame.baseline - frame.top);
	const box: PlotBox = {
		width,
		height: frame.height,
		left: frame.left,
		right: r2(right),
		top: frame.top,
		baseline: frame.baseline,
		labelRight: frame.labelRight,
		grid: ticks.map((v, i) => ({ y: r2(y(v)), x1: frame.gridLeft, x2: r2(gridRight), label: labels[i] ?? String(v) })),
		dots: axis.dots.map((d) => ({ x: r2(x(d.x)), y: frame.dotY, r: d.large ? DOT.large : DOT.small })),
		labels: axis.labels.map((l) => ({ x: r2(x(l.x)), y: frame.labelY, text: l.text, rotated: l.rotated === true })),
	};
	return { box, scale: { x, y, span } };
}

/** A polyline through the points, broken wherever a value is missing: no segment to either side of a gap. */
export function linePath(points: ReadonlyArray<[number, number | null]>): string {
	let d = "";
	let pen = false;
	for (const [px, py] of points) {
		if (py === null) {
			pen = false;
			continue;
		}
		d += `${pen ? "L" : "M"}${r2(px)} ${r2(py)} `;
		pen = true;
	}
	return d.trim();
}
