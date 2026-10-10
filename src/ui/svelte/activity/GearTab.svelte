<script lang="ts">
	import { gearView } from "../../../dashboard/activity-stats-pages";
	import ListCard from "../activities/ListCard.svelte";
	import { lucide } from "../home/lucide";
	import type { ActivityTabProps } from "./types";

	/**
	 * Gear: what is linked to the activity (`gearView`). With nothing linked,
	 * the web's empty state without its Add Gear button, as the twin draws it
	 * (Figma 408:924, Inferred: the phone's Gear tab is not shot). Linked gear
	 * reads one card an item, its name over its type (Inferred).
	 */
	let { detail }: ActivityTabProps = $props();

	let view = $derived(gearView(detail));
</script>

<div class="gear-tab">
	{#if view.empty}
		<div class="empty">
			<span class="disc"><span class="glyph" use:lucide={"footprints"}></span></span>
			<strong class="title">{view.empty.title}</strong>
			<span class="text">{view.empty.text}</span>
		</div>
	{:else if view.items.length}
		<div class="items">
			{#each view.items as item, i (i)}
				<ListCard title={item.name} detail={item.type ?? ""} value="" muted />
			{/each}
		</div>
	{/if}
</div>

<style>
	.gear-tab {
		padding: 16px;
	}
	/* Measured off the twin: a 370pt card on the phone, 44pt disc 16pt in,
	   the title 17.8pt under it, the sentence 18.7pt under that. */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		padding: 16px 16px 24px;
		border-radius: 8px;
		background: var(--background-secondary);
		text-align: center;
	}
	.disc {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--background-modifier-border);
		color: var(--text-muted);
	}
	.glyph {
		display: flex;
	}
	.glyph :global(svg) {
		width: 24px;
		height: 24px;
	}
	.title {
		display: block;
		margin-top: 17.82px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		color: var(--text-normal);
	}
	/* A span, not a <p>: Obsidian pads paragraphs. */
	.text {
		display: block;
		margin-top: 18.73px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
	}
	.items {
		display: grid;
		gap: 8px;
	}

	/* The pane (Figma 416:86103): the same card, centred, 24pt under the tabs. */
	@container (min-width: 640px) {
		.gear-tab {
			padding: 24px 32px 32px;
		}
		.empty,
		.items {
			max-width: 370px;
			margin: 0 auto;
		}
	}
</style>
