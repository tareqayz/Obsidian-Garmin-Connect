import { CATEGORIES, RECORD_TABS, type CategoryId, type MetricId, type RangeId, type RecordTab } from "./activities";
import { pageStat, type HealthRange, type HealthStatPageId } from "./health-stats";
import { PERFORMANCE_REGISTRY, type PerformanceStatPageId } from "./performance-stats";
import type { PeriodRange, PeriodRoute } from "./periods";
import { SLEEP_FACTORS, SLEEP_RANGES, type SleepFactorId, type SleepRange, type SleepTab } from "./sleep-pages";
import type { GlanceTarget, StatDef } from "./stat-registry";
import { STAT_IDS, STAT_RANGES, type StatId, type StatRange, type StatTotals } from "./stats-pages";

/**
 * Where the Home view is, as a stack: Home, then whatever was opened on top
 * of it. Back pops one page, the way the app's back arrow does.
 *
 * Kept in the view's state, so a reload comes back to the same page. Anything
 * read back from there is checked against what the pages accept, since a
 * workspace file can hold whatever an older version or a hand edit left.
 */
export type Route =
	| { page: "home" }
	| { page: "glance" }
	| { page: "activities" }
	| { page: "category"; category: CategoryId; sub: number | null; range: RangeId; offset: number; metric: MetricId }
	| { page: "month"; category: CategoryId; sub: number | null; month: string; metric: MetricId }
	| { page: "records"; tab: RecordTab }
	| AllRoute
	| { page: "stats"; stat: StatId; range: StatRange; offset: number; totals: StatTotals }
	| { page: "health" }
	| { page: "sleep"; range: SleepRange; offset: number; tab: SleepTab }
	| { page: "sleep-factor"; factor: SleepFactorId; date: string }
	/**
	 * Every Health Stats page but Sleep (`health-stats.ts`). `tab`, `sub` and
	 * `date` are the page's own: a tab, a sub-page or sheet, a particular day.
	 */
	| { page: "health-stat"; stat: HealthStatPageId; range: HealthRange; offset: number; tab?: string; sub?: string; date?: string }
	/** The Performance Stats hub. */
	| { page: "performance" }
	/** Every Performance Stats page (`performance-stats.ts`), on the same terms as `health-stat`. */
	| { page: "performance-stat"; stat: PerformanceStatPageId; range: PeriodRange; offset: number; tab?: string; sub?: string; date?: string }
	/**
	 * One activity's page, by its Garmin id. `sub` is an expanded chart
	 * (`chart:<metric>[:<overlay>]`), so a reload reopens it. The Charts tab's
	 * picker choices ride along in `picks`, by the picker's key (the run's
	 * `pace`, `heart` and `power`; a sport's own), which also lets a check open
	 * any of them.
	 */
	| {
			page: "activity";
			id: number;
			tab: ActivityTab;
			axis: ActivityAxis;
			sub?: string;
			picks?: Record<string, string>;
	  }
	/**
	 * The activity's full-screen map, with its Map Settings choices. The
	 * overlay is a token: which ones an activity offers is its sport's (the
	 * page falls back to none for one it doesn't).
	 */
	| { page: "activity-map"; id: number; overlay: string; laps: boolean };

/** All Activities' sort: newest first is the default, and has no value. */
export const ALL_SORTS = ["oldest", "az", "za"] as const;
export type AllSort = (typeof ALL_SORTS)[number];

/**
 * All Activities with its search, sort and filters. Every field is optional:
 * a bare `{ page: "all" }` is everything, newest first. Values are in metres
 * and seconds whatever the units; `types` are Garmin's activity type ids, a
 * group's ("All Cycling" is 2) or a sub-type's (Road Cycling is 10).
 */
export interface AllRoute {
	page: "all";
	/** The search, trimmed, at most 80 characters. */
	q?: string;
	sort?: AllSort;
	types?: number[];
	/** Local days, `YYYY-MM-DD`, inclusive. */
	from?: string;
	to?: string;
	/** Distance, metres. */
	dmin?: number;
	dmax?: number;
	/** Time, seconds. */
	tmin?: number;
	tmax?: number;
	/** Total ascent, metres. */
	amin?: number;
	amax?: number;
	/** Garmin's event type keys (`race`, `training` …). */
	events?: string[];
	/** Favorites only. */
	fav?: true;
	/** Personal Records only. */
	pr?: true;
}

export type HealthStatRoute = Extract<Route, { page: "health-stat" }>;
export type PerformanceStatRoute = Extract<Route, { page: "performance-stat" }>;
/** A page on either stats section's shared route. */
export type StatRoute = HealthStatRoute | PerformanceStatRoute;
export type ActivityRoute = Extract<Route, { page: "activity" }>;
export type ActivityMapRoute = Extract<Route, { page: "activity-map" }>;

export const ACTIVITY_TABS = ["overview", "stats", "laps", "charts", "gear"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];
export type ActivityAxis = "time" | "distance";
/**
 * The run's three Charts pickers (pace, heart rate, power) and their values:
 * the `picks` a run's route holds, and the fields a route saved before
 * `picks` kept them in (`pace`, `heart`, `power`), which `readRoute` folds in.
 */
export const PACE_CHARTS = ["pace", "gap", "lap-pace"] as const;
export type PaceChart = (typeof PACE_CHARTS)[number];
export const HEART_CHARTS = ["heart-rate", "zones"] as const;
export type HeartChart = (typeof HEART_CHARTS)[number];
export const POWER_CHARTS = ["watts", "per-kg"] as const;
export type PowerChart = (typeof POWER_CHARTS)[number];
/** What colours a run's route: the Map Settings sheet's Data Overlay. Other sports list theirs in their map spec. */
export const MAP_OVERLAYS = ["none", "pace", "gap", "heart-rate", "power", "elevation", "run-walk"] as const;
export type MapOverlay = (typeof MAP_OVERLAYS)[number];

export const HOME: Route = { page: "home" };

/** The areas' own pages: the lists the rail and the phone's tabs open, kept right above Home. */
export const AREA_ROOTS = ["activities", "health", "performance"] as const;
export type AreaRoot = Extract<Route, { page: (typeof AREA_ROOTS)[number] }>;

export function isAreaRoot(route: Route | undefined): route is AreaRoot {
	return !!route && (AREA_ROOTS as readonly string[]).includes(route.page);
}

/** Deep enough for Home → Activities → Running → a month → a run → its map, with room. */
const MAX_DEPTH = 8;

/** How much of a stack's bottom a trim keeps: Home, and the area's page above it, so the rail's area stays put. */
function base(stack: readonly Route[]): number {
	return isAreaRoot(stack[1]) ? 2 : 1;
}

export function push(stack: readonly Route[], route: Route): Route[] {
	const next = [...stack, route];
	if (next.length <= MAX_DEPTH) return next;
	// Drop from just above Home and its area rather than lose the way back to them.
	const keep = base(next);
	return [...next.slice(0, keep), ...next.slice(next.length - MAX_DEPTH + keep)];
}

/** One page back. Home is never popped. */
export function pop(stack: readonly Route[]): Route[] {
	return stack.length > 1 ? stack.slice(0, -1) : [HOME];
}

/**
 * Opens a page, or goes back to it when it is already on the stack, so the
 * activity page's links (its records, the running page) don't stack a loop:
 * Running → a run → Running → a run …
 */
export function pushOrReturn(stack: readonly Route[], route: Route): Route[] {
	const key = routeKey(route);
	const at = stack.findIndex((r) => routeKey(r) === key);
	return at >= 0 ? stack.slice(0, at + 1) : push(stack, route);
}

/**
 * A route's identity: its keys in a fixed order at every level, whatever order
 * they were written in. (A replacer array would also drop the nested keys it
 * doesn't list, so two activity routes differing only in `picks` would read
 * as one.) Arrays keep their order.
 */
export function routeKey(route: Route): string {
	return JSON.stringify(sortedKeys(route));
}

function sortedKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortedKeys);
	if (!value || typeof value !== "object") return value;
	const object = value as Record<string, unknown>;
	return Object.fromEntries(
		Object.keys(object)
			.sort()
			.map((key) => [key, sortedKeys(object[key])]),
	);
}

/** Changes the page on top without adding a step, for a filter or a tab. */
export function replace(stack: readonly Route[], route: Route): Route[] {
	return stack.length > 1 ? [...stack.slice(0, -1), route] : [HOME, route];
}

export function top(stack: readonly Route[]): Route {
	return stack[stack.length - 1] ?? HOME;
}

/**
 * A stack read back from saved state: Home at the bottom, every page valid, or
 * just Home. A page this version no longer has is dropped: the More page,
 * which the rail and the tabs replaced, leaves its area's page right above Home.
 */
export function readStack(value: unknown): Route[] {
	if (!Array.isArray(value)) return [HOME];
	const routes = value.map(readRoute).filter((r): r is Route => r !== null);
	const rest = [HOME, ...routes.filter((r) => r.page !== "home")];
	if (rest.length <= MAX_DEPTH) return rest;
	const keep = base(rest);
	return [...rest.slice(0, keep), ...rest.slice(rest.length - MAX_DEPTH + keep)];
}

const RANGES: readonly RangeId[] = ["7d", "4w", "1y"];
const METRICS: readonly MetricId[] = ["distance", "time", "ascent", "calories"];

export function readRoute(value: unknown): Route | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	switch (raw.page) {
		case "home":
		case "glance":
		case "activities":
		case "health":
		case "performance":
			return { page: raw.page };
		case "all":
			return allOf(raw);
		case "records": {
			const tab = RECORD_TABS.find((t) => t.id === raw.tab)?.id;
			return tab ? { page: "records", tab } : null;
		}
		case "category": {
			const category = categoryId(raw.category);
			if (!category) return null;
			return {
				page: "category",
				category,
				sub: subId(raw.sub),
				range: RANGES.includes(raw.range as RangeId) ? (raw.range as RangeId) : "7d",
				// Only the past exists: a later period than now is the current one.
				offset: Number.isInteger(raw.offset) ? Math.min(0, raw.offset as number) : 0,
				metric: metricId(raw.metric, category),
			};
		}
		case "stats": {
			const stat = STAT_IDS.find((id) => id === raw.stat);
			if (!stat) return null;
			return {
				page: "stats",
				stat,
				range: STAT_RANGES.includes(raw.range as StatRange) ? (raw.range as StatRange) : "1d",
				offset: Number.isInteger(raw.offset) ? Math.min(0, raw.offset as number) : 0,
				totals: raw.totals === "weekly" ? "weekly" : "monthly",
			};
		}
		case "sleep":
			return {
				page: "sleep",
				range: SLEEP_RANGES.includes(raw.range as SleepRange) ? (raw.range as SleepRange) : "1d",
				offset: Number.isInteger(raw.offset) ? Math.min(0, raw.offset as number) : 0,
				tab: raw.tab === "coach" ? "coach" : "score",
			};
		case "sleep-factor": {
			const factor = SLEEP_FACTORS.find((f) => f === raw.factor);
			if (!factor || typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
			return { page: "sleep-factor", factor, date: raw.date };
		}
		case "health-stat":
			return healthStatOf(raw);
		case "performance-stat":
			return performanceStatOf(raw);
		case "activity":
			return activityOf(raw);
		case "activity-map": {
			const id = activityId(raw.id);
			if (id === null) return null;
			return {
				page: "activity-map",
				id,
				overlay: typeof raw.overlay === "string" && TOKEN.test(raw.overlay) ? raw.overlay : "pace",
				laps: raw.laps !== false,
			};
		}
		case "month": {
			const category = categoryId(raw.category);
			if (!category || typeof raw.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)) return null;
			return { page: "month", category, sub: subId(raw.sub), month: raw.month, metric: metricId(raw.metric, category) };
		}
		default:
			return null;
	}
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A tab or sub-page id: a short token, nothing that could be markup or a path. */
const TOKEN = /^[\w.:-]{1,64}$/;

/** What a stat route holds besides its page: the stat, its period, and the page's own tab, sub-page and day. */
type StatFields<Id extends string, R extends PeriodRange> = { stat: Id; range: R; offset: number; tab?: string; sub?: string; date?: string };

/**
 * A stat route's fields as its page accepts them, for a stat its section's
 * registry found: none for a stat it did not, so the route is refused; the
 * rest repaired. A range the stat lacks is its default, the offset a whole
 * number at or below 0, and `tab`, `sub` and `date` kept only when they look
 * like one.
 */
function statFieldsOf<Id extends string, R extends PeriodRange>(
	raw: Record<string, unknown>,
	stat: (Pick<StatDef<Id>, "id"> & { ranges: readonly R[]; defaultRange: R }) | undefined,
): StatFields<Id, R> | null {
	if (!stat) return null;
	const fields: StatFields<Id, R> = {
		stat: stat.id,
		range: stat.ranges.includes(raw.range as R) ? (raw.range as R) : stat.defaultRange,
		// Only the past exists: a later period than now is the current one.
		offset: Number.isInteger(raw.offset) ? Math.min(0, raw.offset as number) : 0,
	};
	if (typeof raw.tab === "string" && TOKEN.test(raw.tab)) fields.tab = raw.tab;
	if (typeof raw.sub === "string" && TOKEN.test(raw.sub)) fields.sub = raw.sub;
	if (typeof raw.date === "string" && DATE.test(raw.date)) fields.date = raw.date;
	return fields;
}

/** A health-stat route as the page accepts it: an unknown stat, or Sleep, is refused, the rest repaired. */
function healthStatOf(raw: Record<string, unknown>): HealthStatRoute | null {
	const fields = statFieldsOf(raw, pageStat(raw.stat));
	return fields && { page: "health-stat", ...fields };
}

/** A performance-stat route as the page accepts it: an unknown stat, or Cycling Ability, is refused, the rest repaired. */
function performanceStatOf(raw: Record<string, unknown>): PerformanceStatRoute | null {
	const fields = statFieldsOf(raw, PERFORMANCE_REGISTRY.page(raw.stat));
	return fields && { page: "performance-stat", ...fields };
}

/** An activity route as the page accepts it: an id that can't be one is refused, the rest repaired. */
function activityOf(raw: Record<string, unknown>): ActivityRoute | null {
	const id = activityId(raw.id);
	if (id === null) return null;
	const route: ActivityRoute = {
		page: "activity",
		id,
		tab: ACTIVITY_TABS.find((t) => t === raw.tab) ?? "overview",
		axis: raw.axis === "distance" ? "distance" : "time",
	};
	if (typeof raw.sub === "string" && TOKEN.test(raw.sub)) route.sub = raw.sub;
	const picks = picksOf(raw);
	if (picks) route.picks = picks;
	return route;
}

/** The fields a route saved before `picks` kept the run's picker choices in, and the values each took. */
const LEGACY_PICKS: ReadonlyArray<readonly [field: string, values: readonly string[]]> = [
	["pace", PACE_CHARTS],
	["heart", HEART_CHARTS],
	["power", POWER_CHARTS],
];
/** More pickers than any sport's Charts tab has. */
const MAX_PICKS = 8;
/** A picker's key: a short word, which never reaches an object's prototype (`__proto__`). */
const PICK_KEY = /^[A-Za-z][\w-]{0,31}$/;

/**
 * The Charts tab's choices as the page accepts them: the legacy `pace`,
 * `heart` and `power` folded in (only the values the run had), then `picks`,
 * whose keys and values must be tokens. At most eight; none is no `picks`.
 */
function picksOf(raw: Record<string, unknown>): Record<string, string> | undefined {
	const picks = new Map<string, string>();
	for (const [field, values] of LEGACY_PICKS) {
		const value = raw[field];
		if (typeof value === "string" && values.includes(value)) picks.set(field, value);
	}
	if (raw.picks && typeof raw.picks === "object" && !Array.isArray(raw.picks)) {
		for (const [key, value] of Object.entries(raw.picks as Record<string, unknown>)) {
			if (PICK_KEY.test(key) && typeof value === "string" && TOKEN.test(value)) picks.set(key, value);
		}
	}
	return picks.size ? Object.fromEntries([...picks].slice(0, MAX_PICKS)) : undefined;
}

/** The longest search kept, in characters. */
const MAX_QUERY = 80;
/** More type filters than Garmin's tree has groups and sub-types worth picking at once. */
const MAX_TYPES = 64;
/** More event types than Garmin has. */
const MAX_EVENTS = 16;

/**
 * All Activities as the page accepts it: every field checked and repaired on
 * its own, so one bad value never costs the others. The search is trimmed and
 * cut to 80 characters; types are positive whole ids, each once; dates are
 * real days, put in order; ranges are finite and at least 0, put in order;
 * events are tokens; the two flags are only ever `true`.
 */
function allOf(raw: Record<string, unknown>): AllRoute {
	const route: AllRoute = { page: "all" };
	if (typeof raw.q === "string") {
		const q = [...raw.q.trim()].slice(0, MAX_QUERY).join("").trim();
		if (q) route.q = q;
	}
	const sort = ALL_SORTS.find((s) => s === raw.sort);
	if (sort) route.sort = sort;
	const types = uniqueOf(raw.types, (v): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0, MAX_TYPES);
	if (types) route.types = types;
	let from = isoDay(raw.from);
	let to = isoDay(raw.to);
	if (from && to && from > to) [from, to] = [to, from];
	if (from) route.from = from;
	if (to) route.to = to;
	rangeOf(raw, route, "dmin", "dmax");
	rangeOf(raw, route, "tmin", "tmax");
	rangeOf(raw, route, "amin", "amax");
	const events = uniqueOf(raw.events, (v): v is string => typeof v === "string" && TOKEN.test(v), MAX_EVENTS);
	if (events) route.events = events;
	if (raw.fav === true) route.fav = true;
	if (raw.pr === true) route.pr = true;
	return route;
}

/** The distinct items of an array that pass `ok`, in order, at most `max`; none is undefined. */
function uniqueOf<T>(value: unknown, ok: (v: unknown) => v is T, max: number): T[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = [...new Set(value.filter(ok))].slice(0, max);
	return out.length ? out : undefined;
}

/** A real calendar day, `YYYY-MM-DD`: 2026-02-30 is none. */
function isoDay(value: unknown): string | undefined {
	if (typeof value !== "string" || !DATE.test(value)) return undefined;
	const [y, m, d] = value.split("-").map(Number) as [number, number, number];
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? value : undefined;
}

type RangeKey = "dmin" | "dmax" | "tmin" | "tmax" | "amin" | "amax";

/** A filter's two ends: each finite and at least 0, the pair put in order. */
function rangeOf(raw: Record<string, unknown>, route: AllRoute, minKey: RangeKey, maxKey: RangeKey): void {
	const end = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
	let min = end(raw[minKey]);
	let max = end(raw[maxKey]);
	if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
	if (min !== undefined) route[minKey] = min;
	if (max !== undefined) route[maxKey] = max;
}

/** Garmin's activity ids: positive integers, about 2e10 now. */
function activityId(value: unknown): number | null {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function categoryId(value: unknown): CategoryId | undefined {
	return CATEGORIES.find((c) => c.id === value)?.id;
}

function subId(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function metricId(value: unknown, category: CategoryId): MetricId {
	const allowed = CATEGORIES.find((c) => c.id === category)!.metrics;
	return METRICS.includes(value as MetricId) && allowed.includes(value as MetricId) ? (value as MetricId) : allowed[0];
}

/** Steps, Floors or Intensity Minutes as the hub and Home open them: today. */
export function statsRoute(stat: StatId): Route {
	return { page: "stats", stat, range: "1d", offset: 0, totals: "monthly" };
}

/** The Sleep page as Home and the hub open it: a night's score, `offset` days back. */
export function sleepRoute(offset = 0): Route {
	return { page: "sleep", range: "1d", offset: Math.min(0, offset), tab: "score" };
}

/** Where a stat page opens, when not on its default range and the current period. */
export interface StatRouteOptions {
	range?: PeriodRange;
	offset?: number;
	tab?: string;
	sub?: string;
	date?: string;
}

/**
 * A Health Stats page as the hub, Home and the commands open it: its default
 * range, the current period, unless `opts` says otherwise. Whatever `opts`
 * holds is checked as a saved route would be.
 */
export function healthStatRoute(stat: HealthStatPageId, opts: StatRouteOptions = {}): HealthStatRoute {
	return healthStatOf({ ...opts, stat })!;
}

/**
 * A Performance Stats page as the hub, Home and the commands open it: its
 * default range, the current period and, without a `tab`, its first tab,
 * unless `opts` says otherwise. Whatever `opts` holds is checked as a saved
 * route would be.
 */
export function performanceStatRoute(stat: PerformanceStatPageId, opts: StatRouteOptions = {}): PerformanceStatRoute {
	return performanceStatOf({ ...opts, stat })!;
}

/**
 * The page an At a Glance or In Focus card opens on Performance Stats: the
 * card's stat, on the tab, sub-page and range its link names. A page that
 * opens on a day (1d) opens on Home's, `dayOffset` days back, as Health's do.
 */
export function performanceTargetRoute(target: GlanceTarget<StatDef<PerformanceStatPageId>>, dayOffset = 0): PerformanceStatRoute {
	const range = target.range ?? target.stat.defaultRange;
	return performanceStatRoute(target.stat.id, { range, tab: target.tab, sub: target.sub, ...(range === "1d" ? { offset: dayOffset } : {}) });
}

/** The registry entry behind a stat route: its title, ranges, range names, spans and tabs. */
export function statOfRoute(route: StatRoute): StatDef | undefined {
	return route.page === "health-stat" ? pageStat(route.stat) : PERFORMANCE_REGISTRY.page(route.stat);
}

/** A stat page's tabs as its tab bar shows them: the one the route names is on, or the first. */
export function statTabs(route: StatRoute): Array<{ id: string; label: string; on: boolean }> {
	const stat = statOfRoute(route);
	const tabs = stat?.tabs ?? [];
	const current = route.tab !== undefined && tabs.includes(route.tab) ? route.tab : tabs[0];
	return tabs.map((id) => ({ id, label: stat?.tabLabels?.[id] ?? id, on: id === current }));
}

/**
 * How a stat page's range control looks: Health's own, or Performance's
 * compact (34 tall, labels in 74 pt slots spaced across 338 / 255 / 170 pt)
 * or wide (36 tall, packed 72 pt slots across 370 / 184 pt), and its width.
 */
export function rangeControlOf(route: StatRoute, segments: number): { family: "health" | "compact" | "wide"; width?: number } {
	if (route.page === "health-stat") return { family: "health" };
	const family = statOfRoute(route)?.rangeControl === "wide" ? "wide" : "compact";
	const width = (family === "wide" ? WIDE_WIDTHS : COMPACT_WIDTHS)[segments];
	return width === undefined ? { family } : { family, width };
}

const COMPACT_WIDTHS: Readonly<Record<number, number>> = { 2: 170, 3: 255, 4: 338 };
const WIDE_WIDTHS: Readonly<Record<number, number>> = { 2: 184, 4: 370 };

/**
 * A stat page moved in place, as its range control, steppers and cards move
 * it: another range or period of the same stat, on the same tab and sub-page,
 * with the day 1d last showed when the move carries one.
 */
export function moveStatRoute(route: StatRoute, next: PeriodRoute<PeriodRange>): StatRoute {
	const raw = { stat: route.stat, range: next.range, offset: next.offset, tab: route.tab, sub: route.sub, date: next.date };
	return (route.page === "health-stat" ? healthStatOf(raw) : performanceStatOf(raw)) ?? route;
}

/** An activity's page as a row opens it: Overview, charts against time. */
export function activityRoute(id: number): ActivityRoute {
	return { page: "activity", id, tab: "overview", axis: "time" };
}

/**
 * The activity's full-screen map as the Overview map opens it: in the
 * Overview's overlay (a run's is pace), laps marked.
 */
export function activityMapRoute(id: number, overlay = "pace"): ActivityMapRoute {
	return { page: "activity-map", id, overlay, laps: true };
}

/**
 * All Activities searched, sorted or filtered: a link that opens it on a
 * group ("All Walking Activities"), say. `opts` is checked as a saved route
 * would be; none is everything, newest first.
 */
export function allRoute(opts: Omit<AllRoute, "page"> = {}): AllRoute {
	return allOf({ ...opts });
}

/** A category page as the hub opens it: everything, this week, the first tab. */
export function categoryRoute(category: CategoryId): Route {
	const metric = CATEGORIES.find((c) => c.id === category)!.metrics[0];
	return { page: "category", category, sub: null, range: "7d", offset: 0, metric };
}
