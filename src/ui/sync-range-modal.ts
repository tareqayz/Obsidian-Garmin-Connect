import { App, Modal, Setting } from "obsidian";
import { toIsoDate } from "../garmin/endpoints";
import { dateRange, lastNDays } from "../sync/engine";
import type GarminPlugin from "../main";

/** Backfill a chosen range. The recent-days command covers the everyday case. */
export class SyncRangeModal extends Modal {
	private plugin: GarminPlugin;
	private from: string;
	private to: string;

	constructor(app: App, plugin: GarminPlugin) {
		super(app);
		this.plugin = plugin;
		const range = lastNDays(plugin.data.settings.syncDays, toIsoDate());
		this.from = range.from;
		this.to = range.to;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("gcp-modal");
		contentEl.createEl("h2", { text: "Sync a date range" });

		const summary = contentEl.createDiv({ cls: "gcp-status" });
		const refresh = () => {
			const days = dateRange(this.from, this.to).length;
			summary.setText(
				days === 0
					? "That range is empty — the end date is before the start."
					: `${days} day${days === 1 ? "" : "s"}. Expect roughly ${days * 4} requests.`,
			);
		};

		const dateField = (name: string, get: () => string, set: (v: string) => void) =>
			new Setting(contentEl).setName(name).addText((t) => {
				t.inputEl.type = "date";
				t.setValue(get()).onChange((v) => {
					set(v);
					refresh();
				});
			});

		dateField("From", () => this.from, (v) => (this.from = v));
		dateField("To", () => this.to, (v) => (this.to = v));
		refresh();

		const actions = contentEl.createDiv({ cls: "gcp-actions" });
		const run = actions.createEl("button", { text: "Sync", cls: "mod-cta" });
		run.onclick = () => {
			if (dateRange(this.from, this.to).length === 0) return;
			this.close();
			void this.plugin.sync.run(this.from, this.to);
		};
		actions.createEl("button", { text: "Cancel" }).onclick = () => this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
