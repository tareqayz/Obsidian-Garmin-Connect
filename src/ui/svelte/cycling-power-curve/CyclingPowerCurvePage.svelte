<script lang="ts">
	import { cyclingPowerCurveView } from "../../../dashboard/cycling-power-curve-pages";
	import StatLegend from "../health/StatLegend.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatTable from "../health/StatTable.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import PowerChart from "./PowerChart.svelte";

	/**
	 * Garmin Connect's Cycling Power Curve page (Performance Stats). Twin:
	 * Figma page 430:6118 — phones 780:131509 (4w, empty), 780:131658 (3m,
	 * empty) and 780:131806 (1y); Inferred 780:131957 (4w with rides),
	 * 780:132107 (4w −1), 780:132258 (1y −1) and 780:132411 (a 5-hour
	 * record); panes 783:1986 (1y) and 783:2325 (4w, empty); dark 781:1026.
	 *
	 * Under the compact 4w · 3m · 1y control and the period: the chart's
	 * title and, for a period without a ride, its empty line; the curve; its
	 * legend; the records table, all 15 durations from the Record, whose
	 * dates open nothing (rides have no page yet); and the explainer. A pane
	 * keeps the title, the chart and the table in the 748 pt column and puts
	 * the legend and the explainer in the 370 pt one, the legend level with
	 * the top gridline.
	 *
	 * Everything comes from the activity index, so the page works offline and
	 * fetches nothing on view.
	 */
	let { route, today, onBack, swap, activities }: PerformanceStatPageProps = $props();

	let view = $derived(cyclingPowerCurveView(route, activities.rows, { today, complete: activities.complete }));
	/* The legend's markers: the period's line colour, and the Record's line colour. */
	let legend = $derived([
		{ label: view.legend.period, shape: "circle" as const, color: "var(--color-blue)" },
		{ label: view.legend.record, shape: "circle" as const, color: "var(--text-faint)" },
	]);
	let rows = $derived(view.table.rows.map((row) => ({ key: String(row.seconds), cells: [row.peak, row.watts, row.date] })));
</script>

<StatPageShell {route} {today} label={view.label} canGoBack={view.canGoBack} canGoForward={view.canGoForward} {onBack} {swap}>
	{#snippet children({ pane })}
		<div class="pc-page">
			<div class="pc-heading">
				<p class="pc-title">{view.title}</p>
				{#if view.empty}<p class="pc-empty">{view.empty}</p>{/if}
			</div>
			<div class="pc-plot"><PowerChart {view} {pane} /></div>
			<div class="pc-legend"><StatLegend items={legend} /></div>
			<div class="pc-records"><StatTable kind="records" title={view.table.title} header={view.table.headers} {rows} /></div>
			<div class="pc-explainer">
				{#each view.explainer as paragraph, i (i)}<p>{paragraph}</p>{/each}
			</div>
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (780:131806), under the header's foot at 165: the title (List
	 * Item 17/22, x 16.5) at 191.86 and the empty line (Label 13/16, centred
	 * between x 16 and 386) 27.88 under it; the chart's 244 pt box at 240; the
	 * legend's 16 pt row 3.67 under the box (487.67), centred; the table 16
	 * under the legend (519.67); the explainer (Paragraph 16/22, x 16, 370
	 * wide) its first line 22.16 under the table and 45.31 over the page's end.
	 */
	.pc-heading {
		position: relative;
		height: 48.14px;
		margin-top: 26.86px;
	}
	.pc-heading p {
		margin: 0;
	}
	.pc-title {
		padding-left: 16.5px;
		font-size: 17px;
		line-height: 22px;
		color: var(--text-normal);
		white-space: nowrap;
	}
	.pc-empty {
		position: absolute;
		top: 27.88px;
		left: 16px;
		right: 16px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		text-align: center;
	}
	.pc-plot {
		min-width: 0;
	}
	/* The legend's words are Caption 11/14, where the shared legend's are 12/16. */
	.pc-legend {
		margin-top: 3.67px;
	}
	.pc-legend :global(.stat-legend .item) {
		font-size: 11px;
		line-height: 14px;
	}
	/* Its rows have no `onclick`, so StatTable mutes the dates: a date opens nothing. */
	.pc-records {
		margin-top: 16px;
	}
	.pc-explainer {
		padding: 22.16px 16px 45.31px;
		font-size: 16px;
		line-height: 22px;
		color: var(--text-muted);
	}
	.pc-explainer p {
		margin: 0;
	}
	.pc-explainer p + p {
		margin-top: 22px;
	}

	/*
	 * The pane (783:1986), under the header's foot at 116: the title at 149
	 * (x 48.5, as the table's); the chart's box at (32, 197.14) and the table
	 * 16 under it (457.14), both 748 wide; in the 370 pt column at x 788 the
	 * legend, left-aligned with its top on the top gridline (204.81), and the
	 * explainer's first line 22.16 under the legend (242.97). The legend's
	 * row is fixed, so the chart's height goes to the row the explainer
	 * starts in.
	 */
	@container (min-width: 1000px) {
		.pc-page {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-rows: auto 23.67px auto auto;
			grid-template-areas:
				"heading ."
				"plot legend"
				"plot explainer"
				"records explainer";
			column-gap: 8px;
			align-items: start;
		}
		.pc-heading {
			grid-area: heading;
			margin-top: 33px;
		}
		.pc-plot {
			grid-area: plot;
		}
		.pc-legend {
			grid-area: legend;
			margin-top: 7.67px;
		}
		.pc-legend :global(.stat-legend) {
			justify-content: flex-start;
		}
		.pc-records {
			grid-area: records;
		}
		.pc-explainer {
			grid-area: explainer;
			padding: 22.16px 0 0;
		}
	}
</style>
