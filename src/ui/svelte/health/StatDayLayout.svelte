<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * A 1d page's body: the day's summary (its figure, words and tiles), then
	 * its chart. A pane puts the chart in the wide column and the summary in
	 * the 370pt one beside it. The space above the chart is the phone's 21pt
	 * and a pane's 32pt unless `--stat-chart-top` and `--stat-chart-top-pane`
	 * say otherwise.
	 */
	let { summary, chart }: { summary: Snippet; chart: Snippet } = $props();
</script>

<div class="stat-day">
	<div class="summary">{@render summary()}</div>
	<div class="chart">{@render chart()}</div>
</div>

<style>
	.stat-day {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-areas: "summary" "chart";
	}
	.summary {
		grid-area: summary;
		min-width: 0;
	}
	.chart {
		grid-area: chart;
		min-width: 0;
		margin-top: var(--stat-chart-top, 21px);
	}

	@container (min-width: 1000px) {
		.stat-day {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "chart summary";
			column-gap: 8px;
			align-items: start;
			--stat-title-indent: 0px;
			--stat-figure-gap: 16px;
		}
		.chart {
			margin-top: var(--stat-chart-top-pane, 32px);
		}
	}
</style>
