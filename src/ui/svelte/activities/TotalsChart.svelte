<script lang="ts">
	import type { Chart } from "../../../dashboard/activities";
	import { CHART_HEIGHT, TITLE_HEIGHT, chartGeometry } from "../../../dashboard/totals-chart";

	/**
	 * "Distance Totals" and its bars. The geometry is the app's, measured; the
	 * width is the pane's, so the plot stretches and the insets stay put.
	 */
	let { title, chart }: { title: string; chart: Chart } = $props();

	let width = $state(402);
	let g = $derived(chartGeometry(chart, width));
	const plotHeight = CHART_HEIGHT - TITLE_HEIGHT;
</script>

<figure class="totals" bind:clientWidth={width}>
	<figcaption>{title}</figcaption>
	<!-- The numbers are in the stats beside it; the bars only show their shape. -->
	<svg {width} height={plotHeight} viewBox="0 {TITLE_HEIGHT} {width} {plotHeight}" aria-hidden="true">
		{#each g.gridlines as line, i}
			<line class="grid" class:zero={i === 0} x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
			<text class="tick" x={line.labelX} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
		{/each}
		{#each g.bars as bar}<path class="bar" d={bar.path} />{/each}
		{#each g.dots as dot}<circle class="dot" cx={dot.cx} cy={dot.cy} r={dot.r} />{/each}
		{#each g.labels as label}
			{#if label.rotated}
				<text class="axis" x={label.x} y={label.y} text-anchor="end" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
			{:else}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/if}
		{/each}
	</svg>
</figure>

<style>
	.totals {
		margin: 0;
		min-width: 0;
	}
	figcaption {
		height: 40px;
		box-sizing: border-box;
		padding: 15px 16px 0 16.5px;
		font-size: 18px;
		line-height: 22px;
		font-weight: 700;
		color: var(--text-normal);
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.grid.zero {
		stroke-width: 0.5;
	}
	.tick {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.axis {
		fill: var(--text-faint);
		font-size: 10px;
	}
	.bar {
		fill: var(--color-blue);
	}
	.dot {
		fill: var(--text-faint);
	}
</style>
