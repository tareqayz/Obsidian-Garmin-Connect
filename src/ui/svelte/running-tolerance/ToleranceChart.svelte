<script lang="ts">
	import { DISTANCE_DOT, LINE_WIDTH, TOLERANCE_COLORS, tolerancePlot } from "../../../dashboard/running-tolerance-charts";
	import type { TolerancePeriodView } from "../../../dashboard/running-tolerance-pages";
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";

	/**
	 * The weekly chart of 12w and 1y (twin 695:109, 695:649, 695:903, 697:489;
	 * panes 701:1894, 702:2115): five gridlines from 0, a pill-topped bar a
	 * week, the tolerance line over them (steps on 12w, a polyline on 1y),
	 * with the chip on the Actual Distance line (12w with its dots), and the
	 * axis: a dot a week with the ends labelled (12w), or a dot and its month
	 * on end under each week holding a 1st (1y). Its box grows by the
	 * legend's second row when the legend has one (`rows`). Geometry is
	 * `tolerancePlot`'s.
	 */
	interface Props {
		view: TolerancePeriodView;
		/** The legend's rows under the chart on a phone; a pane passes 2. */
		rows: number;
		pane: boolean;
	}

	let { view, rows, pane }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(tolerancePlot(view.chart, view.range, width, rows));
</script>

<div class="rt-chart" bind:clientWidth={measured} style:height="{p.height}px">
	<!-- The weeks are listed under the chart with their numbers. -->
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as g, i (i)}
			<line class="grid" x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} />
			<text class="tick" x={p.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
		{/each}
		{#each p.bars as bar (bar.week)}<path d={bar.d} fill={bar.color} />{/each}
		{#if p.tolerance}<path class="line" d={p.tolerance} stroke={TOLERANCE_COLORS.tolerance} stroke-width={LINE_WIDTH} />{/if}
		{#if p.distance}<path class="line distance" d={p.distance} stroke={TOLERANCE_COLORS.distance} stroke-width={LINE_WIDTH} />{/if}
		{#each p.distanceDots as dot, i (i)}<circle cx={dot.x} cy={dot.y} r={DISTANCE_DOT} fill={TOLERANCE_COLORS.distance} />{/each}
		{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label, i (i)}
			{#if label.rotated}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
			{:else}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/if}
		{/each}
	</svg>
</div>

<style>
	.rt-chart {
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
		font-size: 10px;
	}
	.line {
		fill: none;
	}
	.distance {
		stroke-linejoin: round;
	}
	.axis-dot {
		fill: var(--text-faint);
	}
</style>
