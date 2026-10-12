<script lang="ts">
	import { cssPlot } from "../../../dashboard/critical-swim-speed-charts";
	import type { CssChart, CssRange } from "../../../dashboard/critical-swim-speed-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";

	/**
	 * A 7d / 12w / 1y chart (twin 800:53, 800:158, 800:291, the Inferred
	 * 800:467; pane 802:480): the five gridlines and their paces, the date
	 * axis, and the results' dots joined straight. The frame is drawn with or
	 * without a result, 254 pt tall at any width; a period without one says
	 * so in it, under the gridlines (on 7d the middle one crosses the words,
	 * as on the phone). Geometry is `cssPlot`'s.
	 */
	interface Props {
		chart: CssChart;
		range: CssRange;
		/** "No Critical Swim Speed data", for a period without a result. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { chart, range, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(cssPlot(chart, range, width));
</script>

<div class="css-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if empty}
		<p class="css-empty" style:top="{p.empty.top}px" style:left="{p.empty.left}px" style:width="{p.empty.right - p.empty.left}px">{empty}</p>
	{/if}
	<!-- The results table under the chart gives every pace it draws. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as line, i (i)}<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />{/each}
		{#each p.ticks as tick, i (i)}
			<text class="tick" x={p.labelRight} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
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
		{#if p.line}<path class="line" d={p.line} />{/if}
		{#each p.points as point, i (i)}<circle class="point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
	</svg>
</div>

<style>
	.css-chart {
		position: relative;
		min-width: 0;
	}
	/* Over the empty line: positioned, and later, so the gridlines cross it. */
	svg {
		position: relative;
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
	/* The twin's Chart Dot (799:18): 8 pt points in the text colour, joined by a 1 pt line. */
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--text-normal);
	}
	/* Label, 13/16, centred in its box. */
	.css-empty {
		position: absolute;
		height: 16px;
		margin: 0;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
