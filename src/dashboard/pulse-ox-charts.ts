import { plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";
import { SPO2_TICKS, type PulseOxDayView, type PulseOxPeriodView, type Spo2Band } from "./pulse-ox-pages";

/**
 * The Pulse Ox charts and gauge, measured off the Obsidian twin (page 239:17;
 * phones 1d 348:63395, 7d 348:63419, 4w 348:63497), each from the bottom of
 * the page's header (167pt down on the phone). The 1d hourly chart was never
 * shot with readings: it keeps the 7d frame's axis (Inferred).
 *
 * Pure.
 */

const FRAMES: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 33.5, inset: 14.5, gridLeft: 33.5, gridInset: 14.5, top: 79, baseline: 175, labelRight: 25, dotY: 209.5, labelY: 223, height: 245 },
	pane: { left: 44, inset: 0, gridLeft: 44, gridInset: 0, top: 79, baseline: 175, labelRight: 36, dotY: 209.5, labelY: 223, height: 245 },
};

/** The column dividers' top and bottom. */
export const COLUMN_TOP = 79;
export const COLUMN_BOTTOM = 201;
export const POINT_R = 5;
export const BAR_WIDTH = 8;

export function pulseOxFrame(pane: boolean): ChartFrame {
	return FRAMES[pane ? "pane" : "phone"];
}

const LABELS = SPO2_TICKS.map((t) => `${t}%`);

export interface PulseOxPlot extends PlotBox {
	columns: number[];
	points: Array<{ x: number; y: number; band: Spo2Band }>;
	emptyY: number;
}

export function pulseOxPlot(view: PulseOxPeriodView, width: number, pane: boolean): PulseOxPlot {
	const f = pulseOxFrame(pane);
	const { box, scale } = plotBox(f, width, SPO2_TICKS, view.axis, LABELS);
	return {
		...box,
		// The twin draws no gridlines here, only the columns.
		grid: box.grid.map((g) => ({ ...g, x2: g.x1 })),
		columns: view.columns.map((c) => r2(scale.x(c))),
		points: view.points.map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)), band: p.band })),
		emptyY: 121,
	};
}

export interface Spo2DayPlot extends PlotBox {
	bars: Array<{ x: number; top: number; bottom: number; band: Spo2Band }>;
	emptyY: number;
}

export function spo2DayPlot(view: PulseOxDayView, width: number, pane: boolean): Spo2DayPlot {
	const f = pulseOxFrame(pane);
	const { box, scale } = plotBox(f, width, SPO2_TICKS, view.axis, LABELS);
	return {
		...box,
		bars: view.bars.map((b) => ({ x: r2(scale.x(b.x)), top: r2(scale.y(b.value)), bottom: f.baseline, band: b.band })),
		emptyY: 121,
	};
}

/* ------------------------------------------------------------------ */
/*  The gauge                                                          */
/* ------------------------------------------------------------------ */

/** The four arcs of the 270° gauge, open at the bottom, from the lower left: < 70, 70–79, 80–89, 90–100 on a 60–100 scale. */
export const GAUGE_BANDS: readonly Spo2Band[] = ["poor", "low", "mid", "high"];

/** An arc of a circle of radius `r` centred on (`c`, `c`), from `a0` to `a1` degrees clockwise from the top. */
function arc(c: number, r: number, a0: number, a1: number): string {
	const pt = (a: number) => {
		const rad = ((a - 90) * Math.PI) / 180;
		return `${r2(c + r * Math.cos(rad))} ${r2(c + r * Math.sin(rad))}`;
	};
	return `M${pt(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}`;
}

/** The gauge's arcs at `size` across with a `stroke` wide ring and `gap` degrees between arcs. */
export function gaugeArcs(size: number, stroke: number, gap = 3): Array<{ band: Spo2Band; d: string }> {
	const c = size / 2;
	const r = c - stroke / 2;
	const start = -135;
	const each = 270 / 4;
	return GAUGE_BANDS.map((band, i) => ({ band, d: arc(c, r, start + i * each + (i ? gap / 2 : 0), start + (i + 1) * each - (i < 3 ? gap / 2 : 0)) }));
}
