import { ItemView, TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { toIsoDate } from "../garmin/endpoints";
import { describe } from "../sync/runner";
import { VaultSeriesStore } from "../sync/series-store";
import Home from "../ui/svelte/home/Home.svelte";
import { GARMIN_ICON } from "../ui/icon";
import { collectRows } from "./collect";
import { dayToShow, homeModel, type HomeModel, type MoreId, type PresetId } from "./home";

export const GARMIN_HOME_VIEW = "garmin-home";

/**
 * The Home screen: Garmin Connect's home, drawn from what the sync wrote.
 *
 * Reads three things — the day notes' frontmatter, that day's series file and
 * `account.json` — and rebuilds the model whenever any of them changes.
 */
export class GarminHomeView extends ItemView {
	private plugin: GarminPlugin;
	private component: ReturnType<typeof Home> | undefined;
	private pending = 0;

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

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("gch-view");
		const today = toIsoDate();
		this.component = mount(Home, {
			target: this.contentEl,
			props: {
				initialModel: await this.build(today),
				initialPreset: this.plugin.data.home.preset,
				initialHidden: [...this.plugin.data.home.hidden],
				today,
				canSync: this.plugin.garmin.isAuthenticated,
				onSync: async () => {
					const report = await this.plugin.sync.syncRecent();
					return report ? describe(report).replace(/^Garmin sync: /, "") : null;
				},
				onChange: (preset: PresetId, hidden: MoreId[]) => void this.plugin.data.saveHome({ preset, hidden }),
			},
		});

		// Frontmatter lands through the metadata cache; the JSON files do not,
		// so watch those directly.
		this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
		const onFile = (file: TAbstractFile) => {
			if (this.store().owns(file.path)) this.scheduleRefresh();
		};
		this.registerEvent(this.app.vault.on("modify", onFile));
		this.registerEvent(this.app.vault.on("create", onFile));
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

	/** Today, or the newest synced day before it when today has not synced yet. */
	private async build(today: string): Promise<HomeModel> {
		const rows = collectRows(this.app, this.plugin.data.settings);
		const date = dayToShow(rows, today);
		const store = this.store();
		const [series, account] = await Promise.all([store.read(date), store.readAccount()]);
		return homeModel({ date, rows, series, account });
	}

	private scheduleRefresh(): void {
		window.clearTimeout(this.pending);
		this.pending = window.setTimeout(() => {
			void this.build(toIsoDate()).then((model) => this.component?.setModel(model));
		}, 150);
	}
}

