import type { FitnessAgeDay, FitnessAgeRow, FitnessComponent, FitnessFactor } from "../sync/fitness-age-index";
import {
	canStepBack,
	daysOf,
	dayAxis,
	longDate,
	monthAxis,
	periodLabel,
	periodOf,
	rollingWeeks,
	spread,
	yearLabel,
	type PeriodAxis,
	type PeriodRoute,
	type SpanRange,
} from "./periods";

/**
 * Garmin Connect's Fitness Age page (ref/health-stats/fitness-age/README.md):
 * Current, from the day's `fitnessage` payload, and the 7d / 4w / 1y trends
 * from the fitness age index.
 *
 * Rules, measured on 2026-10-08:
 * - Component values are shown as sent: 1 dp, vigorous days truncated (the
 *   payload already is; truncating again changes nothing).
 * - A component with `targetValue` is a recommendation, sorted by
 *   `priority`; the others are on target, in the phone's fixed order
 *   Vigorous Minutes, Vigorous Days, Resting Heart Rate (then BMI).
 * - Trends: a point per recalculation day, the line joining rows straight
 *   across days without one; 1y weeks are the mean of their rows, cards
 *   rounded half up to whole years.
 *
 * Pure.
 */

const DASH = "--";

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

export interface FactorCard {
	factor: FitnessFactor;
	title: string;
	detail: string;
}

export interface FitnessTrack {
	/** Where each dot sits along the track, 0..1: the fitness age at the centre. */
	fitness: number;
	age?: number;
}

export interface FitnessCurrentView {
	/** "pending" until the payload loads (the hero from the index), "empty" before any data. */
	state: "pending" | "ready" | "empty";
	updated?: string;
	fitnessAge: string;
	age?: string;
	track: FitnessTrack;
	headline?: string;
	recommendations: FactorCard[];
	onTarget: FactorCard[];
	bmi?: BmiSheet;
}

export interface BmiSheet {
	target: string;
	average: string;
	/** Target and average along the sheet's track, the average at the centre. */
	track: { target: number; average: number };
	copy: string;
}

/** Years either side of the fitness age along the track (the phone: 5 years ≈ 28% of it). */
export const AGE_HALF_SPAN = 8.8;
/** BMI either side of the average along the sheet's track (3.3 ≈ 32%). */
export const BMI_HALF_SPAN = 5.2;

export const ON_TARGET_ORDER: readonly FitnessFactor[] = ["vigorousMinutesAvg", "vigorousDaysAvg", "rhr", "bmi"];

export const REACHED = "You've reached your target Fitness Age. Keep focusing on the following to maintain your fitness.";
/** Inferred: the headline above the achievable age is unseen. */
export const NOT_REACHED = "Keep focusing on the following to lower your Fitness Age.";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const trunc1 = (v: number) => Math.trunc(v * 10 + 1e-9) / 10;

/** A factor's figure as sent: 1 dp, vigorous days truncated, RHR whole. */
export function factorValue(factor: FitnessFactor, value: number): string {
	if (factor === "rhr") return String(Math.round(value));
	return String(factor === "vigorousDaysAvg" ? trunc1(value) : round1(value));
}

/** A fitness age as a whole number, half up (week cards; the hero for a fractional age, Inferred). */
export function ageText(value: number | undefined): string {
	return value === undefined ? DASH : String(Math.round(value));
}

const OFF_TITLE: Record<FitnessFactor, string> = {
	bmi: "Reduce BMI",
	vigorousDaysAvg: "Increase Vigorous Days",
	vigorousMinutesAvg: "Increase Vigorous Minutes",
	rhr: "Lower Resting Heart Rate",
};
const ON_TITLE: Record<FitnessFactor, string> = {
	bmi: "BMI",
	vigorousDaysAvg: "Vigorous Days",
	vigorousMinutesAvg: "Vigorous Minutes",
	rhr: "Resting Heart Rate",
};

function onTargetDetail(factor: FitnessFactor, c: FitnessComponent): string {
	switch (factor) {
		case "vigorousMinutesAvg":
			return "Maintain at least 75 min/wk";
		case "vigorousDaysAvg":
			return "Maintain at least 3 days/wk";
		case "rhr":
			return `Maintain ${factorValue("rhr", c.value!)} bpm`;
		case "bmi":
			return `Maintain ${factorValue("bmi", c.value!)}`;
	}
}

export function factorCards(day: FitnessAgeDay): { recommendations: FactorCard[]; onTarget: FactorCard[] } {
	const entries = (Object.entries(day.components) as Array<[FitnessFactor, FitnessComponent]>).filter(([, c]) => !c.stale && c.value !== undefined);
	const recommendations = entries
		.filter(([, c]) => c.targetValue !== undefined)
		.sort((a, b) => (a[1].priority ?? 99) - (b[1].priority ?? 99))
		.map(([factor, c]) => ({ factor, title: OFF_TITLE[factor], detail: `Weekly avg: ${factorValue(factor, c.value!)}` }));
	const onTarget = ON_TARGET_ORDER.flatMap((factor) => {
		const c = day.components[factor];
		return c && !c.stale && c.value !== undefined && c.targetValue === undefined ? [{ factor, title: ON_TITLE[factor], detail: onTargetDetail(factor, c) }] : [];
	});
	return { recommendations, onTarget };
}

export function bmiSheet(c: FitnessComponent | undefined): BmiSheet | undefined {
	if (!c || c.value === undefined) return undefined;
	const target = c.targetValue ?? 20.6;
	return {
		target: String(round1(target)),
		average: String(round1(c.value)),
		track: { target: clamp01(0.5 + (target - c.value) / (2 * BMI_HALF_SPAN)), average: 0.5 },
		copy: `Reducing your BMI to ${round1(target)} can help lower your Fitness Age.`,
	};
}

export function fitnessCurrentView(day: FitnessAgeDay | null | undefined, rows: readonly FitnessAgeRow[]): FitnessCurrentView {
	const track = (fa: number | undefined, age: number | undefined): FitnessTrack =>
		fa !== undefined && age !== undefined ? { fitness: 0.5, age: clamp01(0.5 + (age - fa) / (2 * AGE_HALF_SPAN)) } : { fitness: 0.5 };
	if (!day) {
		const last = [...rows].reverse().find((r) => r.age !== undefined);
		return { state: "pending", fitnessAge: ageText(last?.age), track: track(last?.age, undefined), recommendations: [], onTarget: [] };
	}
	if (day.fitnessAge === undefined) {
		return { state: "empty", fitnessAge: DASH, age: day.chronologicalAge !== undefined ? String(day.chronologicalAge) : undefined, track: { fitness: 0.5 }, recommendations: [], onTarget: [] };
	}
	const { recommendations, onTarget } = factorCards(day);
	const reached = day.achievableFitnessAge === undefined || day.fitnessAge <= day.achievableFitnessAge;
	const view: FitnessCurrentView = {
		state: "ready",
		fitnessAge: ageText(day.fitnessAge),
		track: track(day.fitnessAge, day.chronologicalAge),
		headline: reached ? REACHED : NOT_REACHED,
		recommendations,
		onTarget,
	};
	if (day.lastUpdated) view.updated = `Updated ${longDate(day.lastUpdated)}`;
	if (day.chronologicalAge !== undefined) view.age = String(day.chronologicalAge);
	const bmi = bmiSheet(day.components.bmi);
	if (bmi) view.bmi = bmi;
	return view;
}

/* ------------------------------------------------------------------ */
/*  Trends                                                             */
/* ------------------------------------------------------------------ */

export interface FitnessTrendPoint {
	x: number;
	value: number;
	date: string;
}

export interface FitnessWeekCard {
	from: string;
	to: string;
	title: string;
	value: string;
}

export interface FitnessTrendView {
	range: SpanRange;
	label: string;
	canGoBack: boolean;
	title: "Daily Totals" | "Weekly Totals";
	points: FitnessTrendPoint[];
	/** Dots on each point (7d, 4w); the year's line has none. */
	dots: boolean;
	ticks: number[];
	axis: PeriodAxis;
	/** 1y: the weeks, newest first. */
	weeks: FitnessWeekCard[];
}

/** value ± 2 by 2 around the period's rounded mean (Inferred from one flat case: 20 / 18 / 16). */
export function trendTicks(values: readonly number[]): number[] {
	const mid = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 18;
	return [mid + 2, mid, mid - 2];
}

export function fitnessTrendView(input: { rows: readonly FitnessAgeRow[]; complete: boolean; route: PeriodRoute; today: string }): FitnessTrendView {
	const range = (input.route.range === "1d" ? "7d" : input.route.range) as SpanRange;
	const span = periodOf(range, input.route.offset, input.today);
	const canGoBack = canStepBack(input.rows[0]?.date, input.complete, span.from);
	const byDate = new Map(input.rows.map((r) => [r.date, r]));
	if (range !== "1y") {
		const days = daysOf(span);
		const points = days.flatMap((d, i) => {
			const v = byDate.get(d)?.age;
			return v === undefined ? [] : [{ x: spread(i, days.length), value: v, date: d }];
		});
		return {
			range,
			label: periodLabel(span.from, span.to, input.today),
			canGoBack,
			title: "Daily Totals",
			points,
			dots: true,
			ticks: trendTicks(points.map((p) => p.value)),
			axis: dayAxis(days),
			weeks: [],
		};
	}
	const { axis, x } = monthAxis(span.from);
	const weeks = rollingWeeks(span.to).map((w) => {
		const values = daysOf(w).flatMap((d) => (byDate.get(d)?.age !== undefined ? [byDate.get(d)!.age!] : []));
		return { ...w, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined };
	});
	const points = weeks.flatMap((w) => (w.mean === undefined ? [] : [{ x: x(w.from), value: w.mean, date: w.from }]));
	return {
		range,
		label: yearLabel(span.from, span.to),
		canGoBack,
		title: "Weekly Totals",
		points,
		dots: false,
		ticks: trendTicks(points.map((p) => p.value)),
		axis,
		weeks: [...weeks].reverse().map((w) => ({ from: w.from, to: w.to, title: periodLabel(w.from, w.to, input.today), value: ageText(w.mean) })),
	};
}
