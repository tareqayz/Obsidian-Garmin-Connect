import { axisFormat, niceTicks } from "./series";

/**
 * Chart geometry, kept out of the components.
 *
 * Svelte renders the marks; this works out where they go. Separating the two
 * means the arithmetic is unit-testable and the components stay readable as
 * markup.
 */

export const PAD = { top: 14, right: 14, bottom: 26, left: 46 };
/** Bars never fill their slot — the leftover is deliberate air. */
export const BAR_MAX = 24;
/** The surface gap that separates touching marks. Never a stroke. */
export const GAP = 2;

export interface ScaleOptions {
	count: number;
	values: readonly number[];
	width: number;
	height: number;
	/** Bars must start at zero; lines need not. */
	zeroBased?: boolean;
	goal?: number;
}

export interface Scale {
	width: number;
	height: number;
	inner: { w: number; h: number };
	band: number;
	min: number;
	max: number;
	ticks: number[];
	formatTick: (value: number) => string;
	x: (index: number) => number;
	y: (value: number) => number;
}

export function buildScale(opts: ScaleOptions): Scale {
	const width = Math.max(240, opts.width);
	const height = opts.height;
	const inner = {
		w: Math.max(10, width - PAD.left - PAD.right),
		h: Math.max(10, height - PAD.top - PAD.bottom),
	};

	const zeroBased = opts.zeroBased !== false;
	const candidates = opts.goal === undefined ? [...opts.values] : [...opts.values, opts.goal];
	let min = candidates.length ? Math.min(...candidates) : 0;
	let max = candidates.length ? Math.max(...candidates) : 1;

	if (zeroBased) min = Math.min(0, min);
	if (min === max) {
		// A flat series still deserves a readable axis rather than a divide by zero.
		min = zeroBased ? 0 : min - 1;
		max = max + 1;
	} else if (!zeroBased) {
		const headroom = (max - min) * 0.12;
		min -= headroom;
		max += headroom;
	}

	const ticks = niceTicks(min, max);
	const band = opts.count > 0 ? inner.w / opts.count : inner.w;

	return {
		width,
		height,
		inner,
		band,
		min,
		max,
		ticks,
		formatTick: axisFormat(ticks),
		x: (i) => band * i + band / 2,
		y: (v) => inner.h - ((v - min) / (max - min)) * inner.h,
	};
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

export function linePath(values: readonly number[], scale: Scale): string {
	return values.map((v, i) => `${i === 0 ? "M" : "L"}${scale.x(i)},${scale.y(v)}`).join(" ");
}

/** Bars are capped so a sparse range does not produce absurdly fat columns. */
export function barWidth(scale: Scale): number {
	return Math.min(BAR_MAX, Math.max(1, scale.band - GAP));
}

/** First, last and two between — never a label per column. */
export function xLabelIndices(count: number): number[] {
	if (count <= 0) return [];
	if (count <= 4) return [...Array(count).keys()];
	return [...new Set([0, Math.floor(count / 3), Math.floor((2 * count) / 3), count - 1])].sort(
		(a, b) => a - b,
	);
}

export function anchorFor(index: number, count: number): "start" | "middle" | "end" {
	if (index === 0) return "start";
	if (index === count - 1) return "end";
	return "middle";
}
