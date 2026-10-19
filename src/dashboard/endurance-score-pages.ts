import { decodeContributors, type EnduranceDay, type EnduranceScoreRow } from "../sync/endurance-score-index";
import type { ActivityRow } from "../sync/activity-index";
import { categoryFor, categoryOf, typeLabel, type CategoryId } from "./activities";
import { latestWith, num } from "./day";
import { ENDURANCE_HELP, HELP_CLASSES_INTRO, HELP_TITLE, endurancePhrase, type EnduranceHelpSection } from "./endurance-score-copy";
import { ENDURANCE_CLASSES, enduranceGauge, type EnduranceScale, type Gauge, type Sex } from "./gauges";
import {
	MONTHS,
	SHORT_MONTHS,
	axisDay,
	canStepBack,
	dayLabel,
	dayOf,
	daysBetween,
	daysOf,
	lastDayOfMonth,
	meanOf,
	monthLabel,
	periodLabel,
	shiftMonth,
	weekStartOf,
	type PeriodAxis,
	type PeriodRange,
	type Span,
} from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { shiftDate, type DayRow } from "./series";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { NO_DATA, NO_READING } from "./vo2-max-pages";

/**
 * Garmin Connect's Endurance Score page (Performance Stats), worked out from
 * the endurance-score index (`src/sync/endurance-score-index.ts`) and, for the
 * dial's scale, the day files. Rules measured on the phone and the web on
 * 2026-10-11 (ref/performance-stats/endurance-score/README.md):
 *
 * - Two tabs on every range, Endurance Score (`score`) and Top Contributors
 *   (`contributors`); switching makes no call, so the view works out both.
 * - 1d is a day: the score on the 300° dial, linear from the gauge's low end
 *   to its high end with its band edges at the six class limits
 *   (`enduranceGauge` on `DIAL_KINDS.endurance`), Garmin's class under it and
 *   the feedback phrase under that; on the other tab a full ring of the day's
 *   categories round the score, a legend and the list.
 * - 12w plots one point per Monday week the span touches and 1y one per
 *   calendar month, each the floored mean of its scored days inside the span,
 *   at its Monday or 1st on an axis that runs by days from the first period's
 *   start to the day after the span. Avg Score is the floored mean of the
 *   points, not of the days (the 1y's 7,179 against 7,177); Max Score the
 *   span's best day (8,582), not its best point. Garmin's own groups are these
 *   means on 169 of 169.
 * - The score tab's y axis runs from the lowest point − 500 to the highest
 *   + 500 in five even ticks, labelled half up; the contributors tab's from 0
 *   to round((highest + 500) / 100) × 100.
 * - A period's contributors are each entry's mean daily share over its days
 *   with a list (a calibrating day counts, as Miscellaneous 100%). The list
 *   keeps the top three categories by share, largest first, folds the rest
 *   into Miscellaneous, which always comes last, and lists Gym & Fitness
 *   Equipment's activity types under it. Percentages round half up to two
 *   decimals with trailing zeros dropped; a category shows its raw sum
 *   rounded, not the sum of its rounded rows (4.64%, not 4.65%).
 * - The legend lists the categories any period keeps in a fixed order —
 *   Running, Cycling, Gym & Fitness Equipment, Swimming, Hiking, the Activities
 *   hub's — then Miscellaneous. The bars stack each period's list from
 *   Miscellaneous at the bottom to its largest category on top, each segment
 *   its share of the period's average; the ring runs the day's list clockwise
 *   from 12 o'clock, a 3.45° gap centred on every boundary.
 *
 * Inferred (unseen on the phone): the 1y score tab (the 12w's with monthly
 * points), previous periods, a weekday's spans (the registry's rolling
 * defaults), the copy for every phrase but 55, the class words but Trained,
 * a calibrating day (the bands without a number or marker, Miscellaneous
 * 100% in the ring without a number), a 0% Miscellaneous (its row "0%", no
 * segment), a day or period without data (the no-data line; no point, bar or
 * list block), unseen groups and types, and the Help sheet.
 *
 * The charts' geometry, the ring's arcs and the categories' colours are
 * `endurance-score-charts.ts`, off the Obsidian twin (430:6128).
 *
 * Pure.
 */

export type EnduranceTab = "score" | "contributors";

/** The tabs in the phone's order: the first is where the page opens. */
export const ENDURANCE_TABS: ReadonlyArray<{ id: EnduranceTab; label: string }> = [
	{ id: "score", label: "Endurance Score" },
	{ id: "contributors", label: "Top Contributors" },
];

/** What the page's route says: the range, how many periods back, the tab. */
export interface EnduranceScoreRoute {
	range: PeriodRange;
	offset: number;
	tab?: string;
}

/** An activity type as the activity index knows it: its key and the type above it. */
export type ActivityTypeRow = Pick<ActivityRow, "type" | "typeId" | "parentTypeId">;

/** What the view needs besides the route and the index's rows. */
export interface EnduranceScoreContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** The day files (`readDays()`), oldest first: the dial's scale (`enduranceScaleOf`). */
	days?: readonly DayRow[];
	/** The 1d day's `ENDURANCE_DAY` block, once loaded: its phrase where the row has none, its scale where the day files have none. */
	day?: EnduranceDay | null;
	/** The activity index's rows: what an activity type Garmin lists is, where this page does not know it (`placeOf`). */
	activities?: readonly ActivityTypeRow[];
}

export const DASH = "--";

/** The ring's gap, in degrees, centred on every boundary between two categories. */
export const RING_GAP = 3.45;

const STAT = PERFORMANCE_REGISTRY.page("endurance-score")!;

/** A score or an axis label with Garmin's thousands separator: "6,413". */
export const scoreText = (n: number) => n.toLocaleString("en-US");

/** The tab a route names: Top Contributors, or the first. */
export function enduranceTab(tab: string | undefined): EnduranceTab {
	return tab === "contributors" ? "contributors" : "score";
}

/* ------------------------------------------------------------------ */
/*  Classes, the scale and the dial                                    */
/* ------------------------------------------------------------------ */

const SCALE_KEYS = [
	"endurance_intermediate_from",
	"endurance_trained_from",
	"endurance_well_trained_from",
	"endurance_expert_from",
	"endurance_superior_from",
	"endurance_elite_from",
] as const;

/**
 * The dial's scale for a day, from the day files (`metrics.ts` writes it from
 * the same payload on every synced day): the newest row on or before the day
 * that has it, else the newest that has it at all. Per account, by age band
 * and sex; it never changed in this history (3,570 / 5,100 / 5,800 / 6,600 /
 * 7,300 / 8,100 / 8,800 / 10,560). Undefined without one.
 */
export function enduranceScaleOf(days: readonly DayRow[], date: string): EnduranceScale | undefined {
	let row = latestWith(days, date, "endurance_gauge_low");
	for (let i = days.length - 1; !row && i >= 0; i--) if (num(days[i], "endurance_gauge_low") !== undefined) row = days[i];
	if (!row) return undefined;
	return { low: num(row, "endurance_gauge_low"), high: num(row, "endurance_gauge_high"), limits: SCALE_KEYS.map((key) => num(row, key)) };
}

/** A day block's scale, where it has the whole of one. */
function scaleOfDay(day: EnduranceDay | null | undefined): EnduranceScale | undefined {
	return day?.low !== undefined && day.high !== undefined && day.limits?.length === 6 ? { low: day.low, high: day.high, limits: day.limits } : undefined;
}

/** Whether a scale has both ends and all six limits. */
function wholeScale(scale: EnduranceScale | undefined): scale is Required<EnduranceScale> {
	return scale?.low !== undefined && scale.high !== undefined && scale.limits?.length === 6 && scale.limits.every((v) => v !== undefined);
}

/**
 * A day's class word: Garmin's (`classId`, 1–7), else its score's by the
 * scale's limits, 1 + the limits at or below it (all 422 scored days agree).
 * "Well-Trained" stays `ENDURANCE_CLASSES`' until a phone shot settles it
 * (the web writes "Well-trained"). None while calibrating.
 */
export function enduranceClassWord(row: Pick<EnduranceScoreRow, "score" | "classId"> | undefined, scale?: EnduranceScale): string | undefined {
	const id = row?.classId;
	if (id !== undefined && id >= 1 && id <= ENDURANCE_CLASSES.length) return ENDURANCE_CLASSES[id - 1];
	if (row?.score === undefined || !wholeScale(scale)) return undefined;
	return ENDURANCE_CLASSES[scale.limits.filter((limit) => row.score! >= limit!).length];
}

/**
 * The page's dial for a day: the score over its class, the seven bands with
 * their edges at the class limits, and the marker at (score − low) / (high −
 * low) in its band's colour (6,413 → 0.4067 → −27.98°, measured −28.03°).
 * Without a score (a calibrating day) the bands alone, "--" in the middle.
 * Without a scale, `enduranceGauge`'s even sevenths.
 */
export function enduranceDialGauge(score: number | undefined, scale: EnduranceScale | undefined, classId?: number): Gauge {
	if (score === undefined) return { value: DASH, segments: enduranceGauge(scale?.low ?? 0, scale ?? {}).segments };
	return { ...enduranceGauge(score, scale ?? {}, classId), value: scoreText(score) };
}

/* ------------------------------------------------------------------ */
/*  Contributors                                                       */
/* ------------------------------------------------------------------ */

/**
 * A contributor category: a list row, a ring slice, a bar segment and a
 * legend item. The Activities hub's categories (Other is Miscellaneous here),
 * and `type-<id>` for an activity type at the top of Garmin's tree that is
 * none of them (Inferred).
 */
export type EnduranceCategoryId = HubCategory | "misc" | `type-${number}`;

/** The Activities hub's categories but Other. */
type HubCategory = Exclude<CategoryId, "other">;

/** Where an entry goes: its category and, under Gym & Fitness Equipment, its row's name. */
export interface EndurancePlace {
	category: EnduranceCategoryId;
	title: string;
	sub?: string;
}

/** Garmin's sport groups: 0, 1, 6 and 8 seen. Any other is Miscellaneous (Inferred). */
const GROUPS: Readonly<Record<number, HubCategory | "misc">> = { 0: "running", 1: "cycling", 6: "swimming", 8: "misc" };

/**
 * The activity types Garmin has listed: Hiking its own category, the rest
 * under Gym & Fitness Equipment with the app's names ("Stair Stepper" is
 * `stair_climbing`, which `typeLabel` would call "Stair Climbing").
 */
const TYPES: Readonly<Record<number, { category: HubCategory; sub?: string }>> = {
	3: { category: "hiking" },
	13: { category: "gym", sub: "Strength Training" },
	31: { category: "gym", sub: "Stair Stepper" },
	163: { category: "gym", sub: "Yoga" },
};

/** The top of Garmin's activity type tree ("all"): a type right under it is a category of its own. */
const ROOT_TYPE = 17;

/** The legend's fixed order: the Activities hub's, then other types by id, then Miscellaneous. */
const ORDER: readonly EnduranceCategoryId[] = ["running", "cycling", "gym", "swimming", "hiking", "multisport"];

function rankOf(id: EnduranceCategoryId): number {
	const i = ORDER.indexOf(id);
	if (i >= 0) return i;
	return id === "misc" ? Number.MAX_SAFE_INTEGER : ORDER.length + Number(id.slice(5));
}

const MISC_TITLE = "Miscellaneous";

function titleOf(id: HubCategory): string {
	return categoryFor(id).title;
}

/** What each activity type the activity index holds is: its key and the type above it. */
export function enduranceTypesOf(rows: readonly ActivityTypeRow[] | undefined): Map<number, ActivityTypeRow> {
	const out = new Map<number, ActivityTypeRow>();
	for (const row of rows ?? []) if (row.typeId !== undefined && !out.has(row.typeId)) out.set(row.typeId, row);
	return out;
}

/**
 * Where a contributor goes. Groups 0, 1 and 6 are Running, Cycling and
 * Swimming; group 8 Miscellaneous. Types 3, 13, 31 and 163 are known. Any
 * other type (Inferred) is placed by the activity index's row for it: under
 * Gym & Fitness Equipment by its name, in the hub category its branch is, or
 * as a category of its own when it sits at the top of Garmin's tree. An
 * unknown group, or a type the activity index has not seen, is Miscellaneous.
 */
export function placeOf(kind: "g" | "t", id: number, types?: ReadonlyMap<number, ActivityTypeRow>): EndurancePlace {
	const misc: EndurancePlace = { category: "misc", title: MISC_TITLE };
	if (kind === "g") {
		const category = GROUPS[id];
		return !category || category === "misc" ? misc : { category, title: titleOf(category) };
	}
	const known = TYPES[id];
	if (known) return { category: known.category, title: titleOf(known.category), ...(known.sub ? { sub: known.sub } : {}) };
	const row = types?.get(id);
	if (!row) return misc;
	const category = categoryOf({ type: row.type, typeId: id, parentTypeId: row.parentTypeId });
	if (category === "gym") return { category, title: titleOf(category), sub: typeLabel(row.type) };
	if (category !== "other") return { category, title: titleOf(category) };
	return row.parentTypeId === ROOT_TYPE ? { category: `type-${id}`, title: typeLabel(row.type) } : misc;
}

/** A share as the lists write it: half up to two decimals, trailing zeros dropped, "%" with no space ("93.3%", "4.4%", "0%"). */
export function percentText(share: number): string {
	return `${(Math.floor(share * 100 + 0.5) / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** A row of a contributor list: a category, or one of Gym & Fitness Equipment's types under it (`sub`). */
export interface EnduranceListRow {
	category: EnduranceCategoryId;
	/** "Running", "Stair Stepper", "Miscellaneous". */
	name: string;
	/** The raw share, in percent. */
	share: number;
	/** "93.54%". */
	text: string;
	/** An indented row under its category. */
	sub: boolean;
}

/** A period's (or a day's) contributors: the categories it keeps, largest first, and what Miscellaneous ends with. */
export interface EnduranceContributors {
	/** The top three categories by share, largest first, each with its raw share. */
	kept: Array<{ category: EnduranceCategoryId; title: string; share: number }>;
	/** Group 8 and every category past the third. */
	misc: number;
	/** The list: each kept category and its types, then Miscellaneous. Empty without a list. */
	rows: EnduranceListRow[];
}

/**
 * Entry means over days: each entry's share summed over the days that have a
 * list, divided by their number (a day without the entry counts 0). Keyed
 * `g0`, `t31`, in the order the entries first appear.
 */
export function sharesOf(lists: ReadonlyArray<string | undefined>): Map<string, number> {
	const sums = new Map<string, number>();
	let n = 0;
	for (const text of lists) {
		const entries = decodeContributors(text);
		if (!entries.length) continue;
		n += 1;
		for (const e of entries) {
			const key = `${e.kind}${e.id}`;
			sums.set(key, (sums.get(key) ?? 0) + e.share);
		}
	}
	return new Map([...sums].map(([key, sum]) => [key, sum / n]));
}

/**
 * The list for a period's entry shares: categories summed from their entries,
 * the top three other than Miscellaneous kept (a tie to the legend's order),
 * the rest folded into Miscellaneous, which comes last whatever its size
 * (January 2026: Cycling's 0.39% makes Miscellaneous 4.88%, after Gym's
 * 4.4%). A kept category's types follow it, largest first.
 */
export function contributorsOf(shares: ReadonlyMap<string, number>, types?: ReadonlyMap<number, ActivityTypeRow>): EnduranceContributors {
	const cats = new Map<EnduranceCategoryId, { title: string; share: number; subs: Array<{ name: string; share: number; id: number }> }>();
	for (const [key, share] of shares) {
		const kind = key[0] as "g" | "t";
		const id = Number(key.slice(1));
		const place = placeOf(kind, id, types);
		let cat = cats.get(place.category);
		if (!cat) cats.set(place.category, (cat = { title: place.title, share: 0, subs: [] }));
		cat.share += share;
		if (place.sub) cat.subs.push({ name: place.sub, share, id });
	}
	if (!cats.size) return { kept: [], misc: 0, rows: [] };
	let misc = cats.get("misc")?.share ?? 0;
	cats.delete("misc");
	const ranked = [...cats].sort((a, b) => b[1].share - a[1].share || rankOf(a[0]) - rankOf(b[0]));
	misc += ranked.slice(3).reduce((sum, [, cat]) => sum + cat.share, 0);
	const kept = ranked.slice(0, 3);
	const rows: EnduranceListRow[] = [];
	for (const [category, cat] of kept) {
		rows.push({ category, name: cat.title, share: cat.share, text: percentText(cat.share), sub: false });
		for (const s of [...cat.subs].sort((a, b) => b.share - a.share || a.id - b.id)) {
			rows.push({ category, name: s.name, share: s.share, text: percentText(s.share), sub: true });
		}
	}
	rows.push({ category: "misc", name: MISC_TITLE, share: misc, text: percentText(misc), sub: false });
	return { kept: kept.map(([category, cat]) => ({ category, title: cat.title, share: cat.share })), misc, rows };
}

/** A slice of the 1d ring, in degrees clockwise from 12 o'clock. */
export interface EnduranceRingSlice {
	category: EnduranceCategoryId;
	from: number;
	to: number;
}

/**
 * The 1d ring: the list's categories clockwise from 12 o'clock in list order,
 * Miscellaneous last, each its share × 360°, less half the gap at each end.
 * A slice the gap leaves nothing of (a 0% Miscellaneous) is not drawn
 * (Inferred). Running 1.73° → 335.02°, Gym 338.47° → 350.97°, Miscellaneous
 * 354.42° → 358.28°; measured 1.77 → 335.00, 338.48 → 351.07, 354.44 → 358.22.
 */
export function ringOf(contributors: EnduranceContributors): EnduranceRingSlice[] {
	const out: EnduranceRingSlice[] = [];
	let at = 0;
	for (const row of contributors.rows) {
		if (row.sub) continue;
		const sweep = row.share * 3.6;
		const from = at + RING_GAP / 2;
		const to = at + sweep - RING_GAP / 2;
		if (to > from) out.push({ category: row.category, from, to });
		at += sweep;
	}
	return out;
}

/** An item of the legend: a dot in the category's colour and its name. */
export interface EnduranceLegendItem {
	category: EnduranceCategoryId;
	title: string;
}

/** The legend: every category kept anywhere in the view, in the fixed order, then Miscellaneous; empty without a list. */
export function legendOf(lists: readonly EnduranceContributors[]): EnduranceLegendItem[] {
	const seen = new Map<EnduranceCategoryId, string>();
	let any = false;
	for (const list of lists) {
		if (!list.rows.length) continue;
		any = true;
		for (const k of list.kept) if (!seen.has(k.category)) seen.set(k.category, k.title);
	}
	if (!any) return [];
	const items = [...seen].map(([category, title]) => ({ category, title })).sort((a, b) => rankOf(a.category) - rankOf(b.category));
	return [...items, { category: "misc", title: MISC_TITLE }];
}

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

export interface EnduranceDayView {
	range: "1d";
	tab: EnduranceTab;
	date: string;
	/** "Today", "Saturday, October 10". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/**
	 * `scored`; `calibrating`, Garmin's first two weeks, a row without a score;
	 * `none`, no row at all: the watch has not synced the day yet, or the day
	 * is before the history.
	 */
	state: "scored" | "calibrating" | "none";
	/** The score in the dial and in the ring, "6,413"; none while calibrating. */
	value?: string;
	/** Garmin's class under it: "Trained". */
	classWord?: string;
	/** Endurance Score: the dial; the bands alone while calibrating; null without a row. */
	gauge: Gauge | null;
	/** The feedback phrase under the dial, where its copy is known. */
	copy?: string;
	/** The row has no phrase and no day block came with the view: the page loads `ENDURANCE_DAY` for the day. */
	wantsDay: boolean;
	/** Top Contributors: the ring, its legend and the list. */
	ring: EnduranceRingSlice[];
	legend: EnduranceLegendItem[];
	rows: EnduranceListRow[];
	/** The line in place of the dial and the ring without a row. */
	empty?: string;
}

function dayView(tab: EnduranceTab, date: string, rows: ReadonlyMap<string, EnduranceScoreRow>, oldest: string | undefined, ctx: EnduranceScoreContext): EnduranceDayView {
	const row = rows.get(date);
	const view: EnduranceDayView = {
		range: "1d",
		tab,
		date,
		label: dayLabel(date, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, date),
		canGoForward: date < ctx.today,
		state: !row ? "none" : row.score !== undefined ? "scored" : "calibrating",
		gauge: null,
		wantsDay: false,
		ring: [],
		legend: [],
		rows: [],
	};
	if (!row) {
		view.empty = NO_READING;
		return view;
	}
	const scale = (ctx.days?.length ? enduranceScaleOf(ctx.days, date) : undefined) ?? scaleOfDay(ctx.day);
	view.gauge = enduranceDialGauge(row.score, scale, row.classId);
	if (row.score !== undefined) view.value = scoreText(row.score);
	const word = enduranceClassWord(row, scale);
	if (word) view.classWord = word;
	const phraseId = row.phraseId ?? ctx.day?.phraseId;
	const copy = endurancePhrase(phraseId);
	if (copy) view.copy = copy;
	view.wantsDay = row.phraseId === undefined && ctx.day === undefined;
	const contributors = contributorsOf(sharesOf([row.contrib]), enduranceTypesOf(ctx.activities));
	view.rows = contributors.rows;
	view.ring = ringOf(contributors);
	view.legend = legendOf([contributors]);
	return view;
}

/* ------------------------------------------------------------------ */
/*  12w and 1y                                                         */
/* ------------------------------------------------------------------ */

/** A Monday week or a calendar month the span touches, worked out as Garmin's weekly and monthly groups are. */
export interface EndurancePeriod {
	/** The week's Monday or the month's 1st: Garmin's `groupMap` key. */
	key: string;
	/** The whole week or month. */
	from: string;
	to: string;
	/** The floored mean of its scored days inside the span (`groupAverage`); undefined without one. */
	average?: number;
	/** Their highest (`groupMax`). */
	max?: number;
	/** Each entry's mean share over its days inside the span that have a list (`enduranceContributorDTOList`). */
	shares: Map<string, number>;
}

/**
 * The span's Monday weeks (`week`) or calendar months (`month`), oldest first,
 * each counting only its days inside the span, as Garmin's weekly and monthly
 * aggregations count a window's partial groups: October 2025 from Oct 13 is
 * 8,522 on 19 days; a Saturday start keys its week by the Monday before it.
 */
export function endurancePeriods(span: Span, rows: ReadonlyMap<string, EnduranceScoreRow>, unit: "week" | "month"): EndurancePeriod[] {
	const out: EndurancePeriod[] = [];
	const next = (key: string) => (unit === "week" ? shiftDate(key, 7) : `${shiftMonth(key.slice(0, 7), 1)}-01`);
	for (let key = unit === "week" ? weekStartOf(span.from, 1) : `${span.from.slice(0, 7)}-01`; key <= span.to; key = next(key)) {
		const to = unit === "week" ? shiftDate(key, 6) : lastDayOfMonth(key.slice(0, 7));
		const inside: Span = { from: key < span.from ? span.from : key, to: to > span.to ? span.to : to };
		const scores: number[] = [];
		const lists: Array<string | undefined> = [];
		for (const day of daysOf(inside)) {
			const row = rows.get(day);
			if (row?.score !== undefined) scores.push(row.score);
			lists.push(row?.contrib);
		}
		const period: EndurancePeriod = { key, from: key, to, shares: sharesOf(lists) };
		const average = meanOf(scores, "floor");
		if (average !== undefined) {
			period.average = average;
			period.max = Math.max(...scores);
		}
		out.push(period);
	}
	return out;
}

/** "6,436 · Avg Score", "6,620 · Max Score". */
export interface EnduranceFigure {
	value: string;
	label: string;
}

/**
 * Avg Score and Max Score over a span's periods: the floored mean of the
 * periods' averages (Garmin's `avg`), and the best day (`max`); "--" without
 * a score.
 */
export function enduranceFigures(periods: readonly EndurancePeriod[]): EnduranceFigure[] {
	const avg = meanOf(periods.flatMap((p) => (p.average === undefined ? [] : [p.average])), "floor");
	const best = periods.reduce<number | undefined>((top, p) => (p.max !== undefined && (top === undefined || p.max > top) ? p.max : top), undefined);
	return [
		{ value: avg !== undefined ? scoreText(avg) : DASH, label: "Avg Score" },
		{ value: best !== undefined ? scoreText(best) : DASH, label: "Max Score" },
	];
}

/** A point of the score tab's line: a period's average at its Monday or 1st. */
export interface EndurancePoint {
	date: string;
	/** Across the plot, 0..1. */
	x: number;
	value: number;
}

/** The score tab's chart: ticks top first, with their labels, the axis and the points, joined straight across a period without one. */
export interface EnduranceLine {
	ticks: number[];
	labels: string[];
	axis: PeriodAxis;
	points: EndurancePoint[];
}

/** A bar of the contributors tab: a period's average, split by its list, bottom up. */
export interface EnduranceBar {
	date: string;
	x: number;
	/** The period's average: the bar's height. */
	value: number;
	/** Bottom up: Miscellaneous, then the kept categories from the smallest share to the largest; `from` and `to` in score units. */
	segments: Array<{ category: EnduranceCategoryId; from: number; to: number }>;
}

export interface EnduranceBars {
	ticks: number[];
	labels: string[];
	axis: PeriodAxis;
	bars: EnduranceBar[];
}

/** A period's block of the contributors tab's list. */
export interface EnduranceBlock {
	/** The week's Monday or the month's 1st. */
	date: string;
	/** "Oct 5 - 11", "Sep 28 - Oct 4"; "October", "December 2025". */
	title: string;
	rows: EnduranceListRow[];
}

export interface EndurancePeriodView {
	range: "12w" | "1y";
	tab: EnduranceTab;
	span: Span;
	/** "Jul 20 - Oct 11", "Oct 13, 2025 - Oct 11, 2026". */
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** Endurance Score: the line; null without a point. */
	line: EnduranceLine | null;
	/** Top Contributors: the stacked bars; null without a bar. */
	bars: EnduranceBars | null;
	/** Under the bars. */
	legend: EnduranceLegendItem[];
	/** Avg Score and Max Score, the same on both tabs; "--" without a score. */
	figures: EnduranceFigure[];
	/** Top Contributors: a block per period with a list, newest first. */
	blocks: EnduranceBlock[];
	/** The line in place of the chart when there is no point. */
	empty?: string;
}

export type EnduranceScoreView = EnduranceDayView | EndurancePeriodView;

const TICKS = [0, 1, 2, 3, 4];

/**
 * The score tab's y axis: five even ticks from the lowest point − 500 to the
 * highest + 500, top first, labelled half up with the thousands separator.
 * 12w: 7,092 / 6,780 / 6,469 (6,468.5) / 6,157 (6,156.75) / 5,845.
 */
export function scoreTicks(values: readonly number[]): { ticks: number[]; labels: string[] } {
	const lo = Math.min(...values) - 500;
	const hi = Math.max(...values) + 500;
	const ticks = TICKS.map((i) => hi - ((hi - lo) * i) / 4);
	return { ticks, labels: ticks.map((t) => scoreText(Math.floor(t + 0.5))) };
}

/**
 * The contributors tab's y axis: five even ticks from round((highest point +
 * 500) / 100) × 100 down to 0. 12w: 7,092 → 7,100; 1y: 9,022 → 9,000 (which
 * rules out ceil, and the best day's 9,082). A tie rounds up (Inferred).
 */
export function contributorTicks(values: readonly number[]): { ticks: number[]; labels: string[] } {
	const top = Math.round((Math.max(...values) + 500) / 100) * 100;
	const ticks = TICKS.map((i) => (top * (4 - i)) / 4);
	return { ticks, labels: ticks.map((t) => scoreText(Math.round(t))) };
}

/**
 * The x axis of both tabs: by days, from the first period's start (its
 * Monday or 1st, even when the span starts later) to the day after the span,
 * so the last point stops short of the end. A dot under every period, all
 * large, labelled on end: the Monday's "MM-DD", or the month's "Oct".
 */
function axisOf(periods: readonly EndurancePeriod[], span: Span, unit: "week" | "month"): { axis: PeriodAxis; x: (date: string) => number } {
	const first = periods[0]?.key ?? span.from;
	const length = daysBetween(first, shiftDate(span.to, 1));
	const x = (date: string) => (length > 0 ? daysBetween(first, date) / length : 0);
	const text = (key: string) => (unit === "week" ? axisDay(key) : SHORT_MONTHS[Number(key.slice(5, 7)) - 1]);
	return {
		axis: {
			dots: periods.map((p) => ({ x: x(p.key), large: true })),
			labels: periods.map((p) => ({ x: x(p.key), text: text(p.key), rotated: true })),
		},
		x,
	};
}

/** A block's header: the week, Monday to Sunday ("Oct 5 - 11"); the month, by name this year, else with its year. */
function blockTitle(period: EndurancePeriod, unit: "week" | "month", today: string): string {
	if (unit === "week") return periodLabel(period.from, period.to, today);
	return period.key.slice(0, 4) === today.slice(0, 4) ? MONTHS[Number(period.key.slice(5, 7)) - 1] : monthLabel(period.key);
}

/** A period's bar: its average split by its list, Miscellaneous at the bottom; none without an average or a list. */
function barOf(period: EndurancePeriod, contributors: EnduranceContributors, x: number): EnduranceBar | undefined {
	if (period.average === undefined || !contributors.rows.length) return undefined;
	const average = period.average;
	const stack = [{ category: "misc" as EnduranceCategoryId, share: contributors.misc }, ...[...contributors.kept].reverse()];
	const segments: EnduranceBar["segments"] = [];
	let at = 0;
	for (const s of stack) {
		const height = (s.share / 100) * average;
		if (height <= 0) continue;
		segments.push({ category: s.category, from: at, to: at + height });
		at += height;
	}
	return { date: period.key, x, value: average, segments };
}

function periodView(tab: EnduranceTab, range: "12w" | "1y", offset: number, rows: ReadonlyMap<string, EnduranceScoreRow>, oldest: string | undefined, ctx: EnduranceScoreContext): EndurancePeriodView {
	const route = { range, offset };
	const span = statSpan(STAT, route, ctx.today)!;
	const unit = range === "12w" ? "week" : "month";
	const periods = endurancePeriods(span, rows, unit);
	const { axis, x } = axisOf(periods, span, unit);
	const types = enduranceTypesOf(ctx.activities);

	const points: EndurancePoint[] = periods.flatMap((p) => (p.average === undefined ? [] : [{ date: p.key, x: x(p.key), value: p.average }]));
	const values = points.map((p) => p.value);
	const lists = periods.map((p) => contributorsOf(p.shares, types));
	const bars = periods.flatMap((p, i) => barOf(p, lists[i], x(p.key)) ?? []);

	const view: EndurancePeriodView = {
		range,
		tab,
		span,
		label: statPeriodLabel(STAT, route, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		canGoForward: offset < 0,
		line: points.length ? { ...scoreTicks(values), axis, points } : null,
		bars: bars.length ? { ...contributorTicks(values), axis, bars } : null,
		legend: legendOf(lists),
		figures: enduranceFigures(periods),
		blocks: periods
			.map((p, i) => ({ date: p.key, title: blockTitle(p, unit, ctx.today), rows: lists[i].rows }))
			.filter((b) => b.rows.length)
			.reverse(),
	};
	if (!view.line) view.empty = NO_DATA;
	return view;
}

/* ------------------------------------------------------------------ */
/*  Help                                                               */
/* ------------------------------------------------------------------ */

/** The Help sheet: the newest score's heading over the class table, then the web's sections (the phone's is unseen). */
export interface EnduranceHelp {
	title: string;
	/** "Your endurance score is 6,413, which is trained for men ages 20-29."; none without a score. */
	heading?: string;
	intro: string;
	/** Elite first: "8,800 and above" … "1 - 5,099"; empty without a scale. */
	classes: Array<{ name: string; range: string }>;
	sections: readonly EnduranceHelpSection[];
}

/**
 * The Help sheet as the web words it on 2026-10-11: the newest score up to
 * today with its class, and who the scale is for — "men ages 20-29" for a man
 * of 23, by decade (Inferred past this one); left off without an age and a
 * sex — then the class table from the account's limits, then the sections.
 */
export function enduranceHelp(rows: readonly EnduranceScoreRow[], ctx: Pick<EnduranceScoreContext, "today" | "days"> & { age?: number; sex?: Sex }): EnduranceHelp {
	let latest: EnduranceScoreRow | undefined;
	for (let i = rows.length - 1; i >= 0 && !latest; i--) if (rows[i].date <= ctx.today && rows[i].score !== undefined) latest = rows[i];
	const scale = ctx.days?.length ? enduranceScaleOf(ctx.days, latest?.date ?? ctx.today) : undefined;
	const help: EnduranceHelp = { title: HELP_TITLE, intro: HELP_CLASSES_INTRO, classes: [], sections: ENDURANCE_HELP };
	const word = latest ? enduranceClassWord(latest, scale) : undefined;
	if (latest?.score !== undefined && word) {
		const decade = ctx.age !== undefined && Number.isFinite(ctx.age) ? Math.floor(ctx.age / 10) * 10 : undefined;
		const who = decade !== undefined && ctx.sex ? ` for ${ctx.sex === "male" ? "men" : "women"} ages ${decade}-${decade + 9}` : "";
		help.heading = `Your endurance score is ${scoreText(latest.score)}, which is ${word.toLowerCase()}${who}.`;
	}
	if (wholeScale(scale)) {
		const limits = scale.limits as number[];
		const starts = [1, ...limits];
		help.classes = ENDURANCE_CLASSES.map((name, i) => ({ name, range: i === starts.length - 1 ? `${scoreText(starts[i])} and above` : `${scoreText(starts[i])} - ${scoreText(starts[i + 1] - 1)}` })).reverse();
	}
	return help;
}

/** The page, on its route's range and tab. */
export function enduranceScoreView(route: EnduranceScoreRoute, rows: readonly EnduranceScoreRow[], ctx: EnduranceScoreContext): EnduranceScoreView {
	const byDate = new Map(rows.map((r) => [r.date, r]));
	const oldest = rows[0]?.date;
	const tab = enduranceTab(route.tab);
	if (route.range === "1d") return dayView(tab, dayOf(route, ctx.today), byDate, oldest, ctx);
	return periodView(tab, route.range === "1y" ? "1y" : "12w", route.offset, byDate, oldest, ctx);
}
