import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import { formatBytes } from "../sync/estimate";
import { deletePlan, deleteSyncedFiles, diagnosticsIn } from "./delete-data";
import RemovedData from "./svelte/RemovedData.svelte";

/** "Garmin Connect was removed": keep the synced data, or move it to the trash. Opened after the plugin unloaded. */
export class RemovedDataModal extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly dataFolder: string,
		private readonly logFolder: string,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Garmin Connect was removed");
		this.body = mount(RemovedData, {
			target: this.contentEl,
			props: {
				folder: this.dataFolder,
				bytes: deletePlan(this.app, this.dataFolder).bytes,
				logFolder: this.logFolder,
				notes: diagnosticsIn(this.app, this.logFolder).length,
				onKeep: () => this.close(),
				onTrash: async (diagnostics: boolean) => {
					const done = await deleteSyncedFiles(this.app, { dataFolder: this.dataFolder, ...(diagnostics ? { logFolder: this.logFolder } : {}) });
					new Notice(`Moved ${done.files} files (${formatBytes(done.bytes)}) to the trash.`);
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
