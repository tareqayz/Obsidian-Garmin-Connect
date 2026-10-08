<script lang="ts">
	import { trendPlot, type TrendPlot } from "../../../dashboard/fitness-age-charts";
	import type { FitnessTrendView } from "../../../dashboard/fitness-age-pages";
	import StatChart from "../health/StatChart.svelte";

	/** The trend chart: a line through the rows (dots on 7d / 4w) and the legend under it. */
	let { view, pane }: { view: FitnessTrendView; pane: boolean } = $props();
</script>

<StatChart title={view.title} {pane} plot={(width): TrendPlot => trendPlot(view, width)}>
	{#snippet over(p)}
		{#if p.line}<path class="fa-line" d={p.line} />{/if}
		{#each p.points as pt (pt.x)}<circle class="fa-point" cx={pt.x} cy={pt.y} r={p.pointRadius} />{/each}
	{/snippet}
	{#snippet footer()}
		<div class="fa-legend"><span class="swatch"></span>Fitness Age</div>
	{/snippet}
</StatChart>

<style>
	.fa-line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
	}
	.fa-point {
		fill: var(--text-normal);
	}
	.fa-legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 0;
		font-size: 13px;
		color: var(--text-muted);
	}
	.swatch {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: var(--text-normal);
	}
</style>
