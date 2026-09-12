import { App, PluginSettingTab, Setting } from "obsidian";
import type { GarminDomain } from "./garmin/constants";
import type GarminProbePlugin from "./main";

export interface ProbeSettings {
	email: string;
	password: string;
	rememberPassword: boolean;
	domain: GarminDomain;
	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: ProbeSettings = {
	email: "",
	password: "",
	rememberPassword: false,
	domain: "garmin.com",
	logFolder: "garmin-probe-logs",
	autoSaveLog: true,
};

export class ProbeSettingTab extends PluginSettingTab {
	private plugin: GarminProbePlugin;

	constructor(app: App, plugin: GarminProbePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Garmin email")
			.addText((t) =>
				t
					.setPlaceholder("you@example.com")
					.setValue(this.plugin.settings.email)
					.onChange(async (v) => {
						this.plugin.settings.email = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Remember password")
			.setDesc(
				"Stores the password in this plugin's data.json as plain text, which syncs " +
					"with your vault. Convenient for repeated mobile testing; turn it off " +
					"and delete data.json when you are done probing.",
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.rememberPassword).onChange(async (v) => {
					this.plugin.settings.rememberPassword = v;
					if (!v) this.plugin.settings.password = "";
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (this.plugin.settings.rememberPassword) {
			new Setting(containerEl).setName("Garmin password").addText((t) => {
				t.inputEl.type = "password";
				t.setValue(this.plugin.settings.password).onChange(async (v) => {
					this.plugin.settings.password = v;
					await this.plugin.saveSettings();
				});
			});
		}

		new Setting(containerEl)
			.setName("Region")
			.setDesc("garmin.cn is the mainland China tenant; everyone else uses garmin.com.")
			.addDropdown((d) =>
				d
					.addOption("garmin.com", "garmin.com")
					.addOption("garmin.cn", "garmin.cn")
					.setValue(this.plugin.settings.domain)
					.onChange(async (v) => {
						this.plugin.settings.domain = v as GarminDomain;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Save every run to the vault")
			.setDesc("The only practical way to read probe output from a phone.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.autoSaveLog).onChange(async (v) => {
					this.plugin.settings.autoSaveLog = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Log folder")
			.addText((t) =>
				t
					.setPlaceholder("garmin-probe-logs")
					.setValue(this.plugin.settings.logFolder)
					.onChange(async (v) => {
						this.plugin.settings.logFolder = v.trim() || DEFAULT_SETTINGS.logFolder;
						await this.plugin.saveSettings();
					}),
			);
	}
}
