import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { chevronLines, contourLines, seeded, stripeLines } from "../src/dashboard/share-art";

/*
 * The share images' own backgrounds: Topographic's contour lines from a
 * seeded field, the Map template's chevrons and stripes.
 */

describe("seeded", () => {
	it("gives the same numbers for the same seed, in [0, 1)", () => {
		const a = seeded(24869746386);
		const b = seeded(24869746386);
		const first = Array.from({ length: 50 }, () => a());
		assert.deepEqual(
			first,
			Array.from({ length: 50 }, () => b()),
		);
		for (const n of first) assert.ok(n >= 0 && n < 1);
		assert.notDeepEqual(
			first,
			Array.from({ length: 50 }, seeded(7)),
		);
	});
});

describe("contourLines", () => {
	const lines = contourLines(22056474263, 402, 715);

	it("draws lines of equal height over the box", () => {
		assert.ok(lines.length > 20, `${lines.length} lines`);
		for (const line of lines) {
			assert.ok(line.length > 2);
			for (const [x, y] of line) assert.ok(x >= -0.01 && x <= 402.01 + 6 && y >= -0.01 && y <= 715.01 + 6, `${x},${y}`);
		}
	});

	it("draws the same hills for the same seed, other hills for another", () => {
		assert.deepEqual(contourLines(22056474263, 402, 715), lines);
		assert.notDeepEqual(contourLines(1, 402, 715), lines);
	});

	it("joins the pieces into long lines, not a dust of segments", () => {
		const points = lines.reduce((n, line) => n + line.length, 0);
		assert.ok(points / lines.length > 8, `${points / lines.length} points a line`);
	});
});

describe("chevronLines", () => {
	it("nests chevrons pointing up, their arms at 45°", () => {
		const lines = chevronLines({ x: 0, y: 0, w: 402, h: 125 }, 322, 11);
		assert.ok(lines.length > 20);
		for (const [[ax, ay], [tx, ty], [bx, by]] of lines.slice(0, 3)) {
			assert.equal(tx, 322);
			assert.equal(tx - ax, ay - ty);
			assert.equal(bx - tx, by - ty);
		}
		assert.equal(lines[1][1][1] - lines[0][1][1], 11);
	});
});

describe("stripeLines", () => {
	it("falls to the right, a spacing apart", () => {
		const lines = stripeLines({ x: 0, y: 500, w: 402, h: 100 }, 11);
		for (const [[x0, y0], [x1, y1]] of lines) assert.equal(y1 - y0, x1 - x0);
		assert.equal(lines[1][0][1] - lines[0][0][1], 11);
		assert.ok(lines[lines.length - 1][0][1] < 600);
	});
});
