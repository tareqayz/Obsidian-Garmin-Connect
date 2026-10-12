import type { HillChart, HillPeriodView } from "./hill-score-pages";
import { linePlot, r2, type LineChartFrame, type LinePlot } from "./stat-charts";

/**
 * The Hill Score charts, measured off the Obsidian twin (Figma page
 * 430:6130: phone 4w 505:403, 12w 505:662, 1y 505:861, March 505:1016;
 * panes 508:96997, 508:97627, 508:98164, 508:97298; the local Y Axis 503:134,
 * X Axis 503:436 and Chart Dot 503:64). A chart's box starts at the header's
 * foot (y 165 on the phone, the month page's 109, a pane's rule at 116) and
 * runs 273.33 pt down to the Avg / Max row, at any width: a pane's 748 pt
 * column keeps the phone's insets, so one frame a range serves both.
 *
 * - The y axis is fixed, 100 to 0 in fives of 25, its labels right-aligned
 *   to x 30.33 (1y 28.33) and centred on their lines.
 * - 4w and a month: a dot a day from x 46.33 to 33 short of the edge, the
 *   gridlines on to 25 short; under them 4 pt day dots and 8 pt ends on one
 *   row, the ends labelled "MM-DD".
 * - 12w: a dot a Monday week, 28.97 pt apart on the phone, ending 37 short;
 *   an 8 pt tick under each and its Monday on end.
 * - 1y: a line without dots from the first month's 1st at x 35.83 to the
 *   last's 27.17 short, by days (1.015 pt a day on the phone); the gridlines
 *   from x 36; a tick a month with its name on end.
 * - The line is 2 pt, round-capped; the dots 8 pt; both the theme's blue.
 *
 * Pure.
 */

/** A Hill chart's box: `LineChartFrame` with the gridlines' own ends, which run past the plot's. */
export interface HillChartFrame extends LineChartFrame {
	/** The gridlines run from `gridLeft` to `gridInset` short of the box's right edge. */
	gridLeft: number;
	gridInset: number;
}

const axisRow = (y: number) => ({ small: { y, r: 2 }, large: { y, r: 4 } });

/** The frames, by what a range plots: days (4w, a month), Monday weeks (12w), months (1y). */
export const HILL_FRAMES: Readonly<Record<"days" | "weeks" | "months", HillChartFrame>> = {
	// 505:403: gridlines y 252.83 + 30.33k, axis dots 397.33, labels from 403.33; the Avg row at 438.33.
	days: {
		left: 46.33,
		inset: 33,
		gridLeft: 46.33,
		gridInset: 25,
		top: 87.83,
		baseline: 209.17,
		labelRight: 30.33,
		axisDots: axisRow(232.33),
		labelY: 245.33,
		pointRadius: 4,
		height: 273.33,
	},
	// 505:662: gridlines y 250.5 … 360.17, ticks 379.33, the rotated labels centred 402.
	weeks: {
		left: 46.33,
		inset: 37,
		gridLeft: 46.33,
		gridInset: 25,
		top: 85.5,
		baseline: 195.17,
		labelRight: 30.33,
		axisDots: axisRow(214.33),
		labelY: 237,
		pointRadius: 4,
		height: 273.33,
	},
	// 505:861: gridlines y 240.5 … 372.17 from x 36, ticks 379.33, month names centred 401.9.
	months: {
		left: 35.83,
		inset: 27.17,
		gridLeft: 36,
		gridInset: 25,
		top: 75.5,
		baseline: 207.17,
		labelRight: 28.33,
		axisDots: axisRow(214.33),
		labelY: 236.9,
		pointRadius: 4,
		height: 273.33,
	},
};

/** The frame a range's chart takes. */
export function hillFrame(range: HillPeriodView["range"]): HillChartFrame {
	return range === "12w" ? HILL_FRAMES.weeks : range === "1y" ? HILL_FRAMES.months : HILL_FRAMES.days;
}

/** A Hill chart laid out: `linePlot`'s, its gridlines to their own ends and its labels knowing whether they stand on end. */
export interface HillPlot extends Omit<LinePlot, "labels"> {
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	/** A dot on each point: days and weeks, and a lone point anywhere; 1y's months are a bare line. */
	pointDots: boolean;
}

/** A range's chart at `width`; for a period without a point, the bare box the no-data line sits in. */
export function hillPlot(range: HillPeriodView["range"], chart: HillChart | null, width: number): HillPlot {
	const frame = hillFrame(range);
	const plot = linePlot(frame, width, chart ?? { ticks: [], axis: { dots: [], labels: [] }, points: [] });
	const gridRight = r2(Math.max(frame.gridLeft + 60, width - frame.gridInset));
	const rotated = chart?.axis.labels.map((l) => l.rotated === true) ?? [];
	return {
		...plot,
		grid: plot.grid.map((g) => ({ ...g, x1: frame.gridLeft, x2: gridRight })),
		labels: plot.labels.map((l, i) => ({ ...l, rotated: rotated[i] ?? false })),
		pointDots: chart !== null && (chart.dots || chart.points.length === 1),
	};
}
