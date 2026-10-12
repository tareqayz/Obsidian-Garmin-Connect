<script lang="ts">
	import { LINE_WIDTH, ltPlot } from "../../../dashboard/running-lactate-threshold-charts";
	import type { LtChart, LtRange } from "../../../dashboard/running-lactate-threshold-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";
	import { LT_COLOR } from "./colors";

	/**
	 * A 4w / 12w / 1y chart (twin 755:154 … 755:1928, panes 758:1092 /
	 * 758:1230): five gridlines, heart rate's labels on the left and the
	 * chip's on the right (pace's fastest on top), the x axis under them,
	 * then each series — heart rate first — as a 1.67 pt line with its shape
	 * on every point. The box runs from the title's foot to the legend on a
	 * phone, to the axis' foot in a pane; a period where neither series has a
	 * point keeps it and says so halfway down (755:2418). Geometry is
	 * `ltPlot`'s.
	 */
	interface Props {
		range: LtRange;
		chart: LtChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { range, chart, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(ltPlot(chart, range, width, pane));
</script>

<div class="lt-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- Current names these values; the legend under the chart names the series. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line, i (i)}<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />{/each}
			{#each p.leftLabels.ticks as tick, i (i)}
				<text class="tick" x={p.leftLabels.x} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
			{/each}
			{#each p.rightLabels.ticks as tick, i (i)}
				<text class="tick" x={p.rightLabels.x} y={tick.y} text-anchor="start" dominant-baseline="central">{tick.text}</text>
			{/each}
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label, i (i)}
				<text
					class="axis"
					x={label.x}
					y={label.y}
					text-anchor="middle"
					dominant-baseline="central"
					transform={label.rotated ? `rotate(-90 ${label.x} ${label.y})` : undefined}>{label.text}</text
				>
			{/each}
			{#each p.series as series (series.id)}
				{#if series.line}<path class="line" d={series.line} stroke={LT_COLOR[series.id]} stroke-width={LINE_WIDTH} />{/if}
				{#each series.markers as marker, i (i)}<path d={marker.d} fill={LT_COLOR[series.id]} />{/each}
			{/each}
		</svg>
	{:else if empty}
		<div class="lt-empty" style:top="{p.middle - 10}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.lt-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	/* Caption, 11/14. */
	.tick {
		fill: var(--text-muted);
		font-size: 11px;
	}
	/* Axis, 10/12. */
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	/* The twin's line vectors (755:737): straight segments, no fill. */
	.line {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* The web's line in Body, centred where the plot would be (755:2418: a 370 × 20 box at x 16). */
	.lt-empty {
		position: absolute;
		left: 0;
		right: 0;
		height: 20px;
	}
	.lt-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
