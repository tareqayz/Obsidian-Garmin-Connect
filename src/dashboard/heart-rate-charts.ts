import type { HeartRatePeriodView, HeartRateTimeline } from "./heart-rate-pages";
import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Heart Rate charts, measured off the Obsidian twin (page 239:20; phone
 * 1d 334:23, 7d 334:710, 1y 334:52510, each from its title's bottom at
 * 270.1). Each axis is fixed, whatever the data, and its scale runs on below
 * the lowest gridline, so a resting value under it still has its place.
 *
 * The panes' frames follow Stress's (the plot from 32pt in, 240pt tall):
 * measured on the Stress twin, not Heart Rate's.
 *
 * Pure.
 */

interface Axis {
	/** Gridlines top first, as labelled. */
	ticks: number[];
	/** The values on the first and last gridline: the 1d labels are rounded. */
	hi: number;
	lo: number;
}

/** 1d: four gridlines, 210 to 67 in steps of 47.67, labelled whole. */
const DAY_AXIS: Axis = { ticks: [210, 162, 115, 67], hi: 210, lo: 67 };
const DAYS_AXIS: Axis = { ticks: [200, 155, 110, 65], hi: 200, lo: 65 };
const YEAR_AXIS: Axis = { ticks: [180, 140, 100, 60], hi: 180, lo: 60 };

const FRAMES: Readonly<Record<"phone" | "pane", Record<"day" | "days" | "year", ChartFrame>>> = {
	phone: {
		day: { left: 38, inset: 25.5, gridLeft: 38, gridInset: 25.5, top: 39.15, baseline: 201.9, labelRight: 28, dotY: 273.15, labelY: 289.04, height: 325.4 },
		days: { left: 46, inset: 33.75, gridLeft: 46, gridInset: 33.5, top: 52.69, baseline: 212.14, labelRight: 28, dotY: 254.9, labelY: 267.54, height: 292.9 },
		year: { left: 46, inset: 50.75, gridLeft: 46, gridInset: 52.5, top: 51.54, baseline: 203.04, labelRight: 28, dotY: 236.9, labelY: 304.4, height: 292.9 },
	},
	pane: {
		day: { left: 32, inset: 20, gridLeft: 32, gridInset: 20, top: 29.05, baseline: 239.05, labelRight: 24, dotY: 296.3, labelY: 308.94, height: 335.2 },
		days: { left: 32, inset: 0.56, gridLeft: 32, gridInset: 0, top: 29.05, baseline: 239.05, labelRight: 24, dotY: 302.3, labelY: 314.9, height: 323 },
		year: { left: 31.44, inset: -3.35, gridLeft: 32, gridInset: 0, top: 29.05, baseline: 239.05, labelRight: 24, dotY: 281.45, labelY: 344.05, height: 350 },
	},
};

/** A value as y on an axis, the scale carried on past its gridlines. */
function yOf(f: ChartFrame, a: Axis): (v: number) => number {
	return (v) => f.top + ((a.hi - v) / (a.hi - a.lo)) * (f.baseline - f.top);
}

/**
 * The 1d line's colours, a vertical gradient by bpm: slate up to 43, then
 * each zone's colour at its midpoint. The zone floors are not available to
 * pages, so the midpoints are Garmin's DEFAULT zone percentages (50, 60, 70,
 * 80, 90%) of the twin's max HR, 204: 55%…95% → 112.2 to 193.8 bpm.
 */
const MAX_HR = 204;
export const GRADIENT_BPM: readonly number[] = [43, 0.55, 0.65, 0.75, 0.85, 0.95].map((v, i) => (i === 0 ? v : r2(v * MAX_HR)));

export interface CurvePlot extends PlotBox {
	line: string;
	/** Today's line is flat slate; a day that is over is shaded by zone. */
	tone: "slate" | "zones";
	/** The gradient's stops in the box's own y, top to bottom per its zone: `--heart-rate-zone-<zone>`. */
	stops: Array<{ y: number; zone: number }>;
	/** The clock marker where the night ended. */
	marker?: { x: number; y: number; r: number };
}

export function curvePlot(t: HeartRateTimeline, width: number, pane: boolean, today: boolean): CurvePlot {
	const f = FRAMES[pane ? "pane" : "phone"].day;
	const axis = {
		dots: t.ticks.map((k) => ({ x: k.x, large: k.large })),
		labels: t.ticks.flatMap((k) => (k.label ? [{ x: k.x, text: k.label }] : [])),
	};
	const { box, scale } = plotBox(f, width, DAY_AXIS.ticks, axis);
	const y = yOf(f, DAY_AXIS);
	const plot: CurvePlot = {
		...box,
		line: linePath(t.points.map((p) => [scale.x(p.x), p.value === null ? null : y(p.value)])),
		tone: today ? "slate" : "zones",
		stops: GRADIENT_BPM.map((bpm, zone) => ({ y: r2(y(bpm)), zone })),
	};
	if (t.wake !== undefined) plot.marker = { x: r2(scale.x(t.wake)), y: f.dotY, r: 9.5 };
	return plot;
}

export interface ReadingsPlot extends PlotBox {
	resting: string;
	high: string;
	points: Array<{ x: number; y: number; series: "resting" | "high" }>;
	pointRadius: number;
}

export function readingsPlot(view: HeartRatePeriodView, width: number, pane: boolean): ReadingsPlot {
	const year = view.range === "1y";
	const f = FRAMES[pane ? "pane" : "phone"][year ? "year" : "days"];
	const a = year ? YEAR_AXIS : DAYS_AXIS;
	const { box, scale } = plotBox(f, width, a.ticks, view.axis);
	const y = yOf(f, a);
	const series = (key: "resting" | "high") => view.points.map((p): [number, number | null] => [scale.x(p.x), p[key] === null ? null : y(p[key]!)]);
	const points: ReadingsPlot["points"] = [];
	for (const key of ["high", "resting"] as const) {
		for (const [x, py] of series(key)) if (py !== null) points.push({ x: r2(x), y: r2(py), series: key });
	}
	return {
		...box,
		resting: view.line ? linePath(series("resting")) : "",
		high: view.line ? linePath(series("high")) : "",
		points,
		pointRadius: year ? 1.1 : 2.5,
	};
}
