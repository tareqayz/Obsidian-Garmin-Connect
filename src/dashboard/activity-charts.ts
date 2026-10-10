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
 * the landscape chart's. Measured off the phone's shots (402 pt portrait,
 * 874 × 402 landscape); phase 2 matches the frames to the Obsidian twin, so
 * every inset and height is a constant here, in one place.
 *
 * A portrait box starts under the card's figures (or its title when it has
 * none) and runs to the card's end; the plot stretches across the width and
 * keeps the phone's heights.
 *
 * Pure.
 */

/** A portrait chart's frame: box coordinates, y down from the box's top. */
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
 * The phone's frames. Plot 137 pt tall, its bottom 11.8 pt above the dots;
 * left edge 39.7 pt (Pace's 44.7: its labels sit 5 pt further right, though
 * Grade-Adjusted and Lap Average Pace's do not), right edge 379.7 pt. Labels
 * end 5.5 pt short of the plot. Stamina's plot is 89 pt; Run/Walk's three
 * lanes are 30.1 pt apart from 46.7 to 382.9 pt. The gap above the plot (30 pt
 * under the figures) is the twin's to settle.
 */
const CHART: ChartFrame = {
	left: 39.7,
	inset: 22.3,
	top: 30,
	height: 137,
	labelRight: 34.2,
	dotGap: 11.8,
	labelGap: 13.2,
	titleGap: 34.2,
	keyGap: 57.3,
	foot: 48,
	keyFoot: 18,
};

export const FRAMES = {
	chart: CHART,
	pace: { ...CHART, left: 44.7, labelRight: 39.4 },
	stamina: { ...CHART, height: 89, dotGap: 9 },
	runWalk: { ...CHART, left: 46.7, inset: 19.1, height: 90.3, labelRight: 41.9, dotGap: 9.6 },
} as const satisfies Record<string, ChartFrame>;

/** The x axis' dots: 7.7 pt across, grey. */
export const AXIS_DOT_R = 3.85;
/** A dot chart's dots: 4.7 pt across on the phone, 5 pt in landscape. */
export const MARK_R = 2.35;
export const LANDSCAPE_MARK_R = 2.5;
/** The narrowest a Run/Walk bar is drawn: the 3.8 s walk is a hairline on the phone. */
export const MIN_BAR = 0.5;

/**
 * The landscape chart at 874 × 402 pt: the plot from 117.7 to 768.7 pt with an
 * overlay (780.7 alone, where no right axis needs the room), 73.3 to 276.6 pt
 * down; the left labels end at 110.6 pt, the right ones start at 760.4 pt.
 */
export const LANDSCAPE = {
	width: 874,
	height: 402,
	left: 117.67,
	/** The plot's right inset with an overlay, and alone. */
	inset: 105.33,
	insetAlone: 93.33,
	top: 73.3,
	bottom: 276.6,
	leftLabelRight: 110.6,
	/** The right labels' left edge, short of the plot's right edge. */
	rightLabelInset: 8.27,
	dotY: 291.83,
	labelY: 304.6,
	titleY: 325.1,
} as const;

/** Training Effect's scales: 16 pt in from each side, five segments with 6 pt gaps and a 7.3 pt cap, 8 pt tall. */
export const TE_FRAME = { inset: 16, gap: 6, cap: 7.33, height: 8, knobR: 9.65, ring: 3.7 } as const;

/** A zone row's bar track: from 16 pt to 112.7 pt short of the right edge (16–289.3 pt on the phone). */
export const ZONE_TRACK = { left: 16, inset: 112.67 } as const;

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

/** A portrait chart at `width`. */
export function seriesPlot(chart: SeriesChart, width: number): SeriesPlot {
	const f = chart.metric === "pace" ? FRAMES.pace : chart.metric === "stamina" ? FRAMES.stamina : FRAMES.chart;
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

export function runWalkPlot(chart: RunWalkChart, width: number): RunWalkPlot {
	const f = FRAMES.runWalk;
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
	width: number;
	height: number;
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

export function expandedPlot(view: ExpandedChartView, width: number = LANDSCAPE.width): ExpandedPlot {
	const L = LANDSCAPE;
	const inset = view.secondary ? L.inset : L.insetAlone;
	const plot: PlotRect = { left: L.left, right: r2(Math.max(L.left + 120, width - inset)), top: L.top, bottom: L.bottom };
	const xOf = (at: number) => r2(plot.left + at * (plot.right - plot.left));
	const ticks = view.x?.ticks ?? [];
	const out: ExpandedPlot = {
		width,
		height: L.height,
		plot,
		leftLabelRight: L.leftLabelRight,
		leftLabels: [],
		dots: ticks.map((t) => ({ x: xOf(t.at), y: L.dotY, r: AXIS_DOT_R })),
		xLabels: ticks.map((t) => ({ x: xOf(t.at), y: L.labelY, text: t.text })),
		xTitle: view.x ? { x: r2((plot.left + plot.right) / 2), y: L.titleY, text: view.x.title } : null,
		primary: {},
		dim: view.dim,
		secondary: null,
		rightLabelLeft: r2(plot.right - L.rightLabelInset),
		rightLabels: [],
	};
	const primary = view.primary;
	if (primary.kind === "series") {
		const left = rawY(primary.y, plot);
		out.leftLabels = primary.y.labels.map((l) => ({ y: r2(left(l.value)), text: l.text }));
		out.primary = marksOf(primary, plot, LANDSCAPE_MARK_R);
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
			return { scatter: dotPaths(series.points, series.colours, series.colour, xOf, yOf), scatterR: LANDSCAPE_MARK_R };
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
