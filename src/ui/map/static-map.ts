import { routePoints, routeRuns, type MapSpec, rampOf, baseOf } from "../../dashboard/activity-map";
import { fitZoom, tileCover, type Point } from "../../dashboard/map-view";
import type { ActivityDetail } from "../../sync/activity-detail";
import { PIN_ANCHOR, PIN_DROP, PIN_FILL, PIN_GLYPH_PATH, type PinKind } from "../svelte/activity/map/markers";
import type { TileSource } from "./tile-source";

/**
 * An activity's route map as a still picture, for a note exported to PDF:
 * Leaflet's static map, fitted and drawn the same way, as a JPEG data URL.
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

export interface StaticMapOptions {
	detail: ActivityDetail;
	/** The overlay that colours the route: the Overview's. */
	overlay: string;
	spec?: MapSpec;
	/** Null when map tiles are off: the route alone. */
	tiles: TileSource | null;
	/** The map's size in CSS pixels, and how many image pixels each holds. */
	width: number;
	height: number;
	scale: number;
}

/** The picture, or null for an activity without a route. Tiles that fail leave the ground showing. */
export async function staticMapImage(options: StaticMapOptions): Promise<string | null> {
	const { detail, overlay, spec, tiles, width, height, scale } = options;
	const points = routePoints(detail).map((p) => p.at);
	const fit = fitZoom(points, width, height, PADDING, MAX_ZOOM);
	if (!fit || points.length < 2) return null;
	const cover = tileCover(fit, width, height, tiles?.maxZoom ?? MAX_ZOOM);

	const canvas = createEl("canvas");
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.scale(scale, scale);
	ctx.fillStyle = GROUND;
	ctx.fillRect(0, 0, width, height);

	if (tiles) {
		await Promise.all(
			cover.tiles.map(async (tile) => {
				let url: string | undefined;
				try {
					url = await tiles.load(cover.tileZoom, tile.x, tile.y);
					const img = createEl("img");
					img.src = url;
					await img.decode();
					// Half a pixel over, as Leaflet draws them, so no seam shows.
					ctx.drawImage(img, tile.left, tile.top, cover.size + 0.5, cover.size + 0.5);
				} catch {
					// A tile that can't be had leaves the ground: the route still shows where it went.
				} finally {
					if (url) tiles.release(url);
				}
			}),
		);
	}

	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	stroke(ctx, points.map(cover.at), OUTLINE.color, OUTLINE.width);
	const ramp = rampOf(overlay, spec);
	const base = baseOf(spec);
	for (const run of routeRuns(detail, overlay, spec)) {
		stroke(ctx, run.points.map(cover.at), run.bucket === null ? base : (ramp[run.bucket] ?? base), LINE_WIDTH);
	}
	// The end under the start, as Leaflet stacks them when they meet.
	pin(ctx, "end", cover.at(points[points.length - 1]));
	pin(ctx, "start", cover.at(points[0]));
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

function pin(ctx: CanvasRenderingContext2D, kind: PinKind, [x, y]: Point): void {
	ctx.save();
	// The drawing is 22 × 28, its tip on the point.
	ctx.translate(x - PIN_ANCHOR[0], y - PIN_ANCHOR[1]);
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
