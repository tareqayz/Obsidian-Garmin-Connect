import type { FitnessTrendView } from "./fitness-age-pages";
import { plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Fitness Age trend charts, measured off the Obsidian twin (page 239:24;
 * phone 7d 346:65312, 1y 346:65487), each box from its title's bottom at
 * 200.42. A pane keeps the phone's insets and stretches the plot.
 *
 * Pure.
 */

export const FRAMES: Readonly<Record<"days" | "year", ChartFrame>> = {
	days: { left: 50, inset: 39, gridLeft: 50, gridInset: 39, top: 44.58, baseline: 158.08, labelRight: 40, dotY: 188.08, labelY: 201.68, height: 231.58 },
	year: { left: 38, inset: 36, gridLeft: 38, gridInset: 36, top: 42.08, baseline: 139.08, labelRight: 29, dotY: 170.58, labelY: 217.58, height: 231.58 },
};

export interface TrendPlot extends PlotBox {
	line: string;
	points: Array<{ x: number; y: number }>;
	pointRadius: number;
}

export function trendPlot(view: FitnessTrendView, width: number): TrendPlot {
	const frame = FRAMES[view.range === "1y" ? "year" : "days"];
	const { box, scale } = plotBox(frame, width, view.ticks, view.axis);
	const xy = view.points.map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)) }));
	// The line joins the rows straight across days without one.
	const line = xy.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
	return { ...box, line, points: view.dots ? xy : [], pointRadius: 4 };
}
