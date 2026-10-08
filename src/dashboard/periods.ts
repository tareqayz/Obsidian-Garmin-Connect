import { shortDate } from "./day";
import type { HealthRange } from "./health-stats";
import { shiftDate } from "./series";

/**
 * The period maths every range stat on the shared Health Stats route uses:
 * a day, a week, four weeks or a year as the app pages through them, the
 * labels on the page, the cards that switch it, and the means behind its
 * figures.
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
 * Pure. Dates are local `YYYY-MM-DD` strings.
 */

/** The ranges a stat can page through. */
export type PeriodRange = HealthRange;
/** The ranges that span more than a day. */
export type SpanRange = Exclude<PeriodRange, "1d">;

/** The days a period covers, which is also how far "<" moves it. */
export const PERIOD_DAYS: Readonly<Record<SpanRange, number>> = { "7d": 7, "4w": 28, "1y": 364 };

/** Where a stat's page is: its range, how many periods back, and the day 1d last showed. */
export interface PeriodRoute {
	range: PeriodRange;
	/** Days, weeks, four weeks or years of fifty-two weeks back from the current one: 0 or less. */
	offset: number;
	/** The day 1d last showed, kept while another range is open, so 1d reopens on it. */
	date?: string;
}

export interface Span {
	from: string;
	to: string;
}

const DAY_MS = 86_400_000;

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

/** The days a 7d, 4w or 1y page covers. */
export function periodOf(range: SpanRange, offset: number, today: string): Span {
	const n = PERIOD_DAYS[range];
	const to = shiftDate(today, n * Math.min(0, offset));
	return { from: shiftDate(to, -(n - 1)), to };
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

/** The range control: 1d reopens on the day it last showed, the others on the current period. */
export function switchRange(route: PeriodRoute, range: PeriodRange, today: string): PeriodRoute {
	if (range === route.range) return route;
	const shown = route.range === "1d" ? dayOf(route, today) : route.date;
	if (range === "1d") return { range, offset: shown ? offsetOfDay(shown, today) : 0 };
	return shown ? { range, offset: 0, date: shown } : { range, offset: 0 };
}

/** "<" (−1) and ">" (+1): a whole period, never past the current one. */
export function stepRoute(route: PeriodRoute, by: number): PeriodRoute {
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
export function weekCardRoute(route: PeriodRoute, weekEnd: string, today: string): PeriodRoute {
	const offset = weekOffset(weekEnd, today);
	return route.date ? { range: "7d", offset, date: route.date } : { range: "7d", offset };
}

/** The days whose series a page loads: a 1d page's day. */
export function periodSeriesDays(route: PeriodRoute, today: string): string[] {
	return route.range === "1d" ? [dayOf(route, today)] : [];
}

/* ------------------------------------------------------------------ */
/*  Labels                                                             */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

const yearOf = (date: string) => date.slice(0, 4);

/** "Wednesday". */
export function weekdayOf(date: string): string {
	return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
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
			{ x: 0, text: axisDay(days[0]!) },
			{ x: 1, text: axisDay(days[n - 1]!) },
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
			labels: months.map((m) => ({ x: x(m), text: SHORT_MONTHS[Number(m.slice(5, 7)) - 1]!, rotated: true })),
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
