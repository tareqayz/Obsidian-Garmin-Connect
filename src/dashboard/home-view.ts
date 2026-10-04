import { ItemView, TAbstractFile, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import { describe } from "../sync/runner";
import { VaultSeriesStore } from "../sync/series-store";
import { pickStat } from "../ui/add-stat-modal";
import Home from "../ui/svelte/home/Home.svelte";
import { GARMIN_ICON } from "../ui/icon";
import type { ActivitiesData } from "./activities";
import { collectRows } from "./collect";
import { unitsOf } from "./day";
import { availableStats, type GlanceId } from "./glance";
import { dayToShow, homeModel, type HomeModel, type MoreId, type PresetId } from "./home";
import { HOME, readStack, type Route } from "./routes";
import type { DayRow } from "./series";
import type { StatsData } from "./stats-pages";
import type { DaySeries } from "../sync/intraday";

export const GARMIN_HOME_VIEW = "garmin-home";

/**
 * The Home screen: Garmin Connect's home, drawn from what the sync wrote, and
 * the pages that open from it.
 *
 * Reads the day notes' frontmatter, that day's series file, `account.json`,
 * the activity index and the daily stats index, and rebuilds whenever any of
 * them changes. Which page is open is part of the view's state, so a reload
 * returns to it.
 */
export class GarminHomeView extends ItemView {
	private plugin: GarminPlugin;
	private component: ReturnType<typeof Home> | undefined;
	private pending = 0;
	private stack: Route[] = [HOME];

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
		const stats = await this.buildStats(rows, activities.units);
		this.component = mount(Home, {
			target: this.contentEl,
			props: {
				initialModel: model,
				initialActivities: activities,
				initialStats: stats,
				initialStack: this.stack,
				initialHistory: this.plugin.sync.historyProgress,
				initialStatsHistory: this.plugin.sync.statsHistoryProgress,
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
				readSeries: (days: string[]) => this.readSeries(days),
			},
		});

		this.register(this.plugin.sync.onHistory((progress) => this.component?.setHistory(progress)));
		this.register(this.plugin.sync.onStatsHistory((progress) => this.component?.setStatsHistory(progress)));

		// Frontmatter lands through the metadata cache; the JSON files do not,
		// so watch those directly.
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
		const onFile = (file: TAbstractFile) => {
			if (this.store().owns(file.path)) this.scheduleRefresh();
		};
		this.registerEvent(this.app.vault.on("modify", onFile));
		this.registerEvent(this.app.vault.on("create", onFile));
		this.registerEvent(this.app.vault.on("delete", onFile));
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.pending);
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

	private async readSeries(days: string[]): Promise<Map<string, DaySeries | null>> {
		const store = this.store();
		return new Map(await Promise.all(days.map(async (day) => [day, await store.read(day)] as const)));
	}

	private scheduleRefresh(): void {
		window.clearTimeout(this.pending);
		this.pending = window.setTimeout(() => {
			const today = toIsoDate();
			const rows = this.rows();
			void Promise.all([this.build(today, rows), this.buildActivities(rows)]).then(async ([model, activities]) => {
				const stats = await this.buildStats(rows, activities.units);
				this.component?.setModel(model, today);
				this.component?.setActivities(activities);
				this.component?.setStats(stats);
			});
		}, 150);
	}
}
