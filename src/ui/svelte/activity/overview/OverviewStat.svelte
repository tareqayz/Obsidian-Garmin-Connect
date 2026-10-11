<script lang="ts">
	import type { OverviewFigure } from "../../../../dashboard/activity-overview";
	import ChartBadge from "../stats/ChartBadge.svelte";

	/**
	 * One of the four figures under the distance (the twin's Stat): a rule,
	 * the value with its unit, the chart badge when the figure has a chart (it
	 * opens the expanded chart), and its label.
	 */
	let { figure, onChart }: { figure: OverviewFigure; onChart?: (chart: string) => void } = $props();
</script>

<div class="gc-stat">
	<div class="line">
		<span class="value">{figure.value}</span>
		{#if figure.unit}<span class="unit">{figure.unit}</span>{/if}
		{#if figure.chart && onChart}
			{@const chart = figure.chart}
			<button class="badge" aria-label="{figure.label} chart" onclick={() => onChart(chart)}><ChartBadge /></button>
		{/if}
	</div>
	<div class="label">{figure.label}</div>
</div>

<style>
	.gc-stat {
		box-sizing: border-box;
		min-width: 0;
		height: 52px;
		padding-top: 4.5px;
		border-top: 1px solid var(--background-modifier-border);
	}
	.line {
		display: flex;
		align-items: baseline;
		gap: 4px;
		min-width: 0;
		white-space: nowrap;
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		font-variant-numeric: tabular-nums;
	}
	.unit {
		font-size: 15px;
		line-height: 19px;
	}
	/* The twin's badge: 16.67pt, 3pt past the gap after the unit. */
	.badge {
		display: inline-flex;
		flex: none;
		align-self: center;
		width: auto;
		height: auto;
		margin: 0 0 0 3px;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: none;
		color: var(--text-accent);
		cursor: pointer;
	}
	.badge:hover {
		color: var(--text-accent-hover);
	}
	.badge :global(svg) {
		width: 16.67px;
		height: 16.67px;
	}
	.label {
		margin-top: 2.5px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
