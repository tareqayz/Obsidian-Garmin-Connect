import type { HealthSheetView } from "./health-status-pages";
import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";

/**
 * Health Status geometry, measured off the Obsidian twin (Figma page 239:14)
 * at the phone's 402pt; the pane's dialog is the same 402pt sheet.
 *
 * Pure.
 */

/** Where a ring's marker sits, degrees anticlockwise from 3 o'clock. */
export function markerAngle(pct: number, status?: string): number {
	const p = Math.max(0, Math.min(100, pct));
	// Out of range is unseen: inferred on the orange arcs, BELOW from its
	// bottom cap up to 9 o'clock, ABOVE from 3 o'clock down to its cap.
	if (status === "BELOW") return r2(240 - 0.6 * p);
	if (status === "ABOVE") return r2(-0.6 * p);
	return r2(180 - 1.8 * p);
}

export interface RingGeometry {
	size: number;
	cx: number;
	cy: number;
	r: number;
	stroke: number;
	/** The upper in-range arc and the two lower ones. */
	upper: string;
	left: string;
	right: string;
	marker: { x: number; y: number; r: number; halo: number };
}

const rad = (deg: number) => (deg * Math.PI) / 180;
function point(cx: number, cy: number, r: number, deg: number): [number, number] {
	return [r2(cx + r * Math.cos(rad(deg))), r2(cy - r * Math.sin(rad(deg)))];
}
/** An arc from `from` to `to` degrees, clockwise on screen when from > to. */
function arc(cx: number, cy: number, r: number, from: number, to: number): string {
	const [x1, y1] = point(cx, cy, r, from);
	const [x2, y2] = point(cx, cy, r, to);
	const large = Math.abs(from - to) > 180 ? 1 : 0;
	const sweep = from > to ? 1 : 0;
	return `M${x1} ${y1} A${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`;
}

function ring(size: number, r: number, stroke: number, gap: number, markerR: number, halo: number, pct: number, status?: string): RingGeometry {
	const c = size / 2;
	const [x, y] = point(c, c, r, markerAngle(pct, status));
	return {
		size,
		cx: c,
		cy: c,
		r,
		stroke,
		upper: arc(c, c, r, 180 - gap, gap),
		left: arc(c, c, r, 240, 180 + gap),
		right: arc(c, c, r, -gap, -60),
		marker: { x, y, r: markerR, halo },
	};
}

/** A card's mini ring: outer radius 17.1, stroke 3.3, marker r 3.4 in a 4.6 halo. */
export function miniRing(pct: number, status?: string): RingGeometry {
	return ring(40, 15.45, 3.3, 6, 3.4, 4.6, pct, status);
}

/** A sheet's big ring: mid radius 80, stroke 11.6, marker r 11 in a 15.2 halo. */
export function bigRing(pct: number, status?: string): RingGeometry {
	return ring(190, 80, 11.6, 2.4, 11, 15.2, pct, status);
}

/** The Sleep Averages chart's frame, under its title: gridlines 44.75pt apart, the dots 12pt under the last. */
export const SHEET_FRAME: ChartFrame = { left: 43, inset: 24, gridLeft: 16, gridInset: 16, top: 22.5, baseline: 201.5, labelRight: 16, dotY: 213.7, labelY: 228, height: 238 };

export interface SheetPlot extends PlotBox {
	band: string;
	line: string;
	points: Array<{ x: number; y: number }>;
}

/** The sheet's chart at `width`: the band between each day's limits and the sleep line over it. */
export function sheetPlot(view: HealthSheetView, width: number): SheetPlot {
	const { box, scale } = plotBox(SHEET_FRAME, width, view.ticks, view.axis, view.tickLabels);
	const n = view.days.length;
	const xs = view.days.map((_, i) => scale.x(n <= 1 ? 0.5 : i / (n - 1)));
	const tops: string[] = [];
	const bottoms: string[] = [];
	view.band.forEach((b, i) => {
		if (!b) return;
		tops.push(`${r2(xs[i]!)} ${r2(scale.y(b.hi))}`);
		bottoms.unshift(`${r2(xs[i]!)} ${r2(scale.y(b.lo))}`);
	});
	const band = tops.length ? `M${[...tops, ...bottoms].join(" L")} Z` : "";
	const points = view.line.flatMap((v, i) => (v === null ? [] : [{ x: r2(xs[i]!), y: r2(scale.y(v)) }]));
	return { ...box, band, line: linePath(view.line.map((v, i) => [xs[i]!, v === null ? null : scale.y(v)])), points };
}
