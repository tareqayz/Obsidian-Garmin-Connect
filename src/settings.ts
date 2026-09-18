import { App, PluginSettingTab } from "obsidian";
import { mount, unmount } from "svelte";
import SettingsPanel from "./ui/svelte/SettingsPanel.svelte";
import type { GarminDomain } from "./garmin/constants";
import type { StorageMode } from "./sync/runner";
import type { MetricGroup } from "./sync/metrics";
import { ALL_GROUPS } from "./sync/metrics";
import type GarminPlugin from "./main";

/**
 * Bumped when a release adds metric groups that an existing vault should get
 * switched on rather than have to discover. See `PluginData.migrate`.
 */
export const SETTINGS_VERSION = 2;

export interface GarminSettings {
	/** Absent in anything written before the migration existed, which reads as 1. */
	settingsVersion: number;
	email: string;
	domain: GarminDomain;

	/** How many days back a "sync recent days" run covers. */
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	storageMode: StorageMode;
	dataFolder: string;
	dataFolderPrefix: string;
	createBasesView: boolean;
	/** Where "Garmin Health.base" lives — usually the parent of the data folder. */
	basesFolder: string;

	/** Give every day note a property pointing at the base, for the graph view. */
	linkToBase: boolean;
	linkProperty: string;

	prefix: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	createMissingNotes: boolean;

	syncOnStartup: boolean;
	pauseBetweenDays: number;
	stopAfterEmptyDays: number;

	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: GarminSettings = {
	settingsVersion: SETTINGS_VERSION,
	email: "",
	domain: "garmin.com",

	// Garmin backfills a day for a while after it ends — sleep is finalised late,
	// and a watch that synced this morning rewrites yesterday.
	syncDays: 3,
	groups: [...ALL_GROUPS],
	units: "auto",

	// A folder of our own is the default: it can never damage a note you wrote,
	// every day in a range is writable so backfill works, and the data stays as
	// properties a Bases view or Dataview query can read.
	storageMode: "dataFolder",
	// The notes sit one level down so the folder root holds only the view.
	dataFolder: "Garmin/data",
	// Nothing to collide with in a dedicated folder, so the columns read cleanly.
	dataFolderPrefix: "",
	createBasesView: true,
	basesFolder: "Garmin",

	// A single shared link target is what gives the day notes a hub in the
	// graph view instead of a cloud of unconnected dots.
	linkToBase: true,
	linkProperty: "link",

	prefix: "garmin_",
	dailyNoteFolder: "",
	dailyNoteFormat: "",
	// Off by default: writing into notes you already have is safe, inventing
	// notes in someone's daily-note folder is not.
	createMissingNotes: false,
	syncOnStartup: false,
	pauseBetweenDays: 250,
	// A backfill that reaches past the start of your Garmin history would
	// otherwise keep asking, four requests a day, until Garmin rate-limits it.
	stopAfterEmptyDays: 45,

	logFolder: "garmin-probe-logs",
	autoSaveLog: true,
};

export class GarminSettingTab extends PluginSettingTab {
	private plugin: GarminPlugin;
	private panel: ReturnType<typeof SettingsPanel> | undefined;

	constructor(app: App, plugin: GarminPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();
		this.panel = mount(SettingsPanel, {
			target: this.containerEl,
			props: { plugin: this.plugin },
		});
	}

	hide(): void {
		if (this.panel) {
			unmount(this.panel);
			this.panel = undefined;
		}
		this.containerEl.empty();
	}
}
