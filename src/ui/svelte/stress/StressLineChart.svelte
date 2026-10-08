<script lang="ts">
	import { linePlot } from "../../../dashboard/stress-charts";
	import type { StressPeriodView } from "../../../dashboard/stress-pages";

	/**
	 * Daily Averages (7d, 4w) or Weekly Averages (1y) under its title: a day's
	 * or a week's level on 0 to 100, the line broken where one has none. Days
	 * carry a dot; a year is a bare line over its months.
	 */
	let { view, pane }: { view: StressPeriodView; pane: boolean } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? 748 : 402));
	let plot = $derived(linePlot(view, width, pane));
</script>

<figure class="stress-line">
	<figcaption>{view.title}</figcaption>
	<div class="canvas" bind:clientWidth={measured} style:height="{plot.height}px">
		<!-- The average is beside the chart; the chart shows the period's shape. -->
		<svg width={plot.width} height={plot.height} aria-hidden="true">
			{#each plot.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={plot.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each plot.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each plot.labels as label}
				{#if label.rotated}
					<text class="axis" x={label.x} y={label.y} text-anchor="start" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
				{:else}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
				{/if}
			{/each}
			{#if plot.line}<path class="line" d={plot.line} stroke-width={plot.lineWidth} />{/if}
			{#each plot.points as point}<circle class="point" cx={point.x} cy={point.y} r={plot.pointRadius} />{/each}
		</svg>
	</div>
</figure>

<style>
	.stress-line {
		margin: 0;
		min-width: 0;
	}
	figcaption {
		height: 22px;
		padding-left: var(--stress-title-indent, 9.6px);
		font-size: 18px;
		line-height: 22px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.canvas {
		position: relative;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 0.5;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
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
