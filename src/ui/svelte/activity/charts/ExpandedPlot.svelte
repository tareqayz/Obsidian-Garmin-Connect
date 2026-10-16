<script lang="ts">
	import { CHART_COLOURS, DIM_OPACITY, type ExpandedChartView } from "../../../../dashboard/activity-chart-pages";
	import { TE_FRAME, type ExpandedPlot } from "../../../../dashboard/activity-charts";
	import ChartAxis from "./ChartAxis.svelte";
	import ChartKeys from "./ChartKeys.svelte";
	import ChartMarks from "./ChartMarks.svelte";

	/**
	 * The expanded chart's SVG (the twin's 411:1340 and 416:86199): the primary
	 * on the left axis, dimmed under an overlay, the overlay on its own axis
	 * with labels in its colour on the right, and the x axis under both.
	 * Run/Walk (and a ride's Position as the base) draws its lanes and Training
	 * Effect its scales across the plot. A ride's overlays may bring lanes along
	 * the plot's bottom (Position) and a key under the axis title (the ride's
	 * twin 956:1067, 956:1172).
	 */
	let { view, plot }: { view: ExpandedChartView; plot: ExpandedPlot } = $props();

	const uid = $props.id();
	let primary = $derived(view.primary);
	let overlayColour = $derived(view.secondary ? CHART_COLOURS[view.secondary.colour] : undefined);
</script>

<div class="expanded-box" style:height="{plot.height}px">
<svg class="expanded-plot" width={plot.width} height={plot.height} aria-hidden="true">
	{#if primary.kind === "series"}
		<ChartMarks marks={plot.primary} plot={plot.plot} uid="ex-{uid}-1" fill={primary.fill} dim={plot.dim} />
	{/if}
	{#if plot.lanes && plot.bars}
		<g opacity={plot.dim ? DIM_OPACITY : undefined}>
			{#each plot.lanes as lane (lane.label)}
				<line class="lane" x1={plot.plot.left} x2={plot.plot.right} y1={lane.y} y2={lane.y} />
			{/each}
			{#each plot.bars as bar, i (i)}
				<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={CHART_COLOURS[bar.colour]} />
			{/each}
		</g>
	{/if}
	{#if plot.scales}
		{#each plot.scales as scale (scale.label)}
			<text class="scale-label" x={plot.plot.left} y={scale.y - 20}>{scale.label}</text>
			{#each scale.segments as segment, i (i)}
				<rect x={segment.x} y={scale.y - TE_FRAME.height / 2} width={segment.width} height={TE_FRAME.height} rx={i === 0 || i === scale.segments.length - 1 ? 4 : 0} fill={CHART_COLOURS[segment.colour]} />
			{/each}
			<circle class="halo" cx={scale.knob.x} cy={scale.y + 1} r={TE_FRAME.haloR} />
			<circle cx={scale.knob.x} cy={scale.y + 1} r={TE_FRAME.knobR} fill={CHART_COLOURS[scale.knob.colour]} />
		{/each}
	{/if}
	{#if plot.secondary && view.secondary}
		<ChartMarks marks={plot.secondary} plot={plot.plot} uid="ex-{uid}-2" colour={view.secondary.colour} overlay />
	{/if}
	{#if plot.overlayBars}
		{#each plot.overlayBars as bar, i (i)}
			<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={CHART_COLOURS[bar.colour]} />
		{/each}
	{/if}
	<ChartAxis labelRight={plot.leftLabelRight} yLabels={plot.leftLabels} dots={plot.dots} xLabels={plot.xLabels} xTitle={plot.xTitle} />
	{#each plot.rightLabels as label, i (i)}
		<text class="right-label" x={plot.rightLabelLeft} y={label.y} dominant-baseline="central" fill={overlayColour}>{label.text}</text>
	{/each}
</svg>
{#if plot.keys && plot.keyY !== undefined && plot.keyLeft !== undefined && plot.keyRight !== undefined}
	<!-- The overlay's key, centred on the plot. -->
	<div class="key-row" style:left="{plot.keyLeft}px" style:width="{plot.keyRight - plot.keyLeft}px">
		<ChartKeys keys={plot.keys} y={plot.keyY} />
	</div>
{/if}
</div>

<style>
	.expanded-box {
		position: relative;
	}
	.expanded-plot {
		display: block;
		overflow: visible;
	}
	.key-row {
		position: absolute;
		top: 0;
		height: 0;
	}
	.lane {
		stroke: var(--background-modifier-border);
		stroke-width: 0.67;
	}
	.right-label {
		font-size: 10px;
	}
	.scale-label {
		fill: var(--text-normal);
		font-size: 18px;
	}
	.halo {
		fill: var(--background-primary);
	}
</style>
