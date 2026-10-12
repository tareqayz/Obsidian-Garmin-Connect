<script lang="ts">
	import {
		BARS_LAYOUT,
		DAY_LAYOUT,
		LEGEND_WIDTH,
		RING,
		SCORE_FRAME,
		SCORE_LAYOUT,
		barsDown,
		legendRows,
		paneRows,
		ringArcs,
	} from "../../../dashboard/endurance-score-charts";
	import { enduranceScoreView } from "../../../dashboard/endurance-score-pages";
	import { dayOf } from "../../../dashboard/periods";
	import type { DayRow } from "../../../dashboard/series";
	import { PHONE } from "../../../dashboard/stat-charts";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { ENDURANCE_DAY, ENDURANCE_SCORE_INDEX, enduranceDayIn, type EnduranceDay, type EnduranceScoreRow } from "../../../sync/endurance-score-index";
	import StatDial from "../health/StatDial.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatRing from "../health/StatRing.svelte";
	import StatTabs from "../health/StatTabs.svelte";
	import type { PerformanceStatPageProps } from "../performance/pages";
	import EnduranceBarsChart from "./EnduranceBarsChart.svelte";
	import EnduranceBlocks from "./EnduranceBlocks.svelte";
	import EnduranceLegend from "./EnduranceLegend.svelte";
	import EnduranceLineChart from "./EnduranceLineChart.svelte";
	import EnduranceRows from "./EnduranceRows.svelte";
	import EnduranceStats from "./EnduranceStats.svelte";

	/**
	 * Garmin Connect's Endurance Score page (Performance Stats). Twin: Figma
	 * page 430:6128 — phones 581:9 (1d Score), 581:110 (1d Contributors),
	 * 581:222 (12w Score), 582:108105 / 582:108657 (12w / 1y Contributors);
	 * Inferred 582:109260 (1y Score), 582:109452 / 582:109643 (12w −1),
	 * 582:109893 / 582:109958 (1d without a score); panes 584:1723, 584:1770,
	 * 585:1793, 585:1917, 585:110129, 585:110509.
	 *
	 * Two tabs under the period, Endurance Score and Top Contributors (the
	 * route's `tab`), on every range. 1d: the score on the dial with its class
	 * and copy, or the day's categories round a ring with a legend and the
	 * list. 12w and 1y: the weekly or monthly averages as a line, or as bars
	 * split by each period's categories with the legend and a list a period,
	 * Avg Score and Max Score under either. A pane puts the tabs and the dial,
	 * ring or chart in the 748 pt column and the copy, the list card or the
	 * figures and legend in the 370 pt one, the period lists three a row
	 * under both.
	 *
	 * Everything comes from the endurance-score index, the dial's scale from
	 * the day files, and an unseen activity type's name from the activity
	 * index, so the page works offline. An old day the history walk brought
	 * has no phrase: its copy is fetched on view (`ENDURANCE_DAY`).
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history, readDays, activities }: PerformanceStatPageProps =
		$props();

	const KIND = ENDURANCE_SCORE_INDEX.kind;
	/** The tabs' height (Tabs Equal · 2 at Endurance Score's 55). */
	const TABS = 55;

	let rows = $state.raw<EnduranceScoreRow[]>([]);
	let meta = $state.raw<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<EnduranceScoreRow>(KIND).then(
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

	/* The dial's scale: the day files' `endurance_*`. */
	let days = $state.raw<DayRow[]>([]);
	$effect(() => {
		void versions["#days"];
		let live = true;
		readDays().then(
			(read) => {
				if (live) days = read;
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	/* 1d on a day without a phrase in the index: the day's payload, from its series file or fetched on view. */
	let date = $derived(route.range === "1d" ? dayOf(route, today) : null);
	let row = $derived(date ? rows.find((r) => r.date === date) : undefined);
	let wanted = $derived(date !== null && row !== undefined && row.phraseId === undefined);
	let loaded = $state.raw<{ date: string; day: EnduranceDay | null } | null>(null);
	$effect(() => {
		const d = date;
		void seriesVersion;
		if (!d || !wanted) return;
		let live = true;
		loadIntraday(d, [ENDURANCE_DAY.key]).then(
			(load) => {
				if (live) loaded = { date: d, day: enduranceDayIn(load.series) };
			},
			() => {
				if (live) loaded = { date: d, day: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let day = $derived(date && loaded?.date === date ? loaded.day : undefined);

	let complete = $derived(meta?.complete ?? false);
	let view = $derived(enduranceScoreView(route, rows, { today, complete, days, day, activities: activities.rows }));
	let dayView = $derived(view.range === "1d" ? view : null);
	let period = $derived(view.range === "1d" ? null : view);

	/* The legend wraps at the twin's item widths, so the chart knows its rows before it is drawn. */
	let width = $state(0);
</script>

<StatPageShell
	{route}
	{today}
	label={view.label}
	canGoBack={view.canGoBack}
	canGoForward={view.canGoForward}
	{onBack}
	{swap}
	history={{ title: ENDURANCE_SCORE_INDEX.title, windowDays: ENDURANCE_SCORE_INDEX.windowDays, complete, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane })}
		{@const across = width || PHONE}
		{@const contributors = view.tab === "contributors"}
		{@const legend = legendRows(view.legend, dayView ? (pane ? Math.max(0, across - 378) : Math.min(LEGEND_WIDTH.day, across - 32)) : pane ? LEGEND_WIDTH.period : Math.min(LEGEND_WIDTH.period, across - 32))}
		{@const down = period && contributors ? barsDown(pane ? paneRows(period.range) : Math.max(1, legend.length)) : null}
		{@const offset = down ? down.offset : SCORE_LAYOUT.offset}
		<div
			class="es"
			class:with-blocks={!!period && contributors && period.blocks.length > 0}
			bind:clientWidth={width}
			style:--es-dial-top="{DAY_LAYOUT.dialTop}px"
			style:--es-copy-gap="{DAY_LAYOUT.copyGap}px"
			style:--es-copy-line="{DAY_LAYOUT.copyLine}px"
			style:--es-copy-top-pane="{DAY_LAYOUT.copyTopPane}px"
			style:--es-ring-top="{RING.top}px"
			style:--es-ring-legend="{RING.legendGap}px"
			style:--es-ring-list="{RING.listGap}px"
			style:--es-ring-list-pane="{RING.listTopPane}px"
			style:--es-chart-top="{offset}px"
			style:--es-legend-gap="{BARS_LAYOUT.legendGap}px"
			style:--es-stats-gap="{down ? BARS_LAYOUT.statsGap : SCORE_LAYOUT.statsGap}px"
			style:--es-stats-top-pane="{TABS + offset + (down ? down.top : SCORE_FRAME.top) - 0.5}px"
			style:--es-legend-gap-pane="{BARS_LAYOUT.paneLegendGap}px"
			style:--es-list-gap="{BARS_LAYOUT.listGap}px"
			style:--es-blocks-gap-pane="{BARS_LAYOUT.paneBlocksGap}px"
		>
			<div class="main">
				<div class="tabs"><StatTabs {route} {swap} height={TABS} /></div>
				{#if dayView}
					{#if dayView.state === "none"}
						<div class="es-none"><StatEmpty text={dayView.empty ?? ""} /></div>
					{:else if !contributors}
						<div class="dial"><StatDial kind="endurance" gauge={dayView.gauge} /></div>
					{:else}
						<div class="es-ring">
							<StatRing
								arcs={ringArcs(dayView.ring)}
								width={RING.width}
								value={dayView.value}
								label={dayView.classWord}
								valueText={{ top: RING.valueTop, size: 47, line: 57 }}
								labelText={{ top: RING.labelTop, size: 16, line: 21 }}
							/>
						</div>
						{#if legend.length}<div class="ring-legend"><EnduranceLegend rows={legend} /></div>{/if}
					{/if}
				{:else if period}
					<div class="chart">
						{#if contributors}
							<EnduranceBarsChart bars={period.bars} range={period.range} rows={pane ? paneRows(period.range) : Math.max(1, legend.length)} empty={period.empty} {pane} />
						{:else}
							<EnduranceLineChart line={period.line} empty={period.empty} {pane} />
						{/if}
					</div>
				{/if}
			</div>
			<div class="side">
				{#if dayView && dayView.state !== "none"}
					{#if !contributors}
						{#if dayView.copy}<p class="copy">{dayView.copy}</p>{/if}
					{:else if dayView.rows.length}
						<div class="day-list"><EnduranceRows rows={dayView.rows} /></div>
					{/if}
				{:else if period}
					{#if contributors && legend.length}
						<div class="legend"><EnduranceLegend rows={legend} align={pane ? "start" : "center"} /></div>
					{/if}
					<div class="es-figures"><EnduranceStats figures={period.figures} /></div>
				{/if}
			</div>
			{#if period && contributors && period.blocks.length}
				<div class="list"><EnduranceBlocks blocks={period.blocks} /></div>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The phone (581:9, 581:110, 581:222, 582:108105): the tabs 7.33 under the
	 * header (y 172.33), then the day's dial or ring, or the period's chart,
	 * at the twin's offsets from the tabs' foot (`endurance-score-charts.ts`).
	 * The copy, the list, the legend and Avg / Max follow; the period lists
	 * last, edge to edge, 54 over the frame's end.
	 */
	.es {
		padding-bottom: 35px;
	}
	.es.with-blocks {
		padding-bottom: 54px;
	}
	.tabs {
		margin-top: 7.33px;
	}
	.dial,
	.es-ring {
		display: flex;
		justify-content: center;
	}
	.dial {
		margin-top: var(--es-dial-top);
	}
	.es-ring {
		margin-top: var(--es-ring-top);
	}
	/* No score yet, or before the history: the line where the dial or the ring would be (582:109893, 582:109958). */
	.es-none {
		position: relative;
		height: 196px;
		margin-top: var(--es-dial-top);
	}
	.es-none :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
	/* Paragraph (16) on the twin's 20.11 pitch, its first line 8.47 under the dial's box. */
	.copy {
		margin: var(--es-copy-gap) 0 0;
		padding: 0 16px;
		font-size: 16px;
		line-height: var(--es-copy-line);
		color: var(--text-normal);
	}
	.ring-legend {
		margin-top: var(--es-ring-legend);
	}
	.day-list {
		margin-top: var(--es-ring-list);
	}
	.chart {
		margin-top: var(--es-chart-top);
	}
	.legend {
		margin-top: var(--es-legend-gap);
	}
	.es-figures {
		margin-top: var(--es-stats-gap);
	}
	.list {
		margin-top: var(--es-list-gap);
	}

	/* From 640 pt the shell pads the body: the day's list becomes a card, as the period lists do. */
	@container (min-width: 640px) {
		.es,
		.es.with-blocks {
			padding-bottom: 0;
		}
		.day-list {
			overflow: hidden;
			border-radius: var(--radius-m, 8px);
		}
	}

	/*
	 * The twins' panes (584:1723 … 585:110509): the tabs 32 under the
	 * header's rule over the 748 pt column only; under them the dial, the
	 * ring with a one-row legend, or the chart, at the phone's offsets. The
	 * 370 pt column beside them holds the copy (its first line 79.19 under
	 * the tabs' top), the list card (level with the ring's top), or Avg / Max
	 * with their rule level with the top gridline and the legend 22.67 under
	 * them. The period lists follow 30 under the chart, three blocks a row.
	 */
	@container (min-width: 1000px) {
		.es {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			grid-template-areas: "main side" "list list";
			column-gap: 8px;
			align-items: start;
			margin-top: 32px;
		}
		.tabs {
			margin-top: 0;
		}
		.main {
			grid-area: main;
			min-width: 0;
		}
		.side {
			grid-area: side;
			display: flex;
			flex-direction: column;
			min-width: 0;
		}
		.list {
			grid-area: list;
			margin-top: var(--es-blocks-gap-pane);
		}
		.copy {
			margin-top: var(--es-copy-top-pane);
			padding: 0;
		}
		.day-list {
			margin-top: var(--es-ring-list-pane);
		}
		.es-figures {
			order: -1;
			margin-top: var(--es-stats-top-pane);
		}
		.legend {
			margin-top: var(--es-legend-gap-pane);
		}
	}
</style>
