<script lang="ts">
	import { LEGEND_MARGIN, SIDE_COLUMN, averagesFrame, legendRows } from "../../../dashboard/hrv-status-charts";
	import { OVERNIGHT, hrvStatusView, withOvernight, type HrvFigure } from "../../../dashboard/hrv-status-pages";
	import { dayCardRoute, dayOf } from "../../../dashboard/periods";
	import { PHONE } from "../../../dashboard/stat-charts";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HRV_DAY, HRV_STATUS_INDEX, hrvNightIn, type HrvNight, type HrvStatusRow } from "../../../sync/hrv-status-index";
	import StatChips from "../health/StatChips.svelte";
	import StatDial from "../health/StatDial.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import HrvAveragesChart from "./HrvAveragesChart.svelte";
	import HrvDayCard from "./HrvDayCard.svelte";
	import HrvLegend, { legendItems } from "./HrvLegend.svelte";
	import HrvTimeline from "./HrvTimeline.svelte";

	/**
	 * Garmin Connect's HRV Status page (Performance Stats). Twin: Figma page
	 * 430:6108 — phone 1d 508:95933, 7d 508:96058 / 508:96227 (chip off /
	 * on), 4w 508:96408 / 508:96696, previous periods 508:98305…, list ends
	 * 508:98896 / 508:99133; panes 511:2120 (1d), 512:2159 (7d), 512:2295 (4w).
	 *
	 * - 1d: the dial with the night's 7-day average, its status and copy,
	 *   Overnight Avg and Highest 5-min Avg, then the Nightly Timeline from
	 *   the night's readings (`loadIntraday(date, ["hrvDay"])`). A pane puts
	 *   the timeline in the wide column and the rest beside it.
	 * - 7d / 4w: "7-day Averages", its legend, the Overnight Averages chip
	 *   (the route's `sub`), then a card a night, newest first, each opening
	 *   its night. A pane puts the chip and the legend beside the chart, the
	 *   chip level with the top gridline, and the cards three a row under both.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: PerformanceStatPageProps = $props();

	const KIND = HRV_STATUS_INDEX.kind;

	let rows = $state.raw<HrvStatusRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HrvStatusRow>(KIND).then(
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

	/* 1d: the night's readings, from its series file or fetched on view. */
	let date = $derived(route.range === "1d" ? dayOf(route, today) : null);
	let loaded = $state.raw<{ date: string; night: HrvNight | null } | null>(null);
	$effect(() => {
		const d = date;
		void seriesVersion;
		if (!d) return;
		let live = true;
		loadIntraday(d, [HRV_DAY.key]).then(
			(load) => {
				if (live) loaded = { date: d, night: hrvNightIn(load.series) };
			},
			() => {
				if (live) loaded = { date: d, night: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let night = $derived(date && loaded?.date === date ? loaded.night : undefined);

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(hrvStatusView(route, rows, { today, complete, night }));
	let day = $derived(view.range === "1d" ? view : null);
	let period = $derived(view.range === "1d" ? null : view);

	/* The phone's legend wraps by the twin's item widths, and the chart gives a second row its room. */
	let width = $state(0);

	const figure = (f: HrvFigure) => (f.unit ? `${f.value} ${f.unit}` : f.value);
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	{onBack}
	{swap}
	history={{ title: HRV_STATUS_INDEX.title, windowDays: HRV_STATUS_INDEX.windowDays, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane, move })}
		<div class="hrv" bind:clientWidth={width}>
			{#if day}
				<div class="hrv-day">
					<div class="summary">
						{#if day.dial}
							<div class="dial"><StatDial kind="hrv" gauge={day.dial.gauge} unit={day.dial.unit} /></div>
							{#if day.status}<p class="status">{day.status.word}</p>{/if}
							{#if day.copy}<p class="copy">{day.copy}</p>{/if}
							<div class="figures">
								{#each day.figures as f (f.label)}
									<div class="figure"><span class="value">{figure(f)}</span><span class="label">{f.label}</span></div>
								{/each}
							</div>
						{:else if day.empty}
							<div class="no-data"><strong>{day.empty.title}</strong><span>{day.empty.text}</span></div>
						{:else}
							<div class="no-data"></div>
						{/if}
					</div>
					{#if day.timeline}
						<div class="timeline"><HrvTimeline timeline={day.timeline} {pane} /></div>
					{/if}
				</div>
			{:else if period}
				{@const legend = period.chart ? legendRows(legendItems(period.chart.legend), pane ? SIDE_COLUMN : (width || PHONE) - 2 * LEGEND_MARGIN) : []}
				<div class="hrv-period" style:--hrv-side-top="{98.49 + averagesFrame(period.range).top - 0.5}px">
					<div class="chart">
						<HrvAveragesChart chart={period.chart} range={period.range} {pane} rows={Math.max(1, legend.length)} />
					</div>
					<div class="side">
						{#if legend.length}<div class="legend"><HrvLegend rows={legend} align={pane ? "start" : "center"} /></div>{/if}
						<div class="chips">
							<StatChips
								chips={[{ id: OVERNIGHT, label: period.chip.label }]}
								selected={period.chip.on ? [OVERNIGHT] : []}
								onchange={(selected) => swap(withOvernight(route, selected.includes(OVERNIGHT)))}
							/>
						</div>
					</div>
					{#if period.days.length}
						<div class="list">
							{#each period.days as card (card.date)}
								<HrvDayCard {card} onclick={() => move(dayCardRoute(card.date, today))} />
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * 1d on the phone (508:95933), from the body's top (y 165): the dial
	 * 17.16 down, the status 27.44 under it, the copy's lines 17.66 apart, the
	 * figures' rules 17.39 under the copy, the timeline's title 45.45 under
	 * the labels; the page ends 72 under "— HRV".
	 */
	.hrv-day {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 72px;
	}
	.summary,
	.timeline {
		min-width: 0;
	}
	.dial {
		display: flex;
		justify-content: center;
		margin-top: 17.16px;
	}
	.status {
		margin: 27.44px 0 0;
		font-size: 20px;
		line-height: 24px;
		font-weight: 600;
		text-align: center;
	}
	.copy {
		margin: 16.69px 16px 0;
		font-size: 15px;
		line-height: 17.66px;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 15px;
		margin-top: 17.39px;
		padding: 0 16px 0 15px;
	}
	.figure {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-top: 1px solid var(--background-modifier-border);
	}
	.figure .value {
		margin-top: 7.33px;
		font-size: 22px;
		line-height: 26px;
		white-space: nowrap;
	}
	.figure .label {
		margin-top: -1.24px;
		font-size: 14px;
		line-height: 18px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Garmin's empty state where the dial goes (Inferred), and the same room while the night loads. */
	.no-data {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		height: 196px;
		margin-top: 17.16px;
		padding: 0 16px;
		font-size: 15px;
		line-height: 20px;
		color: var(--text-muted);
		text-align: center;
	}
	.no-data strong {
		font-weight: 600;
		color: var(--text-normal);
	}
	.timeline {
		margin-top: 45.45px;
	}

	/*
	 * 7d / 4w on the phone (508:96058, 508:96408): the title 13.51 down, the
	 * chart's box, the legend 19.67 under it (rows 37.34 apart), the chip
	 * 13.66 under the legend, the first card 24.67 under the chip, cards
	 * 16.67 apart; the page ends 50.33 under the last.
	 */
	.hrv-period {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-bottom: 34px;
	}
	.chart {
		min-width: 0;
		margin-top: 13.51px;
	}
	.side {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.legend {
		margin-top: 19.67px;
	}
	/* The twin's chip starts at x 16, a point in from the shared chips' 15. */
	.chips {
		margin-top: 13.66px;
		padding-left: 1px;
	}
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: 16.67px;
		margin-top: 24.67px;
		padding: 0 16px 16.33px;
	}

	/* From 640 pt the shell's body ends 32 pt under the page: the twin's panes end there too. */
	@container (min-width: 640px) {
		.hrv-day,
		.hrv-period {
			padding-bottom: 0;
		}
		.chips {
			padding-left: 0;
		}
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px 8px;
			padding: 0 0 16px;
		}
	}

	/*
	 * The panes (511:2120, 512:2159, 512:2295), from the header's rule: the
	 * wide column's title 33 down; beside it, 1d's dial 27.44 down with the
	 * copy in 20 pt lines, or the chip level with the top gridline and the
	 * legend 16 under it; the cards three a row 30 under the chart's box.
	 */
	@container (min-width: 1000px) {
		.hrv-day {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "timeline summary";
			column-gap: 8px;
			align-items: start;
		}
		.summary {
			grid-area: summary;
		}
		.timeline {
			grid-area: timeline;
			margin-top: 33px;
			--stat-title-indent: 0px;
		}
		.dial,
		.no-data {
			margin-top: 27.44px;
		}
		.copy {
			margin: 15.53px 0 0;
			line-height: 20px;
		}
		.figures {
			column-gap: 14px;
			margin-top: 16.21px;
			padding: 0;
		}
		.hrv-period {
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "chart side" "list list";
			column-gap: 8px;
			align-items: start;
		}
		.chart {
			grid-area: chart;
			margin-top: 33px;
		}
		.side {
			grid-area: side;
			margin-top: var(--hrv-side-top);
		}
		.legend {
			order: 1;
			margin-top: 16px;
		}
		.chips {
			order: 0;
			margin-top: 0;
		}
		.list {
			grid-area: list;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			margin-top: 30px;
			padding: 0;
		}
	}
</style>
