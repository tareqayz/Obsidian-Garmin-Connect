<script lang="ts">
	import type { Snippet } from "svelte";
	import SyncButton from "./SyncButton.svelte";
	import { lucide } from "./lucide";
	import { useSync } from "./sync-control";

	/**
	 * The bar across the top of every page inside the view: back on the left,
	 * the title in the middle, an action on the right, and in a pane Sync
	 * after it. Obsidian's own chrome already has a title bar, so this is the
	 * app's navigation bar without the iOS status bar above it.
	 */
	interface Props {
		title: string;
		/** Draws the back chevron. Ignored when `left` is given. */
		onBack?: () => void;
		/** What back returns to, for the button's label. */
		backLabel?: string;
		left?: Snippet;
		right?: Snippet;
		/** False on a bar that closes a state rather than leaving a page (Cancel and Save, the chart's Close). */
		sync?: boolean;
	}

	let { title, onBack, backLabel = "Back", left, right, sync = true }: Props = $props();
	const control = useSync();
</script>

<header class="page-bar">
	{#if left}{@render left()}
	{:else if onBack}<button class="clickable-icon back" aria-label={backLabel} onclick={onBack}><span use:lucide={"chevron-left"}></span></button>
	{:else}<span></span>{/if}
	<strong>{title}</strong>
	{#if sync && control?.inBars}
		<div class="end">
			{@render right?.()}
			<SyncButton canSync={control.canSync} syncing={control.syncing} message={control.message} onSync={control.sync} />
		</div>
	{:else if right}{@render right()}{:else}<span></span>{/if}
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
	.end {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	@container (min-width: 640px) {
		.page-bar {
			padding: 0 24px 0 20px;
		}
	}
</style>
