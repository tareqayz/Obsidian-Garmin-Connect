import type { BloodPressureRow } from "../sync/blood-pressure-index";
import { shortDate } from "./day";
import { canStepBack, dayAxis, dayLabel, dayOf, daysOf, monthAxis, periodLabel, periodOf, spread, yearLabel, type PeriodAxis, type PeriodRoute } from "./periods";

/**
 * Garmin Connect's Blood Pressure page, from the blood pressure index
 * (`src/sync/blood-pressure-index.ts`). Pure.
 * (ref/health-stats/blood-pressure/README.md.)
 *
 * The phone was captured with no readings, so the empty pages are 1:1 and
 * everything a reading draws is Inferred:
 *
 * - 1d: "--", "No Readings" and the copy; "Add a Reading" is left out (the
 *   plugin never writes). A reading shows "sys/dia" with its pulse.
 * - 7d "Weekly Readings", 4w "Monthly Readings", 1y "Weekly Ranges": a chart
 *   ("No data available" and a lone 0), the ISH legend and disclaimer, and
 *   four tiles counting days by category.
 * - Categories (ISH 2020): Normal < 130 / < 85, High-Normal 130–139 / 85–89,
 *   Grade 1 140–159 / 90–99, Grade 2 ≥ 160 / ≥ 100; the higher of the two wins.
 */

export type BpCategory = "normal" | "high-normal" | "grade1" | "grade2";

export const BP_CATEGORIES: ReadonlyArray<{ id: BpCategory; label: string }> = [
	{ id: "normal", label: "Normal" },
	{ id: "high-normal", label: "High-Normal" },
	{ id: "grade1", label: "Grade 1" },
	{ id: "grade2", label: "Grade 2" },
];

export const BP_DISCLAIMER =
	"Based on data from the International Society of Hypertension (ISH). Health-related data is not intended to be used for medical purposes, nor is it intended to diagnose, cure or prevent any disease or condition.";

export interface BloodPressurePageData {
	rows: readonly BloodPressureRow[];
	complete: boolean;
}

export interface BloodPressureInput {
	data: BloodPressurePageData;
	route: PeriodRoute;
	today: string;
}

export function bpCategory(sys: number, dia: number): BpCategory {
	if (sys >= 160 || dia >= 100) return "grade2";
	if (sys >= 140 || dia >= 90) return "grade1";
	if (sys >= 130 || dia >= 85) return "high-normal";
	return "normal";
}

const canGoBack = (data: BloodPressurePageData, from: string) => canStepBack(data.rows[0]?.date, data.complete, from);

export interface BloodPressureDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "120/80", or "--". */
	hero: string;
	hasReading: boolean;
	category?: BpCategory;
	pulse?: string;
}

export function bloodPressureDayView(input: BloodPressureInput): BloodPressureDayView {
	const { data, today } = input;
	const date = dayOf(input.route, today);
	const row = data.rows.find((r) => r.date === date);
	const has = row?.sys !== undefined && row.dia !== undefined;
	return {
		range: "1d",
		date,
		label: dayLabel(date, today),
		canGoBack: canGoBack(data, date),
		canGoForward: date < today,
		hero: has ? `${row!.sys}/${row!.dia}` : "--",
		hasReading: has,
		...(has ? { category: bpCategory(row!.sys!, row!.dia!) } : {}),
		...(row?.pulse !== undefined ? { pulse: `${row.pulse} bpm` } : {}),
	};
}

export interface BloodPressureBar {
	x: number;
	sys: number;
	dia: number;
	category: BpCategory;
}

export interface BloodPressurePeriodView {
	range: "7d" | "4w" | "1y";
	from: string;
	to: string;
	label: string;
	title: string;
	canGoBack: boolean;
	canGoForward: boolean;
	bars: BloodPressureBar[];
	/** Top first; a lone 0 without data. */
	ticks: number[];
	axis: PeriodAxis;
	/** Days in each category: "--" when the span has none at all. */
	tiles: Array<{ value: string; label: string; category: BpCategory }>;
}

export function bloodPressurePeriodView(input: BloodPressureInput): BloodPressurePeriodView {
	const { data, route, today } = input;
	const range = route.range === "4w" ? "4w" : route.range === "1y" ? "1y" : "7d";
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = new Map(data.rows.map((r) => [r.date, r]));
	let axis: PeriodAxis;
	let x: (date: string, i: number) => number;
	if (range === "1y") {
		const m = monthAxis(span.from);
		axis = m.axis;
		x = (d) => m.x(d);
	} else {
		axis = dayAxis(days);
		axis.labels = axis.labels.map((l, i) => ({ ...l, text: shortDate(i ? span.to : span.from) }));
		x = (_, i) => spread(i, days.length);
	}
	const bars: BloodPressureBar[] = [];
	days.forEach((d, i) => {
		const r = rows.get(d);
		if (r?.sys === undefined || r.dia === undefined) return;
		bars.push({ x: x(d, i), sys: r.sys, dia: r.dia, category: bpCategory(r.sys, r.dia) });
	});
	const top = bars.length ? Math.ceil(Math.max(...bars.map((b) => b.sys)) / 40) * 40 : 0;
	const counts = new Map<BpCategory, number>();
	for (const b of bars) counts.set(b.category, (counts.get(b.category) ?? 0) + 1);
	return {
		range,
		from: span.from,
		to: span.to,
		label: range === "1y" ? yearLabel(span.from, span.to) : periodLabel(span.from, span.to, today),
		title: range === "7d" ? "Weekly Readings" : range === "4w" ? "Monthly Readings" : "Weekly Ranges",
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		bars,
		ticks: top ? Array.from({ length: top / 40 + 1 }, (_, k) => top - k * 40) : [0],
		axis,
		tiles: BP_CATEGORIES.map((c) => ({ value: bars.length ? String(counts.get(c.id) ?? 0) : "--", label: c.label, category: c.id })),
	};
}
