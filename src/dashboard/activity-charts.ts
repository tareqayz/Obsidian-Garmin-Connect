import type {
	ChartColour,
	ChartPoints,
	ExpandedChartView,
	OverlaySeries,
	RunWalkChart,
	SeriesChart,
	TrainingEffectChart,
	XAxis,
	YAxis,
	ZonesChart,
} from "./activity-chart-pages";
import { TE_CAP, TE_MAX, TE_SEGMENTS } from "./activity-chart-pages";
import { linePath, r2 } from "./stat-charts";

/**
 * Where the Charts tab's marks go: each card's plot at the width it gets, and
 * the expanded chart's at the view's size. The frames are the Obsidian twin's
 * (Figma 8D338zFIJ1a2zrsuligjva, page 402:2: phone Charts · Time 406:474, pane
 * 415:3254, expanded 411:1340 and 416:86199), all in one place below.
 *
 * A card's chart box starts under its figures (the twin's 120.47 pt in a
 * section) and runs to the card's end; the plot stretches across the width
 * and keeps the twin's heights. A pane card (≥ 640 pt) has a 1 pt border, and
 * its frame is in the box inside it.
 *
 * Pure.
 */

/** The phone's sections, or the bordered cards of a pane (640 pt and up). */
export type ChartLayout = "phone" | "pane";

/** A card chart's frame: box coordinates, y down from the box's top. */
export interface ChartFrame {
	/** The plot's left edge, and its right edge's inset from the box's. */
	left: number;
	inset: number;
	/** The plot's top and height. */
	top: number;
	height: number;
	/** The y labels' right edge; each label is centred on its value. */
	labelRight: number;
	/** The x axis: the tick dots' row below the plot's bottom, the labels and the title below the dots. */
	dotGap: number;
	labelGap: number;
	titleGap: number;
	/** A key's row below the dots (Stamina, Run/Walk). */
	keyGap: number;
	/** The box's end below the dots, or below the key. */
	foot: number;
	keyFoot: number;
}

/**
 * The twin's phone section (Heart Rate 406:1830): plot 39.83–379.83 pt, its top
 * 25.2 pt under the figures and 137 pt tall, the dots 11.83 pt under it, the
 * labels 13.04 and the axis title 32.81 under the dots, the section's end
 * 49.83 under them. Labels end 7 pt short of the plot.
 */
const PHONE_CHART: ChartFrame = {
	left: 39.83,
	inset: 22.17,
	top: 25.2,
	height: 137,
	labelRight: 32.83,
	dotGap: 11.83,
	labelGap: 13.04,
	titleGap: 32.81,
	keyGap: 58.1,
	foot: 49.83,
	keyFoot: 41.66,
};

/** The twin's pane card (Heart Rate 415:3321), inside its border: 7 pt more on the left, 25 pt on the right. */
const PANE_CHART: ChartFrame = { ...PHONE_CHART, left: 46.83, inset: 25, labelRight: 39.83, foot: 52.9, keyFoot: 44.66 };

/**
 * Each layout's frames. Pace's plot starts 5 pt further right (406:1801; the
 * twin keeps Grade-Adjusted and Lap Average Pace at the usual 39.83), the
 * forced labels (Vertical Ratio, Ground Contact Time) end 2 pt further right,
 * Power's plot sits 19.7 pt higher with the room under its axis instead
 * (406:1426, as the phone draws it), Stamina's plot is 89.33 pt, and Run/Walk's
 * three lanes are 30.22 pt apart from 46.83 pt (406:1667, 415:3749).
 */
export const FRAMES = {
	phone: {
		chart: PHONE_CHART,
		pace: { ...PHONE_CHART, left: 44.83, labelRight: 37.83 },
		forced: { ...PHONE_CHART, labelRight: 34.83 },
		power: { ...PHONE_CHART, top: 5.5, foot: 69.86 },
		stamina: { ...PHONE_CHART, height: 89.33, dotGap: 9.57 },
		runWalk: { ...PHONE_CHART, left: 46.83, inset: 18.92, top: 23.86, height: 90.67, labelRight: 40.5, dotGap: 9.84, labelGap: 12.9, titleGap: 32.77, keyGap: 57.83 },
	},
	pane: {
		chart: PANE_CHART,
		pace: { ...PANE_CHART, left: 51.83, labelRight: 44.83 },
		forced: { ...PANE_CHART, labelRight: 41.83 },
		power: { ...PANE_CHART, top: 5.5, foot: 72.93 },
		stamina: { ...PANE_CHART, height: 89.33, dotGap: 9.57 },
		runWalk: { ...PANE_CHART, left: 53.85, inset: 24.94, top: 23.86, height: 90.67, labelRight: 47.5, dotGap: 9.84, labelGap: 12.9, titleGap: 32.77, keyGap: 57.83 },
	},
} as const satisfies Record<ChartLayout, Record<string, ChartFrame>>;

/** A chart with no figures (Performance Condition) starts its box this far under its title, where the figures would end. */
export const NO_FIGURES_GAP = 18.75;

/** The x axis' dots: 8.33 pt across. */
export const AXIS_DOT_R = 4.165;
/** A dot chart's dots: 4.7 pt across on the phone, 5 pt in the expanded chart. */
export const MARK_R = 2.35;
export const EXPANDED_MARK_R = 2.5;
/** The narrowest a Run/Walk bar is drawn: the 3.8 s walk is a hairline. */
export const MIN_BAR = 0.67;

/** The expanded chart's frame: box coordinates from under its page bar, the plot's height from the view's. */
export interface ExpandedFrame {
	/** The plot's left edge and right inset; the labels' edges. */
	left: number;
	inset: number;
	leftLabelRight: number;
	/** The overlay's labels start this far short of the plot's right edge, over its end as on the phone. */
	rightLabelInset: number;
	/** The plot's top under the bar. */
	top: number;
	dotGap: number;
	labelGap: number;
	titleGap: number;
	/** The chip row under the axis title's centre, its height, and the room under it. */
	chipsGap: number;
	chips: number;
	bottom: number;
}

/**
 * The twin's expanded chart (page state): phone 411:1340 (402 × 874), pane
 * 416:86199 (1190 × 664). The twin draws the tick row past the plot's right
 * end, as Garmin's landscape chart does; here the ticks stay on the plot, so a
 * label sits over the sample it names.
 */
export const EXPANDED = {
	phone: { left: 46.76, inset: 40.86, leftLabelRight: 38, rightLabelInset: 1.14, top: 62.14, dotGap: 25.35, labelGap: 11.63, titleGap: 31.13, chipsGap: 40.4, chips: 36, bottom: 32 },
	pane: { left: 85.19, inset: 58.92, leftLabelRight: 70, rightLabelInset: 11.08, top: 64.95, dotGap: 24.58, labelGap: 11.63, titleGap: 31.13, chipsGap: 52.4, chips: 36, bottom: 32 },
} as const satisfies Record<ChartLayout, ExpandedFrame>;

/** The expanded plot's least height, on a short view. */
export const MIN_EXPANDED_PLOT = 160;

/** Training Effect's scales: in from each side, five segments with 6 pt gaps and a 7.33 pt cap, 8 pt tall. */
export const TE_FRAME = { inset: 16, gap: 6, cap: 7.33, height: 8, knobR: 10, haloR: 14 } as const;

/** A zone row's bar track: from 16 pt to 112.67 pt short of the row's right edge (403:72). */
export const ZONE_TRACK = { left: 16, inset: 112.67 } as const;

/** Where the page turns from the phone's layout to a pane's: the container queries' 640 pt. */
export const PANE_WIDTH = 640;

/* ------------------------------------------------------------------ */

export interface PlotRect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** Where a chart's own marks go, in the box. */
export interface ChartMarks {
	/** An area or steps, closed on the plot's bottom (or on Performance Condition's 0). */
	area?: string;
	/** A line mark: Heart Rate Zones', an overlay's. */
	line?: string;
	/** A dot chart's dots by colour, each a zero-length stroke: draw with a round cap, `stroke-width` 2 × `scatterR`. */
	scatter?: Array<{ colour: ChartColour; d: string }>;
	scatterR?: number;
	/** Lap Average Pace's blocks. */
	blocks?: Array<{ x: number; y: number; width: number; height: number }>;
	/** Stamina's Potential, white over the area. */
	potential?: string;
	average?: { y: number; dashed: boolean };
	/** A white line: Performance Condition's 0, Impact Load Factor's 1.0. */
	reference?: { y: number };
	/** The fill's vertical gradient, over the plot rectangle (`gradientUnits="userSpaceOnUse"`). */
	fill?: { y1: number; y2: number };
	/** A line coloured by value: its gradient's ends and stops, top first. */
	zones?: { y1: number; y2: number; stops: Array<{ offset: number; colour: ChartColour }> };
}

export interface AxisMarks {
	labelRight: number;
	yLabels: Array<{ y: number; text: string }>;
	/** The x axis' tick dots, labels and title. */
	dots: Array<{ x: number; y: number; r: number }>;
	xLabels: Array<{ x: number; y: number; text: string }>;
	xTitle: { x: number; y: number; text: string };
}

export interface SeriesPlot extends ChartMarks, AxisMarks {
	width: number;
	height: number;
	plot: PlotRect;
	/** The key's row (Stamina's), centred. */
	keyY?: number;
}

/** A card's chart at `width`, on the phone or in a pane's card. */
export function seriesPlot(chart: SeriesChart, width: number, layout: ChartLayout = "phone"): SeriesPlot {
	const frames = FRAMES[layout];
	const f = frameOf(frames, chart);
	const plot = rectOf(f, width);
	const dotY = plot.bottom + f.dotGap;
	const out: SeriesPlot = {
		width,
		height: r2(dotY + (chart.legend ? f.keyGap + f.keyFoot : f.foot)),
		plot,
		...axisMarks(chart.x, chart.y, plot, f, dotY),
		...marksOf(chart, plot, MARK_R),
	};
	if (chart.legend) out.keyY = r2(dotY + f.keyGap);
	return out;
}

/**
 * The chart's frame in a layout: the one a sport's chart names (its
 * `MetricDef.frame`), else by the run's metric: Pace's, Power's, Stamina's, the
 * forced labels' (Vertical Ratio, GCT), or the usual one.
 */
function frameOf(frames: (typeof FRAMES)[ChartLayout], chart: SeriesChart): ChartFrame {
	if (chart.frame) return frames[chart.frame];
	switch (chart.metric) {
		case "pace":
			return frames.pace;
		case "power":
		case "power-per-kg":
			return frames.power;
		case "stamina":
			return frames.stamina;
		case "vertical-ratio":
		case "ground-contact-time":
			return frames.forced;
		default:
			return frames.chart;
	}
}

function rectOf(f: ChartFrame, width: number): PlotRect {
	return { left: f.left, right: r2(Math.max(f.left + 60, width - f.inset)), top: f.top, bottom: r2(f.top + f.height) };
}

function axisMarks(x: XAxis, y: YAxis, plot: PlotRect, f: ChartFrame, dotY: number): AxisMarks {
	const yRaw = rawY(y, plot);
	const xOf = (at: number) => r2(plot.left + at * (plot.right - plot.left));
	return {
		labelRight: f.labelRight,
		yLabels: y.labels.map((l) => ({ y: r2(yRaw(l.value)), text: l.text })),
		dots: x.ticks.map((t) => ({ x: xOf(t.at), y: r2(dotY), r: AXIS_DOT_R })),
		xLabels: x.ticks.map((t) => ({ x: xOf(t.at), y: r2(dotY + f.labelGap), text: t.text })),
		xTitle: { x: r2((plot.left + plot.right) / 2), y: r2(dotY + f.titleGap), text: x.title },
	};
}

/** A value's y on the axis, the scale carried on past the plot: labels and gradient stops. */
function rawY(axis: YAxis, plot: PlotRect): (v: number) => number {
	const span = axis.top - axis.bottom || 1;
	return (v) => plot.bottom - ((v - axis.bottom) / span) * (plot.bottom - plot.top);
}

/** A value's y, held inside the plot: a mark past the axis sits on its edge (Elevation's dip, a stop's pace). */
function clampedY(axis: YAxis, plot: PlotRect): (v: number) => number {
	const raw = rawY(axis, plot);
	return (v) => {
		if (v === Infinity) return axis.top > axis.bottom ? plot.top : plot.bottom;
		if (v === -Infinity) return axis.top > axis.bottom ? plot.bottom : plot.top;
		return Math.min(plot.bottom, Math.max(plot.top, raw(v)));
	};
}

/** A chart's marks in a plot rectangle: what its card draws, and the landscape's primary. */
export function marksOf(chart: SeriesChart, plot: PlotRect, markR: number): ChartMarks {
	const xOf = (at: number) => plot.left + at * (plot.right - plot.left);
	const yOf = clampedY(chart.y, plot);
	const marks: ChartMarks = {};
	if (chart.fill) marks.fill = { y1: plot.top, y2: plot.bottom };
	const base = chart.base === undefined ? plot.bottom : yOf(chart.base);
	switch (chart.mark) {
		case "area":
			marks.area = areaPath(chart.points, xOf, yOf, base);
			break;
		case "steps":
			marks.area = stepPath(chart.points, xOf, yOf, base);
			break;
		case "blocks":
			marks.blocks = (chart.blocks ?? []).map((b) => {
				const y = yOf(b.value);
				return { x: r2(xOf(b.from)), y: r2(y), width: r2(xOf(b.to) - xOf(b.from)), height: r2(plot.bottom - y) };
			});
			break;
		case "dots":
			marks.scatter = dotPaths(chart.points, chart.colours, chart.colour ?? "blue", xOf, yOf);
			marks.scatterR = markR;
			break;
		case "line":
			marks.line = linePath(chart.points.x.map((x, i) => [xOf(x), nullable(chart.points.y[i], yOf)]));
			break;
	}
	if (chart.stops?.length) marks.zones = zoneGradient(chart.stops, rawY(chart.y, plot));
	if (chart.line) marks.potential = linePath(chart.line.x.map((x, i) => [xOf(x), nullable(chart.line!.y[i], yOf)]));
	if (chart.average) marks.average = { y: r2(yOf(chart.average.value)), dashed: chart.average.dashed };
	if (chart.reference !== undefined) marks.reference = { y: r2(yOf(chart.reference)) };
	return marks;
}

/** The zones line's gradient, between its highest and lowest stop, top first. */
function zoneGradient(stops: NonNullable<SeriesChart["stops"]>, y: (v: number) => number): NonNullable<ChartMarks["zones"]> {
	const sorted = [...stops].sort((a, b) => b.value - a.value);
	const y1 = y(sorted[0]!.value);
	const y2 = y(sorted[sorted.length - 1]!.value);
	const span = y2 - y1 || 1;
	return {
		y1: r2(y1),
		y2: r2(y2),
		stops: sorted.map((s) => ({ offset: Math.round(((y(s.value) - y1) / span) * 10000) / 10000, colour: s.colour })),
	};
}

function nullable(v: number | null | undefined, f: (v: number) => number): number | null {
	return v === null || v === undefined ? null : f(v);
}

/** An area through the points, closed on `base`, one shape per run of values. */
export function areaPath(points: ChartPoints, xOf: (at: number) => number, yOf: (v: number) => number, base: number): string {
	const parts: string[] = [];
	let run: string[] = [];
	let first = 0;
	let last = 0;
	const close = () => {
		if (run.length) parts.push(`${run.join(" ")} L${r2(last)} ${r2(base)} L${r2(first)} ${r2(base)} Z`);
		run = [];
	};
	points.x.forEach((at, i) => {
		const v = points.y[i];
		if (v === null || v === undefined) return close();
		const x = xOf(at);
		if (!run.length) first = x;
		run.push(`${run.length ? "L" : "M"}${r2(x)} ${r2(yOf(v))}`);
		last = x;
	});
	close();
	return parts.join(" ");
}

/** Steps from `base`: each value held until the next sample, the shape closed on `base`. */
export function stepPath(points: ChartPoints, xOf: (at: number) => number, yOf: (v: number) => number, base: number): string {
	return stepRuns(points, xOf, yOf)
		.map((run) => {
			const first = run[0]!;
			const last = run[run.length - 1]!;
			return `M${first[0]} ${r2(base)} ${run.map(([x, y]) => `L${x} ${y}`).join(" ")} L${last[0]} ${r2(base)} Z`;
		})
		.join(" ");
}

/**
 * The corners of a step line, one list per run of values: a level is held
 * until the next sample, and a point is added only where the level changes,
 * so a long hold is one segment.
 */
function stepRuns(points: ChartPoints, xOf: (at: number) => number, yOf: (v: number) => number): Array<Array<[number, number]>> {
	const runs: Array<Array<[number, number]>> = [];
	const n = points.x.length;
	let i = 0;
	while (i < n) {
		if (isGap(points.y[i])) {
			i += 1;
			continue;
		}
		const run: Array<[number, number]> = [];
		let level: number | null = null;
		let end = 0;
		while (i < n && !isGap(points.y[i])) {
			const x = r2(xOf(points.x[i]!));
			const y = r2(yOf(points.y[i]!));
			if (y !== level) {
				if (level !== null) run.push([x, level]);
				run.push([x, y]);
				level = y;
			}
			end = r2(xOf(points.x[Math.min(i + 1, n - 1)]!));
			i += 1;
		}
		run.push([end, level!]);
		runs.push(run);
	}
	return runs;
}

function isGap(v: number | null | undefined): boolean {
	return v === null || v === undefined;
}

/** Dots as zero-length strokes, one path per colour, in the order the colours first appear. */
export function dotPaths(
	points: ChartPoints,
	colours: ReadonlyArray<ChartColour | null> | undefined,
	fallback: ChartColour,
	xOf: (at: number) => number,
	yOf: (v: number) => number,
): Array<{ colour: ChartColour; d: string }> {
	const byColour = new Map<ChartColour, string[]>();
	points.x.forEach((at, i) => {
		const v = points.y[i];
		if (v === null || v === undefined) return;
		const colour = colours?.[i] ?? fallback;
		let list = byColour.get(colour);
		if (!list) byColour.set(colour, (list = []));
		list.push(`M${r2(xOf(at))} ${r2(yOf(v))}h0.01`);
	});
	return [...byColour].map(([colour, d]) => ({ colour, d: d.join("") }));
}

/* ------------------------------------------------------------------ */
/*  Run/Walk                                                           */
/* ------------------------------------------------------------------ */

export interface RunWalkPlot extends AxisMarks {
	width: number;
	height: number;
	plot: PlotRect;
	/** Each lane's line, labelled at `labelRight`: Idle at the plot's top, Walk, Run. */
	lanes: Array<{ y: number; label: string; colour: ChartColour }>;
	/** Bars rise from the plot's bottom to their lane's line. */
	bars: Array<{ x: number; y: number; width: number; height: number; colour: ChartColour }>;
	keyY: number;
}

export function runWalkPlot(chart: RunWalkChart, width: number, layout: ChartLayout = "phone"): RunWalkPlot {
	const f = FRAMES[layout].runWalk;
	const plot = rectOf(f, width);
	const dotY = plot.bottom + f.dotGap;
	// The lanes are its labels: no value axis.
	const axis = axisMarks(chart.x, { bottom: 0, top: 1, labels: [] }, plot, f, dotY);
	return { width, height: r2(dotY + f.keyGap + f.keyFoot), plot, ...axis, ...lanesIn(chart, plot), keyY: r2(dotY + f.keyGap) };
}

/** Run/Walk's lanes in a plot: Idle on its top edge, Walk, Run, evenly down to its bottom; each bar rises to its lane. */
function lanesIn(chart: RunWalkChart, plot: PlotRect): Pick<RunWalkPlot, "lanes" | "bars"> {
	const pitch = (plot.bottom - plot.top) / chart.lanes.length;
	const lanes = chart.lanes.map((l, i) => ({ y: r2(plot.top + i * pitch), label: l.label, colour: l.colour }));
	const xOf = (at: number) => plot.left + at * (plot.right - plot.left);
	const bars = chart.bars.map((b) => {
		const lane = Math.max(0, chart.lanes.findIndex((l) => l.lane === b.lane));
		const top = plot.top + lane * pitch;
		const x = xOf(b.from);
		return { x: r2(x), y: r2(top), width: r2(Math.max(MIN_BAR, xOf(b.to) - x)), height: r2(plot.bottom - top), colour: chart.lanes[lane]!.colour };
	});
	return { lanes, bars };
}

/* ------------------------------------------------------------------ */
/*  Training Effect and the zone bars                                  */
/* ------------------------------------------------------------------ */

export interface TrainingEffectScale {
	label: string;
	/** Five segments and the red cap, left to right. */
	segments: Array<{ x: number; width: number; colour: ChartColour }>;
	/** The knob's centre, ignoring the gaps: 16 + value / 5 × the scale's width. */
	knob: { x: number; colour: ChartColour };
}

export function trainingEffectScales(chart: TrainingEffectChart, width: number): TrainingEffectScale[] {
	return scalesIn(chart, TE_FRAME.inset, Math.max(60, width - 2 * TE_FRAME.inset));
}

function scalesIn(chart: TrainingEffectChart, left: number, span: number): TrainingEffectScale[] {
	const segment = (span - TE_SEGMENTS.length * TE_FRAME.gap - TE_FRAME.cap) / TE_SEGMENTS.length;
	const segments = TE_SEGMENTS.map((colour, i) => ({ x: r2(left + i * (segment + TE_FRAME.gap)), width: r2(segment), colour }));
	segments.push({ x: r2(left + span - TE_FRAME.cap), width: TE_FRAME.cap, colour: TE_CAP });
	return chart.scales.map((s) => ({ label: s.label, segments, knob: { x: r2(left + (s.value / TE_MAX) * span), colour: s.colour } }));
}

export interface ZoneBar {
	zone: number;
	track: { x: number; width: number };
	/** Null at 0%: an empty track. */
	fill: { x: number; width: number } | null;
	colour: ChartColour;
}

export function zoneBars(chart: ZonesChart, width: number): ZoneBar[] {
	const track = { x: ZONE_TRACK.left, width: r2(Math.max(60, width - ZONE_TRACK.left - ZONE_TRACK.inset)) };
	return chart.rows.map((row) => ({
		zone: row.zone,
		track,
		fill: row.fill > 0 ? { x: track.x, width: r2(row.fill * track.width) } : null,
		colour: row.colour,
	}));
}

/* ------------------------------------------------------------------ */
/*  Landscape                                                          */
/* ------------------------------------------------------------------ */

export interface ExpandedPlot extends Omit<AxisMarks, "labelRight" | "yLabels" | "xTitle"> {
	layout: ChartLayout;
	width: number;
	/** The box's height, to the axis title; the chip row's top under the box's top. */
	height: number;
	chipsTop: number;
	plot: PlotRect;
	/** The left axis' labels: the primary's values, or Run/Walk's lane names. */
	leftLabelRight: number;
	leftLabels: Array<{ y: number; text: string }>;
	/** Null without a time axis (Training Effect). */
	xTitle: AxisMarks["xTitle"] | null;
	/** A chart of samples' marks, at half opacity while `dim`; empty for Run/Walk and Training Effect. */
	primary: ChartMarks;
	/** Run/Walk as the primary: its lanes and bars across the plot. */
	lanes?: RunWalkPlot["lanes"];
	bars?: RunWalkPlot["bars"];
	/** Training Effect as the primary: its two scales across the plot, a third and two thirds down. */
	scales?: Array<TrainingEffectScale & { y: number }>;
	dim: boolean;
	/** The overlay on the right axis, its labels left-aligned at `rightLabelLeft` in its colour. */
	secondary: (ChartMarks & { colour: ChartColour }) | null;
	rightLabelLeft: number;
	rightLabels: Array<{ y: number; text: string }>;
}

/**
 * The expanded chart in the room its view leaves under the page bar: `width`
 * and `height` are that room's. The plot takes the height the axis, the chip
 * row and their gaps leave, never under `MIN_EXPANDED_PLOT`.
 */
export function expandedPlot(view: ExpandedChartView, width: number, height: number): ExpandedPlot {
	const layout: ChartLayout = width >= PANE_WIDTH ? "pane" : "phone";
	const E = EXPANDED[layout];
	const below = E.dotGap + E.titleGap + E.chipsGap + E.chips + E.bottom;
	const plotHeight = Math.max(MIN_EXPANDED_PLOT, height - E.top - below);
	const plot: PlotRect = { left: E.left, right: r2(Math.max(E.left + 120, width - E.inset)), top: E.top, bottom: r2(E.top + plotHeight) };
	const xOf = (at: number) => r2(plot.left + at * (plot.right - plot.left));
	const ticks = view.x?.ticks ?? [];
	const dotY = r2(plot.bottom + E.dotGap);
	const titleY = r2(dotY + E.titleGap);
	const out: ExpandedPlot = {
		layout,
		width,
		height: r2(titleY + 8),
		chipsTop: r2(titleY + E.chipsGap),
		plot,
		leftLabelRight: E.leftLabelRight,
		leftLabels: [],
		dots: ticks.map((t) => ({ x: xOf(t.at), y: dotY, r: AXIS_DOT_R })),
		xLabels: ticks.map((t) => ({ x: xOf(t.at), y: r2(dotY + E.labelGap), text: t.text })),
		xTitle: view.x ? { x: r2((plot.left + plot.right) / 2), y: titleY, text: view.x.title } : null,
		primary: {},
		dim: view.dim,
		secondary: null,
		rightLabelLeft: r2(plot.right - E.rightLabelInset),
		rightLabels: [],
	};
	const primary = view.primary;
	if (primary.kind === "series") {
		const left = rawY(primary.y, plot);
		out.leftLabels = primary.y.labels.map((l) => ({ y: r2(left(l.value)), text: l.text }));
		out.primary = marksOf(primary, plot, EXPANDED_MARK_R);
	} else if (primary.kind === "run-walk") {
		const { lanes, bars } = lanesIn(primary, plot);
		out.lanes = lanes;
		out.bars = bars;
		out.leftLabels = lanes.map((l) => ({ y: l.y, text: l.label }));
	} else {
		const span = plot.right - plot.left;
		out.scales = scalesIn(primary, plot.left, span).map((s, i) => ({ ...s, y: r2(plot.top + ((i + 1) * (plot.bottom - plot.top)) / 3) }));
	}
	if (view.secondary) {
		const right = rawY(view.secondary.y, plot);
		out.secondary = { ...overlayMarks(view.secondary, plot), colour: view.secondary.colour };
		out.rightLabels = view.secondary.y.labels.map((l) => ({ y: r2(right(l.value)), text: l.text }));
	}
	return out;
}

/** An overlay's marks on its own axis: a line in its colour, its banded dots, its steps, or the zones line. */
function overlayMarks(series: OverlaySeries, plot: PlotRect): ChartMarks {
	const xOf = (at: number) => plot.left + at * (plot.right - plot.left);
	const yOf = clampedY(series.y, plot);
	switch (series.mark) {
		case "dots":
			return { scatter: dotPaths(series.points, series.colours, series.colour, xOf, yOf), scatterR: EXPANDED_MARK_R };
		case "steps":
			return { line: stepLine(series.points, xOf, yOf) };
		case "zones": {
			const marks: ChartMarks = { line: linePath(series.points.x.map((x, i) => [xOf(x), nullable(series.points.y[i], yOf)])) };
			if (series.stops?.length) marks.zones = zoneGradient(series.stops, rawY(series.y, plot));
			return marks;
		}
		case "line":
			return { line: linePath(series.points.x.map((x, i) => [xOf(x), nullable(series.points.y[i], yOf)])) };
	}
}

/** A step line: each value held until the next sample. */
function stepLine(points: ChartPoints, xOf: (at: number) => number, yOf: (v: number) => number): string {
	return stepRuns(points, xOf, yOf)
		.map((run) => run.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "))
		.join(" ");
}
