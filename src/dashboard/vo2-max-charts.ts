import { linePlot, type LineChartFrame, type LinePlot } from "./stat-charts";
import type { Vo2Chart } from "./vo2-max-pages";

/**
 * The VO₂ Max line chart, measured off the Obsidian twin (Figma page
 * 430:6112: phone 4w 472:131, 12w 472:316, 6m 472:472; pane 473:889,
 * 473:1024, 473:1131; the local Y Axis 470:33, X Axis 470:104 and Chart Dot
 * 470:4). Its box starts at the tabs' bottom and is 304 pt tall at any
 * width: the phone's 402 and a pane's 748 pt column keep the same insets, so
 * one frame serves both and the plot stretches between them.
 *
 * - Five gridlines 41 pt apart, from 104 to 268 in the box (y 302.33 to
 *   466.33 on the phone), from x 39 to 16 short of the box's right edge; the
 *   tick labels end at x 22.8, each centred on its line.
 * - The plot runs from the period's first day at x 39 to its last at the
 *   gridlines' right end: x(d) = 39 + (width − 55)·d / (days − 1).
 * - Under it, the axis row: 4 pt dots centred 278 and 8 pt ones 280.17 (both
 *   top-aligned at 276 in the twin), and "MM-DD" labels centred 295.85.
 * - The readings: 8 pt dots joined by a 1 pt line.
 *
 * `linePlot` (`stat-charts.ts`) lays it out: a frame, the ticks, an axis and
 * points as fractions of the plot.
 *
 * Pure.
 */

/** The line-chart kit moved to `stat-charts.ts` for Hill Score and the rest; still reachable here. */
export { linePlot, type LineChartFrame, type LineInput, type LinePlot } from "./stat-charts";

export const VO2_FRAME: LineChartFrame = {
	left: 39,
	inset: 16,
	top: 104,
	baseline: 268,
	labelRight: 22.8,
	axisDots: { small: { y: 278, r: 2 }, large: { y: 280.17, r: 4 } },
	labelY: 295.85,
	pointRadius: 4,
	height: 304,
};

/** A VO₂ Max range's chart at `width`; for a period without a reading, the bare box the no-data line sits in. */
export function vo2Plot(chart: Vo2Chart | null, width: number): LinePlot {
	return linePlot(VO2_FRAME, width, chart ?? { ticks: [], axis: { dots: [], labels: [] }, points: [] });
}
