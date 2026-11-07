<script lang="ts">
	import { dayCardRoute, dayOf, type PeriodRoute } from "../../../dashboard/periods";
	import { pulseOxDayView, pulseOxPeriodView, type PulseOxPageData } from "../../../dashboard/pulse-ox-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { PULSE_OX_INDEX, SPO2_DAY, spo2DayIn, type PulseOxRow, type Spo2DayData } from "../../../sync/pulse-ox-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import { SPO2_COLORS } from "./colors";
	import DayChart from "./DayChart.svelte";
	import PeriodChart from "./PeriodChart.svelte";
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
	history={{ title: PULSE_OX_INDEX.title, complete: meta?.complete ?? false, walking: history[KIND], canSync, onSync: () => onSyncHistory(KIND) }}
>
	{#snippet children({ pane, move })}
		<div class="pulse-ox" style={SPO2_COLORS}>
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
						<div class="chart"><DayChart view={dayView} {pane} /></div>
					{/if}
				</div>
			{:else if periodView}
				<div class="overview">
					<div class="chart"><PeriodChart view={periodView} {pane} /></div>
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
