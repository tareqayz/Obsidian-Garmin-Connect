<script lang="ts">
	import { hillPlot } from "../../../dashboard/hill-score-charts";
	import type { HillChart, HillPeriodView } from "../../../dashboard/hill-score-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * A 4w, 12w, 1y or month chart (twin 505:403 / 505:662 / 505:861 /
	 * 505:1016, panes 508:96997 / 508:97627 / 508:98164 / 508:97298): the
	 * fixed 0–100 gridlines and their labels, the scores joined by a 2 pt
	 * blue line, a dot on each but 1y's months, and the axis under them. The
	 * box is 273.33 pt tall at any width, from the header's foot to the Avg /
	 * Max row; a period without a score keeps it and says so where the plot
	 * would be. Geometry is `hillPlot`'s.
	 */
	interface Props {
		range: HillPeriodView["range"];
		chart: HillChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { range, chart, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(hillPlot(range, chart, width));
</script>

<div class="hill-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- The figures and the list under the chart say what it shows. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
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
			{#if p.pointDots}
				{#each p.points as point, i (i)}<circle class="point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
			{/if}
		</svg>
	{:else if empty}
		<div class="hill-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.hill-chart {
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
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	/* The twin's Chart Dot (503:64): Garmin's light blue as the theme's blue, the line 2 pt with round ends and joins. */
	.line {
		fill: none;
		stroke: var(--color-blue);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--color-blue);
	}
	.hill-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.hill-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
