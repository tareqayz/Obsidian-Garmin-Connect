<script lang="ts">
	import type { Snippet } from "svelte";
	import { lucide } from "./lucide";

	/**
	 * The bar across the top of every page inside the view: back on the left,
	 * the title in the middle, an action on the right. Obsidian's own chrome
	 * already has a title bar, so this is the app's navigation bar without the
	 * iOS status bar above it.
	 */
	interface Props {
		title: string;
		/** Draws the back chevron. Ignored when `left` is given. */
		onBack?: () => void;
		/** What back returns to, for the button's label. */
		backLabel?: string;
		left?: Snippet;
		right?: Snippet;
	}

	let { title, onBack, backLabel = "Back", left, right }: Props = $props();
</script>

<header class="page-bar">
	{#if left}{@render left()}
	{:else if onBack}<button class="clickable-icon back" aria-label={backLabel} onclick={onBack}><span use:lucide={"chevron-left"}></span></button>
	{:else}<span></span>{/if}
	<strong>{title}</strong>
	{#if right}{@render right()}{:else}<span></span>{/if}
</header>

<style>
	.page-bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 0 16px 0 12px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.page-bar strong {
		font-size: 15px;
		font-weight: 600;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}
	.page-bar > :first-child {
		justify-self: start;
	}
	.page-bar > :last-child {
		justify-self: end;
	}
	.back {
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.page-bar {
			padding: 0 24px 0 20px;
		}
	}
</style>
