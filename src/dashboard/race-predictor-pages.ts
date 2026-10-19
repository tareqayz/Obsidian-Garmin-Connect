import type { RacePredictionRow } from "../sync/race-predictor-index";
import { CHART_TITLE, CURRENT_COPY, CURRENT_COPY_LINES, CURRENT_TITLE } from "./race-predictor-copy";
import { axisDay, canStepBack, dayAxis, daysOf, monthEndsOf, spread, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { duration, shiftDate } from "./series";
import type { ChipRule } from "./stat-controls";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { NO_DATA } from "./vo2-max-pages";

/**
 * Garmin Connect's Race Predictor page (Performance Stats), worked out from
 * the race predictions index (`src/sync/race-predictor-index.ts`) and the
 * settings' units. Rules measured on the phone, the web and the API on
 * 2026-10-11/12 (ref/performance-stats/race-predictor/README.md):
 *
 * - Current is the index's newest row (on or before today), however old,
 *   with no date: the four predicted times, "m:ss" under an hour and
 *   "h:mm:ss" from one ("21:15", "1:43:54"), in a grid filled column by
 *   column — 5k and 10k on the left, Half and Marathon on the right. It is
 *   not a day stepper: the route's offset is ignored.
 * - 4w, 6m and 1y chart pace: a prediction's seconds ÷ its kilometres (5, 10,
 *   21.0975, 42.195), unrounded, linear, the fastest at the top. 4w (the 28
 *   days to today) plots every day with a row; 6m and 1y the registry's
 *   `monthEnds` slots — each month's last day, and today — evenly spaced,
 *   each valued from its month's newest row on or before it, which is
 *   Garmin's own `racepredictions/monthly`.
 * - The y axis is four gridlines in thirds from the fastest pace on the chart
 *   (top) to the slowest (bottom), with no padding; its labels are m:ss
 *   rounded half up (floor and rounded ends both fail a shot).
 * - Every view gives a distance the same shape: 5k a circle, 10k a triangle
 *   (on its centroid), Half a square, Marathon a diamond. 4w draws them only
 *   at each line's two ends, 6m and 1y on every point.
 * - The x axis: 4w a dot a day, the ends large and labelled "MM-DD"; 6m and
 *   1y a large dot per slot, each labelled "MM-DD", 1y's on end.
 * - Under the chart, a static legend, then four chips, all on, each toggling
 *   its line.
 *
 * Inferred (unseen on the phone):
 *
 * - The chips live in the route's `sub` ("off:10k.half", none while all four
 *   are on), so the view stays a function of its route: the lines a reader
 *   turned off hold across ranges and periods (`moveStatRoute` keeps `sub`)
 *   and a reload, as the activity charts' chips do (`pace`, `heart`, `power`
 *   in their route), and reset when the page is opened afresh.
 * - A chip turned off hides its line and moves nothing else: the axis stays
 *   cut from all four lines, as the twin draws Half off (536:648). The last
 *   chip on stays on (`RACE_CHIPS.required`). The legend stays whole.
 * - A spread under 3 s widens about its middle to 3 s (a second a third), so
 *   the four labels never repeat; every shot spans over a minute.
 * - Previous periods by the registry's spans ("Aug 17 - Sep 13", "Nov 30,
 *   2025 - Apr 30, 2026"); a day or slot without a row has no point, the line
 *   joining the points that are there; "<" stops once the index is whole and
 *   its oldest row is not before the period (6m's and 1y's from their first
 *   slot's month, which that slot reads).
 * - Imperial: seconds a mile, the same rules ("6:49 7:30 8:11 8:52" on 4w).
 * - No row at all: Current's "--" for each time; a range's no-data line.
 *
 * The chart's geometry is `race-predictor-charts.ts`, off the Obsidian twin
 * (Figma page 430:6110).
 *
 * Pure.
 */

export type RaceId = "5k" | "10k" | "half" | "marathon";

/** A distance's glyph: `ShapeMarker`'s shapes. */
export type RaceShape = "circle" | "triangle" | "square" | "diamond";

export interface RaceDistance {
	id: RaceId;
	/** As the phone writes it: "5k", "10k", "Half", "Marathon". */
	label: string;
	/** Its column in the index. */
	column: Exclude<keyof RacePredictionRow, "date">;
	/** Kilometres: the web's 5000 and 42195 m confirm the 5k's and the marathon's to the last digit. */
	km: number;
	/** Its glyph on Current, on the chart, in the legend. */
	shape: RaceShape;
}

/**
 * The four distances, in the chips' and the legend's order. Garmin colours
 * them #1976D2, #007838, #DE5809 and #C21515; the twin binds those to the
 * theme's blue, green, orange and red (`RACE_COLOR`, by `id`).
 */
export const RACE_DISTANCES: readonly RaceDistance[] = [
	{ id: "5k", label: "5k", column: "time5k", km: 5, shape: "circle" },
	{ id: "10k", label: "10k", column: "time10k", km: 10, shape: "triangle" },
	{ id: "half", label: "Half", column: "half", km: 21.0975, shape: "square" },
	{ id: "marathon", label: "Marathon", column: "marathon", km: 42.195, shape: "diamond" },
];

const RACE_IDS: readonly RaceId[] = RACE_DISTANCES.map((d) => d.id);

/** The settings' units: pace a kilometre, or a mile. */
export type RaceUnits = "metric" | "imperial";

export const KM_PER_MILE = 1.609344;

/** A time Garmin has not predicted. */
export const DASH = "--";

/** How the chips behave: several on at once, the last one staying on. `StatChips` takes it as is. */
export const RACE_CHIPS: Required<ChipRule> = { multi: true, required: true };

/**
 * The y axis' least spread, in seconds: a second a third, so the four labels,
 * rounded to the second, never repeat. Every shot spans over a minute.
 */
export const MIN_PACE_SPAN = 3;

/** What the page's route says: the range, how many periods back, and the lines turned off. */
export interface RacePredictorRoute {
	range: PeriodRange;
	offset: number;
	/** "off:10k.half": the chips turned off. */
	sub?: string;
}

/** What the view needs besides the route and the index's rows. */
export interface RacePredictorContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	units: RaceUnits;
}

/** A distance as the legend and the chips name it. */
export interface RaceKey {
	id: RaceId;
	label: string;
	shape: RaceShape;
}

/** Current: one distance's prediction. */
export interface RaceTime extends RaceKey {
	/** "21:15", "1:43:54"; "--" without a prediction. */
	time: string;
	/** The prediction, in seconds. */
	seconds?: number;
}

export interface RaceCurrentView {
	range: "1d";
	/** Current has no period row. */
	label: null;
	canGoBack: false;
	canGoForward: false;
	/** "Your Predictions". */
	title: string;
	/** The copy as one paragraph, and as the four lines the page sets it in. */
	copy: string;
	copyLines: readonly string[];
	/** 5k, 10k, Half, Marathon: the grid fills column by column, 5k and 10k on the left. */
	times: RaceTime[];
	/** The day of the row shown, which the page does not show; none without a row. */
	date?: string;
}

export interface RacePoint {
	/** The day the prediction is from. */
	date: string;
	/** Where it is plotted: the day on 4w; on 6m and 1y the month's last day, or today. */
	slot: string;
	/** Across the plot, 0..1. */
	x: number;
	/** Pace, seconds a kilometre or mile, unrounded: what the y axis measures. */
	value: number;
	/** The predicted time, seconds. */
	seconds: number;
	/** The distance's shape is drawn on it: 4w at the line's ends, 6m and 1y on every point. */
	marker: boolean;
}

export interface RaceLine extends RaceKey {
	/** Oldest first; a day or slot without a row has none. */
	points: RacePoint[];
}

export interface RaceChart {
	/** The gridlines' paces, top first: the fastest of all four lines, a third and two thirds down, the slowest. */
	ticks: number[];
	/** Their labels, m:ss rounded: "4:14", "4:40", "5:05", "5:31". */
	labels: string[];
	axis: PeriodAxis;
	/** The lines whose chip is on, in the chips' order. */
	lines: RaceLine[];
}

/** A chip under the chart: a distance's line, on or off. */
export interface RaceChip {
	id: RaceId;
	label: string;
	on: boolean;
}

export interface RacePeriodView {
	range: "4w" | "6m" | "1y";
	span: Span;
	/** "Sep 14 - Oct 11", "May 31 - Oct 11", "Nov 30, 2025 - Oct 11, 2026". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Pace". */
	title: string;
	/** The pace's unit, which the chart does not show: a kilometre, or a mile. */
	unit: "km" | "mi";
	/** Null for a period without a prediction. */
	chart: RaceChart | null;
	/** The line in place of the chart when there is none. */
	empty?: string;
	/** The key under the chart: all four, whatever the chips say. */
	legend: RaceKey[];
	chips: RaceChip[];
	/** The chips that are on, in their order: `StatChips`' `selected`. */
	on: RaceId[];
}

export type RacePredictorView = RaceCurrentView | RacePeriodView;

/** The registry's Race Predictor: its ranges, and 6m and 1y by month ends. */
const RACE_STAT = PERFORMANCE_REGISTRY.page("race-predictor")!;

/* ------------------------------------------------------------------ */
/*  Times and paces                                                    */
/* ------------------------------------------------------------------ */

/** A predicted time: "21:15", "1:43:54"; "--" without one. */
export function raceTime(seconds: number | undefined): string {
	return seconds === undefined ? DASH : duration(seconds);
}

/** A pace, seconds a kilometre or a mile, unrounded. */
export function paceOf(seconds: number, km: number, units: RaceUnits): number {
	return units === "imperial" ? seconds / (km / KM_PER_MILE) : seconds / km;
}

/** A pace's label: m:ss, rounded half up to the second (4w's 279.599 → "4:40"). */
export function paceLabel(pace: number): string {
	return duration(pace);
}

/**
 * The y axis: four paces, top first, from the fastest of `values` to the
 * slowest in thirds. A spread under `MIN_PACE_SPAN` widens about its middle
 * (Inferred). None without values.
 */
export function paceTicks(values: readonly number[]): number[] {
	if (!values.length) return [];
	let lo = Math.min(...values);
	let hi = Math.max(...values);
	if (hi - lo < MIN_PACE_SPAN) {
		const mid = (lo + hi) / 2;
		lo = mid - MIN_PACE_SPAN / 2;
		hi = mid + MIN_PACE_SPAN / 2;
	}
	// The ends are the extreme points themselves; the thirds as the shots' labels reproduce them.
	return [lo, lo + ((hi - lo) * 1) / 3, lo + ((hi - lo) * 2) / 3, hi];
}

/* ------------------------------------------------------------------ */
/*  Chips                                                              */
/* ------------------------------------------------------------------ */

const OFF = "off:";

/** The lines a route's `sub` turns off ("off:10k.half"), in the chips' order: none for any other sub, and never all four. */
export function racesOff(sub: string | undefined): RaceId[] {
	if (!sub?.startsWith(OFF)) return [];
	const named = new Set(sub.slice(OFF.length).split("."));
	const off = RACE_IDS.filter((id) => named.has(id));
	return off.length < RACE_IDS.length ? off : [];
}

/** The chips that are on, in their order. */
export function racesOn(sub: string | undefined): RaceId[] {
	const off = racesOff(sub);
	return RACE_IDS.filter((id) => !off.includes(id));
}

/** The route's `sub` with the chips `on` on: none while all four are, "off:10k.half" otherwise. */
export function raceSub(on: readonly string[]): string | undefined {
	const off = RACE_IDS.filter((id) => !on.includes(id));
	return off.length && off.length < RACE_IDS.length ? `${OFF}${off.join(".")}` : undefined;
}

/** The page with the chips `on` on, as `StatChips` reports a tap: `swap(withRaces(route, on))`. */
export function withRaces<R extends { sub?: string }>(route: R, on: readonly string[]): R {
	const next = { ...route };
	const sub = raceSub(on);
	if (sub) next.sub = sub;
	else delete next.sub;
	return next;
}

/* ------------------------------------------------------------------ */
/*  Lines                                                              */
/* ------------------------------------------------------------------ */

/** A line's points and the axis under them, before the chips pick the lines. */
export interface RaceLines {
	axis: PeriodAxis;
	/** All four, in the chips' order. */
	lines: RaceLine[];
}

interface Place {
	slot: string;
	row: RacePredictionRow | undefined;
	x: number;
}

function lineOf(distance: RaceDistance, places: readonly Place[], units: RaceUnits, every: boolean): RaceLine {
	const points: RacePoint[] = [];
	for (const { slot, row, x } of places) {
		const seconds = row?.[distance.column];
		if (!row || seconds === undefined) continue;
		points.push({ date: row.date, slot, x, value: paceOf(seconds, distance.km, units), seconds, marker: every });
	}
	if (points.length) {
		points[0].marker = true;
		points[points.length - 1].marker = true;
	}
	return { id: distance.id, label: distance.label, shape: distance.shape, points };
}

/** 4w: a point a day with a row, at its day, under a dot a day; markers at each line's ends. */
export function dailyLines(span: Span, rows: readonly RacePredictionRow[], units: RaceUnits): RaceLines {
	const days = daysOf(span);
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const places = days.map((date, i) => ({ slot: date, row: byDate.get(date), x: spread(i, days.length) }));
	return { axis: dayAxis(days), lines: RACE_DISTANCES.map((d) => lineOf(d, places, units, false)) };
}

/**
 * A slot's row: its month's newest on or before it. A past month's slot is
 * its last day; the current month's is today, so it takes today's row, or
 * the newest before it while today has none. Garmin's `monthly` is this,
 * clipped to the newest row.
 */
export function monthRowOn(byDate: ReadonlyMap<string, RacePredictionRow>, slot: string): RacePredictionRow | undefined {
	const first = `${slot.slice(0, 7)}-01`;
	for (let day = slot; day >= first; day = shiftDate(day, -1)) {
		const row = byDate.get(day);
		if (row) return row;
	}
	return undefined;
}

/**
 * 6m and 1y: a point per `monthEndsOf` slot, evenly spaced, each valued from
 * its month's newest row on or before it; a large dot and an "MM-DD" label
 * per slot, on end when `upright` (1y); markers on every point.
 */
export function monthEndLines(span: Span, rows: readonly RacePredictionRow[], units: RaceUnits, upright: boolean): RaceLines {
	const slots = monthEndsOf(span);
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const places = slots.map((slot, i) => ({ slot, row: monthRowOn(byDate, slot), x: spread(i, slots.length) }));
	return {
		axis: {
			dots: places.map((p) => ({ x: p.x, large: true })),
			labels: places.map((p) => ({ x: p.x, text: axisDay(p.slot), ...(upright ? { rotated: true } : {}) })),
		},
		lines: RACE_DISTANCES.map((d) => lineOf(d, places, units, true)),
	};
}

/**
 * The chart: the lines that are on, over an axis cut from all four, so a
 * chip turned off hides its line and moves nothing else (the twin's Half
 * off, 536:648). Null for a period without a prediction.
 */
export function raceChart(plotted: RaceLines, on: readonly RaceId[]): RaceChart | null {
	const ticks = paceTicks(plotted.lines.flatMap((l) => l.points.map((p) => p.value)));
	if (!ticks.length) return null;
	return { ticks, labels: ticks.map(paceLabel), axis: plotted.axis, lines: plotted.lines.filter((l) => on.includes(l.id)) };
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

/** The newest row on or before `today`. */
function newestRow(rows: readonly RacePredictionRow[], today: string): RacePredictionRow | undefined {
	for (let i = rows.length - 1; i >= 0; i--) if (rows[i].date <= today) return rows[i];
	return undefined;
}

/** Current: the newest row's four times; "--" each without one. */
export function currentView(rows: readonly RacePredictionRow[], today: string): RaceCurrentView {
	const row = newestRow(rows, today);
	const view: RaceCurrentView = {
		range: "1d",
		label: null,
		canGoBack: false,
		canGoForward: false,
		title: CURRENT_TITLE,
		copy: CURRENT_COPY,
		copyLines: CURRENT_COPY_LINES,
		times: RACE_DISTANCES.map((d) => {
			const seconds = row?.[d.column];
			const time: RaceTime = { id: d.id, label: d.label, shape: d.shape, time: raceTime(seconds) };
			if (seconds !== undefined) time.seconds = seconds;
			return time;
		}),
	};
	if (row) view.date = row.date;
	return view;
}

/** The page, on its route's range: Current, or a period's pace chart. */
export function racePredictorView(route: RacePredictorRoute, rows: readonly RacePredictionRow[], ctx: RacePredictorContext): RacePredictorView {
	if (route.range === "1d") return currentView(rows, ctx.today);
	const range: RacePeriodView["range"] = route.range === "6m" || route.range === "1y" ? route.range : "4w";
	const period = { range, offset: route.offset };
	const span = statSpan(RACE_STAT, period, ctx.today)!;
	const plotted = range === "4w" ? dailyLines(span, rows, ctx.units) : monthEndLines(span, rows, ctx.units, range === "1y");
	const on = racesOn(route.sub);
	// 6m's and 1y's first slot reads its whole month: older data is a row before that month.
	const start = range === "4w" ? span.from : `${span.from.slice(0, 7)}-01`;
	const view: RacePeriodView = {
		range,
		span,
		label: statPeriodLabel(RACE_STAT, period, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, start),
		canGoForward: route.offset < 0,
		title: CHART_TITLE,
		unit: ctx.units === "imperial" ? "mi" : "km",
		chart: raceChart(plotted, on),
		legend: RACE_DISTANCES.map(({ id, label, shape }) => ({ id, label, shape })),
		chips: RACE_DISTANCES.map(({ id, label }) => ({ id, label, on: on.includes(id) })),
		on,
	};
	if (!view.chart) view.empty = NO_DATA;
	return view;
}
