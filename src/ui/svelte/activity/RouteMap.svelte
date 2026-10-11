<script lang="ts">
	import type * as L from "leaflet";
	import type { Snippet } from "svelte";
	import { PACE_RAMP, ROUTE_BASE, RUN_WALK_RAMP, lapMarkers, routeBounds, routeEnds, routePoints, routeRuns } from "../../../dashboard/activity-map";
	import type { MapOverlay } from "../../../dashboard/routes";
	import type { ActivityDetail } from "../../../sync/activity-detail";
	import { loadLeaflet, type Leaflet } from "../../map/leaflet";
	import type { TileSource } from "../../map/tile-source";
	import { LAP_ANCHOR, LAP_SIZE, PIN_ANCHOR, PIN_SIZE, PIN_Z, lapZ, pinHtml, type PinKind } from "./map/markers";

	/**
	 * An activity's route on a map: OpenStreetMap's tiles when there are any,
	 * the route coloured by the Data Overlay over a thin dark outline, lap
	 * numbers, and the start and end pins.
	 *
	 * The same component on a desktop and a phone. A static map (Overview's)
	 * takes no gestures, so a finger scrolls the page past it, and a tap opens
	 * the full-screen one, which pans and pinches. Without tiles — the setting
	 * off, offline, refused — the route draws alone.
	 *
	 * What sits over the map (the legend, the weather chip, the layers button)
	 * comes in as `children`, placed by the page. In a dark theme only the tiles
	 * are darkened; the route, its markers and those overlays keep their colours.
	 *
	 * Leaflet waits for the map to have a size, and every resize after. A resize
	 * fits the route again: always on a static map, which can't be moved, and on
	 * the full-screen one until someone moves it.
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
		/** Overlays over the map, positioned by the page; they let drags through to the map. */
		children?: Snippet;
	}

	let { detail, tiles, interactive, overlay = "pace", laps = true, onOpen, children }: Props = $props();

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
		let moved = false;
		const touched = () => {
			moved = true;
		};
		const start = async () => {
			starting = true;
			const leaflet = await loadLeaflet();
			if (!alive) return;
			created = build(leaflet, target);
			lib = leaflet;
			map = created;
		};
		// A frame later: resizing the map inside the observer's own callback is a layout loop.
		const resize = new ResizeObserver(() =>
			requestAnimationFrame(() => {
				if (!alive) return;
				if (!created) {
					if (!starting && target.clientWidth > 0 && target.clientHeight > 0) void start();
				} else if (moved) {
					created.invalidateSize();
				} else {
					created.invalidateSize({ pan: false });
					fit(created);
				}
			}),
		);
		resize.observe(target);
		if (interactive) {
			target.addEventListener("pointerdown", touched);
			target.addEventListener("wheel", touched, { passive: true });
			target.addEventListener("keydown", touched);
		}
		return () => {
			alive = false;
			resize.disconnect();
			target.removeEventListener("pointerdown", touched);
			target.removeEventListener("wheel", touched);
			target.removeEventListener("keydown", touched);
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
		fit(m);
		return m;
	}

	/** The whole route in view, clear of the edges. */
	function fit(m: L.Map): void {
		const bounds = routeBounds(points);
		if (bounds) m.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: false });
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
		// A thin dark outline under the whole route, as Garmin draws it.
		leaflet
			.polyline(
				points.map((p) => p.at),
				{ color: "#1a1a1a", weight: 6, opacity: 0.55, lineCap: "round", lineJoin: "round", interactive: false },
			)
			.addTo(group);
		for (const run of routeRuns(detail, overlay)) {
			leaflet
				.polyline(run.points, {
					color: run.bucket === null ? ROUTE_BASE : ramp[run.bucket]!,
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
				const icon = leaflet.divIcon({ className: "gc-map-lap", html: String(lap.n), iconSize: LAP_SIZE, iconAnchor: LAP_ANCHOR });
				leaflet.marker(lap.at, { icon, interactive: false, keyboard: false, zIndexOffset: lapZ(lap.n) }).addTo(group);
			}
		}
		const ends = routeEnds(points);
		if (ends) {
			const pin = (kind: PinKind) =>
				leaflet.marker(kind === "start" ? ends.start : ends.end, {
					icon: leaflet.divIcon({ className: `gc-map-pin is-${kind}`, html: pinHtml(kind), iconSize: PIN_SIZE, iconAnchor: PIN_ANCHOR }),
					interactive: false,
					keyboard: false,
					zIndexOffset: PIN_Z[kind],
				});
			// The start over the end, which a loop puts in the same place.
			pin("end").addTo(group);
			pin("start").addTo(group);
		}
		group.addTo(m);
		return () => {
			group.remove();
		};
	});
</script>

<div class="gc-route-map" class:is-static={!interactive}>
	<!-- On a phone a drag or pinch here is the map's: Obsidian starts no sidebar
	     swipe inside data-ignore-swipe, as on its canvas. Stopping the touches
	     instead would keep them from Leaflet too, which follows them on the document. -->
	<div class="gc-map-canvas" bind:this={el} data-ignore-swipe={interactive ? "true" : undefined}></div>
	{#if children}
		<div class="gc-map-overlays">{@render children()}</div>
	{/if}
	{#if !interactive && onOpen}
		<button class="gc-map-open" onclick={onOpen}><span class="gc-visually-hidden">Open the map</span></button>
	{/if}
	{#if tiles && tileErrors > 0 && interactive}
		<div class="gc-map-note">Map tiles unavailable — showing the route only</div>
	{/if}
</div>

<style>
	/* Its own stacking context: Leaflet's panes (z-index 400 and up) stay
	   inside the map rather than over the page's sticky header. */
	.gc-route-map {
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.gc-map-canvas {
		position: absolute;
		inset: 0;
	}
	.gc-map-overlays {
		position: absolute;
		inset: 0;
		z-index: 1000;
		pointer-events: none;
	}
	.gc-map-open {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 0;
		box-shadow: none;
		background: transparent;
		cursor: pointer;
		z-index: 1100;
	}
	.gc-map-open:focus-visible {
		outline: 2px solid var(--background-modifier-border-focus);
		outline-offset: -2px;
	}
	.gc-map-note {
		position: absolute;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		z-index: 1000;
		padding: 4px 10px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 13px;
		font-size: 12px;
		line-height: 16px;
		white-space: nowrap;
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
	/* A fractional zoom (the Overview's 12.5) scales the tiles, and Chromium
	   leaves hairlines between them. Leaflet's own fix, adding the tiles' edges
	   together (plus-lighter), still shows a light line: each tile overlaps the
	   next by a pixel instead, drawn over it normally. */
	.gc-route-map :global(.leaflet-tile-container img.leaflet-tile) {
		width: 257px !important;
		height: 257px !important;
		mix-blend-mode: normal;
	}
	/* The dark theme's map: the tiles only, so the route keeps its colours. */
	:global(body.theme-dark) .gc-route-map :global(.leaflet-tile-pane) {
		filter: invert(1) hue-rotate(180deg) saturate(0.5) brightness(0.85) contrast(0.85);
	}
	/* Leaflet's attribution as the twin's Map Attribution: bottom right, in the theme's colours. */
	.gc-route-map :global(.leaflet-control-attribution) {
		margin: 0;
		padding: 2px 6px;
		border-radius: 4px 0 0 0;
		background: var(--background-primary);
		color: var(--text-muted);
		font-size: 11px;
		line-height: 14px;
	}
	.gc-route-map :global(.leaflet-control-attribution a) {
		color: var(--text-accent);
		text-decoration: none;
	}
	.gc-route-map :global(.gc-map-lap) {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		border: 1px solid rgba(0, 0, 0, 0.35);
		border-radius: 50%;
		background: #fff;
		color: #000;
		font-size: 12px;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.gc-route-map :global(.gc-map-pin svg) {
		display: block;
		overflow: visible;
		filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.3));
	}
</style>
