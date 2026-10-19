import type { HeatAcclimationRow } from "../sync/heat-acclimation-index";
import type { Trend } from "./glance";
import { ACCLIMATIZED, ACCLIMATIZING, DAILY_PROGRESS, DEACCLIMATIZING, HEAT_ACCLIMATION, NO_DATA, heatCopy, trendLine } from "./heat-acclimation-copy";
import { canStepBack, dayAxis, dayLabel, dayOf, daysBetween, daysOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { statPeriodLabel, statSpan } from "./stat-registry";

/**
 * Garmin Connect's Heat Acclimation page (Performance Stats, opened from
 * Training Status's Heat Acclimation row and Home's Heat card), worked out
 * from the heat-acclimation index (`src/sync/heat-acclimation-index.ts`)
 * alone, so it works offline and asks nothing on view. Rules measured on the
 * phone on 2026-10-11 (ref/performance-stats/heat-acclimation/README.md):
 *
 * - 1d, 7d and 4w; 7d and 4w are the 7 and 28 days ending today, stepped
 *   back a whole period at a time (the registry's default `{days}` spans):
 *   "Oct 5 - 11", "Sep 14 - Oct 11".
 * - 1d is the day's row: a disc with Garmin's trend as a glyph, "97%", the
 *   trend line ("Trending up from 79%.", the row's own reading before, not
 *   yesterday's) and, for ACCLIMATIZING, the copy with its fixed 22°C.
 *   Garmin's trend is shown as sent, never worked out from the change.
 * - 7d and 4w, "Daily Progress": every day's % on a fixed 0–100 % axis in
 *   25s, a dot a day at its own slot joined by a line, an axis dot a day
 *   with "MM-DD" under the two ends, and the key "Heat Acclimation". Nothing
 *   is carried in from before the period.
 *
 * Inferred (unseen on the phone): the other trends' glyph and line, their
 * copy (none), imperial's 72°F, 0 % (an empty disc, no line), a day without
 * a row (1d shows the newest earlier row, as `latest/{date}` does; the
 * chart has no dot there and its line bridges the gap), previous periods,
 * today's overnight decay before the watch syncs, and a period without a
 * row ("You have no data for this time period.").
 *
 * The chart's geometry, the disc's glyphs and the page's rhythm, measured
 * off the Obsidian twin (Figma page 430:6104), are
 * `heat-acclimation-charts.ts`'s.
 *
 * Pure.
 */

/** What the page's route says: the range and how many periods back. */
export interface HeatAcclimationRoute {
	range: PeriodRange;
	offset: number;
}

/** What the view needs besides the route and the index's rows. */
export interface HeatAcclimationContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** The account's units: the copy's threshold. Metric unless imperial. */
	units?: "metric" | "imperial";
}

const HEAT_STAT = PERFORMANCE_REGISTRY.page("heat-acclimation")!;

/** The fixed y axis, top first: 0–100 % in 25s. */
export const HEAT_TICKS: readonly number[] = [100, 75, 50, 25, 0];
export const HEAT_TICK_LABELS: readonly string[] = HEAT_TICKS.map((t) => `${t}%`);

/* ------------------------------------------------------------------ */
/*  Rows                                                               */
/* ------------------------------------------------------------------ */

/**
 * The newest row with a % on or before `date`: the day's own, else the one
 * before it — as `heataltitudeacclimation/latest/{date}` answers a day
 * without a row (2026-01-07 → 01-04). Rows oldest first, as `readIndex`
 * gives them.
 */
export function heatRowOn(rows: readonly HeatAcclimationRow[], date: string): HeatAcclimationRow | undefined {
	for (let i = rows.length - 1; i >= 0; i--) {
		const row = rows[i];
		if (row.date <= date && row.pct !== undefined) return row;
	}
	return undefined;
}

/** The disc's glyph by Garmin's trend: up (seen), flat "→" (Home's card), down (Inferred); none at 0 % or for a trend never seen. */
export function trendGlyph(trend: string | undefined): Trend | undefined {
	switch (trend?.trim().toUpperCase()) {
		case ACCLIMATIZING:
			return "up";
		case ACCLIMATIZED:
			return "flat";
		case DEACCLIMATIZING:
			return "down";
		default:
			return undefined;
	}
}

/** "97%", as sent: the % is a whole number. */
export function heatPercent(pct: number): string {
	return `${pct}%`;
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

export interface HeatDayView {
	range: "1d";
	/** The day viewed. */
	date: string;
	/** "Today", "Saturday, October 10": the day viewed, whichever row shows. */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The row shown: the day's, else the newest earlier one (Inferred); none without either. */
	row?: HeatAcclimationRow;
	/** "97%". */
	value?: string;
	/** The disc's glyph; none at 0 % (an empty disc, Inferred). */
	glyph?: Trend;
	/** "Trending up from 79%."; none at 0 % (Inferred). */
	trendLine?: string;
	/** ACCLIMATIZING's copy, "…22°C or higher…"; none for the other trends (unseen). */
	copy?: string;
	/** No row on or before the day: the line in place of the disc (Inferred). */
	empty?: typeof NO_DATA;
}

/** 1d: the route's day, its row or the newest before it. */
export function heatDayView(route: Pick<HeatAcclimationRoute, "offset">, rows: readonly HeatAcclimationRow[], ctx: HeatAcclimationContext): HeatDayView {
	const date = dayOf(route, ctx.today);
	const view: HeatDayView = {
		range: "1d",
		date,
		label: dayLabel(date, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, date),
		canGoForward: date < ctx.today,
	};
	const row = heatRowOn(rows, date);
	if (!row) {
		view.empty = NO_DATA;
		return view;
	}
	view.row = row;
	view.value = heatPercent(row.pct!);
	const glyph = trendGlyph(row.trend);
	if (glyph) view.glyph = glyph;
	const line = trendLine(row.trend, row.prev);
	if (line) view.trendLine = line;
	const copy = heatCopy(row.trend, ctx.units ?? "metric");
	if (copy) view.copy = copy;
	return view;
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

/** A day's % on the chart. */
export interface HeatPoint {
	date: string;
	/** The day's slot: 0 on the period's first day, 1 on its last. */
	x: number;
	value: number;
}

/** "Daily Progress". */
export interface HeatChart {
	/** The fixed y axis, top first: 100 75 50 25 0. */
	ticks: readonly number[];
	/** "100%" … "0%". */
	tickLabels: readonly string[];
	/**
	 * A dot a day with a row, oldest first, a 0 % day on the 0 % line. The
	 * line joins them in this order, across a day without a row (Inferred, as
	 * VO₂ Max's does).
	 */
	points: HeatPoint[];
	/** A dot a day, the two ends large and labelled "MM-DD" (`dayAxis`). */
	axis: PeriodAxis;
	/** The key under the chart, beside a white dot: "Heat Acclimation". */
	legend: string;
}

export interface HeatPeriodView {
	range: "7d" | "4w";
	from: string;
	to: string;
	/** "Oct 5 - 11", "Sep 14 - Oct 11". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Daily Progress". */
	title: string;
	/** Null for a period without a row: the empty line shows in its place. */
	chart: HeatChart | null;
	empty?: typeof NO_DATA;
}

/** A period's chart: every row in it at its day's slot; null when none is. */
export function heatChart(rows: readonly HeatAcclimationRow[], span: Span): HeatChart | null {
	const days = daysOf(span);
	const last = Math.max(1, days.length - 1);
	const points: HeatPoint[] = [];
	for (const row of rows) {
		if (row.date < span.from || row.date > span.to || row.pct === undefined) continue;
		points.push({ date: row.date, x: daysBetween(span.from, row.date) / last, value: row.pct });
	}
	if (!points.length) return null;
	points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	return { ticks: HEAT_TICKS, tickLabels: HEAT_TICK_LABELS, points, axis: dayAxis(days), legend: HEAT_ACCLIMATION };
}

/** 7d and 4w. */
export function heatPeriodView(route: HeatAcclimationRoute, rows: readonly HeatAcclimationRow[], ctx: HeatAcclimationContext): HeatPeriodView {
	const range: HeatPeriodView["range"] = route.range === "4w" ? "4w" : "7d";
	const at = { range, offset: route.offset };
	const span = statSpan(HEAT_STAT, at, ctx.today)!;
	const chart = heatChart(rows, span);
	const view: HeatPeriodView = {
		range,
		from: span.from,
		to: span.to,
		label: statPeriodLabel(HEAT_STAT, at, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, span.from),
		canGoForward: route.offset < 0,
		title: DAILY_PROGRESS,
		chart,
	};
	if (!chart) view.empty = NO_DATA;
	return view;
}

export type HeatAcclimationView = HeatDayView | HeatPeriodView;

/** The page, on its route's range. */
export function heatAcclimationView(route: HeatAcclimationRoute, rows: readonly HeatAcclimationRow[], ctx: HeatAcclimationContext): HeatAcclimationView {
	return route.range === "1d" ? heatDayView(route, rows, ctx) : heatPeriodView(route, rows, ctx);
}
