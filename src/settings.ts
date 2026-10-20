import { App, Notice, PluginSettingTab, normalizePath, type Setting, type SettingDefinitionItem, type TextComponent } from "obsidian";
import { mount, unmount } from "svelte";
import type { GarminDomain } from "./garmin/constants";
import type GarminPlugin from "./main";
import { DEFAULT_SETTINGS, type GarminSettings } from "./settings-data";
import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_RANGES, DAY_DETAILS_KEY, DAY_DETAILS_RANGES, isActivityDetailsRange, isDayDetailsRange } from "./sync/datasets";
import { ALL_GROUPS, FREE_GROUPS, RANGE_GROUPS, REQUESTS_PER_DAY, REQUESTS_PER_SYNC, type MetricGroup } from "./sync/metrics";
import { isSyncSpeed, SPEED_LABELS } from "./sync/speed";
import { folderProblem } from "./sync/vault-paths";
import { DeleteDataModal } from "./ui/delete-data-modal";
import { SettingsDataRows } from "./ui/settings-data-rows";
import DataStatus from "./ui/svelte/settings/DataStatus.svelte";

const GROUP_LABELS: Record<MetricGroup, string> = {
	activity: "Activity — steps, distance, calories, floors, intensity and active minutes",
	heart: "Heart rate — resting, seven-day resting, min, max",
	sleep: "Sleep — duration, stages, score, Sleep Coach need, respiration, SpO2, restlessness",
	stress: "Stress and Body Battery — averages, peaks, time in each band, charge and drain",
	hrv: "HRV — overnight average, status and your personal baseline range",
	readiness: "Training readiness — score, recovery time and the factors behind it",
	fitness: "Fitness — VO2 Max, fitness age, endurance and hill score, heat and altitude acclimation",
	races: "Race predictions — 5K, 10K, half, marathon",
	respiration: "Respiration — waking average, low and high",
	spo2: "Pulse ox — average, lowest and latest SpO2",
	body: "Body composition — weight, BMI, body fat, muscle and bone mass",
	training: "Training load — status, acute and chronic load, load ratio, load focus, running tolerance",
	workouts: "Workouts — a list of the day's activities",
	intraday: "Intraday charts — heart rate, stress, Body Battery, steps and sleep stages, saved as a file per day",
	health: "Health status — overnight HRV, heart rate, SpO2, respiration and skin temperature against your baseline, plus Health Snapshots",
	profile:
		"Profile — watch, avatar, lactate threshold, FTP, running economy, cycling ability, coach plan, upcoming events and personal records",
};

// Five of these ride along in the daily summary, so turning them on is free.
// Saying which is the difference between an informed choice and a guess.
const freeGroups = new Set<MetricGroup>(FREE_GROUPS);
const rangeGroups = new Set<MetricGroup>(RANGE_GROUPS);

function costOf(group: MetricGroup): string {
	if (freeGroups.has(group)) return "Free — shares the daily summary request";
	if (group === "intraday") {
		return `${REQUESTS_PER_DAY.intraday} requests per day, for the days inside Day details (Data, above)`;
	}
	const perSync = REQUESTS_PER_SYNC[group];
	if (perSync) return `About ${perSync} requests per sync, not per day — saved to account.json`;
	if (rangeGroups.has(group)) return "1 request per sync, not per day";
	const n = REQUESTS_PER_DAY[group] ?? 1;
	return n === 1 ? "1 request per day" : `${n} requests per day`;
}

/** The settings a `control` row edits. A metric group's toggle is `group:<id>`. */
type ControlKey = "email" | "syncOnStartup" | "units" | "mapTiles" | "syncSpeed" | "stopAfterEmptyDays" | "autoSaveLog" | `group:${MetricGroup}`;

const UNITS: ReadonlyArray<GarminSettings["units"]> = ["auto", "metric", "imperial"];

/**
 * Settings → Garmin Connect, declared rather than drawn, so Obsidian's
 * settings search finds every row. Plain values are `control` rows bound
 * through `getControlValue`/`setControlValue`; rows with side effects or text
 * that moves (sign-in, the data folder, what the history holds) `render`
 * themselves with native `Setting` controls.
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
		} else if (key === "email" && typeof value === "string") s.email = value.trim();
		else if (key === "units" && UNITS.includes(value as GarminSettings["units"])) s.units = value as GarminSettings["units"];
		else if (key === "syncSpeed" && isSyncSpeed(value)) s.syncSpeed = value;
		else if (key === "stopAfterEmptyDays" && typeof value === "number") s.stopAfterEmptyDays = value;
		else if ((key === "syncOnStartup" || key === "mapTiles" || key === "autoSaveLog") && typeof value === "boolean") s[key] = value;
		else return;
		await this.plugin.data.saveSettings();
	}

	getSettingDefinitions(): SettingDefinitionItem<ControlKey>[] {
		const plugin = this.plugin;
		const s = plugin.data.settings;
		// Shared by the Data rows that show what the history holds; it listens
		// to the sync only while one of them is on screen.
		const rows = new SettingsDataRows(plugin);

		return [
			{
				type: "group",
				heading: "Connection",
				items: [
					{
						name: "Status",
						aliases: ["sign in", "sign out", "session"],
						render: (setting) => {
							const session = plugin.garmin.session;
							setting
								.setDesc(session ? `Signed in. Session saved ${new Date(session.savedAt).toLocaleString()}.` : "Not signed in.")
								.addButton((b) =>
									b.setButtonText(session ? "Sign out" : "Sign in").onClick(async () => {
										if (session) {
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
						name: "Garmin email",
						desc: "Only the email is stored. The password is used to sign in and never saved.",
						control: { type: "text", key: "email", placeholder: "you@example.com" },
					},
					{
						name: "Region",
						desc: "garmin.cn is the mainland China tenant; everyone else uses garmin.com.",
						render: (setting) => {
							setting.addDropdown((d) =>
								d
									.addOption("garmin.com", "garmin.com")
									.addOption("garmin.cn", "garmin.cn")
									.setValue(s.domain)
									.onChange(async (v) => {
										await plugin.setDomain(v as GarminDomain);
										// A new region signs out: Status says so.
										this.update();
									}),
							);
						},
					},
				],
			},
			{
				type: "group",
				heading: "Sync",
				items: [
					{
						name: "Sync on startup",
						desc: "Runs a recent-days sync shortly after Obsidian loads.",
						control: { type: "toggle", key: "syncOnStartup" },
					},
					{
						name: "Units",
						desc: "Auto asks Garmin which system your account uses.",
						control: {
							type: "dropdown",
							key: "units",
							options: { auto: "Auto (from your Garmin account)", metric: "Metric — km", imperial: "Imperial — miles" },
						},
					},
				],
			},
			{
				type: "group",
				heading: "Data",
				items: [
					{
						name: "Data folder",
						desc: "Where the synced JSON files live. Moving it does not move files already written.",
						render: (setting) =>
							folderInput(setting, plugin, DEFAULT_SETTINGS.dataFolder, () => s.dataFolder, (next) => (s.dataFolder = next)),
					},
					{
						name: "On disk",
						render: (setting) => rows.attach(() => void setting.setDesc(rows.usageText())),
					},
					{
						name: "Day details",
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
						// The download in progress and the new data on offer: no name,
						// nothing to search for, hidden while there is neither.
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
						name: "Run setup again",
						desc: "Scan your Garmin history again and choose what to keep.",
						render: (setting) => {
							setting.addButton((b) => b.setButtonText("Open setup").onClick(() => plugin.openSetup()));
						},
					},
				],
			},
			{
				type: "group",
				heading: "Metrics",
				items: [
					{
						// A row without a name, control or render isn't drawn at all.
						name: "",
						searchable: false,
						render: (setting) =>
							void setting.setDesc(
								"Each group says what it costs in Garmin requests: most per day synced, a few once per sync. The free " +
									"ones share the daily summary request, so one request a day covers all of them.",
							),
					},
					...ALL_GROUPS.map((group) => ({
						name: GROUP_LABELS[group],
						desc: costOf(group),
						control: { type: "toggle" as const, key: `group:${group}` as const },
					})),
				],
			},
			{
				type: "group",
				heading: "Maps",
				items: [
					{
						name: "Map tiles",
						desc: "Draws OpenStreetMap's map under an activity's route. The tiles come from tile.openstreetmap.org, which sees the area of each activity you open. Off, the route is drawn on its own.",
						control: { type: "toggle", key: "mapTiles" },
					},
				],
			},
			{
				type: "group",
				heading: "Advanced",
				items: [
					{
						name: "Sync speed",
						desc:
							"How hard a sync leans on Garmin. Gentle is the old pace; Normal about twice it, well " +
							"under what Garmin was measured to allow. If Garmin asks to slow down, the sync waits and carries on slower.",
						control: { type: "dropdown", key: "syncSpeed", options: SPEED_LABELS },
					},
					{
						name: "Stop after empty days",
						desc:
							"For Sync a date range…, which walks newest to oldest: once it reaches past the start of your " +
							"Garmin history it gives up after this many days with nothing in them, " +
							"instead of asking all the way to the start date and being rate limited. " +
							"Set to 0 to always walk the whole range. The download Data sets up already knows where your history starts.",
						control: { type: "slider", key: "stopAfterEmptyDays", min: 0, max: 120, step: 5 },
					},
					{
						name: "Save every diagnostics run to the vault",
						desc: "The only practical way to read the diagnostics from a phone.",
						control: { type: "toggle", key: "autoSaveLog" },
					},
					{
						name: "Log folder",
						desc: "Where saved diagnostics runs and debug info go.",
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
						desc: `Moves the plugin’s files in ${s.dataFolder} to the trash. Your notes and your Garmin account are not affected.`,
						render: (setting) => {
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
