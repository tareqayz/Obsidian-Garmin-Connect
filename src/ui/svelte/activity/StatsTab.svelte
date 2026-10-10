<script lang="ts">
	import { chartSub } from "../../../dashboard/activity-chart-pages";
	import { columnStarts, statsView, type StatsChartId } from "../../../dashboard/activity-stats-pages";
	import StatsSection from "./stats/StatsSection.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * Stats: Garmin's sections in the phone's order, each only with data
	 * (`statsView`). One list on a phone; from 640pt the sections are cards in
	 * two columns, from 1000pt three, filled in reading order. The columns
	 * break where `columnStarts` balances them, as the twin's pane does.
	 */
	let { detail, route, units, swap }: ActivityTabProps = $props();

	let sections = $derived(statsView(detail, units));
	let starts2 = $derived(new Set(columnStarts(sections, 2)));
	let starts3 = $derived(new Set(columnStarts(sections, 3)));

	/** A badge opens its chart in place of the page. */
	function openChart(base: StatsChartId) {
		swap({ ...route, sub: chartSub({ base, overlay: null, swapped: false }) });
	}
</script>

<div class="stats-tab">
	{#each sections as section, i (section.id)}
		<div class="slot" class:start2={starts2.has(i)} class:start3={starts3.has(i)}>
			<StatsSection {section} onChart={openChart} />
		</div>
	{/each}
</div>

<style>
	.stats-tab {
		padding-bottom: 16px;
	}
	.slot {
		break-inside: avoid;
	}

	/* Two columns between 640 and 1000pt (Inferred: the twin draws only the
	   phone and the 1190pt pane), three in the pane: 370pt cards 8pt apart,
	   16pt between cards, 24pt under the tabs. */
	@container (min-width: 640px) {
		.stats-tab {
			column-count: 2;
			column-gap: 8px;
			padding: 24px 32px 32px;
		}
		.slot {
			margin-bottom: 16px;
		}
		.slot:last-child {
			margin-bottom: 0;
		}
		.start2 {
			break-before: column;
		}
	}

	@container (min-width: 1000px) {
		.stats-tab {
			column-count: 3;
			max-width: 1126px;
			box-sizing: content-box;
			margin: 0 auto;
		}
		.start2 {
			break-before: auto;
		}
		.start3 {
			break-before: column;
		}
	}
</style>
