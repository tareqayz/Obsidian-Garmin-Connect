import type { TrainingStatusEntry, TrainingStatusHistory } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import type { DayData } from "./metrics";

/**
 * Training Status: the day index every view of the page reads — Current's
 * row, the 4w / 12w / 6m strips and their tables
 * (ref/performance-stats/training-status/README.md) — and what Load's Training
 * Load tab and Training Readiness's acute load timeline read for a day's
 * acute and chronic load.
 *
 * One route holds the whole history: `trainingstatus/weekly/{displayName}`
 * (`GarminApi.trainingStatusWeekly`). Despite its name it sends a row a day,
 * per device, oldest first: the status code, the feedback phrase, the acute
 * and chronic load with their ratio and status, and the VO₂ Max trend with
 * its sport. It has no cap (3660 days returned all 435 rows, 2025-08-02 →
 * 2026-10-11), leaves out a day without a status (2025-08-08, today before
 * the watch syncs, future days), and a span with none is `reportData: {}`.
 *
 * - A row is the day sync's own data: each equals the aggregated route's
 *   entry for the day (`DayData.training`) and `trainingstatus/daily`'s, but
 *   for `sinceDate`, null on history rows, which the page works out again
 *   (`sinceOf` in training-status-pages.ts). So the run's own days are free
 *   (`fromDay`), and a day the aggregated route has no status for (all null)
 *   is covered with no row.
 * - With several training devices, a day's row is the one flagged
 *   `primaryTrainingDevice`, else the first device's, as the day files pick
 *   theirs (`primaryEntry` in metrics.ts).
 * - Rows come whole (`keepOld` false). A day is not revised after it ends,
 *   but today's row moves with each activity and yesterday's last values can
 *   land after the plugin's last sync of it: the last two days are asked
 *   again, free when the run's own days cover them.
 * - The history is about three requests: the year to today, the year before
 *   (71 rows from 2025-08-02) and an empty year that ends the walk.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface TrainingStatusRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/**
	 * Garmin's status code, one to one with the phrase's prefix: 0 No Status,
	 * 1 Detraining, 2 Unproductive, 3 Overreaching, 4 Maintaining, 5 Recovery,
	 * 6 Peaking, 7 Productive, 8 Strained (`trainingStatus`). 0 is a value.
	 */
	code?: number;
	/** The copy's key: `MAINTAINING_2`, `DETRAINING`, `NO_STATUS_1` (`trainingStatusFeedbackPhrase`). */
	phrase?: string;
	/** The acute load, whole (`acuteTrainingLoadDTO.dailyTrainingLoadAcute`): Current's Load row. */
	acute?: number;
	/** The chronic load, whole (`dailyTrainingLoadChronic`): the optimal band is 0.8× to 1.5× it. */
	chronic?: number;
	/** The load ratio as Garmin sends it, 1 dp: acute ÷ chronic truncated (`dailyAcuteChronicWorkloadRatio`). Null on 13 rows. */
	ratio?: number;
	/** `LOW`, `OPTIMAL`, `HIGH`, `VERY_HIGH`, or `NONE` with No Status (`acwrStatus`). */
	acwr?: string;
	/** The ratio's place on the gauge, 0–100 (`acwrPercent`). */
	acwrPct?: number;
	/** The load sheet's copy key: `FEEDBACK_1` … `FEEDBACK_5`, `NONE` (`acwrStatusFeedback`). */
	acwrFeedback?: string;
	/** The VO₂ Max trend: 3 rising, 2 level, 1 falling; 0 with the sport `NONE` (`fitnessTrend`). */
	trend?: number;
	/** The trend's sport, "Based on your Running VO₂ Max Trend": `RUNNING`, `CYCLING`, `NONE` (`fitnessTrendSport`). */
	trendSport?: string;
	/** 1 while Garmin's training status is paused (`trainingPaused`); absent otherwise. */
	paused?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A status entry's day, `YYYY-MM-DD`; undefined for an entry without one. */
export function statusDateOf(entry: Pick<TrainingStatusEntry, "calendarDate"> | null | undefined): string | undefined {
	const date = entry?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/** One device's entry for a day, from any of the training status routes, as an index row; the definition drops what is null. */
export function rowOfStatus(entry: TrainingStatusEntry | null | undefined): DayRowInput<TrainingStatusRow> {
	const load = entry?.acuteTrainingLoadDTO;
	return {
		date: statusDateOf(entry),
		code: entry?.trainingStatus,
		phrase: entry?.trainingStatusFeedbackPhrase,
		acute: load?.dailyTrainingLoadAcute,
		chronic: load?.dailyTrainingLoadChronic,
		ratio: load?.dailyAcuteChronicWorkloadRatio,
		acwr: load?.acwrStatus,
		acwrPct: load?.acwrPercent,
		acwrFeedback: load?.acwrStatusFeedback,
		trend: entry?.fitnessTrend,
		trendSport: entry?.fitnessTrendSport,
		paused: entry?.trainingPaused === true ? 1 : undefined,
	};
}

function isEntry(value: unknown): value is TrainingStatusEntry {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * The primary training device's entry in a device-keyed map
 * (`latestTrainingStatusData`), else the first there is: what the day files
 * keep (`primaryEntry` in metrics.ts).
 */
export function primaryStatus(map: unknown): TrainingStatusEntry | undefined {
	if (!isEntry(map)) return undefined;
	const entries = Object.values(map).filter(isEntry);
	return entries.find((e) => e.primaryTrainingDevice === true) ?? entries[0];
}

/**
 * A `trainingstatus/weekly` (or `/monthly`) answer as one entry a day,
 * oldest first: for each day, the row flagged `primaryTrainingDevice`, else
 * the first device's. Rows without a day are left out; an empty span
 * (`reportData: {}`) or a null answer is none.
 */
export function entriesOfHistory(history: TrainingStatusHistory | null | undefined): TrainingStatusEntry[] {
	const byDate = new Map<string, TrainingStatusEntry>();
	const report = history?.reportData;
	if (!isEntry(report)) return [];
	for (const rows of Object.values(report)) {
		if (!Array.isArray(rows)) continue;
		for (const row of rows) {
			const date = isEntry(row) ? statusDateOf(row) : undefined;
			if (!date) continue;
			const held = byDate.get(date);
			if (!held || (row.primaryTrainingDevice === true && held.primaryTrainingDevice !== true)) byDate.set(date, row);
		}
	}
	return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, row]) => row);
}

/**
 * The day's status as the day sync fetched it (`trainingstatus/aggregated`),
 * as a row: the primary device's entry, or null for a day without a status
 * (the route sends every part null) or an entry dated another day.
 */
export function rowOfDay(day: Pick<DayData, "training">, date: string): DayRowInput<TrainingStatusRow> | null {
	const training = day.training;
	const entry = primaryStatus(training?.mostRecentTrainingStatus?.latestTrainingStatusData ?? training?.latestTrainingStatusData);
	if (!entry) return null;
	const at = statusDateOf(entry);
	// `trainingstatus/daily` answers a day without a status with an earlier day's entry; never keep one as this day's.
	if (at !== undefined && at !== date) return null;
	return rowOfStatus(entry);
}

export const TRAINING_STATUS_INDEX = defineDayIndex<TrainingStatusRow>({
	kind: "training-status",
	// "Sync training status history".
	title: "training status",
	folder: "training-status",
	version: 1,
	columns: {
		code: {},
		phrase: { text: true },
		acute: {},
		chronic: {},
		ratio: { precision: 1 },
		acwr: { text: true },
		acwrPct: {},
		acwrFeedback: { text: true },
		trend: {},
		trendSport: { text: true },
		paused: {},
	},
	// A day's row comes whole from either source.
	keepOld: false,
	group: "training",
	// No cap was found up to 3660 days; a year bounds a response to about 240 KB.
	windowDays: 365,
	// Today's row moves with each activity, and yesterday's can land after the
	// last sync of it. Free when the run's own days cover both.
	refreshDays: 2,
	// The longest gap inside the history is one day; the year before 2025-08-02 is `reportData: {}`.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => entriesOfHistory(await api.trainingStatusWeekly(start, end)).map(rowOfStatus),
	// Free on a routine sync: the day's `trainingstatus/aggregated` it fetched
	// anyway. A day without a status is all null, so it is covered with no row.
	fromDay: { needs: ["training"], read: (day, date) => rowOfDay(day, date) },
});
