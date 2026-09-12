import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import type GarminPlugin from "../main";
import { lastNDays } from "../sync/engine";
import { endpointsFor } from "../sync/metrics";
import SyncRangeForm from "./svelte/SyncRangeForm.svelte";

/** Backfill a chosen range. The recent-days command covers the everyday case. */
export class SyncRangeModal extends Modal {
	private plugin: GarminPlugin;
	private form: ReturnType<typeof SyncRangeForm> | undefined;

	constructor(app: App, plugin: GarminPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const settings = this.plugin.data.settings;
		const { from, to } = lastNDays(settings.syncDays, toIsoDate());
		// Only the endpoints the enabled groups actually need count towards the
		// estimate, so turning groups off visibly lowers it.
		const wanted = endpointsFor(settings.groups);
		const perDay = [wanted.summary, wanted.sleep, wanted.hrv, wanted.readiness].filter(
			Boolean,
		).length;

		this.form = mount(SyncRangeForm, {
			target: this.contentEl,
			props: {
				initialFrom: from,
				initialTo: to,
				perDay,
				today: toIsoDate(),
				pauseMs: settings.pauseBetweenDays,
				stopAfterEmptyDays: settings.stopAfterEmptyDays,
				onRun: (start: string, end: string) => {
					this.close();
					void this.plugin.sync.run(start, end);
				},
				onCancel: () => this.close(),
			},
		});
	}

	onClose(): void {
		if (this.form) {
			unmount(this.form);
			this.form = undefined;
		}
		this.contentEl.empty();
	}
}
