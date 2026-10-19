import { DAY_MS, shortDate } from "./day";
import type { HealthRange } from "./health-stats";
import { shiftDate } from "./series";

/**
 * The period maths every range stat on the shared Health Stats and
 * Performance Stats routes uses: a day, a week, weeks, months or a year as the
 * app pages through them, the labels on the page, the cards that switch it,
 * and the means behind its figures.
 *
 * Measured on Stress (ref/health-stats/stress/README.md) and shared by the
 * stats whose specs page the same way:
 *
 * - Periods roll back from today: 7d is the seven days ending today, 4w the
 *   twenty-eight, 1y fifty-two rolling weeks of seven. A step back moves a
 *   whole period, so a 1y week is always a whole number of 7d steps back.
 *   Never Monday- or Sunday-based.
 * - 1d reopens on the day it last showed; 7d, 4w and 1y on the current
 *   period. A day card switches the page in place to 1d on its day, a week
 *   card to 7d on its week.
 * - Labels: "Today", "Wednesday, October 7"; "Oct 2 - 8", and a past year's
 *   without the spaces, "Oct 16-22, 2025"; "Oct 10, 2025 - Oct 8, 2026".
 *
 * Performance Stats adds 12w, 3m and 6m, and pages some ranges another way:
 * a stat's `spans` (`stat-registry.ts`) name the `SpanRule` a range follows,
 * and `spanOf` cuts the period by it. Health's spans are the defaults.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings.
 */

/**
 * The ranges a stat can page through: Health Stats' 1d, 7d, 4w and 1y, and
 * Performance Stats' 12w, 3m and 6m among them.
 */
export type PeriodRange = "1d" | "7d" | "4w" | "12w" | "3m" | "6m" | "1y";

/** Every range, in the order a range control lists them. */
export const PERIOD_RANGES: readonly PeriodRange[] = ["1d", "7d", "4w", "12w", "3m", "6m", "1y"];

/** The ranges that span more than a day. */
export type SpanRange = Exclude<PeriodRange, "1d">;

/** The days a range's default period covers, which is also how far "<" moves it. 3m counts months instead. */
export const PERIOD_DAYS: Readonly<Record<Exclude<SpanRange, "3m">, number>> = { "7d": 7, "4w": 28, "12w": 84, "6m": 182, "1y": 364 };

/**
 * How a range cuts its period. `spanOf` steps it back one whole rule at a
 * time: n days, n weeks, n months.
 *
 * - `{ days }`: the n days ending today. Every range's default but 3m's
 *   (`PERIOD_DAYS`): 7d 7, 4w 28, 12w 84, 6m 182, 1y 364.
 * - `{ weeks, weekStart }`: the week holding today, so far, and the n − 1
 *   whole weeks before it, weeks starting on `weekStart` (0 Sunday … 6
 *   Saturday): Running Tolerance's 12w, Sunday weeks, Jul 26 – Oct 11.
 * - `{ months }`: from n months back, plus a day, to today: 3m's default,
 *   Jul 12 – Oct 11; a 1y of Oct 12, 2025 – Oct 11, 2026.
 * - `{ months, calendar: true }`: n calendar months, this one so far the
 *   last: Hill Score's 1y, "Nov 2025 - Oct 2026".
 * - `{ monthEnds }`: a point on each of the n − 1 month ends before this
 *   month, and today: Race Predictor's 6m, May 31 – Oct 11 (`monthEndsOf`).
 */
export type SpanRule =
	| { days: number }
	| { weeks: number; weekStart: number }
	| { months: number; calendar?: boolean }
	| { monthEnds: number };

/**
 * Where a stat's page is: its range, how many periods back, and the day 1d
 * last showed. `R` is the ranges its route takes: Health's four, unless the
 * page is a Performance one (`PeriodRoute<PeriodRange>`).
 */
export interface PeriodRoute<R extends PeriodRange = HealthRange> {
	range: R;
	/** Days on 1d, else whole periods of the range (`spanOf`), back from the current one: 0 or less. */
	offset: number;
	/** The day 1d last showed, kept while another range is open, so 1d reopens on it. */
	date?: string;
}

export interface Span {
	from: string;
	to: string;
}

/* ------------------------------------------------------------------ */
/*  Days and spans                                                     */
/* ------------------------------------------------------------------ */

export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The same day `months` months on, or the month's last day when it has no such day. */
export function addMonths(date: string, months: number): string {
	const t = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months;
	const year = Math.floor(t / 12);
	const month = t - year * 12;
	const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const day = Math.min(Number(date.slice(8, 10)), last);
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A `YYYY-MM` month moved by whole months. */
export function shiftMonth(month: string, n: number): string {
	const [y, m] = month.split("-").map(Number);
	const t = y * 12 + (m - 1) + n;
	return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** A `YYYY-MM` month's last day, as `YYYY-MM-DD`. */
export function lastDayOfMonth(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Periods back as an offset: never above 0, and never −0, which a saved route would keep. */
function back(periods: number): number {
	return periods > 0 ? -periods : 0;
}

/** The day a 1d page shows. */
export function dayOf(route: Pick<PeriodRoute, "offset">, today: string): string {
	return shiftDate(today, Math.min(0, route.offset));
}

/** A day as a 1d offset: 0 today, −1 yesterday. A day still to come is today. */
export function offsetOfDay(date: string, today: string): number {
	return back(daysBetween(date, today));
}

/** A range's period where its stat does not set one: its `PERIOD_DAYS`, or 3m's three months. */
export function defaultSpan(range: SpanRange): SpanRule {
	return range === "3m" ? { months: 3 } : { days: PERIOD_DAYS[range] };
}

/** The days a range's default period covers: Health's 7d, 4w and 1y. */
export function periodOf(range: SpanRange, offset: number, today: string): Span {
	return spanOf(defaultSpan(range), offset, today);
}

/**
 * The days a period covers by its rule, `offset` whole rules back from the
 * current one (`SpanRule`). The current period ends today; a past one on its
 * rule's last day. A later period than now is the current one.
 */
export function spanOf(rule: SpanRule, offset: number, today: string): Span {
	const k = Math.min(0, offset);
	if ("days" in rule) {
		const to = shiftDate(today, rule.days * k);
		return { from: shiftDate(to, -(rule.days - 1)), to };
	}
	if ("weeks" in rule) {
		// The first day of the period's last week: today's week, or whole periods before it.
		const last = shiftDate(weekStartOf(today, rule.weekStart), 7 * rule.weeks * k);
		return { from: shiftDate(last, -7 * (rule.weeks - 1)), to: k === 0 ? today : shiftDate(last, 6) };
	}
	const month = today.slice(0, 7);
	if ("monthEnds" in rule) {
		const last = shiftMonth(month, rule.monthEnds * k);
		return { from: lastDayOfMonth(shiftMonth(last, -(rule.monthEnds - 1))), to: k === 0 ? today : lastDayOfMonth(last) };
	}
	if (rule.calendar) {
		const last = shiftMonth(month, rule.months * k);
		return { from: `${shiftMonth(last, -(rule.months - 1))}-01`, to: k === 0 ? today : lastDayOfMonth(last) };
	}
	return { from: shiftDate(addMonths(today, rule.months * (k - 1)), 1), to: addMonths(today, rule.months * k) };
}

/** The first day of the week `date` falls in, weeks starting on `weekStart` (0 Sunday … 6 Saturday). */
export function weekStartOf(date: string, weekStart: number): string {
	const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
	return shiftDate(date, -((dow - weekStart + 7) % 7));
}

/**
 * A `{ monthEnds }` period's points: the last day of each month it covers,
 * then its own last day where that is not one — today, on the current period.
 */
export function monthEndsOf(span: Span): string[] {
	const out: string[] = [];
	for (let month = span.from.slice(0, 7); month <= span.to.slice(0, 7); month = shiftMonth(month, 1)) {
		const end = lastDayOfMonth(month);
		if (end >= span.from && end <= span.to) out.push(end);
	}
	if (out[out.length - 1] !== span.to) out.push(span.to);
	return out;
}

/** Every day of a span, oldest first. */
export function daysOf(span: Span): string[] {
	return Array.from({ length: daysBetween(span.from, span.to) + 1 }, (_, i) => shiftDate(span.from, i));
}

/** The 1y page's weeks: `count` rolling weeks of seven days ending `end`, oldest first. */
export function rollingWeeks(end: string, count = 52): Span[] {
	return Array.from({ length: count }, (_, i) => {
		const to = shiftDate(end, -7 * (count - 1 - i));
		return { from: shiftDate(to, -6), to };
	});
}

/** Older data exists, or may: the index is still fetching its history. */
export function canStepBack(oldest: string | undefined, complete: boolean, from: string): boolean {
	return !complete || (oldest !== undefined && oldest < from);
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

/**
 * The range control: 1d reopens on the day it last showed, the others on the
 * current period. `range` is one of the stat's own, so one its route takes.
 */
export function switchRange<R extends PeriodRange>(route: PeriodRoute<R>, range: PeriodRange, today: string): PeriodRoute<R> {
	if (range === route.range) return route;
	const next = range as R;
	const shown = route.range === "1d" ? dayOf(route, today) : route.date;
	if (range === "1d") return { range: next, offset: shown ? offsetOfDay(shown, today) : 0 };
	return shown ? { range: next, offset: 0, date: shown } : { range: next, offset: 0 };
}

/** "<" (−1) and ">" (+1): a whole period, never past the current one. */
export function stepRoute<R extends PeriodRange>(route: PeriodRoute<R>, by: number): PeriodRoute<R> {
	return { ...route, offset: back(-(route.offset + by)) };
}

/** A 7d or 4w day card: the page switches in place to 1d on that day. */
export function dayCardRoute(date: string, today: string): PeriodRoute {
	return { range: "1d", offset: offsetOfDay(date, today) };
}

/** The 7d page a 1y week card switches to, as its offset: weeks end a whole number of weeks before today. */
export function weekOffset(weekEnd: string, today: string): number {
	return back(Math.round(daysBetween(weekEnd, today) / 7));
}

/** A 1y week card: the page switches to 7d on exactly that week, keeping the day 1d remembers. */
export function weekCardRoute(route: PeriodRoute<PeriodRange>, weekEnd: string, today: string): PeriodRoute {
	const offset = weekOffset(weekEnd, today);
	return route.date ? { range: "7d", offset, date: route.date } : { range: "7d", offset };
}

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

const yearOf = (date: string) => date.slice(0, 4);

/** "Wednesday". */
export function weekdayOf(date: string): string {
	return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** "October 7". */
export function longDate(date: string): string {
	return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** A day card's date: "October 7", or "October 22, 2025" in another year. */
export function cardDate(date: string, today: string): string {
	return yearOf(date) === yearOf(today) ? longDate(date) : `${longDate(date)}, ${yearOf(date)}`;
}

/** The 1d label: "Today", "Wednesday, October 7", "Wednesday, October 22, 2025". */
export function dayLabel(date: string, today: string): string {
	if (date === today) return "Today";
	const text = `${weekdayOf(date)}, ${longDate(date)}`;
	return yearOf(date) === yearOf(today) ? text : `${text}, ${yearOf(date)}`;
}

/**
 * A 7d or 4w label: "Oct 2 - 8", "Sep 25 - Oct 1"; a past year's without the
 * spaces, "Oct 16-22, 2025"; one across New Year with both years.
 */
export function periodLabel(from: string, to: string, today: string): string {
	if (yearOf(from) !== yearOf(to)) return `${shortDate(from)}, ${yearOf(from)} - ${shortDate(to)}, ${yearOf(to)}`;
	const end = from.slice(0, 7) === to.slice(0, 7) ? String(Number(to.slice(8, 10))) : shortDate(to);
	return yearOf(to) === yearOf(today) ? `${shortDate(from)} - ${end}` : `${shortDate(from)}-${end}, ${yearOf(to)}`;
}

/** The 1y label, always with both years: "Oct 10, 2025 - Oct 8, 2026". */
export function yearLabel(from: string, to: string): string {
	return `${shortDate(from)}, ${yearOf(from)} - ${shortDate(to)}, ${yearOf(to)}`;
}

/** A month: "March 2026". Takes a `YYYY-MM` month or any day in it. */
export function monthLabel(month: string): string {
	return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${yearOf(month)}`;
}

/** Calendar months, by the months `from` and `to` fall in: "Nov 2025 - Oct 2026". */
export function monthsLabel(from: string, to: string): string {
	const short = (date: string) => `${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]} ${yearOf(date)}`;
	return `${short(from)} - ${short(to)}`;
}

/** Any period's label: 1d's day, 7d's and 4w's span, 1y's both years. */
export function rangeLabel(range: PeriodRange, span: Span, today: string): string {
	if (range === "1d") return dayLabel(span.to, today);
	return range === "1y" ? yearLabel(span.from, span.to) : periodLabel(span.from, span.to, today);
}

/**
 * A 1y week card: "October 1 - 7" and "Aug 27 - Sep 2" this year; "December
 * 25 - 31, 2025" and, dropping the end's month, "Nov 27 - 3, 2025" before it.
 * The year is the week's last day's.
 */
export function weekTitle(from: string, to: string, today: string): string {
	const sameMonth = from.slice(0, 7) === to.slice(0, 7);
	const endDay = Number(to.slice(8, 10));
	if (yearOf(to) === yearOf(today)) return sameMonth ? `${longDate(from)} - ${endDay}` : `${shortDate(from)} - ${shortDate(to)}`;
	return `${sameMonth ? longDate(from) : shortDate(from)} - ${endDay}, ${yearOf(to)}`;
}

/** An x axis end: "10-02", the year left off. */
export function axisDay(date: string): string {
	return date.slice(5);
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/** Marks under a chart, every x a fraction of the plot. */
export interface PeriodAxis {
	dots: Array<{ x: number; large: boolean }>;
	/** A year's month names stand on end, reading bottom to top. */
	labels: Array<{ x: number; text: string; rotated?: boolean }>;
}

/** Evenly across the plot, the first on its left edge and the last on its right. */
export function spread(i: number, n: number): number {
	return n <= 1 ? 0.5 : i / (n - 1);
}

/** 7d's and 4w's axis: a dot a day, the two ends large and labelled "MM-DD". */
export function dayAxis(days: readonly string[]): PeriodAxis {
	const n = days.length;
	return {
		dots: days.map((_, i) => ({ x: spread(i, n), large: i === 0 || i === n - 1 })),
		labels: n ? [
			{ x: 0, text: axisDay(days[0]) },
			{ x: 1, text: axisDay(days[n - 1]) },
		] : [],
	};
}

/**
 * 1y's axis: twelve calendar months from the period's first day, a large dot
 * on that day of each month with the month's short name standing on end.
 * `x(date)` places a week (at its first day) on the same scale, so the last
 * week stops short of the axis' end.
 */
export function monthAxis(from: string): { axis: PeriodAxis; x: (date: string) => number } {
	const span = daysBetween(from, addMonths(from, 12));
	const x = (date: string) => daysBetween(from, date) / span;
	const months = Array.from({ length: 13 }, (_, k) => addMonths(from, k));
	return {
		axis: {
			dots: months.map((m) => ({ x: x(m), large: true })),
			labels: months.map((m) => ({ x: x(m), text: SHORT_MONTHS[Number(m.slice(5, 7)) - 1], rotated: true })),
		},
		x,
	};
}

/* ------------------------------------------------------------------ */
/*  Means                                                              */
/* ------------------------------------------------------------------ */

/**
 * How a stat rounds its means: Stress truncates ("floor"); Body Battery,
 * Heart Rate and Respiration round half up ("round").
 */
export type Rounding = "floor" | "round";

/** The mean of `values`, rounded the stat's way; undefined for none. */
/** The plain mean, unrounded; undefined without values. */
export function mean(values: readonly number[]): number | undefined {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

export function meanOf(values: readonly number[], rounding: Rounding): number | undefined {
	if (!values.length) return undefined;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	return rounding === "floor" ? Math.floor(mean) : Math.round(mean);
}

/** A week of a 1y page: its days, and the rounded mean of its values. */
export interface PeriodWeek extends Span {
	/** The rounded mean of the week's values; absent for a week without any. */
	value?: number;
	/** Days with a value. */
	days: number;
}

/**
 * Fifty-two rolling weeks ending `end`, oldest first, each the rounded mean of
 * its days' values: a week is the mean of its days, never of the year's.
 */
export function weeksOf<R extends { date: string }>(rows: readonly R[], end: string, value: (row: R) => number | undefined, rounding: Rounding): PeriodWeek[] {
	const lookup = new Map(rows.map((r) => [r.date, r]));
	return rollingWeeks(end).map((week) => {
		const values: number[] = [];
		for (const day of daysOf(week)) {
			const row = lookup.get(day);
			const v = row ? value(row) : undefined;
			if (v !== undefined) values.push(v);
		}
		const mean = meanOf(values, rounding);
		return mean !== undefined ? { ...week, value: mean, days: values.length } : { ...week, days: 0 };
	});
}
