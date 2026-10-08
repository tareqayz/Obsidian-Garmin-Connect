import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";
import type { WeightPeriodView } from "./weight-pages";

/**
 * The Weight charts, measured off the Obsidian twin (page 239:16; phones
 * 7d 348:64749, 4w 348:64836, 1y 348:64948 / 348:65088; pane 1y 348:66777),
 * each from the bottom of the page's header (167pt down on the phone): the
 * chart has no title.
 *
 * Pure.
 */

type Kind = "days" | "year";

const FRAMES: Readonly<Record<"phone" | "pane", Record<Kind, ChartFrame>>> = {
	phone: {
		days: { left: 40, inset: 26, gridLeft: 40, gridInset: 26, top: 62.3, baseline: 213.5, labelRight: 28, dotY: 253, labelY: 267.5, height: 285 },
		year: { left: 44, inset: 34, gridLeft: 44, gridInset: 33, top: 62.3, baseline: 213.5, labelRight: 28, dotY: 234, labelY: 262, height: 278 },
	},
	pane: {
		days: { left: 40, inset: 26, gridLeft: 40, gridInset: 26, top: 62.3, baseline: 213.5, labelRight: 28, dotY: 253, labelY: 267.5, height: 285 },
		year: { left: 82, inset: 0, gridLeft: 82, gridInset: 0, top: 62.3, baseline: 213.5, labelRight: 66, dotY: 234, labelY: 262, height: 278 },
	},
};

export function weightFrame(kind: Kind, pane: boolean): ChartFrame {
	return FRAMES[pane ? "pane" : "phone"][kind];
}

/** A weigh-in's dot, 8pt across; the High-Low bar 3pt wide. */
export const WEIGH_DOT_R = 4;
export const HIGH_LOW_WIDTH = 3;

export interface WeightPlot extends PlotBox {
	line: string;
	dots: PlotBox["dots"];
	marks: Array<{ x: number; y: number }>;
	bars: Array<{ x: number; top: number; bottom: number }>;
	/** Where "No data available." is centred. */
	emptyY: number;
}

export function weightPlot(view: WeightPeriodView, width: number, pane: boolean): WeightPlot {
	const f = weightFrame(view.range === "1y" ? "year" : "days", pane);
	const { box, scale } = plotBox(f, width, view.hasData ? view.ticks : [], view.axis);
	const marks = view.points.map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)) }));
	const bars = view.points
		.filter((p) => p.low !== undefined && p.high !== undefined)
		.map((p) => ({ x: r2(scale.x(p.x)), top: r2(scale.y(p.high!)), bottom: r2(scale.y(p.low!)) }));
	return {
		...box,
		line: linePath(view.line.map((p) => [scale.x(p.x), scale.y(p.value)])),
		marks,
		bars,
		emptyY: r2((f.top + f.baseline) / 2),
	};
}
