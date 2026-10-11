<script lang="ts">
	import { CHART_COLOURS, type RunWalkChart } from "../../../../dashboard/activity-chart-pages";
	import { runWalkPlot, type ChartLayout } from "../../../../dashboard/activity-charts";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import ChartAxis from "./ChartAxis.svelte";
	import ChartKeys from "./ChartKeys.svelte";

	/**
	 * Run/Walk: three lanes, Idle, Walk and Run, with a bar for each segment
	 * rising from the plot's bottom to its lane, on the timer or the distance.
	 */
	let { chart, layout }: { chart: RunWalkChart; layout: ChartLayout } = $props();

	let measured = $state(0);
	let p = $derived(runWalkPlot(chart, measured || PHONE, layout));
</script>

<div class="run-walk" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.lanes as lane (lane.label)}
			<line class="lane" x1={p.plot.left} x2={p.plot.right} y1={lane.y} y2={lane.y} />
			<text class="lane-label" x={p.labelRight} y={lane.y} text-anchor="end" dominant-baseline="central">{lane.label}</text>
		{/each}
		{#each p.bars as bar, i (i)}
			<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={CHART_COLOURS[bar.colour]} />
		{/each}
		<ChartAxis labelRight={p.labelRight} yLabels={[]} dots={p.dots} xLabels={p.xLabels} xTitle={p.xTitle} />
	</svg>
	<ChartKeys keys={chart.legend} y={p.keyY} />
</div>

<style>
	.run-walk {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.lane {
		stroke: var(--background-modifier-border);
		stroke-width: 0.67;
	}
	.lane-label {
		fill: var(--text-muted);
		font-size: 10px;
	}
</style>
