<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * An optimal range inside a chart's SVG (twin Optimal Range 443:470):
	 * a dashed pill outline, 1 pt --text-faint, dash 2 / gap 2, its radius
	 * half its height, the stroke kept inside the box. Load Focus draws one
	 * over each benefit bar (8 pt, from the target minimum to the maximum)
	 * and its legend's 25.33 × 9.33 key.
	 */
	interface Props {
		x?: number;
		y?: number;
		width: number;
		height?: number;
	}

	let { x = 0, y = 0, width, height = 8 }: Props = $props();
</script>

{#if width > 1 && height > 1}
	<rect class="optimal-range" x={x + 0.5} y={y + 0.5} width={width - 1} height={height - 1} rx={height / 2 - 0.5} />
{/if}

<style>
	.optimal-range {
		fill: none;
		stroke: var(--text-faint);
		stroke-width: 1;
		stroke-dasharray: 2 2;
	}
</style>
