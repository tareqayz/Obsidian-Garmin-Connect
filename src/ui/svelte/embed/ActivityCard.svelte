<script lang="ts">
	import { mapLegend, overlayFor, overviewOverlay } from "../../../dashboard/activity-map";
	import { profileFor } from "../../../dashboard/activity-sports";
	import type { ActivityCardView } from "../../../embeds/view";
	import type { TileSource } from "../../map/tile-source";
	import MapLegend from "../activity/map/MapLegend.svelte";
	import RouteMap from "../activity/RouteMap.svelte";
	import Stat from "../home/Stat.svelte";
	import { lucide } from "../home/lucide";

	/**
	 * One activity in a note, in a Home card (Figma 1319:2, F · Card): the
	 * sport's figure in its blue disc, the name and when, the route map as
	 * the Overview draws it (static, its overlay and key), and four figures.
	 * Before the activity's page has loaded the map, a line says how to get it.
	 * A click anywhere opens the activity: the map takes no gestures, so a
	 * finger scrolls the note past it.
	 */
	let { card, tiles }: { card: ActivityCardView; tiles: TileSource | null } = $props();

	let profile = $derived(card.detail ? profileFor(card.detail) : null);
	let overlay = $derived(card.detail && profile ? overlayFor(card.detail, overviewOverlay(profile.map), profile.map) : "none");
	let legend = $derived(profile ? mapLegend(overlay, profile.map) : null);
</script>

<article class="gca-card">
	<header>
		<span class="disc"><span class="glyph" use:lucide={card.icon}></span></span>
		<span class="name">
			<span class="title">{card.title}</span>
			<span class="when">{card.when}</span>
		</span>
	</header>
	{#if card.detail}
		<div class="map">
			<RouteMap detail={card.detail} {tiles} interactive={false} laps={false} {overlay} map={profile?.map}>
				{#if legend}<div class="legend"><MapLegend {legend} /></div>{/if}
			</RouteMap>
		</div>
	{:else if card.mapNote}
		<div class="map is-empty">{card.mapNote}</div>
	{/if}
	{#if card.figures.length}
		<div class="figures">
			{#each card.figures as figure (figure.label)}
				<Stat value={figure.value} label={figure.label} />
			{/each}
		</div>
	{/if}
</article>

<style>
	/* Home's card (HomeCard.svelte), full width. */
	.gca-card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
		box-sizing: border-box;
		padding: 16px;
		border-radius: var(--radius-m, 8px);
		background: var(--background-secondary);
		color: var(--text-normal);
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	/* Today's Activity row's badge (RowCard.svelte), with the sport's own figure. */
	.disc {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--color-blue);
		color: var(--text-on-accent);
	}
	.glyph {
		display: inline-flex;
	}
	.glyph :global(svg) {
		width: 20px;
		height: 20px;
	}
	.name {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.title {
		overflow: hidden;
		font-size: 15px;
		font-weight: var(--font-semibold, 600);
		line-height: 20px;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.when {
		font-size: 13px;
		line-height: 16px;
		color: var(--text-muted);
	}
	/* The Overview's map: a fixed height Leaflet fills, the route on its own ground without tiles. */
	.map {
		position: relative;
		height: 206px;
		overflow: hidden;
		border-radius: 6px;
		background: var(--background-primary);
	}
	.map > :global(.gc-route-map) {
		position: absolute;
		inset: 0;
		height: auto;
	}
	.map.is-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: auto;
		padding: 20px 16px;
		font-size: 13px;
		line-height: 16px;
		text-align: center;
		color: var(--text-muted);
	}
	.legend {
		position: absolute;
		top: var(--gc-map-inset, 8px);
		left: var(--gc-map-inset, 8px);
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 16px;
	}
	@container (min-width: 520px) {
		.map {
			height: 300px;
		}
		.figures {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
