import type { DailyEvent, DailyStatRow, DailySummary, Nap } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import { epochOf, type DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";

/**
 * Body Battery: the day index the Body Battery pages read
 * (ref/health-stats/body-battery/README.md). Their 1d timeline reads the day's
 * curve out of `STRESS_DAY`'s block (`batteryDayIn`), and their Factors the
 * series file's own `bodyBatteryEvents`, both loadable for any day. The
 * timeline's marker row also needs the day's naps and Move IQ events, which
 * nothing else keeps: `NAPS_DAY` and `MOVE_IQ_DAY` load them on view.
 *
 * A row a day. A routine sync fills the run's own days from the daily summary
 * it fetches anyway, which is the only source of the newest level and the
 * level at wake. The history takes two requests a 28-day window, side by side:
 *
 * - `stats/bodybattery/daily` for the high and low, the only route that has
 *   them right (the reports route's six-point sketch matches them on 126 days
 *   of 424). It caps at 28 days and leaves a day without data out, so its
 *   rows are the days the index keeps.
 * - `bodyBattery/reports/daily` for charged, drained and the day's feedback,
 *   which nothing else serves for a past day. It caps at 31 days and sends
 *   every calendar day, with nulls on a day without data; it is only read for
 *   the days the stats route has a row for. Its charged and drained equal the
 *   summary's on 434 days of 434.
 *
 * Pure: no Obsidian import, so the tests load the definition as registered.
 */

export interface BatteryRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	/** The day's highest and lowest level, 0 to 100: the stats route's, which are the summary's and the curve's too. */
	high?: number;
	low?: number;
	/** The sums of the day's rises and of its drops on the three-minute curve: first + charged − drained = last. 0 is kept. */
	charged?: number;
	drained?: number;
	/** The curve's newest level, today's gauge. Only a summary has it. */
	latest?: number;
	/** The level when the night ended. Only a summary has it. */
	atWake?: number;
	/**
	 * The day's feedback, `bodyBatteryDynamicFeedbackEvent.feedbackLongType`,
	 * the key the 1d copy is looked up by: SLEEP_PREPARATION_BALANCED_AND_INACTIVE,
	 * NO_DATA… The running event, not the end-of-day one: the phone showed Oct
	 * 1's dynamic STRESSFUL_AND_INACTIVE ("Stressful day") where its end-of-day
	 * event said BALANCED_AND_INACTIVE ("Easy day").
	 */
	feedback?: string;
}

/** A `stats/bodybattery/daily` row's high and low. */
export function rowOfStat(stat: DailyStatRow | null | undefined): DayRowInput<BatteryRow> {
	const values = (stat?.values ?? {}) as Record<string, unknown>;
	return { date: stat?.calendarDate, high: values.highBodyBattery, low: values.lowBodyBattery };
}

/** What a `bodyBattery/reports/daily` day adds to the stats route's row. */
export function reportOf(report: unknown): DayRowInput<BatteryRow> {
	const day = (report && typeof report === "object" ? report : {}) as Record<string, unknown>;
	return { date: day.date, charged: day.charged, drained: day.drained, feedback: feedbackOf(day.bodyBatteryDynamicFeedbackEvent) };
}

/**
 * A window's rows: one for each day the stats route has a level for, with the
 * reports route's columns for that day beside its high and low. A day only
 * the reports route mentions had no data (its charged and drained are null,
 * its feedback often NO_DATA), so it gets no row, and loses any it had.
 */
export function rowsOfWindow(stats: readonly DailyStatRow[] | null | undefined, reports: readonly unknown[] | null | undefined): Array<DayRowInput<BatteryRow>> {
	const extra = new Map<unknown, DayRowInput<BatteryRow>>();
	for (const report of Array.isArray(reports) ? reports : []) {
		const row = reportOf(report);
		if (typeof row.date === "string") extra.set(row.date, row);
	}
	const rows: Array<DayRowInput<BatteryRow>> = [];
	for (const stat of stats ?? []) {
		const row = rowOfStat(stat);
		if (isLevel(row.high) || isLevel(row.low)) rows.push({ ...extra.get(row.date), ...row });
	}
	return rows;
}

/**
 * A day's row from its daily summary, or null on a day without a level: the
 * same days the stats route leaves out, whatever feedback the day carries.
 */
export function rowOfSummary(summary: DailySummary): DayRowInput<BatteryRow> | null {
	const high = summary.bodyBatteryHighestValue;
	const low = summary.bodyBatteryLowestValue;
	if (!isLevel(high) && !isLevel(low)) return null;
	return {
		high,
		low,
		charged: summary.bodyBatteryChargedValue,
		drained: summary.bodyBatteryDrainedValue,
		latest: summary.bodyBatteryMostRecentValue,
		atWake: summary.bodyBatteryAtWakeTime,
		feedback: feedbackOf(summary.bodyBatteryDynamicFeedbackEvent),
	};
}

function isLevel(value: unknown): boolean {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** A feedback event's long type, the more specific of its two: the short type plus suffixes such as `_AND_BB_LOW`. */
function feedbackOf(event: unknown): unknown {
	return event && typeof event === "object" ? (event as Record<string, unknown>).feedbackLongType : undefined;
}

export const BODY_BATTERY_INDEX = defineDayIndex<BatteryRow>({
	kind: "body-battery",
	title: "body battery",
	folder: "body-battery",
	version: 1,
	columns: { high: {}, low: {}, charged: {}, drained: {}, latest: {}, atWake: {}, feedback: { text: true } },
	// A history window has no newest level nor level at wake: the ones the day's summary gave stay.
	keepOld: true,
	group: "stress",
	// The stats route's cap; the reports route takes the same window.
	windowDays: 28,
	// The longest gap inside the history is five days (Jan 5 – 9), so two
	// empty windows in a row mean the history has not started yet.
	emptyWindowsToStop: 2,
	// The stats route and the reports route, side by side.
	requestsPerWindow: 2,
	fetchWindow: async (api, start, end) => {
		const [stats, reports] = await Promise.all([api.bodyBatteryDaily(start, end), api.bodyBattery(start, end)]);
		return rowsOfWindow(stats, reports);
	},
	fromSummary: (summary) => rowOfSummary(summary),
});

/* ------------------------------------------------------------------ */
/*  The 1d timeline's markers                                          */
/* ------------------------------------------------------------------ */

/** A nap or a Move IQ event: when it began, epoch ms, and how long it ran, minutes. */
export interface DayMark {
	start: number;
	minutes?: number;
	/** Move IQ's activity type: `walking`, `running`, … */
	type?: string;
}

export const NAPS_KEY = "naps";
export const MOVE_IQ_KEY = "moveIq";

/** The day's naps, as the phone's timeline marks them with a Zz. Null on a day without any. */
export function napsOf(payload: readonly Nap[] | null | undefined): DayMark[] | null {
	const out: DayMark[] = [];
	const naps: readonly Nap[] = Array.isArray(payload) ? payload : [];
	for (const nap of naps) {
		const start = epochOf(nap?.napStartTimestampGMT);
		if (start === undefined) continue;
		const mark: DayMark = { start };
		if (typeof nap.napTimeSec === "number" && nap.napTimeSec > 0) mark.minutes = Math.round(nap.napTimeSec / 60);
		out.push(mark);
	}
	return out.length ? out.sort((a, b) => a.start - b.start) : null;
}

/** The day's Move IQ events: stretches of walking or running never recorded as an activity. Null on a day without any. */
export function moveIqOf(payload: readonly DailyEvent[] | null | undefined): DayMark[] | null {
	const out: DayMark[] = [];
	const events: readonly DailyEvent[] = Array.isArray(payload) ? payload : [];
	for (const event of events) {
		const start = epochOf(event?.startTimestampGMT);
		if (start === undefined) continue;
		const mark: DayMark = { start };
		if (typeof event.duration === "number" && event.duration > 0) mark.minutes = event.duration;
		if (typeof event.activityType === "string" && event.activityType) mark.type = event.activityType;
		out.push(mark);
	}
	return out.length ? out.sort((a, b) => a.start - b.start) : null;
}

export const NAPS_DAY = defineIntraday<Nap[], DayMark[]>({
	key: NAPS_KEY,
	group: "intraday",
	fetch: (api, date) => api.naps(date),
	map: (payload) => napsOf(payload),
});

export const MOVE_IQ_DAY = defineIntraday<DailyEvent[], DayMark[]>({
	key: MOVE_IQ_KEY,
	group: "intraday",
	fetch: (api, date) => api.dailyEvents(date),
	map: (payload) => moveIqOf(payload),
});

/** A loaded day's marks under `key`, or none. */
export function marksIn(series: DaySeries | null | undefined, key: string): DayMark[] {
	const raw = series?.extra?.[key];
	return Array.isArray(raw) ? (raw as DayMark[]).filter((m) => typeof m?.start === "number") : [];
}
