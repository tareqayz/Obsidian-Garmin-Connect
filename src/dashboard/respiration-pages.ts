import type { RespirationDayData, RespirationRow } from "../sync/respiration-index";
import {
	canStepBack,
	dayAxis,
	dayLabel,
	dayOf,
	daysOf,
	meanOf,
	offsetOfDay,
	periodLabel,
	periodOf,
	spread,
	weekdayOf,
	type PeriodAxis,
	type PeriodRoute,
} from "./periods";
import { readingDate } from "./day";

/**
 * Garmin Connect's Respiration page, worked out from the respiration index
 * (`src/sync/respiration-index.ts`) and, for one day, that day's hourly rows.
 *
 * Pure. The rules were measured on 2026-10-08
 * (ref/health-stats/respiration/README.md):
 *
 * - 1d, 7d and 4w only: no 1y on the phone or the web.
 * - A period's Sleep Avg and Awake Avg are each the half-up rounded mean of
 *   the days that have that value, today's partial day included.
 * - The 1d Lowest / Highest are the day payload's hourly extremes, never the
 *   daily summary's (Oct 2: 6, Oct 4: 8, Sep 12: 21).
 * - Every y axis is five gridlines: lo = min − 1, hi = max + 1, step =
 *   ⌈(hi − lo) / 4⌉, centre = ⌊(lo + hi) / 2⌋, ticks centre ± 2·step.
 * - A −1 or −2 hour draws nothing and breaks the average line.
 * - The night shows as markers on the axis' dot row: a "zz" where it began
 *   (inside the day) and a clock where it ended; an evening's night a "zz".
 */

export type RespirationRoute = PeriodRoute;

export interface RespirationPageData {
	rows: readonly RespirationRow[];
	complete: boolean;
}

/** A figure: "7 brpm / Lowest". */
export interface RespirationStat {
	/** The bare number, "--" without one. */
	value: string;
	unit?: string;
	label: string;
}

export interface RespirationInput {
	data: RespirationPageData;
	route: RespirationRoute;
	today: string;
	/** 1d: the day's rows, `respirationDayIn(series)`: undefined while they load, null once Garmin had none. */
	day?: RespirationDayData | null;
}

const DASH = "--";
const UNIT = "brpm";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MAX_DAY_MS = 50 * HOUR_MS;

function stat(value: number | undefined, label: string): RespirationStat {
	return value !== undefined ? { value: String(value), unit: UNIT, label } : { value: DASH, label };
}

/** "13 brpm", or "--". */
export function brpmText(value: number | undefined): string {
	return value !== undefined ? `${value} ${UNIT}` : DASH;
}

function shiftDay(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function byDate(rows: readonly RespirationRow[]): Map<string, RespirationRow> {
	return new Map(rows.map((r) => [r.date, r]));
}

function canGoBack(data: RespirationPageData, from: string): boolean {
	return canStepBack(data.rows[0]?.date, data.complete, from);
}

/**
 * The five gridlines, top first, for values running `min` to `max`: Today
 * 7…20 → 21 17 13 9 5; 8…42 → 43 34 25 16 7; 7d 13…14 → 15…11.
 */
export function respirationTicks(min: number, max: number): number[] {
	const lo = min - 1;
	const hi = max + 1;
	const step = Math.max(1, Math.ceil((hi - lo) / 4));
	const centre = Math.floor((lo + hi) / 2);
	return [2, 1, 0, -1, -2].map((k) => centre + k * step);
}

/** Without data, the axis of a typical day. */
const DEFAULT_TICKS = respirationTicks(6, 20);

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/** An hour with readings: `x` its end across the day (0..1). */
export interface RespirationBar {
	x: number;
	avg: number;
	high: number;
	low: number;
}

export interface RespirationMarker {
	kind: "sleep" | "wake";
	x: number;
}

export interface RespirationTimeline {
	/** `pending` while the rows load, `empty` without a drawn hour, `drawn` otherwise. */
	state: "pending" | "empty" | "drawn";
	hours: number;
	/** Gridlines, top first. */
	ticks: number[];
	bars: RespirationBar[];
	/** The average line's points, null where an hour has no reading: the line breaks there. */
	line: Array<{ x: number; value: number | null }>;
	axis: PeriodAxis;
	markers: RespirationMarker[];
}

/** A Sleep Averages card: the night's wake day, and the 1d Sleep page it opens. */
export interface SleepAverageCard {
	date: string;
	weekday: string;
	/** "Oct 8": shown only on a card alone in its row. */
	detail: string;
	value: string;
	/** The Sleep page's offset for the night ending `date`. */
	sleepOffset: number;
}

export interface RespirationDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	title: string;
	/** Lowest, Highest, Awake Avg. */
	stats: RespirationStat[];
	timeline: RespirationTimeline;
	/** The night that ended this morning, then the one that started this evening, each when it has a value. */
	sleep: SleepAverageCard[];
}

/** How long the day ran: today and a day whose end is not a local midnight run 24 hours. */
export function respirationDayLength(day: RespirationDayData | null | undefined, isToday: boolean): number {
	if (!day || isToday || day.endOffset === undefined) return DAY_MS;
	const length = day.end - day.start;
	if (!(length > 0) || length > MAX_DAY_MS) return DAY_MS;
	const local = (((day.end + day.endOffset) % DAY_MS) + DAY_MS) % DAY_MS;
	return local === 0 ? length : DAY_MS;
}

function clockLabel(hour: number): string {
	return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** A dot an hour; on a 24-hour day every fourth large and labelled, on another the ends only. */
function hourAxis(hours: number): PeriodAxis {
	const axis: PeriodAxis = { dots: [], labels: [] };
	for (let h = 0; h <= hours; h++) {
		const large = hours === 24 ? h % 4 === 0 : h === 0 || h === hours;
		axis.dots.push({ x: h / hours, large });
		if (large) axis.labels.push({ x: h / hours, text: clockLabel(hours === 24 ? h : 0) });
	}
	return axis;
}

export function timelineOf(day: RespirationDayData | null | undefined, isToday = false): RespirationTimeline {
	const length = respirationDayLength(day, isToday);
	const hours = Math.round(length / HOUR_MS);
	const bars: RespirationBar[] = [];
	const line: RespirationTimeline["line"] = [];
	const markers: RespirationMarker[] = [];
	if (day) {
		for (const [t, avg, high, low] of day.hours) {
			const x = (t - day.start) / length;
			if (x <= 0 || x > 1) continue;
			if (avg < 0 || high === null || low === null) {
				line.push({ x, value: null });
				continue;
			}
			bars.push({ x, avg, high, low });
			line.push({ x, value: avg });
		}
		const at = (ms: number | undefined) => (ms === undefined ? undefined : (ms - day.start) / length);
		const inside = (x: number | undefined): x is number => x !== undefined && x > 0 && x < 1;
		const start = at(day.sleepStart);
		const wake = at(day.sleepEnd);
		const evening = at(day.nextSleepStart);
		if (inside(start)) markers.push({ kind: "sleep", x: start });
		if (inside(wake)) markers.push({ kind: "wake", x: wake });
		if (inside(evening)) markers.push({ kind: "sleep", x: evening });
	}
	const lows = bars.map((b) => b.low);
	const highs = bars.map((b) => b.high);
	const min = day?.lowest ?? (lows.length ? Math.min(...lows) : undefined);
	const max = day?.highest ?? (highs.length ? Math.max(...highs) : undefined);
	return {
		state: day === undefined ? "pending" : bars.length ? "drawn" : "empty",
		hours,
		ticks: min !== undefined && max !== undefined ? respirationTicks(min, max) : DEFAULT_TICKS,
		bars,
		line,
		axis: hourAxis(hours),
		markers,
	};
}

export function respirationDayView(input: RespirationInput): RespirationDayView {
	const { data, today } = input;
	const date = dayOf(input.route, today);
	const rows = byDate(data.rows);
	const day = input.day;
	const awake = rows.get(date)?.awake ?? day?.awake;
	const sleep: SleepAverageCard[] = [];
	for (const night of [date, shiftDay(date, 1)]) {
		const value = rows.get(night)?.sleep;
		if (value === undefined || night > today) continue;
		sleep.push({ date: night, weekday: weekdayOf(night), detail: readingDate(night, today), value: brpmText(value), sleepOffset: offsetOfDay(night, today) });
	}
	return {
		range: "1d",
		date,
		label: dayLabel(date, today),
		canGoBack: canGoBack(data, date),
		canGoForward: date < today,
		title: "Daily Timeline",
		stats: [stat(day?.lowest, "Lowest"), stat(day?.highest, "Highest"), stat(awake, "Awake Avg")],
		timeline: timelineOf(day, date === today),
		sleep,
	};
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

export interface RespirationPoint {
	x: number;
	sleep: number | null;
	awake: number | null;
}

export interface RespirationDayCard {
	date: string;
	weekday: string;
	/** "Oct 8". */
	detail: string;
	/** "13 brpm" or "--". */
	sleep: string;
	awake: string;
	/** The 1d page a tap switches to. */
	offset: number;
}

export interface RespirationPeriodView {
	range: "7d" | "4w";
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	title: string;
	points: RespirationPoint[];
	ticks: number[];
	axis: PeriodAxis;
	averages: { sleep?: number; awake?: number };
	/** Sleep Avg, Awake Avg. */
	stats: RespirationStat[];
	/** Newest first. */
	days: RespirationDayCard[];
}

export function respirationPeriodView(input: RespirationInput): RespirationPeriodView {
	const { data, route, today } = input;
	const range = route.range === "4w" ? "4w" : "7d";
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = byDate(data.rows);
	const points = days.map((date, i) => {
		const row = rows.get(date);
		return { x: spread(i, days.length), sleep: row?.sleep ?? null, awake: row?.awake ?? null };
	});
	const values = (key: "sleep" | "awake") => points.map((p) => p[key]).filter((v): v is number => v !== null);
	const averages: RespirationPeriodView["averages"] = {};
	const sleepMean = meanOf(values("sleep"), "round");
	const awakeMean = meanOf(values("awake"), "round");
	if (sleepMean !== undefined) averages.sleep = sleepMean;
	if (awakeMean !== undefined) averages.awake = awakeMean;
	const all = [...values("sleep"), ...values("awake")];
	return {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		title: "Daily Averages",
		points,
		ticks: all.length ? respirationTicks(Math.min(...all), Math.max(...all)) : DEFAULT_TICKS,
		axis: dayAxis(days),
		averages,
		stats: [stat(averages.sleep, "Sleep Avg"), stat(averages.awake, "Awake Avg")],
		days: [...days].reverse().map((date) => {
			const row = rows.get(date);
			return { date, weekday: weekdayOf(date), detail: readingDate(date, today), sleep: brpmText(row?.sleep), awake: brpmText(row?.awake), offset: offsetOfDay(date, today) };
		}),
	};
}

export type RespirationView = RespirationDayView | RespirationPeriodView;

export function respirationView(input: RespirationInput): RespirationView {
	return input.route.range === "1d" ? respirationDayView(input) : respirationPeriodView(input);
}
