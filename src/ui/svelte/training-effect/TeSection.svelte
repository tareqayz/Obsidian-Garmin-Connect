<script lang="ts">
	import type { Snippet } from "svelte";

	/**
	 * A section of the Training Effect page: the run page's Section Header
	 * (twin 403:49, as `activity/stats/StatsSection.svelte` draws it) over its
	 * cell. On a phone the sections run edge to edge, the header bands parting
	 * them; from 640 pt each is a bordered card (pane 686:119855), the border
	 * drawn over the content as Figma's inside stroke.
	 */
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="te-section">
	<h3 class="heading">{title}</h3>
	{@render children()}
</section>

<style>
	.heading {
		box-sizing: border-box;
		height: 41.67px;
		margin: 0;
		padding: 20.61px 16.35px 0;
		background: var(--background-secondary);
		color: var(--text-muted);
		font-size: 13px;
		line-height: 16px;
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@container (min-width: 640px) {
		.te-section {
			position: relative;
			overflow: hidden;
			border-radius: var(--radius-m, 8px);
		}
		.te-section::after {
			content: "";
			position: absolute;
			inset: 0;
			border: 1px solid var(--background-modifier-border);
			border-radius: inherit;
			pointer-events: none;
		}
	}
</style>
