<script lang="ts">
	import { PHONE } from "../../../dashboard/stat-charts";
	import { SCORES_MARKS, recentSleepPlot } from "../../../dashboard/training-readiness-charts";
	import type { RecentSleepChart } from "../../../dashboard/training-readiness-pages";
	import SleepLegend from "../sleep/SleepLegend.svelte";

	/**
	 * Recent Sleep Scores' Daily Scores (twin Sheet Chart 650:362, the line
	 * 654:1098): the 7 nights ending on the day on a fixed 0–100, a grey line
	 * and dots, the two nights the factor weighs in purple, the day axis, and
	 * "Relevant Scores" under it. Geometry is `recentSleepPlot`'s.
	 */
	interface Props {
		chart: RecentSleepChart | null;
		/** The purple dot's key: "Relevant Scores". */
		legend: string;
	}

	let { chart, legend }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || PHONE);
	let p = $derived(recentSleepPlot(chart, width));
</script>

<div class="scores">
	<div class="canvas" bind:clientWidth={measured} style:height="{p.height}px">
		<!-- The figures under the chart give the two nights the factor weighs. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label (label.text)}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/each}
			{#if p.line}<path class="line" d={p.line} stroke-width={SCORES_MARKS.line} />{/if}
			{#each p.points as point, i (i)}
				<circle class="point" class:relevant={point.relevant} cx={point.x} cy={point.y} r={SCORES_MARKS.dot} />
			{/each}
		</svg>
	</div>
	<div class="legend"><SleepLegend items={[{ kind: "dot", label: legend, color: "var(--color-purple)" }]} /></div>
</div>

<style>
	.scores {
		min-width: 0;
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
		stroke-width: 1;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
	.line {
		fill: none;
		stroke: var(--text-faint);
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--text-faint);
	}
	.point.relevant {
		fill: var(--color-purple);
	}
	/* The key in the twin's Caption (11/14). */
	.legend :global(.label) {
		font-size: 11px;
		line-height: 14px;
	}
</style>
