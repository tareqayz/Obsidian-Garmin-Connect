<script lang="ts">
	import type { StressPeriodView } from "../../../dashboard/stress-pages";
	import StressCard from "./StressCard.svelte";
	import StressLineChart from "./StressLineChart.svelte";
	import StressTiles from "./StressTiles.svelte";

	/**
	 * A week, four weeks or a year: the line, the period's average, and a card
	 * a day, newest first, or a card a week with data. A pane puts the chart
	 * and the average side by side and lays the cards three across.
	 */
	interface Props {
		view: StressPeriodView;
		pane: boolean;
		openDay: (date: string) => void;
		openWeek: (weekEnd: string) => void;
	}

	let { view, pane, openDay, openWeek }: Props = $props();

	/* The phone shows the average alone; the web's Lowest and Highest stay in the view model. */
	let stats = $derived(view.stats.slice(0, 1));
</script>

<div class="period-body">
	<div class="overview">
		<div class="chart"><StressLineChart {view} {pane} /></div>
		<div class="stat"><StressTiles {stats} /></div>
	</div>
	{#if view.days.length || view.weeks.length}
		<div class="list">
			{#each view.days as day (day.date)}
				<StressCard title={day.weekday} detail={day.detail} value={day.value} ring={day.ring} onclick={() => openDay(day.date)} />
			{/each}
			{#each view.weeks as week (week.from)}
				<StressCard title={week.title} value={week.value} onclick={() => openWeek(week.to)} />
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Measured off the twin's 7d and 1y frames (272:279, 274:1184), from the bottom of the header. */
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
	}
	.chart {
		min-width: 0;
		margin-top: 27.6px;
	}
	.stat {
		min-width: 0;
		padding: 0 16px;
	}
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: 17.1px;
		padding: 0 16px 16px;
	}

	@container (min-width: 640px) {
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0 0 16px;
		}
	}

	/* The twin's panes (279:3298, 279:3455, 279:41765): the chart in the wide
	   column, the average in the 370pt one level with its top gridline, and
	   the cards three across. */
	@container (min-width: 1000px) {
		.overview {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--stress-title-indent: 0px;
			--stress-tile-gap: 16px;
		}
		.chart {
			margin-top: 32px;
		}
		.stat {
			margin-top: 82.8px;
			padding: 0;
		}
		.list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 30px;
			padding: 0 0 32px;
		}
	}
</style>
