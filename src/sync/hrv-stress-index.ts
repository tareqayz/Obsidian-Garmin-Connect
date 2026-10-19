import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * HRV Stress: the day index the HRV Stress page's 7d and 4w read
 * (ref/performance-stats/hrv-stress/README.md, "Data plan"). Blood
 * Pressure's pattern (`blood-pressure-index.ts`): a route without a cap, so
 * one window is ten years and holds the whole history.
 *
 * The account the spec was captured from has never run an HRV stress test
 * (it needs a chest strap and a manual test on the watch): every window, the
 * whole history included, answered `[]`. A test's shape is unknown, so the
 * mapper is Inferred from the route's name ("manual stress level") and the
 * web Help (a score of 0 to 100):
 *
 * - `score`: the first whole number in 0–100 among `stressLevel`,
 *   `stressScore`, `hrvStressScore`, `manualStressLevel`, `value`;
 * - the day: `calendarDate`, else the first 10 characters of a local
 *   timestamp (`timestampLocal`, `startTimestampLocal`);
 * - several tests on a day: the last wins — by their local timestamps where
 *   they have them, else in the route's order — and `n` counts them.
 *
 * `{"date":"2026-10-08","score":42,"n":1}`.
 *
 * - One route a window: `hrvStressDaily(start, end)`, keyed by the profile's
 *   numeric id. `[]` (and a null body) is no rows. An error — a 5xx, the
 *   network, a profile without a numeric id — throws, so the window fails
 *   and is asked again and the index stays incomplete: an error never reads
 *   as "no data".
 * - No cap (7 days to 2000-01-01..2026-10-11 all answer), so a window is
 *   `MAX_WINDOW_DAYS`, 3660 days, and one empty window ends the walk: only
 *   ten years without a test end a history early. On the recording account
 *   the walk asks 2016-10-04..2026-10-11, `[]`: complete with no rows after
 *   one request, once.
 * - No `fromDay`: the day sync never asks this route, so a routine sync asks
 *   one window for its days (and any stretch since the index's newest day):
 *   one request a sync.
 *
 * Bump `version` when the first real test fixes the mapper, so the history
 * is fetched again.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface HrvStressRow {
	/** The local calendar day of the test, `YYYY-MM-DD` (Inferred). */
	date: string;
	/** The day's last score, 0–100, lower meaning readier for hard training (Inferred). */
	score?: number;
	/** Tests that day (Inferred: when the route sends a row a test). */
	n?: number;
}

type Rec = Record<string, unknown>;

/** Where a test's score may be, in order (Inferred). */
export const HRV_STRESS_SCORE_KEYS: readonly string[] = ["stressLevel", "stressScore", "hrvStressScore", "manualStressLevel", "value"];

/** Where its local time may be, in order, when it has no `calendarDate` (Inferred). */
export const HRV_STRESS_TIME_KEYS: readonly string[] = ["timestampLocal", "startTimestampLocal"];

/** The scale the web Help gives: "HRV stress is rated on a scale of 0 to 100". */
export const HRV_STRESS_MAX = 100;

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A test's score: the first whole number in 0–100 among `HRV_STRESS_SCORE_KEYS`. */
export function hrvStressScoreOf(entry: Rec): number | undefined {
	for (const key of HRV_STRESS_SCORE_KEYS) {
		const value = entry[key];
		if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= HRV_STRESS_MAX) return value;
	}
	return undefined;
}

/** A test's local time, `YYYY-MM-DDThh:mm…`, when it has one. */
function localTimeOf(entry: Rec): string | undefined {
	for (const key of HRV_STRESS_TIME_KEYS) {
		const value = entry[key];
		if (typeof value === "string" && DAY.test(value)) return value;
	}
	return undefined;
}

/** A test's day: its `calendarDate`, else its local time's. */
function dayOf(entry: Rec): string | undefined {
	const date = entry.calendarDate;
	if (typeof date === "string" && DAY.test(date)) return date.slice(0, 10);
	return localTimeOf(entry)?.slice(0, 10);
}

/**
 * A window's payload as index rows, one a day, oldest first: the day's last
 * score and how many tests it had (Inferred field names; see the module's
 * doc). `[]`, and a null body, are no rows.
 */
export function rowsOfHrvStress(payload: ReadonlyArray<Rec | null> | null | undefined): Array<DayRowInput<HrvStressRow>> {
	const tests: Array<{ date: string; at: string; i: number; score: number }> = [];
	(payload ?? []).forEach((entry, i) => {
		if (!entry || typeof entry !== "object") return;
		const date = dayOf(entry);
		const score = hrvStressScoreOf(entry);
		if (date && score !== undefined) tests.push({ date, at: localTimeOf(entry) ?? "", i, score });
	});
	// A day's tests in the order they were taken, where they say; the route's order otherwise.
	tests.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.at < b.at ? -1 : a.at > b.at ? 1 : a.i - b.i));
	const days = new Map<string, { score: number; n: number }>();
	for (const test of tests) days.set(test.date, { score: test.score, n: (days.get(test.date)?.n ?? 0) + 1 });
	return [...days.entries()].map(([date, day]) => ({ date, score: day.score, n: day.n }));
}

export const HRV_STRESS_INDEX = defineDayIndex<HrvStressRow>({
	kind: "hrv-stress",
	// "Sync HRV stress history".
	title: "HRV stress",
	folder: "hrv-stress",
	// Bump when the first real test fixes the mapper.
	version: 1,
	columns: { score: {}, n: {} },
	// A day's tests come whole.
	keepOld: false,
	group: "hrv",
	// No cap: the whole history in one request.
	windowDays: 3660,
	// Nothing says tests are revised; a routine sync asks for its own days anyway.
	refreshDays: 0,
	// One window is ten years: only ten years without a test end a history early.
	emptyWindowsToStop: 1,
	fetchWindow: async (api, start, end) => rowsOfHrvStress(await api.hrvStressDaily(start, end)),
});
