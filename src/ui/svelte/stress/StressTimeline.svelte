<script lang="ts">
	import { timelinePlot, type TimelinePlot } from "../../../dashboard/stress-charts";
	import type { StressTimeline } from "../../../dashboard/stress-pages";
	import StatChart from "../health/StatChart.svelte";
	import SleepLegend, { type LegendEntry } from "../sleep/SleepLegend.svelte";

	/**
	 * The 1d Daily Timeline under its title: a bar a three-minute reading,
	 * blue at rest and orange above 25, an hour's dot each, the clock where
	 * the night ended, and the key under it.
	 *
	 * Provisional until the phone is re-shot after 04:00, when its timelines
	 * drew nothing: active runs (−2) stand grey to the top, unmeasurable ones
	 * (−1) are left blank, and a day Garmin had no readings for shows the axes
	 * alone. All of that lives here, so the re-shoot changes this file.
	 */
	let { timeline, pane }: { timeline: StressTimeline; pane: boolean } = $props();

	/** The phone lists all four, whatever the day drew. */
	const LEGEND: LegendEntry[] = [
		{ kind: "dot", label: "Rest", color: "var(--stress-rest)" },
		{ kind: "dot", label: "Stress", color: "var(--stress-medium)" },
		{ kind: "dot", label: "Active", color: "var(--text-faint)" },
		{ kind: "ring", label: "Unmeasurable", color: "var(--text-muted)" },
	];
</script>

<StatChart title="Daily Timeline" {pane} plot={(width) => timelinePlot(timeline, width, pane)}>
	{#snippet under(p: TimelinePlot)}
		{#each p.active as run}<rect class="active" x={run.x} y={run.y} width={run.w} height={run.h} />{/each}
		{#each p.bars as bar}<rect class="bar {bar.tone}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />{/each}
	{/snippet}
	{#snippet over(p: TimelinePlot)}
		{#if p.marker}
			{@const k = p.marker.r / 8}
			<!-- When the night ended: the app's clock on the dot row. -->
			<g class="wake" transform="translate({p.marker.x} {p.marker.y}) scale({k})">
				<circle r="8" />
				<circle class="face" r="4.5" />
				<path class="hands" d="M0 -2.4 V0 L1.8 1.2" />
			</g>
		{/if}
	{/snippet}
	{#snippet footer()}
		<div class="legend"><SleepLegend items={LEGEND} /></div>
	{/snippet}
</StatChart>

<style>
	.bar.rest {
		fill: var(--stress-rest);
	}
	.bar.stress {
		fill: var(--stress-medium);
	}
	.active {
		fill: var(--text-faint);
	}
	.wake circle {
		fill: var(--color-blue);
	}
	.wake .face,
	.wake .hands {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-width: 1.1;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
