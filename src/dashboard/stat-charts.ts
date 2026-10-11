import { axisDay, dayAxis, type PeriodAxis } from "./periods";

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
 * The Performance Stats line charts (VO₂ Max, Hill Score and the rest) share
 * a second kit below: a `LineChartFrame` measured off the stat's twin, and
 * `linePlot`, which lays out the gridlines, the axis and the points; with
 * `stepAxis` for an axis that marks every n-th day.
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

/* ------------------------------------------------------------------ */
/*  Line charts (Performance Stats)                                    */
/* ------------------------------------------------------------------ */

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

/** An axis that marks every n-th day of a period rather than each one. */
export interface AxisSteps {
	/** Days between two marks, from the period's first day. */
	every: number;
	/** How many marks at most before the last day's, which always ends the axis. */
	count: number;
	/** Large and labelled "MM-DD": the two ends only, or every mark. */
	labelled: "ends" | "all";
}

/**
 * An axis from a period's first day to its last that marks `every` days
 * from the first, `count` of them at most, then the last day: VO₂ Max's 12w
 * (every 7 days, the ends labelled) and 6m (every 36, all labelled). Fewer
 * than two days fall back to `dayAxis`.
 */
export function stepAxis(days: readonly string[], steps: AxisSteps): PeriodAxis {
	const n = days.length;
	if (n < 2) return dayAxis(days);
	const at = [...Array.from({ length: steps.count }, (_, k) => k * steps.every).filter((d) => d < n - 1), n - 1];
	const marks = at.map((d, i) => ({ x: d / (n - 1), large: steps.labelled === "all" || i === 0 || i === at.length - 1, day: days[d]! }));
	return {
		dots: marks.map(({ x, large }) => ({ x, large })),
		labels: marks.filter((m) => m.large).map((m) => ({ x: m.x, text: axisDay(m.day) })),
	};
}
