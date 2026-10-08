<script lang="ts">
	import { readingsPlot, type ReadingsPlot } from "../../../dashboard/heart-rate-charts";
	import type { HeartRatePeriodView } from "../../../dashboard/heart-rate-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/** Daily Readings (7d, 4w): High and Resting lines with a dot a day; Weekly Averages (1y): the dots alone. */
	let { view, pane }: { view: HeartRatePeriodView; pane: boolean } = $props();

	const LEGEND: LegendEntry[] = [
		{ kind: "dot", label: "Resting", color: "var(--heart-rate-resting-legend)" },
		{ kind: "dot", label: "High", color: "var(--heart-rate-high)" },
	];
</script>

<StatChart title={view.title} {pane} plot={(width) => readingsPlot(view, width, pane)}>
	{#snippet over(p: ReadingsPlot)}
		{#if p.high}<path class="line high" d={p.high} />{/if}
		{#if p.resting}<path class="line resting" d={p.resting} />{/if}
		{#each p.points as point}<circle class={point.series} cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
	{/snippet}
	{#snippet footer()}
		<div class="legend"><SleepLegend items={LEGEND} /></div>
	{/snippet}
</StatChart>

<style>
	.line {
		fill: none;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	.line.high {
		stroke: var(--heart-rate-high);
	}
	.line.resting {
		stroke: var(--heart-rate-resting);
	}
	circle.high {
		fill: var(--heart-rate-high);
	}
	circle.resting {
		fill: var(--heart-rate-resting);
	}
	.legend {
		height: 32.5px;
		font-size: 10px;
	}
</style>
