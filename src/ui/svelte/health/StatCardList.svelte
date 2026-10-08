<script lang="ts" module>
	/** A card in a Health Stats list. */
	export interface StatCardItem {
		key: string;
		title: string;
		detail?: string;
		value: string;
		kind: "day" | "week";
		onclick: () => void;
	}
</script>

<script lang="ts" generics="T extends StatCardItem">
	import type { Snippet } from "svelte";
	import StatCard from "./StatCard.svelte";

	/**
	 * A 7d or 4w page's days, or a 1y page's weeks: one card a row on a phone,
	 * two from 640pt, three in a pane. `visual` draws a card's own mark at its
	 * right edge, given the card. The space above the list is the phone's
	 * 17.1pt and a pane's 30pt unless `--stat-list-top` and
	 * `--stat-list-top-pane` say otherwise.
	 */
	let { items, visual: drawVisual }: { items: T[]; visual?: Snippet<[T]> } = $props();
</script>

<div class="stat-card-list">
	{#each items as item (item.key)}
		<StatCard title={item.title} detail={item.detail} value={item.value} kind={item.kind} onclick={item.onclick}>
			{#snippet visual()}{@render drawVisual?.(item)}{/snippet}
		</StatCard>
	{/each}
</div>

<style>
	.stat-card-list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: var(--stat-list-top, 17.1px);
		padding: 0 16px 16px;
	}

	@container (min-width: 640px) {
		.stat-card-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0 0 16px;
		}
	}

	@container (min-width: 1000px) {
		.stat-card-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: var(--stat-list-top-pane, 30px);
			padding: 0 0 32px;
		}
	}
</style>
