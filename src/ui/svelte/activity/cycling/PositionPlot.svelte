<script lang="ts">
	import { CHART_COLOURS } from "../../../../dashboard/activity-chart-pages";
	import { positionPlot } from "../../../../dashboard/cycling-activity-charts";
	import type { PositionData } from "../../../../dashboard/cycling-metrics";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import ChartAxis from "../charts/ChartAxis.svelte";
	import type { CardPlotProps } from "../charts/kinds";

	/**
	 * Position (the twin's Chart · Position 948:8035): Standing on the plot's top
	 * line and Seated halfway, each stretch of riding a bar from the baseline to
	 * its lane's line, Standing over Seated, on the clock to the summary's
	 * duration; gridlines at the lanes, a quarter down and the baseline.
	 */
	let { card, layout }: CardPlotProps = $props();

	let measured = $state(0);
	let p = $derived(positionPlot(card.data as PositionData, measured || PHONE, layout));
</script>

<div class="gc-position" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as y, i (i)}
			<line class="grid" x1={p.plot.left} x2={p.plot.right} y1={y} y2={y} />
		{/each}
		{#each p.bars as bar, i (i)}
			<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} style:fill={CHART_COLOURS[bar.colour]} />
		{/each}
		{#each p.lanes as lane (lane.label)}
			<text class="lane" x={p.labelRight} y={lane.y} text-anchor="end" dominant-baseline="central">{lane.label}</text>
		{/each}
		<ChartAxis labelRight={p.labelRight} yLabels={[]} dots={p.dots} xLabels={p.xLabels} xTitle={p.xTitle} />
	</svg>
</div>

<style>
	.gc-position {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 0.67;
	}
	.lane {
		fill: var(--text-muted);
		font-size: 10px;
	}
</style>
