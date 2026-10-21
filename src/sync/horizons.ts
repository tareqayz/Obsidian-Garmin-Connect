import type { DailySummary } from "../garmin/endpoints";
import { shiftDate } from "./day-index";
import { mapSeries, type IntradayPayloads } from "./intraday";

/**
 * How far back Garmin keeps a day's fine-grained timelines. Past about 140
 * days it answers a day's stress, heart rate, floors and intensity with the
 * day's totals and no points, so the history download stops asking for them
 * there; the steps chart and Body Battery's events it keeps, and they are
 * still asked.
 *
 * Learned per account, as an age in days, for the window slides with each
 * day: seven days in a row whose totals say there was something but whose
 * timelines came back empty set it, and one timeline served past it clears it
 * — so does a check of one such day each session, and a new data version.
 *
 * Pure.
 */

/** The timelines Garmin drops for old days, by their intraday job. */
export const HORIZON_JOBS = ["stress", "heartRate", "floors", "intensity"] as const;

/** Misses in a row, newest first, that set the age. */
export const MISSES_TO_LEARN = 7;

/** Fewer days kept than this is something else going wrong, not the horizon: nothing is learned from it. */
export const MIN_HORIZON_DAYS = 30;

/**
 * The age assumed before one is learned: what Garmin was seen to keep,
 * measured 2026-10-21 (Mar 1 and May 31 empty, Jun 1 on served).
 */
export const ASSUMED_HORIZON_DAYS = 140;

/**
 * What the download learned, as scan.json keeps it: how many days back Garmin
 * keeps the timelines — a day older than that is past the horizon — or null
 * once it served one past it.
 */
export interface Horizon {
	days: number | null;
	/** `DAY_DETAILS_VERSION` when learned: a new version forgets it. */
	version: number;
}

/** What a day's four timelines said: points, totals without points, or nothing at all (a day not worn). */
export type TimelineVerdict = "served" | "missed" | "none";

/** What Garmin's answers for a day's four timelines say about the horizon. */
export function timelineVerdict(intraday: IntradayPayloads, summary: DailySummary | null | undefined): TimelineVerdict {
	const series = mapSeries({ stress: intraday.stress ?? null, heartRate: intraday.heartRate ?? null, floors: intraday.floors ?? null, intensity: intraday.intensity ?? null });
	if (series.stress || series.bodyBattery || series.heartRate || series.floors || series.intensity) return "served";
	const positive = (v: unknown) => typeof v === "number" && v > 0;
	const stress = intraday.stress;
	const hr = intraday.heartRate;
	const im = intraday.intensity;
	const totals =
		positive(stress?.avgStressLevel) ||
		positive(stress?.maxStressLevel) ||
		positive(hr?.restingHeartRate) ||
		positive(hr?.maxHeartRate) ||
		// Floors have no total of their own: the day's summary says.
		positive(summary?.floorsAscended) ||
		(typeof im?.endDayMinutes === "number" && typeof im.startDayMinutes === "number" && im.endDayMinutes > im.startDayMinutes);
	return totals ? "missed" : "none";
}

/** The run of misses being counted, newest first, across a download's chunks. */
export interface HorizonStreak {
	misses: number;
	/** The newest day of the run. */
	newest?: string;
}

/**
 * The horizon after some days' verdicts, taken newest first. A served day
 * past the horizon clears it (null); `MISSES_TO_LEARN` misses in a row set
 * it, or move it on, to the age of the newest of them.
 */
export function learn(horizon: number | null | undefined, streak: HorizonStreak, heard: ReadonlyArray<[date: string, verdict: TimelineVerdict]>, today: string): { horizon: number | null | undefined; streak: HorizonStreak } {
	let days = horizon;
	let run = { ...streak };
	for (const [date, verdict] of heard) {
		if (verdict === "none") continue;
		if (verdict === "served") {
			if (typeof days === "number" && date <= cutOf(days, today)!) days = null;
			run = { misses: 0 };
			continue;
		}
		run = { misses: run.misses + 1, newest: run.newest ?? date };
		// The newest miss is past the horizon: Garmin keeps the days younger than it.
		const kept = ageOf(run.newest!, today) - 1;
		if (run.misses >= MISSES_TO_LEARN && kept >= MIN_HORIZON_DAYS && (typeof days !== "number" || kept < days)) days = kept;
	}
	return { horizon: days, streak: run };
}

/** The newest day past the horizon: on it and before, the four timelines aren't asked. Null with no horizon. */
export function cutOf(days: number | null | undefined, today: string): string | null {
	return typeof days === "number" ? shiftDate(today, -(days + 1)) : null;
}

/** The horizon the estimate reckons with: the learned one, none once Garmin served past it, or the assumed one. */
export function plannedCut(days: number | null | undefined, today: string): string | null {
	return cutOf(days === undefined ? ASSUMED_HORIZON_DAYS : days, today);
}

/** How many days before `today` a day is. */
function ageOf(date: string, today: string): number {
	return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}

/** A horizon as scan.json keeps it, or undefined for anything else, or one from another data version. */
export function parseHorizon(raw: unknown, version: number): number | null | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	if (r.version !== version) return undefined;
	if (r.days === null) return null;
	return typeof r.days === "number" && Number.isInteger(r.days) && r.days >= MIN_HORIZON_DAYS ? r.days : undefined;
}
