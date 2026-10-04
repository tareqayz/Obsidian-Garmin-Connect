import { CATEGORIES, RECORD_TABS, type CategoryId, type MetricId, type RangeId, type RecordTab } from "./activities";
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
	| { page: "stats"; stat: StatId; range: StatRange; offset: number; totals: StatTotals };

export const HOME: Route = { page: "home" };

/** Deep enough for Home → More → Activities → Running → a month → back again, with room. */
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
		case "month": {
			const category = categoryId(raw.category);
			if (!category || typeof raw.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)) return null;
			return { page: "month", category, sub: subId(raw.sub), month: raw.month, metric: metricId(raw.metric, category) };
		}
		default:
			return null;
	}
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

/** A category page as the hub opens it: everything, this week, the first tab. */
export function categoryRoute(category: CategoryId): Route {
	const metric = CATEGORIES.find((c) => c.id === category)!.metrics[0]!;
	return { page: "category", category, sub: null, range: "7d", offset: 0, metric };
}
