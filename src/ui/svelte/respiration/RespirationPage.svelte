<script lang="ts">
	import { dayCardRoute, dayOf, type PeriodRoute } from "../../../dashboard/periods";
	import { respirationDayView, respirationPeriodView, type RespirationPageData, type RespirationStat } from "../../../dashboard/respiration-pages";
	import { sleepRoute } from "../../../dashboard/routes";
	import type { DayIndexMeta } from "../../../sync/day-index";
	import { RESPIRATION_DAY, RESPIRATION_INDEX, respirationDayIn, type RespirationDayData, type RespirationRow } from "../../../sync/respiration-index";
	import type { HealthStatPageProps } from "../health/pages";
	import StatCardList, { type StatCardItem } from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPageShell from "../health/StatPageShell.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import DayValues from "./DayValues.svelte";
	import RespirationAverages from "./RespirationAverages.svelte";
	import RespirationTimeline from "./RespirationTimeline.svelte";
	import SleepAverages from "./SleepAverages.svelte";

	/**
	 * Garmin Connect's Respiration page in the shared shell: a day's timeline
	 * with its Lowest, Highest and Awake Avg and the nights around it, or a
	 * week or four weeks of Sleep and Awake averages with a card a day. A day
	 * card switches the page in place; a night card opens the Sleep page.
	 */
	let { route, today, canSync, onBack, go, swap, readIndex, loadIntraday, onSyncHistory, versions, seriesVersion, history }: HealthStatPageProps = $props();

	const KIND = RESPIRATION_INDEX.kind;

	let rows = $state<RespirationRow[]>([]);
	let meta = $state<DayIndexMeta | null>(null);
	$effect(() => {
		void versions[KIND];
		let live = true;
		readIndex<RespirationRow>(KIND).then(
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

	let loaded = $state<{ date: string; day: RespirationDayData | null } | null>(null);
	$effect(() => {
		const d = date;
		void seriesVersion;
		if (!d) return;
		let live = true;
		loadIntraday(d, [RESPIRATION_DAY.key]).then(
			(load) => {
				if (live) loaded = { date: d, day: respirationDayIn(load.series) };
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

	let highLow = $state(true);

	let data: RespirationPageData = $derived({ rows, complete: meta?.complete ?? false });
	let dayView = $derived(date ? respirationDayView({ data, route: pageRoute, today, day }) : null);
	let periodView = $derived(date ? null : respirationPeriodView({ data, route: pageRoute, today }));

	const figure = (s: RespirationStat) => ({ value: s.unit ? `${s.value} ${s.unit}` : s.value, label: s.label });

	type Card = StatCardItem & { sleep: string; awake: string };
	let cards: Card[] = $derived(
		(periodView?.days ?? []).map((d) => ({ key: d.date, title: d.weekday, detail: d.detail, value: "", kind: "day" as const, sleep: d.sleep, awake: d.awake, onclick: () => {} })),
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
		title: RESPIRATION_INDEX.title,
		windowDays: RESPIRATION_INDEX.windowDays,
		complete: meta?.complete ?? false,
		walking: history[KIND],
		canSync,
		onSync: () => onSyncHistory(KIND),
	}}
>
	{#snippet children({ pane, move })}
		<div class="respiration">
			{#if dayView}
				<StatPeriodLayout>
					{#snippet chart()}
						<RespirationTimeline timeline={dayView.timeline} {pane} {highLow} />
						<div class="chips">
							<button class="chip" class:on={highLow} aria-pressed={highLow} onclick={() => (highLow = !highLow)}>High/Low Rates</button>
						</div>
					{/snippet}
					{#snippet figures()}<StatFigures figures={dayView.stats.map(figure)} />{/snippet}
					{#snippet list()}<SleepAverages nights={dayView.sleep} open={(night) => go(sleepRoute(night.sleepOffset))} />{/snippet}
				</StatPeriodLayout>
			{:else if periodView}
				<StatPeriodLayout>
					{#snippet chart()}<RespirationAverages view={periodView} {pane} />{/snippet}
					{#snippet figures()}<StatFigures figures={periodView.stats.map(figure)} />{/snippet}
					{#snippet list()}
						<StatCardList items={cards.map((c) => ({ ...c, onclick: () => move(dayCardRoute(c.key, today)) }))}>
							{#snippet visual(card)}<DayValues sleep={card.sleep} awake={card.awake} />{/snippet}
						</StatCardList>
					{/snippet}
				</StatPeriodLayout>
			{/if}
		</div>
	{/snippet}
</StatPageShell>

<style>
	/*
	 * The twin's respiration/* aliases. Low is text-faint and Active base-50 in
	 * the twin; they read almost alike, so the low dot keeps text-faint and
	 * Active (not drawn yet) would take base-50.
	 */
	.respiration {
		--stat-chart-top: 27.1px;
		--respiration-high: var(--color-blue);
		--respiration-low: var(--text-faint);
		--respiration-bar: var(--background-modifier-border);
		--respiration-active: var(--color-base-50);
		--respiration-line: var(--text-normal);
		--respiration-sleep: var(--color-blue);
		--respiration-awake: var(--color-cyan);
	}
	.chips {
		display: flex;
		gap: 8px;
		padding: 25px 16px 0;
	}
	.chip {
		height: 36px;
		margin: 0;
		padding: 0 15px;
		border: 1px solid var(--text-normal);
		border-radius: 18px;
		box-shadow: none;
		background: transparent;
		color: var(--text-normal);
		font: inherit;
		font-size: 16px;
		cursor: pointer;
	}
	.chip.on {
		border-color: var(--color-base-50);
		background: var(--color-base-50);
		color: var(--text-on-accent);
	}
	@container (min-width: 1000px) {
		.chips {
			padding-left: 0;
		}
	}
</style>
