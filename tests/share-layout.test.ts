import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ShareFigure, ShareView } from "../src/dashboard/activity-share";
import { mercator } from "../src/dashboard/map-view";
import { fitRoute, frameHeight, SHARE_TEMPLATES, shareScene, templatesFor, type ShareOp } from "../src/dashboard/share-layout";

/*
 * The share images' layouts, in Garmin's points (402 wide). Each place is
 * measured off Garmin's saved images (ref/share/README.md): text by its ink
 * and baseline, rings, rules and boxes by their pixels.
 */

const f = (value: string, label: string, unit?: string): ShareFigure => (unit ? { value, unit, label } : { value, label });

const VIEW: ShareView = {
	id: 1,
	title: "Ridge Hike",
	when: "Mar 4 @ 9:22 AM",
	date: "2026-03-04",
	glyph: "trekking",
	figures: [f("2:48:48", "Total Time"), f("6.14", "Distance", "km"), f("27:27", "Avg Pace", "/km"), f("312", "Total Ascent", "m"), f("739", "Total Calories")],
	time: f("2:48:48", "Total Time"),
	route: {
		points: [
			[10, 20],
			[10, 20.02],
			[10.01, 20.02],
		],
		runs: [],
		start: [10, 20],
		end: [10.01, 20.02],
	},
};

const ofKind = <K extends ShareOp["kind"]>(ops: ShareOp[], kind: K) => ops.filter((op): op is Extract<ShareOp, { kind: K }> => op.kind === kind);
const r1 = (n: number) => Math.round(n * 10) / 10;
const texts = (ops: ShareOp[]) => ofKind(ops, "text").map((t) => [t.text, r1(t.x), r1(t.y), t.size]);
const figures = (ops: ShareOp[]) => ofKind(ops, "figure").map((g) => [g.figure.value, r1(g.x), r1(g.y), g.size]);

describe("templates", () => {
	it("are Garmin's, less its sport art, in its order", () => {
		assert.deepEqual(
			SHARE_TEMPLATES.map((t) => t.id),
			["rings", "map", "topo", "transparent", "transparent-route"],
		);
		assert.deepEqual(
			templatesFor(VIEW).map((t) => t.id),
			["rings", "map", "topo", "transparent", "transparent-route"],
		);
	});

	it("drop the route ones without a route", () => {
		assert.deepEqual(
			templatesFor({ route: null }).map((t) => t.id),
			["rings", "transparent"],
		);
	});

	it("are 402 points wide, as tall as their ratio", () => {
		assert.deepEqual(["9:16", "4:5", "1:1"].map((r) => r1(frameHeight(r as "9:16"))), [714.7, 502.5, 402]);
	});
});

describe("Rings", () => {
	const scene = shareScene(VIEW, "rings", "9:16");

	it("has Garmin's band, header and rings at 9:16", () => {
		assert.equal(scene.transparent, false);
		assert.deepEqual(ofKind(scene.ops, "rect")[0].box, { x: 0, y: 0, w: 402, h: 132 });
		assert.deepEqual(
			ofKind(scene.ops, "ring").map((r) => [r.cx, r1(r.cy), r.r, r.width, r.halo ?? 0]),
			[
				[97.8, 375.8, 61.25, 4.5, 0],
				[304.2, 375.8, 61.25, 4.5, 0],
				[201, 331.7, 61.25, 4.5, 12.5],
			],
		);
		assert.deepEqual(texts(scene.ops).slice(0, 2), [
			["Ridge Hike", 59.8, 96.8, 24],
			["Mar 4 @ 9:22 AM", 59.8, 116.9, 13],
		]);
	});

	it("puts A, B and C on their rings' middles, D and E under the rules", () => {
		assert.deepEqual(figures(scene.ops), [
			["2:48:48", 97.8, 375.8, 23],
			["6.14", 201, 331.7, 23],
			["27:27", 304.2, 375.8, 23],
			["312", 23.5, 601.7, 19],
			["739", 212.4, 601.7, 19],
		]);
		assert.deepEqual(texts(scene.ops).slice(2), [
			["Total Time", 97.8, 395.3, 14],
			["Distance", 201, 351.2, 14],
			["Avg Pace", 304.2, 395.3, 14],
			["Total Ascent", 23.5, 624, 17],
			["Total Calories", 212.4, 624, 17],
		]);
		assert.deepEqual(
			ofKind(scene.ops, "rule").map((r) => [r.x, r.y, r.w]),
			[
				[23.5, 575.1, 165.8],
				[212.4, 575.1, 165.8],
			],
		);
	});

	it("moves up at 4:5 and 1:1, the rules 71.8 above the bottom", () => {
		const square = shareScene(VIEW, "rings", "1:1");
		assert.deepEqual(ofKind(square.ops, "rect")[0].box.h, 89);
		assert.equal(ofKind(square.ops, "ring")[0].cy, 229.6);
		assert.equal(r1(ofKind(square.ops, "rule")[0].y), 330.2);
		assert.equal(r1(ofKind(shareScene(VIEW, "rings", "4:5").ops, "rule")[0].y), 430.7);
	});
});

describe("Map", () => {
	it("draws the map across the image, B and Total Time under it", () => {
		const scene = shareScene(VIEW, "map", "9:16");
		const [map] = ofKind(scene.ops, "map");
		assert.deepEqual([map.box.x, map.box.y, map.box.w, r1(map.box.h)], [0, 137.9, 402, 429.9]);
		assert.deepEqual(figures(scene.ops), [
			["6.14", 23.5, 605.4, 34],
			["2:48:48", 224.5, 605.4, 34],
		]);
		assert.deepEqual(texts(scene.ops).slice(2), [
			["Distance", 23.5, 631.9, 17],
			["Total Time", 224.5, 631.9, 17],
		]);
	});

	it("keeps 76.2 points of band under the map at 1:1", () => {
		const [map] = ofKind(shareScene(VIEW, "map", "1:1").ops, "map");
		assert.deepEqual([map.box.y, r1(map.box.y + map.box.h)], [91, 325.8]);
	});
});

describe("Topographic", () => {
	const scene = shareScene(VIEW, "topo", "9:16");

	it("draws its own contour lines under a see-through band", () => {
		const [contours] = ofKind(scene.ops, "lines");
		assert.ok(contours.lines.length > 10);
		const [band] = ofKind(scene.ops, "rect");
		assert.deepEqual([band.box.h, band.alpha], [132, 0.85]);
	});

	it("fits the route into Garmin's box on the right", () => {
		const route = ofKind(scene.ops, "lines")[1];
		const xs = route.lines[0].map((p) => p[0]);
		const ys = route.lines[0].map((p) => p[1]);
		assert.ok(Math.min(...xs) >= 214.1 && Math.max(...xs) <= 356.5, `${Math.min(...xs)}..${Math.max(...xs)}`);
		assert.ok(Math.min(...ys) >= 305.6 && Math.max(...ys) <= 427.8, `${Math.min(...ys)}..${Math.max(...ys)}`);
		// Wider than tall, it fills the box's width.
		assert.equal(r1(Math.max(...xs) - Math.min(...xs)), 142.3);
	});

	it("puts B big over two ruled rows", () => {
		assert.deepEqual(figures(scene.ops), [
			["6.14", 23.5, 440.1, 34],
			["2:48:48", 23.5, 522.8, 20],
			["27:27", 212.4, 522.8, 20],
			["312", 23.5, 602, 20],
			["739", 212.4, 602, 20],
		]);
		assert.deepEqual(
			ofKind(scene.ops, "rule").map((r) => r1(r.y)),
			[495.9, 495.9, 575.1, 575.1],
		);
	});

	it("draws the same hills for the same activity", () => {
		const again = ofKind(shareScene(VIEW, "topo", "9:16").ops, "lines")[0];
		assert.deepEqual(again.lines, ofKind(scene.ops, "lines")[0].lines);
	});
});

describe("TRANSPARENT", () => {
	it("stacks A, B and C beside the hatched bar, labels in capitals, on nothing", () => {
		const scene = shareScene(VIEW, "transparent", "9:16");
		assert.equal(scene.transparent, true);
		assert.equal(ofKind(scene.ops, "fill").length, 0);
		assert.deepEqual(ofKind(scene.ops, "hatch")[0].box, { x: 0, y: 362.4, w: 11.7, h: 233.3 });
		assert.deepEqual(figures(scene.ops), [
			["2:48:48", 24, 397.1, 26.5],
			["6.14", 24, 480.2, 26.5],
			["27:27", 24, 563.3, 26.5],
		]);
		assert.deepEqual(texts(scene.ops).slice(2), [
			["TOTAL TIME", 24, 414.7, 13],
			["DISTANCE", 24, 497.8, 13],
			["AVG PACE", 24, 580.9, 13],
		]);
		assert.equal(ofKind(scene.ops, "lines").length, 0);
	});

	it("closes up at 1:1", () => {
		const scene = shareScene(VIEW, "transparent", "1:1");
		assert.deepEqual(
			figures(scene.ops).map((g) => g[2]),
			[207.8, 285, 362.1],
		);
	});

	it("with the route, draws it on the right", () => {
		const [route] = ofKind(shareScene(VIEW, "transparent-route", "4:5").ops, "lines");
		const xs = route.lines[0].map((p) => p[0]);
		assert.deepEqual([r1(Math.min(...xs)), r1(Math.max(...xs))], [189.3, 378.5]);
	});
});

describe("fitRoute", () => {
	it("keeps the route's shape and centres it in the box", () => {
		// 0.02° of longitude by 0.01° of latitude near the equator: twice as wide as tall.
		const at = fitRoute(
			[
				[0, 0],
				[0.01, 0.02],
			],
			{ x: 0, y: 0, w: 400, h: 400 },
		);
		const [x0, y0] = at([0, 0]);
		const [x1, y1] = at([0.01, 0.02]);
		assert.equal(r1(x0), 0);
		assert.equal(r1(x1), 400);
		assert.equal(r1(Math.abs(y1 - y0)), 200);
		// North is up, and the route sits in the middle of the box's height.
		assert.ok(y1 < y0);
		assert.equal(r1((y0 + y1) / 2), 200);
	});

	it("puts a route that never moved in the middle", () => {
		const at = fitRoute([[5, 5]], { x: 10, y: 20, w: 100, h: 50 });
		assert.deepEqual(at([5, 5]), [60, 45]);
	});
});

describe("mercator", () => {
	it("maps the origin to the middle and the north up", () => {
		assert.deepEqual(mercator([0, 0]), [0.5, 0.5]);
		assert.ok(mercator([45, 0])[1] < 0.5);
	});
});
