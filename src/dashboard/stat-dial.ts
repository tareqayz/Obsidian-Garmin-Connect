import type { Gauge, GaugeSegment, Tone } from "./gauges";

/**
 * The Performance Stats dial (Figma "Stat Dial", Obsidian twin 442:1349):
 * a 300° gauge whose ends sit at ±150° from 12 o'clock, its bands arcs with a
 * gap between them and round caps at the two ends, a marker on the ring's
 * centreline in its band's colour, and a value and a line under it. The full
 * ring (Running Tolerance) is a 360° track with the value's share drawn from
 * 12 o'clock.
 *
 * Every dial is a 196 × 196 box with its centre at (98, 98); the phone places
 * it at (cx − 98, cy − 98). Angles are degrees clockwise from 12 o'clock, a
 * point at (cx + r·sin α, cy − r·cos α). A `Gauge`'s fractions (0 at the
 * dial's start, 1 at its end) map linearly onto the sweep.
 *
 * Pure.
 */

export const DIAL_SIZE = 196;
export const DIAL_CENTRE = DIAL_SIZE / 2;
/** Degrees from 12 o'clock to either end of the sweep. */
export const DIAL_END = 150;
/** The marker's dot, 16 pt across. */
export const MARKER_RADIUS = 8;

export type DialKind = "vo2" | "readiness" | "ftp" | "hill" | "endurance" | "hrv" | "tolerance" | "recovery" | "economy";

/** A line of text in the dial, as the twin sets it: its box's top in the 196 box, and its size. */
export interface DialText {
	top: number;
	size: number;
	line: number;
}

/** One kind of dial, measured off its twin. */
export interface DialSpec {
	/** The ring's outer radius and width. */
	radius: number;
	width: number;
	/** Degrees left empty between two bands. */
	gap: number;
	/** The marker's outline round the dot: 2 pt (ring), 3 pt (Running Economy's) or 4 pt (halo); none for a dial without one. */
	outline: number;
	/** The marker's dot, where it isn't `MARKER_RADIUS`: Running Economy's is 15 pt across. */
	markerRadius?: number;
	/** VO₂ Max lays its bands over a ring in the page's colour, which shows in the gaps. */
	separators?: boolean;
	/** Running Tolerance: a full ring, a track and the value's share, no bands. */
	full?: boolean;
	value: DialText;
	/** The line under the value: the class, "100", "7d Avg". `strong` sets it in the text colour rather than muted, never bold (FTP's class word). */
	label: DialText & { strong?: boolean };
	/** A unit set after the value on its baseline (HRV Status's "ms"). */
	unit?: { size: number; line: number };
}

export const DIAL_KINDS: Readonly<Record<DialKind, DialSpec>> = {
	vo2: { radius: 84, width: 8, gap: 1.9, outline: 2, separators: true, value: { top: 66.91, size: 35, line: 42 }, label: { top: 109.45, size: 15, line: 20 } },
	readiness: { radius: 88, width: 8, gap: 3, outline: 4, value: { top: 67.59, size: 35, line: 42 }, label: { top: 107.17, size: 16, line: 21 } },
	// The FTP shot's gaps are 2.17° at half brightness; its class word is regular, in the text colour (the twin's white label).
	ftp: { radius: 83, width: 8, gap: 2.17, outline: 2, value: { top: 65.9, size: 35, line: 42 }, label: { top: 110.78, size: 15, line: 20, strong: true } },
	hill: { radius: 85.6, width: 6, gap: 1.9, outline: 2, value: { top: 61.61, size: 43, line: 52 }, label: { top: 112.65, size: 16, line: 21 } },
	endurance: { radius: 85.6, width: 6, gap: 1.85, outline: 2, value: { top: 61.62, size: 43, line: 52 }, label: { top: 112.89, size: 16, line: 21 } },
	hrv: {
		radius: 88,
		width: 8,
		gap: 3,
		outline: 4,
		value: { top: 67.89, size: 35, line: 42 },
		unit: { size: 20, line: 24 },
		label: { top: 107.8, size: 15, line: 20 },
	},
	tolerance: { radius: 84, width: 8, gap: 0, outline: 0, full: true, value: { top: 66.87, size: 35, line: 42 }, label: { top: 109.25, size: 16, line: 21 } },
	recovery: { radius: 88, width: 10, gap: 0, outline: 0, value: { top: 68.26, size: 35, line: 39.7 }, label: { top: 107.5, size: 15, line: 20 } },
	// Running Economy's own dial (twin 751:9924, off the 2026-10-11 Current shot): the ring 82.55 → 92.45, 3.26°
	// gaps, a Ø 15 marker in a 3 pt ring, the number's box at 76.2. No line inside: the class word sits under the
	// dial, so the page passes none and `label` only keeps the type whole.
	economy: {
		radius: 92.45,
		width: 9.9,
		gap: 3.26,
		outline: 3,
		markerRadius: 7.5,
		value: { top: 76.2, size: 35, line: 42 },
		label: { top: 118.2, size: 15, line: 20 },
	},
};

/** A fraction of the sweep as an angle: 0 → −150°, 1 → 150°. */
export function dialAngle(fraction: number): number {
	return -DIAL_END + 2 * DIAL_END * Math.min(1, Math.max(0, fraction));
}

/** An angle on the sweep as a fraction of it: the inverse of `dialAngle`. */
export function dialFraction(angle: number): number {
	return (angle + DIAL_END) / (2 * DIAL_END);
}

/**
 * Bands from boundaries in degrees, as a spec measures them off the app: n + 1
 * angles from −150 to 150 for n tones.
 */
export function segmentsFromAngles(angles: readonly number[], tones: readonly Tone[]): GaugeSegment[] {
	return tones.map((tone, i) => ({ from: dialFraction(angles[i]), to: dialFraction(angles[i + 1]), tone }));
}

export interface DialBand {
	/** Degrees from 12 o'clock, start before end. */
	from: number;
	to: number;
	tone: Tone;
	/** A stroked arc on the ring's centreline, butt-ended. */
	d: string;
}

export interface DialGeometry {
	/** The ring's centreline radius and width. */
	rc: number;
	width: number;
	/** The page-coloured ring under the bands (VO₂ Max). */
	separators?: string;
	/** The full ring's track and its filled share (Running Tolerance). */
	track?: string;
	progress?: string;
	bands: DialBand[];
	/** The round ends of the sweep, in the first and last band's colours. */
	caps: Array<{ x: number; y: number; r: number; tone: Tone }>;
	marker?: { x: number; y: number; angle: number; tone?: Tone; r: number; outline: number };
}

/** A point on the dial's ring, `angle` degrees clockwise from 12 o'clock. */
export function dialPoint(r: number, angle: number): [number, number] {
	const rad = (angle * Math.PI) / 180;
	return [DIAL_CENTRE + r * Math.sin(rad), DIAL_CENTRE - r * Math.cos(rad)];
}

/** An open clockwise arc from `a0` to `a1`, for a stroke; a whole turn is drawn as two halves. */
export function dialArc(r: number, a0: number, a1: number): string {
	if (a1 - a0 >= 360) return `${dialArc(r, a0, a0 + 180)}${dialArc(r, a0 + 180, a0 + 360).replace(/^M[^A]*/, "")}`;
	const [x0, y0] = dialPoint(r, a0);
	const [x1, y1] = dialPoint(r, a1);
	return `M${fix(x0)} ${fix(y0)}A${fix(r)} ${fix(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${fix(x1)} ${fix(y1)}`;
}

const fix = (n: number) => String(Math.round(n * 100) / 100);

/**
 * What a dial draws for a gauge: each band its arc, the gap split either side
 * of each boundary inside the sweep, a round cap at each end in that end's
 * band colour, and the marker at the gauge's `at`. `progress` (0–1) fills a
 * full ring instead (`kind` "tolerance"); its gauge's segments are ignored.
 */
export function dialGeometry(kind: DialKind, gauge: Pick<Gauge, "segments" | "at" | "tone"> | null, progress?: number): DialGeometry {
	const spec = DIAL_KINDS[kind];
	const rc = spec.radius - spec.width / 2;
	const geometry: DialGeometry = { rc, width: spec.width, bands: [], caps: [] };
	if (spec.full) {
		geometry.track = dialArc(rc, 0, 360);
		const share = Math.min(1, Math.max(0, progress ?? 0));
		if (share > 0) geometry.progress = dialArc(rc, 0, 360 * share);
		return geometry;
	}
	if (spec.separators) geometry.separators = dialArc(rc, -DIAL_END, DIAL_END);
	const segments = gauge?.segments ?? [];
	for (const s of segments) {
		const from = dialAngle(s.from) + (s.from > 0 ? spec.gap / 2 : 0);
		const to = dialAngle(s.to) - (s.to < 1 ? spec.gap / 2 : 0);
		if (to > from) geometry.bands.push({ from, to, tone: s.tone, d: dialArc(rc, from, to) });
	}
	const first = segments.find((s) => s.from <= 0);
	const last = [...segments].reverse().find((s) => s.to >= 1);
	const cap = (angle: number, tone: Tone) => {
		const [x, y] = dialPoint(rc, angle);
		geometry.caps.push({ x, y, r: spec.width / 2, tone });
	};
	if (first) cap(-DIAL_END, first.tone);
	if (last) cap(DIAL_END, last.tone);
	if (gauge?.at !== undefined && spec.outline > 0) {
		const angle = dialAngle(gauge.at);
		const [x, y] = dialPoint(rc, angle);
		geometry.marker = { x, y, angle, tone: gauge.tone, r: spec.markerRadius ?? MARKER_RADIUS, outline: spec.outline };
	}
	return geometry;
}
