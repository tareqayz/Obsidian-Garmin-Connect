<script lang="ts">
	import { stressPlot } from "../../../dashboard/sleep-charts";

	/** Stress through the night, a bar a reading: blue at rest, orange above 25. */
	interface Props {
		points: Array<[number, number | null]>;
		hours: number[];
		startLabel: string;
		endLabel: string;
	}

	let { points, hours, startLabel, endLabel }: Props = $props();

	let width = $state(402);
	let plot = $derived(stressPlot(points, hours, width));
</script>

<div class="stress" bind:clientWidth={width}>
	<svg {width} height={plot.height} aria-hidden="true">
		{#each plot.grid as g}
			{#if g.line}<line class="grid" x1={plot.left} x2={plot.right} y1={g.y} y2={g.y} />{/if}
			<text class="tick" x={plot.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
		{/each}
		{#each plot.bars as bar}<rect class="bar {bar.tone}" x={bar.x} y={bar.y} width={bar.w} height={bar.h} />{/each}
		<rect class="base" x={plot.left} y={plot.baseline - 5} width={plot.right - plot.left} height="5" />
		{#each plot.hours as x}<circle class="hour" cx={x} cy={plot.dotY} r="1.75" />{/each}
		<g class="marker" transform="translate({plot.left} {plot.dotY - 1.2})">
			<circle r="11.5" />
			<text class="zz" y="0.5" text-anchor="middle" dominant-baseline="central"><tspan font-size="11">Z</tspan><tspan font-size="9">z</tspan></text>
		</g>
		<g class="marker" transform="translate({plot.right} {plot.dotY - 1.2})">
			<circle r="11.5" />
			<circle class="face" r="6.5" />
			<path class="face" d="M0 -3.5 V0 L2.2 1.5" />
		</g>
		<text class="time" x={plot.left} y={plot.labelY} text-anchor="middle" dominant-baseline="central">{startLabel}</text>
		<text class="time" x={plot.right} y={plot.labelY} text-anchor="middle" dominant-baseline="central">{endLabel}</text>
	</svg>
</div>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--background-modifier-border);
	}
	.tick,
	.time {
		fill: var(--text-muted);
		font-size: 12px;
	}
	.bar.rest {
		fill: var(--color-blue);
	}
	.bar.stress {
		fill: var(--color-orange);
	}
	.base {
		fill: var(--color-blue);
		opacity: 0.6;
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
