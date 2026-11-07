import type { SportGlyph } from "./activities";
import type { LatLon } from "./activity-map";
import { ratioOf, type ShareFigure, type ShareRatioId, type ShareRoute, type ShareView } from "./activity-share";
import { mercator, type Point } from "./map-view";
import { chevronLines, contourLines, stripeLines, type Box } from "./share-art";

/**
 * The share images' layouts: each template, at each aspect ratio, as a list
 * of drawing steps in Garmin's points (the image is 402 pt wide, as the
 * phone draws it; `src/ui/share/draw.ts` paints it at 1080 px). Nothing here
 * measures text: the painter fits a figure into its width.
 *
 * Every place is measured off Garmin's saved images (spec: ref/share/
 * README.md). 9:16 keeps Stories clear of the app's own bars: the header sits
 * lower and the figures higher than at 4:5 and 1:1. Garmin's vertical GARMIN
 * tag, its sport-art template and its topographic artwork are left out;
 * Topographic's lines are the plugin's own (`share-art.ts`).
 *
 * Pure: no Obsidian import.
 */

export type { Box } from "./share-art";

/** Garmin's image width, in points: every layout is in these units. */
export const FRAME_WIDTH = 402;

/** A colour, or a linear gradient between two points with its stops. */
export type Paint = string | { from: Point; to: Point; stops: ReadonlyArray<readonly [number, string]> };

/** The phone's system face (SF Pro on an Apple device), or the condensed face TRANSPARENT uses. */
export type Face = "system" | "condensed";

export type ShareOp =
	/** The whole image. */
	| { kind: "fill"; paint: Paint }
	| { kind: "rect"; box: Box; paint: Paint; alpha?: number }
	/** Diagonal stripes (/) inside a box, `step` apart down its edge: TRANSPARENT's bar. */
	| { kind: "hatch"; box: Box; color: string; step: number; width: number }
	/** A sport's figure: its 24-unit outline drawn `size` points square from (x, y). */
	| { kind: "glyph"; glyph: SportGlyph; x: number; y: number; size: number; color: string }
	/**
	 * One line of text on its baseline, from `x` or centred on it. Too wide for
	 * `maxWidth`, it shrinks to fit, or ("cut") to three quarters and then ends in "…".
	 */
	| {
			kind: "text";
			x: number;
			y: number;
			text: string;
			face: Face;
			size: number;
			weight: number;
			color: string;
			align?: "left" | "center";
			maxWidth?: number;
			fit?: "shrink" | "cut";
	  }
	/** A figure's value with its unit after it, on one baseline: "6.14 km". Shrinks to `maxWidth`. */
	| {
			kind: "figure";
			x: number;
			y: number;
			figure: ShareFigure;
			face: Face;
			size: number;
			weight: number;
			unitSize: number;
			unitWeight: number;
			color: string;
			align?: "left" | "center";
			maxWidth?: number;
	  }
	| { kind: "rule"; x: number; y: number; w: number; color: string; width: number }
	/** A ring; `halo` first clears a black disc that far past it, hiding the side rings under it. */
	| { kind: "ring"; cx: number; cy: number; r: number; width: number; paint: Paint; halo?: number }
	| { kind: "lines"; lines: Point[][]; width: number; paint: Paint; alpha?: number; clip?: Box }
	/** The route on its map, OpenStreetMap's tiles under it, as the activity's Overview draws it. */
	| { kind: "map"; box: Box; route: ShareRoute };

export interface ShareScene {
	width: number;
	height: number;
	/** See-through where nothing is drawn, as TRANSPARENT is: the preview puts a checkerboard behind it. */
	transparent: boolean;
	ops: ShareOp[];
}

export type ShareTemplateId = "rings" | "map" | "topo" | "transparent" | "transparent-route";

export interface ShareTemplate {
	id: ShareTemplateId;
	/** The word on the preview's chip, for an image that's see-through: Garmin's "TRANSPARENT". */
	chip?: string;
	/** Drawn only for an activity with a route. */
	needsRoute: boolean;
}

/** The carousel, in Garmin's order (its sport-art template, after Map, is left out). */
export const SHARE_TEMPLATES: readonly ShareTemplate[] = [
	{ id: "rings", needsRoute: false },
	{ id: "map", needsRoute: true },
	{ id: "topo", needsRoute: true },
	{ id: "transparent", chip: "TRANSPARENT", needsRoute: false },
	{ id: "transparent-route", chip: "TRANSPARENT", needsRoute: true },
];

/** The templates an activity can use: the route ones only with a route. */
export function templatesFor(view: Pick<ShareView, "route">): ShareTemplate[] {
	return SHARE_TEMPLATES.filter((t) => !t.needsRoute || view.route !== null);
}

/** The image's height in points at a ratio: 714.7 at 9:16, as Garmin's 715. */
export function frameHeight(ratio: ShareRatioId): number {
	const r = ratioOf(ratio);
	return (FRAME_WIDTH * r.height) / r.width;
}

const WHITE = "#ffffff";
/** Garmin's labels: white at 62%, which reads a little warmer over the orange band. */
const GREY = "rgba(255, 255, 255, 0.62)";
const RULE = "#3b3b3b";
const BLACK = "#000000";
/** The left and right margins, and the second column of a two-column row. */
const MARGIN = 23.5;
const COLUMN_2 = 212.4;
const COLUMN_W = 165.8;

type Header = "rings" | "topo" | "map" | "transparent";

/** The header's baselines (title, date) and the sport figure's middle, at 9:16 and at 4:5 and 1:1. */
const HEADER: Readonly<Record<Header, { tall: [number, number, number]; short: [number, number, number] }>> = {
	rings: { tall: [96.8, 116.9, 97.8], short: [53.8, 73.8, 54.3] },
	topo: { tall: [96.8, 116.9, 92], short: [53.8, 73.8, 48.4] },
	map: { tall: [91, 111, 86.1], short: [47.9, 68, 42.6] },
	transparent: { tall: [93.9, 115.9, 94.9], short: [53.3, 75.3, 54.3] },
};

/** The sport figure, the name and the date line. */
function header(view: ShareView, kind: Header, tall: boolean): ShareOp[] {
	const [title, date, icon] = HEADER[kind][tall ? "tall" : "short"];
	const condensed = kind === "transparent";
	const x = 59.8;
	return [
		{ kind: "glyph", glyph: view.glyph, x: 25.2, y: icon - 10, size: 20, color: WHITE },
		{
			kind: "text",
			x,
			y: title,
			text: view.title,
			face: condensed ? "condensed" : "system",
			size: condensed ? 20.5 : 24,
			weight: condensed ? 700 : 600,
			color: WHITE,
			maxWidth: FRAME_WIDTH - x - MARGIN,
			fit: "cut",
		},
		{
			kind: "text",
			x,
			y: date,
			text: view.when,
			face: condensed ? "condensed" : "system",
			size: 13,
			weight: condensed ? 300 : 400,
			color: condensed ? WHITE : GREY,
			maxWidth: FRAME_WIDTH - x - MARGIN,
			fit: "cut",
		},
	];
}

/**
 * The header band's light: from black at the bottom left to its colour at
 * the top right, its slope set by the band's height (fitted to Garmin's
 * band: red ≈ 78 + 127·x/width − 106·y/height).
 */
function bandPaint(height: number, stops: ReadonlyArray<readonly [number, string]>): Paint {
	const gx = 127 / FRAME_WIDTH;
	const gy = -105.6 / height;
	const len2 = gx * gx + gy * gy;
	const start = -78.4 / len2;
	const end = (204 - 78.4) / len2;
	return { from: [gx * start, gy * start], to: [gx * end, gy * end], stops };
}

const ORANGE_BAND: ReadonlyArray<readonly [number, string]> = [
	[0, "rgb(0, 0, 0)"],
	[47 / 204, "rgb(47, 13, 1)"],
	[90 / 204, "rgb(90, 33, 4)"],
	[141 / 204, "rgb(141, 61, 12)"],
	[1, "rgb(204, 105, 22)"],
];

const SLATE_BAND: ReadonlyArray<readonly [number, string]> = [
	[0, "rgb(3, 4, 6)"],
	[0.38, "rgb(16, 23, 31)"],
	[0.62, "rgb(23, 32, 41)"],
	[1, "rgb(48, 52, 55)"],
];

/** A two-figure row under a hairline, in the two columns. */
function row(left: ShareFigure, right: ShareFigure, rule: number, value: { size: number; weight: number; at: number }, labelAt: number): ShareOp[] {
	const ops: ShareOp[] = [];
	const columns = [
		[MARGIN, left],
		[COLUMN_2, right],
	] as const;
	for (const [at, f] of columns) {
		ops.push({ kind: "rule", x: at, y: rule, w: COLUMN_W, color: RULE, width: 0.5 });
		ops.push({
			kind: "figure",
			x: at,
			y: rule + value.at,
			figure: f,
			face: "system",
			size: value.size,
			weight: value.weight,
			unitSize: value.size,
			unitWeight: 400,
			color: WHITE,
			maxWidth: COLUMN_W,
		});
		ops.push({ kind: "text", x: at, y: rule + labelAt, text: f.label, face: "system", size: 17, weight: 400, color: GREY, maxWidth: COLUMN_W, fit: "shrink" });
	}
	return ops;
}

/** A big figure over its label: Map's two and Topographic's one. */
function bigFigure(figure: ShareFigure, x: number, baseline: number, labelAt: number): ShareOp[] {
	return [
		{ kind: "figure", x, y: baseline, figure, face: "system", size: 34, weight: 400, unitSize: 17, unitWeight: 400, color: WHITE, maxWidth: 186 },
		{ kind: "text", x, y: labelAt, text: figure.label, face: "system", size: 17, weight: 400, color: GREY, maxWidth: 186, fit: "shrink" },
	];
}

/** The second rule from the top of the bottom rows: Rings' one and Topographic's lower one. */
function lowerRule(ratio: ShareRatioId, height: number): number {
	return ratio === "9:16" ? 575.1 : height - 71.8;
}

/** Rings: three rings for A, B and C over a black ground, D and E under them. */
function rings(view: ShareView, ratio: ShareRatioId, height: number): ShareOp[] {
	const tall = ratio === "9:16";
	const band = tall ? 132 : 89;
	const side = tall ? 375.8 : ratio === "4:5" ? 280 : 229.6;
	const middle = side - 44.1;
	const r = 61.25;
	const [a, b, c, d, e] = view.figures;
	const ring = (cx: number, cy: number, top: string, bottom: string, halo?: number): ShareOp => ({
		kind: "ring",
		cx,
		cy,
		r,
		width: 4.5,
		paint: { from: [cx, cy - r], to: [cx, cy + r], stops: [[0, top], [1, bottom]] },
		...(halo ? { halo } : {}),
	});
	const inRing = (figure: ShareFigure, cx: number, cy: number): ShareOp[] => [
		{ kind: "figure", x: cx, y: cy, figure, face: "system", size: 23, weight: 300, unitSize: 23, unitWeight: 300, color: WHITE, align: "center", maxWidth: 88 },
		{ kind: "text", x: cx, y: cy + 19.5, text: figure.label, face: "system", size: 14, weight: 400, color: GREY, align: "center", maxWidth: 88, fit: "shrink" },
	];
	const rule = lowerRule(ratio, height);
	return [
		{ kind: "fill", paint: BLACK },
		{ kind: "rect", box: { x: 0, y: 0, w: FRAME_WIDTH, h: band }, paint: bandPaint(band, ORANGE_BAND) },
		...header(view, "rings", tall),
		ring(97.8, side, "#3f96e5", "#906ef6"),
		ring(304.2, side, "#23b274", "#09f704"),
		ring(201, middle, "#ec640e", "#ffae52", 12.5),
		...inRing(a, 97.8, side),
		...inRing(b, 201, middle),
		...inRing(c, 304.2, side),
		...row(d, e, rule, { size: 19, weight: 600, at: 26.6 }, 48.9),
	];
}

/** Map: the route on its map between two patterned bands, B and Total Time under it. */
function map(view: ShareView, ratio: ShareRatioId, height: number): ShareOp[] {
	const tall = ratio === "9:16";
	const top = tall ? 137.9 : 91;
	const bottom = tall ? 567.8 : height - 76.2;
	const pattern: Box = { x: 0, y: 0, w: FRAME_WIDTH, h: top - 12.9 };
	const footer: Box = { x: 0, y: bottom, w: FRAME_WIDTH, h: height - bottom };
	const ops: ShareOp[] = [
		{ kind: "fill", paint: BLACK },
		{ kind: "rect", box: pattern, paint: { from: [0, pattern.h], to: [FRAME_WIDTH, 0], stops: [[0, "#03050c"], [0.55, "#070b1a"], [1, "#152462"]] } },
		{
			kind: "lines",
			lines: chevronLines(pattern, 322, 11),
			width: 1.2,
			paint: { from: [120, pattern.h], to: [FRAME_WIDTH, 0], stops: [[0, "rgba(40, 70, 170, 0)"], [1, "rgba(64, 104, 220, 0.5)"]] },
			clip: pattern,
		},
		{
			kind: "lines",
			lines: stripeLines(footer, 11),
			width: 1.2,
			paint: { from: [0, 0], to: [260, 0], stops: [[0, "rgba(55, 90, 200, 0.5)"], [1, "rgba(55, 90, 200, 0)"]] },
			clip: footer,
		},
		...header(view, "map", tall),
	];
	if (view.route) ops.push({ kind: "map", box: { x: 0, y: top, w: FRAME_WIDTH, h: bottom - top }, route: view.route });
	ops.push(...bigFigure(view.figures[1], MARGIN, bottom + 37.6, bottom + 64.1));
	ops.push(...bigFigure(view.time, 224.5, bottom + 37.6, bottom + 64.1));
	return ops;
}

/** Topographic: contour lines, the route small and white, B big, then A and C, then D and E. */
function topo(view: ShareView, ratio: ShareRatioId, height: number): ShareOp[] {
	const tall = ratio === "9:16";
	const band = tall ? 132 : 89;
	const lower = lowerRule(ratio, height);
	const upper = lower - 79.2;
	const middle = tall ? 366.7 : ratio === "4:5" ? 226.9 : 161.9;
	const [a, b, c, d, e] = view.figures;
	const ops: ShareOp[] = [
		{ kind: "fill", paint: BLACK },
		{ kind: "lines", lines: contourLines(view.id, FRAME_WIDTH, height), width: 1.3, paint: "#1f3858" },
		{ kind: "rect", box: { x: 0, y: 0, w: FRAME_WIDTH, h: band }, paint: bandPaint(band, SLATE_BAND), alpha: 0.85 },
		...header(view, "topo", tall),
	];
	if (view.route) ops.push(routeOp(view.route, { x: 285.3 - 71.15, y: middle - 61, w: 142.3, h: 122 }, 1.2));
	ops.push(...bigFigure(b, MARGIN, upper - 55.8, upper - 29.3));
	// Garmin's rows are light, as its ring values are; its big figure is regular.
	ops.push(...row(a, c, upper, { size: 20, weight: 300, at: 26.9 }, 49.9));
	ops.push(...row(d, e, lower, { size: 20, weight: 300, at: 26.9 }, 49.9));
	return ops;
}

/** TRANSPARENT: A, B and C in the condensed face beside the hatched bar, on nothing; with the route, the route too. */
function transparent(view: ShareView, ratio: ShareRatioId, withRoute: boolean): ShareOp[] {
	const tall = ratio === "9:16";
	const barTop = tall ? 362.4 : ratio === "4:5" ? 268 : 167.3;
	const first = barTop + (ratio === "1:1" ? 40.5 : 34.7);
	const step = ratio === "1:1" ? 77.15 : 83.1;
	const ops: ShareOp[] = [{ kind: "hatch", box: { x: 0, y: barTop, w: 11.7, h: 233.3 }, color: WHITE, step: 13, width: 1.75 }, ...header(view, "transparent", tall)];
	if (withRoute && view.route) {
		const middle = tall ? 440.7 : ratio === "4:5" ? 340.35 : 263.15;
		ops.push(routeOp(view.route, { x: 283.9 - 94.6, y: middle - 75, w: 189.2, h: 150 }, 1.5));
	}
	view.figures.slice(0, 3).forEach((figure, i) => {
		const baseline = first + i * step;
		ops.push(
			{ kind: "figure", x: 24, y: baseline, figure, face: "condensed", size: 26.5, weight: 700, unitSize: 14, unitWeight: 300, color: WHITE, maxWidth: 160 },
			{ kind: "text", x: 24, y: baseline + 17.6, text: figure.label.toUpperCase(), face: "condensed", size: 13, weight: 300, color: WHITE, maxWidth: 160, fit: "shrink" },
		);
	});
	return ops;
}

/** The route in white, as large as fits in `box` without changing its shape. */
function routeOp(route: ShareRoute, box: Box, width: number): ShareOp {
	const at = fitRoute(route.points, box);
	return { kind: "lines", lines: [route.points.map(at)], width, paint: WHITE };
}

/** The scene for one template at one ratio. */
export function shareScene(view: ShareView, template: ShareTemplateId, ratio: ShareRatioId): ShareScene {
	const height = frameHeight(ratio);
	const frame = (ops: ShareOp[], see = false): ShareScene => ({ width: FRAME_WIDTH, height, transparent: see, ops });
	switch (template) {
		case "rings":
			return frame(rings(view, ratio, height));
		case "map":
			return frame(map(view, ratio, height));
		case "topo":
			return frame(topo(view, ratio, height));
		case "transparent":
			return frame(transparent(view, ratio, false), true);
		case "transparent-route":
			return frame(transparent(view, ratio, true), true);
	}
}

/**
 * Where each point of a route lands in `box`: projected as the map projects
 * it, as large as fits without changing its shape, and centred. A route with
 * no extent (one spot) sits in the middle.
 */
export function fitRoute(points: readonly LatLon[], box: Box): (point: LatLon) => Point {
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
	const spanX = maxX - minX;
	const spanY = maxY - minY;
	const scale = spanX > 0 || spanY > 0 ? Math.min(spanX > 0 ? box.w / spanX : Infinity, spanY > 0 ? box.h / spanY : Infinity) : 0;
	const offX = box.x + (box.w - spanX * scale) / 2;
	const offY = box.y + (box.h - spanY * scale) / 2;
	return (point) => {
		const [x, y] = mercator(point);
		return [offX + (x - minX) * scale, offY + (y - minY) * scale];
	};
}
