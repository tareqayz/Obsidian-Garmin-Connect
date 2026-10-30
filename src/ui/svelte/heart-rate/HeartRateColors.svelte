<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * The twin's heart-rate/* colours (Light / Dark) around whatever draws Heart
	 * Rate's charts: its page, or a card in a note. The zones run slate, blue,
	 * light blue, green, orange, red. Three are the twin's own hex values, with
	 * a dark theme's of their own, so they live here rather than in a style
	 * string.
	 */
	let { children }: { children: Snippet } = $props();
</script>

<div class="heart-rate-colors">{@render children()}</div>

<style>
	.heart-rate-colors {
		display: contents;
		--heart-rate-resting: var(--color-blue);
		--heart-rate-high: var(--color-red);
		--heart-rate-resting-legend: #0a4ea8;
		--heart-rate-zone-0: #8f9ba6;
		--heart-rate-zone-1: var(--color-blue);
		--heart-rate-zone-2: #4c9cf0;
		--heart-rate-zone-3: var(--color-green);
		--heart-rate-zone-4: var(--color-orange);
		--heart-rate-zone-5: var(--color-red);
	}
	:global(.theme-dark) .heart-rate-colors {
		--heart-rate-resting-legend: #5c9dff;
		--heart-rate-zone-0: #6f8594;
		--heart-rate-zone-2: #54a9fe;
	}
</style>
