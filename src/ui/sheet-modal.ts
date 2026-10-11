import { App, Modal } from "obsidian";
import { mount, unmount, type Component } from "svelte";

/** A sheet's body gets a way to close the sheet it is in. */
export interface SheetBodyProps {
	onClose: () => void;
}

/**
 * Opens a Svelte body as one of Garmin's bottom sheets: an info sheet, a
 * picker, Map Settings. Its title, then its props without `onClose`, which
 * the sheet adds.
 */
export type OpenSheet = <P extends SheetBodyProps>(title: string, body: Component<P>, props: Omit<P, "onClose">) => void;

/**
 * Any of the pages' sheets: an Obsidian Modal, for its focus handling, Escape
 * and close button, with a Svelte body.
 *
 * The title is the modal's own header. On a phone that header is the handle
 * Obsidian drags a sheet down by, closing it past halfway, and styles.css
 * puts the sheet on the bottom edge at the height of what it holds. In a pane
 * it is a dialog over the page.
 */
export class SheetModal<P extends SheetBodyProps> extends Modal {
	private body: ReturnType<typeof mount> | undefined;

	constructor(
		app: App,
		private readonly title: string,
		private readonly component: Component<P>,
		private readonly props: Omit<P, "onClose">,
	) {
		super(app);
	}

	onOpen(): void {
		this.containerEl.addClass("gch-sheet-container");
		this.modalEl.addClass("gch-sheet");
		this.setTitle(this.title);
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
