import type { DaySeries, SeriesPoint, SleepDetail, SleepFactorKey, SleepLevel } from "../sync/intraday";
import type { SleepRow } from "../sync/sleep-index";
import { shortDate } from "./day";
import { daysBetween, longDate, mean, SHORT_MONTHS, weekdayOf } from "./periods";
import { shiftDate } from "./series";
import {
	NEED_FACTOR_TITLE,
	adjustmentText,
	alignmentText,
	headline,
	historyMessage,
	humanizeKey,
	needMessage,
	needReason,
	qualifierText,
	worseQualifier,
	type NeedFactor,
} from "./sleep-copy";
import { STAT_RANGES, type StatRange, type Units } from "./stats-pages";

/**
 * Garmin Connect's Sleep page, worked out from the sleep index
 * (`src/sync/sleep-index.ts`) and, for one night, that day's series file.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The rules are the app's,
 * measured against it on 2026-10-05 and 2026-10-07 (ref/health-stats):
 *
 * - Durations and clock times truncate to the minute: 28,308 s of average
 *   wake time is 7:51 AM, not 7:52.
 * - A period's averages are the plain mean of its nights, rounded to the
 *   nearest whole number (one decimal for skin temperature).
 * - A year runs in fifty-two weeks of seven days ending today. Each week is
 *   the mean of its nights; the year's figures are the mean of its weeks,
 *   with Highest and Lowest the mean of each week's best and worst score.
 * - Bed and wake times average on the clock of the day the night ended on:
 *   seconds from that day's midnight, negative before it.
 * - An overlay's axis is centred on the data, four steps of
 *   ceil((max − min + 4) / 4): 45–63 bpm draws 42–66, 47–117 ms 44–120.
 */

export type SleepRange = StatRange;
export type SleepTab = "score" | "coach";
export type SleepFactorId = "duration" | "stress" | "deep" | "light" | "rem" | "awake";

export const SLEEP_RANGES: readonly SleepRange[] = STAT_RANGES;
export const SLEEP_FACTORS: readonly SleepFactorId[] = ["duration", "stress", "deep", "light", "rem", "awake"];
export const FACTOR_TITLE: Record<SleepFactorId, string> = {
	duration: "Duration",
	stress: "Stress",
	deep: "Deep",
	light: "Light",
	rem: "REM",
	awake: "Awake/Restlessness",
};

/** What the pages read. */
export interface SleepData {
	/** Oldest first. */
	rows: SleepRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
	units: Units;
}

export interface SleepRoute {
	range: SleepRange;
	/** Days, weeks, four weeks or years back from the current one: 0 or less. */
	offset: number;
	tab: SleepTab;
}

/** A figure under a line: "50 bpm / Avg Overnight Heart Rate". */
export interface SleepStat {
	value: string;
	unit?: string;
	label: string;
	/** A stage's colour beside the label. */
	stage?: Stage;
}

export type Stage = "deep" | "light" | "rem" | "awake";
const STAGE_OF: Stage[] = ["deep", "light", "rem", "awake"];

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/** Seconds as the app writes them, truncated: "8h 16m", "5m", "7h". */
export function hm(seconds: number): string {
	const total = Math.trunc(Math.max(0, seconds) / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h === 0) return `${m}m`;
	return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Minutes, the same way. */
export function hmOfMinutes(minutes: number): string {
	return hm(minutes * 60);
}

/** Seconds from midnight (negative before it) as a clock time, truncated: { time: "11:30", ampm: "PM" }. */
export function clock(secondsFromMidnight: number): { time: string; ampm: string } {
	const minutes = Math.trunc(secondsFromMidnight / 60);
	const m = ((minutes % 1440) + 1440) % 1440;
	const h = Math.floor(m / 60);
	return { time: `${h % 12 || 12}:${String(m % 60).padStart(2, "0")}`, ampm: h < 12 ? "AM" : "PM" };
}

export function clockText(secondsFromMidnight: number): string {
	const c = clock(secondsFromMidnight);
	return `${c.time} ${c.ampm}`;
}

/**
 * A moment's time of day, truncated: 23:35:14 is 11:35 PM. Unlike an average
 * (`clock`), a moment before midnight is not rounded towards it.
 */
function timeOfDay(secondsFromMidnight: number): { value: string; unit: string } {
	const c = clock(((secondsFromMidnight % 86_400) + 86_400) % 86_400);
	return { value: c.time, unit: c.ampm };
}

/** Epoch ms on the watch's clock (ms already shifted to local) as "11:35 PM". */
function localClock(localMs: number): string {
	const d = new Date(localMs);
	return clockText(d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds());
}

/** "Sunday, October 4", with the year once it is not this one's. */
export function nightLabel(date: string, today: string): string {
	const d = new Date(`${date}T00:00:00Z`);
	const text = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
	return date.slice(0, 4) === today.slice(0, 4) ? text : `${text}, ${date.slice(0, 4)}`;
}

/** "Oct 1 - 7", "Sep 24 - 30", "Oct 9, 2025 - Oct 7, 2026". */
export function periodLabel(from: string, to: string, today: string): string {
	if (from.slice(0, 4) === to.slice(0, 4)) {
		const tail = to.slice(0, 4) === today.slice(0, 4) ? "" : `, ${to.slice(0, 4)}`;
		const end = from.slice(0, 7) === to.slice(0, 7) ? String(Number(to.slice(8))) : shortDate(to);
		return `${shortDate(from)} - ${end}${tail}`;
	}
	return `${shortDate(from)}, ${from.slice(0, 4)} - ${shortDate(to)}, ${to.slice(0, 4)}`;
}

function signed(value: number, digits = 0): string {
	const text = value.toFixed(digits);
	return value > 0 ? `+${text}` : text === `-${(0).toFixed(digits)}` ? (0).toFixed(digits) : text;
}

function round(value: number): number {
	return Math.round(value);
}

const DASH = "--";

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/** An overlay's five gridline values, bottom first: centred on the data, four equal steps. */
export function overlayTicks(min: number, max: number): number[] {
	const step = Math.max(1, Math.ceil((max - min + 4) / 4));
	const centre = Math.floor((max + min) / 2);
	return [-2, -1, 0, 1, 2].map((k) => centre + k * step);
}

/* ------------------------------------------------------------------ */
/*  The day view                                                       */
/* ------------------------------------------------------------------ */

export type OverlayId = "breathing" | "awake" | "rhr" | "bodyBattery" | "pulseOx" | "respiration" | "hrv";

export const OVERLAY_CHIP: Record<OverlayId, string> = {
	breathing: "Breathing Variations",
	awake: "Awake/Restlessness",
	rhr: "Resting Heart Rate",
	bodyBattery: "Body Battery",
	pulseOx: "Pulse Ox",
	respiration: "Respiration",
	hrv: "Overnight HRV",
};
const OVERLAY_ORDER: readonly OverlayId[] = ["breathing", "awake", "rhr", "bodyBattery", "pulseOx", "respiration", "hrv"];

export interface TimelineOverlay {
	id: OverlayId;
	chip: string;
	legend: string;
	/** `awake` lights the awake bars and draws restless moments; the others draw a line on their own axis. */
	kind: "awake" | "line" | "step";
	/** `[x 0..1, value]`, x across the night. */
	points: Array<[number, number | null]>;
	/** Restless moments: x and how many. */
	ticks?: Array<[number, number]>;
	/** Bottom first; `labels[i]` empty where the app leaves a line unlabelled. */
	axis?: number[];
	labels?: string[];
}

export interface Timeline {
	/** `x0..x1` across the night, 0..1, and the stage. */
	bars: Array<{ x0: number; x1: number; stage: Stage }>;
	/** Each whole hour on the watch's clock. */
	hours: number[];
	startLabel: string;
	endLabel: string;
	overlays: TimelineOverlay[];
}

export interface Stages {
	/** Each stage's share of the ring, going round from the top: deep, light, REM, awake. */
	segments: Array<{ stage: Stage; fraction: number }>;
	total: string;
	stats: SleepStat[];
}

export interface FactorCard {
	id: SleepFactorId;
	title: string;
	detail: string;
	rating: string;
}

export interface NeedAdjustment {
	id: NeedFactor;
	title: string;
	detail: string;
}

export interface CoachView {
	need: string;
	/** How far the need moved off its baseline: "−30m", "+45m". */
	delta?: string;
	/** The bar: the need against the baseline, both in minutes. */
	needMinutes: number;
	baselineMinutes?: number;
	title: string;
	text: string;
	adjustments: NeedAdjustment[];
	/** The key the Sleep History sheet speaks to. */
	historyKey?: string;
	alignment?: AlignmentView;
}

export interface AlignmentView {
	title: string;
	subtitle: string;
	text: string;
	/** The axis' left edge, minutes from midnight: the optimal window's midpoint less six hours. */
	axisStart: number;
	/** Minutes from midnight. */
	last?: { start: number; end: number; mid: number };
	internal: { start: number; end: number; mid: number };
	stats: SleepStat[];
}

export interface SleepDayView {
	date: string;
	label: string;
	canGoBack: boolean;
	/** "detail" draws everything; "summary" is a night the index knows but whose series file predates the Sleep page; "empty" has no night. */
	state: "detail" | "summary" | "empty";
	score?: string;
	stats: SleepStat[];
	insight?: { title: string; lines: string[] };
	factors: FactorCard[];
	timeline?: Timeline;
	stages?: Stages;
	metrics: SleepStat[];
	coach?: CoachView;
}

export interface SleepDayInput {
	data: SleepData;
	route: SleepRoute;
	today: string;
	/** The night's series file, read for the page. */
	series?: DaySeries | null;
}

/** The day a 1d page shows. */
export function dayOf(route: SleepRoute, today: string): string {
	return shiftDate(today, Math.min(0, route.offset));
}

export function sleepDayView(input: SleepDayInput): SleepDayView {
	const date = dayOf(input.route, input.today);
	const row = input.data.rows.find((r) => r.date === date);
	const detail = input.series?.sleep ?? null;
	const levels = input.series?.sleepLevels ?? [];
	const oldest = input.data.rows[0]?.date;
	const view: SleepDayView = {
		date,
		label: nightLabel(date, input.today),
		canGoBack: !input.data.complete || !oldest || date > oldest,
		state: detail ? "detail" : row ? "summary" : "empty",
		stats: [],
		factors: [],
		metrics: [],
	};
	if (!detail && !row) return view;

	const score = detail?.score ?? row?.score;
	if (score !== undefined) view.score = String(score);
	const seconds = detail?.seconds ?? row?.seconds;
	view.stats = [
		{ value: qualifierText(detail?.quality ?? row?.quality) ?? DASH, label: "Quality" },
		{ value: seconds !== undefined ? hm(seconds) : DASH, label: "Duration" },
	];
	const insight = detail ? headline(detail.feedback, detail.insight, detail.personal) : undefined;
	if (insight) view.insight = insight;

	if (detail) view.factors = factorCards(detail);
	if (detail && levels.length) view.timeline = timelineOf(detail, levels);
	const stages = stagesOf(detail ?? row!);
	if (stages) view.stages = stages;
	view.metrics = metricsOf(detail, row, input.data.units);
	const coach = detail ? coachOf(detail, date) : undefined;
	if (coach) view.coach = coach;
	return view;
}

function factorCards(d: SleepDetail): FactorCard[] {
	const f = d.factors ?? {};
	const rating = (key: SleepFactorKey) => qualifierText(f[key]?.qualifier) ?? DASH;
	const cards: FactorCard[] = [];
	if (d.seconds !== undefined) cards.push({ id: "duration", title: "Duration", detail: hm(d.seconds), rating: rating("duration") });
	if (d.avgStress !== undefined) cards.push({ id: "stress", title: "Stress", detail: `${round(d.avgStress)} avg`, rating: rating("stress") });
	if (d.deep !== undefined) cards.push({ id: "deep", title: "Deep", detail: hm(d.deep), rating: rating("deep") });
	if (d.light !== undefined) cards.push({ id: "light", title: "Light", detail: hm(d.light), rating: rating("light") });
	if (d.rem !== undefined) cards.push({ id: "rem", title: "REM", detail: hm(d.rem), rating: rating("rem") });
	if (d.awake !== undefined) {
		const restless = d.restlessCount !== undefined ? ` • ${d.restlessCount} Restless Moments` : "";
		const verdict = qualifierText(worseQualifier(f.awakeCount?.qualifier, f.restlessness?.qualifier)) ?? DASH;
		cards.push({ id: "awake", title: "Awake/Restlessness", detail: `${hm(d.awake)}${restless}`, rating: verdict });
	}
	return cards;
}

/** Where a moment falls across the night, 0..1. */
function across(d: { start: number; end: number }, t: number): number {
	return Math.max(0, Math.min(1, (t - d.start) / (d.end - d.start)));
}

export function timelineOf(d: SleepDetail, levels: readonly SleepLevel[]): Timeline {
	const bars: Timeline["bars"] = [];
	for (const l of levels) {
		const stage = STAGE_OF[Math.max(0, Math.min(3, Math.round(l.level)))]!;
		const x0 = across(d, l.start);
		const x1 = across(d, l.end);
		if (x1 <= x0) continue;
		const last = bars[bars.length - 1];
		if (last && last.stage === stage && Math.abs(last.x1 - x0) < 1e-9) last.x1 = x1;
		else bars.push({ x0, x1, stage });
	}
	const offset = d.offset ?? 0;
	const hours: number[] = [];
	const firstHour = Math.floor((d.start + offset) / 3_600_000) * 3_600_000 + 3_600_000;
	for (let t = firstHour; t < d.end + offset; t += 3_600_000) hours.push(across(d, t - offset));
	return {
		bars,
		hours,
		startLabel: localClock(d.start + offset),
		endLabel: localClock(d.end + offset),
		overlays: overlaysOf(d),
	};
}

function linePoints(d: SleepDetail, series: readonly SeriesPoint[] | undefined): Array<[number, number | null]> {
	return (series ?? []).map(([t, v]) => [across(d, t), v]);
}

function valuesOf(points: ReadonlyArray<[number, number | null]>): number[] {
	return points.map((p) => p[1]).filter((v): v is number => v !== null);
}

function lineOverlay(id: OverlayId, legend: string, kind: "line" | "step", points: Array<[number, number | null]>, fixed?: number[]): TimelineOverlay | null {
	const values = valuesOf(points);
	if (!values.length) return null;
	const axis = fixed ?? overlayTicks(Math.min(...values), Math.max(...values));
	// The app labels the four upper lines; Body Battery labels its zero too.
	const labels = axis.map((v, i) => (i === 0 && !fixed ? "" : String(v)));
	return { id, chip: OVERLAY_CHIP[id], legend, kind, points, axis, labels };
}

function overlaysOf(d: SleepDetail): TimelineOverlay[] {
	const out = new Map<OverlayId, TimelineOverlay>();
	if (d.breathing) {
		// Breathing variations come as a severity, not a series; nothing to draw yet.
	}
	if (d.awake !== undefined || d.restless?.length) {
		out.set("awake", {
			id: "awake",
			chip: OVERLAY_CHIP.awake,
			legend: "Restless Moments",
			kind: "awake",
			points: [],
			ticks: (d.restless ?? []).map(([t, v]) => [across(d, t), v ?? 1]),
		});
	}
	const rhr = lineOverlay("rhr", "Resting Heart Rate", "line", linePoints(d, d.heartRate));
	if (rhr) out.set("rhr", rhr);
	const bb = lineOverlay("bodyBattery", "Body Battery", "line", linePoints(d, d.bodyBattery), [0, 25, 50, 75, 100]);
	if (bb) out.set("bodyBattery", bb);
	// Hourly averages, rounded, held across the hour they close.
	const resp: Array<[number, number | null]> = [];
	let previous: number | null = null;
	for (const [t, v] of d.respiration ?? []) {
		const x = across(d, t);
		if (v !== null && previous !== null) resp.push([previous, Math.round(v)], [x, Math.round(v)]);
		else if (v !== null) resp.push([Math.max(0, x - 3_600_000 / (d.end - d.start)), Math.round(v)], [x, Math.round(v)]);
		else resp.push([x, null]);
		previous = x;
	}
	const respiration = lineOverlay("respiration", "Avg Respiration", "step", resp);
	if (respiration) out.set("respiration", respiration);
	const hrv = lineOverlay("hrv", "Overnight HRV", "line", linePoints(d, d.hrvValues));
	if (hrv) out.set("hrv", hrv);
	return OVERLAY_ORDER.map((id) => out.get(id)).filter((o): o is TimelineOverlay => Boolean(o));
}

function stagesOf(n: { deep?: number; light?: number; rem?: number; awake?: number; seconds?: number }): Stages | undefined {
	const parts: Array<[Stage, number | undefined, string]> = [
		["deep", n.deep, "Deep"],
		["light", n.light, "Light"],
		["rem", n.rem, "REM"],
		["awake", n.awake, "Awake"],
	];
	const total = parts.reduce((a, [, v]) => a + (v ?? 0), 0);
	if (!total) return undefined;
	return {
		segments: parts.map(([stage, v]) => ({ stage, fraction: (v ?? 0) / total })),
		total: hm(n.seconds ?? total - (n.awake ?? 0)),
		stats: parts.map(([stage, v, label]) => ({ value: v !== undefined ? hm(v) : DASH, label, stage })),
	};
}

function metricsOf(d: SleepDetail | null, row: SleepRow | undefined, units: Units): SleepStat[] {
	const unitOf = (value: number | undefined, unit: string): Pick<SleepStat, "value" | "unit"> =>
		value === undefined ? { value: DASH } : { value: String(round(value)), unit };
	const skin = units === "imperial" ? (d?.skinF ?? row?.skinF) : (d?.skinC ?? row?.skinC);
	const spo2 = d?.spo2Avg ?? row?.spo2;
	return [
		{ value: d?.breathing ? humanizeKey(d.breathing) : DASH, label: "Breathing Variations" },
		{ value: d?.restlessCount !== undefined ? String(d.restlessCount) : DASH, label: "Restless Moments" },
		{ ...unitOf(d?.avgHr ?? row?.hr, "bpm"), label: "Avg Overnight Heart Rate" },
		{ ...unitOf(d?.restingHr ?? row?.rhr, "bpm"), label: "Resting Heart Rate" },
		{ value: (d?.bodyBatteryChange ?? row?.bb) !== undefined ? signed((d?.bodyBatteryChange ?? row?.bb)!) : DASH, label: "Body Battery Change" },
		{ value: spo2 !== undefined ? `${round(spo2)}%` : DASH, label: "Avg SpO₂" },
		{ value: d?.spo2Low !== undefined ? `${round(d.spo2Low)}%` : DASH, label: "Lowest SpO₂" },
		{ ...unitOf(d?.respAvg ?? row?.resp, "brpm"), label: "Avg Respiration" },
		{ ...unitOf(d?.respLow, "brpm"), label: "Lowest Respiration" },
		{ ...unitOf(d?.hrv ?? row?.hrv, "ms"), label: "Avg Overnight HRV" },
		{ value: (d?.hrvStatus ?? row?.hrvStatus) ? humanizeKey((d?.hrvStatus ?? row?.hrvStatus)!) : DASH, label: "7d Avg HRV" },
		{ value: skin !== undefined ? `${signed(skin, 1)}°` : DASH, label: "Avg Skin Temp Change" },
	];
}

function coachOf(d: SleepDetail, date: string): CoachView | undefined {
	const need = d.need;
	if (need?.actual === undefined) return undefined;
	const adjustments: NeedAdjustment[] = [];
	let reason: string | undefined;
	for (const id of ["history", "hrv", "training", "nap"] as const) {
		const key = need[id];
		if (!key || key.startsWith("NO_CHANGE")) continue;
		adjustments.push({ id, title: NEED_FACTOR_TITLE[id], detail: adjustmentText(key) });
		reason ??= needReason(id, key);
	}
	const message = needMessage(need.feedback, { need: need.actual, ...(need.baseline !== undefined ? { baseline: need.baseline } : {}) }, reason);
	const view: CoachView = {
		need: hmOfMinutes(need.actual),
		needMinutes: need.actual,
		title: message.title,
		text: message.text,
		adjustments,
	};
	if (need.baseline !== undefined) {
		view.baselineMinutes = need.baseline;
		const moved = need.actual - need.baseline;
		if (moved) view.delta = `${moved < 0 ? "−" : "+"}${hmOfMinutes(Math.abs(moved))}`;
	}
	if (need.history) view.historyKey = need.history;
	const a = d.alignment;
	if (a && a.start !== undefined && a.end !== undefined) {
		const mid = a.mid ?? (a.start + a.end) / 2;
		const window = `${clockText(a.start * 60)} ~ ${clockText(a.end * 60)}`;
		const words = alignmentText(a.status, window);
		// Minutes from the midnight that starts the night's day, negative before it, as the index keeps bed and wake.
		const midnight = Date.parse(`${date}T00:00:00Z`);
		const localMinutes = (t: number) => (t + (d.offset ?? 0) - midnight) / 60_000;
		const bed = localMinutes(d.start);
		const wake = localMinutes(d.end);
		const align: AlignmentView = {
			...words,
			axisStart: mid - 360,
			internal: { start: a.start, end: a.end, mid },
			stats: [
				{ ...timeOfDay(bed * 60), label: "Bedtime" },
				{ ...timeOfDay(a.start * 60), label: "Optimal Bedtime" },
				{ ...timeOfDay(wake * 60), label: "Wake Time" },
				{ ...timeOfDay(a.end * 60), label: "Optimal Wake Time" },
			],
		};
		align.last = { start: bed, end: wake, mid: a.last ?? (bed + wake) / 2 };
		view.alignment = align;
	}
	return view;
}

function clockParts(seconds: number): { value: string; unit: string } {
	const c = clock(seconds);
	return { value: c.time, unit: c.ampm };
}

/* ------------------------------------------------------------------ */
/*  Factor pages                                                       */
/* ------------------------------------------------------------------ */

export interface FactorView {
	factor: SleepFactorId;
	title: string;
	about: string;
	/** Deep, Light and REM: the night's total and its share. */
	total?: string;
	/** Deep, Light and REM: the bar with the optimal range drawn on it. */
	range?: { value: number; low: number; high: number; lowLabel: string; highLabel: string; inRange: boolean; stage: Stage };
	stats: SleepStat[];
	/** The sentence under the figures. */
	guidance: string[];
	/** Duration and Awake/Restlessness draw the night; Stress its stress. */
	chart?: "stages" | "awake" | "stress";
	timeline?: Timeline;
	stress?: { points: Array<[number, number | null]>; startLabel: string; endLabel: string; hours: number[] };
}

/** Where the bar puts its optimal range, as fractions of its width, measured off the app. */
export const RANGE_BAR = { low: 0.2297, high: 0.6595, max: 0.892 };

export function factorView(factor: SleepFactorId, d: SleepDetail, levels: readonly SleepLevel[], units: Units): FactorView {
	const f = d.factors ?? {};
	const rating = (key: SleepFactorKey) => qualifierText(f[key]?.qualifier) ?? DASH;
	const title = FACTOR_TITLE[factor];
	switch (factor) {
		case "deep":
		case "light":
		case "rem": {
			const seconds = d[factor] ?? 0;
			const part = f[factor];
			const name = factor === "rem" ? "REM" : title;
			const view: FactorView = {
				factor,
				title,
				about: `About ${name} Sleep`,
				total: `${hm(seconds)}${part?.value !== undefined ? ` (${part.value}%)` : ""}`,
				stats: [
					{ value: rating(factor), label: `${name} Sleep` },
					{ value: hm(seconds), label: "Total Time" },
				],
				guidance: [],
			};
			if (part?.idealStart !== undefined && part.idealEnd !== undefined && part.idealEnd > part.idealStart) {
				view.range = {
					value: rangePosition(seconds, part.idealStart, part.idealEnd),
					low: RANGE_BAR.low,
					high: RANGE_BAR.high,
					lowLabel: hm(part.idealStart),
					highLabel: hm(part.idealEnd),
					inRange: seconds >= part.idealStart && seconds <= part.idealEnd,
					stage: factor,
				};
			}
			if (part?.optimalStart !== undefined && part.optimalEnd !== undefined && part.value !== undefined) {
				const lower = factor === "rem" ? "REM" : factor;
				view.guidance = [`${name} sleep should be ${part.optimalStart}-${part.optimalEnd}% of total sleep. Your ${lower} sleep was ${part.value}%.`];
			}
			return view;
		}
		case "duration": {
			const ideal = f.duration?.optimalStart;
			const view: FactorView = {
				factor,
				title,
				about: "About Sleep Duration",
				stats: [
					{ value: rating("duration"), label: "Duration" },
					{ value: d.seconds !== undefined ? hm(d.seconds) : DASH, label: "Total Time" },
					...(stagesOf(d)?.stats ?? []),
				],
				guidance: ideal !== undefined ? [`Sleep duration of ${spokenHours(ideal)} is ideal for adults your age.`] : [],
				chart: "stages",
			};
			if (levels.length) view.timeline = timelineOf(d, levels);
			return view;
		}
		case "awake": {
			const view: FactorView = {
				factor,
				title,
				about: "About Awake & Restlessness",
				stats: [
					{ value: qualifierText(worseQualifier(f.awakeCount?.qualifier, f.restlessness?.qualifier)) ?? DASH, label: "Awake/Restlessness" },
					{ value: d.awake !== undefined ? hm(d.awake) : DASH, label: "Total Awake Time" },
					{ value: d.awakeCount !== undefined ? String(d.awakeCount) : DASH, label: "Awakenings > 5m" },
					{ value: d.restlessCount !== undefined ? String(d.restlessCount) : DASH, label: "Restless Moments" },
				],
				guidance: [
					"The following are good indicators of calm and restful sleep:",
					"Fewer than 20 total minutes of awake time.",
					"No more than one awakening longer than 5 minutes.",
					"5 or fewer restless moments per hour.",
					"Some restless moments, where you move while still asleep, are natural.",
				],
				chart: "awake",
			};
			if (levels.length) view.timeline = timelineOf(d, levels);
			return view;
		}
		case "stress": {
			const optimal = f.stress?.optimalEnd;
			const tl = levels.length ? timelineOf(d, levels) : undefined;
			const view: FactorView = {
				factor,
				title: "Sleep-Time Stress",
				about: "About Stress & Sleep",
				stats: [
					{ value: rating("stress"), label: "Stress" },
					{ value: d.avgStress !== undefined ? String(round(d.avgStress)) : DASH, label: "Avg Stress Level" },
				],
				guidance:
					optimal !== undefined
						? [`An ideal average stress level while sleeping is ${optimal} or lower. Higher stress levels can negatively affect your sleep score.`]
						: [],
				chart: "stress",
				stress: {
					points: linePoints(d, d.stress),
					startLabel: tl?.startLabel ?? localClock(d.start + (d.offset ?? 0)),
					endLabel: tl?.endLabel ?? localClock(d.end + (d.offset ?? 0)),
					hours: tl?.hours ?? [],
				},
			};
			void units;
			return view;
		}
	}
}

/** "7 hours", "7.5 hours". */
function spokenHours(seconds: number): string {
	const h = Math.round((seconds / 3600) * 10) / 10;
	return `${h} hour${h === 1 ? "" : "s"}`;
}

/** The value's place on the bar: inside the optimal range proportionally, outside it on the same scale per side. */
export function rangePosition(value: number, low: number, high: number): number {
	if (value <= low) return Math.max(0, (value / low) * RANGE_BAR.low);
	if (value <= high) return RANGE_BAR.low + ((value - low) / (high - low)) * (RANGE_BAR.high - RANGE_BAR.low);
	return Math.min(RANGE_BAR.max, RANGE_BAR.high + ((value - high) / (high - low)) * (RANGE_BAR.high - RANGE_BAR.low));
}

/* ------------------------------------------------------------------ */
/*  Weeks, four weeks and years                                        */
/* ------------------------------------------------------------------ */

export type PeriodOverlayId = "hr" | "rhr" | "bodyBattery" | "pulseOx" | "respiration" | "hrv" | "skin";

export const PERIOD_OVERLAY_CHIP: Record<PeriodOverlayId, string> = {
	hr: "Overnight Heart Rate",
	rhr: "Resting Heart Rate",
	bodyBattery: "Body Battery",
	pulseOx: "Pulse Ox",
	respiration: "Respiration",
	hrv: "HRV Status",
	skin: "Skin Temp Change",
};

export interface PeriodOverlay {
	id: PeriodOverlayId;
	chip: string;
	legend: string;
	/** HRV status draws dots coloured by the morning's status; the rest a line of squares. */
	kind: "squares" | "dots";
	points: Array<{ x: number; value: number; status?: string }>;
	axis: number[];
	labels: string[];
}

export interface XAxis {
	dots: Array<{ x: number; large: boolean }>;
	labels: Array<{ x: number; text: string; rotated?: boolean }>;
}

export interface PeriodCard {
	key: string;
	title: string;
	detail?: string;
	score: string;
	duration: string;
	/** A day's card opens its 1d page; a week's its 7d. */
	day?: string;
	weekEnd?: string;
}

export interface SleepPeriodView {
	range: Exclude<SleepRange, "1d">;
	label: string;
	canGoBack: boolean;
	score: {
		/** `null` where a night or week had no score. */
		points: Array<{ x: number; value: number | null }>;
		/** Days get dots; a year's weeks a bare line. */
		dots: boolean;
		axis: XAxis;
		overlays: PeriodOverlay[];
	};
	/** 7d and 4w: the period's averages. */
	averages: SleepStat[];
	/** 1y: average, highest and lowest weekly score. */
	scoreStats: SleepStat[];
	duration: {
		bars: Array<{ x: number; hours: number; need: number | null; met: boolean }>;
		ticks: number[];
		axis: XAxis;
		stats: SleepStat[];
		/** A year's bars are thin. */
		thin: boolean;
	};
	times: {
		/** The top gridline, hours from midnight (negative before it), then four steps of four hours. */
		top: number;
		labels: string[];
		bars: Array<{ x: number; bed: number; wake: number; aligned: boolean }>;
		avgBed?: number;
		avgWake?: number;
		axis: XAxis;
		stats: SleepStat[];
		/** 7d and 4w have the Sleep Alignment tab; a year only Consistency. */
		alignment: boolean;
		thin: boolean;
	};
	cards: PeriodCard[];
}

export interface SleepPeriodInput {
	data: SleepData;
	route: SleepRoute;
	today: string;
}

interface Night {
	date: string;
	row?: SleepRow;
}

/** The days a 7d or 4w page covers, oldest first. */
function trailingDays(days: number, offset: number, today: string): string[] {
	const end = shiftDate(today, days * Math.min(0, offset));
	return Array.from({ length: days }, (_, i) => shiftDate(end, i - days + 1));
}

/** Evenly across the plot, the first on its left edge and the last on its right. */
function spread(i: number, n: number): number {
	return n <= 1 ? 0.5 : i / (n - 1);
}

function dayAxis(days: readonly string[]): XAxis {
	const n = days.length;
	return {
		dots: days.map((_, i) => ({ x: spread(i, n), large: i === 0 || i === n - 1 })),
		labels: [
			{ x: 0, text: days[0]!.slice(5) },
			{ x: 1, text: days[n - 1]!.slice(5) },
		],
	};
}

export function sleepPeriodView(input: SleepPeriodInput): SleepPeriodView {
	const range = input.route.range === "1d" ? "7d" : input.route.range;
	return range === "1y" ? yearView(input) : daysView(input, range);
}

function daysView(input: SleepPeriodInput, range: "7d" | "4w"): SleepPeriodView {
	const n = range === "7d" ? 7 : 28;
	const days = trailingDays(n, input.route.offset, input.today);
	const byDate = new Map(input.data.rows.map((r) => [r.date, r]));
	const nights: Night[] = days.map((date) => {
		const row = byDate.get(date);
		return row ? { date, row } : { date };
	});
	const rows = nights.map((n) => n.row).filter((r): r is SleepRow => Boolean(r));
	const axis = dayAxis(days);
	const oldest = input.data.rows[0]?.date;

	const pick = (key: keyof SleepRow) => rows.map((r) => r[key]).filter((v): v is number => typeof v === "number");
	const avg = (key: keyof SleepRow) => mean(pick(key));
	const units = input.data.units;
	const skinKey = units === "imperial" ? "skinF" : "skinC";

	const averages: SleepStat[] = [
		{ value: fmt(avg("score")), label: "Avg Score" },
		withUnit(avg("hr"), "bpm", "Avg Overnight Heart Rate"),
		withUnit(avg("rhr"), "bpm", "Avg Resting Heart Rate"),
		{ value: avg("bb") !== undefined ? signed(round(avg("bb")!)) : DASH, label: "Avg Body Battery Change" },
		{ value: avg("spo2") !== undefined ? `${round(avg("spo2")!)}%` : DASH, label: "Avg SpO₂" },
		withUnit(avg("resp"), "brpm", "Avg Respiration"),
		{ value: avg(skinKey) !== undefined ? `${signed(Math.round(avg(skinKey)! * 10) / 10, 1)}°` : DASH, label: "Avg Skin Temp Change" },
	];

	const durationBars = nights.map((night, i) => {
		const r = night.row;
		const hours = (r?.seconds ?? 0) / 3600;
		const need = r?.need !== undefined ? r.need / 60 : null;
		return { x: spread(i, n), hours, need, met: need !== null && hours * 60 >= need * 60 - 1e-9 };
	});
	const avgSeconds = avg("seconds");
	const avgNeed = avg("need");

	const beds = pick("bed");
	const wakes = pick("wake");
	const avgBed = mean(beds);
	const avgWake = mean(wakes);

	return {
		range,
		label: periodLabel(days[0]!, days[n - 1]!, input.today),
		canGoBack: !input.data.complete || !oldest || days[0]! > oldest,
		score: {
			points: nights.map((night, i) => ({ x: spread(i, n), value: night.row?.score ?? null })),
			dots: true,
			axis,
			overlays: periodOverlays(nights, n, units),
		},
		averages,
		scoreStats: [],
		duration: {
			bars: durationBars.filter((b) => b.hours > 0),
			ticks: durationTicks(Math.max(0, ...durationBars.map((b) => Math.max(b.hours, b.need ?? 0)))),
			axis,
			stats: [
				{ value: avgSeconds !== undefined ? hm(round(avgSeconds)) : DASH, label: "Avg Sleep Duration" },
				{ value: avgNeed !== undefined ? hmOfMinutes(round(avgNeed)) : DASH, label: "Avg Sleep Need" },
			],
			thin: n > 7,
		},
		times: {
			...timesAxis(rows.map((r) => r.bed).filter((v): v is number => v !== undefined)),
			bars: nights
				.map((night, i) => ({ night, i }))
				.filter(({ night }) => night.row?.bed !== undefined && night.row?.wake !== undefined)
				.map(({ night, i }) => ({ x: spread(i, n), bed: night.row!.bed!, wake: night.row!.wake!, aligned: night.row!.align === "ALIGNED" })),
			...(avgBed !== undefined ? { avgBed: round(avgBed) } : {}),
			...(avgWake !== undefined ? { avgWake: round(avgWake) } : {}),
			axis,
			stats: [
				{ ...(avgBed !== undefined ? clockParts(round(avgBed)) : { value: DASH }), label: "Avg Bedtime" },
				{ ...(avgWake !== undefined ? clockParts(round(avgWake)) : { value: DASH }), label: "Avg Wake Time" },
			],
			alignment: true,
			thin: n > 7,
		},
		cards: [...nights]
			.reverse()
			.filter((night) => night.row)
			.map((night) => ({
				key: night.date,
				title: weekdayOf(night.date),
				detail: longDate(night.date),
				score: night.row!.score !== undefined ? String(night.row!.score) : DASH,
				duration: night.row!.seconds !== undefined ? hm(night.row!.seconds) : DASH,
				day: night.date,
			})),
	};
}

function periodOverlays(nights: readonly Night[], n: number, units: Units): PeriodOverlay[] {
	const out: PeriodOverlay[] = [];
	const series = (key: keyof SleepRow, map: (v: number) => number = (v) => v) =>
		nights.flatMap((night, i) => {
			const v = night.row?.[key];
			return typeof v === "number" ? [{ x: spread(i, n), value: map(v) }] : [];
		});
	const add = (id: PeriodOverlayId, legend: string, points: PeriodOverlay["points"], kind: PeriodOverlay["kind"] = "squares", fixed?: { axis: number[]; labels: string[] }) => {
		if (!points.length) return;
		const values = points.map((p) => p.value);
		const axis = fixed?.axis ?? overlayTicks(Math.min(...values), Math.max(...values));
		const labels = fixed?.labels ?? axis.map((v, i) => (i === 0 ? "" : String(v)));
		out.push({ id, chip: PERIOD_OVERLAY_CHIP[id], legend, kind, points, axis, labels });
	};
	add("hr", "Avg Overnight Heart Rate", series("hr"));
	add("rhr", "Resting Heart Rate", series("rhr"));
	add("bodyBattery", "Body Battery Change", series("bb"), "squares", { axis: [0, 25, 50, 75, 100], labels: ["0", "25", "50", "75", "100"] });
	add("pulseOx", "Avg SpO₂", series("spo2"));
	// The app draws whole breaths, rounded down: 14.89 sits on 14.
	add("respiration", "Respiration Rate", series("resp", Math.floor));
	const hrv = nights.flatMap((night, i) =>
		typeof night.row?.hrv === "number" ? [{ x: spread(i, n), value: night.row.hrv, ...(night.row.hrvStatus ? { status: night.row.hrvStatus } : {}) }] : [],
	);
	if (hrv.length) {
		const status = hrv.find((p) => p.status)?.status;
		const values = hrv.map((p) => p.value);
		const axis = overlayTicks(Math.min(...values), Math.max(...values));
		out.push({ id: "hrv", chip: PERIOD_OVERLAY_CHIP.hrv, legend: status ? humanizeKey(status) : "HRV", kind: "dots", points: hrv, axis, labels: axis.map((v, i) => (i === 0 ? "" : String(v))) });
	}
	const skin = series(units === "imperial" ? "skinF" : "skinC");
	if (skin.length) {
		const reach = Math.max(1, Math.ceil(Math.max(...skin.map((p) => Math.abs(p.value))) * 2) / 2);
		const axis = [-reach, -reach / 2, 0, reach / 2, reach];
		add("skin", "Avg Skin Temp Change", skin, "squares", { axis, labels: axis.map((v) => (v === 0 ? "0" : signed(v, 1))) });
	}
	return out;
}

/** 0, 3, 6, 9, 12 hours, stretched in threes when a night runs longer. */
export function durationTicks(maxHours: number): number[] {
	const top = Math.max(12, Math.ceil(maxHours / 3) * 3);
	const step = top / 4;
	return [0, step, 2 * step, 3 * step, top];
}

/**
 * The bedtime axis: sixteen hours in four steps, starting on the odd hour at
 * or before the earliest bedtime (7 PM for a week of 8:54 PM to 1:57 AM, 9 PM
 * for a year whose earliest week averaged 9:36 PM).
 */
export function timesAxis(beds: readonly number[]): { top: number; labels: string[] } {
	const earliest = beds.length ? Math.min(...beds) / 3600 : -3;
	let top = Math.floor(earliest);
	if (((top % 2) + 2) % 2 === 0) top -= 1;
	const labels = [0, 4, 8, 12].map((k) => hourLabel(top + k));
	return { top, labels: [...labels, ""] };
}

function hourLabel(hoursFromMidnight: number): string {
	const h = ((hoursFromMidnight % 24) + 24) % 24;
	return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

function fmt(value: number | undefined): string {
	return value === undefined ? DASH : String(round(value));
}

function withUnit(value: number | undefined, unit: string, label: string): SleepStat {
	return value === undefined ? { value: DASH, label } : { value: String(round(value)), unit, label };
}

/* ------------------------------------------------------------------ */
/*  A year of weeks                                                    */
/* ------------------------------------------------------------------ */

export interface SleepWeek {
	from: string;
	to: string;
	score?: number;
	high?: number;
	low?: number;
	seconds?: number;
	need?: number;
	bed?: number;
	wake?: number;
	nights: number;
}

/** Fifty-two weeks of seven days ending `end`, oldest first; each the rounded mean of its nights. */
export function weeksEnding(rows: readonly SleepRow[], end: string): SleepWeek[] {
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const weeks: SleepWeek[] = [];
	for (let k = 51; k >= 0; k--) {
		const to = shiftDate(end, -7 * k);
		const from = shiftDate(to, -6);
		const nights = Array.from({ length: 7 }, (_, i) => byDate.get(shiftDate(from, i))).filter((r): r is SleepRow => Boolean(r));
		const vals = (key: keyof SleepRow) => nights.map((r) => r[key]).filter((v): v is number => typeof v === "number");
		const avg = (key: keyof SleepRow) => {
			const m = mean(vals(key));
			return m === undefined ? undefined : round(m);
		};
		const scores = vals("score");
		const week: SleepWeek = { from, to, nights: nights.length };
		const set = (k2: keyof SleepWeek, v: number | undefined) => {
			if (v !== undefined) (week as unknown as Record<string, number>)[k2] = v;
		};
		set("score", avg("score"));
		set("high", scores.length ? Math.max(...scores) : undefined);
		set("low", scores.length ? Math.min(...scores) : undefined);
		set("seconds", avg("seconds"));
		set("need", avg("need"));
		set("bed", avg("bed"));
		set("wake", avg("wake"));
		weeks.push(week);
	}
	return weeks;
}

function yearView(input: SleepPeriodInput): SleepPeriodView {
	const end = shiftDate(input.today, 364 * Math.min(0, input.route.offset));
	const weeks = weeksEnding(input.data.rows, end);
	const from = weeks[0]!.from;
	const n = weeks.length;
	const oldest = input.data.rows[0]?.date;
	const of = (key: keyof SleepWeek) => mean(weeks.map((w) => w[key]).filter((v): v is number => typeof v === "number"));

	// Month dots sit at calendar month starts over their own span: the first
	// of the month the year starts in, to the first of the month it ends in.
	const first = `${from.slice(0, 7)}-01`;
	const last = `${end.slice(0, 7)}-01`;
	const span = Math.max(1, daysBetween(first, last));
	const monthAxis = (): XAxis => {
		const dots: XAxis["dots"] = [];
		const labels: XAxis["labels"] = [];
		for (let m = first; m <= last; m = nextMonth(m)) {
			const x = daysBetween(first, m) / span;
			dots.push({ x, large: true });
			labels.push({ x, text: SHORT_MONTHS[Number(m.slice(5, 7)) - 1]!, rotated: true });
		}
		return { dots, labels };
	};
	const axis = monthAxis();

	const avgSeconds = of("seconds");
	const avgNeed = of("need");
	const avgBed = of("bed");
	const avgWake = of("wake");

	return {
		range: "1y",
		label: periodLabel(from, end, input.today),
		canGoBack: !input.data.complete || !oldest || from > oldest,
		score: { points: weeks.map((w, i) => ({ x: spread(i, n), value: w.score ?? null })), dots: false, axis, overlays: [] },
		averages: [],
		scoreStats: [
			{ value: fmt(of("score")), label: "Avg Score" },
			{ value: fmt(of("high")), label: "Avg Highest Score" },
			{ value: fmt(of("low")), label: "Avg Lowest Score" },
		],
		duration: {
			bars: weeks
				.map((w, i) => ({ x: spread(i, n), hours: (w.seconds ?? 0) / 3600, need: w.need !== undefined ? w.need / 60 : null, met: w.need !== undefined && (w.seconds ?? 0) / 60 >= w.need }))
				.filter((b) => b.hours > 0),
			ticks: durationTicks(Math.max(0, ...weeks.map((w) => Math.max((w.seconds ?? 0) / 3600, (w.need ?? 0) / 60)))),
			axis,
			stats: [
				{ value: avgSeconds !== undefined ? hm(round(avgSeconds)) : DASH, label: "Avg Weekly Sleep Duration" },
				{ value: avgNeed !== undefined ? hmOfMinutes(round(avgNeed)) : DASH, label: "Avg Weekly Sleep Need" },
			],
			thin: true,
		},
		times: {
			...timesAxis(weeks.map((w) => w.bed).filter((v): v is number => v !== undefined)),
			bars: weeks
				.map((w, i) => ({ w, i }))
				.filter(({ w }) => w.bed !== undefined && w.wake !== undefined)
				.map(({ w, i }) => ({ x: spread(i, n), bed: w.bed!, wake: w.wake!, aligned: false })),
			...(avgBed !== undefined ? { avgBed: round(avgBed) } : {}),
			...(avgWake !== undefined ? { avgWake: round(avgWake) } : {}),
			axis,
			stats: [
				{ ...(avgBed !== undefined ? clockParts(round(avgBed)) : { value: DASH }), label: "Avg Weekly Bedtime" },
				{ ...(avgWake !== undefined ? clockParts(round(avgWake)) : { value: DASH }), label: "Avg Weekly Wake Time" },
			],
			alignment: false,
			thin: true,
		},
		cards: [...weeks]
			.reverse()
			.filter((w) => w.nights > 0)
			.map((w) => ({
				key: w.from,
				title: weekRange(w.from, w.to),
				score: w.score !== undefined ? String(w.score) : DASH,
				duration: w.seconds !== undefined ? hm(w.seconds) : DASH,
				weekEnd: w.to,
			})),
	};
}

/** "Oct 1 - 7", "Aug 27 - Sep 2". */
export function weekRange(from: string, to: string): string {
	return from.slice(0, 7) === to.slice(0, 7) ? `${shortDate(from)} - ${Number(to.slice(8))}` : `${shortDate(from)} - ${shortDate(to)}`;
}

function nextMonth(firstOfMonth: string): string {
	const y = Number(firstOfMonth.slice(0, 4));
	const m = Number(firstOfMonth.slice(5, 7));
	return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/* ------------------------------------------------------------------ */
/*  Sleep History sheet                                                */
/* ------------------------------------------------------------------ */

export interface HistoryView {
	message: string;
	bars: SleepPeriodView["duration"];
	axisLabels: XAxis;
}

/** The Sleep History sheet: duration against need for the seven nights ending `date`. */
export function historyView(data: SleepData, date: string, key: string | undefined): HistoryView {
	const week = daysView({ data, route: { range: "7d", offset: 0, tab: "score" }, today: date }, "7d");
	return { message: historyMessage(key), bars: week.duration, axisLabels: week.duration.axis };
}

/* ------------------------------------------------------------------ */
/*  Opening the page                                                   */
/* ------------------------------------------------------------------ */

/**
 * Where the hub opens the Sleep page: the newest night, as Home shows the
 * newest synced day. Today's once it has synced.
 */
export function latestNightOffset(data: SleepData, today: string): number {
	const newest = [...data.rows].reverse().find((r) => r.date <= today)?.date;
	const back = newest ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000) : 0;
	return back ? -back : 0;
}

/** Whether a 1d page wants that day's series file. */
export function sleepSeriesDays(route: SleepRoute, today: string): string[] {
	return route.range === "1d" ? [dayOf(route, today)] : [];
}
