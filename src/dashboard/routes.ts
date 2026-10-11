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
	| { page: "more" }
	| { page: "activities" }
	| { page: "category"; category: CategoryId; sub: number | null; range: RangeId; offset: number; metric: MetricId }
	| { page: "month"; category: CategoryId; sub: number | null; month: string; metric: MetricId }
	| { page: "records"; tab: RecordTab }
	| { page: "all" }
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
	 * picker choices ride along, which also lets a check open any of them.
	 */
	| {
			page: "activity";
			id: number;
			tab: ActivityTab;
			axis: ActivityAxis;
			sub?: string;
			pace?: PaceChart;
			heart?: HeartChart;
			power?: PowerChart;
	  }
	/** The activity's full-screen map, with its Map Settings choices. */
	| { page: "activity-map"; id: number; overlay: MapOverlay; laps: boolean };

export type HealthStatRoute = Extract<Route, { page: "health-stat" }>;
export type PerformanceStatRoute = Extract<Route, { page: "performance-stat" }>;
/** A page on either stats section's shared route. */
export type StatRoute = HealthStatRoute | PerformanceStatRoute;
export type ActivityRoute = Extract<Route, { page: "activity" }>;
export type ActivityMapRoute = Extract<Route, { page: "activity-map" }>;

export const ACTIVITY_TABS = ["overview", "stats", "laps", "charts", "gear"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];
export type ActivityAxis = "time" | "distance";
/** The Charts tab's three pickers: pace, heart rate, power. */
export const PACE_CHARTS = ["pace", "gap", "lap-pace"] as const;
export type PaceChart = (typeof PACE_CHARTS)[number];
export const HEART_CHARTS = ["heart-rate", "zones"] as const;
export type HeartChart = (typeof HEART_CHARTS)[number];
export const POWER_CHARTS = ["watts", "per-kg"] as const;
export type PowerChart = (typeof POWER_CHARTS)[number];
/** What colours the route: the Map Settings sheet's Data Overlay. */
export const MAP_OVERLAYS = ["none", "pace", "gap", "heart-rate", "power", "elevation", "run-walk"] as const;
export type MapOverlay = (typeof MAP_OVERLAYS)[number];

export const HOME: Route = { page: "home" };

/** Deep enough for Home → More → Activities → Running → a month → a run → its map, with room. */
const MAX_DEPTH = 8;

export function push(stack: readonly Route[], route: Route): Route[] {
	const next = [...stack, route];
	// Drop from just above Home rather than lose the way back to it.
	return next.length > MAX_DEPTH ? [next[0]!, ...next.slice(next.length - MAX_DEPTH + 1)] : next;
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

/** A route's identity: its keys in a fixed order, whatever order they were written in. */
function routeKey(route: Route): string {
	return JSON.stringify(route, Object.keys(route).sort());
}

/** Changes the page on top without adding a step, for a filter or a tab. */
export function replace(stack: readonly Route[], route: Route): Route[] {
	return stack.length > 1 ? [...stack.slice(0, -1), route] : [HOME, route];
}

export function top(stack: readonly Route[]): Route {
	return stack[stack.length - 1] ?? HOME;
}

/** A stack read back from saved state: Home at the bottom, every page valid, or just Home. */
export function readStack(value: unknown): Route[] {
	if (!Array.isArray(value)) return [HOME];
	const routes = value.map(readRoute).filter((r): r is Route => r !== null);
	const rest = routes.filter((r) => r.page !== "home").slice(-(MAX_DEPTH - 1));
	return [HOME, ...rest];
}

const RANGES: readonly RangeId[] = ["7d", "4w", "1y"];
const METRICS: readonly MetricId[] = ["distance", "time", "ascent", "calories"];

export function readRoute(value: unknown): Route | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	switch (raw.page) {
		case "home":
		case "glance":
		case "more":
		case "activities":
		case "all":
		case "health":
		case "performance":
			return { page: raw.page };
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
				overlay: MAP_OVERLAYS.find((o) => o === raw.overlay) ?? "pace",
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
	const pace = PACE_CHARTS.find((c) => c === raw.pace);
	if (pace) route.pace = pace;
	const heart = HEART_CHARTS.find((c) => c === raw.heart);
	if (heart) route.heart = heart;
	const power = POWER_CHARTS.find((c) => c === raw.power);
	if (power) route.power = power;
	return route;
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
	return METRICS.includes(value as MetricId) && allowed.includes(value as MetricId) ? (value as MetricId) : allowed[0]!;
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

/** The activity's full-screen map as the Overview map opens it: coloured by pace, laps marked. */
export function activityMapRoute(id: number): ActivityMapRoute {
	return { page: "activity-map", id, overlay: "pace", laps: true };
}

/** A category page as the hub opens it: everything, this week, the first tab. */
export function categoryRoute(category: CategoryId): Route {
	const metric = CATEGORIES.find((c) => c.id === category)!.metrics[0]!;
	return { page: "category", category, sub: null, range: "7d", offset: 0, metric };
}
