import { ItemView, TAbstractFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import type { DayIndexData, ReadIndex } from "../sync/day-index";
import { dayIndex } from "../sync/day-indexes";
import { describe } from "../sync/runner";
import { VaultSeriesStore } from "../sync/series-store";
import { pickStat } from "../ui/add-stat-modal";
import { SleepHistoryModal } from "../ui/sleep-history-modal";
import { SheetModal, type OpenSheet, type SheetBodyProps } from "../ui/sheet-modal";
import { openStreetMapTiles } from "../ui/map/tiles";
import type { TileSource } from "../ui/map/tile-source";
import type { ActivityDetail, ActivityLoad } from "../sync/activity-detail";
import Home from "../ui/svelte/home/Home.svelte";
import { GARMIN_ICON } from "../ui/icon";
import type { ActivitiesData } from "./activities";
import { unitsOf } from "./day";
import { availableStats, type GlanceId } from "./glance";
import { dayToShow, homeModel, type HomeModel, type MoreId, type PresetId } from "./home";
import { HOME, readStack, type Route } from "./routes";
import type { DayRow } from "./series";
import type { HistoryView, SleepData } from "./sleep-pages";
import type { StatsData } from "./stats-pages";
import type { DaySeries } from "../sync/intraday";
import type { SetupCardKind } from "../ui/setup-flow";

export const GARMIN_HOME_VIEW = "garmin-home";


/** The series files' entry among the versions: not a name an index can have. */
const SERIES = "#series";
/** The day files' and account.json's entries, which the stat pages watch beside the indexes'. */
const DAYS = "#days";
const ACCOUNT = "#account";

/** Activity details kept in memory, so a page coming back draws at once: Back from the map. */
const REMEMBERED_ACTIVITIES = 8;

/** While a backfill writes, Home rebuilds at most this often. */
const BACKFILL_REFRESH_MS = 30_000;

/**
 * The Home screen: Garmin Connect's home, drawn from what the sync wrote, and
 * the pages that open from it.
 *
 * Reads the day files, that day's series file, `account.json`,
 * the activity index, the daily stats index and the sleep index, and rebuilds
 * whenever any of them changes. Which page is open is part of the view's state, so a reload
 * returns to it.
 *
 * The registered day indexes (`day-indexes.ts`) are not part of that
 * rebuild: a page reads one when it asks (`readIndex`), and a change in an
 * index's folder only moves that index's version, which the pages reading it
 * watch. The stat pages read the day files and account.json the same way
 * (`readDays`, `readAccount`), each once per version of its own (`#days`,
 * `#account`), while Home's rebuild goes on reading them for itself.
 */
export class GarminHomeView extends ItemView {
	private plugin: GarminPlugin;
	private component: ReturnType<typeof Home> | undefined;
	private pending = 0;
	private stack: Route[] = [HOME];
	/** By index kind, `SERIES`, `DAYS` and `ACCOUNT`: moved, a moment after the files settle, whenever one changes. */
	private versions = new Map<string, number>();
	private bumps = new Map<string, number>();
	/** Unsubscribes from the runner's progress. */
	private unbind: Array<() => void> = [];
	/** When each version last moved, and when Home last rebuilt: while a backfill writes, both wait their turn. */
	private bumpedAt = new Map<string, number>();
	private refreshedAt = 0;
	/** What a page read, by the same keys, for as long as its version holds. */
	private cache = new Map<string, { version: number; data: Promise<unknown> }>();
	private activities = new Map<number, ActivityDetail>();
	private tileSource: TileSource | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GarminPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return GARMIN_HOME_VIEW;
	}

	getDisplayText(): string {
		return "Garmin Home";
	}

	getIcon(): string {
		return GARMIN_ICON;
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), stack: this.stack };
	}

	/** Restores the saved page, and is how a command opens one in a view that is already up. */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const saved = (state as { stack?: unknown } | null)?.stack;
		if (saved !== undefined) {
			this.stack = readStack(saved);
			this.component?.navigate(this.stack);
		}
		await super.setState(state, result);
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("gch-view");
		const today = toIsoDate();
		const rows = await this.rows();
		const [model, activities] = await Promise.all([this.build(today, rows), this.buildActivities(rows)]);
		const [stats, sleep] = await Promise.all([this.buildStats(rows, activities.units), this.buildSleep(activities.units)]);
		this.component = mount(Home, {
			target: this.contentEl,
			props: {
				initialModel: model,
				initialActivities: activities,
				initialStats: stats,
				initialSleep: sleep,
				initialStack: this.stack,
				initialHistory: this.plugin.sync.historyProgress,
				initialStatsHistory: this.plugin.sync.statsHistoryProgress,
				initialSleepHistory: this.plugin.sync.sleepHistoryProgress,
				initialIndexHistory: this.plugin.sync.indexHistoryProgress,
				initialPreset: this.plugin.data.home.preset,
				initialHidden: [...this.plugin.data.home.hidden],
				initialGlance: this.plugin.data.home.glance ? [...this.plugin.data.home.glance] : undefined,
				today,
				initialCanSync: this.plugin.garmin.isAuthenticated,
				initialSetupCard: await this.setupCard(),
				initialBackfill: this.plugin.sync.backfillProgress,
				onSetUp: () => this.plugin.openSetup(),
				onSignIn: () => this.plugin.openLogin(),
				onPauseBackfill: () => void this.plugin.sync.pauseBackfill(),
				onResumeBackfill: () => void this.plugin.sync.resumeBackfill(),
				onSync: async () => {
					const report = await this.plugin.sync.syncRecent();
					return report ? describe(report).replace(/^Garmin sync: /, "") : null;
				},
				onChange: (preset: PresetId, hidden: MoreId[], glance: GlanceId[] | undefined) =>
					void this.plugin.data.saveHome({ preset, hidden, ...(glance ? { glance } : {}) }),
				onPick: (current: GlanceId[]) => pickStat(this.app, availableStats(current)),
				onRoute: (stack: Route[]) => {
					this.stack = stack;
					this.app.workspace.requestSaveLayout();
				},
				onSyncHistory: () => void this.plugin.sync.syncActivityHistory(),
				onSyncStatsHistory: () => void this.plugin.sync.syncDailyStatsHistory(),
				onSyncSleepHistory: () => void this.plugin.sync.syncSleepHistory(),
				onSyncIndexHistory: (kind: string) => void this.plugin.sync.syncIndexHistory(kind),
				onSleepHistory: (view: HistoryView) => new SleepHistoryModal(this.app, view).open(),
				readSeries: (days: string[]) => this.readSeries(days),
				readIndex: ((kind: string) => this.readIndex(kind)) as ReadIndex,
				readDays: () => this.cached(DAYS, () => this.rows()),
				readAccount: () => this.cached(ACCOUNT, () => this.store().readAccount()),
				loadIntraday: (date: string, keys: readonly string[]) => this.plugin.sync.loadIntraday(date, keys),
				loadActivity: (id: number) => this.loadActivity(id),
				cachedActivity: (id: number) => this.activities.get(id) ?? null,
				tiles: () => this.tiles(),
				openSheet: (<P extends SheetBodyProps>(title: string, body: Component<P>, props: Omit<P, "onClose">) =>
					new SheetModal(this.app, title, body, props).open()) as OpenSheet,
			},
		});

		this.bindRunner();
		// The first Garmin view after an update asks about what it offers, once.
		void this.plugin.askForUpdates();

		// Everything the sync writes is a JSON file under the data folder.
		const onFile = (file: TAbstractFile) => {
			const store = this.store();
			// A registered index reaches only the pages that read it.
			const def = store.dayIndexOf(file.path);
			if (def) {
				this.bump(def.kind);
				return;
			}
			if (!store.owns(file.path)) return;
			// Coverage is the backfill's bookkeeping: no page reads it.
			if (file.path === store.dayCoveragePath || file.path === store.runCoveragePath) return;
			if (store.isSeriesPath(file.path)) this.bump(SERIES);
			else if (file.path.startsWith(`${store.sleepFolder}/`)) this.bump("sleep");
			else if (file.path.startsWith(`${store.dailyStatsFolder}/`)) this.bump("daily-stats");
			else if (file.path.startsWith(`${store.daysFolder}/`)) this.bump(DAYS);
			else if (file.path === store.accountPath) this.bump(ACCOUNT);
			this.scheduleRefresh();
		};
		this.registerEvent(this.app.vault.on("modify", onFile));
		this.registerEvent(this.app.vault.on("create", onFile));
		this.registerEvent(this.app.vault.on("delete", onFile));
	}

	/** The runner's progress, to the pages. Bound again when signing in elsewhere replaces the runner. */
	private bindRunner(): void {
		const sync = this.plugin.sync;
		this.unbind.push(
			sync.onHistory((progress) => this.component?.setHistory(progress)),
			sync.onStatsHistory((progress) => this.component?.setStatsHistory(progress)),
			sync.onSleepHistory((progress) => this.component?.setSleepHistory(progress)),
			sync.onIndexHistory((kind, progress) => this.component?.setIndexHistory(kind, progress)),
			sync.onBackfill((progress) => this.component?.setBackfill(progress)),
		);
	}

	rebindRunner(): void {
		for (const off of this.unbind.splice(0)) off();
		this.bindRunner();
		this.component?.setBackfill(this.plugin.sync.backfillProgress);
	}

	/** Signed in or out, set up or not: the Sync button and the setup card follow. */
	async refreshState(): Promise<void> {
		this.component?.setCanSync(this.plugin.garmin.isAuthenticated);
		this.component?.setSetupCard(await this.setupCard());
	}

	/**
	 * The card Home shows above everything else, if any: the setup to finish,
	 * a sign-in, or — set up, signed in, and still nothing here — data that
	 * another device has but this one never received.
	 */
	private async setupCard(): Promise<SetupCardKind | null> {
		if (!this.plugin.data.settings.setup) return "finish";
		if (!this.plugin.garmin.isAuthenticated) return "signed-out";
		const store = this.store();
		if (!store.hasData()) {
			// An account with nothing on Garmin yet is not missing anything here.
			const scan = await store.readScan();
			if (!scan || scan.days || scan.activities) return "no-data";
		}
		return null;
	}

	async onClose(): Promise<void> {
		for (const off of this.unbind.splice(0)) off();
		window.clearTimeout(this.pending);
		for (const timer of this.bumps.values()) window.clearTimeout(timer);
		this.bumps.clear();
		if (this.component) {
			unmount(this.component);
			this.component = undefined;
		}
	}

	/** `this.plugin.sync` read each time: signing in again replaces the runner. */
	private async loadActivity(id: number): Promise<ActivityLoad> {
		const load = await this.plugin.sync.loadActivity(id);
		if (load.detail) {
			this.activities.delete(id);
			this.activities.set(id, load.detail);
			for (const oldest of this.activities.keys()) {
				if (this.activities.size <= REMEMBERED_ACTIVITIES) break;
				this.activities.delete(oldest);
			}
		}
		return load;
	}

	/** OpenStreetMap's tiles, or none when the setting is off. Read when a map draws. */
	private tiles(): TileSource | null {
		if (!this.plugin.data.settings.mapTiles) return null;
		this.tileSource ??= openStreetMapTiles(this.plugin.manifest.version);
		return this.tileSource;
	}

	private store(): VaultSeriesStore {
		return new VaultSeriesStore(this.app, this.plugin.data.settings.dataFolder);
	}

	private rows(): Promise<DayRow[]> {
		return this.store().readDays();
	}

	/** Today, or the newest synced day before it when today has not synced yet. */
	private async build(today: string, rows: DayRow[]): Promise<HomeModel> {
		const date = dayToShow(rows, today);
		const store = this.store();
		const [series, account] = await Promise.all([store.read(date), store.readAccount()]);
		return homeModel({ date, rows, series, account });
	}

	private async buildActivities(rows: DayRow[]): Promise<ActivitiesData> {
		const store = this.store();
		const [index, account] = await Promise.all([store.readActivities(), store.readAccount()]);
		const data: ActivitiesData = {
			rows: index.rows,
			complete: index.meta?.complete === true,
			records: account?.personalRecords ?? [],
			// The sync records the account's units; before it has, the day files say.
			units: index.meta?.units ?? unitsOf(rows),
		};
		if (index.meta?.total !== undefined) data.total = index.meta.total;
		return data;
	}

	/**
	 * What the Steps, Floors and Intensity Minutes pages read. The index has
	 * no calories for the days only a history sync reached, so the day files fill
	 * those in: the same daily summary figure.
	 */
	private async buildStats(rows: DayRow[], units: StatsData["units"]): Promise<StatsData> {
		const store = this.store();
		const index = await store.readDailyStats();
		const calories: Record<string, number> = {};
		for (const row of rows) {
			const kcal = row.values.calories;
			if (typeof kcal === "number" && Number.isFinite(kcal)) calories[row.date] = kcal;
		}
		return {
			rows: index.rows,
			complete: index.meta?.complete === true,
			units,
			// Monday, whatever the account's first day of the week: the app's
			// Intensity Minutes weeks and Garmin's weekly totals both run Monday
			// to Sunday on an account set to start its weeks on Sunday.
			weekStart: 1,
			calories,
		};
	}

	/** What the Sleep pages read: every night the sleep index holds. */
	private async buildSleep(units: SleepData["units"]): Promise<SleepData> {
		const index = await this.store().readSleep();
		return { rows: index.rows, complete: index.meta?.complete === true, units };
	}

	private async readSeries(days: string[]): Promise<Map<string, DaySeries | null>> {
		const store = this.store();
		return new Map(await Promise.all(days.map(async (day) => [day, await store.read(day)] as const)));
	}

	/**
	 * A day index as a stat page reads it: a registered one by its kind, or
	 * the sleep and daily stats indexes. Read once per version, so pages
	 * sharing an index share the read.
	 */
	private readIndex(kind: string): Promise<DayIndexData> {
		return this.cached(kind, () => this.loadIndex(kind));
	}

	/** A read once per version of `key`: a failed one is tried again on the next ask. */
	private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
		const version = this.versions.get(key) ?? 0;
		const hit = this.cache.get(key);
		if (hit?.version === version) return hit.data as Promise<T>;
		const data = load();
		this.cache.set(key, { version, data });
		data.catch(() => {
			if (this.cache.get(key)?.data === data) this.cache.delete(key);
		});
		return data;
	}

	private async loadIndex(kind: string): Promise<DayIndexData> {
		const store = this.store();
		if (kind === "sleep") return store.readSleep();
		if (kind === "daily-stats") return store.readDailyStats();
		const def = dayIndex(kind);
		return def ? store.readDayIndex(def) : { rows: [], meta: null };
	}

	/** The backfill is writing: Home redraws at most every `BACKFILL_REFRESH_MS`. */
	private get backfilling(): boolean {
		return this.plugin.sync.backfillProgress?.status === "running";
	}

	/**
	 * Moves one version, once a burst of file events settles: a sync writes a
	 * year file and the meta together. While a backfill writes, at most every
	 * `BACKFILL_REFRESH_MS`, a burst never putting it off.
	 */
	private bump(key: string): void {
		this.cache.delete(key);
		const fire = () => {
			this.bumps.delete(key);
			this.cache.delete(key);
			this.bumpedAt.set(key, Date.now());
			const version = (this.versions.get(key) ?? 0) + 1;
			this.versions.set(key, version);
			if (key === SERIES) this.component?.setSeriesVersion(version);
			else this.component?.setIndexVersion(key, version);
		};
		if (this.backfilling) {
			if (this.bumps.has(key)) return;
			this.bumps.set(key, window.setTimeout(fire, Math.max(150, (this.bumpedAt.get(key) ?? 0) + BACKFILL_REFRESH_MS - Date.now())));
			return;
		}
		window.clearTimeout(this.bumps.get(key));
		this.bumps.set(key, window.setTimeout(fire, 150));
	}

	private scheduleRefresh(): void {
		let wait = 150;
		if (this.backfilling) {
			if (this.pending) return;
			wait = Math.max(150, this.refreshedAt + BACKFILL_REFRESH_MS - Date.now());
		}
		window.clearTimeout(this.pending);
		this.pending = window.setTimeout(() => {
			this.pending = 0;
			this.refreshedAt = Date.now();
			const today = toIsoDate();
			void this.rows().then(async (rows) => {
				const [model, activities] = await Promise.all([this.build(today, rows), this.buildActivities(rows)]);
				const [stats, sleep] = await Promise.all([this.buildStats(rows, activities.units), this.buildSleep(activities.units)]);
				this.component?.setModel(model, today);
				this.component?.setActivities(activities);
				this.component?.setStats(stats);
				this.component?.setSleep(sleep);
			});
		}, wait);
	}
}
