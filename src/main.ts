import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, ProbeSettingTab, type ProbeSettings } from "./settings";
import { ProbeModal } from "./ui/probe-modal";

export default class GarminProbePlugin extends Plugin {
	settings: ProbeSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon("activity", "Garmin Connect probe", () => this.openProbe());
		this.addCommand({
			id: "run-probe",
			name: "Run connectivity probe",
			callback: () => this.openProbe(),
		});
		this.addSettingTab(new ProbeSettingTab(this.app, this));
	}

	private openProbe(): void {
		new ProbeModal(this.app, this.settings).open();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		// Never persist a password the user did not ask us to keep.
		const toSave: ProbeSettings = {
			...this.settings,
			password: this.settings.rememberPassword ? this.settings.password : "",
		};
		await this.saveData(toSave);
	}
}
