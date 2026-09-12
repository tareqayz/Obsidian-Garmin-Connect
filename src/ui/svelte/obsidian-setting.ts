import { Setting } from "obsidian";

/**
 * Svelte action that drops a native Obsidian `Setting` row into an element.
 *
 * Hand-rolling toggles and sliders in Svelte would mean re-implementing
 * Obsidian's look and its mobile behaviour, and getting both subtly wrong. This
 * keeps the controls native while Svelte decides which rows exist — which is the
 * half that actually benefited from the rewrite.
 *
 * The builder runs once per mount. Anything whose *presence* depends on state
 * belongs in an `{#if}` around the row, not in a rebuild.
 */
export function obsidianSetting(node: HTMLElement, build: (setting: Setting) => void) {
	build(new Setting(node));
	return {
		destroy() {
			node.empty();
		},
	};
}
