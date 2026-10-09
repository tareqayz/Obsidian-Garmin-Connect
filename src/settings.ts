import { App, PluginSettingTab } from "obsidian";
import { mount, unmount } from "svelte";
import SettingsPanel from "./ui/svelte/SettingsPanel.svelte";
import type GarminPlugin from "./main";

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
