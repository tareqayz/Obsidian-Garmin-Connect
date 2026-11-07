<script lang="ts">
	import { batteryColumnsPlot, type BatteryColumnsPlot } from "../../../dashboard/body-battery-charts";
	import type { BatteryPeriodView } from "../../../dashboard/body-battery-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend from "../sleep/SleepLegend.svelte";

	/** Seven days or four weeks of Daily Values: a low-to-high bar a day with a dot at each end, and their key. */
	let { view, pane }: { view: BatteryPeriodView; pane: boolean } = $props();
</script>

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
</style>
