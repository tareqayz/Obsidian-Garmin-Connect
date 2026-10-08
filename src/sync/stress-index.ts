import type { DailyStatRow, DailyStress, DailySummary, ValueDescriptor } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";

/**
 * Stress: the day index the Stress pages' 7d, 4w and 1y views read, and the
 * intraday extra their 1d timeline draws (ref/health-stats/stress/README.md).
 *
 * The index keeps a row a day. A routine sync fills the run's own days from
 * the daily summary it fetches anyway, which is also the only source of the
 * day's qualifier; the history comes from `stats/stress/daily`, 28 days a
 * request. Garmin leaves a day without data out in two ways: a row whose
 * level is −1 with every duration null (the watch synced but measured
 * nothing), or no row at all. Both end the same way in the index: no row for
 * the day, since a −1 level and null durations drop out when the row is
 * normalized and a day a fetch asked about without a row loses the one it had.
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface StressRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The day's stress level, 0 to 100, as Garmin sends it: the server's figure, never the readings' mean. */
	level?: number;
	/** Seconds at rest (0–25), low (26–50), medium (51–75) and high stress (76–100). Absent for a category with no time. */
	rest?: number;
	low?: number;
	medium?: number;
	high?: number;
	/** The daily summary's `stressQualifier`: CALM, BALANCED, STRESSFUL, UNKNOWN… A history window has none. */
	qualifier?: string;
}

/** A `stats/stress/daily` row as an index row. A −1 level and null durations drop out when it is normalized. */
export function rowOfStat(stat: DailyStatRow | null | undefined): DayRowInput<StressRow> {
	const values = (stat?.values ?? {}) as Record<string, unknown>;
	return {
		date: stat?.calendarDate,
		level: values.overallStressLevel,
		rest: values.restStressDuration,
		low: values.lowStressDuration,
		medium: values.mediumStressDuration,
		high: values.highStressDuration,
	};
}

/**
 * A day's row from its daily summary, or null on a day the watch measured
 * nothing: a −1 level and no durations. Its UNKNOWN qualifier alone is not a
 * day with data, so the day goes as a −1 history row does.
 */
export function rowOfSummary(summary: DailySummary): DayRowInput<StressRow> | null {
	const measures = {
		level: summary.averageStressLevel,
		rest: summary.restStressDuration,
		low: summary.lowStressDuration,
		medium: summary.mediumStressDuration,
		high: summary.highStressDuration,
	};
	if (!Object.values(measures).some(isMeasured)) return null;
	return { ...measures, qualifier: summary.stressQualifier };
}

function isMeasured(value: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export const STRESS_INDEX = defineDayIndex<StressRow>({
	kind: "stress",
	title: "stress",
	folder: "stress",
	version: 1,
	columns: { level: {}, rest: {}, low: {}, medium: {}, high: {}, qualifier: { text: true } },
	// A history window carries no qualifier: the one the day's summary gave stays.
	keepOld: true,
	group: "stress",
	windowDays: 28,
	// The longest gap inside an account's history was five days, so two empty
	// windows in a row mean the history has not started yet.
	emptyWindowsToStop: 2,
	fetchWindow: async (api, start, end) => (await api.stressDaily(start, end)).map(rowOfStat),
	fromSummary: (summary) => rowOfSummary(summary),
});

/* ------------------------------------------------------------------ */
/*  The day's readings                                                 */
/* ------------------------------------------------------------------ */

/**
 * What the 1d timelines need of a day's `dailyStress`, kept by `STRESS_DAY`:
 * its bounds, every stress reading with Garmin's two "not measured" codes
 * kept apart, and the Body Battery curve the same payload carries, with the
 * status of every reading. The series file's own blocks turn both stress
 * codes into null and drop the battery's status, so the Stress page could not
 * tell activity from time off the wrist, nor the Body Battery page draw what
 * was estimated.
 *
 * Readings come every three minutes from the watch's midnight, the battery's
 * one for one with the stress readings, so both are kept as lists a step
 * apart: a day is about 480 small numbers each. The battery's status is
 * MEASURED nearly all day, so only the stretches that are not are kept.
 */
export interface StressDay {
	/** The day's start on the watch's clock, epoch ms: its midnight. */
	start: number;
	/** Its end, epoch ms: the next midnight, or for a day still going the newest reading. */
	end: number;
	/** The watch's local time minus UTC, ms, as the day began and as it ended: they differ on a day the clocks changed. */
	startOffset?: number;
	endOffset?: number;
	/** Milliseconds between readings: three minutes. */
	step: number;
	/** A stress reading a step from `start`: a level from 0 to 100, −1 unmeasurable, −2 too active to measure, null none. Empty on a day with only Body Battery. */
	levels: Array<number | null>;
	/** Body Battery a step from `start`, 0 to 100, null where there is no reading. Absent on a day without the curve. */
	battery?: Array<number | null>;
	/** The battery's stretches whose status is not MEASURED: `[status, first step, steps]`. */
	batteryRuns?: Array<[string, number, number]>;
}

/** A day's Body Battery curve, as the Body Battery page reads it out of `STRESS_DAY`'s block. */
export interface BatteryDay {
	start: number;
	end: number;
	startOffset?: number;
	endOffset?: number;
	step: number;
	/** Body Battery a step from `start`, 0 to 100, null where there is no reading. */
	levels: Array<number | null>;
	/**
	 * The stretches whose status is not MEASURED, by step, `to` exclusive:
	 * MODELED (the web's "Estimated"), and ADJUSTED and RESET round a day the
	 * clocks changed.
	 */
	runs: Array<{ status: string; from: number; to: number }>;
}

/** The key the day's readings are kept under, in the series file's `extra`. */
export const STRESS_DAY_KEY = "stressDay";

/** Three minutes: the step every payload seen so far used. */
const READING_MS = 180_000;
/** No day runs longer than 25 hours; a reading far past that is not this day's. */
const MAX_DAY_MS = 26 * 3_600_000;
/** The battery status nearly every reading has, which is not kept. */
const MEASURED = "MEASURED";

type Reading = [time: number, value: number | null, status?: string];

/**
 * The day's readings, or null when Garmin had none at all: a day the watch
 * never synced, or one from before the account's watch sent intraday data.
 */
export function stressDayOf(payload: DailyStress | null | undefined): StressDay | null {
	if (!payload || typeof payload !== "object") return null;
	const stressColumns = payload.stressValueDescriptorsDTOList;
	const stress = readingsOf(payload.stressValuesArray, columnOf(stressColumns, "timestamp", 0), columnOf(stressColumns, "stressLevel", 1));
	const batteryColumns = payload.bodyBatteryValueDescriptorsDTOList;
	const battery = readingsOf(
		payload.bodyBatteryValuesArray,
		columnOf(batteryColumns, "timestamp", 0),
		columnOf(batteryColumns, "bodyBatteryLevel", 2),
		columnOf(batteryColumns, "bodyBatteryStatus", 1),
	);
	const scored = stress.filter((r) => r[1] !== null);
	const charted = battery.filter((r) => r[1] !== null);
	if (!scored.length && !charted.length) return null;

	const step = commonGap((scored.length ? scored : charted).map(([t]) => t)) ?? READING_MS;
	const first = Math.min(scored[0]?.[0] ?? Infinity, charted[0]?.[0] ?? Infinity);
	const last = Math.max(scored[scored.length - 1]?.[0] ?? -Infinity, charted[charted.length - 1]?.[0] ?? -Infinity);
	const startGmt = epochOf(payload.startTimestampGMT);
	const endGmt = epochOf(payload.endTimestampGMT);
	const start = startGmt ?? first;
	const end = endGmt !== undefined && endGmt > start ? endGmt : last + step;
	const slots = Math.ceil(Math.min(MAX_DAY_MS, Math.max(end, last + step) - start) / step);
	const slotOf = (t: number) => {
		const i = Math.round((t - start) / step);
		return i >= 0 && i < slots ? i : -1;
	};

	const day: StressDay = { start, end, step, levels: onGrid(scored, slotOf) };
	if (charted.length) {
		day.battery = onGrid(charted, slotOf);
		const runs = statusRuns(battery, slotOf);
		if (runs.length) day.batteryRuns = runs;
	}
	if (!day.levels.some((v) => v !== null) && !day.battery?.some((v) => v !== null)) return null;
	const startOffset = offsetOf(payload.startTimestampLocal, startGmt);
	const endOffset = offsetOf(payload.endTimestampLocal, endGmt);
	if (startOffset !== undefined) day.startOffset = startOffset;
	if (endOffset !== undefined) day.endOffset = endOffset;
	return day;
}

/** A payload's rows as `[time, value, status]`, oldest first; a row without a time is dropped, a value that is not a number is null. */
function readingsOf(rows: unknown, timeAt: number, valueAt: number, statusAt?: number): Reading[] {
	const out: Reading[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!Array.isArray(row)) continue;
		const t = row[timeAt];
		if (typeof t !== "number" || !Number.isFinite(t)) continue;
		const v = row[valueAt];
		const reading: Reading = [t, typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null];
		if (statusAt !== undefined && typeof row[statusAt] === "string" && row[statusAt].trim()) reading[2] = row[statusAt].trim().toUpperCase();
		out.push(reading);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

/** Values on the day's steps, null where a step has none. */
function onGrid(readings: readonly Reading[], slotOf: (t: number) => number): Array<number | null> {
	const out: Array<number | null> = [];
	for (const [t, v] of readings) {
		const i = slotOf(t);
		if (i < 0 || v === null) continue;
		while (out.length < i) out.push(null);
		out[i] = v;
	}
	return out;
}

/** The stretches of readings whose status is not MEASURED, by step. */
function statusRuns(readings: readonly Reading[], slotOf: (t: number) => number): Array<[string, number, number]> {
	const runs: Array<[string, number, number]> = [];
	for (const [t, , status] of readings) {
		const i = slotOf(t);
		if (i < 0 || !status || status === MEASURED) continue;
		const run = runs[runs.length - 1];
		if (run && run[0] === status && run[1] + run[2] === i) run[2] += 1;
		else runs.push([status, i, 1]);
	}
	return runs;
}

/** The day's readings as its series file keeps them, or null when the file has none, or a block it cannot read. */
export function stressDayIn(series: DaySeries | null | undefined): StressDay | null {
	const raw = series?.extra?.[STRESS_DAY_KEY] as Partial<Record<keyof StressDay, unknown>> | undefined;
	if (!raw || typeof raw !== "object") return null;
	if (!finiteNumber(raw.start) || !finiteNumber(raw.end) || !finiteNumber(raw.step) || raw.step <= 0 || raw.end <= raw.start) return null;
	if (!Array.isArray(raw.levels)) return null;
	const day: StressDay = { start: raw.start, end: raw.end, step: raw.step, levels: raw.levels.map(orNull) };
	if (finiteNumber(raw.startOffset)) day.startOffset = raw.startOffset;
	if (finiteNumber(raw.endOffset)) day.endOffset = raw.endOffset;
	if (Array.isArray(raw.battery)) day.battery = raw.battery.map(orNull);
	if (Array.isArray(raw.batteryRuns)) {
		const runs = raw.batteryRuns.filter(
			(r): r is [string, number, number] =>
				Array.isArray(r) && typeof r[0] === "string" && Number.isInteger(r[1]) && r[1] >= 0 && Number.isInteger(r[2]) && r[2] > 0,
		);
		if (runs.length) day.batteryRuns = runs.map(([status, from, steps]) => [status, from, steps]);
	}
	return day;
}

/** The day's Body Battery curve out of `STRESS_DAY`'s block, or null when the day has none. */
export function batteryDayIn(series: DaySeries | null | undefined): BatteryDay | null {
	const day = stressDayIn(series);
	if (!day?.battery || !day.battery.some((v) => v !== null)) return null;
	const battery: BatteryDay = {
		start: day.start,
		end: day.end,
		step: day.step,
		levels: day.battery,
		runs: (day.batteryRuns ?? []).map(([status, from, steps]) => ({ status, from, to: from + steps })),
	};
	if (day.startOffset !== undefined) battery.startOffset = day.startOffset;
	if (day.endOffset !== undefined) battery.endOffset = day.endOffset;
	return battery;
}

function finiteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function orNull(value: unknown): number | null {
	return finiteNumber(value) ? value : null;
}

/**
 * The 1d timelines' payload, fetched on view: `loadIntraday(date, [STRESS_DAY.key])`
 * serves the Stress page and the Body Battery page. One request a day, under
 * the stats' own group, whatever the series file already holds.
 */
export const STRESS_DAY = defineIntraday<DailyStress | null, StressDay>({
	key: STRESS_DAY_KEY,
	group: "stress",
	fetch: (api, date) => api.stress(date),
	map: (payload) => stressDayOf(payload),
});

/**
 * Where a named column sits, per Garmin's descriptor list, or the known
 * default. Stress's descriptors say `key` and `index`; Body Battery's say
 * `bodyBatteryValueDescriptorKey` and `bodyBatteryValueDescriptorIndex`.
 */
function columnOf(descriptors: ValueDescriptor[] | null | undefined, key: string, fallback: number): number {
	for (const d of Array.isArray(descriptors) ? descriptors : []) {
		const name = d?.key ?? d?.bodyBatteryValueDescriptorKey;
		const index = d?.index ?? d?.bodyBatteryValueDescriptorIndex;
		if (name === key && typeof index === "number") return index;
	}
	return fallback;
}

/** The most common gap between readings, the smaller on a tie. */
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

/** Local minus UTC, ms, from a zone-less local timestamp and the same moment in GMT. */
function offsetOf(local: unknown, gmt: number | undefined): number | undefined {
	const at = epochOf(local);
	return at !== undefined && gmt !== undefined ? at - gmt : undefined;
}
