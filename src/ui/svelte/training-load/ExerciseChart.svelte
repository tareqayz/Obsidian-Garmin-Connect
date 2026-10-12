<script lang="ts">
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { exercisePlot } from "../../../dashboard/training-load-charts";
	import type { ExerciseTabView } from "../../../dashboard/training-load-pages";
	import StatStackedBars from "../health/StatStackedBars.svelte";

	/**
	 * Daily Totals (twin 604:43; pane 609:1515): no gridlines, the y labels
	 * at their values, a bar a day with load stacked by benefit group with
	 * only its top rounded, and a dot a day under them with MM-DD under the
	 * ends. The box is 150 pt tall at any width; a period without load keeps
	 * its 0 … 75 axis and no bars (Inferred). Geometry is `exercisePlot`'s.
	 */
	let { chart, pane }: { chart: ExerciseTabView["chart"]; pane: boolean } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(exercisePlot(chart, width));
</script>

<div class="exercise-chart" bind:clientWidth={measured} style:height="{p.height}px">
	<!-- The list under the chart gives each activity's load. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.ticks as tick, i (i)}
			<text class="tick" x={tick.x} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
		{/each}
		<StatStackedBars bars={p.bars} />
		{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label, i (i)}
			<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
		{/each}
	</svg>
</div>

<style>
	.exercise-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
</style>
