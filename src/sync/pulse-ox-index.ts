import type { AcclimationStats, Spo2Acclimation } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import { isFiniteNumber } from "./numbers";

/**
 * Pulse Ox: the day index the Pulse Ox and Pulse Ox Acclimation pages read,
 * and the intraday extra the Pulse Ox 1d draws
 * (ref/health-stats/pulse-ox/README.md, ../pulse-ox-acclimation/README.md).
 *
 * A row a day with readings: Garmin's daily average (`acclimationDaily`'s
 * `spo2DailyAverageArray`, equal to the summary's `averageSpo2`), and from a
 * routine sync's summary the lowest and latest. `acclimationDaily` has no
 * cap, so one request holds the whole history. `elev` is the day's mean
 * elevation in metres from the same payload's six-minute series, which
 * Garmin sends only from 2026-06-01 on; it is grouped by UTC day, the
 * payload carrying no offsets (Inferred, for Acclimation's elevation area).
 *
 * Pure: no Obsidian import.
 */

export interface PulseOxRow {
	date: string;
	/** The day's average SpO₂, whole %. */
	avg?: number;
	/** The day's lowest single reading, %. */
	low?: number;
	/** The day's last reading, %. */
	latest?: number;
	/** The day's mean elevation, m. */
	elev?: number;
}

/** The rows of an `acclimationDaily` payload. */
export function rowsOfAcclimation(payload: AcclimationStats | null | undefined): Array<DayRowInput<PulseOxRow>> {
	const rows = new Map<string, DayRowInput<PulseOxRow>>();
	for (const pair of payload?.spo2DailyAverageArray ?? []) {
		if (!Array.isArray(pair) || typeof pair[0] !== "string") continue;
		rows.set(pair[0], { date: pair[0], avg: pair[1] });
	}
	const sums = new Map<string, { sum: number; n: number }>();
	for (const sample of payload?.monitoringEnvironmentValuesArray ?? []) {
		if (!Array.isArray(sample) || !isFiniteNumber(sample[0]) || !isFiniteNumber(sample[1])) continue;
		const day = new Date(sample[0]).toISOString().slice(0, 10);
		const acc = sums.get(day) ?? { sum: 0, n: 0 };
		acc.sum += sample[1];
		acc.n += 1;
		sums.set(day, acc);
	}
	for (const [day, { sum, n }] of sums) rows.set(day, { ...(rows.get(day) ?? { date: day }), elev: sum / n });
	return [...rows.values()];
}

export const PULSE_OX_INDEX = defineDayIndex<PulseOxRow>({
	kind: "pulse-ox",
	title: "pulse ox",
	folder: "pulse-ox",
	version: 1,
	columns: { avg: {}, low: {}, latest: {}, elev: { signed: true } },
	// The range has the average and elevation, the summary the lowest and latest.
	keepOld: true,
	group: "spo2",
	// `acclimationDaily` has no cap: the whole history in one request.
	windowDays: 3660,
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfAcclimation(await api.acclimationDaily(start, end)),
	fromSummary: (summary) => {
		const s = summary as Record<string, unknown>;
		return { avg: s.averageSpo2, low: s.lowestSpo2, latest: s.latestSpo2 };
	},
});

/* ------------------------------------------------------------------ */
/*  The day's hourly averages                                          */
/* ------------------------------------------------------------------ */

/** An hour as Garmin sent it: `[GMT ms at the hour's start, % or null]`. */
export type Spo2Hour = [time: number, value: number | null];

/** What the Pulse Ox 1d keeps of `spo2acclimation/{date}`. */
export interface Spo2DayData {
	/** The window, GMT epoch ms: local midnight to the next (or the last sync, today). */
	start: number;
	end: number;
	hours: Spo2Hour[];
	avg?: number;
	low?: number;
	latest?: number;
	/** "HH:MM", the latest reading's local wall clock. */
	latestTime?: string;
	/** `lastSevenDaysAvgSpO2`, unrounded. */
	avg7?: number;
	/** The night that ended this day. */
	sleepAvg?: number;
}

export const SPO2_DAY_KEY = "spo2Day";

const HOUR_MS = 3_600_000;

function hoursOf(rows: unknown): Spo2Hour[] {
	const out: Spo2Hour[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!Array.isArray(row) || !isFiniteNumber(row[0])) continue;
		out.push([row[0], isFiniteNumber(row[1]) && row[1] > 0 ? Math.round(row[1]) : null]);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

function clockOf(local: unknown): string | undefined {
	const at = epochOf(local);
	if (at === undefined) return undefined;
	return new Date(at).toISOString().slice(11, 16);
}

/** The day's window and figures, or null before the history (every field null). */
export function spo2DayOf(payload: Spo2Acclimation | null | undefined): Spo2DayData | null {
	if (!payload || typeof payload !== "object") return null;
	const start = epochOf(payload.startTimestampGMT);
	if (start === undefined) return null;
	const endGmt = epochOf(payload.endTimestampGMT);
	const day: Spo2DayData = { start, end: endGmt !== undefined && endGmt > start ? endGmt : start + 24 * HOUR_MS, hours: hoursOf(payload.spO2HourlyAverages) };
	const figures: Array<[keyof Spo2DayData, unknown]> = [
		["avg", payload.averageSpO2],
		["low", payload.lowestSpO2],
		["latest", payload.latestSpO2],
		["avg7", payload.lastSevenDaysAvgSpO2],
		["sleepAvg", payload.avgSleepSpO2],
	];
	for (const [key, value] of figures) if (isFiniteNumber(value) && value > 0) (day as unknown as Record<string, number>)[key] = value;
	const time = clockOf(payload.latestSpO2TimestampLocal);
	if (time && day.latest !== undefined) day.latestTime = time;
	return day;
}

/** The day's block as the series file keeps it, or null. */
export function spo2DayIn(series: DaySeries | null | undefined): Spo2DayData | null {
	const raw = series?.extra?.[SPO2_DAY_KEY] as Partial<Record<keyof Spo2DayData, unknown>> | undefined;
	if (!raw || typeof raw !== "object" || !isFiniteNumber(raw.start) || !isFiniteNumber(raw.end) || raw.end <= raw.start) return null;
	const day: Spo2DayData = { start: raw.start, end: raw.end, hours: hoursOf(raw.hours) };
	for (const key of ["avg", "low", "latest", "avg7", "sleepAvg"] as const) if (isFiniteNumber(raw[key])) day[key] = raw[key];
	if (typeof raw.latestTime === "string") day.latestTime = raw.latestTime;
	return day;
}

/** The Pulse Ox 1d's payload, fetched on view: `loadIntraday(date, [SPO2_DAY.key])`. */
export const SPO2_DAY = defineIntraday<Spo2Acclimation | null, Spo2DayData>({
	key: SPO2_DAY_KEY,
	group: "spo2",
	fetch: (api, date) => api.spo2Acclimation(date),
	map: (payload) => spo2DayOf(payload),
});
