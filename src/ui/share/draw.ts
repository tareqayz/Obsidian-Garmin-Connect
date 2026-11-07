import { getIcon } from "obsidian";
import type { SportGlyph } from "../../dashboard/activities";
import type { Point } from "../../dashboard/map-view";
import { FRAME_WIDTH, type Face, type Paint, type ShareOp, type ShareScene } from "../../dashboard/share-layout";
import { drawRouteMap } from "../map/static-map";
import type { TileSource } from "../map/tile-source";
import { sportIcon, sportPaths } from "../sport-icons";
import { loadShareFont, SHARE_FONT_STACK } from "./font";

/**
 * Paints a share scene on a canvas: with the exported note's map, the one
 * place the plugin draws to a canvas, because the image leaves the app as a
 * PNG. Every page draws SVG.
 */

/** The image's width in pixels: 1080, Stories' and the feed's. */
export const IMAGE_WIDTH = 1080;

/** The phone's system face first (SF Pro on an Apple device), as Garmin's images use it. */
const SYSTEM_STACK = `-apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

/** A sport's figure as canvas paths, from the same 24-unit outlines the pages draw. */
const outlines = new Map<SportGlyph, Path2D[]>();

function outlineOf(glyph: SportGlyph): Path2D[] {
	const known = outlines.get(glyph);
	if (known) return known;
	const paths: Path2D[] = [];
	const markup = sportPaths(glyph);
	if (markup) {
		for (const match of markup.matchAll(/\sd="([^"]+)"/g)) paths.push(new Path2D(match[1]));
	} else {
		// Lucide's figure ("activity"), which only Obsidian holds: the same 24-unit grid.
		getIcon(sportIcon(glyph))
			?.querySelectorAll("path")
			.forEach((path) => {
				const d = path.getAttribute("d");
				if (d) paths.push(new Path2D(d));
			});
	}
	outlines.set(glyph, paths);
	return paths;
}

function font(face: Face, weight: number, size: number): string {
	return `${weight} ${size.toFixed(2)}px ${face === "condensed" ? SHARE_FONT_STACK : SYSTEM_STACK}`;
}

function style(ctx: CanvasRenderingContext2D, paint: Paint): string | CanvasGradient {
	if (typeof paint === "string") return paint;
	const gradient = ctx.createLinearGradient(paint.from[0], paint.from[1], paint.to[0], paint.to[1]);
	for (const [at, color] of paint.stops) gradient.addColorStop(Math.max(0, Math.min(1, at)), color);
	return gradient;
}

/**
 * Sets the font for `text` and returns what to draw. "shrink" makes it as
 * small as it must be to fit; "cut" stops at three quarters of its size and
 * ends it in "…".
 */
function fitText(ctx: CanvasRenderingContext2D, op: Extract<ShareOp, { kind: "text" }>): string {
	const { text, face, weight, size, maxWidth, fit } = op;
	ctx.font = font(face, weight, size);
	if (maxWidth === undefined) return text;
	const width = ctx.measureText(text).width;
	if (width <= maxWidth) return text;
	if (fit === "shrink") {
		ctx.font = font(face, weight, (size * maxWidth) / width);
		return text;
	}
	ctx.font = font(face, weight, Math.max(size * 0.75, (size * maxWidth) / width));
	if (ctx.measureText(text).width <= maxWidth) return text;
	const chars = Array.from(text);
	while (chars.length > 1 && ctx.measureText(`${chars.join("").trimEnd()}…`).width > maxWidth) chars.pop();
	return `${chars.join("").trimEnd()}…`;
}

/** A figure's value and unit, shrunk together to `maxWidth`, from `x` or centred on it. */
function drawFigure(ctx: CanvasRenderingContext2D, op: Extract<ShareOp, { kind: "figure" }>): void {
	const { figure, face, weight, unitWeight, color } = op;
	const measure = (k: number) => {
		ctx.font = font(face, weight, op.size * k);
		const value = ctx.measureText(figure.value).width;
		if (!figure.unit) return { value, gap: 0, unit: 0 };
		const gap = op.size * k * (face === "condensed" ? 0.12 : 0.24);
		ctx.font = font(face, unitWeight, op.unitSize * k);
		return { value, gap, unit: ctx.measureText(figure.unit).width };
	};
	let k = 1;
	let m = measure(1);
	const total = m.value + m.gap + m.unit;
	if (op.maxWidth !== undefined && total > op.maxWidth) {
		k = op.maxWidth / total;
		m = measure(k);
	}
	const start = op.align === "center" ? op.x - (m.value + m.gap + m.unit) / 2 : op.x;
	ctx.fillStyle = color;
	ctx.font = font(face, weight, op.size * k);
	ctx.fillText(figure.value, start, op.y);
	if (figure.unit) {
		ctx.font = font(face, unitWeight, op.unitSize * k);
		ctx.fillText(figure.unit, start + m.value + m.gap, op.y);
	}
}

function polyline(ctx: CanvasRenderingContext2D, line: readonly Point[]): void {
	ctx.moveTo(line[0][0], line[0][1]);
	for (let i = 1; i < line.length; i += 1) ctx.lineTo(line[i][0], line[i][1]);
}

function drawOp(ctx: CanvasRenderingContext2D, op: ShareOp, scene: ShareScene): void {
	ctx.save();
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	switch (op.kind) {
		case "fill":
			ctx.fillStyle = style(ctx, op.paint);
			ctx.fillRect(0, 0, scene.width, scene.height);
			break;
		case "rect":
			if (op.alpha !== undefined) ctx.globalAlpha = op.alpha;
			ctx.fillStyle = style(ctx, op.paint);
			ctx.fillRect(op.box.x, op.box.y, op.box.w, op.box.h);
			break;
		case "hatch": {
			const { x, y, w, h } = op.box;
			ctx.beginPath();
			ctx.rect(x, y, w, h);
			ctx.clip();
			ctx.strokeStyle = op.color;
			ctx.lineWidth = op.width;
			ctx.lineCap = "butt";
			ctx.beginPath();
			// Stripes rising to the right, from below the box to past its top.
			for (let at = y - w; at < y + h + w; at += op.step) {
				ctx.moveTo(x, at + w);
				ctx.lineTo(x + w, at);
			}
			ctx.stroke();
			break;
		}
		case "glyph":
			ctx.translate(op.x, op.y);
			ctx.scale(op.size / 24, op.size / 24);
			ctx.strokeStyle = op.color;
			ctx.lineWidth = 2;
			for (const path of outlineOf(op.glyph)) ctx.stroke(path);
			break;
		case "text": {
			const text = fitText(ctx, op);
			ctx.fillStyle = op.color;
			if (op.align === "center") ctx.textAlign = "center";
			ctx.fillText(text, op.x, op.y);
			break;
		}
		case "figure":
			drawFigure(ctx, op);
			break;
		case "rule":
			ctx.fillStyle = op.color;
			ctx.fillRect(op.x, op.y - op.width / 2, op.w, op.width);
			break;
		case "ring":
			if (op.halo) {
				ctx.fillStyle = "#000000";
				ctx.beginPath();
				ctx.arc(op.cx, op.cy, op.r + op.halo / 2, 0, 2 * Math.PI);
				ctx.fill();
			}
			ctx.strokeStyle = style(ctx, op.paint);
			ctx.lineWidth = op.width;
			ctx.beginPath();
			ctx.arc(op.cx, op.cy, op.r, 0, 2 * Math.PI);
			ctx.stroke();
			break;
		case "lines":
			if (op.clip) {
				ctx.beginPath();
				ctx.rect(op.clip.x, op.clip.y, op.clip.w, op.clip.h);
				ctx.clip();
			}
			if (op.alpha !== undefined) ctx.globalAlpha = op.alpha;
			ctx.strokeStyle = style(ctx, op.paint);
			ctx.lineWidth = op.width;
			ctx.beginPath();
			for (const line of op.lines) if (line.length > 1) polyline(ctx, line);
			ctx.stroke();
			break;
		case "map":
			// Drawn by paintScene, which waits for its tiles.
			break;
	}
	ctx.restore();
}

export interface PaintOptions {
	/** The map's tiles, or null when map tiles are off. */
	tiles: TileSource | null;
}

/**
 * Draws `scene` into `canvas`, `width` pixels wide (a preview small, the
 * image at `IMAGE_WIDTH`). It waits for the share face and the map's tiles,
 * then draws in one go, so a preview never shows half an image.
 */
export async function paintScene(canvas: HTMLCanvasElement, scene: ShareScene, width: number, options: PaintOptions): Promise<void> {
	const scale = width / FRAME_WIDTH;
	const w = Math.max(1, Math.round(scene.width * scale));
	const h = Math.max(1, Math.round(scene.height * scale));
	// Off screen first: the visible canvas changes once, when everything is drawn.
	const off = createEl("canvas");
	await loadShareFont(off.ownerDocument);
	off.width = w;
	off.height = h;
	const ctx = off.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	for (const op of scene.ops) {
		if (op.kind === "map") {
			await drawRouteMap(ctx, {
				points: op.route.points,
				runs: op.route.runs,
				tiles: options.tiles,
				box: { x: op.box.x * scale, y: op.box.y * scale, w: op.box.w * scale, h: op.box.h * scale },
				// Map pixels as a high-density screen shows them at the image's full size.
				unit: (2 * scale * FRAME_WIDTH) / IMAGE_WIDTH,
				padding: 12,
				fitAspect: 0.75,
				lineScale: 2,
				pinScale: 2,
				attribution: true,
			});
		} else {
			drawOp(ctx, op, scene);
		}
	}
	canvas.width = w;
	canvas.height = h;
	canvas.getContext("2d")?.drawImage(off, 0, 0);
}

/** The full-size image as a PNG, see-through where the scene draws nothing. */
export async function renderScene(scene: ShareScene, options: PaintOptions): Promise<Blob> {
	const canvas = createEl("canvas");
	await paintScene(canvas, scene, IMAGE_WIDTH, options);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image couldn't be drawn."))), "image/png");
	});
}
