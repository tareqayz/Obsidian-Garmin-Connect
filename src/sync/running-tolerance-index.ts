import type { RunningTolerance } from "../garmin/endpoints";
import { defineDayIndex, shiftDate, type DayRowInput } from "./day-index";

/**
 * Running Tolerance: two indexes, one route
 * (ref/performance-stats/running-tolerance/README.md, Data plan).
 *
 * `metrics-service/metrics/runningtolerance/stats` (`GarminApi.runningTolerance`)
 * answers in two aggregations, both up to 366 days a request (367 is HTTP 400,
 * daily across Feb 29 too), both `[]` before the history (2025-08-17 here):
 *
 * - **daily** (`RUNNING_TOLERANCE_INDEX`, Current): a row a day with data, in
 *   no date order, days without one left out (2025-10-11, 2026-01-22). The
 *   acute impact load (Garmin's weighted sum, decaying on rest days), the run
 *   distance of the 7 days ending the day, the weekly tolerance that day, and a
 *   feedback phrase key. Metres, whatever the account's units. Kept in metres:
 *   the day files hold the distance as km to 2 dp, which rounds wrong to one
 *   for about 5% of days (22449 m → 22.45 → "22.5", where Garmin shows 22.4).
 *   Routine syncs feed it for free (`fromDay`): the day sync asks the same
 *   route for the run anyway (`engine.ts`), a year a request.
 * - **weekly** (`RUNNING_TOLERANCE_WEEKS_INDEX`, 12w and 1y): a row per Sunday
 *   week holding a daily row inside the window, sorted, weeks without runs
 *   zero-filled. `startOfWeek` / `endOfWeek` are the first and last days with a
 *   daily row inside the week and the window, `calendarDate` = `endOfWeek`,
 *   and the values are the week to date at `endOfWeek`. Its impact load
 *   totals exist nowhere else, and 6 of the 61 weeks here disagree with
 *   Garmin's own daily rows (Jul 19 – Sep 12, 2026) while the phone shows
 *   them: the rows are kept as sent and never rebuilt from the days.
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

/** A day of the daily aggregation, in metres. */
export interface RunningToleranceRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The acute impact load, Garmin's weighted sum: `acuteImpactLoad`. */
	load?: number;
	/** The run distance of the 7 days ending the day: `acuteDistance`. */
	distance?: number;
	/** The weekly tolerance on the day: `acuteTolerance`. */
	tolerance?: number;
	/** The feedback phrase key: `runningToleranceFeedBackPhrase` ("MEDIUM_LOAD"). */
	phrase?: string;
}

/** A Sunday week of the weekly aggregation as Garmin sent it, in metres. */
export interface RunningToleranceWeekRow {
	/** The week's Sunday, `YYYY-MM-DD`: the row's key, whatever day `from` is. */
	date: string;
	/** Garmin's `startOfWeek` and `endOfWeek`: the first and last days with a daily row. The list's headers read them. */
	from?: string;
	to?: string;
	/** The week's impact load: `totalImpactLoad`. */
	load?: number;
	/** The week's run distance: `totalDistance`. */
	distance?: number;
	/** The week's tolerance, `endOfWeek`'s: `tolerance`. */
	tolerance?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

function dayOf(value: unknown): string | undefined {
	return typeof value === "string" && DAY.test(value) ? value.slice(0, 10) : undefined;
}

/** The Sunday of the week `date` falls in: Garmin's weeks for this route run Sunday to Saturday. */
export function sundayOf(date: string): string {
	return shiftDate(date, -new Date(`${date}T00:00:00Z`).getUTCDay());
}

/** A daily row as an index row; the definition drops what is null or missing. */
export function rowOfTolerance(row: RunningTolerance | null | undefined): DayRowInput<RunningToleranceRow> {
	return {
		date: dayOf(row?.calendarDate),
		load: row?.acuteImpactLoad,
		distance: row?.acuteDistance,
		tolerance: row?.acuteTolerance,
		phrase: row?.runningToleranceFeedBackPhrase,
	};
}

/** A weekly row as an index row, keyed by its week's Sunday; none without a day to key it by. */
export function rowOfWeek(row: RunningTolerance | null | undefined): DayRowInput<RunningToleranceWeekRow> | null {
	const from = dayOf(row?.startOfWeek);
	const to = dayOf(row?.endOfWeek);
	const anchor = from ?? to ?? dayOf(row?.calendarDate);
	if (!anchor) return null;
	return { date: sundayOf(anchor), from, to, load: row?.totalImpactLoad, distance: row?.totalDistance, tolerance: row?.tolerance };
}

/**
 * A weekly answer as the rows of `start..end`: each row keyed by its week's
 * Sunday, every week the window touches kept. `weeklyRequest` asks those weeks
 * whole, so a week the window only starts in comes whole too: the week that
 * was current at the last sync before a gap (stored as it stood that day) is
 * brought up to date by the first window after it, whatever day that starts
 * on. A week two windows touch comes the same from both; the index keeps it
 * once, by its Sunday.
 */
export function weekRowsIn(rows: readonly RunningTolerance[], start: string, end: string): Array<DayRowInput<RunningToleranceWeekRow>> {
	const first = sundayOf(start);
	const out: Array<DayRowInput<RunningToleranceWeekRow>> = [];
	for (const raw of rows) {
		const row = rowOfWeek(raw);
		if (row && typeof row.date === "string" && row.date >= first && row.date <= end) out.push(row);
	}
	return out;
}

/**
 * The weekly request for a window: whole Sunday weeks, from the Sunday on or
 * before `start` to the Saturday on or after `end`. A window cut mid-week
 * would give a first row starting on the window's first day and a last row
 * holding only its days (`probe-weekly-midweek-…`: Oct 4–7 is 0 / 0). The
 * Saturday may be after today, which Garmin answers with the week so far
 * (`probe-weekly-future-…`). 350 days widen to 362 at most, inside the 366.
 */
export function weeklyRequest(start: string, end: string): { start: string; end: string } {
	return { start: sundayOf(start), end: shiftDate(sundayOf(end), 6) };
}

export const RUNNING_TOLERANCE_INDEX = defineDayIndex<RunningToleranceRow>({
	kind: "running-tolerance",
	// "Sync running tolerance history".
	title: "running tolerance",
	folder: "running-tolerance",
	version: 1,
	columns: { load: {}, distance: {}, tolerance: {}, phrase: { text: true } },
	// A day's row comes whole.
	keepOld: false,
	group: "training",
	// The cap is 366 days; a year a request is the day sync's chunk for this route.
	windowDays: 365,
	// A run synced late changes yesterday's row. Free when the run's own days cover both.
	refreshDays: 2,
	// Every day from 2025-08-17 has a row but two; the year before is [].
	emptyWindowsToStop: 1,
	// Garmin's order is arbitrary: the definition sorts.
	fetchWindow: async (api, start, end) => (await api.runningTolerance(start, end, "daily")).map(rowOfTolerance),
	// Free on a routine sync: the day's row of the range call it made anyway. A
	// day Garmin has no row for has `runningTolerance: null`, so it is covered with none.
	fromDay: { needs: ["runningTolerance"], read: (day) => (day.runningTolerance ? rowOfTolerance(day.runningTolerance) : null) },
});

export const RUNNING_TOLERANCE_WEEKS_INDEX = defineDayIndex<RunningToleranceWeekRow>({
	kind: "running-tolerance-weeks",
	// "Sync weekly running tolerance history".
	title: "weekly running tolerance",
	folder: "running-tolerance-weeks",
	listKey: "weeks",
	version: 1,
	columns: { from: { text: true }, to: { text: true }, load: {}, distance: {}, tolerance: {} },
	// A week's row comes whole.
	keepOld: false,
	group: "training",
	// Widened to whole weeks a window asks for 362 days at most; the cap is 366.
	windowDays: 350,
	// This week and last week, whatever the day: a late Saturday run and
	// today's runs land. One request a sync.
	refreshDays: 14,
	// The history begins 2025-08-17; the window before it is [].
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => {
		const ask = weeklyRequest(start, end);
		return weekRowsIn(await api.runningTolerance(ask.start, ask.end, "weekly"), start, end);
	},
	// No `fromDay`: the daily payload has no weekly totals.
});
