<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * A card that opens a page, by click or by Enter / Space. A link inside it
	 * (a weigh-in's +, a prompt's) goes where it says instead.
	 *
	 * In a note (`contained`) the press stops at the card: in Live Preview it
	 * would otherwise put the cursor into the block's source, and the editor
	 * would take the Enter.
	 */
	interface Props {
		open: () => void;
		contained?: boolean;
		children: Snippet;
	}

	let { open, contained = false, children }: Props = $props();

	const onLink = (e: Event) => !!(e.target as Element | null)?.closest?.("a[href]");

	function onclick(e: MouseEvent) {
		if (onLink(e)) return;
		if (contained) e.stopPropagation();
		open();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		if (contained) e.stopPropagation();
		open();
	}

	function press(e: Event) {
		if (contained && !onLink(e)) e.stopPropagation();
	}
</script>

<div class="tap" role="button" tabindex="0" {onclick} {onkeydown} onmousedown={press} onpointerdown={press}>{@render children()}</div>

<style>
	.tap {
		display: flex;
		flex-direction: column;
		cursor: pointer;
		border-radius: var(--radius-m, 8px);
	}
	.tap > :global(*) {
		flex: 1;
	}
	.tap:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}
</style>
