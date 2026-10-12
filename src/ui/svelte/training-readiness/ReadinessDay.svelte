<script lang="ts">
	import { DOT_COLOR, READINESS_LAYOUT } from "../../../dashboard/training-readiness-charts";
	import { FACTORS_TITLE } from "../../../dashboard/training-readiness-copy";
	import type { ReadinessFactor, TrainingReadinessView } from "../../../dashboard/training-readiness-pages";
	import StatDial from "../health/StatDial.svelte";
	import StatFactorCards from "../health/StatFactorCards.svelte";

	/**
	 * A day (twin 652:51; past day 652:244, no reading 652:445; pane
	 * 656:1616): "Updated @ 9:41 AM • After Activity", the page's dial over
	 * its level, the title and the copy, then FACTORS — six cards, each
	 * opening its sheet. In a pane the dial and its level stand in the 748 pt
	 * column, "Updated @", the title and the copy beside them in the 370 pt
	 * one, and the cards three a row under both. A day without a reading says
	 * so where the dial's centre would be; one still loading leaves the space
	 * blank. The rhythm is `READINESS_LAYOUT`'s.
	 */
	interface Props {
		view: TrainingReadinessView;
		/** Opens a factor's sheet. */
		onFactor: (factor: ReadinessFactor) => void;
	}

	let { view, onFactor }: Props = $props();

	const L = READINESS_LAYOUT;

	let factors = $derived(
		view.factors.map((f) => ({
			key: f.id,
			title: f.title,
			...(f.value !== undefined ? { detail: f.value } : {}),
			rating: f.word ?? "",
			color: DOT_COLOR[f.dot],
			onclick: () => onFactor(f),
		})),
	);
</script>

<div
	class="readiness-day"
	style:--rd-updated="{L.phone.updated}px"
	style:--rd-dial="{L.phone.dial}px"
	style:--rd-level="{L.phone.level}px"
	style:--rd-level-shift="{2 * L.phone.levelShift}px"
	style:--rd-title="{L.phone.title}px"
	style:--rd-copy="{L.phone.copy}px"
	style:--rd-copy-line="{L.phone.copyLine}px"
	style:--rd-factors="{L.phone.factors}px"
	style:--rd-cards="{L.phone.cards}px"
	style:--rd-bottom="{L.phone.bottom}px"
	style:--rd-empty="{L.phone.empty}px"
	style:--rd-empty-height="{L.phone.updated + L.box.updated + L.phone.dial + L.box.dial}px"
	style:--rd-pane-dial="{L.pane.dial}px"
	style:--rd-pane-updated="{L.pane.updated}px"
	style:--rd-pane-title="{L.pane.title}px"
	style:--rd-pane-factors="{L.pane.factors}px"
	style:--rd-pane-bottom="{L.pane.bottom}px"
	style:--rd-pane-empty="{L.pane.empty}px"
	style:--rd-pane-empty-height="{L.pane.dial + L.box.dial}px"
>
	{#if view.state === "reading" && view.dial}
		<div class="main">
			<StatDial kind="readiness" gauge={view.dial.gauge} />
			{#if view.level}<p class="level">{view.level}</p>{/if}
		</div>
		<div class="side">
			<p class="updated">{view.updated ?? ""}</p>
			{#if view.title}<p class="title">{view.title}</p>{/if}
			{#if view.copy}<p class="copy">{view.copy}</p>{/if}
		</div>
		<div class="factors">
			<div class="factors-label">{FACTORS_TITLE}</div>
			<div class="cards"><StatFactorCards {factors} /></div>
		</div>
	{:else}
		<div class="main no-reading">
			{#if view.empty}<p class="empty">{view.empty}</p>{/if}
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone (652:51): one column, "Updated @" first. The side column's
	 * pieces join it in place (`display: contents`): the dial and its level,
	 * then the title and the copy.
	 */
	.readiness-day {
		display: flex;
		flex-direction: column;
		padding-bottom: var(--rd-bottom);
	}
	p {
		margin: 0;
	}
	.side {
		display: contents;
	}
	.updated {
		order: 0;
		height: 16px;
		margin-top: var(--rd-updated);
		padding: 0 16px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.main {
		order: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: var(--rd-dial);
	}
	/* Garmin's level word sits 0.83 right of the page's centre. */
	.level {
		margin-top: var(--rd-level);
		padding-left: var(--rd-level-shift);
		font-size: 20px;
		line-height: 24px;
		font-weight: 600;
		text-align: center;
	}
	.title {
		order: 2;
		margin-top: var(--rd-title);
		padding: 0 18px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	/* The phone's 17.77 pt pitch; a title above it is 7.4 away. */
	.copy {
		order: 2;
		margin-top: var(--rd-title);
		padding: 0 18px;
		font-size: 15px;
		line-height: var(--rd-copy-line);
	}
	.title + .copy {
		margin-top: var(--rd-copy);
	}
	.factors {
		order: 3;
		margin-top: var(--rd-factors);
	}
	.factors-label {
		padding-left: 17.1px;
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.cards {
		margin-top: var(--rd-cards);
	}
	/* The factor cards in the twin's sizes (Factor Card 443:420): title Body Semibold, value Label, word Value M. */
	.cards :global(.title) {
		font-size: 15px;
		line-height: 20px;
	}
	.cards :global(.detail) {
		font-size: 13px;
		line-height: 16px;
	}
	.cards :global(.rating) {
		font-size: 17px;
		line-height: 22px;
		font-weight: 400;
	}
	/* No reading: the line centred where the dial's centre would be (652:445); a load in progress, the space alone. */
	.no-reading {
		position: relative;
		height: var(--rd-empty-height);
		margin-top: 0;
	}
	.empty {
		position: absolute;
		top: var(--rd-empty);
		left: 16px;
		right: 16px;
		font-size: 15px;
		line-height: 20px;
		text-align: center;
		color: var(--text-muted);
	}

	/* From 640 pt the shell pads the page 32 pt and the cards go two a row: the words line up with them (Inferred). */
	@container (min-width: 640px) {
		.updated,
		.title,
		.copy {
			padding: 0;
		}
		.factors-label {
			padding-left: 0;
		}
	}

	/*
	 * The pane (656:1616): the dial 23.35 under the header, centred in the
	 * 748 pt column with its level; "Updated @" 30.09 under it in the
	 * 370 pt column and the title 12 under it; FACTORS 32 under the level and
	 * the cards three a row (the shared cards' own grid); 32 under them.
	 */
	@container (min-width: 1000px) {
		.readiness-day {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side" "factors factors";
			column-gap: 8px;
			align-items: start;
			padding-bottom: var(--rd-pane-bottom);
		}
		.main {
			grid-area: main;
			margin-top: var(--rd-pane-dial);
		}
		.side {
			display: block;
			grid-area: side;
			min-width: 0;
		}
		.updated {
			margin-top: var(--rd-pane-updated);
			padding: 0;
		}
		.title {
			margin-top: var(--rd-pane-title);
			padding: 0;
		}
		.copy {
			margin-top: var(--rd-pane-title);
			padding: 0;
		}
		.title + .copy {
			margin-top: var(--rd-copy);
		}
		.factors {
			grid-area: factors;
			margin-top: var(--rd-pane-factors);
		}
		.factors-label {
			padding-left: 0;
		}
		.no-reading {
			height: var(--rd-pane-empty-height);
			margin-top: 0;
		}
		.empty {
			top: var(--rd-pane-empty);
		}
	}
</style>
