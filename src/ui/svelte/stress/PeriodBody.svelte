<script lang="ts">
	import { CARD_RING } from "../../../dashboard/stress-charts";
	import type { RingPart, StressPeriodView } from "../../../dashboard/stress-pages";
	import StatCardList, { type StatCardItem } from "../health/StatCardList.svelte";
	import StatFigures from "../health/StatFigures.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import StressLineChart from "./StressLineChart.svelte";
	import StressRing from "./StressRing.svelte";

	/**
	 * A week, four weeks or a year: the line, the period's average, and a card
	 * a day, newest first, with its mini ring, or a card a week with data.
	 */
	interface Props {
		view: StressPeriodView;
		pane: boolean;
		openDay: (date: string) => void;
		openWeek: (weekEnd: string) => void;
	}

	let { view, pane, openDay, openWeek }: Props = $props();

	/* The phone shows the average alone; the web's Lowest and Highest stay in the view model. */
	let average = $derived(view.stats.slice(0, 1).map((s) => ({ value: s.value, label: s.label })));

	let cards: Array<StatCardItem & { ring?: RingPart[] }> = $derived(
		view.days.length
			? view.days.map((d) => ({ key: d.date, title: d.weekday, detail: d.detail, value: d.value, kind: "day" as const, ring: d.ring, onclick: () => openDay(d.date) }))
			: view.weeks.map((w) => ({ key: w.from, title: w.title, value: w.value, kind: "week" as const, onclick: () => openWeek(w.to) })),
	);
</script>

<StatPeriodLayout>
	{#snippet chart()}
		<StressLineChart {view} {pane} />
	{/snippet}
	{#snippet figures()}
		<StatFigures figures={average} />
	{/snippet}
	{#snippet list()}
		{#if cards.length}
			<StatCardList items={cards}>
				{#snippet visual(card)}
					{#if card.ring}<StressRing parts={card.ring} size={CARD_RING.size} thickness={CARD_RING.thickness} />{/if}
				{/snippet}
			</StatCardList>
		{/if}
	{/snippet}
</StatPeriodLayout>
