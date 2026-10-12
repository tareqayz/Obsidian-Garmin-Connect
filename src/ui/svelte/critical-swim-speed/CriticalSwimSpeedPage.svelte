<script lang="ts">
	import { criticalSwimSpeedView } from "../../../dashboard/critical-swim-speed-pages";
	import { CRITICAL_SWIM_SPEED_INDEX, type CriticalSwimSpeedRow } from "../../../sync/critical-swim-speed-index";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatTable from "../health/StatTable.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import CssChart from "./CssChart.svelte";
	import CssCurrent from "./CssCurrent.svelte";

	/**
	 * Garmin Connect's Critical Swim Speed page (Performance Stats). Twin:
	 * Figma page 430:6122 — phones 800:9 (Current), 800:53 (7d), 800:158
	 * (12w), 800:291 (1y), the Inferred 800:424 (Current with a result) and
	 * 800:467 (12w with results); panes 802:458 (Current) and 802:480 (12w);
	 * dark 801:233 / 802:585.
	 *
	 * - Every view reads the CSS index, Current included (its newest row), so
	 *   the page fetches nothing on view and the history banner shows on all
	 *   of them while the index is still coming.
	 * - Current has no period row. A range has the compact stepper ("<" by
	 *   the shell's `canStepBack`), the chart's title, the chart's frame —
	 *   always drawn, "No Critical Swim Speed data" in it for a period without
	 *   a result — and the results table: Pace over "min/100m" · Date, one
	 *   "--:--" · "--" row in the card tone when empty, else every result
	 *   newest first, its date muted (Inferred, as the twin draws it).
	 * - A pane keeps the chart and the table in the 748 pt column; the 370 pt
	 *   one stays empty on the ranges (the twin's choice: the table lists the
	 *   chart's points, so it follows the chart).
	 */
	let { route, today, canSync, onBack, swap, readIndex, onSyncHistory, versions, history }: PerformanceStatPageProps = $props();

	const KIND = CRITICAL_SWIM_SPEED_INDEX.kind;

	let rows = $state.raw<CriticalSwimSpeedRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<CriticalSwimSpeedRow>(KIND).then(
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
	let view = $derived(criticalSwimSpeedView(route, rows, { today, complete }));
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	history={{
		title: CRITICAL_SWIM_SPEED_INDEX.title,
		windowDays: CRITICAL_SWIM_SPEED_INDEX.windowDays,
		complete,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children({ pane })}
		{#if view.range === "1d"}
			<CssCurrent current={view} />
		{:else}
			<div class="css-period">
				<p class="css-title">{view.title}</p>
				<div class="css-plot"><CssChart chart={view.chart} range={view.range} empty={view.empty} {pane} /></div>
				<div class="css-results" class:dated={view.empty === undefined}>
					<StatTable
						kind="results"
						title={view.table.title}
						header={view.table.header}
						sub={view.table.unit}
						rows={view.table.rows.map((row) => ({ key: row.key, cells: row.cells }))}
						zebra="card"
					/>
				</div>
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (800:53), under the header's foot at 165: the chart's title
	 * (Inter Regular 20/24, x 16) at 192.29; the chart's 254 pt box at 244;
	 * the table 51.67 under the box (549.67): its title band 53, the header
	 * 52.33 (602.67), rows 52.33 from 655, the first in the card tone.
	 */
	.css-period {
		padding-bottom: 24px;
	}
	.css-title {
		margin: 27.29px 0 0;
		padding-left: 16px;
		font-size: 20px;
		line-height: 24px;
		font-weight: 400;
		color: var(--text-normal);
		white-space: nowrap;
	}
	.css-plot {
		margin-top: 27.71px;
		min-width: 0;
	}
	.css-results {
		margin-top: 51.67px;
	}
	/* The twin's Table Title · Results is Nav Title 17 Semi Bold, where StatTable's titles are 18 bold. */
	.css-results :global(.stat-table.results .title) {
		font-size: 17px;
		font-weight: 600;
	}
	/* Its rows are 52.33 tall, as its header is. */
	.css-results :global(.stat-table.results .row) {
		height: 52.33px;
	}
	/* A result's date is muted (the twin's Inferred rows); the empty row's "--" keeps the text colour. */
	.css-results.dated :global(.stat-table.results .row .c2) {
		color: var(--text-muted);
	}

	/*
	 * The pane (802:480), under the header's rule at 116: the chart's title at
	 * (48.5, 149), 16.5 into the 748 pt column; the chart's box at 200.71 and
	 * the table 51.67 under it (506.38), both 748 wide; the 370 pt column
	 * empty. The shell's 32 pt end padding follows the table.
	 */
	@container (min-width: 1000px) {
		.css-period {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			padding-bottom: 0;
		}
		.css-period > * {
			grid-column: 1;
		}
		.css-title {
			margin-top: 33px;
			padding-left: 16.5px;
		}
	}
</style>
