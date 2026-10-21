<script lang="ts">
	import { RACE_FRAMES } from "../../../dashboard/race-predictor-charts";
	import { RACE_DISTANCES, racePredictorView, withRaces } from "../../../dashboard/race-predictor-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { RACE_PREDICTIONS_INDEX, type RacePredictionRow } from "../../../sync/race-predictor-index";
	import { RACE_COLOR } from "../health/performance-colors";
	import StatLegend from "../health/StatLegend.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import RaceChart from "./RaceChart.svelte";
	import RaceChips from "./RaceChips.svelte";
	import RaceCurrent from "./RaceCurrent.svelte";

	/**
	 * Garmin Connect's Race Predictor page (Performance Stats). Twin: Figma
	 * page 430:6110 — phone 535:35 (Current), 535:124 / 535:354 / 535:609
	 * (4w / 6m / 1y), 536:410, 536:648, 536:850 (4w −1, Half off, 1y −1);
	 * panes 537:1310 (Current), 537:1353 / 537:1498 / 537:1655.
	 *
	 * - Current: no period row; the runner, the title, the copy and the four
	 *   predictions (`RaceCurrent`).
	 * - 4w / 6m / 1y: "Pace", the chart, the legend and the chips, which
	 *   keep the lines turned off in the route's `sub` (`withRaces`). A pane
	 *   puts the chips and the legend beside the chart, the chips' top level
	 *   with the top gridline. A period without a prediction keeps the box and
	 *   says so, without a legend or chips (Inferred).
	 */
	let { route, today, units, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: PerformanceStatPageProps = $props();

	const KIND = RACE_PREDICTIONS_INDEX.kind;

	let rows = $state.raw<RacePredictionRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<RacePredictionRow>(KIND).then(
			(index) => {
				if (!live) return;
				rows = index.rows;
				meta = index.meta;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(racePredictorView(route, rows, { today, complete, units }));
	let current = $derived(view.range === "1d" ? view : null);
	let period = $derived(view.range === "1d" ? null : view);

	const legend = RACE_DISTANCES.map((d) => ({ label: d.label, shape: d.shape, color: RACE_COLOR[d.id] }));
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	steppers={!current}
	{onBack}
	{swap}
	history={{ title: RACE_PREDICTIONS_INDEX.title, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{#if current}
			<RaceCurrent view={current} />
		{:else if period}
			<!-- In a pane the side column starts level with the top gridline: the title's 33 + 24, then the frame's top line's top edge. -->
			<div class="race-period" style:--race-side-top="{33 + 24 + RACE_FRAMES[period.range].top - 0.5}px">
				<figure class="chart">
					<figcaption>{period.title}</figcaption>
					<RaceChart range={period.range} chart={period.chart} empty={period.empty} {pane} />
				</figure>
				{#if period.chart}
					<div class="side">
						<div class="legend"><StatLegend items={legend} /></div>
						<div class="chips"><RaceChips chips={period.chips} onchange={(on) => swap(withRaces(route, on))} /></div>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (535:124), from the header's foot (y 165): "Pace" 13.35 down,
	 * the chart's box from its foot to the legend (y 490.67, 1y 510.67), the
	 * chips 25.66 under the legend (y 532.33, 1y 552.33); nothing below them.
	 */
	.race-period {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 32px;
	}
	.chart {
		min-width: 0;
		margin: 0;
	}
	figcaption {
		margin-top: 13.35px;
		padding-left: 16px;
		font-size: 20px;
		line-height: 24px;
		color: var(--text-normal);
	}
	.side {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.chips {
		margin-top: 25.66px;
	}

	@container (min-width: 640px) {
		.race-period {
			padding-bottom: 0;
		}
	}

	/*
	 * The panes (537:1353, 537:1498, 537:1655), from the header's rule (116):
	 * "Pace" 33 down in the wide column, the chart under it to its axis
	 * labels; beside it the chips, their top level with the top gridline's,
	 * and the legend 16 under them, both from the column's left edge.
	 */
	@container (min-width: 1000px) {
		.race-period {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "chart side";
			column-gap: 8px;
			align-items: start;
		}
		.chart {
			grid-area: chart;
		}
		figcaption {
			margin-top: 33px;
			padding-left: 0;
		}
		.side {
			grid-area: side;
			margin-top: var(--race-side-top);
		}
		.chips {
			order: 0;
			margin-top: 0;
		}
		/* The shared legend centres its items: fitted to them, it starts at the column's edge. */
		.legend {
			order: 1;
			width: fit-content;
			margin-top: 16px;
		}
	}
</style>
