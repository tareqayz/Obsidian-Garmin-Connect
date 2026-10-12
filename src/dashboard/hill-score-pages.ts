import type { HillScoreRow } from "../sync/hill-score-index";
import type { Vo2MaxRow } from "../sync/vo2-max-index";
import { FACTOR_COPY, hillPhrase, type FactorBand } from "./hill-score-copy";
import { HILL_CLASSES, VO2_CLASSES, vo2Class, vo2Scale, type Gauge, type GaugeSegment, type Sex, type Tone } from "./gauges";
import {
	SHORT_MONTHS,
	axisDay,
	canStepBack,
	cardDate,
	dayAxis,
	dayLabel,
	dayOf,
	daysBetween,
	daysOf,
	lastDayOfMonth,
	meanOf,
	monthLabel,
	offsetOfDay,
	shiftMonth,
	spread,
	weekStartOf,
	weekdayOf,
	type PeriodAxis,
	type PeriodRange,
	type PeriodRoute,
	type Span,
} from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { performanceStatRoute, type PerformanceStatRoute } from "./routes";
import { shiftDate } from "./series";
import { segmentsFromAngles } from "./stat-dial";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { NO_DATA, NO_READING, classCopy, readingsOf, topPercent, vo2DialGauge, type Vo2Reading } from "./vo2-max-pages";

/**
 * Garmin Connect's Hill Score page (Performance Stats), worked out from the
 * hill score index (`src/sync/hill-score-index.ts`) and, for the VO₂ Max
 * factor, the vo2-max index. Rules measured on the phone and the web on
 * 2026-10-11 (ref/performance-stats/hill-score/README.md):
 *
 * - 1d is a day: its score on the page's dial over "100", Garmin's class
 *   (`classId`) under the dial, the feedback phrase under that, and three
 *   factor cards, each opening a half sheet: Hill Endurance and Hill Strength
 *   on a three-band dial split at 30 and 70, and VO₂ Max — the vo2-max
 *   index's newest running reading on or before the day, Garmin's integer,
 *   graded as the VO₂ Max page grades it.
 * - The dial is linear, 0–100, but its bands are not at the class limits:
 *   the gaps sit at −72, 4.55, 64.5, 108 and 135° (26, 51.5, 71.5, 86 and 95
 *   on the score scale). The marker takes the colour of the band under it.
 * - Every average is floored. 4w plots its days and 12w the floored mean of
 *   each Monday week (Garmin's weekly aggregation, the account's week start
 *   ignored); 1y the floored mean of each calendar month, at its 1st on a
 *   day-scaled axis. Avg Score is the floored mean of the plotted points (the
 *   1y's 34 proves it: 418 / 12 = 34.83, where the days' mean is 35.70); Max
 *   Score is the period's best day, not its best point. The y axis is 0–100
 *   on every view.
 * - 4w, 12w and a month list their days, newest first; 1y lists its months,
 *   "29 Avg" over the help table's class for 29. A month card opens that
 *   month's page (`sub` "month:YYYY-MM"): its days, stepped a month at a
 *   time.
 *
 * Inferred (unseen on the phone): a day without a row (no dial, the no-data
 * line), a calibrating day (the bands without a number or a marker), the
 * copy for most phrase ids, the factor words past Low, the current month's
 * page (the month so far), how far "<" goes, and what a day card opens (1d
 * on its day, `offset`).
 *
 * The charts' geometry is `hill-score-charts.ts`, off the Obsidian twin.
 *
 * Pure.
 */

/** What the page's route says: the range, how many periods back, and the month page a 1y card opened. */
export interface HillScoreRoute {
	range: PeriodRange;
	offset: number;
	/** "month:2026-03": the month page. */
	sub?: string;
}

/** What the view needs besides the route and the index's rows. */
export interface HillScoreContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** The vo2-max index's rows, oldest first: the VO₂ Max factor's reading. */
	vo2?: readonly Vo2MaxRow[];
	/** Who the VO₂ reading is graded for (`vo2Person`): without both, it has no class. */
	age?: number;
	sex?: Sex;
}

export const DASH = "--";
/** The line under the dial's number. */
export const DIAL_TOP = "100";

/**
 * The page dial's bands: their boundaries in degrees from 12 o'clock, the
 * gap centres measured on the 1d shot (the Figma foundation's Hill row
 * agrees), and Garmin's colours for them.
 */
export const HILL_DIAL_ANGLES: readonly number[] = [-150, -72, 4.55, 64.5, 108, 135, 150];
export const HILL_DIAL_TONES: readonly Tone[] = ["red", "orange", "green", "blue", "purple", "pink"];

/** The factor sheets' dial: three bands split at 30 and 70 on a linear 0–100 (−60° and 60°). */
export const FACTOR_DIAL_ANGLES: readonly number[] = [-150, -60, 60, 150];
export const FACTOR_DIAL_TONES: readonly Tone[] = ["orange", "yellow", "green"];

/** The help table's lower limits of Challenger, Trained, Skilled, Expert and Elite. */
export const HILL_LIMITS: readonly number[] = [25, 50, 70, 85, 95];

/** The y axis of every range: fixed, top first. */
export const HILL_TICKS: readonly number[] = [100, 75, 50, 25, 0];

/** The registry's Hill Score: its ranges and its 1y in calendar months. */
const HILL_STAT = PERFORMANCE_REGISTRY.page("hill-score")!;

/* ------------------------------------------------------------------ */
/*  Classes, dials and words                                           */
/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The colour under the marker: the band it sits in, as `gauges.ts` colours its markers. */
function toneAt(segments: readonly GaugeSegment[], at: number): Tone {
	return (segments.find((s) => at < s.to) ?? segments[segments.length - 1]!).tone;
}

/** A score's class by the help table: Recreational 1-24, Challenger 25-49 … Elite 95-100. */
export function hillClassOf(score: number): string {
	return HILL_CLASSES[HILL_LIMITS.filter((limit) => score >= limit).length]!;
}

/** A day's class word: the class Garmin sends (`classId`, 1–6), else its score's. None while calibrating. */
export function hillClassWord(row: Pick<HillScoreRow, "score" | "classId"> | undefined): string | undefined {
	const id = row?.classId;
	if (id !== undefined && id >= 1 && id <= HILL_CLASSES.length) return HILL_CLASSES[id - 1];
	return row?.score !== undefined ? hillClassOf(row.score) : undefined;
}

/**
 * The page's dial for a score: the number over "100", the six bands, and the
 * marker at score / 100 in its band's colour (29 → −63.0°). Without a score
 * (a calibrating day) the bands alone, "--" in the middle.
 */
export function hillDialGauge(score: number | undefined): Gauge {
	const segments = segmentsFromAngles(HILL_DIAL_ANGLES, HILL_DIAL_TONES);
	if (score === undefined) return { value: DASH, label: DIAL_TOP, segments };
	const at = clamp01(score / 100);
	return { value: String(score), label: DIAL_TOP, segments, at, tone: toneAt(segments, at) };
}

/** A factor's band: Low under 30 (seen), Moderate to 69 and High from 70 (Inferred). */
export function factorBand(value: number): FactorBand {
	return value < 30 ? "low" : value < 70 ? "moderate" : "high";
}

const FACTOR_WORDS: Readonly<Record<FactorBand, string>> = { low: "Low", moderate: "Moderate", high: "High" };

/** A factor's word, on its card and under its sheet's number: "Low". */
export function factorWord(value: number): string {
	return FACTOR_WORDS[factorBand(value)];
}

/** A Hill Endurance or Hill Strength sheet's dial: the value over its word, the marker at value / 100 (7 → −129.0°). */
export function factorGauge(value: number): Gauge {
	const segments = segmentsFromAngles(FACTOR_DIAL_ANGLES, FACTOR_DIAL_TONES);
	const at = clamp01(value / 100);
	return { value: String(value), label: factorWord(value), segments, at, tone: toneAt(segments, at) };
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/** A factor's half sheet: its title, its dial, and the copy under it (none where unseen). */
export interface HillFactorSheet {
	title: string;
	gauge: Gauge;
	copy?: string;
}

/** A FACTORS card: the title over the value, the word on the right, and the sheet it opens. */
export interface HillFactor {
	key: "endurance" | "strength" | "vo2";
	/** "Hill Endurance", "Hill Strength", "VO₂ Max". */
	title: string;
	/** The value: "7", "55"; "--" without one. */
	detail: string;
	/** "Low", "Excellent"; empty without one. */
	rating: string;
	/** Null without a value: the card opens nothing. */
	sheet: HillFactorSheet | null;
}

export interface HillDayView {
	range: "1d";
	date: string;
	/** "Today", "Saturday, October 10". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/**
	 * `scored`; `calibrating`, Garmin's first two weeks, a row without a score;
	 * `none`, no row at all: the watch has not scored the day yet, or the day
	 * is before the history.
	 */
	state: "scored" | "calibrating" | "none";
	/** The dial: the score over "100", its bands and its marker; the bands alone while calibrating; null without a row. */
	gauge: Gauge | null;
	/** Garmin's class under the dial: "Challenger". */
	classWord?: string;
	/** The feedback phrase under the class, where its copy is known. */
	copy?: string;
	/** Hill Endurance, Hill Strength, VO₂ Max; none without a row. */
	factors: HillFactor[];
	/** The line in place of the dial without a row. */
	empty?: string;
}

/** The VO₂ Max factor's reading: the newest running reading on or before `date`. */
export function hillVo2Reading(rows: readonly Vo2MaxRow[] | undefined, date: string): Vo2Reading | undefined {
	const readings = readingsOf(rows ?? [], "running").filter((r) => r.date <= date);
	return readings[readings.length - 1];
}

function hillFactor(key: "endurance" | "strength", title: string, value: number | undefined): HillFactor {
	if (value === undefined) return { key, title, detail: DASH, rating: "", sheet: null };
	const sheet: HillFactorSheet = { title, gauge: factorGauge(value) };
	const copy = FACTOR_COPY[key][factorBand(value)];
	if (copy) sheet.copy = copy;
	return { key, title, detail: String(value), rating: factorWord(value), sheet };
}

/**
 * The VO₂ Max card and sheet: Garmin's integer, the precise value's class
 * and copy, and the VO₂ Max page's own dial (`vo2DialGauge`), which the
 * sheet draws on the hill dial's ring.
 */
export function vo2Factor(reading: Vo2Reading | undefined, ctx: Pick<HillScoreContext, "age" | "sex">): HillFactor {
	const title = "VO₂ Max";
	if (!reading) return { key: "vo2", title, detail: DASH, rating: "", sheet: null };
	const scale = ctx.age !== undefined && ctx.sex ? vo2Scale(ctx.age, ctx.sex) : undefined;
	const sheet: HillFactorSheet = { title, gauge: vo2DialGauge(reading, scale) };
	if (scale) sheet.copy = classCopy("running", topPercent(reading.value, scale));
	const rating = scale ? VO2_CLASSES[vo2Class(reading.value, scale)]! : "";
	return { key: "vo2", title, detail: String(reading.shown), rating, sheet };
}

function dayView(date: string, rows: ReadonlyMap<string, HillScoreRow>, oldest: string | undefined, ctx: HillScoreContext): HillDayView {
	const row = rows.get(date);
	const view: HillDayView = {
		range: "1d",
		date,
		label: dayLabel(date, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, date),
		canGoForward: date < ctx.today,
		state: !row ? "none" : row.score !== undefined ? "scored" : "calibrating",
		gauge: null,
		factors: [],
	};
	if (!row) {
		view.empty = NO_READING;
		return view;
	}
	view.gauge = hillDialGauge(row.score);
	const word = hillClassWord(row);
	if (word) view.classWord = word;
	const copy = hillPhrase(row.phraseId);
	if (copy) view.copy = copy;
	view.factors = [
		hillFactor("endurance", "Hill Endurance", row.endurance),
		hillFactor("strength", "Hill Strength", row.strength),
		vo2Factor(hillVo2Reading(ctx.vo2, date), ctx),
	];
	return view;
}

/* ------------------------------------------------------------------ */
/*  4w, 12w, 1y and the month page                                     */
/* ------------------------------------------------------------------ */

export interface HillPoint {
	/** The day, or the week's Monday, or the month's 1st. */
	date: string;
	/** Across the plot, 0..1. */
	x: number;
	value: number;
}

/** A range's chart, as `linePlot` takes it. */
export interface HillChart {
	/** 100, 75, 50, 25, 0 on every range. */
	ticks: number[];
	axis: PeriodAxis;
	points: HillPoint[];
	/** Days and weeks draw a dot on each point; 1y's months are a bare line. */
	dots: boolean;
}

/** "29 · Avg Score", "30 · Max Score". */
export interface HillFigure {
	value: string;
	label: string;
}

/** A day of a 4w, 12w or month list. */
export interface HillDayCard {
	date: string;
	/** "Sunday". */
	weekday: string;
	/** "October 11", or "October 11, 2025" in another year. */
	detail: string;
	/** "29". */
	value: string;
	/** Garmin's class for the day: "Challenger". */
	word: string;
	/** The 1d page the card opens: days back from today. */
	offset: number;
}

/** A month of the 1y list. */
export interface HillMonthCard {
	/** `YYYY-MM`. */
	month: string;
	/** "October 2026". */
	title: string;
	/** "29 Avg". */
	value: string;
	/** The help table's class for the month's average. */
	word: string;
	/** The month page it opens, on top of the 1y. */
	route: PerformanceStatRoute;
}

export interface HillPeriodView {
	range: "4w" | "12w" | "1y" | "month";
	span: Span;
	/** "Sep 14 - Oct 11", "Nov 2025 - Oct 2026", "March 2026". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The month page's month, `YYYY-MM`: its "<" and ">" step it (`monthSub`). */
	month?: string;
	/** Null for a period without a point. */
	chart: HillChart | null;
	/** The line in place of the plot when there is no chart. */
	empty?: string;
	/** Avg Score, Max Score. */
	figures: HillFigure[];
	/** 4w, 12w and a month: the days with a score, newest first. */
	days: HillDayCard[];
	/** 1y: the months with a score, newest first. */
	months: HillMonthCard[];
}

export type HillScoreView = HillDayView | HillPeriodView;

const MONTH_SUB = /^month:(\d{4}-(?:0[1-9]|1[0-2]))$/;

/** The month page's sub-page: "month:2026-03". */
export function monthSub(month: string): string {
	return `month:${month.slice(0, 7)}`;
}

/** The month a route's sub-page names, `YYYY-MM`; undefined for any other sub-page. */
export function monthOfSub(sub: string | undefined): string | undefined {
	return sub === undefined ? undefined : MONTH_SUB.exec(sub)?.[1];
}

/** The month page's "<" (−1) and ">" (+1): the sub-page of the month before or after. */
export function stepMonthSub(month: string, by: number): string {
	return monthSub(shiftMonth(month, by));
}

/**
 * What a day card opens: 1d on its day (Inferred). On 4w and 12w the page
 * moves there in place, as the shared periods' day cards do; a month page
 * pushes it on top, so Back returns to the month, on a route without the
 * month's `sub`, which would reopen the month page.
 */
export function dayCardOpens(range: HillPeriodView["range"], card: Pick<HillDayCard, "offset">): { go: PerformanceStatRoute } | { move: PeriodRoute<PeriodRange> } {
	return range === "month" ? { go: performanceStatRoute("hill-score", { range: "1d", offset: card.offset }) } : { move: { range: "1d", offset: card.offset } };
}

/** Each scored day's score, by day. */
function scoresOf(rows: Iterable<HillScoreRow>): Map<string, number> {
	const out = new Map<string, number>();
	for (const row of rows) if (row.score !== undefined) out.set(row.date, row.score);
	return out;
}

/** The scores of a span's days that have one, oldest first. */
function scoresIn(scores: ReadonlyMap<string, number>, from: string, to: string): number[] {
	const out: number[] = [];
	for (const day of daysOf({ from, to })) {
		const v = scores.get(day);
		if (v !== undefined) out.push(v);
	}
	return out;
}

/** 4w and the month page: a point a scored day, at its day, under a dot a day. */
export function dayPoints(span: Span, scores: ReadonlyMap<string, number>): { points: HillPoint[]; axis: PeriodAxis } {
	const days = daysOf(span);
	const points: HillPoint[] = [];
	days.forEach((date, i) => {
		const value = scores.get(date);
		if (value !== undefined) points.push({ date, x: spread(i, days.length), value });
	});
	return { points, axis: dayAxis(days) };
}

/**
 * 12w: the Monday weeks the span touches, each a slot, evenly spaced and
 * labelled with its Monday on end; a point for each week with a score, the
 * floored mean of its days inside the span. On the capture day, a Sunday, the
 * span is twelve whole weeks; on another day the first and last are part
 * weeks, as Garmin's weekly aggregation counts them.
 */
export function weekPoints(span: Span, scores: ReadonlyMap<string, number>): { points: HillPoint[]; axis: PeriodAxis } {
	const mondays: string[] = [];
	for (let monday = weekStartOf(span.from, 1); monday <= span.to; monday = shiftDate(monday, 7)) mondays.push(monday);
	const x = (i: number) => spread(i, mondays.length);
	const points: HillPoint[] = [];
	mondays.forEach((monday, i) => {
		const sunday = shiftDate(monday, 6);
		const value = meanOf(scoresIn(scores, monday < span.from ? span.from : monday, sunday > span.to ? span.to : sunday), "floor");
		if (value !== undefined) points.push({ date: monday, x: x(i), value });
	});
	return {
		points,
		axis: {
			dots: mondays.map((_, i) => ({ x: x(i), large: true })),
			labels: mondays.map((monday, i) => ({ x: x(i), text: axisDay(monday), rotated: true })),
		},
	};
}

/**
 * 1y: the span's calendar months, each the floored mean of its scored days
 * inside the span (October 2026 is Oct 1–11), placed at its 1st on an axis
 * that runs by days from the first month's 1st to the last's, so the steps
 * follow the months' lengths.
 */
export function monthPoints(span: Span, scores: ReadonlyMap<string, number>): { points: HillPoint[]; axis: PeriodAxis } {
	const months: string[] = [];
	for (let month = span.from.slice(0, 7); month <= span.to.slice(0, 7); month = shiftMonth(month, 1)) months.push(month);
	const first = `${months[0]}-01`;
	const length = daysBetween(first, `${months[months.length - 1]}-01`);
	const x = (month: string) => (length > 0 ? daysBetween(first, `${month}-01`) / length : 0.5);
	const points: HillPoint[] = [];
	for (const month of months) {
		const from = `${month}-01` < span.from ? span.from : `${month}-01`;
		const end = lastDayOfMonth(month);
		const value = meanOf(scoresIn(scores, from, end > span.to ? span.to : end), "floor");
		if (value !== undefined) points.push({ date: `${month}-01`, x: x(month), value });
	}
	return {
		points,
		axis: {
			dots: months.map((month) => ({ x: x(month), large: true })),
			labels: months.map((month) => ({ x: x(month), text: SHORT_MONTHS[Number(month.slice(5, 7)) - 1]!, rotated: true })),
		},
	};
}

/** The day cards: the span's scored days, newest first. */
function dayCards(span: Span, rows: ReadonlyMap<string, HillScoreRow>, today: string): HillDayCard[] {
	const cards: HillDayCard[] = [];
	for (const date of daysOf(span).reverse()) {
		const row = rows.get(date);
		if (row?.score === undefined) continue;
		cards.push({
			date,
			weekday: weekdayOf(date),
			detail: cardDate(date, today),
			value: String(row.score),
			word: hillClassWord(row) ?? "",
			offset: offsetOfDay(date, today),
		});
	}
	return cards;
}

function figuresOf(points: readonly HillPoint[], days: readonly number[]): HillFigure[] {
	const avg = meanOf(points.map((p) => p.value), "floor");
	return [
		{ value: avg !== undefined ? String(avg) : DASH, label: "Avg Score" },
		{ value: days.length ? String(Math.max(...days)) : DASH, label: "Max Score" },
	];
}

/** A period's page: what `plotted` puts on the chart, its figures, and its days. */
function periodView(
	range: HillPeriodView["range"],
	span: Span,
	label: string,
	steps: Pick<HillPeriodView, "canGoBack" | "canGoForward">,
	plotted: { points: HillPoint[]; axis: PeriodAxis },
	rows: ReadonlyMap<string, HillScoreRow>,
	scores: ReadonlyMap<string, number>,
	today: string,
): HillPeriodView {
	const { points, axis } = plotted;
	const view: HillPeriodView = {
		range,
		span,
		label,
		...steps,
		chart: points.length ? { ticks: [...HILL_TICKS], axis, points, dots: range !== "1y" } : null,
		figures: figuresOf(points, scoresIn(scores, span.from, span.to)),
		days: range === "1y" ? [] : dayCards(span, rows, today),
		months: [],
	};
	if (!view.chart) view.empty = NO_DATA;
	return view;
}

/** The month page: a calendar month's days, the current month so far (Inferred), stepped a month at a time. */
function monthView(
	month: string,
	rows: ReadonlyMap<string, HillScoreRow>,
	scores: ReadonlyMap<string, number>,
	oldest: string | undefined,
	ctx: HillScoreContext,
): HillPeriodView {
	const current = ctx.today.slice(0, 7);
	const shown = month > current ? current : month;
	const end = lastDayOfMonth(shown);
	const span: Span = { from: `${shown}-01`, to: end > ctx.today ? ctx.today : end };
	const steps = { canGoBack: canStepBack(oldest, ctx.complete, span.from), canGoForward: shown < current };
	return { ...periodView("month", span, monthLabel(shown), steps, dayPoints(span, scores), rows, scores, ctx.today), month: shown };
}

/** The page, on its route's range, or the month page its sub-page names. */
export function hillScoreView(route: HillScoreRoute, rows: readonly HillScoreRow[], ctx: HillScoreContext): HillScoreView {
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const scores = scoresOf(rows);
	const oldest = rows[0]?.date;
	const month = monthOfSub(route.sub);
	if (month) return monthView(month, byDate, scores, oldest, ctx);
	if (route.range === "1d") return dayView(dayOf(route, ctx.today), byDate, oldest, ctx);

	const period = { range: route.range, offset: route.offset };
	const span = statSpan(HILL_STAT, period, ctx.today)!;
	const label = statPeriodLabel(HILL_STAT, period, ctx.today);
	const range = route.range === "12w" ? "12w" : route.range === "1y" ? "1y" : "4w";
	const plotted = range === "12w" ? weekPoints(span, scores) : range === "1y" ? monthPoints(span, scores) : dayPoints(span, scores);
	const steps = { canGoBack: canStepBack(oldest, ctx.complete, span.from), canGoForward: route.offset < 0 };
	const view = periodView(range, span, label, steps, plotted, byDate, scores, ctx.today);
	if (range === "1y") {
		view.months = [...plotted.points].reverse().map((p) => {
			const month = p.date.slice(0, 7);
			return {
				month,
				title: monthLabel(month),
				value: `${p.value} Avg`,
				word: hillClassOf(p.value),
				route: performanceStatRoute("hill-score", { range: "1y", offset: route.offset, sub: monthSub(month) }),
			};
		});
	}
	return view;
}
