<svelte:options namespace="svg" />

<script lang="ts">
	import { CHART_COLOURS, CHART_FILLS, DIM_OPACITY, type ChartColour, type ChartFill } from "../../../../dashboard/activity-chart-pages";
	import type { ChartMarks, PlotRect } from "../../../../dashboard/activity-charts";

	/**
	 * A chart's own marks inside its SVG, placed by `activity-charts.ts`: the
	 * area, steps or blocks in the chart's fill, the dot charts' band colours,
	 * a line (an overlay's colour, or the Heart Rate Zones gradient), Stamina's
	 * Potential and the white lines, which the twin maps to text-normal.
	 */
	interface Props {
		marks: ChartMarks;
		plot: PlotRect;
		/** Unique per chart: its gradients' ids. */
		uid: string;
		fill?: ChartFill;
		/** An overlay's line colour. */
		colour?: ChartColour;
		/** The expanded chart's primary under an overlay: at half opacity. */
		dim?: boolean;
		/** An overlay's line is heavier than a card's. */
		overlay?: boolean;
	}

	let { marks, plot, uid, fill, colour, dim = false, overlay = false }: Props = $props();

	let fillId = $derived(`${uid}-fill`);
	let zonesId = $derived(`${uid}-zones`);
	/** Garmin's gradient; Performance Condition's grey is the theme's (text-faint, as the twin maps it). */
	let gradient = $derived(fill && fill !== "performance" ? CHART_FILLS[fill] : null);
	let paint = $derived(gradient ? `url(#${fillId})` : undefined);
</script>

<defs>
	{#if marks.fill && gradient}
		<linearGradient id={fillId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={marks.fill.y1} y2={marks.fill.y2}>
			<stop offset="0" stop-color={gradient[0]} />
			<stop offset="1" stop-color={gradient[1]} />
		</linearGradient>
	{/if}
	{#if marks.zones}
		<linearGradient id={zonesId} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={marks.zones.y1} y2={marks.zones.y2}>
			{#each marks.zones.stops as stop, i (i)}
				<stop offset={stop.offset} stop-color={CHART_COLOURS[stop.colour]} />
			{/each}
		</linearGradient>
	{/if}
</defs>

<g class="marks" class:overlay opacity={dim ? DIM_OPACITY : undefined}>
	{#if marks.area}
		<path class="area" class:faint={fill === "performance"} d={marks.area} fill={paint} />
	{/if}
	{#if marks.blocks}
		{#each marks.blocks as b, i (i)}
			<rect x={b.x} y={b.y} width={b.width} height={b.height} fill={paint} />
		{/each}
	{/if}
	{#if marks.potential}
		<path class="potential" d={marks.potential} />
	{/if}
	{#if marks.line}
		<path class="line" d={marks.line} stroke={marks.zones ? `url(#${zonesId})` : colour ? CHART_COLOURS[colour] : undefined} />
	{/if}
	{#if marks.scatter}
		{#each marks.scatter as s (s.colour)}
			<path class="scatter" d={s.d} stroke={CHART_COLOURS[s.colour]} stroke-width={2 * (marks.scatterR ?? 2)} />
		{/each}
	{/if}
	{#if marks.average}
		<line class="average" class:dashed={marks.average.dashed} x1={plot.left} x2={plot.right} y1={marks.average.y} y2={marks.average.y} />
	{/if}
	{#if marks.reference}
		<line class="reference" class:heavy={fill === "impact"} x1={plot.left} x2={plot.right} y1={marks.reference.y} y2={marks.reference.y} />
	{/if}
</g>

<style>
	.area.faint {
		fill: var(--text-faint);
	}
	.potential {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1.33;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.line {
		fill: none;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.overlay .line {
		stroke-width: 2;
	}
	.scatter {
		fill: none;
		stroke-linecap: round;
	}
	/* The twin's average: 0.5 pt text-normal at 75%, the dot charts' dashed 4.67 at 80%. */
	.average {
		stroke: var(--text-normal);
		stroke-width: 0.5;
		opacity: 0.75;
	}
	.average.dashed {
		stroke-dasharray: 4.67 4.67;
		opacity: 0.8;
	}
	/* Performance Condition's zero line; Impact Load Factor's 1.0 line is heavier (1.33 pt at 95%). */
	.reference {
		stroke: var(--text-normal);
		stroke-width: 0.5;
		opacity: 0.8;
	}
	.reference.heavy {
		stroke-width: 1.33;
		opacity: 0.95;
	}
</style>
