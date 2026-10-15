<script lang="ts">
	import { allActivities, type ActivitiesData, type AllItem } from "../../../dashboard/activities";
	import { activityRoute, type AllRoute, type Route } from "../../../dashboard/routes";
	import type { HistoryProgress } from "../../../sync/runner";
	import type { OpenSheet } from "../../sheet-modal";
	import { sportIcon } from "../../sport-icons";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * Every activity, newest first. Drawn a page at a time as the list scrolls:
	 * years of history is hundreds of rows, and nobody reads them all at once.
	 * A run opens its activity page.
	 *
	 * `route` (search, sort, filters), `today`, `history`, `openSheet` and
	 * `swap` are handed in for the rebuilt page (search, sort and the filter
	 * sheet); this one doesn't read them yet.
	 */
	interface Props {
		route: AllRoute;
		data: ActivitiesData;
		/** `YYYY-MM-DD`. */
		today: string;
		/** The activity history's download, while it runs. */
		history: HistoryProgress | null;
		openSheet: OpenSheet;
		onBack: () => void;
		go: (route: Route) => void;
		/** The same page with another search, sort or filter. */
		swap: (route: Route) => void;
	}

	let { data, onBack, go }: Props = $props();

	const PAGE = 60;
	let items = $derived(allActivities(data.rows, data.units));
	let limit = $state(PAGE);
	let shown = $derived(items.slice(0, limit));

	let sentinel = $state<HTMLElement | null>(null);
	$effect(() => {
		if (!sentinel) return;
		const root = sentinel.closest<HTMLElement>(".view-content");
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) limit += PAGE;
			},
			{ root, rootMargin: "600px 0px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

{#snippet row(item: AllItem)}
	<span class="icon" use:lucide={sportIcon(item.glyph)}></span>
	<div class="text">
		<span class="name">{item.name}</span>
		<span class="when">{item.when}</span>
		{#if item.time || item.distance}
			<span class="figures">
				{#if item.time}<span>{item.time}</span>{/if}
				{#if item.distance}<span>{item.distance}</span>{/if}
			</span>
		{/if}
	</div>
{/snippet}

<PageBar title="All Activities" {onBack} />

<div class="rows">
	{#each shown as item (item.id)}
		{#if item.opens}
			<button class="row" onclick={() => go(activityRoute(item.id))}>{@render row(item)}</button>
		{:else}
			<div class="row">{@render row(item)}</div>
		{/if}
	{:else}
		<p class="empty">No activities synced yet.</p>
	{/each}
	{#if shown.length < items.length}<div class="more" bind:this={sentinel}></div>{/if}
</div>

<style>
	.rows {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		background: var(--background-secondary);
	}
	button.row {
		width: 100%;
		height: auto;
		margin: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	button.row:hover {
		background: var(--background-modifier-hover);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 22px;
		min-height: 87.6px;
		box-sizing: border-box;
		padding: 0 21px 0 22.65px;
		background: var(--background-secondary);
	}
	.icon {
		display: inline-flex;
		flex: none;
		color: var(--text-normal);
	}
	.icon :global(svg) {
		width: 28px;
		height: 28px;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name,
	.when {
		font-size: 16px;
		line-height: 21px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		color: var(--text-muted);
	}
	.figures {
		display: flex;
		gap: 14px;
		font-size: 11px;
		line-height: 14px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		margin: 0;
		padding: 24px;
		color: var(--text-muted);
		font-size: 15px;
		background: var(--background-primary);
	}
	.more {
		height: 1px;
	}

	@container (min-width: 640px) {
		.rows {
			box-sizing: content-box;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 8px;
			max-width: 1126px;
			margin: 0 auto;
			padding: 16px 32px 32px;
			background: none;
		}
		.row,
		button.row {
			border-radius: 8px;
		}
		.empty,
		.more {
			grid-column: 1 / -1;
		}
	}
	@container (min-width: 1000px) {
		.rows {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
