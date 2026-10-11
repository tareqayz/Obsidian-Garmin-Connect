import { ToggleComponent } from "obsidian";

/**
 * Svelte action that draws Obsidian's own toggle: the look and the touch
 * behaviour of every switch in the app's settings, which the twin's Toggle
 * is (40 × 22, the accent when on).
 *
 * `value` follows the caller; a tap reports the new value through `onChange`,
 * and the caller decides whether to keep it.
 */
export interface ToggleParams {
	value: boolean;
	onChange: (value: boolean) => void;
}

export function obsidianToggle(node: HTMLElement, params: ToggleParams) {
	let current = params;
	const toggle = new ToggleComponent(node).setValue(params.value).onChange((value) => {
		if (value !== current.value) current.onChange(value);
	});
	return {
		update(next: ToggleParams) {
			current = next;
			if (toggle.getValue() !== next.value) toggle.setValue(next.value);
		},
		destroy() {
			node.empty();
		},
	};
}
