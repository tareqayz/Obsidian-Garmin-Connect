<script lang="ts">
	import { batteryDayView, batteryPeriodView, type BatteryData } from "../../../dashboard/body-battery-pages";
	import { dayCardRoute, dayOf, type PeriodRoute } from "../../../dashboard/periods";
	import { shiftDate } from "../../../dashboard/series";
	import { BODY_BATTERY_INDEX, MOVE_IQ_KEY, NAPS_KEY, marksIn, type BatteryRow, type DayMark } from "../../../sync/body-battery-index";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import type { BodyBatteryMarker } from "../../../sync/intraday";
	import type { SleepRow } from "../../../sync/sleep-index";
	import { STRESS_DAY, stressDayIn, type StressDay } from "../../../sync/stress-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatPageShell from "../health/StatPageShell.svelte";
	import { BATTERY_COLORS } from "./colors";
	import DayBody from "./DayBody.svelte";
	import PeriodBody from "./PeriodBody.svelte";

	/**
	 * Garmin Connect's Body Battery page in the shared shell: a day's gauge or
	 * ring, tiles, timeline and Factors, or seven days or four weeks of daily
	 * highs and lows. A day card switches this page in place.
	 */
	let { route, today, canSync, onBack, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history, activities }: HealthStatPageProps = $props();

	const KIND = BODY_BATTERY_INDEX.kind;

	let rows = $state<BatteryRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<BatteryRow>(KIND).then(
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

	/* Each night's sleep time, start and end, for the Sleep row and the timeline's Zz and alarm clock. */
	let nights = $state<Map<string, SleepRow>>(new Map());
	$effect(() => {
		void versions.sleep;
		let live = true;
		readIndex<SleepRow>("sleep").then(
			(index) => {
				if (live) nights = new Map(index.rows.map((r) => [r.date, r]));
			},
			() => {},
		);
		return () => {
			live = false;
		};
	});

	let pageRoute: PeriodRoute = $derived(route.date ? { range: route.range, offset: route.offset, date: route.date } : { range: route.range, offset: route.offset });
	let day = $derived(pageRoute.range === "1d" ? dayOf(pageRoute, today) : null);

	/* The day's curve and events load on view, and again when a sync rewrites the file. */
	let loaded = $state<{ date: string; readings: StressDay | null; events: BodyBatteryMarker[]; naps: DayMark[]; moveIq: DayMark[] } | null>(null);
	$effect(() => {
		const date = day;
		void seriesVersion;
		if (!date) return;
		let live = true;
		loadIntraday(date, [STRESS_DAY.key, "bodyBatteryEvents", NAPS_KEY, MOVE_IQ_KEY]).then(
			(load) => {
				if (live)
					loaded = {
						date,
						readings: stressDayIn(load.series),
						events: load.series?.bodyBatteryEvents ?? [],
						naps: marksIn(load.series, NAPS_KEY),
						moveIq: marksIn(load.series, MOVE_IQ_KEY),
					};
			},
			() => {
				if (live) loaded = { date, readings: null, events: [], naps: [], moveIq: [] };
			},
		);
		return () => {
			live = false;
		};
	});
	let current = $derived(day && loaded?.date === day ? loaded : null);

	let data: BatteryData = $derived({ rows, complete: meta?.complete ?? false });
	let night = $derived(day ? nights.get(day) : undefined);
	let nextBed = $derived(day ? nights.get(shiftDate(day, 1))?.bed : undefined);
	let dayView = $derived(
		day
			? batteryDayView({
					data,
					route: pageRoute,
					today,
					readings: current ? current.readings : undefined,
					events: current?.events,
					sleep: night ? { seconds: night.seconds, wake: night.wake, bed: night.bed } : null,
					marks: { nextBed, naps: current?.naps, moveIq: current?.moveIq, activities: activities.rows },
				})
			: null,
	);
	let periodView = $derived(day ? null : batteryPeriodView({ data, route: pageRoute, today }));
</script>

<StatPageShell
	{route}
	{today}
	label={dayView?.label ?? periodView?.label ?? ""}
	canGoBack={dayView?.canGoBack ?? periodView?.canGoBack ?? false}
	{onBack}
	{swap}
	style={BATTERY_COLORS}
	history={{
		title: BODY_BATTERY_INDEX.title,
		complete: meta?.complete ?? false,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children({ pane, move })}
		{#if dayView}
			<DayBody view={dayView} {pane} />
		{:else if periodView}
			<PeriodBody view={periodView} {pane} openDay={(date) => move(dayCardRoute(date, today))} />
		{/if}
	{/snippet}
</StatPageShell>
