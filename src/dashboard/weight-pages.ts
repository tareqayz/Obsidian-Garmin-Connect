import { weighInsOf, type WeightRow } from "../sync/weight-index";
import {
	canStepBack,
	dayAxis,
	dayLabel,
	dayOf,
	daysOf,
	mean,
	monthAxis,
	offsetOfDay,
	periodLabel,
	periodOf,
	rollingWeeks,
	spread,
	weekdayOf,
	weekOffset,
	yearLabel,
	type PeriodAxis,
	type PeriodRoute,
} from "./periods";
import { readingDate } from "./day";

/**
 * Garmin Connect's Weight page, worked out from the weight index
 * (`src/sync/weight-index.ts`). Pure. The rules (ref/health-stats/weight/README.md):
 *
 * - A day's value in every span is its latest weigh-in; a span's average is
 *   the mean of those (never of all weigh-ins, never of day means). The 1d
 *   hero is the mean of all the day's weigh-ins.
 * - Grams show to 0.1 kg, half up: 67599.5 g → 67.6, 67199 → 67.2.
 * - BMI = kg ÷ (height m)², to 0.1, from the profile height the index keeps.
 *   No height: "--".
 * - A change is Garmin's `weightDelta`; null prints "0.0 kg →" (↑ up, ↓ down).
 * - 1y is a line through the 52 rolling weeks' averages, joining the weeks
 *   with data and running flat to the last week; never broken.
 * - y ticks: whole units from ⌊min⌋, four of them (67–70, 22–25), wider steps
 *   when the data needs them.
 * - 7d / 4w figures are Change and BMI (the twin); Change is the span's last
 *   day's latest minus its first day's (Inferred).
 */

export type WeightRoute = PeriodRoute;
export type WeightUnits = "metric" | "imperial";
export type WeightSeries = "weight" | "bmi";

export interface WeightPageData {
	rows: readonly WeightRow[];
	complete: boolean;
}

export interface WeightInput {
	data: WeightPageData;
	route: WeightRoute;
	today: string;
	units?: WeightUnits;
	series?: WeightSeries;
}

export interface WeightFigure {
	value: string;
	unit?: string;
	label: string;
}

const DASH = "--";
const LB = 453.59237;

/** One decimal, half up. */
export function round1(value: number): number {
	return Math.round(Math.round(value * 1000) / 100) / 10;
}

/** Grams in the account's unit, one decimal. */
export function massOf(grams: number, units: WeightUnits = "metric"): number {
	return units === "imperial" ? round1(grams / LB) : Math.round(grams / 100) / 10;
}

export function unitOf(units: WeightUnits = "metric"): string {
	return units === "imperial" ? "lb" : "kg";
}

/** "68.0". */
export function massText(grams: number | undefined, units: WeightUnits = "metric"): string {
	return grams === undefined ? DASH : massOf(grams, units).toFixed(1);
}

/** kg ÷ (m)², one decimal, or undefined without a height. */
export function bmiOf(grams: number | undefined, heightCm: number | undefined): number | undefined {
	if (grams === undefined || !heightCm) return undefined;
	const m = heightCm / 100;
	return round1(grams / 1000 / (m * m));
}

export function bmiText(bmi: number | undefined): string {
	return bmi === undefined ? DASH : bmi.toFixed(1);
}

/** "0.8 kg ↑", "1.0 kg ↓", and "0.0 kg →" for none. */
export function changeText(grams: number | null | undefined, units: WeightUnits = "metric"): string {
	const v = grams === null || grams === undefined ? 0 : massOf(Math.abs(grams), units) * Math.sign(grams);
	const arrow = v > 0 ? "↑" : v < 0 ? "↓" : "→";
	return `${Math.abs(v).toFixed(1)} ${unitOf(units)} ${arrow}`;
}

/** "10:27 AM" from "10:27:27". */
export function clockText(time: string): string {
	const h = Number(time.slice(0, 2));
	return `${h % 12 || 12}:${time.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`;
}

/** The newest height the index holds. */
export function heightIn(rows: readonly WeightRow[]): number | undefined {
	for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.h) return rows[i]!.h;
	return undefined;
}

/** Four whole-unit ticks from ⌊min⌋, top first; a wider step when the data runs past three units. */
export function weightTicks(min: number, max: number): number[] {
	const lo = Math.floor(min);
	const step = Math.max(1, Math.ceil((Math.ceil(max) - lo) / 3));
	return [3, 2, 1, 0].map((k) => lo + k * step);
}

const byDate = (rows: readonly WeightRow[]) => new Map(rows.map((r) => [r.date, r]));
const canGoBack = (data: WeightPageData, from: string) => canStepBack(data.rows[0]?.date, data.complete, from);

/** A 1y week card: "Oct 2 - 8"; another year "Oct 10-16, 2025", "Oct 31 - Nov 6, 2025". */
export function weekLabel(from: string, to: string, today: string): string {
	if (to.slice(0, 4) === today.slice(0, 4) || from.slice(0, 4) !== to.slice(0, 4)) return periodLabel(from, to, today);
	if (from.slice(0, 7) === to.slice(0, 7)) return periodLabel(from, to, today);
	return `${readingDate(from, to).replace(/, \d{4}$/, "")} - ${readingDate(to, today)}`;
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

export interface WeighInGroup {
	/** "10:27 AM". */
	time: string;
	weight: string;
	bmi: string;
}

export interface WeightDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The day mean, "68.0", or "--". */
	hero: string;
	unit: string;
	/** Oldest first. */
	weighIns: WeighInGroup[];
}

export function weightDayView(input: WeightInput): WeightDayView {
	const { data, today } = input;
	const units = input.units ?? "metric";
	const date = dayOf(input.route, today);
	const row = byDate(data.rows).get(date);
	const height = heightIn(data.rows);
	const entries = weighInsOf(row);
	const avg = row?.avg ?? mean(entries.map((e) => e.grams));
	return {
		range: "1d",
		date,
		label: dayLabel(date, today),
		canGoBack: canGoBack(data, date),
		canGoForward: date < today,
		hero: massText(avg, units),
		unit: unitOf(units),
		weighIns: entries.map((e) => ({ time: clockText(e.time), weight: `${massText(e.grams, units)} ${unitOf(units)}`, bmi: bmiText(bmiOf(e.grams, height)) })),
	};
}

/* ------------------------------------------------------------------ */
/*  7d, 4w, 1y                                                         */
/* ------------------------------------------------------------------ */

export interface WeightPoint {
	x: number;
	value: number;
	/** 7d / 4w: the day's High-Low, where it had weigh-ins that differ. */
	low?: number;
	high?: number;
}

export interface WeightCard {
	key: string;
	title: string;
	detail?: string;
	value: string;
	change: string;
	kind: "day" | "week";
	/** The route a tap switches to. */
	target: PeriodRoute;
}

export interface WeightPeriodView {
	range: "7d" | "4w" | "1y";
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	series: WeightSeries;
	/** False: "No data available." in the chart. */
	hasData: boolean;
	points: WeightPoint[];
	/** 1y: the line, joining the weeks with data and flat to the last week. */
	line: Array<{ x: number; value: number }>;
	ticks: number[];
	axis: PeriodAxis;
	/** The mean of each day's latest weigh-in, grams. */
	average?: number;
	figures: WeightFigure[];
	/** Newest first. */
	cards: WeightCard[];
}

function valueOf(grams: number, series: WeightSeries, units: WeightUnits, height: number | undefined): number | undefined {
	return series === "bmi" ? bmiOf(grams, height) : massOf(grams, units);
}

export function weightPeriodView(input: WeightInput): WeightPeriodView {
	const { data, route, today } = input;
	const units = input.units ?? "metric";
	const series = input.series ?? "weight";
	const range = route.range === "4w" ? "4w" : route.range === "1y" ? "1y" : "7d";
	const span = periodOf(range, route.offset, today);
	const rows = byDate(data.rows);
	const height = heightIn(data.rows);
	const days = daysOf(span);
	const latest = days.map((d) => rows.get(d)).filter((r): r is WeightRow & { w: number } => r?.w !== undefined);
	const average = mean(latest.map((r) => r.w));
	const unit = unitOf(units);
	const points: WeightPoint[] = [];
	const line: WeightPeriodView["line"] = [];
	const cards: WeightCard[] = [];
	let axis: PeriodAxis;
	let figures: WeightFigure[];
	const bmi = bmiOf(average, height);

	if (range === "1y") {
		const months = monthAxis(span.from);
		axis = months.axis;
		const weeks = rollingWeeks(span.to).map((w) => {
			const values = daysOf(w).map((d) => rows.get(d)?.w).filter((v): v is number => v !== undefined);
			return { ...w, avg: mean(values) };
		});
		let prev: number | undefined;
		const listed: WeightCard[] = [];
		for (const w of weeks) {
			if (w.avg === undefined) continue;
			const v = valueOf(w.avg, series, units, height);
			if (v !== undefined) line.push({ x: months.x(w.from), value: v });
			const delta = prev === undefined ? null : w.avg - prev;
			prev = w.avg;
			listed.push({
				key: w.to,
				title: weekLabel(w.from, w.to, today),
				value: `${massText(w.avg, units)} ${unit}`,
				change: changeText(delta, units),
				kind: "week",
				target: { range: "7d", offset: weekOffset(w.to, today) },
			});
		}
		const last = weeks[weeks.length - 1]!;
		if (line.length && line[line.length - 1]!.x < months.x(last.from)) line.push({ x: months.x(last.from), value: line[line.length - 1]!.value });
		cards.push(...listed.reverse());
		figures = [
			{ value: massText(average, units), ...(average !== undefined ? { unit } : {}), label: "Weight" },
			{ value: bmiText(bmi), label: "BMI" },
		];
	} else {
		axis = dayAxis(days);
		days.forEach((d, i) => {
			const row = rows.get(d);
			if (row?.w === undefined) return;
			const v = valueOf(row.w, series, units, height);
			if (v === undefined) return;
			const point: WeightPoint = { x: spread(i, days.length), value: v };
			if (series === "weight" && row.lo !== undefined && row.hi !== undefined && row.lo !== row.hi) {
				point.low = massOf(row.lo, units);
				point.high = massOf(row.hi, units);
			}
			points.push(point);
		});
		for (const r of [...latest].reverse()) {
			cards.push({
				key: r.date,
				title: weekdayOf(r.date),
				detail: readingDate(r.date, today),
				value: `${massText(r.w, units)} ${unit}`,
				change: changeText(r.d, units),
				kind: "day",
				target: { range: "1d", offset: offsetOfDay(r.date, today) },
			});
		}
		const first = latest[0];
		const end = latest[latest.length - 1];
		const change = first && end ? Math.round((massOf(end.w, units) - massOf(first.w, units)) * 10) / 10 : undefined;
		figures = [
			{ value: change === undefined ? DASH : (change > 0 ? "+" : "") + change.toFixed(1), ...(change !== undefined ? { unit } : {}), label: "Change" },
			{ value: bmiText(bmi), label: "BMI" },
		];
	}

	const values = range === "1y" ? line.map((p) => p.value) : points.flatMap((p) => [p.value, p.low ?? p.value, p.high ?? p.value]);
	return {
		range,
		from: span.from,
		to: span.to,
		label: range === "1y" ? yearLabel(span.from, span.to) : periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		series,
		hasData: values.length > 0,
		points,
		line,
		ticks: values.length ? weightTicks(Math.min(...values), Math.max(...values)) : series === "bmi" ? [25, 24, 23, 22] : [70, 69, 68, 67],
		axis,
		...(average !== undefined ? { average } : {}),
		figures,
		cards,
	};
}

export type WeightView = WeightDayView | WeightPeriodView;

export function weightView(input: WeightInput): WeightView {
	return input.route.range === "1d" ? weightDayView(input) : weightPeriodView(input);
}
