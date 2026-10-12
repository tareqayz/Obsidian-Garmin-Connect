<script lang="ts">
	import { CHART_RHYTHM } from "../../../dashboard/heat-acclimation-charts";
	import type { HeatPeriodView } from "../../../dashboard/heat-acclimation-pages";
	import StatLegend from "../health/StatLegend.svelte";
	import HeatChart from "./HeatChart.svelte";

	/**
	 * 7d and 4w (twin 630:34, 630:146, 4w − 1 630:439; panes 631:591,
	 * 631:679): "Daily Progress", its chart, and the key — a --text-normal
	 * dot and "Heat Acclimation" — centred under it on a phone, beside it in a
	 * pane with its top level with the top gridline's. Nothing else: no
	 * figures, no list.
	 */
	let { view, pane }: { view: HeatPeriodView; pane: boolean } = $props();

	const C = CHART_RHYTHM;
</script>

<div
	class="ha-period"
	style:--ha-title-top="{C.titleTop}px"
	style:--ha-title-top-pane="{C.titleTopPane}px"
	style:--ha-title="{C.title}px"
	style:--ha-box-gap="{C.boxGap}px"
	style:--ha-legend-gap="{C.legendGap}px"
	style:--ha-legend-top-pane="{C.legendTopPane}px"
>
	<div class="ha-main">
		<div class="ha-title">{view.title}</div>
		<div class="ha-box"><HeatChart chart={view.chart} empty={view.empty} {pane} /></div>
	</div>
	{#if view.chart}
		<div class="ha-side">
			<div class="ha-legend"><StatLegend items={[{ label: view.chart.legend, shape: "circle", color: "var(--text-normal)" }]} /></div>
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone (630:34), under the header's foot (165): the title in List
	 * Item 9.86 down (174.86) at x 16, the chart's box 47.14 under its foot
	 * (244), and the key 10.67 under the box (465.67), centred, its label in
	 * Caption (11/14) --text-muted 5.67 after the Ø 16 dot.
	 */
	.ha-period {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 24px;
	}
	.ha-main,
	.ha-side {
		min-width: 0;
	}
	.ha-title {
		margin-top: var(--ha-title-top);
		padding-left: 16px;
		font-size: 17px;
		line-height: var(--ha-title);
		font-weight: 400;
		color: var(--text-normal);
	}
	.ha-box {
		margin-top: var(--ha-box-gap);
	}
	.ha-legend {
		margin-top: var(--ha-legend-gap);
	}
	.ha-legend :global(.item) {
		font-size: 11px;
		line-height: 14px;
	}

	/* From 640 pt the title starts at the shell's 32 pt margin, as in the pane. */
	@container (min-width: 640px) {
		.ha-period {
			padding-bottom: 0;
		}
		.ha-title {
			padding-left: 0;
		}
	}

	/*
	 * The panes (631:591, 631:679), under the rule: the title 33 down in the
	 * 748 pt column (149), the box 47.14 under it (218.14); the key starts the
	 * 370 pt column, left-aligned, its top level with the top gridline's
	 * (237.14). The pane ends 32 under the box.
	 */
	@container (min-width: 1000px) {
		.ha-period {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.ha-title {
			margin-top: var(--ha-title-top-pane);
		}
		.ha-legend {
			margin-top: var(--ha-legend-top-pane);
		}
		.ha-legend :global(.stat-legend) {
			justify-content: flex-start;
		}
	}
</style>
