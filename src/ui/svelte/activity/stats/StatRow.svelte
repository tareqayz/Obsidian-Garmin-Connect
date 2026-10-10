<script lang="ts">
	import { CHART_TITLES } from "../../../../dashboard/activity-chart-pages";
	import type { StatsChartId, StatsRow } from "../../../../dashboard/activity-stats-pages";
	import ChartBadge from "./ChartBadge.svelte";

	/**
	 * One row of a Stats section, as the twin's Stat Row (Figma 403:40): the
	 * label on the left with its chart badge, the value from 255pt in. Primary
	 * Benefit takes two lines; Vigorous minutes carry the x2 disc.
	 */
	interface Props {
		row: StatsRow;
		/** The badge opens its metric's expanded chart. */
		onChart: (chart: StatsChartId) => void;
	}

	let { row, onChart }: Props = $props();
</script>

<div class="stat-row" class:two-line={row.sub !== undefined}>
	<div class="label">
		<span class="text">{row.label}</span>
		{#if row.chart}
			{@const chart = row.chart}
			<button class="badge" aria-label={`${CHART_TITLES[chart]} chart`} onclick={() => onChart(chart)}><ChartBadge /></button>
		{/if}
	</div>
	<div class="value">
		{#if row.sub !== undefined}
			<span>{row.value}</span>
			<span>{row.sub}</span>
		{:else}
			<span>{row.text}</span>
			{#if row.badge}<span class="x2">{row.badge}</span>{/if}
		{/if}
	</div>
</div>

<style>
	/* Measured off the twin: 36pt rows (58 for two lines), the label 15.55pt
	   in, the value 255.25pt in. On a phone narrower than the twin's 402 the
	   label gives way, never the value. */
	.stat-row {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		min-height: 36px;
		padding: 0 16px 0 15.55px;
		background: var(--background-primary);
		font-size: 15px;
		line-height: 20px;
	}
	.two-line {
		min-height: 58px;
	}
	.label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 0 1 239.7px;
		min-width: 0;
		color: var(--text-muted);
	}
	.text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		position: relative;
		display: flex;
		flex: none;
		width: 20px;
		height: 20px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		box-shadow: none;
		background: none;
		color: var(--text-accent);
		cursor: pointer;
	}
	/* A finger-sized target around the 20pt badge, without moving it. */
	.badge::before {
		content: "";
		position: absolute;
		inset: -8px;
	}
	.badge:hover {
		color: var(--text-accent-hover);
		background: var(--background-modifier-hover);
	}
	.badge:focus-visible {
		box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
	}
	.value {
		display: flex;
		align-items: center;
		flex: 1 0 auto;
		color: var(--text-normal);
		white-space: nowrap;
	}
	.two-line .value {
		flex-direction: column;
		align-items: flex-start;
		line-height: 22px;
	}
	/* The shared Badge x2 (Figma 139:461), as the Intensity Minutes page draws it. */
	.x2 {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		width: 20px;
		height: 20px;
		margin-left: 10px;
		border-radius: 50%;
		background: var(--text-normal);
		color: var(--background-primary);
		font-size: 11px;
		line-height: 13px;
		font-weight: 700;
	}
</style>
