<script lang="ts">
	import { BAR_WIDTH, DOT_R, MARKER_R, timelinePlot, type TimelinePlot } from "../../../dashboard/respiration-charts";
	import type { RespirationTimeline } from "../../../dashboard/respiration-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/**
	 * The 1d Daily Timeline: an hour's bar from its low to its high, a blue
	 * dot at the high and a faint one at the low, the average line through
	 * the hours, and the night's markers on the dot row ("zz" where it began,
	 * a clock where it ended). High/Low Rates off leaves the line alone.
	 */
	let { timeline, pane, highLow }: { timeline: RespirationTimeline; pane: boolean; highLow: boolean } = $props();

	let legend: LegendEntry[] = $derived([
		{ kind: "line", label: "Avg Respiration Rate", color: "var(--respiration-line)" },
		...(highLow
			? ([
					{ kind: "dot", label: "High", color: "var(--respiration-high)" },
					{ kind: "dot", label: "Low", color: "var(--respiration-low)" },
				] as LegendEntry[])
			: []),
	]);
</script>

<StatChart title="Daily Timeline" {pane} plot={(width) => timelinePlot(timeline, width, pane)}>
	{#snippet under(p: TimelinePlot)}
		{#if highLow}
			{#each p.bars as bar}
				<rect class="bar" x={bar.x - BAR_WIDTH / 2} y={bar.top} width={BAR_WIDTH} height={Math.max(0, bar.bottom - bar.top)} rx={BAR_WIDTH / 2} />
			{/each}
		{/if}
	{/snippet}
	{#snippet over(p: TimelinePlot)}
		{#if p.line}<path class="avg" d={p.line} />{/if}
		{#if highLow}
			{#each p.lows as d}<circle class="low" cx={d.x} cy={d.y} r={DOT_R} />{/each}
			{#each p.highs as d}<circle class="high" cx={d.x} cy={d.y} r={DOT_R} />{/each}
		{/if}
		{#each p.markers as m}
			<g class="marker" transform="translate({m.x} {m.y})">
				<circle class="ring" r={MARKER_R} />
				<circle class="disc" r={6.5} />
				{#if m.kind === "sleep"}
					<text class="zz" text-anchor="middle" dominant-baseline="central">zz</text>
				{:else}
					<circle class="face" r="3.6" />
					<path class="hands" d="M0 -2 V0 L1.4 1" />
				{/if}
			</g>
		{/each}
	{/snippet}
	{#snippet footer()}
		<div class="legend"><SleepLegend items={legend} /></div>
	{/snippet}
</StatChart>

<style>
	.bar {
		fill: var(--respiration-bar);
	}
	.avg {
		fill: none;
		stroke: var(--respiration-line);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	.high {
		fill: var(--respiration-high);
	}
	.low {
		fill: var(--respiration-low);
	}
	.marker .ring {
		fill: var(--background-primary);
	}
	.marker .disc {
		fill: var(--respiration-high);
	}
	.zz {
		fill: var(--text-on-accent);
		font-size: 6px;
		font-weight: 700;
	}
	.face,
	.hands {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-width: 1;
		stroke-linecap: round;
	}
	.legend {
		height: 32.5px;
		font-size: 12px;
	}
</style>
