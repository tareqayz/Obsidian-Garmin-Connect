<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * A 7d, 4w or 1y page's body: the chart, the period's figures under it,
	 * then its list. A pane puts the chart in the wide column and the figures
	 * in the 370pt one, level with the chart's top gridline. The spaces are
	 * the twin's for Stress (above the chart 27.6pt, a pane's figures 82.8pt
	 * down) unless `--stat-chart-top` and `--stat-figures-top-pane` say
	 * otherwise.
	 */
	let { chart, figures, list }: { chart: Snippet; figures: Snippet; list?: Snippet } = $props();
</script>

<div class="stat-period">
	<div class="overview">
		<div class="chart">{@render chart()}</div>
		<div class="figures">{@render figures()}</div>
	</div>
	{@render list?.()}
</div>

<style>
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.chart {
		min-width: 0;
		margin-top: var(--stat-chart-top, 27.6px);
	}
	.figures {
		min-width: 0;
		padding: 0 16px;
	}

	@container (min-width: 1000px) {
		.overview {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--stat-title-indent: 0px;
			--stat-figure-gap: 16px;
		}
		.chart {
			margin-top: var(--stat-chart-top-pane, 32px);
		}
		.figures {
			margin-top: var(--stat-figures-top-pane, 82.8px);
			padding: 0;
		}
	}
</style>
