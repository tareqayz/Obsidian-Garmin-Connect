<script lang="ts">
	import type { ChartCardView } from "../../../embeds/view";
	import Stat from "../home/Stat.svelte";
	import { lucide } from "../home/lucide";
	import { toneColor } from "../home/tones";
	import ChartBody from "./ChartBody.svelte";

	/**
	 * A stat page's chart in a note, in a Home card (Figma 1319:2, F · Card):
	 * the stat's icon and name with the period on the right, the big figure and
	 * the figures beside it as an In Focus card has them, then the page's own
	 * chart at the card's width. The card names the chart, so the chart's own
	 * title goes; its key stays.
	 *
	 * The chart lays itself out as its page's does: by the phone's frames in a
	 * narrow column, by a pane's in a desktop note's (`pane`).
	 */
	let { card }: { card: ChartCardView } = $props();

	let width = $state(0);
	let pane = $derived(width >= 600);
</script>

<article class="gcc-card">
	<header>
		<span class="icon" style:color={toneColor(card.tone)} use:lucide={card.icon}></span>
		<span class="title">{card.title}</span>
		{#if card.period}<span class="period">{card.period}</span>{/if}
	</header>
	{#if card.value !== undefined || card.figures.length}
		<div class="headline">
			{#if card.value !== undefined}<div class="big">{card.value}</div>{/if}
			{#each card.figures as figure (figure.label)}
				<Stat value={figure.value} label={figure.label} />
			{/each}
		</div>
	{/if}
	<div class="body" bind:clientWidth={width}>
		{#if card.body.kind === "chart"}
			<ChartBody chart={card.body.chart} {pane} />
		{:else}
			<div class="none">{card.body.text}</div>
		{/if}
	</div>
</article>

<style>
	/* Home's card (HomeCard.svelte), full width. Not ".card": Obsidian styles that class. */
	.gcc-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		box-sizing: border-box;
		padding: 16px;
		border-radius: var(--radius-m, 8px);
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	header {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 12px;
		font-size: 14px;
		line-height: 18px;
	}
	.icon {
		display: inline-flex;
		flex: none;
		width: 20px;
		height: 20px;
	}
	.icon :global(svg) {
		width: 20px;
		height: 20px;
	}
	.title {
		flex: 1;
		min-width: 0;
		padding-top: 1px;
	}
	.period {
		flex: none;
		padding-top: 2px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	/* The In Focus top row, kept together: the figures follow the big one. */
	.headline {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		column-gap: 28px;
		row-gap: 8px;
		margin-bottom: 12px;
	}
	.big {
		font-size: 35px;
		line-height: 42px;
		font-variant-numeric: tabular-nums;
	}
	.body {
		min-width: 0;
	}
	/* The card names the chart: its page's own title goes. */
	.body :global(figcaption) {
		display: none;
	}
	.none {
		padding: 24px 0;
		text-align: center;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
</style>
