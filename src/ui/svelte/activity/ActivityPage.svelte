<script lang="ts">
	import type { ActivitiesData } from "../../../dashboard/activities";
	import { sportTitle } from "../../../dashboard/activity-labels";
	import { profileFor } from "../../../dashboard/activity-sports";
	import { ACTIVITY_TABS, type ActivityRoute, type ActivityTab, type Route } from "../../../dashboard/routes";
	import type { ActivityDetail, ActivityLoad } from "../../../sync/activity-detail";
	import type { TileSource } from "../../map/tile-source";
	import type { OpenSheet } from "../../sheet-modal";
	import PageBar from "../home/PageBar.svelte";
	import ChartsTab from "./ChartsTab.svelte";
	import ExpandedChart from "./ExpandedChart.svelte";
	import GearTab from "./GearTab.svelte";
	import LapsTab from "./LapsTab.svelte";
	import OverviewTab from "./OverviewTab.svelte";
	import StatsTab from "./StatsTab.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * One activity's page: Garmin's Overview, Stats, Laps, Charts and Gear tabs
	 * under the sport's name. The activity loads when the page opens — from the
	 * vault when it has been opened before, from Garmin the first time — and a
	 * page coming back (Back from the map) draws at once from what it had.
	 *
	 * Each tab is its own component with the same props (`ActivityTabProps`),
	 * the activity's sport profile among them: what the tab tells its view model
	 * about the sport. A chart badge opens the expanded chart in place of the
	 * page (`route.sub` "chart:…"): the phone turns sideways for it, the view
	 * gives it the pane.
	 */
	interface Props {
		route: ActivityRoute;
		data: ActivitiesData;
		loadActivity: (id: number) => Promise<ActivityLoad>;
		cachedActivity: (id: number) => ActivityDetail | null;
		tiles: () => TileSource | null;
		openSheet: OpenSheet;
		onBack: () => void;
		go: (route: Route) => void;
		swap: (route: Route) => void;
		reach: (route: Route) => void;
	}

	let { route, data, loadActivity, cachedActivity, tiles, openSheet, onBack, go, swap, reach }: Props = $props();

	const TAB_LABELS: Record<ActivityTab, string> = {
		overview: "Overview",
		stats: "Stats",
		laps: "Laps",
		charts: "Charts",
		gear: "Gear",
	};

	// svelte-ignore state_referenced_locally
	let load = $state.raw<ActivityLoad | null>(cachedActivity(route.id) ? { detail: cachedActivity(route.id) } : null);
	/** A load on its way: what is drawn may still lack a block, the map's samples among them. */
	let loading = $state(true);

	$effect(() => {
		const id = route.id;
		let live = true;
		loading = true;
		void loadActivity(id).then((result) => {
			if (!live) return;
			load = result;
			loading = false;
		});
		return () => {
			live = false;
		};
	});

	let detail = $derived(load?.detail ?? null);
	let profile = $derived(detail ? profileFor(detail) : null);
	let tabProps = $derived<ActivityTabProps | null>(
		detail && profile ? { detail, route, units: data.units, profile, rows: data.rows, tiles, go, swap, reach, openSheet } : null,
	);
	let title = $derived(detail ? sportTitle(detail.type) : "Activity");

	/** Why there is nothing, or not everything, to show. */
	let status = $derived.by(() => {
		if (!load) return "Loading the activity…";
		if (load.detail && !load.reason) return null;
		switch (load.reason) {
			case "signed-out":
				return load.detail ? null : "Sign in to Garmin to load this activity.";
			case "off":
				return load.detail ? null : "Workouts are switched off in the plugin's settings.";
			case "unavailable":
				return "Garmin no longer has this activity.";
			case "failed":
				return load.detail ? `Some of this activity didn't load: ${load.error ?? "unknown error"}` : `This activity didn't load: ${load.error ?? "unknown error"}`;
			default:
				return null;
		}
	});

	function choose(tab: ActivityTab) {
		swap({ ...route, tab, sub: undefined });
	}

	let expanded = $derived(route.sub?.startsWith("chart:") === true);

	/**
	 * The sticky bar and tabs' height, as `--activity-bar-height` on the page,
	 * for a tab's own sticky header to sit under them (Charts' Time | Distance).
	 */
	let barHeight = $state(94);

	function closeChart() {
		const { sub: _sub, ...rest } = route;
		swap(rest);
	}
</script>

{#if expanded && tabProps}
	<ExpandedChart {...tabProps} onClose={closeChart} />
{:else}
<div class="activity-page" style:--activity-bar-height="{barHeight}px">
	<div class="sticky" bind:clientHeight={barHeight}>
		<PageBar {title} {onBack} />
		<!-- The twin's Tabs: each tab hugs its label and the group sits centred, so the
		     strip reads the same on a phone and across a pane; it scrolls when it can't fit. -->
		<div class="tabs" role="tablist">
			{#each ACTIVITY_TABS as tab (tab)}
				<button class="tab" class:is-active={route.tab === tab} role="tab" aria-selected={route.tab === tab} onclick={() => choose(tab)}>
					<span class="tab-label">{TAB_LABELS[tab]}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if status}
		<div class="status">{status}</div>
	{/if}

	{#if tabProps}
		{#if route.tab === "stats"}
			<StatsTab {...tabProps} />
		{:else if route.tab === "laps"}
			<LapsTab {...tabProps} />
		{:else if route.tab === "charts"}
			<ChartsTab {...tabProps} />
		{:else if route.tab === "gear"}
			<GearTab {...tabProps} />
		{:else}
			<OverviewTab {...tabProps} {loading} />
		{/if}
	{/if}
</div>
{/if}

<style>
	.sticky {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--background-primary);
	}
	/* The pane's scroller has top padding that the header sticks below, so
	   without a cover the page scrolls through that strip above it. */
	.sticky::before {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: 100%;
		height: 48px;
		background: var(--background-primary);
	}
	.tabs {
		display: flex;
		align-items: flex-end;
		box-sizing: border-box;
		height: 50px;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: auto;
		height: auto;
		margin: 0;
		padding: 14px 14px 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		color: var(--text-muted);
		cursor: pointer;
	}
	/* Centred while the group fits; the auto margins give way when it scrolls. */
	.tab:first-child {
		margin-left: auto;
	}
	.tab:last-child {
		margin-right: auto;
	}
	.tab-label {
		font-size: 16px;
		line-height: 20px;
		white-space: nowrap;
	}
	/* The underline: the label's width, under it. */
	.tab::after {
		content: "";
		align-self: stretch;
		height: 2px;
		background: transparent;
	}
	.tab:hover {
		color: var(--text-normal);
	}
	.tab:focus-visible {
		outline: 2px solid var(--background-modifier-border-focus);
		outline-offset: -2px;
	}
	.tab.is-active {
		color: var(--text-normal);
		font-weight: 600;
	}
	.tab.is-active::after {
		background: var(--text-normal);
	}
	.status {
		padding: 12px 16px;
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
