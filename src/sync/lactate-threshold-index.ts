import type { BiometricChange } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Running lactate threshold: the day index the Running Lactate Threshold
 * page's 4w, 12w and 1y read for heart rate and pace
 * (ref/performance-stats/running-lactate-threshold/README.md, "Data plan").
 * Its power views read the FTP index's `running` / `runningWkg` columns
 * (`ftp-index.ts`), and Current reads `account.json`.
 *
 * Garmin keeps the threshold as change points: a row on each day it saved a
 * new running lactate threshold estimate. The heart rate and speed routes
 * always have rows on the same days, and a value can repeat (2025-09-01,
 * 09-06 and 09-15 are all 168 bpm). So the index has a row only on those
 * days, holding both.
 *
 * - Two routes a window, one after the other, both daily + LATEST +
 *   RUNNING: `stats/lactateThresholdHeartRate/range` (bpm) and
 *   `stats/lactateThresholdSpeed/range` (tenths of m/s). Merged by day
 *   (`from`, which daily aggregation sets to the change day). If either
 *   throws, the window fails and is asked again.
 * - Speed is kept in m/s, Garmin's value × 10, to 5 dp: 0.37222118 →
 *   3.72221, 268.66 s/km (4:29 /km); 5 dp keeps a pace within 0.0004 s/km.
 * - Cap: end − start ≤ 366 days (367 calendar days; 368 is HTTP 400, across
 *   Feb 29 too), so a window is 367 days. A window without a change is `[]`;
 *   nothing is carried in from before it. The history starts 2025-08-03: 40
 *   rows to 2026-10-11, 28 in the newest window and 12 in the one before,
 *   and two empty windows end the walk — four windows, eight requests, once.
 * - No `fromDay`: the day sync never asks these routes, so a routine sync
 *   asks one window for its days (and any stretch since the index's newest):
 *   two requests a sync, which the engine books as such (`requestsPerWindow`).
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface LactateThresholdRow {
	/** The local calendar day Garmin saved the estimate, `YYYY-MM-DD`. */
	date: string;
	/** Heart rate at the threshold, bpm. */
	hr?: number;
	/** Speed at the threshold, m/s to 5 dp (Garmin's value × 10): pace = 1000 ÷ speed s/km. */
	speed?: number;
}

/** The only series these routes carry, asked with `sport=RUNNING`. */
const SERIES = "running";

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A change's day: `from`, which daily aggregation sets to the change day, else `updatedDate`. */
function dayOf(change: BiometricChange): string | undefined {
	for (const value of [change.from, change.updatedDate]) {
		if (typeof value === "string" && DAY.test(value)) return value.slice(0, 10);
	}
	return undefined;
}

/**
 * A window's two payloads as index rows, one a day, oldest first: the heart
 * rate from `heartRate`, the speed from `speed` × 10 (m/s). A row of another
 * series (none seen: the routes are asked for running) is left out, and a
 * day either payload lacks keeps what the other gave; the definition drops
 * what is null.
 */
export function thresholdRows(
	heartRate: ReadonlyArray<BiometricChange | null> | null | undefined,
	speed: ReadonlyArray<BiometricChange | null> | null | undefined,
): Array<DayRowInput<LactateThresholdRow>> {
	const days = new Map<string, Record<string, unknown>>();
	const put = (changes: ReadonlyArray<BiometricChange | null> | null | undefined, column: "hr" | "speed") => {
		for (const change of changes ?? []) {
			if (!change || typeof change !== "object") continue;
			const series = change.series;
			if (series !== undefined && series !== null && String(series).toLowerCase() !== SERIES) continue;
			const date = dayOf(change);
			if (!date) continue;
			const row = days.get(date) ?? { date };
			const value = change.value;
			row[column] = column === "speed" && typeof value === "number" ? value * 10 : value;
			days.set(date, row);
		}
	};
	put(heartRate, "hr");
	put(speed, "speed");
	return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, row]) => row);
}

export const LACTATE_THRESHOLD_INDEX = defineDayIndex<LactateThresholdRow>({
	kind: "lactate-threshold",
	// "Sync lactate threshold history".
	title: "lactate threshold",
	folder: "lactate-threshold",
	version: 1,
	columns: {
		hr: {},
		speed: { precision: 5 },
	},
	// Heart rate and speed always come on the same days, so a day's row comes whole.
	keepOld: false,
	group: "fitness",
	// The cap: end − start ≤ 366 days.
	windowDays: 367,
	// The heart rate, then the speed.
	requestsPerWindow: 2,
	// No row was revised between the sweep, the web capture and the live rows; a routine sync asks for its own days anyway.
	refreshDays: 0,
	// An athlete can go months without a new estimate (here 39 days at most,
	// 2025-12-07 → 2026-01-15), and another account could have a whole empty
	// window inside its history.
	emptyWindowsToStop: 2,
	fetchWindow: async (api, start, end) => {
		const heartRate = await api.lactateThresholdHeartRateRange(start, end);
		const speed = await api.lactateThresholdSpeedRange(start, end);
		return thresholdRows(heartRate, speed);
	},
});
