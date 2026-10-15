<script lang="ts">
	/**
	 * The bar's filter button: three bars of falling width, as Garmin draws it
	 * (Lucide's list-filter). With a filter on, the top bar shortens for an
	 * accent dot at its end (list/03). The search and the sort don't light it.
	 */
	let { active, onclick }: { active: boolean; onclick: () => void } = $props();
</script>

<!-- It opens the Filters sheet; its label is also its tooltip. -->
<button class="clickable-icon filter" aria-label="Filters" aria-haspopup="dialog" {onclick}>
	<!-- Lucide's list-filter as Obsidian 1.14 draws it. Active: the top bar shortened and a dot 8 across
	     at the 20 px the icon is drawn (r 4.8 of 24), clear of both bars. -->
	<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
		<path d={active ? "M2 5h8" : "M2 5h20"} />
		<path d="M6 12h12" />
		<path d="M9 19h6" />
		{#if active}<circle class="dot" cx="18.2" cy="5.6" r="4.8" />{/if}
	</svg>
</button>

<style>
	/* At the bar's right end, as PageBar's own slots sit (its rule doesn't reach a slotted element). */
	.filter {
		justify-self: end;
		color: var(--text-muted);
	}
	.dot {
		fill: var(--interactive-accent);
		stroke: none;
	}
</style>
