import { App, Modal } from "obsidian";
import { mount, unmount, type Component } from "svelte";

/** A sheet's body gets a way to close the sheet it is in. */
export interface SheetBodyProps {
	onClose: () => void;
}

/**
 * Opens a Svelte body as one of Garmin's bottom sheets: an info sheet, a
 * picker, Map Settings. Its props, without `onClose`, which the sheet adds.
 */
export type OpenSheet = <P extends SheetBodyProps>(body: Component<P>, props: Omit<P, "onClose">) => void;

/**
 * Any of the pages' sheets, for the same reasons as Sleep History's: Obsidian
 * gives a modal focus handling, Escape and a close button, and on a phone it
 * rises from the bottom as Garmin's sheet does, while a pane gets a dialog over
 * the page. The body draws the sheet's header itself; styles.css hides the
 * modal's own.
 */
export class SheetModal<P extends SheetBodyProps> extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly component: Component<P>,
		private readonly props: Omit<P, "onClose">,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("gch-sheet");
		this.body = mount(this.component, {
			target: this.contentEl,
			props: { ...this.props, onClose: () => this.close() } as unknown as P,
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
