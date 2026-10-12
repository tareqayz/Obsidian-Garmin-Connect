import { rowOfNight, type HrvNight, type HrvStatusRow } from "../sync/hrv-status-index";
import { readingDate } from "./day";
import type { Gauge, Tone } from "./gauges";
import { HRV_STATUSES, NO_DATA, hrvCopy, statusLook, type HrvStatusLook } from "./hrv-status-copy";
import { canStepBack, dayAxis, dayLabel, dayOf, daysBetween, daysOf, weekdayOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { segmentsFromAngles } from "./stat-dial";
import { statPeriodLabel, statSpan } from "./stat-registry";

/**
 * Garmin Connect's HRV Status page (Performance Stats), worked out from the
 * HRV status index (`src/sync/hrv-status-index.ts`) and, on 1d, the night's
 * readings (`HRV_DAY`). Rules measured on the phone on 2026-10-11
 * (ref/performance-stats/hrv-status/README.md):
 *
 * - 1d, 7d and 4w, spans rolling back from the selected day (`{days}`, the
 *   registry's default): "Oct 5 - 11", "Sep 14 - Oct 11". A night belongs to
 *   the morning it ends.
 * - Every number is Garmin's, as sent: the 7-day average is not the mean of
 *   the window's nights, nor the overnight average the mean of the readings.
 * - 1d: the dial (`hrvDial`) with the 7-day average, the status and its
 *   copy, Overnight Avg and Highest 5-min Avg, and the Nightly Timeline
 *   (`nightTimeline`) from sleep start to wake.
 * - 7d / 4w: "7-day Averages" (`hrvAverages`): a dot a night shaped and
 *   coloured by status, the baseline band, and with the "Overnight
 *   Averages" chip the overnight averages as a dashed line; then a card a
 *   night, newest first.
 * - The chip is the route's `sub` (`"overnight"`), so it survives a reload
 *   and a step to another period, as a chart's overlay does on an activity's
 *   page; 1d ignores it.
 *
 * The dial and the 7-day Averages chart are exported for Training
 * Readiness's HRV Status sheet, which draws the same two (pixel-identical).
 *
 * Inferred (unseen on the phone): previous periods, the 7d / 4w bottom rule
 * past Oct 5 – 11, the dial's bands staying put as the baseline moves, every
 * copy but `HRV_BALANCED_5` and `_6`, POOR, a gap in the night's readings
 * (bridged), a night without a row, onboarding, and the cards past the
 * second.
 *
 * The charts' geometry, measured off the Obsidian twin (Figma 430:6108), is
 * `hrv-status-charts.ts`'s.
 *
 * Pure.
 */

/** What the page's route says: the range, how many periods back, and the chip. */
export interface HrvStatusRoute {
	range: PeriodRange;
	offset: number;
	/** `OVERNIGHT` while the Overnight Averages chip is on. */
	sub?: string;
}

/** What the view needs besides the route and the index's rows. */
export interface HrvStatusContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** 1d: the night's block (`hrvNightIn(series)`): undefined while it loads, null once Garmin had none. */
	night?: HrvNight | null;
}

/** The route's `sub` while the Overnight Averages chip is on. */
export const OVERNIGHT = "overnight";
export const NIGHTLY_TIMELINE = "Nightly Timeline";
export const SEVEN_DAY_AVERAGES = "7-day Averages";
export const CHIP_LABEL = "Overnight Averages";
const DASH = "--";

/* ------------------------------------------------------------------ */
/*  The dial                                                           */
/* ------------------------------------------------------------------ */

/** The dial: a 300° arc open at the bottom, running from 30° to 330° clockwise from straight down. */
export const HRV_DIAL = { start: 30, sweep: 300 } as const;

/**
 * The dial's band boundaries, in degrees from 12 o'clock (`stat-dial.ts`'s
 * measure): the gaps measured on 1d/01-top.png, centred 61.57°, 104.79° and
 * 268.00° from straight down, fractions 0.1052, 0.2493 and 0.7933 of the arc.
 * No value scale puts the baseline there (69, 73 and 90 step 10.8°, 9.0° and
 * 10.75° a ms), so the bands stay where they were measured, whatever the
 * baseline (Inferred). A LOW night just under `lowUpper` can then sit in the
 * orange band, and the marker's colour, by status, keeps the meaning.
 */
export const HRV_DIAL_BOUNDS: readonly number[] = [-150, -118.43, -75.21, 88, 150];
export const HRV_DIAL_TONES: readonly Tone[] = ["red", "orange", "green", "orange"];

/** The 1d dial: the 7-day average and its line, the bands, and Garmin's marker in its status's colour. */
export interface HrvDial {
	/** "84" and "7d Avg"; "--" without a 7-day average (onboarding). The bands, and the marker (`at`, `tone`) when it has a place. */
	gauge: Gauge;
	/** "ms" after a number. */
	unit?: "ms";
	/** The marker's centre in degrees clockwise from straight down: 30 + 300 × markerValue. */
	angle?: number;
	/** The gauge's true ends, ms: balancedLow − Δ/2 and balancedUpper + Δ/2 (64.5 and 98.5 on Oct 11; the web reads "Data ranges from 64 to 98"). */
	low?: number;
	high?: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The baseline's width, Δ = balancedUpper − balancedLow; none without a baseline. */
function deltaOf(row: Pick<HrvStatusRow, "balLow" | "balHigh">): number | undefined {
	return row.balLow !== undefined && row.balHigh !== undefined && row.balHigh > row.balLow ? row.balHigh - row.balLow : undefined;
}

/** The dial's ends on Garmin's scale: balancedLow − Δ/2 and balancedUpper + Δ/2. */
export function gaugeEnds(row: Pick<HrvStatusRow, "balLow" | "balHigh">): { low: number; high: number } | undefined {
	const delta = deltaOf(row);
	return delta === undefined ? undefined : { low: row.balLow! - delta / 2, high: row.balHigh! + delta / 2 };
}

/**
 * `markerValue` as Garmin works it out at or above `balancedLow`: linear on
 * the gauge's ends, so balancedLow sits at 0.25 and balancedUpper at 0.75
 * (303 of 303 rows). Below `balancedLow` Garmin maps it another way, which
 * whole-ms data cannot reproduce: none.
 */
export function linearMarker(row: Pick<HrvStatusRow, "weekly" | "balLow" | "balHigh">): number | undefined {
	const ends = gaugeEnds(row);
	if (!ends || row.weekly === undefined || row.weekly < row.balLow!) return undefined;
	return clamp01((row.weekly - ends.low) / (ends.high - ends.low));
}

/** The marker's place, 0–1: Garmin's own `markerValue`, else its linear rule where that holds. */
export function markerOf(row: Pick<HrvStatusRow, "marker" | "weekly" | "balLow" | "balHigh">): number | undefined {
	return row.marker !== undefined ? clamp01(row.marker) : linearMarker(row);
}

/**
 * A fraction of the dial as the marker's angle, degrees clockwise from
 * straight down: 202.05° for Oct 11's 0.5735. The shot has it at 203.55°,
 * 1.5° on; no rule found explains the difference, so the spec's rule stands.
 */
export function markerAngle(at: number): number {
	return HRV_DIAL.start + at * HRV_DIAL.sweep;
}

/** A night's dial. */
export function hrvDial(row: HrvStatusRow): HrvDial {
	const gauge: Gauge = {
		value: row.weekly !== undefined ? String(row.weekly) : DASH,
		label: "7d Avg",
		segments: segmentsFromAngles(HRV_DIAL_BOUNDS, HRV_DIAL_TONES),
	};
	const dial: HrvDial = { gauge };
	if (row.weekly !== undefined) dial.unit = "ms";
	const at = row.weekly !== undefined ? markerOf(row) : undefined;
	if (at !== undefined) {
		gauge.at = at;
		const tone = statusLook(row.status)?.tone;
		if (tone) gauge.tone = tone;
		dial.angle = markerAngle(at);
	}
	const ends = gaugeEnds(row);
	if (ends) Object.assign(dial, ends);
	return dial;
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/** A figure: "79 ms / Overnight Avg", or "--" without a value. */
export interface HrvFigure {
	value: string;
	unit?: "ms";
	label: string;
}

function figure(value: number | undefined, label: string): HrvFigure {
	return value !== undefined ? { value: String(value), unit: "ms", label } : { value: DASH, label };
}

/** The Nightly Timeline. */
export interface HrvTimeline {
	/** `pending` while the night loads; `empty` without a reading (every night before 2026-06-01, or one without an overnight value); `drawn` otherwise. */
	state: "pending" | "empty" | "drawn";
	/** The readings across the sleep window, x 0 at sleep start and 1 at wake, joined straight; across a gap too (Inferred). */
	points: Array<{ x: number; value: number }>;
	/** Gridlines every 20 ms, top first: 120 100 80 60 40 for 53–105. */
	ticks: number[];
	/** Every whole hour of the watch's clock inside the window, as x: a grey dot each. Oct 11's 00:00 sits under the sleep disc. */
	hours: number[];
	/** Under the two discs: sleep start and wake, seconds dropped ("11:58 PM", "6:31 AM"). None without a window. */
	start?: string;
	end?: string;
}

/** Without a reading: the one night seen's gridlines (Inferred). */
const DEFAULT_TICKS = [120, 100, 80, 60, 40];
const HOUR_MS = 3_600_000;

/** Gridlines every 20 ms from floor(min / 20)·20 to ceil(max / 20)·20, top first: 53–105 → 120…40. One night seen. */
export function timelineTicks(min: number, max: number): number[] {
	const lo = Math.floor(min / 20) * 20;
	const hi = Math.max(lo + 20, Math.ceil(max / 20) * 20);
	const ticks: number[] = [];
	for (let v = hi; v >= lo; v -= 20) ticks.push(v);
	return ticks;
}

/** A moment on the watch's clock (epoch ms shifted by its offset) as "11:58 PM": the minute it is in. */
export function clockLabel(local: number): string {
	const date = new Date(local);
	const hour = date.getUTCHours();
	return `${hour % 12 || 12}:${String(date.getUTCMinutes()).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** The night's readings as `[epoch ms, value]`, oldest first. */
function readingsIn(night: HrvNight): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	if (night.start === undefined) return out;
	night.values.forEach((v, i) => {
		if (v !== null) out.push([night.start! + i * night.step, v]);
	});
	return out;
}

/** The night's timeline: `night` undefined while it loads, null once Garmin had none. */
export function nightTimeline(night: HrvNight | null | undefined): HrvTimeline {
	if (night === undefined) return { state: "pending", points: [], ticks: DEFAULT_TICKS, hours: [] };
	const readings = night ? readingsIn(night) : [];
	// The window is the sleep; a night sent without one runs from its first reading to its last (Inferred).
	const start = night?.sleepStart ?? readings[0]?.[0];
	const end = night?.sleepEnd ?? readings[readings.length - 1]?.[0];
	if (!readings.length || start === undefined || end === undefined || end <= start) return { state: "empty", points: [], ticks: DEFAULT_TICKS, hours: [] };
	const offset = night?.offset ?? 0;
	const length = end - start;
	const values = readings.map(([, v]) => v);
	const hours: number[] = [];
	for (let h = Math.ceil((start + offset) / HOUR_MS) * HOUR_MS; h < end + offset; h += HOUR_MS) {
		if (h > start + offset) hours.push((h - offset - start) / length);
	}
	return {
		state: "drawn",
		points: readings.map(([t, value]) => ({ x: (t - start) / length, value })),
		ticks: timelineTicks(Math.min(...values), Math.max(...values)),
		hours,
		start: clockLabel(start + offset),
		end: clockLabel(end + offset),
	};
}

export interface HrvDayView {
	range: "1d";
	date: string;
	/** "Today", "Saturday, October 10". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** Null without a row for the night: the empty state, or the night still loading. */
	dial: HrvDial | null;
	/** "Balanced" in its colour; none while onboarding. */
	status?: HrvStatusLook;
	copy?: string;
	/** Overnight Avg, Highest 5-min Avg; none with the empty state. */
	figures: HrvFigure[];
	title: string;
	/** Null with the empty state. */
	timeline: HrvTimeline | null;
	/** "No HRV status data" / "You have no data for this time period.": a night without a row (today before it syncs, 2026-09-12). */
	empty?: typeof NO_DATA;
}

/** 1d: the night that ended on the route's day. The index's row first, else the night's own summary. */
export function hrvDayView(route: Pick<HrvStatusRoute, "offset">, rows: readonly HrvStatusRow[], ctx: HrvStatusContext): HrvDayView {
	const date = dayOf(route, ctx.today);
	const row = rows.find((r) => r.date === date) ?? rowOfNight(ctx.night, date);
	const view: HrvDayView = {
		range: "1d",
		date,
		label: dayLabel(date, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, date),
		canGoForward: date < ctx.today,
		dial: null,
		figures: [],
		title: NIGHTLY_TIMELINE,
		timeline: null,
	};
	if (!row) {
		// The index has no row: Garmin's empty state once the night says so too.
		if (ctx.night === undefined) view.timeline = nightTimeline(undefined);
		else view.empty = NO_DATA;
		return view;
	}
	view.dial = hrvDial(row);
	const look = statusLook(row.status);
	if (look) view.status = look;
	const copy = hrvCopy(row.feedback, row.status);
	if (copy) view.copy = copy;
	view.figures = [figure(row.night, "Overnight Avg"), figure(row.high, "Highest 5-min Avg")];
	view.timeline = nightTimeline(ctx.night);
	return view;
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

/** A night's 7-day average on the chart. */
export interface HrvPoint {
	date: string;
	/** The night's day centre: 0 on the span's first day, 1 on its last. */
	x: number;
	value: number;
	/** Its status's colour and shape: a green circle, an orange square, a red triangle. */
	look: HrvStatusLook;
}

export interface HrvBandPoint {
	x: number;
	/** balancedLow and balancedUpper, ms. */
	low: number;
	high: number;
}

export interface HrvLegendItem {
	kind: "status" | "baseline" | "overnight";
	label: string;
	look?: HrvStatusLook;
}

/** The 7-day Averages chart. */
export interface HrvAverages {
	/** The y range, ms: [64.75, 98.5] on 7d, [58, 99.5] on 4w. */
	low: number;
	high: number;
	/** Four gridlines evenly from top to bottom, top first, each labelled with its floor: "98 87 76 64". */
	ticks: Array<{ value: number; label: string }>;
	/** A dot a night with a 7-day average and a status (onboarding has neither). */
	points: HrvPoint[];
	/** The baseline band, balancedLow..balancedUpper, joined straight between day centres: runs of nights; a night without a row is bridged (Inferred), one without a baseline breaks it. */
	band: HrvBandPoint[][];
	/** With the chip on, a point a day, null where the night has no overnight value (Sep 17) or no row: the dashed line breaks there. Null with the chip off. */
	overnight: Array<{ x: number; value: number | null }> | null;
	axis: PeriodAxis;
	/** The statuses present, in the order Balanced, Unbalanced, Low; Baseline; Overnight Avg with the chip on. */
	legend: HrvLegendItem[];
}

/** A tick's label: the floor, never rounded (64.75 is "64"). */
export function tickLabel(value: number): string {
	return String(Math.floor(value + 1e-9));
}

/**
 * The y range of a span's chart, ms.
 *
 * - Top: the highest balancedUpper + Δ/2 over the span's nights (98.5 on
 *   Oct 5 – 11, 99.5 on Sep 14 – Oct 11, both pixel-proven).
 * - Bottom: the lowest of the span's 7-day and overnight averages, the
 *   overnight ones counted even with the chip off (4w's 58 is Sep 25's
 *   overnight), and of lowUpper − Δ/4 over its nights (7d's 64.75; this part
 *   is Inferred, the only rule found that fits both shots).
 * - A value past either end widens it, so nothing is clipped.
 */
export function averagesRange(rows: readonly HrvStatusRow[], values: readonly number[]): { low: number; high: number } | null {
	const highs = [...values];
	const lows = [...values];
	for (const row of rows) {
		const delta = deltaOf(row);
		if (delta === undefined) continue;
		highs.push(row.balHigh! + delta / 2);
		if (row.lowUpper !== undefined) lows.push(row.lowUpper - delta / 4);
	}
	if (!highs.length || !lows.length) return null;
	const low = Math.min(...lows);
	const high = Math.max(...highs);
	// A lone value with no baseline (Inferred): a band of 10 ms round it.
	return high - low >= 1 ? { low, high } : { low: low - 5, high: high + 5 };
}

/** Four ticks evenly from `high` down to `low`, its ends exact. */
export function averagesTicks(low: number, high: number): Array<{ value: number; label: string }> {
	const step = (high - low) / 3;
	return [high, low + 2 * step, low + step, low].map((value) => ({ value, label: tickLabel(value) }));
}

/** A span's 7-day Averages chart; null when no night in it has anything to draw. */
export function hrvAverages(rows: readonly HrvStatusRow[], span: Span, overnight: boolean): HrvAverages | null {
	const days = daysOf(span);
	const last = Math.max(1, days.length - 1);
	const inSpan = rows.filter((r) => r.date >= span.from && r.date <= span.to);
	const byDate = new Map(inSpan.map((r) => [r.date, r]));
	const xOf = (date: string) => daysBetween(span.from, date) / last;

	const points: HrvPoint[] = [];
	const band: HrvBandPoint[][] = [];
	let run: HrvBandPoint[] | null = null;
	for (const date of days) {
		const row = byDate.get(date);
		if (!row) continue;
		const look = statusLook(row.status);
		if (row.weekly !== undefined && look) points.push({ date, x: xOf(date), value: row.weekly, look });
		if (deltaOf(row) !== undefined) {
			if (!run) band.push((run = []));
			run.push({ x: xOf(date), low: row.balLow!, high: row.balHigh! });
		} else run = null;
	}
	const nights = days.map((date) => ({ x: xOf(date), value: byDate.get(date)?.night ?? null }));
	const values = [...points.map((p) => p.value), ...nights.flatMap((n) => (n.value === null ? [] : [n.value]))];
	const range = averagesRange(inSpan, values);
	if (!range) return null;

	const legend: HrvLegendItem[] = HRV_STATUSES.filter((s) => points.some((p) => p.look.status === s.status)).map((look) => ({ kind: "status", label: look.word, look }));
	if (band.length) legend.push({ kind: "baseline", label: "Baseline" });
	if (overnight) legend.push({ kind: "overnight", label: "Overnight Avg" });
	return {
		...range,
		ticks: averagesTicks(range.low, range.high),
		points,
		band,
		overnight: overnight ? nights : null,
		axis: dayAxis(days),
		legend,
	};
}

/** A night's card. */
export interface HrvDayCard {
	date: string;
	/** "Sunday". */
	weekday: string;
	/** "Oct 11"; with its year in another year. */
	detail: string;
	/** The status's dot. */
	look?: HrvStatusLook;
	/** "84 ms / 7d Avg" and "79 ms / Overnight Avg". */
	weekly: HrvFigure;
	night: HrvFigure;
}

export interface HrvPeriodView {
	range: "7d" | "4w";
	from: string;
	to: string;
	/** "Oct 5 - 11". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	title: string;
	/** Null for a span without a row: the empty state shows in its place. */
	chart: HrvAverages | null;
	/** "Overnight Averages", off by default; the route's `sub` turns it on. */
	chip: { label: string; on: boolean };
	/** A card a night with a row, newest first; a tap opens the night's 1d (Inferred). */
	days: HrvDayCard[];
	empty?: typeof NO_DATA;
}

const HRV_STAT = PERFORMANCE_REGISTRY.page("hrv-status")!;

/** 7d and 4w. */
export function hrvPeriodView(route: HrvStatusRoute, rows: readonly HrvStatusRow[], ctx: HrvStatusContext): HrvPeriodView {
	const range: HrvPeriodView["range"] = route.range === "4w" ? "4w" : "7d";
	const at = { range, offset: route.offset };
	const span = statSpan(HRV_STAT, at, ctx.today)!;
	const on = route.sub === OVERNIGHT;
	const chart = hrvAverages(rows, span, on);
	const view: HrvPeriodView = {
		range,
		from: span.from,
		to: span.to,
		label: statPeriodLabel(HRV_STAT, at, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, span.from),
		canGoForward: route.offset < 0,
		title: SEVEN_DAY_AVERAGES,
		chart,
		chip: { label: CHIP_LABEL, on },
		days: rows
			.filter((r) => r.date >= span.from && r.date <= span.to)
			.reverse()
			.map((row) => {
				const card: HrvDayCard = {
					date: row.date,
					weekday: weekdayOf(row.date),
					detail: readingDate(row.date, ctx.today),
					weekly: figure(row.weekly, "7d Avg"),
					night: figure(row.night, "Overnight Avg"),
				};
				const look = statusLook(row.status);
				if (look) card.look = look;
				return card;
			}),
	};
	if (!chart) view.empty = NO_DATA;
	return view;
}

export type HrvStatusView = HrvDayView | HrvPeriodView;

/** The page, on its route's range. */
export function hrvStatusView(route: HrvStatusRoute, rows: readonly HrvStatusRow[], ctx: HrvStatusContext): HrvStatusView {
	return route.range === "1d" ? hrvDayView(route, rows, ctx) : hrvPeriodView(route, rows, ctx);
}

/** The route with the chip turned on or off, keeping the rest. */
export function withOvernight<R extends { sub?: string }>(route: R, on: boolean): R {
	const { sub: _sub, ...rest } = route;
	return (on ? { ...rest, sub: OVERNIGHT } : rest) as R;
}
