/**
 * The few bits of geometry the Home cards share. Pure.
 *
 * Angles are degrees clockwise from twelve o'clock, which is how a dial reads.
 */

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
	const rad = ((deg - 90) * Math.PI) / 180;
	return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** An open arc from `a0` to `a1`, for a stroked path. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
	if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
	const [x0, y0] = polar(cx, cy, r, a0);
	const [x1, y1] = polar(cx, cy, r, a1);
	const large = a1 - a0 > 180 ? 1 : 0;
	return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Linear position of `t` across `[from, to]`, scaled to `width`. */
export function scaleX(t: number, from: number, to: number, width: number): number {
	return to > from ? ((t - from) / (to - from)) * width : 0;
}

/** "11:06 PM" in the reader's locale. */
export function clock(ms: number | undefined): string {
	if (ms === undefined) return "";
	return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
