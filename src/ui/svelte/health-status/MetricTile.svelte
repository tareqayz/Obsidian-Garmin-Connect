<script lang="ts">
	import { miniRing } from "../../../dashboard/health-status-charts";
	import type { MetricView } from "../../../dashboard/health-status-pages";
	import Ring from "./Ring.svelte";

	/** A metric's row on the day page: title, subtitle, value and the mini ring. A scored metric opens its sheet. */
	let { metric, onopen }: { metric: MetricView; onopen?: () => void } = $props();
	let ring = $derived(metric.pct !== undefined ? miniRing(metric.pct, metric.status) : null);
</script>

{#if onopen && ring}
	<button class="hs-tile" onclick={onopen}>
		<span class="text"><span class="title">{metric.title}</span><span class="subtitle">{metric.subtitle}</span></span>
		<span class="value">{metric.value}</span>
		<Ring {ring} out={metric.group === "out"} />
	</button>
{:else}
	<div class="hs-tile">
		<span class="text"><span class="title">{metric.title}</span><span class="subtitle">{metric.subtitle}</span></span>
		<span class="value">{metric.value}</span>
		{#if ring}<Ring {ring} out={metric.group === "out"} />{/if}
	</div>
{/if}

<style>
	.hs-tile {
		display: flex;
		align-items: center;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		height: 74px;
		margin: 0;
		padding: 0 16px 0 14px;
		border: none;
		border-radius: 12px;
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
	}
	button.hs-tile {
		cursor: pointer;
	}
	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.title {
		font-size: 16px;
		font-weight: 600;
	}
	.subtitle {
		font-size: 13px;
		color: var(--text-muted);
	}
	.value {
		font-size: 18px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
