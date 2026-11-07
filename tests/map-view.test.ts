import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { LatLon } from "../src/dashboard/activity-map";
import { fitZoom, mercator, tileCover } from "../src/dashboard/map-view";

/*
 * A map's view without Leaflet, for the picture an exported note prints:
 * Leaflet's fitBounds zoom (padding, maxZoom, zoomSnap) and the tiles that
 * cover the box. The routes are made-up lines on the equator.
 */

/** A route `degrees` of longitude long, east from the origin along the equator. */
const east = (degrees: number): LatLon[] => [
	[0, 0],
	[0, degrees],
];

describe("mercator", () => {
	it("maps the origin to the middle of the unit square, north up", () => {
		assert.deepEqual(mercator([0, 0]), [0.5, 0.5]);
		assert.equal(mercator([0, 90])[0], 0.75);
		assert.ok(mercator([45, 0])[1] < 0.5);
	});
});

describe("fitZoom", () => {
	it("picks Leaflet's zoom: the deepest quarter step that fits inside the padding", () => {
		// 1/1024 of the world is 0.25 px at zoom 0; 232 px of room → log2(928) = 9.86 → 9.75.
		const fit = fitZoom(east(360 / 1024), 280, 300, 24, 17);
		assert.ok(fit);
		assert.equal(fit.zoom, 9.75);
		assert.deepEqual(fit.center, [0.5 + 1 / 2048, 0.5]);
	});

	it("stops at maxZoom, for a short route or one that never moved", () => {
		assert.equal(fitZoom(east(0.0001), 668, 300, 24, 17)?.zoom, 17);
		assert.equal(fitZoom([[10, 20]], 668, 300, 24, 17)?.zoom, 17);
		assert.equal(fitZoom([], 668, 300, 24, 17), null);
	});

	it("lets the tighter side decide", () => {
		// The same span north-south in a short, wide box fits less deep than east-west.
		const wide = fitZoom(east(0.05), 600, 200, 24, 17);
		const tall = fitZoom(
			[
				[0, 0],
				[0.05, 0],
			],
			600,
			200,
			24,
			17,
		);
		assert.ok(wide && tall && tall.zoom < wide.zoom);
	});
});

describe("tileCover", () => {
	it("lists the tiles under the box and where each goes", () => {
		const cover = tileCover({ zoom: 2, center: [0.5, 0.5] }, 512, 512, 19);
		assert.equal(cover.tileZoom, 2);
		assert.equal(cover.size, 256);
		assert.deepEqual(
			cover.tiles.map((t) => [t.x, t.y, t.left, t.top]),
			[
				[1, 1, 0, 0],
				[2, 1, 256, 0],
				[1, 2, 0, 256],
				[2, 2, 256, 256],
			],
		);
		assert.deepEqual(cover.at([0, 0]), [256, 256]);
	});

	it("rounds a fractional zoom to the tiles' and scales them, as Leaflet's tile layer does", () => {
		const cover = tileCover({ zoom: 2.5, center: [0.5, 0.5] }, 300, 200, 19);
		assert.equal(cover.tileZoom, 3);
		assert.equal(Math.round(cover.size * 100) / 100, 181.02);
		const cover2 = tileCover({ zoom: 2.25, center: [0.5, 0.5] }, 300, 200, 19);
		assert.equal(cover2.tileZoom, 2);
		assert.equal(Math.round(cover2.size * 100) / 100, 304.44);
	});

	it("never asks past the server's deepest zoom, and wraps round the world", () => {
		assert.equal(tileCover({ zoom: 17, center: [0.5, 0.5] }, 100, 100, 16).tileZoom, 16);
		// Centred on the antimeridian: the column west of it is the world's last.
		const cover = tileCover({ zoom: 1, center: [0, 0.5] }, 256, 256, 19);
		assert.deepEqual(
			cover.tiles.map((t) => [t.x, t.y, t.left]),
			[
				[1, 0, -128],
				[0, 0, 128],
				[1, 1, -128],
				[0, 1, 128],
			],
		);
	});
});
