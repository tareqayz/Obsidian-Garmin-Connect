import type { Tone } from "./gauges";
import type { EconomyChart } from "./running-economy-pages";
import { r2 } from "./stat-charts";

/**
 * The Running Economy charts' geometry, measured off the Obsidian twin
 * (Figma page 430:6114: phones 752:3318 (4w), 752:3488 (12w), 752:3620 (1y),
 * the Inferred 752:3768 (12w −1) and 752:3925 (an empty 4w); panes 757:614
 * (12w) and 757:700 (1y); the local Y Axis 751:9838, X Axis 751:9849 and
 * Chart Dot 751:9759).
 *
 * A chart's box is 236 pt tall at any width, 79 under the header's foot (the
 * phone's y 244, a pane's 195). A pane's 748 pt column keeps the phone's
 * insets, so one frame serves both and the plot stretches between them.
 *
 * - Five 1 pt gridlines from x 39 to 16 short of the box's right edge, their
 *   centres from 19.33 to 178.37 down the box, 39.76 apart (page 263.33 +
 *   39.76k on the phone); the labels right-aligned to 22.5 and centred on
 *   their lines.
 * - The plot runs from the axis' first day at x 39 to its last at the
 *   gridlines' right end: 386 on the phone, 732 in a pane's column (page 764),
 *   so x' = 39 + (x − 39)·693/347.
 * - The axis under it: Ø 4 dots (4w's days, 12w's block starts) centred
 *   190.33, Ø 8 dots (the ends, 1y's month starts) 190.67; the end labels
 *   centred 206.34, 1y's month names on end centred 206.5.
 * - The readings: Ø 8 dots in their class's colour (4w, 12w) on a 2 pt line
 *   with round ends and joins. The line takes each class's colour inside that
 *   class's band of values, so it changes colour on a level boundary: the
 *   1y's Trained stretches are a copy of the line clipped below y(214.5),
 *   142.59 down the box.
 * - A period without a reading keeps the box and centres the web's line on
 *   the middle gridline's place, 98.85 (page 342.82 on the phone).
 *
 * Pure.
 */

/** The chart's box, in its own coordinates: the y values from its top, x from its left edge. */
export const ECONOMY_FRAME = {
	height: 236,
	/** The plot's first day and the gridlines' left end; both end `inset` short of the box's right edge. */
	left: 39,
	inset: 16,
	/** The top and the bottom gridline's centres. */
	top: 19.33,
	baseline: 178.37,
	/** The y labels' right edge. */
	labelRight: 22.5,
	/** The axis' dots: a day's (small) and an end's or a month's (large), centre and radius. */
	axisDots: { small: { y: 190.33, r: 2 }, large: { y: 190.67, r: 4 } },
	/** The end labels' centre, and 1y's month names', which stand on end. */
	labelY: 206.34,
	monthY: 206.5,
	/** A reading's dot. */
	pointRadius: 4,
} as const;

/** A chart laid out at a width. */
export interface EconomyPlot {
	width: number;
	height: number;
	/** The plot's first and last day. */
	left: number;
	right: number;
	labelRight: number;
	/** The gridlines, top first, each with its label. */
	grid: Array<{ y: number; x1: number; x2: number; label: string }>;
	/** The axis under the plot. */
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	/** The readings, each in its class's colour. */
	points: Array<{ x: number; y: number; tone: Tone }>;
	pointRadius: number;
	/** A dot on each point: 4w and 12w, and a lone point on 1y, which would draw nothing otherwise (Inferred). */
	pointDots: boolean;
	/** The points joined straight, in order; empty for fewer than two. */
	line: string;
	/**
	 * The line's colours: for each class it passes through, worse first, the
	 * box's band from `y0` to `y1` it is drawn in. The outer bands run well
	 * past the box, so the line's round ends are never clipped.
	 */
	bands: Array<{ tone: Tone; y0: number; y1: number }>;
	/** Halfway down the gridlines: where the empty period's line is centred. */
	middle: number;
}

/** A range's chart at `width`; for a period without a reading, the bare box its line sits in. */
export function economyPlot(chart: EconomyChart | null, width: number): EconomyPlot {
	const f = ECONOMY_FRAME;
	const right = Math.max(f.left + 60, width - f.inset);
	const plot: EconomyPlot = {
		width,
		height: f.height,
		left: f.left,
		right: r2(right),
		labelRight: f.labelRight,
		grid: [],
		dots: [],
		labels: [],
		points: [],
		pointRadius: f.pointRadius,
		pointDots: false,
		line: "",
		bands: [],
		middle: r2((f.top + f.baseline) / 2),
	};
	if (!chart) return plot;
	const hi = Math.max(...chart.ticks);
	const lo = Math.min(...chart.ticks);
	const x = (fraction: number) => r2(f.left + fraction * (right - f.left));
	// Linear, unclamped: the ticks cover every point, and a band's edge may lie past them.
	const y = (value: number) => r2(f.top + ((hi - value) / (hi - lo || 1)) * (f.baseline - f.top));
	plot.grid = chart.ticks.map((tick) => ({ y: y(tick), x1: f.left, x2: plot.right, label: String(tick) }));
	plot.dots = chart.axis.dots.map((d) => {
		const dot = d.large ? f.axisDots.large : f.axisDots.small;
		return { x: x(d.x), y: dot.y, r: dot.r };
	});
	plot.labels = chart.axis.labels.map((l) => {
		const rotated = l.rotated === true;
		return { x: x(l.x), y: rotated ? f.monthY : f.labelY, text: l.text, rotated };
	});
	plot.points = chart.points.map((p) => ({ x: x(p.x), y: y(p.value), tone: p.tone }));
	plot.pointDots = chart.dots || chart.points.length === 1;
	plot.line = plot.points.length > 1 ? plot.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "";
	plot.bands = chart.zones.map((zone) => ({
		tone: zone.tone,
		y0: zone.above === null ? -f.height : y(zone.above),
		y1: zone.below === null ? 2 * f.height : y(zone.below),
	}));
	return plot;
}
