import { titleCase } from "./day";

/**
 * Garmin's banded dials: each stat's bands, their colours and names, the
 * class limits that grade a value, and where the marker sits. At a Glance
 * draws them on its cards (`glance.ts`); the Performance Stats pages on their
 * own dials.
 *
 * Pure: a value in, a dial out. Reading the value from a day row or the
 * account is the caller's business.
 */

/** Obsidian's named colours, which is what the Figma twin binds every series to. */
export type Tone = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink";

export interface GaugeSegment {
	/** Fractions of the dial, 0 at its start and 1 at its end. */
	from: number;
	to: number;
	tone: Tone;
}

/** A banded dial: Garmin's gauge for VO₂ Max, FTP, Endurance and the rest. */
export interface Gauge {
	/** The number in the middle, formatted. */
	value: string;
	/** The band's name, under the dial. */
	label?: string;
	segments: GaugeSegment[];
	/** Where the marker sits, as a fraction of the dial. None when it cannot be placed. */
	at?: number;
	/** The marker takes the colour of the band it sits in. */
	tone?: Tone;
}

/** Garmin grades VO₂ Max and FTP by sex (`AccountInfo.sex`). */
export type Sex = "male" | "female";

const FIVE: Tone[] = ["red", "orange", "green", "blue", "purple"];
const SIX: Tone[] = ["red", "orange", "green", "blue", "purple", "pink"];
const SEVEN: Tone[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function bands(bounds: readonly number[], tones: readonly Tone[]): GaugeSegment[] {
	return tones.map((tone, i) => ({ from: bounds[i]!, to: bounds[i + 1]!, tone }));
}

function bandAt(segments: readonly GaugeSegment[], at: number): number {
	const i = segments.findIndex((s) => at < s.to);
	return i < 0 ? segments.length - 1 : i;
}

function gauge(value: string, segments: GaugeSegment[], at: number | undefined, label?: string): Gauge {
	return { value, label, segments, at, tone: at === undefined ? undefined : segments[bandAt(segments, at)]!.tone };
}

/** Linear interpolation of `value` inside `[lo, hi]`, placed inside a band. */
function within(value: number, lo: number, hi: number, band: GaugeSegment): number {
	const t = hi === lo ? 0.5 : clamp01((value - lo) / (hi - lo));
	return band.from + t * (band.to - band.from);
}

/* VO₂ Max. Graded against Garmin's age-and-sex table (from The Cooper
   Institute). Unlike FTP the dial is not linear: every band has a fixed arc and
   the marker is placed inside its band. */

/** Lower limits of Fair, Good, Excellent and Superior, by the top of each age band. */
const VO2_TABLE: Record<Sex, Array<[number, [number, number, number, number]]>> = {
	male: [
		[29, [41.7, 45.4, 51.1, 55.4]],
		[39, [40.5, 44.0, 48.3, 54.0]],
		[49, [38.5, 42.4, 46.4, 52.5]],
		[59, [35.6, 39.2, 43.4, 48.9]],
		[69, [32.3, 35.5, 39.5, 45.7]],
		[Infinity, [29.4, 32.3, 36.7, 42.1]],
	],
	female: [
		[29, [36.1, 39.5, 43.9, 49.6]],
		[39, [34.4, 37.8, 42.4, 47.4]],
		[49, [33.0, 36.3, 39.7, 45.3]],
		[59, [30.1, 33.0, 36.7, 41.1]],
		[69, [27.5, 30.0, 33.0, 37.8]],
		[Infinity, [25.9, 28.1, 30.9, 36.7]],
	],
};
export const VO2_CLASSES: readonly string[] = ["Poor", "Fair", "Good", "Excellent", "Superior"];
const VO2_BOUNDS = [0, 0.402, 0.546, 0.69, 0.849, 1];

export function vo2Gauge(value: number, age: number | undefined, sex: Sex | undefined): Gauge {
	const segments = bands(VO2_BOUNDS, FIVE);
	const shown = String(Math.round(value));
	if (age === undefined || !sex) return gauge(shown, segments, undefined);
	const limits = VO2_TABLE[sex].find(([top]) => age <= top)![1];
	const index = limits.filter((l) => value >= l).length;
	// The open ends get a band's worth of range each, scaled to their arc.
	const lo = index === 0 ? limits[0] - (limits[1] - limits[0]) * 2.8 : limits[index - 1]!;
	const hi = index === 4 ? limits[3] + (limits[3] - limits[2]) : limits[index]!;
	return gauge(shown, segments, within(value, lo, hi, segments[index]!), VO2_CLASSES[index]);
}

/* FTP, as W/kg. A linear dial from 0 to about 6 W/kg for men, graded by
   Garmin's FTP table; the women's dial is the same shape, scaled. */

const FTP_TABLE: Record<Sex, [number, number, number, number]> = {
	male: [2.23, 2.79, 3.93, 5.05],
	female: [1.9, 2.36, 3.33, 4.3],
};
export const FTP_CLASSES: readonly string[] = ["Untrained", "Fair", "Good", "Excellent", "Superior"];

export function ftpGauge(wattsPerKg: number, sex: Sex | undefined): Gauge {
	const limits = FTP_TABLE[sex ?? "male"];
	const top = limits[3] * (6 / 5.05);
	const f = (v: number) => clamp01(v / top);
	const segments = bands([0, ...limits.map(f), 1], FIVE);
	// Without the sex the bands are only a guess, so the class name is left off.
	const label = sex ? FTP_CLASSES[limits.filter((l) => wattsPerKg >= l).length] : undefined;
	return gauge(wattsPerKg.toFixed(2), segments, f(wattsPerKg), label);
}

/* Training Readiness: 0–100, Garmin's own bands (Poor 1–24 … Prime 95–100). */

export function readinessDial(score: number): Gauge {
	return gauge(String(score), bands([0, 0.25, 0.5, 0.75, 0.95, 1], FIVE), clamp01(score / 100));
}

/* Endurance Score. Garmin sends the class limits with the score — they depend on
   age and sex — and the dial is linear between its own ends, which is what puts
   6,336 a third of the way round. */

export const ENDURANCE_CLASSES: readonly string[] = ["Recreational", "Intermediate", "Trained", "Well-Trained", "Expert", "Superior", "Elite"];

/** One person's Endurance Score dial, as Garmin sends it with the score. */
export interface EnduranceScale {
	/** The dial's ends. */
	low?: number;
	high?: number;
	/** Where Intermediate, Trained, Well-Trained, Expert, Superior and Elite start. */
	limits?: readonly (number | undefined)[];
}

/**
 * Seven classes on a dial linear between the scale's ends. Without a whole
 * scale the classes share the dial evenly and the marker sits in the middle
 * of the class Garmin names (`classification`, 1–7), if it names one.
 */
export function enduranceGauge(score: number, scale: EnduranceScale = {}, classification?: number): Gauge {
	const { low, high, limits = [] } = scale;
	const known = low !== undefined && high !== undefined && high > low && limits.length === 6 && limits.every((v) => v !== undefined);
	const f = (v: number) => clamp01((v - low!) / (high! - low!));
	const segments = known ? bands([0, ...limits.map((v) => f(v!)), 1], SEVEN) : bands([0, 1, 2, 3, 4, 5, 6, 7].map((i) => i / 7), SEVEN);
	const named = classification !== undefined && classification >= 1 && classification <= 7;
	const index = named ? classification - 1 : known ? limits.filter((v) => score >= v!).length : undefined;
	const at = known ? f(score) : index !== undefined ? (index + 0.5) / 7 : undefined;
	return gauge(score.toLocaleString(), segments, at, index !== undefined ? ENDURANCE_CLASSES[index] : undefined);
}

/* Hill Score: 0–100 on a linear dial, bands read off the app. */

export const HILL_CLASSES: readonly string[] = ["Recreational", "Challenger", "Trained", "Well-Trained", "Expert", "Elite"];
const HILL_BOUNDS = [0, 0.255, 0.505, 0.705, 0.855, 0.945, 1];

/** The class is Garmin's (`classification`, 1–6) when it sends one, else the band the score falls in. */
export function hillGauge(score: number, classification?: number): Gauge {
	const segments = bands(HILL_BOUNDS, SIX);
	const at = clamp01(score / 100);
	const index = classification !== undefined && classification >= 1 && classification <= 6 ? classification - 1 : bandAt(segments, at);
	return gauge(String(Math.round(score)), segments, at, HILL_CLASSES[index]);
}

/* Running Economy. Lower is better and only a class name comes back, so the
   marker sits inside the named class. The limits that place it there are
   read off one reading of the app's dial (223–224, just into Intermediate),
   and are clamped to the class so a wrong guess cannot contradict the name. */

const ECONOMY_CLASSES = ["RECREATIONAL", "INTERMEDIATE", "TRAINED", "WELL_TRAINED", "EXPERT", "SUPERIOR", "ELITE"];
const ECONOMY_BOUNDS = [0, 0.179, 0.366, 0.55, 0.728, 0.818, 0.906, 1];
/** Each class's worse and better limit, in the score's own units. */
const ECONOMY_RANGES: Array<[number, number]> = [
	[235, 225],
	[225, 215],
	[215, 205],
	[205, 195],
	[195, 190],
	[190, 185],
	[185, 175],
];

/** `classification` is Garmin's own word, "INTERMEDIATE"; one this build does not know leaves the marker off. */
export function economyGauge(score: number, classification?: string): Gauge {
	const segments = bands(ECONOMY_BOUNDS, SEVEN);
	const index = ECONOMY_CLASSES.indexOf((classification ?? "").toUpperCase());
	const shown = String(Math.round(score));
	if (index < 0) return gauge(shown, segments, undefined, titleCase(classification));
	const [worse, better] = ECONOMY_RANGES[index]!;
	const at = within(worse - score, 0, worse - better, segments[index]!);
	return gauge(shown, segments, at, titleCase(classification));
}
