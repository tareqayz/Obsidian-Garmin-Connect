<script lang="ts">
	import { DAY_RHYTHM } from "../../../dashboard/heat-acclimation-charts";
	import type { HeatDayView } from "../../../dashboard/heat-acclimation-pages";
	import TrendDisc from "./TrendDisc.svelte";

	/**
	 * 1d (twin 630:9, pane 631:561; Inferred 630:359 Deacclimatizing, 630:379
	 * Acclimatized, 630:402 0 %, 630:423 no data): the trend disc, the % and
	 * the trend line, centred, then ACCLIMATIZING's copy. In a pane the disc,
	 * % and line stand centred in the 748 pt column and the copy starts the
	 * 370 pt one, left-aligned. A day with no row on or before it says so where
	 * the disc would be.
	 */
	let { view }: { view: HeatDayView } = $props();

	const R = DAY_RHYTHM;
</script>

<div
	class="ha-day"
	style:--ha-disc-top="{R.discTop}px"
	style:--ha-percent-gap="{R.percentGap}px"
	style:--ha-percent="{R.percent}px"
	style:--ha-trend-gap="{R.trendGap}px"
	style:--ha-trend="{R.trend}px"
	style:--ha-copy-gap="{R.copyGap}px"
	style:--ha-copy-line="{R.copyLine}px"
	style:--ha-copy-top-pane="{R.copyTopPane}px"
	style:--ha-empty-top="{R.emptyTop}px"
>
	{#if view.value !== undefined}
		<div class="ha-main">
			<TrendDisc glyph={view.glyph} />
			<div class="ha-percent">{view.value}</div>
			{#if view.trendLine}<div class="ha-trend">{view.trendLine}</div>{/if}
		</div>
		{#if view.copy}
			<div class="ha-side"><p class="ha-copy">{view.copy}</p></div>
		{/if}
	{:else}
		<p class="ha-empty">{view.empty ?? ""}</p>
	{/if}
</div>

<style>
	/*
	 * The phone (630:9), under the header's foot (165): the disc 23.33 down
	 * (188.33), the % in Ring Value L 16.73 under it (269.06), the trend line
	 * in Label --text-muted 15.68 under that (324.74), all centred; the copy in
	 * Paragraph, centred in a 370 pt measure at x 16 so its lines break as the
	 * app's do, on the app's 20.33 pt pitch — a 20.33 pt line box puts each
	 * line's middle where the twin's 22 pt boxes (371.83 + 20.33k) put it.
	 */
	.ha-day {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 24px;
	}
	.ha-main {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		padding-top: var(--ha-disc-top);
	}
	.ha-percent {
		margin-top: var(--ha-percent-gap);
		font-size: 34px;
		line-height: var(--ha-percent);
		font-weight: 400;
		color: var(--text-normal);
		text-align: center;
		white-space: nowrap;
	}
	.ha-trend {
		max-width: 300px;
		margin-top: var(--ha-trend-gap);
		font-size: 13px;
		line-height: var(--ha-trend);
		color: var(--text-muted);
		text-align: center;
	}
	.ha-side {
		min-width: 0;
		padding: 0 16px;
	}
	.ha-copy {
		max-width: 370px;
		margin: var(--ha-copy-gap) auto 0;
		font-size: 16px;
		line-height: var(--ha-copy-line);
		color: var(--text-normal);
		text-align: center;
	}
	/* No row on or before the day (630:423, Inferred): the line in Body where the disc would be. */
	.ha-empty {
		margin: var(--ha-empty-top) 16px 0;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		text-align: center;
	}

	/* From 640 pt the shell's body has its own 32 pt margins and ends 32 pt under the page. */
	@container (min-width: 640px) {
		.ha-day {
			padding-bottom: 0;
		}
		.ha-side {
			padding: 0;
		}
		.ha-empty {
			margin-left: 0;
			margin-right: 0;
		}
	}

	/*
	 * The pane (631:561): the disc, % and trend line at the phone's offsets
	 * under the rule, centred on the 748 pt column (x 406); the copy
	 * left-aligned in the 370 pt one beside it, its first cap level with the
	 * disc's top (first 22 pt box at 134.16); the pane ends 32 under the trend
	 * line.
	 */
	@container (min-width: 1000px) {
		.ha-day {
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
		}
		.ha-copy {
			max-width: none;
			margin: var(--ha-copy-top-pane) 0 0;
			text-align: left;
		}
		.ha-empty {
			grid-column: 1;
		}
	}
</style>
