import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type { GarminDomain } from "./garmin/constants";
import type GarminPlugin from "./main";

export interface GarminSettings {
	email: string;
	domain: GarminDomain;
	logFolder: string;
	autoSaveLog: boolean;
}

export const DEFAULT_SETTINGS: GarminSettings = {
	email: "",
	domain: "garmin.com",
	logFolder: "garmin-probe-logs",
	autoSaveLog: true,
};

export class GarminSettingTab extends PluginSettingTab {
	private plugin: GarminPlugin;

	constructor(app: App, plugin: GarminPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const data = this.plugin.data;
		containerEl.empty();

		new Setting(containerEl).setName("Connection").setHeading();

		const session = this.plugin.garmin.session;
		new Setting(containerEl)
			.setName("Status")
			.setDesc(
				session
					? `Signed in. Session saved ${new Date(session.savedAt).toLocaleString()}.`
					: "Not signed in. Use the probe to sign in.",
			)
			.addButton((b) =>
				b
					.setButtonText("Sign out")
					.setDisabled(!session)
					.onClick(async () => {
						await this.plugin.garmin.logout();
						new Notice("Signed out of Garmin Connect.");
						this.display();
					}),
			);

		new Setting(containerEl)
			.setName("Garmin email")
			.setDesc("Only the email is stored. The password is used to sign in and never saved.")
			.addText((t) =>
				t
					.setPlaceholder("you@example.com")
					.setValue(data.settings.email)
					.onChange(async (v) => {
						data.settings.email = v.trim();
						await data.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Region")
			.setDesc("garmin.cn is the mainland China tenant; everyone else uses garmin.com.")
			.addDropdown((d) =>
				d
					.addOption("garmin.com", "garmin.com")
					.addOption("garmin.cn", "garmin.cn")
					.setValue(data.settings.domain)
					.onChange(async (v) => {
						data.settings.domain = v as GarminDomain;
						await data.saveSettings();
					}),
			);

		new Setting(containerEl).setName("Diagnostics").setHeading();

		new Setting(containerEl)
			.setName("Save every probe run to the vault")
			.setDesc("The only practical way to read probe output from a phone.")
			.addToggle((t) =>
				t.setValue(data.settings.autoSaveLog).onChange(async (v) => {
					data.settings.autoSaveLog = v;
					await data.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Log folder")
			.addText((t) =>
				t
					.setPlaceholder(DEFAULT_SETTINGS.logFolder)
					.setValue(data.settings.logFolder)
					.onChange(async (v) => {
						data.settings.logFolder = v.trim() || DEFAULT_SETTINGS.logFolder;
						await data.saveSettings();
					}),
			);
	}
}
