import { ItemView } from "obsidian";
import { GARMIN_ICON } from "../ui/icon";
import { GARMIN_HOME_VIEW } from "./home-view";

/**
 * The classic dashboard's view type. The dashboard was retired in 0.2, but a
 * workspace saved before then can still hold a tab of it: this view turns that
 * tab into Home the first time it is shown, rather than leaving a dead leaf.
 *
 * Remove it the release after 0.2 (TODO.md).
 */
export const LEGACY_DASHBOARD_VIEW = "garmin-dashboard";

export class LegacyDashboardView extends ItemView {
	getViewType(): string {
		return LEGACY_DASHBOARD_VIEW;
	}

	getDisplayText(): string {
		return "Garmin Home";
	}

	getIcon(): string {
		return GARMIN_ICON;
	}

	async onOpen(): Promise<void> {
		// A tick later: swapping the view from inside its own onOpen re-enters setViewState.
		this.registerInterval(
			window.setTimeout(() => {
				if (this.leaf.view === this) void this.leaf.setViewState({ type: GARMIN_HOME_VIEW });
			}, 0),
		);
	}
}
