<script lang="ts">
	import { timelinePlot, type TimelineLook } from "../../../dashboard/sleep-charts";
	import type { Timeline, TimelineOverlay } from "../../../dashboard/sleep-pages";

	/**
	 * The night from falling asleep to waking: a bar per stretch at its
	 * stage's height, with the overlay the chips picked on top of it.
	 */
	interface Props {
		timeline: Timeline;
		overlay: TimelineOverlay | null;
		look: TimelineLook;
		/** The space between stage lines: 38.45 on the score page, 28.4 on a factor's. */
		level: number;
	}

	let { timeline, overlay, look, level }: Props = $props();

	let width = $state(402);
	let plot = $derived(timelinePlot(timeline, overlay, width, level));
</script>

<div class="timeline" bind:clientWidth={width}>
	<svg {width} height={plot.height} class="look-{look}" aria-hidden="true">
		{#each plot.bars as bar}
			<rect class="bar {bar.stage}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />
		{/each}
		{#each plot.grid as line}
			<line class="grid" x1={plot.left} x2={plot.right} y1={line.y} y2={line.y} />
			<text class="tick" x={plot.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
		{/each}
		{#each plot.ticks as t}<rect class="restless" x={t.x} y={t.y} width="1" height={t.h} />{/each}
		{#if plot.line}<path class="overlay" d={plot.line} />{/if}
		{#each plot.rightLabels as label}
			<text class="tick" x={plot.rightX} y={label.y} dominant-baseline="central">{label.text}</text>
		{/each}
		{#each plot.hours as x}<circle class="hour" cx={x} cy={plot.dotY} r="1.75" />{/each}
		<g class="marker" transform="translate({plot.left} {plot.markerY})">
			<circle r="11.5" />
			<text class="zz" y="0.5" text-anchor="middle" dominant-baseline="central"><tspan font-size="11">Z</tspan><tspan font-size="9">z</tspan></text>
		</g>
		<g class="marker" transform="translate({plot.right} {plot.markerY})">
			<circle r="11.5" />
			<circle class="face" r="6.5" />
			<path class="face" d="M0 -3.5 V0 L2.2 1.5" />
		</g>
		<text class="time" x={plot.left} y={plot.labelY} text-anchor="middle" dominant-baseline="central">{plot.startLabel}</text>
		<text class="time" x={plot.right} y={plot.labelY} text-anchor="middle" dominant-baseline="central">{plot.endLabel}</text>
	</svg>
</div>

<style>
	.timeline {
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.bar.deep {
		fill: var(--gcs-deep);
	}
	.bar.light {
		fill: var(--gcs-light);
	}
	.bar.rem,
	.bar.awake {
		fill: var(--color-pink);
	}
	.bar.awake {
		opacity: 0.7;
	}
	.look-awake .bar.deep,
	.look-awake .bar.light,
	.look-awake .bar.rem,
	.look-line .bar.deep,
	.look-line .bar.light,
	.look-line .bar.rem {
		opacity: 0.4;
	}
	.look-line .bar.awake {
		opacity: 0.3;
	}
	.grid {
		stroke: var(--background-modifier-border);
		stroke-width: 1;
	}
	.tick,
	.time {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.restless {
		fill: var(--text-normal);
	}
	.overlay {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 1.8;
		stroke-linejoin: round;
	}
	.hour {
		fill: var(--text-faint);
	}
	.marker circle {
		fill: var(--color-blue);
	}
	.marker .face {
		fill: none;
		stroke: var(--text-on-accent);
		stroke-width: 1.3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.zz {
		fill: var(--text-on-accent);
		font-weight: 700;
	}
</style>
