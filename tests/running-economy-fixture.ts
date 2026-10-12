import { addMonths, daysBetween, daysOf } from "../src/dashboard/periods";
import type { RunningEconomyScore } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import type { RunningEconomyRow } from "../src/sync/running-economy-index";

/*
 * The running economy history as Garmin sent it on 2026-10-12 at 14:50
 * (ref/performance-stats/running-economy/api-samples/daily-2024-10-10_2025-10-10.json
 * and probe-daily-366-2025-10-11_2026-10-11.json, merged): every reading, 87
 * days from 2025-08-16 to 2026-09-28, the README's "Fixture data" block
 * verbatim. `T` is TRAINED, the rest INTERMEDIATE.
 */
export const READINGS: readonly string[] = [
	"2025-08: 16 214T · 17 213T · 18 213T · 19 213T · 20 213T · 21 213T · 22 213T · 23 213T · 25 214T · 26 214T · 27 214T · 28 214T · 31 214T",
	"2025-09: 01 214T · 05 215 · 06 215 · 07 214T · 09 215 · 12 214T · 18 214T",
	"2025-10: 01 214T · 05 214T · 12 214T · 13 214T · 15 215 · 16 215 · 17 215 · 22 215 · 29 215",
	"2025-11: 01 215 · 03 215 · 04 215 · 05 215 · 06 215 · 09 215 · 10 215 · 16 215 · 23 215 · 25 215",
	"2025-12: 02 215 · 05 215 · 07 215 · 13 215",
	"2026-01: 15 214T",
	"2026-03: 18 215 · 24 216 · 27 216 · 28 216 · 30 217 · 31 218",
	"2026-04: 04 218 · 06 218 · 10 217 · 12 217 · 18 217 · 19 217 · 23 217 · 24 217 · 25 217 · 26 217 · 28 218",
	"2026-05: 01 218 · 02 218 · 03 218 · 07 218 · 08 218 · 10 218 · 12 218 · 17 218 · 21 218 · 24 218 · 30 218 · 31 219",
	"2026-06: 07 219 · 15 220 · 17 220 · 29 220 · 30 220",
	"2026-07: 13 220 · 27 221 · 30 221",
	"2026-09: 15 222 · 16 223 · 23 224 · 25 223 · 27 223 · 28 224",
];

/** `READINGS` as the index holds them, oldest first. */
export function economyRows(lines: readonly string[] = READINGS): RunningEconomyRow[] {
	return lines.flatMap((line) => {
		const [month, items] = line.split(": ");
		return items!.split(" · ").map((item) => {
			const [day, value] = item.split(" ");
			return { date: `${month}-${day}`, score: parseInt(value!, 10), classification: value!.endsWith("T") ? "TRAINED" : "INTERMEDIATE" };
		});
	});
}

export const ROWS: readonly RunningEconomyRow[] = economyRows();

/**
 * `runningeconomy/daily?startDate&endDate` as Garmin answers it: HTTP 400 past
 * one calendar year (`endDate` > `startDate` + 1 year: 367 days, or 368 across
 * Feb 29); `[]` for a window without a reading; otherwise a row for every
 * day, oldest first, score and classification null on the days without one.
 */
export function dailyPayload(start: string, end: string, rows: readonly RunningEconomyRow[] = ROWS): RunningEconomyScore[] {
	if (end > addMonths(start, 12) || daysBetween(start, end) < 0) throw new GarminApiError("HTTP 400", 400, "");
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const days = daysOf({ from: start, to: end });
	if (!days.some((d) => byDate.has(d))) return [];
	return days.map((d) => {
		const row = byDate.get(d);
		return { calendarDate: d, score: row?.score ?? null, classification: row?.classification ?? null };
	});
}

/**
 * Every `runningeconomy/weekly` payload seen: the 12 live ones of 2026-10-12
 * (api-samples/weekly-*, probe-weekly-*) and the web's two
 * (web/bodies/16-…-weekly.json, extra-runningeconomy-weekly-1y.json). Each is
 * its window, how many rows Garmin sent (a block every 7 days from
 * `startDate`, the last one clipped at `endDate`; none for a window without a
 * reading), and its scored blocks as `startDate=score`, `T` for TRAINED.
 * 124 scored blocks in all.
 */
export const WEEKLY: ReadonlyArray<readonly [start: string, end: string, rows: number, blocks: string, source: string]> = [
	["2026-07-20", "2026-10-11", 12, "2026-07-27=221 2026-09-14=222 2026-09-21=223 2026-09-28=224", "weekly-2026-07-20_2026-10-11 (the phone's 12w)"],
	[
		"2025-10-13",
		"2026-10-11",
		52,
		"2025-10-13=214T 2025-10-20=215 2025-10-27=215 2025-11-03=215 2025-11-10=215 2025-11-17=215 2025-11-24=215 2025-12-01=215 2025-12-08=215 " +
			"2026-01-12=214T 2026-03-16=215 2026-03-23=216 2026-03-30=217 2026-04-06=217 2026-04-13=217 2026-04-20=217 2026-04-27=218 2026-05-04=218 " +
			"2026-05-11=218 2026-05-18=218 2026-05-25=218 2026-06-01=219 2026-06-15=220 2026-06-29=220 2026-07-13=220 2026-07-27=221 2026-09-14=222 " +
			"2026-09-21=223 2026-09-28=224",
		"weekly-2025-10-13_2026-10-11 (the phone's 1y)",
	],
	["2026-07-21", "2026-10-12", 12, "2026-07-21=221 2026-07-28=221 2026-09-15=222 2026-09-22=223", "weekly-2026-07-21_2026-10-12 (Tuesday blocks)"],
	[
		"2026-04-27",
		"2026-07-19",
		12,
		"2026-04-27=218 2026-05-04=218 2026-05-11=218 2026-05-18=218 2026-05-25=218 2026-06-01=219 2026-06-15=220 2026-06-29=220 2026-07-13=220",
		"weekly-12wprev-2026-04-27_2026-07-19 (the web's 12 Weeks −1)",
	],
	[
		"2024-10-12",
		"2025-10-11",
		53,
		"2025-08-16=213T 2025-08-23=213T 2025-08-30=214T 2025-09-06=214T 2025-09-13=214T 2025-09-27=214T 2025-10-04=214T",
		"weekly-1yprev-2024-10-12_2025-10-11 (the web's 1 Year −1)",
	],
	[
		"2025-10-11",
		"2026-10-11",
		53,
		"2025-10-11=214T 2025-10-18=215 2025-10-25=215 2025-11-01=215 2025-11-08=215 2025-11-15=215 2025-11-22=215 2025-11-29=215 2025-12-06=215 " +
			"2025-12-13=215 2026-01-10=214T 2026-03-14=215 2026-03-21=216 2026-03-28=216 2026-04-04=217 2026-04-11=217 2026-04-18=217 2026-04-25=217 " +
			"2026-05-02=218 2026-05-09=218 2026-05-16=218 2026-05-23=218 2026-05-30=218 2026-06-06=219 2026-06-13=220 2026-06-27=220 2026-07-11=220 " +
			"2026-07-25=221 2026-09-12=222 2026-09-19=223 2026-09-26=223",
		"weekly-cap366-2025-10-11_2026-10-11 (Saturday blocks, 366 days)",
	],
	["2026-09-14", "2026-09-24", 2, "2026-09-14=222 2026-09-21=224", "probe-weekly-clip (the last block clipped at endDate)"],
	["2026-08-03", "2026-09-13", 0, "", "probe-weekly-empty"],
	["2026-03-28", "2026-03-28", 1, "2026-03-28=216", "probe-weekly-2026-03-28_2026-03-28"],
	["2026-03-30", "2026-03-30", 1, "2026-03-30=217", "probe-weekly-2026-03-30_2026-03-30"],
	["2026-03-31", "2026-03-31", 1, "2026-03-31=218", "probe-weekly-2026-03-31_2026-03-31"],
	["2026-03-28", "2026-03-31", 1, "2026-03-28=216", "probe-weekly-2026-03-28_2026-03-31"],
	["2026-07-20", "2026-10-11", 12, "2026-07-27=221 2026-09-14=222 2026-09-21=223 2026-09-28=224", "web 16-…-weekly (12 Weeks)"],
	[
		"2025-10-12",
		"2026-10-11",
		53,
		"2025-10-12=214T 2025-10-19=215 2025-10-26=215 2025-11-02=215 2025-11-09=215 2025-11-16=215 2025-11-23=215 2025-11-30=215 2025-12-07=215 " +
			"2026-01-11=214T 2026-03-15=215 2026-03-22=216 2026-03-29=217 2026-04-05=217 2026-04-12=217 2026-04-19=217 2026-04-26=217 2026-05-03=218 " +
			"2026-05-10=218 2026-05-17=218 2026-05-24=218 2026-05-31=219 2026-06-07=219 2026-06-14=220 2026-06-28=220 2026-07-12=220 2026-07-26=221 " +
			"2026-09-13=222 2026-09-20=223 2026-09-27=223",
		"web extra-…-weekly-1y (1 Year, Sunday blocks)",
	],
];

/** `runningeconomy/latest/{date}` as sampled: the newest reading on or before the day; `null` (HTTP 204) before the first. */
export const LATEST: Readonly<Record<string, RunningEconomyScore | null>> = {
	"2026-10-12": { calendarDate: "2026-09-28", score: 224, classification: "INTERMEDIATE" },
	"2026-10-11": { calendarDate: "2026-09-28", score: 224, classification: "INTERMEDIATE" },
	"2026-09-27": { calendarDate: "2026-09-27", score: 223, classification: "INTERMEDIATE" },
	"2026-09-14": { calendarDate: "2026-07-30", score: 221, classification: "INTERMEDIATE" },
	"2025-08-16": { calendarDate: "2025-08-16", score: 214, classification: "TRAINED" },
	"2025-08-15": null,
};
