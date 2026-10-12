import type { Tone } from "./gauges";
import type { HrvAverages, HrvLegendItem, HrvTimeline } from "./hrv-status-pages";
import { linePath, r2, type PlotBox } from "./stat-charts";

/**
 * The HRV Status charts, measured off the Obsidian twin (Figma page
 * 430:6108): phone 1d 508:95933, 7d 508:96058 / 508:96227 (chip off / on),
 * 4w 508:96408 / 508:96696, previous periods 508:98305 / 508:98437 /
 * 508:98612; panes 511:2120 (1d), 512:2159 (7d), 512:2295 (4w, chip on);
 * the local Timeline Axis 507:150, Y Axis 507:95917, X Axis 507:108, Status
 * Marker 507:30, Sleep Marker 507:37 and Legend Item 507:46. A chart keeps
 * the phone's insets and stretches across whatever width it gets: the
 * phone's 402, a pane's 748 pt column.
 *
 * - The Nightly Timeline's box starts at its title's foot, the 7-day
 *   Averages' at the twin's Y Axis (y 244 on the phone, (32, 214.49) in the
 *   pane, 41.49 under the title).
 * - On the phone a 7-day Averages legend that needs a second row (4w with
 *   the chip on) takes it from the chart: the box loses 37.33 pt, its top
 *   line moves 4.33 up and its bottom one 34, and the chip stays put. In a
 *   pane the legend sits beside the chart, which keeps its height.
 *
 * Pure.
 */

/* ------------------------------------------------------------------ */
/*  The Nightly Timeline                                               */
/* ------------------------------------------------------------------ */

/**
 * The timeline's box, from the foot of its title (the Timeline Axis starts
 * 26.46 under it: y 644 on the phone, 197.46 in the pane). Measured on the
 * 1d frames, the same at both widths:
 *
 * - The plot is the sleep window, from x 33 to 24.9 short of the box's
 *   right edge (377.1 on the phone, 723.1 of the pane's 748).
 * - Five 0.5 pt gridlines 50 apart (2.5 pt a ms), from x 33 to 25.33 short
 *   of the edge, the first centred 33.63 under the box top; labels end at
 *   23.84. A night with other ticks spreads them over the same 200 pt
 *   (Inferred: one night seen).
 * - The axis row 258.46 down: a 4 pt dot on each whole hour, and the 21.67
 *   pt discs 4.17 in from sleep start and 4.6 in from wake, centred 258.63.
 * - The end times centred on the plot's ends, 274.39 down; the box ends at
 *   their foot, 280.39.
 */
export const TIMELINE_FRAME = {
	left: 33,
	inset: 24.9,
	gridInset: 25.33,
	top: 33.63,
	span: 200,
	labelRight: 23.84,
	axisY: 258.46,
	hourRadius: 2,
	discY: 258.63,
	discStart: 4.17,
	discEnd: 4.6,
	labelY: 274.39,
	height: 280.39,
} as const;

/** A Sleep Marker (507:37): a 19.33 pt disc in a 1.08 pt ring, 21.67 across. */
export const DISC = { radius: 10.205, ring: 1.08 } as const;

/** The timeline at a width: what `StatChart` draws, and the night's own marks. */
export interface TimelinePlot extends PlotBox {
	/** The readings joined straight, a reading at a time; empty without any. */
	line: string;
	/** "Zz" at sleep start, the alarm clock at wake. */
	discs: Array<{ kind: "sleep" | "wake"; x: number; y: number }>;
	/** Where a night without readings says so: the plot's centre. */
	empty?: { x: number; y: number };
}

/** The Nightly Timeline at `width`. Pending or empty, the gridlines alone. */
export function timelinePlot(timeline: HrvTimeline, width: number): TimelinePlot {
	const F = TIMELINE_FRAME;
	const right = Math.max(F.left + 60, width - F.inset);
	const span = right - F.left;
	const hi = timeline.ticks[0] ?? 0;
	const lo = timeline.ticks[timeline.ticks.length - 1] ?? 0;
	const x = (fraction: number) => r2(F.left + fraction * span);
	const y = (value: number) => r2(F.top + ((hi - Math.min(hi, Math.max(lo, value))) / (hi - lo || 1)) * F.span);
	const drawn = timeline.state === "drawn";
	const plot: TimelinePlot = {
		width,
		height: F.height,
		left: F.left,
		right: r2(right),
		top: F.top,
		baseline: F.top + F.span,
		labelRight: F.labelRight,
		grid: timeline.ticks.map((v) => ({ y: y(v), x1: F.left, x2: r2(width - F.gridInset), label: String(v) })),
		dots: drawn ? timeline.hours.map((h) => ({ x: x(h), y: F.axisY, r: F.hourRadius })) : [],
		labels: [],
		line: drawn ? linePath(timeline.points.map((p) => [x(p.x), y(p.value)])) : "",
		discs: drawn
			? [
					{ kind: "sleep", x: r2(F.left + F.discStart), y: F.discY },
					{ kind: "wake", x: r2(right - F.discEnd), y: F.discY },
				]
			: [],
	};
	if (drawn && timeline.start && timeline.end) {
		plot.labels = [
			{ x: F.left, y: F.labelY, text: timeline.start, rotated: false },
			{ x: r2(right), y: F.labelY, text: timeline.end, rotated: false },
		];
	}
	if (timeline.state === "empty") plot.empty = { x: r2(F.left + span / 2), y: r2(F.top + F.span / 2) };
	return plot;
}

/* ------------------------------------------------------------------ */
/*  The 7-day Averages                                                 */
/* ------------------------------------------------------------------ */

/** Where a 7-day Averages chart's marks go in its box. */
export interface AveragesFrame {
	/** The first day's centre, and the last one's inset from the box's right edge. */
	plotLeft: number;
	plotInset: number;
	/** The gridlines' ends, the same way. */
	gridLeft: number;
	gridInset: number;
	/** The top and the bottom gridline's centres. */
	top: number;
	bottom: number;
	/** The y labels' right edge; each label is centred on its line. */
	labelRight: number;
	/** The X Axis' top: its dots centred 12.005 under it, its labels 24.93. */
	axisTop: number;
	/** The box's height, to the axis labels' foot. */
	height: number;
}

/**
 * The twin's frames, in the box (y 244 on the phone): 7d gridlines x
 * 41.33–368.67, centres 253.83 + 58.33k, days 41.5 + 54.555·d; 4w x 50–369,
 * 261.5 + 57.11k, days 49.83 + 11.827·d; the X Axis at y 449. The labels end
 * at 25.9 (7d) and 35 (4w), whatever their digits ("102" on 4w − 1 too).
 */
export const AVERAGES_FRAMES: Readonly<Record<"7d" | "4w", AveragesFrame>> = {
	"7d": { plotLeft: 41.5, plotInset: 33.17, gridLeft: 41.33, gridInset: 33.33, top: 9.83, bottom: 184.83, labelRight: 25.9, axisTop: 205, height: 237 },
	"4w": { plotLeft: 49.83, plotInset: 32.84, gridLeft: 50, gridInset: 33, top: 17.5, bottom: 188.83, labelRight: 35, axisTop: 205, height: 237 },
};

/** A legend row as the phone stacks them: 16 pt items, rows 37.34 apart. */
export const LEGEND_ROW = 37.34;

/**
 * The frame with the phone's legend taking `rows` rows. A second row (4w
 * with the chip on, 508:96696) lifts the top line 4.33 and the bottom one 34
 * and the axis 37.33 (y 257.17 + 47.22k, axis 411.67). A 7d legend that
 * wraps, and any row past the second, are Inferred to do the same.
 */
export function averagesFrame(range: "7d" | "4w", rows = 1): AveragesFrame {
	const frame = AVERAGES_FRAMES[range];
	const extra = Math.max(0, Math.floor(rows) - 1);
	if (!extra) return frame;
	const shrink = 37.33 * extra;
	return {
		...frame,
		top: r2(frame.top - 4.33),
		bottom: r2(frame.bottom - 34 - 37.33 * (extra - 1)),
		axisTop: r2(frame.axisTop - shrink),
		height: r2(frame.height - shrink),
	};
}

/** A night's mark (Status Marker 507:30): a 9 pt circle or square, or an 8.33 × 7.33 triangle whose centroid is the value. */
export interface AveragesPoint {
	date: string;
	x: number;
	y: number;
	shape: "circle" | "square" | "triangle";
	tone: Tone;
	/** The mark's outline, for the square and the triangle; the circle's radius is `MARK.radius`. */
	d: string;
}

/** The Status Marker's sizes. */
export const MARK = { radius: 4.5, half: 4.5, triangle: { apex: 4.887, base: 2.443, half: 4.165 } } as const;

export interface AveragesPlot {
	width: number;
	height: number;
	labelRight: number;
	/** Top first; 1 pt lines under the band. */
	grid: Array<{ y: number; x1: number; x2: number; label: string }>;
	/** The baseline band, a path a run of nights. */
	band: string[];
	/** The overnight averages, dashed and broken where a night has none; empty with the chip off. */
	overnight: string;
	points: AveragesPoint[];
	/** The X Axis: 8.33 pt dots at the ends, 4.33 between. */
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
}

function markPath(shape: AveragesPoint["shape"], x: number, y: number): string {
	if (shape === "square") return `M${r2(x - MARK.half)} ${r2(y - MARK.half)}h9v9h-9Z`;
	if (shape === "triangle") {
		const t = MARK.triangle;
		return `M${r2(x)} ${r2(y - t.apex)}L${r2(x + t.half)} ${r2(y + t.base)}H${r2(x - t.half)}Z`;
	}
	return "";
}

/** A 7-day Averages chart at `width`, its phone legend taking `rows` rows. A period without a night draws its box only. */
export function averagesPlot(chart: HrvAverages | null, range: "7d" | "4w", width: number, rows = 1): AveragesPlot {
	const F = averagesFrame(range, rows);
	const plot: AveragesPlot = { width, height: F.height, labelRight: F.labelRight, grid: [], band: [], overnight: "", points: [], dots: [], labels: [] };
	if (!chart) return plot;
	const right = Math.max(F.plotLeft + 60, width - F.plotInset);
	const x = (fraction: number) => r2(F.plotLeft + fraction * (right - F.plotLeft));
	const y = (value: number) => r2(F.bottom - ((value - chart.low) / (chart.high - chart.low || 1)) * (F.bottom - F.top));
	plot.grid = chart.ticks.map((t) => ({ y: y(t.value), x1: F.gridLeft, x2: r2(width - F.gridInset), label: t.label }));
	plot.band = chart.band.map((run) => {
		// A night alone in its run still shows, 4 pt wide (Inferred).
		const edges = run.length > 1 ? run.map((b) => ({ ...b, x: x(b.x) })) : run.flatMap((b) => [{ ...b, x: x(b.x) - 2 }, { ...b, x: x(b.x) + 2 }]);
		const top = edges.map((b, i) => `${i ? "L" : "M"}${r2(b.x)} ${y(b.high)}`).join("");
		const bottom = [...edges].reverse().map((b) => `L${r2(b.x)} ${y(b.low)}`).join("");
		return `${top}${bottom}Z`;
	});
	if (chart.overnight) plot.overnight = linePath(chart.overnight.map((p) => [x(p.x), p.value === null ? null : y(p.value)]));
	plot.points = chart.points.map((p) => {
		const px = x(p.x);
		const py = y(p.value);
		return { date: p.date, x: px, y: py, shape: p.look.shape, tone: p.look.tone, d: markPath(p.look.shape, px, py) };
	});
	const dotY = r2(F.axisTop + 12.005);
	plot.dots = chart.axis.dots.map((d) => ({ x: x(d.x), y: dotY, r: d.large ? 4.165 : 2.165 }));
	plot.labels = chart.axis.labels.map((l) => ({ x: x(l.x), y: r2(F.axisTop + 24.93), text: l.text }));
	return plot;
}

/* ------------------------------------------------------------------ */
/*  The legends                                                        */
/* ------------------------------------------------------------------ */

/**
 * Each Legend Item's width in the twin (16 pt mark, 8 apart from its
 * caption; HRV's line 5): what a row of them takes. Poor is Inferred.
 */
export const LEGEND_WIDTHS: Readonly<Record<string, number>> = {
	Balanced: 72,
	Unbalanced: 87,
	Low: 46,
	Poor: 50,
	Baseline: 68,
	"Overnight Avg": 98,
	HRV: 44,
};
/** Between two items on a row. */
export const LEGEND_GAP = 15.33;
/** The phone's legend keeps 16 pt off either edge; a pane's has the 370 pt column. */
export const LEGEND_MARGIN = 16;
export const SIDE_COLUMN = 370;

/**
 * The legend in rows no wider than `width`, in order, as the twin wraps
 * them: four items fit the phone's 370, a fifth starts a row (4w with the
 * chip on: 318.99 pt, then Overnight Avg).
 */
export function legendRows<T extends Pick<HrvLegendItem, "label">>(items: readonly T[], width: number): T[][] {
	const rows: T[][] = [];
	let used = 0;
	for (const item of items) {
		const w = LEGEND_WIDTHS[item.label] ?? 80;
		const row = rows[rows.length - 1];
		if (row && used + LEGEND_GAP + w <= width + 0.01) {
			row.push(item);
			used += LEGEND_GAP + w;
		} else {
			rows.push([item]);
			used = w;
		}
	}
	return rows;
}

/** A row's width, as the twin lays it out. */
export function legendWidth(row: ReadonlyArray<Pick<HrvLegendItem, "label">>): number {
	return r2(row.reduce((sum, item, i) => sum + (LEGEND_WIDTHS[item.label] ?? 80) + (i ? LEGEND_GAP : 0), 0));
}
