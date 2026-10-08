import type { StressDay, StressRow } from "../sync/stress-index";
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
	spread,
	weekOffset,
	weekTitle,
	weekdayOf,
	weeksOf,
	yearLabel,
	type PeriodAxis,
	type PeriodRange,
	type PeriodRoute,
	type PeriodWeek,
	type SpanRange,
} from "./periods";
import { stressCopy } from "./stress-copy";

/**
 * Garmin Connect's Stress page, worked out from the stress index
 * (`src/sync/stress-index.ts`) and, for one day, that day's readings.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The periods, their labels and
 * the cards that switch them are the shared ones (`periods.ts`); the rules
 * here are Stress's, measured on 2026-10-08 (ref/health-stats/stress/README.md):
 *
 * - Averages truncate, never round. A 7d or 4w average is the period's levels
 *   over the days that have one, today's partial day included. A week is the
 *   same over its seven days; a year is the mean of its weeks with data, not
 *   of its days.
 * - A day's level is Garmin's, never recomputed from the readings.
 * - The ring splits the measured time — rest, low, medium, high, clockwise
 *   from twelve o'clock. Unmeasurable and active time are not in it.
 */

/** Stress pages through all four ranges, on the shared route. */
export type StressRange = PeriodRange;
export type StressRoute = PeriodRoute;
export type StressPart = "rest" | "low" | "medium" | "high";

export const STRESS_PARTS: readonly StressPart[] = ["rest", "low", "medium", "high"];
export const PART_LABEL: Readonly<Record<StressPart, string>> = { rest: "Rest", low: "Low", medium: "Medium", high: "High" };

/** The timeline's one split: a reading at or below 25 is rest, above it stress. */
export const REST_MAX = 25;

/** Stress truncates every mean. */
const ROUNDING = "floor";

/** What the pages read. */
export interface StressData {
	/** The stress index, oldest first. */
	rows: readonly StressRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
}

export const NO_STRESS: StressData = { rows: [], complete: false };

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

/** Whole minutes as the app writes them: "10h 57m", "59m", and "2h" on the hour. */
export function duration(seconds: number): string {
	const minutes = Math.floor(Math.max(0, seconds) / 60);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
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

function byDate(rows: readonly StressRow[]): Map<string, StressRow> {
	return new Map(rows.map((r) => [r.date, r]));
}

/** Older data exists, or may: the index is still fetching its history. */
function canGoBack(data: StressData, from: string): boolean {
	return canStepBack(data.rows[0]?.date, data.complete, from);
}

/** Each category's share of the measured time, in the ring's order; empty for a day without any. */
export function ringOf(row: Partial<Record<StressPart, number>> | null | undefined): RingPart[] {
	const total = STRESS_PARTS.reduce((sum, part) => sum + (row?.[part] ?? 0), 0);
	if (!(total > 0)) return [];
	return STRESS_PARTS.map((part) => ({ part, fraction: (row?.[part] ?? 0) / total }));
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
	range: SpanRange;
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
	axis: PeriodAxis;
	/** Avg Stress Level, Lowest, Highest: the phone shows the first, the web all three. */
	stats: StressStat[];
	/** 7d and 4w: a card a day, newest first. */
	days: StressDayCard[];
	/** 1y: a card a week with data, newest first. */
	weeks: StressWeekCard[];
}

export function stressPeriodView(input: StressInput): StressPeriodView {
	const range: SpanRange = input.route.range === "1d" ? "7d" : input.route.range;
	return range === "1y" ? yearView(input) : daysView(input, range);
}

function periodStats(values: readonly number[]): StressStat[] {
	const avg = meanOf(values, ROUNDING);
	const has = values.length > 0;
	return [
		{ value: avg !== undefined ? String(avg) : DASH, label: "Avg Stress Level" },
		{ value: has ? String(Math.min(...values)) : DASH, label: "Lowest" },
		{ value: has ? String(Math.max(...values)) : DASH, label: "Highest" },
	];
}

function daysView(input: StressInput, range: "7d" | "4w"): StressPeriodView {
	const { data, route, today } = input;
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = byDate(data.rows);
	const levels = days.map((d) => rows.get(d)?.level);
	return {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		title: "Daily Averages",
		points: days.map((_, i) => ({ x: spread(i, days.length), value: levels[i] ?? null })),
		dots: true,
		axis: dayAxis(days),
		stats: periodStats(levels.filter((v): v is number => v !== undefined)),
		days: [...days].reverse().map((date) => {
			const row = rows.get(date);
			return {
				date,
				weekday: weekdayOf(date),
				detail: cardDate(date, today),
				value: row?.level !== undefined ? String(row.level) : DASH,
				ring: ringOf(row),
				offset: offsetOfDay(date, today),
			};
		}),
		weeks: [],
	};
}

/** A week of the 1y page: its days and the truncated mean of their levels. */
export type StressWeek = PeriodWeek;

/** Fifty-two weeks of seven days ending `end`, oldest first, each the truncated mean of its days with a level. */
export function stressWeeks(rows: readonly StressRow[], end: string): StressWeek[] {
	return weeksOf(rows, end, (r) => r.level, ROUNDING);
}

function yearView(input: StressInput): StressPeriodView {
	const { data, route, today } = input;
	const { from, to } = periodOf("1y", route.offset, today);
	const weeks = stressWeeks(data.rows, to);
	const months = monthAxis(from);
	return {
		range: "1y",
		from,
		to,
		label: yearLabel(from, to),
		canGoBack: canGoBack(data, from),
		canGoForward: route.offset < 0,
		title: "Weekly Averages",
		points: weeks.map((w) => ({ x: months.x(w.from), value: w.value ?? null })),
		dots: false,
		axis: months.axis,
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
				offset: weekOffset(w.to, today),
			})),
	};
}
