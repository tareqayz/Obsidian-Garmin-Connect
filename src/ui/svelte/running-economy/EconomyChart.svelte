<script lang="ts" module>
	/* Each chart's clip paths need ids no other chart on the page has. */
	let charts = 0;
</script>

<script lang="ts">
	import { economyPlot } from "../../../dashboard/running-economy-charts";
	import type { EconomyChart } from "../../../dashboard/running-economy-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";
	import { toneColor } from "../home/tones";

	/**
	 * A 4w / 12w / 1y chart (twin 752:3318 / 752:3488 / 752:3620, panes
	 * 757:614 / 757:700): the gridlines and their labels, the date axis, and
	 * the readings in their classes' colours — 4w and 12w Ø 8 dots on a 2 pt
	 * line, 1y the line alone. The line is drawn once a class it passes
	 * through, clipped to that class's band, so its colour changes on a level
	 * boundary (the twin's Trained copy below 214.5). The box is 236 pt tall
	 * at any width; a period without a reading keeps it and centres the web's
	 * line where the middle gridline would be. Geometry is `economyPlot`'s.
	 */
	interface Props {
		chart: EconomyChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { chart, empty, pane }: Props = $props();

	const id = `re-chart-${++charts}`;
	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(economyPlot(chart, width));
	let clipped = $derived(p.bands.length > 1);
</script>

<div class="re-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- The legend and the figures under the chart say what it shows. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#if clipped}
				<defs>
					{#each p.bands as band, i (i)}
						<clipPath id="{id}-{i}"><rect x={-p.width} y={band.y0} width={3 * p.width} height={band.y1 - band.y0} /></clipPath>
					{/each}
				</defs>
			{/if}
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
			{#if p.line}
				{#each p.bands as band, i (i)}
					<path class="line" d={p.line} stroke={toneColor(band.tone)} clip-path={clipped ? `url(#${id}-${i})` : undefined} />
				{/each}
			{/if}
			{#if p.pointDots}
				{#each p.points as point, i (i)}<circle cx={point.x} cy={point.y} r={p.pointRadius} fill={toneColor(point.tone)} />{/each}
			{/if}
		</svg>
	{:else if empty}
		<div class="re-empty" style:top="{p.middle - 10}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.re-chart {
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
	/* The twin's Chart Dot (751:9759): a 2 pt line, round at its ends and joins, in each class's colour. */
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	/* The web's line, Body, centred where the plot would be (752:3925). */
	.re-empty {
		position: absolute;
		left: 0;
		right: 0;
		height: 20px;
	}
	.re-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
