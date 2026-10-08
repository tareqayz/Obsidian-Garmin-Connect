import type { RespirationDay, RespirationStatRow } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";

/**
 * Respiration: the day index the Respiration pages' 7d and 4w views read, and
 * the intraday extra their 1d Daily Timeline draws
 * (ref/health-stats/respiration/README.md).
 *
 * The index keeps a row a day: Garmin's awake average for the calendar day
 * and the sleep average of the night that ended that morning, both whole
 * breaths a minute as `stats/respiration/daily` sends them. A routine sync
 * fills the awake value from the daily summary it fetches anyway (equal on
 * 424 of 424 days); the sleep value comes from the range, which `keepOld`
 * keeps when a summary row arrives without one. A day without data has no
 * row in that range, never a null row.
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface RespirationRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The day's awake average, brpm: `avgWakingRespiration`. */
	awake?: number;
	/** The average of the night that ended this day, brpm: `avgSleepRespiration`. Absent on a day without a night. */
	sleep?: number;
}

/** A `stats/respiration/daily` row as an index row; a null sleep value drops out when it is normalized. */
export function rowOfStat(stat: RespirationStatRow | null | undefined): DayRowInput<RespirationRow> {
	return { date: stat?.calendarDate, awake: stat?.avgWakingRespiration, sleep: stat?.avgSleepRespiration };
}

export const RESPIRATION_INDEX = defineDayIndex<RespirationRow>({
	kind: "respiration",
	title: "respiration",
	folder: "respiration",
	version: 1,
	columns: { awake: {}, sleep: {} },
	// The summary carries only the awake value: the night a window wrote stays.
	keepOld: true,
	group: "respiration",
	// The endpoint takes 31 days (32 is HTTP 400).
	windowDays: 31,
	// The longest gap inside the history is five days.
	emptyWindowsToStop: 2,
	// Today's night arrives after waking, so yesterday's and today's rows are fetched again.
	refreshDays: 2,
	fetchWindow: async (api, start, end) => (await api.respirationDaily(start, end)).map(rowOfStat),
	fromSummary: (summary) => ({ awake: (summary as Record<string, unknown>).avgWakingRespirationValue as number | null | undefined }),
});

/* ------------------------------------------------------------------ */
/*  The day's hourly rows                                              */
/* ------------------------------------------------------------------ */

/**
 * An hourly row as Garmin sent it, end-stamped: `[epoch ms, average, high,
 * low]`. An average of −1 (unmeasurable) or −2 (no reading) comes with a null
 * high and low; both codes are kept, and neither is drawn.
 */
export type RespirationHour = [time: number, avg: number, high: number | null, low: number | null];

/**
 * What the 1d page needs of a day's `daily/respiration`, kept by
 * `RESPIRATION_DAY`: the day's bounds, its hourly rows (not the two-minute
 * values, which the page never draws), its sleep windows and Garmin's figures.
 */
export interface RespirationDayData {
	/** The day's start on the watch's clock, epoch ms. */
	start: number;
	/** Its end as sent: the next midnight for a day that is over, the last sync for today. */
	end: number;
	/** Local minus UTC, ms, as the day began and ended. Today has no end offset. */
	startOffset?: number;
	endOffset?: number;
	hours: RespirationHour[];
	/** The night that ended this day, epoch ms (the GMT fields). */
	sleepStart?: number;
	sleepEnd?: number;
	/** The night that starts this evening. */
	nextSleepStart?: number;
	nextSleepEnd?: number;
	/** The lowest hourly low and highest hourly high, sleep included: the page's Lowest and Highest. */
	lowest?: number;
	highest?: number;
	/** The awake average. */
	awake?: number;
}

export const RESPIRATION_DAY_KEY = "respirationDay";

const HOUR_MS = 3_600_000;
const MAX_OFFSET_MS = 14 * HOUR_MS;
const QUARTER_HOUR_MS = 900_000;

function finite(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

/** Whole brpm, or undefined for null or a negative code. */
function brpm(value: unknown): number | undefined {
	return finite(value) && value >= 0 ? Math.round(value) : undefined;
}

function offsetOf(local: unknown, gmt: number | undefined): number | undefined {
	const at = epochOf(local);
	if (at === undefined || gmt === undefined) return undefined;
	const offset = at - gmt;
	return Math.abs(offset) <= MAX_OFFSET_MS && offset % QUARTER_HOUR_MS === 0 ? offset : undefined;
}

function hoursOf(rows: unknown): RespirationHour[] {
	const out: RespirationHour[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!Array.isArray(row) || !finite(row[0]) || !finite(row[1])) continue;
		const avg = Math.round(row[1] * 100) / 100;
		const measured = avg >= 0;
		out.push([row[0], avg, measured ? (brpm(row[2]) ?? null) : null, measured ? (brpm(row[3]) ?? null) : null]);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

/** The day's rows and figures, or null when Garmin had nothing: no bounds and no figures (2026-01-06). */
export function respirationDayOf(payload: RespirationDay | null | undefined): RespirationDayData | null {
	if (!payload || typeof payload !== "object") return null;
	const start = epochOf(payload.startTimestampGMT);
	const endGmt = epochOf(payload.endTimestampGMT);
	if (start === undefined) return null;
	const day: RespirationDayData = { start, end: endGmt !== undefined && endGmt > start ? endGmt : start + 24 * HOUR_MS, hours: hoursOf(payload.respirationAveragesValuesArray) };
	const startOffset = offsetOf(payload.startTimestampLocal, start);
	const endOffset = offsetOf(payload.endTimestampLocal, endGmt);
	if (startOffset !== undefined) day.startOffset = startOffset;
	if (endOffset !== undefined) day.endOffset = endOffset;
	const times = {
		sleepStart: payload.sleepStartTimestampGMT,
		sleepEnd: payload.sleepEndTimestampGMT,
		nextSleepStart: payload.tomorrowSleepStartTimestampGMT,
		nextSleepEnd: payload.tomorrowSleepEndTimestampGMT,
	};
	for (const [key, value] of Object.entries(times) as Array<[keyof typeof times, unknown]>) {
		const at = epochOf(value);
		if (at !== undefined) day[key] = at;
	}
	const figures = { lowest: brpm(payload.lowestRespirationValue), highest: brpm(payload.highestRespirationValue), awake: brpm(payload.avgWakingRespirationValue) };
	for (const [key, value] of Object.entries(figures) as Array<[keyof typeof figures, number | undefined]>) {
		if (value !== undefined) day[key] = value;
	}
	return day;
}

/** The day's rows as its series file keeps them, or null when it has none or a block it cannot read. */
export function respirationDayIn(series: DaySeries | null | undefined): RespirationDayData | null {
	const raw = series?.extra?.[RESPIRATION_DAY_KEY] as Partial<Record<keyof RespirationDayData, unknown>> | undefined;
	if (!raw || typeof raw !== "object" || !finite(raw.start) || !finite(raw.end) || raw.end <= raw.start) return null;
	const day: RespirationDayData = { start: raw.start, end: raw.end, hours: hoursOf(raw.hours) };
	for (const key of ["startOffset", "endOffset", "sleepStart", "sleepEnd", "nextSleepStart", "nextSleepEnd"] as const) {
		if (finite(raw[key])) day[key] = raw[key];
	}
	for (const key of ["lowest", "highest", "awake"] as const) {
		const value = brpm(raw[key]);
		if (value !== undefined) day[key] = value;
	}
	return day;
}

/** The 1d page's payload, fetched on view: `loadIntraday(date, [RESPIRATION_DAY.key])`. */
export const RESPIRATION_DAY = defineIntraday<RespirationDay | null, RespirationDayData>({
	key: RESPIRATION_DAY_KEY,
	group: "respiration",
	fetch: (api, date) => api.respiration(date),
	map: (payload) => respirationDayOf(payload),
});
