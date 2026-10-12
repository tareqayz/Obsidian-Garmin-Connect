<script lang="ts">
	import { BAR_COLOUR, TE_CHART, trainingEffectPlot } from "../../../dashboard/training-effect-charts";
	import type { TeChart } from "../../../dashboard/training-effect-pages";
	import { PHONE } from "../../../dashboard/stat-charts";

	/**
	 * One of the two charts (twin Chart 683:217; pane 686:1147): the title
	 * centred over a fixed 0–5 plot without gridlines, the y labels at their
	 * values, a green bar a day with a value, round-topped, and a dot a day
	 * under the slots with MM-DD under the ends. 190 pt tall at any width; a
	 * pane gives it half the column. Geometry is `trainingEffectPlot`'s.
	 */
	let { chart, pane }: { chart: TeChart; pane: boolean } = $props();

	/** A pane's half: (1126 − 8) / 2. */
	const PANE_HALF = 559;

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_HALF : PHONE));
	let p = $derived(trainingEffectPlot(chart, width));
</script>

<figure class="te-chart" bind:clientWidth={measured} style:height="{TE_CHART.height}px">
	<figcaption style:top="{p.title.y}px">{chart.title}</figcaption>
	<!-- The cards under the charts give every value. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.ticks as tick (tick.text)}
			<text class="tick" x={tick.x} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
		{/each}
		{#each p.bars as bar (bar.date)}<path d={bar.d} fill={BAR_COLOUR} />{/each}
		{#each p.dots as dot, i (i)}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label, i (i)}
			<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
		{/each}
	</svg>
</figure>

<style>
	.te-chart {
		position: relative;
		min-width: 0;
		margin: 0;
	}
	figcaption {
		position: absolute;
		left: 0;
		right: 0;
		font-size: 13px;
		line-height: 16px;
		text-align: center;
		color: var(--text-muted);
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
	.dot {
		fill: var(--text-faint);
	}
</style>
