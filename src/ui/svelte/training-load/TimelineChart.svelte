<script lang="ts">
	import { PANE_COLUMN, PHONE } from "../../../dashboard/stat-charts";
	import { ACUTE_FRAME, MARKS, SERIES_COLOR, acutePlot, ratioPlot, type TimelineFrame } from "../../../dashboard/training-load-charts";
	import type { AcuteChart, RatioChart } from "../../../dashboard/training-load-pages";
	import OptimalBand from "../health/OptimalBand.svelte";
	import StatEmpty from "../health/StatEmpty.svelte";

	/**
	 * The 4-Week Timeline (twin 606:461, 606:666, 606:901; panes 610:1576,
	 * 610:1750): gridlines and labels, the optimal band over the gridlines,
	 * then — Acute Load — the chronic line and its squares with the chip on
	 * and the acute line and its dots over them, or the Load Ratio line;
	 * a dot a day under the plot with MM-DD under the ends. The box is 200
	 * pt tall at any width; a period without a row keeps it and says so.
	 * Geometry is `acutePlot`'s and `ratioPlot`'s; another page's Acute Load
	 * box (Training Readiness's sheet) comes as `frame`.
	 */
	interface Props {
		chart: AcuteChart | RatioChart | null;
		/** The line in place of the plot when `chart` is null. */
		empty?: string;
		pane: boolean;
		/** Acute Load's box where it is not Load's own (`ACUTE_FRAME`). */
		frame?: TimelineFrame;
	}

	let { chart, empty, pane, frame = ACUTE_FRAME }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(chart ? (chart.segment === "acute" ? acutePlot(chart, width, frame) : ratioPlot(chart, width)) : null);
	let muted = $derived(chart?.segment === "acute" && chart.muted);
	let color = $derived(chart?.segment === "ratio" ? SERIES_COLOR.ratio : muted ? SERIES_COLOR.muted : SERIES_COLOR.acute);
</script>

<div class="timeline" bind:clientWidth={measured} style:height="{frame.height}px" style:--tl-series={color} style:--tl-chronic={SERIES_COLOR.chronic}>
	{#if p}
		<!-- The status and the figures under the chart say what it shows. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as g, i (i)}<line class="grid" x1={g.x1} x2={g.x2} y1={g.y} y2={g.y} />{/each}
			{#each p.ticks as tick, i (i)}
				<text class="tick" x={tick.x} y={tick.y} text-anchor="end" dominant-baseline="central">{tick.text}</text>
			{/each}
			<OptimalBand d={p.band} {muted} />
			{#if p.chronic}
				<path class="chronic" d={p.chronic.line} />
				{#each p.chronic.squares as sq, i (i)}
					<rect class="square" x={sq.x - MARKS.square / 2} y={sq.y - MARKS.square / 2} width={MARKS.square} height={MARKS.square} />
				{/each}
			{/if}
			{#if p.line}<path class="series" d={p.line} />{/if}
			{#each p.points as pt, i (i)}<circle class="point" cx={pt.x} cy={pt.y} r={MARKS.dot} />{/each}
			{#each p.dots as dot, i (i)}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label, i (i)}
				<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
			{/each}
		</svg>
	{:else if empty}
		<div class="tl-empty" style:top="{frame.top}px" style:height="{frame.baseline - frame.top}px"><StatEmpty text={empty} /></div>
	{/if}
</div>

<style>
	.timeline {
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
	.axis-dot {
		fill: var(--text-faint);
	}
	.series,
	.chronic {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.series {
		stroke: var(--tl-series);
	}
	.point {
		fill: var(--tl-series);
	}
	.chronic {
		stroke: var(--tl-chronic);
	}
	.square {
		fill: var(--tl-chronic);
	}
	.tl-empty {
		position: absolute;
		left: 0;
		right: 0;
	}
	.tl-empty :global(.stat-empty) {
		font-size: 15px;
		line-height: 20px;
	}
</style>
