<script lang="ts">
	import type { RunningEconomyView } from "../../../dashboard/running-economy-pages";
	import EconomyChart from "./EconomyChart.svelte";
	import EconomyLegend from "./EconomyLegend.svelte";
	import EconomyStats from "./EconomyStats.svelte";

	/**
	 * A 4w, 12w or 1y body (twin 752:3318 / 752:3488 / 752:3620; Inferred
	 * 752:3768, and 752:3925 for a period without a reading; panes 757:614 /
	 * 757:700): the chart's title, the chart, its legend and Avg / Best. A
	 * period without a reading keeps the chart's box for the web's line and
	 * leaves the title, the legend and the figures out.
	 */
	let { view, pane }: { view: RunningEconomyView; pane: boolean } = $props();
</script>

<div class="re-period">
	<p class="re-title">{view.title ?? ""}</p>
	<div class="re-plot"><EconomyChart chart={view.chart} empty={view.empty} {pane} /></div>
	{#if view.chart}
		<div class="re-key">
			<div class="re-legend"><EconomyLegend items={view.chart.legend} dots={view.chart.dots} /></div>
			<div class="re-figures"><EconomyStats figures={view.figures} /></div>
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone (752:3318): the title, Title S at x 16, 23.19 under the
	 * header's foot (165); the chart's 236 pt box 33.81 under it (y 244); the
	 * legend's row 3.25 under the box, centred; Avg / Best 25.08 under the
	 * legend (y 522.33).
	 */
	.re-period {
		padding-bottom: 24px;
	}
	.re-title {
		height: 22px;
		margin: 23.19px 0 33.81px;
		padding-left: 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 700;
		white-space: nowrap;
	}
	.re-plot {
		min-width: 0;
	}
	.re-key {
		display: flex;
		flex-direction: column;
	}
	.re-legend {
		margin-top: 3.25px;
	}
	.re-figures {
		margin-top: 25.08px;
	}

	/*
	 * The pane (757:614): the title at x 48 and the chart's box in the 748 pt
	 * column as on the phone; Avg / Best in the 370 pt one, their rules level
	 * with the top gridline (18.83 into the box), the legend 25.08 under
	 * them, left-aligned at x 788.
	 */
	@container (min-width: 1000px) {
		.re-period {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas:
				"title ."
				"plot key";
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.re-title {
			grid-area: title;
		}
		.re-plot {
			grid-area: plot;
		}
		.re-key {
			grid-area: key;
		}
		.re-figures {
			order: -1;
			margin-top: 18.83px;
		}
		.re-legend {
			margin-top: 25.08px;
		}
	}
</style>
