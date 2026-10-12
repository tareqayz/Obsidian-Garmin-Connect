import type { Acclimation } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import type { DayData } from "./metrics";

/**
 * Heat Acclimation: the day index every view of the page reads — the day's
 * % with the reading before it and Garmin's trend on 1d, every day's % on
 * 7d and 4w (ref/performance-stats/heat-acclimation/README.md) — and what
 * Training Status's Heat Acclimation row reads.
 *
 * One route holds the whole history:
 * `heataltitudeacclimation/daily/{start}/{end}`
 * (`GarminApi.heatAltitudeAcclimationDaily`), a row a day, oldest first. It
 * has no cap (3660 days returned all 431 rows, 2025-08-02 → 2026-10-11),
 * leaves out a day without data (2026-01-05..09, future days), and a span
 * with none is `[]`. Today has a row from about 00:01 local, before the
 * watch syncs: the overnight decay (2026-10-12: 95 from 97,
 * DEACCLIMATIZING).
 *
 * - A row is dated by its `calendarDate`. Garmin's own reading dates
 *   (`heatAcclimationDate` and the rest) drift a day either side of it and
 *   are not kept.
 * - `prev` is Garmin's reading before (`previousHeatAcclimationPercentage`),
 *   yesterday's % on 428 of 429 days but not always (2026-08-30 reads 100
 *   from 100 after a 75): the page shows the field, never yesterday's row.
 * - `trend` is Garmin's word as sent: null exactly at 0 %, ACCLIMATIZING
 *   exactly when the % rose, but two falling days say ACCLIMATIZED.
 * - The altitude fields ride in the same rows; the index keeps them for a
 *   later Altitude Acclimation page, so it needs no second walk.
 * - Routine syncs feed it for free (`fromDay`) from the aggregated training
 *   status the day sync fetches for the `training` group: its
 *   `mostRecentVO2Max.heatAltitudeAcclimation` is the day's row on any day
 *   with one. But that payload is all null every morning until the watch
 *   syncs, while the daily route already has today's decay row, and a day
 *   without a row carries the newest earlier one (2026-01-07 → 01-04). So
 *   `read` throws for anything but the day's own row (`rowOfDay`): the engine
 *   counts a null `read` as the day covered with no row, which would drop
 *   the decay row (and delete a held one) even inside the refresh window. A
 *   throw leaves the day to the window fetch instead.
 * - Rows come whole (`keepOld` false). A past day is not revised; today's
 *   row is recomputed overnight and after each activity, and yesterday's last
 *   values can land after the plugin's last sync of it: the last two days are
 *   asked again, free when the run's own days cover them.
 * - The history is three requests: the year to today (360 rows), the year
 *   before (72, from 2025-08-02) and an empty year that ends the walk.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface HeatAcclimationRow {
	/** The local calendar day, `YYYY-MM-DD` (`calendarDate`). */
	date: string;
	/** Heat acclimation, 0–100, whole: "97%" (`heatAcclimationPercentage`). */
	pct?: number;
	/** The reading before, "Trending up from 79%." (`previousHeatAcclimationPercentage`). */
	prev?: number;
	/** `ACCLIMATIZING`, `ACCLIMATIZED`, `DEACCLIMATIZING`; absent at 0 % (`heatTrend` null). */
	trend?: string;
	/** Altitude acclimation, metres: 0, or 850–1150 here (`altitudeAcclimation`). For a later page. */
	altitude?: number;
	/** The altitude reading before, metres (`previousAltitudeAcclimation`). For a later page. */
	altitudePrev?: number;
	/** The altitude trend, as `trend`; absent while there is none (`altitudeTrend`). For a later page. */
	altitudeTrend?: string;
	/** The altitude the row was worked out at, metres, 0–2041 here (`currentAltitude`). For a later page. */
	altitudeNow?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A row's day, `YYYY-MM-DD`: its `calendarDate`, never Garmin's drifting reading dates. Undefined without one. */
export function acclimationDateOf(row: Pick<Acclimation, "calendarDate"> | null | undefined): string | undefined {
	const date = row?.calendarDate;
	return typeof date === "string" && DAY.test(date) ? date.slice(0, 10) : undefined;
}

/** One `heataltitudeacclimation` row (any of its routes, or the aggregated payload's) as an index row; the definition drops what is null. */
export function rowOfAcclimation(row: Acclimation | null | undefined): DayRowInput<HeatAcclimationRow> {
	return {
		date: acclimationDateOf(row),
		pct: row?.heatAcclimationPercentage,
		prev: row?.previousHeatAcclimationPercentage,
		trend: row?.heatTrend,
		altitude: row?.altitudeAcclimation,
		altitudePrev: row?.previousAltitudeAcclimation,
		altitudeTrend: row?.altitudeTrend,
		altitudeNow: row?.currentAltitude,
	};
}

/**
 * A daily window's answer as index rows, the window's days only. A null
 * answer is no rows (the wrapper's `[]`); anything else that is not a list
 * throws, so a changed payload fails the window instead of reading as days
 * without data, which would delete the rows the index holds for them.
 */
export function rowsOfDaily(answer: unknown, start: string, end: string): Array<DayRowInput<HeatAcclimationRow>> {
	if (answer === null || answer === undefined) return [];
	if (!Array.isArray(answer)) throw new Error("heat acclimation: the daily route did not send a list");
	const rows: Array<DayRowInput<HeatAcclimationRow>> = [];
	for (const item of answer as unknown[]) {
		if (!item || typeof item !== "object") continue;
		const row = rowOfAcclimation(item as Acclimation);
		if (typeof row.date === "string" && row.date >= start && row.date <= end) rows.push(row);
	}
	return rows;
}

/**
 * The day's row as the day sync fetched it (`trainingstatus/aggregated`):
 * `mostRecentVO2Max.heatAltitudeAcclimation` when it is dated `date`.
 *
 * Throws otherwise — on a morning before the watch syncs (`mostRecentVO2Max`
 * null) and on a day without a row of its own, whose payload carries the
 * newest earlier row. Not null: `takeDay` in engine.ts would count the day
 * covered with no row and skip it even in the refresh window, dropping
 * today's decay row the daily route already has. A throw leaves the day to
 * the window fetch.
 */
export function rowOfDay(day: Pick<DayData, "training">, date: string): DayRowInput<HeatAcclimationRow> {
	const row = day.training?.mostRecentVO2Max?.heatAltitudeAcclimation;
	const at = acclimationDateOf(row);
	if (!row || at !== date) throw new Error(`heat acclimation: no row of ${date} in the day's training status${at ? ` (it carries ${at}'s)` : ""}`);
	return rowOfAcclimation(row);
}

export const HEAT_ACCLIMATION_INDEX = defineDayIndex<HeatAcclimationRow>({
	kind: "heat-acclimation",
	// "Sync heat acclimation history".
	title: "heat acclimation",
	folder: "heat-acclimation",
	version: 1,
	columns: {
		pct: {},
		prev: {},
		trend: { text: true },
		altitude: {},
		altitudePrev: {},
		altitudeTrend: { text: true },
		altitudeNow: {},
	},
	// A day's row comes whole from either source.
	keepOld: false,
	group: "fitness",
	// No cap was found up to 3660 days; a year bounds a response to about 190 KB.
	windowDays: 365,
	// Today's row is recomputed overnight and with each activity, and yesterday's
	// can land after the last sync of it. Free when the run's own days cover both.
	refreshDays: 2,
	// The only gap inside the history is five days; the year before 2025-08-02 is `[]`.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfDaily(await api.heatAltitudeAcclimationDaily(start, end), start, end),
	// Free on a routine sync with the training group on: the aggregated status
	// the day sync fetched anyway. Only the day's own row; `rowOfDay` throws
	// for anything else, leaving the day to the window fetch.
	fromDay: { needs: ["training"], read: (day, date) => rowOfDay(day, date) },
});
