<script lang="ts">
	import { dayCardRoute, dayOf, type PeriodRoute } from "../../../dashboard/periods";
	import { BAR_WIDTH, COLUMN_BOTTOM, COLUMN_TOP, POINT_R, pulseOxPlot, spo2DayPlot } from "../../../dashboard/pulse-ox-charts";
	import { pulseOxDayView, pulseOxPeriodView, type PulseOxPageData } from "../../../dashboard/pulse-ox-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { PULSE_OX_INDEX, SPO2_DAY, spo2DayIn, type PulseOxRow, type Spo2DayData } from "../../../sync/pulse-ox-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import Spo2Chart from "./Spo2Chart.svelte";
	import Spo2Gauge from "./Spo2Gauge.svelte";

	/**
	 * Garmin Connect's Pulse Ox page in the shared shell: a day's gauge, its
	 * hourly averages and figures, or a week or four weeks of daily averages
	 * with a card a day (each with a small gauge) that switches the page to
	 * that day.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	const KIND = PULSE_OX_INDEX.kind;

	let rows = $state<PulseOxRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<PulseOxRow>(KIND).then(
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

	let pageRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let date = $derived(pageRoute.range === "1d" ? dayOf(pageRoute, today) : null);

	let loaded = $state<{ date: string; day: Spo2DayData | null } | null>(null);
	$effect(() => {
		const d = date;
		void seriesVersion;
		if (!d) return;
		let live = true;
		loadIntraday(d, [SPO2_DAY.key]).then(
			(load) => {
				if (live) loaded = { date: d, day: spo2DayIn(load.series) };
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

	let data: PulseOxPageData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(date ? pulseOxDayView({ data, route: pageRoute, today, day }) : null);
	let periodView = $derived(date ? null : pulseOxPeriodView({ data, route: pageRoute, today }));
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	history={{ title: PULSE_OX_INDEX.title, windowDays: PULSE_OX_INDEX.windowDays, complete: meta?.complete ?? false, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane, move })}
		<div class="pulse-ox">
			{#if dayView}
				<div class="day">
					<div class="summary">
						<div class="gauge"><Spo2Gauge value={dayView.gauge} label="SpO₂" /></div>
						{#if dayView.gauge !== undefined}
							<div class="figures"><StatFigures figures={dayView.figures} /></div>
						{:else}
							<p class="none">No data available.</p>
						{/if}
					</div>
					{#if dayView.state === "drawn"}
						<div class="chart">
							<Spo2Chart {pane} empty={false} plot={(width) => spo2DayPlot(dayView, width, pane)}>
								{#snippet marks(p)}
									{#each p.bars as bar}<line class="bar {bar.band}" x1={bar.x} x2={bar.x} y1={bar.top} y2={bar.bottom} stroke-width={BAR_WIDTH} />{/each}
								{/snippet}
							</Spo2Chart>
						</div>
					{/if}
				</div>
			{:else if periodView}
				<div class="overview">
					<div class="chart">
						<Spo2Chart {pane} empty={!periodView.points.length} plot={(width) => pulseOxPlot(periodView, width, pane)}>
							{#snippet marks(p)}
								{#each p.columns as x}<line class="column" x1={x} x2={x} y1={COLUMN_TOP} y2={COLUMN_BOTTOM} />{/each}
								{#each p.points as point}<circle class="point {point.band}" cx={point.x} cy={point.y} r={POINT_R} />{/each}
							{/snippet}
						</Spo2Chart>
					</div>
					<div class="figures"><StatFigures figures={periodView.figures} /></div>
				</div>
				<StatCardList items={periodView.days.map((d) => ({ key: d.date, title: d.weekday, detail: d.detail, value: d.value, kind: "day" as const, avg: d.avg, onclick: () => move(dayCardRoute(d.date, today)) }))}>
					{#snippet visual(card)}<Spo2Gauge value={card.avg} size={30} stroke={3} />{/snippet}
				</StatCardList>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/* The twin's spo2/* aliases: the gauge's bands and its empty grey. */
	.pulse-ox {
		--spo2-high: var(--color-green);
		--spo2-mid: var(--color-yellow);
		--spo2-low: var(--color-orange);
		--spo2-poor: var(--color-red);
		--spo2-none: var(--text-faint);
	}
	.gauge {
		display: flex;
		justify-content: center;
		padding-top: 22px;
	}
	.none {
		margin: 70px 0 0;
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
	}
	.summary .figures {
		padding: 24px 16px 0;
	}
	.day .chart {
		margin-top: 16px;
	}
	.overview .chart {
		margin-top: 0;
	}
	.overview .figures {
		padding: 0 16px;
	}
	.column {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.point.high,
	.bar.high {
		fill: var(--spo2-high);
		stroke: var(--spo2-high);
	}
	.point.mid,
	.bar.mid {
		fill: var(--spo2-mid);
		stroke: var(--spo2-mid);
	}
	.point.low,
	.bar.low {
		fill: var(--spo2-low);
		stroke: var(--spo2-low);
	}
	.point.poor,
	.bar.poor {
		fill: var(--spo2-poor);
		stroke: var(--spo2-poor);
	}
	.point {
		stroke: none;
	}
	.bar {
		stroke-linecap: round;
	}

	@container (min-width: 1000px) {
		.day,
		.overview {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 370px;
			column-gap: 8px;
			align-items: start;
			--stat-figure-gap: 16px;
		}
		.day .summary {
			grid-column: 2;
			grid-row: 1;
		}
		.day .chart {
			grid-column: 1;
			grid-row: 1;
			margin-top: 32px;
		}
		.overview .chart {
			margin-top: 32px;
		}
		.summary .figures,
		.overview .figures {
			padding: 32px 0 0;
		}
	}
</style>
