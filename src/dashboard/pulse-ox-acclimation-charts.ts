import { SPO2_AXIS, type AcclimationView } from "./pulse-ox-acclimation-pages";
import type { Spo2Band } from "./pulse-ox-pages";
import { plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Acclimation chart, measured off the Obsidian twin (page 239:18; phone
 * 4w 348:59, pane 348:241), from the bottom of the page's header and its
 * two-line period (167pt down on the phone).
 *
 * Pure.
 */

const FRAMES: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 51, inset: 43, gridLeft: 51, gridInset: 42, top: 32.6, baseline: 293.4, labelRight: 43, dotY: 304.5, labelY: 319, height: 332 },
	pane: { left: 51, inset: 43, gridLeft: 51, gridInset: 42, top: 32.6, baseline: 293.4, labelRight: 43, dotY: 304.5, labelY: 319, height: 332 },
};

export const ACCLIMATION_POINT_R = 4;

export interface AcclimationPlot extends PlotBox {
	/** The right labels' left edge. */
	rightX: number;
	right: number;
	rightLabels: Array<{ y: number; text: string }>;
	/** A closed area along the baseline, empty without elevation. */
	area: string;
	points: Array<{ x: number; y: number; band: Spo2Band }>;
}

export function acclimationPlot(view: AcclimationView, width: number, pane: boolean): AcclimationPlot {
	const f = FRAMES[pane ? "pane" : "phone"];
	const { box, scale } = plotBox(f, width, SPO2_AXIS, view.axis);
	const yElev = (m: number) => f.baseline - (Math.max(0, Math.min(view.elevationTop, m)) / view.elevationTop) * (f.baseline - f.top);
	let area = "";
	let run: Array<[number, number]> = [];
	const flush = () => {
		if (run.length) area += `M${r2(run[0]![0])} ${f.baseline} ${run.map(([x, y]) => `L${r2(x)} ${r2(y)}`).join(" ")} L${r2(run[run.length - 1]![0])} ${f.baseline} Z `;
		run = [];
	};
	for (const e of view.elevation) {
		if (e.value === null) flush();
		else run.push([scale.x(e.x), yElev(e.value)]);
	}
	flush();
	return {
		...box,
		rightX: r2(box.right + 22.7),
		rightLabels: box.grid.map((g, i) => ({ y: g.y, text: view.elevationLabels[i] ?? "" })),
		area: area.trim(),
		points: view.points.map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)), band: p.band })),
	};
}
