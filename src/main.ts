import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { pageStats } from "./dashboard/health-stats";
import { GARMIN_HOME_VIEW, GarminHomeView } from "./dashboard/home-view";
import { healthStatRoute, sleepRoute, statsRoute } from "./dashboard/routes";
import { STAT_IDS, STAT_TITLE } from "./dashboard/stats-pages";
import { GARMIN_DASHBOARD_VIEW, GarminDashboardView } from "./dashboard/view";
import { GarminApi } from "./garmin/endpoints";
import { ObsidianHttpClient } from "./obsidian-http";
import { PluginData } from "./plugin-data";
import { GarminSettingTab } from "./settings";
import { DAY_INDEXES } from "./sync/day-indexes";
import { SyncRunner } from "./sync/runner";
import { GARMIN_ICON, registerGarminIcon } from "./ui/icon";
import { HEALTH_PAGES } from "./ui/svelte/health/pages";
import { registerSportIcons } from "./ui/sport-icons";
import { LoginModal } from "./ui/login-modal";
import { ProbeModal } from "./ui/probe-modal";
import { SyncRangeModal } from "./ui/sync-range-modal";

/** Long enough for the vault's metadata cache to be ready before a sync reads it. */
const STARTUP_SYNC_DELAY_MS = 5000;

export default class GarminPlugin extends Plugin {
	data!: PluginData;
	garmin!: GarminApi;
	sync!: SyncRunner;

	async onload(): Promise<void> {
		registerGarminIcon();
		registerSportIcons();

		this.data = new PluginData(this);
		await this.data.init();

		this.buildClient();
		await this.garmin.restore();

		if (this.data.migratedAwayFromStoredPassword) {
			new Notice(
				"Garmin Connect: a password left in data.json by the phase 0 probe has " +
					"been deleted. Consider changing your Garmin password.",
				10000,
			);
		}

		this.registerView(
			GARMIN_DASHBOARD_VIEW,
			(leaf: WorkspaceLeaf) => new GarminDashboardView(leaf, this),
		);

		this.registerView(GARMIN_HOME_VIEW, (leaf: WorkspaceLeaf) => new GarminHomeView(leaf, this));

		this.addRibbonIcon(GARMIN_ICON, "Open Garmin dashboard", () => void this.openView(GARMIN_HOME_VIEW));

		// The dashboard is being rebuilt as a copy of Garmin Connect, Home first.
		// The previous dashboard stays one command away until that is finished.
		this.addCommand({
			id: "open-dashboard",
			name: "Open dashboard",
			callback: () => void this.openView(GARMIN_HOME_VIEW),
		});
		this.addCommand({
			id: "open-activities",
			name: "Open activities",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, { page: "activities" }] }),
		});
		for (const stat of STAT_IDS) {
			this.addCommand({
				id: `open-${stat === "intensity" ? "intensity-minutes" : stat}`,
				name: `Open ${STAT_TITLE[stat].toLowerCase()}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, statsRoute(stat)] }),
			});
		}
		this.addCommand({
			id: "open-sleep",
			name: "Open sleep",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, sleepRoute()] }),
		});
		// One per Health Stats page built so far.
		for (const stat of pageStats(Object.keys(HEALTH_PAGES))) {
			this.addCommand({
				id: `open-${stat.id}`,
				name: `Open ${stat.title.toLowerCase()}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, healthStatRoute(stat.id)] }),
			});
		}
		this.addCommand({
			id: "open-classic-dashboard",
			name: "Open classic dashboard",
			callback: () => void this.openView(GARMIN_DASHBOARD_VIEW),
		});

		this.addCommand({
			id: "sync-recent",
			name: "Sync recent days",
			callback: () => void this.sync.syncRecent(),
		});
		this.addCommand({
			id: "sync-today",
			name: "Sync today",
			callback: () => void this.sync.syncToday(),
		});
		this.addCommand({
			id: "sync-activity-history",
			name: "Sync activity history",
			callback: () => void this.sync.syncActivityHistory(),
		});
		this.addCommand({
			id: "sync-daily-stats-history",
			name: "Sync step, floor and intensity history",
			callback: () => void this.sync.syncDailyStatsHistory(),
		});
		this.addCommand({
			id: "sync-sleep-history",
			name: "Sync sleep history",
			callback: () => void this.sync.syncSleepHistory(),
		});
		for (const def of DAY_INDEXES) {
			this.addCommand({
				id: `sync-${def.kind}-history`,
				name: `Sync ${def.title} history`,
				callback: () => void this.sync.syncIndexHistory(def.kind),
			});
		}
		this.addCommand({
			id: "sync-range",
			name: "Sync a date range…",
			callback: () => new SyncRangeModal(this.app, this).open(),
		});
		this.addCommand({
			id: "rebuild-table-view",
			name: "Rebuild the Garmin table view",
			callback: async () => {
				const path = await this.sync.rewriteBasesView();
				new Notice(`Rebuilt ${path}`);
			},
		});
		this.addCommand({
			id: "sign-in",
			name: "Sign in to Garmin Connect",
			callback: () => this.openLogin(),
		});
		this.addCommand({
			id: "run-probe",
			name: "Run connectivity probe",
			callback: () => new ProbeModal(this.app, this).open(),
		});

		this.addSettingTab(new GarminSettingTab(this.app, this));

		if (this.data.settings.syncOnStartup && this.garmin.isAuthenticated) {
			// Deferred: a sync at load time competes with vault indexing, and the
			// daily-note lookup needs the metadata cache populated.
			this.registerInterval(
				window.setTimeout(() => void this.sync.syncRecent(), STARTUP_SYNC_DELAY_MS),
			);
		}
	}

	/**
	 * Reuses an open view rather than stacking duplicates. `state` opens it on
	 * a particular page, in a view that is already up as much as a new one.
	 */
	async openView(type: string, state?: Record<string, unknown>): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(type)[0];
		if (existing && !state) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}
		const leaf = existing ?? this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type, active: true, ...(state ? { state } : {}) });
		await this.app.workspace.revealLeaf(leaf);
	}

	/** The domain is baked into every URL, so changing it needs a fresh client. */
	buildClient(): void {
		this.garmin = new GarminApi({
			http: new ObsidianHttpClient(),
			store: this.data,
			domain: this.data.settings.domain,
		});
		this.sync = new SyncRunner(this.app, this.garmin, () => this.data.settings);
	}

	async rebuildClient(): Promise<void> {
		this.buildClient();
		await this.garmin.restore();
	}

	openLogin(onDone?: () => void): void {
		new LoginModal(this.app, this, onDone).open();
	}

	async signOut(): Promise<void> {
		await this.garmin.logout();
		this.sync.reset();
	}
}
