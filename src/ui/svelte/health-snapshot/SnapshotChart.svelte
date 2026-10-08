<script lang="ts">
	import { snapshotPlot } from "../../../dashboard/health-snapshot-charts";
	import type { SnapshotSection } from "../../../dashboard/health-snapshot-pages";
	import { PHONE } from "../../../dashboard/stat-charts";

	/** A section's chart over the two minutes, at the width it gets. */
	let { section }: { section: SnapshotSection } = $props();

	let measured = $state(0);
	let p = $derived(snapshotPlot(section, measured || PHONE));
	const uid = $props.id();
	const gradient = `hs-grad-${uid}`;
</script>

<div class="hs-chart hs-{section.id}" bind:clientWidth={measured} style:height="{p.height}px">
	<svg width={p.width} height={p.height} aria-hidden="true">
		<defs>
			<linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" class="stop-top" />
				<stop offset="1" class="stop-bottom" />
			</linearGradient>
		</defs>
		{#each p.grid as g (g.label)}
			<text class="tick" x={p.labelRight} y={g.y} text-anchor="end" dominant-baseline="central">{g.label}</text>
		{/each}
		{#if p.path}
			{#if p.kind === "step-line"}
				<path class="mark-line" d={p.path} />
			{:else}
				<path class="mark-area" d={p.path} fill="url(#{gradient})" />
			{/if}
		{/if}
		{#if p.average}<line class="average" x1={p.average.x1} x2={p.average.x2} y1={p.average.y} y2={p.average.y} />{/if}
		{#each p.dots as d}<circle class="dot" cx={d.x} cy={d.y} r="3" />{/each}
		{#each p.labels as l}<text class="axis" x={l.x} y={l.y} text-anchor="middle" dominant-baseline="central">{l.text}</text>{/each}
		<text class="axis" x={p.caption.x} y={p.caption.y} text-anchor="middle" dominant-baseline="central">Time (h:m:s)</text>
	</svg>
</div>

<style>
	.hs-chart {
		position: relative;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.tick,
	.axis {
		fill: var(--text-muted);
		font-size: 10px;
	}
	.dot {
		fill: var(--text-faint);
	}
	.average {
		stroke: var(--text-faint);
		stroke-width: 1;
	}
	.mark-line {
		fill: none;
		stroke: var(--color-green);
		stroke-width: 2;
	}
	.hs-heart {
		--hs-top: rgba(var(--color-red-rgb), 0.65);
		--hs-bottom: var(--color-red);
	}
	.hs-respiration {
		--hs-top: #8ca3b4;
		--hs-bottom: #587589;
	}
	.hs-stress {
		--hs-top: var(--color-orange);
		--hs-bottom: var(--color-orange);
	}
	.stop-top {
		stop-color: var(--hs-top, var(--text-muted));
	}
	.stop-bottom {
		stop-color: var(--hs-bottom, var(--text-muted));
	}
</style>
