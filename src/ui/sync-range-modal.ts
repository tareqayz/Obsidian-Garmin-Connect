import { App, Modal, Notice } from "obsidian";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import type GarminPlugin from "../main";
import { FIRST_SYNC_DAYS, lastNDays } from "../sync/engine";
import { estimateRange, type EstimateInput } from "../sync/estimate";
import { historyFloor, type RangeQuote } from "./date-range";
import SyncRangeForm from "./svelte/SyncRangeForm.svelte";

const dateFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/** "Mar 2, 2019", as your locale writes it. */
function dayText(date: string): string {
	return dateFormat.format(new Date(`${date}T12:00:00`));
}

/**
 * Sync a date range…: a dialog in a pane, a sheet on a phone. A short range
 * syncs at once; a long one, once the setup is done, goes to the history
 * download (`estimateRange` decides, `SyncRunner.queueRange` queues it).
 */
export class SyncRangeModal extends Modal {
	private form: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly plugin: GarminPlugin,
	) {
		super(app);
	}

	onOpen(): void {
		this.containerEl.addClass("gch-sheet-container");
		this.modalEl.addClass("gch-setup");
		this.setTitle("Sync a date range");
		const today = toIsoDate();
		const { from, to } = lastNDays(FIRST_SYNC_DAYS, today);
		this.form = mount(SyncRangeForm, {
			target: this.contentEl,
			props: {
				initialFrom: from,
				initialTo: to,
				today,
				quote: () => this.quote(today),
				dayText,
				onSync: (start: string, end: string) => {
					this.close();
					void this.plugin.sync.run(start, end);
				},
				onQueue: (start: string, end: string) => {
					this.close();
					this.plugin.sync.queueRange(start, end).then(
						() => new Notice("Downloading the range in the background."),
						(e: unknown) => new Notice(`Couldn't start the download: ${e instanceof Error ? e.message : String(e)}`),
					);
				},
				onCancel: () => this.close(),
			},
		});
	}

	/** The vault, read once: where the history starts, and every range priced from it. */
	private async quote(today: string): Promise<RangeQuote> {
		const settings = this.plugin.data.settings;
		let input: EstimateInput | null = null;
		try {
			input = await this.plugin.historyInput();
		} catch {
			// Priced from the measured sizes alone.
		}
		const priced: EstimateInput = input ?? {
			today,
			groups: settings.groups,
			accepted: [],
			dayDetails: settings.data.dayDetails,
			activityDetails: settings.data.activityDetails,
			scan: null,
			daySpans: [],
			charts: new Map(),
			activities: [],
			detailFiles: new Map(),
		};
		const start = historyFloor(priced.scan, priced.activities[priced.activities.length - 1]?.date);
		const download = settings.setup !== null;
		return { ...(start ? { start } : {}), price: (from, to) => estimateRange(priced, from, to, { download }) };
	}

	onClose(): void {
		if (this.form) {
			void unmount(this.form);
			this.form = undefined;
		}
		this.contentEl.empty();
	}
}
