<script lang="ts">
	import { ftpPlot, type FtpRange } from "../../../dashboard/ftp-charts";
	import type { FtpChart, FtpUnit } from "../../../dashboard/ftp-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * A 4w / 12w / 1y line (twin 727:178 … 727:1112, panes 730:1988 /
	 * 730:2104): the gridlines, their labels each at its own value, the date
	 * axis, and the changes' dots joined straight. The box is 276 pt tall on
	 * 4w and 282 on 12w and 1y at any width; a period without a row keeps it
	 * and says so halfway down the gridlines (728:644). Geometry is
	 * `ftpPlot`'s.
	 */
	interface Props {
		chart: FtpChart | null;
		range: FtpRange;
		unit: FtpUnit;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { chart, range, unit, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(ftpPlot(chart, range, unit, width));
</script>

<div class="ftp-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- The chart's title says what the line shows. -->
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
	{:else if empty}
		<div class="ftp-empty" style:top="{p.middle - 10}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.ftp-chart {
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
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	/* The twin's Chart Dot (726:31): 8 pt discs in the text colour, joined by a 1 pt line. */
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--text-normal);
	}
	/* The web's line, Body, centred where the plot would be. */
	.ftp-empty {
		position: absolute;
		left: 0;
		right: 0;
		height: 20px;
	}
	.ftp-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
