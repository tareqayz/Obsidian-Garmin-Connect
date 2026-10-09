import type { PulseOxRow, Spo2DayData } from "../sync/pulse-ox-index";
import {
	canStepBack,
	cardDate,
	dayLabel,
	dayOf,
	daysOf,
	meanOf,
	offsetOfDay,
	periodLabel,
	periodOf,
	weekdayOf,
	axisDay,
	type PeriodAxis,
	type PeriodRoute,
} from "./periods";

/**
 * Garmin Connect's Pulse Ox page, worked out from the pulse ox index
 * (`src/sync/pulse-ox-index.ts`) and, for one day, its hourly averages.
 * Pure. The rules (ref/health-stats/pulse-ox/README.md):
 *
 * - 1d, 7d and 4w only.
 * - The day's figures are Garmin's (average, lowest, latest, the overnight
 *   average); the average equals round(mean of the day's hourly averages).
 *   The 7-day average is sent unrounded and shown half up (Inferred).
 * - A period's Avg SpO₂ is the half-up mean of its daily averages, over the
 *   days with one (`overallSpo2Average`'s rule).
 * - Every axis runs 60–100 % by 10. Bands: 90–100, 80–89, 70–79, < 70.
 * - 7d draws a column a day labelled by weekday; 4w four week columns
 *   labelled by each week's middle day ("09-14").
 * - Readings stopped on 2026-06-27: later days show "--".
 */

export type Spo2Band = "high" | "mid" | "low" | "poor" | "none";

export interface PulseOxPageData {
	rows: readonly PulseOxRow[];
	complete: boolean;
}

export interface PulseOxInput {
	data: PulseOxPageData;
	route: PeriodRoute;
	today: string;
	/** 1d: the day's block, `spo2DayIn(series)`: undefined while it loads, null once Garmin had none. */
	day?: Spo2DayData | null;
}

export interface PulseOxFigure {
	value: string;
	label: string;
}

const DASH = "--";
const HOUR_MS = 3_600_000;
export const SPO2_TICKS = [100, 90, 80, 70, 60];

/** A reading's band, as the gauge and the legend colour it. */
export function spo2Band(value: number | undefined | null): Spo2Band {
	if (value === undefined || value === null) return "none";
	return value >= 90 ? "high" : value >= 80 ? "mid" : value >= 70 ? "low" : "poor";
}

export function percentText(value: number | undefined): string {
	return value === undefined ? DASH : `${value}%`;
}

const byDate = (rows: readonly PulseOxRow[]) => new Map(rows.map((r) => [r.date, r]));
const canGoBack = (data: PulseOxPageData, from: string) => canStepBack(data.rows[0]?.date, data.complete, from);

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

export interface Spo2Bar {
	/** The hour's middle across the window, 0..1. */
	x: number;
	value: number;
	band: Spo2Band;
}

export interface PulseOxDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The gauge's value: the day's average. */
	gauge?: number;
	band: Spo2Band;
	/** `pending` while the hours load, `empty` without any, `drawn` otherwise. */
	state: "pending" | "empty" | "drawn";
	bars: Spo2Bar[];
	axis: PeriodAxis;
	/** round(mean of the hourly averages): equals Garmin's average. */
	hourlyMean?: number;
	/** Lowest, Latest, 7-Day Avg, Overnight. */
	figures: PulseOxFigure[];
}

function clockLabel(hour: number): string {
	return `${hour % 12 || 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
}

/** A dot an hour of the window; a 24-hour day labels every sixth, another only its ends. */
export function spo2HourAxis(hours: number): PeriodAxis {
	const axis: PeriodAxis = { dots: [], labels: [] };
	for (let h = 0; h <= hours; h++) {
		const large = hours === 24 ? h % 6 === 0 : h === 0 || h === hours;
		axis.dots.push({ x: h / hours, large });
		if (large) axis.labels.push({ x: h / hours, text: clockLabel(hours === 24 ? h : 0) });
	}
	return axis;
}

export function pulseOxDayView(input: PulseOxInput): PulseOxDayView {
	const { data, today, day } = input;
	const date = dayOf(input.route, today);
	const row = byDate(data.rows).get(date);
	const length = day ? day.end - day.start : 24 * HOUR_MS;
	const hours = Math.max(1, Math.round(length / HOUR_MS));
	const bars: Spo2Bar[] = [];
	for (const [t, value] of day?.hours ?? []) {
		if (value === null) continue;
		const x = (t - day!.start + HOUR_MS / 2) / (hours * HOUR_MS);
		if (x <= 0 || x >= 1) continue;
		bars.push({ x, value, band: spo2Band(value) });
	}
	const gauge = day?.avg ?? row?.avg;
	const low = day?.low ?? row?.low;
	const latest = day?.latest ?? row?.latest;
	const avg7 = day?.avg7 !== undefined ? Math.round(day.avg7) : undefined;
	return {
		range: "1d",
		date,
		label: dayLabel(date, today),
		canGoBack: canGoBack(data, date),
		canGoForward: date < today,
		...(gauge !== undefined ? { gauge } : {}),
		band: spo2Band(gauge),
		state: day === undefined ? "pending" : bars.length ? "drawn" : "empty",
		bars,
		axis: spo2HourAxis(hours),
		...(bars.length ? { hourlyMean: meanOf(bars.map((b) => b.value), "round") } : {}),
		figures: [
			{ value: percentText(low), label: "Lowest" },
			{ value: percentText(latest), label: day?.latestTime ? `Latest · ${day.latestTime}` : "Latest" },
			{ value: percentText(avg7), label: "7-Day Avg" },
			{ value: percentText(day?.sleepAvg), label: "Overnight" },
		],
	};
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

export interface PulseOxPoint {
	/** The day's middle across the period, 0..1. */
	x: number;
	value: number;
	band: Spo2Band;
}

export interface PulseOxDayCard {
	date: string;
	weekday: string;
	detail: string;
	value: string;
	avg?: number;
	offset: number;
}

export interface PulseOxPeriodView {
	range: "7d" | "4w";
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** Column dividers across the plot, 0..1: a day's (7d) or a week's (4w). */
	columns: number[];
	points: PulseOxPoint[];
	axis: PeriodAxis;
	average?: number;
	figures: PulseOxFigure[];
	/** Newest first. */
	days: PulseOxDayCard[];
}

const WEEKDAY_SHORT = (date: string) => weekdayOf(date).slice(0, 3);

export function pulseOxPeriodView(input: PulseOxInput): PulseOxPeriodView {
	const { data, route, today } = input;
	const range = route.range === "4w" ? "4w" : "7d";
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = byDate(data.rows);
	const n = days.length;
	const points: PulseOxPoint[] = [];
	days.forEach((d, i) => {
		const avg = rows.get(d)?.avg;
		if (avg !== undefined) points.push({ x: (i + 0.5) / n, value: avg, band: spo2Band(avg) });
	});
	const average = meanOf(points.map((p) => p.value), "round");
	const groups = range === "7d" ? 7 : 4;
	const size = n / groups;
	const axis: PeriodAxis = { dots: [], labels: [] };
	for (let g = 0; g < groups; g++) {
		const x = (g + 0.5) / groups;
		axis.dots.push({ x, large: true });
		axis.labels.push({ x, text: range === "7d" ? WEEKDAY_SHORT(days[g]!) : axisDay(days[g * size + 3]!) });
	}
	return {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		columns: Array.from({ length: groups + 1 }, (_, g) => g / groups),
		points,
		axis,
		...(average !== undefined ? { average } : {}),
		figures: [{ value: percentText(average), label: "Avg SpO₂" }],
		days: [...days].reverse().map((date) => {
			const avg = rows.get(date)?.avg;
			return { date, weekday: weekdayOf(date), detail: cardDate(date, today), value: avg !== undefined ? `${avg}%` : "", ...(avg !== undefined ? { avg } : {}), offset: offsetOfDay(date, today) };
		}),
	};
}

export type PulseOxView = PulseOxDayView | PulseOxPeriodView;

export function pulseOxView(input: PulseOxInput): PulseOxView {
	return input.route.range === "1d" ? pulseOxDayView(input) : pulseOxPeriodView(input);
}
