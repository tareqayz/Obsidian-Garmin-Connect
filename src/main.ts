import { Notice, Platform, Plugin, type WorkspaceLeaf } from "obsidian";
import { categoryOf } from "./dashboard/activities";
import { pageStats } from "./dashboard/health-stats";
import { GARMIN_HOME_VIEW, GarminHomeView } from "./dashboard/home-view";
import { LEGACY_DASHBOARD_VIEW, LegacyDashboardView } from "./dashboard/legacy-view";
import { PERFORMANCE_REGISTRY } from "./dashboard/performance-stats";
import { healthStatRoute, performanceStatRoute, sleepRoute, statsRoute } from "./dashboard/routes";
import { commandTitle } from "./dashboard/stat-registry";
import { STAT_IDS, STAT_TITLE } from "./dashboard/stats-pages";
import { GarminApi, toIsoDate } from "./garmin/endpoints";
import { ObsidianHttpClient } from "./obsidian-http";
import { PluginData } from "./plugin-data";
import { GarminSettingTab } from "./settings";
import { DAY_INDEXES } from "./sync/day-indexes";
import { importDayNotes } from "./sync/import-notes";
import { SyncRunner, type BackfillProgress, type DeviceIdentity } from "./sync/runner";
import { VaultSeriesStore } from "./sync/series-store";
import { GARMIN_ICON, registerGarminIcon } from "./ui/icon";
import { HEALTH_PAGES } from "./ui/svelte/health/pages";
import { PERFORMANCE_PAGES } from "./ui/svelte/performance/pages";
import { registerSportIcons } from "./ui/sport-icons";
import { LoginModal } from "./ui/login-modal";
import { removeLeafletStyles } from "./ui/map/leaflet";
import { ProbeModal } from "./ui/probe-modal";
import { SyncRangeModal } from "./ui/sync-range-modal";
import { SetupModal } from "./ui/setup-modal";
import { deleteSyncedFiles } from "./ui/delete-data";
import { DataUpdateModal } from "./ui/data-update-modal";
import { debtItems, pendingItems, type DebtItem } from "./sync/debt";
import { costOf } from "./sync/estimate";
import type { UpdateLine } from "./ui/setup-flow";
import { defaultData } from "./settings-data";
import type { ActivityRow } from "./sync/activity-index";

/** Long enough for the vault's metadata cache to be ready before a sync reads it. */
const STARTUP_SYNC_DELAY_MS = 5000;
/** The backfill carries on after the startup sync has had its turn. */
const STARTUP_BACKFILL_DELAY_MS = 8000;
/** Where this device keeps its id, for the backfill's lease. Per vault and device, never synced. */
const DEVICE_KEY = "garmin-connect-device";

export default class GarminPlugin extends Plugin {
	data!: PluginData;
	garmin!: GarminApi;
	sync!: SyncRunner;

	async onload(): Promise<void> {
		registerGarminIcon();
		registerSportIcons();
		// The activity maps add Leaflet's stylesheet when they first draw.
		this.register(removeLeafletStyles);

		this.data = new PluginData(this);
		await this.data.init();

		this.buildClient();
		await this.garmin.restore();
		this.bindStatusBar();

		this.registerView(GARMIN_HOME_VIEW, (leaf: WorkspaceLeaf) => new GarminHomeView(leaf, this));
		this.registerView(LEGACY_DASHBOARD_VIEW, (leaf: WorkspaceLeaf) => new LegacyDashboardView(leaf));

		this.addRibbonIcon(GARMIN_ICON, "Open Garmin Home", () => void this.openView(GARMIN_HOME_VIEW));

		this.addCommand({
			id: "open-dashboard",
			name: "Open home",
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
		// Performance Stats once its hub has a page, and one per page the hub lists:
		// Load and Heat Acclimation open from Training Status instead.
		const performance = PERFORMANCE_REGISTRY.hubStats(Object.keys(PERFORMANCE_PAGES));
		if (performance.length) {
			this.addCommand({
				id: "open-performance-stats",
				name: "Open performance stats",
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, { page: "performance" }] }),
			});
		}
		for (const stat of performance) {
			this.addCommand({
				id: `open-${stat.id}`,
				name: `Open ${commandTitle(stat.title)}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: [{ page: "home" }, performanceStatRoute(stat.id)] }),
			});
		}

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
			id: "sign-in",
			name: "Sign in to Garmin Connect",
			callback: () => this.openLogin(),
		});
		this.addCommand({
			id: "set-up",
			name: "Set up Garmin Connect…",
			callback: () => this.openSetup(),
		});
		this.addCommand({
			id: "run-probe",
			name: "Run diagnostics",
			callback: () => new ProbeModal(this.app, this).open(),
		});

		this.addSettingTab(new GarminSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => this.importDayNotes());

		if (this.data.settings.syncOnStartup && this.garmin.isAuthenticated) {
			// Deferred: a sync at load time competes with vault indexing, and the
			// import of old day notes reads the metadata cache first.
			this.registerInterval(
				window.setTimeout(() => void this.sync.syncRecent(), STARTUP_SYNC_DELAY_MS),
			);
		}
		// A backfill agreed to carries on where the files say it stopped, whether or not the startup sync runs.
		this.app.workspace.onLayoutReady(() =>
			this.registerInterval(window.setTimeout(() => this.sync.kickBackfill(), STARTUP_BACKFILL_DELAY_MS)),
		);
	}

	onunload(): void {
		this.sync.stop();
	}

	/**
	 * The user enabled the plugin, just installed or turned back on: until the
	 * setup has run, Home opens behind the setup wizard. A vault already set up
	 * — another device's settings, or a re-enable — opens nothing.
	 */
	onUserEnable(): void {
		this.app.workspace.onLayoutReady(() => {
			if (this.data.settings.setup) return;
			void this.openView(GARMIN_HOME_VIEW).then(() => this.openSetup());
		});
	}

	openSetup(): void {
		new SetupModal(this.app, this).open();
	}

	/**
	 * "Delete synced data": the plugin's files go to the trash (see
	 * `owned-paths.ts`), and the plugin starts over — no setup, nothing agreed
	 * to — so no backfill fetches them straight back.
	 */
	async deleteSyncedData(opts: { diagnostics: boolean }): Promise<{ files: number; bytes: number }> {
		const settings = this.data.settings;
		this.sync.reset();
		const done = await deleteSyncedFiles(this.app, { dataFolder: settings.dataFolder, ...(opts.diagnostics ? { logFolder: settings.logFolder } : {}) });
		settings.setup = null;
		settings.data = defaultData();
		await this.data.saveSettings();
		this.setupChanged();
		return done;
	}

	private statusBar: HTMLElement | null = null;
	private statusOff: (() => void) | null = null;

	/**
	 * The history download in the status bar, on a computer: how far it has
	 * got, or why it waits. Gone once nothing is left. Clicking it opens
	 * Settings → Data.
	 */
	private bindStatusBar(): void {
		if (!Platform.isDesktopApp) return;
		if (!this.statusBar) {
			this.statusBar = this.addStatusBarItem();
			this.statusBar.addClass("gch-status", "mod-clickable");
			this.statusBar.onclick = () => {
				const setting = (this.app as unknown as { setting: { open(): void; openTabById(id: string): void } }).setting;
				setting.open();
				setting.openTabById(this.manifest.id);
			};
		}
		const bar = this.statusBar;
		const show = (progress: BackfillProgress | null) => {
			if (!progress) return bar.toggle(false);
			const total = progress.done + progress.remaining;
			const percent = total > 0 ? Math.min(99, Math.round((progress.done / total) * 100)) : 0;
			const text =
				progress.status === "running"
					? `Garmin · history ${percent}%`
					: progress.status === "elsewhere"
						? `Garmin · downloading on ${progress.device ?? "another device"}`
						: progress.reason === "sign-in"
							? "Garmin · sign in to continue"
							: progress.reason === "user"
								? "Garmin · download paused"
								: "Garmin · download resting";
			bar.setText(text);
			bar.toggle(true);
		};
		this.statusOff?.();
		this.statusOff = this.sync.onBackfill(show);
		show(this.sync.backfillProgress);
	}

	/** Asked once a session at most: what an update offers. */
	private askedForUpdates = false;

	/**
	 * What the data sets offer that has not been agreed to — every item with
	 * something to fetch, or only those not put off yet — as dialog lines.
	 */
	async updateLines(only: "pending" | "all"): Promise<UpdateLine[]> {
		const settings = this.data.settings;
		if (!settings.setup) return [];
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		if (!store.hasData()) return [];
		const [scan, coverage, charts, index, runFiles] = await Promise.all([
			store.readScan(),
			store.readDayCoverage(settings.groups.includes("intraday")),
			store.readChartMetas(),
			store.readActivities(),
			store.readRunCoverage(),
		]);
		const input = {
			today: toIsoDate(),
			groups: settings.groups,
			accepted: settings.data.accepted,
			deferred: settings.data.deferred,
			dayDetails: settings.data.dayDetails,
			runDetails: settings.data.runDetails,
			since: settings.setup.completedAt.slice(0, 10),
			scan,
			daySpans: coverage.spans,
			charts,
			runs: index.rows.filter((row) => this.isRun(row)).map((row) => ({ id: row.id, date: row.start.slice(0, 10) })),
			runFiles,
		};
		const items: DebtItem[] = only === "pending" ? pendingItems(input) : debtItems(input);
		return items.map((item) => ({ key: item.key, title: item.title, detail: item.detail, ...costOf(item, settings.groups, settings.syncSpeed) }));
	}

	/** The first Garmin view after an update: one dialog for whatever the update offers. */
	async askForUpdates(): Promise<void> {
		if (this.askedForUpdates || !this.garmin.isAuthenticated) return;
		const lines = await this.updateLines("pending");
		if (!lines.length || this.askedForUpdates) return;
		this.askedForUpdates = true;
		new DataUpdateModal(this.app, this, lines).open();
	}

	/** Yes to `keys`, later to `later`: the ledger keeps both, and the backfill starts on the yeses. */
	async agreeTo(keys: readonly string[], later: readonly string[]): Promise<void> {
		const data = this.data.settings.data;
		const accepted = [...new Set([...data.accepted, ...keys])];
		data.accepted = accepted;
		data.deferred = [...new Set([...data.deferred, ...later])].filter((key) => !accepted.includes(key));
		await this.data.saveSettings();
		this.setupChanged();
		if (keys.length) this.sync.kickBackfill();
	}

	/** The rows that are runs, the ones whose page opens: what Run details downloads. */
	isRun(row: ActivityRow): boolean {
		return categoryOf(row) === "running";
	}

	/** Signed in or out: open views redraw what depends on it, and a backfill waiting for the sign-in carries on. */
	authChanged(): void {
		if (this.garmin.isAuthenticated) void this.sync.signedIn();
		this.refreshViews();
	}

	/** The setup ran, or the data choices changed: open views redraw their setup card. */
	setupChanged(): void {
		this.refreshViews();
		for (const listener of this.dataListeners) listener();
	}

	private dataListeners = new Set<() => void>();

	/** Called when the data folder's contents or the data choices change wholesale: a delete, a setup. Returns the unsubscribe. */
	onDataChanged(listener: () => void): () => void {
		this.dataListeners.add(listener);
		return () => this.dataListeners.delete(listener);
	}

	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(GARMIN_HOME_VIEW)) {
			const view = leaf.view;
			if (view instanceof GarminHomeView) void view.refreshState();
		}
	}

	/** Another device changed data.json: take its setup and data choices. */
	async onExternalSettingsChange(): Promise<void> {
		await this.data.reloadChoices();
		this.setupChanged();
		this.sync.kickBackfill();
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

	/** Brings the days old builds wrote as notes into the day files, once the vault is indexed. */
	private importDayNotes(): void {
		const run = async () => {
			const store = new VaultSeriesStore(this.app, this.data.settings.dataFolder);
			const count = await importDayNotes(this.app, store, this.data.legacyNotes);
			if (count) new Notice(`Garmin: copied ${count} days from the old day notes into ${store.daysFolder}.`);
		};
		const go = () => void run().catch((err) => console.error("Garmin: day note import failed", err));
		// A file with no cache yet means the vault is still being indexed.
		const indexed = this.app.vault.getMarkdownFiles().every((f) => this.app.metadataCache.getFileCache(f));
		if (indexed) go();
		else {
			const ref = this.app.metadataCache.on("resolved", () => {
				this.app.metadataCache.offref(ref);
				go();
			});
			this.registerEvent(ref);
		}
	}

	/** The domain is baked into every URL, so changing it needs a fresh client. */
	buildClient(): void {
		this.garmin = new GarminApi({
			http: new ObsidianHttpClient(),
			store: this.data,
			domain: this.data.settings.domain,
		});
		this.sync = new SyncRunner(this.app, this.garmin, () => this.data.settings, (row) => this.isRun(row), this.device());
	}

	/** This device for the backfill's lease: an id kept in this vault's local storage, and a name a person knows it by. */
	private device(): DeviceIdentity {
		let id = this.app.loadLocalStorage(DEVICE_KEY) as string | null;
		if (typeof id !== "string" || !id) {
			id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
			this.app.saveLocalStorage(DEVICE_KEY, id);
		}
		const label = Platform.isIosApp ? (Platform.isTablet ? "iPad" : "iPhone") : Platform.isAndroidApp ? "Android" : Platform.isMacOS ? "Mac" : Platform.isWin ? "Windows PC" : "computer";
		return { id, label };
	}

	async rebuildClient(): Promise<void> {
		this.sync.stop();
		this.buildClient();
		await this.garmin.restore();
		this.bindStatusBar();
		// Open views listen to the runner: hand them the new one.
		for (const leaf of this.app.workspace.getLeavesOfType(GARMIN_HOME_VIEW)) {
			const view = leaf.view;
			if (view instanceof GarminHomeView) view.rebindRunner();
		}
		this.authChanged();
	}

	openLogin(onDone?: () => void): void {
		new LoginModal(this.app, this, onDone).open();
	}

	async signOut(): Promise<void> {
		await this.garmin.logout();
		this.sync.reset();
		this.authChanged();
	}
}
