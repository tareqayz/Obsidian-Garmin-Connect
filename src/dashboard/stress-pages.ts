import type { StressDay, StressRow } from "../sync/stress-index";
import { shortDate } from "./day";
import { shiftDate } from "./series";
import { stressCopy } from "./stress-copy";

/**
 * Garmin Connect's Stress page, worked out from the stress index
 * (`src/sync/stress-index.ts`) and, for one day, that day's readings.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The rules are the app's and the
 * web's, measured on 2026-10-08 (ref/health-stats/stress/README.md):
 *
 * - Periods roll back from today: 7d is the seven days ending today, 4w the
 *   twenty-eight, 1y fifty-two weeks of seven. A step back moves a whole
 *   period, so a 1y week is always a whole number of 7d steps back.
 * - Averages truncate, never round. A 7d or 4w average is the period's levels
 *   over the days that have one, today's partial day included. A week is the
 *   same over its seven days; a year is the mean of its weeks with data, not
 *   of its days.
 * - A day's level is Garmin's, never recomputed from the readings.
 * - The ring splits the measured time — rest, low, medium, high, clockwise
 *   from twelve o'clock. Unmeasurable and active time are not in it.
 */

export type StressRange = "1d" | "7d" | "4w" | "1y";
export type StressPeriodRange = Exclude<StressRange, "1d">;
export type StressPart = "rest" | "low" | "medium" | "high";

export const STRESS_RANGES: readonly StressRange[] = ["1d", "7d", "4w", "1y"];
export const STRESS_PARTS: readonly StressPart[] = ["rest", "low", "medium", "high"];
export const PART_LABEL: Readonly<Record<StressPart, string>> = { rest: "Rest", low: "Low", medium: "Medium", high: "High" };

/** The days a period covers, which is also how far "<" moves it. */
export const PERIOD_DAYS: Readonly<Record<StressPeriodRange, number>> = { "7d": 7, "4w": 28, "1y": 364 };

/** The timeline's one split: a reading at or below 25 is rest, above it stress. */
export const REST_MAX = 25;

/** What the pages read. */
export interface StressData {
	/** The stress index, oldest first. */
	rows: readonly StressRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
}

export const NO_STRESS: StressData = { rows: [], complete: false };

export interface StressRoute {
	range: StressRange;
	/** Days, weeks, four weeks or years of fifty-two weeks back from the current one: 0 or less. */
	offset: number;
	/** The day 1d last showed, kept while another range is open, so 1d reopens on it. */
	date?: string;
}

/** A category's share of the day's measured time. An empty ring is a day without any: drawn grey. */
export interface RingPart {
	part: StressPart;
	fraction: number;
}

/** A figure: "25 / Avg Stress Level", "10h 57m / Rest". */
export interface StressStat {
	value: string;
	label: string;
	/** A tile's category, for its dot. */
	part?: StressPart;
}

export interface StressInput {
	data: StressData;
	route: StressRoute;
	today: string;
	/** 1d: the day's readings, `stressDayIn(series)`: undefined while they load, null once Garmin had none. */
	readings?: StressDay | null;
	/** 1d: when the night before ended, seconds from the day's midnight: the sleep index's `wake`. */
	wake?: number;
}

export type StressView = StressDayView | StressPeriodView;

export function stressView(input: StressInput): StressView {
	return input.route.range === "1d" ? stressDayView(input) : stressPeriodView(input);
}

const DASH = "--";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));

/** Whole minutes as the app writes them: "10h 57m", "59m", and "2h" on the hour. */
export function duration(seconds: number): string {
	const minutes = Math.floor(Math.max(0, seconds) / 60);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function weekday(date: string): string {
	return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/** "October 7". */
function longDate(date: string): string {
	return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

const yearOf = (date: string) => date.slice(0, 4);

/** The 1d label: "Today", "Wednesday, October 7", "Wednesday, October 22, 2025". */
export function dayLabel(date: string, today: string): string {
	if (date === today) return "Today";
	const text = `${weekday(date)}, ${longDate(date)}`;
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

/** A 24-hour clock hour as the axis writes it: "12 AM", "4 PM". */
function clockLabel(hour: number): string {
	return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** An offset from UTC as the web writes it: "GMT +03:00". */
function gmtLabel(offsetMs: number): string {
	const minutes = Math.round(Math.abs(offsetMs) / 60_000);
	return `GMT ${offsetMs < 0 ? "-" : "+"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The same day `months` months on, or the month's last day when it has no such day. */
function addMonths(date: string, months: number): string {
	const t = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months;
	const year = Math.floor(t / 12);
	const month = t - year * 12;
	const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const day = Math.min(Number(date.slice(8, 10)), last);
	return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The truncated mean, as every Stress average is. */
export function floorMean(values: readonly number[]): number {
	return Math.floor(values.reduce((a, b) => a + b, 0) / values.length);
}

function byDate(rows: readonly StressRow[]): Map<string, StressRow> {
	return new Map(rows.map((r) => [r.date, r]));
}

/** Older data exists, or may: the index is still fetching its history. */
function canGoBack(data: StressData, from: string): boolean {
	const oldest = data.rows[0]?.date;
	return !data.complete || (oldest !== undefined && oldest < from);
}

/** Each category's share of the measured time, in the ring's order; empty for a day without any. */
export function ringOf(row: Partial<Record<StressPart, number>> | null | undefined): RingPart[] {
	const total = STRESS_PARTS.reduce((sum, part) => sum + (row?.[part] ?? 0), 0);
	if (!(total > 0)) return [];
	return STRESS_PARTS.map((part) => ({ part, fraction: (row?.[part] ?? 0) / total }));
}

/** Evenly across the plot, the first on its left edge and the last on its right. */
function spread(i: number, n: number): number {
	return n <= 1 ? 0.5 : i / (n - 1);
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

/** The day a 1d page shows. */
export function dayOf(route: StressRoute, today: string): string {
	return shiftDate(today, Math.min(0, route.offset));
}

/** Periods back as an offset: never above 0, and never −0, which a saved route would keep. */
function back(periods: number): number {
	return periods > 0 ? -periods : 0;
}

/** A day as a 1d offset: 0 today, −1 yesterday. A day still to come is today. */
export function offsetOfDay(date: string, today: string): number {
	return back(daysBetween(date, today));
}

/** The days a 7d, 4w or 1y page covers. */
export function periodOf(range: StressPeriodRange, offset: number, today: string): { from: string; to: string } {
	const n = PERIOD_DAYS[range];
	const to = shiftDate(today, n * Math.min(0, offset));
	return { from: shiftDate(to, -(n - 1)), to };
}

/** The range bar: 1d reopens on the day it last showed, 7d, 4w and 1y on the current period. */
export function switchRange(route: StressRoute, range: StressRange, today: string): StressRoute {
	if (range === route.range) return route;
	const shown = route.range === "1d" ? dayOf(route, today) : route.date;
	if (range === "1d") return { range, offset: shown ? offsetOfDay(shown, today) : 0 };
	return shown ? { range, offset: 0, date: shown } : { range, offset: 0 };
}

/** "<" (−1) and ">" (+1): a whole period, never past the current one. */
export function stepRoute(route: StressRoute, by: number): StressRoute {
	return { ...route, offset: back(-(route.offset + by)) };
}

/** A 7d or 4w day card: the page switches in place to 1d on that day. */
export function dayCardRoute(date: string, today: string): StressRoute {
	return { range: "1d", offset: offsetOfDay(date, today) };
}

/** A 1y week card: the page switches to 7d on exactly that week, a whole number of weeks back. */
export function weekCardRoute(route: StressRoute, weekEnd: string, today: string): StressRoute {
	const offset = back(Math.round(daysBetween(weekEnd, today) / 7));
	return route.date ? { range: "7d", offset, date: route.date } : { range: "7d", offset };
}

/** The days whose readings a page loads: a 1d page's day. */
export function stressSeriesDays(route: StressRoute, today: string): string[] {
	return route.range === "1d" ? [dayOf(route, today)] : [];
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

export interface StressTimeline {
	/**
	 * `pending` while the day's readings load, `drawn` once they are in.
	 * `empty` when Garmin had no stress readings for the day, as before the
	 * account's watch sent intraday data (June 2026 here): axes and no bars,
	 * inferred until the phone shows such a day.
	 */
	state: "pending" | "empty" | "drawn";
	/** How long the day ran on the clock: 24 hours, or 23 / 25 on a day the clocks changed. */
	hours: number;
	/** A bar a reading at zero or above, `x0..x1` across the day (0..1). */
	bars: Array<{ x0: number; x1: number; level: number; tone: "rest" | "stress" }>;
	/** Runs Garmin could not score: too active to measure (−2), and off the wrist or short of data (−1). */
	active: Array<{ x0: number; x1: number }>;
	unmeasurable: Array<{ x0: number; x1: number }>;
	/** A dot an hour; a 24-hour day's every fourth is large and labelled, another day's ends only. */
	ticks: Array<{ x: number; large: boolean; label?: string }>;
	/** The clock's offset at each end, on a day the clocks changed: "GMT +03:00". */
	zones?: { start: string; end: string };
	/** When the night before ended, 0..1: the clock marker on the dot row. */
	wake?: number;
}

export interface StressDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The day's level, "--" without one. */
	value: string;
	/** Rest, low, medium and high, each its share of the measured time; empty for a grey ring. */
	ring: RingPart[];
	/** The sentence under the ring. */
	copy: string;
	/** Rest, Low, Medium, High. */
	tiles: StressStat[];
	timeline: StressTimeline;
}

export function stressDayView(input: StressInput): StressDayView {
	const date = dayOf(input.route, input.today);
	const row = byDate(input.data.rows).get(date);
	return {
		range: "1d",
		date,
		label: dayLabel(date, input.today),
		canGoBack: canGoBack(input.data, date),
		canGoForward: date < input.today,
		value: row?.level !== undefined ? String(row.level) : DASH,
		ring: ringOf(row),
		copy: stressCopy(row?.qualifier, row?.level, date === input.today),
		tiles: STRESS_PARTS.map((part) => {
			const seconds = row?.[part];
			return { value: seconds !== undefined ? duration(seconds) : DASH, label: PART_LABEL[part], part };
		}),
		timeline: timelineOf(input.readings, input.wake),
	};
}

/**
 * How long the day ran: midnight to midnight on the watch's clock, which is
 * 23 or 25 hours on a day the clocks changed, or 24 hours for a day still
 * going, whose end is its newest reading.
 */
export function dayLength(day: StressDay): number {
	const length = day.end - day.start;
	const offset = day.endOffset ?? day.startOffset;
	const atMidnight = offset !== undefined ? (((day.end + offset) % DAY_MS) + DAY_MS) % DAY_MS === 0 : length % HOUR_MS === 0;
	return atMidnight && length >= 22 * HOUR_MS && length <= 26 * HOUR_MS ? length : DAY_MS;
}

/**
 * The 1d timeline: a bar a reading, the runs it could not score, an hour's
 * dot each. `day` is undefined while the readings load and null once Garmin
 * had none.
 */
export function timelineOf(day: StressDay | null | undefined, wake?: number): StressTimeline {
	const length = day ? dayLength(day) : DAY_MS;
	const hours = Math.round(length / HOUR_MS);
	const state = day === undefined ? "pending" : day && day.levels.some((v) => v !== null) ? "drawn" : "empty";
	const timeline: StressTimeline = { state, hours, bars: [], active: [], unmeasurable: [], ticks: hourTicks(hours) };
	if (day) {
		let run: { kind: "active" | "unmeasurable"; x0: number; x1: number } | null = null;
		for (let i = 0; i < day.levels.length; i++) {
			const x0 = (i * day.step) / length;
			if (x0 >= 1) break;
			const x1 = Math.min(1, ((i + 1) * day.step) / length);
			const v = day.levels[i] ?? null;
			const kind = v === null || v >= 0 ? null : v === -2 ? "active" : "unmeasurable";
			if (run && run.kind === kind && Math.abs(run.x1 - x0) < 1e-9) {
				run.x1 = x1;
				continue;
			}
			if (run) timeline[run.kind].push({ x0: run.x0, x1: run.x1 });
			run = kind ? { kind, x0, x1 } : null;
			if (v !== null && v >= 0) timeline.bars.push({ x0, x1, level: v, tone: v > REST_MAX ? "stress" : "rest" });
		}
		if (run) timeline[run.kind].push({ x0: run.x0, x1: run.x1 });
		if (hours !== 24 && day.startOffset !== undefined && day.endOffset !== undefined) {
			timeline.zones = { start: gmtLabel(day.startOffset), end: gmtLabel(day.endOffset) };
		}
	}
	if (wake !== undefined) {
		const x = (wake * 1000) / length;
		if (x > 0 && x < 1) timeline.wake = x;
	}
	return timeline;
}

function hourTicks(hours: number): StressTimeline["ticks"] {
	const ticks: StressTimeline["ticks"] = [];
	for (let h = 0; h <= hours; h++) {
		const large = hours === 24 ? h % 4 === 0 : h === 0 || h === hours;
		ticks.push(large ? { x: h / hours, large, label: clockLabel(hours === 24 ? h : 0) } : { x: h / hours, large });
	}
	return ticks;
}

/* ------------------------------------------------------------------ */
/*  7d, 4w and 1y                                                      */
/* ------------------------------------------------------------------ */

export interface StressAxis {
	dots: Array<{ x: number; large: boolean }>;
	/** A year's month names stand on end, reading bottom to top. */
	labels: Array<{ x: number; text: string; rotated?: boolean }>;
}

export interface StressDayCard {
	date: string;
	/** "Wednesday". */
	weekday: string;
	/** "October 7", or "October 22, 2025" in another year. */
	detail: string;
	/** The level, "--" without one. */
	value: string;
	/** The mini ring; empty for a grey one. */
	ring: RingPart[];
	/** The 1d page the card switches to. */
	offset: number;
}

export interface StressWeekCard {
	from: string;
	to: string;
	title: string;
	/** "25 Avg". */
	value: string;
	/** The 7d page the card switches to. */
	offset: number;
}

export interface StressPeriodView {
	range: StressPeriodRange;
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Daily Averages" or "Weekly Averages". */
	title: string;
	/** `x` across the plot (0..1); `value` null where a day or week has no level, and the line breaks there. */
	points: Array<{ x: number; value: number | null }>;
	/** Days carry a dot; a year's weeks are a bare line. */
	dots: boolean;
	axis: StressAxis;
	/** Avg Stress Level, Lowest, Highest: the phone shows the first, the web all three. */
	stats: StressStat[];
	/** 7d and 4w: a card a day, newest first. */
	days: StressDayCard[];
	/** 1y: a card a week with data, newest first. */
	weeks: StressWeekCard[];
}

export function stressPeriodView(input: StressInput): StressPeriodView {
	const range: StressPeriodRange = input.route.range === "1d" ? "7d" : input.route.range;
	return range === "1y" ? yearView(input) : daysView(input, range);
}

function periodStats(values: readonly number[]): StressStat[] {
	const has = values.length > 0;
	return [
		{ value: has ? String(floorMean(values)) : DASH, label: "Avg Stress Level" },
		{ value: has ? String(Math.min(...values)) : DASH, label: "Lowest" },
		{ value: has ? String(Math.max(...values)) : DASH, label: "Highest" },
	];
}

function daysView(input: StressInput, range: "7d" | "4w"): StressPeriodView {
	const { data, route, today } = input;
	const { from, to } = periodOf(range, route.offset, today);
	const n = PERIOD_DAYS[range];
	const days = Array.from({ length: n }, (_, i) => shiftDate(from, i));
	const rows = byDate(data.rows);
	const levels = days.map((d) => rows.get(d)?.level);
	return {
		range,
		from,
		to,
		label: periodLabel(from, to, today),
		canGoBack: canGoBack(data, from),
		canGoForward: route.offset < 0,
		title: "Daily Averages",
		points: days.map((_, i) => ({ x: spread(i, n), value: levels[i] ?? null })),
		dots: true,
		axis: {
			dots: days.map((_, i) => ({ x: spread(i, n), large: i === 0 || i === n - 1 })),
			labels: [
				{ x: 0, text: from.slice(5) },
				{ x: 1, text: to.slice(5) },
			],
		},
		stats: periodStats(levels.filter((v): v is number => v !== undefined)),
		days: [...days].reverse().map((date) => {
			const row = rows.get(date);
			return {
				date,
				weekday: weekday(date),
				detail: yearOf(date) === yearOf(today) ? longDate(date) : `${longDate(date)}, ${yearOf(date)}`,
				value: row?.level !== undefined ? String(row.level) : DASH,
				ring: ringOf(row),
				offset: offsetOfDay(date, today),
			};
		}),
		weeks: [],
	};
}

export interface StressWeek {
	from: string;
	to: string;
	/** The truncated mean of the week's levels; absent for a week without any. */
	value?: number;
	/** Days with a level. */
	days: number;
}

/** Fifty-two weeks of seven days ending `end`, oldest first, each the truncated mean of its days with a level. */
export function stressWeeks(rows: readonly StressRow[], end: string): StressWeek[] {
	const lookup = byDate(rows);
	const weeks: StressWeek[] = [];
	for (let k = 51; k >= 0; k--) {
		const to = shiftDate(end, -7 * k);
		const from = shiftDate(to, -6);
		const levels: number[] = [];
		for (let i = 0; i < 7; i++) {
			const level = lookup.get(shiftDate(from, i))?.level;
			if (level !== undefined) levels.push(level);
		}
		weeks.push(levels.length ? { from, to, value: floorMean(levels), days: levels.length } : { from, to, days: 0 });
	}
	return weeks;
}

function yearView(input: StressInput): StressPeriodView {
	const { data, route, today } = input;
	const { from, to } = periodOf("1y", route.offset, today);
	const weeks = stressWeeks(data.rows, to);
	// Twelve calendar months from the period's first day, a dot on that day of each month.
	const span = daysBetween(from, addMonths(from, 12));
	const months = Array.from({ length: 13 }, (_, k) => addMonths(from, k));
	return {
		range: "1y",
		from,
		to,
		label: yearLabel(from, to),
		canGoBack: canGoBack(data, from),
		canGoForward: route.offset < 0,
		title: "Weekly Averages",
		points: weeks.map((w) => ({ x: daysBetween(from, w.from) / span, value: w.value ?? null })),
		dots: false,
		axis: {
			dots: months.map((m) => ({ x: daysBetween(from, m) / span, large: true })),
			labels: months.map((m) => ({ x: daysBetween(from, m) / span, text: SHORT_MONTHS[Number(m.slice(5, 7)) - 1]!, rotated: true })),
		},
		stats: periodStats(weeks.map((w) => w.value).filter((v): v is number => v !== undefined)),
		days: [],
		weeks: [...weeks]
			.reverse()
			.filter((w) => w.value !== undefined)
			.map((w) => ({
				from: w.from,
				to: w.to,
				title: weekTitle(w.from, w.to, today),
				value: `${w.value} Avg`,
				offset: back(Math.round(daysBetween(w.to, today) / 7)),
			})),
	};
}
