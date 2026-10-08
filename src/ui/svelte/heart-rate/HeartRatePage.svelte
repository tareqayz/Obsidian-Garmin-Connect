<script lang="ts">
	import { heartRateDayView, heartRatePeriodView, type HeartRatePageData, type HeartRateStat } from "../../../dashboard/heart-rate-pages";
	import { dayCardRoute, dayOf, weekCardRoute, type PeriodRoute } from "../../../dashboard/periods";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { HEART_DAY, HEART_RATE_INDEX, heartDayIn, type HeartDay, type HeartRateRow } from "../../../sync/heart-rate-index";
	import type { SleepRow } from "../../../sync/sleep-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList, { type StatCardItem } from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import DayValues from "./DayValues.svelte";
	import HeartRateCurve from "./HeartRateCurve.svelte";
	import HeartRateReadings from "./HeartRateReadings.svelte";

	/**
	 * Garmin Connect's Heart Rate page in the shared shell: a day's timeline
	 * with its Resting and High, or a week, four weeks or a year of daily or
	 * weekly readings with their averages and cards. A card switches the page
	 * in place, as the app does.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	const KIND = HEART_RATE_INDEX.kind;

	let rows = $state<HeartRateRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<HeartRateRow>(KIND).then(
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

	let wakes = $state<Map<string, number>>(new Map());
	$effect(() => {
		void versions.sleep;
		let live = true;
		readIndex<SleepRow>("sleep").then(
			(index) => {
				if (live) wakes = new Map(index.rows.flatMap((r) => (r.wake !== undefined ? [[r.date, r.wake] as [string, number]] : [])));
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let hrRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let day = $derived(hrRoute.range === "1d" ? dayOf(hrRoute, today) : null);

	/* The day's samples load on view; one request carries the curve and Garmin's figures. */
	let loaded = $state<{ date: string; samples: HeartDay | null } | null>(null);
	$effect(() => {
		const date = day;
		void seriesVersion;
		if (!date) return;
		let live = true;
		loadIntraday(date, [HEART_DAY.key]).then(
			(load) => {
				if (live) loaded = { date, samples: heartDayIn(load.series) };
			},
			() => {
				if (live) loaded = { date, samples: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let samples = $derived(day && loaded?.date === day ? loaded.samples : undefined);

	let data: HeartRatePageData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(day ? heartRateDayView({ data, route: hrRoute, today, samples, wake: wakes.get(day) }) : null);
	let periodView = $derived(day ? null : heartRatePeriodView({ data, route: hrRoute, today }));

	const figure = (s: HeartRateStat) => ({ value: s.unit ? `${s.value} ${s.unit}` : s.value, label: s.label });

	type Card = StatCardItem & { resting: string; high: string };
	let cards: Card[] = $derived(
		!periodView
			? []
			: periodView.days.length
				? periodView.days.map((d) => ({ key: d.date, title: d.weekday, detail: d.detail, value: "", kind: "day" as const, resting: d.resting, high: d.high, onclick: () => {} }))
				: periodView.weeks.map((w) => ({ key: w.from, title: w.title, value: "", kind: "week" as const, resting: w.resting, high: w.high, onclick: () => {} })),
	);
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	history={{
		title: HEART_RATE_INDEX.title,
		windowDays: HEART_RATE_INDEX.windowDays,
		complete: meta?.complete ?? false,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children({ pane, move })}
		<div class="heart-rate">
			{#if dayView}
				<StatPeriodLayout>
					{#snippet chart()}<HeartRateCurve timeline={dayView.timeline} {pane} today={dayView.date === today} />{/snippet}
					{#snippet figures()}<StatFigures figures={dayView.stats.map(figure)} />{/snippet}
				</StatPeriodLayout>
			{:else if periodView}
				<StatPeriodLayout>
					{#snippet chart()}<HeartRateReadings view={periodView} {pane} />{/snippet}
					{#snippet figures()}<StatFigures figures={periodView.stats.map(figure)} />{/snippet}
					{#snippet list()}
						<StatCardList
							items={cards.map((c) => ({
								...c,
								onclick: () => move(c.kind === "day" ? dayCardRoute(c.key, today) : weekCardRoute(hrRoute, periodView.weeks.find((w) => w.from === c.key)!.to, today)),
							}))}
						>
							{#snippet visual(card)}<DayValues resting={card.resting} high={card.high} />{/snippet}
						</StatCardList>
					{/snippet}
				</StatPeriodLayout>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/* The twin's heart-rate/* colours (Light / Dark); the zones run slate, blue, light blue, green, orange, red. */
	.heart-rate {
		--stat-chart-top: 27.1px;
		--heart-rate-resting: var(--color-blue);
		--heart-rate-high: var(--color-red);
		--heart-rate-resting-legend: #0a4ea8;
		--heart-rate-zone-0: #8f9ba6;
		--heart-rate-zone-1: var(--color-blue);
		--heart-rate-zone-2: #4c9cf0;
		--heart-rate-zone-3: var(--color-green);
		--heart-rate-zone-4: var(--color-orange);
		--heart-rate-zone-5: var(--color-red);
	}
	:global(.theme-dark) .heart-rate {
		--heart-rate-resting-legend: #5c9dff;
		--heart-rate-zone-0: #6f8594;
		--heart-rate-zone-2: #54a9fe;
	}
</style>
