import type { BiometricChange } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * FTP: the day index the page's 4w, 12w and 1y read, and the Running Lactate
 * Threshold page's power series (ref/performance-stats/ftp/README.md).
 *
 * Garmin keeps FTP as change points: a row per day and sport on which it
 * recomputed power-to-weight. That happens when the sport's FTP changed, or
 * when a weigh-in was logged; a weigh-in gives every sport a row, its FTP
 * unchanged (2025-08-02, 08-03, 10-13, 11-02 and 2026-10-08 here). So the
 * index has a row only on those days, and a sport only on its own.
 *
 * - Two routes a window, one after the other, both without a sport, so each
 *   carries every sport with `series` naming it (`cycling`,
 *   `cross_country_skiing`, `running`):
 *   `stats/functionalThresholdPower/range` (watts, daily and LATEST) and
 *   `stats/powerToWeight/range?aggregation=daily` (W/kg). Their rows pair one
 *   to one (same day, same series) and are merged by day. If either throws,
 *   the window fails and is asked again.
 * - A W/kg keeps the weight of its own day (67.0 kg to 2025-10-08, 67.199 on
 *   10-13, 68.0 from 11-02): the 1y's first W/kg dot is 274 ÷ 67.199 = 4.0774,
 *   the next 274 ÷ 68 = 4.0294. Kept to 4 dp, the watts whole.
 * - `running` is the lactate threshold power: the Running Lactate Threshold
 *   page's Power (W) and Power (W/kg) views read it from here.
 * - Cap: end − start ≤ 366 days (367 calendar days; 368 is HTTP 400, across
 *   Feb 29 too), so a window is 367 days. An empty window is `[]`. The
 *   history starts 2025-08-02: 35 rows, in the two newest windows, and two
 *   empty windows end the walk — four windows, eight requests, once.
 * - No `fromDay`: the day sync never asks these routes, so a routine sync asks
 *   one window for its days (and any stretch since the index's newest): two
 *   requests a sync, which the engine books as such (`requestsPerWindow`).
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface FtpRow {
	/** The local calendar day of the change, `YYYY-MM-DD`. */
	date: string;
	/** Cycling FTP, W. */
	cycling?: number;
	/** Cycling FTP ÷ the day's weight, W/kg to 4 dp. */
	cyclingWkg?: number;
	/** Cross-country skiing FTP, W. */
	xc?: number;
	xcWkg?: number;
	/** Running lactate threshold power, W (the Running Lactate Threshold page's). */
	running?: number;
	runningWkg?: number;
}

/** A sport's watts column; its W/kg column is the same name plus `Wkg`. */
export type FtpSeries = "cycling" | "xc" | "running";

/** Garmin's `series` → the sport's column. */
export const FTP_SERIES: Readonly<Record<string, FtpSeries>> = {
	cycling: "cycling",
	cross_country_skiing: "xc",
	running: "running",
};

/** The W/kg column of each sport. */
export const WKG_COLUMN = { cycling: "cyclingWkg", xc: "xcWkg", running: "runningWkg" } as const satisfies Record<FtpSeries, keyof FtpRow>;

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** A change's day: `from`, which daily aggregation sets to the change day, else `updatedDate`. */
function dayOf(change: BiometricChange): string | undefined {
	for (const value of [change.from, change.updatedDate]) {
		if (typeof value === "string" && DAY.test(value)) return value.slice(0, 10);
	}
	return undefined;
}

/**
 * A window's two payloads as index rows, one a day, oldest first: each
 * sport's watts from `watts` and its W/kg from `wkg`, by day and series. A
 * series this build doesn't know (none seen) is left out; the definition
 * drops what is null.
 */
export function rowsOfRanges(
	watts: ReadonlyArray<BiometricChange | null> | null | undefined,
	wkg: ReadonlyArray<BiometricChange | null> | null | undefined,
): Array<DayRowInput<FtpRow>> {
	const days = new Map<string, Record<string, unknown>>();
	const put = (changes: ReadonlyArray<BiometricChange | null> | null | undefined, ratio: boolean) => {
		for (const change of changes ?? []) {
			if (!change || typeof change !== "object") continue;
			const sport = FTP_SERIES[String(change.series ?? "").toLowerCase()];
			const date = dayOf(change);
			if (!sport || !date) continue;
			const row = days.get(date) ?? { date };
			row[ratio ? WKG_COLUMN[sport] : sport] = change.value;
			days.set(date, row);
		}
	};
	put(watts, false);
	put(wkg, true);
	return [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, row]) => row);
}

export const FTP_INDEX = defineDayIndex<FtpRow>({
	kind: "ftp",
	// "Sync FTP history".
	title: "FTP",
	folder: "ftp",
	version: 1,
	columns: {
		cycling: {},
		cyclingWkg: { precision: 4 },
		xc: {},
		xcWkg: { precision: 4 },
		running: {},
		runningWkg: { precision: 4 },
	},
	// Both payloads carry every sport of a day, so a day's row comes whole.
	keepOld: false,
	group: "fitness",
	// The cap: end − start ≤ 366 days.
	windowDays: 367,
	// The watts, then the W/kg.
	requestsPerWindow: 2,
	// No row was revised across three fetches; a routine sync asks for its own days anyway.
	refreshDays: 0,
	// A sport can go a year without a change (cycling 2025-11-02 → 2026-10-08,
	// 340 days); weigh-ins and running fill that gap here, but another account
	// could have a whole empty window inside its history.
	emptyWindowsToStop: 2,
	fetchWindow: async (api, start, end) => {
		const watts = await api.functionalThresholdPowerRange(start, end);
		const wkg = await api.powerToWeightRange(start, end, "daily");
		return rowsOfRanges(watts, wkg);
	},
});
