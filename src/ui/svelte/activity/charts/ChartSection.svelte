<script lang="ts">
	import type { ChartCard } from "../../../../dashboard/activity-chart-pages";
	import type { ChartLayout } from "../../../../dashboard/activity-charts";
	import { lucide } from "../../home/lucide";
	import ChartFigures from "./ChartFigures.svelte";
	import RunWalkPlot from "./RunWalkPlot.svelte";
	import SeriesPlot from "./SeriesPlot.svelte";
	import TrainingEffectScales from "./TrainingEffectScales.svelte";
	import ZoneRows from "./ZoneRows.svelte";

	/**
	 * One chart of the Charts tab: on the phone a section under a 14 pt band
	 * (the twin's `section · …`), in a pane a bordered card of the grid. The
	 * title opens the picker when the chart has one; the "?" icons are left
	 * out until their sheets' copy is captured, as in the twin.
	 */
	interface Props {
		card: ChartCard;
		layout: ChartLayout;
		/** Opens the picker's menu, for a card that has one. */
		onPick: (e: MouseEvent) => void;
	}

	let { card, layout, onPick }: Props = $props();
</script>

<section class="chart-section" class:zones={card.kind === "zones"}>
	<div class="head">
		{#if card.picker}
			<button class="title picker" onclick={onPick}>
				<span class="name">{card.title}</span>
				<span class="chevron" use:lucide={"chevron-down"}></span>
			</button>
		{:else}
			<div class="title"><span class="name">{card.title}</span></div>
		{/if}
	</div>
	{#if card.figures.length}
		<ChartFigures figures={card.figures} />
	{/if}
	{#if card.kind === "series"}
		<SeriesPlot chart={card} {layout} />
	{:else if card.kind === "run-walk"}
		<RunWalkPlot chart={card} {layout} />
	{:else if card.kind === "training-effect"}
		<TrainingEffectScales chart={card} />
	{:else}
		<ZoneRows chart={card} />
	{/if}
</section>

<style>
	.chart-section {
		min-width: 0;
		background: var(--background-primary);
		border-top: 14px solid var(--background-secondary);
	}
	/* The title's box: 15.43 pt under the band (23.16 for the zone tables), 16.4 pt in. */
	.head {
		display: flex;
		align-items: center;
		height: 22px;
		margin: 15.43px 16px 0 16.4px;
	}
	.zones .head {
		margin-top: 23.16px;
	}
	.title {
		display: inline-flex;
		align-items: center;
		gap: 8.17px;
		min-width: 0;
		font-size: 18px;
		line-height: 22px;
		font-weight: 600;
		color: var(--text-normal);
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.picker {
		margin: 0;
		height: auto;
		padding: 0;
		border: none;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 18px;
		line-height: 22px;
		font-weight: 600;
		color: var(--text-normal);
		cursor: pointer;
	}
	.chevron {
		display: inline-flex;
		flex: none;
		color: var(--text-muted);
	}
	.chevron :global(svg) {
		width: 18px;
		height: 18px;
	}

	/* A pane: the twin's bordered cards (415:3321), 5 pt more room above the title. */
	@container (min-width: 640px) {
		.chart-section {
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			overflow: hidden;
		}
		.head {
			margin: 20.43px 15px 0 15.4px;
		}
		.zones .head {
			margin-top: 28.16px;
		}
	}
</style>
