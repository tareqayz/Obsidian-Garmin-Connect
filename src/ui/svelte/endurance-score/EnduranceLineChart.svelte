<script lang="ts">
	import { LINE_COLOR, scorePlot } from "../../../dashboard/endurance-score-charts";
	import type { EnduranceLine } from "../../../dashboard/endurance-score-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * The Endurance Score tab's chart on 12w and 1y (twin 581:222, Inferred
	 * 582:109260; panes 585:1793, 585:1917): five gridlines from the lowest
	 * point − 500 to the highest + 500 with their labels, a 2 pt cyan line
	 * through a dot on each week or month, an 8 pt dot under each and its
	 * Monday or month on end. The box is 251.16 pt tall at any width; a period
	 * without a score keeps it and says so where the plot would be. Geometry
	 * is `scorePlot`'s.
	 */
	interface Props {
		line: EnduranceLine | null;
		/** The line in place of the plot when `line` is null. */
		empty?: string;
		/** Laid out as a pane: the width to start from before the box is measured. */
		pane: boolean;
	}

	let { line, empty, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(scorePlot(line, width));
</script>

<div class="es-line" bind:clientWidth={measured} style:height="{p.height}px" style:--es-line={LINE_COLOR}>
	{#if line}
		<!-- Avg Score and Max Score under the chart say what it shows. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as g, i (i)}
				<line class="grid" x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} />
				<text class="tick" x={p.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
			{/each}
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label, i (i)}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
			{/each}
			{#if p.line}<path class="line" d={p.line} />{/if}
			{#each p.points as point, i (i)}<circle class="point" cx={point.x} cy={point.y} r={p.pointRadius} />{/each}
		</svg>
	{:else if empty}
		<div class="es-empty" style:top="{p.top}px" style:height="{p.baseline - p.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.es-line {
		position: relative;
		min-width: 0;
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
	/* The twin's Chart Dot (576:1200): Garmin's teal as the theme's cyan, the line 2 pt with round ends and joins. */
	.line {
		fill: none;
		stroke: var(--es-line);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.point {
		fill: var(--es-line);
	}
	.es-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.es-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
