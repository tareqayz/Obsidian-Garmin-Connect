<script lang="ts">
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { vo2Plot } from "../../../dashboard/vo2-max-charts";
	import type { Vo2Chart } from "../../../dashboard/vo2-max-pages";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * A 4w / 12w / 6m line (twin 472:131 / 472:316 / 472:472, panes 473:889 /
	 * 473:1024 / 473:1131): the gridlines and their labels, the readings'
	 * dots joined straight, the date axis under them. The box is 304 pt tall
	 * at any width; a period without a reading keeps it and says so where the
	 * plot would be. Geometry is `vo2Plot`'s.
	 */
	interface Props {
		chart: Vo2Chart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { chart, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(vo2Plot(chart, width));
</script>

<div class="vo2-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- The copy under the chart says what the line shows. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label (label.text)}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/each}
			{#if p.line}<path class="line" d={p.line} />{/if}
			{#each p.points as point, i (i)}<circle class="point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
		</svg>
	{:else if empty}
		<div class="vo2-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.vo2-chart {
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
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--text-normal);
	}
	/* The twin sets the no-data line in Body, a size up from the empty state's default. */
	.vo2-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.vo2-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
