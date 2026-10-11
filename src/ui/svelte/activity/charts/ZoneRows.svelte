<script lang="ts">
	import { CHART_COLOURS, type ZonesChart } from "../../../../dashboard/activity-chart-pages";
	import { zoneBars } from "../../../../dashboard/activity-charts";
	import { PHONE } from "../../../../dashboard/stat-charts";

	/**
	 * Time in Heart Rate or Power Zones: the twin's Zone Row (403:72), Zone 5
	 * first, each with its range and name, a track filled to the floored share
	 * in the zone's colour, and the time and share on the right.
	 */
	let { chart }: { chart: ZonesChart } = $props();

	let measured = $state(0);
	let bars = $derived(zoneBars(chart, measured || PHONE));
</script>

<div class="zone-rows" bind:clientWidth={measured}>
	{#each chart.rows as row, i (row.zone)}
		{@const bar = bars[i]}
		<div class="zone-row">
			<div class="zone-head">
				<span class="zone">{row.title}</span>
				<span class="range">{[row.range, row.name].filter(Boolean).join(" • ")}</span>
			</div>
			{#if bar}
				<span class="track" style:left="{bar.track.x}px" style:width="{bar.track.width}px">
					{#if bar.fill}<span class="fill" style:width="{bar.fill.width}px" style:background-color={CHART_COLOURS[bar.colour]}></span>{/if}
				</span>
			{/if}
			<span class="time">{row.time}</span>
			<span class="percent">{row.percent}</span>
		</div>
	{/each}
</div>

<style>
	/* Rows 44 pt tall, 57.67 apart, the first 16.24 under the title; 30.62 under the last. */
	.zone-rows {
		display: flex;
		flex-direction: column;
		gap: 13.67px;
		padding: 16.24px 0 30.62px;
	}
	.zone-row {
		position: relative;
		height: 44px;
	}
	.zone-head {
		display: flex;
		align-items: baseline;
		gap: 6.2px;
		padding: 0.55px 16px 0 16.25px;
		white-space: nowrap;
		overflow: hidden;
	}
	.zone {
		font-size: 15px;
		line-height: 20px;
		color: var(--text-normal);
	}
	.range {
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.track {
		position: absolute;
		top: 29.97px;
		height: 8px;
		border-radius: 4px;
		background: var(--background-modifier-border);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: 4px;
	}
	.time,
	.percent {
		position: absolute;
		top: 25.2px;
		font-size: 13.5px;
		line-height: 17px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.time {
		right: 60.65px;
		width: 70px;
		color: var(--text-normal);
	}
	.percent {
		right: 16.33px;
		width: 44px;
		color: var(--text-muted);
	}
</style>
