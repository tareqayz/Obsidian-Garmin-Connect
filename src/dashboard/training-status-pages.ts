import type { HrvStatusRow } from "../sync/hrv-status-index";
import type { TrainingStatusRow } from "../sync/training-status-index";
import type { Vo2MaxRow } from "../sync/vo2-max-index";
import { latestWith, num, rowOn, shortDate, str } from "./day";
import type { Sex } from "./gauges";
import { statusLook } from "./hrv-status-copy";
import { axisDay, canStepBack, dayLabel, daysBetween, daysOf, periodLabel, type PeriodRange, type Span, type SpanRange } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { performanceStatRoute, type PerformanceStatRoute } from "./routes";
import { shiftDate, type DayRow } from "./series";
import { statPeriodLabel, statSpan } from "./stat-registry";
import {
	LOAD_WORDS,
	NO_DATA,
	NO_STATUS_YET,
	STATUS_BY_CODE,
	STATUS_ICON,
	STATUS_WORDS,
	basedOnLine,
	loadFocusLine,
	statusCopy,
	statusOfPhrase,
	type TrainingStatusIcon,
	type TrainingStatusKey,
} from "./training-status-copy";
import { readingsOf, vo2Dial, type Vo2Tab } from "./vo2-max-pages";

/**
 * Garmin Connect's Training Status page (Performance Stats), worked out from
 * the training status index (`src/sync/training-status-index.ts`), the day
 * files, and the VO₂ Max and HRV Status indexes. Rules measured on the phone
 * on 2026-10-11 (ref/performance-stats/training-status/README.md):
 *
 * - Current is the index's newest row on or before today, whatever the
 *   route's offset (there is no date row): its status (the badge, the word),
 *   "Load Focus - …" from the day file's `load_focus` that day, "Since …"
 *   (`sinceOf`: the run's first day, at most 13 days back, as Garmin's
 *   `sinceDate` on 435 of 435 days), "Based on your Running VO₂ Max Trend",
 *   the coaching copy, and four rows that open VO₂ Max, HRV Status, Load and
 *   Heat Acclimation.
 * - 4w, 12w and 6m are the registry's `{days}` spans (28, 84, 182 days to
 *   today) and draw every day: the period's days walked oldest first, runs of
 *   one status code (a phrase change inside a code does not split one), a
 *   day without a row ending a run and leaving its slot empty, runs clipped
 *   to the period (`blocksOf`). 6m was not shot: it follows the same daily
 *   rule, the spec's recommendation (Inferred).
 * - Seven x labels, label i dated start + (2i + 1)·N/14 days, centred at that
 *   fraction of the day space (`axisOf`).
 * - The table lists the runs newest first: "Since Oct 11" for the current
 *   period's newest, "Sunday, August 23" for a single day, "Oct 6 - 10" for
 *   a longer run (`runDates`).
 * - Tapping a row selects its run: the route's `sub` names it ("run:" and its
 *   first day in the period). That run's block stays full height, the rest
 *   drop to a foot, and every other row dims.
 *
 * Inferred (unseen on the phone): 6m, previous periods, the copy of 27 of the
 * 28 phrases, the badge of other statuses, No Status and Paused, "Based on"
 * for cycling, the Load Focus words but one, the load words but "Optimal", a
 * morning before today's row, a missing day in the strip, and clearing a
 * selection. The strip's geometry is `training-status-charts.ts`'s.
 *
 * Pure.
 */

/** What the page's route says: the range, how many periods back, and the selected run. */
export interface TrainingStatusRoute {
	range: PeriodRange;
	offset: number;
	/** The selected run: "run:2026-10-06" (`runSub`). */
	sub?: string;
}

/** What the view needs besides the route and the index's rows. */
export interface TrainingStatusContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** The day files (`readDays()`), oldest first: Current's `load_focus`, and the heat % until Heat Acclimation has a source of its own. */
	days?: readonly DayRow[];
	/** The VO₂ Max index's rows: the VO₂ Max row. */
	vo2?: readonly Vo2MaxRow[];
	/** Who a VO₂ Max reading is graded for (`vo2Person`); without both the row has no class. */
	age?: number;
	sex?: Sex;
	/** The HRV Status index's rows: the HRV Status row. */
	hrv?: readonly HrvStatusRow[];
	/** The newest heat % on or before today from a heat source, when the page has one; the day files' otherwise. */
	heat?: { date: string; pct: number } | null;
}

const TRAINING_STATUS_STAT = PERFORMANCE_REGISTRY.page("training-status")!;
const DASH = "--";

/** How far back Current's "Since" reaches: the day and the 13 before it. */
export const SINCE_DAYS = 13;

/* ------------------------------------------------------------------ */
/*  Statuses                                                           */
/* ------------------------------------------------------------------ */

/**
 * A row's status: Paused while Garmin's is (Inferred: never seen), else its
 * code's, else its phrase's; No Status for a row with neither.
 */
export function statusOf(row: Pick<TrainingStatusRow, "code" | "phrase" | "paused"> | undefined): TrainingStatusKey {
	if (!row) return "none";
	if (row.paused) return "paused";
	return (row.code !== undefined ? STATUS_BY_CODE[row.code] : undefined) ?? statusOfPhrase(row.phrase) ?? "none";
}

/** The index's newest row on or before `today`: Current's. */
export function currentRow(rows: readonly TrainingStatusRow[], today: string): TrainingStatusRow | undefined {
	for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.date <= today) return rows[i];
	return undefined;
}

/**
 * Current's "Since": the first day of the run `date` is in — consecutive
 * days with rows and the same status, a day without a row ending it — but
 * never more than 13 days before `date`. Garmin's `sinceDate` follows this on
 * all 435 days: Sep 5, 2025 says Aug 23 though the run began Aug 22, and
 * Aug 9, 2025 says Aug 9 after the missing Aug 8. Undefined without a row on
 * `date`.
 */
export function sinceOf(byDate: ReadonlyMap<string, TrainingStatusRow>, date: string): string | undefined {
	const row = byDate.get(date);
	if (!row) return undefined;
	const status = statusOf(row);
	const floor = shiftDate(date, -SINCE_DAYS);
	let first = date;
	while (first > floor) {
		const before = byDate.get(shiftDate(first, -1));
		if (!before || statusOf(before) !== status) break;
		first = shiftDate(first, -1);
	}
	return first;
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

/** A row under Current: its title, its value, and the page it opens. */
export interface TrainingStatusFactor {
	id: "vo2-max" | "hrv-status" | "load" | "heat";
	title: string;
	/** "55 - Excellent", "84 ms - Balanced", "498 - Optimal", "97%"; "--" without a reading (Inferred). */
	value: string;
	route: PerformanceStatRoute;
}

export interface TrainingStatusCurrentView {
	range: "1d";
	/** Current has no date row. */
	label: null;
	canGoBack: false;
	/** The Current row's day; none without any row. */
	date?: string;
	/** The badge's colour (`PERFORMANCE_STATUS_COLOR`) and the word under it. */
	status: TrainingStatusKey;
	word: string;
	/** The badge's glyph. */
	icon: TrainingStatusIcon;
	/** "Load Focus - Low Aerobic Shortage"; none without a phrase that day. */
	focus?: string;
	/** "Since Oct 11". */
	since?: string;
	/** "Based on your Running VO₂ Max Trend"; none without a trend sport. */
	basedOn?: string;
	/** The coaching copy; none for a phrase whose wording is unseen. */
	copy?: string;
	/** VO₂ Max, HRV Status, Load and Heat Acclimation. */
	factors: TrainingStatusFactor[];
	/** Without any row: "How to Get Training Status" in place of the copy (Inferred). */
	empty?: typeof NO_STATUS_YET;
}

/** The VO₂ Max tab a trend's sport reads: Cycling's for a cycling trend (Inferred), else the running one. */
export function trendTab(sport: string | undefined): Vo2Tab {
	return sport?.trim().toUpperCase() === "CYCLING" ? "cycling" : "running";
}

/** The VO₂ Max row: the VO₂ Max page's Current for the tab, "55 - Excellent"; the number alone without a class. */
export function vo2Value(rows: readonly Vo2MaxRow[], tab: Vo2Tab, ctx: Pick<TrainingStatusContext, "today" | "age" | "sex">): string {
	const readings = readingsOf(rows, tab).filter((r) => r.date <= ctx.today);
	const latest = readings[readings.length - 1];
	if (!latest) return DASH;
	const { gauge } = vo2Dial(latest, ctx);
	return gauge.label ? `${gauge.value} - ${gauge.label}` : gauge.value;
}

/** The HRV Status row: the index's newest row, "84 ms - Balanced"; the average alone without a status (onboarding). */
export function hrvValue(rows: readonly HrvStatusRow[], today: string): string {
	let row: HrvStatusRow | undefined;
	for (let i = rows.length - 1; i >= 0 && !row; i--) if (rows[i]!.date <= today) row = rows[i];
	if (row?.weekly === undefined) return DASH;
	const word = statusLook(row.status)?.word;
	return word ? `${row.weekly} ms - ${word}` : `${row.weekly} ms`;
}

/** The Load row: the Current row's acute load and its status, "498 - Optimal"; the number alone for `NONE`. */
export function loadValue(row: Pick<TrainingStatusRow, "acute" | "acwr"> | undefined): string {
	if (row?.acute === undefined) return DASH;
	const word = row.acwr ? LOAD_WORDS[row.acwr.trim().toUpperCase()] : undefined;
	return word ? `${row.acute} - ${word}` : String(row.acute);
}

/** The Heat Acclimation row: the newest heat % on or before today, "97%". */
export function heatValue(ctx: Pick<TrainingStatusContext, "today" | "days" | "heat">): string {
	const pct = ctx.heat && ctx.heat.date <= ctx.today ? ctx.heat.pct : num(latestWith(ctx.days ?? [], ctx.today, "heat_acclimation_pct"), "heat_acclimation_pct");
	return pct === undefined ? DASH : `${pct}%`;
}

/** The four rows under Current, each opening its page as the phone did: VO₂ Max's Current, HRV Status 1d, Load on Load Focus, Heat Acclimation 1d. */
export function factorsOf(row: TrainingStatusRow | undefined, ctx: TrainingStatusContext): TrainingStatusFactor[] {
	const tab = trendTab(row?.trendSport);
	return [
		{
			id: "vo2-max",
			title: "VO₂ Max",
			value: vo2Value(ctx.vo2 ?? [], tab, ctx),
			route: performanceStatRoute("vo2-max", tab === "cycling" ? { range: "1d", tab } : { range: "1d" }),
		},
		{ id: "hrv-status", title: "HRV Status", value: hrvValue(ctx.hrv ?? [], ctx.today), route: performanceStatRoute("hrv-status", { range: "1d" }) },
		{ id: "load", title: "Load", value: loadValue(row), route: performanceStatRoute("training-load", { range: "4w", tab: "focus" }) },
		{ id: "heat", title: "Heat Acclimation", value: heatValue(ctx), route: performanceStatRoute("heat-acclimation", { range: "1d" }) },
	];
}

/** Current: the newest row on or before today, whatever the route's offset. */
export function currentView(rows: readonly TrainingStatusRow[], ctx: TrainingStatusContext): TrainingStatusCurrentView {
	const row = currentRow(rows, ctx.today);
	const status = statusOf(row);
	const view: TrainingStatusCurrentView = {
		range: "1d",
		label: null,
		canGoBack: false,
		status,
		word: STATUS_WORDS[status],
		icon: STATUS_ICON,
		factors: factorsOf(row, ctx),
	};
	if (!row) {
		view.empty = NO_STATUS_YET;
		return view;
	}
	view.date = row.date;
	const focus = loadFocusLine(str(rowOn(ctx.days ?? [], row.date), "load_focus"));
	if (focus) view.focus = focus;
	const since = sinceOf(new Map(rows.map((r) => [r.date, r])), row.date);
	if (since) view.since = `Since ${shortDate(since)}`;
	const basedOn = basedOnLine(row.trendSport);
	if (basedOn) view.basedOn = basedOn;
	const copy = statusCopy(row.phrase);
	if (copy) view.copy = copy;
	return view;
}

/* ------------------------------------------------------------------ */
/*  4w, 12w and 6m                                                     */
/* ------------------------------------------------------------------ */

/**
 * A stretch of the period's days: a run of one status, or days without a
 * row (`status` null, an empty slot). Day `start` of the period is its first.
 */
export interface StatusBlock {
	/** Days into the period of its first day, and how many days it spans. */
	start: number;
	days: number;
	/** Its first and last day, clipped to the period. */
	from: string;
	to: string;
	status: TrainingStatusKey | null;
	/** A run's key, "run:2026-10-06": what selecting it puts in the route's `sub`. */
	key?: string;
}

/** A run's row in the table. */
export interface StatusTableRow {
	key: string;
	status: TrainingStatusKey;
	/** "Maintaining". */
	word: string;
	/** "Since Oct 11", "Oct 6 - 10", "Sunday, August 23". */
	dates: string;
	selected: boolean;
	/** Another row is selected: this one is drawn at half opacity over the table. */
	dimmed: boolean;
}

export interface TrainingStatusPeriodView {
	range: SpanRange;
	from: string;
	to: string;
	/** The period's days, N: 28, 84, 182. A day is 1/N of the strip's day space. */
	days: number;
	/** "Sep 14 - Oct 11". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** The strip, oldest first; `selected` is the selected run's block. Null for a period without a row. */
	strip: { blocks: StatusBlock[]; selected?: number } | null;
	/** Seven "MM-DD" labels, `x` their centre as a fraction of the day space. */
	axis: Array<{ date: string; text: string; x: number }>;
	/** A row a run, newest first. */
	table: StatusTableRow[];
	/** The selected run's key, when the route's `sub` names a run of this period. */
	selected?: string;
	empty?: typeof NO_DATA;
}

const RUN_SUB = /^run:(\d{4}-\d{2}-\d{2})$/;

/** A run's key, by its first day in the period: "run:2026-10-06". */
export function runSub(from: string): string {
	return `run:${from}`;
}

/** The first day a route's `sub` names, `YYYY-MM-DD`; undefined for any other sub-page. */
export function runOfSub(sub: string | undefined): string | undefined {
	return sub === undefined ? undefined : RUN_SUB.exec(sub)?.[1];
}

/**
 * The route with a run selected, or none: a row's tap is
 * `withSelection(route, row.selected ? null : row.key)`, so a second tap
 * clears it (Inferred). A range or a period step should clear it too
 * (Inferred): the shell keeps `sub`, so the page drops it as it moves.
 */
export function withSelection<R extends { sub?: string }>(route: R, key: string | null): R {
	const { sub: _sub, ...rest } = route;
	return (key ? { ...rest, sub: key } : rest) as R;
}

/**
 * The period's days, oldest first, as blocks: consecutive days with rows and
 * the same status make a run (Productive Sep 9 – 20 holds PRODUCTIVE_3 and
 * _5); a day without a row ends it, and days without rows make an empty
 * block of their own. Runs are clipped to the period.
 */
export function blocksOf(byDate: ReadonlyMap<string, TrainingStatusRow>, span: Span): StatusBlock[] {
	const blocks: StatusBlock[] = [];
	daysOf(span).forEach((day, i) => {
		const row = byDate.get(day);
		const status = row ? statusOf(row) : null;
		const last = blocks[blocks.length - 1];
		if (last && last.status === status) {
			last.days += 1;
			last.to = day;
		} else {
			blocks.push(status === null ? { start: i, days: 1, from: day, to: day, status } : { start: i, days: 1, from: day, to: day, status, key: runSub(day) });
		}
	});
	return blocks;
}

/** Seven labels: label i dated start + (2i + 1)·N/14 days and centred at (2i + 1)/14 of the day space. */
export function axisOf(span: Span): TrainingStatusPeriodView["axis"] {
	const n = daysBetween(span.from, span.to) + 1;
	return Array.from({ length: 7 }, (_, i) => {
		const date = shiftDate(span.from, Math.floor(((2 * i + 1) * n) / 14));
		return { date, text: axisDay(date), x: (2 * i + 1) / 14 };
	});
}

/**
 * A run's dates in the table: "Since Oct 11" for the newest run of the
 * current period, even a single day's; "Sunday, August 23" for a single day;
 * "Oct 6 - 10" or "Sep 23 - Oct 2" for a longer one, with the year in
 * another year ("Dec 28-29, 2025", "Friday, December 12, 2025").
 */
export function runDates(run: Pick<StatusBlock, "from" | "to">, sinceLabel: boolean, today: string): string {
	if (sinceLabel) return `Since ${shortDate(run.from)}`;
	return run.from === run.to ? dayLabel(run.from, today) : periodLabel(run.from, run.to, today);
}

/** 4w, 12w and 6m. */
export function periodView(route: TrainingStatusRoute, rows: readonly TrainingStatusRow[], ctx: TrainingStatusContext): TrainingStatusPeriodView {
	const range = route.range as SpanRange;
	const at = { range, offset: route.offset };
	const span = statSpan(TRAINING_STATUS_STAT, at, ctx.today)!;
	const blocks = blocksOf(new Map(rows.map((r) => [r.date, r])), span);
	const runs = blocks.filter((b): b is StatusBlock & { status: TrainingStatusKey; key: string } => b.status !== null);
	const picked = runOfSub(route.sub);
	const selected = picked !== undefined ? runs.find((r) => r.from === picked)?.key : undefined;
	const current = route.offset >= 0;

	const view: TrainingStatusPeriodView = {
		range,
		from: span.from,
		to: span.to,
		days: daysBetween(span.from, span.to) + 1,
		label: statPeriodLabel(TRAINING_STATUS_STAT, at, ctx.today),
		canGoBack: canStepBack(rows[0]?.date, ctx.complete, span.from),
		canGoForward: route.offset < 0,
		strip: null,
		axis: axisOf(span),
		table: [...runs].reverse().map((run, i) => ({
			key: run.key,
			status: run.status,
			word: STATUS_WORDS[run.status],
			dates: runDates(run, current && i === 0, ctx.today),
			selected: run.key === selected,
			dimmed: selected !== undefined && run.key !== selected,
		})),
	};
	if (!runs.length) {
		view.empty = NO_DATA;
		return view;
	}
	view.strip = { blocks };
	if (selected !== undefined) {
		view.selected = selected;
		view.strip.selected = blocks.findIndex((b) => b.key === selected);
	}
	return view;
}

export type TrainingStatusView = TrainingStatusCurrentView | TrainingStatusPeriodView;

/** The page, on its route's range. */
export function trainingStatusView(route: TrainingStatusRoute, rows: readonly TrainingStatusRow[], ctx: TrainingStatusContext): TrainingStatusView {
	return route.range === "1d" ? currentView(rows, ctx) : periodView(route, rows, ctx);
}
