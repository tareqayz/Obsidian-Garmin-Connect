<script lang="ts">
	import type { HillDayView, HillFactor } from "../../../dashboard/hill-score-pages";
	import StatDial from "../health/StatDial.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatFactorCards from "../health/StatFactorCards.svelte";

	/**
	 * A day (twin 504:11, pane 507:95580): the score on the page's dial over
	 * "100", Garmin's class under it, the feedback phrase, then FACTORS — Hill
	 * Endurance, Hill Strength and VO₂ Max, each opening its sheet. In a pane
	 * the dial and its class stand in the wide column with the phrase beside
	 * them, and the three factors take a row under both. A day without a row
	 * says so where the dial would be.
	 */
	interface Props {
		view: HillDayView;
		/** Opens a factor's half sheet. */
		onFactor: (factor: HillFactor) => void;
	}

	let { view, onFactor }: Props = $props();

	let factors = $derived(
		view.factors.map((f) => ({ key: f.key, title: f.title, detail: f.detail, rating: f.rating, onclick: f.sheet ? () => onFactor(f) : undefined })),
	);
</script>

<div class="hill-day">
	{#if view.gauge}
		<div class="main">
			<StatDial kind="hill" gauge={view.gauge} />
			{#if view.classWord}<div class="class-word">{view.classWord}</div>{/if}
		</div>
		<div class="side">
			{#if view.copy}<div class="phrase">{view.copy}</div>{/if}
		</div>
		{#if factors.length}
			<div class="factors">
				<div class="factors-label">FACTORS</div>
				<div class="factor-cards"><StatFactorCards {factors} /></div>
			</div>
		{/if}
	{:else}
		<div class="no-row"><StatEmpty text={view.empty ?? ""} /></div>
	{/if}
</div>

<style>
	/*
	 * The phone (504:11): the dial 23.35 under the header, the class right
	 * under it in Title M (20/24 Bold), the phrase 16.79 lower in 16 pt on a
	 * 20 pt pitch, FACTORS (Label, 13/16) 23.85 under that and the cards
	 * 23.86 under FACTORS, 16 apart; 35 under the last.
	 */
	.hill-day {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 35px;
	}
	.main {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 23.35px;
	}
	.class-word {
		margin-top: 0.15px;
		font-size: 20px;
		line-height: 24px;
		font-weight: 700;
		text-align: center;
	}
	.phrase {
		margin-top: 16.79px;
		padding: 0 16px;
		font-size: 16px;
		line-height: 20px;
	}
	.factors {
		margin-top: 23.85px;
	}
	.factors-label {
		padding: 0 16px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.factor-cards {
		margin-top: 23.86px;
	}
	/* The factor cards in Hill's sizes (504:22): title Body Semibold, value Label, word Body Semibold. */
	.factor-cards :global(.title) {
		font-size: 15px;
		line-height: 20px;
	}
	.factor-cards :global(.detail) {
		font-size: 13px;
		line-height: 16px;
	}
	.factor-cards :global(.rating) {
		font-size: 15px;
		line-height: 20px;
		font-weight: 600;
	}
	/* No row: the line where the dial and its class would be (Inferred). */
	.no-row {
		position: relative;
		height: 220.15px;
		margin-top: 23.35px;
	}
	.no-row :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}

	/*
	 * The pane (507:95580): the dial centred in the 748 pt column, the phrase
	 * in the 370 pt one with its first line 31.58 under the rule, FACTORS 32
	 * under the class and the three cards in a row; 32 under them.
	 */
	@container (min-width: 1000px) {
		.hill-day {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side" "factors factors";
			column-gap: 8px;
			align-items: start;
			padding-bottom: 32px;
		}
		.main {
			grid-area: main;
		}
		.side {
			grid-area: side;
		}
		.phrase {
			margin-top: 31.58px;
			padding: 0;
		}
		.factors {
			grid-area: factors;
			margin-top: 32px;
		}
		.factors-label {
			padding: 0;
		}
	}
</style>
