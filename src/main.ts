import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { GARMIN_DASHBOARD_VIEW, GarminDashboardView } from "./dashboard/view";
import { GarminApi } from "./garmin/endpoints";
import { ObsidianHttpClient } from "./obsidian-http";
import { PluginData } from "./plugin-data";
import { GarminSettingTab } from "./settings";
import { SyncRunner } from "./sync/runner";
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

		this.addRibbonIcon("activity", "Open Garmin dashboard", () => void this.openDashboard());

		this.addCommand({
			id: "open-dashboard",
			name: "Open dashboard",
			callback: () => void this.openDashboard(),
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

	/** Reuses an open dashboard rather than stacking duplicates. */
	async openDashboard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(GARMIN_DASHBOARD_VIEW);
		if (existing.length > 0) {
			await this.app.workspace.revealLeaf(existing[0]!);
			return;
		}
		const leaf = this.app.workspace.getLeaf("tab");
		await leaf.setViewState({ type: GARMIN_DASHBOARD_VIEW, active: true });
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
