<script lang="ts">
	import { duration } from "../../../dashboard/series";
	import { formatDistance } from "../../../dashboard/activities";
	import { hasRoute } from "../../../dashboard/activity-map";
	import { activityMapRoute } from "../../../dashboard/routes";
	import RouteMap from "./RouteMap.svelte";
	import type { ActivityTabProps } from "./types";

	/**
	 * Overview: the route map, then the activity's name and headline figures.
	 * The foundation's version, enough to open the map; the Overview build
	 * replaces it with Garmin's layout.
	 */
	let { detail, units, tiles, go }: ActivityTabProps = $props();

	let distance = $derived(typeof detail.summary.distance === "number" ? formatDistance(detail.summary.distance, units, 2, true) : null);
	let time = $derived(typeof detail.summary.duration === "number" ? duration(Math.round(detail.summary.duration)) : null);
</script>

{#if hasRoute(detail)}
	<div class="inline-map">
		<RouteMap {detail} tiles={tiles()} interactive={false} laps={false} onOpen={() => go(activityMapRoute(detail.id))} />
	</div>
{/if}
<div class="overview">
	<div class="when">{detail.start.replace("T", " ").slice(0, 16)}</div>
	<h2 class="name">{detail.name}</h2>
	{#if distance}<div class="figure">{distance}</div>{/if}
	{#if time}<div class="figure">{time}</div>{/if}
</div>

<style>
	.inline-map {
		height: 260px;
	}
	.overview {
		padding: 16px;
	}
	.when {
		color: var(--text-muted);
		font-size: 14px;
	}
	.name {
		margin: 8px 0;
		font-size: 24px;
	}
	.figure {
		font-size: 20px;
		margin: 4px 0;
	}
</style>
