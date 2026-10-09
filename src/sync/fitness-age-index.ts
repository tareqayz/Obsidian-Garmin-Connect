import type { DailyStatRow, FitnessAge } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";
import type { DaySeries } from "./intraday";
import { defineIntraday } from "./intraday-registry";
import { num } from "./numbers";

/**
 * Fitness Age: the day index the 7d, 4w and 1y trends read, and the intraday
 * extra the Current page draws (ref/health-stats/fitness-age/README.md).
 *
 * The index keeps a row only on a day Garmin recalculated: `stats/daily`
 * sends nothing for the others (377 of 432 days), and the trends join the
 * rows straight across those days. The route takes 29 days a request.
 *
 * The Current page reads `fitnessage/{date}` whole, on view: its targets and
 * priorities, which decide the factor cards, are in no daily row, and its
 * figures are rounded differently from the rows (BMI 23.9 against 23.81).
 *
 * Pure: no Obsidian import, so the tests load the definitions as registered.
 */

export interface FitnessAgeRow {
	/** The local calendar day, `YYYY-MM-DD`: a recalculation day. */
	date: string;
	/** The fitness age, raw (18.649547 on 2025-08-03), kept to 3 dp. */
	age?: number;
	achievable?: number;
	/** Garmin's fitness-age resting heart rate, whole bpm. */
	rhr?: number;
	/** Vigorous days a week over six weeks, raw (k/6). */
	vigDays?: number;
	/** The daily rows' BMI, which is not the Current page's. */
	bmi?: number;
}

/** A `stats/daily` row as an index row. */
export function rowOfFitnessStat(stat: DailyStatRow | null | undefined): DayRowInput<FitnessAgeRow> {
	const values = (stat?.values ?? {}) as Record<string, unknown>;
	return {
		date: stat?.calendarDate,
		age: values.fitnessAge,
		achievable: values.achievableFitnessAge,
		rhr: values.rhr,
		vigDays: values.vigorousDaysAvg,
		bmi: values.bmi,
	};
}

export const FITNESS_AGE_INDEX = defineDayIndex<FitnessAgeRow>({
	kind: "fitness-age",
	title: "fitness age",
	folder: "fitness-age",
	version: 1,
	columns: { age: { precision: 3 }, achievable: { precision: 3 }, rhr: {}, vigDays: { precision: 4 }, bmi: { precision: 2 } },
	keepOld: false,
	group: "fitness",
	// 29 works, 30 is HTTP 400.
	windowDays: 29,
	// The longest gap inside the history is 7 days.
	emptyWindowsToStop: 1,
	// A row for yesterday may land after a sync; any refresh up to 29 days is one request.
	refreshDays: 7,
	fetchWindow: async (api, start, end) => (await api.fitnessAgeDaily(start, end)).map(rowOfFitnessStat),
});

/* ------------------------------------------------------------------ */
/*  The Current page's payload                                         */
/* ------------------------------------------------------------------ */

export type FitnessFactor = "vigorousDaysAvg" | "rhr" | "vigorousMinutesAvg" | "bmi";
export const FITNESS_FACTORS: readonly FitnessFactor[] = ["vigorousDaysAvg", "rhr", "vigorousMinutesAvg", "bmi"];

/** One factor as `fitnessage/{date}` sends it. */
export interface FitnessComponent {
	value?: number;
	/** Present only off target. */
	targetValue?: number;
	improvementValue?: number;
	potentialAge?: number;
	/** 1 is the most important; only with `targetValue`. */
	priority?: number;
	stale?: boolean;
	staleInputs?: string[];
	numOfWeeksForIm?: number;
	lastMeasurementDate?: string;
}

/** What the Current page keeps of `fitnessage/{date}`: nearly the whole payload. */
export interface FitnessAgeDay {
	fitnessAge?: number;
	chronologicalAge?: number;
	achievableFitnessAge?: number;
	previousFitnessAge?: number;
	/** `YYYY-MM-DD`: the computation's day, not the request's. */
	lastUpdated?: string;
	components: Partial<Record<FitnessFactor, FitnessComponent>>;
}

export const FITNESS_AGE_DAY_KEY = "fitnessAgeDay";

export function fitnessAgeDayOf(payload: FitnessAge | null | undefined): FitnessAgeDay | null {
	if (!payload || typeof payload !== "object") return null;
	const day: FitnessAgeDay = { components: {} };
	for (const key of ["fitnessAge", "chronologicalAge", "achievableFitnessAge", "previousFitnessAge"] as const) {
		const v = num(payload[key]);
		if (v !== undefined) day[key] = v;
	}
	if (typeof payload.lastUpdated === "string" && /^\d{4}-\d{2}-\d{2}/.test(payload.lastUpdated)) day.lastUpdated = payload.lastUpdated.slice(0, 10);
	const raw = (payload.components ?? {}) as Record<string, Record<string, unknown> | null>;
	for (const key of FITNESS_FACTORS) {
		const c = raw[key];
		if (!c || typeof c !== "object") continue;
		const out: FitnessComponent = {};
		for (const f of ["value", "targetValue", "improvementValue", "potentialAge", "priority", "numOfWeeksForIm"] as const) {
			const v = num(c[f]);
			if (v !== undefined) out[f] = v;
		}
		if (typeof c.stale === "boolean") out.stale = c.stale;
		if (Array.isArray(c.staleInputs)) out.staleInputs = c.staleInputs.filter((s): s is string => typeof s === "string");
		if (typeof c.lastMeasurementDate === "string") out.lastMeasurementDate = c.lastMeasurementDate.slice(0, 10);
		day.components[key] = out;
	}
	return day;
}

/** The kept payload from a day's series file, or null. */
export function fitnessAgeDayIn(series: DaySeries | null | undefined): FitnessAgeDay | null {
	const raw = series?.extra?.[FITNESS_AGE_DAY_KEY] as FitnessAgeDay | undefined;
	if (!raw || typeof raw !== "object" || typeof raw.components !== "object" || raw.components === null) return null;
	return raw;
}

/** The Current page's payload: `loadIntraday(today, [FITNESS_AGE_DAY.key])`. */
export const FITNESS_AGE_DAY = defineIntraday<FitnessAge | null, FitnessAgeDay>({
	key: FITNESS_AGE_DAY_KEY,
	group: "fitness",
	fetch: (api, date) => api.fitnessAge(date),
	map: (payload) => fitnessAgeDayOf(payload),
});
