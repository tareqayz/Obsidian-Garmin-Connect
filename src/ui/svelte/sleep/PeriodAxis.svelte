<svelte:options namespace="svg" />

<script lang="ts">
	import type { AxisPlot } from "../../../dashboard/sleep-charts";

	/** Under a period chart: the dot row and the first and last dates, or a year's months standing up. */
	let { axis }: { axis: AxisPlot } = $props();
</script>

{#each axis.dots as dot}<circle class="axis-dot" cx={dot.x} cy={dot.y} r={dot.r} />{/each}
{#each axis.labels as label}
	{#if label.rotated}
		<text class="axis-label" x={label.x} y={label.y} text-anchor="end" dominant-baseline="central" transform="rotate(-90 {label.x} {label.y})">{label.text}</text>
	{:else}
		<text class="axis-label" x={label.x} y={label.y} text-anchor="middle" dominant-baseline="central">{label.text}</text>
	{/if}
{/each}

<style>
	.axis-dot {
		fill: var(--text-faint);
	}
	.axis-label {
		fill: var(--text-muted);
		font-size: 12px;
	}
</style>
