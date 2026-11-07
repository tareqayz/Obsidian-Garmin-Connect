import { Notice, Platform, type App } from "obsidian";

/**
 * What the share sheet's buttons do with a finished image. Public APIs only:
 * the system share sheet where the device has one for files (the iPhone),
 * and a file in the vault everywhere. Never the clipboard: the Community
 * directory's review counts clipboard access against a plugin, and a saved
 * image can be copied with Obsidian's own right-click → Copy image.
 */
export interface ShareActions {
	/** Whether this device has a system share sheet that takes an image. */
	canShare(): boolean;
	/**
	 * Opens the system share sheet with the image. Call it straight from the
	 * tap, with the image already drawn: the sheet opens only on a tap's turn.
	 */
	share(image: Blob, name: string): void;
	/** Saves the image into the vault's attachment folder; in a pane, opens it in a new tab. */
	save(image: Blob, name: string): Promise<void>;
}

export function shareActions(app: App): ShareActions {
	return {
		canShare: canShareFiles,
		share(image, name) {
			const file = new File([image], name, { type: "image/png" });
			navigator.share({ files: [file] }).catch((error: unknown) => {
				// Closing the sheet without picking anything isn't a failure.
				if (error instanceof DOMException && error.name === "AbortError") return;
				new Notice(`Couldn't share the image: ${messageOf(error)}`, 8000);
			});
		},
		async save(image, name) {
			try {
				const path = await app.fileManager.getAvailablePathForAttachment(name);
				const file = await app.vault.createBinary(path, await image.arrayBuffer());
				// In a pane the image opens beside the page, where right-click copies it; a phone stays on the page.
				if (!Platform.isPhone) await app.workspace.getLeaf("tab").openFile(file);
				new Notice(`Saved ${file.path}.`, 5000);
			} catch (error) {
				new Notice(`Couldn't save the image: ${messageOf(error)}`, 8000);
			}
		},
	};
}

/** Whether `navigator.share` takes a PNG here: the iPhone's yes, a desktop's and Android's WebView's no. */
export function canShareFiles(): boolean {
	const nav: Partial<Pick<Navigator, "share" | "canShare">> = navigator;
	if (typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
	try {
		return navigator.canShare({ files: [new File([new Uint8Array(1)], "probe.png", { type: "image/png" })] });
	} catch {
		return false;
	}
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
