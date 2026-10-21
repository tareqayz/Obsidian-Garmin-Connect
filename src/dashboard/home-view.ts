import { ItemView, TAbstractFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { mount, unmount, type Component } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import type { DayIndexData, IndexHistoryProgress, ReadIndex } from "../sync/day-index";
import { dayIndex } from "../sync/day-indexes";
import type { BackfillProgress, HistoryProgress, SleepHistoryProgress, StatsHistoryProgress } from "../sync/runner";
import { outcomeLine, type SyncOutcome } from "../sync/sync-outcome";

/** The time a sync ended, as Home's line beside ↻ says it: "2:05 PM". */
const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** A sync's ending as the line beside ↻: "Synced 2:05 PM", "Couldn't sync". */
const syncLine = (outcome: SyncOutcome): string => outcomeLine(outcome, (iso) => clock.format(new Date(iso)));
import { forgetParsedDays, VaultSeriesStore } from "../sync/series-store";
import { rebuildAt } from "./rebuild-schedule";
import { pickStat } from "../ui/add-stat-modal";
import { SleepHistoryModal } from "../ui/sleep-history-modal";
import { SheetModal, type OpenSheet, type SheetBodyProps } from "../ui/sheet-modal";
import { openStreetMapTiles } from "../ui/map/tiles";
import type { TileSource } from "../ui/map/tile-source";
import type { ActivityDetail, ActivityLoad } from "../sync/activity-detail";
import Home from "../ui/svelte/home/Home.svelte";
import { GARMIN_ICON } from "../ui/icon";
import type { ActivitiesData } from "./activities";
import { areaTitle, railFocus, type RailPref } from "./areas";
import { unitsOf } from "./day";
import { availableStats, type GlanceId } from "./glance";
import { dayToShow, homeModel, type HomeModel, type MoreId, type PresetId } from "./home";
import { HOME, readStack, routeKey, type Route } from "./routes";
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

/**
 * What Home.svelte exports. Spelled out because only svelte-check reads the component's own types:
 * tsc and the lint see every `.svelte` import as untyped.
 */
interface HomeApi {
	setCanSync(next: boolean): void;
	setSetupCard(next: SetupCardKind | null): void;
	setBackfill(next: BackfillProgress | null): void;
	setModel(next: HomeModel, nextToday?: string): void;
	setActivities(next: ActivitiesData): void;
	setHistory(next: HistoryProgress | null): void;
	setStats(next: StatsData): void;
	setStatsHistory(next: StatsHistoryProgress | null): void;
	setSleep(next: SleepData): void;
	setSleepHistory(next: SleepHistoryProgress | null): void;
	setIndexHistory(kind: string, next: IndexHistoryProgress | null): void;
	setIndexVersion(kind: string, version: number): void;
	setSeriesVersion(version: number): void;
	navigate(next: Route[]): void;
	setRail(next: RailPref | null): void;
	setRunnerSyncing(next: boolean): void;
	setSyncMessage(next: string | null): void;
}

function sameStack(a: readonly Route[], b: readonly Route[]): boolean {
	return a.length === b.length && a.every((route, i) => routeKey(route) === routeKey(b[i]));
}

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
	private component: HomeApi | undefined;
	private pending = 0;
	private stack: Route[] = [HOME];
	/** The rail expanded or collapsed by hand; null follows the pane's width. */
	private rail: RailPref | null = null;
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

	/** The area you are in: "Garmin Home", "Garmin Health Stats"… Obsidian also stores it for the tab it restores. */
	getDisplayText(): string {
		return `Garmin ${areaTitle(railFocus(this.stack).area)}`;
	}

	getIcon(): string {
		return GARMIN_ICON;
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), stack: this.stack, ...(this.rail ? { rail: this.rail } : {}) };
	}

	/**
	 * Restores the saved page and rail, and is how a command opens a page in a
	 * view that is already up. The same stack again (the tab's title being
	 * redrawn) leaves the page as it is.
	 */
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const saved = state as { stack?: unknown; rail?: unknown } | null;
		if (saved?.rail === "expanded" || saved?.rail === "collapsed") {
			this.rail = saved.rail;
			this.component?.setRail(this.rail);
		}
		if (saved?.stack !== undefined) {
			const next = readStack(saved.stack);
			const same = sameStack(next, this.stack);
			this.stack = next;
			if (!same) this.component?.navigate(this.stack);
		}
		await super.setState(state, result);
	}

	/**
	 * Redraws the tab's title for the area now open. Obsidian redraws a leaf's
	 * header whenever its state is set, and the stack is already this one.
	 */
	private retitle(): void {
		void this.leaf.setViewState({ type: GARMIN_HOME_VIEW, state: this.getState() });
	}

	/** The width the pages get: the pane inside Obsidian's padding. Whether a rail or tabs show follows it. */
	private contentWidth(): number {
		const style = getComputedStyle(this.contentEl);
		return this.contentEl.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
	}

	async onOpen(): Promise<void> {
		// Home in view: a sync may be due.
		this.plugin.autoSync.poke();
		try {
			await this.openHome();
		} catch (err) {
			// Building Home's first view threw on data it didn't expect: say so, and
			// open on Home next time rather than on whatever page was saved.
			console.error("Garmin: Home couldn't open", err);
			this.stack = [HOME];
			this.app.workspace.requestSaveLayout();
			this.showOpenError(err);
		}
	}

	/** What a pane shows when Home couldn't be built at all: the error, Save debug info and Try again. */
	private showOpenError(err: unknown): void {
		this.contentEl.empty();
		const card = this.contentEl.createDiv({ cls: "gch-open-error" });
		card.createEl("strong", { text: "Garmin Home couldn't open" });
		card.createEl("p", { text: "Something in your Garmin data didn't look the way Home expected. Nothing was lost." });
		card.createEl("code", { text: err instanceof Error ? err.message : String(err) });
		const actions = card.createDiv({ cls: "gch-open-error-actions" });
		actions.createEl("button", { text: "Save debug info", cls: "mod-cta" }).addEventListener("click", () => void this.plugin.saveDebugInfo(err));
		actions.createEl("button", { text: "Try again" }).addEventListener("click", () => void this.onOpen());
	}

	private async openHome(): Promise<void> {
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
				onHideSignIn: () => this.plugin.hideSignInCard(),
				onPageError: (error: unknown) => {
					console.error("Garmin: a page couldn't be drawn", error);
					// Home on the next launch, not the page that just threw.
					this.stack = [HOME];
					this.app.workspace.requestSaveLayout();
				},
				onSaveDebugInfo: (error: unknown) => void this.plugin.saveDebugInfo(error),
				onPauseBackfill: () => void this.plugin.sync.pauseBackfill(),
				onResumeBackfill: () => void this.plugin.sync.resumeBackfill(),
				onSync: async () => {
					const outcome = await this.plugin.sync.syncRecent("button");
					return outcome ? syncLine(outcome) : null;
				},
				initialSyncMessage: this.plugin.sync.lastOutcome ? syncLine(this.plugin.sync.lastOutcome) : null,
				onChange: (preset: PresetId, hidden: MoreId[], glance: GlanceId[] | undefined) =>
					void this.plugin.data.saveHome({ preset, hidden, ...(glance ? { glance } : {}) }),
				onPick: (current: GlanceId[]) => pickStat(this.app, availableStats(current)),
				onRoute: (stack: Route[]) => {
					const area = railFocus(this.stack).area;
					this.stack = stack;
					this.app.workspace.requestSaveLayout();
					if (railFocus(stack).area !== area) this.retitle();
				},
				initialRail: this.rail,
				initialWidth: this.contentWidth(),
				onRail: (rail: RailPref) => {
					this.rail = rail;
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
		}) as HomeApi;

		this.bindRunner();
		// The first Garmin view after an update asks about what it offers, once.
		void this.plugin.askForUpdates();

		// Left open past midnight, Home moves to the new day: every page's
		// "Today", "Yesterday" and offsets count from it.
		let shownDay = today;
		this.registerInterval(
			window.setInterval(() => {
				const now = toIsoDate();
				if (now === shownDay) return;
				shownDay = now;
				this.scheduleRefresh();
			}, 60_000),
		);

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
			if (file.path === store.dayCoveragePath || file.path === store.detailCoveragePath) return;
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
			sync.onSyncing((startedAt) => {
				this.component?.setRunnerSyncing(startedAt > 0);
				if (!startedAt) this.syncEnded();
			}),
			sync.onOutcome((outcome) => this.component?.setSyncMessage(syncLine(outcome))),
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
	 * another device has but this one never received. Signed out with data
	 * here, the device reads what another one syncs: it says so, once, until
	 * put away.
	 */
	private async setupCard(): Promise<SetupCardKind | null> {
		if (!this.plugin.data.settings.setup) return "finish";
		const store = this.store();
		if (!this.plugin.garmin.isAuthenticated) {
			// A session that ended here asks for a sign-in; a device that never had
			// one reads what another syncs, and may put the card away.
			if (!store.hasData() || this.plugin.tokens.hadSessionHere) return "signed-out";
			return this.plugin.signInCardHidden ? null : "this-device";
		}
		if (!store.hasData()) {
			// An account with nothing on Garmin yet is not missing anything here.
			const scan = await store.readScan();
			if (!scan || scan.days || scan.activities) return "no-data";
		}
		return null;
	}

	async onClose(): Promise<void> {
		for (const off of this.unbind.splice(0)) off();
		// The last Garmin view gone: the parsed day files go too, on a phone's memory.
		if (!this.app.workspace.getLeavesOfType(this.getViewType()).some((leaf) => leaf.view !== this)) forgetParsedDays();
		window.clearTimeout(this.pending);
		for (const timer of this.bumps.values()) window.clearTimeout(timer);
		this.bumps.clear();
		if (this.component) {
			void unmount(this.component);
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

	/** The backfill is writing: Home redraws at most every `REBUILD_EVERY_MS`. */
	private get backfilling(): boolean {
		return this.plugin.sync.backfillProgress?.status === "running";
	}

	/** When the next redraw may come (`rebuildAt`): once a sync, not once a day. */
	private holdUntil(last: number): number | null {
		return rebuildAt(last, { syncingSince: this.plugin.sync.syncingSince, backfilling: this.backfilling });
	}

	/** A sync ended: what it held back goes now. */
	private syncEnded(): void {
		const keys = [...this.bumps.keys()];
		for (const key of keys) {
			window.clearTimeout(this.bumps.get(key));
			this.bumps.delete(key);
			this.bump(key);
		}
		if (this.pending) {
			window.clearTimeout(this.pending);
			this.pending = 0;
			this.scheduleRefresh();
		}
	}

	/**
	 * Moves one version, once a burst of file events settles: a sync writes a
	 * year file and the meta together. While a backfill writes, at most every
	 * `REBUILD_EVERY_MS`, and while a sync writes, once it ends (`rebuildAt`).
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
		const hold = this.holdUntil(this.bumpedAt.get(key) ?? 0);
		if (hold !== null) {
			if (this.bumps.has(key)) return;
			this.bumps.set(key, window.setTimeout(fire, Math.max(150, hold - Date.now())));
			return;
		}
		window.clearTimeout(this.bumps.get(key));
		this.bumps.set(key, window.setTimeout(fire, 150));
	}

	private scheduleRefresh(): void {
		let wait = 150;
		const hold = this.holdUntil(this.refreshedAt);
		if (hold !== null) {
			if (this.pending) return;
			wait = Math.max(150, hold - Date.now());
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
			}).catch((err) => console.error("Garmin: Home couldn't refresh", err));
		}, wait);
	}
}
