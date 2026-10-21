import { App, Notice, PluginSettingTab, normalizePath, type Setting, type SettingDefinitionItem, type TextComponent } from "obsidian";
import { mount, unmount } from "svelte";
import type { GarminDomain } from "./garmin/constants";
import type GarminPlugin from "./main";
import { DEFAULT_SETTINGS, type GarminSettings } from "./settings-data";
import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_RANGES, DAY_DETAILS_KEY, DAY_DETAILS_RANGES, isActivityDetailsRange, isDayDetailsRange } from "./sync/datasets";
import { ALL_GROUPS, FREE_GROUPS, RANGE_GROUPS, REQUESTS_PER_DAY, REQUESTS_PER_SYNC, type MetricGroup } from "./sync/metrics";
import { folderProblem } from "./sync/vault-paths";
import { DeleteDataModal } from "./ui/delete-data-modal";
import { SettingsDataRows } from "./ui/settings-data-rows";
import DataStatus from "./ui/svelte/settings/DataStatus.svelte";

/**
 * Each metric group's row: a short name, what it holds in a few words, and
 * the words the longer list used to say, kept as search aliases.
 */
const GROUPS: Record<MetricGroup, { name: string; holds: string; aliases: string[] }> = {
	activity: { name: "Activity", holds: "Steps, distance, calories, floors, intensity minutes.", aliases: ["active minutes"] },
	heart: { name: "Heart rate", holds: "Resting, min and max.", aliases: ["seven-day resting"] },
	sleep: { name: "Sleep", holds: "Stages, score, need, SpO2.", aliases: ["sleep coach", "respiration", "restlessness"] },
	stress: { name: "Stress and Body Battery", holds: "Levels, peaks, charge and drain.", aliases: ["body battery"] },
	hrv: { name: "HRV", holds: "Overnight average, status, baseline.", aliases: ["heart rate variability"] },
	readiness: { name: "Training readiness", holds: "Score, recovery time, factors.", aliases: ["recovery"] },
	fitness: {
		name: "Fitness",
		holds: "VO2 Max, fitness age, endurance, hill score.",
		aliases: ["vo2 max", "fitness age", "endurance score", "hill score", "heat acclimation", "altitude acclimation"],
	},
	races: { name: "Race predictions", holds: "5K to marathon.", aliases: ["race predictor", "10k", "half marathon"] },
	respiration: { name: "Respiration", holds: "Waking average, low, high.", aliases: ["breathing"] },
	spo2: { name: "Pulse ox", holds: "Average, lowest, latest SpO2.", aliases: ["spo2", "oxygen"] },
	body: { name: "Body composition", holds: "Weight, BMI, body fat, muscle, bone.", aliases: ["weight", "bmi", "body fat"] },
	training: {
		name: "Training load",
		holds: "Status, load, focus, running tolerance.",
		aliases: ["training status", "acute load", "chronic load", "load ratio", "load focus", "running tolerance"],
	},
	workouts: { name: "Workouts", holds: "The day's activities.", aliases: ["activities"] },
	intraday: { name: "Intraday charts", holds: "Heart rate, stress, steps and sleep through the day.", aliases: ["timelines", "body battery", "sleep stages"] },
	health: { name: "Health status", holds: "Overnight vitals against your baseline.", aliases: ["health snapshot", "skin temperature"] },
	profile: {
		name: "Profile",
		holds: "Watch, thresholds, FTP, events, records.",
		aliases: ["lactate threshold", "ftp", "running economy", "cycling ability", "coach plan", "personal records", "avatar"],
	},
};

// Five of these ride along in the daily summary, so turning them on is free.
// Saying which is the difference between an informed choice and a guess.
const freeGroups = new Set<MetricGroup>(FREE_GROUPS);
const rangeGroups = new Set<MetricGroup>(RANGE_GROUPS);

function costOf(group: MetricGroup): string {
	if (freeGroups.has(group)) return "Free.";
	if (group === "intraday") return `${REQUESTS_PER_DAY.intraday} requests a day.`;
	const perSync = REQUESTS_PER_SYNC[group];
	if (perSync) return `About ${perSync} requests a sync.`;
	if (rangeGroups.has(group)) return "1 request a sync.";
	const n = REQUESTS_PER_DAY[group] ?? 1;
	return n === 1 ? "1 request a day." : `${n} requests a day.`;
}

/** The settings a `control` row edits. A metric group's toggle is `group:<id>`. */
type ControlKey = "syncOnStartup" | "units" | "mapTiles" | "stopAfterEmptyDays" | "autoSaveLog" | `group:${MetricGroup}`;

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
		else if (key === "stopAfterEmptyDays" && typeof value === "number") s.stopAfterEmptyDays = value;
		else if ((key === "syncOnStartup" || key === "mapTiles" || key === "autoSaveLog") && typeof value === "boolean") s[key] = value;
		else return;
		await this.plugin.data.saveSettings();
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
						name: "Sync on startup",
						desc: "Sync recent days when Obsidian starts.",
						control: { type: "toggle", key: "syncOnStartup" },
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
						// The download in progress and the new data on offer: no name,
						// nothing to search for, hidden while there is neither. Not the
						// card's first row, whose divider would show above the next one.
						name: "",
						searchable: false,
						render: (setting) => {
							setting.infoEl.hide();
							setting.controlEl.hide();
							const panel = mount(DataStatus, { target: setting.settingEl, props: { plugin, rows } });
							const detach = rows.attach(() => setting.settingEl.toggle(rows.progress !== null || rows.updates.length > 0));
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

	/** One switch per metric group, each with what it holds and costs. */
	private metricsPage(): SettingDefinitionItem<ControlKey>[] {
		return [
			{
				type: "group",
				items: [
					{
						// A row without a name, control or render isn't drawn at all.
						name: "",
						searchable: false,
						render: (setting) => void setting.setDesc("Turn off what you don't need. Free groups share one daily request."),
					},
					...ALL_GROUPS.map((group) => ({
						name: GROUPS[group].name,
						desc: `${GROUPS[group].holds} ${costOf(group)}`,
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
					{
						name: "Stop after empty days",
						desc: "Sync a date range… stops after this many empty days in a row. 0 never stops.",
						control: { type: "slider", key: "stopAfterEmptyDays", min: 0, max: 120, step: 5 },
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
