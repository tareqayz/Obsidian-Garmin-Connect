<script lang="ts">
	import type * as L from "leaflet";
	import { PACE_RAMP, RUN_WALK_RAMP, lapMarkers, routeBounds, routeEnds, routePoints, routeRuns } from "../../../dashboard/activity-map";
	import type { MapOverlay } from "../../../dashboard/routes";
	import type { ActivityDetail } from "../../../sync/activity-detail";
	import { loadLeaflet, type Leaflet } from "../../map/leaflet";
	import type { TileSource } from "../../map/tile-source";

	/**
	 * An activity's route on a map: OpenStreetMap's tiles when there are any,
	 * the route coloured by the Data Overlay, lap numbers and the start and end.
	 *
	 * The same component on a desktop and a phone. A static map (Overview's)
	 * takes no gestures, so a finger scrolls the page past it, and a tap opens
	 * the full-screen one, which pans and pinches. Without tiles — the setting
	 * off, offline, refused — the route draws alone.
	 *
	 * Leaflet waits for the map to have a size, and every resize after.
	 */
	interface Props {
		detail: ActivityDetail;
		tiles: TileSource | null;
		interactive: boolean;
		overlay?: MapOverlay;
		/** Lap numbers on the route. */
		laps?: boolean;
		/** A static map's tap. */
		onOpen?: () => void;
	}

	let { detail, tiles, interactive, overlay = "pace", laps = true, onOpen }: Props = $props();

	let el = $state<HTMLDivElement | null>(null);
	let lib = $state.raw<Leaflet | null>(null);
	let map = $state.raw<L.Map | null>(null);
	let tileErrors = $state(0);

	const points = $derived(routePoints(detail));

	$effect(() => {
		const target = el;
		if (!target) return;
		let alive = true;
		let starting = false;
		let created: L.Map | null = null;
		const start = async () => {
			starting = true;
			const leaflet = await loadLeaflet();
			if (!alive) return;
			created = build(leaflet, target);
			lib = leaflet;
			map = created;
		};
		const resize = new ResizeObserver(() => {
			if (created) created.invalidateSize();
			else if (!starting && target.clientWidth > 0 && target.clientHeight > 0) void start();
		});
		resize.observe(target);
		// On a phone the map keeps its drags: Obsidian's sidebar swipe must not see them.
		const keep = (e: Event) => e.stopPropagation();
		if (interactive) {
			target.addEventListener("touchstart", keep, { passive: true });
			target.addEventListener("touchmove", keep, { passive: true });
		}
		return () => {
			alive = false;
			resize.disconnect();
			target.removeEventListener("touchstart", keep);
			target.removeEventListener("touchmove", keep);
			created?.remove();
			map = null;
		};
	});

	function build(leaflet: Leaflet, target: HTMLElement): L.Map {
		const m = leaflet.map(target, {
			zoomControl: false,
			attributionControl: !!tiles,
			dragging: interactive,
			touchZoom: interactive,
			scrollWheelZoom: interactive,
			doubleClickZoom: interactive,
			boxZoom: false,
			keyboard: interactive,
			zoomSnap: 0.25,
		});
		if (tiles) {
			m.attributionControl.setPrefix(false);
			tileLayer(leaflet, tiles).addTo(m);
		}
		const bounds = routeBounds(points);
		if (bounds) m.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
		return m;
	}

	/** Leaflet's grid, filled through the tile source rather than an `<img>` URL. */
	function tileLayer(leaflet: Leaflet, source: TileSource): L.GridLayer {
		type Tile = HTMLImageElement & { gcAbort?: AbortController; gcUrl?: string };
		const Layer = leaflet.GridLayer.extend({
			createTile(coords: L.Coords, done: L.DoneCallback) {
				const img = document.createElement("img") as Tile;
				img.alt = "";
				img.setAttribute("role", "presentation");
				img.gcAbort = new AbortController();
				source.load(coords.z, coords.x, coords.y, img.gcAbort.signal).then(
					(url) => {
						img.gcUrl = url;
						img.onload = () => done(undefined, img);
						img.onerror = () => done(new Error("tile"), img);
						img.src = url;
					},
					(err: unknown) => {
						tileErrors += 1;
						done(err instanceof Error ? err : new Error(String(err)), img);
					},
				);
				return img;
			},
		}) as unknown as new (options: L.GridLayerOptions) => L.GridLayer;
		const layer = new Layer({ maxZoom: source.maxZoom, attribution: source.attribution, tileSize: 256 });
		layer.on("tileunload", (e) => {
			const tile = (e as L.TileEvent).tile as Tile;
			tile.gcAbort?.abort();
			if (tile.gcUrl) source.release(tile.gcUrl);
		});
		return layer;
	}

	// The route, redrawn when the overlay or the laps toggle change.
	$effect(() => {
		const m = map;
		const leaflet = lib;
		if (!m || !leaflet) return;
		const ramp = overlay === "run-walk" ? RUN_WALK_RAMP : PACE_RAMP;
		const group = leaflet.layerGroup();
		for (const run of routeRuns(detail, overlay, ramp.length)) {
			leaflet
				.polyline(run.points, {
					color: run.bucket === null ? "#3a7bd5" : ramp[run.bucket]!,
					weight: 4,
					opacity: 1,
					lineCap: "round",
					lineJoin: "round",
					interactive: false,
				})
				.addTo(group);
		}
		if (laps) {
			for (const lap of lapMarkers(detail)) {
				const icon = leaflet.divIcon({ className: "gc-map-lap", html: String(lap.n), iconSize: [22, 22], iconAnchor: [11, 11] });
				leaflet.marker(lap.at, { icon, interactive: false, keyboard: false }).addTo(group);
			}
		}
		const ends = routeEnds(points);
		if (ends) {
			const pin = (kind: string) => leaflet.divIcon({ className: `gc-map-pin ${kind}`, html: "", iconSize: [20, 20], iconAnchor: [10, 10] });
			leaflet.marker(ends.end, { icon: pin("is-end"), interactive: false, keyboard: false }).addTo(group);
			leaflet.marker(ends.start, { icon: pin("is-start"), interactive: false, keyboard: false }).addTo(group);
		}
		group.addTo(m);
		return () => {
			group.remove();
		};
	});
</script>

<div class="gc-route-map" class:is-static={!interactive}>
	<div class="gc-map-canvas" bind:this={el}></div>
	{#if !interactive && onOpen}
		<button class="gc-map-open" onclick={onOpen}><span class="gc-visually-hidden">Open the map</span></button>
	{/if}
	{#if tiles && tileErrors > 0 && interactive}
		<div class="gc-map-note">Map tiles unavailable — showing the route only</div>
	{/if}
</div>

<style>
	.gc-route-map {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.gc-map-canvas {
		position: absolute;
		inset: 0;
	}
	.gc-map-open {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		box-shadow: none;
		background: transparent;
		cursor: pointer;
		z-index: 500;
	}
	.gc-map-note {
		position: absolute;
		left: 50%;
		bottom: 12px;
		transform: translateX(-50%);
		z-index: 500;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		background: var(--background-primary);
		color: var(--text-muted);
	}
	.gc-visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	.gc-route-map :global(.leaflet-container) {
		background: var(--background-secondary);
		font: inherit;
	}
	.gc-route-map :global(.gc-map-lap) {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #fff;
		color: #000;
		border: 1px solid rgba(0, 0, 0, 0.35);
		font-size: 12px;
		font-weight: 600;
	}
	.gc-route-map :global(.gc-map-pin) {
		border-radius: 50%;
		border: 2px solid #fff;
	}
	.gc-route-map :global(.gc-map-pin.is-start) {
		background: #3cb043;
	}
	.gc-route-map :global(.gc-map-pin.is-end) {
		background: #e0312b;
	}
</style>
