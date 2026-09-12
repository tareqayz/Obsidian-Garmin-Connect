import { Notice, Plugin } from "obsidian";
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

		this.addRibbonIcon("activity", "Sync Garmin data", () => void this.sync.syncRecent());

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
