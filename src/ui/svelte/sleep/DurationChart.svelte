<script lang="ts">
	import { durationPlot } from "../../../dashboard/sleep-charts";
	import type { SleepPeriodView } from "../../../dashboard/sleep-pages";
	import PeriodAxis from "./PeriodAxis.svelte";

	/** Sleep against need, a bar a night or week: green where the need was met. */
	let { view }: { view: SleepPeriodView } = $props();

	let width = $state(402);
	let plot = $derived(durationPlot(view, width));
</script>

<div class="duration-chart" bind:clientWidth={width}>
	<svg {width} height={plot.height} aria-hidden="true">
		{#each plot.grid as g}
			<line class="grid" x1={plot.left} x2={plot.right} y1={g.y} y2={g.y} />
			<text class="tick" x={plot.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
		{/each}
		{#each plot.bars as bar}<path class="bar {bar.kind}" d={bar.d} />{/each}
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
	.bar.met {
		fill: var(--color-green);
	}
	.bar.need {
		fill: var(--background-modifier-border);
	}
	.bar.duration {
		fill: var(--color-blue);
	}
</style>
