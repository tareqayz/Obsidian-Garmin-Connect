import { getIcon } from "obsidian";
import type { SportGlyph } from "../../dashboard/activities";
import type { Point } from "../../dashboard/map-view";
import type { ShareOp, ShareScene } from "../../dashboard/share-layout";
import { sportIcon, sportPaths } from "../sport-icons";
import { loadShareFont, SHARE_FONT_STACK } from "./font";

/**
 * Paints a share scene on a canvas: the one place the plugin draws to a
 * canvas, because the image leaves the app as a PNG. Every page draws SVG.
 */

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

function font(weight: number, size: number): string {
	return `${weight} ${size.toFixed(2)}px ${SHARE_FONT_STACK}`;
}

/**
 * Sets the font for `text` and returns what to draw: the text as it is,
 * squeezed down to three quarters of its size if it's too wide, then cut
 * short with an ellipsis.
 */
function fitText(ctx: CanvasRenderingContext2D, text: string, size: number, weight: number, maxWidth: number | undefined): string {
	ctx.font = font(weight, size);
	if (maxWidth === undefined) return text;
	const width = ctx.measureText(text).width;
	if (width <= maxWidth) return text;
	ctx.font = font(weight, Math.max(size * 0.75, (size * maxWidth) / width));
	if (ctx.measureText(text).width <= maxWidth) return text;
	const chars = Array.from(text);
	while (chars.length > 1 && ctx.measureText(`${chars.join("").trimEnd()}…`).width > maxWidth) chars.pop();
	return `${chars.join("").trimEnd()}…`;
}

function line(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
	ctx.beginPath();
	ctx.moveTo(points[0][0], points[0][1]);
	for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
	ctx.stroke();
}

function drawOp(ctx: CanvasRenderingContext2D, op: ShareOp, scene: ShareScene): void {
	ctx.save();
	ctx.textAlign = "left";
	ctx.textBaseline = "alphabetic";
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	switch (op.kind) {
		case "fill":
			ctx.fillStyle = op.color;
			ctx.fillRect(0, 0, scene.width, scene.height);
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
		case "glyph": {
			ctx.translate(op.x, op.y);
			ctx.scale(op.size / 24, op.size / 24);
			ctx.strokeStyle = op.color;
			ctx.lineWidth = 2;
			for (const path of outlineOf(op.glyph)) ctx.stroke(path);
			break;
		}
		case "text":
			ctx.fillStyle = op.color;
			ctx.fillText(fitText(ctx, op.text, op.size, op.weight, op.maxWidth), op.x, op.y);
			break;
		case "figure": {
			ctx.fillStyle = op.color;
			ctx.font = font(op.weight, op.size);
			ctx.fillText(op.value, op.x, op.y);
			if (op.unit) {
				const after = op.x + ctx.measureText(op.value).width + op.unitSize * 0.2;
				ctx.font = font(400, op.unitSize);
				ctx.fillText(op.unit, after, op.y);
			}
			break;
		}
		case "rule":
			ctx.fillStyle = op.color;
			ctx.fillRect(op.x, op.y - op.width / 2, op.w, op.width);
			break;
		case "route":
			ctx.lineWidth = op.width;
			for (const path of op.paths) {
				if (path.points.length < 2) continue;
				ctx.strokeStyle = path.color;
				line(ctx, path.points);
			}
			break;
	}
	ctx.restore();
}

/**
 * Draws `scene` into `canvas` at `scale` (a preview is drawn small, the image
 * at 1). The share face must be loaded in the canvas's document first.
 */
export function paintScene(canvas: HTMLCanvasElement, scene: ShareScene, scale = 1): void {
	canvas.width = Math.max(1, Math.round(scene.width * scale));
	canvas.height = Math.max(1, Math.round(scene.height * scale));
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(scale, 0, 0, scale, 0, 0);
	ctx.clearRect(0, 0, scene.width, scene.height);
	for (const op of scene.ops) drawOp(ctx, op, scene);
}

/** The full-size image as a PNG, see-through where the scene draws nothing. */
export async function renderScene(scene: ShareScene): Promise<Blob> {
	const canvas = createEl("canvas");
	await loadShareFont(canvas.ownerDocument);
	paintScene(canvas, scene, 1);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The image couldn't be drawn."))), "image/png");
	});
}
