import { HRV_STRESS_MAX, type HrvStressRow } from "../sync/hrv-stress-index";
import { HRV_STRESS_LEVELS, NO_DATA_AVAILABLE, type HrvStressLevel } from "./hrv-stress-copy";
import { canStepBack, dayAxis, daysBetween, daysOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { statPeriodLabel, statSpan } from "./stat-registry";

/**
 * Garmin Connect's HRV Stress page (Performance Stats), worked out from the
 * HRV stress index (`src/sync/hrv-stress-index.ts`). The account the spec was
 * captured from has never run a test, so the empty page is 1:1 with the
 * phone (2026-10-11) and everything a test draws is Inferred
 * (ref/performance-stats/hrv-stress/README.md):
 *
 * - 7d and 4w, the registry's default spans: the seven or 28 days ending
 *   today, "Oct 5 - 11" and "Sep 14 - Oct 11" (the phone's rolling 4w, not
 *   the web's Sunday block, "Sep 20 - Oct 11").
 * - A period without a test is almost bare: the period row, "No data
 *   available" and the day axis — a dot a day, the ends large and "MM-DD".
 *   No title, no y axis, no gridlines, no legend, no list.
 * - With tests (Inferred: the web's chart config is `BAR_DAILY`): a bar a
 *   day with a test, as tall as its score on 0–100, in its level's colour —
 *   the Help's Low 1-34, Moderate 35-69, High 70-89, Very High 90-100 — on a
 *   0–100 axis, with the levels' legend under it.
 * - "<": the shell's `canStepBack` — off once the index is complete with no
 *   row before the period, as Blood Pressure does — where the phone keeps it
 *   on (the spec's recommendation).
 *
 * The chart's geometry is `hrv-stress-charts.ts`, off the Obsidian twin
 * (Figma page 430:6132).
 *
 * Pure.
 */

/** The page's ranges. */
export type HrvStressRange = "7d" | "4w";

/**
 * A score's level in the Help's table: Low to 34, Moderate 35-69, High
 * 70-89, Very High 90 and up. The table starts at 1; a 0 reads as Low.
 */
export function hrvStressLevel(score: number): HrvStressLevel {
	let level: HrvStressLevel = "low";
	for (const l of HRV_STRESS_LEVELS) if (score >= l.min) level = l.id;
	return level;
}

/** A day's bar (Inferred). */
export interface HrvStressBar {
	/** The test's day. */
	date: string;
	/** Across the plot: 0 on the period's first day, 1 on its last, as the day axis' dots. */
	x: number;
	/** The day's last score, 0–100. */
	score: number;
	/** Tests that day. */
	n: number;
	level: HrvStressLevel;
}

/** A populated chart's y axis (Inferred): the Help's 0–100 scale, its gridlines top first. */
export interface HrvStressYAxis {
	max: number;
	ticks: readonly number[];
}

export const HRV_STRESS_Y: HrvStressYAxis = { max: HRV_STRESS_MAX, ticks: [100, 75, 50, 25, 0] };

export interface HrvStressView {
	range: HrvStressRange;
	span: Span;
	/** "Oct 5 - 11", "Sep 14 - Oct 11". */
	label: string;
	/** "<": the index may still hold, or does hold, an older test. */
	canGoBack: boolean;
	/** A dot a day, the ends large and labelled "MM-DD": drawn with or without a test. */
	axis: PeriodAxis;
	/** A bar a day with a test, oldest first (Inferred). */
	bars: HrvStressBar[];
	/** The 0–100 axis once a bar draws (Inferred); none on the bare empty page. */
	y: HrvStressYAxis | null;
	/** "No data available" for a period without a test. */
	empty?: string;
}

/** What the page's route says: the range and how many periods back. */
export interface HrvStressRoute {
	range: PeriodRange;
	offset: number;
}

/** What the view needs besides the route and the index's rows. */
export interface HrvStressContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
}

/** The registry's HRV Stress: 7d and 4w on the default spans (7 and 28 days). */
const HRV_STRESS_STAT = PERFORMANCE_REGISTRY.page("hrv-stress")!;

/** The page on its route's range: the period's bars, or its bare empty state. */
export function hrvStressView(route: HrvStressRoute, rows: readonly HrvStressRow[], ctx: HrvStressContext): HrvStressView {
	const range: HrvStressRange = route.range === "4w" ? "4w" : "7d";
	const period = { range, offset: route.offset };
	const span = statSpan(HRV_STRESS_STAT, period, ctx.today)!;
	const days = daysOf(span);
	const last = Math.max(1, days.length - 1);
	const bars = rows
		.filter((r): r is HrvStressRow & { score: number } => r.date >= span.from && r.date <= span.to && r.score !== undefined)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
		.map((r) => ({ date: r.date, x: daysBetween(span.from, r.date) / last, score: r.score, n: r.n ?? 1, level: hrvStressLevel(r.score) }));
	const oldest = rows.reduce<string | undefined>((min, r) => (r.score !== undefined && (min === undefined || r.date < min) ? r.date : min), undefined);
	const view: HrvStressView = {
		range,
		span,
		label: statPeriodLabel(HRV_STRESS_STAT, period, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		axis: dayAxis(days),
		bars,
		y: bars.length ? HRV_STRESS_Y : null,
	};
	if (!bars.length) view.empty = NO_DATA_AVAILABLE;
	return view;
}
