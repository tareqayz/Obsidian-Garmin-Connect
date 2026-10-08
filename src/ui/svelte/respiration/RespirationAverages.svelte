<script lang="ts">
	import { averagesPlot, POINT_R, type AveragesPlot } from "../../../dashboard/respiration-charts";
	import type { RespirationPeriodView } from "../../../dashboard/respiration-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/** Daily Averages (7d, 4w): the Sleep and Awake lines with a dot a day, broken at a missing value. */
	let { view, pane }: { view: RespirationPeriodView; pane: boolean } = $props();

	const LEGEND: LegendEntry[] = [
		{ kind: "line", label: "Sleep Avg", color: "var(--respiration-sleep)" },
		{ kind: "line", label: "Awake Avg", color: "var(--respiration-awake)" },
	];
</script>

<StatChart title={view.title} {pane} plot={(width) => averagesPlot(view, width, pane)}>
	{#snippet over(p: AveragesPlot)}
		{#if p.sleep}<path class="line sleep" d={p.sleep} />{/if}
		{#if p.awake}<path class="line awake" d={p.awake} />{/if}
		{#each p.points as point}<circle class={point.series} cx={point.x} cy={point.y} r={POINT_R} />{/each}
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
	.line.sleep {
		stroke: var(--respiration-sleep);
	}
	.line.awake {
		stroke: var(--respiration-awake);
	}
	circle.sleep {
		fill: var(--respiration-sleep);
	}
	circle.awake {
		fill: var(--respiration-awake);
	}
	.legend {
		height: 32.5px;
		font-size: 12px;
	}
</style>
