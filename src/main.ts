import { Notice, Platform, Plugin, type App, type Modal, type WorkspaceLeaf } from "obsidian";
import { categoryOf, detailProfileOf } from "./dashboard/activities";
import { areaStack, inArea } from "./dashboard/areas";
import { pageStats } from "./dashboard/health-stats";
import { GARMIN_HOME_VIEW, GarminHomeView } from "./dashboard/home-view";
import { LEGACY_DASHBOARD_VIEW, LegacyDashboardView } from "./dashboard/legacy-view";
import { PERFORMANCE_REGISTRY } from "./dashboard/performance-stats";
import { healthStatRoute, performanceStatRoute, sleepRoute, statsRoute } from "./dashboard/routes";
import { commandTitle } from "./dashboard/stat-registry";
import { STAT_IDS, STAT_TITLE } from "./dashboard/stats-pages";
import { GarminApi, toIsoDate } from "./garmin/endpoints";
import { HAD_SESSION_KEY, SecretTokenStore, SESSION_SECRET } from "./garmin/secret-token-store";
import type { GarminDomain } from "./garmin/constants";
import { ObsidianHttpClient } from "./obsidian-http";
import { PluginData } from "./plugin-data";
import { GarminSettingTab } from "./settings";
import { DAY_INDEXES } from "./sync/day-indexes";
import { BUDGET_KEY, SyncRunner, type BackfillProgress, type DeviceIdentity } from "./sync/runner";
import { VaultSeriesStore } from "./sync/series-store";
import { GARMIN_ICON } from "./ui/icon";
import { HEALTH_PAGES } from "./ui/svelte/health/pages";
import { PERFORMANCE_PAGES } from "./ui/svelte/performance/pages";
import { registerSportIcons } from "./ui/sport-icons";
import { LoginModal } from "./ui/login-modal";
import { saveDebugInfo } from "./debug-info";
import { ProbeModal } from "./ui/probe-modal";
import { SyncRangeModal } from "./ui/sync-range-modal";
import { SetupModal } from "./ui/setup-modal";
import { deletePlan, deleteSyncedFiles } from "./ui/delete-data";
import { RemovedDataModal } from "./ui/removed-data-modal";
import { watchForUninstall } from "./uninstall-watch";
import { TILE_DB } from "./ui/map/tiles";
import { DataUpdateModal } from "./ui/data-update-modal";
import { debtItems, pendingItems, type DebtInput, type DebtItem } from "./sync/debt";
import { estimateDelta, type EstimateInput } from "./sync/estimate";
import type { DetailCandidate } from "./sync/backfill";
import { PACE } from "./sync/pace";
import type { UpdateLine, UpdateTotal } from "./ui/setup-flow";
import { defaultData } from "./settings-data";
import type { ActivityRow } from "./sync/activity-index";

/** Long enough for the vault's metadata cache to be ready before a sync reads it. */
const STARTUP_SYNC_DELAY_MS = 5000;
/** What an uninstalled plugin leaves on this device besides the vault: the map tiles, the device's id, its request budget and its Garmin session. */
function forgetThisDevice(app: App): void {
	try {
		window.indexedDB.deleteDatabase(TILE_DB);
	} catch {
		// Nothing to clear.
	}
	app.saveLocalStorage(DEVICE_KEY, null);
	app.saveLocalStorage(SIGN_IN_CARD_KEY, null);
	app.saveLocalStorage(BUDGET_KEY, null);
	app.saveLocalStorage(HAD_SESSION_KEY, null);
	app.secretStorage?.setSecret(SESSION_SECRET, "");
}

/** The backfill carries on after the startup sync has had its turn. */
const STARTUP_BACKFILL_DELAY_MS = 8000;
/** Where this device keeps its id, for the backfill's lease. Per vault and device, never synced. */
const DEVICE_KEY = "garmin-connect-device";
/** Set when Home's "Not signed in on this device" card was put away here: a device that only reads what another syncs. */
const SIGN_IN_CARD_KEY = "garmin-connect-hide-sign-in";

export default class GarminPlugin extends Plugin {
	data!: PluginData;
	garmin!: GarminApi;
	sync!: SyncRunner;
	/** This device's Garmin session, in Obsidian's keychain rather than data.json. */
	tokens!: SecretTokenStore;

	async onload(): Promise<void> {
		registerSportIcons();

		this.tokens = new SecretTokenStore(this.app);
		this.data = new PluginData(this, this.tokens);
		await this.data.init();

		this.buildClient();
		await this.garmin.restore();
		this.bindStatusBar();

		this.registerView(GARMIN_HOME_VIEW, (leaf: WorkspaceLeaf) => new GarminHomeView(leaf, this));
		this.registerView(LEGACY_DASHBOARD_VIEW, (leaf: WorkspaceLeaf) => new LegacyDashboardView(leaf));

		// Home itself, even when the view sits on another page.
		this.addRibbonIcon(GARMIN_ICON, "Open Garmin Home", () => void this.openView(GARMIN_HOME_VIEW, { stack: areaStack("home") }));

		// Each page opens inside its area, as the rail opens it: Back goes to the area's list.
		this.addCommand({
			id: "open-dashboard",
			name: "Open home",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: areaStack("home") }),
		});
		this.addCommand({
			id: "open-activities",
			name: "Open activities",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: areaStack("activities") }),
		});
		for (const stat of STAT_IDS) {
			this.addCommand({
				id: `open-${stat === "intensity" ? "intensity-minutes" : stat}`,
				name: `Open ${STAT_TITLE[stat].toLowerCase()}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: inArea(statsRoute(stat)) }),
			});
		}
		this.addCommand({
			id: "open-health-stats",
			name: "Open health stats",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: areaStack("health") }),
		});
		this.addCommand({
			id: "open-sleep",
			name: "Open sleep",
			callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: inArea(sleepRoute()) }),
		});
		// One per Health Stats page built so far.
		for (const stat of pageStats(Object.keys(HEALTH_PAGES))) {
			this.addCommand({
				id: `open-${stat.id}`,
				name: `Open ${stat.title.toLowerCase()}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: inArea(healthStatRoute(stat.id)) }),
			});
		}
		// Performance Stats once its hub has a page, and one per page the hub lists:
		// Load and Heat Acclimation open from Training Status instead.
		const performance = PERFORMANCE_REGISTRY.hubStats(Object.keys(PERFORMANCE_PAGES));
		if (performance.length) {
			this.addCommand({
				id: "open-performance-stats",
				name: "Open performance stats",
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: areaStack("performance") }),
			});
		}
		for (const stat of performance) {
			this.addCommand({
				id: `open-${stat.id}`,
				name: `Open ${commandTitle(stat.title)}`,
				callback: () => void this.openView(GARMIN_HOME_VIEW, { stack: inArea(performanceStatRoute(stat.id)) }),
			});
		}

		this.addCommand({
			id: "sync-recent",
			name: "Sync recent days",
			callback: () => void this.sync.syncRecent("command"),
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
			name: "Sign in",
			callback: () => this.openLogin(),
		});
		this.addCommand({
			id: "set-up",
			name: "Set up…",
			callback: () => this.openSetup(),
		});
		this.addCommand({
			id: "stop-sync",
			name: "Stop syncing",
			callback: () => new Notice(this.sync.stopForeground() ? "Garmin: stopping after the day in progress." : "No Garmin sync is running."),
		});
		this.addCommand({
			id: "pause-download",
			name: "Pause the history download",
			callback: () => void this.sync.pauseBackfill(),
		});
		this.addCommand({
			id: "resume-download",
			name: "Resume the history download",
			callback: () => void this.sync.resumeBackfill(),
		});
		this.addCommand({
			id: "copy-debug-info",
			name: "Save debug info",
			callback: () => void this.saveDebugInfo(),
		});
		this.addCommand({
			id: "run-probe",
			name: "Run diagnostics",
			callback: () => new ProbeModal(this.app, this).open(),
		});

		this.addSettingTab(new GarminSettingTab(this.app, this));

		if (this.data.settings.syncOnStartup && this.garmin.isAuthenticated) {
			// Deferred: a sync at load time competes with vault indexing.
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
		// A dialog this instance opened would act through it after a reload (an update): close it.
		for (const dialog of this.dialogs) dialog.close();
		// Uninstalled rather than disabled or updated: offer to remove the synced data (see uninstall-watch.ts).
		const app = this.app;
		const dir = this.manifest.dir;
		const dataFolder = this.data.settings.dataFolder;
		const logFolder = this.data.settings.logFolder;
		if (!dir) return;
		watchForUninstall({
			exists: () => app.vault.adapter.exists(dir),
			onGone: () => {
				forgetThisDevice(app);
				if (deletePlan(app, dataFolder).files) new RemovedDataModal(app, dataFolder, logFolder).open();
			},
		});
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

	/** The setup and update dialogs this instance has open, closed when it unloads. */
	private dialogs = new Set<Modal>();

	private track(dialog: Modal): void {
		this.dialogs.add(dialog);
		const close = dialog.onClose.bind(dialog);
		dialog.onClose = () => {
			this.dialogs.delete(dialog);
			close();
		};
		dialog.open();
	}

	openSetup(): void {
		this.track(new SetupModal(this.app, this));
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
	 * Settings → History.
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
				progress.status === "running" || progress.status === "waiting"
					? `Garmin · history ${percent}%`
					: progress.status === "elsewhere"
						? `Garmin · downloading on ${progress.device ?? "another device"}`
						: progress.reason === "sign-in"
							? "Garmin · sign in to continue"
							: progress.reason === "update"
								? "Garmin · update the plugin to continue"
							: progress.reason === "blocked"
								? "Garmin · refused by Garmin, resting"
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

	/** What the update lines and their total are worked out from, read once: null before the setup or without data here. */
	private async updateInput(): Promise<(DebtInput & EstimateInput) | null> {
		const settings = this.data.settings;
		if (!settings.setup) return null;
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		if (!store.hasData()) return null;
		const [scan, coverage, charts, index, detailFiles] = await Promise.all([
			store.readScan(),
			store.readDayCoverage(settings.groups.includes("intraday")),
			store.readChartMetas(),
			store.readActivities(),
			store.readDetailCoverage(),
		]);
		return {
			today: toIsoDate(),
			groups: settings.groups,
			accepted: settings.data.accepted,
			deferred: settings.data.deferred,
			dayDetails: settings.data.dayDetails,
			activityDetails: settings.data.activityDetails,
			since: settings.setup.completedAt.slice(0, 10),
			scan,
			daySpans: coverage.spans,
			charts,
			activities: index.rows.map((row) => this.candidateOf(row)),
			detailFiles,
			budget: this.sync.budgetOutlook(),
			now: Date.now(),
		};
	}

	/**
	 * What the data sets offer that has not been agreed to — every item with
	 * something to fetch, or only those not put off yet — as dialog lines.
	 */
	async updateLines(only: "pending" | "all"): Promise<UpdateLine[]> {
		const input = await this.updateInput();
		if (!input) return [];
		const items: DebtItem[] = only === "pending" ? pendingItems(input) : debtItems(input);
		return items.map((item) => {
			const { bytes, seconds } = estimateDelta(input, [item.key]);
			return { key: item.key, title: item.title, detail: item.detail, bytes, seconds };
		});
	}

	/** What picked update lines add together, as one download under one hourly budget. */
	async updateTotal(): Promise<UpdateTotal> {
		const input = await this.updateInput();
		return (keys) => (input && keys.length ? estimateDelta(input, keys) : { bytes: 0, seconds: 0 });
	}

	/** The first Garmin view after an update: one dialog for whatever the update offers. */
	async askForUpdates(): Promise<void> {
		if (this.askedForUpdates || !this.garmin.isAuthenticated) return;
		const [lines, total] = await Promise.all([this.updateLines("pending"), this.updateTotal()]);
		if (!lines.length || this.askedForUpdates) return;
		this.askedForUpdates = true;
		this.track(new DataUpdateModal(this.app, this, lines, total));
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

	/** An activity on the index as the history download plans it: its day, whether it's a run, and what its page costs. */
	candidateOf(row: ActivityRow): DetailCandidate {
		return { id: row.id, date: row.start.slice(0, 10), run: this.isRun(row), profile: detailProfileOf(row), ...(row.power ? { power: true } : {}) };
	}

	/** The rows that are runs: all an older Run details agreement downloads, before Activity details is agreed to. */
	isRun(row: ActivityRow): boolean {
		return categoryOf(row) === "running";
	}

	/** Signed in or out: open views redraw what depends on it, and a backfill waiting for the sign-in carries on. */
	authChanged(): void {
		if (this.garmin.isAuthenticated) {
			this.app.saveLocalStorage(SIGN_IN_CARD_KEY, null);
			void this.sync.signedIn();
		}
		this.refreshViews();
	}

	/** Whether Home's "Not signed in on this device" card was put away on this device. */
	get signInCardHidden(): boolean {
		return this.app.loadLocalStorage(SIGN_IN_CARD_KEY) === "1";
	}

	/** Puts that card away on this device, for one that only reads what another syncs. */
	hideSignInCard(): void {
		this.app.saveLocalStorage(SIGN_IN_CARD_KEY, "1");
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

	/** The domain is baked into every URL, so changing it needs a fresh client. */
	buildClient(): void {
		this.garmin = new GarminApi({
			http: new ObsidianHttpClient(),
			store: this.tokens,
			domain: this.data.settings.domain,
			limits: PACE.limits,
		});
		this.sync = new SyncRunner(this.app, this.garmin, () => this.data.settings, (row) => this.candidateOf(row), this.device(), this.manifest.version);
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

	/** For a bug report: versions, settings without the email, the last sync and its warnings — see `debug-info.ts`. */
	async saveDebugInfo(error?: unknown): Promise<void> {
		try {
			new Notice(await saveDebugInfo(this, error === undefined ? {} : { error }), 8000);
		} catch (err) {
			new Notice(`Couldn't gather the debug info: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	/**
	 * A new region: every host changes, so the client is built again, signed out
	 * — a session belongs to the region that issued it.
	 */
	async setDomain(domain: GarminDomain): Promise<void> {
		if (this.data.settings.domain === domain) return;
		if (this.garmin.isAuthenticated) await this.garmin.logout();
		this.data.settings.domain = domain;
		await this.data.saveSettings();
		await this.rebuildClient();
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
