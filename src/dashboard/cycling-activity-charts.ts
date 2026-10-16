import { AXIS_DOT_R, MIN_BAR, ZONE_TRACK, type ChartLayout, type PlotRect } from "./activity-charts";
import type { ChartColour } from "./activity-chart-pages";
import type { CurveVertex, PlatformOffsetData, PositionData, PowerCurveData, PowerPhaseData, TimeInPositionData } from "./cycling-metrics";
import { r2 } from "./stat-charts";

/**
 * Where a ride's own cards draw (`cycling-metrics.ts` gives their data):
 * Position's lanes, Time in Position's bars, the Power Phase dials, the
 * Platform Offset pedals and the Power Curve, each in the box under its
 * card's title, at the width the card gets.
 *
 * The numbers are the Obsidian twin's (Figma 8D338zFIJ1a2zrsuligjva, page
 * 886:5: Chart · Position 948:8008, Time in Position 950:659, Power Phase and
 * Balance 951:176908, Platform Offset 951:177238, Power Curve 952:1053 and
 * 952:1164), which keep the phone's (ref/activity-details/road-cycling,
 * `phone/charts-time/05`–`14`), each body from the bottom of the card's title
 * line (`ChartSection`'s head: the band, 15.43 pt, then 22). A pane's card
 * keeps the phone's layout 7 pt further in on the left and 2.83 pt on the
 * right, inside its border, as the run's charts do (the twin's 370 pt cards).
 *
 * Pure.
 */

/** How much further in a pane's card draws than the phone's, at each side. */
const PANE_SHIFT = { left: 7, right: 2.83 } as const;

function shiftOf(layout: ChartLayout): { left: number; right: number } {
	return layout === "pane" ? PANE_SHIFT : { left: 0, right: 0 };
}

/** The phone's side margin. */
const MARGIN = 16;

/* ------------------------------------------------------------------ */
/*  Position                                                           */
/* ------------------------------------------------------------------ */

/**
 * Position: a 192 pt plot from x 73.83 to 19.17 short of the right edge, 50.37
 * under the title; lines at its top (Standing), a quarter and a half down
 * (Seated) and its bottom; the lane names right-aligned at 66.33 on their
 * lines; the tick dots 14.5 under the plot, the labels 13.04 and the axis
 * title 32.81 under them (306.7 tall).
 */
export const POSITION_FRAME = {
	left: 73.83,
	inset: 19.17,
	labelRight: 66.33,
	top: 50.37,
	height: 192,
	/** The gridlines' places down the plot: Standing's line, the quarter, Seated's, the baseline. */
	grid: [0, 0.25, 0.5, 1],
	dotGap: 14.5,
	labelGap: 13.04,
	titleGap: 32.81,
	foot: 49.83,
} as const;

export interface PositionPlot {
	width: number;
	height: number;
	plot: PlotRect;
	/** Each gridline's y, top first. */
	grid: number[];
	/** The lane names, right-aligned at `labelRight` on their lines. */
	labelRight: number;
	lanes: Array<{ y: number; label: string; colour: ChartColour }>;
	/** Seated first, Standing over it; each rises from the baseline to its lane's line. */
	bars: Array<{ x: number; y: number; width: number; height: number; colour: ChartColour }>;
	dots: Array<{ x: number; y: number; r: number }>;
	xLabels: Array<{ x: number; y: number; text: string }>;
	xTitle: { x: number; y: number; text: string };
}

export function positionPlot(data: PositionData, width: number, layout: ChartLayout = "phone"): PositionPlot {
	const f = POSITION_FRAME;
	const s = shiftOf(layout);
	const left = f.left + s.left;
	const plot: PlotRect = { left, right: r2(Math.max(left + 60, width - f.inset - s.right)), top: f.top, bottom: r2(f.top + f.height) };
	const span = plot.right - plot.left;
	const xOf = (at: number) => plot.left + at * span;
	// Lanes evenly from the top: two put Standing on the top line and Seated halfway down.
	const pitch = f.height / Math.max(1, data.lanes.length);
	const laneOf = (id: string) => Math.max(0, data.lanes.findIndex((l) => l.id === id));
	const bars = [...data.bars]
		.sort((a, b) => laneOf(b.lane) - laneOf(a.lane) || a.from - b.from)
		.map((bar) => {
			const lane = laneOf(bar.lane);
			const top = plot.top + lane * pitch;
			const x = xOf(bar.from);
			return { x: r2(x), y: r2(top), width: r2(Math.max(MIN_BAR, xOf(bar.to) - x)), height: r2(plot.bottom - top), colour: data.lanes[lane]!.colour };
		});
	const dotY = r2(plot.bottom + f.dotGap);
	return {
		width,
		height: r2(dotY + f.foot),
		plot,
		grid: f.grid.map((g) => r2(plot.top + g * f.height)),
		labelRight: f.labelRight + s.left,
		lanes: data.lanes.map((l, i) => ({ y: r2(plot.top + i * pitch), label: l.label, colour: l.colour })),
		bars,
		dots: data.x.ticks.map((t) => ({ x: r2(xOf(t.at)), y: dotY, r: AXIS_DOT_R })),
		xLabels: data.x.ticks.map((t) => ({ x: r2(xOf(t.at)), y: r2(dotY + f.labelGap), text: t.text })),
		xTitle: { x: r2((plot.left + plot.right) / 2), y: r2(dotY + f.titleGap), text: data.x.title },
	};
}

/* ------------------------------------------------------------------ */
/*  Time in Position                                                   */
/* ------------------------------------------------------------------ */

/**
 * Time in Position is the zone rows' layout (`ZoneRows`, the twin's Zone Row
 * with no range): 44 pt rows 57.67 apart, the first 16.24 under the title,
 * each name over an 8 pt track 29.97 down the row, from 16 to 112.67 short of
 * the right edge (16 → 289.33 on the phone), the time and the share right of
 * it; 30.62 under the last row (148.53 tall for two).
 */
export const SHARE_ROWS = { top: 16.24, pitch: 57.67, row: 44, track: 29.97, trackHeight: 8, foot: 30.62 } as const;

export interface PositionShareBar {
	/** The row's top, its track's and the track's span. */
	y: number;
	trackY: number;
	track: { x: number; width: number };
	/** Null at 0%: an empty track. */
	fill: { x: number; width: number } | null;
	colour: ChartColour;
}

export interface TimeInPositionPlot {
	width: number;
	height: number;
	bars: PositionShareBar[];
}

export function timeInPositionPlot(data: TimeInPositionData, width: number): TimeInPositionPlot {
	const R = SHARE_ROWS;
	const track = { x: ZONE_TRACK.left, width: r2(Math.max(60, width - ZONE_TRACK.left - ZONE_TRACK.inset)) };
	const bars = data.rows.map((row, i) => {
		const y = r2(R.top + i * R.pitch);
		return { y, trackY: r2(y + R.track), track, fill: row.fill > 0 ? { x: track.x, width: r2(row.fill * track.width) } : null, colour: row.colour };
	});
	const last = bars.at(-1);
	return { width, height: r2((last ? last.y + R.row : R.top) + R.foot), bars };
}

/* ------------------------------------------------------------------ */
/*  Power Phase and Balance                                            */
/* ------------------------------------------------------------------ */

/**
 * The dials: each 146.67 pt across, centred 73.2 in from its side margin (the
 * peak arc's outer edge on the margin) and 95.44 under the title; a 9.7 pt
 * ring from radius 57.6 to 67.3 carrying the power phase, the peak 57.7 → 73;
 * eight marks on radius 53 (Ø 6 at TDC, 90°, BDC and 270°, Ø 3.3 between),
 * "TDC" centred 36.62 above the centre, "BDC" 37.38 below, the side 2.13
 * below; the balance centred in each half of the card; then the key: two
 * blocks a row (the Power Phase Legend 950:771, 152.7 wide, hugging its side
 * margin), 88.67 apart: a 14 pt square and the title 18.1 right of it, two
 * values centred 38.33 and 115.33 in, split by a 0.5 pt hairline at 76.33;
 * 444.11 tall (the twin's, its bottom Inferred: the shot cuts it off).
 */
export const DIAL_FRAME = {
	inset: 73.2,
	cy: 95.44,
	ring: { inner: 57.6, outer: 67.3 },
	peak: { inner: 57.7, outer: 73 },
	marks: { r: 53, big: 3, small: 1.67 },
	tdc: -36.62,
	bdc: 37.38,
	side: 2.13,
	balance: { value: 207.28, label: 233.34 },
	keys: {
		/** The first row's square and title, centred. */
		top: 273.6,
		pitch: 88.67,
		square: 14,
		/** The title's left, from the square's. */
		title: 18.1,
		/** Each column's width, hugging its side margin. */
		column: 152.7,
		/** The two values' centres and the hairline's x, from the column's left; their lines' centres under the title's. */
		values: [38.33, 115.33],
		divider: 76.33,
		value: 23.53,
		label: 42.45,
		sub: 57.95,
		dividerTop: 14.67,
		dividerHeight: 48,
	},
	foot: 23.89,
} as const;

export interface DialPlot {
	cx: number;
	cy: number;
	/** The track: a circle at the ring's middle radius, as wide as the ring. */
	track: { r: number; width: number };
	/** The power phase on the ring and the peak proud of it, clockwise from TDC; null without one. */
	phase: { d: string; colour: ChartColour } | null;
	peak: { d: string; colour: ChartColour } | null;
	/** The quarters' marks are the big ones. */
	marks: Array<{ x: number; y: number; r: number; quarter: boolean }>;
	tdc: { x: number; y: number };
	bdc: { x: number; y: number };
	label: { x: number; y: number; text: string };
	/** The balance's value and its label, centred at `x`; null without one. */
	balance: { x: number; valueY: number; labelY: number } | null;
}

export interface PhaseKeyPlot {
	square: { x: number; y: number; size: number };
	titleX: number;
	titleY: number;
	values: Array<{ x: number; valueY: number; labelY: number; subY: number }>;
	divider: { x: number; y1: number; y2: number };
}

export interface PowerPhasePlot {
	width: number;
	height: number;
	dials: DialPlot[];
	keys: PhaseKeyPlot[];
}

/** A point on a dial: `deg` clockwise from TDC (the top), at radius `r`. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
	const a = (deg * Math.PI) / 180;
	return [r2(cx + r * Math.sin(a)), r2(cy - r * Math.cos(a))];
}

/** A ring's segment between two radii, clockwise from `from` to `to` degrees. */
export function ringArc(cx: number, cy: number, inner: number, outer: number, from: number, to: number): string {
	const sweep = (((to - from) % 360) + 360) % 360;
	const large = sweep > 180 ? 1 : 0;
	const [ox1, oy1] = polar(cx, cy, outer, from);
	const [ox2, oy2] = polar(cx, cy, outer, from + sweep);
	const [ix2, iy2] = polar(cx, cy, inner, from + sweep);
	const [ix1, iy1] = polar(cx, cy, inner, from);
	return `M${ox1} ${oy1} A${outer} ${outer} 0 ${large} 1 ${ox2} ${oy2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`;
}

export function powerPhasePlot(data: PowerPhaseData, width: number, layout: ChartLayout = "phone"): PowerPhasePlot {
	const f = DIAL_FRAME;
	const s = shiftOf(layout);
	const leftEdge = MARGIN + s.left;
	const rightEdge = width - MARGIN - s.right;
	const middle = (leftEdge + rightEdge) / 2;
	const dials = data.dials.map((dial, i): DialPlot => {
		const cx = r2(i === 0 ? leftEdge + f.inset : rightEdge - f.inset);
		const cy = f.cy;
		const marks = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
			const [x, y] = polar(cx, cy, f.marks.r, deg);
			const quarter = deg % 90 === 0;
			return { x, y, r: quarter ? f.marks.big : f.marks.small, quarter };
		});
		return {
			cx,
			cy,
			track: { r: r2((f.ring.inner + f.ring.outer) / 2), width: r2(f.ring.outer - f.ring.inner) },
			phase: dial.phase ? { d: ringArc(cx, cy, f.ring.inner, f.ring.outer, dial.phase.start, dial.phase.end), colour: dial.phase.colour } : null,
			peak: dial.peak ? { d: ringArc(cx, cy, f.peak.inner, f.peak.outer, dial.peak.start, dial.peak.end), colour: dial.peak.colour } : null,
			marks,
			tdc: { x: cx, y: r2(cy + f.tdc) },
			bdc: { x: cx, y: r2(cy + f.bdc) },
			label: { x: cx, y: r2(cy + f.side), text: dial.label },
			// The balance sits in the middle of its half of the card, not under the dial.
			balance: dial.balance ? { x: r2(i === 0 ? (leftEdge + middle) / 2 : (middle + rightEdge) / 2), valueY: f.balance.value, labelY: f.balance.label } : null,
		};
	});
	const K = f.keys;
	const keys = data.keys.map((_, i): PhaseKeyPlot => {
		const left = i % 2 === 0 ? leftEdge : rightEdge - K.column;
		const y = r2(K.top + Math.floor(i / 2) * K.pitch);
		return {
			square: { x: r2(left), y: r2(y - K.square / 2), size: K.square },
			titleX: r2(left + K.title),
			titleY: y,
			values: K.values.map((dx) => ({ x: r2(left + dx), valueY: r2(y + K.value), labelY: r2(y + K.label), subY: r2(y + K.sub) })),
			divider: { x: r2(left + K.divider), y1: r2(y + K.dividerTop), y2: r2(y + K.dividerTop + K.dividerHeight) },
		};
	});
	const rows = Math.ceil(data.keys.length / 2);
	const height = rows ? K.top + (rows - 1) * K.pitch + K.sub + f.foot : f.balance.label + f.foot;
	return { width, height: r2(height), dials, keys };
}

/* ------------------------------------------------------------------ */
/*  Platform Offset                                                    */
/* ------------------------------------------------------------------ */

/**
 * Platform Offset: each pedal centred in its half of the card, a 1 pt
 * divider between, from 30.9 to 168.9 under the title, as the red average
 * line (2 pt, 1.05 pt a mm toward "+", outboard) and the dashed centre line
 * from 29.9; the pedal art (the twin's five traced tones, its "+" and "−"
 * among them) 50.29 left of the left pedal's centre and 38.61 down, the right
 * pedal's mirrored; the value 184.34, the pedal's name 204.34 and the key
 * 228.9 under the title (252.5 tall).
 */
export const PEDAL_FRAME = {
	line: { top: 30.9, bottom: 168.9 },
	centre: { top: 29.9, bottom: 168.9 },
	mmScale: 1.05,
	/** The art's origin from the pedal's centre: its outboard reach and its top. */
	art: { outboard: 50.29, top: 38.61 },
	value: 184.34,
	label: 204.34,
	keys: 228.9,
	foot: 252.5,
} as const;

export interface PedalPlot {
	cx: number;
	/** The dashed centre line. */
	centre: { x: number; y1: number; y2: number };
	/** The red average line; null without an average. */
	average: { x: number; y1: number; y2: number } | null;
	/** Where the left pedal's art goes, its origin at (`x`, `y`); the right pedal's is the left one mirrored about its centre. */
	art: { x: number; y: number; mirrored: boolean };
	value: { x: number; y: number; text: string };
	label: { x: number; y: number; text: string };
}

export interface PlatformOffsetPlot {
	width: number;
	height: number;
	divider: { x: number; y1: number; y2: number };
	pedals: PedalPlot[];
	keysY: number;
}

export function platformOffsetPlot(data: PlatformOffsetData, width: number, layout: ChartLayout = "phone"): PlatformOffsetPlot {
	const f = PEDAL_FRAME;
	const s = shiftOf(layout);
	const leftEdge = MARGIN + s.left;
	const rightEdge = width - MARGIN - s.right;
	const middle = r2((leftEdge + rightEdge) / 2);
	const pedals = data.pedals.map((pedal, i): PedalPlot => {
		const cx = r2(i === 0 ? (leftEdge + middle) / 2 : (middle + rightEdge) / 2);
		// "+" is outboard: left of the left pedal, right of the right one.
		const toPlus = pedal.plus === "left" ? -1 : 1;
		const mirrored = pedal.side === "right";
		return {
			cx,
			centre: { x: cx, y1: f.centre.top, y2: f.centre.bottom },
			average: pedal.offset === null ? null : { x: r2(cx + toPlus * f.mmScale * pedal.offset), y1: f.line.top, y2: f.line.bottom },
			art: { x: r2(mirrored ? cx + f.art.outboard : cx - f.art.outboard), y: f.art.top, mirrored },
			value: { x: cx, y: f.value, text: pedal.value },
			label: { x: cx, y: f.label, text: pedal.label },
		};
	});
	return { width, height: f.foot, divider: { x: middle, y1: f.line.top, y2: f.line.bottom }, pedals, keysY: f.keys };
}

/* ------------------------------------------------------------------ */
/*  Power Curve                                                        */
/* ------------------------------------------------------------------ */

/**
 * The Power Curve: the subtitle centred 15.03 under the title; the axis' top
 * 65.4 and its 0 253.4 under it (188 pt); 0.67 pt gridlines over the areas
 * from the first duration to 15.83 short of the right edge, their labels
 * right-aligned at 36.13 (W) or 28.13 (W/kg) and the first duration 17.04
 * past them; the 14 duration dots (Ø 5.67) 7.17 under the axis' 0, their
 * labels on end centred 287.47 under the title; "Interval Length" centred on
 * the card at 327.27; the key at 366.42 (386.87 tall).
 */
export const CURVE_FRAME = {
	subtitle: 15.03,
	top: 65.4,
	zero: 253.4,
	labelRight: { W: 36.13, "W/kg": 28.13 },
	gap: 17.04,
	inset: 15.83,
	gridWidth: 0.67,
	dotY: 260.57,
	dotR: 2.835,
	durationY: 287.47,
	titleY: 327.27,
	keysY: 366.42,
	foot: 386.87,
} as const;

/** A curve as drawn: its points, the straight line through them, and its area down to the axis' 0. */
export interface CurvePaths {
	points: Array<{ x: number; y: number }>;
	/** "" without a point; a lone point is a zero-length segment, which a round cap draws as a dot. */
	line: string;
	area: string;
}

export interface CurvePlot {
	width: number;
	height: number;
	/** The first duration's x and the last's. */
	left: number;
	right: number;
	subtitleY: number;
	/** Top first: each tick's line and label. */
	grid: Array<{ y: number; x1: number; x2: number; label: string; zero: boolean }>;
	labelRight: number;
	dots: Array<{ x: number; y: number; r: number }>;
	/** Each duration's name on end, reading bottom to top, centred at its point. */
	labels: Array<{ x: number; y: number; text: string }>;
	title: { x: number; y: number; text: string };
	keysY: number;
	/** The Record drawn first, This Activity over it. */
	record: CurvePaths;
	activity: CurvePaths;
}

function curvePaths(vertices: readonly CurveVertex[], place: (v: CurveVertex) => { x: number; y: number }, base: number): CurvePaths {
	const points = vertices.map(place);
	if (!points.length) return { points, line: "", area: "" };
	const first = points[0]!;
	const last = points.at(-1)!;
	const along = points.slice(points.length > 1 ? 1 : 0).map((p) => `L${p.x} ${p.y}`);
	return {
		points,
		line: [`M${first.x} ${first.y}`, ...along].join(" "),
		area: [`M${first.x} ${base}`, ...points.map((p) => `L${p.x} ${p.y}`), `L${last.x} ${base}`, "Z"].join(" "),
	};
}

export function powerCurvePlot(data: PowerCurveData, width: number, layout: ChartLayout = "phone"): CurvePlot {
	const f = CURVE_FRAME;
	const s = shiftOf(layout);
	const labelRight = f.labelRight[data.unit] + s.left;
	const left = r2(labelRight + f.gap);
	const right = r2(Math.max(left + 60, width - f.inset - s.right));
	const span = right - left;
	const top = data.top > 0 ? data.top : 1;
	const yOf = (value: number) => f.zero - (value / top) * (f.zero - f.top);
	const place = (v: CurveVertex) => ({ x: r2(left + v.x * span), y: r2(yOf(v.value)) });
	return {
		width,
		height: f.foot,
		left,
		right,
		subtitleY: f.subtitle,
		grid: data.ticks.map((t) => ({ y: r2(yOf(t.value)), x1: left, x2: right, label: t.text, zero: t.value === 0 })),
		labelRight: r2(labelRight),
		dots: data.durations.map((d) => ({ x: r2(left + d.x * span), y: f.dotY, r: f.dotR })),
		labels: data.durations.map((d) => ({ x: r2(left + d.x * span - 0.5), y: f.durationY, text: d.label })),
		title: { x: r2(width / 2), y: f.titleY, text: data.axisTitle },
		keysY: f.keysY,
		record: curvePaths(data.record, place, f.zero),
		activity: curvePaths(data.activity, place, f.zero),
	};
}
