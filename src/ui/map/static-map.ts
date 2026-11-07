import { baseOf, rampOf, routePoints, routeRuns, type LatLon, type MapSpec } from "../../dashboard/activity-map";
import { fitZoom, tileCover, type Point } from "../../dashboard/map-view";
import type { ActivityDetail } from "../../sync/activity-detail";
import { PIN_ANCHOR, PIN_DROP, PIN_FILL, PIN_GLYPH_PATH, type PinKind } from "../svelte/activity/map/markers";
import type { TileSource } from "./tile-source";

/**
 * An activity's route map as a still picture: Leaflet's static map, fitted
 * and drawn the same way, on a canvas. A note exported to PDF prints it
 * (`staticMapImage`) and Share's Map template draws it (`drawRouteMap`).
 *
 * Export lays a note out once in a hidden window, then prints it at the
 * page's width with no script running: a live map fitted to the first width
 * comes out cropped, and on a phone, where the page's HTML is copied into
 * the print, its `blob:` tiles don't come along at all. A picture scales
 * with the page and travels inside the HTML.
 */

/** Leaflet's fit, as RouteMap asks for it. */
const PADDING = 24;
const MAX_ZOOM = 17;
/** The route as RouteMap draws it: a dark outline under the coloured runs. */
const OUTLINE = { color: "rgba(26, 26, 26, 0.55)", width: 6 };
const LINE_WIDTH = 4;
/** The ground where no tile came: the map's own light grey. */
const GROUND = "#f2f2f0";

export interface RouteMapDrawing {
	/** Every GPS point, and the route's coloured stretches. */
	points: readonly LatLon[];
	runs: ReadonlyArray<{ color: string; points: readonly LatLon[] }>;
	/** Null when map tiles are off: the route alone. */
	tiles: TileSource | null;
	/** Where the map goes, in the canvas's own pixels. */
	box: { x: number; y: number; w: number; h: number };
	/** Canvas pixels per map pixel: 2 draws the map as a high-density screen shows it. */
	unit: number;
	/** Room around the route, in map pixels: RouteMap's 24 by default. */
	padding?: number;
	/**
	 * Fits the route as a map this many times as tall as wide would, then
	 * centres it in the box: Garmin's share map keeps the Overview's zoom, so a
	 * round route has its surroundings and a long one fills the width.
	 */
	fitAspect?: number;
	/** The route's line and the pins, scaled from RouteMap's. */
	lineScale?: number;
	pinScale?: number;
	/** OpenStreetMap's credit in the corner, as their tiles ask. */
	attribution?: boolean;
}

/**
 * Draws a route map into `box`. It waits for the tiles first, then draws in
 * one go; a tile that fails leaves the ground, and the route still shows.
 * The canvas's transform is put back afterwards.
 */
export async function drawRouteMap(ctx: CanvasRenderingContext2D, drawing: RouteMapDrawing): Promise<void> {
	const { points, runs, tiles, box, unit } = drawing;
	const width = box.w / unit;
	const height = box.h / unit;
	const fitHeight = drawing.fitAspect ? Math.min(height, width * drawing.fitAspect) : height;
	const fit = fitZoom(points, width, fitHeight, drawing.padding ?? PADDING, MAX_ZOOM);
	if (!fit || points.length < 2) return;
	const cover = tileCover(fit, width, height, tiles?.maxZoom ?? MAX_ZOOM);

	const images = tiles
		? await Promise.all(
				cover.tiles.map(async (tile) => {
					let url: string | undefined;
					try {
						url = await tiles.load(cover.tileZoom, tile.x, tile.y);
						const img = createEl("img");
						img.src = url;
						await img.decode();
						return { tile, img };
					} catch {
						// A tile that can't be had leaves the ground: the route still shows where it went.
						return null;
					} finally {
						if (url) tiles.release(url);
					}
				}),
			)
		: [];

	ctx.save();
	ctx.setTransform(unit, 0, 0, unit, box.x, box.y);
	ctx.beginPath();
	ctx.rect(0, 0, width, height);
	ctx.clip();
	ctx.fillStyle = GROUND;
	ctx.fillRect(0, 0, width, height);
	for (const drawn of images) {
		// Half a pixel over, as Leaflet draws them, so no seam shows.
		if (drawn) ctx.drawImage(drawn.img, drawn.tile.left, drawn.tile.top, cover.size + 0.5, cover.size + 0.5);
	}
	const lines = drawing.lineScale ?? 1;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	stroke(ctx, points.map(cover.at), OUTLINE.color, OUTLINE.width * lines);
	for (const run of runs) stroke(ctx, run.points.map(cover.at), run.color, LINE_WIDTH * lines);
	// The end under the start, as Leaflet stacks them when they meet.
	const pins = drawing.pinScale ?? 1;
	pin(ctx, "end", cover.at(points[points.length - 1]), pins);
	pin(ctx, "start", cover.at(points[0]), pins);
	if (tiles && drawing.attribution) credit(ctx, width, height);
	ctx.restore();
}

/** The picture an exported activity card prints, or null for an activity without a route. */
export async function staticMapImage(options: {
	detail: ActivityDetail;
	/** The overlay that colours the route: the Overview's. */
	overlay: string;
	spec?: MapSpec;
	tiles: TileSource | null;
	/** The map's size in CSS pixels, and how many image pixels each holds. */
	width: number;
	height: number;
	scale: number;
}): Promise<string | null> {
	const { detail, overlay, spec, tiles, width, height, scale } = options;
	const points = routePoints(detail).map((p) => p.at);
	if (points.length < 2) return null;
	const ramp = rampOf(overlay, spec);
	const base = baseOf(spec);
	const runs = routeRuns(detail, overlay, spec).map((run) => ({ color: run.bucket === null ? base : (ramp[run.bucket] ?? base), points: run.points }));
	const canvas = createEl("canvas");
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	await drawRouteMap(ctx, { points, runs, tiles, box: { x: 0, y: 0, w: canvas.width, h: canvas.height }, unit: scale });
	return canvas.toDataURL("image/jpeg", 0.9);
}

function stroke(ctx: CanvasRenderingContext2D, line: readonly Point[], color: string, width: number): void {
	if (line.length < 2) return;
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(line[0][0], line[0][1]);
	for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i][0], line[i][1]);
	ctx.stroke();
}

function pin(ctx: CanvasRenderingContext2D, kind: PinKind, [x, y]: Point, scale: number): void {
	ctx.save();
	// The drawing is 22 × 28, its tip on the point.
	ctx.translate(x, y);
	ctx.scale(scale, scale);
	ctx.translate(-PIN_ANCHOR[0], -PIN_ANCHOR[1]);
	const drop = new Path2D(PIN_DROP);
	ctx.fillStyle = PIN_FILL[kind];
	ctx.fill(drop);
	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 1.5;
	ctx.stroke(drop);
	ctx.fillStyle = "#ffffff";
	ctx.fill(new Path2D(PIN_GLYPH_PATH[kind]));
	ctx.restore();
}

/** "© OpenStreetMap contributors" in the bottom right corner, as the live map shows it. */
function credit(ctx: CanvasRenderingContext2D, width: number, height: number): void {
	const text = "© OpenStreetMap contributors";
	ctx.font = "11px -apple-system, system-ui, sans-serif";
	const w = ctx.measureText(text).width + 10;
	ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
	ctx.fillRect(width - w, height - 16, w, 16);
	ctx.fillStyle = "#333333";
	ctx.textBaseline = "middle";
	ctx.fillText(text, width - w + 5, height - 8);
}
