<script lang="ts">
	import { LOAD_LAYOUT, SERIES_COLOR } from "../../../dashboard/training-load-charts";
	import type { TrainingSegment } from "../../../dashboard/training-load-copy";
	import { CHRONIC_SUB, type LegendItem, type TrainingTabView } from "../../../dashboard/training-load-pages";
	import type { Shape } from "../health/ShapeMarker.svelte";
	import StatChips from "../health/StatChips.svelte";
	import StatLegend from "../health/StatLegend.svelte";
	import LoadSegmented from "./LoadSegmented.svelte";
	import TimelineChart from "./TimelineChart.svelte";

	/**
	 * The Training Load tab (twin 606:454 Acute, 606:659 Acute + Chronic,
	 * 606:894 Ratio; panes 610:1571, 610:1745): the Acute Load | Load Ratio
	 * control, the 4-Week Timeline, its legend, then Acute Load's Chronic
	 * Load chip or Load Ratio's two figures under their rules, and the
	 * newest row's status and copy. A pane puts the timeline in the 748 pt
	 * column and the rest, left-aligned, in the 370 pt one. The view and the
	 * chip are the route's `sub` (`withTrainingView`); the rhythm is
	 * `LOAD_LAYOUT.training`.
	 */
	interface Props {
		view: TrainingTabView;
		pane: boolean;
		onsegment: (segment: TrainingSegment) => void;
		onchronic: (on: boolean) => void;
	}

	let { view, pane, onsegment, onchronic }: Props = $props();

	const L = LOAD_LAYOUT.training;

	/** A legend entry's marker: the optimal band's green at 35 %, or grey; the series' colours, grey with the chip on. */
	function marker(item: LegendItem): { label: string; shape: Shape; color: string } {
		const color =
			item.key === "optimal"
				? item.muted
					? "var(--background-modifier-border)"
					: "rgba(var(--color-green-rgb), 0.35)"
				: item.key === "chronic"
					? SERIES_COLOR.chronic
					: item.muted
						? SERIES_COLOR.muted
						: SERIES_COLOR.acute;
		return { label: item.label, shape: item.shape === "square" ? "square" : "circle", color };
	}

	let legend = $derived(view.legend.map(marker));
</script>

<div
	class="tl"
	style:--tl-segmented="{L.segmented}px"
	style:--tl-title="{L.title}px"
	style:--tl-chart="{L.chart}px"
	style:--tl-legend="{L.legend}px"
	style:--tl-chip="{L.chip}px"
	style:--tl-status="{L.status}px"
	style:--tl-figures="{L.figures}px"
	style:--tl-figure-value="{L.figureValue}px"
	style:--tl-figures-status="{L.figuresStatus}px"
	style:--tl-copy="{L.copy}px"
	style:--tl-pane-top="{L.paneTop}px"
	style:--tl-pane-legend="{L.paneLegend}px"
	style:--tl-pane-chip="{L.paneChip}px"
>
	<div class="seg"><LoadSegmented segments={view.segments} onchange={onsegment} /></div>
	<div class="main">
		<h3 class="heading">{view.title}</h3>
		<div class="chart"><TimelineChart chart={view.chart} empty={view.empty} {pane} /></div>
	</div>
	<div class="side">
		<div class="legend"><StatLegend items={legend} /></div>
		{#if view.chip}
			{@const chip = view.chip}
			<div class="chip">
				<StatChips chips={[{ id: CHRONIC_SUB, label: chip.label }]} selected={chip.on ? [CHRONIC_SUB] : []} onchange={(on) => onchronic(on.includes(CHRONIC_SUB))} />
			</div>
		{/if}
		{#if view.figures}
			<div class="figures">
				{#each view.figures as figure (figure.label)}
					<div class="figure">
						<span class="value">{figure.value}</span>
						<span class="label">{figure.label}</span>
					</div>
				{/each}
			</div>
		{/if}
		{#if view.status}<p class="status" class:after-figures={!!view.figures}>{view.status}</p>{/if}
		{#if view.copyLines}
			<p class="copy">
				{#each view.copyLines as line, i (i)}<span>{line}</span>{/each}
			</p>
		{/if}
	</div>
</div>

<style>
	/*
	 * The phone (606:454, 606:894): the control 23 under the header, the
	 * title 38.53 under it and the chart 38.14 under that; the legend 8.67
	 * under the chart, then the chip 5.66 under it and the status 36.35
	 * under the chip, or the figures' rules 30.66 under the legend and the
	 * status 24 under the figures; the copy 7.51 under the status.
	 */
	.tl {
		padding-bottom: 35px;
	}
	.seg {
		display: flex;
		justify-content: center;
		margin-top: var(--tl-segmented);
		padding: 0 16px;
	}
	.heading {
		margin: var(--tl-title) 0 0;
		padding-left: 16px;
		font-size: 17px;
		line-height: 22px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.chart {
		margin-top: var(--tl-chart);
	}
	.legend {
		margin-top: var(--tl-legend);
	}
	.chip {
		margin-top: var(--tl-chip);
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 15px;
		margin-top: var(--tl-figures);
		padding: 0 15px;
	}
	.figure {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding-top: var(--tl-figure-value);
		border-top: 1px solid var(--background-modifier-border);
	}
	.value {
		font-size: 22px;
		line-height: 26px;
		color: var(--text-normal);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.label {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.status {
		margin: var(--tl-status) 0 0;
		padding: 0 16px;
		font-size: 22px;
		line-height: 28px;
		font-weight: 700;
		text-align: center;
		color: var(--text-normal);
	}
	.status.after-figures {
		margin-top: var(--tl-figures-status);
	}
	.copy {
		margin: var(--tl-copy) 0 0;
		padding: 0 16px;
		font-size: 16px;
		line-height: 20px;
		text-align: center;
		color: var(--text-muted);
	}
	.copy span {
		display: block;
	}

	@container (min-width: 640px) {
		.tl {
			padding-bottom: 0;
		}
		.seg,
		.figures,
		.status,
		.copy {
			padding: 0;
		}
	}

	/*
	 * The pane (610:1571, 610:1745): the title 31 under the header and the
	 * timeline under it in the 748 pt column; the control level with the
	 * title in the 370 pt column, the legend 24 under it, then the chip 17
	 * under the legend or the figures, the status and the copy at the
	 * phone's gaps, all left-aligned.
	 */
	@container (min-width: 1000px) {
		.tl {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-rows: auto 1fr;
			grid-template-areas: "main seg" "main side";
			column-gap: 8px;
			align-items: start;
		}
		.seg {
			grid-area: seg;
			justify-content: flex-start;
			margin-top: var(--tl-pane-top);
		}
		.main {
			grid-area: main;
			min-width: 0;
		}
		.heading {
			margin-top: var(--tl-pane-top);
		}
		.side {
			grid-area: side;
			min-width: 0;
		}
		.legend {
			margin-top: var(--tl-pane-legend);
		}
		.side :global(.stat-legend) {
			justify-content: flex-start;
		}
		.chip {
			margin-top: var(--tl-pane-chip);
		}
		.status,
		.copy {
			text-align: left;
		}
	}
</style>
