<script lang="ts">
	import type { ActivitiesData } from "../../../dashboard/activities";
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
	 * Each tab is its own component with the same props (`ActivityTabProps`).
	 * A chart badge opens the expanded chart in place of the page (`route.sub`
	 * "chart:…"): the phone turns sideways for it, the view gives it the pane.
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

	$effect(() => {
		const id = route.id;
		let live = true;
		void loadActivity(id).then((result) => {
			if (live) load = result;
		});
		return () => {
			live = false;
		};
	});

	let detail = $derived(load?.detail ?? null);
	let tabProps = $derived<ActivityTabProps | null>(detail ? { detail, route, units: data.units, tiles, go, swap, reach, openSheet } : null);
	let title = $derived(detail ? sportTitle(detail.type) : "Activity");

	/** Garmin's typeKey as the bar's title: `treadmill_running` → "Treadmill Running". */
	function sportTitle(type: string): string {
		return type
			.split("_")
			.filter(Boolean)
			.map((word) => word[0]!.toUpperCase() + word.slice(1))
			.join(" ");
	}

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

	function closeChart() {
		const { sub: _sub, ...rest } = route;
		swap(rest);
	}
</script>

{#if expanded && tabProps}
	<ExpandedChart {...tabProps} onClose={closeChart} />
{:else}
<div class="activity-page">
	<div class="sticky">
		<PageBar {title} {onBack} />
		<div class="tabs" role="tablist">
			{#each ACTIVITY_TABS as tab (tab)}
				<button class="tab" class:is-active={route.tab === tab} role="tab" aria-selected={route.tab === tab} onclick={() => choose(tab)}>
					{TAB_LABELS[tab]}
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
			<OverviewTab {...tabProps} />
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
	.tabs {
		display: flex;
		overflow-x: auto;
		scrollbar-width: none;
		border-bottom: 1px solid var(--background-modifier-border);
	}
	.tab {
		flex: 1 0 auto;
		height: auto;
		margin: 0;
		padding: 12px 14px 10px;
		border: none;
		border-bottom: 2px solid transparent;
		border-radius: 0;
		box-shadow: none;
		background: none;
		font: inherit;
		font-size: 15px;
		color: var(--text-muted);
		cursor: pointer;
	}
	.tab.is-active {
		color: var(--text-normal);
		font-weight: 600;
		border-bottom-color: var(--text-normal);
	}
	.status {
		padding: 12px 16px;
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
