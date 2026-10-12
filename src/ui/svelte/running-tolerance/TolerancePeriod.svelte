<script lang="ts">
	import { PERIOD_LAYOUT, paneLegendTop } from "../../../dashboard/running-tolerance-charts";
	import { DISTANCE_CHIP, TOLERANCE_CHIPS, type TolerancePeriodView } from "../../../dashboard/running-tolerance-pages";
	import StatChips from "../health/StatChips.svelte";
	import ToleranceChart from "./ToleranceChart.svelte";
	import ToleranceLegend from "./ToleranceLegend.svelte";
	import ToleranceWeeks from "./ToleranceWeeks.svelte";

	/**
	 * 12w and 1y (twin 695:103, 695:643, 695:897, 697:483; panes 701:1890,
	 * 702:2111): "Weekly Totals", the chart, its legend and the Actual
	 * Distance chip, then a block a week, newest first. A span without a row
	 * keeps the chart's empty slots, the legend and the chip, without blocks
	 * (697:1580). A pane puts the title and the chart in the 748 pt column,
	 * the legend and the chip beside them, and the weeks three a row under
	 * both.
	 */
	interface Props {
		view: TolerancePeriodView;
		pane: boolean;
		/** The chip tapped: on or off. */
		onchip: (on: boolean) => void;
	}

	let { view, pane, onchip }: Props = $props();

	const L = PERIOD_LAYOUT;
	/* A phone's box grows by the legend's second row when there is none; a pane's keeps its two-row box. */
	let rows = $derived(pane ? 2 : view.legend.length);
</script>

<div
	class="rt-period"
	style:--rt-title-top="{L.titleTop}px"
	style:--rt-title-top-pane="{L.titleTopPane}px"
	style:--rt-chart-gap="{L.chartGap}px"
	style:--rt-legend-gap="{L.legendGap}px"
	style:--rt-legend-top-pane="{L.titleTopPane + 22 + L.chartGap + paneLegendTop(view.range)}px"
	style:--rt-chip-gap="{L.chipGap}px"
	style:--rt-chip-gap-pane="{L.chipGapPane}px"
	style:--rt-blocks-gap="{L.blocksGap}px"
	style:--rt-blocks-gap-pane="{L.blocksGapPane}px"
	style:--rt-bottom="{L.bottom}px"
>
	<div class="rt-main">
		<div class="rt-title">Weekly Totals</div>
		<div class="rt-chart"><ToleranceChart {view} {rows} {pane} /></div>
	</div>
	<div class="rt-side">
		<div class="rt-legend"><ToleranceLegend rows={view.legend} align={pane ? "start" : "center"} /></div>
		<div class="rt-chips">
			<StatChips chips={TOLERANCE_CHIPS} selected={view.chip ? [DISTANCE_CHIP] : []} onchange={(selected) => onchip(selected.includes(DISTANCE_CHIP))} />
		</div>
	</div>
	{#if view.weeks.length}
		<div class="rt-weeks"><ToleranceWeeks weeks={view.weeks} /></div>
	{/if}
</div>

<style>
	/*
	 * The phone (695:103), from the header's foot (165): "Weekly Totals" (Value
	 * M 17/22) 17.49 under it at x 16; the chart's box 19.51 under the title;
	 * the legend 5.33 under the box; the chip 15.66 under the legend; the
	 * weeks 16 under the chip, edge to edge; 34 under the last.
	 */
	.rt-period {
		padding-bottom: var(--rt-bottom);
	}
	.rt-title {
		margin-top: var(--rt-title-top);
		padding-left: 16px;
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
	}
	.rt-chart {
		margin-top: var(--rt-chart-gap);
	}
	.rt-legend {
		margin-top: var(--rt-legend-gap);
	}
	.rt-chips {
		margin-top: var(--rt-chip-gap);
	}
	.rt-weeks {
		margin-top: var(--rt-blocks-gap);
	}

	/* From 640 pt the shell pads the body's foot. */
	@container (min-width: 640px) {
		.rt-period {
			padding-bottom: 0;
		}
	}

	/*
	 * The panes (701:1890, 702:2111), from the header's rule (116): the title
	 * 32 under it, the chart as on the phone in the 748 pt column; beside them
	 * the legend from the 370 pt column's edge, its first row 2.99 over the
	 * top gridline, the chip 16 under it; the weeks 30 under the chart.
	 */
	@container (min-width: 1000px) {
		.rt-period {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side" "weeks weeks";
			column-gap: 8px;
			align-items: start;
		}
		.rt-main {
			grid-area: main;
			min-width: 0;
		}
		.rt-side {
			grid-area: side;
			min-width: 0;
		}
		.rt-weeks {
			grid-area: weeks;
			margin-top: var(--rt-blocks-gap-pane);
		}
		.rt-title {
			margin-top: var(--rt-title-top-pane);
		}
		.rt-legend {
			margin-top: var(--rt-legend-top-pane);
		}
		.rt-chips {
			margin-top: var(--rt-chip-gap-pane);
		}
	}
</style>
