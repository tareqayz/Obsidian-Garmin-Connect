import type { Trend } from "./glance";
import type { HeatChart } from "./heat-acclimation-pages";
import { linePlot, type LineChartFrame, type LinePlot } from "./stat-charts";

/**
 * The Heat Acclimation page's geometry, measured off the Obsidian twin (Figma
 * page 430:6104): phone 1d 630:9, 7d 630:34, 4w 630:146, the Inferred 1d
 * states 630:359 / 630:379 / 630:402 / 630:423 and 4w − 1 630:439; panes
 * 631:561 (1d), 631:591 (7d), 631:679 (4w); the local Trend Disc 629:19, Y
 * Axis 629:33, X Axis 629:44 and Chart Dot 629:31. The twin is the Garmin
 * page (430:6068) 56 pt up, under the shell's header (the body starts at y
 * 165 on the phone, 116 in a pane).
 *
 * - Daily Progress: one box, 211 pt tall, at any width — the phone's 402 and
 *   a pane's 748 pt column keep the same insets, so one frame serves both
 *   and the plot stretches between them (`HEAT_FRAME`).
 * - The 1d disc: Ø 64, Material's trending_up / _flat / _down at 1.6× in a
 *   38.4 pt box centred in it, the paths as the twin exports them.
 * - The page's rhythm under the header: `DAY_RHYTHM` and `CHART_RHYTHM`,
 *   which the page sets as custom properties.
 *
 * Pure.
 */

/**
 * Daily Progress's box (Y Axis 629:33 at the box's top, X Axis 629:44 187
 * under it): five 1 pt gridlines from x 46.17 to 33.17 short of the box's
 * right edge (368.83 on the phone, 714.83 of the pane's 748), centred 19.5 →
 * 165.17, so 0–100 % is 1.4567 pt a %; the labels "100%" … "0%" end at x
 * 30.4. A day i of N is centred at 46.17 + (width − 79.34)·i/(N − 1). The
 * axis dots (Ø 8 at the ends, Ø 4 between) are centred 191 down, the
 * "MM-DD" labels 203.97; the readings are Ø 8 dots joined by a 2 pt line.
 * Phone: the box at y 244, gridlines 263.5 + 36.42k, dots y 409.17 −
 * 1.4567·%, axis dots 435. Pane: at (32, 218.14), gridlines x 78.17 →
 * 746.83 centred 237.64 + 36.42k, dots y 383.31 − 1.4567·%, axis dots
 * 409.14.
 */
export const HEAT_FRAME: LineChartFrame = {
	left: 46.17,
	inset: 33.17,
	top: 19.5,
	baseline: 165.17,
	labelRight: 30.4,
	axisDots: { small: { y: 191, r: 2 }, large: { y: 191, r: 4 } },
	labelY: 203.97,
	pointRadius: 4,
	height: 211,
};

/** The line joining the readings, pt. */
export const LINE_WIDTH = 2;

/**
 * A 7d or 4w chart at `width`: the fixed axis labelled "100%" … "0%", the
 * day axis, and the readings; a period without a row keeps the bare box, the
 * empty line set between its top and bottom gridlines' places.
 */
export function heatPlot(chart: HeatChart | null, width: number): LinePlot {
	if (!chart) return linePlot(HEAT_FRAME, width, { ticks: [], axis: { dots: [], labels: [] }, points: [] });
	const plot = linePlot(HEAT_FRAME, width, chart);
	return { ...plot, grid: plot.grid.map((line, i) => ({ ...line, label: chart.tickLabels[i] ?? line.label })) };
}

/* ------------------------------------------------------------------ */
/*  The 1d disc                                                        */
/* ------------------------------------------------------------------ */

/** The Trend Disc's diameter, pt. */
export const TREND_DISC = 64;

/**
 * The glyphs in the disc's 64-unit box, as the twin exports them (Trend
 * Disc 629:20 / 629:23 / 629:26): Material's 24 pt trending_up, _flat and
 * _down at 1.6×, their 38.4 pt box centred. Up and down ink 32 × 19.2 from
 * (16, 22.4), flat 30.4 × 12.8 from (17.6, 25.6): (185, 210.73) and
 * (186.6, 213.93) on the phone. No trend (0 %) is the empty disc.
 */
export const TREND_GLYPHS: Readonly<Record<Trend, string>> = {
	up: "M38.4 22.4L42.064 26.064L34.256 33.872L27.856 27.472L16 39.344L18.256 41.6L27.856 32L34.256 38.4L44.336 28.336L48 32V22.4H38.4Z",
	flat: "M48 32L41.6 25.6V30.4H17.6V33.6H41.6V38.4L48 32Z",
	down: "M38.4 41.6L42.064 37.936L34.256 30.128L27.856 36.528L16 24.656L18.256 22.4L27.856 32L34.256 25.6L44.336 35.664L48 32V41.6H38.4Z",
};

/* ------------------------------------------------------------------ */
/*  The page's rhythm                                                  */
/* ------------------------------------------------------------------ */

/**
 * 1d under the header (phone 165, pane 116), pt: the disc 23.33 down (188.33,
 * pane 139.33), the % in Ring Value L (34/40) 16.73 under it (269.06), the
 * trend line in Label (13/16) 15.68 under that (324.74). The copy, in
 * Paragraph (16) on the app's 20.33 pt pitch, has its first 22 pt line box
 * at 371.83 on the phone: a 20.33 pt line box 0.835 lower, 31.925 under the
 * trend line's foot. In a pane the disc, % and trend stand centred in the
 * 748 pt column and the copy starts the 370 pt one, its first box at 134.16
 * (cap level with the disc's top). Without a row, the empty line in Body
 * (15/20) 45.33 down (210.33).
 */
export const DAY_RHYTHM = {
	discTop: 23.33,
	percentGap: 16.73,
	percent: 40,
	trendGap: 15.68,
	trend: 16,
	copyGap: 31.925,
	copyLine: 20.33,
	copyTopPane: 18.995,
	emptyTop: 45.33,
} as const;

/**
 * 7d / 4w under the header, pt: "Daily Progress" in List Item (17/22) 9.86
 * down on the phone (174.86) and 33 in a pane (149); the box 47.14 under its
 * foot (244, pane 218.14). The key 10.67 under the box on the phone (465.67),
 * centred; in a pane it starts the 370 pt column, its top level with the top
 * gridline's (237.14).
 */
export const CHART_RHYTHM = {
	titleTop: 9.86,
	titleTopPane: 33,
	title: 22,
	boxGap: 47.14,
	legendGap: 10.67,
	legendTopPane: 121.14,
} as const;
