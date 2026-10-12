<script lang="ts">
	import { hrvStressPlot } from "../../../dashboard/hrv-stress-charts";
	import type { HrvStressView } from "../../../dashboard/hrv-stress-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { LEVEL_COLOR } from "./colors";

	/**
	 * The chart (twin 805:9 / 805:67 empty, the Inferred 805:164; pane
	 * 806:134691): on the empty page only "No data available" over the day
	 * axis; with tests (Inferred) the 0–100 gridlines and their labels, a bar
	 * a day in its level's colour, and the axis on the labelled plot. The box
	 * is 193.14 pt tall at any width; geometry is `hrvStressPlot`'s.
	 */
	let { view, pane }: { view: HrvStressView; pane: boolean } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(hrvStressPlot(view, width));
</script>

<div class="hrv-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if p.empty && view.empty}
		<p class="hrv-empty" style:top="{p.empty.top}px" style:left="{p.empty.left}px" style:width="{p.empty.right - p.empty.left}px">{view.empty}</p>
	{/if}
	<!-- The legend under the chart names the colours; the scores are the bars' heights on the labelled axis. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as line, i (i)}<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />{/each}
		{#each p.ticks as tick, i (i)}
			<text class="tick" x={p.labelRight} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
		{/each}
		{#each p.bars as bar (bar.date)}<path d={bar.path} fill={LEVEL_COLOR[bar.level]} />{/each}
		{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label, i (i)}
			<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
		{/each}
	</svg>
</div>

<style>
	.hrv-chart {
		position: relative;
		min-width: 0;
	}
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
	/* Axis, 10/12: Garmin's end labels are a darker grey than its other axis labels; the twin keeps them all muted. */
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	/* Label, 13/16, centred in its box. */
	.hrv-empty {
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
