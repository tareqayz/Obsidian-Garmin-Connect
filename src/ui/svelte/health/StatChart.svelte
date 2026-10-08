<script lang="ts" generics="P extends PlotBox">
	import type { Snippet } from "svelte";
	import { PANE_COLUMN, PHONE, type PlotBox } from "../../../dashboard/stat-charts";

	/**
	 * A Health Stats chart under its title: the box every stat's chart has —
	 * gridlines with their labels, the axis' dots and labels — and the stat's
	 * own marks in it. `plot` lays the chart out at the width it gets (the
	 * phone's 402pt, a pane's 748pt column, or whatever the pane has); `under`
	 * draws the marks the axis sits on (bars), `over` the ones on top (a line,
	 * a marker), and `footer` whatever goes under the chart (a key).
	 */
	interface Props {
		title: string;
		/** The page is laid out as a pane: the width to start from before the chart is measured. */
		pane: boolean;
		plot: (width: number) => P;
		under?: Snippet<[P]>;
		over?: Snippet<[P]>;
		footer?: Snippet;
	}

	let { title, pane, plot, under, over, footer }: Props = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(plot(width));
</script>

<figure class="stat-chart">
	<figcaption>{title}</figcaption>
	<div class="canvas" bind:clientWidth={measured} style:height="{p.height}px">
		<!-- The figures are beside the chart; the chart shows their shape. -->
		<svg width={p.width} height={p.height} aria-hidden="true">
			{#each p.grid as line (line.label)}
				<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />
				<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
			{/each}
			{@render under?.(p)}
			{#each p.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
			{#each p.labels as label}
				{#if label.rotated}
					<text class="axis" x={label.x} y={label.y} text-anchor="start" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
				{:else}
					<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
				{/if}
			{/each}
			{@render over?.(p)}
		</svg>
	</div>
	{@render footer?.()}
</figure>

<style>
	.stat-chart {
		margin: 0;
		min-width: 0;
	}
	/* The title's inset is the phone's; a pane's layout sets it to 0. */
	figcaption {
		height: 22px;
		padding-left: var(--stat-title-indent, 9.6px);
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
	.dot {
		fill: var(--text-faint);
	}
</style>
