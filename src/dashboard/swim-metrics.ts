import type { ActivityDetail, ActivityLength } from "../sync/activity-detail";
import type { Units } from "./activities";
import {
	blockSteps,
	fitStep,
	forcedLabels,
	niceLabels,
	niceStep,
	plain,
	roundHalfEven,
	TICKS,
	type AxisPlaces,
	type ChartContext,
	type ChartFigure,
	type MetricDef,
	type SeriesChart,
	type XAxis,
	type YAxis,
} from "./activity-chart-pages";
import { fixed } from "./activity-stats-pages";
import type { ActivityAxis } from "./routes";
import { duration } from "./series";

/**
 * A swim's charts that the run doesn't have, as the `MetricDef`s the two
 * swims' profiles (`sports/swimming.ts`) hand the Charts tab, and the rules
 * both swims share. The rules are the spec's (ref/activity-details/pool-swim
 * and open-water-swim, "Rules"), each proved on the captured swims; the ones
 * the shots could not settle are marked Inferred.
 *
 * - Units are the pool's (metres or yards), else the page's: a swim reads
 *   metres in a metric vault and yards in an imperial one (Inferred).
 * - A pace is per 100 m: 100 ÷ the speed in m/s, rounded to the second (Best
 *   Pace 68.78 s reads 1:09 where truncation gives 1:08); per 100 yd it is
 *   91.44 ÷ the speed (Inferred). Standing still reads "0:00", as a rest does.
 * - The pool's charts are its lengths, from the laps' `lengths` (Garmin's
 *   `/splits` lengthDTOs): one bar per length swum, on its own span of time or
 *   of metres; a rest is a gap in time and takes no room in distance (the
 *   web's placement: the phone draws its Distance bars one length late).
 * - Open water's charts are its samples, as the run's are: Pace an area,
 *   Strokes the stroke rate's area, Temperature steps.
 *
 * Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Units                                                              */
/* ------------------------------------------------------------------ */

/** A swim's unit of distance. */
export type SwimUnit = "m" | "yd";

export const METRES_PER_YARD = 0.9144;

/** The pool's unit, else the page's: yards in imperial (Inferred: no imperial swim was shot). */
export function swimUnit(detail: Pick<ActivityDetail, "pool">, units: Units): SwimUnit {
	return detail.pool?.unit ?? (units === "imperial" ? "yd" : "m");
}

/** Metres in the swim's unit. */
export function inUnit(metres: number, unit: SwimUnit): number {
	return unit === "yd" ? metres / METRES_PER_YARD : metres;
}

/** Seconds per 100 m (or 100 yd) at `speed` m/s; standing still is infinitely slow. */
export function per100(speed: number, unit: SwimUnit): number {
	return speed > 0 ? (unit === "yd" ? 100 * METRES_PER_YARD : 100) / speed : Infinity;
}

/** A pace to the second, "1:46"; Garmin's "0:00" standing still (a rest's); none without a speed. */
export function swimPace(speed: number | undefined, unit: SwimUnit): string | undefined {
	if (speed === undefined || !Number.isFinite(speed) || speed < 0) return undefined;
	return speed === 0 ? "0:00" : duration(per100(speed, unit));
}

/** "/100m", "/100yd". */
export function perHundred(unit: SwimUnit): string {
	return `/100${unit}`;
}

/** °C as Garmin sends it, or °F (Inferred). */
export function degrees(celsius: number, units: Units): number {
	return units === "imperial" ? (celsius * 9) / 5 + 32 : celsius;
}

export function degreeUnit(units: Units): string {
	return units === "imperial" ? "°F" : "°C";
}

/* ------------------------------------------------------------------ */
/*  Lengths                                                            */
/* ------------------------------------------------------------------ */

/** A pool length on both of the swim's axes: its timer seconds and its metres, from the start of the first length. */
export interface PlacedLength {
	length: ActivityLength;
	from: number;
	to: number;
	fromMetres: number;
	toMetres: number;
}

/**
 * Every length, swum or idle, in order, end to end: a pool swim's lengths
 * run its whole timer (its 58 add up to the 1,900.42 s), rests included.
 */
export function placedLengths(detail: Pick<ActivityDetail, "laps">): PlacedLength[] {
	const out: PlacedLength[] = [];
	let time = 0;
	let metres = 0;
	for (const lap of detail.laps) {
		for (const length of lap.lengths ?? []) {
			const from = time;
			const fromMetres = metres;
			time += length.duration;
			metres += length.distance;
			out.push({ length, from, to: time, fromMetres, toMetres: metres });
		}
	}
	return out;
}

/** A length swum covered a distance; an idle one (a rest) has none. */
export function isSwum(length: ActivityLength): boolean {
	return length.distance > 0;
}

/** The lengths swum, in order. */
export function swumLengths(detail: Pick<ActivityDetail, "laps">): ActivityLength[] {
	return detail.laps.flatMap((lap) => lap.lengths ?? []).filter(isSwum);
}

/** A length's speed: Garmin's, else its distance over its time. */
export function lengthSpeed(length: ActivityLength): number {
	if (length.speed !== undefined && length.speed > 0) return length.speed;
	return length.duration > 0 ? length.distance / length.duration : 0;
}

/** A length's strokes; none for a drill (no strokes recorded, Inferred). */
function strokesOf(length: ActivityLength): number | null {
	return length.strokes !== undefined && length.strokes > 0 ? length.strokes : null;
}

/** A length's Swolf (its seconds plus its strokes, as Garmin sends it); none without strokes. */
function swolfOf(length: ActivityLength): number | null {
	return strokesOf(length) !== null && length.swolf !== undefined && length.swolf > 0 ? length.swolf : null;
}

/**
 * A pool swim's samples on its two axes (`ChartsSpec.places`), from its
 * lengths. Time: the samples' own, the axis running to the last length's end
 * (the timer: a pool swim records its rests as laps), so the bars draw before
 * the samples arrive. Distance: the samples carry none, so the sample that
 * closes each length, the last at or before its end, sits at the metres swum
 * by then, and a rest's at the same metres as the length before it: one
 * point a length, so the heart rate drops straight down at a rest, as the
 * phone draws it (median error 0.7 pt), and nothing sits before the first
 * length ends. Without lengths, the samples' own.
 */
export function poolPlaces(detail: ActivityDetail, axis: ActivityAxis): AxisPlaces | undefined {
	const lengths = placedLengths(detail);
	const last = lengths[lengths.length - 1];
	if (!last) return undefined;
	const time = detail.samples.time ?? [];
	if (axis === "time") {
		let end = last.to;
		for (const t of time) if (isNumber(t) && t > end) end = t;
		return { at: time, end };
	}
	const at: Array<number | null> = time.map(() => null);
	let i = 0;
	let closing = -1;
	for (const p of lengths) {
		for (; i < time.length; i += 1) {
			const t = time[i];
			if (!isNumber(t)) continue;
			if (t > p.to) break;
			closing = i;
		}
		if (closing >= 0) at[closing] = p.toMetres;
	}
	return { at, end: last.toMetres };
}

/**
 * A per-length chart's bars on the chart's axis: one per length swum that
 * has a value, as wide as its time or its metres. A rest is a gap on the
 * Time axis and takes no room on the Distance axis, so the bars there touch.
 */
export function lengthBars(ctx: Pick<ChartContext, "detail" | "axis" | "end">, value: (length: ActivityLength) => number | null): NonNullable<SeriesChart["blocks"]> {
	const out: NonNullable<SeriesChart["blocks"]> = [];
	for (const p of placedLengths(ctx.detail)) {
		if (!isSwum(p.length)) continue;
		const v = value(p.length);
		if (v === null) continue;
		const [from, to] = ctx.axis === "distance" ? [p.fromMetres, p.toMetres] : [p.from, p.to];
		out.push({ from: clamp01(from / ctx.end), to: clamp01(to / ctx.end), value: v });
	}
	return out;
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/**
 * The pool's Distance axis: six ticks at equal fifths of the metres swum (or
 * yards), whole numbers and not grouped, "0 220 440 660 880 1100", as its
 * Time axis is fifths of its time (Inferred why: the run's nice steps would
 * read 0 200 … 1000).
 */
export function fifthsAxis(metres: number, unit: SwimUnit): XAxis {
	const length = inUnit(metres, unit);
	const ticks: XAxis["ticks"] = [];
	for (let k = 0; k < TICKS; k += 1) ticks.push({ at: k / (TICKS - 1), text: String(Math.round((k * length) / (TICKS - 1))) });
	return { ticks, title: `Distance (${unit})` };
}

/** Open water's Distance axis: the run's nice steps from 0, in metres (or yards) and whole: "0 100 … 500" for 519 m, the plot running on past the last. */
export function stepsAxis(metres: number, unit: SwimUnit): XAxis {
	const length = inUnit(metres, unit);
	const step = niceStep(length / (TICKS - 1));
	const ticks: XAxis["ticks"] = [];
	for (let k = 0; k * step <= length + 1e-9; k += 1) {
		const value = k * step;
		ticks.push({ at: length > 0 ? value / length : 0, text: plain(value, 2) });
	}
	return { ticks, title: `Distance (${unit})` };
}

/** A swim's slowest pace on an axis: 5:00 per 100 (Inferred: fitted on the pool's Time chart and open water's). */
export const SLOWEST_PACE = 300;

/** A pace axis, the slow end at the bottom, labelled by the 5.5 rule ("0:50 1:40 … 5:00"). */
function paceAxis(slow: number, fast: number): YAxis {
	const bottom = Number.isFinite(slow) && slow > fast ? slow : fast + 60;
	return { bottom, top: fast, labels: niceLabels(bottom, fast, (v) => duration(v), fitStep(bottom - fast)) };
}

/** The slow end of a pace axis: `pace` no slower than 5:00, unless the whole axis is slower. */
function slowEnd(pace: number, fast: number): number {
	const capped = Math.min(pace, SLOWEST_PACE);
	return capped > fast ? capped : pace;
}

/**
 * The pool's Pace axis, worked out in speed as the bars' tops fit it (0.17 pt
 * residual): the slow end at 0.98 × the slowest length, a rest counting as
 * standing still on the Time axis, and the fast end 0.45 of the span past the
 * fastest; as paces, the slow end no slower than 5:00 (Inferred: the 0.45 and
 * the cap are fitted on two charts). Time 47.43 s to 5:00; Distance 54.34 to
 * 167.83 s.
 */
export function lengthPaceAxis(detail: Pick<ActivityDetail, "laps">, axis: ActivityAxis, unit: SwimUnit): YAxis {
	const lengths = placedLengths(detail).map((p) => p.length);
	const speeds = lengths.filter(isSwum).map(lengthSpeed).filter((v) => v > 0);
	if (!speeds.length) return paceAxis(SLOWEST_PACE, 0);
	const rested = axis === "time" && lengths.some((l) => !isSwum(l));
	const fastest = Math.max(...speeds);
	const lo = 0.98 * (rested ? 0 : Math.min(...speeds));
	const fast = per100(fastest + 0.45 * (fastest - lo), unit);
	return paceAxis(slowEnd(per100(lo, unit), fast), fast);
}

/**
 * Open water's Pace axis: the fast end at 0.98 × the best pace (the
 * summary's `maxSpeed`, as the run's), the slow end at 1.02 × the slowest
 * sample but no slower than 5:00 (Inferred), where slower samples sit:
 * 71.90 s to 5:00 on the captured swim, whose slowest sample is 8:10.
 */
function samplePaceAxis(detail: ActivityDetail, units: Units, values: ReadonlyArray<number | null>): YAxis {
	const unit = swimUnit(detail, units);
	const paces = values.filter((v): v is number => v !== null && Number.isFinite(v));
	if (!paces.length) return paceAxis(SLOWEST_PACE, 0);
	const best = positive(detail.summary.maxSpeed);
	const fast = 0.98 * (best !== undefined ? per100(best, unit) : Math.min(...paces));
	return paceAxis(slowEnd(1.02 * Math.max(...paces), fast), fast);
}

/** A count's axis from 0 to its most ÷ 0.7, labelled by the 5.5 rule: 12 strokes a length → 17.14 ("15 10 5 0"), Swolf 52 → 74.29. */
function countAxis(most: number): YAxis {
	const top = most > 0 ? most / 0.7 : 1;
	return { bottom: 0, top, labels: niceLabels(0, top, (v) => plain(v, 1), fitStep(top)) };
}

/**
 * The water's temperature in whole degrees, a degree under the coldest and
 * two over the warmest (26–36 °C for 27–34; Inferred), with five forced
 * labels rounded half-even: "36 34 31 28 26".
 */
function temperatureAxis(values: ReadonlyArray<number | null>): YAxis {
	const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
	const bottom = finite.length ? Math.floor(Math.min(...finite)) - 1 : 0;
	const top = finite.length ? Math.ceil(Math.max(...finite)) + 2 : 1;
	return { bottom, top, labels: forcedLabels(bottom, top, (v) => plain(roundHalfEven(v, 0), 0)) };
}

/* ------------------------------------------------------------------ */
/*  The charts                                                         */
/* ------------------------------------------------------------------ */

/** The summary's average pace, in seconds per 100: the moving pace on a pool swim (1,100 m over 1,172 s). */
function averagePace(detail: ActivityDetail, units: Units): number | undefined {
	const speed = positive(detail.summary.averageSpeed);
	return speed === undefined ? undefined : per100(speed, swimUnit(detail, units));
}

function paceFigure(speed: number | undefined, unit: SwimUnit, label: string): ChartFigure[] {
	const text = speed !== undefined && speed > 0 ? swimPace(speed, unit) : undefined;
	return text ? [{ value: text, unit: perHundred(unit), label }] : [];
}

/**
 * The pool's Pace: one bar per length swum, as high as its pace on an
 * inverted axis, in the run's pace gradient; the summary's average pace as a
 * white line. Average "1:46", Best the fastest length ("1:09"). Its axis is
 * the chart's own: on Time the rests count as standing still.
 */
export const LENGTH_PACE: MetricDef = {
	title: "Pace",
	has: (detail) => swumLengths(detail).some((l) => lengthSpeed(l) > 0),
	values: () => [],
	mark: "blocks",
	fill: "pace",
	accent: "blue",
	pace: true,
	average: { value: averagePace },
	figures: (detail, units) => {
		const unit = swimUnit(detail, units);
		const speeds = swumLengths(detail)
			.map(lengthSpeed)
			.filter((v) => v > 0);
		const best = speeds.length ? Math.max(...speeds) : positive(detail.summary.maxSpeed);
		return [...paceFigure(positive(detail.summary.averageSpeed), unit, "Average"), ...paceFigure(best, unit, "Best")];
	},
	decorate: (chart, ctx) => {
		const unit = swimUnit(ctx.detail, ctx.units);
		chart.blocks = lengthBars(ctx, (l) => (lengthSpeed(l) > 0 ? per100(lengthSpeed(l), unit) : null));
		chart.points = blockSteps(chart.blocks);
		chart.y = lengthPaceAxis(ctx.detail, ctx.axis, unit);
	},
};

/** The pool's Strokes: one orange bar per length swum, its strokes; the summary's 10.7 a length as the average line and figure. */
export const LENGTH_STROKES: MetricDef = {
	title: "Strokes",
	has: (detail) => swumLengths(detail).some((l) => strokesOf(l) !== null),
	values: () => [],
	mark: "blocks",
	fill: "swim-strokes",
	accent: "orange",
	yAxis: (detail) => countAxis(most(swumLengths(detail).map(strokesOf))),
	average: { value: (detail) => averageStrokes(detail) },
	figures: (detail) => {
		const average = averageStrokes(detail);
		return average === undefined ? [] : [{ value: fixed(average, 1), unit: "/length", label: "Average" }];
	},
	decorate: (chart, ctx) => {
		chart.blocks = lengthBars(ctx, strokesOf);
		chart.points = blockSteps(chart.blocks);
	},
};

/** The pool's Swolf: one magenta bar per length swum, its seconds plus its strokes; the summary's 37 as the average line and figure. */
export const LENGTH_SWOLF: MetricDef = {
	title: "Swolf",
	has: (detail) => swumLengths(detail).some((l) => swolfOf(l) !== null),
	values: () => [],
	mark: "blocks",
	fill: "swim-swolf",
	accent: "purple",
	yAxis: (detail) => countAxis(most(swumLengths(detail).map(swolfOf))),
	average: { value: (detail) => averageSwolf(detail) },
	figures: (detail) => {
		const average = averageSwolf(detail);
		return average === undefined ? [] : [{ value: fixed(average, 0), label: "Average" }];
	},
	decorate: (chart, ctx) => {
		chart.blocks = lengthBars(ctx, swolfOf);
		chart.points = blockSteps(chart.blocks);
	},
};

/** Open water's Pace: the run's area over the samples' pace per 100, Average only ("2:14"); a stop or a sample slower than 5:00 sits on the bottom. */
export const SAMPLE_PACE: MetricDef = {
	title: "Pace",
	has: (detail) => (detail.samples.speed ?? []).some((v) => isNumber(v) && v > 0),
	values: (detail, units) => {
		const unit = swimUnit(detail, units);
		return (detail.samples.speed ?? []).map((v) => (isNumber(v) ? per100(v, unit) : null));
	},
	mark: "area",
	fill: "pace",
	accent: "blue",
	pace: true,
	yAxis: samplePaceAxis,
	average: { value: averagePace },
	figures: (detail, units) => paceFigure(positive(detail.summary.averageSpeed), swimUnit(detail, units), "Average"),
};

/** Open water's Strokes: an orange area of the strokes a minute, from 0 to the most ÷ 0.7; Average 29 and Maximum 39 spm. */
export const STROKE_RATE: MetricDef = {
	title: "Strokes",
	has: (detail) => (detail.samples.strokeRate ?? []).some((v) => isNumber(v) && v > 0),
	values: (detail) => (detail.samples.strokeRate ?? []).map((v) => (isNumber(v) ? v : null)),
	mark: "area",
	fill: "swim-strokes",
	accent: "orange",
	axis: { times: 1 / 0.7, step: "fit" },
	average: { value: (detail) => positive(detail.summary.averageSwimCadence) },
	figures: (detail) => [
		...countFigure(detail.summary.averageSwimCadence, "spm", "Average"),
		...countFigure(detail.summary.maxSwimCadence, "spm", "Maximum"),
	],
};

/**
 * Open water's Temperature: grey steps of the water's temperature, as Garmin
 * sends it (°C; °F in imperial, Inferred), on whole degrees. Minimum and
 * Maximum from the summary; the average line is the samples' mean (27.65),
 * not the summary's 27.96, as the shot's line sits at 27.68.
 */
export const TEMPERATURE: MetricDef = {
	title: "Temperature",
	has: (detail) => (detail.samples.temperature ?? []).some(isNumber),
	values: (detail, units) => (detail.samples.temperature ?? []).map((v) => (isNumber(v) ? degrees(v, units) : null)),
	mark: "steps",
	fill: "swim-temperature",
	accent: "grey",
	frame: "forced",
	yAxis: (_detail, _units, values) => temperatureAxis(values),
	average: {
		value: (detail, units) => {
			const values = (detail.samples.temperature ?? []).filter(isNumber);
			return values.length ? degrees(values.reduce((a, b) => a + b, 0) / values.length, units) : undefined;
		},
	},
	figures: (detail, units) => {
		const unit = degreeUnit(units);
		const samples = (detail.samples.temperature ?? []).filter(isNumber);
		const min = num(detail.summary.minTemperature) ?? (samples.length ? Math.min(...samples) : undefined);
		const max = num(detail.summary.maxTemperature) ?? (samples.length ? Math.max(...samples) : undefined);
		return [
			...countFigure(min === undefined ? undefined : degrees(min, units), unit, "Minimum"),
			...countFigure(max === undefined ? undefined : degrees(max, units), unit, "Maximum"),
		];
	},
};

/* ------------------------------------------------------------------ */
/*  Numbers                                                            */
/* ------------------------------------------------------------------ */

/** Strokes a length: the summary's, else the lengths' mean (470 over 44 also reads 10.7). */
function averageStrokes(detail: ActivityDetail): number | undefined {
	return positive(detail.summary.averageStrokes) ?? meanOf(swumLengths(detail).map(strokesOf));
}

/** Swolf: the summary's, else the lengths' mean. */
function averageSwolf(detail: ActivityDetail): number | undefined {
	return positive(detail.summary.averageSWOLF) ?? meanOf(swumLengths(detail).map(swolfOf));
}

/** A whole figure: "29" "spm", "27" "°C". */
function countFigure(value: unknown, unit: string, label: string): ChartFigure[] {
	const n = num(value);
	return n === undefined ? [] : [{ value: fixed(n, 0), unit, label }];
}

function most(values: ReadonlyArray<number | null>): number {
	return values.reduce<number>((best, v) => (v !== null && v > best ? v : best), 0);
}

function meanOf(values: ReadonlyArray<number | null>): number | undefined {
	const present = values.filter((v): v is number => v !== null);
	return present.length ? present.reduce((a, b) => a + b, 0) / present.length : undefined;
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function num(value: unknown): number | undefined {
	return isNumber(value) ? value : undefined;
}

function positive(value: unknown): number | undefined {
	return isNumber(value) && value > 0 ? value : undefined;
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
