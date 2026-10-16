import { POWER_DURATIONS, type ActivityRow } from "../sync/activity-index";
import { categoryOf } from "./activities";
import {
	INTERVAL_LENGTH,
	POWER_CURVE_EXPLAINER,
	RECORDS_HEADERS,
	RECORDS_TITLE,
	RECORD_WORD,
	axisDuration,
	curveTitle,
	emptyLine,
	legendWord,
	peakDuration,
	type PowerCurveRange,
} from "./cycling-power-curve-copy";
import { canStepBack, spread, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { listDate, startsIn } from "./training-load-pages";

export type { PowerCurveRange } from "./cycling-power-curve-copy";

/**
 * Garmin Connect's Cycling Power Curve page (Performance Stats), worked out
 * from the activity index alone: it calls nothing on view. Each ride's row
 * keeps `power`, its best average power by duration (the list's
 * `maxAvgPower_<seconds>`), and `noPowerCurve`. Rules measured on the phone
 * on 2026-10-11 and proved against the API on 2026-10-12
 * (ref/performance-stats/cycling-power-curve/README.md):
 *
 * - The rides are the index's cycling category (`categoryOf`) with a best
 *   power, minus those the rider left out of the power curve.
 * - The Record is the all-time best per duration, not a lookback: the 1 s
 *   687 W of Sep 13, 2025 still shows on Oct 11, 2026. It is the same on
 *   every range and period; only the period's curve follows the date row.
 * - The period's curve is the best per duration over the rides whose local
 *   start day falls in the span (`startsIn`, both ends inclusive). 4w is the
 *   28 days ending today; 3m and 1y count months back from today plus a day
 *   (the registry's spans): "Sep 14 - Oct 11", "Jul 12 - Oct 11", "Oct 12,
 *   2025 - Oct 11, 2026". "<" steps one whole rule back.
 * - Each duration's best is chosen apart from the others' and never
 *   smoothed: the Sep 15 ride alone holds 20 min 170 W and 30 min 171 W.
 *   A duration has a value only when some ride has its key.
 * - The x axis is the 15 durations "1 sec" … "5 hr" in equal steps, a dot
 *   and a label each, value or not; the curves join the durations that have
 *   a value with straight segments and end at the last one (2 hr here). The
 *   y axis runs 0 … 100·⌈M / 100⌉ in steps of 100, M the Record's highest
 *   (687 → 700). Watts only: there is no W/kg on the phone or the web.
 * - A period without a counted ride shows its empty line ("There is no 4
 *   week power data for this period") over the Record alone, with the same
 *   legend.
 * - The records table is always all 15 durations, the Record's: watts with
 *   no unit and the record's ride's day ("Sep 13, 2025"), "--" and "--" for
 *   a duration no ride reached (5 hours here). Rides have no page in the
 *   plugin, so a date opens nothing and takes the row's colour, not the
 *   phone's link blue.
 *
 * Inferred (unseen on the phone): previous periods, the 1y empty line's
 * words, ties (the earliest ride keeps one; Garmin breaks them by decimals
 * the API rounds away), cycling types other than road biking counting,
 * `noPowerCurve` leaving a ride out, the 5 hours row filling, the y axis
 * past 1,000 W (steps of 200) and with no Record at all (0–100), and the
 * current year's dates (still "Mon d, yyyy").
 *
 * The chart's geometry is `cycling-power-curve-charts.ts`, off the Obsidian
 * twin (Figma page 430:6118; the Garmin page is 430:6082).
 *
 * Pure.
 */

const PC_STAT = PERFORMANCE_REGISTRY.page("cycling-power-curve")!;
const DASH = "--";

/** The ranges, as the registry lists them; any other range is read as the first. */
const RANGES: readonly PowerCurveRange[] = ["4w", "3m", "1y"];

/**
 * Past a top of this, the y axis counts in 200s (Inferred: 1,250 W → 0–1,400
 * by 200). The only record seen, 687 W, gives 0–700 by 100.
 */
const FINE_AXIS_TOP = 1000;

/** What the page's route says: the range and how many periods back. */
export interface CyclingPowerCurveRoute {
	range: PeriodRange;
	offset: number;
}

/** What the view needs besides the route and the activity index's rows. */
export interface CyclingPowerCurveContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The activity index holds the whole history (`activities.complete`). */
	complete: boolean;
}

/* ------------------------------------------------------------------ */
/*  Which rides count                                                  */
/* ------------------------------------------------------------------ */

/** A ride's best average power for `seconds`, in whole watts; none without the key. */
function wattsAt(row: ActivityRow, seconds: number): number | undefined {
	const watts = row.power?.[String(seconds)];
	return typeof watts === "number" && Number.isFinite(watts) && watts > 0 ? watts : undefined;
}

/**
 * A ride the page counts: the cycling category (type 2 or a child of it),
 * a best power for some duration, and not left out of the power curve
 * (`noPowerCurve`, Garmin's `excludeFromPowerCurveReports`).
 */
export function isPowerRide(row: ActivityRow): boolean {
	return categoryOf(row) === "cycling" && !row.noPowerCurve && POWER_DURATIONS.some((seconds) => wattsAt(row, seconds) !== undefined);
}

/** The local start day of the oldest ride the page counts. */
function oldestDay(rides: readonly ActivityRow[]): string | undefined {
	let oldest: string | undefined;
	for (const ride of rides) {
		const day = ride.start.slice(0, 10);
		if (oldest === undefined || day < oldest) oldest = day;
	}
	return oldest;
}

/* ------------------------------------------------------------------ */
/*  Curves                                                             */
/* ------------------------------------------------------------------ */

/** A duration's best: its watts and the ride that set them. */
export interface CurvePoint {
	/** The duration, in seconds (`POWER_DURATIONS`). */
	seconds: number;
	/** The best average power held for it, in whole watts. */
	watts: number;
	/** The ride: its id and its local start, `YYYY-MM-DDTHH:mm:ss`. */
	id: number;
	start: string;
}

/**
 * The best power for each of the 15 durations over the counted rides, or
 * over those whose local start day falls in `span`: one entry per
 * `POWER_DURATIONS`, null where no ride has that duration. Each duration's
 * best is chosen apart from the others'. On a tie the earliest ride keeps
 * it, since a record is set when it is first reached (Garmin picks by
 * decimals the API rounds away: Sep 10 over Sep 27 at 5 min, but Oct 4 over
 * Oct 1 at 20 min).
 */
export function powerCurve(rows: readonly ActivityRow[], span?: Span): (CurvePoint | null)[] {
	const rides = rows.filter((r) => isPowerRide(r) && (span === undefined || startsIn(r, span))).sort((a, b) => a.begin - b.begin || a.id - b.id);
	return POWER_DURATIONS.map((seconds) => {
		let best: CurvePoint | null = null;
		for (const ride of rides) {
			const watts = wattsAt(ride, seconds);
			if (watts !== undefined && (best === null || watts > best.watts)) best = { seconds, watts, id: ride.id, start: ride.start };
		}
		return best;
	});
}

/** A curve's highest value; none for a curve without one. */
function highest(curve: readonly (CurvePoint | null)[]): number | undefined {
	let max: number | undefined;
	for (const point of curve) if (point && (max === undefined || point.watts > max)) max = point.watts;
	return max;
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/** One of the 15 durations: its place on the x axis and its words. */
export interface PowerDuration {
	seconds: number;
	/** "1 sec": under the axis, standing on end. */
	axis: string;
	/** "1 second": the table's Peak column. */
	peak: string;
	/** Its place across the plot: 0 for 1 sec, 1 for 5 hr, in 14 equal steps (not a log scale). */
	x: number;
}

/** The durations left to right: 1 sec … 5 hr. */
export const CURVE_DURATIONS: readonly PowerDuration[] = POWER_DURATIONS.map((seconds, i) => ({
	seconds,
	axis: axisDuration(seconds),
	peak: peakDuration(seconds),
	x: spread(i, POWER_DURATIONS.length),
}));

/** The x axis: a dot at every duration, all one size, each with its label standing on end, reading bottom to top. */
export const POWER_X_AXIS: PeriodAxis = {
	dots: CURVE_DURATIONS.map((d) => ({ x: d.x, large: true })),
	labels: CURVE_DURATIONS.map((d) => ({ x: d.x, text: d.axis, rotated: true })),
};

/** The y axis: 0 up to `top`, a gridline and a label every `step`. */
export interface PowerAxis {
	top: number;
	step: number;
	/** Top first, as the chart lists them: 700, 600 … 0. */
	ticks: number[];
}

/**
 * The y axis for a Record whose highest value is `max`: 0 to 100·⌈max / 100⌉
 * in steps of 100 (687 → 700, the only case seen). Inferred beyond it: a top
 * past 1,000 counts in 200s, to 200·⌈max / 200⌉ (1,250 → 1,400); no Record
 * at all gives 0–100.
 */
export function powerAxis(max: number | undefined): PowerAxis {
	const m = max !== undefined && Number.isFinite(max) && max > 0 ? max : 0;
	let step = 100;
	let top = Math.max(step, step * Math.ceil(m / step));
	if (top > FINE_AXIS_TOP) {
		step = 200;
		top = step * Math.ceil(m / step);
	}
	return { top, step, ticks: Array.from({ length: top / step + 1 }, (_, i) => top - i * step) };
}

/** A curve's vertex: a duration with a value. */
export interface CurveVertex {
	seconds: number;
	/** Its duration's place across the plot (`PowerDuration.x`). */
	x: number;
	watts: number;
	/** watts / the axis' top: its height as a share of the plot. */
	at: number;
}

/**
 * A curve as drawn: a vertex at each duration with a value, left to right,
 * joined by straight segments; its area ends at the last vertex, straight
 * down to the baseline. A duration without a value between two with one
 * (never seen: a ride with a long best has the shorter ones) is passed over.
 */
function vertices(curve: readonly (CurvePoint | null)[], top: number): CurveVertex[] {
	return curve.flatMap((point, i) => (point ? [{ seconds: point.seconds, x: CURVE_DURATIONS[i]!.x, watts: point.watts, at: point.watts / top }] : []));
}

/* ------------------------------------------------------------------ */
/*  The records table                                                  */
/* ------------------------------------------------------------------ */

/** A row of the records table: a duration and the Record's best for it. */
export interface PowerRecordRow {
	seconds: number;
	/** "1 second". */
	peak: string;
	/** "687": whole watts, no unit; "--" for a duration no ride reached. */
	watts: string;
	/** "Sep 13, 2025": the record's ride's local start day, always with the year (`listDate`); "--" without one. */
	date: string;
	/**
	 * The ride that set it: the date opens its page, in link blue.
	 */
	id?: number;
}

/** The table's rows: every duration, in the axis' order, from the Record. */
function recordRows(record: readonly (CurvePoint | null)[]): PowerRecordRow[] {
	return CURVE_DURATIONS.map((d, i) => {
		const point = record[i];
		return point
			? { seconds: d.seconds, peak: d.peak, watts: String(point.watts), date: listDate(point.start), id: point.id }
			: { seconds: d.seconds, peak: d.peak, watts: DASH, date: DASH };
	});
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export interface CyclingPowerCurveView {
	range: PowerCurveRange;
	/** The period's days. */
	span: Span;
	/** The date row: "Sep 14 - Oct 11", "Jul 12 - Oct 11", "Oct 12, 2025 - Oct 11, 2026". */
	label: string;
	/** "<": an older counted ride exists, or may while the index is still coming. */
	canGoBack: boolean;
	/** ">": a past period. */
	canGoForward: boolean;
	/** The chart's title: "4 Week Cycling Power Curve". */
	title: string;
	/** The line under the title for a period without a counted ride; the Record draws alone. */
	empty?: string;
	/** The legend under the chart, on an empty period too: the period's word ("4 Weeks", "1 year"), then "Record". */
	legend: { period: string; record: string };
	/** The y axis' top, and its gridlines and labels, top first: 700, 600 … 0. */
	top: number;
	ticks: number[];
	/** The x axis: every duration's dot and label (`POWER_X_AXIS`), and its title, "Interval Length". */
	axis: PeriodAxis;
	axisTitle: string;
	/** The Record: the all-time best per duration, drawn behind; the same on every range and period. */
	record: CurveVertex[];
	/** The period's best per duration, drawn over the Record; none on an empty period. */
	period: CurveVertex[];
	/** "Cycling Power Records": all 15 durations, the Record's values. */
	table: { title: string; headers: readonly string[]; rows: PowerRecordRow[] };
	/** The explainer under the table: two paragraphs. */
	explainer: readonly string[];
}

/** The range a route names, if the page has it; else the first, 4w. */
function curveRange(range: PeriodRange): PowerCurveRange {
	return (RANGES as readonly PeriodRange[]).includes(range) ? (range as PowerCurveRange) : RANGES[0]!;
}

/** The page on its route: the period's curve over the Record, the records table and the explainer. */
export function cyclingPowerCurveView(route: CyclingPowerCurveRoute, activities: readonly ActivityRow[], ctx: CyclingPowerCurveContext): CyclingPowerCurveView {
	const range = curveRange(route.range);
	const period = { range, offset: Math.min(0, route.offset) };
	const span = statSpan(PC_STAT, period, ctx.today)!;
	const rides = activities.filter(isPowerRide);
	const record = powerCurve(rides);
	const best = powerCurve(rides, span);
	const { top, ticks } = powerAxis(highest(record));
	const view: CyclingPowerCurveView = {
		range,
		span,
		label: statPeriodLabel(PC_STAT, period, ctx.today),
		canGoBack: canStepBack(oldestDay(rides), ctx.complete, span.from),
		canGoForward: period.offset < 0,
		title: curveTitle(range),
		legend: { period: legendWord(range), record: RECORD_WORD },
		top,
		ticks,
		axis: POWER_X_AXIS,
		axisTitle: INTERVAL_LENGTH,
		record: vertices(record, top),
		period: vertices(best, top),
		table: { title: RECORDS_TITLE, headers: RECORDS_HEADERS, rows: recordRows(record) },
		explainer: POWER_CURVE_EXPLAINER,
	};
	if (!best.some((point) => point !== null)) view.empty = emptyLine(range);
	return view;
}
