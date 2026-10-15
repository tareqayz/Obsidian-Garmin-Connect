import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import type GarminPlugin from "../main";
import { formatBytes } from "../sync/estimate";
import { deletePlan, diagnosticsIn } from "./delete-data";
import DeleteData from "./svelte/DeleteData.svelte";

/** "Delete synced data…": what goes, and a last chance to keep it. */
export class DeleteDataModal extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly plugin: GarminPlugin,
		private readonly onDone?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Delete synced data?");
		const settings = this.plugin.data.settings;
		const plan = deletePlan(this.app, settings.dataFolder);
		this.body = mount(DeleteData, {
			target: this.contentEl,
			props: {
				folder: settings.dataFolder,
				files: plan.files,
				bytes: plan.bytes,
				logFolder: settings.logFolder,
				notes: diagnosticsIn(this.app, settings.logFolder).length,
				onDelete: async (diagnostics: boolean) => {
					const done = await this.plugin.deleteSyncedData({ diagnostics });
					new Notice(`Moved ${done.files} files (${formatBytes(done.bytes)}) to the trash.`);
					this.onDone?.();
					this.close();
				},
				onCancel: () => this.close(),
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
