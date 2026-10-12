<script lang="ts">
	import { NO_DATA } from "../../../dashboard/hrv-status-copy";
	import { DISC, timelinePlot, type TimelinePlot } from "../../../dashboard/hrv-status-charts";
	import { NIGHTLY_TIMELINE, type HrvTimeline } from "../../../dashboard/hrv-status-pages";
	import StatChart from "../health/StatChart.svelte";
	import HrvLegend from "./HrvLegend.svelte";

	/**
	 * The 1d Nightly Timeline (twin 508:95933, pane 511:2120): the night's
	 * five-minute readings across the sleep window, a grey dot on each whole
	 * hour, a blue disc where sleep began ("Zz") and where it ended (an alarm
	 * clock) with the times under the plot's ends, and "— HRV" under it.
	 * Geometry is `timelinePlot`'s; `StatChart` draws the gridlines, the hour
	 * dots and the times.
	 */
	let { timeline, pane }: { timeline: HrvTimeline; pane: boolean } = $props();

	/** The Sleep Marker's 21.67 pt box (507:37), centred on the disc. */
	const C = 10.835;
</script>

<div class="hrv-timeline">
	<StatChart title={NIGHTLY_TIMELINE} {pane} plot={(width) => timelinePlot(timeline, width)}>
		{#snippet over(p: TimelinePlot)}
			{#if p.line}<path class="line" d={p.line} />{/if}
			{#each p.discs as disc (disc.kind)}
				<g transform="translate({disc.x - C} {disc.y - C})">
					<circle class="disc" cx={C} cy={C} r={DISC.radius} stroke-width={DISC.ring} />
					{#if disc.kind === "sleep"}
						<path class="glyph" d="M6.99 7.64H11.02V8.68L8.44 11.94H11.02V12.98H6.99V11.94L9.57 8.68H6.99V7.64Z" />
						<path class="glyph" d="M11.37 9.65H14.98V10.69L12.72 13.26H14.98V14.3H11.37V13.26L13.63 10.69H11.37V9.65Z" />
					{:else}
						<circle class="face" cx="10.83" cy="10.76" r="4.62" />
						<path class="hands" d="M9.02 9.58L10.83 10.76L13.05 8.47" />
					{/if}
				</g>
			{/each}
			{#if p.empty}
				<text class="empty" x={p.empty.x} y={p.empty.y} text-anchor="middle" dominant-baseline="central">{NO_DATA.text}</text>
			{/if}
		{/snippet}
		{#snippet footer()}
			{#if timeline.state === "drawn"}<div class="legend"><HrvLegend rows={[[{ label: "HRV", mark: "line" }]]} /></div>{/if}
		{/snippet}
	</StatChart>
</div>

<style>
	.line {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	/* The Sleep Marker: a --color-blue disc in a page-coloured ring, its glyph in the accent's text colour. */
	.disc {
		fill: var(--color-blue);
		stroke: var(--background-primary);
	}
	.glyph {
		fill: var(--text-on-accent);
	}
	.face,
	.hands {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.face {
		stroke-width: 1.04;
	}
	.hands {
		stroke-width: 0.85;
	}
	.empty {
		fill: var(--text-muted);
		font-size: 14px;
	}
	/* "— HRV", 11.74 under the times, centred under the chart. */
	.legend {
		margin-top: 11.74px;
	}
</style>
