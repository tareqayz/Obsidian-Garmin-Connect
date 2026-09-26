import { App, Modal } from "obsidian";
import { mount, unmount } from "svelte";
import type { GlanceId, GlanceStat } from "../dashboard/glance";
import AddStat from "./svelte/home/AddStat.svelte";

/**
 * Add a Stat, from the At a Glance edit screen.
 *
 * A modal rather than a sheet drawn inside the pane: Obsidian already gives a
 * modal its focus handling, Escape and close button, and on a phone it rises
 * from the bottom much as Garmin's sheet does. Picking a stat closes it.
 */
export class AddStatModal extends Modal {
	private list: ReturnType<typeof AddStat> | undefined;
	private picked: GlanceId | null = null;

	constructor(
		app: App,
		private readonly stats: readonly GlanceStat[],
		private readonly onDone: (id: GlanceId | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("gch-add-stat");
		this.setTitle("Add a Stat");
		this.list = mount(AddStat, {
			target: this.contentEl,
			props: {
				stats: this.stats,
				onPick: (id: GlanceId) => {
					this.picked = id;
					this.close();
				},
			},
		});
	}

	onClose(): void {
		if (this.list) {
			unmount(this.list);
			this.list = undefined;
		}
		this.contentEl.empty();
		this.onDone(this.picked);
	}
}

/** Opens the picker and resolves with the stat chosen, or null when it was dismissed. */
export function pickStat(app: App, stats: readonly GlanceStat[]): Promise<GlanceId | null> {
	return new Promise((resolve) => new AddStatModal(app, stats, resolve).open());
}
