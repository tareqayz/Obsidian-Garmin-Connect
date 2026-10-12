<script lang="ts">
	import { CURRENT_LAYOUT, ringColor } from "../../../dashboard/running-tolerance-charts";
	import type { ToleranceCurrentView } from "../../../dashboard/running-tolerance-pages";
	import StatDial from "../health/StatDial.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";
	import ToleranceFigures from "./ToleranceFigures.svelte";

	/**
	 * Current (twin 695:22, pane 700:1865): the acute impact load's share of
	 * the weekly tolerance as a full ring (`StatDial`'s tolerance kind), blue,
	 * or orange at or over the line (Inferred, 697:1250), "28.2 km" over
	 * "37 km/w" in it; then the phrase's title and copy, where its words are
	 * known, and the three figures. Without a row the no-data line stands
	 * where the ring's centre would be (697:1546). A pane puts the ring in the
	 * 748 pt column and the rest in the 370 pt one.
	 */
	let { view }: { view: ToleranceCurrentView } = $props();

	const L = CURRENT_LAYOUT;
</script>

<div
	class="rt-current"
	style:--rt-ring-top="{L.ringTop}px"
	style:--rt-ring-top-pane="{L.ringTopPane}px"
	style:--rt-title-gap="{L.titleGap}px"
	style:--rt-title-top-pane="{L.titleTopPane}px"
	style:--rt-copy-gap="{L.copyGap}px"
	style:--rt-copy-line="{L.copyLine}px"
	style:--rt-figures-gap="{L.figuresGap}px"
>
	<div class="rt-main">
		{#if view.ring}
			<div class="rt-ring">
				<StatDial kind="tolerance" progress={view.ring.progress} value={view.ring.value} label={view.ring.label} color={ringColor(view.ring)} />
			</div>
		{:else if view.empty}
			<div class="rt-none"><StatEmpty text={view.empty} /></div>
		{/if}
	</div>
	{#if view.date}
		<div class="rt-side">
			{#if view.title}<p class="rt-title">{view.title}</p>{/if}
			{#if view.copy}<p class="rt-copy">{view.copy}</p>{/if}
			{#if view.figures.length}<div class="rt-figures"><ToleranceFigures figures={view.figures} /></div>{/if}
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone, from the header's foot (165): the ring's 196 pt box 7.12 over
	 * it, so its centre is at 255.88; the title 36.61 under the box, the copy
	 * 15.39 under the title on 22 pt lines, the figures 23.45 under the copy.
	 */
	.rt-current {
		padding-bottom: 32px;
	}
	.rt-ring,
	.rt-none {
		margin-top: var(--rt-ring-top);
	}
	.rt-ring {
		display: flex;
		justify-content: center;
	}
	.rt-none {
		position: relative;
		height: 196px;
	}
	.rt-none :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
	.rt-title,
	.rt-copy {
		margin: 0;
		padding: 0 16px;
		color: var(--text-normal);
	}
	/* The first of the side's parts sits 36.61 under the ring's box. */
	.rt-side > :first-child {
		margin-top: var(--rt-title-gap);
	}
	.rt-title {
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	.rt-copy {
		font-size: 15px;
		line-height: var(--rt-copy-line);
		letter-spacing: -0.3px;
	}
	.rt-title + .rt-copy {
		margin-top: var(--rt-copy-gap);
	}
	.rt-copy + .rt-figures,
	.rt-title + .rt-figures {
		margin-top: var(--rt-figures-gap);
	}
	.rt-figures {
		padding: 0 16px;
	}

	/* From 640 pt the shell pads the body: its sides and its foot. */
	@container (min-width: 640px) {
		.rt-current {
			padding-bottom: 0;
		}
		.rt-title,
		.rt-copy,
		.rt-figures {
			padding: 0;
		}
	}

	/*
	 * The pane (700:1865), from the header's rule (116): the ring's box 18
	 * under it, centred in the 748 pt column; beside it the title 27.19
	 * under the rule, the copy and the figures under it as on the phone.
	 */
	@container (min-width: 1000px) {
		.rt-current {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.rt-ring,
		.rt-none {
			margin-top: var(--rt-ring-top-pane);
		}
		.rt-side > :first-child {
			margin-top: var(--rt-title-top-pane);
		}
	}
</style>
