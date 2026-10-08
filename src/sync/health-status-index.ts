import type { HealthStatus, HealthStatusMetric } from "../garmin/endpoints";
import { defineDayIndex, type DayRowInput } from "./day-index";

/**
 * Health Status: the day index the Health Status page reads
 * (ref/health-stats/health-status/README.md).
 *
 * A row a night: per metric (HR, HRV, respiration, skin temperature in °C,
 * SpO2) Garmin's value, typical range, ring percentage and status, plus the
 * night's outlier count. One REST range request returns the whole history
 * (no cap: 5,395 days give the same 334 rows), and Garmin creates or rescores
 * rows up to 26 days late, so every routine sync re-reads the last 28 days.
 *
 * Not kept: SKIN_TEMP_F (C × 1.8 to one decimal, with C's status and
 * percentage), feedbackKey (follows from type and status) and the
 * timestamps. The daily note's `health_*` keys still come from the sync's own
 * call; this index does not replace them.
 *
 * Pure: no Obsidian import.
 */

export type HealthMetricStatus = "IN_RANGE" | "ABOVE" | "BELOW" | "ONBOARDING" | "UNKNOWN";

export interface HealthStatusRow {
	date: string;
	hr?: number;
	hrLo?: number;
	hrHi?: number;
	hrPct?: number;
	hrSt?: string;
	hrv?: number;
	hrvLo?: number;
	hrvHi?: number;
	hrvPct?: number;
	hrvSt?: string;
	resp?: number;
	respLo?: number;
	respHi?: number;
	respPct?: number;
	respSt?: string;
	skin?: number;
	skinLo?: number;
	skinHi?: number;
	skinPct?: number;
	skinSt?: string;
	spo2?: number;
	spo2Lo?: number;
	spo2Hi?: number;
	spo2Pct?: number;
	spo2St?: string;
	/** `outliersCount`: ABOVE / BELOW metrics among the five. */
	out?: number;
}

/** The row's metric prefixes, in the page's fixed order. */
export const HEALTH_METRIC_KEYS = ["hr", "hrv", "resp", "skin", "spo2"] as const;
export type HealthMetricKey = (typeof HEALTH_METRIC_KEYS)[number];

const TYPE_KEY: Record<string, HealthMetricKey> = { HR: "hr", HRV: "hrv", RESPIRATION: "resp", SKIN_TEMP_C: "skin", SPO2: "spo2" };

/** Respiration is Garmin's sleep value cut (not rounded) to one decimal; the row already is, this keeps it so. */
function cut1(value: unknown): unknown {
	if (typeof value !== "number" || !Number.isFinite(value)) return value;
	return Math.trunc(Math.round(value * 1000) / 100) / 10;
}

/** A range row (or the single-day summary) as an index row. */
export function rowOfHealthStatus(summary: HealthStatus | null | undefined): DayRowInput<HealthStatusRow> {
	const row: Record<string, unknown> = { date: summary?.calendarDate, out: summary?.outliersCount };
	for (const metric of (summary?.metrics ?? []) as HealthStatusMetric[]) {
		const key = TYPE_KEY[metric?.type ?? ""];
		if (!key) continue;
		row[key] = key === "resp" ? cut1(metric.value) : metric.value;
		row[`${key}Lo`] = metric.baselineLowerLimit;
		row[`${key}Hi`] = metric.baselineUpperLimit;
		row[`${key}Pct`] = metric.percentage;
		row[`${key}St`] = metric.status;
	}
	return row as DayRowInput<HealthStatusRow>;
}

const whole = {};
const tenth = { precision: 1 };
const signedTenth = { precision: 1, signed: true };
const text = { text: true };

export const HEALTH_STATUS_INDEX = defineDayIndex<HealthStatusRow>({
	kind: "health-status",
	title: "health status",
	folder: "health-status",
	version: 1,
	columns: {
		hr: whole, hrLo: whole, hrHi: whole, hrPct: whole, hrSt: text,
		hrv: whole, hrvLo: whole, hrvHi: whole, hrvPct: whole, hrvSt: text,
		resp: tenth, respLo: tenth, respHi: tenth, respPct: whole, respSt: text,
		skin: signedTenth, skinLo: signedTenth, skinHi: signedTenth, skinPct: whole, skinSt: text,
		spo2: whole, spo2Lo: whole, spo2Hi: whole, spo2Pct: whole, spo2St: text,
		out: whole,
	},
	// A rescored night replaces the old one whole.
	keepOld: false,
	group: "health",
	// The range has no cap: the whole history in one request.
	windowDays: 3660,
	emptyWindowsToStop: 1,
	// Rows appear or are rescored up to 26 days after their date.
	refreshDays: 28,
	fetchWindow: async (api, start, end) => (await api.healthStatusRange(start, end)).map(rowOfHealthStatus),
});
