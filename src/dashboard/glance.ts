import type { AccountInfo } from "../sync/account";
import type { DaySeries, SeriesPoint } from "../sync/intraday";
import {
	DAY_MS,
	addDays,
	clockText,
	dayStart,
	lastDays,
	latestWith,
	num,
	readingDate,
	rowOn,
	shortDate,
	str,
	titleCase,
	weekdayLetter,
} from "./day";
import type { HomeInput } from "./home";
import type { DayRow } from "./series";

/**
 * At a Glance: Garmin's 36 stat cards, the list of them a person keeps, and
 * what each card draws.
 *
 * Pure, like `home.ts`. Home shows the first eight of the list; See All shows
 * the lot, up to twenty, and is where the list is edited.
 */

export type GlanceId =
	| "altitude"
	| "bloodPressure"
	| "bodyBattery"
	| "calories"
	| "criticalSwimSpeed"
	| "cyclingAbility"
	| "cyclingFtp"
	| "cyclingVo2"
	| "endurance"
	| "fitnessAge"
	| "floors"
	| "hrv"
	| "healthStatus"
	| "heartRate"
	| "heat"
	| "hillScore"
	| "hydration"
	| "intensity"
	| "lastActivity"
	| "lifestyle"
	| "loadFocus"
	| "nutrition"
	| "pulseOx"
	| "respiration"
	| "runningEconomy"
	| "lactateThreshold"
	| "runningTolerance"
	| "sleep"
	| "steps"
	| "stress"
	| "trainingLoad"
	| "readiness"
	| "trainingStatus"
	| "vo2max"
	| "weight"
	| "xcSkiFtp";

/** Obsidian's named colours, which is what the Figma twin binds every series to. */
export type Tone = "red" | "orange" | "yellow" | "green" | "cyan" | "blue" | "purple" | "pink";

export interface GlanceStat {
	id: GlanceId;
	/** As Garmin titles the card. */
	title: string;
	/** A Lucide icon, as the Figma twin draws it. */
	icon: string;
	/** The icon's colour; the plain text colour when absent. */
	tone?: Tone;
}

/** All 36, in the order Garmin's Add a Stat sheet lists them. */
export const GLANCE_STATS: readonly GlanceStat[] = [
	{ id: "altitude", title: "Altitude Acclimation", icon: "mountain-snow" },
	{ id: "bloodPressure", title: "Blood Pressure", icon: "stethoscope", tone: "red" },
	{ id: "bodyBattery", title: "Body Battery", icon: "battery-charging", tone: "blue" },
	{ id: "calories", title: "Calories Burned", icon: "flame", tone: "green" },
	{ id: "criticalSwimSpeed", title: "Critical Swim Speed", icon: "waves" },
	{ id: "cyclingAbility", title: "Cycling Ability", icon: "bike" },
	{ id: "cyclingFtp", title: "Cycling FTP", icon: "bike" },
	{ id: "cyclingVo2", title: "Cycling VO₂ Max", icon: "bike" },
	{ id: "endurance", title: "Endurance Score", icon: "award" },
	{ id: "fitnessAge", title: "Fitness Age", icon: "person-standing" },
	{ id: "floors", title: "Floors", icon: "layers", tone: "cyan" },
	{ id: "hrv", title: "HRV Status", icon: "heart-pulse", tone: "red" },
	{ id: "healthStatus", title: "Health Status", icon: "clipboard-check" },
	{ id: "heartRate", title: "Heart Rate", icon: "heart", tone: "red" },
	{ id: "heat", title: "Heat Acclimation", icon: "thermometer-sun" },
	{ id: "hillScore", title: "Hill Score", icon: "mountain" },
	{ id: "hydration", title: "Hydration", icon: "glass-water", tone: "blue" },
	{ id: "intensity", title: "Intensity Minutes", icon: "timer", tone: "orange" },
	{ id: "lastActivity", title: "Last Activity", icon: "clock" },
	{ id: "lifestyle", title: "Lifestyle Logging", icon: "clipboard-list" },
	{ id: "loadFocus", title: "Load Focus", icon: "chart-pie" },
	{ id: "nutrition", title: "Nutrition", icon: "utensils", tone: "blue" },
	{ id: "pulseOx", title: "Pulse Ox", icon: "droplets", tone: "red" },
	{ id: "respiration", title: "Respiration", icon: "wind", tone: "cyan" },
	{ id: "runningEconomy", title: "Running Economy", icon: "chart-line" },
	{ id: "lactateThreshold", title: "Running Lactate Threshold", icon: "zap" },
	{ id: "runningTolerance", title: "Running Tolerance", icon: "shield-check" },
	{ id: "sleep", title: "Sleep Score", icon: "moon-star", tone: "blue" },
	{ id: "steps", title: "Steps", icon: "footprints", tone: "blue" },
	{ id: "stress", title: "Stress", icon: "brain", tone: "orange" },
	{ id: "trainingLoad", title: "Training Load", icon: "chart-column" },
	{ id: "readiness", title: "Training Readiness", icon: "gauge", tone: "blue" },
	{ id: "trainingStatus", title: "Training Status", icon: "trending-up", tone: "purple" },
	{ id: "vo2max", title: "VO₂ Max", icon: "circle-gauge" },
	{ id: "weight", title: "Weight", icon: "weight", tone: "blue" },
	{ id: "xcSkiFtp", title: "XC Skiing FTP", icon: "snowflake" },
];

/** See All holds at most this many; Home shows the first `HOME_GLANCE`. */
export const MAX_GLANCE = 20;
export const HOME_GLANCE = 8;

const IDS = new Set<string>(GLANCE_STATS.map((s) => s.id));

export function isGlanceId(value: unknown): value is GlanceId {
	return typeof value === "string" && IDS.has(value);
}

export function statFor(id: GlanceId): GlanceStat {
	return GLANCE_STATS.find((s) => s.id === id)!;
}

/* ------------------------------------------------------------------ */
/*  The list                                                           */
/* ------------------------------------------------------------------ */

/**
 * A stored list as this build can draw it: known ids, each once, at most
 * twenty. Anything else in `data.json` is dropped rather than drawn.
 */
export function readGlance(value: unknown): GlanceId[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out: GlanceId[] = [];
	for (const v of value) {
		if (isGlanceId(v) && !out.includes(v) && out.length < MAX_GLANCE) out.push(v);
	}
	return out;
}

export function addStat(list: readonly GlanceId[], id: GlanceId): GlanceId[] {
	return list.includes(id) || list.length >= MAX_GLANCE ? [...list] : [...list, id];
}

export function removeStat(list: readonly GlanceId[], id: GlanceId): GlanceId[] {
	return list.filter((x) => x !== id);
}

/** `id` moved to `to`, everything else keeping its order. */
export function moveStat(list: readonly GlanceId[], id: GlanceId, to: number): GlanceId[] {
	const from = list.indexOf(id);
	if (from < 0) return [...list];
	const next = list.filter((x) => x !== id);
	next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
	return next;
}

/** What Add a Stat offers: everything not already on the page, in Garmin's order. */
export function availableStats(list: readonly GlanceId[]): GlanceStat[] {
	return GLANCE_STATS.filter((s) => !list.includes(s.id));
}

export function sameList(a: readonly GlanceId[], b: readonly GlanceId[]): boolean {
	return a.length === b.length && a.every((id, i) => b[i] === id);
}

/* ------------------------------------------------------------------ */
/*  Dials                                                              */
/* ------------------------------------------------------------------ */

export interface GaugeSegment {
	/** Fractions of the dial, 0 at its start and 1 at its end. */
	from: number;
	to: number;
	tone: Tone;
}

/** A banded dial: Garmin's gauge for VO₂ Max, FTP, Endurance and the rest. */
export interface Gauge {
	/** The number in the middle, formatted. */
	value: string;
	/** The band's name, under the dial. */
	label?: string;
	segments: GaugeSegment[];
	/** Where the marker sits, as a fraction of the dial. None when it cannot be placed. */
	at?: number;
	/** The marker takes the colour of the band it sits in. */
	tone?: Tone;
}

export type Trend = "up" | "down" | "flat";

export interface TrendGauge extends Gauge {
	trend?: Trend;
}

const FIVE: Tone[] = ["red", "orange", "green", "blue", "purple"];
const SIX: Tone[] = ["red", "orange", "green", "blue", "purple", "pink"];
const SEVEN: Tone[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * How far back a card will reach for its latest reading. A daily stat older
 * than a week is not "at a glance" any more; VO₂ Max gets the four weeks the
 * app reads it over — which is why a cycling VO₂ Max from last year shows the
 * app's prompt, not the number, even though Garmin still has it.
 */
const DAILY = 7;
const VO2_WINDOW = 28;

function bands(bounds: readonly number[], tones: readonly Tone[]): GaugeSegment[] {
	return tones.map((tone, i) => ({ from: bounds[i]!, to: bounds[i + 1]!, tone }));
}

function bandAt(segments: readonly GaugeSegment[], at: number): number {
	const i = segments.findIndex((s) => at < s.to);
	return i < 0 ? segments.length - 1 : i;
}

function gauge(value: string, segments: GaugeSegment[], at: number | undefined, label?: string): Gauge {
	return { value, label, segments, at, tone: at === undefined ? undefined : segments[bandAt(segments, at)]!.tone };
}

/** Linear interpolation of `value` inside `[lo, hi]`, placed inside a band. */
function within(value: number, lo: number, hi: number, band: GaugeSegment): number {
	const t = hi === lo ? 0.5 : clamp01((value - lo) / (hi - lo));
	return band.from + t * (band.to - band.from);
}

/**
 * Which way a number moved over the last week, the arrow under Endurance and
 * Hill Score. The week-old value is the one on or just before that day; failing
 * that, the earliest inside the week.
 */
export function trendOf(rows: readonly DayRow[], date: string, key: string, tolerance: number): Trend | undefined {
	const current = num(latestWith(rows, date, key), key);
	if (current === undefined) return undefined;
	const weekAgo = addDays(date, -7);
	let past = num(latestWith(rows, weekAgo, key, 7), key);
	if (past === undefined) {
		for (const r of rows) {
			if (r.date <= weekAgo || r.date > date) continue;
			past = num(r, key);
			if (past !== undefined) break;
		}
	}
	if (past === undefined) return undefined;
	const delta = current - past;
	if (Math.abs(delta) <= Math.abs(past) * tolerance) return "flat";
	return delta > 0 ? "up" : "down";
}

/* Endurance Score. Garmin sends the class limits with the score — they depend on
   age and sex — and the dial is linear between its own ends, which is what puts
   6,336 a third of the way round. */

const ENDURANCE_CLASSES = ["Recreational", "Intermediate", "Trained", "Well-Trained", "Expert", "Superior", "Elite"];
const ENDURANCE_LIMITS = [
	"endurance_intermediate_from",
	"endurance_trained_from",
	"endurance_well_trained_from",
	"endurance_expert_from",
	"endurance_superior_from",
	"endurance_elite_from",
];

export function enduranceView(input: HomeInput): TrendGauge | null {
	const r = latestWith(input.rows, input.date, "endurance_score", DAILY);
	const score = num(r, "endurance_score");
	if (score === undefined) return null;
	const low = num(r, "endurance_gauge_low");
	const high = num(r, "endurance_gauge_high");
	const limits = ENDURANCE_LIMITS.map((k) => num(r, k));
	const known = low !== undefined && high !== undefined && high > low && limits.every((v) => v !== undefined);
	const f = (v: number) => clamp01((v - low!) / (high! - low!));
	const segments = known ? bands([0, ...limits.map((v) => f(v!)), 1], SEVEN) : bands([0, 1, 2, 3, 4, 5, 6, 7].map((i) => i / 7), SEVEN);
	const cls = num(r, "endurance_classification");
	const index = cls !== undefined && cls >= 1 && cls <= 7 ? cls - 1 : known ? limits.filter((v) => score >= v!).length : undefined;
	const at = known ? f(score) : index !== undefined ? (index + 0.5) / 7 : undefined;
	return {
		...gauge(score.toLocaleString(), segments, at, index !== undefined ? ENDURANCE_CLASSES[index] : undefined),
		trend: trendOf(input.rows, input.date, "endurance_score", 0.0025),
	};
}

/* Hill Score: 0–100 on a linear dial, bands read off the app. */

const HILL_CLASSES = ["Recreational", "Challenger", "Trained", "Well-Trained", "Expert", "Elite"];
const HILL_BOUNDS = [0, 0.255, 0.505, 0.705, 0.855, 0.945, 1];

export function hillView(input: HomeInput): TrendGauge | null {
	const r = latestWith(input.rows, input.date, "hill_score", DAILY);
	const score = num(r, "hill_score");
	if (score === undefined) return null;
	const segments = bands(HILL_BOUNDS, SIX);
	const at = clamp01(score / 100);
	const cls = num(r, "hill_score_classification");
	const index = cls !== undefined && cls >= 1 && cls <= 6 ? cls - 1 : bandAt(segments, at);
	return {
		...gauge(String(Math.round(score)), segments, at, HILL_CLASSES[index]),
		trend: trendOf(input.rows, input.date, "hill_score", 0),
	};
}

/* VO₂ Max. Graded against Garmin's age-and-sex table (from The Cooper
   Institute). Unlike FTP the dial is not linear: every band has a fixed arc and
   the marker is placed inside its band. */

type Sex = "male" | "female";

/** Lower limits of Fair, Good, Excellent and Superior, by the top of each age band. */
const VO2_TABLE: Record<Sex, Array<[number, [number, number, number, number]]>> = {
	male: [
		[29, [41.7, 45.4, 51.1, 55.4]],
		[39, [40.5, 44.0, 48.3, 54.0]],
		[49, [38.5, 42.4, 46.4, 52.5]],
		[59, [35.6, 39.2, 43.4, 48.9]],
		[69, [32.3, 35.5, 39.5, 45.7]],
		[Infinity, [29.4, 32.3, 36.7, 42.1]],
	],
	female: [
		[29, [36.1, 39.5, 43.9, 49.6]],
		[39, [34.4, 37.8, 42.4, 47.4]],
		[49, [33.0, 36.3, 39.7, 45.3]],
		[59, [30.1, 33.0, 36.7, 41.1]],
		[69, [27.5, 30.0, 33.0, 37.8]],
		[Infinity, [25.9, 28.1, 30.9, 36.7]],
	],
};
const VO2_CLASSES = ["Poor", "Fair", "Good", "Excellent", "Superior"];
const VO2_BOUNDS = [0, 0.402, 0.546, 0.69, 0.849, 1];

export function vo2Gauge(value: number, age: number | undefined, sex: Sex | undefined): Gauge {
	const segments = bands(VO2_BOUNDS, FIVE);
	const shown = String(Math.round(value));
	if (age === undefined || !sex) return gauge(shown, segments, undefined);
	const limits = VO2_TABLE[sex].find(([top]) => age <= top)![1];
	const index = limits.filter((l) => value >= l).length;
	// The open ends get a band's worth of range each, scaled to their arc.
	const lo = index === 0 ? limits[0] - (limits[1] - limits[0]) * 2.8 : limits[index - 1]!;
	const hi = index === 4 ? limits[3] + (limits[3] - limits[2]) : limits[index]!;
	return gauge(shown, segments, within(value, lo, hi, segments[index]!), VO2_CLASSES[index]);
}

/* FTP, as W/kg. A linear dial from 0 to about 6 W/kg for men, graded by
   Garmin's FTP table; the women's dial is the same shape, scaled. */

const FTP_TABLE: Record<Sex, [number, number, number, number]> = {
	male: [2.23, 2.79, 3.93, 5.05],
	female: [1.9, 2.36, 3.33, 4.3],
};
const FTP_CLASSES = ["Untrained", "Fair", "Good", "Excellent", "Superior"];

export function ftpGauge(wattsPerKg: number, sex: Sex | undefined): Gauge {
	const limits = FTP_TABLE[sex ?? "male"];
	const top = limits[3] * (6 / 5.05);
	const f = (v: number) => clamp01(v / top);
	const segments = bands([0, ...limits.map(f), 1], FIVE);
	// Without the sex the bands are only a guess, so the class name is left off.
	const label = sex ? FTP_CLASSES[limits.filter((l) => wattsPerKg >= l).length] : undefined;
	return gauge(wattsPerKg.toFixed(2), segments, f(wattsPerKg), label);
}

/* Training Readiness: 0–100, Garmin's own bands (Poor 1–24 … Prime 95–100). */

export function readinessDial(score: number): Gauge {
	return gauge(String(score), bands([0, 0.25, 0.5, 0.75, 0.95, 1], FIVE), clamp01(score / 100));
}

/* Running Economy. Lower is better and only a class name comes back, so the
   marker sits inside the named class. The limits that place it there are
   read off one reading of the app's dial (223–224, just into Intermediate),
   and are clamped to the class so a wrong guess cannot contradict the name. */

const ECONOMY_CLASSES = ["RECREATIONAL", "INTERMEDIATE", "TRAINED", "WELL_TRAINED", "EXPERT", "SUPERIOR", "ELITE"];
const ECONOMY_BOUNDS = [0, 0.179, 0.366, 0.55, 0.728, 0.818, 0.906, 1];
/** Each class's worse and better limit, in the score's own units. */
const ECONOMY_RANGES: Array<[number, number]> = [
	[235, 225],
	[225, 215],
	[215, 205],
	[205, 195],
	[195, 190],
	[190, 185],
	[185, 175],
];

export function economyView(account: AccountInfo | null): Gauge | null {
	const e = account?.runningEconomy;
	if (e?.score === undefined) return null;
	const segments = bands(ECONOMY_BOUNDS, SEVEN);
	const index = ECONOMY_CLASSES.indexOf((e.classification ?? "").toUpperCase());
	const shown = String(Math.round(e.score));
	if (index < 0) return gauge(shown, segments, undefined, titleCase(e.classification));
	const [worse, better] = ECONOMY_RANGES[index]!;
	const at = within(worse - e.score, 0, worse - better, segments[index]!);
	return gauge(shown, segments, at, titleCase(e.classification));
}

/* ------------------------------------------------------------------ */
/*  The other cards                                                    */
/* ------------------------------------------------------------------ */

export interface HeartRateView {
	current?: number;
	resting?: number;
	min?: number;
	max?: number;
}

export function heartRateView(row: DayRow | undefined, series: DaySeries | null): HeartRateView | null {
	const points = series?.heartRate ?? [];
	let current = num(row, "hr_latest");
	for (let i = points.length - 1; i >= 0 && current === undefined; i--) {
		const v = points[i]![1];
		if (v !== null) current = v;
	}
	const resting = num(row, "resting_hr");
	if (current === undefined && resting === undefined) return null;
	return { current, resting, min: num(row, "min_hr"), max: num(row, "max_hr") };
}

export interface IntensityView {
	total: number;
	goal: number;
	/** Monday first: running total for each day of this week so far. */
	week: Array<{ label: string; total: number | null; today: boolean }>;
}

/** Garmin's intensity week runs Monday to Sunday. */
export function intensityView(input: HomeInput): IntensityView | null {
	const today = new Date(dayStart(input.date)).getDay();
	const back = (today + 6) % 7;
	const monday = addDays(input.date, -back);
	let running = 0;
	let seen = false;
	const week: IntensityView["week"] = [];
	for (let i = 0; i < 7; i++) {
		const date = addDays(monday, i);
		const label = "MTWTFSS"[i]!;
		if (date > input.date) {
			week.push({ label, total: null, today: false });
			continue;
		}
		const v = num(rowOn(input.rows, date), "intensity_minutes");
		if (v !== undefined) seen = true;
		running += v ?? 0;
		week.push({ label, total: running, today: date === input.date });
	}
	if (!seen) return null;
	const goal = num(rowOn(input.rows, input.date), "intensity_goal") ?? 150;
	return { total: running, goal, week };
}

export interface CaloriesView {
	total: number;
	active?: number;
	resting?: number;
}

export function caloriesView(row: DayRow | undefined): CaloriesView | null {
	const total = num(row, "calories");
	if (total === undefined) return null;
	return { total, active: num(row, "calories_active"), resting: num(row, "calories_bmr") };
}

export interface StressView {
	average?: number;
	/** Minutes in each band: rest, low, medium, high. */
	bands: [number, number, number, number];
	points: SeriesPoint[];
	from: number;
	to: number;
}

export function stressView(input: HomeInput, row: DayRow | undefined): StressView | null {
	const average = num(row, "stress_avg");
	const points = input.series?.stress ?? [];
	if (average === undefined && !points.length) return null;
	const from = dayStart(input.date);
	return {
		average,
		bands: [
			num(row, "stress_rest_minutes") ?? 0,
			num(row, "stress_low_minutes") ?? 0,
			num(row, "stress_medium_minutes") ?? 0,
			num(row, "stress_high_minutes") ?? 0,
		],
		points,
		from,
		to: from + DAY_MS,
	};
}

export interface HrvView {
	status?: string;
	weekly?: number;
	low?: number;
	high?: number;
	/** Nightly averages for four weeks, oldest first. */
	nights: Array<number | null>;
}

export function hrvView(input: HomeInput, row: DayRow | undefined): HrvView | null {
	const status = titleCase(str(row, "hrv_status"));
	const weekly = num(row, "hrv_weekly_avg");
	if (!status && weekly === undefined) return null;
	return {
		status,
		weekly,
		low: num(row, "hrv_baseline_low"),
		high: num(row, "hrv_baseline_high"),
		nights: lastDays(input.rows, input.date, 28).map(({ row: r }) => num(r, "hrv_avg") ?? null),
	};
}

export interface FitnessAgeView {
	age: number;
	actual?: number;
	/** "Sep 23": when Garmin last recalculated it. */
	updated?: string;
}

export function fitnessAgeView(input: HomeInput): FitnessAgeView | null {
	const r = latestWith(input.rows, input.date, "fitness_age", DAILY);
	const age = num(r, "fitness_age");
	if (age === undefined) return null;
	const updated = str(r, "fitness_age_updated");
	return {
		age: Math.round(age),
		actual: num(latestWith(input.rows, input.date, "chronological_age"), "chronological_age"),
		updated: updated ? readingDate(updated, input.date) : undefined,
	};
}

export interface FloorsView {
	floors: number;
	goal?: number;
	/** The last seven days, oldest first: whether the goal was met. */
	week: Array<{ label: string; met: boolean | null; today: boolean }>;
}

export function floorsView(input: HomeInput, row: DayRow | undefined): FloorsView | null {
	const floors = num(row, "floors");
	if (floors === undefined) return null;
	return {
		// Garmin counts whole floors climbed; the summary sends 2.13.
		floors: Math.floor(floors),
		goal: num(row, "floors_goal"),
		week: lastDays(input.rows, input.date, 7).map(({ date, row: r }) => {
			const f = num(r, "floors");
			const g = num(r, "floors_goal");
			return { label: weekdayLetter(date), met: f === undefined || g === undefined ? null : f >= g, today: date === input.date };
		}),
	};
}

export interface AcclimationView {
	/** "100%" or "2,450 m". */
	value: string;
	trend?: Trend;
	message: string;
	updated: string;
}

const ACCLIMATION: Record<string, [Trend, string]> = {
	ACCLIMATIZED: ["flat", "Maintaining acclimation."],
	ACCLIMATIZING: ["up", "Improving acclimation."],
	DEACCLIMATIZING: ["down", "Losing acclimation."],
};

function acclimation(value: string, trendKey: string | undefined, date: string, today: string): AcclimationView {
	const known = trendKey ? ACCLIMATION[trendKey] : undefined;
	return {
		value,
		trend: known?.[0],
		message: known?.[1] ?? (trendKey ? `${titleCase(trendKey)}.` : ""),
		updated: readingDate(date, today),
	};
}

export function heatView(input: HomeInput): AcclimationView | null {
	const r = latestWith(input.rows, input.date, "heat_acclimation_pct", DAILY);
	const pct = num(r, "heat_acclimation_pct");
	if (r === undefined || pct === undefined) return null;
	return acclimation(`${Math.round(pct)}%`, str(r, "heat_acclimation_trend"), r.date, input.date);
}

/** Null below any altitude, which is when the app shows its "train at 800 meters" prompt. */
export function altitudeView(input: HomeInput): AcclimationView | null {
	const metres = latestWith(input.rows, input.date, "altitude_acclimation_m", DAILY);
	const feet = latestWith(input.rows, input.date, "altitude_acclimation_ft", DAILY);
	const r = metres && (!feet || metres.date >= feet.date) ? metres : feet;
	const unit = r === metres ? "m" : "ft";
	const value = num(r, `altitude_acclimation_${unit}`);
	if (r === undefined || value === undefined || value <= 0) return null;
	return acclimation(`${Math.round(value).toLocaleString()} ${unit}`, str(r, "altitude_acclimation_trend"), r.date, input.date);
}

export interface LoadFocusView {
	/** "Anaerobic Shortage". */
	focus?: string;
	/** Anaerobic, high aerobic, low aerobic: each with the band Garmin considers optimal. */
	bars: Array<{ value: number; min?: number; max?: number; tone: Tone }>;
	/** The widest thing drawn, which spans the full bar. */
	scale: number;
	/** "Aug 28 - Sep 24". */
	range: string;
}

const LOAD_FOCUS: Record<string, string> = {
	AEROBIC_LOW_SHORTAGE: "Low Aerobic Shortage",
	AEROBIC_HIGH_SHORTAGE: "High Aerobic Shortage",
	AEROBIC_LOW_FOCUS: "Low Aerobic Focus",
	AEROBIC_HIGH_FOCUS: "High Aerobic Focus",
};

export function loadFocusView(input: HomeInput): LoadFocusView | null {
	const r = latestWith(input.rows, input.date, "load_aerobic_high", DAILY);
	if (!r) return null;
	const bar = (stem: string, tone: Tone) => ({
		value: num(r, `load_${stem}`) ?? 0,
		min: num(r, `load_${stem}_target_min`),
		max: num(r, `load_${stem}_target_max`),
		tone,
	});
	const bars = [bar("anaerobic", "purple"), bar("aerobic_high", "orange"), bar("aerobic_low", "cyan")];
	const phrase = str(r, "load_focus");
	return {
		focus: phrase ? LOAD_FOCUS[phrase] ?? titleCase(phrase) : undefined,
		bars,
		scale: Math.max(1, ...bars.flatMap((b) => [b.value, b.max ?? 0])),
		range: `${shortDate(addDays(r.date, -27))} - ${shortDate(r.date)}`,
	};
}

export interface ToleranceView {
	/** Acute impact load, "19.1": Garmin counts it in kilometre (or mile) equivalents. */
	load: string;
	/** How much of the weekly tolerance the load is, for the ring. */
	share: number;
	/** "38 km". */
	tolerance: string;
}

export function toleranceView(input: HomeInput, units: "metric" | "imperial"): ToleranceView | null {
	const r = latestWith(input.rows, input.date, "running_tolerance", DAILY);
	const tolerance = num(r, "running_tolerance");
	const load = num(r, "running_tolerance_load");
	if (tolerance === undefined || load === undefined || tolerance <= 0) return null;
	// Both arrive in metres, whatever the unit setting.
	const per = units === "imperial" ? 1609.344 : 1000;
	return {
		load: (load / per).toFixed(1),
		share: clamp01(load / tolerance),
		tolerance: `${Math.round(tolerance / per)} ${units === "imperial" ? "mi" : "km"}`,
	};
}

export interface TrainingLoadView {
	status?: string;
	acute?: number;
	chronic?: number;
	ratio?: number;
}

export function trainingLoadView(input: HomeInput): TrainingLoadView | null {
	const r = latestWith(input.rows, input.date, "training_load_acute", DAILY);
	if (!r) return null;
	return {
		status: titleCase(str(r, "training_load_status")),
		acute: num(r, "training_load_acute"),
		chronic: num(r, "training_load_chronic"),
		ratio: num(r, "training_load_ratio"),
	};
}

export interface WeightView {
	value: string;
	change?: string;
	bmi?: string;
	updated: string;
}

/** The latest weigh-in, and how it moved from the one before. */
export function weightView(input: HomeInput): WeightView | null {
	const weighIns: Array<{ date: string; value: number; unit: string; bmi?: number }> = [];
	for (let i = input.rows.length - 1; i >= 0 && weighIns.length < 2; i--) {
		const r = input.rows[i]!;
		if (r.date > input.date) continue;
		const kg = num(r, "weight_kg");
		const lb = num(r, "weight_lb");
		if (kg !== undefined) weighIns.push({ date: r.date, value: kg, unit: "kg", bmi: num(r, "bmi") });
		else if (lb !== undefined) weighIns.push({ date: r.date, value: lb, unit: "lb", bmi: num(r, "bmi") });
	}
	const [latest, previous] = weighIns;
	if (!latest) return null;
	const delta = previous && previous.unit === latest.unit ? latest.value - previous.value : undefined;
	return {
		value: `${latest.value.toFixed(1)} ${latest.unit}`,
		change: delta === undefined ? undefined : `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(1)} ${latest.unit}`,
		bmi: latest.bmi?.toFixed(1),
		updated: readingDate(latest.date, input.date),
	};
}

export interface LastActivityView {
	name: string;
	icon: string;
	tone: Tone;
	stats: Array<{ value: string; label: string }>;
}

const WALKING = /run|walk|hik|trail|treadmill/;

export function lastActivityView(input: HomeInput): LastActivityView | null {
	let latest: Record<string, unknown> | undefined;
	for (let i = input.rows.length - 1; i >= 0 && !latest; i--) {
		const r = input.rows[i]!;
		if (r.date > input.date || !r.workouts?.length) continue;
		latest = [...r.workouts].sort((a, b) => String(b.start ?? "").localeCompare(String(a.start ?? "")))[0];
	}
	if (!latest) return null;
	const type = typeof latest.type === "string" ? latest.type : "";
	const seconds =
		typeof latest.duration_s === "number" ? latest.duration_s : typeof latest.minutes === "number" ? latest.minutes * 60 : undefined;
	const km = typeof latest.distance_km === "number" ? latest.distance_km : undefined;
	const mi = typeof latest.distance_mi === "number" ? latest.distance_mi : undefined;
	const distance = km ?? mi;
	const unit = km !== undefined ? "km" : "mi";
	const stats: LastActivityView["stats"] = [];
	if (distance !== undefined && distance > 0) stats.push({ value: `${distance.toFixed(2)} ${unit}`, label: "Distance" });
	if (seconds !== undefined) stats.push({ value: clockText(seconds / 60), label: "Total Time" });
	if (distance && seconds && WALKING.test(type)) {
		// Garmin's Avg Pace is over the total time, not the moving time.
		stats.push({ value: `${clockText(seconds / distance / 60)} /${unit}`, label: "Avg Pace" });
	} else if (distance && seconds) {
		stats.push({ value: `${(distance / (seconds / 3600)).toFixed(1)} ${unit === "km" ? "km/h" : "mph"}`, label: "Avg Speed" });
	} else if (typeof latest.calories === "number") {
		stats.push({ value: `${latest.calories}`, label: "Calories" });
	}
	return {
		name: typeof latest.name === "string" ? latest.name : "Activity",
		...activityLook(type),
		stats,
	};
}

function activityLook(type: string): { icon: string; tone: Tone } {
	if (/cycl|bik|ride/.test(type)) return { icon: "bike", tone: "green" };
	if (/swim/.test(type)) return { icon: "waves", tone: "blue" };
	if (/strength|fitness|cardio|hiit|yoga|pilates/.test(type)) return { icon: "dumbbell", tone: "purple" };
	if (/hik/.test(type)) return { icon: "mountain", tone: "orange" };
	return { icon: "activity", tone: "orange" };
}

export interface ReadingsView {
	/** The big number: the latest reading. */
	latest?: number;
	/** Awake average for respiration, the day's average for Pulse Ox. */
	average?: number;
	sleep?: number;
}

export function respirationView(row: DayRow | undefined): ReadingsView | null {
	const view = { latest: num(row, "respiration_latest"), average: num(row, "respiration_avg"), sleep: num(row, "sleep_respiration") };
	return Object.values(view).some((v) => v !== undefined) ? view : null;
}

/** Null on a day with no readings, which is when the app says so. */
export function pulseOxView(row: DayRow | undefined): ReadingsView | null {
	const view = { latest: num(row, "spo2_latest"), average: num(row, "spo2_avg"), sleep: num(row, "sleep_spo2") };
	return Object.values(view).some((v) => v !== undefined) ? view : null;
}

export interface HealthView {
	/** True while any metric is still building its baseline — the app shows its "wear it for 3 weeks" prompt. */
	onboarding: boolean;
	outside: number;
	metrics: Array<{ label: string; status: string; ok: boolean }>;
}

const HEALTH_METRICS: Array<[string[], string]> = [
	[["hrv"], "HRV"],
	[["hr"], "Resting HR"],
	[["respiration"], "Respiration"],
	[["skin_temp_c", "skin_temp_f"], "Skin Temp"],
	[["spo2"], "Pulse Ox"],
];

export function healthView(row: DayRow | undefined): HealthView | null {
	const metrics: HealthView["metrics"] = [];
	let onboarding = false;
	for (const [stems, label] of HEALTH_METRICS) {
		const status = stems.map((s) => str(row, `health_${s}_status`)).find(Boolean);
		if (!status) continue;
		if (status === "ONBOARDING") onboarding = true;
		metrics.push({ label, status: titleCase(status)!, ok: status === "IN_RANGE" });
	}
	if (!metrics.length) return null;
	return { onboarding, outside: metrics.filter((m) => !m.ok).length, metrics };
}

export interface AbilityView {
	bars: Array<{ label: string; value: number; tone: Tone }>;
}

/** Cycling ability: three 0–100 scores, drawn as bars. */
export function abilityView(account: AccountInfo | null): AbilityView | null {
	const a = account?.cyclingAbility;
	const bars: AbilityView["bars"] = [];
	for (const [key, label, tone] of [
		["anaerobicCapacity", "Anaerobic Capacity", "purple"],
		["aerobicCapacity", "Aerobic Capacity", "orange"],
		["aerobicEndurance", "Aerobic Endurance", "cyan"],
	] as const) {
		const v = a?.[key];
		if (typeof v === "number") bars.push({ label, value: v, tone });
	}
	return bars.length ? { bars } : null;
}

export interface LactateView {
	stats: Array<{ value: string; label: string; shape: "dot" | "square" | "triangle" | "diamond"; tone: Tone }>;
	updated?: string;
}

export function lactateView(account: AccountInfo | null, units: "metric" | "imperial", today: string): LactateView | null {
	const lt = account?.lactateThreshold;
	const ftp = account?.ftp?.running;
	const stats: LactateView["stats"] = [];
	if (lt?.heartRate !== undefined) stats.push({ value: `${lt.heartRate} bpm`, label: "Heart Rate", shape: "dot", tone: "red" });
	if (lt?.pace) stats.push({ value: `${lt.pace} /${units === "imperial" ? "mi" : "km"}`, label: "Pace", shape: "square", tone: "blue" });
	if (ftp?.watts !== undefined) stats.push({ value: `${ftp.watts} W`, label: "Power", shape: "triangle", tone: "purple" });
	if (ftp?.wattsPerKg !== undefined) {
		stats.push({ value: `${ftp.wattsPerKg.toFixed(2)} W/kg`, label: "Power (W/kg)", shape: "diamond", tone: "pink" });
	}
	if (!stats.length) return null;
	const date = lt?.date ?? ftp?.date;
	return { stats, updated: date ? readingDate(date, today) : undefined };
}

/* ------------------------------------------------------------------ */
/*  Everything At a Glance draws                                       */
/* ------------------------------------------------------------------ */

export interface GlanceModel {
	units: "metric" | "imperial";
	heartRate: HeartRateView | null;
	intensity: IntensityView | null;
	calories: CaloriesView | null;
	stress: StressView | null;
	hrv: HrvView | null;
	altitude: AcclimationView | null;
	cyclingAbility: AbilityView | null;
	cyclingFtp: Gauge | null;
	cyclingVo2: Gauge | null;
	endurance: TrendGauge | null;
	fitnessAge: FitnessAgeView | null;
	floors: FloorsView | null;
	health: HealthView | null;
	heat: AcclimationView | null;
	hillScore: TrendGauge | null;
	lastActivity: LastActivityView | null;
	loadFocus: LoadFocusView | null;
	pulseOx: ReadingsView | null;
	respiration: ReadingsView | null;
	runningEconomy: Gauge | null;
	lactate: LactateView | null;
	tolerance: ToleranceView | null;
	trainingLoad: TrainingLoadView | null;
	vo2max: Gauge | null;
	weight: WeightView | null;
	xcSkiFtp: Gauge | null;
}

/**
 * Every card's view, whether or not it is on the page: each is a few lookups,
 * and the edit screen can add any of them without a rebuild.
 */
export function glanceModel(input: HomeInput, row: DayRow | undefined, units: "metric" | "imperial"): GlanceModel {
	const sex = input.account?.sex;
	const age = num(latestWith(input.rows, input.date, "chronological_age"), "chronological_age");
	const vo2 = (key: string) => {
		const v = num(latestWith(input.rows, input.date, key, VO2_WINDOW), key);
		return v === undefined ? null : vo2Gauge(v, age, sex);
	};
	const ftp = (sport: "cycling" | "xcSkiing") => {
		const v = input.account?.ftp?.[sport]?.wattsPerKg;
		return v === undefined ? null : ftpGauge(v, sex);
	};
	return {
		units,
		heartRate: heartRateView(row, input.series),
		intensity: intensityView(input),
		calories: caloriesView(row),
		stress: stressView(input, row),
		hrv: hrvView(input, row),
		altitude: altitudeView(input),
		cyclingAbility: abilityView(input.account),
		cyclingFtp: ftp("cycling"),
		cyclingVo2: vo2("vo2max_cycling"),
		endurance: enduranceView(input),
		fitnessAge: fitnessAgeView(input),
		floors: floorsView(input, row),
		health: healthView(row),
		heat: heatView(input),
		hillScore: hillView(input),
		lastActivity: lastActivityView(input),
		loadFocus: loadFocusView(input),
		pulseOx: pulseOxView(row),
		respiration: respirationView(row),
		runningEconomy: economyView(input.account),
		lactate: lactateView(input.account, units, input.date),
		tolerance: toleranceView(input, units),
		trainingLoad: trainingLoadView(input),
		vo2max: vo2("vo2max"),
		weight: weightView(input),
		xcSkiFtp: ftp("xcSkiing"),
	};
}
