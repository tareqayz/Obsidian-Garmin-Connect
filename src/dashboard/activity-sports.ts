import type { ActivityRow } from "../sync/activity-index";
import { categoryOf } from "./activities";
import type { ChartsSpec } from "./activity-chart-pages";
import type { MapSpec } from "./activity-map";
import type { OverviewSpec } from "./activity-overview";
import type { LapsSpec, StatsSpec } from "./activity-stats-pages";
import { BASIC } from "./sports/basic";
import { CYCLING } from "./sports/cycling";
import { MULTISPORT, TRANSITION } from "./sports/multisport";
import { RUNNING } from "./sports/running";
import { OPEN_WATER_SWIM, POOL_SWIM } from "./sports/swimming";

/**
 * Which page an activity gets. Every activity has the same five tabs; what
 * fills them is its sport's profile, which hands each tab's view model a spec
 * (`overviewView`, `statsView`, `lapsView`, `chartsTabView` and the map's
 * functions each take one as their last argument). A part a profile leaves
 * out is the run's, so the running profile is just `{ id: "running" }` and the
 * run's page is drawn by the code that drew it before there were profiles.
 *
 * The sport modules (`sports/*.ts`) import the shared view models, never the
 * other way round; only their data-only palettes are read by
 * `activity-chart-pages.ts`.
 *
 * Pure: no Obsidian import.
 */

export const SPORT_IDS = ["running", "cycling", "pool-swim", "open-water-swim", "multisport", "transition", "basic"] as const;
export type SportId = (typeof SPORT_IDS)[number];

/** What a profile tells each tab; each part left out is the run's. */
export interface SportProfile {
	id: SportId;
	overview?: OverviewSpec;
	stats?: StatsSpec;
	laps?: LapsSpec;
	charts?: ChartsSpec;
	map?: MapSpec;
}

/** What `sportOf` reads: an index row or an activity's file. */
type Typed = Pick<ActivityRow, "type" | "typeId" | "parentTypeId">;

/**
 * An activity's sport: the running family (the rows the hub's Running page
 * lists) and the cycling one by Garmin's type tree, the two swims by their
 * type, a multisport its own page of legs and a multisport's transition the
 * basic page with its own figures, every other sport the basic page. Until the activity type table lands, the families are `categoryOf`'s.
 */
export function sportOf(activity: Typed): SportId {
	const category = categoryOf(activity);
	if (category === "running") return "running";
	if (category === "cycling") return "cycling";
	if (activity.type === "lap_swimming") return "pool-swim";
	if (activity.type === "open_water_swimming") return "open-water-swim";
	if (category === "multisport") return "multisport";
	if (/transition/i.test(activity.type)) return "transition";
	return "basic";
}

const PROFILES: Readonly<Record<SportId, SportProfile>> = {
	running: RUNNING,
	cycling: CYCLING,
	"pool-swim": POOL_SWIM,
	"open-water-swim": OPEN_WATER_SWIM,
	multisport: MULTISPORT,
	transition: TRANSITION,
	basic: BASIC,
};

/** The profile an activity's page is drawn with. */
export function profileFor(activity: Typed): SportProfile {
	return PROFILES[sportOf(activity)];
}
