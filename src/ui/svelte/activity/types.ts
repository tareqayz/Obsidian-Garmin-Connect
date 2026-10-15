import type { Units } from "../../../dashboard/activities";
import type { SportProfile } from "../../../dashboard/activity-sports";
import type { ActivityRoute, Route } from "../../../dashboard/routes";
import type { ActivityDetail } from "../../../sync/activity-detail";
import type { ActivityRow } from "../../../sync/activity-index";
import type { TileSource } from "../../map/tile-source";
import type { OpenSheet } from "../../sheet-modal";

/**
 * What every tab of the activity page gets. Each tab is its own component,
 * so the pages that fill them can be built side by side.
 */
export interface ActivityTabProps {
	detail: ActivityDetail;
	route: ActivityRoute;
	units: Units;
	/** The activity's sport (`profileFor`): the spec each tab hands its view model. */
	profile: SportProfile;
	/** The activity index: what a chart compares the activity with (a ride's power curve record). */
	rows: readonly ActivityRow[];
	/** The map's tiles, or null when the setting is off. */
	tiles: () => TileSource | null;
	go: (route: Route) => void;
	/** The same page with another tab, axis or picker choice. */
	swap: (route: Route) => void;
	/** A link that may lead back down the stack (Records, the running page). */
	reach: (route: Route) => void;
	openSheet: OpenSheet;
}
