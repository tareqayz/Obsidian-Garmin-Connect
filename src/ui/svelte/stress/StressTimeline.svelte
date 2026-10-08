<script lang="ts">
	import { timelinePlot } from "../../../dashboard/stress-charts";
	import type { StressTimeline } from "../../../dashboard/stress-pages";
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

	let measured = $state(0);
	let width = $derived(measured || (pane ? 748 : 402));
	let plot = $derived(timelinePlot(timeline, width, pane));

	/** The phone lists all four, whatever the day drew. */
	const LEGEND: LegendEntry[] = [
		{ kind: "dot", label: "Rest", color: "var(--stress-rest)" },
		{ kind: "dot", label: "Stress", color: "var(--stress-medium)" },
		{ kind: "dot", label: "Active", color: "var(--text-faint)" },
		{ kind: "ring", label: "Unmeasurable", color: "var(--text-muted)" },
	];
</script>

<figure class="stress-timeline">
	<figcaption>Daily Timeline</figcaption>
	<div class="canvas" bind:clientWidth={measured} style:height="{plot.height}px">
		<!-- The figures are in the tiles; the chart shows the day's shape. -->
		<svg width={plot.width} height={plot.height} aria-hidden="true">
			{#each plot.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={plot.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each plot.active as run}<rect class="active" x={run.x} y={run.y} width={run.w} height={run.h} />{/each}
			{#each plot.bars as bar}<rect class="bar {bar.tone}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />{/each}
			{#each plot.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each plot.labels as label}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/each}
			{#if plot.marker}
				{@const k = plot.marker.r / 8}
				<!-- When the night ended: the app's clock on the dot row. -->
				<g class="wake" transform="translate({plot.marker.x} {plot.marker.y}) scale({k})">
					<circle r="8" />
					<circle class="face" r="4.5" />
					<path class="hands" d="M0 -2.4 V0 L1.8 1.2" />
				</g>
			{/if}
		</svg>
	</div>
	<div class="legend"><SleepLegend items={LEGEND} /></div>
</figure>

<style>
	.stress-timeline {
		margin: 0;
		min-width: 0;
	}
	figcaption {
		height: 22px;
		padding-left: var(--stress-title-indent, 9.6px);
		font-size: 18px;
		line-height: 22px;
		font-weight: 400;
		color: var(--text-normal);
	}
	.canvas {
		position: relative;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 0.5;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.bar.rest {
		fill: var(--stress-rest);
	}
	.bar.stress {
		fill: var(--stress-medium);
	}
	.active {
		fill: var(--text-faint);
	}
	.dot {
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
