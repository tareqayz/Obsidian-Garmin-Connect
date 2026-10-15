<script lang="ts">
	import { hasRoute, mapLegend, mapOverlays, overlayFor, overlayLabel } from "../../../dashboard/activity-map";
	import { profileFor } from "../../../dashboard/activity-sports";
	import type { ActivityMapRoute, Route } from "../../../dashboard/routes";
	import type { ActivityDetail, ActivityLoad } from "../../../sync/activity-detail";
	import type { TileSource } from "../../map/tile-source";
	import type { OpenSheet } from "../../sheet-modal";
	import PageBar from "../home/PageBar.svelte";
	import { lucide } from "../home/lucide";
	import MapLegend from "./map/MapLegend.svelte";
	import MapSettings from "./map/MapSettings.svelte";
	import RouteMap from "./RouteMap.svelte";

	/**
	 * The full-screen map the Overview map opens: the route over the whole
	 * pane, to pan and pinch, with the lap numbers, the legend and the layers
	 * button that opens Map Settings. A page of its own on the stack, as on the
	 * phone, so Back returns to the activity where it was. Map Settings' choices
	 * are the route's (`overlay`, `laps`), so a reload keeps them. The overlays
	 * on offer, their words and colours are the sport's (its profile's map).
	 */
	interface Props {
		route: ActivityMapRoute;
		loadActivity: (id: number) => Promise<ActivityLoad>;
		cachedActivity: (id: number) => ActivityDetail | null;
		tiles: () => TileSource | null;
		openSheet: OpenSheet;
		onBack: () => void;
		swap: (route: Route) => void;
	}

	let { route, loadActivity, cachedActivity, tiles, openSheet, onBack, swap }: Props = $props();

	// svelte-ignore state_referenced_locally
	let detail = $state.raw<ActivityDetail | null>(cachedActivity(route.id));
	let loaded = $state(false);

	$effect(() => {
		const id = route.id;
		let live = true;
		void loadActivity(id).then((load) => {
			if (!live) return;
			if (load.detail) detail = load.detail;
			loaded = true;
		});
		return () => {
			live = false;
		};
	});

	/** The sport's map: its overlays, their words and colours (the run's without one). */
	let spec = $derived(detail ? profileFor(detail).map : undefined);
	/** What the map draws: the route's overlay when the activity has its data. */
	let overlay = $derived(detail ? overlayFor(detail, route.overlay, spec) : route.overlay);
	let legend = $derived(mapLegend(overlay, spec));

	function openSettings() {
		const current = detail;
		if (!current) return;
		const overlays = mapOverlays(current, spec);
		openSheet("Map Settings", MapSettings, {
			provider: tiles() ? "OpenStreetMap" : "Route only (map tiles off)",
			laps: route.laps,
			overlay,
			overlays,
			labels: Object.fromEntries(overlays.map((o) => [o, overlayLabel(o, spec)])),
			// Read the route when the choice is made: the sheet outlives the page's props.
			onLaps: (laps: boolean) => swap({ ...route, laps }),
			onOverlay: (next: string) => swap({ ...route, overlay: next }),
		});
	}

	/* The map fills what the pane shows below the bar, whatever its padding. */
	let host = $state<HTMLElement | null>(null);
	let barHeight = $state(44);
	let height = $state(0);

	$effect(() => {
		const scroller = host?.closest<HTMLElement>(".view-content");
		if (!scroller) return;
		const measure = () => {
			const style = getComputedStyle(scroller);
			const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
			height = Math.max(240, scroller.clientHeight - padding - barHeight);
		};
		// A frame later: a height set inside the observer's own callback is a layout loop.
		let frame = 0;
		const resize = new ResizeObserver(() => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		});
		resize.observe(scroller);
		measure();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
		};
	});
</script>

<div class="activity-map-page" bind:this={host}>
	<div bind:clientHeight={barHeight}>
		<PageBar title={detail?.name || "Map"} {onBack} />
	</div>
	<div class="map-area" style:height="{height}px">
		<div class="map-frame">
			{#if detail && hasRoute(detail)}
				<RouteMap {detail} tiles={tiles()} interactive {overlay} map={spec} laps={route.laps}>
					{#if legend}<div class="legend-at"><MapLegend {legend} /></div>{/if}
					<button class="layers" aria-label="Map Settings" onclick={openSettings}><span use:lucide={"layers"}></span></button>
				</RouteMap>
			{:else if detail || loaded}
				<div class="empty">{detail ? "This activity has no route to draw." : "This activity didn’t load."}</div>
			{:else}
				<div class="empty">Loading the map…</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.map-area {
		box-sizing: border-box;
		width: 100%;
	}
	.map-frame {
		position: relative;
		height: 100%;
		overflow: hidden;
		background: var(--background-secondary);
	}
	.legend-at {
		position: absolute;
		top: 12px;
		left: 12px;
	}
	.layers {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 36px;
		height: 36px;
		margin: 0;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
		color: var(--text-normal);
		cursor: pointer;
		pointer-events: auto;
	}
	.layers:hover {
		color: var(--text-accent);
	}
	.layers :global(svg) {
		width: 20px;
		height: 20px;
	}
	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 0 24px;
		font-size: 14px;
		text-align: center;
		color: var(--text-muted);
	}

	/* A wider pane: the map inset like the page's content, its corners rounded. */
	@container (min-width: 640px) {
		.map-area {
			padding: 16px 32px 32px;
		}
		.map-frame {
			border-radius: 8px;
		}
	}
</style>
