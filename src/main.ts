import { Notice, Plugin } from "obsidian";
import { GarminApi } from "./garmin/endpoints";
import { ObsidianHttpClient } from "./obsidian-http";
import { PluginData } from "./plugin-data";
import { GarminSettingTab } from "./settings";
import { ProbeModal } from "./ui/probe-modal";

export default class GarminPlugin extends Plugin {
	data!: PluginData;
	garmin!: GarminApi;

	async onload(): Promise<void> {
		this.data = new PluginData(this);
		await this.data.init();

		this.buildClient();
		await this.garmin.restore();

		if (this.data.migratedAwayFromStoredPassword) {
			// Worth interrupting for: the password was sitting in a synced file.
			new Notice(
				"Garmin Connect: a password left in data.json by the phase 0 probe has " +
					"been deleted. Consider changing your Garmin password.",
				10000,
			);
		}

		this.addRibbonIcon("activity", "Garmin Connect probe", () => this.openProbe());
		this.addCommand({
			id: "run-probe",
			name: "Run connectivity probe",
			callback: () => this.openProbe(),
		});
		this.addSettingTab(new GarminSettingTab(this.app, this));
	}

	/** The domain is baked into every URL, so changing it needs a fresh client. */
	buildClient(): void {
		this.garmin = new GarminApi({
			http: new ObsidianHttpClient(),
			store: this.data,
			domain: this.data.settings.domain,
		});
	}

	private openProbe(): void {
		new ProbeModal(this.app, this).open();
	}
}
