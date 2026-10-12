<script lang="ts">
	import type { EconomyLegendItem } from "../../../dashboard/running-economy-pages";
	import { toneColor } from "../home/tones";

	/**
	 * The chart's key (twin Legend Item 751:9774): each plotted class, worse
	 * first — a 16 × 2 line in its colour, with a Ø 8 dot where the chart has
	 * dots (4w, 12w), 8 pt before its name in Caption. Items 16 apart; the
	 * row centred under the phone's chart, left-aligned in a pane's column.
	 */
	let { items, dots }: { items: readonly EconomyLegendItem[]; dots: boolean } = $props();
</script>

<div class="re-legend-row">
	{#each items as item (item.name)}
		<span class="re-legend-item">
			<svg width="16" height="8" aria-hidden="true">
				<line x1="0" x2="16" y1="4" y2="4" stroke={toneColor(item.tone)} stroke-width="2" />
				{#if dots}<circle cx="8" cy="4" r="4" fill={toneColor(item.tone)} />{/if}
			</svg>
			{item.name}
		</span>
	{/each}
</div>

<style>
	.re-legend-row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 16px;
	}
	.re-legend-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	svg {
		display: block;
		flex: none;
	}

	@container (min-width: 1000px) {
		.re-legend-row {
			justify-content: flex-start;
		}
	}
</style>
