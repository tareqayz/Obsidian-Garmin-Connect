<script lang="ts">
	import { alignmentPlot } from "../../../dashboard/sleep-charts";
	import type { AlignmentView } from "../../../dashboard/sleep-pages";

	/**
	 * Last night against the internal rhythm on twelve hours of clock: two
	 * tracks, a tick at each midpoint, and the target range, an hour either
	 * side of the rhythm's midpoint, boxed across both.
	 */
	let { alignment }: { alignment: AlignmentView } = $props();

	let width = $state(402);
	let plot = $derived(alignmentPlot(alignment, width));
</script>

<div class="alignment" bind:clientWidth={width}>
	<svg {width} height="97" aria-hidden="true">
		<rect class="track" x={plot.left} y="20.3" width={plot.right - plot.left} height="8" rx="4" />
		{#if plot.last && plot.last.x2 > plot.last.x1}
			<rect class="last" x={plot.last.x1} y="20.3" width={plot.last.x2 - plot.last.x1} height="8" rx="4" />
		{/if}
		<rect class="track" x={plot.left} y="36.3" width={plot.right - plot.left} height="8" rx="4" />
		{#if plot.internal.x2 > plot.internal.x1}
			<rect class="internal" x={plot.internal.x1} y="36.3" width={plot.internal.x2 - plot.internal.x1} height="8" rx="4" />
		{/if}
		{#if plot.last}<rect class="mid" x={plot.last.mid - 1} y="16.4" width="2" height="15.7" />{/if}
		<rect class="mid" x={plot.internal.mid - 1} y="32.5" width="2" height="15.6" />
		<rect class="target" x={plot.target.x1} y="8.3" width={plot.target.x2 - plot.target.x1} height="47.7" rx="5" />
		{#each plot.dots as dot}<circle class="dot" cx={dot.x} cy="72.7" r={dot.large ? 4 : 1.85} />{/each}
		{#each plot.labels as label}
			<text class="hour" x={label.x} y="88.4" text-anchor="middle" dominant-baseline="central">{label.text}</text>
		{/each}
	</svg>
</div>

<style>
	svg {
		display: block;
		overflow: visible;
	}
	.track {
		fill: var(--background-modifier-border);
	}
	.last {
		fill: var(--gcs-light);
	}
	.internal {
		fill: var(--color-purple);
	}
	.mid {
		fill: var(--text-normal);
	}
	.target {
		fill: none;
		stroke: var(--text-normal);
		stroke-width: 2;
		stroke-dasharray: 4 3;
	}
	.dot {
		fill: var(--text-muted);
	}
	.hour {
		fill: var(--text-muted);
		font-size: 12px;
	}
</style>
