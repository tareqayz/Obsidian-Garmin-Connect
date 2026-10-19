import type { CriticalSwimSpeedRow } from "../sync/critical-swim-speed-index";
import {
	CSS_TITLE,
	CURRENT_COPY,
	CURRENT_COPY_LINES,
	DAILY_RESULTS,
	DASH,
	EMPTY_RESULT,
	NO_CSS_DATA,
	PACE_LABEL,
	PACE_UNIT,
	RESULTS_HEADER,
	RESULTS_TITLE,
	WEEKLY_RESULTS,
} from "./critical-swim-speed-copy";
import { shortDate } from "./day";
import { BLOCK_DAYS, ftpXAxis } from "./ftp-pages";
import { canStepBack, dayAxis, dayLabel, daysBetween, daysOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { ltYAxis } from "./running-lactate-threshold-pages";
import { duration, shiftDate } from "./series";
import { statPeriodLabel, statSpan } from "./stat-registry";

/**
 * Garmin Connect's Critical Swim Speed page (Performance Stats), worked out
 * from the CSS index (`src/sync/critical-swim-speed-index.ts`). The account
 * the spec was captured from has never had a result, so the empty pages are
 * 1:1 with the phone (2026-10-11) and everything a result draws is Inferred
 * (ref/performance-stats/critical-swim-speed/README.md):
 *
 * - Current: "Critical Swim Speed", a date line, the pace over "Pace
 *   (min/100m)", and the copy. Empty: "--" and "--". With a result (Inferred):
 *   the newest row on or before today, however old — its day as `dayLabel`
 *   words it ("Thursday, October 8") and its pace, 100 ÷ speed seconds per
 *   100 m rounded half up to the second, "m:ss" (1.0256 m/s → 97.5 s →
 *   "1:38"). No period row.
 * - 7d "Daily Results", 12w and 1y "Weekly Results": the chart's frame is
 *   always drawn — five gridlines, the y labels, the date axis — with "No
 *   Critical Swim Speed data" in it for a period without a result, and a
 *   results table under it, one "--:--" · "--" row when empty.
 * - The y axis without a result is "0:40 1:50 3:00 4:10 5:20" (40 + 70k
 *   seconds), the fastest pace at the top. With results (Inferred): Running
 *   Lactate Threshold's pace axis over the period's points, as the twin's
 *   12w · results frame names it ("y by RLT's 5 s step"; its labels, 1:30 …
 *   1:50, start a step lower than the rule's 1:35 … 1:55 for its points).
 * - The x axis is FTP's: 7d a dot a day with "MM-DD" ends (`dayAxis`); 12w
 *   the 12 block starts, "7-20" … "10-05"; 1y the period's first day each
 *   month on, "Oct" … "Sep" (`ftpXAxis`). The plot runs from the period's
 *   first day to its last (today).
 * - Points (Inferred): 7d a result at its day; 12w and 1y each 7-day block's
 *   last result from the period's first day, at the block's first day
 *   (FTP's rule). Table rows (Inferred): every result of the period, newest
 *   first, its pace and its day with the year, as the twin dates them ("Oct
 *   8, 2026").
 * - "<": the shell's `canStepBack` — off once the index is complete with no
 *   row before the period, as Blood Pressure does — where the phone keeps it
 *   on and steps back to the same empty frame (the spec's recommendation).
 *
 * The charts' geometry is `critical-swim-speed-charts.ts`, off the Obsidian
 * twin (Figma page 430:6122).
 *
 * Pure.
 */

/** The ranges with a chart. */
export type CssRange = "7d" | "12w" | "1y";

/* ------------------------------------------------------------------ */
/*  Paces                                                              */
/* ------------------------------------------------------------------ */

/** Seconds per 100 m at a speed in m/s, unrounded: 1.0256 → 97.504. */
export function cssPace(speed: number): number {
	return 100 / speed;
}

/** A pace's words: m:ss, rounded half up to the second (97.504 → "1:38"; Inferred, as Running Lactate Threshold rounds). */
export function paceText(seconds: number): string {
	return duration(seconds);
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

export interface CssCurrentView {
	range: "1d";
	/** Current has no period row. */
	label: null;
	canGoBack: false;
	/** "Critical Swim Speed". */
	title: string;
	/** "--" without a result; its day with one, "Thursday, October 8" (Inferred). */
	line: string;
	/** The newest result's day, `YYYY-MM-DD`; none without one. */
	date?: string;
	/** "--" without a result; its pace, "1:38" (Inferred). */
	value: string;
	/** "Pace (min/100m)". */
	unit: string;
	/** The copy as one paragraph, and as the phone's six lines. */
	copy: string;
	copyLines: readonly string[];
}

/** The newest result on or before `today`, however old: what Current shows. */
export function newestResult(rows: readonly CriticalSwimSpeedRow[], today: string): CriticalSwimSpeedRow | undefined {
	let newest: CriticalSwimSpeedRow | undefined;
	for (const row of rows) {
		if (row.date > today || row.speed === undefined || !(row.speed > 0)) continue;
		if (!newest || row.date > newest.date) newest = row;
	}
	return newest;
}

/** Current, from the index alone: nothing is fetched on view. */
export function cssCurrent(rows: readonly CriticalSwimSpeedRow[], today: string): CssCurrentView {
	const view: CssCurrentView = {
		range: "1d",
		label: null,
		canGoBack: false,
		title: CSS_TITLE,
		line: DASH,
		value: DASH,
		unit: PACE_LABEL,
		copy: CURRENT_COPY,
		copyLines: CURRENT_COPY_LINES,
	};
	const row = newestResult(rows, today);
	if (!row) return view;
	return { ...view, line: dayLabel(row.date, today), date: row.date, value: paceText(cssPace(row.speed!)) };
}

/* ------------------------------------------------------------------ */
/*  7d, 12w, 1y                                                        */
/* ------------------------------------------------------------------ */

/** A dot on a range's chart (Inferred). */
export interface CssPoint {
	/** The result's day. */
	date: string;
	/** The day it is drawn on: its own on 7d, its 7-day block's first on 12w and 1y. */
	day: string;
	/** Across the plot: 0 on the period's first day, 1 on its last. */
	x: number;
	/** Seconds per 100 m, unrounded. */
	pace: number;
}

/** The y axis: five gridlines, each labelled with its pace, the fastest at the top. */
export interface CssYAxis {
	/** The gridlines' paces, seconds per 100 m, top first: the fastest first. */
	ticks: number[];
	/** Their labels, top first: "0:40" … "5:20". */
	labels: string[];
}

/** The empty chart's gridlines: 0:40 to 5:20 per 100 m, 70 s apart. */
export const DEFAULT_PACES: readonly number[] = [40, 110, 180, 250, 320];

/**
 * The y axis for a period's paces: the phone's default, "0:40 1:50 3:00 4:10
 * 5:20", without one; with some (Inferred), Running Lactate Threshold's pace
 * axis — padded, five gridlines 1, 2 or 5 × 10ᵏ seconds apart (5 s at
 * least), the fastest at the top.
 */
export function cssYAxis(paces: readonly number[]): CssYAxis {
	const axis = paces.length ? ltYAxis("pace", paces) : null;
	const ticks = axis ? [...axis.ticks] : [...DEFAULT_PACES];
	return { ticks, labels: ticks.map(paceText) };
}

/** A pace's place on its axis: 0 at the top gridline (the fastest), 1 at the bottom one. */
export function cssYFraction(axis: CssYAxis, pace: number): number {
	const top = axis.ticks[0];
	const bottom = axis.ticks[axis.ticks.length - 1];
	return (pace - top) / (bottom - top);
}

/**
 * The x axis, the period's first day to its last: 7d a dot a day, the ends
 * large and "MM-DD"; 12w each 7-day block's first day, "M-dd" on end; 1y the
 * period's first day each month on, its month's name on end. FTP's.
 */
export function cssXAxis(range: CssRange, span: Span): PeriodAxis {
	return range === "7d" ? dayAxis(daysOf(span)) : ftpXAxis(range, span);
}

/** The period's results, oldest first: rows inside it with a speed. */
function resultsIn(rows: readonly CriticalSwimSpeedRow[], span: Span): Array<CriticalSwimSpeedRow & { speed: number }> {
	return rows
		.filter((r): r is CriticalSwimSpeedRow & { speed: number } => r.date >= span.from && r.date <= span.to && r.speed !== undefined && r.speed > 0)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * A period's dots (Inferred): 7d each result at its day; 12w and 1y each
 * 7-day block's last result, blocks from the period's first day, at the
 * block's first day — FTP's rule, Garmin's weekly route for the same window.
 */
export function cssPoints(range: CssRange, rows: readonly CriticalSwimSpeedRow[], span: Span): CssPoint[] {
	const last = Math.max(1, daysBetween(span.from, span.to));
	const results = resultsIn(rows, span);
	if (range === "7d") return results.map((r) => ({ date: r.date, day: r.date, x: daysBetween(span.from, r.date) / last, pace: cssPace(r.speed) }));
	const blocks = new Map<number, CriticalSwimSpeedRow & { speed: number }>();
	for (const row of results) blocks.set(Math.floor(daysBetween(span.from, row.date) / BLOCK_DAYS), row);
	return [...blocks.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([block, row]) => ({ date: row.date, day: shiftDate(span.from, BLOCK_DAYS * block), x: (BLOCK_DAYS * block) / last, pace: cssPace(row.speed) }));
}

/** A range's chart: always drawn, its points empty for a period without a result. */
export interface CssChart {
	points: CssPoint[];
	y: CssYAxis;
	axis: PeriodAxis;
}

/** A row of the results table: its pace and its day. */
export interface CssResultRow {
	key: string;
	/** The result's day; none on the empty table's row. */
	date?: string;
	/** "1:38" · "Oct 8, 2026"; "--:--" · "--" when the period has no result. */
	cells: readonly [string, string];
}

/** A result's day in the table, always with its year (the twin's Inferred rows): "Oct 8, 2026". */
export function resultDate(date: string): string {
	return `${shortDate(date)}, ${date.slice(0, 4)}`;
}

/** The results table, under the chart on every range. */
export interface CssResultsTable {
	/** "Critical Swim Speed Results". */
	title: string;
	/** "Pace", "Date". */
	header: readonly string[];
	/** Under "Pace": "min/100m". */
	unit: string;
	rows: CssResultRow[];
}

/** The table for a period: every result, newest first (Inferred), or the one empty row. */
export function cssResults(rows: readonly CriticalSwimSpeedRow[], span: Span): CssResultsTable {
	const results = resultsIn(rows, span).reverse();
	return {
		title: RESULTS_TITLE,
		header: RESULTS_HEADER,
		unit: PACE_UNIT,
		rows: results.length
			? results.map((r) => ({ key: r.date, date: r.date, cells: [paceText(cssPace(r.speed)), resultDate(r.date)] as const }))
			: [{ key: "empty", cells: EMPTY_RESULT }],
	};
}

export interface CssPeriodView {
	range: CssRange;
	span: Span;
	/** "Oct 5 - 11", "Jul 20 - Oct 11", "Oct 13, 2025 - Oct 11, 2026". */
	label: string;
	/** "<": the index may still hold, or does hold, an older result. */
	canGoBack: boolean;
	/** "Daily Results" on 7d; "Weekly Results" on 12w and 1y. */
	title: string;
	/** The frame, drawn with or without a result. */
	chart: CssChart;
	/** "No Critical Swim Speed data", in the frame, for a period without a result. */
	empty?: string;
	table: CssResultsTable;
}

export type CriticalSwimSpeedView = CssCurrentView | CssPeriodView;

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

/** What the page's route says: the range and how many periods back. */
export interface CssRoute {
	range: PeriodRange;
	offset: number;
}

/** What the view needs besides the route and the index's rows. */
export interface CssContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
}

/** The registry's Critical Swim Speed: Current, 7d, 12w and 1y on the default spans (7, 84 and 364 days). */
const CSS_STAT = PERFORMANCE_REGISTRY.page("critical-swim-speed")!;

/** The page on its route's range: Current, or a period's chart and table. */
export function criticalSwimSpeedView(route: CssRoute, rows: readonly CriticalSwimSpeedRow[], ctx: CssContext): CriticalSwimSpeedView {
	if (route.range === "1d") return cssCurrent(rows, ctx.today);
	const range: CssRange = route.range === "12w" || route.range === "1y" ? route.range : "7d";
	const period = { range, offset: route.offset };
	const span = statSpan(CSS_STAT, period, ctx.today)!;
	const points = cssPoints(range, rows, span);
	const oldest = rows.reduce<string | undefined>((min, r) => (r.speed !== undefined && (min === undefined || r.date < min) ? r.date : min), undefined);
	const view: CssPeriodView = {
		range,
		span,
		label: statPeriodLabel(CSS_STAT, period, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		title: range === "7d" ? DAILY_RESULTS : WEEKLY_RESULTS,
		chart: { points, y: cssYAxis(points.map((p) => p.pace)), axis: cssXAxis(range, span) },
		table: cssResults(rows, span),
	};
	if (!points.length) view.empty = NO_CSS_DATA;
	return view;
}
