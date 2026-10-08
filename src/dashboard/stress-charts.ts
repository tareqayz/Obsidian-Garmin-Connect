import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";
import type { RingPart, StressPart, StressPeriodView, StressTimeline } from "./stress-pages";

/**
 * The Stress charts: their frames, measured off the Figma frames of the app
 * (Garmin / Stress, page 239:10: 1d 260:1478, 7d 255:17, 4w 258:421, 1y
 * 259:1265; the Obsidian twin, page 239:22, draws them 56pt higher on its
 * page at the same sizes), and the marks only Stress draws: the averages'
 * line, the day's bars, and the ring. The box every chart shares — gridlines,
 * y labels, the axis — comes from `stat-charts.ts`.
 *
 * A pane (the twin's 1190pt frames, the chart in a 748pt column) has frames
 * of its own: the plot from 32pt in to the column's edge and 240pt tall,
 * every mark below it where the phone has it.
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Every Stress chart: 0 to 100, labelled every 25, whatever the data. */
const TICKS = [100, 75, 50, 25, 0];

/* ------------------------------------------------------------------ */
/*  Daily and Weekly Averages                                          */
/* ------------------------------------------------------------------ */

/**
 * Figma's 7d and 4w frames (their title's bottom at 270.56): gridlines from
 * 323.5 to 504.75, the days from x 46 to 368.25. The 1y frame: gridlines from
 * 303.75 to 507.6, the months' dots from 35.75 to 358 under gridlines that
 * stop at 356.5, as measured off the phone. The panes (279:3298, 279:41765),
 * from the 748pt column's edge and their title's bottom at 171: gridlines
 * from 32 to the column's right edge, 200.05 to 440.05; the days end 0.56
 * short of it and the months 3.35 past it, as the phone's do.
 */
const LINE_FRAMES: Readonly<Record<"phone" | "pane", Record<"days" | "year", ChartFrame>>> = {
	phone: {
		days: { left: 46, inset: 33.75, gridLeft: 46, gridInset: 33.5, top: 52.94, baseline: 234.19, labelRight: 28, dotY: 267.44, labelY: 280.04, height: 324.94 },
		year: { left: 35.75, inset: 44, gridLeft: 36, gridInset: 45.5, top: 33.19, baseline: 237.04, labelRight: 26.3, dotY: 249.44, labelY: 282.04, height: 324.94 },
	},
	pane: {
		days: { left: 32, inset: 0.56, gridLeft: 32, gridInset: 0, top: 29.05, baseline: 269.05, labelRight: 24, dotY: 302.3, labelY: 314.9, height: 323 },
		year: { left: 31.44, inset: -3.35, gridLeft: 32, gridInset: 0, top: 29.05, baseline: 269.05, labelRight: 24, dotY: 281.45, labelY: 314.05, height: 328 },
	},
};

export interface LinePlot extends PlotBox {
	/** Through the points, broken where a day or week has no level: no dot there, and no segment to either side. */
	line: string;
	lineWidth: number;
	/** A dot a day with a level; a year's line has none. */
	points: Array<{ x: number; y: number }>;
	pointRadius: number;
}

/** `pane`: the twin's pane frame, for a page laid out as a pane. */
export function linePlot(view: StressPeriodView, width: number, pane = false): LinePlot {
	const f = LINE_FRAMES[pane ? "pane" : "phone"][view.range === "1y" ? "year" : "days"];
	const { box, scale } = plotBox(f, width, TICKS, view.axis);
	const points = view.points.filter((p): p is { x: number; value: number } => p.value !== null);
	return {
		...box,
		line: linePath(view.points.map((p) => [scale.x(p.x), p.value === null ? null : scale.y(p.value)])),
		lineWidth: 2,
		points: view.dots ? points.map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)) })) : [],
		pointRadius: 4,
	};
}

/* ------------------------------------------------------------------ */
/*  The day's timeline                                                 */
/* ------------------------------------------------------------------ */

/**
 * Figma's 1d frame (its title's bottom at 691.06): gridlines from 729 to
 * 916.25, x 38 to 376.5, an hour's dot on 943.5, the labels centred on
 * 956.14, the legend below at 982.4. The pane (279:3157), from the column's
 * edge and its title's bottom at 171: x 32 to 20 short of the column's right
 * edge, gridlines from 200.05 to 440.05, the rest as far below as the
 * phone's.
 */
const TIMELINES: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 38, inset: 25.5, gridLeft: 38, gridInset: 25.5, top: 37.94, baseline: 225.19, labelRight: 28, dotY: 252.44, labelY: 265.08, height: 291.34 },
	pane: { left: 32, inset: 20, gridLeft: 32, gridInset: 20, top: 29.05, baseline: 269.05, labelRight: 24, dotY: 296.3, labelY: 308.94, height: 335.2 },
};
/** The clock marker: the phone's ≈19pt. */
const MARKER = 9.5;

export interface TimelinePlot extends PlotBox {
	/** A bar a reading, from the 0 line up to its level; a 0 still shows a sliver. */
	bars: Array<{ x: number; y: number; w: number; h: number; tone: "rest" | "stress" }>;
	/**
	 * Too active to measure: grey, the plot's full height. Inferred until the
	 * day is re-shot after 04:00 — the phone's timelines were empty.
	 */
	active: Array<{ x: number; y: number; w: number; h: number }>;
	/** Unmeasurable: nothing scored there, the legend's hollow ring. Left blank unless the re-shoot says otherwise. */
	unmeasurable: Array<{ x: number; w: number }>;
	/** The clock marker where the night ended, on the dot row. */
	marker?: { x: number; y: number; r: number };
}

/** `pane`: the twin's pane frame, for a page laid out as a pane. */
export function timelinePlot(t: StressTimeline, width: number, pane = false): TimelinePlot {
	const f = TIMELINES[pane ? "pane" : "phone"];
	const axis = {
		dots: t.ticks.map((tick) => ({ x: tick.x, large: tick.large })),
		labels: t.ticks.flatMap((tick) => (tick.label ? [{ x: tick.x, text: tick.label }] : [])),
	};
	const { box, scale } = plotBox(f, width, TICKS, axis);
	const plot: TimelinePlot = {
		...box,
		bars: t.bars.map((b) => {
			const top = scale.y(Math.max(1, b.level));
			return { x: r2(scale.x(b.x0)), y: r2(top), w: r2((b.x1 - b.x0) * scale.span), h: r2(f.baseline - top), tone: b.tone };
		}),
		active: t.active.map((a) => ({ x: r2(scale.x(a.x0)), y: f.top, w: r2((a.x1 - a.x0) * scale.span), h: r2(f.baseline - f.top) })),
		unmeasurable: t.unmeasurable.map((u) => ({ x: r2(scale.x(u.x0)), w: r2((u.x1 - u.x0) * scale.span) })),
	};
	if (t.wake !== undefined) plot.marker = { x: r2(scale.x(t.wake)), y: f.dotY, r: MARKER };
	return plot;
}

/* ------------------------------------------------------------------ */
/*  Rings                                                              */
/* ------------------------------------------------------------------ */

/** The gap centred on every boundary between categories, twelve o'clock's included: 1% of the circle. */
export const RING_GAP = 3.6;
/** The 1d ring: 182.4pt across, 8.3pt thick. */
export const DAY_RING = { size: 182.4, thickness: 8.3 } as const;
/** A day card's mini ring: 26pt across, 4pt thick, where the same gap reads as a hairline. */
export const CARD_RING = { size: 26, thickness: 4 } as const;

export interface RingArc {
	part: StressPart;
	/** A stroke along the ring's middle, `thickness` wide with butt ends, in a `size` × `size` box. */
	d: string;
	/** Degrees clockwise from three o'clock, as Figma's arcs are: twelve o'clock is −90. */
	start: number;
	end: number;
}

/**
 * The ring's arcs, clockwise from twelve o'clock in the order rest, low,
 * medium, high, each its share of the circle less the gap. A category with
 * no time has no arc; a single category closes the circle without one.
 */
export function ringArcs(parts: readonly RingPart[], size: number, thickness: number): RingArc[] {
	const shown = parts.filter((p) => p.fraction > 0);
	const gap = shown.length > 1 ? RING_GAP : 0;
	const { c, r } = ringTrack(size, thickness);
	const arcs: RingArc[] = [];
	let angle = -90;
	for (const p of shown) {
		const sweep = p.fraction * 360;
		const start = angle + gap / 2;
		const end = angle + sweep - gap / 2;
		angle += sweep;
		if (end <= start) continue;
		arcs.push({ part: p.part, d: arcPath(c, r, start, end), start: r3(start), end: r3(end) });
	}
	return arcs;
}

/** The ring's centre and middle radius: a day without data draws this whole track in grey. */
export function ringTrack(size: number, thickness: number): { c: number; r: number } {
	return { c: size / 2, r: size / 2 - thickness / 2 };
}

function arcPath(c: number, r: number, start: number, end: number): string {
	const at = (deg: number) => {
		const a = (deg * Math.PI) / 180;
		return `${r2(c + r * Math.cos(a))} ${r2(c + r * Math.sin(a))}`;
	};
	const radius = `${r2(r)} ${r2(r)}`;
	// One arc command cannot close a circle: two halves.
	if (end - start >= 360 - 1e-6) return `M${at(start)} A${radius} 0 1 1 ${at(start + 180)} A${radius} 0 1 1 ${at(start)}`;
	return `M${at(start)} A${radius} 0 ${end - start > 180 ? 1 : 0} 1 ${at(end)}`;
}
