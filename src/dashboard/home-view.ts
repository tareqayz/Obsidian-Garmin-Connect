import { ItemView, TAbstractFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import type { DayIndexData, ReadIndex } from "../sync/day-index";
import { dayIndex } from "../sync/day-indexes";
import { describe } from "../sync/runner";
import { VaultSeriesStore } from "../sync/series-store";
import { pickStat } from "../ui/add-stat-modal";
import { SleepHistoryModal } from "../ui/sleep-history-modal";
import Home from "../ui/svelte/home/Home.svelte";
import { GARMIN_ICON } from "../ui/icon";
import type { ActivitiesData } from "./activities";
import { collectRows } from "./collect";
import { unitsOf } from "./day";
import { availableStats, type GlanceId } from "./glance";
import { dayToShow, homeModel, type HomeModel, type MoreId, type PresetId } from "./home";
import { HOME, readStack, type Route } from "./routes";
import type { DayRow } from "./series";
import type { HistoryView, SleepData } from "./sleep-pages";
import type { StatsData } from "./stats-pages";
import type { DaySeries } from "../sync/intraday";

export const GARMIN_HOME_VIEW = "garmin-home";

/** The series files' entry among the versions: not a name an index can have. */
const SERIES = "#series";

/**
 * The Home screen: Garmin Connect's home, drawn from what the sync wrote, and
 * the pages that open from it.
 *
 * Reads the day notes' frontmatter, that day's series file, `account.json`,
 * the activity index, the daily stats index and the sleep index, and rebuilds
 * whenever any of them changes. Which page is open is part of the view's state, so a reload
 * returns to it.
 *
 * The registered day indexes (`day-indexes.ts`) are not part of that
 * rebuild: a page reads one when it asks (`readIndex`), and a change in an
 * index's folder only moves that index's version, which the pages reading it
 * watch.
 */
export class GarminHomeView extends ItemView {
	private plugin: GarminPlugin;
	private component: ReturnType<typeof Home> | undefined;
	private pending = 0;
	private stack: Route[] = [HOME];
	/** By index kind, and `SERIES`: moved, a moment after the files settle, whenever one changes. */
	private versions = new Map<string, number>();
	private bumps = new Map<string, number>();
	private indexCache = new Map<string, { version: number; data: Promise<DayIndexData> }>();

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
		const rows = this.rows();
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
				canSync: this.plugin.garmin.isAuthenticated,
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
				loadIntraday: (date: string, keys: readonly string[]) => this.plugin.sync.loadIntraday(date, keys),
			},
		});

		this.register(this.plugin.sync.onHistory((progress) => this.component?.setHistory(progress)));
		this.register(this.plugin.sync.onStatsHistory((progress) => this.component?.setStatsHistory(progress)));
		this.register(this.plugin.sync.onSleepHistory((progress) => this.component?.setSleepHistory(progress)));
		this.register(this.plugin.sync.onIndexHistory((kind, progress) => this.component?.setIndexHistory(kind, progress)));

		// Frontmatter lands through the metadata cache; the JSON files do not,
		// so watch those directly.
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
		const onFile = (file: TAbstractFile) => {
			const store = this.store();
			// A registered index reaches only the pages that read it.
			const def = store.dayIndexOf(file.path);
			if (def) {
				this.bump(def.kind);
				return;
			}
			if (!store.owns(file.path)) return;
			if (store.isSeriesPath(file.path)) this.bump(SERIES);
			else if (file.path.startsWith(`${store.sleepFolder}/`)) this.bump("sleep");
			else if (file.path.startsWith(`${store.dailyStatsFolder}/`)) this.bump("daily-stats");
			this.scheduleRefresh();
		};
		this.registerEvent(this.app.vault.on("modify", onFile));
		this.registerEvent(this.app.vault.on("create", onFile));
		this.registerEvent(this.app.vault.on("delete", onFile));
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.pending);
		for (const timer of this.bumps.values()) window.clearTimeout(timer);
		this.bumps.clear();
		if (this.component) {
			unmount(this.component);
			this.component = undefined;
		}
	}

	private store(): VaultSeriesStore {
		return new VaultSeriesStore(this.app, this.plugin.data.settings.dataFolder);
	}

	private rows(): DayRow[] {
		return collectRows(this.app, this.plugin.data.settings);
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
			// The sync records the account's units; before it has, the notes say.
			units: index.meta?.units ?? unitsOf(rows),
		};
		if (index.meta?.total !== undefined) data.total = index.meta.total;
		return data;
	}

	/**
	 * What the Steps, Floors and Intensity Minutes pages read. The index has
	 * no calories for the days only a history sync reached, so the notes fill
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
	 * A day index as a Health Stats page reads it: a registered one by its
	 * kind, or the sleep and daily stats indexes. Read once per version, so
	 * pages sharing an index share the read.
	 */
	private readIndex(kind: string): Promise<DayIndexData> {
		const version = this.versions.get(kind) ?? 0;
		const cached = this.indexCache.get(kind);
		if (cached?.version === version) return cached.data;
		const data = this.loadIndex(kind);
		this.indexCache.set(kind, { version, data });
		data.catch(() => {
			if (this.indexCache.get(kind)?.data === data) this.indexCache.delete(kind);
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

	/** Moves one version, once a burst of file events settles: a sync writes a year file and the meta together. */
	private bump(key: string): void {
		this.indexCache.delete(key);
		window.clearTimeout(this.bumps.get(key));
		this.bumps.set(
			key,
			window.setTimeout(() => {
				this.bumps.delete(key);
				this.indexCache.delete(key);
				const version = (this.versions.get(key) ?? 0) + 1;
				this.versions.set(key, version);
				if (key === SERIES) this.component?.setSeriesVersion(version);
				else this.component?.setIndexVersion(key, version);
			}, 150),
		);
	}

	private scheduleRefresh(): void {
		window.clearTimeout(this.pending);
		this.pending = window.setTimeout(() => {
			const today = toIsoDate();
			const rows = this.rows();
			void Promise.all([this.build(today, rows), this.buildActivities(rows)]).then(async ([model, activities]) => {
				const [stats, sleep] = await Promise.all([this.buildStats(rows, activities.units), this.buildSleep(activities.units)]);
				this.component?.setModel(model, today);
				this.component?.setActivities(activities);
				this.component?.setStats(stats);
				this.component?.setSleep(sleep);
			});
		}, 150);
	}
}
