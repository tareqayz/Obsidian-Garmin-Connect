import type { BloodPressureRange } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Blood Pressure: the day index the Blood Pressure pages read
 * (ref/health-stats/blood-pressure/README.md).
 *
 * The account the spec was captured from has never had a reading, so every
 * route answered empty and a reading's shape is unknown. The row below is
 * Inferred from python-garminconnect's write arguments (systolic, diastolic,
 * pulse) and the day view's counts: a day's highest systolic and diastolic,
 * its lowest, the pulse, the reading count and Garmin's category if it sends
 * one. Whatever `measurementSummaries` really holds, a row only appears once a
 * reading exists, so the empty pages are what this account sees.
 *
 * Pure: no Obsidian import.
 */

export interface BloodPressureRow {
	date: string;
	/** Highest systolic / diastolic of the day, mmHg (Inferred). */
	sys?: number;
	dia?: number;
	/** Lowest systolic / diastolic. */
	sysLo?: number;
	diaLo?: number;
	pulse?: number;
	/** Readings that day. */
	n?: number;
	/** Garmin's category, if sent. */
	cat?: string;
}

type Rec = Record<string, unknown>;
const num = (r: Rec, ...keys: string[]) => keys.map((k) => r[k]).find((v) => typeof v === "number" && Number.isFinite(v));

/** A `measurementSummaries` entry as a row (Inferred field names). */
export function rowOfBloodPressure(summary: Rec | null | undefined): DayRowInput<BloodPressureRow> {
	const s = summary ?? {};
	const list = (Array.isArray(s.measurements) ? s.measurements : []) as Rec[];
	const sys = list.map((m) => num(m, "systolic")).filter((v): v is number => v !== undefined);
	const dia = list.map((m) => num(m, "diastolic")).filter((v): v is number => v !== undefined);
	const first = list[list.length - 1] ?? {};
	return {
		date: (s.startDate ?? s.calendarDate ?? s.summaryDate ?? first.calendarDate) as unknown,
		sys: num(s, "highSystolic", "systolic") ?? (sys.length ? Math.max(...sys) : undefined),
		dia: num(s, "highDiastolic", "diastolic") ?? (dia.length ? Math.max(...dia) : undefined),
		sysLo: num(s, "lowSystolic") ?? (sys.length ? Math.min(...sys) : undefined),
		diaLo: num(s, "lowDiastolic") ?? (dia.length ? Math.min(...dia) : undefined),
		pulse: num(s, "pulse", "avgPulse") ?? num(first, "pulse"),
		n: num(s, "numOfMeasurements", "totalMeasurementCount") ?? (list.length || undefined),
		cat: (s.category ?? first.category) as unknown,
	};
}

export function rowsOfBloodPressure(payload: BloodPressureRange | null | undefined): Array<DayRowInput<BloodPressureRow>> {
	return (payload?.measurementSummaries ?? []).map((s) => rowOfBloodPressure(s));
}

export const BLOOD_PRESSURE_INDEX = defineDayIndex<BloodPressureRow>({
	kind: "blood-pressure",
	title: "blood pressure",
	folder: "blood-pressure",
	version: 1,
	columns: { sys: {}, dia: {}, sysLo: {}, diaLo: {}, pulse: {}, n: {}, cat: { text: true } },
	keepOld: false,
	group: "body",
	// The day range has no cap: the whole history in one request.
	windowDays: 3660,
	emptyWindowsToStop: 1,
	refreshDays: 7,
	fetchWindow: async (api, start, end) => rowsOfBloodPressure(await api.bloodPressureRange(start, end)),
});
