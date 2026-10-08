<script lang="ts">
	import { curvePlot, type CurvePlot } from "../../../dashboard/heart-rate-charts";
	import type { HeartRateTimeline } from "../../../dashboard/heart-rate-pages";
	import StatChart from "../health/StatChart.svelte";

	/**
	 * The 1d Daily Timeline: the day's two-minute averages on the fixed 210 /
	 * 162 / 115 / 67 axis, shaded by zone from slate to red; today's line is
	 * flat slate. No markers and no key, as on the phone. Move IQ and activity
	 * rows under the figures are not drawn (Inferred: they need other payloads).
	 */
	let { timeline, pane, today }: { timeline: HeartRateTimeline; pane: boolean; today: boolean } = $props();

	const id = `hr-zones-${Math.random().toString(36).slice(2, 8)}`;
</script>

<StatChart title="Daily Timeline" {pane} plot={(width) => curvePlot(timeline, width, pane, today)}>
	{#snippet over(p: CurvePlot)}
		{#if p.tone === "zones"}
			<defs>
				<!-- y runs down: the highest bpm's stop first. -->
				<linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={p.stops[p.stops.length - 1]!.y} y2={p.stops[0]!.y}>
					{#each [...p.stops].reverse() as stop, i}
						<stop offset={(i / (p.stops.length - 1)).toFixed(4)} stop-color="var(--heart-rate-zone-{stop.zone})" />
					{/each}
				</linearGradient>
			</defs>
		{/if}
		{#if p.line}<path class="curve" d={p.line} stroke={p.tone === "zones" ? `url(#${id})` : "var(--heart-rate-zone-0)"} />{/if}
		{#if p.marker}
			{@const k = p.marker.r / 8}
			<g class="wake" transform="translate({p.marker.x} {p.marker.y}) scale({k})">
				<circle r="8" />
				<circle class="face" r="4.5" />
				<path class="hands" d="M0 -2.4 V0 L1.8 1.2" />
			</g>
		{/if}
	{/snippet}
</StatChart>

<style>
	.curve {
		fill: none;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
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
	}
</style>
