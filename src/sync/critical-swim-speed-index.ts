import type { CriticalSwimSpeedRange } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Critical Swim Speed: the day index every view of the Critical Swim Speed
 * page reads, Current included
 * (ref/performance-stats/critical-swim-speed/README.md, "Data plan").
 *
 * The account the spec was captured from has never had a CSS result: every
 * phone shot, web state and live call was empty — `latest/{date}` HTTP 204,
 * `range` `{from, until, criticalSwimSpeedDTOList: [], aggregatedResults:
 * []}`. A result's shape is unknown, so the mapper is Inferred from the
 * route's names and its siblings' (`calendarDate`; m/s, or the lactate
 * threshold speed's tenths of m/s):
 *
 * - the entries of `criticalSwimSpeedDTOList`, else `aggregatedResults`';
 * - an entry's day from `calendarDate`, else `updatedDate`, else `from`
 *   (the first 10 characters);
 * - its value from the first number among `criticalSwimSpeed`, `speed`,
 *   `value`, `swimSpeed`, read by its size: 0.3–2.5 is m/s; 0.03–0.25 tenths
 *   of m/s (× 10); 40–320 seconds per 100 m (speed = 100 ÷ value); anything
 *   else is dropped;
 * - the last entry of a day wins.
 *
 * Kept as m/s to 4 dp: pace = 100 ÷ speed s/100m, within 0.01 s.
 * `{"date":"2026-10-08","speed":1.0256}` is 97.5 s, "1:38".
 *
 * - One route a window, the bare (daily) path: `criticalSwimSpeedRange(start,
 *   end)`. A null body is no rows. An error — HTTP 400 past the cap, a 5xx,
 *   the network — throws, so the window fails and is asked again and the
 *   index stays incomplete: an error never reads as "no data".
 * - Cap: end − start ≤ 366 days (367 calendar days; 368 is HTTP 400, across
 *   Feb 29 too), so a window is 367 days.
 * - Two empty windows end the walk: a swimmer can go a year without a test
 *   (Garmin suggests one every eight weeks). On the recording account the
 *   walk asks 2025-10-10..2026-10-11 and 2024-10-08..2025-10-09, both empty:
 *   complete with no rows after two requests, once.
 * - No `fromDay`: the day sync never asks this route, so a routine sync asks
 *   one window for its days (and any stretch since the index's newest day):
 *   one request a sync.
 * - Current is the newest row on or before today: the page asks nothing of
 *   `latest`.
 *
 * Bump `version` when the first real result fixes the mapper, so the history
 * is fetched again.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface CriticalSwimSpeedRow {
	/** The local calendar day of the result, `YYYY-MM-DD` (Inferred). */
	date: string;
	/** Critical swim speed, m/s to 4 dp: pace = 100 ÷ speed seconds per 100 m. */
	speed?: number;
}

type Rec = Record<string, unknown>;

/** Where an entry's day may be, in order (Inferred). */
export const CSS_DATE_KEYS: readonly string[] = ["calendarDate", "updatedDate", "from"];

/** Where its value may be, in order (Inferred). */
export const CSS_VALUE_KEYS: readonly string[] = ["criticalSwimSpeed", "speed", "value", "swimSpeed"];

const DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * A value as m/s, read by its size: 0.3–2.5 m/s (5:33 to 0:40 per 100 m) as
 * is; 0.03–0.25 is tenths of m/s, × 10; 40–320 is seconds per 100 m, 100 ÷
 * it. Anything else is no speed.
 */
export function swimSpeedOf(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	if (value >= 0.3 && value <= 2.5) return value;
	if (value >= 0.03 && value <= 0.25) return value * 10;
	if (value >= 40 && value <= 320) return 100 / value;
	return undefined;
}

/** An entry's day: the first of `CSS_DATE_KEYS` that starts with one. */
function dayOf(entry: Rec): string | undefined {
	for (const key of CSS_DATE_KEYS) {
		const value = entry[key];
		if (typeof value === "string" && DAY.test(value)) return value.slice(0, 10);
	}
	return undefined;
}

/** An entry's speed: the first number among `CSS_VALUE_KEYS`, read by its size. */
function speedOf(entry: Rec): number | undefined {
	const value = CSS_VALUE_KEYS.map((key) => entry[key]).find((v) => typeof v === "number" && Number.isFinite(v));
	return swimSpeedOf(value);
}

const listOf = (list: unknown): unknown[] => (Array.isArray(list) ? list : []);

/**
 * A window's payload as index rows, one a day, oldest first (Inferred field
 * names; see the module's doc). The empty answer, and a null body, are no
 * rows.
 */
export function rowsOfCriticalSwimSpeed(payload: CriticalSwimSpeedRange | null | undefined): Array<DayRowInput<CriticalSwimSpeedRow>> {
	const results = listOf(payload?.criticalSwimSpeedDTOList);
	const entries = results.length ? results : listOf(payload?.aggregatedResults);
	const days = new Map<string, number>();
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const date = dayOf(entry as Rec);
		const speed = speedOf(entry as Rec);
		if (date && speed !== undefined) days.set(date, speed);
	}
	return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([date, speed]) => ({ date, speed }));
}

export const CRITICAL_SWIM_SPEED_INDEX = defineDayIndex<CriticalSwimSpeedRow>({
	kind: "critical-swim-speed",
	// "Sync critical swim speed history".
	title: "critical swim speed",
	folder: "critical-swim-speed",
	// Bump when the first real result fixes the mapper.
	version: 1,
	columns: { speed: { precision: 4 } },
	// A day's result comes whole.
	keepOld: false,
	group: "workouts",
	// The cap: end − start ≤ 366 days.
	windowDays: 367,
	// Nothing says results are revised; a routine sync asks for its own days anyway.
	refreshDays: 0,
	// A swimmer can go a year without a test: two empty windows keep a history with a one-year gap.
	emptyWindowsToStop: 2,
	fetchWindow: async (api, start, end) => rowsOfCriticalSwimSpeed(await api.criticalSwimSpeedRange(start, end)),
});
