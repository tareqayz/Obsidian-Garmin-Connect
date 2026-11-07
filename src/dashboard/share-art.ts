import type { Point } from "./map-view";

/**
 * The share images' backgrounds, drawn by the plugin rather than taken from
 * Garmin: Topographic's contour lines come from a smooth random field seeded
 * by the activity (the same activity always gets the same hills), and the
 * Map template's bands are plain chevrons and stripes.
 *
 * Pure: no Obsidian import.
 */

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A small seeded generator (mulberry32): the same seed, the same numbers. */
export function seeded(seed: number): () => number {
	let s = Math.floor(Math.abs(seed)) % 4_294_967_296 >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
	};
}

export interface ContourOptions {
	/** The grid the field is sampled on, in points. */
	cell?: number;
	/** How many lines of equal height. */
	levels?: number;
	/** How many hills and hollows make the field. */
	bumps?: number;
	/** The hills' widths, as shares of the box's longer side. */
	spread?: readonly [number, number];
}

/**
 * Lines of equal height over a `width` × `height` box: marching squares on a
 * field of Gaussian hills and hollows, each line smoothed once (Chaikin).
 */
export function contourLines(seed: number, width: number, height: number, options: ContourOptions = {}): Point[][] {
	const cell = options.cell ?? 5;
	const levels = options.levels ?? 22;
	const random = seeded(seed);
	const span = Math.max(width, height);
	const [narrow, wide] = options.spread ?? [0.05, 0.17];
	const bumps = Array.from({ length: options.bumps ?? 22 }, () => ({
		x: (random() * 1.3 - 0.15) * width,
		y: (random() * 1.3 - 0.15) * height,
		s: (narrow + random() * (wide - narrow)) * span,
		a: random() * 2 - 1,
	}));
	const field = (x: number, y: number) => {
		let f = 0;
		for (const b of bumps) {
			const dx = x - b.x;
			const dy = y - b.y;
			f += b.a * Math.exp(-(dx * dx + dy * dy) / (2 * b.s * b.s));
		}
		return f;
	};
	const nx = Math.ceil(width / cell) + 1;
	const ny = Math.ceil(height / cell) + 1;
	const values: number[][] = [];
	let lo = Infinity;
	let hi = -Infinity;
	for (let j = 0; j < ny; j += 1) {
		const row: number[] = [];
		for (let i = 0; i < nx; i += 1) {
			const f = field(i * cell, j * cell);
			row.push(f);
			lo = Math.min(lo, f);
			hi = Math.max(hi, f);
		}
		values.push(row);
	}
	return isoLines(
		values,
		Array.from({ length: levels }, (_, k) => lo + ((hi - lo) * (k + 1)) / (levels + 1)),
		cell,
	);
}

/** The lines where a field sampled every `cell` points crosses each level, joined and smoothed once. */
export function isoLines(values: number[][], levels: readonly number[], cell: number): Point[][] {
	const lines: Point[][] = [];
	for (const level of levels) for (const line of joinSegments(isoSegments(values, level, cell))) lines.push(chaikin(line));
	return lines;
}

type Segment = [Point, Point];

/** Marching squares: the pieces of the line where the field crosses `level`. */
function isoSegments(values: number[][], level: number, cell: number): Segment[] {
	const out: Segment[] = [];
	for (let j = 0; j + 1 < values.length; j += 1) {
		for (let i = 0; i + 1 < values[j].length; i += 1) {
			const a = values[j][i];
			const b = values[j][i + 1];
			const c = values[j + 1][i + 1];
			const d = values[j + 1][i];
			const index = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
			if (index === 0 || index === 15) continue;
			const x = i * cell;
			const y = j * cell;
			const lerp = (p: number, q: number) => (level - p) / (q - p);
			const top: Point = [x + cell * lerp(a, b), y];
			const right: Point = [x + cell, y + cell * lerp(b, c)];
			const bottom: Point = [x + cell * lerp(d, c), y + cell];
			const left: Point = [x, y + cell * lerp(a, d)];
			switch (index) {
				case 1:
				case 14:
					out.push([left, bottom]);
					break;
				case 2:
				case 13:
					out.push([bottom, right]);
					break;
				case 3:
				case 12:
					out.push([left, right]);
					break;
				case 4:
				case 11:
					out.push([top, right]);
					break;
				case 6:
				case 9:
					out.push([top, bottom]);
					break;
				case 7:
				case 8:
					out.push([left, top]);
					break;
				case 5:
					out.push([left, top], [bottom, right]);
					break;
				case 10:
					out.push([top, right], [left, bottom]);
					break;
			}
		}
	}
	return out;
}

const keyOf = ([x, y]: Point) => `${Math.round(x * 100)},${Math.round(y * 100)}`;

/** The segments joined end to end into lines. */
function joinSegments(segments: Segment[]): Point[][] {
	const ends = new Map<string, number[]>();
	segments.forEach(([p, q], n) => {
		for (const point of [p, q]) {
			const key = keyOf(point);
			const list = ends.get(key);
			if (list) list.push(n);
			else ends.set(key, [n]);
		}
	});
	const used = new Uint8Array(segments.length);
	const next = (point: Point): Point | null => {
		for (const n of ends.get(keyOf(point)) ?? []) {
			if (used[n]) continue;
			used[n] = 1;
			const [p, q] = segments[n];
			return keyOf(p) === keyOf(point) ? q : p;
		}
		return null;
	};
	const lines: Point[][] = [];
	segments.forEach(([p, q], n) => {
		if (used[n]) return;
		used[n] = 1;
		const line: Point[] = [p, q];
		for (let point = next(q); point; point = next(point)) line.push(point);
		const head: Point[] = [];
		for (let point = next(p); point; point = next(point)) head.push(point);
		lines.push([...head.reverse(), ...line]);
	});
	return lines.filter((line) => line.length > 2);
}

/** One round of Chaikin's corner cutting: a smoother line through the same places. */
function chaikin(line: Point[]): Point[] {
	if (line.length < 3) return line;
	const out: Point[] = [line[0]];
	for (let i = 0; i + 1 < line.length; i += 1) {
		const [ax, ay] = line[i];
		const [bx, by] = line[i + 1];
		out.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
	}
	out.push(line[line.length - 1]);
	return out;
}

/**
 * Nested chevrons pointing up, their tip at `apexX` above the box: the Map
 * template's header pattern. Each is `spacing` below the last, its arms at 45°.
 */
export function chevronLines(box: Box, apexX: number, spacing: number): Point[][] {
	const lines: Point[][] = [];
	const reach = Math.max(box.w, box.h) + spacing * 4;
	for (let top = box.y - box.h; top < box.y + box.h + reach; top += spacing) {
		lines.push([
			[apexX - reach, top + reach],
			[apexX, top],
			[apexX + reach, top + reach],
		]);
	}
	return lines;
}

/** Parallel lines falling to the right (\), `spacing` apart along the box's left edge: the Map template's footer. */
export function stripeLines(box: Box, spacing: number): Point[][] {
	const lines: Point[][] = [];
	for (let start = box.y - box.w; start < box.y + box.h; start += spacing) {
		lines.push([
			[box.x, start],
			[box.x + box.w, start + box.w],
		]);
	}
	return lines;
}
