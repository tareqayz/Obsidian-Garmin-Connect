import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import type { UpdateLine, UpdateTotal } from "./setup-flow";
import DataUpdate from "./svelte/DataUpdate.svelte";

/**
 * "New data for your history": once after an update that has something new
 * to fetch for days the vault already holds. A dialog in a pane, a sheet on
 * a phone.
 */
export class DataUpdateModal extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly plugin: GarminPlugin,
		private readonly lines: UpdateLine[],
		private readonly total: UpdateTotal,
	) {
		super(app);
	}

	onOpen(): void {
		this.containerEl.addClass("gch-sheet-container");
		this.modalEl.addClass("gch-setup");
		this.setTitle("New data for your history");
		this.body = mount(DataUpdate, {
			target: this.contentEl,
			props: {
				lines: this.lines,
				total: this.total,
				onDownload: (keys: string[], later: string[]) => {
					void this.plugin.agreeTo(keys, later);
					new Notice("Downloading the new data in the background.");
					this.close();
				},
				onLater: () => {
					void this.plugin.agreeTo([], this.lines.map((line) => line.key));
					this.close();
				},
			},
		});
	}

	onClose(): void {
		if (this.body) {
			void unmount(this.body);
			this.body = undefined;
		}
		this.contentEl.empty();
	}
}
