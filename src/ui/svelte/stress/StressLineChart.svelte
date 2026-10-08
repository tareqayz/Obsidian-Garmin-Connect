<script lang="ts">
	import { linePlot, type LinePlot } from "../../../dashboard/stress-charts";
	import type { StressPeriodView } from "../../../dashboard/stress-pages";
	import StatChart from "../health/StatChart.svelte";

	/**
	 * Daily Averages (7d, 4w) or Weekly Averages (1y): a day's or a week's
	 * level on 0 to 100, the line broken where one has none. Days carry a dot;
	 * a year is a bare line over its months.
	 */
	let { view, pane }: { view: StressPeriodView; pane: boolean } = $props();
</script>

<StatChart title={view.title} {pane} plot={(width) => linePlot(view, width, pane)}>
	{#snippet over(p: LinePlot)}
		{#if p.line}<path class="line" d={p.line} stroke-width={p.lineWidth} />{/if}
		{#each p.points as point}<circle class="point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
	{/snippet}
</StatChart>

<style>
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.point {
		fill: var(--text-normal);
	}
</style>
