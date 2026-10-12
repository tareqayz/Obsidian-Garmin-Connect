<script lang="ts">
	import type { ActivityRoute } from "../../../dashboard/routes";
	import { GROUP_COLOR, LOAD_LAYOUT } from "../../../dashboard/training-load-charts";
	import type { ExerciseTabView } from "../../../dashboard/training-load-pages";
	import StatLegend from "../health/StatLegend.svelte";
	import ActivityList from "./ActivityList.svelte";
	import ExerciseChart from "./ExerciseChart.svelte";

	/**
	 * The Exercise Load tab (twin 604:37, 604:405; pane 609:1511): "Daily
	 * Totals" over the chart, the four benefit groups' legend in two rows,
	 * then the period's activities. A pane puts the chart in the 748 pt
	 * column, the legend left-aligned in the 370 pt one level with its top
	 * label, and the list three cards a row under both. The rhythm is
	 * `LOAD_LAYOUT.exercise`.
	 */
	let { view, pane, open }: { view: ExerciseTabView; pane: boolean; open: (route: ActivityRoute) => void } = $props();

	const L = LOAD_LAYOUT.exercise;

	/* The legend in the phone's two rows: Anaerobic and High Aerobic, then Low Aerobic and Unknown. */
	let rows = $derived([view.legend.slice(0, 2), view.legend.slice(2)].map((items) => items.map((item) => ({ label: item.label, shape: "circle" as const, color: GROUP_COLOR[item.group] }))));
</script>

<div
	class="el"
	style:--el-heading="{L.heading}px"
	style:--el-chart="{L.chart}px"
	style:--el-legend="{L.legend}px"
	style:--el-legend-row="{L.legendRow}px"
	style:--el-list="{L.list}px"
	style:--el-bottom="{L.bottom}px"
	style:--el-pane-top="{L.paneTop}px"
	style:--el-pane-legend="{L.paneLegend}px"
	style:--el-pane-list="{L.paneList}px"
>
	<div class="main">
		<h3 class="heading">{view.title}</h3>
		<div class="chart"><ExerciseChart chart={view.chart} {pane} /></div>
	</div>
	<div class="side">
		{#each rows as items, i (i)}
			<div class="legend-row"><StatLegend {items} /></div>
		{/each}
	</div>
	{#if view.list.length}
		<div class="list"><ActivityList rows={view.list} {open} /></div>
	{/if}
</div>

<style>
	/* The phone (604:37): the heading 6.53 under the header, the chart 25.14 under it, the legend's rows 10.33 and 5.34 under that, the list 5.66 under them and 34 over the end. */
	.el {
		padding-bottom: var(--el-bottom);
	}
	.heading {
		margin: var(--el-heading) 0 0;
		padding-left: 9.83px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.chart {
		margin-top: var(--el-chart);
	}
	.legend-row {
		margin-top: var(--el-legend-row);
	}
	.legend-row:first-child {
		margin-top: var(--el-legend);
	}
	.list {
		margin-top: var(--el-list);
	}

	@container (min-width: 640px) {
		.el {
			padding-bottom: 0;
		}
	}

	/*
	 * The pane (609:1511): the heading 31 under the header and the chart in
	 * the 748 pt column, the legend's rows in the 370 pt one from 86.94
	 * down, left-aligned; the list 30 under the chart across both.
	 */
	@container (min-width: 1000px) {
		.el {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side" "list list";
			column-gap: 8px;
			align-items: start;
		}
		.main {
			grid-area: main;
			min-width: 0;
		}
		.heading {
			margin-top: var(--el-pane-top);
		}
		.side {
			grid-area: side;
			min-width: 0;
		}
		.legend-row:first-child {
			margin-top: var(--el-pane-legend);
		}
		.side :global(.stat-legend) {
			justify-content: flex-start;
		}
		.list {
			grid-area: list;
			margin-top: var(--el-pane-list);
		}
	}
</style>
