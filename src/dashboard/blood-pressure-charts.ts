import type { BloodPressurePeriodView, BpCategory } from "./blood-pressure-pages";
import { plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Blood Pressure chart, measured off the Obsidian twin (page 239:21; phone
 * 7d 348:65299), from the bottom of its title ("Weekly Readings", 216pt down
 * on the phone). Only the empty chart was drawn; the bars are Inferred.
 *
 * Pure.
 */

const FRAMES: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 35, inset: 37.5, gridLeft: 35, gridInset: 37.5, top: 40, baseline: 332.3, labelRight: 30, dotY: 341, labelY: 355, height: 372 },
	pane: { left: 35, inset: 37.5, gridLeft: 35, gridInset: 37.5, top: 40, baseline: 332.3, labelRight: 30, dotY: 341, labelY: 355, height: 372 },
};

export const BP_BAR_WIDTH = 6;

export interface BloodPressurePlot extends PlotBox {
	bars: Array<{ x: number; top: number; bottom: number; category: BpCategory }>;
	emptyY: number;
}

export function bloodPressurePlot(view: BloodPressurePeriodView, width: number, pane: boolean): BloodPressurePlot {
	const f = FRAMES[pane ? "pane" : "phone"];
	const { box, scale } = plotBox(f, width, view.ticks, view.axis);
	return {
		...box,
		// The empty chart has a lone 0 and no gridline.
		grid: view.bars.length ? box.grid : box.grid.map((g) => ({ ...g, x2: g.x1 })),
		bars: view.bars.map((b) => ({ x: r2(scale.x(b.x)), top: r2(scale.y(b.sys)), bottom: r2(scale.y(b.dia)), category: b.category })),
		emptyY: 182.6,
	};
}
