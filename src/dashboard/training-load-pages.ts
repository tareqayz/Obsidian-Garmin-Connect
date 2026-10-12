import { sortRows, type ActivityRow } from "../sync/activity-index";
import type { TrainingStatusRow } from "../sync/training-status-index";
import { categoryOf, formatDistance, typeLabel, type Units } from "./activities";
import { primaryBenefit, type BenefitGroup } from "./activity-labels";
import { latestWith, num, shortDate, str } from "./day";
import { canStepBack, dayAxis, daysOf, periodLabel, spread, type PeriodAxis, type PeriodRange, type Span, type SpanRange } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { activityRoute, type ActivityRoute } from "./routes";
import { shiftDate, type DayRow } from "./series";
import { acuteAxis, r2, stepUp, type MarkedAxis } from "./stat-charts";
import { statPeriodLabel, statSpan } from "./stat-registry";
import {
	ACUTE_LOAD,
	CHRONIC_LOAD,
	DAILY_TOTALS,
	GROUP_LABELS,
	LOAD_GROUPS,
	LOAD_RATIO,
	OPTIMAL_RANGE,
	TIMELINE,
	focusCopyLines,
	focusTitle,
	loadCopyLines,
	type FocusBucket,
	type LoadGroup,
	type TrainingSegment,
} from "./training-load-copy";
import { LOAD_WORDS, NO_DATA } from "./training-status-copy";
import { loadValue } from "./training-status-pages";

/**
 * Garmin Connect's Load page (Performance Stats; hidden, opened from
 * Training Status's Load row and Home's Load Focus and Training Load cards),
 * worked out from what the plugin already keeps — it calls nothing on view.
 * Rules measured on the phone on 2026-10-11
 * (ref/performance-stats/training-load/README.md):
 *
 * - Load Focus reads the day files' `load_*` and `load_focus` (the day
 *   sync's `trainingStatus`): the newest day on or before today with a
 *   record, however old (as Training Status's Current), so a morning before
 *   the watch syncs shows yesterday's. Its label is that record's own window,
 *   the 28 days ending on it ("Sep 14 - Oct 11"), and it has no stepper.
 *   The three values are Garmin's, rounded half up as the day files keep
 *   them (17.69 → 18): an activity list summed by benefit does not give them,
 *   since Garmin splits an activity across the buckets. Each bar runs to its
 *   value over the scale, the largest of the three values and the three
 *   target maxima; each Optimal Range box spans its targets on that scale.
 * - Exercise Load reads the activity index: the 28 days ending today (4w),
 *   stepping 28 days. A bar a day with load, on each activity's local start
 *   day (the Sep 14 23:50 swim is Sep 14's), stacked by benefit group; its y
 *   axis counts in ⌈M / 3 / 25⌉ × 25 to 3 steps. Under it every activity of
 *   the period, newest first: "Oct 11, 2026" over "12.5 km run • Load: 204
 *   • Benefit: Threshold"; a run opens its page.
 * - Training Load reads the Training Status index over the same periods:
 *   Acute Load draws the acute load a day over the optimal band, 0.8× to
 *   1.5× each day's chronic load, on `acuteAxis` (stat-charts.ts); the
 *   Chronic Load chip adds the chronic line and greys the rest. Load Ratio
 *   draws Garmin's 1 dp ratio on a fixed 0–2.3 axis over the 0.8–1.5 band,
 *   with the newest row's acute and chronic loads under it. Both end on
 *   the newest row's status and copy, by `acwrStatusFeedback`.
 * - The segment and the chip are the route's `sub`: "ratio" for Load Ratio,
 *   "chronic" for Acute Load with the chip on, none for Acute Load alone
 *   (`withTrainingView`). So they survive a period step and a reload; the
 *   other tabs ignore it.
 *
 * Inferred (unseen on the phone): previous periods, the list's rows past
 * Sep 23 and the wording of other sports' rows, stacked bars and their
 * order, Load Focus's other six phrases' titles and copy, the status words
 * and copy but Optimal / FEEDBACK_2, ratios past 2.3 and null ones, a
 * morning before the watch syncs, and the empty states.
 *
 * The charts' and rows' geometry is `training-load-charts.ts`'s, measured
 * off the Obsidian twin (Figma 430:6102).
 *
 * Pure.
 */

const LOAD_STAT = PERFORMANCE_REGISTRY.page("training-load")!;
const DASH = "--";

/** The page's tabs, as the registry lists them: Load Focus opens first. */
export type LoadTab = "focus" | "exercise" | "training";

/** The tab a route names: Exercise Load, Training Load, else the first, Load Focus. */
export function loadTab(tab: string | undefined): LoadTab {
	return tab === "exercise" || tab === "training" ? tab : "focus";
}

/** What the page's route says: the period (4w, whole periods back), the tab, and Training Load's view. */
export interface TrainingLoadRoute {
	range: PeriodRange;
	offset: number;
	tab?: string;
	/** Training Load's view: `RATIO_SUB`, `CHRONIC_SUB`, or none for Acute Load with the chip off. */
	sub?: string;
}

/** What the view reads besides the route: each tab its own source. */
export interface TrainingLoadContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The account's unit system: the list's distances. */
	units?: Units;
	/** Every day file (`readDays()`), oldest first: Load Focus. */
	days?: readonly DayRow[];
	/** The activity index's rows (`activities.rows`), any order: Exercise Load. */
	activities?: readonly ActivityRow[];
	/** The activity index holds the whole history (`activities.complete`). */
	activitiesComplete?: boolean;
	/** The Training Status index's rows (`readIndex("training-status")`), oldest first: Training Load. */
	status?: readonly TrainingStatusRow[];
	/** The Training Status index's meta says it holds the whole history. */
	statusComplete?: boolean;
}

/** What every tab's view has: the date row and the line in place of its content. */
interface TabView {
	/** The date row: "Sep 14 - Oct 11". */
	label: string;
	/** False on Load Focus, which shows its label alone. */
	steppers: boolean;
	/** "<": older data exists, or may while the index is still coming. */
	canGoBack: boolean;
	/** ">": a past period. */
	canGoForward: boolean;
	/** The shared line in place of the tab's content when there is nothing to show. */
	empty?: string;
}

/* ------------------------------------------------------------------ */
/*  Load Focus                                                         */
/* ------------------------------------------------------------------ */

/** The days a Load Focus record covers: the 28 ending on its day (`trainingloadbalance`'s window). */
export const FOCUS_DAYS = 28;

/** The rows, top down, and each one's day-file stem. */
const FOCUS_ROWS: ReadonlyArray<{ bucket: FocusBucket; stem: string }> = [
	{ bucket: "anaerobic", stem: "anaerobic" },
	{ bucket: "highAerobic", stem: "aerobic_high" },
	{ bucket: "lowAerobic", stem: "aerobic_low" },
];

/** A Load Focus row: its value and bar, and the Optimal Range box over the bar. */
export interface FocusBar {
	bucket: FocusBucket;
	/** "High Aerobic". */
	label: string;
	/** Garmin's load, rounded half up: 1355. */
	value: number;
	/** "1,355". */
	text: string;
	/** The bar's length as a fraction of the scale (the phone's runs from x 201 to 201 + 185 × it); 0 draws nothing. */
	fraction: number;
	/** The Optimal Range: Garmin's targets, and where they fall on the same scale. */
	target?: { min: number; max: number; from: number; to: number };
}

export interface FocusTabView extends TabView {
	tab: "focus";
	steppers: false;
	canGoBack: false;
	canGoForward: false;
	/** The record's day; none without a record. */
	date?: string;
	/** The 28 days the record covers, ending on its day (today's window without one). */
	span: Span;
	/** "Low Aerobic Shortage". */
	title?: string;
	/** The copy under the title; none for a phrase whose words are unseen. */
	copy?: string;
	/** The same, as the phone breaks it into lines. */
	copyLines?: readonly string[];
	/** Anaerobic, High Aerobic, Low Aerobic; none without a record. */
	bars: FocusBar[];
	/** What a full bar stands for: the largest of the values and the target maxima. */
	scale: number;
	/** The legend under the rows: "Optimal Range". */
	legend: string;
}

/** The 28 days a Load Focus record of `date` covers. */
export function focusSpan(date: string): Span {
	return { from: shiftDate(date, -(FOCUS_DAYS - 1)), to: date };
}

/** The day file Load Focus shows: the newest on or before today with a record, however old. */
export function focusRecord(days: readonly DayRow[], today: string): DayRow | undefined {
	return latestWith(days, today, "load_aerobic_high");
}

/**
 * A record's three rows on one scale, the largest of the three values and
 * the three target maxima (Home's Load Focus card's rule): 1355 on Oct 11,
 * where High Aerobic's 1355 passes its 869 target.
 */
export function focusBars(row: DayRow): { bars: FocusBar[]; scale: number } {
	const rows = FOCUS_ROWS.map(({ bucket, stem }) => ({
		bucket,
		value: Math.max(0, Math.round(num(row, `load_${stem}`) ?? 0)),
		min: num(row, `load_${stem}_target_min`),
		max: num(row, `load_${stem}_target_max`),
	}));
	const scale = Math.max(1, ...rows.flatMap((r) => [r.value, r.max ?? 0]));
	const bars = rows.map(({ bucket, value, min, max }) => {
		const bar: FocusBar = { bucket, label: GROUP_LABELS[bucket], value, text: value.toLocaleString(), fraction: value / scale };
		if (min !== undefined && max !== undefined) bar.target = { min, max, from: min / scale, to: max / scale };
		return bar;
	});
	return { bars, scale };
}

/** Load Focus: the newest record's window, title, copy and rows; the shared empty line without any. */
export function focusView(ctx: Pick<TrainingLoadContext, "today" | "days">): FocusTabView {
	const row = focusRecord(ctx.days ?? [], ctx.today);
	const span = focusSpan(row?.date ?? ctx.today);
	const view: FocusTabView = {
		tab: "focus",
		label: periodLabel(span.from, span.to, ctx.today),
		steppers: false,
		canGoBack: false,
		canGoForward: false,
		span,
		bars: [],
		scale: 1,
		legend: OPTIMAL_RANGE,
	};
	if (!row) {
		view.empty = NO_DATA;
		return view;
	}
	view.date = row.date;
	const phrase = str(row, "load_focus");
	const title = focusTitle(phrase);
	if (title) view.title = title;
	const lines = focusCopyLines(phrase);
	if (lines) {
		view.copy = lines.join(" ");
		view.copyLines = lines;
	}
	const { bars, scale } = focusBars(row);
	view.bars = bars;
	view.scale = scale;
	return view;
}

/* ------------------------------------------------------------------ */
/*  Exercise Load                                                      */
/* ------------------------------------------------------------------ */

/** A part of a day's bar: a benefit group's load, stacked from `from` to `to`. */
export interface ExerciseSegment {
	group: LoadGroup;
	value: number;
	from: number;
	to: number;
}

/** A day's bar in Daily Totals. */
export interface ExerciseBar {
	date: string;
	/** Its day across the plot, 0 the period's first and 1 its last: centred on that day's dot. */
	x: number;
	/** The day's load, its activities' summed. */
	total: number;
	/** Bottom up, in the legend's order: Anaerobic, High Aerobic, Low Aerobic, Unknown (Inferred). */
	segments: ExerciseSegment[];
}

/** An activity in the list under the chart. */
export interface ExerciseRow {
	id: number;
	/** "Oct 11, 2026", always with the year. */
	date: string;
	/** "12.5 km run • Load: 204 • Benefit: Threshold". */
	subtitle: string;
	/** Its three parts, which the row sets apart with spaced bullets: "12.5 km run", "Load: 204", "Benefit: Threshold". */
	parts: string[];
	/** A run's page, opened on top, as the Activities lists open it; other sports have none yet (Inferred). */
	route?: ActivityRoute;
}

export interface ExerciseTabView extends TabView {
	tab: "exercise";
	range: SpanRange;
	from: string;
	to: string;
	/** "Daily Totals". */
	title: string;
	chart: {
		/** A bar for each day with load, oldest first. */
		bars: ExerciseBar[];
		/** The y labels top first, each at its own value: 225, 150, 75, 0. */
		ticks: number[];
		/** The plot's top: 3 steps (Inferred: the shot can't tell it from the tallest day). */
		top: number;
		/** A dot a day, the ends large and labelled "09-14", "10-11". */
		axis: PeriodAxis;
	};
	/** Anaerobic, High Aerobic, Low Aerobic, Unknown: always all four. */
	legend: Array<{ group: LoadGroup; label: string }>;
	/** Every activity of the period, newest first. */
	list: ExerciseRow[];
}

const GROUP_OF: Readonly<Record<BenefitGroup, LoadGroup>> = {
	Anaerobic: "anaerobic",
	"High Aerobic": "highAerobic",
	"Low Aerobic": "lowAerobic",
};

/** A primary benefit's group, as the activity pages group it (`primaryBenefit`); Unknown for none, UNKNOWN, NO_BENEFIT. */
export function loadGroup(benefit: string | undefined): LoadGroup {
	const group = primaryBenefit(benefit)?.group;
	return group ? GROUP_OF[group] : "unknown";
}

/** A primary benefit as the list writes it: "Threshold", "VO₂ Max"; "Unknown" for none. */
export function benefitName(benefit: string | undefined): string {
	return primaryBenefit(benefit)?.name ?? GROUP_LABELS.unknown;
}

/**
 * The sport in a row's subtitle: "run" for any run (treadmill included),
 * "swim", "ride", else the type's name in lower case, "stair climbing".
 * Only "run" is seen (Inferred).
 */
export function sportWord(row: Pick<ActivityRow, "type" | "typeId" | "parentTypeId">): string {
	switch (categoryOf(row)) {
		case "running":
			return "run";
		case "swimming":
			return "swim";
		case "cycling":
			return "ride";
		default:
			return typeLabel(row.type).toLowerCase();
	}
}

/**
 * "12.5 km run • Load: 204 • Benefit: Threshold": the distance to a tenth
 * of a km (miles on an imperial account, Inferred), the load rounded half
 * up (203.85 → 204, 171.55 → 172). An activity without a distance drops it
 * and its space (Inferred: Aug 28's stair climbing).
 */
export function exerciseSubtitle(row: ActivityRow, units: Units): string {
	return subtitleParts(row, units).join(" • ");
}

/** A row's subtitle in its three parts: the activity, its load, its benefit. */
export function subtitleParts(row: ActivityRow, units: Units): string[] {
	const sport = sportWord(row);
	const what = row.distance !== undefined ? `${formatDistance(row.distance, units, 1, true)} ${sport}` : sport;
	return [what, `Load: ${Math.round(row.load ?? 0)}`, `Benefit: ${benefitName(row.benefit)}`];
}

/** A list row's date: "Oct 11, 2026", always with the year. */
export function listDate(start: string): string {
	return `${shortDate(start)}, ${start.slice(0, 4)}`;
}

/** Whether an activity's local start day falls in the span (Training Effect's periods too). */
export function startsIn(row: Pick<ActivityRow, "start">, span: Span): boolean {
	const day = row.start.slice(0, 10);
	return day >= span.from && day <= span.to;
}

/**
 * Daily Totals: each day's activities summed by their local start day,
 * stacked by benefit group in the legend's order; a day without load has no
 * bar. Loads stay to the hundredth, as the index keeps them.
 */
export function dailyTotals(rows: readonly ActivityRow[], span: Span): ExerciseBar[] {
	const days = daysOf(span);
	const sums = new Map<string, Map<LoadGroup, number>>();
	for (const row of rows) {
		if (!row.load || !startsIn(row, span)) continue;
		const day = row.start.slice(0, 10);
		const groups = sums.get(day) ?? new Map<LoadGroup, number>();
		const group = loadGroup(row.benefit);
		groups.set(group, (groups.get(group) ?? 0) + row.load);
		sums.set(day, groups);
	}
	return days.flatMap((date, i) => {
		const groups = sums.get(date);
		if (!groups) return [];
		let at = 0;
		const segments = LOAD_GROUPS.flatMap((group) => {
			const value = groups.get(group);
			if (!value) return [];
			const segment = { group, value: r2(value), from: r2(at), to: r2(at + value) };
			at += value;
			return [segment];
		});
		return [{ date, x: spread(i, days.length), total: r2(at), segments }];
	});
}

/**
 * Daily Totals' y labels, top first: 0, S, 2S and 3S for the tallest day M,
 * S = ⌈M / 3 / 25⌉ × 25 (203.85 → 75: 0 / 75 / 150 / 225; Sep 12's 257.94
 * → 100). A period without load reads 0–75 (Inferred).
 */
export function exerciseTicks(max: number): number[] {
	const step = stepUp(max / 3);
	return [3 * step, 2 * step, step, 0];
}

/** The period's activities, newest first by start (`sortRows`), each with its date, subtitle and, for a run, its page. */
export function exerciseRows(rows: readonly ActivityRow[], span: Span, units: Units): ExerciseRow[] {
	return sortRows(rows.filter((r) => startsIn(r, span))).map((r) => {
		const parts = subtitleParts(r, units);
		const item: ExerciseRow = { id: r.id, date: listDate(r.start), subtitle: parts.join(" • "), parts };
		if (categoryOf(r) === "running") item.route = activityRoute(r.id);
		return item;
	});
}

/** The oldest day the rows hold. */
function oldestDay(dates: Iterable<string>): string | undefined {
	let oldest: string | undefined;
	for (const date of dates) if (oldest === undefined || date < oldest) oldest = date;
	return oldest;
}

/** The 4w period a route is on: Load's only range, whole 28 days back. */
function loadPeriod(route: Pick<TrainingLoadRoute, "offset">, today: string): { span: Span; label: string } {
	const at = { range: "4w" as const, offset: route.offset };
	return { span: statSpan(LOAD_STAT, at, today)!, label: statPeriodLabel(LOAD_STAT, at, today) };
}

/** Exercise Load: Daily Totals and the list, over the route's 4w period. */
export function exerciseView(route: TrainingLoadRoute, ctx: TrainingLoadContext): ExerciseTabView {
	const { span, label } = loadPeriod(route, ctx.today);
	const rows = ctx.activities ?? [];
	const bars = dailyTotals(rows, span);
	const ticks = exerciseTicks(Math.max(0, ...bars.map((b) => b.total)));
	return {
		tab: "exercise",
		range: "4w",
		from: span.from,
		to: span.to,
		label,
		steppers: true,
		canGoBack: canStepBack(oldestDay(rows.map((r) => r.start.slice(0, 10))), ctx.activitiesComplete ?? false, span.from),
		canGoForward: route.offset < 0,
		title: DAILY_TOTALS,
		chart: { bars, ticks, top: ticks[0]!, axis: dayAxis(daysOf(span)) },
		legend: LOAD_GROUPS.map((group) => ({ group, label: GROUP_LABELS[group] })),
		list: exerciseRows(rows, span, ctx.units ?? "metric"),
	};
}

/* ------------------------------------------------------------------ */
/*  Training Load                                                      */
/* ------------------------------------------------------------------ */

/** The route's `sub` on Load Ratio. */
export const RATIO_SUB = "ratio";
/** The route's `sub` on Acute Load with the Chronic Load chip on. */
export const CHRONIC_SUB = "chronic";

/** Training Load's view a route's `sub` names: Load Ratio, else Acute Load. */
export function segmentOf(sub: string | undefined): TrainingSegment {
	return sub === RATIO_SUB ? "ratio" : "acute";
}

/** Whether a route's `sub` has the Chronic Load chip on (Acute Load only). */
export function chronicOf(sub: string | undefined): boolean {
	return sub === CHRONIC_SUB;
}

/**
 * The route on a view, the chip on or off: the segmented control's and the
 * chip's taps. Load Ratio has no chip, so Acute Load reopens with it off.
 */
export function withTrainingView<R extends { sub?: string }>(route: R, segment: TrainingSegment, chronic = false): R {
	const { sub: _sub, ...rest } = route;
	const sub = segment === "ratio" ? RATIO_SUB : chronic ? CHRONIC_SUB : undefined;
	return (sub ? { ...rest, sub } : rest) as R;
}

/** The optimal band, as fractions of the chronic load (Garmin's `min`/`maxTrainingLoadChronic`), and Load Ratio's rectangle. */
export const BAND = { low: 0.8, high: 1.5 } as const;

/**
 * Load Ratio's y axis, fixed: linear from 0 to 2.3 (the web gauge's "Data
 * ranges from 0 to 2.3"), its lines and labels together at 0, 0.8, 1.5 and
 * 2.3, which reads "2+". A ratio past 2.3 is drawn at the top (Inferred:
 * the history's highest is 2.1).
 */
export const RATIO_AXIS: MarkedAxis = (() => {
	const marks: Array<[number, string]> = [
		[2.3, "2+"],
		[1.5, "1.5"],
		[0.8, "0.8"],
		[0, "0"],
	];
	return {
		top: 2.3,
		grid: marks.map(([value]) => ({ value, at: value / 2.3 })),
		labels: marks.map(([value, text]) => ({ value, at: value / 2.3, text })),
	};
})();

/** A day's value across the plot; null where the day has none, which breaks the line. */
export interface SeriesPoint {
	x: number;
	value: number | null;
}

/** Acute Load's chart. */
export interface AcuteChart {
	segment: "acute";
	/** 0 to 1.5 × the period's largest acute load, lines at its thirds, labels at their own values (`acuteAxis`). */
	axis: MarkedAxis;
	/** The acute load a day: the white line and its dots. */
	acute: SeriesPoint[];
	/** The chronic load a day, with the chip on: the orange line and its squares. */
	chronic?: SeriesPoint[];
	/** A day's band, 0.8× to 1.5× its chronic load, joined straight from the first day to the last; null for a day without one. */
	band: Array<{ x: number; low: number; high: number } | null>;
	/** The chip is on: the band turns flat grey and the acute series grey; nothing moves. */
	muted: boolean;
	/** A dot a day, the ends large and labelled. */
	axisX: PeriodAxis;
}

/** Load Ratio's chart. */
export interface RatioChart {
	segment: "ratio";
	axis: MarkedAxis;
	/** Garmin's ratio a day, 1 dp as sent (not acute ÷ chronic); null for a day without one, a gap. */
	ratio: SeriesPoint[];
	/** The band: the rectangle from 0.8 to 1.5, green. */
	band: { low: number; high: number };
	axisX: PeriodAxis;
}

/** A legend entry: Optimal Range, Acute Load, Chronic Load, Load Ratio. */
export interface LegendItem {
	key: "optimal" | "acute" | "chronic" | "ratio";
	label: string;
	/** Chronic Load's mark is a square, the rest dots. */
	shape: "dot" | "square";
	/** Drawn grey: the band and the acute load with the chip on, and Load Ratio's Optimal Range, whose band stays green. */
	muted: boolean;
}

export interface TrainingTabView extends TabView {
	tab: "training";
	range: SpanRange;
	from: string;
	to: string;
	segment: TrainingSegment;
	/** The segmented control: Acute Load, Load Ratio. A tap swaps to `withTrainingView(route, id)`. */
	segments: Array<{ id: TrainingSegment; label: string; on: boolean }>;
	/** "4-Week Timeline". */
	title: string;
	/** Acute Load's Chronic Load chip; a tap swaps to `withTrainingView(route, "acute", !on)`. None on Load Ratio. */
	chip?: { label: string; on: boolean };
	/** Null for a period without a row. */
	chart: AcuteChart | RatioChart | null;
	legend: LegendItem[];
	/** The row the status speaks for: the period's newest. */
	date?: string;
	/** "498 - Optimal" on Acute Load, "1.2 - Optimal" on Load Ratio. */
	status?: string;
	/** The copy under it, by the row's feedback key; none where its words are unseen. */
	copy?: string;
	/** The same, as the phone breaks it into lines. */
	copyLines?: readonly string[];
	/** Load Ratio's figures: the row's acute and chronic loads. */
	figures?: Array<{ value: string; label: string }>;
}

/**
 * Load Ratio's status: "1.2 - Optimal", the ratio to one decimal as Garmin
 * sends it (498 / 393 is 1.267, which Garmin truncates); the number alone
 * for `NONE` (Inferred), "--" without a ratio.
 */
export function ratioValue(row: Pick<TrainingStatusRow, "ratio" | "acwr"> | undefined): string {
	if (row?.ratio === undefined) return DASH;
	const word = row.acwr ? LOAD_WORDS[row.acwr.trim().toUpperCase()] : undefined;
	const value = row.ratio.toFixed(1);
	return word ? `${value} - ${word}` : value;
}

/** The legend: Acute Load's two, three with the chip on (the first two grey); Load Ratio's grey Optimal Range and its line. */
export function legendOf(segment: TrainingSegment, chronic: boolean): LegendItem[] {
	if (segment === "ratio") {
		return [
			{ key: "optimal", label: OPTIMAL_RANGE, shape: "dot", muted: true },
			{ key: "ratio", label: LOAD_RATIO, shape: "dot", muted: false },
		];
	}
	const items: LegendItem[] = [
		{ key: "optimal", label: OPTIMAL_RANGE, shape: "dot", muted: chronic },
		{ key: "acute", label: ACUTE_LOAD, shape: "dot", muted: chronic },
	];
	if (chronic) items.push({ key: "chronic", label: CHRONIC_LOAD, shape: "square", muted: false });
	return items;
}

/** A whole load as a figure: "498"; "--" without one. */
function figure(value: number | undefined): string {
	return value === undefined ? DASH : value.toLocaleString();
}

/**
 * Training Load over the route's 4w period: a slot a day, today's empty
 * before the watch syncs, and the status of the period's newest row.
 */
export function trainingView(route: TrainingLoadRoute, ctx: TrainingLoadContext): TrainingTabView {
	const { span, label } = loadPeriod(route, ctx.today);
	const rows = ctx.status ?? [];
	const segment = segmentOf(route.sub);
	const chronic = segment === "acute" && chronicOf(route.sub);
	const days = daysOf(span);
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const slots = days.map((day) => byDate.get(day));
	const x = (i: number) => spread(i, days.length);
	let last: TrainingStatusRow | undefined;
	for (const row of slots) if (row) last = row;

	const view: TrainingTabView = {
		tab: "training",
		range: "4w",
		from: span.from,
		to: span.to,
		label,
		steppers: true,
		canGoBack: canStepBack(oldestDay(rows.map((r) => r.date)), ctx.statusComplete ?? false, span.from),
		canGoForward: route.offset < 0,
		segment,
		segments: [
			{ id: "acute", label: ACUTE_LOAD, on: segment === "acute" },
			{ id: "ratio", label: LOAD_RATIO, on: segment === "ratio" },
		],
		title: TIMELINE,
		chart: null,
		legend: legendOf(segment, chronic),
	};
	if (segment === "acute") view.chip = { label: CHRONIC_LOAD, on: chronic };
	if (!last) {
		view.empty = NO_DATA;
		return view;
	}
	view.date = last.date;
	const axisX = dayAxis(days);
	if (segment === "acute") {
		const acutes = slots.flatMap((r) => (r?.acute === undefined ? [] : [r.acute]));
		const chart: AcuteChart = {
			segment,
			axis: acuteAxis(acutes.length ? Math.max(...acutes) : undefined),
			acute: slots.map((r, i) => ({ x: x(i), value: r?.acute ?? null })),
			band: slots.map((r, i) => (r?.chronic === undefined ? null : { x: x(i), low: r2(BAND.low * r.chronic), high: r2(BAND.high * r.chronic) })),
			muted: chronic,
			axisX,
		};
		if (chronic) chart.chronic = slots.map((r, i) => ({ x: x(i), value: r?.chronic ?? null }));
		view.chart = chart;
		view.status = loadValue(last);
	} else {
		view.chart = { segment, axis: RATIO_AXIS, ratio: slots.map((r, i) => ({ x: x(i), value: r?.ratio ?? null })), band: { ...BAND }, axisX };
		view.status = ratioValue(last);
		view.figures = [
			{ value: figure(last.acute), label: ACUTE_LOAD },
			{ value: figure(last.chronic), label: CHRONIC_LOAD },
		];
	}
	const lines = loadCopyLines(segment, last.acwrFeedback);
	if (lines) {
		view.copy = lines.join(" ");
		view.copyLines = lines;
	}
	return view;
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export type TrainingLoadPageView = FocusTabView | ExerciseTabView | TrainingTabView;

/** The page on its route's tab. */
export function trainingLoadView(route: TrainingLoadRoute, ctx: TrainingLoadContext): TrainingLoadPageView {
	switch (loadTab(route.tab)) {
		case "exercise":
			return exerciseView(route, ctx);
		case "training":
			return trainingView(route, ctx);
		default:
			return focusView(ctx);
	}
}
