<script lang="ts">
	import { dayCardRoute, dayOf, weekCardRoute, type PeriodRoute } from "../../../dashboard/periods";
	import { stressDayView, stressPeriodView, type StressData } from "../../../dashboard/stress-pages";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import type { SleepRow } from "../../../sync/sleep-index";
	import { STRESS_DAY, STRESS_INDEX, stressDayIn, type StressDay, type StressRow } from "../../../sync/stress-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatPageShell from "../health/StatPageShell.svelte";
	import { STRESS_COLORS } from "./colors";
	import DayBody from "./DayBody.svelte";
	import PeriodBody from "./PeriodBody.svelte";

	/**
	 * Garmin Connect's Stress page: a day's ring, tiles and timeline, or a
	 * week, four weeks or a year of daily or weekly averages, in the shared
	 * page shell. A day or week card switches this page in place, as the app
	 * does, so Back still returns to Health Stats.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	/* The stress index, read again whenever a file in its folder changes. */
	let rows = $state<StressRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions.stress;
		let live = true;
		readIndex<StressRow>("stress").then(
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

	/* When each night ended, for the clock on a day's timeline. */
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

	let stressRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let day = $derived(stressRoute.range === "1d" ? dayOf(stressRoute, today) : null);

	/*
	 * A day's readings load on view, fetched if its series file lacks them,
	 * and again when a sync rewrites the file. Until they are in, the
	 * timeline shows its axes; a day Garmin had none for stays that way.
	 */
	let loaded = $state<{ date: string; readings: StressDay | null } | null>(null);
	$effect(() => {
		const date = day;
		void seriesVersion;
		if (!date) return;
		let live = true;
		loadIntraday(date, [STRESS_DAY.key]).then(
			(load) => {
				if (live) loaded = { date, readings: stressDayIn(load.series) };
			},
			() => {
				if (live) loaded = { date, readings: null };
			},
		);
		return () => {
			live = false;
		};
	});
	let readings = $derived(day && loaded?.date === day ? loaded.readings : undefined);

	let data: StressData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(day ? stressDayView({ data, route: stressRoute, today, readings, wake: wakes.get(day) }) : null);
	let periodView = $derived(day ? null : stressPeriodView({ data, route: stressRoute, today }));
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	style={STRESS_COLORS}
	history={{
		title: STRESS_INDEX.title,
		windowDays: STRESS_INDEX.windowDays,
		complete: meta?.complete ?? false,
		walking: history.stress,
		canSync,
		onSync: () => onSyncHistory("stress"),
	}}
>
	{#snippet children({ pane, move })}
		{#if dayView}
			<DayBody view={dayView} {pane} />
		{:else if periodView}
			<PeriodBody
				view={periodView}
				{pane}
				openDay={(date) => move(dayCardRoute(date, today))}
				openWeek={(weekEnd) => move(weekCardRoute(stressRoute, weekEnd, today))}
			/>
		{/if}
	{/snippet}
</StatPageShell>
