import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ShareView } from "../src/dashboard/activity-share";
import { mercator } from "../src/dashboard/map-view";
import { fitRoute, SHARE_TEMPLATES, shareScene, templatesFor, type ShareOp } from "../src/dashboard/share-layout";

/*
 * The share images' layouts. TRANSPARENT at 9:16 is measured off Garmin's
 * (the issue #44 shot, scaled to 1080 wide); the rest is Inferred, so these
 * pin the geometry the stand-ins draw until Garmin's saved images arrive.
 */

const VIEW: ShareView = {
	id: 1,
	title: "Ridge Hike",
	when: "Mar 4 @ 9:22 AM",
	date: "2026-03-04",
	glyph: "trekking",
	stats: [
		{ value: "2:48:48", label: "Total Time" },
		{ value: "6.14", unit: "km", label: "Distance" },
		{ value: "27:27", unit: "/km", label: "Avg Pace" },
	],
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
const round = (n: number) => Math.round(n * 10) / 10;

describe("templatesFor", () => {
	it("offers every template for an activity with a route", () => {
		assert.deepEqual(
			templatesFor(VIEW).map((t) => t.id),
			SHARE_TEMPLATES.map((t) => t.id),
		);
	});

	it("drops the route templates without one", () => {
		assert.deepEqual(
			templatesFor({ route: null }).map((t) => t.id),
			["transparent"],
		);
	});
});

describe("TRANSPARENT at 9:16", () => {
	const scene = shareScene(VIEW, "transparent", "9:16");

	it("is a see-through 1080 × 1920 image", () => {
		assert.equal(scene.width, 1080);
		assert.equal(scene.height, 1920);
		assert.equal(scene.transparent, true);
		assert.equal(ofKind(scene.ops, "fill").length, 0);
	});

	it("puts the figure, the name and the date line at Garmin's places", () => {
		assert.deepEqual(ofKind(scene.ops, "glyph"), [{ kind: "glyph", glyph: "trekking", x: 66, y: 226, size: 58, color: "#ffffff" }]);
		const [title, date] = ofKind(scene.ops, "text");
		assert.deepEqual([title.text, title.x, title.y, title.size, title.weight], ["Ridge Hike", 157, 258, 66, 700]);
		assert.deepEqual([date.text, date.y, date.size, date.weight], ["Mar 4 @ 9:22 AM", 314, 38, 400]);
		assert.equal(title.maxWidth, 1080 - 157 - 62);
	});

	it("stacks the three figures beside the hatched bar, labels in capitals", () => {
		assert.deepEqual(ofKind(scene.ops, "hatch")[0].box, { x: 0, y: 977, w: 29, h: 622 });
		const figures = ofKind(scene.ops, "figure");
		assert.deepEqual(
			figures.map((f) => [f.value, f.unit, f.x, f.y, f.size, f.unitSize]),
			[
				["2:48:48", undefined, 62, 1072, 78, 42],
				["6.14", "km", 62, 1294, 78, 42],
				["27:27", "/km", 62, 1516, 78, 42],
			],
		);
		const labels = ofKind(scene.ops, "text").slice(2);
		assert.deepEqual(
			labels.map((l) => [l.text, l.y]),
			[
				["TOTAL TIME", 1119],
				["DISTANCE", 1341],
				["AVG PACE", 1563],
			],
		);
	});

	it("draws no route", () => {
		assert.equal(ofKind(scene.ops, "route").length, 0);
	});
});

describe("the other ratios", () => {
	it("scale the type and keep the block above the bottom edge", () => {
		const square = shareScene(VIEW, "transparent", "1:1");
		assert.equal(square.height, 1080);
		const bar = ofKind(square.ops, "hatch")[0].box;
		assert.equal(round(bar.y + bar.h), 970);
		assert.equal(round(bar.h), 497.6);
		assert.equal(round(ofKind(square.ops, "figure")[0].size), 62.4);
		const vertical = shareScene(VIEW, "transparent", "4:5");
		const vbar = ofKind(vertical.ops, "hatch")[0].box;
		assert.equal(round(vbar.y + vbar.h), 1170);
	});
});

describe("the route templates", () => {
	it("dark: a ground, hairlines between the figures, the route on the right", () => {
		const scene = shareScene(VIEW, "dark", "9:16");
		assert.equal(scene.transparent, false);
		assert.deepEqual(scene.ops[0], { kind: "fill", color: "#111417" });
		assert.equal(ofKind(scene.ops, "hatch").length, 0);
		assert.equal(ofKind(scene.ops, "rule").length, 2);
		const [route] = ofKind(scene.ops, "route");
		for (const [x, y] of route.paths[0].points) {
			assert.ok(x >= 1080 * 0.3 - 0.01 && x <= 1080 - 62 + 0.01, `x ${x}`);
			assert.ok(y >= 384 - 0.01 && y <= 1599 + 0.01, `y ${y}`);
		}
	});

	it("route: see-through, the route between the header and the figures", () => {
		const scene = shareScene(VIEW, "route", "9:16");
		assert.equal(scene.transparent, true);
		const [route] = ofKind(scene.ops, "route");
		assert.equal(route.paths[0].color, "#ffffff");
		for (const [, y] of route.paths[0].points) assert.ok(y >= 384 - 0.01 && y <= 977 - 50 + 0.01, `y ${y}`);
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
		assert.equal(round(x0), 0);
		assert.equal(round(x1), 400);
		assert.equal(round(Math.abs(y1 - y0)), 200);
		// North is up, and the route sits in the middle of the box's height.
		assert.ok(y1 < y0);
		assert.equal(round((y0 + y1) / 2), 200);
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
		assert.equal(mercator([0, 90])[0], 0.75);
	});
});
