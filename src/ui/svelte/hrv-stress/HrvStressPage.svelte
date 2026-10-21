<script lang="ts">
	import { HRV_STRESS_LEVELS } from "../../../dashboard/hrv-stress-copy";
	import { hrvStressView } from "../../../dashboard/hrv-stress-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HRV_STRESS_INDEX, type HrvStressRow } from "../../../sync/hrv-stress-index";
	import StatLegend from "../health/StatLegend.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import { HRV_STRESS_STYLE, LEVEL_COLOR } from "./colors";
	import HrvStressChart from "./HrvStressChart.svelte";

	/**
	 * Garmin Connect's HRV Stress page (Performance Stats). Twin: Figma page
	 * 430:6132 — phones 805:9 (7d) and 805:67 (4w), the Inferred 805:164 (7d
	 * with tests); pane 806:134691; dark 806:116 / 806:134732.
	 *
	 * - 7d · 4w under the compact two-segment control, the period stepper ("<"
	 *   by the shell's `canStepBack`), then the chart: on the empty page only
	 *   "No data available" over the day axis. With tests (Inferred) the
	 *   0–100 axis and a bar a day in its level's colour, the levels' legend
	 *   under the chart.
	 * - The phone's "Help" is left out, as on the twin (its sheet was never
	 *   shot); the web dialog's words are `HRV_STRESS_HELP`.
	 * - Everything comes from the HRV stress index: nothing is fetched on view.
	 *   A pane keeps the chart in the 748 pt column.
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: PerformanceStatPageProps = $props();

	const KIND = HRV_STRESS_INDEX.kind;

	let rows = $state.raw<HrvStressRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HrvStressRow>(KIND).then(
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
	let view = $derived(hrvStressView(route, rows, { today, complete }));
	const legend = HRV_STRESS_LEVELS.map((level) => ({ label: level.label, shape: "circle" as const, color: LEVEL_COLOR[level.id] }));
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	style={HRV_STRESS_STYLE}
	history={{
		title: HRV_STRESS_INDEX.title,
		complete,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children({ pane })}
		<div class="hrv-stress-page">
			<div class="hrv-plot"><HrvStressChart {view} {pane} /></div>
			{#if view.bars.length}
				<div class="hrv-legend"><StatLegend items={legend} /></div>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (805:9), under the header's foot at 165: the chart's 193.14
	 * pt box at 174.86, its foot at 368; nothing under it on the empty page.
	 * With tests (805:164) the legend's 16 pt row 12 under the box (380),
	 * centred.
	 */
	.hrv-stress-page {
		padding-bottom: 24px;
	}
	.hrv-plot {
		margin-top: 9.86px;
		min-width: 0;
	}
	.hrv-legend {
		margin-top: 12px;
	}

	/*
	 * The pane (806:134691), under the header's rule at 116: the chart's box
	 * at (32, 149) in the 748 pt column, the 370 pt one empty; the legend
	 * centred under the chart in its column. The shell's 32 pt end padding
	 * follows.
	 */
	@container (min-width: 1000px) {
		.hrv-stress-page {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.hrv-stress-page > * {
			grid-column: 1;
		}
		.hrv-plot {
			margin-top: 33px;
		}
	}
</style>
