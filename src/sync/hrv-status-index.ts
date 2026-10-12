import type { HrvSummary } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import type { HrvData } from "./metrics";
import { isFiniteNumber } from "./numbers";

/**
 * HRV Status: the day index every number on the page reads, and the intraday
 * extra its 1d Nightly Timeline draws (ref/performance-stats/hrv-status/README.md).
 *
 * One range route feeds the index: `hrv-service/hrv/daily/{start}/{end}`
 * (`GarminApi.hrvDaily`), a row a night with the 7-day average, the
 * overnight average, the highest five-minute value, the baseline, Garmin's
 * own dial position (`markerValue`), the status and the copy's key. It takes
 * 367 days a request (368 is HTTP 400); a night without data has no row, and
 * a span without any is HTTP 204 (null). The history starts 2025-08-03 and is
 * three requests: two windows of rows and the empty one before them.
 *
 * - A night belongs to the morning it ends: `calendarDate` 2026-10-11 is the
 *   sleep of Oct 10→11.
 * - Rows come whole (`keepOld` false). Six of 416 were made 14–26 days after
 *   their night, when the watch synced late, so a routine sync asks the last
 *   28 days again: one request, the window being a year.
 * - The run's own days are free (`fromDay`): the day sync fetches
 *   `hrv/{date}`, whose summary is the night's `hrv/daily` row field for
 *   field. A 204 night reads null, so it is covered with no row.
 * - The first 18 nights are onboarding (`NONE`, `ONBOARDING_1`, no
 *   baseline; a 7-day average from night 4); nine later ones are
 *   `ONBOARDING_2` (baseline kept, no 7-day average or marker). Both keep
 *   what they have, `NONE` included.
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface HrvStatusRow {
	/** The morning the night ended, `YYYY-MM-DD`. */
	date: string;
	/** The 7-day average, ms: the dial's number and the 7d / 4w dots (`weeklyAvg`). Absent on onboarding nights 1–3 and `ONBOARDING_2` nights. */
	weekly?: number;
	/** The overnight average, ms: "Overnight Avg" and the dashed line (`lastNightAvg`). Absent on a night the watch had no overnight value (36 a year). */
	night?: number;
	/** The night's highest five-minute value, ms: "Highest 5-min Avg" (`lastNight5MinHigh`), the top reading. */
	high?: number;
	/** The baseline: LOW at or below `lowUpper`, BALANCED from `balLow` to `balHigh`. Absent while onboarding (`ONBOARDING_1`). */
	lowUpper?: number;
	balLow?: number;
	balHigh?: number;
	/** Garmin's dial position, 0–1, to 4 dp (0.0001 is 0.03° of the dial): `baseline.markerValue`. */
	marker?: number;
	/** `BALANCED`, `UNBALANCED`, `LOW`, or `NONE` while onboarding. */
	status?: string;
	/** The copy's key: `HRV_BALANCED_6`, `ONBOARDING_1`. */
	feedback?: string;
}

/** What the mapper reads of a night's summary: a `hrv/daily` row, or `hrv/{date}`'s `hrvSummary`. */
export type HrvSummaryInput = Pick<HrvSummary, "calendarDate" | "weeklyAvg" | "lastNightAvg" | "lastNight5MinHigh" | "baseline" | "status" | "feedbackPhrase">;

/** A night's summary as an index row; the definition drops what is null. */
export function rowOfSummary(summary: HrvSummaryInput | null | undefined): DayRowInput<HrvStatusRow> {
	const baseline = summary?.baseline;
	return {
		date: summary?.calendarDate,
		weekly: summary?.weeklyAvg,
		night: summary?.lastNightAvg,
		high: summary?.lastNight5MinHigh,
		lowUpper: baseline?.lowUpper,
		balLow: baseline?.balancedLow,
		balHigh: baseline?.balancedUpper,
		marker: baseline?.markerValue,
		status: summary?.status,
		feedback: summary?.feedbackPhrase,
	};
}

export const HRV_STATUS_INDEX = defineDayIndex<HrvStatusRow>({
	kind: "hrv-status",
	// "Sync HRV status history".
	title: "HRV status",
	folder: "hrv-status",
	version: 1,
	columns: {
		weekly: {},
		night: {},
		high: {},
		lowUpper: {},
		balLow: {},
		balHigh: {},
		marker: { precision: 4 },
		status: { text: true },
		feedback: { text: true },
	},
	// A night's row comes whole.
	keepOld: false,
	group: "hrv",
	// The route's cap: the history is two windows and the empty one before them.
	windowDays: 367,
	// Rows appear up to 26 days after their night: the last 4w is asked again, one request.
	refreshDays: 28,
	// The longest gap inside the history is six nights; the year before 2025-08-03 is null.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => ((await api.hrvDaily(start, end))?.hrvSummaries ?? []).map(rowOfSummary),
	// Free on a routine sync: the day's `hrv/{date}` it fetched anyway. A 204 night is covered with no row.
	fromDay: { needs: ["hrv"], read: (day) => (day.hrv?.hrvSummary ? rowOfSummary(day.hrv.hrvSummary) : null) },
});

/* ------------------------------------------------------------------ */
/*  The night's readings                                               */
/* ------------------------------------------------------------------ */

/**
 * What the 1d page needs of a night's `hrv/{date}`, kept by `HRV_DAY`: the
 * sleep window the Nightly Timeline spans, the five-minute readings on a grid
 * a step apart, and the night's summary under the index's column names, so a
 * night the index lacks still shows. 78–120 small numbers a night.
 *
 * Times are epoch ms, UTC, as every series keeps them; `offset` puts them on
 * the watch's clock, which follows the watch across zones (+3 h on Jun 1 and
 * Sep 25, +4 h on Jul 11 and Oct 11). Garmin has no readings before
 * 2026-06-01, or on a night without an overnight value: such a night keeps
 * its summary, an empty grid and no window.
 */
export interface HrvNight extends Omit<HrvStatusRow, "date"> {
	/** The sleep window, epoch ms (`sleepStartTimestampGMT`, `sleepEndTimestampGMT`): the timeline's ends. */
	sleepStart?: number;
	sleepEnd?: number;
	/** The watch's local time minus UTC that night, ms. */
	offset?: number;
	/** The first reading, epoch ms: slot 0 of `values`. Absent without readings. */
	start?: number;
	/** Milliseconds between slots: five minutes. */
	step: number;
	/** Whole ms a `step` apart from `start`; null in a slot with no reading (2026-07-11 skips 05:59:50 → 06:24:50). Empty without readings. */
	values: Array<number | null>;
}

/** The key the night is kept under, in the series file's `extra`. */
export const HRV_DAY_KEY = "hrvDay";

/** Five minutes: the step every night seen so far used. */
export const HRV_STEP_MS = 300_000;
const HOUR_MS = 3_600_000;
/** The most slots a night can hold: a day and a half of readings. */
const MAX_SLOTS = (36 * HOUR_MS) / HRV_STEP_MS;
/** Clock offsets run from UTC−12 to UTC+14, in quarter hours. */
const MAX_OFFSET_MS = 14 * HOUR_MS;
const QUARTER_HOUR_MS = 900_000;

/** A row's fields without its date. */
function fieldsOf(row: HrvStatusRow | null): Omit<HrvStatusRow, "date"> {
	if (!row) return {};
	const { date: _date, ...fields } = row;
	return fields;
}

/** Whole ms, or undefined for null, a non-number or a negative. */
function ms(value: unknown): number | undefined {
	return isFiniteNumber(value) && value >= 0 ? Math.round(value) : undefined;
}

/** Local minus UTC, ms, from the same moment on both clocks; undefined unless it is a real zone. */
function offsetOf(local: unknown, gmt: unknown): number | undefined {
	const at = epochOf(local);
	const utc = epochOf(gmt);
	if (at === undefined || utc === undefined) return undefined;
	const offset = at - utc;
	return Math.abs(offset) <= MAX_OFFSET_MS && offset % QUARTER_HOUR_MS === 0 ? offset : undefined;
}

/** The readings as `[epoch ms, value]`, oldest first; one without a time or a value is left out. */
function readingsOf(payload: HrvData): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	for (const reading of Array.isArray(payload.hrvReadings) ? payload.hrvReadings : []) {
		const t = epochOf(reading?.readingTimeGMT);
		const v = ms(reading?.hrvValue);
		if (t !== undefined && v !== undefined) out.push([t, v]);
	}
	return out.sort((a, b) => a[0] - b[0]);
}

/** Readings on a grid a step apart from the first; a reading off the grid takes its nearest slot. */
function gridOf(readings: ReadonlyArray<[number, number]>): { start?: number; values: Array<number | null> } {
	const start = readings[0]?.[0];
	if (start === undefined) return { values: [] };
	const values: Array<number | null> = [];
	for (const [t, v] of readings) {
		const i = Math.round((t - start) / HRV_STEP_MS);
		if (i >= MAX_SLOTS) break;
		while (values.length < i) values.push(null);
		values[i] = v;
	}
	return { start, values };
}

/**
 * A night as `HRV_DAY` keeps it, or null when Garmin had nothing: a 204
 * (2026-09-12, or today before the night syncs), or a payload with neither a
 * summary nor a reading.
 */
export function hrvNightOf(payload: HrvData | null | undefined, date: string): HrvNight | null {
	if (!payload || typeof payload !== "object") return null;
	const summary = HRV_STATUS_INDEX.normalize({ ...rowOfSummary(payload.hrvSummary), date });
	const { start, values } = gridOf(readingsOf(payload));
	if (!summary && !values.length) return null;
	const first = payload.hrvReadings?.[0];
	const offset = offsetOf(payload.sleepStartTimestampLocal, payload.sleepStartTimestampGMT) ?? offsetOf(first?.readingTimeLocal, first?.readingTimeGMT);
	const sleepStart = epochOf(payload.sleepStartTimestampGMT);
	const sleepEnd = epochOf(payload.sleepEndTimestampGMT);
	return {
		...(sleepStart !== undefined && sleepEnd !== undefined && sleepEnd > sleepStart ? { sleepStart, sleepEnd } : {}),
		...(offset !== undefined ? { offset } : {}),
		...(start !== undefined ? { start } : {}),
		step: HRV_STEP_MS,
		values,
		...fieldsOf(summary),
	};
}

/** The night as the day's series file keeps it, or null when the file has none, or a block it cannot read. */
export function hrvNightIn(series: DaySeries | null | undefined): HrvNight | null {
	const raw = series?.extra?.[HRV_DAY_KEY] as Partial<Record<keyof HrvNight, unknown>> | undefined;
	if (!raw || typeof raw !== "object" || !isFiniteNumber(raw.step) || raw.step <= 0 || !Array.isArray(raw.values)) return null;
	const values = raw.values.map((v: unknown) => ms(v) ?? null);
	if (values.length && !isFiniteNumber(raw.start)) return null;
	const { sleepStart, sleepEnd } = raw;
	return {
		...(isFiniteNumber(sleepStart) && isFiniteNumber(sleepEnd) && sleepEnd > sleepStart ? { sleepStart, sleepEnd } : {}),
		...(isFiniteNumber(raw.offset) ? { offset: raw.offset } : {}),
		...(isFiniteNumber(raw.start) ? { start: raw.start } : {}),
		step: raw.step,
		values,
		// The summary comes back through the index's own cleaning: its columns, its precision.
		...fieldsOf(HRV_STATUS_INDEX.normalize({ ...raw, date: "2000-01-01" })),
	};
}

/** The night's summary as an index row for `date`, for a night the index lacks; null without one. */
export function rowOfNight(night: HrvNight | null | undefined, date: string): HrvStatusRow | null {
	return night ? HRV_STATUS_INDEX.normalize({ ...night, date }) : null;
}

/**
 * The 1d page's night: `loadIntraday(date, [HRV_DAY.key])` fetches it for a
 * night nobody synced. A sync keeps it too (`fromDay`), from the payload the
 * day sync fetched anyway, for every night with readings: Garmin has already
 * dropped every reading before 2026-06-01, and may drop more. A night without
 * readings adds nothing the index lacks, so a sync leaves it to the page.
 */
export const HRV_DAY = defineIntraday<HrvData | null, HrvNight>({
	key: HRV_DAY_KEY,
	group: "hrv",
	fetch: (api, date) => api.hrv(date) as Promise<HrvData | null>,
	map: (payload, date) => hrvNightOf(payload, date),
	fromDay: (day) => (day.hrv?.hrvReadings?.length ? day.hrv : null),
});
