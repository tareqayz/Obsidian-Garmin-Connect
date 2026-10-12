<script lang="ts">
	import { BENEFIT_COLOR } from "../../../dashboard/activity-labels";
	import type { Route } from "../../../dashboard/routes";
	import { TE_DETAIL } from "../../../dashboard/training-effect-charts";
	import { DETAIL_HEADERS } from "../../../dashboard/training-effect-copy";
	import type { TrainingEffectDetailView } from "../../../dashboard/training-effect-pages";
	import TeRelated from "./TeRelated.svelte";
	import TeScaleCell from "./TeScaleCell.svelte";
	import TeSection from "./TeSection.svelte";

	/**
	 * An activity's Training Effect page (twin 684:118813, 684:118933,
	 * 684:119704; pane 686:119854): PRIMARY BENEFIT — the benefit's dot in
	 * the run page's colour, its label and what it did — then AEROBIC and
	 * ANAEROBIC, each the band's title, the scale with its knob and value and
	 * the band's copy, then RELATED ACTIVITY. A cell without copy is shorter
	 * (the swim's). From 640 pt the sections are bordered cards; a pane sets
	 * the three in the 748 pt column and the related activity in the 370.
	 */
	let { view, open }: { view: TrainingEffectDetailView; open: (route: Route) => void } = $props();

	const D = TE_DETAIL;
</script>

<div
	class="te-detail"
	style:--te-top="{D.top}px"
	style:--te-pane-top="{D.paneTop}px"
	style:--te-pane-gap="{D.paneGap}px"
	style:--te-pane-columns="{D.paneColumnGap}px"
	style:--te-cell-top="{D.cellTop}px"
	style:--te-benefit-bottom="{D.benefitBottom}px"
	style:--te-benefit-gap="{D.benefitGap}px"
	style:--te-title="{D.title}px"
>
	<div class="main">
		<TeSection title={DETAIL_HEADERS.benefit}>
			<div class="benefit">
				<div class="benefit-row">
					{#if view.benefit.group}<span class="dot" style:background={BENEFIT_COLOR[view.benefit.group]}></span>{/if}
					<span class="label">{view.benefit.label}</span>
				</div>
				{#if view.benefit.copy}<div class="copy">{view.benefit.copy}</div>{/if}
			</div>
		</TeSection>
		{#each view.scales as scale (scale.key)}
			<TeSection title={DETAIL_HEADERS[scale.key]}><TeScaleCell {scale} /></TeSection>
		{/each}
	</div>
	<div class="side">
		<TeSection title={DETAIL_HEADERS.related}><TeRelated related={view.related} {open} /></TeSection>
	</div>
</div>

<style>
	.te-detail {
		padding-top: var(--te-top);
	}
	/* Primary Benefit 683:239: the 16 pt dot 8.3 before the label, the copy 7.49 under them in 370 pt. */
	.benefit {
		padding: var(--te-cell-top) 16px var(--te-benefit-bottom);
		background: var(--background-primary);
	}
	.benefit-row {
		display: flex;
		align-items: center;
		gap: 8.3px;
		min-width: 0;
	}
	.dot {
		flex: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
	}
	.label {
		min-width: 0;
		font-size: 16px;
		line-height: var(--te-title);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.copy {
		max-width: 370px;
		margin-top: var(--te-benefit-gap);
		font-size: 13px;
		line-height: 20px;
		color: var(--text-muted);
	}

	/* Bordered section cards, 16 apart, 32 under the bar. */
	@container (min-width: 640px) {
		.te-detail {
			display: flex;
			flex-direction: column;
			gap: var(--te-pane-gap);
			padding-top: var(--te-pane-top);
		}
		.main {
			display: flex;
			flex-direction: column;
			gap: var(--te-pane-gap);
		}
	}

	/* A pane (686:119854): the 748 pt column and the 370 pt one, 8 apart. */
	@container (min-width: 1000px) {
		.te-detail {
			display: grid;
			grid-template-columns: minmax(0, 748fr) minmax(0, 370fr);
			align-items: start;
			gap: var(--te-pane-columns);
		}
	}
</style>
