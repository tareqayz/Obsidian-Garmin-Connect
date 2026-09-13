import { type App, ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import { toIsoDate } from "../garmin/endpoints";
import Gallery from "./svelte/gallery/Gallery.svelte";

export const GARMIN_GALLERY_VIEW = "garmin-ui-gallery";

/**
 * The component gallery, in a real Obsidian leaf.
 *
 * `npm run preview:gallery` renders the same component in a browser, which is
 * the faster loop — but the browser's theme is a stand-in. Only this view shows
 * the components against the user's actual theme variables, which is the whole
 * question for a plugin that inherits its palette from the app.
 */
export class GarminGalleryView extends ItemView {
	private component: ReturnType<typeof Gallery> | undefined;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return GARMIN_GALLERY_VIEW;
	}

	getDisplayText(): string {
		return "Garmin UI gallery";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.component = mount(Gallery, {
			target: this.contentEl,
			props: { today: toIsoDate() },
		});
	}

	async onClose(): Promise<void> {
		if (this.component) {
			unmount(this.component);
			this.component = undefined;
		}
	}
}

/**
 * Reveal an open gallery or put one in a new tab.
 *
 * A free function rather than a method on the plugin: a method is always
 * retained, and the reference alone would keep this module — and the injected
 * CSS of every component it imports — in the production bundle.
 */
export async function openGallery(app: App): Promise<void> {
	const existing = app.workspace.getLeavesOfType(GARMIN_GALLERY_VIEW);
	if (existing.length > 0) {
		await app.workspace.revealLeaf(existing[0]!);
		return;
	}
	const leaf = app.workspace.getLeaf("tab");
	await leaf.setViewState({ type: GARMIN_GALLERY_VIEW, active: true });
	await app.workspace.revealLeaf(leaf);
}
