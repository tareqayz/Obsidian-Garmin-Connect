import type { DailyStatRow, DailySummary, HeartRateData, ValueDescriptor } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import { isFiniteNumber } from "./numbers";

/**
 * Heart Rate: the day index the Heart Rate pages' 7d, 4w and 1y views read,
 * and the intraday extra their 1d timeline draws
 * (ref/health-stats/heart-rate/README.md).
 *
 * The index keeps a row a day: Garmin's resting heart rate, the day's highest
 * and lowest two-minute averages, and its stored seven-day average of resting
 * heart rate. A routine sync fills the run's own days from the daily summary
 * it fetches anyway, which is also the only source of the seven-day average;
 * the history comes from `stats/heartRate/daily`, 28 days a request. A day
 * without data has no row at all in that range, never a −1 row as in Stress,
 * so it simply has none in the index.
 *
 * The page's High and low are the two-minute extremes (`maxAvgHeartRate`,
 * `wellnessMaxAvgHR`), never the raw extremes the daily note keeps as
 * `max_hr` / `min_hr`: those differ on most days (Oct 7: 114 raw, High 108).
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface HeartRateRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** Garmin's resting heart rate, bpm. Absent on a day it has none although the day has heart rate (2026-01-21, 06-18). */
	resting?: number;
	/** The day's highest two-minute average, bpm: the page's High. */
	high?: number;
	/** The day's lowest two-minute average, bpm. */
	low?: number;
	/** Garmin's stored seven-day average of resting heart rate, as sent, never recomputed. Only the daily summary carries it, so a history day has none. */
	avg7?: number;
}

/** A `stats/heartRate/daily` row as an index row. A null resting value drops out when it is normalized. */
export function rowOfStat(stat: DailyStatRow | null | undefined): DayRowInput<HeartRateRow> {
	const values = (stat?.values ?? {}) as Record<string, unknown>;
	return {
		date: stat?.calendarDate,
		resting: values.restingHR,
		high: values.wellnessMaxAvgHR,
		low: values.wellnessMinAvgHR,
	};
}

/**
 * A day's row from its daily summary. The two-minute extremes, never
 * `maxHeartRate` / `minHeartRate`, which are the raw ones. A day the summary
 * has nothing for normalizes to no row, so the day goes as a day a window
 * found empty does.
 */
export function rowOfSummary(summary: DailySummary): DayRowInput<HeartRateRow> {
	return {
		resting: summary.restingHeartRate,
		high: summary.maxAvgHeartRate,
		low: summary.minAvgHeartRate,
		avg7: summary.lastSevenDaysAvgRestingHeartRate,
	};
}

export const HEART_RATE_INDEX = defineDayIndex<HeartRateRow>({
	kind: "heart-rate",
	title: "heart rate",
	folder: "heart-rate",
	version: 1,
	columns: { resting: {}, high: {}, low: {}, avg7: {} },
	// A history window carries no seven-day average: the one the day's summary
	// gave stays. The price: a resting value Garmin later withdrew would stay
	// too, which no capture has shown.
	keepOld: true,
	group: "heart",
	windowDays: 28,
	// The longest gap inside the account's history is five days, so two empty
	// windows in a row mean the history has not started yet.
	emptyWindowsToStop: 2,
	fetchWindow: async (api, start, end) => (await api.heartRateDaily(start, end)).map(rowOfStat),
	fromSummary: (summary) => rowOfSummary(summary),
});

/* ------------------------------------------------------------------ */
/*  The day's samples                                                  */
/* ------------------------------------------------------------------ */

/**
 * What the 1d timeline needs of a day's `dailyHeartRate`, kept by
 * `HEART_DAY`: the day's bounds, every two-minute sample on a grid a step
 * apart, and Garmin's figures for the day. The series file's own `heartRate`
 * block keeps the samples as `[ms, bpm]` pairs for the newest days a sync
 * writes, and neither the day's end nor its figures, so a history day's page
 * could not draw its axis or show its seven-day average.
 *
 * A sample comes every two minutes from the watch's midnight: a 24-hour day
 * is 720 small numbers, about two kilobytes. Before 2026-06-01 Garmin has no
 * samples for this account, but still sends the resting value and the
 * seven-day average, so such a day keeps its figures and an empty grid.
 */
export interface HeartDay {
	/** The day's start on the watch's clock, epoch ms: its midnight. */
	start: number;
	/**
	 * Its end as Garmin sent it, epoch ms: the next midnight for a day that is
	 * over, which runs 23 or 25 hours on a day the clocks changed and 35 on a
	 * day the watch flew west (2025-10-31); for today, the watch's last sync.
	 */
	end: number;
	/**
	 * The watch's local time minus UTC, ms, as the day began and as it ended.
	 * They differ on a day the clocks changed. Today has no end offset: its end
	 * is a sync, not a midnight.
	 */
	startOffset?: number;
	endOffset?: number;
	/** Milliseconds between samples: two minutes. */
	step: number;
	/** A two-minute average a step from `start`, bpm, null where there is none. Empty on a day without samples. */
	values: Array<number | null>;
	/**
	 * Garmin's resting value as dailyHeartRate sends it. On a day Garmin has
	 * none it is the day's raw minimum instead (44 on 2026-01-21, 43 on
	 * 06-18, where the summary and the stats rows are null), so a page takes
	 * the index's first.
	 */
	resting?: number;
	/** The stored seven-day average, as sent: null on a day without a resting value. */
	avg7?: number;
	/** The day's highest and lowest two-minute averages: `maxHeartRate` / `minHeartRate` here, the stats rows' High and low. Absent on a day without samples. */
	high?: number;
	low?: number;
}

/** The key the day's samples are kept under, in the series file's `extra`. */
export const HEART_DAY_KEY = "heartDay";

/** Two minutes: the step every payload seen so far used. */
const SAMPLE_MS = 120_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** The longest a day can run, from UTC+14 to UTC−12; a sample far past it is not this day's. */
const MAX_DAY_MS = 50 * HOUR_MS;
/** Clock offsets run from UTC−12 to UTC+14, in quarter hours. */
const MAX_OFFSET_MS = 14 * HOUR_MS;
const QUARTER_HOUR_MS = 900_000;

type Sample = [time: number, bpm: number | null];

/**
 * The day's samples and figures, or null when Garmin had nothing at all: a
 * day the watch never synced (2026-01-06, every field null) or one with
 * bounds and nothing else (2026-08-18).
 */
export function heartDayOf(payload: HeartRateData | null | undefined): HeartDay | null {
	if (!payload || typeof payload !== "object") return null;
	const columns = payload.heartRateValueDescriptors as ValueDescriptor[] | null | undefined;
	const samples = samplesOf(payload.heartRateValues, columnOf(columns, "timestamp", 0), columnOf(columns, "heartrate", 1));
	const measured = samples.filter((s) => s[1] !== null);
	const figures = {
		resting: bpm(payload.restingHeartRate),
		avg7: bpm(payload.lastSevenDaysAvgRestingHeartRate),
		high: bpm(payload.maxHeartRate),
		low: bpm(payload.minHeartRate),
	};
	if (!measured.length && Object.values(figures).every((v) => v === undefined)) return null;

	const startGmt = epochOf(payload.startTimestampGMT);
	const endGmt = epochOf(payload.endTimestampGMT);
	const first = measured[0]?.[0];
	const last = measured[measured.length - 1]?.[0];
	const start = startGmt ?? first;
	if (start === undefined) return null;
	// A null sample still has its time, which tells the cadence too.
	const step = commonGap(samples.map(([t]) => t)) ?? SAMPLE_MS;
	const end = endGmt !== undefined && endGmt > start ? endGmt : last !== undefined && last >= start ? last + step : start + DAY_MS;

	const slots = Math.ceil(Math.min(MAX_DAY_MS, Math.max(end, last !== undefined ? last + step : end) - start) / step);
	const values: Array<number | null> = [];
	for (const [t, v] of measured) {
		const i = Math.round((t - start) / step);
		if (i < 0 || i >= slots) continue;
		while (values.length < i) values.push(null);
		values[i] = v;
	}

	const day: HeartDay = { start, end, step, values };
	const startOffset = offsetOf(payload.startTimestampLocal, startGmt);
	const endOffset = offsetOf(payload.endTimestampLocal, endGmt);
	if (startOffset !== undefined) day.startOffset = startOffset;
	if (endOffset !== undefined) day.endOffset = endOffset;
	for (const key of ["resting", "avg7", "high", "low"] as const) {
		const value = figures[key];
		if (value !== undefined) day[key] = value;
	}
	return day;
}

/** The day's samples as its series file keeps them, or null when the file has none, or a block it cannot read. */
export function heartDayIn(series: DaySeries | null | undefined): HeartDay | null {
	const raw = series?.extra?.[HEART_DAY_KEY] as Partial<Record<keyof HeartDay, unknown>> | undefined;
	if (!raw || typeof raw !== "object") return null;
	if (!isFiniteNumber(raw.start) || !isFiniteNumber(raw.end) || !isFiniteNumber(raw.step) || raw.step <= 0 || raw.end <= raw.start) return null;
	if (!Array.isArray(raw.values)) return null;
	const day: HeartDay = { start: raw.start, end: raw.end, step: raw.step, values: raw.values.map((v) => bpm(v) ?? null) };
	if (isFiniteNumber(raw.startOffset)) day.startOffset = raw.startOffset;
	if (isFiniteNumber(raw.endOffset)) day.endOffset = raw.endOffset;
	for (const key of ["resting", "avg7", "high", "low"] as const) {
		const value = bpm(raw[key]);
		if (value !== undefined) day[key] = value;
	}
	return day;
}

/**
 * The 1d timeline's payload, fetched on view: `loadIntraday(date,
 * [HEART_DAY.key])`. One request a day under the stat's own group, whatever
 * the series file already holds; it carries the samples, so the page needs
 * no other key.
 */
export const HEART_DAY = defineIntraday<HeartRateData | null, HeartDay>({
	key: HEART_DAY_KEY,
	group: "heart",
	fetch: (api, date) => api.heartRate(date),
	map: (payload) => heartDayOf(payload),
});

/* ------------------------------------------------------------------ */

/** A payload's rows as `[time, bpm]`, oldest first; a row without a time is dropped, a value that is not a reading is null. */
function samplesOf(rows: unknown, timeAt: number, valueAt: number): Sample[] {
	const out: Sample[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!Array.isArray(row)) continue;
		const t = row[timeAt];
		if (!isFiniteNumber(t)) continue;
		out.push([t, bpm(row[valueAt]) ?? null]);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

/** Whole bpm, or undefined for null, a non-number, or Garmin's negative "not measured". */
function bpm(value: unknown): number | undefined {
	return isFiniteNumber(value) && value >= 0 ? Math.round(value) : undefined;
}

/** Where a named column sits, per Garmin's descriptor list, or the known default. */
function columnOf(descriptors: ValueDescriptor[] | null | undefined, key: string, fallback: number): number {
	for (const d of Array.isArray(descriptors) ? descriptors : []) {
		if (d?.key === key && typeof d.index === "number") return d.index;
	}
	return fallback;
}

/** The most common gap between samples, the smaller on a tie. */
function commonGap(times: readonly number[]): number | undefined {
	const counts = new Map<number, number>();
	for (let i = 1; i < times.length; i++) {
		const gap = times[i]! - times[i - 1]!;
		if (gap > 0) counts.set(gap, (counts.get(gap) ?? 0) + 1);
	}
	let best: number | undefined;
	let most = 0;
	for (const [gap, count] of counts) {
		if (count > most || (count === most && best !== undefined && gap < best)) {
			best = gap;
			most = count;
		}
	}
	return best;
}

/**
 * Local minus UTC, ms, from a zone-less local timestamp and the same moment
 * in GMT, or undefined when the two are not the same moment. Today's local
 * end is its next midnight while its GMT end is the last sync, which makes
 * no clock offset.
 */
function offsetOf(local: unknown, gmt: number | undefined): number | undefined {
	const at = epochOf(local);
	if (at === undefined || gmt === undefined) return undefined;
	const offset = at - gmt;
	return Math.abs(offset) <= MAX_OFFSET_MS && offset % QUARTER_HOUR_MS === 0 ? offset : undefined;
}
