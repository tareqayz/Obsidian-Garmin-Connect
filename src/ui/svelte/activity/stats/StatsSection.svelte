<script lang="ts">
	import type { StatsChartId, StatsSection } from "../../../../dashboard/activity-stats-pages";
	import StatRow from "./StatRow.svelte";

	/**
	 * A Stats section: the twin's Section Header (Figma 403:49) over its rows.
	 * On a phone the sections run edge to edge, the header bands parting them;
	 * from 640pt each is a bordered card. The HELP link is left out until its
	 * sheet's copy is captured, as in the twin.
	 */
	interface Props {
		section: StatsSection;
		onChart: (chart: StatsChartId) => void;
	}

	let { section, onChart }: Props = $props();
</script>

<section class="stats-section">
	<div class="inner">
		<h3 class="heading">{section.title}</h3>
		{#each section.rows as row (row.label)}
			<StatRow {row} {onChart} />
		{/each}
	</div>
</section>

<style>
	.heading {
		box-sizing: border-box;
		height: 41.67px;
		margin: 0;
		padding: 20.61px 16.35px 0;
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		font-weight: 400;
		text-transform: uppercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* The pane's cards (Figma 414:2918): the border is drawn over the content,
	   which sits a point up and left of the card's edge, as Figma's inside
	   stroke does. */
	@container (min-width: 640px) {
		.stats-section {
			position: relative;
			overflow: hidden;
			padding-bottom: 1px;
			border-radius: 8px;
		}
		.stats-section::after {
			content: "";
			position: absolute;
			inset: 0;
			border: 1px solid var(--background-modifier-border);
			border-radius: inherit;
			pointer-events: none;
		}
		.inner {
			width: 100%;
			margin: -1px 0 0 -1px;
		}
	}
</style>
