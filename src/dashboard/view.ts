import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import { describe } from "../sync/runner";
import Dashboard from "../ui/svelte/Dashboard.svelte";
import { SyncRangeModal } from "../ui/sync-range-modal";
import { collectRows } from "./collect";
import { GARMIN_ICON } from "../ui/icon";

export const GARMIN_DASHBOARD_VIEW = "garmin-dashboard";

export class GarminDashboardView extends ItemView {
	private plugin: GarminPlugin;
	private component: ReturnType<typeof Dashboard> | undefined;
	private pending = 0;

	constructor(leaf: WorkspaceLeaf, plugin: GarminPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return GARMIN_DASHBOARD_VIEW;
	}

	getDisplayText(): string {
		return "Garmin dashboard";
	}

	getIcon(): string {
		return GARMIN_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.component = mount(Dashboard, {
			target: this.contentEl,
			props: {
				initialRows: collectRows(this.app, this.plugin.data.settings),
				today: toIsoDate(),
				canSync: this.plugin.garmin.isAuthenticated,
				onSync: async () => {
					const report = await this.plugin.sync.syncRecent();
					// The metadata listener refreshes the rows; this is only the
					// one-line summary the status strip shows.
					return report ? describe(report).replace(/^Garmin sync: /, "") : null;
				},
				onBackfill: () => new SyncRangeModal(this.app, this.plugin).open(),
			},
		});

		// A sync writes frontmatter; the open dashboard should follow it. Pushing
		// new rows in keeps the range selection and the table toggle intact.
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.pending);
		if (this.component) {
			unmount(this.component);
			this.component = undefined;
		}
	}

	private scheduleRefresh(): void {
		window.clearTimeout(this.pending);
		this.pending = window.setTimeout(() => {
			this.component?.setRows(collectRows(this.app, this.plugin.data.settings));
		}, 120);
	}
}
