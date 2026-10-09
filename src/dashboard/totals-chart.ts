import type { Chart, RangeId } from "./activities";

/**
 * Where the marks of a "<Metric> Totals" chart go, measured off the app.
 *
 * Coordinates are the chart's own, title included: 340 high, whatever wide.
 * The plot keeps the app's fixed insets and stretches across the rest, so a
 * pane draws the phone's chart wider rather than a different chart.
 *
 * A week and four weeks put a day at each point, the first at the plot's left
 * edge and the last at its right; a year gives each month a slot and stands
 * its bar at the slot's start, leaving the last slot's width as air on the
 * right. Only the two ends of a day range are labelled; every month is.
 */

export const CHART_HEIGHT = 340;
/** The title's band above the plot. */
export const TITLE_HEIGHT = 40;

interface Frame {
	left: number;
	/** Gap between the plot and the chart's right edge. */
	right: number;
	top: number;
	zero: number;
	bar: number;
	/** The y labels' right edge. */
	labelRight: number;
	dotY: number;
}

const FRAMES: Record<RangeId, Frame> = {
	"7d": { left: 63.7, right: 58, top: 116, zero: 300.7, bar: 7, labelRight: 38.6, dotY: 311.1 },
	"4w": { left: 51, right: 45.3, top: 116, zero: 300.7, bar: 4, labelRight: 38.6, dotY: 311.1 },
	"1y": { left: 63.7, right: 50, top: 118.8, zero: 285.7, bar: 8.3, labelRight: 46.7, dotY: 293.1 },
};

const SMALL_DOT = 1.75;
const LARGE_DOT = 4;

export interface ChartGeometry {
	width: number;
	gridlines: Array<{ y: number; x1: number; x2: number; label: string; labelX: number }>;
	bars: Array<{ path: string }>;
	dots: Array<{ cx: number; cy: number; r: number }>;
	/** Rotated labels stand upright, reading bottom to top, ending just under their dot. */
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
}

export function chartGeometry(chart: Chart, width: number): ChartGeometry {
	const f = FRAMES[chart.range];
	const right = Math.max(f.left + 40, width - f.right);
	const n = chart.slots.length;
	const top = chart.ticks[chart.ticks.length - 1] || 1;
	const yearly = chart.range === "1y";

	// A year's bars stand at slot starts; a day range spans first point to last.
	const step = yearly ? (right - f.left) / n : (right - f.left) / Math.max(1, n - 1);
	const x = (i: number) => f.left + i * step;
	const y = (v: number) => f.zero - (v / top) * (f.zero - f.top);

	const gridlines = chart.ticks.map((t) => ({ y: y(t), x1: f.left, x2: right, label: t.toLocaleString(), labelX: f.labelRight }));

	const bars: ChartGeometry["bars"] = [];
	chart.values.forEach((v, i) => {
		if (!(v > 0)) return;
		const h = f.zero - y(Math.min(v, top));
		bars.push({ path: barPath(x(i) - f.bar / 2, f.zero - h, f.bar, h, f.bar / 2) });
	});

	const dots = chart.slots.map((_, i) => ({
		cx: x(i),
		cy: f.dotY,
		r: yearly || i === 0 || i === n - 1 ? LARGE_DOT : SMALL_DOT,
	}));

	const labels = yearly
		? chart.slots.map((s, i) => ({ x: x(i) + 3.5, y: f.dotY + 10, text: s.label, rotated: true }))
		: [0, n - 1].filter((i, k, all) => n > 0 && all.indexOf(i) === k).map((i) => ({ x: x(i), y: 324, text: chart.slots[i]!.label, rotated: false }));

	return { width, gridlines, bars, dots, labels };
}

/** Rounded at the data end, square at the baseline. */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
	const radius = Math.min(r, w / 2, Math.max(0, h));
	const bottom = y + h;
	return (
		`M${x},${bottom} L${x},${y + radius} Q${x},${y} ${x + radius},${y} ` +
		`L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${bottom} Z`
	);
}
