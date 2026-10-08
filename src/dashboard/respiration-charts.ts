import type { RespirationPeriodView, RespirationTimeline } from "./respiration-pages";
import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Respiration charts, measured off the Obsidian twin (page 239:19; phone
 * 1d 340:3, 7d 340:962, 4w 340:1159; panes 341:1067, 341:1238, 341:1365),
 * each from its title's bottom (216.5 on the phone). Every axis is the
 * data's own five gridlines (`respirationTicks`).
 *
 * Pure.
 */

type Kind = "day" | "week" | "month";

const FRAMES: Readonly<Record<"phone" | "pane", Record<Kind, ChartFrame>>> = {
	phone: {
		day: { left: 60, inset: 41, gridLeft: 60, gridInset: 41, top: 71.9, baseline: 177.6, labelRight: 40.5, dotY: 205.1, labelY: 220.6, height: 232 },
		week: { left: 31.5, inset: 28.4, gridLeft: 31.5, gridInset: 28.4, top: 68.4, baseline: 189.4, labelRight: 19.5, dotY: 210.5, labelY: 223.5, height: 232 },
		month: { left: 35.4, inset: 28.4, gridLeft: 35.4, gridInset: 28.4, top: 68.4, baseline: 189.4, labelRight: 23, dotY: 210.5, labelY: 223.5, height: 232 },
	},
	pane: {
		day: { left: 44, inset: 54, gridLeft: 44, gridInset: 54, top: 71.9, baseline: 177.6, labelRight: 24.5, dotY: 205.1, labelY: 220.6, height: 232 },
		week: { left: 62.4, inset: 25.1, gridLeft: 31.5, gridInset: 25.1, top: 68.4, baseline: 189.4, labelRight: 19.5, dotY: 210.5, labelY: 223.5, height: 232 },
		month: { left: 66.1, inset: 25.1, gridLeft: 39.4, gridInset: 25.1, top: 68.4, baseline: 189.4, labelRight: 23, dotY: 210.5, labelY: 223.5, height: 232 },
	},
};

export function respirationFrame(kind: Kind, pane: boolean): ChartFrame {
	return FRAMES[pane ? "pane" : "phone"][kind];
}

/** A bar's width and a dot's radius (8pt across), the night markers' ring. */
export const BAR_WIDTH = 8;
export const DOT_R = 4;
export const MARKER_R = 8;
/** The 7d / 4w points: 7pt across. */
export const POINT_R = 3.5;

export interface TimelinePlot extends PlotBox {
	bars: Array<{ x: number; top: number; bottom: number }>;
	highs: Array<{ x: number; y: number }>;
	lows: Array<{ x: number; y: number }>;
	line: string;
	markers: Array<{ kind: "sleep" | "wake"; x: number; y: number }>;
}

export function timelinePlot(t: RespirationTimeline, width: number, pane: boolean): TimelinePlot {
	const f = respirationFrame("day", pane);
	const { box, scale } = plotBox(f, width, t.ticks, t.axis);
	const bars = t.bars.map((b) => ({ x: r2(scale.x(b.x)), top: r2(scale.y(b.high)), bottom: r2(scale.y(b.low)) }));
	return {
		...box,
		bars,
		highs: bars.map((b) => ({ x: b.x, y: b.top })),
		lows: bars.map((b) => ({ x: b.x, y: b.bottom })),
		line: linePath(t.line.map((p) => [scale.x(p.x), p.value === null ? null : scale.y(p.value)])),
		markers: t.markers.map((m) => ({ kind: m.kind, x: r2(scale.x(m.x)), y: f.dotY })),
	};
}

export interface AveragesPlot extends PlotBox {
	sleep: string;
	awake: string;
	points: Array<{ x: number; y: number; series: "sleep" | "awake" }>;
}

export function averagesPlot(view: RespirationPeriodView, width: number, pane: boolean): AveragesPlot {
	const f = respirationFrame(view.range === "4w" ? "month" : "week", pane);
	const { box, scale } = plotBox(f, width, view.ticks, view.axis);
	const series = (key: "sleep" | "awake") => view.points.map((p): [number, number | null] => [scale.x(p.x), p[key] === null ? null : scale.y(p[key]!)]);
	const points: AveragesPlot["points"] = [];
	// Awake last: where the two are equal its dot covers Sleep's, as on the web.
	for (const key of ["sleep", "awake"] as const) {
		for (const [x, y] of series(key)) if (y !== null) points.push({ x: r2(x), y: r2(y), series: key });
	}
	return { ...box, sleep: linePath(series("sleep")), awake: linePath(series("awake")), points };
}
