import { defineDayIndex, type DayRowInput } from "./day-index";
import type { MaxMetricsData } from "./metrics";

/**
 * VO₂ Max: the day index every view of the page reads — Current's newest
 * reading and the 4w / 12w / 6m lines (ref/performance-stats/vo2-max/README.md).
 *
 * One endpoint feeds it all: `maxmet/daily/{start}/{end}` (`GarminApi.maxMetrics`),
 * which the day sync already asks once per run for the `fitness` group. It has
 * no range cap (3660 days returned the whole history, 161 rows from
 * 2025-08-03) and sends a row only on a day with a running or cycling reading,
 * so the index has a row only on those days. Days with heat acclimation but no
 * VO₂ reading are left out (2026-10-04..09 → `[]`), which is why the heat
 * fields are not kept here: Heat Acclimation needs a daily source of its own.
 *
 * - A row's day is its readings': `generic.calendarDate`, else
 *   `cycling.calendarDate` (cycling-only days have `generic: null`). The row
 *   has no date of its own, and its acclimation block's can be a day later
 *   (`maxmet/weekly`'s 2026-08-01 row says 08-02 there).
 * - `vo2` is the precise value (1 dp) the charts plot and the class grades;
 *   `vo2Value` is Garmin's integer, the dial's number. It is rounded from the
 *   unrounded value, so an x.5 goes either way (55.5 → 56 on 2026-04-23, → 55
 *   on 04-25): keep both. `cycling` and `cyclingValue` are the same for the
 *   Cycling tab.
 * - Routine syncs feed it for free (`fromDay`), from the range call they make
 *   anyway; a history walk asks a year a request.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface Vo2MaxRow {
	/** The local calendar day of the readings, `YYYY-MM-DD`. */
	date: string;
	/** The running reading (the "VO₂ Max" tab), 1 dp: `generic.vo2MaxPreciseValue`. */
	vo2?: number;
	/** Garmin's integer for it, the dial's number: `generic.vo2MaxValue`. */
	vo2Value?: number;
	/** The cycling reading (the "Cycling" tab), 1 dp: `cycling.vo2MaxPreciseValue`. */
	cycling?: number;
	/** Garmin's integer for it: `cycling.vo2MaxValue`. */
	cyclingValue?: number;
}

/** What the mapper reads of a `maxmet/daily` row, as the API wrapper and the day sync both type it. */
export type MaxMetricsRow = Pick<MaxMetricsData, "generic" | "cycling">;

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** The day a max-metrics row's readings are from: the running reading's, else the cycling one's. */
export function vo2DateOf(row: MaxMetricsRow | null | undefined): string | undefined {
	for (const date of [row?.generic?.calendarDate, row?.cycling?.calendarDate]) {
		if (typeof date === "string" && DAY.test(date)) return date.slice(0, 10);
	}
	return undefined;
}

/** A `maxmet/daily` row as an index row; the definition drops what is null or missing. */
export function rowOfMaxMetrics(row: MaxMetricsRow | null | undefined): DayRowInput<Vo2MaxRow> {
	return {
		date: vo2DateOf(row),
		vo2: row?.generic?.vo2MaxPreciseValue,
		vo2Value: row?.generic?.vo2MaxValue,
		cycling: row?.cycling?.vo2MaxPreciseValue,
		cyclingValue: row?.cycling?.vo2MaxValue,
	};
}

export const VO2_MAX_INDEX = defineDayIndex<Vo2MaxRow>({
	kind: "vo2-max",
	// "Sync VO₂ max history".
	title: "VO₂ max",
	folder: "vo2-max",
	version: 1,
	columns: { vo2: { precision: 1 }, vo2Value: {}, cycling: { precision: 1 }, cyclingValue: {} },
	// A day's row comes whole.
	keepOld: false,
	group: "fitness",
	// No cap was found up to 3660 days; a year a request matches the day sync's
	// chunks for this route (`RANGE_CHUNK_DAYS`). The history is two requests.
	windowDays: 365,
	// The run's own days come through `fromDay`; no reading was revised across three fetches.
	refreshDays: 0,
	// The longest gap inside the history is 15 days: an empty year ends it.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => (await api.maxMetrics(start, end)).map(rowOfMaxMetrics),
	// Free on a routine sync: the day's row of the range call it made anyway. A
	// day without a reading has `maxMetrics: null`, so it is covered with no row.
	fromDay: { needs: ["maxMetrics"], read: (day) => (day.maxMetrics ? rowOfMaxMetrics(day.maxMetrics) : null) },
});
