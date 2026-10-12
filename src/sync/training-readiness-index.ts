import type { TrainingReadinessReading } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import type { DayData } from "./metrics";

/**
 * Training Readiness: the day index every past day of the page reads, and
 * the intraday extra that keeps all of a day's readings
 * (ref/performance-stats/training-readiness/README.md).
 *
 * A day has one to eleven readings: on waking (`AFTER_WAKEUP_RESET`), after
 * an activity (`AFTER_POST_EXERCISE_RESET`) and through the day
 * (`UPDATE_REALTIME_VARIABLES`). Garmin's page shows one of them: today its
 * newest, a past day its first wake-up reading ("only your score early each
 * morning … is displayed in Garmin Connect for that day"). The day files
 * keep element 0, the newest, which is the wrong one for a past day and has
 * no time, so the page reads these instead.
 *
 * - The index keeps a day's morning reading (`morningReading`): the earliest
 *   `AFTER_WAKEUP_RESET` by `timestamp`, else the earliest reading (only
 *   2026-01-10 has no wake-up reading). An overnight realtime reading before
 *   it is not the morning's (Oct 8's 00:20 had no sleep score).
 * - One route feeds it: `trainingreadiness/{start}/{end}`
 *   (`GarminApi.trainingReadinessRange`), every reading of the span newest
 *   first, 367 days a request (368 is HTTP 400), days without one left out
 *   and a span without any `[]`. The history starts 2025-08-02: three
 *   requests, 1,111 readings on 432 days to 2026-10-12, the last window
 *   empty.
 * - The run's own days are free (`fromDay`): the day sync fetches
 *   `trainingreadiness/{date}`, the range's rows for the day field for field.
 *   A day without readings (`[]`: today before the watch syncs, a missed day)
 *   is covered with no row, which is the truth for that day on both routes;
 *   today's morning reading lands with the next sync, which fetches today
 *   again. Yesterday's can land after the plugin's last sync of yesterday, so
 *   the last two days are asked again, free when the run covers them.
 * - `READINESS_DAY` keeps every reading of a day in its series file, at sync
 *   time from the same payload, so today's newest reading and its "Updated @
 *   9:41 AM • After Activity" line work offline; a page fetches it on view
 *   for a day no sync kept.
 * - A day's readings are ordered by `timestamp`, GMT: the watch's own clock
 *   can step back mid-day when it travels (2026-01-28, +4 h to +3 h). A
 *   reading from another tracker than the Preferred Activity Tracker
 *   (`primaryActivityTracker` false, never seen) is left out, as Garmin
 *   Connect leaves it out.
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface TrainingReadinessRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The reading's time on the watch's clock, minutes from midnight, truncated: 07:24:57 is 444. */
	time?: number;
	/** `AFTER_WAKEUP_RESET`, `AFTER_POST_EXERCISE_RESET` or `UPDATE_REALTIME_VARIABLES` (`inputContext`). */
	ctx?: string;
	/** 1–100; absent while onboarding. */
	score?: number;
	/** `POOR`, `LOW`, `MODERATE`, `HIGH`, `PRIME`; `NONE` while onboarding, kept. */
	level?: string;
	/** The title's key, `WELL_RECOVERED`, and the copy's, `HIGH_RT_HIGHEST_SS_AVAILABLE` (`feedbackShort`, `feedbackLong`). */
	short?: string;
	long?: string;
	/** Last night's sleep score, its factor percent and Garmin's band of it (`VERY_GOOD` … `POOR`, `NONE`). */
	sleep?: number;
	sleepPct?: number;
	sleepFb?: string;
	/** Recovery time, minutes (`recoveryTime`), and its factor. */
	recovery?: number;
	recoveryPct?: number;
	recoveryFb?: string;
	/** The reading's own acute load: the Acute Load card's value when the day has no Training Status row. */
	acute?: number;
	acwrPct?: number;
	acwrFb?: string;
	/** The HRV 7-day average, ms (`hrvWeeklyAverage`), and its factor. */
	hrv?: number;
	hrvPct?: number;
	hrvFb?: string;
	/** Recent Sleep Scores and Recent Stress: a percent and a band, no value. */
	sleepHistPct?: number;
	sleepHistFb?: string;
	stressHistPct?: number;
	stressHistFb?: string;
}

/** A reading as `READINESS_DAY` keeps it: the index's columns, without the date. */
export type ReadinessReading = Omit<TrainingReadinessRow, "date">;

/** The `inputContext` of a reading made on waking: a past day shows its first. */
export const WAKE_UP = "AFTER_WAKEUP_RESET";
/** After an activity: "Updated @ 9:41 AM • After Activity". */
export const AFTER_ACTIVITY = "AFTER_POST_EXERCISE_RESET";
/** Through the day and overnight. */
export const REALTIME = "UPDATE_REALTIME_VARIABLES";

const DATE = /^\d{4}-\d{2}-\d{2}/;

/** A reading's day, `YYYY-MM-DD`; undefined without one. */
function dayOf(value: unknown): string | undefined {
	return typeof value === "string" && DATE.test(value) ? value.slice(0, 10) : undefined;
}

/** A wall-clock time's minutes from midnight, truncated: "2026-10-10T07:24:57.0" is 444. */
export function minuteOfDay(local: unknown): number | undefined {
	if (typeof local !== "string") return undefined;
	const match = /T(\d{2}):(\d{2})/.exec(local);
	if (!match) return undefined;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours < 24 && minutes < 60 ? hours * 60 + minutes : undefined;
}

/** A reading as an index row; the definition drops what is null. */
export function rowOfReading(reading: TrainingReadinessReading | null | undefined): DayRowInput<TrainingReadinessRow> {
	const r: TrainingReadinessReading = reading ?? {};
	return {
		date: dayOf(r.calendarDate),
		time: minuteOfDay(r.timestampLocal),
		ctx: r.inputContext,
		score: r.score,
		level: r.level,
		short: r.feedbackShort,
		long: r.feedbackLong,
		sleep: r.sleepScore,
		sleepPct: r.sleepScoreFactorPercent,
		sleepFb: r.sleepScoreFactorFeedback,
		recovery: r.recoveryTime,
		recoveryPct: r.recoveryTimeFactorPercent,
		recoveryFb: r.recoveryTimeFactorFeedback,
		acute: r.acuteLoad,
		acwrPct: r.acwrFactorPercent,
		acwrFb: r.acwrFactorFeedback,
		hrv: r.hrvWeeklyAverage,
		hrvPct: r.hrvFactorPercent,
		hrvFb: r.hrvFactorFeedback,
		sleepHistPct: r.sleepHistoryFactorPercent,
		sleepHistFb: r.sleepHistoryFactorFeedback,
		stressHistPct: r.stressHistoryFactorPercent,
		stressHistFb: r.stressHistoryFactorFeedback,
	};
}

function isReading(value: unknown): value is TrainingReadinessReading {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/** When a reading was made, for ordering a day: GMT, else the watch's clock; a reading with neither goes first. */
function momentOf(reading: TrainingReadinessReading): number {
	return epochOf(reading.timestamp) ?? epochOf(reading.timestampLocal) ?? Number.NEGATIVE_INFINITY;
}

/**
 * A day's readings oldest first by `timestamp`, as Garmin Connect picks from
 * them: another tracker's left out, and with `date` another day's too. The
 * routes send them newest first, so equal times keep that order reversed.
 */
export function dayReadings(raw: unknown, date?: string): TrainingReadinessReading[] {
	if (!Array.isArray(raw)) return [];
	const readings = raw.filter(isReading).filter((r) => {
		if (r.primaryActivityTracker === false) return false;
		const day = dayOf(r.calendarDate);
		return !date || day === undefined || day === date;
	});
	return readings
		.reverse()
		.map((reading, i) => ({ reading, i, at: momentOf(reading) }))
		.sort((a, b) => a.at - b.at || a.i - b.i)
		.map((r) => r.reading);
}

/** A past day's reading: the earliest `AFTER_WAKEUP_RESET` by `timestamp`, else the earliest reading. */
export function morningReading(readings: readonly unknown[] | null | undefined, date?: string): TrainingReadinessReading | undefined {
	const sorted = dayReadings(readings, date);
	return sorted.find((r) => r.inputContext === WAKE_UP) ?? sorted[0];
}

/** The same pick among readings as the extra keeps them, oldest first. */
export function morningOf<T extends { ctx?: string }>(readings: readonly T[] | null | undefined): T | undefined {
	return readings?.find((r) => r.ctx === WAKE_UP) ?? readings?.[0];
}

/** Today's reading: the newest of the extra's, which keeps them oldest first. */
export function newestOf<T>(readings: readonly T[] | null | undefined): T | undefined {
	return readings?.length ? readings[readings.length - 1] : undefined;
}

/** A range answer as rows: a day each with readings, its morning reading. */
export function rowsOfReadings(raw: unknown): Array<DayRowInput<TrainingReadinessRow>> {
	const byDay = new Map<string, TrainingReadinessReading[]>();
	for (const reading of Array.isArray(raw) ? raw : []) {
		const day = isReading(reading) ? dayOf(reading.calendarDate) : undefined;
		if (!day) continue;
		const list = byDay.get(day);
		if (list) list.push(reading);
		else byDay.set(day, [reading]);
	}
	const rows: Array<DayRowInput<TrainingReadinessRow>> = [];
	for (const [day, readings] of byDay) {
		const morning = morningReading(readings, day);
		if (morning) rows.push({ ...rowOfReading(morning), date: day });
	}
	return rows;
}

/** The day sync's readings as the day's row: its morning reading, or null for a day without one (`[]`). */
export function rowOfDay(day: Pick<DayData, "readiness">, date: string): DayRowInput<TrainingReadinessRow> | null {
	const morning = morningReading(day.readiness, date);
	return morning ? { ...rowOfReading(morning), date } : null;
}

export const TRAINING_READINESS_INDEX = defineDayIndex<TrainingReadinessRow>({
	kind: "training-readiness",
	// "Sync training readiness history".
	title: "training readiness",
	folder: "training-readiness",
	version: 1,
	columns: {
		time: {},
		ctx: { text: true },
		score: {},
		level: { text: true },
		short: { text: true },
		long: { text: true },
		sleep: {},
		sleepPct: {},
		sleepFb: { text: true },
		recovery: {},
		recoveryPct: {},
		recoveryFb: { text: true },
		acute: {},
		acwrPct: {},
		acwrFb: { text: true },
		hrv: {},
		hrvPct: {},
		hrvFb: { text: true },
		sleepHistPct: {},
		sleepHistFb: { text: true },
		stressHistPct: {},
		stressHistFb: { text: true },
	},
	// A day's row is one reading, whole.
	keepOld: false,
	group: "readiness",
	// The route's cap: the history is two windows and the empty one before them.
	windowDays: 367,
	// Readings land with the watch's next sync: yesterday's morning one can come after the plugin's last sync of it.
	refreshDays: 2,
	// The longest gap inside the history is five days (2026-01-05 … 09); the year before 2025-08-02 is [].
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfReadings(await api.trainingReadinessRange(start, end)),
	// Free on a routine sync: every reading of the day, which the day sync fetched anyway. [] is covered with no row.
	fromDay: { needs: ["readiness"], read: (day, date) => rowOfDay(day, date) },
});

/* ------------------------------------------------------------------ */
/*  The day's readings                                                 */
/* ------------------------------------------------------------------ */

/** The key the day's readings are kept under, in the series file's `extra`. */
export const READINESS_DAY_KEY = "readinessDay";

/** A placeholder day for cleaning a reading through the index's own columns. */
const ANY_DAY = "2000-01-01";

/** A row's fields without its date; null for nothing. */
function readingOf(input: unknown): ReadinessReading | null {
	const row = TRAINING_READINESS_INDEX.normalize(isReading(input) ? { ...input, date: ANY_DAY } : null);
	if (!row) return null;
	const { date: _date, ...fields } = row;
	return fields;
}

/**
 * Every reading of a day as `READINESS_DAY` keeps it, oldest first, each the
 * index's row without its date; null for a day without one (`[]`). About 2.6
 * readings a day, 22 small values each.
 */
export function readinessDayOf(payload: unknown, date: string): ReadinessReading[] | null {
	const readings = dayReadings(payload, date)
		.map((r) => readingOf(rowOfReading(r)))
		.filter((r): r is ReadinessReading => r !== null);
	return readings.length ? readings : null;
}

/** The day's readings as its series file keeps them, oldest first; null when the file has none, or a block it cannot read. */
export function readinessDayIn(series: DaySeries | null | undefined): ReadinessReading[] | null {
	const raw = series?.extra?.[READINESS_DAY_KEY];
	if (!Array.isArray(raw)) return null;
	const readings = raw.map(readingOf).filter((r): r is ReadinessReading => r !== null);
	return readings.length ? readings : null;
}

/**
 * A day's readings, all of them: `loadIntraday(date, [READINESS_DAY.key])`
 * fetches them for a day no sync kept. A sync keeps them too (`fromDay`),
 * from the payload the day sync fetched anyway, for every day with a reading,
 * so today's newest is on disk after every sync. A day without one adds
 * nothing, and never erases what an earlier sync kept.
 */
export const READINESS_DAY = defineIntraday<readonly unknown[] | null, ReadinessReading[]>({
	key: READINESS_DAY_KEY,
	group: "readiness",
	fetch: (api, date) => api.trainingReadiness(date),
	map: (payload, date) => readinessDayOf(payload, date),
	fromDay: (day) => (day.readiness?.length ? day.readiness : null),
});
