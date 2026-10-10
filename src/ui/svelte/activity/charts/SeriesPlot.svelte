<script lang="ts">
	import type { SeriesChart } from "../../../../dashboard/activity-chart-pages";
	import { NO_FIGURES_GAP, seriesPlot, type ChartLayout } from "../../../../dashboard/activity-charts";
	import { PHONE } from "../../../../dashboard/stat-charts";
	import ChartAxis from "./ChartAxis.svelte";
	import ChartKeys from "./ChartKeys.svelte";
	import ChartMarks from "./ChartMarks.svelte";

	/**
	 * A card's chart of samples at the width the card gives it: the box under
	 * the figures (or, with none, where they would end), drawn by `seriesPlot`.
	 */
	let { chart, layout }: { chart: SeriesChart; layout: ChartLayout } = $props();

	let measured = $state(0);
	let p = $derived(seriesPlot(chart, measured || PHONE, layout));
	const uid = $props.id();
</script>

<div class="series-plot" bind:clientWidth={measured} style:height="{p.height}px" style:margin-top={chart.figures.length ? null : `${NO_FIGURES_GAP}px`}>
	<svg width={p.width} height={p.height} aria-hidden="true">
		<ChartMarks marks={p} plot={p.plot} uid="ac-{uid}" fill={chart.fill} />
		<ChartAxis labelRight={p.labelRight} yLabels={p.yLabels} dots={p.dots} xLabels={p.xLabels} xTitle={p.xTitle} />
	</svg>
	{#if chart.legend && p.keyY !== undefined}
		<ChartKeys keys={chart.legend} y={p.keyY} />
	{/if}
</div>

<style>
	.series-plot {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
</style>
