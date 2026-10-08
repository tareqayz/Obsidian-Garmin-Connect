<script lang="ts" generics="P extends PlotBox & { emptyY: number }">
	import type { Snippet } from "svelte";
	import { PANE_COLUMN, PHONE, type PlotBox } from "../../../dashboard/stat-charts";

	/** A Pulse Ox chart without a title: the box, the stat's marks, and "No data available." when `empty`. */
	let { pane, plot, empty, marks }: { pane: boolean; plot: (width: number) => P; empty: boolean; marks: Snippet<[P]> } = $props();

	let measured = $state(0);
	let width = $derived(measured || (pane ? PANE_COLUMN : PHONE));
	let p = $derived(plot(width));
</script>

<div class="spo2-chart" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		{#each p.grid as line (line.label)}
			{#if line.x2 > line.x1}<line class="grid" x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} />{/if}
			<text class="tick" x={p.labelRight} y={line.y} text-anchor="end" dominant-baseline="central">{line.label}</text>
		{/each}
		{@render marks(p)}
		{#each p.dots as dot}<circle class="dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
		{#each p.labels as label}<text class="axis" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>{/each}
		{#if empty}<text class="empty" x={p.width / 2} y={p.emptyY} text-anchor="middle" dominant-baseline="central">No data available.</text>{/if}
	</svg>
</div>

<style>
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
	.empty {
		fill: var(--text-muted);
		font-size: 13px;
	}
</style>
