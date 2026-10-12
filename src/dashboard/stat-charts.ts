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
 * `stepAxis` for an axis that marks every n-th day, and `acuteAxis` for the
 * acute load's, whose labels sit off its lines (Load, Training Readiness).
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

/* ------------------------------------------------------------------ */
/*  The acute load axis (Load, Training Readiness)                     */
/* ------------------------------------------------------------------ */

/** ⌈value / unit⌉ × unit, and at least one unit: the round label step Garmin's load charts count in. */
export function stepUp(value: number, unit = 25): number {
	return Math.max(1, Math.ceil(value / unit)) * unit;
}

/** A load axis label: whole below a thousand ("375"), else thousands to a tenth ("1.1k"). */
export function loadLabel(value: number): string {
	return value < 1000 ? String(Math.round(value)) : `${Number((value / 1000).toFixed(1)).toLocaleString()}k`;
}

/** A mark on a y axis: its value, and `at`, that value as a fraction of the domain (0 the zero line, 1 the top line). */
export interface AxisMark {
	value: number;
	at: number;
}

/** A y axis whose labels need not sit on its gridlines, from 0 to `top`: the acute load's (`acuteAxis`), Load Ratio's. */
export interface MarkedAxis {
	/** The domain's top: where the top gridline sits. The acute load's is 1.5 × the period's largest. */
	top: number;
	/** The gridlines, top first: the acute load's at the domain's thirds, 1053, 702, 351, 0. */
	grid: AxisMark[];
	/** The labels, top first, each at its own value: the acute load's "1.1k" (1125, `at` 1.07), "750", "375", "0". */
	labels: Array<AxisMark & { text: string }>;
}

/**
 * The acute load axis as Garmin draws it on Load's Training Load tab and
 * Training Readiness' Acute Load sheet (ref/performance-stats/training-load,
 * 2026-10-11): the domain runs from 0 to 1.5 × the period's largest acute
 * load M, and its gridlines sit at the domain's thirds (0, M/2, M, 1.5·M);
 * the labels count in S = ⌈1.5·M / 3 / 25⌉ × 25 and each stands at its own
 * value, so they sit off the lines and the top one may pass the top line.
 * M 702 → lines 351 / 702 / 1053, labels 375 / 750 / "1.1k" (9 pt above the
 * phone's top line); M 604 → lines 302 / 604 / 906, labels 325 / 650 / 975.
 * Whether M counts the band's top (1.5 × chronic) too is unseen: here it is
 * the acute load alone. Without a load to scale by the domain is 0–75, the
 * labels on the lines (Inferred).
 */
export function acuteAxis(maxAcute: number | undefined): MarkedAxis {
	const loaded = maxAcute !== undefined && Number.isFinite(maxAcute) && maxAcute > 0;
	const step = stepUp(loaded ? (1.5 * maxAcute) / 3 : 0);
	const top = loaded ? 1.5 * maxAcute : 3 * step;
	return {
		top,
		grid: [3, 2, 1, 0].map((k) => ({ value: (top * k) / 3, at: k / 3 })),
		labels: [3, 2, 1, 0].map((k) => ({ value: k * step, at: (k * step) / top, text: loadLabel(k * step) })),
	};
}
