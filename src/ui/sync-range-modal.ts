import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import type GarminPlugin from "../main";
import { FIRST_SYNC_DAYS, lastNDays } from "../sync/engine";
import { requestsPerDay } from "../sync/estimate";
import { HOURLY_BUDGET, secondsPerDay } from "../sync/pace";
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
		const { from, to } = lastNDays(FIRST_SYNC_DAYS, toIsoDate());
		// Only the endpoints the enabled groups actually need count towards the
		// estimate, so turning groups off visibly lowers it: the day's own
		// requests, and its timelines' six with intraday on.
		const perDay = requestsPerDay(settings.groups);

		this.form = mount(SyncRangeForm, {
			target: this.contentEl,
			props: {
				initialFrom: from,
				initialTo: to,
				perDay,
				today: toIsoDate(),
				secondsPerDay: secondsPerDay(perDay),
				stopAfterEmptyDays: settings.stopAfterEmptyDays,
				hourly: HOURLY_BUDGET,
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
			void unmount(this.form);
			this.form = undefined;
		}
		this.contentEl.empty();
	}
}
