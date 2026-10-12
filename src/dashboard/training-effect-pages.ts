import { sortRows, type ActivityRow } from "../sync/activity-index";
import { categoryOf, glyphOf, typeLabel, type CategoryId, type SportGlyph } from "./activities";
import { TE_MAX, teColour, type ChartColour } from "./activity-chart-pages";
import { benefitMessage } from "./activity-copy";
import { activityWhen, primaryBenefit, type BenefitGroup } from "./activity-labels";
import { canStepBack, dayAxis, daysOf, spread, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { activityRoute, performanceStatRoute, type ActivityRoute, type PerformanceStatRoute } from "./routes";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { SCALE_TITLES, TE_ABOUT, TE_SCALES, TOP_BAND, bandCopyLines, bandTitle, type TeScaleKey } from "./training-effect-copy";
import { listDate, startsIn } from "./training-load-pages";

/**
 * Garmin Connect's Training Effect page (Performance Stats), worked out from
 * the activity index alone: it calls nothing on view. Rules measured on the
 * phone and the web on 2026-10-11 and the payloads of 2026-10-12
 * (ref/performance-stats/training-effect/README.md):
 *
 * - 7d and 4w are the 7 and 28 days ending today, "<" a whole period back:
 *   the registry's default spans, "Oct 5 - 11", "Sep 14 - Oct 11".
 * - Every activity whose index row has an aerobic training effect enters,
 *   0.0 included and whatever its sport, on its local start day: the Sep 14
 *   23:50 pool swim (+03) is Sep 14's, though the phone's +04 clock had it
 *   at 00:50 on Sep 15.
 * - Two charts, Aerobic above Anaerobic, each on a fixed 0–5 axis with a
 *   slot a day: a day's bar is its highest aerobic, and separately its
 *   highest anaerobic, training effect, to a tenth (the web help's rule for a
 *   day with several; Sep 12's 3.2 and 2.3 come from two runs). A day
 *   without an activity, or whose highest is 0.0, has no bar.
 * - A card per activity, newest first: "Oct 11, 2026" over "Threshold
 *   (High Aerobic) • 4.5 • 0.2", no name, no chevron. It opens the
 *   activity's Training Effect page on top, the route's `sub`
 *   "activity:<id>", so a reload keeps it.
 * - That page: the Primary Benefit's dot, label and copy by `benefit`; each
 *   scale's title and copy by its value's band (the tenth floored, the web
 *   help's table), not by Garmin's message keys; the knob at value / 5
 *   along the run page's scale (16 + v / 5 × 370 on a phone), the value
 *   centred under it, never clamped; and the related activity: its sport's
 *   disc, name, "Oct 11 @ 8:21 AM" and the card's subtitle. A run opens its
 *   activity page; other sports have none yet.
 *
 * Inferred (unseen on the phone): previous periods, several activities a
 * day, the 4w list past its third card, benefit labels and copy other than
 * Threshold's, band titles and copy other than Aerobic 4.x and Anaerobic
 * 0.x, other sports' related row, the empty period, Help, a detail whose
 * activity is gone (it falls back to the list), and whether 7d and 4w are
 * Monday weeks on a weekday.
 *
 * The charts' and the detail page's geometry is `training-effect-charts.ts`,
 * off the Obsidian twin (Figma page 430:6116).
 *
 * Pure.
 */

const TE_STAT = PERFORMANCE_REGISTRY.page("training-effect")!;
const DASH = "--";
/** What a benefit Garmin does not name reads, as Load's list words it. */
const UNKNOWN = "Unknown";

/** Both charts' y labels, top first: the axis is fixed at 0–5, whatever the data. */
export const TE_TICKS: readonly number[] = [5, 4, 3, 2, 1, 0];

/** What the page's route says: the range, how many periods back, and the activity page a card opened. */
export interface TrainingEffectRoute {
	range: PeriodRange;
	offset: number;
	/** "activity:24680971010": that activity's Training Effect page. */
	sub?: string;
}

/** What the view needs besides the route and the activity index's rows. */
export interface TrainingEffectContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The activity index holds the whole history (`activities.complete`). */
	complete: boolean;
}

/* ------------------------------------------------------------------ */
/*  Values and words                                                   */
/* ------------------------------------------------------------------ */

/** A training effect as the page shows it: to a tenth, within 0–5; none without one. */
function teValue(raw: number | undefined): number | undefined {
	if (raw === undefined || !Number.isFinite(raw)) return undefined;
	return Math.min(TE_MAX, Math.max(0, Math.round(raw * 10) / 10));
}

/** "4.5", "0.0": always one decimal; "--" without a value. */
export function teText(raw: number | undefined): string {
	return teValue(raw)?.toFixed(1) ?? DASH;
}

/** A value's band: its tenth floored, 0 No Benefit … 4 Highly Impacting, 5 Overreaching (5.0 only). */
export function teBand(value: number): number {
	return Math.max(0, Math.min(TOP_BAND, Math.floor(teValue(value) ?? 0)));
}

/** The Primary Benefit as the cards and the detail page write it: "Threshold (High Aerobic)"; "Unknown" for UNKNOWN or none. */
export function benefitLabel(benefit: string | undefined): string {
	return primaryBenefit(benefit)?.label ?? UNKNOWN;
}

/** A card's subtitle, and the related activity's: "Threshold (High Aerobic) • 4.5 • 0.2". */
export function teSubtitle(row: Pick<ActivityRow, "benefit" | "aerobic" | "anaerobic">): string {
	return [benefitLabel(row.benefit), teText(row.aerobic), teText(row.anaerobic)].join(" • ");
}

/* ------------------------------------------------------------------ */
/*  Which activities, on which day                                     */
/* ------------------------------------------------------------------ */

/** An activity the page counts: its row has an aerobic training effect, 0.0 included. */
function hasTe(row: Pick<ActivityRow, "aerobic">): boolean {
	return teValue(row.aerobic) !== undefined;
}

/** The activity's local start day: where Garmin's own filters, and so its bars and cards, put it. */
function localDay(row: Pick<ActivityRow, "start">): string {
	return row.start.slice(0, 10);
}

/** An activity of the period: one the page counts, started on a day of the span (`startsIn`, Load's). */
function inPeriod(row: ActivityRow, span: Span): boolean {
	return hasTe(row) && startsIn(row, span);
}

/** Each day's highest `key`, by the activities' local start days, chosen apart from the other key's. */
export function dayMaxima(rows: readonly ActivityRow[], span: Span, key: TeScaleKey): Map<string, number> {
	const best = new Map<string, number>();
	for (const row of rows) {
		if (!inPeriod(row, span)) continue;
		const value = teValue(row[key]);
		if (value === undefined) continue;
		const day = localDay(row);
		best.set(day, Math.max(best.get(day) ?? 0, value));
	}
	return best;
}

/** The oldest day an activity of the page's started. */
function oldestDay(rows: readonly ActivityRow[]): string | undefined {
	let oldest: string | undefined;
	for (const row of rows) {
		if (!hasTe(row)) continue;
		const day = localDay(row);
		if (oldest === undefined || day < oldest) oldest = day;
	}
	return oldest;
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

/** A day's bar: the day's highest value. */
export interface TeBar {
	date: string;
	/** The day's slot in the period, 0 its first. */
	slot: number;
	/** Its day across the plot, 0 the first slot's centre and 1 the last's (`spread`), as the axis' dots. */
	x: number;
	/** The day's highest, to a tenth: above 0, at most 5. */
	value: number;
	/** value / 5: the bar's height as a share of the 0–5 plot. */
	at: number;
}

/** One of the two charts. */
export interface TeChart {
	key: TeScaleKey;
	/** "Aerobic", "Anaerobic". */
	title: string;
	/** 5, 4, 3, 2, 1, 0, each at its own value. */
	ticks: readonly number[];
	/** The plot's top: 5. */
	top: number;
	/** A bar for each day whose highest is above 0, oldest first. */
	bars: TeBar[];
	/** A dot a day under the bars' slots, the ends large and labelled "10-05", "10-11". */
	axis: PeriodAxis;
}

/** A card under the charts: one activity. */
export interface TeCard {
	id: number;
	/** "Oct 11, 2026", always with the year. */
	date: string;
	/** "Threshold (High Aerobic) • 4.5 • 0.2". */
	subtitle: string;
	/** Its Training Effect page, opened on top (`go`), so Back returns to the list. */
	route: PerformanceStatRoute;
}

export interface TrainingEffectPeriodView {
	kind: "period";
	range: "7d" | "4w";
	span: Span;
	/** The date row: "Oct 5 - 11", "Sep 14 - Oct 11". */
	label: string;
	/** "<": older activities exist, or may while the index is still coming. */
	canGoBack: boolean;
	/** ">": a past period. */
	canGoForward: boolean;
	/** Aerobic, then Anaerobic. */
	charts: [TeChart, TeChart];
	/** Every activity of the period, newest first. */
	cards: TeCard[];
	/** The web's line where the list would be, for a period without activities; the charts keep their axes. */
	empty?: string;
}

/** A chart of the period: a slot a day, a bar on each day whose highest `key` is above 0. */
export function teChart(rows: readonly ActivityRow[], span: Span, key: TeScaleKey): TeChart {
	const days = daysOf(span);
	const best = dayMaxima(rows, span, key);
	const bars: TeBar[] = [];
	days.forEach((date, slot) => {
		const value = best.get(date);
		if (value) bars.push({ date, slot, x: spread(slot, days.length), value, at: value / TE_MAX });
	});
	return { key, title: SCALE_TITLES[key], ticks: TE_TICKS, top: TE_MAX, bars, axis: dayAxis(days) };
}

/** The `sub` of an activity's Training Effect page: "activity:24680971010". */
export function activitySub(id: number): string {
	return `activity:${id}`;
}

const ACTIVITY_SUB = /^activity:([1-9]\d{0,15})$/;

/** The activity a route's `sub` names; none for any other sub-page. */
export function activityOfSub(sub: string | undefined): number | undefined {
	const match = sub === undefined ? null : ACTIVITY_SUB.exec(sub);
	const id = match ? Number(match[1]) : NaN;
	return Number.isSafeInteger(id) ? id : undefined;
}

/** The route a card opens: its activity's page, on the period it was opened from. */
export function cardRoute(range: TrainingEffectPeriodView["range"], offset: number, id: number): PerformanceStatRoute {
	return performanceStatRoute("training-effect", { range, offset, sub: activitySub(id) });
}

/** 7d or 4w: the route's period, its two charts and a card per activity. */
function periodView(route: TrainingEffectRoute, rows: readonly ActivityRow[], ctx: TrainingEffectContext): TrainingEffectPeriodView {
	const range: TrainingEffectPeriodView["range"] = route.range === "4w" ? "4w" : "7d";
	const period = { range, offset: Math.min(0, route.offset) };
	const span = statSpan(TE_STAT, period, ctx.today)!;
	// Newest first (`sortRows`): a card each.
	const shown = sortRows(rows.filter((r) => inPeriod(r, span)));
	const view: TrainingEffectPeriodView = {
		kind: "period",
		range,
		span,
		label: statPeriodLabel(TE_STAT, period, ctx.today),
		canGoBack: canStepBack(oldestDay(rows), ctx.complete, span.from),
		canGoForward: period.offset < 0,
		charts: [teChart(shown, span, "aerobic"), teChart(shown, span, "anaerobic")],
		cards: shown.map((r) => ({ id: r.id, date: listDate(r.start), subtitle: teSubtitle(r), route: cardRoute(range, period.offset, r.id) })),
	};
	if (!shown.length) view.empty = TE_ABOUT;
	return view;
}

/* ------------------------------------------------------------------ */
/*  An activity's Training Effect page                                 */
/* ------------------------------------------------------------------ */

/** PRIMARY BENEFIT: the dot, the label and what the activity did. */
export interface TeBenefit {
	/** "Threshold (High Aerobic)"; "Unknown" for UNKNOWN or none. */
	label: string;
	/** The dot's group (`BENEFIT_COLOR`); none, no dot. */
	group: BenefitGroup | null;
	/** By `benefit`; known for Threshold only (`benefitMessage`). */
	copy?: string;
}

/**
 * AEROBIC or ANAEROBIC: a title and copy by the value's band, and the run
 * page's scale with its knob. `label`, `value` and `colour` are what the run
 * page's `trainingEffectScales` draws.
 */
export interface TeScale {
	key: TeScaleKey;
	label: "Aerobic" | "Anaerobic";
	/** To a tenth, 0–5. */
	value: number;
	/** "4.5": centred under the knob, never clamped to the cell's margins. */
	text: string;
	/** value / 5: where the knob sits along the scale, its gaps ignored. */
	at: number;
	/** The knob's colour: the segment it sits on (`teColour`), 4.5 orange, 0.2 grey. */
	colour: ChartColour;
	/** 0–5: the value's tenth floored. */
	band: number;
	/** "Highly Impacting Aerobic Fitness", "No Anaerobic Benefit". */
	title: string;
	/** The copy under the scale; none where the band's words are unseen. */
	copy?: string;
	/** The same, as the phone breaks it into lines. */
	copyLines?: readonly string[];
}

/** RELATED ACTIVITY: the activity's row. */
export interface TeRelated {
	id: number;
	/** "Dubai Running"; the sport's name for an activity without one (Inferred). */
	name: string;
	/** "Oct 11 @ 8:21 AM", with the year when it is not this one's. */
	when: string;
	/** The card's subtitle. */
	subtitle: string;
	/** The disc's figure (`sportIcon`) and the sport it stands for. */
	glyph: SportGlyph;
	category: CategoryId;
	/** A run's activity page; other sports have none yet, so their row opens nothing. */
	route?: ActivityRoute;
}

export interface TrainingEffectDetailView {
	kind: "detail";
	/** The activity's id, the route's `sub`. */
	id: number;
	/** Its local start day. */
	date: string;
	benefit: TeBenefit;
	/** Aerobic, then Anaerobic; a scale without a value is left out. */
	scales: TeScale[];
	related: TeRelated;
}

/** A scale for a value: its band's words and its knob; none without a value. */
function teScale(key: TeScaleKey, raw: number | undefined): TeScale | undefined {
	const value = teValue(raw);
	if (value === undefined) return undefined;
	const band = teBand(value);
	const scale: TeScale = { key, label: SCALE_TITLES[key], value, text: value.toFixed(1), at: value / TE_MAX, colour: teColour(value), band, title: bandTitle(key, band) };
	const lines = bandCopyLines(key, band);
	if (lines) {
		scale.copy = lines.join(" ");
		scale.copyLines = lines;
	}
	return scale;
}

/** The activity's Training Effect page. */
function detailView(row: ActivityRow, today: string): TrainingEffectDetailView {
	const benefit = primaryBenefit(row.benefit);
	const head: TeBenefit = { label: benefitLabel(row.benefit), group: benefit?.group ?? null };
	const copy = benefitMessage(row.benefit);
	if (copy) head.copy = copy;
	const related: TeRelated = {
		id: row.id,
		name: row.name ?? typeLabel(row.type),
		when: activityWhen(row.start, today),
		subtitle: teSubtitle(row),
		glyph: glyphOf(row),
		category: categoryOf(row),
	};
	if (related.category === "running") related.route = activityRoute(row.id);
	return {
		kind: "detail",
		id: row.id,
		date: localDay(row),
		benefit: head,
		scales: TE_SCALES.flatMap((key) => teScale(key, row[key]) ?? []),
		related,
	};
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export type TrainingEffectView = TrainingEffectPeriodView | TrainingEffectDetailView;

/**
 * The page on its route: the activity page its `sub` names, else the
 * route's 7d or 4w. A `sub` whose activity is gone from the index, or no
 * longer has a training effect, falls back to the list (Inferred).
 */
export function trainingEffectView(route: TrainingEffectRoute, activities: readonly ActivityRow[], ctx: TrainingEffectContext): TrainingEffectView {
	const id = activityOfSub(route.sub);
	const row = id === undefined ? undefined : activities.find((r) => r.id === id && hasTe(r));
	return row ? detailView(row, ctx.today) : periodView(route, activities, ctx);
}
