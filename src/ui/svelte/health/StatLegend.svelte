<script lang="ts">
	import ShapeMarker, { type Shape } from "./ShapeMarker.svelte";

	/**
	 * A chart's key (twin Legend Item 443:453): each series' marker and name,
	 * centred under the chart (Race Predictor, Running Lactate Threshold).
	 */
	let { items }: { items: ReadonlyArray<{ label: string; shape: Shape; color: string }> } = $props();
</script>

<div class="stat-legend">
	{#each items as item (item.label)}
		<span class="item"><ShapeMarker shape={item.shape} color={item.color} />{item.label}</span>
	{/each}
</div>

<style>
	.stat-legend {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 16px;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 5.67px;
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
	}
</style>
