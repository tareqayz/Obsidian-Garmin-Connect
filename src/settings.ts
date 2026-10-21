import { App, Notice, PluginSettingTab, normalizePath, type Setting, type SettingDefinitionItem, type TextComponent } from "obsidian";
import { mount, unmount } from "svelte";
import type { GarminDomain } from "./garmin/constants";
import type GarminPlugin from "./main";
import { DEFAULT_SETTINGS, type GarminSettings } from "./settings-data";
import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_RANGES, DAY_DETAILS_KEY, DAY_DETAILS_RANGES, isActivityDetailsRange, isDayDetailsRange } from "./sync/datasets";
import { ALL_GROUPS, type MetricGroup } from "./sync/metrics";
import { folderProblem } from "./sync/vault-paths";
import { DeleteDataModal } from "./ui/delete-data-modal";
import { SettingsDataRows } from "./ui/settings-data-rows";
import DataStatus from "./ui/svelte/settings/DataStatus.svelte";

/**
 * Each metric group's row: a short name, what it holds in one sentence, and
 * the words the longer list used to say, kept as search aliases. What a group
 * costs in requests is for the docs (`docs/settings.md`, Metrics), not here.
 */
const GROUPS: Record<MetricGroup, { name: string; desc: string; aliases: string[] }> = {
	activity: { name: "Activity", desc: "Steps, distance, calories, floors and intensity minutes.", aliases: ["active minutes"] },
	heart: { name: "Heart rate", desc: "Resting, lowest and highest heart rate.", aliases: ["seven-day resting", "min", "max"] },
	sleep: { name: "Sleep", desc: "Sleep score, stages, need and SpO2.", aliases: ["sleep coach", "respiration", "restlessness"] },
	stress: { name: "Stress and Body Battery", desc: "Stress levels and Body Battery charge and drain.", aliases: ["body battery"] },
	hrv: { name: "HRV", desc: "Overnight HRV, its status and your baseline.", aliases: ["heart rate variability"] },
	readiness: { name: "Training readiness", desc: "Readiness score, recovery time and its factors.", aliases: ["recovery"] },
	fitness: {
		name: "Fitness",
		desc: "VO2 Max, fitness age, endurance and hill scores.",
		aliases: ["vo2 max", "fitness age", "endurance score", "hill score", "heat acclimation", "altitude acclimation"],
	},
	races: { name: "Race predictions", desc: "Predicted race times from 5K to marathon.", aliases: ["race predictor", "10k", "half marathon"] },
	respiration: { name: "Respiration", desc: "Breathing rate while awake: average, low and high.", aliases: ["breathing", "waking"] },
	spo2: { name: "Pulse ox", desc: "Blood oxygen: average, lowest and latest.", aliases: ["spo2", "oxygen"] },
	body: { name: "Body composition", desc: "Weight, BMI, body fat, muscle and bone mass.", aliases: ["weight", "bmi", "body fat"] },
	training: {
		name: "Training load",
		desc: "Training status, load, load focus and running tolerance.",
		aliases: ["training status", "acute load", "chronic load", "load ratio", "load focus", "running tolerance"],
	},
	workouts: { name: "Workouts", desc: "Your activities, with their maps, laps and charts.", aliases: ["activities"] },
	intraday: { name: "Intraday charts", desc: "Heart rate, stress, steps and sleep through the day.", aliases: ["timelines", "body battery", "sleep stages"] },
	health: { name: "Health status", desc: "Overnight vitals against your baseline.", aliases: ["health snapshot", "skin temperature"] },
	profile: {
		name: "Profile",
		desc: "Your watch, thresholds, FTP, race events and records.",
		aliases: ["lactate threshold", "ftp", "running economy", "cycling ability", "coach plan", "personal records", "avatar"],
	},
};

/** The settings a `control` row edits. A metric group's toggle is `group:<id>`. */
type ControlKey = "autoSync" | "units" | "mapTiles" | "autoSaveLog" | `group:${MetricGroup}`;

const UNITS: ReadonlyArray<GarminSettings["units"]> = ["auto", "metric", "imperial"];

/**
 * Settings → Garmin Connect, declared rather than drawn, so Obsidian's
 * settings search finds every row, sub-pages included. The main page keeps
 * the everyday settings; History, Metrics and Advanced are sub-pages
 * (`type: "page"`). Plain values are `control` rows bound through
 * `getControlValue`/`setControlValue`; rows with side effects or text that
 * moves (sign-in, the folders, what the history holds) `render` themselves
 * with native `Setting` controls.
 *
 * A page's name is how Obsidian finds it again after `update()`, so the
 * names stay fixed and what changes goes in the description.
 */
export class GarminSettingTab extends PluginSettingTab {
	private plugin: GarminPlugin;

	constructor(app: App, plugin: GarminPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		const s = this.plugin.data.settings;
		if (key.startsWith("group:")) return s.groups.includes(key.slice("group:".length) as MetricGroup);
		return s[key as keyof GarminSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.plugin.data.settings;
		if (key.startsWith("group:")) {
			const group = key.slice("group:".length) as MetricGroup;
			s.groups = value === true ? [...new Set([...s.groups, group])] : s.groups.filter((g) => g !== group);
			await this.plugin.data.saveSettings();
			// The main page's Metrics row counts the groups on.
			this.update();
			return;
		}
		if (key === "units" && UNITS.includes(value as GarminSettings["units"])) s.units = value as GarminSettings["units"];
		else if ((key === "autoSync" || key === "mapTiles" || key === "autoSaveLog") && typeof value === "boolean") s[key] = value;
		else return;
		await this.plugin.data.saveSettings();
		// Turned on: a sync may be due already.
		if (key === "autoSync" && value === true) this.plugin.autoSync.poke();
	}

	getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		// Shared by the History rows that show what the history holds; it listens
		// to the sync only while one of them is on screen.
		const rows = new SettingsDataRows(plugin);

		return [
			{
				type: "group",
				items: [
					{
						name: "Garmin account",
						aliases: ["sign in", "sign out", "session", "email"],
						render: (setting) => {
							const signedIn = plugin.garmin.isAuthenticated;
							setting
								.setDesc(signedIn ? (s.email ? `Signed in as ${s.email}.` : "Signed in.") : "Not signed in.")
								.addButton((b) =>
									b.setButtonText(signedIn ? "Sign out" : "Sign in").onClick(async () => {
										if (signedIn) {
											await plugin.signOut();
											new Notice("Signed out of Garmin Connect.");
											this.update();
										} else {
											plugin.openLogin(() => this.update());
										}
									}),
								);
						},
					},
					{
						name: "Sync automatically",
						desc: "Sync new data when Obsidian starts and when you open Home.",
						aliases: ["sync on startup", "auto sync"],
						control: { type: "toggle", key: "autoSync" },
					},
					{
						name: "Units",
						desc: "Auto follows your Garmin account.",
						control: { type: "dropdown", key: "units", options: { auto: "Auto", metric: "Metric", imperial: "Imperial" } },
					},
					{
						name: "Map tiles",
						desc: "Show OpenStreetMap under routes. OpenStreetMap sees each map's area.",
						aliases: ["openstreetmap", "maps"],
						control: { type: "toggle", key: "mapTiles" },
					},
				],
			},
			{
				type: "group",
				items: [
					{ type: "page", name: "History", desc: rows.summaryText(), items: this.historyPage(rows) },
					{ type: "page", name: "Metrics", desc: `${s.groups.length} of ${ALL_GROUPS.length} on.`, items: this.metricsPage() },
					{ type: "page", name: "Advanced", desc: "Region, diagnostics and deleting data.", items: this.advancedPage() },
				],
			},
		];
	}

	/** The download, what the vault holds, the ranges, and where it all goes. */
	private historyPage(rows: SettingsDataRows): SettingDefinitionItem<ControlKey>[] {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		return [
			{
				type: "group",
				items: [
					{
						name: "On disk",
						aliases: ["size", "storage"],
						render: (setting) => rows.attach(() => void setting.setDesc(rows.usageText())),
					},
					{
						// The download in progress, the new data on offer and the date
						// ranges queued: no name, nothing to search for, hidden while there
						// is none. Not the card's first row, whose divider would show above
						// the next one.
						name: "",
						searchable: false,
						render: (setting) => {
							setting.infoEl.hide();
							setting.controlEl.hide();
							const panel = mount(DataStatus, { target: setting.settingEl, props: { plugin, rows } });
							const detach = rows.attach(() => setting.settingEl.toggle(rows.progress !== null || rows.updates.length > 0 || rows.ranges.length > 0));
							return () => {
								detach();
								void unmount(panel);
							};
						},
					},
					{
						name: "Day details",
						aliases: ["timelines", "range"],
						render: (setting) => {
							setting.addDropdown((d) => {
								for (const range of DAY_DETAILS_RANGES) d.addOption(range.id, range.label);
								d.setValue(s.data.dayDetails).onChange((v) => {
									if (!isDayDetailsRange(v)) return;
									s.data.dayDetails = v;
									choose(plugin, rows, DAY_DETAILS_KEY);
								});
							});
							return rows.attach(() => void setting.setDesc(rows.dayText()));
						},
					},
					{
						name: "Activity details",
						aliases: ["maps", "laps", "range"],
						render: (setting) => {
							setting.addDropdown((d) => {
								for (const range of ACTIVITY_DETAILS_RANGES) d.addOption(range.id, range.label);
								d.setValue(s.data.activityDetails).onChange((v) => {
									if (!isActivityDetailsRange(v)) return;
									s.data.activityDetails = v;
									choose(plugin, rows, ACTIVITY_DETAILS_KEY);
								});
							});
							return rows.attach(() => void setting.setDesc(rows.detailText()));
						},
					},
					{
						name: "Data folder",
						desc: "Where the JSON files go. Existing files don't move.",
						render: (setting) =>
							folderInput(setting, plugin, DEFAULT_SETTINGS.dataFolder, () => s.dataFolder, (next) => (s.dataFolder = next)),
					},
					{
						name: "Run setup again",
						desc: "Scan your account and choose what to download.",
						aliases: ["setup", "wizard"],
						render: (setting) => {
							setting.addButton((b) => b.setButtonText("Open setup").onClick(() => plugin.openSetup()));
						},
					},
				],
			},
		];
	}

	/** One switch per metric group, each with what it holds. */
	private metricsPage(): SettingDefinitionItem<ControlKey>[] {
		return [
			{
				type: "group",
				items: [
					{
						// A row without a name, control or render isn't drawn at all.
						name: "",
						searchable: false,
						render: (setting) => void setting.setDesc("Turn off what you don't need."),
					},
					...ALL_GROUPS.map((group) => ({
						name: GROUPS[group].name,
						desc: GROUPS[group].desc,
						aliases: GROUPS[group].aliases,
						control: { type: "toggle" as const, key: `group:${group}` as const },
					})),
				],
			},
		];
	}

	/** What few people change: the region, diagnostics, and deleting the data. */
	private advancedPage(): SettingDefinitionItem<ControlKey>[] {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		return [
			{
				type: "group",
				items: [
					{
						name: "Region",
						desc: "Use garmin.cn for accounts in mainland China.",
						aliases: ["china", "domain"],
						render: (setting) => {
							setting.addDropdown((d) =>
								d
									.addOption("garmin.com", "garmin.com")
									.addOption("garmin.cn", "garmin.cn")
									.setValue(s.domain)
									.onChange(async (v) => {
										await plugin.setDomain(v as GarminDomain);
										// A new region signs out and builds a new runner: redraw the rows on it.
										this.update();
									}),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: "Diagnostics",
				items: [
					{
						name: "Save diagnostics runs",
						desc: "Save each Run diagnostics result as a note.",
						control: { type: "toggle", key: "autoSaveLog" },
					},
					{
						name: "Log folder",
						desc: "Where diagnostics and debug notes go.",
						render: (setting) =>
							folderInput(setting, plugin, DEFAULT_SETTINGS.logFolder, () => s.logFolder, (next) => (s.logFolder = next)),
					},
				],
			},
			{
				type: "group",
				heading: "Danger zone",
				items: [
					{
						name: "Delete synced data",
						aliases: ["delete", "remove", "trash", "uninstall"],
						render: (setting) => {
							// The folder as it is now: the row sits a page away from Data folder.
							setting.setDesc(`Moves this plugin's files in ${s.dataFolder} to the trash. Notes and your Garmin account stay.`);
							setting.addButton((b) => {
								b.setButtonText("Delete…").onClick(() => new DeleteDataModal(plugin.app, plugin).open());
								b.buttonEl.addClass("gch-danger");
							});
						},
					},
				],
			},
		];
	}
}

/**
 * A folder setting, saved once, on Enter or leaving the field: a folder taken
 * a keystroke at a time would scatter half-typed folders through the vault.
 */
function folderInput(setting: Setting, plugin: GarminPlugin, fallback: string, get: () => string, set: (folder: string) => void): void {
	setting.addText((t: TextComponent) => {
		t.setPlaceholder(fallback).setValue(get());
		const commit = () => {
			const next = normalizePath(t.getValue().trim() || fallback);
			const problem = folderProblem(next, plugin.app.vault.configDir);
			if (problem) {
				new Notice(problem);
				t.setValue(get());
				return;
			}
			if (next === get()) return;
			set(next);
			t.setValue(next);
			void plugin.data.saveSettings();
		};
		t.inputEl.addEventListener("blur", commit);
		t.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") t.inputEl.blur();
		});
	});
}

/** Choosing a range is agreeing to fetch it: the backfill starts on what is missing. */
function choose(plugin: GarminPlugin, rows: SettingsDataRows, key: string): void {
	const s = plugin.data.settings;
	if (!s.data.accepted.includes(key)) s.data.accepted = [...s.data.accepted, key];
	s.data.deferred = s.data.deferred.filter((k) => k !== key);
	void plugin.data.saveSettings();
	plugin.setupChanged();
	plugin.sync.kickBackfill();
	void rows.refresh();
}
