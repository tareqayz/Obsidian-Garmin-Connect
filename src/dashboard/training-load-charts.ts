import { pillPath } from "./endurance-score-charts";
import type { PeriodAxis } from "./periods";
import { linePath, r2, type MarkedAxis } from "./stat-charts";
import type { FocusBucket, LoadGroup } from "./training-load-copy";
import type { AcuteChart, ExerciseTabView, FocusBar, RatioChart } from "./training-load-pages";

/**
 * Load's charts and rows as the Obsidian twin draws them (Figma page
 * 430:6102: phones 603:10 Load Focus, 604:37 Exercise Load, 606:454 Acute,
 * 606:659 Acute + Chronic, 606:894 Ratio, 604:405 / 606:1097 previous;
 * panes 609:1438, 609:1511, 610:1571, 610:1745). The twin sits 56 pt above
 * Garmin's shots and keeps their geometry; a pane keeps the phone's insets
 * and stretches each chart across its 748 pt column.
 *
 * - Load Focus: a row of 40 pt every 44, the bar track 185 pt into the
 *   row's content to its end (x 201 for 185 pt on the phone, 217 for 563 in
 *   a pane); a bar shorter than its 8 pt height is two radius-4 caps
 *   overlapping, a lens (Anaerobic's 2.4 pt), and the Optimal Range box a
 *   dashed pill over it on the same scale.
 * - Exercise Load: 8.5 pt bars on the day slots, 12.21 pt apart from 43.17
 *   on the phone, their feet at 119.67 and 0 … 3S over 102.73 pt; the
 *   stacked segments bottom up with no gap, only the top one rounded.
 * - Training Load: gridlines from 44 (Acute) or 42 (Ratio) to 25 short of
 *   the edge, the days 11.753 apart from 51.9 (Ratio 11.827 from 50), the
 *   zero line at 154.17 and the top one 129.67 above it (Ratio 133.33); the
 *   acute labels at their own values, so "1.1k" sits over the top line.
 *
 * Pure.
 */

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

/** Each benefit group's colour, as the twin binds it (performance/benefit/*): Load Focus's bars, Exercise Load's segments and legend. */
export const GROUP_COLOR: Readonly<Record<LoadGroup, string>> = {
	anaerobic: "var(--color-purple)",
	highAerobic: "var(--color-orange)",
	lowAerobic: "var(--color-cyan)",
	unknown: "var(--text-normal)",
};

/** Training Load's series: the acute load (grey with the chip on), the chronic load, the ratio. */
export const SERIES_COLOR = {
	acute: "var(--text-normal)",
	muted: "var(--text-muted)",
	chronic: "var(--color-orange)",
	ratio: "var(--text-normal)",
} as const;

/* ------------------------------------------------------------------ */
/*  Load Focus                                                         */
/* ------------------------------------------------------------------ */

/** A Load Focus row (603:19, 603:26, 603:31; pane 609:1445 …), in the row's content: the phone pads it 16 pt, a pane not at all. */
export const FOCUS_ROW = {
	height: 40,
	/** Row tops 44 apart. */
	pitch: 44,
	/** The label's line box, 7.52 down; the value right-aligned here. */
	textTop: 7.52,
	valueRight: 167.5,
	/** The bar track starts this far into the content and runs to its end: 185 pt on the phone, 563 in a pane. */
	trackLeft: 185,
	/** The bar and the box over it: 8 pt, 16 down the row, radius 4. */
	barTop: 16,
	barHeight: 8,
} as const;

/** The legend's dashed pill (603:36): 25.33 × 9.33, 8 pt before "Optimal Range". */
export const FOCUS_KEY = { width: 25.33, height: 9.33, gap: 8 } as const;

/** A bar's outline in its 8 pt track, from x 0. */
export interface FocusShape {
	/** "pill" from 8 pt long on; "lens" below, two radius-4 caps overlapping; "none" for nothing. */
	kind: "pill" | "lens" | "none";
	width: number;
	d: string;
}

/** The bar and the Optimal Range box of a row whose track is `track` pt long. */
export interface FocusRowPlot {
	bucket: FocusBucket;
	color: string;
	bar: FocusShape;
	/** The box: from `x`, `width` long, as tall as the bar. */
	box?: { x: number; width: number };
}

/**
 * A bar `width` pt long and 8 pt tall as a path: a pill from 8 pt on, and
 * below that the overlap of its two end caps, a lens as tall as the caps
 * allow — Anaerobic's 2.42 pt draws 5.72 pt tall on the phone, its 7.48 pt
 * 7.97 tall in a pane, as the twin (603:22, 609:1448). Nothing at 0.
 */
export function focusBarPath(width: number): FocusShape {
	const h = FOCUS_ROW.barHeight;
	const r = h / 2;
	if (!(width > 0)) return { kind: "none", width: 0, d: "" };
	if (width >= h) {
		return { kind: "pill", width: r2(width), d: `M${r} 0H${r2(width - r)}A${r} ${r} 0 0 1 ${r2(width - r)} ${h}H${r}A${r} ${r} 0 0 1 ${r} 0Z` };
	}
	const half = Math.sqrt(r * r - ((h - width) / 2) ** 2);
	const x = r2(width / 2);
	const top = r2(r - half);
	const foot = r2(r + half);
	return { kind: "lens", width: r2(width), d: `M${x} ${top}A${r} ${r} 0 0 1 ${x} ${foot}A${r} ${r} 0 0 1 ${x} ${top}Z` };
}

/** A row's bar and box along a track `track` pt long: its share of the scale, and its targets' on the same scale. */
export function focusRowPlot(bar: Pick<FocusBar, "bucket" | "fraction" | "target">, track: number): FocusRowPlot {
	const plot: FocusRowPlot = { bucket: bar.bucket, color: GROUP_COLOR[bar.bucket], bar: focusBarPath(track * bar.fraction) };
	if (bar.target) plot.box = { x: r2(track * bar.target.from), width: r2(track * (bar.target.to - bar.target.from)) };
	return plot;
}

/* ------------------------------------------------------------------ */
/*  Exercise Load                                                      */
/* ------------------------------------------------------------------ */

/** Daily Totals' 150 pt box (604:43; pane 609:1515, 748 wide), in its own coordinates. */
export const EXERCISE_FRAME = {
	/** The first day's slot centre, and the last day's as an inset from the right edge (372.84 on the phone, 718.84 in a pane). */
	left: 43.17,
	inset: 29.16,
	/** The bars' feet, and the height of 0 … 3S. */
	baseline: 119.67,
	plot: 102.73,
	/** The y labels' right edge; each is centred on its value. */
	labelRight: 32,
	barWidth: 8.5,
	/** The day dots' centre line and the MM-DD labels' centre. */
	dotY: 129.67,
	labelY: 142.64,
	height: 150,
} as const;

/** A dot on a day axis: 4 pt a day, 8 pt at the ends, --text-faint. */
export const DAY_DOT = { small: 2, large: 4 } as const;

export interface AxisMarks {
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
}

export interface ExercisePlot extends AxisMarks {
	width: number;
	height: number;
	/** The y labels, top first, at their values. */
	ticks: Array<{ x: number; y: number; text: string }>;
	/** Each day's bar: its slot's centre and its segments bottom up, the top one pill-topped (`d`). */
	bars: Array<{ date: string; x: number; width: number; rects: Array<{ color: string; y: number; height: number; d?: string }> }>;
}

/** The day axis under a chart: its dots on the days' x, the two ends large and labelled. */
function axisMarks(axis: PeriodAxis, x: (fraction: number) => number, dotY: number, labelY: number): AxisMarks {
	return {
		dots: axis.dots.map((d) => ({ x: r2(x(d.x)), y: dotY, r: d.large ? DAY_DOT.large : DAY_DOT.small })),
		labels: axis.labels.map((l) => ({ x: r2(x(l.x)), y: labelY, text: l.text })),
	};
}

/** Daily Totals at `width`: the plot spans 0 … 3S over 102.73 pt, every bar on its day's slot. */
export function exercisePlot(chart: ExerciseTabView["chart"], width: number): ExercisePlot {
	const f = EXERCISE_FRAME;
	const span = Math.max(60, width - f.left - f.inset);
	const x = (fraction: number) => f.left + fraction * span;
	const unit = f.plot / (chart.top || 1);
	const y = (value: number) => f.baseline - value * unit;
	return {
		width,
		height: f.height,
		ticks: chart.ticks.map((t) => ({ x: f.labelRight, y: r2(y(t)), text: String(t) })),
		bars: chart.bars.map((bar) => {
			const cx = r2(x(bar.x));
			const rects: ExercisePlot["bars"][number]["rects"] = bar.segments.map((s) => ({ color: GROUP_COLOR[s.group], y: r2(y(s.to)), height: r2(s.value * unit) }));
			const top = rects[rects.length - 1];
			if (top) top.d = pillPath(cx - f.barWidth / 2, top.y, f.barWidth, top.height, f.barWidth / 2);
			return { date: bar.date, x: cx, width: f.barWidth, rects };
		}),
		...axisMarks(chart.axis, x, f.dotY, f.labelY),
	};
}

/* ------------------------------------------------------------------ */
/*  Training Load                                                      */
/* ------------------------------------------------------------------ */

/** A 4-Week Timeline's 200 pt box, in its own coordinates. */
export interface TimelineFrame {
	/** The first and the last day's x, the second as an inset from the right edge. */
	left: number;
	inset: number;
	/** The gridlines' ends. */
	gridLeft: number;
	gridInset: number;
	/** The top gridline (the domain's top) and the zero line, their centres. */
	top: number;
	baseline: number;
	/** The y labels' right edge. */
	labelRight: number;
	dotY: number;
	labelY: number;
	height: number;
}

/** Acute Load's (606:461; pane 610:1576): lines 24.5 / 67.72 / 110.95 / 154.17 at 1053, days 11.753 apart from 51.9. */
export const ACUTE_FRAME: TimelineFrame = {
	left: 51.9,
	inset: 32.77,
	gridLeft: 44,
	gridInset: 25,
	top: 24.5,
	baseline: 154.17,
	labelRight: 37,
	dotY: 178,
	labelY: 190.97,
	height: 200,
};

/** Load Ratio's (606:901; pane 610:1750): 0 … 2.3 over 133.33 pt, days 11.827 apart from 50; its narrower labels move the plot 2 pt left. */
export const RATIO_FRAME: TimelineFrame = {
	left: 50,
	inset: 32.67,
	gridLeft: 42,
	gridInset: 25,
	top: 20.84,
	baseline: 154.17,
	labelRight: 35,
	dotY: 178,
	labelY: 190.97,
	height: 200,
};

/** The series' marks: 2 pt lines, 8 pt dots, the chronic load's 7 pt squares. */
export const MARKS = { line: 2, dot: 4, square: 7 } as const;

export interface TimelinePlot extends AxisMarks {
	width: number;
	height: number;
	/** The plot's ends and its top and zero lines: where an empty state goes. */
	left: number;
	right: number;
	top: number;
	baseline: number;
	grid: Array<{ y: number; x1: number; x2: number }>;
	/** The y labels, top first: the acute load's at their own values, Load Ratio's on its lines. */
	ticks: Array<{ x: number; y: number; text: string }>;
	/** The optimal band's outline: a per-day area (Acute Load) or the 0.8–1.5 rectangle (Load Ratio); empty without one. */
	band: string;
	/** The acute load or the ratio: the line through the days with a value, broken at a day without, and a dot each. */
	line: string;
	points: Array<{ x: number; y: number }>;
	/** With the chip on: the chronic load's line and its squares' centres. */
	chronic?: { line: string; squares: Array<{ x: number; y: number }> };
}

function timeline(frame: TimelineFrame, axis: MarkedAxis, width: number, xAxis: PeriodAxis, clamp: boolean) {
	const right = Math.max(frame.left + 60, width - frame.inset);
	const span = right - frame.left;
	const x = (fraction: number) => frame.left + fraction * span;
	const range = frame.baseline - frame.top;
	const y = (value: number) => frame.baseline - (clamp ? Math.min(axis.top, Math.max(0, value)) : value) * (range / (axis.top || 1));
	const base = {
		width,
		height: frame.height,
		left: frame.left,
		right: r2(right),
		top: frame.top,
		baseline: frame.baseline,
		grid: axis.grid.map((g) => ({ y: r2(frame.baseline - g.at * range), x1: frame.gridLeft, x2: r2(Math.max(frame.gridLeft + 60, width - frame.gridInset)) })),
		ticks: axis.labels.map((l) => ({ x: frame.labelRight, y: r2(frame.baseline - l.at * range), text: l.text })),
		...axisMarks(xAxis, x, frame.dotY, frame.labelY),
	};
	return { base, x, y };
}

/** A series' line and dots: a point for each day with a value, the line broken where one is missing. */
function series(points: ReadonlyArray<{ x: number; value: number | null }>, x: (f: number) => number, y: (v: number) => number) {
	const at = points.map((p) => [x(p.x), p.value === null ? null : y(p.value)] as [number, number | null]);
	return {
		line: linePath(at),
		points: at.flatMap(([px, py]) => (py === null ? [] : [{ x: r2(px), y: r2(py) }])),
	};
}

/**
 * The band through each day's 0.8× and 1.5× chronic load, joined straight:
 * along the tops left to right, back along the feet; a day without one ends
 * a stretch, and a stretch of one day draws nothing.
 */
export function bandPath(band: AcuteChart["band"], x: (f: number) => number, y: (v: number) => number): string {
	const runs: Array<Array<{ x: number; low: number; high: number }>> = [];
	let run: Array<{ x: number; low: number; high: number }> = [];
	for (const day of band) {
		if (day) run.push(day);
		else if (run.length) {
			runs.push(run);
			run = [];
		}
	}
	if (run.length) runs.push(run);
	return runs
		.filter((r) => r.length > 1)
		.map((r) => {
			const tops = r.map((d) => `${r2(x(d.x))} ${r2(y(d.high))}`);
			const feet = [...r].reverse().map((d) => `${r2(x(d.x))} ${r2(y(d.low))}`);
			return `M${tops.join("L")}L${feet.join("L")}Z`;
		})
		.join("");
}

/**
 * Acute Load's timeline at `width`: the gridlines at the domain's thirds and
 * the labels at their own values (`acuteAxis`), the band (cut at the top
 * line, Inferred), the acute line and its dots, and with the chip on the
 * chronic line and its squares. `frame` is Load's own unless another page
 * draws the timeline in a box of its own (Training Readiness's Acute Load
 * sheet, 1.288 times as tall).
 */
export function acutePlot(chart: AcuteChart, width: number, frame: TimelineFrame = ACUTE_FRAME): TimelinePlot {
	const { base, x, y } = timeline(frame, chart.axis, width, chart.axisX, false);
	// A band over the domain's top is cut at the top line (Inferred: whether M counts the band is unseen).
	const plot: TimelinePlot = { ...base, band: bandPath(chart.band, x, (v) => y(Math.min(v, chart.axis.top))), ...series(chart.acute, x, y) };
	if (chart.chronic) {
		const chronic = series(chart.chronic, x, y);
		plot.chronic = { line: chronic.line, squares: chronic.points };
	}
	return plot;
}

/** Load Ratio's timeline at `width`: the fixed 0–2.3 axis, the 0.8–1.5 band across the days, the ratio (past 2.3 at the top). */
export function ratioPlot(chart: RatioChart, width: number): TimelinePlot {
	const { base, x, y } = timeline(RATIO_FRAME, chart.axis, width, chart.axisX, true);
	const top = r2(y(chart.band.high));
	const foot = r2(y(chart.band.low));
	const band = `M${r2(x(0))} ${top}H${r2(x(1))}V${foot}H${r2(x(0))}Z`;
	return { ...base, band, ...series(chart.ratio, x, y) };
}

/* ------------------------------------------------------------------ */
/*  The page's rhythm                                                  */
/* ------------------------------------------------------------------ */

/**
 * The tabs' vertical rhythm off the twin, each gap from the foot of what is
 * above it (the header ends at 160.33 on the phone, 117 in a pane).
 *
 * - Phone: Load Focus's title at 179.01, its copy's first line at 213.52,
 *   the rows at 299 / 343 / 387, the legend at 438.67; Exercise Load's
 *   heading at 166.86, the chart at 214, the legend rows at 374.33 /
 *   395.67, the list at 417.33, 34 pt left under it; Training Load's
 *   segmented control at 183.33, its title at 253.86, the chart at 314, the
 *   legend at 522.67, the chip at 543.33 (its outline; the fill at 544.33),
 *   the status at 616.68 and the copy at 651.19, or Load Ratio's rules at
 *   569.33, the status at 641.68 and the copy at 676.19.
 * - Pane: the first row of each column 31 under the header; Load Focus's
 *   title 6.34 under the rows' top; Exercise Load's legend level with the
 *   chart's top label, its list 30 under the chart, three cards a row 8
 *   apart, 16 between rows; the timeline 38.14 under its title, the side
 *   column the segmented control, the legend 24 under it, then the chip or
 *   the figures, the status and the copy at the phone's gaps.
 *
 * Copy runs on a 20 pt pitch: its 20 pt line boxes sit a point under the
 * twin's 22 pt text frames. The chip's gaps are to its 36 pt fill
 * (`StatChips` draws the outline inside it), a point under the twin's
 * outlined 38 pt frame.
 */
export const LOAD_LAYOUT = {
	focus: { title: 18.68, copy: 7.51, rows: 24.48, legend: 11.67, paneTop: 31, paneTitle: 37.34 },
	exercise: { heading: 6.53, chart: 25.14, legend: 10.33, legendRow: 5.34, list: 5.66, bottom: 34, paneTop: 31, paneLegend: 86.94, paneList: 30 },
	training: { segmented: 23, title: 38.53, chart: 38.14, legend: 8.67, chip: 5.66, status: 36.35, figures: 30.66, figureValue: 5.35, figuresStatus: 24, copy: 7.51, paneTop: 31, paneLegend: 24, paneChip: 17 },
} as const;
