import type { SleepRow } from "../sync/sleep-index";
import { HEALTH_METRIC_KEYS, type HealthMetricKey, type HealthStatusRow } from "../sync/health-status-index";
import { shiftDate as addDays } from "../sync/day-index";
import { dayAxis, dayLabel, dayOf, type PeriodAxis, type PeriodRoute } from "./periods";

/**
 * Garmin Connect's Health Status page, worked out from the Health Status index
 * and, for a metric's sheet, the sleep index (ref/health-stats/health-status/README.md).
 *
 * Pure. The rules, verified on 2026-10-05 and 2026-10-08:
 *
 * - One day at a time; five cards in a fixed order (HR, HRV, Respiration,
 *   Skin Temp, Pulse Ox), grouped WITHIN RANGE then NO DATA. An out-of-range
 *   group is unseen: inferred "OUT OF RANGE", first.
 * - Values print as sent: respiration "15" without ".0", skin with a sign
 *   ("+0.1°", "-0.3°") but zero as "0°".
 * - The ring marker sits at 180° − 1.8° × `percentage`, the sent value.
 * - A sheet charts the 7 nights ending on the shown day: the band is each
 *   day's typical range from this index, the line the sleep index's value.
 */

export type HealthGroup = "out" | "within" | "none";

export interface HealthStatusPageData {
	rows: readonly HealthStatusRow[];
	complete: boolean;
}

export interface MetricInfo {
	key: HealthMetricKey;
	title: string;
	unit: string;
	/** The sheet's big-ring label. */
	ringLabel: string;
	/** The chart line's name in the legend. */
	lineName: string;
	/** The sleep index field the line reads. */
	sleepKey: "hr" | "hrv" | "resp" | "skinC" | "spo2";
	/** The noun in the sheet copy. */
	noun: string;
	typicalRange: boolean;
}

export const METRICS: Readonly<Record<HealthMetricKey, MetricInfo>> = {
	hr: { key: "hr", title: "Heart Rate", unit: "bpm", ringLabel: "Avg Overnight HR", lineName: "Avg Overnight Heart Rate", sleepKey: "hr", noun: "heart rate", typicalRange: true },
	hrv: { key: "hrv", title: "HRV", unit: "ms", ringLabel: "Overnight Avg", lineName: "Avg Overnight HRV", sleepKey: "hrv", noun: "HRV", typicalRange: false },
	resp: { key: "resp", title: "Respiration", unit: "brpm", ringLabel: "Avg Respiration", lineName: "Avg Respiration", sleepKey: "resp", noun: "respiration rate", typicalRange: true },
	skin: { key: "skin", title: "Skin Temp", unit: "°", ringLabel: "Avg Change", lineName: "Avg Skin Temp Change", sleepKey: "skinC", noun: "skin temperature change", typicalRange: true },
	spo2: { key: "spo2", title: "Pulse Ox", unit: "%", ringLabel: "Avg SpO₂", lineName: "Avg SpO₂", sleepKey: "spo2", noun: "blood oxygen", typicalRange: true },
};

const DASH = "--";
const GROUP_TITLES: Record<HealthGroup, string> = { out: "OUT OF RANGE", within: "WITHIN RANGE", none: "NO DATA" };

/** A metric of a day, as its card and sheet show it. */
export interface MetricView {
	key: HealthMetricKey;
	title: string;
	group: HealthGroup;
	status?: string;
	/** "53 bpm", "-0.3°", "--". */
	value: string;
	subtitle: string;
	/** The ring's percentage; absent on a NO DATA card (no ring). */
	pct?: number;
	/** "47-62 bpm", "-0.6° to +0.6°": limits for a scored metric. */
	range?: string;
}

export interface HealthGroupView {
	group: HealthGroup;
	title: string;
	metrics: MetricView[];
}

export interface HealthStatusDayView {
	date: string;
	label: string;
	canGoBack: boolean;
	headline: string;
	copy: string;
	groups: HealthGroupView[];
	metrics: MetricView[];
}

/** "15", "14.8"; skin "+0.1", "-0.3", "0". */
export function numberText(key: HealthMetricKey, value: number): string {
	const n = key === "resp" || key === "skin" ? Math.round(value * 10) / 10 : Math.round(value);
	const text = String(n === 0 ? 0 : n);
	return key === "skin" && n > 0 ? `+${text}` : text;
}

/** A value with its unit: "53 bpm", "+0.4°", "--". */
export function valueText(key: HealthMetricKey, value: number | undefined): string {
	if (value === undefined) return DASH;
	const unit = METRICS[key].unit;
	return key === "skin" ? `${numberText(key, value)}°` : `${numberText(key, value)} ${unit}`;
}

/** "47-62 bpm", "13.1-15.5 brpm", "-0.6° to +0.6°". */
export function rangeText(key: HealthMetricKey, lo: number, hi: number): string {
	if (key === "skin") return `${numberText(key, lo)}° to ${numberText(key, hi)}°`;
	return `${numberText(key, lo)}-${numberText(key, hi)} ${METRICS[key].unit}`;
}

/** A day's metric. `row` is null for a day without a summary. */
export function metricView(key: HealthMetricKey, row: HealthStatusRow | null | undefined): MetricView {
	const info = METRICS[key];
	if (!row) {
		return { key, title: info.title, group: "none", value: DASH, subtitle: key === "spo2" ? "Not enabled during sleep" : "No data" };
	}
	const r = row as unknown as Record<string, number | string | undefined>;
	const status = r[`${key}St`] as string | undefined;
	const value = r[key] as number | undefined;
	const lo = r[`${key}Lo`] as number | undefined;
	const hi = r[`${key}Hi`] as number | undefined;
	const pct = r[`${key}Pct`] as number | undefined;
	const range = lo !== undefined && hi !== undefined ? rangeText(key, lo, hi) : undefined;
	const scored = status === "IN_RANGE" || status === "ABOVE" || status === "BELOW";
	if (!scored || value === undefined) {
		return { key, title: info.title, group: "none", status, value: DASH, subtitle: status === "ONBOARDING" ? "Calibrating" : "No data" };
	}
	const word = status === "IN_RANGE" ? "Within" : status === "ABOVE" ? "Above" : "Below";
	return {
		key,
		title: info.title,
		group: status === "IN_RANGE" ? "within" : "out",
		status,
		value: valueText(key, value),
		subtitle: range ? `${word} ${range}` : word,
		pct: pct ?? 0,
		range,
	};
}

export function headlineOf(row: HealthStatusRow | null | undefined, metrics: readonly MetricView[]): { headline: string; copy: string } {
	const scored = metrics.some((m) => m.group !== "none");
	if (!row || !scored) return { headline: "No data available", copy: "Wear your device while sleeping to reveal your metrics." };
	const out = row.out ?? metrics.filter((m) => m.group === "out").length;
	// Out-of-range wording is unseen on the phone: inferred.
	if (out > 0) return { headline: out === 1 ? "1 metric is out of range" : `${out} metrics are out of range`, copy: "Here's how your sleep metrics compare to your typical ranges." };
	return { headline: "All your metrics are in range", copy: "Here's how your sleep metrics compare to your typical ranges." };
}

export function healthStatusDayView(input: { data: HealthStatusPageData; route: PeriodRoute; today: string }): HealthStatusDayView {
	const { data, route, today } = input;
	const date = dayOf(route, today);
	const row = data.rows.find((r) => r.date === date) ?? null;
	const metrics = HEALTH_METRIC_KEYS.map((k) => metricView(k, row));
	const groups = (["out", "within", "none"] as const)
		.map((group) => ({ group, title: GROUP_TITLES[group], metrics: metrics.filter((m) => m.group === group) }))
		.filter((g) => g.metrics.length);
	const oldest = data.rows[0]?.date;
	return {
		date,
		label: dayLabel(date, today),
		canGoBack: !data.complete || (oldest !== undefined && oldest < date),
		...headlineOf(row, metrics),
		groups,
		metrics,
	};
}

/* ------------------------------------------------------------------ */
/*  A metric's sheet                                                   */
/* ------------------------------------------------------------------ */

export interface HealthSheetView {
	metric: MetricView;
	info: MetricInfo;
	heading: string;
	copy: string;
	/** The 7 days, D−6 … D. */
	days: string[];
	/** Per day: the typical range, or null. */
	band: Array<{ lo: number; hi: number } | null>;
	/** Per day: the sleep index's value, or null. */
	line: Array<number | null>;
	ticks: number[];
	tickLabels: string[];
	axis: PeriodAxis;
	/** HRV only: the "Overnight HRV vs. HRV Status" figures. */
	hrvStatus?: Array<{ value: string; unit?: string; label: string }>;
}

const IN_RANGE_COPY: Record<HealthMetricKey, string> = {
	hr: "Your in-range heart rate for this sleep suggests that you're maintaining your current state of health.",
	hrv: "Your in-range HRV for this sleep suggests that you're maintaining your current state of health.",
	resp: "Your in-range respiration rate for this sleep suggests that you're maintaining your current state of health.",
	skin: "Your in-range skin temperature change for this sleep is a good indicator of your sleep quality and health.",
	spo2: "Your in-range blood oxygen for this sleep suggests that you're maintaining your current state of health.",
};

export function sheetCopy(metric: MetricView): { heading: string; copy: string } {
	const noun = METRICS[metric.key].noun;
	if (metric.status === "IN_RANGE") return { heading: "Within range", copy: IN_RANGE_COPY[metric.key] };
	// ABOVE / BELOW are unseen on the phone: inferred.
	if (metric.status === "ABOVE") return { heading: "Above range", copy: `Your ${noun} for this sleep is above your typical range.` };
	if (metric.status === "BELOW") return { heading: "Below range", copy: `Your ${noun} for this sleep is below your typical range.` };
	return { heading: "No data", copy: "Wear your device while sleeping to reveal your metrics." };
}

/**
 * Five y ticks over the band and the line (the spec's rule, fitting all
 * four sheets): centred on ⌊(lo + hi) / 2⌋ with step ⌈(half + 2) / 2⌉; skin
 * centred on 0 with a step of whole halves.
 */
export function sheetTicks(key: HealthMetricKey, values: readonly number[]): number[] {
	if (!values.length) return key === "skin" ? [1, 0.5, 0, -0.5, -1] : [];
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	if (key === "skin") {
		const step = Math.max(0.5, Math.ceil(Math.round((Math.max(Math.abs(lo), Math.abs(hi)) / 2 / 0.5) * 1e6) / 1e6) * 0.5);
		return [2 * step, step, 0, -step, -2 * step];
	}
	const c = Math.floor((lo + hi) / 2);
	const half = Math.max(c - lo, hi - c) + 2;
	const step = Math.ceil(Math.round((half / 2) * 1e6) / 1e6);
	return [c + 2 * step, c + step, c, c - step, c - 2 * step];
}

/** Skin ticks read "+1.0", "+0.5", "0", "-0.5"; the rest as numbers. */
export function tickLabel(key: HealthMetricKey, tick: number): string {
	if (key !== "skin") return String(tick);
	if (tick === 0) return "0";
	return `${tick > 0 ? "+" : "-"}${Math.abs(tick).toFixed(1)}`;
}

export function healthSheetView(input: {
	data: HealthStatusPageData;
	sleep: readonly SleepRow[];
	date: string;
	key: HealthMetricKey;
}): HealthSheetView {
	const { data, sleep, date, key } = input;
	const info = METRICS[key];
	const byDate = new Map(data.rows.map((r) => [r.date, r]));
	const nights = new Map(sleep.map((r) => [r.date, r]));
	const metric = metricView(key, byDate.get(date));
	const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
	const band = days.map((d) => {
		const r = byDate.get(d) as unknown as Record<string, number | string | undefined> | undefined;
		const st = r?.[`${key}St`];
		const lo = r?.[`${key}Lo`];
		const hi = r?.[`${key}Hi`];
		if (typeof lo !== "number" || typeof hi !== "number" || (st !== "IN_RANGE" && st !== "ABOVE" && st !== "BELOW")) return null;
		return { lo, hi };
	});
	const line = days.map((d) => {
		const v = nights.get(d)?.[info.sleepKey];
		return typeof v === "number" ? v : null;
	});
	const values = [...band.flatMap((b) => (b ? [b.lo, b.hi] : [])), ...line.filter((v): v is number => v !== null)];
	const ticks = sheetTicks(key, values);
	const view: HealthSheetView = {
		metric,
		info,
		...sheetCopy(metric),
		days,
		band,
		line,
		ticks,
		tickLabels: ticks.map((t) => tickLabel(key, t)),
		axis: dayAxis(days),
	};
	if (key === "hrv") {
		const night = nights.get(date);
		const r = byDate.get(date);
		const figures: Array<{ value: string; unit?: string; label: string }> = [];
		if (r?.hrvLo !== undefined && r.hrvHi !== undefined && metric.group !== "none") figures.push({ value: `${r.hrvLo}-${r.hrvHi}`, unit: "ms", label: "Typical Overnight Range" });
		if (metric.group !== "none" && r?.hrv !== undefined) figures.push({ value: String(r.hrv), unit: "ms", label: "Overnight Avg" });
		if (night?.hrv7d !== undefined) figures.push({ value: String(night.hrv7d), unit: "ms", label: "HRV Status" });
		view.hrvStatus = figures;
	}
	return view;
}

/** The metric a route's `sub` names, if it is one with a sheet. */
export function sheetKeyOf(sub: string | undefined): HealthMetricKey | null {
	return (HEALTH_METRIC_KEYS as readonly string[]).includes(sub ?? "") ? (sub as HealthMetricKey) : null;
}
