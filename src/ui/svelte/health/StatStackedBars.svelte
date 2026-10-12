<svelte:options namespace="svg" />

<script lang="ts">
	/**
	 * Stacked bars inside a chart's SVG (Endurance Score's Top Contributors,
	 * twin 582:108111): each bar centred on its `x`, its segments as the stat
	 * laid them out, bottom up, with the page showing in the gaps between
	 * them, and its top segment a pill (`d`, rounded by half the bar's
	 * width). The stat's geometry places everything; this draws it.
	 */
	interface Segment {
		color: string;
		y: number;
		height: number;
		/** The top segment's outline, pill-topped; the others are plain rectangles. */
		d?: string;
	}

	interface Props {
		bars: ReadonlyArray<{ x: number; width: number; rects: readonly Segment[] }>;
	}

	let { bars }: Props = $props();
</script>

<g class="stat-stacked-bars">
	{#each bars as bar, i (i)}
		{#each bar.rects as rect, j (j)}
			{#if rect.d}
				<path d={rect.d} fill={rect.color} />
			{:else if rect.height > 0}
				<rect x={bar.x - bar.width / 2} y={rect.y} width={bar.width} height={rect.height} fill={rect.color} />
			{/if}
		{/each}
	{/each}
</g>
