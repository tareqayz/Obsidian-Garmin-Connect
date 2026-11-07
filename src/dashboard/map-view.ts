import type { LatLon } from "./activity-map";

/**
 * A map's view without Leaflet: the Web Mercator projection the tiles are
 * drawn in, Leaflet's `fitBounds` zoom, and the tiles that cover a box. The
 * still map an exported note prints (`src/ui/map/static-map.ts`) and the
 * share images' route both stand on it.
 *
 * Pure: no Obsidian import.
 */

/** A point in pixels, [x, y]. */
export type Point = [number, number];

/** A tile's side in pixels at its own zoom. */
export const TILE_SIZE = 256;

/** Web Mercator, as the map tiles are drawn: the unit square, north up. */
export function mercator([lat, lon]: LatLon): Point {
	const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
	const s = Math.sin((clamped * Math.PI) / 180);
	return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

export interface MapFit {
	/** Leaflet's zoom: fractional, in `snap` steps. */
	zoom: number;
	/** The route's middle, in unit-square coordinates. */
	center: Point;
}

/**
 * The view Leaflet's `fitBounds(bounds, { padding, maxZoom })` picks for a
 * `width` × `height` map with `zoomSnap: snap`: the deepest zoom, rounded
 * down to a step, at which the route fits inside the padding, and the
 * route's middle in the middle. A route that never moved gets `maxZoom`.
 */
export function fitZoom(points: readonly LatLon[], width: number, height: number, padding: number, maxZoom: number, snap = 0.25): MapFit | null {
	if (!points.length) return null;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		const [x, y] = mercator(p);
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	const center: Point = [(minX + maxX) / 2, (minY + maxY) / 2];
	const spanX = (maxX - minX) * TILE_SIZE;
	const spanY = (maxY - minY) * TILE_SIZE;
	const room = Math.min(spanX > 0 ? (width - 2 * padding) / spanX : Infinity, spanY > 0 ? (height - 2 * padding) / spanY : Infinity);
	if (!Number.isFinite(room) || room <= 0) return { zoom: maxZoom, center };
	// Leaflet rounds to a hundredth of a step first, then down to a step.
	const exact = Math.round(Math.log2(room) / (snap / 100)) * (snap / 100);
	return { zoom: Math.min(maxZoom, Math.floor(exact / snap) * snap), center };
}

export interface TilePlace {
	/** The tile's column and row at the cover's tile zoom, the column wrapped round the world. */
	x: number;
	y: number;
	/** Where its top-left corner falls in the box, in pixels. */
	left: number;
	top: number;
}

export interface TileCover {
	/** The zoom the tiles are fetched at: the view's, rounded, as Leaflet's tile layer does. */
	tileZoom: number;
	/** A tile's side in the box: 256 scaled by the view's fractional zoom. */
	size: number;
	tiles: TilePlace[];
	/** Where a point lands in the box. */
	at: (point: LatLon) => Point;
}

/** The tiles a `width` × `height` box needs for a view, with where each one goes. */
export function tileCover(fit: MapFit, width: number, height: number, maxTileZoom: number): TileCover {
	const tileZoom = Math.max(0, Math.min(maxTileZoom, Math.round(fit.zoom)));
	const size = TILE_SIZE * 2 ** (fit.zoom - tileZoom);
	const world = TILE_SIZE * 2 ** fit.zoom;
	const left = fit.center[0] * world - width / 2;
	const top = fit.center[1] * world - height / 2;
	const count = 2 ** tileZoom;
	const tiles: TilePlace[] = [];
	for (let ty = Math.floor(top / size); ty * size < top + height; ty += 1) {
		if (ty < 0 || ty >= count) continue;
		for (let tx = Math.floor(left / size); tx * size < left + width; tx += 1) {
			tiles.push({ x: ((tx % count) + count) % count, y: ty, left: tx * size - left, top: ty * size - top });
		}
	}
	const at = (point: LatLon): Point => {
		const [x, y] = mercator(point);
		return [x * world - left, y * world - top];
	};
	return { tileZoom, size, tiles, at };
}
