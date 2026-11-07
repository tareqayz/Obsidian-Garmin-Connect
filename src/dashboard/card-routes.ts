import type { ActivityRow } from "../sync/activity-index";
import { activityIdFor } from "./activities";
import type { GlanceId } from "./glance";
import { glanceStat } from "./health-stats";
import type { FocusId, TodayItem } from "./home";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { activityRoute, healthStatRoute, performanceTargetRoute, sleepRoute, statsRoute, type Route } from "./routes";

/**
 * The page each Home card opens, as the app opens it: on Home, and the same
 * cards in a note. Pure.
 *
 * `dayOffset` is the card's day as days back from today (0 today, −1
 * yesterday). A day's page opens on that day, as Sleep's card opens its night.
 */

/** The pages this build has, by section: a card whose page isn't built opens nothing. */
export interface BuiltPages {
	health: readonly string[];
	performance: readonly string[];
}

/** An At a Glance card's page, or null for the cards without one. */
export function glanceRoute(id: GlanceId, dayOffset: number, built: BuiltPages): Route | null {
	if (id === "steps" || id === "floors" || id === "intensity") return statsRoute(id, dayOffset);
	if (id === "sleep") return sleepRoute(dayOffset);
	const stat = glanceStat(id, built.health);
	if (stat) return healthStatRoute(stat.id, stat.defaultRange === "1d" ? { offset: dayOffset } : {});
	const target = PERFORMANCE_REGISTRY.glanceTarget(id, built.performance);
	return target ? performanceTargetRoute(target, dayOffset) : null;
}

/** An In Focus card's page. Body Battery's opens nothing, as in the app. */
export function focusRoute(id: FocusId, dayOffset: number, built: BuiltPages): Route | null {
	switch (id) {
		case "sleep":
			return sleepRoute(dayOffset);
		case "steps":
		case "readiness":
		case "trainingStatus":
			return glanceRoute(id, dayOffset, built);
		case "activities":
			return { page: "all" };
		case "bodyBattery":
			return null;
	}
}

/** A Today's Activity row's page: an activity the index holds opens its own; a Health Snapshot opens nothing. */
export function todayItemRoute(item: TodayItem, rows: readonly ActivityRow[]): Route | null {
	if (item.kind !== "activity") return null;
	const id = activityIdFor(rows, item.start, item.name);
	return id === null ? null : activityRoute(id);
}
