import type { HrvStatusRow } from "../sync/hrv-status-index";
import type { DaySeries } from "../sync/intraday";
import type { SleepRow } from "../sync/sleep-index";
import type { StressRow } from "../sync/stress-index";
import { morningOf, newestOf, type ReadinessReading, type TrainingReadinessRow } from "../sync/training-readiness-index";
import type { TrainingStatusRow } from "../sync/training-status-index";
import { shortDate } from "./day";
import type { Gauge, Tone } from "./gauges";
import { SEVEN_DAY_AVERAGES, hrvAverages, hrvDial, type HrvAverages, type HrvDial } from "./hrv-status-pages";
import { canStepBack, dayAxis, dayLabel, dayOf, daysOf, spread, type PeriodAxis, type Span } from "./periods";
import { shiftDate } from "./series";
import { qualifierText } from "./sleep-copy";
import { clockText, hm, timelineOf, type Timeline } from "./sleep-pages";
import { r2 } from "./stat-charts";
import { DIAL_END, dialFraction, segmentsFromAngles } from "./stat-dial";
import { stressPeriodView, type StressPeriodView } from "./stress-pages";
import {
	AVG_STRESS_LEVEL,
	CONTEXT_WORDS,
	DAILY_AVERAGES,
	DAILY_SCORES,
	DIAL_TOP,
	FACTOR_TITLES,
	FACTOR_WORDS,
	LEVEL_WORDS,
	RECOVERED,
	RELEVANT_SCORES,
	SLEEP_TIMELINE,
	readinessCopy,
	readinessTitle,
	sheetCopy,
	type FactorFeedback,
	type ReadinessFactorId,
} from "./training-readiness-copy";
import { trainingView, type AcuteChart, type LegendItem } from "./training-load-pages";
import { LOAD_WORDS, NO_DATA } from "./training-status-copy";

/**
 * Garmin Connect's Training Readiness page (Performance Stats), worked out
 * from the training-readiness index and the day's readings
 * (`src/sync/training-readiness-index.ts`), and for its six sheets the
 * Training Status, HRV Status, sleep and stress indexes and the day's series
 * file — it calls nothing on view but the day's readings. Rules measured on
 * the phone and the web on 2026-10-11
 * (ref/performance-stats/training-readiness/README.md):
 *
 * - A day at a time, no range control: "<" to the day before while the
 *   index may hold one, ">" on a past day. Today shows its newest reading
 *   (09:41's 18 after a run, not 07:36's 64); a past day its morning reading,
 *   the first `AFTER_WAKEUP_RESET` (Oct 10: 07:24's 80, not 19:30's 26).
 * - "Updated @ 9:41 AM • After Activity": the reading's time on the watch's
 *   clock, truncated to the minute, and its context.
 * - The dial is the page's 300° one, not linear: a point is 3.2° centred on
 *   51, so the band gaps sit at the level boundaries (24.5, 49.5, 74.5, 94.5
 *   → −84.8, −4.8, 75.2, 139.2°) and 18 at −105.6°. The marker takes its
 *   level's colour. Home's 270° `readinessDial` (gauges.ts) is another dial.
 * - Six factor cards. Each word and dot is Garmin's band of the factor
 *   (`…FactorFeedback`: VERY_GOOD and GOOD green, MODERATE orange, POOR red),
 *   but Acute Load's value and word are the day's Training Status row
 *   ("281 Low" on Oct 10, whose reading said 63), its dot still the
 *   reading's band. Recovery Time is whole hours, floored, and "Recovered"
 *   at 0 h.
 * - The sheets reuse the other pages' models: the Sleep page's 1d
 *   hypnogram, the HRV Status page's dial and 7-day chart, Load's acute
 *   timeline, Stress's 7d chart; Recent Sleep Scores is its own line on a
 *   fixed 0–100 with the two nights the factor weighs (D−2, D−1) picked out.
 *   Recent Stress's "Avg Stress Level" floors the 7-day mean, today's
 *   partial level included.
 *
 * Inferred (unseen on the phone): a past day's page (the web's), several
 * wake-up readings in a day (the first), a realtime reading's context
 * (none), Recovery's floor and the words "Low Need" / "Moderate Need", the
 * words and dots of every unseen band, NONE's grey dot and "--", the titles
 * and copy of unseen keys, the dial's clamp past 4.1 and 97.9, the empty,
 * onboarding and overnight states.
 *
 * The page's and the sheets' geometry, measured off the Obsidian twin
 * (Figma 430:6106), is `training-readiness-charts.ts`'s.
 *
 * Pure.
 */

const DASH = "--";

/** What the page's route says: the day, days back from today. */
export interface TrainingReadinessRoute {
	offset: number;
}

/** The stat's own data: its index and the day's readings. */
export interface TrainingReadinessData {
	/** The training-readiness index (`readIndex("training-readiness")`), oldest first: each day's morning reading. */
	rows: readonly TrainingReadinessRow[];
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/**
	 * The day's readings, oldest first (`readinessDayIn(series)` after
	 * `loadIntraday(date, [READINESS_DAY.key])`): undefined while they load,
	 * null once Garmin had none or they could not be had.
	 */
	readings?: readonly ReadinessReading[] | null;
}

/** What else the page reads: the day, and the indexes and series its sheets draw from. */
export interface TrainingReadinessContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The Training Status index (`readIndex("training-status")`), oldest first: Acute Load's value, word and timeline. */
	status?: readonly TrainingStatusRow[];
	/** The HRV Status index, oldest first: the HRV Status sheet. */
	hrv?: readonly HrvStatusRow[];
	/** The sleep index, oldest first: the Sleep Score and Recent Sleep Scores sheets. */
	sleep?: readonly SleepRow[];
	/** The stress index, oldest first: the Recent Stress sheet. */
	stress?: readonly StressRow[];
	/** The day's series file, its `sleep` and `sleepLevels`: the Sleep Score sheet's timeline. Undefined while it loads. */
	series?: DaySeries | null;
}

/* ------------------------------------------------------------------ */
/*  The reading                                                        */
/* ------------------------------------------------------------------ */

/** A row's fields without its date. */
function fieldsOf(row: TrainingReadinessRow): ReadinessReading {
	const { date: _date, ...fields } = row;
	return fields;
}

/**
 * The reading a day shows, or "pending" while the day's readings load with
 * nothing to stand in for them.
 *
 * - Today: the newest of the day's readings. Until they are in, or without
 *   them (offline, a failed load), the index's morning reading stands in.
 * - A past day: its morning reading, the index's row; the day's readings'
 *   while the index lacks the day (its history not walked yet).
 */
export function shownReading(date: string, today: string, data: TrainingReadinessData): ReadinessReading | "pending" | undefined {
	const row = data.rows.find((r) => r.date === date);
	const readings = data.readings?.length ? data.readings : undefined;
	const isToday = date >= today;
	if (isToday && readings) return newestOf(readings);
	if (row) return fieldsOf(row);
	if (!isToday && readings) return morningOf(readings);
	return data.readings === undefined ? "pending" : undefined;
}

/**
 * "Updated @ 9:41 AM • After Activity": the reading's time, truncated to the
 * minute, and its context — "After Wake-Up" (web), none for a realtime
 * reading (Inferred). The Recovery Time sheet has the time alone.
 */
export function updatedLine(reading: Pick<ReadinessReading, "time" | "ctx">, withContext = true): string | undefined {
	if (reading.time === undefined) return undefined;
	const at = `Updated @ ${clockText(reading.time * 60)}`;
	const context = withContext && reading.ctx ? CONTEXT_WORDS[reading.ctx.trim().toUpperCase()] : undefined;
	return context ? `${at} • ${context}` : at;
}

/** A score's level by Garmin's bands: POOR 1–24, LOW 25–49, MODERATE 50–74, HIGH 75–94, PRIME 95–100 (all 1,111 readings). */
export function levelOfScore(score: number): string {
	return score < 25 ? "POOR" : score < 50 ? "LOW" : score < 75 ? "MODERATE" : score < 95 ? "HIGH" : "PRIME";
}

/** The level word under the dial: "Poor"; none while onboarding (`NONE`). */
export function levelWord(reading: Pick<ReadinessReading, "level" | "score">): string | undefined {
	const key = reading.level?.trim().toUpperCase();
	if (key) return LEVEL_WORDS[key];
	return reading.score !== undefined ? LEVEL_WORDS[levelOfScore(reading.score)] : undefined;
}

/* ------------------------------------------------------------------ */
/*  The dial                                                           */
/* ------------------------------------------------------------------ */

/** Degrees a point of score turns the page's dial, about its middle score. */
export const DEGREES_PER_POINT = 3.2;
export const DIAL_MIDDLE = 51;
/** The level boundaries the dial's gaps sit on: Poor | Low, Low | Moderate, Moderate | High, High | Prime. */
export const LEVEL_BOUNDARIES: readonly number[] = [24.5, 49.5, 74.5, 94.5];
/** The bands' colours, Poor to Prime: Garmin's #E02C2C, #F27716, #28B44E, #1976D2, #6F42F3. */
export const READINESS_TONES: readonly Tone[] = ["red", "orange", "green", "blue", "purple"];

const LEVEL_TONES: Readonly<Record<string, Tone>> = { POOR: "red", LOW: "orange", MODERATE: "green", HIGH: "blue", PRIME: "purple" };

/**
 * A score's place on the page's dial, degrees clockwise from 12 o'clock:
 * 3.2 × (score − 51), measured on the phone (18 → −105.6°, shot −105.62°).
 * The sweep ends at ±150°, so a score under 4.1 or over 97.9 stops there
 * (Inferred: never seen).
 */
export function readinessAngle(score: number): number {
	return r2(Math.min(DIAL_END, Math.max(-DIAL_END, DEGREES_PER_POINT * (score - DIAL_MIDDLE))));
}

/** The bands' boundaries: −150, −84.8, −4.8, 75.2, 139.2, 150 (shot: −84.78, −4.77, 75.30, 139.22). */
export const READINESS_DIAL_ANGLES: readonly number[] = [-DIAL_END, ...LEVEL_BOUNDARIES.map(readinessAngle), DIAL_END];

/** The page's dial: the score over "100", its five bands, and the marker in its level's colour. */
export interface ReadinessDial {
	/** "18" over "100"; "--" and no marker without a score (onboarding, Inferred). */
	gauge: Gauge;
	/** The marker's angle, degrees clockwise from 12 o'clock: −105.6 for 18. */
	angle?: number;
}

/** The dial for a reading's score and level; without a score, the bands alone. */
export function readinessPageDial(score: number | undefined, level?: string): ReadinessDial {
	const segments = segmentsFromAngles(READINESS_DIAL_ANGLES, READINESS_TONES);
	if (score === undefined) return { gauge: { value: DASH, label: DIAL_TOP, segments } };
	const angle = readinessAngle(score);
	const tone = LEVEL_TONES[level?.trim().toUpperCase() ?? ""] ?? LEVEL_TONES[levelOfScore(score)];
	return { gauge: { value: String(score), label: DIAL_TOP, segments, at: dialFraction(angle), tone }, angle };
}

/* ------------------------------------------------------------------ */
/*  Factors                                                            */
/* ------------------------------------------------------------------ */

const FEEDBACKS: ReadonlySet<string> = new Set<FactorFeedback>(["VERY_GOOD", "GOOD", "MODERATE", "POOR", "NONE"]);

/**
 * Garmin's band of a factor percent, for a reading that lacks its own: 0
 * NONE, under 40 POOR, under 70 MODERATE, then GOOD to 99 and VERY_GOOD at
 * 100 — the sleep factors from 90, stress history never. It matches the band
 * Garmin sent on all 1,111 readings but six stress-history 70s, which Garmin
 * sends both ways (9 GOOD, 6 MODERATE).
 */
export function percentBand(percent: number, factor: ReadinessFactorId): FactorFeedback {
	if (percent <= 0) return "NONE";
	if (percent < 40) return "POOR";
	if (percent < 70) return "MODERATE";
	if (factor === "stress-history") return "GOOD";
	const top = factor === "sleep" || factor === "sleep-history" ? 89 : 99;
	return percent <= top ? "GOOD" : "VERY_GOOD";
}

/** A factor's band: Garmin's own, else its percent's (`percentBand`), else NONE. */
export function factorFeedback(feedback: string | undefined, percent: number | undefined, factor: ReadinessFactorId): FactorFeedback {
	const key = feedback?.trim().toUpperCase();
	if (key && FEEDBACKS.has(key)) return key as FactorFeedback;
	return percent !== undefined ? percentBand(percent, factor) : "NONE";
}

/** A factor card's dot: green, orange, red; grey without the data (Inferred). */
export type FactorDot = "green" | "orange" | "red" | "grey";

const DOTS: Readonly<Record<FactorFeedback, FactorDot>> = { VERY_GOOD: "green", GOOD: "green", MODERATE: "orange", POOR: "red", NONE: "grey" };

/** Garmin's colours for the dots, measured on the phone; the pages bind the theme's green, orange, red and faint text instead. */
export const DOT_COLORS: Readonly<Record<FactorDot, string>> = { green: "#0B963F", orange: "#EA670E", red: "#E02C2C", grey: "#6C6C6C" };

/** A band's dot. */
export function dotOf(feedback: FactorFeedback): FactorDot {
	return DOTS[feedback];
}

/** A figure on a sheet: "6h 31m" over "Duration". */
export interface ReadinessFigure {
	value: string;
	label: string;
}

interface SheetBase<I extends ReadinessFactorId> {
	id: I;
	/** The sheet's header: the card's title. */
	title: string;
	/** The first line, bold: the card's word; Acute Load's "498 - Optimal". None without the data. */
	heading?: string;
	/** The copy under it, by the factor's band; none where it is unseen. */
	copy?: string;
}

/** Sleep Score: the night's score and figures, then the Sleep page's 1d hypnogram. */
export interface SleepScoreSheet extends SheetBase<"sleep"> {
	/** "89" over "100" and "Score"; "--" without the night. */
	score: string;
	outOf: string;
	scoreLabel: string;
	/** "Good" over "Quality", "6h 31m" over "Duration"; "--" without them. */
	figures: ReadinessFigure[];
	/** "Sleep Timeline". */
	chartTitle: string;
	/** `timelineOf`'s night, drawn as the Sleep page draws it: `pending` while the day's series loads, `empty` without the night's stages. */
	timeline: { state: "pending" | "empty" | "drawn"; timeline?: Timeline };
}

/** Recovery Time: the reading's time, then a ring round the hours. */
export interface RecoverySheet extends SheetBase<"recovery"> {
	/** "Updated @ 9:41 AM": the shown reading's time, without its context. */
	updated?: string;
	/** In the ring: "82h" over "High Need". */
	value: string;
	label?: string;
	/** The ring: the whole 300° sweep, not a share, in the card's dot colour. */
	ring: FactorDot;
}

/** HRV Status: the HRV Status page's 1d dial and its 7d chart, ending on the day. */
export interface HrvSheet extends SheetBase<"hrv"> {
	/** The night's dial: "84" "ms" over "7d Avg"; null without the night's row. */
	dial: HrvDial | null;
	/** "7-day Averages". */
	chartTitle: string;
	/** D−6 … D, chip off; null without a night in it. */
	chart: HrvAverages | null;
}

/** Acute Load: Load's acute timeline over the 28 days ending on the day, without the Chronic Load chip. */
export interface AcuteSheet extends SheetBase<"acute"> {
	/** "4-Week Timeline". */
	chartTitle: string;
	/** D−27 … D, as Load's Training Load tab draws it (`acuteAxis`, the 0.8–1.5 × chronic band); null without a Training Status row in it. */
	chart: AcuteChart | null;
	/** Optimal Range, Acute Load. */
	legend: LegendItem[];
}

/** Recent Sleep Scores' chart: the 7 nights ending on the day on a fixed 0–100. */
export interface RecentSleepChart {
	/** 100, 75, 50, 25, 0. */
	ticks: readonly number[];
	/** A night each, D−6 … D, null without a score (the line breaks); `relevant` on D−2 and D−1, the purple dots. */
	points: Array<{ date: string; x: number; value: number | null; relevant: boolean }>;
	/** A dot a night, the ends large and labelled "10-05", "10-11". */
	axis: PeriodAxis;
}

/** Recent Sleep Scores: the week's scores, and the two the factor weighs. */
export interface RecentSleepSheet extends SheetBase<"sleep-history"> {
	/** "Daily Scores". */
	chartTitle: string;
	/** Null without a score in the 7 nights. */
	chart: RecentSleepChart | null;
	/** "Relevant Scores", the purple dot's key. */
	legend: string;
	/** The two nights before the day, oldest first: "53" over "Score - Oct 9"; a night without a score is left out (Inferred). */
	figures: ReadinessFigure[];
}

/** Recent Stress: Stress's 7d chart ending on the day, and its average. */
export interface RecentStressSheet extends SheetBase<"stress-history"> {
	/** "Daily Averages". */
	chartTitle: string;
	/** Stress's 7d view of D−6 … D, as its `linePlot` takes it; null without a level in it. */
	chart: StressPeriodView | null;
	/** "28" over "Avg Stress Level": the floor of the days' mean, today's partial level included. */
	figure: ReadinessFigure;
}

export type ReadinessSheet = SleepScoreSheet | RecoverySheet | HrvSheet | AcuteSheet | RecentSleepSheet | RecentStressSheet;

/** A FACTORS card: the title over the value, the word and dot on the right, and the sheet it opens. */
export interface ReadinessFactor {
	id: ReadinessFactorId;
	/** "Sleep Score". */
	title: string;
	/** "89", "82h", "84 ms", "498"; "--" without the data; none on the two Recent cards. */
	value?: string;
	/** "Good", "High Need", "Optimal"; none without the data. */
	word?: string;
	/** Garmin's band of the factor (Acute Load's from the reading, whatever the Training Status row says). */
	feedback: FactorFeedback;
	dot: FactorDot;
	sheet: ReadinessSheet;
}

/** Everything a day's factors and sheets read. */
interface FactorInput {
	date: string;
	reading: ReadinessReading;
	ctx: TrainingReadinessContext;
}

/** The days a sheet's chart spans: the `days` ending on the day. */
function spanEnding(date: string, days: number): Span {
	return { from: shiftDate(date, -(days - 1)), to: date };
}

function card(id: ReadinessFactorId, feedback: FactorFeedback, value: string | undefined, word: string | undefined, sheet: ReadinessSheet): ReadinessFactor {
	const factor: ReadinessFactor = { id, title: FACTOR_TITLES[id], feedback, dot: dotOf(feedback), sheet };
	if (value !== undefined) factor.value = value;
	if (word !== undefined) factor.word = word;
	return factor;
}

function base<I extends ReadinessFactorId>(id: I, heading: string | undefined, copy: string | undefined): SheetBase<I> {
	const sheet: SheetBase<I> = { id, title: FACTOR_TITLES[id] };
	if (heading !== undefined) sheet.heading = heading;
	if (copy !== undefined) sheet.copy = copy;
	return sheet;
}

/** Sleep Score: last night's score as the reading sent it; the sheet the sleep index's night and the day's hypnogram. */
export function sleepFactor({ date, reading, ctx }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.sleepFb, reading.sleepPct, "sleep");
	const none = feedback === "NONE";
	const word = none ? undefined : FACTOR_WORDS.sleep[feedback];
	const row = ctx.sleep?.find((r) => r.date === date);
	const night = ctx.series?.sleep;
	const score = row?.score ?? night?.score ?? (none ? undefined : reading.sleep);
	const seconds = row?.seconds ?? night?.seconds;
	const levels = ctx.series?.sleepLevels ?? [];
	const sheet: SleepScoreSheet = {
		...base("sleep", word, none ? undefined : sheetCopy("sleep", feedback)),
		score: score !== undefined ? String(score) : DASH,
		outOf: DIAL_TOP,
		scoreLabel: "Score",
		figures: [
			{ value: qualifierText(row?.quality ?? night?.quality) ?? DASH, label: "Quality" },
			{ value: seconds !== undefined ? hm(seconds) : DASH, label: "Duration" },
		],
		chartTitle: SLEEP_TIMELINE,
		timeline:
			ctx.series === undefined ? { state: "pending" } : night && levels.length ? { state: "drawn", timeline: timelineOf(night, levels) } : { state: "empty" },
	};
	return card("sleep", feedback, none || reading.sleep === undefined ? DASH : String(reading.sleep), word, sheet);
}

/** Recovery Time: whole hours, floored (Inferred: 4931 min is "82h", 1 min "0h"), "Recovered" at 0 h. */
export function recoveryFactor({ reading }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.recoveryFb, reading.recoveryPct, "recovery");
	const none = feedback === "NONE";
	const hours = reading.recovery !== undefined ? Math.floor(reading.recovery / 60) : undefined;
	const value = none || hours === undefined ? DASH : `${hours}h`;
	const word = none ? undefined : hours === 0 ? RECOVERED : FACTOR_WORDS.recovery[feedback];
	const sheet: RecoverySheet = {
		...base("recovery", word, none ? undefined : sheetCopy("recovery", feedback)),
		value,
		ring: dotOf(feedback),
	};
	const updated = updatedLine(reading, false);
	if (updated) sheet.updated = updated;
	if (word) sheet.label = word;
	return card("recovery", feedback, value, word, sheet);
}

/** HRV Status: the reading's 7-day average; the sheet the HRV Status page's dial and 7-day chart. */
export function hrvFactor({ date, reading, ctx }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.hrvFb, reading.hrvPct, "hrv");
	const none = feedback === "NONE";
	const word = none ? undefined : FACTOR_WORDS.hrv[feedback];
	const rows = ctx.hrv ?? [];
	const row = rows.find((r) => r.date === date);
	const sheet: HrvSheet = {
		...base("hrv", word, none ? undefined : sheetCopy("hrv", feedback)),
		dial: row ? hrvDial(row) : null,
		chartTitle: SEVEN_DAY_AVERAGES,
		chart: hrvAverages(rows, spanEnding(date, 7), false),
	};
	return card("hrv", feedback, none || reading.hrv === undefined ? DASH : `${reading.hrv} ms`, word, sheet);
}

/**
 * Acute Load: the day's Training Status row's acute load and status word,
 * the dot the reading's band; without a row, the reading's acute load alone
 * (Inferred). The sheet is Load's acute timeline, ending on the day.
 */
export function acuteFactor({ date, reading, ctx }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.acwrFb, reading.acwrPct, "acute");
	const none = feedback === "NONE";
	const rows = ctx.status ?? [];
	const row = rows.find((r) => r.date === date);
	const fromRow = !none && row?.acute !== undefined;
	const value = none ? DASH : fromRow ? String(row.acute) : reading.acute !== undefined ? String(reading.acute) : DASH;
	const word = fromRow && row.acwr ? LOAD_WORDS[row.acwr.trim().toUpperCase()] : undefined;
	// Load's Training Load tab on the 28 days ending on the day: its acute timeline, verbatim.
	const load = trainingView({ range: "4w", offset: 0, tab: "training" }, { today: date, status: rows, statusComplete: true });
	const sheet: AcuteSheet = {
		...base("acute", value === DASH ? undefined : word ? `${value} - ${word}` : value, fromRow ? sheetCopy("acute", row.acwr) : undefined),
		chartTitle: load.title,
		chart: load.chart?.segment === "acute" ? load.chart : null,
		legend: load.legend,
	};
	return card("acute", feedback, value, word, sheet);
}

/** The y axis of Recent Sleep Scores: fixed. */
export const SLEEP_SCORE_TICKS: readonly number[] = [100, 75, 50, 25, 0];

/** The nights the Recent Sleep Scores factor weighs: the two before the day (0.65 · D−1 + 0.35 · D−2 fits its percent at r = 0.976). */
export function relevantNights(date: string): [string, string] {
	return [shiftDate(date, -2), shiftDate(date, -1)];
}

/** The 7 nights ending on the day on a fixed 0–100, the two relevant ones picked out; null without a score among them. */
export function recentSleepChart(rows: readonly SleepRow[], date: string): RecentSleepChart | null {
	const days = daysOf(spanEnding(date, 7));
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const relevant = new Set(relevantNights(date));
	const points = days.map((day, i) => ({ date: day, x: spread(i, days.length), value: byDate.get(day)?.score ?? null, relevant: relevant.has(day) }));
	if (points.every((p) => p.value === null)) return null;
	return { ticks: SLEEP_SCORE_TICKS, points, axis: dayAxis(days) };
}

/** Recent Sleep Scores: a word and a dot, no value; the sheet the week's scores. */
export function sleepHistoryFactor({ date, reading, ctx }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.sleepHistFb, reading.sleepHistPct, "sleep-history");
	const none = feedback === "NONE";
	const word = none ? undefined : FACTOR_WORDS["sleep-history"][feedback];
	const rows = ctx.sleep ?? [];
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const figures: ReadinessFigure[] = [];
	for (const night of relevantNights(date)) {
		const score = byDate.get(night)?.score;
		if (score !== undefined) figures.push({ value: String(score), label: `Score - ${shortDate(night)}` });
	}
	const sheet: RecentSleepSheet = {
		...base("sleep-history", word, none ? undefined : sheetCopy("sleep-history", feedback)),
		chartTitle: DAILY_SCORES,
		chart: recentSleepChart(rows, date),
		legend: RELEVANT_SCORES,
		figures,
	};
	return card("sleep-history", feedback, undefined, word, sheet);
}

/** Recent Stress: a word and a dot, no value; the sheet Stress's 7d chart ending on the day and its floored average. */
export function stressHistoryFactor({ date, reading, ctx }: FactorInput): ReadinessFactor {
	const feedback = factorFeedback(reading.stressHistFb, reading.stressHistPct, "stress-history");
	const none = feedback === "NONE";
	const word = none ? undefined : FACTOR_WORDS["stress-history"][feedback];
	// Stress's own 7d page, its period ending on the day: the points, the axis and "Avg Stress Level".
	const week = stressPeriodView({ data: { rows: ctx.stress ?? [], complete: true }, route: { range: "7d", offset: 0 }, today: date });
	const average = week.stats.find((s) => s.label === AVG_STRESS_LEVEL);
	const sheet: RecentStressSheet = {
		...base("stress-history", word, none ? undefined : sheetCopy("stress-history", feedback)),
		chartTitle: DAILY_AVERAGES,
		chart: week.points.some((p) => p.value !== null) ? week : null,
		figure: { value: average?.value ?? DASH, label: AVG_STRESS_LEVEL },
	};
	return card("stress-history", feedback, undefined, word, sheet);
}

/** The six cards, the phone's order. */
export function factorsOf(input: FactorInput): ReadinessFactor[] {
	return [sleepFactor(input), recoveryFactor(input), hrvFactor(input), acuteFactor(input), sleepHistoryFactor(input), stressHistoryFactor(input)];
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export interface TrainingReadinessView {
	date: string;
	/** "Today", "Saturday, October 10". */
	label: string;
	/** "<": the index may hold an earlier day (the history starts 2025-08-02). */
	canGoBack: boolean;
	/** ">": a past day. */
	canGoForward: boolean;
	/**
	 * `reading`: the dial, its words and the factors. `pending`: the day's
	 * readings are loading and the index has nothing to show meanwhile.
	 * `empty`: no reading for the day — today before the watch syncs, a day
	 * without one (2026-01-05 … 09), before the history.
	 */
	state: "reading" | "pending" | "empty";
	/** The reading shown: today's newest, a past day's morning one. */
	reading?: ReadinessReading;
	/** Today's readings are loading or could not be had (offline): the index's morning reading stands in for the newest (Inferred). */
	standIn?: boolean;
	/** "Updated @ 9:41 AM • After Activity". */
	updated?: string;
	dial?: ReadinessDial;
	/** "Poor". */
	level?: string;
	/** "Let your body recover"; none for UNKNOWN. */
	title?: string;
	/** The copy under it, where its key is known. */
	copy?: string;
	/** Six cards; none without a reading. */
	factors: ReadinessFactor[];
	/** The shared line in place of the dial: "You have no data for this time period." */
	empty?: string;
}

/** The page on its day. */
export function trainingReadinessView(route: TrainingReadinessRoute, data: TrainingReadinessData, ctx: TrainingReadinessContext): TrainingReadinessView {
	const date = dayOf(route, ctx.today);
	const view: TrainingReadinessView = {
		date,
		label: dayLabel(date, ctx.today),
		canGoBack: canStepBack(data.rows[0]?.date, data.complete, date),
		canGoForward: date < ctx.today,
		state: "empty",
		factors: [],
	};
	const reading = shownReading(date, ctx.today, data);
	if (reading === "pending") {
		view.state = "pending";
		return view;
	}
	if (!reading) {
		view.empty = NO_DATA;
		return view;
	}
	view.state = "reading";
	view.reading = reading;
	if (date >= ctx.today && !data.readings?.length) view.standIn = true;
	const updated = updatedLine(reading);
	if (updated) view.updated = updated;
	view.dial = readinessPageDial(reading.score, reading.level);
	const level = levelWord(reading);
	if (level) view.level = level;
	const title = readinessTitle(reading.short);
	if (title) view.title = title;
	const copy = readinessCopy(reading.long);
	if (copy) view.copy = copy;
	view.factors = factorsOf({ date, reading, ctx });
	return view;
}
