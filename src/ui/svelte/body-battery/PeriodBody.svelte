<script lang="ts">
	import type { BatteryPeriodView } from "../../../dashboard/body-battery-pages";
	import StatCardList, { type StatCardItem } from "../health/StatCardList.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import DailyValues from "./DailyValues.svelte";

	/**
	 * Seven days or four weeks: Daily Values, a low-to-high bar a day with a
	 * dot at each end, and a card a day, newest first, with its High and Low.
	 * No averages, as on the phone.
	 */
	let { view, pane, openDay }: { view: BatteryPeriodView; pane: boolean; openDay: (date: string) => void } = $props();

	let cards: Array<StatCardItem & { high: string; low: string }> = $derived(
		view.days.map((d) => ({ key: d.date, title: d.weekday, detail: d.detail, value: "", kind: "day" as const, high: d.high, low: d.low, onclick: () => openDay(d.date) })),
	);
</script>

<StatPeriodLayout>
	{#snippet chart()}
		<DailyValues {view} {pane} />
	{/snippet}
	{#snippet figures()}{/snippet}
	{#snippet list()}
		<StatCardList items={cards}>
			{#snippet visual(card)}
				<span class="pair"><span class="n">{card.high}</span><span class="l">High</span></span>
				<span class="pair"><span class="n">{card.low}</span><span class="l">Low</span></span>
			{/snippet}
		</StatCardList>
	{/snippet}
</StatPeriodLayout>

<style>
	.pair {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		min-width: 48px;
	}
	.n {
		font-size: 17px;
		font-variant-numeric: tabular-nums;
	}
	.l {
		font-size: 13px;
		color: var(--text-muted);
	}
</style>
