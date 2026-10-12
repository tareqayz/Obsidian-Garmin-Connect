<script lang="ts">
	import type { Route } from "../../../dashboard/routes";
	import { TE_LAYOUT } from "../../../dashboard/training-effect-charts";
	import type { TrainingEffectPeriodView } from "../../../dashboard/training-effect-pages";
	import TeChart from "./TeChart.svelte";

	/**
	 * 7d or 4w (twin 684:33, 684:118544, 684:119826; panes 686:1120,
	 * 686:1218): Aerobic over Anaerobic, then a card per activity, newest
	 * first, the date over "Threshold (High Aerobic) • 4.5 • 0.2", no
	 * chevron; a card opens the activity's Training Effect page on top. A
	 * period without activities keeps its charts and has the web's line in
	 * the list's place (Inferred). From 640 pt the cards go two a row; a pane
	 * sets the charts side by side and the cards three a row under them.
	 */
	let { view, pane, open }: { view: TrainingEffectPeriodView; pane: boolean; open: (route: Route) => void } = $props();

	const L = TE_LAYOUT;
</script>

<div
	class="te-period"
	style:--te-chart-overlap="{L.chartOverlap}px"
	style:--te-list="{L.list}px"
	style:--te-list-bottom="{L.listBottom}px"
	style:--te-empty-bottom="{L.emptyBottom}px"
	style:--te-pane-top="{L.paneTop}px"
	style:--te-pane-gap="{L.paneGap}px"
>
	<div class="charts">
		{#each view.charts as chart (chart.key)}<TeChart {chart} {pane} />{/each}
	</div>
	{#if view.cards.length}
		<ul class="te-cards">
			{#each view.cards as item (item.id)}
				<li>
					<button class="te-card" onclick={() => open(item.route)}>
						<span class="date">{item.date}</span>
						<span class="subtitle">{item.subtitle}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else if view.empty}
		<div class="empty">{view.empty}</div>
	{/if}
</div>

<style>
	/* The phone (684:33): the charts right under the header, 187.33 apart; the cards 20 under the second, 90 apart, 8 over the end. */
	.te-period .charts > :global(* + *) {
		margin-top: calc(-1 * var(--te-chart-overlap));
	}
	.te-cards {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin: var(--te-list) 0 0;
		padding: 0 16px var(--te-list-bottom);
		list-style: none;
	}
	li {
		margin: 0;
	}
	/* Activity Card 683:224: 370 × 74 on the secondary background, radius 8, the date 15.84 down and the subtitle 41 down, 16 in. */
	.te-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		box-sizing: border-box;
		width: 100%;
		height: 74px;
		margin: 0;
		padding: 15.84px 16px 0;
		border: none;
		border-radius: var(--radius-m, 8px);
		box-shadow: none;
		background: var(--background-secondary);
		color: var(--text-normal);
		font: inherit;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		cursor: pointer;
	}
	.te-card:hover {
		background: var(--background-modifier-hover);
	}
	.date {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	.subtitle {
		margin-top: 5.16px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.date,
	.subtitle {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* 684:119836: the web's line, centred, 3 lines in 370 pt, 16 over the end. */
	.empty {
		margin: var(--te-list) auto 0;
		max-width: 402px;
		padding: 0 16px var(--te-empty-bottom);
		font-size: 15px;
		line-height: 20px;
		text-align: center;
		color: var(--text-muted);
	}

	@container (min-width: 640px) {
		.te-cards {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding: 0;
		}
	}

	/* A pane (686:1120): the two charts side by side, 8 apart, 31 under the header's rule; three cards a row. */
	@container (min-width: 1000px) {
		.charts {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--te-pane-gap);
			margin-top: var(--te-pane-top);
		}
		.te-period .charts > :global(* + *) {
			margin-top: 0;
		}
		.te-cards {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
