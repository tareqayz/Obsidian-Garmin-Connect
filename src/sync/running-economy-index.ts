import type { RunningEconomyScore } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Running Economy: the day index every view of the page reads — Current's
 * newest reading and the 4w / 12w / 1y lines
 * (ref/performance-stats/running-economy/README.md).
 *
 * One route feeds it all: `metrics-service/metrics/runningeconomy/daily`
 * (`GarminApi.runningEconomyDaily`), which no sync called before this index.
 *
 * - A window holding a reading sends a row for every calendar day, `score`
 *   and `classification` null on the days without one (also before the
 *   history, and today before a reading lands); a window without one sends
 *   `[]`. The mapper drops the null rows, so the index has a row only on a
 *   day with a reading: 87 from 2025-08-16 to 2026-10-11, about 6 KB in
 *   two year files.
 * - Scores are whole numbers, lower is better; `classification` is Garmin's
 *   word (`INTERMEDIATE`, `TRAINED`, …), kept as sent rather than derived:
 *   Current's heading and marker colour follow it. All 87 days carry the
 *   class the help table gives their score.
 * - The cap is one calendar year: `endDate` ≤ `startDate` + 1 year. 366
 *   calendar days always pass (367 only across Feb 29), so a window is 366.
 *   From 2026-10-12 the history walk asks [2025-10-12 … 2026-10-12] (65
 *   rows), [2024-10-11 … 2025-10-11] (22) and [2023-10-11 … 2024-10-10]
 *   (`[]`), which ends it: three requests, once. The longest gap inside the
 *   history is 62 days, so an empty year means the history has started.
 * - No `fromDay`: the day sync never asks this route, so a routine sync asks
 *   one window for its days and any stretch since the index's newest day —
 *   one request a sync. `refreshDays` 2 asks yesterday again on every sync:
 *   a reading lands when the watch syncs, which can be after the plugin's
 *   last sync of that day. No row was revised in 16 hours between the web
 *   capture and the live calls.
 * - The page computes every 7-day block, Avg and Best from these rows; the
 *   weekly route (each block's lowest reading) is never asked.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface RunningEconomyRow {
	/** The local calendar day of the reading, `YYYY-MM-DD`. */
	date: string;
	/** The running economy score, a whole number, lower is better (ml O₂/kg/km): `score`. */
	score?: number;
	/** Garmin's class word, `INTERMEDIATE`, `TRAINED`, `WELL_TRAINED` …: `classification`. */
	classification?: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A daily row's day, `YYYY-MM-DD`; undefined for a row without one. */
export function economyDateOf(row: Pick<RunningEconomyScore, "calendarDate"> | null | undefined): string | undefined {
	const date = row?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/**
 * A `runningeconomy/daily` payload as index rows, oldest first: the days with
 * a reading only. A null row (no reading that day) is left out here; the
 * definition drops anything else it can't keep.
 */
export function rowsOfEconomy(rows: ReadonlyArray<RunningEconomyScore | null> | null | undefined): Array<DayRowInput<RunningEconomyRow>> {
	const out: Array<DayRowInput<RunningEconomyRow>> = [];
	for (const row of rows ?? []) {
		if (!row || typeof row !== "object" || typeof row.score !== "number") continue;
		out.push({ date: economyDateOf(row), score: row.score, classification: row.classification });
	}
	return out;
}

export const RUNNING_ECONOMY_INDEX = defineDayIndex<RunningEconomyRow>({
	kind: "running-economy",
	// "Sync running economy history".
	title: "running economy",
	folder: "running-economy",
	version: 1,
	columns: { score: {}, classification: { text: true } },
	// A day's row comes whole.
	keepOld: false,
	group: "fitness",
	// The cap: `endDate` ≤ `startDate` + 1 calendar year; 366 calendar days always fit.
	windowDays: 366,
	// A reading lands when the watch syncs, so yesterday's can come after the
	// plugin's last sync of it. Free: without `fromDay` a routine sync asks a window anyway.
	refreshDays: 2,
	// The longest gap inside the history is 62 days: an empty year is the start.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfEconomy(await api.runningEconomyDaily(start, end)),
});
