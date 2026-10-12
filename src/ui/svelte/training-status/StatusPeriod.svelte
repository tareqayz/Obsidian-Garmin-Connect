<script lang="ts">
	import { CHART_RHYTHM, tableColumnCount, tableColumns } from "../../../dashboard/training-status-charts";
	import type { StatusTableRow, TrainingStatusPeriodView } from "../../../dashboard/training-status-pages";
	import { PERFORMANCE_STATUS_COLOR } from "../health/performance-colors";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatusStrip from "../health/StatusStrip.svelte";
	import StatusTable from "./StatusTable.svelte";

	/**
	 * 4w, 12w and 6m (twin 561:60, 562:104152, 562:104823; panes 564:2030,
	 * 565:1876, 565:2481): the strip of the period's runs, its seven labels,
	 * and the runs' table, newest first. On a phone the strip and its labels
	 * stay pinned under the header while the table scrolls under them, as the
	 * app's 12w does; in a pane everything scrolls, the strip fills the 748 pt
	 * column and the table runs in two 370 pt columns, newest left then right.
	 * A row's tap selects its run (`onSelect`): its block keeps its height,
	 * every other drops to a foot, and every other row dims.
	 */
	interface Props {
		view: TrainingStatusPeriodView;
		/** Laid out as the twins' 1190 pt pane. */
		pane: boolean;
		onSelect: (row: StatusTableRow) => void;
	}

	let { view, pane, onSelect }: Props = $props();

	/* Days without a row are periods without a colour: empty slots. */
	let periods = $derived(view.strip?.blocks.map((b) => (b.status ? { days: b.days, color: PERFORMANCE_STATUS_COLOR[b.status] } : { days: b.days })) ?? []);
	let columns = $derived(
		tableColumns(
			view.table.map((row) => ({
				key: row.key,
				status: row.word,
				dates: row.dates,
				color: PERFORMANCE_STATUS_COLOR[row.status],
				dimmed: row.dimmed,
				onclick: () => onSelect(row),
			})),
			tableColumnCount(pane),
		),
	);
	let rhythm = $derived(
		`--ts-chart-top: ${CHART_RHYTHM.phoneTop}px; --ts-chart-top-pane: ${CHART_RHYTHM.paneTop}px; --ts-label-gap: ${CHART_RHYTHM.labelGap}px; --ts-table-gap: ${CHART_RHYTHM.tableGap}px`,
	);
</script>

<div class="ts-period" style={rhythm}>
	<div class="chart">
		{#if view.strip}
			<StatusStrip size="page" {periods} selected={view.strip.selected} />
			<div class="labels">
				{#each view.axis as label (label.date)}
					<span style:left="calc((100% + 2px) * {label.x} - 30px)">{label.text}</span>
				{/each}
			</div>
		{:else}
			<div class="empty"><StatEmpty text={view.empty ?? ""} /></div>
		{/if}
	</div>
	{#if columns[0]?.length}
		<div class="table">
			{#each columns as rows, c (c)}
				<StatusTable {rows} />
			{/each}
		</div>
	{/if}
</div>

<style>
	/*
	 * The phone (561:60): the strip 31.33 under the header's foot (196.33),
	 * 368 wide at x 16; the labels in Legend 8.04 under it (268.37), each a
	 * 60 pt box centred at 16 + (2i + 1)·370/14; the table's header 24.96
	 * under them (309.33). The block is the page's colour, so the rows scroll
	 * out of sight under it.
	 */
	.chart {
		position: sticky;
		/* The shell's header: the 44 pt bar and the 121 pt range control and period. */
		top: 165px;
		z-index: 1;
		padding: var(--ts-chart-top) 18px var(--ts-table-gap) 16px;
		background: var(--background-primary);
	}
	.labels {
		position: relative;
		height: 16px;
		margin-top: var(--ts-label-gap);
		font-size: 12px;
		line-height: 16px;
		color: var(--text-muted);
	}
	/* Centred on (2i + 1)/14 of the day space, which runs 2 pt past the strip's right edge. */
	.labels span {
		position: absolute;
		top: 0;
		width: 60px;
		text-align: center;
		white-space: nowrap;
	}
	/* A period without a row: the web's line where the strip and its labels would be (Inferred). */
	.empty {
		position: relative;
		height: calc(64px + var(--ts-label-gap) + 16px);
	}

	/*
	 * The pane (564:2030): the strip 32 under the header's rule (148), the
	 * 748 pt column wide, the 370 pt side column empty; the table's two
	 * columns 8 apart under the labels (261), each with its own header.
	 */
	@container (min-width: 1000px) {
		.ts-period {
			margin-right: 378px;
		}
		.chart {
			position: static;
			padding: var(--ts-chart-top-pane) 0 var(--ts-table-gap);
		}
		.table {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			column-gap: 8px;
			align-items: start;
		}
	}
</style>
