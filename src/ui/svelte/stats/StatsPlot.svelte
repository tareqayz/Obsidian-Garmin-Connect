<script lang="ts">
	import { plotFor, plotHeight, type ChartSpec } from "../../../dashboard/stats-charts";

	/**
	 * A Steps, Floors or Intensity Minutes chart under its title. The geometry
	 * is the app's, measured (`stats-charts.ts`); the width is the pane's, so
	 * the plot stretches and the insets stay put.
	 */
	let { spec }: { spec: ChartSpec } = $props();

	let width = $state(402);
	let plot = $derived(plotFor(spec, width));
</script>

<figure class="stats-plot">
	<figcaption>{spec.title}</figcaption>
	<div class="canvas" bind:clientWidth={width} style:height="{plotHeight(spec.frame)}px">
		<!-- The numbers are in the stats beside it; the chart only shows their shape. -->
		<svg {width} height={plot.height} aria-hidden="true">
			{#each plot.grid as line}
				<line class="grid" class:strong={line.strong} x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} stroke-width={plot.gridWidth} />
			{/each}
			{#each plot.vlines as line}
				<line class="grid" x1={line.x} x2={line.x} y1={line.y1} y2={line.y2} stroke-width={plot.gridWidth} />
			{/each}
			{#each plot.yLabels as label}
				<text class="tick" x={label.x} y={label.y} text-anchor="end" dominant-baseline="central">{label.text}</text>
			{/each}
			{#each plot.bars as bar}<path class="bar tone-{bar.tone}" d={bar.d} />{/each}
			{#each plot.areas as area}<path class="area" d={area} />{/each}
			{#if plot.goal}
				<line class="goal-line" x1={plot.goal.x1} x2={plot.goal.x2} y1={plot.goal.y} y2={plot.goal.y} stroke-width={plot.goal.width} stroke-dasharray={plot.goal.dash} />
			{/if}
			{#each plot.lines as line}<path class="line {line.tone}" d={line.d} stroke-width={plot.lineWidth} />{/each}
			{#each plot.dots as dot}<circle class="dot" cx={dot.cx} cy={dot.cy} r={dot.r} />{/each}
			{#each plot.xLabels as label}
				{#if label.rotated}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
				{:else}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
				{/if}
			{/each}
			{#each plot.markers as marker}
				{#if marker.kind === "wake"}
					<!-- When the night ended: the app's clock on the dot row. -->
					<g class="wake" transform="translate({marker.cx} {marker.cy})">
						<circle r="8" />
						<circle class="face" r="4.5" />
						<path class="hands" d="M0 -2.4 V0 L1.8 1.2" />
					</g>
				{:else}
					<!-- Where the running total first reached the goal. -->
					<g class="reached" transform="translate({marker.cx} {marker.cy})">
						<circle r="7.85" />
						<path d="M-3.7 0.26 L-1.22 2.66 L3.66 -2.3" />
					</g>
				{/if}
			{/each}
		</svg>
	</div>
</figure>

<style>
	.stats-plot {
		margin: 0;
		min-width: 0;
	}
	/* The title's inset differs a little from page to page in the app; the page sets it. */
	figcaption {
		height: 44px;
		box-sizing: border-box;
		padding-left: var(--plot-indent, 11.3px);
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
	}
	.grid.strong {
		stroke: var(--text-faint);
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.bar.tone-blue {
		fill: var(--color-blue);
	}
	.bar.tone-green {
		fill: var(--color-green);
	}
	.bar.tone-goal {
		fill: var(--background-modifier-border);
	}
	.bar.tone-faded {
		fill: var(--color-blue);
		opacity: 0.4;
	}
	.area {
		fill: var(--text-normal);
		opacity: 0.08;
	}
	.goal-line {
		stroke: var(--text-normal);
	}
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-linejoin: round;
	}
	.line.faint {
		stroke: var(--text-faint);
	}
	.dot {
		fill: var(--text-faint);
	}
	.wake circle {
		fill: var(--color-blue);
	}
	.wake .face,
	.wake .hands {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-width: 1.1;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.reached circle {
		fill: var(--background-primary);
		stroke: var(--color-green);
		stroke-width: 1.3;
	}
	.reached path {
		fill: none;
		stroke: var(--color-green);
		stroke-width: 1.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
