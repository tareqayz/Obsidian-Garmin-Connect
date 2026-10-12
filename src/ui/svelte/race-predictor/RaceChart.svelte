<script lang="ts">
	import { racePlot } from "../../../dashboard/race-predictor-charts";
	import type { RaceChart, RacePeriodView } from "../../../dashboard/race-predictor-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { RACE_COLOR } from "../health/performance-colors";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * A 4w / 6m / 1y pace chart (twin 535:124 / 535:354 / 535:609, panes
	 * 537:1353 / 537:1498 / 537:1655): four gridlines labelled m:ss, the
	 * fastest on top; a 2 pt line a distance in its colour; its shape on the
	 * ends (4w) or every point (6m, 1y), drawn over every line; the date axis
	 * under them. The box runs from the title's foot to the legend on a
	 * phone, to the axis labels in a pane; a period without a prediction
	 * keeps it and says so where the plot would be. Geometry is `racePlot`'s.
	 */
	interface Props {
		range: RacePeriodView["range"];
		chart: RaceChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { range, chart, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(racePlot(range, chart, width, pane));
</script>

<div class="race-chart" bind:clientWidth={measured} style:height="{p.height}px">
	{#if chart}
		<!-- Current's times are the newest of these lines; the legend names them. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line, i (i)}
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
			{#each p.lines as series (series.id)}
				{#if series.line}<path class="line" d={series.line} stroke={RACE_COLOR[series.id]} />{/if}
			{/each}
			{#each p.lines as series (series.id)}
				{#each series.markers as marker, i (i)}<path d={marker.d} fill={RACE_COLOR[series.id]} />{/each}
			{/each}
		</svg>
	{:else if empty}
		<div class="race-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.race-chart {
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
	/* The twin's lines (535:132–135): 2 pt, round ends and joins. */
	.line {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.race-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	/* The no-data line in Body, as VO₂ Max's and Hill Score's twins set it. */
	.race-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
