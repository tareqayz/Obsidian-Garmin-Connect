import type { SportGlyph } from "./activities";
import type { LatLon } from "./activity-map";
import { ratioOf, type ShareRatioId, type ShareView } from "./activity-share";
import { mercator, type Point } from "./map-view";

/**
 * The share images' layouts: each template, at each aspect ratio, as a list
 * of drawing steps in the image's own pixels. `src/ui/share/draw.ts` paints
 * them on a canvas; nothing here measures text, so a figure's unit is placed
 * by the painter, after its value.
 *
 * TRANSPARENT at 9:16 is measured off Garmin's (the issue #44 shot, scaled
 * to 1080 wide). Its other ratios and the other two templates are Inferred:
 * stand-ins until Garmin's saved images give the five templates 1:1. Garmin's
 * vertical GARMIN tag and its topographic artwork are left out on purpose.
 *
 * Pure: no Obsidian import.
 */

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export type ShareOp =
	/** The whole image in one colour. */
	| { kind: "fill"; color: string }
	/** Diagonal stripes inside a box, as Garmin's bar beside the figures. */
	| { kind: "hatch"; box: Box; color: string; step: number; width: number }
	/** A sport's figure: its 24-unit outline drawn `size` pixels square from (x, y). */
	| { kind: "glyph"; glyph: SportGlyph; x: number; y: number; size: number; color: string }
	/** One line of text, on its baseline; squeezed, then cut, to `maxWidth`. */
	| { kind: "text"; x: number; y: number; text: string; size: number; weight: number; color: string; maxWidth?: number }
	/** A figure's value with its unit after it, smaller, on one baseline: "6.14 km". */
	| { kind: "figure"; x: number; y: number; value: string; unit?: string; size: number; unitSize: number; weight: number; color: string }
	/** A hairline. */
	| { kind: "rule"; x: number; y: number; w: number; color: string; width: number }
	/** The route, each stretch in its colour. */
	| { kind: "route"; paths: { color: string; points: Point[] }[]; width: number };

export interface ShareScene {
	width: number;
	height: number;
	/** See-through where nothing is drawn, as TRANSPARENT is: the preview puts a checkerboard behind it. */
	transparent: boolean;
	ops: ShareOp[];
}

export type ShareTemplateId = "dark" | "transparent" | "route";

export interface ShareTemplate {
	id: ShareTemplateId;
	/** The word on the preview's chip, for an image that's see-through: Garmin's "TRANSPARENT". */
	chip?: string;
	/** Drawn only for an activity with a route. */
	needsRoute: boolean;
}

/** The carousel, in order (Inferred: Garmin's has five, the 4th TRANSPARENT). */
export const SHARE_TEMPLATES: readonly ShareTemplate[] = [
	{ id: "dark", needsRoute: true },
	{ id: "transparent", chip: "TRANSPARENT", needsRoute: false },
	{ id: "route", chip: "TRANSPARENT", needsRoute: true },
];

/** The templates an activity can use: the route ones only with a route. */
export function templatesFor(view: Pick<ShareView, "route">): ShareTemplate[] {
	return SHARE_TEMPLATES.filter((t) => !t.needsRoute || view.route !== null);
}

const WHITE = "#ffffff";
/** The dark template's ground, until its own artwork is picked (Inferred). */
const DARK_GROUND = "#111417";
const DARK_LABEL = "#a7adb4";
const DARK_RULE = "rgba(255, 255, 255, 0.28)";
/** The share face's cap height, as a share of its size (Oswald's 0.81 em, about). */
const CAP = 0.8;

/**
 * How each ratio scales the type and where the figures' block ends: 9:16 is
 * Garmin's; the shorter two are Inferred, the type a little smaller and the
 * block closer to the bottom.
 */
const FRAME: Readonly<Record<ShareRatioId, { k: number; bottom: number }>> = {
	"9:16": { k: 1, bottom: 321 },
	"4:5": { k: 0.9, bottom: 180 },
	"1:1": { k: 0.8, bottom: 110 },
};

/** TRANSPARENT at 9:16, in pixels of the 1080 × 1920 image (measured off Garmin's preview). */
const T = {
	glyph: { x: 66, y: 226, size: 58 },
	title: { x: 157, y: 258, size: 66 },
	date: { y: 314, size: 38 },
	/** The hatched bar: 29 wide, 622 tall, stripes every 12 px. */
	bar: { w: 29, h: 622, step: 12, line: 3 },
	figures: { x: 62, first: 95, step: 222, size: 78, unit: 42, label: 42, labelGap: 47 },
	margin: 62,
} as const;

/** The scene for one template at one ratio. */
export function shareScene(view: ShareView, template: ShareTemplateId, ratio: ShareRatioId): ShareScene {
	const { width, height } = ratioOf(ratio);
	const { k, bottom } = FRAME[ratio];
	const dark = template === "dark";
	const ops: ShareOp[] = [];
	if (dark) ops.push({ kind: "fill", color: DARK_GROUND });

	// The header: the sport's figure, the name, the date line.
	ops.push({ kind: "glyph", glyph: view.glyph, x: T.glyph.x * k, y: T.glyph.y * k, size: T.glyph.size * k, color: WHITE });
	const titleX = T.title.x * k;
	ops.push({
		kind: "text",
		x: titleX,
		y: T.title.y * k,
		text: view.title,
		size: T.title.size * k,
		weight: 700,
		color: WHITE,
		maxWidth: width - titleX - T.margin,
	});
	ops.push({ kind: "text", x: titleX, y: T.date.y * k, text: view.when, size: T.date.size * k, weight: 400, color: WHITE, maxWidth: width - titleX - T.margin });

	// The figures' block, from the bottom up.
	const blockH = T.bar.h * k;
	const top = height - bottom - blockH;
	const f = T.figures;
	if (!dark) {
		ops.push({ kind: "hatch", box: { x: 0, y: top, w: T.bar.w * k, h: blockH }, color: WHITE, step: T.bar.step * k, width: T.bar.line * k });
	}
	view.stats.forEach((stat, i) => {
		const baseline = top + (f.first + i * f.step) * k;
		// The dark template's hairline sits midway between the last label and this value's cap height.
		if (dark && i > 0) ops.push({ kind: "rule", x: 0, y: baseline - ((f.step - f.labelGap + CAP * f.size) / 2) * k, w: width * 0.42, color: DARK_RULE, width: 2 });
		ops.push({ kind: "figure", x: f.x * k, y: baseline, value: stat.value, unit: stat.unit, size: f.size * k, unitSize: f.unit * k, weight: 700, color: WHITE });
		ops.push({ kind: "text", x: f.x * k, y: baseline + f.labelGap * k, text: stat.label.toUpperCase(), size: f.label * k, weight: 400, color: dark ? DARK_LABEL : WHITE });
	});

	// The route, between the header and the figures (Inferred for both route templates).
	if (template !== "transparent" && view.route) {
		const headerEnd = (T.date.y + 70) * k;
		const box: Box = dark
			? { x: width * 0.3, y: headerEnd, w: width * 0.7 - T.margin, h: top + blockH - headerEnd }
			: { x: T.margin, y: headerEnd, w: width - 2 * T.margin, h: top - 50 * k - headerEnd };
		const at = fitRoute(view.route.points, box);
		ops.push({ kind: "route", paths: [{ color: WHITE, points: view.route.points.map(at) }], width: (dark ? 7 : 9) * k });
	}

	return { width, height, transparent: !dark, ops };
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
