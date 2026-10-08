<script lang="ts">
	import { batteryColumnsPlot, type BatteryColumnsPlot } from "../../../dashboard/body-battery-charts";
	import type { BatteryPeriodView } from "../../../dashboard/body-battery-pages";
	import StatCardList, { type StatCardItem } from "../health/StatCardList.svelte";
	import StatChart from "../health/StatChart.svelte";
	import StatPeriodLayout from "../health/StatPeriodLayout.svelte";
	import SleepLegend from "../sleep/SleepLegend.svelte";

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
		<StatChart title={view.title} {pane} plot={(width) => batteryColumnsPlot(view, width, pane)}>
			{#snippet under(p: BatteryColumnsPlot)}
				{#each p.bars as bar}<rect class="bar" x={bar.x} y={bar.y} width={p.barWidth} height={bar.h} rx={p.barWidth / 2} />{/each}
			{/snippet}
			{#snippet over(p: BatteryColumnsPlot)}
				{#each p.highs as d}<circle class="high" cx={d.x} cy={d.y} r={p.dotRadius} />{/each}
				{#each p.lows as d}<circle class="low" cx={d.x} cy={d.y} r={p.dotRadius} />{/each}
			{/snippet}
			{#snippet footer()}
				<SleepLegend
					items={[
						{ kind: "dot", label: "Daily High", color: "var(--battery-high)" },
						{ kind: "dot", label: "Daily Low", color: "var(--battery-low)" },
					]}
				/>
			{/snippet}
		</StatChart>
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
	.bar {
		fill: var(--battery-bar);
	}
	.high {
		fill: var(--battery-high);
	}
	.low {
		fill: var(--battery-low);
	}
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
