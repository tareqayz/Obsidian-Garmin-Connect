import type { HeartDay, HeartRateRow } from "../sync/heart-rate-index";
import {
	canStepBack,
	cardDate,
	dayAxis,
	dayLabel,
	dayOf,
	daysOf,
	meanOf,
	monthAxis,
	offsetOfDay,
	periodLabel,
	periodOf,
	rollingWeeks,
	spread,
	weekOffset,
	weekTitle,
	weekdayOf,
	yearLabel,
	type PeriodAxis,
	type PeriodRoute,
	type Span,
	type SpanRange,
} from "./periods";
import { shortDate } from "./day";

/**
 * Garmin Connect's Heart Rate page, worked out from the heart rate index
 * (`src/sync/heart-rate-index.ts`) and, for one day, that day's samples.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The periods, their labels and
 * the cards that switch them are the shared ones (`periods.ts`); the rules
 * here are Heart Rate's, measured on 2026-10-08
 * (ref/health-stats/heart-rate/README.md):
 *
 * - Every average rounds half up, never down: the opposite of Stress. A 7d or
 *   4w average is the period's values over the days that have one, today's
 *   partial day included. A week is the same over its seven days, figure by
 *   figure; a year is the rounded mean of its weeks with data, not of its days.
 * - Figures are Garmin's, shown as sent and never derived from the samples:
 *   resting, the day's High and low (its highest and lowest two-minute
 *   averages, not its raw extremes) and the stored seven-day average.
 * - A day with heart rate but no resting value (2026-01-21, 06-18) shows
 *   none: the index's empty resting wins over dailyHeartRate's, which is the
 *   day's raw minimum there.
 */

/** Heart Rate pages through all four ranges, on the shared route. */
export type HeartRateRoute = PeriodRoute;
/** The day's figures. A period averages the first three. */
export type HeartRateMetric = "resting" | "high" | "low" | "avg7";
export type PeriodMetric = Exclude<HeartRateMetric, "avg7">;

export const PERIOD_METRICS: readonly PeriodMetric[] = ["resting", "high", "low"];

/** A day's figures as the web labels them; the phone shows Resting and High only. */
export const DAY_LABEL: Readonly<Record<HeartRateMetric, string>> = {
	resting: "Resting",
	high: "High",
	low: "Low",
	avg7: "7-Day Avg Resting",
};

/** A period's averages as the web labels them. */
export const AVERAGE_LABEL: Readonly<Record<PeriodMetric, string>> = { resting: "Avg Resting", high: "Avg High", low: "Avg Low" };

/** Heart Rate rounds every mean half up. */
const ROUNDING = "round";

/** What the pages read. */
export interface HeartRatePageData {
	/** The heart rate index, oldest first. */
	rows: readonly HeartRateRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
}

/** A figure: "49 bpm / Resting", "113 bpm / Avg High". */
export interface HeartRateStat {
	metric: HeartRateMetric;
	/** The bare number, "--" without one. */
	value: string;
	/** "bpm" beside a number; absent beside "--". */
	unit?: string;
	label: string;
}

export interface HeartRateInput {
	data: HeartRatePageData;
	route: HeartRateRoute;
	today: string;
	/** 1d: the day's samples, `heartDayIn(series)`: undefined while they load, null once Garmin had none. */
	samples?: HeartDay | null;
	/** 1d: when the night before ended, seconds from the day's midnight: the sleep index's `wake`. */
	wake?: number;
	/**
	 * The web's rules: today's partial day plotted, listed and averaged, and a
	 * year of 52 weeks ending today. The phone (the default) leaves today out
	 * of 7d, 4w and 1y — its card reads "--" — and a year is the weeks ending
	 * yesterday that start inside the period (twin 334:710, 334:52510).
	 */
	includeToday?: boolean;
}

export type HeartRateView = HeartRateDayView | HeartRatePeriodView;

export function heartRateView(input: HeartRateInput): HeartRateView {
	return input.route.range === "1d" ? heartRateDayView(input) : heartRatePeriodView(input);
}

const DASH = "--";
const UNIT = "bpm";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** The longest a day can run, from UTC+14 to UTC−12. */
const MAX_DAY_MS = 50 * HOUR_MS;

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

function stat(metric: HeartRateMetric, value: number | undefined, label: string): HeartRateStat {
	return value !== undefined ? { metric, value: String(value), unit: UNIT, label } : { metric, value: DASH, label };
}

/** A card's figure: the bare number, "--" without one. */
function text(value: number | undefined): string {
	return value !== undefined ? String(value) : DASH;
}

/** A 24-hour clock hour as the axis writes it: "12 AM", "4 PM". */
function clockLabel(hour: number): string {
	return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** An offset from UTC as the web writes it: "GMT +03:00". */
function gmtLabel(offsetMs: number): string {
	const minutes = Math.round(Math.abs(offsetMs) / 60_000);
	return `GMT ${offsetMs < 0 ? "-" : "+"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function byDate(rows: readonly HeartRateRow[]): Map<string, HeartRateRow> {
	return new Map(rows.map((r) => [r.date, r]));
}

function isNumber(value: number | undefined): value is number {
	return value !== undefined;
}

/** Older data exists, or may: the index is still fetching its history. */
function canGoBack(data: HeartRatePageData, from: string): boolean {
	return canStepBack(data.rows[0]?.date, data.complete, from);
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/** A sample the timeline would mark: `x` across the day (0..1), its bpm, and when it was, epoch ms. */
export interface TimelineMark {
	x: number;
	value: number;
	at: number;
}

export interface HeartRateTimeline {
	/**
	 * `pending` while the day's samples load, `drawn` once they are in.
	 * `empty` when Garmin had no samples for the day, as before 2026-06-01 on
	 * this account: the axes and no line.
	 */
	state: "pending" | "empty" | "drawn";
	/** How long the day ran on the clock: 24 hours, 23 or 25 on a day the clocks changed, 35 on a day the watch flew west. */
	hours: number;
	/**
	 * A point a two-minute slot, `x` across the day (0..1). `value` is null
	 * where there is no sample, a null sample or a gap of more than two
	 * minutes, and the line breaks there; a lone sample between two breaks
	 * draws nothing, as on the web.
	 */
	points: Array<{ x: number; value: number | null }>;
	/**
	 * The curve's highest and lowest samples, the first of a tie: where a high
	 * and a low marker would sit, if the phone draws them (README to-do 2).
	 * They are the samples', not the figures: Garmin's High can differ from
	 * the samples' highest (2026-06-18: 105 against 168).
	 */
	highest?: TimelineMark;
	lowest?: TimelineMark;
	/** A dot an hour; a 24-hour day's every fourth is large and labelled, another day's ends only. */
	ticks: Array<{ x: number; large: boolean; label?: string }>;
	/** The clock's offset at each end, on a day it changed: "GMT +03:00". */
	timeZones?: { start: string; end: string };
	/** When the night before ended, 0..1: the clock marker on the dot row. */
	wake?: number;
}

export interface HeartRateDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Daily Timeline". */
	title: string;
	/** Every figure the day has, "--" for one it has not: resting, High, low, and the seven-day average. */
	figures: Readonly<Record<HeartRateMetric, HeartRateStat>>;
	/** The figures the phone shows, in its order: Resting, High. The web adds the seven-day average first. */
	stats: HeartRateStat[];
	timeline: HeartRateTimeline;
}

/**
 * The day's figures: the index's, and the day's payload's where the index
 * has no row for the day or no such figure. The resting value is the
 * index's whenever it has the day, even without one: dailyHeartRate's is the
 * raw minimum on such a day.
 */
export function dayFigures(row: HeartRateRow | undefined, samples: HeartDay | null | undefined): Partial<Record<HeartRateMetric, number>> {
	return {
		resting: row ? row.resting : samples?.resting,
		high: row?.high ?? samples?.high,
		low: row?.low ?? samples?.low,
		avg7: row?.avg7 ?? samples?.avg7,
	};
}

export function heartRateDayView(input: HeartRateInput): HeartRateDayView {
	const date = dayOf(input.route, input.today);
	const values = dayFigures(byDate(input.data.rows).get(date), input.samples);
	const figures = {
		resting: stat("resting", values.resting, DAY_LABEL.resting),
		high: stat("high", values.high, DAY_LABEL.high),
		low: stat("low", values.low, DAY_LABEL.low),
		avg7: stat("avg7", values.avg7, DAY_LABEL.avg7),
	};
	return {
		range: "1d",
		date,
		label: dayLabel(date, input.today),
		canGoBack: canGoBack(input.data, date),
		canGoForward: date < input.today,
		title: "Daily Timeline",
		figures,
		stats: [figures.resting, figures.high],
		timeline: timelineOf(input.samples, date === input.today, input.wake),
	};
}

/**
 * How long the day ran. A day that is over runs from its midnight to its
 * next one on the watch's clock, whatever that came to: 23 or 25 hours on a
 * day the clocks changed, 35 on 2025-10-31. Today runs to its midnight, 24
 * hours on: its end is the last sync. So does a day whose end is not a
 * midnight, kept while it was still today.
 */
export function heartDayLength(day: HeartDay | null | undefined, isToday: boolean): number {
	if (!day || isToday || day.endOffset === undefined) return DAY_MS;
	const length = day.end - day.start;
	if (!(length > 0) || length > MAX_DAY_MS) return DAY_MS;
	const local = (((day.end + day.endOffset) % DAY_MS) + DAY_MS) % DAY_MS;
	return local === 0 ? length : DAY_MS;
}

/**
 * The 1d timeline: a point a sample, the highest and lowest of them, an
 * hour's dot each. `day` is undefined while the samples load and null once
 * Garmin had none.
 */
export function timelineOf(day: HeartDay | null | undefined, isToday = false, wake?: number): HeartRateTimeline {
	const length = heartDayLength(day, isToday);
	const hours = Math.round(length / HOUR_MS);
	const drawn = Boolean(day?.values.some((v) => v !== null));
	const timeline: HeartRateTimeline = { state: day === undefined ? "pending" : drawn ? "drawn" : "empty", hours, points: [], ticks: hourTicks(hours) };
	if (day) {
		for (let i = 0; i < day.values.length; i++) {
			const x = (i * day.step) / length;
			if (x >= 1) break;
			const value = day.values[i] ?? null;
			timeline.points.push({ x, value });
			if (value === null) continue;
			const mark = { x, value, at: day.start + i * day.step };
			if (!timeline.highest || value > timeline.highest.value) timeline.highest = mark;
			if (!timeline.lowest || value < timeline.lowest.value) timeline.lowest = mark;
		}
		if (hours !== 24 && day.startOffset !== undefined && day.endOffset !== undefined) {
			timeline.timeZones = { start: gmtLabel(day.startOffset), end: gmtLabel(day.endOffset) };
		}
	}
	if (wake !== undefined) {
		const x = (wake * 1000) / length;
		if (x > 0 && x < 1) timeline.wake = x;
	}
	return timeline;
}

function hourTicks(hours: number): HeartRateTimeline["ticks"] {
	const ticks: HeartRateTimeline["ticks"] = [];
	for (let h = 0; h <= hours; h++) {
		const large = hours === 24 ? h % 4 === 0 : h === 0 || h === hours;
		ticks.push(large ? { x: h / hours, large, label: clockLabel(hours === 24 ? h : 0) } : { x: h / hours, large });
	}
	return ticks;
}

/** `YYYY-MM-DD` moved by whole days. */
function shiftDay(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}


/**
 * The phone's week card: "Oct 1 - 7", "Aug 27 - Sep 2" this year; "Dec 25-31,
 * 2025", "Nov 27 - Dec 3, 2025" before it, the year the week's last day's.
 */
export function heartRateWeekTitle(from: string, to: string, today: string): string {
	const sameMonth = from.slice(0, 7) === to.slice(0, 7);
	const end = sameMonth ? String(Number(to.slice(8, 10))) : shortDate(to);
	if (to.slice(0, 4) === today.slice(0, 4)) return `${shortDate(from)} - ${end}`;
	return `${shortDate(from)}${sameMonth ? "-" : " - "}${end}, ${to.slice(0, 4)}`;
}

/* ------------------------------------------------------------------ */
/*  7d, 4w and 1y                                                      */
/* ------------------------------------------------------------------ */

/** A day's or a week's values, each null where there is none: no dot there, and the line breaks. */
export interface HeartRatePoint {
	/** Across the plot, 0..1. */
	x: number;
	resting: number | null;
	high: number | null;
	low: number | null;
}

export interface HeartRateDayCard {
	date: string;
	/** "Wednesday". */
	weekday: string;
	/** "October 7", or "October 22, 2025" in another year. */
	detail: string;
	/** Bare numbers, "--" without one. */
	resting: string;
	high: string;
	low: string;
	/** The 1d page the card switches to. */
	offset: number;
}

export interface HeartRateWeekCard {
	from: string;
	to: string;
	title: string;
	/** The week's rounded means, "--" without one. */
	resting: string;
	high: string;
	low: string;
	/** The 7d page the card switches to. */
	offset: number;
}

export interface HeartRatePeriodView {
	range: SpanRange;
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Daily Readings" or "Weekly Averages", as the web titles them. */
	title: string;
	/** A point a day, or a week at its first day. */
	points: HeartRatePoint[];
	/** Every point carries a marker on the web, a year's weeks too (the phone's is to be captured). */
	dots: boolean;
	/** The points joined: days always; the phone's year is dots alone. */
	line: boolean;
	axis: PeriodAxis;
	/** The period's rounded means: of its days on 7d and 4w, of its weeks with data on 1y. */
	averages: Partial<Record<PeriodMetric, number>>;
	/** Avg Resting and Avg High, as the web shows them. */
	stats: HeartRateStat[];
	/** Every average, Avg Low included. */
	figures: Readonly<Record<PeriodMetric, HeartRateStat>>;
	/** 7d and 4w: a card a day, newest first. */
	days: HeartRateDayCard[];
	/** 1y: a card a week with data, newest first. */
	weeks: HeartRateWeekCard[];
}

export function heartRatePeriodView(input: HeartRateInput): HeartRatePeriodView {
	const range: SpanRange = input.route.range === "1d" ? "7d" : input.route.range;
	return range === "1y" ? yearView(input) : daysView(input, range);
}

/** Each figure's rounded mean over the values given. */
function averagesOf(points: readonly HeartRatePoint[]): Partial<Record<PeriodMetric, number>> {
	const out: Partial<Record<PeriodMetric, number>> = {};
	for (const metric of PERIOD_METRICS) {
		const mean = meanOf(
			points.map((p) => p[metric]).filter((v): v is number => v !== null),
			ROUNDING,
		);
		if (mean !== undefined) out[metric] = mean;
	}
	return out;
}

function periodFigures(averages: Partial<Record<PeriodMetric, number>>): Record<PeriodMetric, HeartRateStat> {
	return {
		resting: stat("resting", averages.resting, AVERAGE_LABEL.resting),
		high: stat("high", averages.high, AVERAGE_LABEL.high),
		low: stat("low", averages.low, AVERAGE_LABEL.low),
	};
}

function daysView(input: HeartRateInput, range: "7d" | "4w"): HeartRatePeriodView {
	const { data, route, today } = input;
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = byDate(input.includeToday ? data.rows : data.rows.filter((r) => r.date !== today));
	const points = days.map((date, i) => {
		const row = rows.get(date);
		return { x: spread(i, days.length), resting: row?.resting ?? null, high: row?.high ?? null, low: row?.low ?? null };
	});
	const averages = averagesOf(points);
	const figures = periodFigures(averages);
	return {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		title: "Daily Readings",
		points,
		dots: true,
		line: true,
		axis: dayAxis(days),
		averages,
		stats: [figures.resting, figures.high],
		figures,
		days: [...days].reverse().map((date) => {
			const row = rows.get(date);
			return {
				date,
				weekday: weekdayOf(date),
				detail: cardDate(date, today),
				resting: text(row?.resting),
				high: text(row?.high),
				low: text(row?.low),
				offset: offsetOfDay(date, today),
			};
		}),
		weeks: [],
	};
}

/** A week of the 1y page: its days, and the rounded mean of each figure over the days that have one. */
export interface HeartRateWeek extends Span {
	resting?: number;
	high?: number;
	low?: number;
	/** Days with any figure. */
	days: number;
}

/**
 * Fifty-two rolling weeks of seven days ending `end`, oldest first, each
 * figure the half-up mean of its days with one: Garmin's
 * `stats/heartRate/weekly/{end}/52`, rebuilt from the daily rows.
 */
export function heartRateWeeks(rows: readonly HeartRateRow[], end: string): HeartRateWeek[] {
	const lookup = byDate(rows);
	return rollingWeeks(end).map((span) => {
		const week: HeartRateWeek = { ...span, days: 0 };
		const found = daysOf(span).map((d) => lookup.get(d)).filter((r): r is HeartRateRow => r !== undefined);
		for (const metric of PERIOD_METRICS) {
			const mean = meanOf(found.map((r) => r[metric]).filter(isNumber), ROUNDING);
			if (mean !== undefined) week[metric] = mean;
		}
		week.days = found.filter((r) => PERIOD_METRICS.some((m) => r[m] !== undefined)).length;
		return week;
	});
}

function yearView(input: HeartRateInput): HeartRatePeriodView {
	const { data, route, today } = input;
	const { from, to } = periodOf("1y", route.offset, today);
	const weeks = input.includeToday ? heartRateWeeks(data.rows, to) : heartRateWeeks(data.rows, shiftDay(to, -1)).filter((w) => w.from >= from);
	const months = monthAxis(from);
	const points = weeks.map((w) => ({ x: months.x(w.from), resting: w.resting ?? null, high: w.high ?? null, low: w.low ?? null }));
	const averages = averagesOf(points);
	const figures = periodFigures(averages);
	return {
		range: "1y",
		from,
		to,
		label: yearLabel(from, to),
		canGoBack: canGoBack(data, from),
		canGoForward: route.offset < 0,
		title: "Weekly Averages",
		points,
		dots: true,
		line: Boolean(input.includeToday),
		axis: months.axis,
		averages,
		stats: [figures.resting, figures.high],
		figures,
		days: [],
		weeks: [...weeks]
			.reverse()
			.filter((w) => w.days > 0)
			.map((w) => ({
				from: w.from,
				to: w.to,
				title: input.includeToday ? weekTitle(w.from, w.to, today) : heartRateWeekTitle(w.from, w.to, today),
				resting: text(w.resting),
				high: text(w.high),
				low: text(w.low),
				offset: weekOffset(w.to, today),
			})),
	};
}
