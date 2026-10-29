<script lang="ts">
	import { dayActivityRows, type TodayItem } from "../../../dashboard/home";
	import HomeCard from "./HomeCard.svelte";
	import RowCard from "./RowCard.svelte";
	import Tap from "./Tap.svelte";

	/**
	 * The day's activities and Health Snapshots, newest first, as Home's
	 * Today's Activity stacks them. `opens` says what a row opens, if anything.
	 */
	interface Props {
		items: readonly TodayItem[];
		opens?: (item: TodayItem) => (() => void) | null;
		/** In a note: a press stops at the card (see `Tap`). */
		contained?: boolean;
		/** Two cards a row from 640 pt, as a note lays them out. */
		wide?: boolean;
		emptyText?: string;
	}

	let { items, opens, contained = false, wide = false, emptyText = "No activities or Health Snapshots yet today." }: Props = $props();

	let rows = $derived(dayActivityRows(items));
</script>

<div class="stack" class:wide>
	{#each rows as row}
		{@const open = opens?.(row.item) ?? null}
		{#snippet card()}
			<RowCard kicker={row.kicker} icon={row.icon} color={row.color} headline={row.headline} detail={row.detail} />
		{/snippet}
		{#if open}<Tap {open} {contained}>{@render card()}</Tap>{:else}{@render card()}{/if}
	{:else}
		<div class="none"><HomeCard><div class="quiet">{emptyText}</div></HomeCard></div>
	{/each}
</div>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--gch-gap, 8px);
	}
	.quiet {
		color: var(--text-faint);
		font-size: 13px;
	}
	.none {
		display: flex;
		flex-direction: column;
	}
	@container (min-width: 640px) {
		.wide {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		/* A day without any spans the row. */
		.wide .none {
			grid-column: 1 / -1;
		}
	}
</style>
