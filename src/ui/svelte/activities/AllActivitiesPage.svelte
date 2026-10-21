<script lang="ts">
	import type { ActivitiesData } from "../../../dashboard/activities";
	import { allView, clearedRoute, searchRoute, sortRoute, type AllChip } from "../../../dashboard/all-activities";
	import { activityRoute, routeKey, type AllRoute, type Route } from "../../../dashboard/routes";
	import type { HistoryProgress } from "../../../sync/runner";
	import type { OpenSheet } from "../../sheet-modal";
	import PageBar from "../home/PageBar.svelte";
	import ActivityTile from "./all/ActivityTile.svelte";
	import CountRow from "./all/CountRow.svelte";
	import FilterButton from "./all/FilterButton.svelte";
	import FilterChips from "./all/FilterChips.svelte";
	import FilterSheet from "./all/FilterSheet.svelte";
	import SearchField from "./all/SearchField.svelte";
	import HistoryBanner from "./HistoryBanner.svelte";

	/**
	 * All Activities, Garmin's new list (ref/activities/all-activities): the
	 * bar with the filter button and the search stay put while the rest
	 * scrolls; under them the chips of the filters in force, the exact count
	 * with Sort, and the cards, a page of 60 at a time as the list scrolls.
	 * Search, sort and filters live in the route and run over the activity
	 * index, so the page sends no request. A new query starts the list again
	 * from the top. A pane lays the cards out two, then three, across.
	 */
	interface Props {
		route: AllRoute;
		data: ActivitiesData;
		/** `YYYY-MM-DD`. */
		today: string;
		/** The activity history's download, while it runs. */
		history: HistoryProgress | null;
		/** Whether a history sync can start now. */
		canSync?: boolean;
		openSheet: OpenSheet;
		onBack: () => void;
		go: (route: Route) => void;
		/** The same page with another search, sort or filter. */
		swap: (route: Route) => void;
		onSyncHistory?: () => void;
	}

	let { route, data, today, history, canSync = false, openSheet, onBack, go, swap, onSyncHistory }: Props = $props();

	const PAGE = 60;

	let view = $derived(allView(data.rows, route, data.units, today));
	let limit = $state(PAGE);
	let shown = $derived(view.items.slice(0, limit));

	let page = $state<HTMLElement | null>(null);
	let sentinel = $state<HTMLElement | null>(null);

	// A new search, sort or filter: the first page again, from the top. (Home keeps a swap's scroll.)
	let key = $derived(routeKey(route));
	let shownKey: string | undefined;
	$effect(() => {
		const next = key;
		if (shownKey !== undefined && next !== shownKey) {
			limit = PAGE;
			page?.closest<HTMLElement>(".view-content")?.scrollTo({ top: 0 });
		}
		shownKey = next;
	});

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

	let banner = $derived.by(() => {
		if (history) {
			return {
				title: "Fetching activity history…",
				detail:
					history.total !== undefined
						? `${history.fetched.toLocaleString()} of ${history.total.toLocaleString()} activities`
						: `${history.fetched.toLocaleString()} activities so far`,
			};
		}
		return { title: "Activity history isn’t synced", detail: "The list covers only what’s synced." };
	});

	function openFilters() {
		openSheet("Filters", FilterSheet, { rows: data.rows, route, units: data.units, today, onApply: (next: AllRoute) => swap(next) });
	}
</script>

<div class="all" bind:this={page}>
	<div class="sticky">
		<PageBar title="All Activities" {onBack}>
			{#snippet right()}<FilterButton active={view.active} onclick={openFilters} />{/snippet}
		</PageBar>
		<div class="search">
			<SearchField value={route.q ?? ""} onSearch={(text) => swap(searchRoute(route, text))} />
		</div>
	</div>

	<div class="body">
		{#if history || !data.complete}
			<div class="banner">
				<HistoryBanner title={banner.title} detail={banner.detail} busy={history !== null} canSync={canSync && onSyncHistory !== undefined} onSync={() => onSyncHistory?.()} />
			</div>
		{/if}
		{#if view.chips.length}
			<div class="chips"><FilterChips chips={view.chips} onRemove={(chip: AllChip) => swap(chip.remove)} /></div>
		{/if}
		<div class="count" class:after-chips={view.chips.length > 0}>
			<CountRow label={view.countLabel} sort={route.sort} onSort={(sort) => swap(sortRoute(route, sort))} />
		</div>

		{#if view.empty}
			<div class="empty">
				<strong>{view.empty.title}</strong>
				{#if !data.complete && data.rows.length}<span>The list covers only what’s synced.</span>{/if}
				{#if view.empty.clear}<button onclick={() => swap(clearedRoute(route))}>Clear All</button>{/if}
			</div>
		{:else}
			<div class="grid">
				{#each shown as item (item.id)}
					<ActivityTile {item} onclick={() => go(activityRoute(item.id))} />
				{/each}
			</div>
			{#if shown.length < view.items.length}<div class="more" bind:this={sentinel}></div>{/if}
		{/if}
	</div>
</div>

<style>
	.sticky {
		position: sticky;
		top: 0;
		z-index: 2;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	/* The pane's scroller has top padding that the header sticks below, so
	   without a cover the list scrolls through that strip above it. */
	.sticky::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 100%;
		height: 48px;
		background: var(--background-primary);
	}
	/* The bar and the search are one band, as on the phone; the line is under both. */
	.sticky :global(header.page-bar) {
		border-bottom: none;
	}
	.search {
		padding: 4px 16px 15px;
	}
	.body {
		padding: 0 16px 16px;
	}
	.banner {
		padding-top: 16px;
	}
	.chips {
		margin-top: 16px;
	}
	.count {
		margin-top: 12px;
	}
	.count.after-chips {
		margin-top: 28px;
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 16px 8px;
		margin-top: 21px;
	}
	.more {
		height: 1px;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 88px 16px 24px;
		text-align: center;
	}
	.empty strong {
		font-size: 17px;
		line-height: 22px;
		font-weight: 600;
	}
	.empty span {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	.empty button {
		height: 48px;
		margin-top: 4px;
		padding: 0 48px;
		font-size: 15px;
		cursor: pointer;
	}

	/* Content-box: Obsidian makes everything border-box, which would take the padding out of the 1126. */
	@container (min-width: 640px) {
		.search,
		.body {
			box-sizing: content-box;
			max-width: 1126px;
			margin: 0 auto;
			padding-left: 32px;
			padding-right: 32px;
		}
		.body {
			padding-bottom: 32px;
		}
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@container (min-width: 1000px) {
		.grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
</style>
