import type { RunningTolerance } from "../src/garmin/endpoints";
import {
	RUNNING_TOLERANCE_INDEX,
	RUNNING_TOLERANCE_WEEKS_INDEX,
	rowOfTolerance,
	rowOfWeek,
	type RunningToleranceRow,
	type RunningToleranceWeekRow,
} from "../src/sync/running-tolerance-index";

/**
 * Running Tolerance as Garmin sent it for this vault's history
 * (ref/performance-stats/running-tolerance/api-samples/), the account id
 * left out.
 *
 * - Every weekly row, 61 Sunday weeks from the history's first (2025-08-17):
 *   `stats-weekly-2024-10-20_2025-10-18.json` (9 rows) and
 *   `stats-weekly-2025-10-19_2026-10-11.json` (52, the phone's 1y; equal to
 *   the 22:29 12w sample and the 12w −1 call on every shared week). The
 *   current week is Sunday 2026-10-11 alone. Jul 19 – Sep 12, 2026 hold
 *   Garmin's six weeks that disagree with its daily rows, as sent.
 * - The daily rows of Oct 5–12, 2026 in the order Garmin sent them
 *   (`probe-daily-today-2026-10-05_2026-10-12.json`; the 28-day sample agrees
 *   on every shared day).
 * - The days with a daily row: 2025-08-17 → 2026-10-12 but 2025-10-11 and
 *   2026-01-22, 420 (`probe-daily-366-…` twice, and Oct 12).
 */

/** `startOfWeek endOfWeek totalImpactLoad totalDistance tolerance`, metres. */
export const WEEKS = `
2025-08-17 2025-08-23 70170 60308 63393
2025-08-24 2025-08-30 75700 69321 79244
2025-08-31 2025-09-06 77750 61898 89466
2025-09-07 2025-09-13 71130 57911 96220
2025-09-14 2025-09-20 68280 61185 98639
2025-09-21 2025-09-27 51000 42596 99691
2025-09-28 2025-10-04 68570 49130 96482
2025-10-05 2025-10-10 50380 41924 97731
2025-10-12 2025-10-18 72770 68607 95494
2025-10-19 2025-10-25 32600 26437 93824
2025-10-26 2025-11-01 44050 35290 90622
2025-11-02 2025-11-08 63240 56454 89116
2025-11-09 2025-11-15 57650 49750 102103
2025-11-16 2025-11-22 48520 43695 99354
2025-11-23 2025-11-29 44290 42418 96217
2025-11-30 2025-12-06 34310 32774 92005
2025-12-07 2025-12-13 37670 33518 89596
2025-12-14 2025-12-20 13500 13463 82092
2025-12-21 2025-12-27 7800 7395 74231
2025-12-28 2026-01-03 29660 25314 66605
2026-01-04 2026-01-10 0 0 63729
2026-01-11 2026-01-17 10640 8770 57450
2026-01-18 2026-01-24 36210 28028 52330
2026-01-25 2026-01-31 40930 33213 52417
2026-02-01 2026-02-07 20420 14847 52879
2026-02-08 2026-02-14 26010 23381 50968
2026-02-15 2026-02-21 41020 35822 49830
2026-02-22 2026-02-28 0 0 48272
2026-03-01 2026-03-07 0 0 43792
2026-03-08 2026-03-14 35490 31827 41749
2026-03-15 2026-03-21 23650 21227 41645
2026-03-22 2026-03-28 48710 43650 41365
2026-03-29 2026-04-04 37000 34657 41723
2026-04-05 2026-04-11 45660 44373 42112
2026-04-12 2026-04-18 39480 35497 42805
2026-04-19 2026-04-25 60910 57292 43579
2026-04-26 2026-05-02 45260 42166 46921
2026-05-03 2026-05-09 26630 24886 47735
2026-05-10 2026-05-16 21830 20203 46166
2026-05-17 2026-05-23 21880 21445 44783
2026-05-24 2026-05-30 22330 20282 43761
2026-05-31 2026-06-06 12290 8847 41663
2026-06-07 2026-06-13 18410 18170 40351
2026-06-14 2026-06-20 23550 20465 40226
2026-06-21 2026-06-27 5110 4502 38971
2026-06-28 2026-07-04 32460 26651 40348
2026-07-05 2026-07-11 13670 11709 39574
2026-07-12 2026-07-18 7800 6545 38644
2026-07-19 2026-07-25 30040 19964 36128
2026-07-26 2026-08-01 21450 20185 37250
2026-08-02 2026-08-08 24580 23080 35752
2026-08-09 2026-08-15 11460 10337 36050
2026-08-16 2026-08-22 40530 37453 36968
2026-08-23 2026-08-29 24580 23080 35776
2026-08-30 2026-09-05 29060 21246 38016
2026-09-06 2026-09-12 29060 21246 36670
2026-09-13 2026-09-19 18230 16427 37507
2026-09-20 2026-09-26 23076 20705 37561
2026-09-27 2026-10-03 28140 25185 37489
2026-10-04 2026-10-10 10590 10009 37734
2026-10-11 2026-10-11 14150 12469 37070
`;

/** Garmin's weekIndex: whole weeks from Sunday 1989-12-31 to the week's Sunday. */
export function weekIndexOf(sunday: string): number {
	return Math.round((Date.parse(`${sunday}T00:00:00Z`) - Date.parse("1989-12-31T00:00:00Z")) / (7 * 86_400_000));
}

/** The weekly rows as Garmin sends them, oldest first: `calendarDate` = `endOfWeek`, every week whole. */
export function weekPayloads(): RunningTolerance[] {
	return WEEKS.trim()
		.split("\n")
		.map((line) => {
			const [from, to, load, distance, tolerance] = line.trim().split(/\s+/);
			return {
				userProfilePK: 1,
				calendarDate: to!,
				totalImpactLoad: Number(load),
				totalDistance: Number(distance),
				tolerance: Number(tolerance),
				startOfWeek: from!,
				endOfWeek: to!,
				weekIndex: weekIndexOf(from!),
			};
		});
}

/** The weekly index's rows, oldest first, as `readIndex("running-tolerance-weeks")` gives them. */
export function weekRows(): RunningToleranceWeekRow[] {
	return weekPayloads().map((p) => RUNNING_TOLERANCE_WEEKS_INDEX.normalize(rowOfWeek(p))!);
}

/** `probe-daily-today-2026-10-05_2026-10-12.json`, in Garmin's order. */
export const DAILY_OCT_5_12: readonly RunningTolerance[] = [
	{ userProfilePK: 1, calendarDate: "2026-10-11", acuteImpactLoad: 28158, acuteDistance: 22478, acuteTolerance: 37070, runningToleranceFeedBackPhrase: "MEDIUM_LOAD" },
	{ userProfilePK: 1, calendarDate: "2026-10-06", acuteImpactLoad: 14339, acuteDistance: 8008, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
	{ userProfilePK: 1, calendarDate: "2026-10-09", acuteImpactLoad: 6071, acuteDistance: 8008, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
	{ userProfilePK: 1, calendarDate: "2026-10-12", acuteImpactLoad: 25137, acuteDistance: 22478, acuteTolerance: 37070, runningToleranceFeedBackPhrase: "MEDIUM_LOAD" },
	{ userProfilePK: 1, calendarDate: "2026-10-07", acuteImpactLoad: 10026, acuteDistance: 8008, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
	{ userProfilePK: 1, calendarDate: "2026-10-10", acuteImpactLoad: 15719, acuteDistance: 10009, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
	{ userProfilePK: 1, calendarDate: "2026-10-05", acuteImpactLoad: 17684, acuteDistance: 8008, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
	{ userProfilePK: 1, calendarDate: "2026-10-08", acuteImpactLoad: 6854, acuteDistance: 8008, acuteTolerance: 37734, runningToleranceFeedBackPhrase: "LOW_LOAD_1DAYS" },
];

/** The daily index's rows of Oct 5–12, oldest first, as `readIndex("running-tolerance")` gives them. */
export function dayRows(payloads: readonly RunningTolerance[] = DAILY_OCT_5_12): RunningToleranceRow[] {
	return RUNNING_TOLERANCE_INDEX.merge([], { rows: payloads.map((p) => RUNNING_TOLERANCE_INDEX.normalize(rowOfTolerance(p))!), dates: [] });
}

/** The first day with a daily row, and the two days inside the history without one. */
export const FIRST_DAY = "2025-08-17";
export const HOLES: readonly string[] = ["2025-10-11", "2026-01-22"];

/** Every day with a daily row from the first to `last`, oldest first: 420 to 2026-10-12. */
export function historyDays(last = "2026-10-12"): string[] {
	const out: string[] = [];
	for (let t = Date.parse(`${FIRST_DAY}T00:00:00Z`); t <= Date.parse(`${last}T00:00:00Z`); t += 86_400_000) {
		const day = new Date(t).toISOString().slice(0, 10);
		if (!HOLES.includes(day)) out.push(day);
	}
	return out;
}
