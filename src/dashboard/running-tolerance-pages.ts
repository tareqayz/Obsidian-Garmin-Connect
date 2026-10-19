import type { RunningToleranceRow, RunningToleranceWeekRow } from "../sync/running-tolerance-index";
import { readingDate, shortDate } from "./day";
import { tolerancePhrase } from "./running-tolerance-copy";
import { SHORT_MONTHS, axisDay, canStepBack, dayLabel, periodLabel, spread, weekStartOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { shiftDate } from "./series";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { NO_READING } from "./vo2-max-pages";

/**
 * Garmin Connect's Running Tolerance page (Performance Stats), worked out from
 * its two indexes (`src/sync/running-tolerance-index.ts`): the daily rows for
 * Current, Garmin's weekly rows as sent for 12w and 1y. Rules measured on the
 * phone, the web and the API on 2026-10-11/12
 * (ref/performance-stats/running-tolerance/README.md):
 *
 * - Current is today's daily row, "Today", with no day stepper: the ring is
 *   the acute impact load's share of the weekly tolerance in raw metres
 *   (28158 / 37070 → 273.45°, measured 273.6°; the rounded 28.2 / 37 would
 *   give 274.38°), "28.2 km" over "37 km/w" in it, the phrase's title and
 *   copy under it, then three figures: Acute Impact Load, Weekly Tolerance
 *   and Actual 7d Distance.
 * - 12w and 1y are the registry's Sunday weeks (`{ weeks, weekStart: 0 }`):
 *   the week holding today, so far, and the 11 or 51 before. A slot per week,
 *   evenly spaced by index, the current partial week a whole slot; a weekly
 *   row goes to its Sunday's slot.
 * - A bar per week of `totalImpactLoad`, unrounded, none for a 0 week;
 *   orange when the load is at or over the tolerance, else blue. The
 *   tolerance line runs at whole units (12w's weeks 2–3 sit level at 36 for
 *   35.75 and 36.05): a step line on 12w, its risers half way between
 *   slots, and a polyline on 1y that runs on across 0 km weeks.
 * - The y axis has five gridlines from 0 to 4 × ceil(max / 4), max the
 *   largest load, tolerance (raw) or distance of the span: 44, 104, 48, 100.
 *   The chip does not move it.
 * - The x axis: 12w a dot under every slot, the ends large and labelled
 *   with their rows' last day ("08-01", "10-11"); 1y a large dot and the
 *   month's name on end under each week holding a month's 1st.
 * - The "Actual Distance" chip (the route's `sub`): bars grey, a line of
 *   `totalDistance` over them that breaks at 0 km weeks, with dots on 12w
 *   only, and the legend on one row.
 * - The list: a block per week of the span, newest first: "TODAY" for a
 *   current week of today alone, else its days ("OCT 4 - 10") from Garmin's
 *   `startOfWeek` and `endOfWeek`; Tolerance, Impact Load, Actual Distance.
 * - Numbers: tenths rounded half up on the metres with a trailing ".0"
 *   dropped ("10 km" for 10009 m, "21.5" for 21450 m where `toFixed` says
 *   21.4); the tolerance in whole units ("37 km", "37 km/w").
 *
 * Inferred (unseen on the phone): today without a row yet (the newest row
 * of the last 7 days under its day, as Home's card); no row at all (the
 * no-data line on Current; empty slots, an axis of 0–4 and no list on a
 * range); the legend without "At/Above Tolerance" when no week reaches the
 * line (the web leaves it out); a weekday's current week ("OCT 11 - 12",
 * the right label "10-12"); earlier years' headers in the web's spacing
 * ("OCT 12-18, 2025", "SEP 28 - OCT 4, 2025"); an empty slot's axis label
 * (its last day; none for a span without a row) and the lines breaking
 * across it; the phrases' words but MEDIUM_LOAD's; the chip turning off on
 * a range switch; imperial units (miles, the same rounding: "17.5 mi",
 * "23 mi/w").
 *
 * The view places every mark as a fraction of the plot (`x`, 0 at the first
 * slot's centre, 1 at the last's) and a value in the axis' units; the
 * charts' geometry is `running-tolerance-charts.ts`, off the Obsidian twin
 * (Figma page 430:6124).
 *
 * Pure.
 */

/** What the page's route says: the range, how many periods back, and the chip (`sub`). */
export interface RunningToleranceRoute {
	range: PeriodRange;
	offset: number;
	/** "distance" while the Actual Distance chip is on. */
	sub?: string;
}

/** The two indexes, as `readIndex` gives them, oldest first. */
export interface RunningToleranceData {
	/** `readIndex("running-tolerance")`: Current's daily rows. */
	days: readonly RunningToleranceRow[];
	/** `readIndex("running-tolerance-weeks")`: Garmin's weekly rows, keyed by their Sunday. */
	weeks: readonly RunningToleranceWeekRow[];
}

/** The settings' units: Garmin sends metres either way. */
export type ToleranceUnits = "metric" | "imperial";

/** What the view needs besides the route and the rows. */
export interface RunningToleranceContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The weekly index's meta says it holds the whole history: "<" stops at its oldest week. */
	complete: boolean;
	/** Metric unless the settings say imperial (Inferred: miles). */
	units?: ToleranceUnits;
}

/** Metres in the unit the page counts in. */
export const METRES_PER: Readonly<Record<ToleranceUnits, number>> = { metric: 1000, imperial: 1609.344 };

const UNIT: Readonly<Record<ToleranceUnits, string>> = { metric: "km", imperial: "mi" };

/** A figure Garmin has nothing for. */
export const DASH = "--";

/** Days back from today Current still shows a row from when today has none yet: Home's card's rule (`latestWith(…, 7)`). */
export const CURRENT_MAX_AGE = 7;

const STAT = PERFORMANCE_REGISTRY.page("running-tolerance")!;

/* ------------------------------------------------------------------ */
/*  Numbers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Tenths of the unit, rounded half up on the metres, a trailing ".0"
 * dropped: 28158 m → "28.2", 10009 m → "10", 21450 m → "21.5" (the web's;
 * `toFixed(1)` on 21.45 gives "21.4").
 */
export function tenthsText(metres: number, units: ToleranceUnits = "metric"): string {
	return String(Math.round(metres / (METRES_PER[units] / 10)) / 10);
}

/** Whole units, rounded half up: the tolerance, 37070 m → "37". */
export function wholeText(metres: number, units: ToleranceUnits = "metric"): string {
	return String(Math.round(metres / METRES_PER[units]));
}

/* ------------------------------------------------------------------ */
/*  The chip                                                           */
/* ------------------------------------------------------------------ */

/** The chip's id, and the route's `sub` while it is on. */
export const DISTANCE_CHIP = "distance";

/** The one chip under the chart, off by default: `StatChips`' `chips`. */
export const TOLERANCE_CHIPS: ReadonlyArray<{ id: string; label: string }> = [{ id: DISTANCE_CHIP, label: "Actual Distance" }];

/** Whether a route's `sub` has the Actual Distance chip on. */
export function distanceOn(sub: string | undefined): boolean {
	return sub === DISTANCE_CHIP;
}

/** The page with the chip on or off, as `StatChips` reports a tap: `swap(withDistance(route, selected.includes(DISTANCE_CHIP)))`. */
export function withDistance<R extends { sub?: string }>(route: R, on: boolean): R {
	const next = { ...route };
	if (on) next.sub = DISTANCE_CHIP;
	else delete next.sub;
	return next;
}

/**
 * Where the shell's range control and steppers move the page: a period step
 * keeps the chip, a range switch turns it off (the spec's guess, Inferred 7:
 * the 1y shot after a 12w one with the chip on shows it off). The shell
 * keeps `sub` itself, so the page drops it as it moves (Training Status's way).
 */
export function movedRoute<R extends { range: string; sub?: string }>(from: { range: string }, next: R): R {
	return next.range !== from.range ? withDistance(next, false) : next;
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

/** The ring: the acute impact load against the weekly tolerance. */
export interface ToleranceRing {
	/** The load's share of the tolerance, in raw metres: 28158 / 37070 = 0.7596. Over 1 above the tolerance. */
	share: number;
	/** The arc's share, clamped to 0..1: `StatDial`'s `progress`. */
	progress: number;
	/** Where the arc ends, degrees clockwise from 12 o'clock: 273.45°. */
	angle: number;
	/** "28.2 km". */
	value: string;
	/** "37 km/w". */
	label: string;
}

/** A figure under the copy: the number and its unit apart, as the phone sets the unit smaller. */
export interface ToleranceFigure {
	/** "28.2", or "--". */
	value: string;
	/** "km"; none with "--". */
	unit?: string;
	label: string;
}

export interface ToleranceCurrentView {
	range: "1d";
	/** "Today"; the row's day when today has none yet ("Saturday, October 10"). */
	label: string;
	/** Current never steps. */
	canGoBack: false;
	canGoForward: false;
	/** The row's day; none without a row. */
	date?: string;
	/** Null without a row, or one without a load and a tolerance. */
	ring: ToleranceRing | null;
	/** Garmin's phrase key, and its title and copy where they are known. */
	phrase?: string;
	title?: string;
	copy?: string;
	/** Acute Impact Load, Weekly Tolerance, Actual 7d Distance; empty without a row. */
	figures: ToleranceFigure[];
	/** The line in place of the ring without a row. */
	empty?: string;
}

/** The row Current shows: today's, else the newest of the last `CURRENT_MAX_AGE` days (Inferred). */
export function currentRow(rows: readonly RunningToleranceRow[], today: string): RunningToleranceRow | undefined {
	const oldest = shiftDate(today, -CURRENT_MAX_AGE);
	let best: RunningToleranceRow | undefined;
	for (const row of rows) if (row.date <= today && row.date >= oldest && (!best || row.date > best.date)) best = row;
	return best;
}

/** The ring for a day's row; null without a load and a positive tolerance. */
export function toleranceRing(row: Pick<RunningToleranceRow, "load" | "tolerance">, units: ToleranceUnits = "metric"): ToleranceRing | null {
	if (row.load === undefined || row.tolerance === undefined || row.tolerance <= 0) return null;
	const share = row.load / row.tolerance;
	const progress = Math.min(1, Math.max(0, share));
	return { share, progress, angle: progress * 360, value: `${tenthsText(row.load, units)} ${UNIT[units]}`, label: `${wholeText(row.tolerance, units)} ${UNIT[units]}/w` };
}

function figure(metres: number | undefined, text: (m: number) => string, unit: string, label: string): ToleranceFigure {
	return metres === undefined ? { value: DASH, label } : { value: text(metres), unit, label };
}

function currentView(rows: readonly RunningToleranceRow[], ctx: RunningToleranceContext): ToleranceCurrentView {
	const units = ctx.units ?? "metric";
	const row = currentRow(rows, ctx.today);
	const view: ToleranceCurrentView = { range: "1d", label: dayLabel(row?.date ?? ctx.today, ctx.today), canGoBack: false, canGoForward: false, ring: null, figures: [] };
	if (!row) {
		view.empty = NO_READING;
		return view;
	}
	view.date = row.date;
	view.ring = toleranceRing(row, units);
	if (row.phrase !== undefined) {
		view.phrase = row.phrase;
		const words = tolerancePhrase(row.phrase);
		if (words) {
			view.title = words.title;
			view.copy = words.copy;
		}
	}
	const unit = UNIT[units];
	view.figures = [
		figure(row.load, (m) => tenthsText(m, units), unit, "Acute Impact Load"),
		figure(row.tolerance, (m) => wholeText(m, units), unit, "Weekly Tolerance"),
		figure(row.distance, (m) => tenthsText(m, units), unit, "Actual 7d Distance"),
	];
	return view;
}

/* ------------------------------------------------------------------ */
/*  12w and 1y                                                         */
/* ------------------------------------------------------------------ */

/** A week of the span: its Sunday, its place across the plot and Garmin's row for it. */
export interface ToleranceSlot {
	/** The week's Sunday. */
	week: string;
	/** Across the plot: 0 at the first slot's centre, 1 at the last's. */
	x: number;
	/** Garmin's row as sent; none for a week the index has no row for. */
	row?: RunningToleranceWeekRow;
}

/** A bar's colour: blue, orange at or over the tolerance, grey with the chip on. */
export type ToleranceTone = "load" | "above" | "muted";

export interface ToleranceBar {
	week: string;
	x: number;
	/** The week's impact load in the page's unit, unrounded: 40.53. */
	value: number;
	tone: ToleranceTone;
}

export interface TolerancePoint {
	x: number;
	value: number;
}

/** The tolerance line in whole units: runs of points, a gap between runs where a slot has no row. */
export interface ToleranceLine {
	/** 12w steps, its risers half way between slots, clipped to the end slots' centres; 1y joins the slots' centres. */
	shape: "step" | "line";
	runs: TolerancePoint[][];
}

/** The Actual Distance line, with the chip on: a point per slot, null where it breaks (no row, or 0 km). */
export interface ToleranceDistanceLine {
	points: Array<{ x: number; value: number | null }>;
	/** A dot on every point: 12w's; 1y draws the line alone. */
	dots: boolean;
}

export interface ToleranceChart {
	/** The gridlines' values, top first: 44, 33, 22, 11, 0. */
	ticks: number[];
	labels: string[];
	axis: PeriodAxis;
	slots: ToleranceSlot[];
	bars: ToleranceBar[];
	tolerance: ToleranceLine;
	/** Null with the chip off. */
	distance: ToleranceDistanceLine | null;
}

export type ToleranceLegendId = "tolerance" | "load" | "above" | "distance";

/** A legend item: a 12 × 2 line swatch, a Ø 12 dot, or (12w's Actual Distance) a line through a dot. */
export interface ToleranceLegendItem {
	id: ToleranceLegendId;
	label: string;
	mark: "line" | "dot" | "line-dot";
	/** The tolerance line's, a bar's (`ToleranceTone`), or the distance line's colour. */
	tone: "tolerance" | ToleranceTone | "distance";
}

/** A week's block of the list. */
export interface ToleranceWeekBlock {
	/** The week's Sunday. */
	week: string;
	/** "TODAY", "OCT 4 - 10", "SEP 27 - OCT 3". */
	title: string;
	/** Tolerance, Impact Load, Actual Distance: "37 km", "14.2 km", "12.5 km". */
	rows: Array<{ label: string; value: string }>;
}

export interface TolerancePeriodView {
	range: "12w" | "1y";
	span: Span;
	/** "Jul 26 - Oct 11", "Oct 19, 2025 - Oct 11, 2026". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The Actual Distance chip is on. */
	chip: boolean;
	chart: ToleranceChart;
	/** Centred rows: chip off "Tolerance · Impact Load", then "At/Above Tolerance" when a week reaches the line; chip on one row. */
	legend: ToleranceLegendItem[][];
	/** A block per row of the span, newest first. */
	weeks: ToleranceWeekBlock[];
}

export type RunningToleranceView = ToleranceCurrentView | TolerancePeriodView;

/** At or over the line: `totalImpactLoad >= tolerance`, in raw metres. */
export function isAbove(row: Pick<RunningToleranceWeekRow, "load" | "tolerance"> | undefined): boolean {
	return row?.load !== undefined && row.tolerance !== undefined && row.load > 0 && row.load >= row.tolerance;
}

/** The span's Sunday weeks, oldest first, each with its row. */
export function toleranceSlots(span: Span, rows: readonly RunningToleranceWeekRow[]): ToleranceSlot[] {
	const byWeek = new Map(rows.map((r) => [weekStartOf(r.date, 0), r]));
	const weeks: string[] = [];
	for (let week = weekStartOf(span.from, 0); week <= span.to; week = shiftDate(week, 7)) weeks.push(week);
	return weeks.map((week, k) => {
		const slot: ToleranceSlot = { week, x: spread(k, weeks.length) };
		const row = byWeek.get(week);
		if (row) slot.row = row;
		return slot;
	});
}

/**
 * The y axis, top first: 0, s, 2s, 3s, 4s with s = ceil(max / 4), at least
 * 1. 40.53 → 44; 102.103 → 104; 47.735 → 48; 99.691 → 100; nothing → 4.
 * A max already a multiple of 4 gets no headroom.
 */
export function toleranceTicks(values: readonly number[]): number[] {
	const max = values.length ? Math.max(...values) : 0;
	const step = Math.max(1, Math.ceil(max / 4));
	return [4, 3, 2, 1, 0].map((k) => k * step);
}

/** A slot's last day on the chart: its row's `endOfWeek`, else its Saturday, or the span's end for the current week. */
function lastDayOf(slot: ToleranceSlot, span: Span): string {
	if (slot.row?.to) return slot.row.to;
	const saturday = shiftDate(slot.week, 6);
	return saturday < span.to ? saturday : span.to;
}

/**
 * 12w's axis: a dot under every slot, the two ends large and labelled with
 * their weeks' last days, "MM-DD" ("08-01", "10-11"); a span without a row
 * leaves the ends blank (Inferred, twin 697:1580).
 */
function weeksAxis(slots: readonly ToleranceSlot[], span: Span): PeriodAxis {
	const n = slots.length;
	return {
		dots: slots.map((s, k) => ({ x: s.x, large: k === 0 || k === n - 1 })),
		labels: slots.some((s) => s.row) ? [
			{ x: slots[0].x, text: axisDay(lastDayOf(slots[0], span)) },
			{ x: slots[n - 1].x, text: axisDay(lastDayOf(slots[n - 1], span)) },
		] : [],
	};
}

/** 1y's axis: a large dot and the month's name on end under each week holding a month's 1st (inside the span). */
function monthsAxis(slots: readonly ToleranceSlot[], span: Span): PeriodAxis {
	const axis: PeriodAxis = { dots: [], labels: [] };
	for (const slot of slots) {
		const last = lastDayOf({ week: slot.week, x: slot.x }, span);
		for (let day = slot.week; day <= last; day = shiftDate(day, 1)) {
			if (day.slice(8, 10) !== "01") continue;
			axis.dots.push({ x: slot.x, large: true });
			axis.labels.push({ x: slot.x, text: SHORT_MONTHS[Number(day.slice(5, 7)) - 1], rotated: true });
			break;
		}
	}
	return axis;
}

/**
 * 12w's step line: each week holds its level from the midpoint before its
 * slot to the midpoint after, so the risers sit half way between slots
 * (55.5 + 30k on the phone), clipped to the first and last slots' centres.
 */
function stepRuns(levels: ReadonlyArray<number | undefined>): TolerancePoint[][] {
	const n = levels.length;
	const edge = (k: number) => Math.min(1, Math.max(0, n > 1 ? (k - 0.5) / (n - 1) : k));
	return runsOf(levels, (k, value) => [
		{ x: edge(k), value },
		{ x: edge(k + 1), value },
	]);
}

/** 1y's polyline through the slots' centres; it breaks only where a slot has no row. */
function lineRuns(slots: readonly ToleranceSlot[], levels: ReadonlyArray<number | undefined>): TolerancePoint[][] {
	return runsOf(levels, (k, value) => [{ x: slots[k].x, value }]);
}

/** Runs of consecutive slots with a level, each slot's points from `pointsOf`. */
function runsOf(levels: ReadonlyArray<number | undefined>, pointsOf: (k: number, value: number) => TolerancePoint[]): TolerancePoint[][] {
	const runs: TolerancePoint[][] = [];
	let run: TolerancePoint[] | undefined;
	for (let k = 0; k < levels.length; k++) {
		const value = levels[k];
		if (value === undefined) {
			run = undefined;
			continue;
		}
		if (!run) {
			run = [];
			runs.push(run);
		}
		run.push(...pointsOf(k, value));
	}
	return runs;
}

function legendOf(range: "12w" | "1y", chip: boolean, above: boolean): ToleranceLegendItem[][] {
	const tolerance: ToleranceLegendItem = { id: "tolerance", label: "Tolerance", mark: "line", tone: "tolerance" };
	if (chip) {
		return [[tolerance, { id: "load", label: "Impact Load", mark: "dot", tone: "muted" }, { id: "distance", label: "Actual Distance", mark: range === "12w" ? "line-dot" : "line", tone: "distance" }]];
	}
	const rows: ToleranceLegendItem[][] = [[tolerance, { id: "load", label: "Impact Load", mark: "dot", tone: "load" }]];
	if (above) rows.push([{ id: "above", label: "At/Above Tolerance", mark: "dot", tone: "above" }]);
	return rows;
}

/**
 * A week block's header: "TODAY" for a current week of today alone; this
 * year's weeks as the period row words them, upper case ("OCT 4 - 10", "SEP
 * 27 - OCT 3", a weekday's "OCT 11 - 12"); an earlier year's in the web's
 * spacing ("OCT 12-18, 2025", "SEP 28 - OCT 4, 2025"); a week across New
 * Year with both years ("DEC 28, 2025 - JAN 3, 2026"); a one-day week its
 * day ("OCT 11"). Garmin's own days, so a week without its Saturday's row
 * reads "OCT 5-10, 2025".
 */
export function weekHeader(from: string, to: string, today: string): string {
	if (from === to) return from === today ? "TODAY" : readingDate(from, today).toUpperCase();
	const year = to.slice(0, 4);
	if (from.slice(0, 4) !== year || year === today.slice(0, 4)) return periodLabel(from, to, today).toUpperCase();
	const end = from.slice(0, 7) === to.slice(0, 7) ? `-${Number(to.slice(8, 10))}` : ` - ${shortDate(to)}`;
	return `${shortDate(from)}${end}, ${year}`.toUpperCase();
}

function blockOf(slot: ToleranceSlot & { row: RunningToleranceWeekRow }, span: Span, units: ToleranceUnits, today: string): ToleranceWeekBlock {
	const { row } = slot;
	const unit = UNIT[units];
	const text = (metres: number | undefined, f: (m: number, u: ToleranceUnits) => string) => (metres === undefined ? DASH : `${f(metres, units)} ${unit}`);
	return {
		week: slot.week,
		title: weekHeader(row.from ?? slot.week, lastDayOf(slot, span), today),
		rows: [
			{ label: "Tolerance", value: text(row.tolerance, wholeText) },
			{ label: "Impact Load", value: text(row.load, tenthsText) },
			{ label: "Actual Distance", value: text(row.distance, tenthsText) },
		],
	};
}

function periodView(range: "12w" | "1y", offset: number, chip: boolean, rows: readonly RunningToleranceWeekRow[], ctx: RunningToleranceContext): TolerancePeriodView {
	const units = ctx.units ?? "metric";
	const per = METRES_PER[units];
	const route = { range, offset };
	const span = statSpan(STAT, route, ctx.today)!;
	const slots = toleranceSlots(span, rows);
	const held = slots.filter((s): s is ToleranceSlot & { row: RunningToleranceWeekRow } => s.row !== undefined);

	const values = held.flatMap(({ row }) => [row.load, row.tolerance, row.distance].flatMap((m) => (m === undefined ? [] : [m / per])));
	const ticks = toleranceTicks(values);
	const levels = slots.map((s) => (s.row?.tolerance === undefined ? undefined : Math.round(s.row.tolerance / per)));
	const bars: ToleranceBar[] = held
		.filter(({ row }) => row.load !== undefined && row.load > 0)
		.map(({ week, x, row }) => ({ week, x, value: row.load! / per, tone: chip ? "muted" : isAbove(row) ? "above" : "load" }));
	const distance: ToleranceDistanceLine | null = chip
		? {
				points: slots.map((s) => ({ x: s.x, value: s.row?.distance !== undefined && s.row.distance > 0 ? s.row.distance / per : null })),
				dots: range === "12w",
			}
		: null;
	const oldest = rows.reduce<string | undefined>((min, r) => (min === undefined || r.date < min ? r.date : min), undefined);

	return {
		range,
		span,
		label: statPeriodLabel(STAT, route, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		canGoForward: offset < 0,
		chip,
		chart: {
			ticks,
			labels: ticks.map(String),
			axis: range === "12w" ? weeksAxis(slots, span) : monthsAxis(slots, span),
			slots,
			bars,
			tolerance: range === "12w" ? { shape: "step", runs: stepRuns(levels) } : { shape: "line", runs: lineRuns(slots, levels) },
			distance,
		},
		legend: legendOf(range, chip, held.some(({ row }) => isAbove(row))),
		weeks: held.map((slot) => blockOf(slot, span, units, ctx.today)).reverse(),
	};
}

/** The page on its route's range: Current, 12w or 1y. */
export function runningToleranceView(route: RunningToleranceRoute, data: RunningToleranceData, ctx: RunningToleranceContext): RunningToleranceView {
	if (route.range === "1d") return currentView(data.days, ctx);
	return periodView(route.range === "1y" ? "1y" : "12w", route.offset, distanceOn(route.sub), data.weeks, ctx);
}
