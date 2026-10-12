<script lang="ts" module>
	export type Shape = "circle" | "triangle" | "square" | "diamond";
</script>

<script lang="ts">
	/**
	 * A series' marker (twin 443:452), 16 pt: a circle, a 16 × 15 triangle, a
	 * square, a 14.7 pt diamond. The triangle and the diamond have a 1 pt
	 * outline in the page's colour. Legends, chips and a chart's points.
	 */
	let { shape, color }: { shape: Shape; color: string } = $props();
</script>

<svg class="shape-marker" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
	{#if shape === "circle"}
		<circle cx="8" cy="8" r="8" fill={color} />
	{:else if shape === "square"}
		<rect width="16" height="16" fill={color} />
	{:else if shape === "triangle"}
		<path class="outlined" d="M8 0.5L16 15.5H0Z" fill={color} />
	{:else}
		<path class="outlined" d="M8 0.67L15.33 8L8 15.33L0.67 8Z" fill={color} />
	{/if}
</svg>

<style>
	.shape-marker {
		display: block;
		flex: none;
		overflow: visible;
	}
	.outlined {
		stroke: var(--background-primary);
		stroke-width: 1;
		stroke-linejoin: miter;
	}
</style>
