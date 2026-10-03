import type { AccountInfo } from "../sync/account";
import { PR_TYPES } from "../sync/account";
import type { ActivityRow } from "../sync/activity-index";
import { shortDate, titleCase } from "./day";
import { duration, shiftDate } from "./series";

/**
 * Garmin Connect's Activities pages, worked out from the activity index.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. Every total is summed from
 * Garmin's raw metres and seconds and rounded only for display, which is what
 * makes a year of runs read 1,168.9 km here and on the phone alike.
 */

/** What the pages read: the activity index, the account's records, and the units to write in. */
export interface ActivitiesData {
	rows: ActivityRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
	/** How many activities the list held when last counted. */
	total?: number;
	records: AccountInfo["personalRecords"];
	units: Units;
}

export const NO_ACTIVITIES: ActivitiesData = { rows: [], complete: false, records: [], units: "metric" };

export type CategoryId = "running" | "cycling" | "gym" | "swimming" | "hiking" | "multisport" | "other";
export type MetricId = "distance" | "time" | "ascent" | "calories";
export type RangeId = "7d" | "4w" | "1y";
export type RecordTab = "steps" | "running" | "cycling" | "swimming" | "strength";
export type Units = "metric" | "imperial";

/** Icon ids registered by `src/ui/sport-icons.ts`; `activity` is Lucide's own. */
export type SportGlyph =
	| "run"
	| "treadmill"
	| "swimming"
	| "bike"
	| "barbell"
	| "yoga"
	| "stairs-up"
	| "stretching"
	| "trekking"
	| "walk"
	| "medal"
	| "shoe"
	| "activity";

export interface Category {
	id: CategoryId;
	/** "Gym & Fitness Equipment": the hub row and the page bar. */
	title: string;
	/** Garmin's type at the top of this branch of its tree. Other has none. */
	typeId?: number;
	/** The tabs the app shows for it, in its order. */
	metrics: readonly MetricId[];
	/** Where "View Personal Records" goes. Sports without records have no such row. */
	records?: RecordTab;
	glyph: SportGlyph;
}

const ALL_METRICS: readonly MetricId[] = ["distance", "time", "ascent", "calories"];

/** The hub, in the app's order. */
export const CATEGORIES: readonly Category[] = [
	{ id: "running", title: "Running", typeId: 1, metrics: ALL_METRICS, records: "running", glyph: "run" },
	{ id: "cycling", title: "Cycling", typeId: 2, metrics: ALL_METRICS, records: "cycling", glyph: "bike" },
	{ id: "gym", title: "Gym & Fitness Equipment", typeId: 29, metrics: ["time", "calories"], records: "strength", glyph: "barbell" },
	{ id: "swimming", title: "Swimming", typeId: 26, metrics: ["distance", "time"], records: "swimming", glyph: "swimming" },
	{ id: "hiking", title: "Hiking", typeId: 3, metrics: ALL_METRICS, glyph: "trekking" },
	// Never seen in the app with data; given the running tabs until it is.
	{ id: "multisport", title: "Multisport", typeId: 89, metrics: ALL_METRICS, glyph: "medal" },
	{ id: "other", title: "Other", metrics: ["time"], glyph: "activity" },
];

export function categoryFor(id: CategoryId): Category {
	return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export const METRIC_TITLE: Record<MetricId, string> = {
	distance: "Distance",
	time: "Time",
	ascent: "Ascent",
	calories: "Calories",
};

const BRANCH: Record<number, CategoryId> = { 1: "running", 2: "cycling", 29: "gym", 26: "swimming", 3: "hiking", 89: "multisport" };

/**
 * Which hub category an activity falls under: its own type or the one above
 * it in Garmin's tree, which is two levels deep. Yoga, stair climbing and
 * mobility sit under fitness equipment, so they are Gym; meditation and
 * walking are Other.
 */
export function categoryOf(row: Pick<ActivityRow, "type" | "typeId" | "parentTypeId">): CategoryId {
	const byTree = (row.typeId !== undefined && BRANCH[row.typeId]) || (row.parentTypeId !== undefined && BRANCH[row.parentTypeId]);
	if (byTree) return byTree;
	if (row.typeId !== undefined) return "other";
	// A row without ids: go by the key.
	const key = row.type;
	if (/run/.test(key)) return "running";
	if (/cycling|biking|bike|ride|bmx|mtb/.test(key)) return "cycling";
	if (/swim/.test(key)) return "swimming";
	if (/hiking|rucking/.test(key)) return "hiking";
	if (key === "multi_sport") return "multisport";
	if (/strength|yoga|pilates|stair|elliptical|rowing|cardio|hiit|mobility|fitness/.test(key)) return "gym";
	return "other";
}

/** Garmin's own names where its key says something else. */
const TYPE_LABEL: Record<string, string> = {
	lap_swimming: "Pool Swimming",
	road_biking: "Road Cycling",
	hiit: "HIIT",
	multi_sport: "Multisport",
};

export function typeLabel(type: string): string {
	return TYPE_LABEL[type] ?? titleCase(type) ?? type;
}

export interface SubTypeOption {
	/** Null is the whole category: "All Running". */
	typeId: number | null;
	label: string;
}

/**
 * The picker: the whole category first, then each sub-type the account has
 * actually recorded, most used first, the way the app lists Treadmill, Trail
 * and Track Running. The category's own plain type ("Running") is part of
 * "All Running" and not an option of its own.
 */
export function subTypeOptions(rows: readonly ActivityRow[], category: CategoryId): SubTypeOption[] {
	const cat = categoryFor(category);
	const counts = new Map<number, { type: string; n: number }>();
	for (const row of rows) {
		if (row.typeId === undefined || categoryOf(row) !== category) continue;
		if (row.typeId === cat.typeId || (category === "other" && row.typeId === 4)) continue;
		const seen = counts.get(row.typeId);
		if (seen) seen.n += 1;
		else counts.set(row.typeId, { type: row.type, n: 1 });
	}
	const subs = [...counts.entries()]
		.sort((a, b) => b[1].n - a[1].n || a[0] - b[0])
		.map(([typeId, { type }]) => ({ typeId, label: typeLabel(type) }));
	return [{ typeId: null, label: `All ${cat.title}` }, ...subs];
}

/** The rows a page shows: a category, or one sub-type of it. */
export function rowsFor(rows: readonly ActivityRow[], category: CategoryId, sub: number | null): ActivityRow[] {
	return rows.filter((r) => categoryOf(r) === category && (sub === null || r.typeId === sub));
}

/* ------------------------------------------------------------------ */
/*  Periods                                                            */
/* ------------------------------------------------------------------ */

export interface Slot {
	/** First and last day it covers, inclusive. */
	from: string;
	to: string;
	/** "09-27" for a day, "Nov" for a month. */
	label: string;
}

export interface Period {
	range: RangeId;
	/** 0 is the current period, -1 the one before. */
	offset: number;
	from: string;
	to: string;
	/** "Sep 27 - Oct 3", "Nov 2025 - Oct 2026". */
	label: string;
	slots: Slot[];
}

const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * 7d is the week ending today, 4w the 28 days ending today, 1y the twelve
 * calendar months ending with this one. Each step back is one whole period.
 */
export function periodFor(range: RangeId, offset: number, today: string): Period {
	const step = Math.min(0, Math.trunc(offset));
	if (range === "1y") {
		const last = addMonths(today.slice(0, 7), step * 12);
		const slots = Array.from({ length: 12 }, (_, i) => {
			const month = addMonths(last, i - 11);
			return { from: `${month}-01`, to: lastDayOf(month), label: MONTH[Number(month.slice(5)) - 1]!.slice(0, 3) };
		});
		const first = slots[0]!.from;
		return {
			range,
			offset: step,
			from: first,
			to: slots[11]!.to,
			label: `${monthLabel(first.slice(0, 7), true)} - ${monthLabel(last, true)}`,
			slots,
		};
	}

	const days = range === "7d" ? 7 : 28;
	const to = shiftDate(today, step * days);
	const from = shiftDate(to, -(days - 1));
	const slots = Array.from({ length: days }, (_, i) => {
		const date = shiftDate(from, i);
		return { from: date, to: date, label: date.slice(5) };
	});
	return { range, offset: step, from, to, label: dayRangeLabel(from, to, today), slots };
}

/** "Sep 27 - Oct 3", with the year once the period is not this year's. */
function dayRangeLabel(from: string, to: string, today: string): string {
	if (to.slice(0, 4) === today.slice(0, 4)) return `${shortDate(from)} - ${shortDate(to)}`;
	if (from.slice(0, 4) === to.slice(0, 4)) return `${shortDate(from)} - ${shortDate(to)}, ${to.slice(0, 4)}`;
	return `${shortDate(from)}, ${from.slice(0, 4)} - ${shortDate(to)}, ${to.slice(0, 4)}`;
}

/** "September 2026", or "Sep 2026" when `short`. */
export function monthLabel(month: string, short = false): string {
	const name = MONTH[Number(month.slice(5, 7)) - 1] ?? month;
	return `${short ? name.slice(0, 3) : name} ${month.slice(0, 4)}`;
}

function addMonths(month: string, n: number): string {
	const [y, m] = month.split("-").map(Number);
	const t = y! * 12 + (m! - 1) + n;
	return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return `${month}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
}

function dayOf(row: ActivityRow): string {
	return row.start.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Totals                                                             */
/* ------------------------------------------------------------------ */

/** What one activity adds to a metric: metres, seconds, metres, kcal. */
export function metricValue(row: ActivityRow, metric: MetricId): number | undefined {
	switch (metric) {
		case "distance":
			return row.distance;
		case "time":
			return row.duration;
		case "ascent":
			return row.ascent;
		case "calories":
			return row.calories;
	}
}

function sum(rows: readonly ActivityRow[], metric: MetricId): number {
	let total = 0;
	for (const row of rows) total += metricValue(row, metric) ?? 0;
	return total;
}

/**
 * Each slot's total in the chart's unit: km or mi, m or ft, kcal, and minutes
 * for a day but hours for a month, so a year of gym time is not an axis in
 * the thousands.
 */
export function totalsBySlot(rows: readonly ActivityRow[], period: Period, metric: MetricId, units: Units): number[] {
	const totals = period.slots.map(() => 0);
	for (const row of rows) {
		const day = dayOf(row);
		if (day < period.from || day > period.to) continue;
		const value = metricValue(row, metric);
		if (value === undefined) continue;
		// Slots are in date order, so the first that ends on or after the day holds it.
		const i = period.slots.findIndex((s) => day <= s.to);
		if (i >= 0) totals[i]! += value;
	}
	return totals.map((v) => chartUnit(v, metric, period.range, units));
}

function chartUnit(base: number, metric: MetricId, range: RangeId, units: Units): number {
	switch (metric) {
		case "distance":
			return units === "imperial" ? base / METRES_PER_MILE : base / 1000;
		case "time":
			return range === "1y" ? base / 3600 : base / 60;
		case "ascent":
			return units === "imperial" ? base * FEET_PER_METRE : base;
		case "calories":
			return base;
	}
}

/**
 * Five gridlines from zero in equal whole steps: a top of 11.09 gives
 * 0/3/6/9/12, one of 214 gives 0/54/108/162/216, as the app draws them.
 */
export function axisTicks(max: number): number[] {
	const step = max > 0 ? Math.ceil(max / 4) : 1;
	return [0, step, 2 * step, 3 * step, 4 * step];
}

export interface Stat {
	value: string;
	label: string;
}

/** Total, then the averages the app shows for each range. */
export function summaryStats(total: number, range: RangeId, metric: MetricId, units: Units): Stat[] {
	const label = `Total ${METRIC_TITLE[metric]}`;
	const value = (n: number) => formatMetric(n, metric, units);
	const out: Stat[] = [{ value: value(total), label }];
	if (range === "7d") out.push({ value: value(total / 7), label: "Avg Daily" });
	else if (range === "4w") out.push({ value: value(total / 28), label: "Avg Daily" }, { value: value(total / 4), label: "Avg Weekly" });
	else out.push({ value: value(total / 52), label: "Avg Weekly" }, { value: value(total / 12), label: "Avg Monthly" });
	return out;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.28084;
const METRES_PER_YARD = 0.9144;

/** "1,168.9", "8": up to `places` decimals, with no trailing zero. */
function decimal(value: number, places: number, fixed = false): string {
	return value.toLocaleString(undefined, {
		maximumFractionDigits: places,
		minimumFractionDigits: fixed ? places : 0,
	});
}

/** "11.1 km", "8 km"; `fixed` keeps every decimal, "8.01 km", the way an activity row reads. */
export function formatDistance(metres: number, units: Units, places = 1, fixed = false): string {
	const value = units === "imperial" ? metres / METRES_PER_MILE : metres / 1000;
	return `${decimal(value, places, fixed)} ${units === "imperial" ? "mi" : "km"}`;
}

/** A total in base units — metres, seconds, metres, kcal — as the app writes it. */
export function formatMetric(value: number, metric: MetricId, units: Units): string {
	switch (metric) {
		case "distance":
			return formatDistance(value, units);
		case "time":
			return duration(value);
		case "ascent":
			return units === "imperial"
				? `${Math.round(value * FEET_PER_METRE).toLocaleString()} ft`
				: `${Math.round(value).toLocaleString()} m`;
		case "calories":
			return `${Math.round(value).toLocaleString()} kcal`;
	}
}

/** `2026-10-03T14:59:19` → "2026-10-03, 2:59 PM", as the app dates an activity. */
export function dateTimeLabel(start: string): string {
	const hour = Number(start.slice(11, 13));
	const minute = start.slice(14, 16);
	const h12 = hour % 12 === 0 ? 12 : hour % 12;
	return `${start.slice(0, 10)}, ${h12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

function countLabel(n: number): string {
	return `${n.toLocaleString()} ${n === 1 ? "activity" : "activities"}`;
}

/* ------------------------------------------------------------------ */
/*  Pages                                                              */
/* ------------------------------------------------------------------ */

export interface ActivityItem {
	id: number;
	name: string;
	/** "2026-10-03, 2:59 PM". */
	when: string;
	/** The selected metric: "8 km", "41:34". */
	value: string;
}

export interface MonthItem {
	/** `2026-09`. */
	month: string;
	title: string;
	count: string;
	value: string;
}

export interface Chart {
	range: RangeId;
	slots: Slot[];
	values: number[];
	ticks: number[];
}

export interface CategoryView {
	category: Category;
	sub: number | null;
	/** "All Running", or the sub-type's name. */
	title: string;
	options: SubTypeOption[];
	metric: MetricId;
	period: Period;
	/** Whether anything is older than this period, for ‹. */
	canGoBack: boolean;
	chart: Chart;
	stats: Stat[];
	/** "Running Activities". */
	listTitle: string;
	/** 7d and 4w list each activity. */
	activities: ActivityItem[];
	/** 1y lists the months that have any. */
	months: MonthItem[];
}

export interface CategoryInput {
	rows: readonly ActivityRow[];
	category: CategoryId;
	sub: number | null;
	range: RangeId;
	offset: number;
	metric: MetricId;
	today: string;
	units: Units;
}

export function categoryView(input: CategoryInput): CategoryView {
	const category = categoryFor(input.category);
	const options = subTypeOptions(input.rows, input.category);
	const option = options.find((o) => o.typeId === input.sub) ?? options[0]!;
	const metric = category.metrics.includes(input.metric) ? input.metric : category.metrics[0]!;
	const period = periodFor(input.range, input.offset, input.today);

	const all = rowsFor(input.rows, input.category, option.typeId);
	const inPeriod = all.filter((r) => dayOf(r) >= period.from && dayOf(r) <= period.to);
	const values = totalsBySlot(inPeriod, period, metric, input.units);

	return {
		category,
		sub: option.typeId,
		title: option.label,
		options,
		metric,
		period,
		canGoBack: all.some((r) => dayOf(r) < period.from),
		chart: { range: period.range, slots: period.slots, values, ticks: axisTicks(Math.max(0, ...values)) },
		stats: summaryStats(sum(inPeriod, metric), period.range, metric, input.units),
		listTitle: `${option.typeId === null ? category.title : option.label} Activities`,
		activities: period.range === "1y" ? [] : items(inPeriod, metric, input.units),
		months: period.range === "1y" ? monthItems(inPeriod, metric, input.units) : [],
	};
}

function items(rows: readonly ActivityRow[], metric: MetricId, units: Units): ActivityItem[] {
	return sorted(rows).map((r) => {
		const value = metricValue(r, metric);
		return {
			id: r.id,
			name: r.name ?? typeLabel(r.type),
			when: dateTimeLabel(r.start),
			value: value === undefined ? "--" : formatMetric(value, metric, units),
		};
	});
}

function monthItems(rows: readonly ActivityRow[], metric: MetricId, units: Units): MonthItem[] {
	const byMonth = new Map<string, ActivityRow[]>();
	for (const row of rows) {
		const month = row.start.slice(0, 7);
		const list = byMonth.get(month);
		if (list) list.push(row);
		else byMonth.set(month, [row]);
	}
	return [...byMonth.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([month, list]) => ({
			month,
			title: monthLabel(month),
			count: countLabel(list.length),
			value: formatMetric(sum(list, metric), metric, units),
		}));
}

/** Newest first; the index already is, but a filtered copy should not depend on it. */
function sorted(rows: readonly ActivityRow[]): ActivityRow[] {
	return [...rows].sort((a, b) => b.begin - a.begin || b.id - a.id);
}

export interface MonthView {
	/** "September 2026". */
	title: string;
	/** "17 Running Activities · 100.2 km". */
	summary: string;
	activities: ActivityItem[];
}

export function monthView(input: Omit<CategoryInput, "range" | "offset" | "today"> & { month: string }): MonthView {
	const category = categoryFor(input.category);
	const options = subTypeOptions(input.rows, input.category);
	const option = options.find((o) => o.typeId === input.sub) ?? options[0]!;
	const metric = category.metrics.includes(input.metric) ? input.metric : category.metrics[0]!;
	const rows = rowsFor(input.rows, input.category, option.typeId).filter((r) => r.start.startsWith(input.month));
	const what = `${option.typeId === null ? category.title : option.label} ${rows.length === 1 ? "Activity" : "Activities"}`;
	return {
		title: monthLabel(input.month),
		summary: `${rows.length.toLocaleString()} ${what} · ${formatMetric(sum(rows, metric), metric, input.units)}`,
		activities: items(rows, metric, input.units),
	};
}

export interface AllItem {
	id: number;
	name: string;
	when: string;
	glyph: SportGlyph;
	/** "41:34". */
	time?: string;
	/** "8.01 km". Activities without one show only the time. */
	distance?: string;
}

/** All Activities: everything, newest first. */
export function allActivities(rows: readonly ActivityRow[], units: Units): AllItem[] {
	return sorted(rows).map((r) => {
		const item: AllItem = { id: r.id, name: r.name ?? typeLabel(r.type), when: dateTimeLabel(r.start), glyph: glyphOf(r) };
		if (r.duration !== undefined) item.time = duration(r.duration);
		if (r.distance !== undefined) item.distance = formatDistance(r.distance, units, 2, true);
		return item;
	});
}

/** The figure an activity is drawn with. */
export function glyphOf(row: Pick<ActivityRow, "type" | "typeId" | "parentTypeId">): SportGlyph {
	const key = row.type;
	if (key === "treadmill_running") return "treadmill";
	if (key === "strength_training") return "barbell";
	if (/^(yoga|pilates|meditation|breathwork)$/.test(key)) return "yoga";
	if (key === "stair_climbing" || key === "floor_climbing") return "stairs-up";
	if (key === "mobility") return "stretching";
	if (/walking/.test(key)) return "walk";
	switch (categoryOf(row)) {
		case "running":
			return "run";
		case "cycling":
			return "bike";
		case "swimming":
			return "swimming";
		case "hiking":
			return "trekking";
		case "multisport":
			return "medal";
		default:
			return "activity";
	}
}

/* ------------------------------------------------------------------ */
/*  Personal Records                                                   */
/* ------------------------------------------------------------------ */

export const RECORD_TABS: ReadonlyArray<{ id: RecordTab; title: string; glyph: SportGlyph }> = [
	{ id: "steps", title: "Steps", glyph: "shoe" },
	{ id: "running", title: "Running", glyph: "run" },
	{ id: "cycling", title: "Cycling", glyph: "bike" },
	{ id: "swimming", title: "Swimming", glyph: "swimming" },
	{ id: "strength", title: "Strength", glyph: "barbell" },
];

/** Each tab's slots, from Garmin's prtypes, in the app's order. A slot with no record still shows. */
const RECORD_SLOTS: Record<RecordTab, ReadonlyArray<[number, string]>> = {
	steps: [
		[12, "Most Steps in a Day"],
		[13, "Most Steps in a Week"],
		[14, "Most Steps in a Month"],
		[15, "Longest Goal Streak"],
		[16, "Current Goal Streak"],
	],
	running: [
		[1, "1 km"],
		[2, "1 mi"],
		[3, "5K"],
		[4, "10K"],
		[5, "Half Marathon"],
		[6, "Marathon"],
		[7, "Longest Run"],
	],
	cycling: [
		[8, "Longest Ride"],
		[9, "Biggest Climb"],
		[10, "Max Avg Power (20 min)"],
		[11, "40K"],
	],
	swimming: [
		[17, "Longest Swim"],
		[18, "100 m"],
		[19, "100 yd"],
		[20, "400 m"],
		[21, "500 yd"],
		[22, "750 m"],
		[23, "1000 m"],
		[24, "1000 yd"],
		[25, "1500 m"],
		[26, "1650 yd"],
	],
	strength: [
		[28, "Bench Press"],
		[29, "Overhead Press"],
		[30, "Squat"],
		[31, "Deadlift"],
		[32, "Row"],
		[45, "Barbell Biceps Curl"],
		[46, "Dumbbell Squat"],
		[47, "Dumbbell Row"],
		[48, "Dumbbell Deadlift"],
		[49, "Dumbbell Biceps Curl"],
		[50, "Dumbbell Bench Press"],
		[51, "Overhead Dumbbell Press"],
	],
};

export interface RecordItem {
	typeId: number;
	title: string;
	value?: string;
	date?: string;
}

type PersonalRecord = NonNullable<AccountInfo["personalRecords"]>[number];

const TYPE_ID_OF = new Map(Object.entries(PR_TYPES).map(([id, name]) => [name, Number(id)]));

/** A record's type id. Account files written before it was kept carry only the name. */
function recordTypeId(record: PersonalRecord): number | undefined {
	return record.typeId ?? TYPE_ID_OF.get(record.type);
}

export function recordsView(records: AccountInfo["personalRecords"], tab: RecordTab, units: Units): RecordItem[] {
	const byType = new Map<number, PersonalRecord>();
	for (const record of records ?? []) {
		const id = recordTypeId(record);
		if (id !== undefined) byType.set(id, record);
	}
	return RECORD_SLOTS[tab].map(([typeId, title]) => {
		const record = byType.get(typeId);
		const item: RecordItem = { typeId, title };
		if (record?.value !== undefined) {
			item.value = recordValue(typeId, record.value, units);
			if (record.date) item.date = record.date;
		}
		return item;
	});
}

/** Seconds for the timed records, metres for distances, steps, days, watts. */
export function recordValue(typeId: number, value: number, units: Units): string {
	if (typeId === 7 || typeId === 8) return formatDistance(value, units, 2, true);
	if (typeId === 9) return formatMetric(value, "ascent", units);
	if (typeId === 10) return `${Math.round(value).toLocaleString()} W`;
	if (typeId >= 12 && typeId <= 14) return Math.round(value).toLocaleString();
	if (typeId === 15 || typeId === 16) return `${Math.round(value)} ${Math.round(value) === 1 ? "day" : "days"}`;
	if (typeId === 17) {
		return units === "imperial"
			? `${Math.round(value / METRES_PER_YARD).toLocaleString()} yd`
			: `${Math.round(value).toLocaleString()} m`;
	}
	// Strength records are the heaviest weight lifted. Unverified: no account
	// here has one. Garmin keeps set weights in grams, hence the guess.
	if (RECORD_SLOTS.strength.some(([id]) => id === typeId)) {
		const kg = value >= 1000 ? value / 1000 : value;
		return units === "imperial" ? `${decimal(kg * 2.20462, 1)} lb` : `${decimal(kg, 1)} kg`;
	}
	return duration(value);
}
