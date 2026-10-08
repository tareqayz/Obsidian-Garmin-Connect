<script lang="ts">
	import { fitnessCurrentView, fitnessTrendView } from "../../../dashboard/fitness-age-pages";
	import { weekCardRoute, type PeriodRoute } from "../../../dashboard/periods";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { FITNESS_AGE_DAY, FITNESS_AGE_INDEX, fitnessAgeDayIn, type FitnessAgeDay, type FitnessAgeRow } from "../../../sync/fitness-age-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList from "../health/StatCardList.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import AgeTrack from "./AgeTrack.svelte";
	import BmiSheet from "./BmiSheet.svelte";
	import FactorCards from "./FactorCards.svelte";
	import FitnessTrend from "./FitnessTrend.svelte";

	/**
	 * Garmin Connect's Fitness Age page: Current (the day's computation, its
	 * factors grouped as the app groups them) and the 7d / 4w / 1y trends
	 * from the index. Twin: page 239:24.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	const KIND = FITNESS_AGE_INDEX.kind;

	let rows = $state<FitnessAgeRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<FitnessAgeRow>(KIND).then(
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

	let current = $derived(route.range === "1d");

	/* Current reads today's computation on view: one request after each sync. */
	let payload = $state<FitnessAgeDay | null | undefined>(undefined);
	$effect(() => {
		void seriesVersion;
		if (!current) return;
		let live = true;
		loadIntraday(today, [FITNESS_AGE_DAY.key]).then(
			(load) => {
				if (live) payload = fitnessAgeDayIn(load.series);
			},
			() => {
				if (live) payload = null;
			},
		);
		return () => {
			live = false;
		};
	});

	let faRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let currentView = $derived(current ? fitnessCurrentView(payload, rows) : null);
	let trendView = $derived(current ? null : fitnessTrendView({ rows, complete: meta?.complete ?? false, route: faRoute, today }));

	let sheetOpen = $state(false);
</script>

<StatPageShell
	{route}
	{today}
	label={trendView?.label ?? null}
	canGoBack={trendView?.canGoBack ?? false}
	{onBack}
	{swap}
	history={current
		? undefined
		: {
				title: FITNESS_AGE_INDEX.title,
				windowDays: FITNESS_AGE_INDEX.windowDays,
				complete: meta?.complete ?? false,
				walking: history[KIND],
				canSync,
				onSync: () => onSyncHistory(KIND),
			}}
>
	{#snippet children({ pane, move })}
		{#if currentView}
			<div class="fa-current">
				<div class="hero">
					{#if currentView.updated}<p class="updated">{currentView.updated}</p>{/if}
					<div class="track">
						<AgeTrack
							main={{ label: "Fitness Age", value: currentView.fitnessAge, at: currentView.track.fitness }}
							other={currentView.age !== undefined && currentView.track.age !== undefined ? { label: "Age", value: currentView.age, at: currentView.track.age } : undefined}
						/>
					</div>
					{#if currentView.headline}<p class="headline">{currentView.headline}</p>{/if}
					{#if currentView.state === "empty"}<p class="headline">Not enough data yet to calculate your Fitness Age.</p>{/if}
				</div>
				<div class="group"><FactorCards heading="Recommendations" cards={currentView.recommendations} onopen={() => (sheetOpen = true)} /></div>
				<div class="group"><FactorCards heading="On Target" cards={currentView.onTarget} check /></div>
			</div>
			{#if sheetOpen && currentView.bmi}<BmiSheet sheet={currentView.bmi} {pane} onclose={() => (sheetOpen = false)} />{/if}
		{:else if trendView}
			<div class="fa-period" class:with-weeks={trendView.weeks.length > 0}>
				<div class="chart"><FitnessTrend view={trendView} {pane} /></div>
				{#if trendView.weeks.length}
					<div class="weeks">
						<StatCardList
							items={trendView.weeks.map((w) => ({ key: w.from, title: w.title, value: w.value, kind: "week" as const, onclick: () => move(weekCardRoute(faRoute, w.to, today)) }))}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{/snippet}
</StatPageShell>

<style>
	.fa-current {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		row-gap: 24px;
		padding: 0 16px 24px;
	}
	.updated {
		margin: 0;
		font-size: 14px;
		color: var(--text-muted);
	}
	.track {
		margin-top: 32px;
	}
	.headline {
		margin: 24px 0 0;
		font-size: 17px;
		line-height: 22px;
		text-align: center;
	}
	.fa-period .chart {
		margin-top: 14.4px;
	}
	.weeks {
		margin-top: 24px;
		padding-top: 16px;
		background: var(--background-secondary-alt, var(--background-secondary));
	}
	.weeks :global(.stat-card-list) {
		margin-top: 0;
	}
	.weeks :global(.stat-card) {
		background: var(--background-primary);
	}

	@container (min-width: 640px) {
		.fa-current {
			padding: 0 0 24px;
		}
	}

	/* The twins' panes: hero | recommendations | on target; the 1y chart beside its weeks. */
	@container (min-width: 1000px) {
		.fa-current {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			column-gap: 16px;
			padding-top: 32px;
			align-items: start;
		}
		.fa-period .chart {
			margin-top: 32px;
		}
		.fa-period.with-weeks {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 402px;
			column-gap: 0;
			align-items: start;
		}
		.weeks {
			margin-top: 16px;
		}
		.weeks :global(.stat-card-list) {
			grid-template-columns: minmax(0, 1fr);
			padding: 0 16px 16px;
		}
	}
</style>
