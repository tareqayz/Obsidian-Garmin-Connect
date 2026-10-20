import { CATEGORIES } from "./activities";
import { healthStat, hubStats } from "./health-stats";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { HOME, categoryRoute, healthStatRoute, isAreaRoot, performanceStatRoute, sleepRoute, statsRoute, top, type Route } from "./routes";
import { STAT_IDS, STAT_TITLE } from "./stats-pages";

/**
 * The plugin's areas: Home, and the three the More page used to hold —
 * Garmin's Activities, Health Stats and Performance Stats. A wide pane lists
 * them in a rail down its left side, the current one opened to its pages; a
 * phone shows them as tabs across the top of Home and of each area's own page.
 */
export type AreaId = "home" | "activities" | "health" | "performance";

export interface Area {
	id: AreaId;
	title: string;
	/** The phone's tab: four full titles don't fit across 402 pt. */
	short: string;
	/** One of Obsidian's Lucide icons: the More page's, and Home's house. */
	icon: string;
}

export const AREAS: readonly Area[] = [
	{ id: "home", title: "Home", short: "Home", icon: "house" },
	{ id: "activities", title: "Activities", short: "Activities", icon: "activity" },
	{ id: "health", title: "Health Stats", short: "Health", icon: "heart-pulse" },
	{ id: "performance", title: "Performance Stats", short: "Performance", icon: "chart-column" },
];

/**
 * The rail expanded or collapsed by hand. Left alone it follows the pane's
 * width: expanded from 1000 pt, collapsed to its icons below.
 */
export type RailPref = "expanded" | "collapsed";

export function areaTitle(id: AreaId): string {
	return AREAS.find((a) => a.id === id)!.title;
}

/**
 * The areas there is something to show for: Performance Stats once its hub
 * lists a built page, as the More page had it. `performancePages` is
 * `Object.keys(PERFORMANCE_PAGES)`, which only the Svelte side can read.
 */
export function visibleAreas(performancePages: Iterable<string>): Area[] {
	const performance = PERFORMANCE_REGISTRY.hubStats(performancePages).length > 0;
	return AREAS.filter((a) => a.id !== "performance" || performance);
}

/** Where a page lives. Steps, Floors and Intensity Minutes are on Activities' list, as in the app. */
export function pageArea(route: Route): AreaId {
	switch (route.page) {
		case "home":
		case "glance":
			return "home";
		case "activities":
		case "category":
		case "month":
		case "records":
		case "all":
		case "activity":
		case "activity-map":
		case "stats":
			return "activities";
		case "health":
		case "sleep":
		case "sleep-factor":
		case "health-stat":
			return "health";
		case "performance":
		case "performance-stat":
			return "performance";
	}
}

/** An area's own page, as its tab or its row in the rail opens it: Home, or the area's list above Home. */
export function areaStack(area: AreaId): Route[] {
	return area === "home" ? [HOME] : [HOME, { page: area }];
}

/** A page opened inside its area, as the commands and the rail open one: Back goes to the area's list. */
export function inArea(route: Route): Route[] {
	const stack = areaStack(pageArea(route));
	return route.page === top(stack).page ? stack : [...stack, route];
}

/** The area a stack was entered through: the area's page right above Home, or Home. */
export function areaOf(stack: readonly Route[]): AreaId {
	const root = stack[1];
	return isAreaRoot(root) ? root.page : "home";
}

/** Home itself, or an area's own page: where the phone shows the tabs. */
export function atAreaRoot(stack: readonly Route[]): boolean {
	return stack.length <= 1 || (stack.length === 2 && isAreaRoot(stack[1]));
}

/** A row of the rail, and of the area's own list. */
export interface AreaItem {
	/** The pages it stands for, as `itemKey` names them. */
	key: string;
	label: string;
	route: Route;
}

/** The line Activities' list draws before Steps, Floors and Intensity Minutes. */
export const DIVIDER = "divider";
export type AreaEntry = AreaItem | typeof DIVIDER;

/** The pages built so far, by area: the registries' ids, which only the Svelte side can read. */
export interface BuiltPages {
	health: Iterable<string>;
	performance: Iterable<string>;
}

/**
 * An area's pages, in the app's order: what its list shows and what the rail
 * opens it to. Sleep opens on the newest night, `sleepOffset` days back, which
 * only Home knows.
 */
export function areaItems(area: AreaId, built: BuiltPages, sleepOffset = 0): AreaEntry[] {
	switch (area) {
		case "home":
			return [];
		case "activities":
			return [
				...CATEGORIES.map((c) => ({ key: `category:${c.id}`, label: c.title, route: categoryRoute(c.id) })),
				{ key: "all", label: "All Activities", route: { page: "all" } },
				DIVIDER,
				...STAT_IDS.map((s) => ({ key: `stats:${s}`, label: STAT_TITLE[s], route: statsRoute(s) })),
			];
		case "health":
			return hubStats(built.health).map((stat) => {
				const id = stat.id;
				return id === "sleep"
					? { key: "health:sleep", label: stat.title, route: sleepRoute(sleepOffset) }
					: { key: `health:${id}`, label: stat.title, route: healthStatRoute(id) };
			});
		case "performance":
			return PERFORMANCE_REGISTRY.hubStats(built.performance).map((stat) => ({
				key: `performance:${stat.id}`,
				label: stat.title,
				route: performanceStatRoute(stat.id),
			}));
	}
}

/**
 * The rail row a page belongs to: a category's page and its months are the
 * category's, a night's factor is Sleep's. Null for a page the rail doesn't
 * list — an area's own page, an activity, Personal Records, a page another
 * page opens (Training Status → Load).
 */
export function itemKey(route: Route): string | null {
	switch (route.page) {
		case "category":
		case "month":
			return `category:${route.category}`;
		case "all":
			return "all";
		case "stats":
			return `stats:${route.stat}`;
		case "sleep":
		case "sleep-factor":
			return "health:sleep";
		case "health-stat":
			return healthStat(route.stat)?.hub === false ? null : `health:${route.stat}`;
		case "performance-stat":
			return PERFORMANCE_REGISTRY.get(route.stat)?.hub === false ? null : `performance:${route.stat}`;
		default:
			return null;
	}
}

/** What the rail opens and lights up: an area, and the row that is the page you are on. */
export interface RailFocus {
	area: AreaId;
	item: string | null;
}

/**
 * The rail's focus for a stack: the nearest page down from the top that the
 * rail lists, so a run opened from Running keeps Running lit and Load keeps
 * Training Status; else the top page's own area, with no row lit.
 */
export function railFocus(stack: readonly Route[]): RailFocus {
	for (const route of stack.slice(1).reverse()) {
		const item = itemKey(route);
		if (item) return { area: pageArea(route), item };
	}
	return { area: pageArea(top(stack)), item: null };
}
