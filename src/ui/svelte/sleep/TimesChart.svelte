<script lang="ts">
	import { timesPlot } from "../../../dashboard/sleep-charts";
	import type { SleepPeriodView } from "../../../dashboard/sleep-pages";
	import PeriodAxis from "./PeriodAxis.svelte";

	/**
	 * Bed to wake, a bar a night or week, with the average bedtime as a line
	 * and the average wake time dashed. The Sleep Alignment tab greens the
	 * nights that matched the internal rhythm.
	 */
	let { view, alignment = false }: { view: SleepPeriodView; alignment?: boolean } = $props();

	let width = $state(402);
	let plot = $derived(timesPlot(view, width));
</script>

<div class="times-chart" bind:clientWidth={width}>
	<svg {width} height={plot.height} aria-hidden="true">
		{#each plot.grid as g}
			<line class="grid" x1={plot.left} x2={plot.right} y1={g.y} y2={g.y} />
			{#if g.label}<text class="tick" x={plot.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>{/if}
		{/each}
		{#each plot.bars as bar}<path class="bar" class:aligned={alignment && bar.aligned} d={bar.d} />{/each}
		{#if plot.avgBed !== undefined}<line class="avg" x1={plot.left} x2={plot.right} y1={plot.avgBed} y2={plot.avgBed} />{/if}
		{#if plot.avgWake !== undefined}<line class="avg wake" x1={plot.left} x2={plot.right} y1={plot.avgWake} y2={plot.avgWake} />{/if}
		<PeriodAxis axis={plot.axis} />
	</svg>
</div>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
	}
	.tick {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.bar {
		fill: var(--color-blue);
	}
	.bar.aligned {
		fill: var(--color-green);
	}
	.avg {
		stroke: var(--text-normal);
		stroke-width: 2;
	}
	.avg.wake {
		stroke-dasharray: 5 4;
	}
</style>
