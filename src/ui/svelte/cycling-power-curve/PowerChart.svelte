<script lang="ts">
	import { powerPlot } from "../../../dashboard/cycling-power-curve-charts";
	import type { CyclingPowerCurveView } from "../../../dashboard/cycling-power-curve-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";

	/**
	 * The power curve (twin Chart Axes 779:28 and the plot; phones 780:131509
	 * / 780:131806, panes 783:1986 / 783:2325): the gridlines and their
	 * labels, a dot and an upright label at each of the 15 durations,
	 * "Interval Length", then the Record's area and line and the period's
	 * over them. The box is 244 pt tall at any width, the plot stretching
	 * between the phone's insets; geometry is `powerPlot`'s.
	 */
	let { view, pane }: { view: CyclingPowerCurveView; pane: boolean } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(powerPlot(view, width));
</script>

<div class="pc-chart" bind:clientWidth={measured} style:height="{p.height}px">
	<!-- The records table under the chart gives every value it draws. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as line (line.label)}
			<line class="pc-grid" class:zero={line.zero} x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
			<text class="pc-tick" x={p.labelRight} y={line.labelY} text-anchor="end" dominant-baseline="central">{line.label}</text>
		{/each}
		{#each p.dots as dot, i (i)}<circle class="pc-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label (label.text)}
			<text class="pc-duration" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})"
				>{label.text}</text
			>
		{/each}
		<text class="pc-axis-title" x={p.title.x} y={p.title.y} text-anchor="middle" dominant-baseline="central">{p.title.text}</text>
		{#if p.record.line}
			<path class="pc-record-area" d={p.record.area} />
			<path class="pc-line pc-record-line" d={p.record.line} />
		{/if}
		{#if p.period.line}
			<path class="pc-period-area" d={p.period.area} />
			<path class="pc-line pc-period-line" d={p.period.line} />
		{/if}
	</svg>
</div>

<style>
	.pc-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	/* Hairlines; the 0 line at 24 %, where the areas leave it uncovered. */
	.pc-grid {
		stroke: var(--background-modifier-border);
		stroke-width: 0.33;
	}
	.pc-grid.zero {
		opacity: 0.24;
	}
	/* Axis, 10/12. */
	.pc-tick,
	.pc-duration {
		fill: var(--text-muted);
		font-size: 10px;
	}
	/* Caption, 11/14. */
	.pc-axis-title {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.pc-dot {
		fill: var(--text-faint);
	}
	/* The Record behind, in the border grey; the period over it, its area the line's blue at 30 %. */
	.pc-record-area {
		fill: var(--background-modifier-border);
	}
	.pc-period-area {
		fill: var(--color-blue);
		fill-opacity: 0.3;
	}
	.pc-line {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.pc-record-line {
		stroke: var(--text-faint);
	}
	.pc-period-line {
		stroke: var(--color-blue);
	}
</style>
