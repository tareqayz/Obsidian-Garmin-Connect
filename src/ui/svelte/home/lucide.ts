import { setIcon } from "obsidian";

/**
 * Svelte action that draws one of Obsidian's bundled Lucide icons.
 *
 * Obsidian ships Lucide, and the Figma file draws the same set, so the Home
 * screen uses the app's icons rather than bundling its own copies.
 */
export function lucide(node: HTMLElement, name: string) {
	setIcon(node, name);
	return {
		update(next: string) {
			node.empty();
			setIcon(node, next);
		},
	};
}
