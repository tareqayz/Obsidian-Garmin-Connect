import type { BatteryPeriodView, BatteryTimeline } from "./body-battery-pages";
import { plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * The Body Battery charts: the 1d Daily Timeline (the Stress page's bars and
 * axis with the curve over them) and the 7d / 4w Daily Values (a low-to-high
 * bar and two dots a day), and the gauge's and ring's arcs.
 *
 * The twin (Figma page 239:23, 1d 334:48242, 7d 334:49216, 4w 334:49751)
 * places its charts where the Stress twin does, at the same sizes, so the
 * frames are Stress's (`stress-charts.ts`) until a measured pass says
 * otherwise.
 */

const TICKS = [100, 75, 50, 25, 0];

const TIMELINES: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 38, inset: 25.5, gridLeft: 38, gridInset: 25.5, top: 37.94, baseline: 225.19, labelRight: 28, dotY: 252.44, labelY: 265.08, height: 291.34 },
	pane: { left: 32, inset: 20, gridLeft: 32, gridInset: 20, top: 29.05, baseline: 269.05, labelRight: 24, dotY: 296.3, labelY: 308.94, height: 335.2 },
};

const COLUMNS: Readonly<Record<"phone" | "pane", ChartFrame>> = {
	phone: { left: 46, inset: 33.75, gridLeft: 46, gridInset: 33.5, top: 52.94, baseline: 234.19, labelRight: 28, dotY: 267.44, labelY: 280.04, height: 324.94 },
	pane: { left: 32, inset: 8, gridLeft: 32, gridInset: 0, top: 29.05, baseline: 269.05, labelRight: 24, dotY: 302.3, labelY: 314.9, height: 323 },
};

export interface BatteryTimelinePlot extends PlotBox {
	/** The grey area under the curve, closed on the 0 line, one per unbroken stretch. */
	areas: string[];
	/** The step line: measured stretches solid, estimated ones dotted. */
	lines: Array<{ d: string; estimated: boolean }>;
	bars: Array<{ x: number; y: number; w: number; h: number; tone: "rest" | "stress" }>;
	active: Array<{ x: number; y: number; w: number; h: number }>;
	/** The night: a lighter band from midnight to the wake time, and the Zz marker on the dot row. */
	sleep?: { x: number; w: number };
	marker?: { x: number; y: number };
}

export function batteryTimelinePlot(t: BatteryTimeline, width: number, pane = false): BatteryTimelinePlot {
	const f = TIMELINES[pane ? "pane" : "phone"];
	const axis = {
		dots: t.ticks.map((k) => ({ x: k.x, large: k.large })),
		labels: t.ticks.flatMap((k) => (k.label ? [{ x: k.x, text: k.label }] : [])),
	};
	const { box, scale } = plotBox(f, width, TICKS, axis);
	const areas: string[] = [];
	const lines: BatteryTimelinePlot["lines"] = [];
	let run: BatteryTimeline["curve"] = [];
	const flush = () => {
		if (!run.length) return;
		let d = "";
		for (const s of run) d += `${d ? "L" : "M"}${r2(scale.x(s.x0))} ${r2(scale.y(s.level))} H${r2(scale.x(s.x1))} `;
		areas.push(`${d}V${f.baseline} H${r2(scale.x(run[0]!.x0))} Z`);
		let part: BatteryTimeline["curve"] = [];
		const out = () => {
			if (!part.length) return;
			let p = "";
			for (const s of part) p += `${p ? "L" : "M"}${r2(scale.x(s.x0))} ${r2(scale.y(s.level))} H${r2(scale.x(s.x1))} `;
			lines.push({ d: p.trim(), estimated: part[0]!.estimated === true });
			part = [];
		};
		for (const s of run) {
			if (part.length && (part[0]!.estimated === true) !== (s.estimated === true)) out();
			part.push(s);
		}
		out();
		run = [];
	};
	for (const s of t.curve) {
		const last = run[run.length - 1];
		if (last && Math.abs(last.x1 - s.x0) > 1e-9) flush();
		run.push(s);
	}
	flush();
	const plot: BatteryTimelinePlot = {
		...box,
		areas,
		lines,
		bars: t.bars.map((b) => {
			const top = scale.y(Math.max(1, b.level));
			return { x: r2(scale.x(b.x0)), y: r2(top), w: r2((b.x1 - b.x0) * scale.span), h: r2(f.baseline - top), tone: b.tone };
		}),
		active: t.active.map((a) => ({ x: r2(scale.x(a.x0)), y: f.top, w: r2((a.x1 - a.x0) * scale.span), h: r2(f.baseline - f.top) })),
	};
	if (t.wake !== undefined) {
		plot.sleep = { x: f.left, w: r2(t.wake * scale.span) };
		plot.marker = { x: r2(scale.x(t.wake)), y: f.dotY };
	}
	return plot;
}

export interface BatteryColumnsPlot extends PlotBox {
	bars: Array<{ x: number; y: number; h: number }>;
	highs: Array<{ x: number; y: number }>;
	lows: Array<{ x: number; y: number }>;
	barWidth: number;
	dotRadius: number;
}

/** Daily Values: a bar from a day's low to its high, a dot at each end; nothing on a day without data. */
export function batteryColumnsPlot(view: BatteryPeriodView, width: number, pane = false): BatteryColumnsPlot {
	const f = COLUMNS[pane ? "pane" : "phone"];
	const { box, scale } = plotBox(f, width, TICKS, view.axis);
	const barWidth = view.range === "7d" ? 8 : 6;
	const plot: BatteryColumnsPlot = { ...box, bars: [], highs: [], lows: [], barWidth, dotRadius: view.range === "7d" ? 4 : 3.5 };
	for (const c of view.columns) {
		const x = r2(scale.x(c.x));
		if (c.high !== undefined && c.low !== undefined) plot.bars.push({ x: r2(x - barWidth / 2), y: r2(scale.y(c.high)), h: r2(scale.y(c.low) - scale.y(c.high)) });
		if (c.high !== undefined) plot.highs.push({ x, y: r2(scale.y(c.high)) });
		if (c.low !== undefined) plot.lows.push({ x, y: r2(scale.y(c.low)) });
	}
	return plot;
}

/* ------------------------------------------------------------------ */
/*  Gauge and ring                                                     */
/* ------------------------------------------------------------------ */

/** The 1d gauge and ring: 160pt across, 8pt thick. */
export const DIAL = { size: 160, thickness: 8 } as const;
/** The gauge opens at the bottom: 321° from about 199° clockwise of twelve, four segments 4° apart. */
const GAUGE_START = 199;
const GAUGE_SWEEP = 321;
const GAUGE_GAP = 4;

/** A segment's track and its fill, as paths in a `DIAL.size` box. */
export function gaugeArcs(segments: readonly number[]): Array<{ track: string; fill?: string }> {
	const n = segments.length;
	const each = (GAUGE_SWEEP - GAUGE_GAP * (n - 1)) / n;
	return segments.map((fill, k) => {
		const start = GAUGE_START + k * (each + GAUGE_GAP);
		const arc: { track: string; fill?: string } = { track: arc_(start, start + each) };
		if (fill > 0) arc.fill = arc_(start, start + each * Math.min(1, fill));
		return arc;
	});
}

/** The ring's full circle. */
export function ringPath(): string {
	const c = DIAL.size / 2;
	const r = c - DIAL.thickness / 2;
	return `M${c} ${c - r} A${r} ${r} 0 1 1 ${c} ${c + r} A${r} ${r} 0 1 1 ${c} ${c - r}`;
}

/** An arc between two clock angles (degrees clockwise from twelve). */
function arc_(from: number, to: number): string {
	const c = DIAL.size / 2;
	const r = c - DIAL.thickness / 2;
	const at = (deg: number) => {
		const a = ((deg - 90) * Math.PI) / 180;
		return `${r2(c + r * Math.cos(a))} ${r2(c + r * Math.sin(a))}`;
	};
	return `M${at(from)} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`;
}
