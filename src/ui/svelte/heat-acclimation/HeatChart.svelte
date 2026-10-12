<script lang="ts">
	import { LINE_WIDTH, heatPlot } from "../../../dashboard/heat-acclimation-charts";
	import type { HeatChart } from "../../../dashboard/heat-acclimation-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * Daily Progress's box (twin 630:34 / 630:146, panes 631:591 / 631:679):
	 * the fixed 0–100 % gridlines and their labels, a dot a day, the dots
	 * joined in order by a 2 pt line (across a day without a row), and the day
	 * axis with "MM-DD" under its ends. 211 pt tall at any width; a period
	 * without a row keeps the box and says so where the plot would be.
	 * Geometry is `heatPlot`'s.
	 */
	interface Props {
		chart: HeatChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { chart, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(heatPlot(chart, width));
</script>

<div class="ha-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- The page has no copy for the chart; the % a day is its only content, as on the phone. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="ha-grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="ha-tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each p.dots as dot, i (i)}<circle class="ha-axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label, i (i)}
				<text class="ha-tick" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/each}
			{#if p.line}<path class="ha-line" d={p.line} stroke-width={LINE_WIDTH} />{/if}
			{#each p.points as point, i (i)}<circle class="ha-point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
		</svg>
	{:else if empty}
		<div class="ha-chart-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.ha-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	/* Y Axis 629:33: 1 pt --background-modifier-border lines, Axis (10/12) --text-muted labels. */
	.ha-grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.ha-tick {
		fill: var(--text-muted);
		font-size: 10px;
	}
	/* X Axis 629:44: --text-faint dots. */
	.ha-axis-dot {
		fill: var(--text-faint);
	}
	/* The series: Chart Dot 629:31 (Ø 8) and the line joining them, --text-normal. */
	.ha-line {
		fill: none;
		stroke: var(--text-normal);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ha-point {
		fill: var(--text-normal);
	}
	/* The no-data line in Body, as the 1d page's (Inferred). */
	.ha-chart-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.ha-chart-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
