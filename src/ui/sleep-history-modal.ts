import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { HistoryView } from "../dashboard/sleep-pages";
import HistorySheet from "./svelte/sleep/HistorySheet.svelte";

/**
 * The Sleep Coach's Sleep History sheet.
 *
 * A modal for the same reasons as Add a Stat: Obsidian gives it focus
 * handling, Escape and a close button, and on a phone it rises from the
 * bottom as Garmin's sheet does, while a pane gets a dialog over the page.
 */
export class SleepHistoryModal extends Modal {
	private sheet: ReturnType<typeof HistorySheet> | undefined;

	constructor(
		app: App,
		private readonly view: HistoryView,
	) {
		super(app);
	}

	onOpen(): void {
		// The sheet draws the Figma header itself; styles.css hides the modal's own.
		this.modalEl.addClass("gch-sleep-history");
		this.sheet = mount(HistorySheet, { target: this.contentEl, props: { view: this.view, onClose: () => this.close() } });
	}

	onClose(): void {
		if (this.sheet) {
			unmount(this.sheet);
			this.sheet = undefined;
		}
		this.contentEl.empty();
	}
}
