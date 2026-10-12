import type { RacePrediction } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Race Predictor: the day index every view of the page reads — Current's
 * newest prediction, 4w's days and the month ends 6m and 1y plot
 * (ref/performance-stats/race-predictor/README.md).
 *
 * One route feeds it all: `racepredictions/daily/{displayName}`
 * (`GarminApi.racePredictions`), which the day sync already asks once per run
 * for the `races` group, a year a request (`RANGE_CHUNK_DAYS`).
 *
 * - The cap is one calendar year (end ≤ start + 1 year): 366 days answer 200,
 *   367 HTTP 400, with data or without. A 365-day window is always inside it.
 * - A window holding any prediction sends every day of it, with null times
 *   where there is none — before the history, and days still to come. Such a
 *   day maps to no row, so it is covered with nothing to keep. A window
 *   with none at all sends `[]`.
 * - The history starts 2025-08-09 and has all four times every day since,
 *   run or not: 430 rows to 2026-10-12, two year files.
 * - Today's row exists early in the day and changes when a run updates it;
 *   yesterday's last values can land after the plugin's last sync of it.
 *   Hence `refreshDays` 2, free when the run's own days cover both.
 * - Garmin's `monthly` and `latest` are this list's rows (each month's last
 *   day; the newest day), so the page derives them and calls neither.
 * - Routine syncs feed it for free (`fromDay`), from the range call they make
 *   anyway; a history walk asks a year a request, two for this history.
 *
 * The day files keep their own `race_5k` … `race_marathon`; this index is
 * what reaches back a year and more.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface RacePredictionRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The predicted 5K, seconds: `time5K`. */
	time5k?: number;
	/** 10K, seconds: `time10K`. */
	time10k?: number;
	/** Half marathon, seconds: `timeHalfMarathon`. */
	half?: number;
	/** Marathon, seconds: `timeMarathon`. */
	marathon?: number;
}

/** What the mapper reads of a prediction, as the API wrapper (`RacePrediction`) and the day sync (`RaceData`) both type it. */
export type RaceTimes = Pick<RacePrediction, "time5K" | "time10K" | "timeHalfMarathon" | "timeMarathon">;

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A prediction row's day, `YYYY-MM-DD`; undefined for a row without one. */
export function raceDateOf(row: Pick<RacePrediction, "calendarDate"> | null | undefined): string | undefined {
	const date = row?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/** A prediction's four times as an index row's; the definition drops what is null, so a null-filled day is no row. */
export function rowOfRace(row: RaceTimes | null | undefined): DayRowInput<RacePredictionRow> {
	return {
		time5k: row?.time5K,
		time10k: row?.time10K,
		half: row?.timeHalfMarathon,
		marathon: row?.timeMarathon,
	};
}

export const RACE_PREDICTIONS_INDEX = defineDayIndex<RacePredictionRow>({
	kind: "race-predictions",
	// "Sync race predictions history".
	title: "race predictions",
	folder: "race-predictions",
	version: 1,
	columns: { time5k: {}, time10k: {}, half: {}, marathon: {} },
	// A day's row comes whole.
	keepOld: false,
	group: "races",
	// The cap is a calendar year; a year a request is the day sync's chunk for this route.
	windowDays: 365,
	// Today's row changes with each run, and yesterday's can land after the last sync of it.
	refreshDays: 2,
	// No gap since the first row: a year without one, which Garmin sends as [], is before the history.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => (await api.racePredictions(start, end)).map((r) => ({ date: raceDateOf(r), ...rowOfRace(r) })),
	// Free on a routine sync: the day's row of the range call it made anyway. A
	// null-filled day, or one Garmin sent nothing for, is covered with no row.
	fromDay: { needs: ["races"], read: (day) => (day.races ? rowOfRace(day.races) : null) },
});
