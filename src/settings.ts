import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { GarminDomain } from "./garmin/constants";
import { DAILY_NOTE_DEFAULTS, coreDailyNoteOptions } from "./sync/daily-note";
import { ALL_GROUPS, type MetricGroup } from "./sync/metrics";
import type GarminPlugin from "./main";

export interface GarminSettings {
	email: string;
	domain: GarminDomain;

	/** How many days back a "sync recent days" run covers. */
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";
	prefix: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	createMissingNotes: boolean;
	syncOnStartup: boolean;
	pauseBetweenDays: number;

	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: GarminSettings = {
	email: "",
	domain: "garmin.com",

	// Garmin backfills a day for a while after it ends — sleep is finalised late,
	// and a watch that synced this morning rewrites yesterday.
	syncDays: 3,
	groups: [...ALL_GROUPS],
	units: "auto",
	prefix: "garmin_",
	dailyNoteFolder: "",
	dailyNoteFormat: "",
	// Off by default: writing into notes you already have is safe, inventing
	// notes in someone's daily-note folder is not.
	createMissingNotes: false,
	syncOnStartup: false,
	pauseBetweenDays: 250,

	logFolder: "garmin-probe-logs",
	autoSaveLog: true,
};

const GROUP_LABELS: Record<MetricGroup, string> = {
	activity: "Activity — steps, distance, calories, floors, intensity minutes",
	heart: "Heart rate — resting, min, max",
	sleep: "Sleep — duration, stages, score, start and end",
	stress: "Stress and Body Battery",
	hrv: "HRV — overnight average and status",
	readiness: "Training readiness",
	workouts: "Workouts — a list of the day's activities",
};

export class GarminSettingTab extends PluginSettingTab {
	private plugin: GarminPlugin;

	constructor(app: App, plugin: GarminPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private async persist(change: () => void): Promise<void> {
		change();
		await this.plugin.data.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		const s = this.plugin.data.settings;
		containerEl.empty();

		/* -- Connection ------------------------------------------------ */
		new Setting(containerEl).setName("Connection").setHeading();

		const session = this.plugin.garmin.session;
		new Setting(containerEl)
			.setName("Status")
			.setDesc(
				session
					? `Signed in. Session saved ${new Date(session.savedAt).toLocaleString()}.`
					: "Not signed in.",
			)
			.addButton((b) =>
				b.setButtonText(session ? "Sign out" : "Sign in").onClick(async () => {
					if (session) {
						await this.plugin.signOut();
						new Notice("Signed out of Garmin Connect.");
						this.display();
					} else {
						this.plugin.openLogin(() => this.display());
					}
				}),
			);

		new Setting(containerEl)
			.setName("Garmin email")
			.setDesc("Only the email is stored. The password is used to sign in and never saved.")
			.addText((t) =>
				t
					.setPlaceholder("you@example.com")
					.setValue(s.email)
					.onChange((v) => void this.persist(() => (s.email = v.trim()))),
			);

		new Setting(containerEl)
			.setName("Region")
			.setDesc("garmin.cn is the mainland China tenant; everyone else uses garmin.com.")
			.addDropdown((d) =>
				d
					.addOption("garmin.com", "garmin.com")
					.addOption("garmin.cn", "garmin.cn")
					.setValue(s.domain)
					.onChange(async (v) => {
						await this.persist(() => (s.domain = v as GarminDomain));
						await this.plugin.rebuildClient();
						this.display();
					}),
			);

		/* -- Sync ------------------------------------------------------ */
		new Setting(containerEl).setName("Sync").setHeading();

		new Setting(containerEl)
			.setName("Days to sync")
			.setDesc(
				"How far back a recent-days sync reaches. Garmin keeps revising a day " +
					"after it ends — sleep is finalised late — so more than one day is worth it.",
			)
			.addSlider((sl) =>
				sl
					.setLimits(1, 30, 1)
					.setValue(s.syncDays)
					.setDynamicTooltip()
					.onChange((v) => void this.persist(() => (s.syncDays = v))),
			);

		new Setting(containerEl)
			.setName("Sync on startup")
			.setDesc("Runs a recent-days sync shortly after Obsidian loads.")
			.addToggle((t) =>
				t.setValue(s.syncOnStartup).onChange((v) => void this.persist(() => (s.syncOnStartup = v))),
			);

		new Setting(containerEl)
			.setName("Units")
			.setDesc("Auto asks Garmin which system your account uses.")
			.addDropdown((d) =>
				d
					.addOption("auto", "Auto (from your Garmin account)")
					.addOption("metric", "Metric — km")
					.addOption("imperial", "Imperial — miles")
					.setValue(s.units)
					.onChange((v) =>
						void this.persist(() => (s.units = v as GarminSettings["units"])),
					),
			);

		new Setting(containerEl)
			.setName("Property prefix")
			.setDesc(
				`Prepended to every property, so "steps" becomes "${s.prefix || ""}steps". ` +
					"Clear it at your own risk — an unprefixed key can collide with your own.",
			)
			.addText((t) =>
				t
					.setPlaceholder("garmin_")
					.setValue(s.prefix)
					.onChange((v) => void this.persist(() => (s.prefix = v))),
			);

		/* -- Metrics --------------------------------------------------- */
		new Setting(containerEl)
			.setName("Metrics")
			.setHeading()
			.setDesc("Turning a group off also stops the request that fetches it.");

		for (const group of ALL_GROUPS) {
			new Setting(containerEl).setName(GROUP_LABELS[group]).addToggle((t) =>
				t.setValue(s.groups.includes(group)).onChange((on) =>
					void this.persist(() => {
						s.groups = on
							? [...new Set([...s.groups, group])]
							: s.groups.filter((g) => g !== group);
					}),
				),
			);
		}

		/* -- Daily notes ----------------------------------------------- */
		new Setting(containerEl).setName("Daily notes").setHeading();

		const core = coreDailyNoteOptions(this.app);
		new Setting(containerEl)
			.setName("Folder")
			.setDesc(
				`Leave blank to follow the core Daily Notes plugin (currently "${
					core.folder || "vault root"
				}").`,
			)
			.addText((t) =>
				t
					.setPlaceholder(core.folder || "vault root")
					.setValue(s.dailyNoteFolder)
					.onChange((v) => void this.persist(() => (s.dailyNoteFolder = v.trim()))),
			);

		new Setting(containerEl)
			.setName("Date format")
			.setDesc(
				`Moment tokens. Leave blank to follow Daily Notes (currently "${
					core.format || DAILY_NOTE_DEFAULTS.format
				}").`,
			)
			.addText((t) =>
				t
					.setPlaceholder(core.format || DAILY_NOTE_DEFAULTS.format)
					.setValue(s.dailyNoteFormat)
					.onChange((v) => void this.persist(() => (s.dailyNoteFormat = v.trim()))),
			);

		new Setting(containerEl)
			.setName("Create missing notes")
			.setDesc(
				"Off by default. While off, days without a daily note are skipped before " +
					"any request is made, which also keeps request counts down.",
			)
			.addToggle((t) =>
				t
					.setValue(s.createMissingNotes)
					.onChange((v) => void this.persist(() => (s.createMissingNotes = v))),
			);

		/* -- Diagnostics ----------------------------------------------- */
		new Setting(containerEl).setName("Diagnostics").setHeading();

		new Setting(containerEl)
			.setName("Pause between days")
			.setDesc("Milliseconds. Slows a long backfill down enough to stay under Garmin's limits.")
			.addSlider((sl) =>
				sl
					.setLimits(0, 2000, 50)
					.setValue(s.pauseBetweenDays)
					.setDynamicTooltip()
					.onChange((v) => void this.persist(() => (s.pauseBetweenDays = v))),
			);

		new Setting(containerEl)
			.setName("Save every probe run to the vault")
			.setDesc("The only practical way to read probe output from a phone.")
			.addToggle((t) =>
				t.setValue(s.autoSaveLog).onChange((v) => void this.persist(() => (s.autoSaveLog = v))),
			);

		new Setting(containerEl)
			.setName("Log folder")
			.addText((t) =>
				t
					.setPlaceholder(DEFAULT_SETTINGS.logFolder)
					.setValue(s.logFolder)
					.onChange((v) =>
						void this.persist(() => (s.logFolder = v.trim() || DEFAULT_SETTINGS.logFolder)),
					),
			);
	}
}
