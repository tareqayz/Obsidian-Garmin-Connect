import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { periodFor } from "../src/dashboard/activities";
import { barPath, chartGeometry } from "../src/dashboard/totals-chart";

const round = (n: number) => Math.round(n * 10) / 10;

describe("chartGeometry", () => {
	it("puts a week's days from the plot's left edge to its right, as the Figma frame does", () => {
		const period = periodFor("7d", 0, "2026-10-03");
		const g = chartGeometry({ range: "7d", slots: period.slots, values: [6.08, 11.09, 0, 0, 0, 0, 8.01], ticks: [0, 3, 6, 9, 12] }, 402);

		assert.deepEqual(g.gridlines.map((l) => round(l.y)), [300.7, 254.5, 208.4, 162.2, 116]);
		assert.deepEqual(g.gridlines.map((l) => l.label), ["0", "3", "6", "9", "12"]);
		assert.equal(g.bars.length, 3, "no bar for an empty day");
		// Bar 0 in the frame: 7 wide at x 60.2, 93.5 high.
		assert.match(g.bars[0]!.path, /^M60\.2,300\.7 /);
		assert.deepEqual(g.dots.map((d) => [round(d.cx), d.r]), [[63.7, 4], [110.4, 1.75], [157.1, 1.75], [203.9, 1.75], [250.6, 1.75], [297.3, 1.75], [344, 4]]);
		assert.deepEqual(g.labels.map((l) => [l.text, round(l.x)]), [["09-27", 63.7], ["10-03", 344]]);
	});

	it("stands a year's bars at the start of each month's slot, every month labelled", () => {
		const period = periodFor("1y", 0, "2026-10-03");
		const g = chartGeometry({ range: "1y", slots: period.slots, values: Array(12).fill(10), ticks: [0, 54, 108, 162, 216] }, 402);
		assert.equal(round(g.dots[11]!.cx), 328);
		assert.ok(g.dots.every((d) => d.r === 4));
		assert.equal(g.labels.length, 12);
		assert.ok(g.labels.every((l) => l.rotated));
		assert.equal(g.gridlines[0]!.x2, 352);
	});
});

describe("barPath", () => {
	it("is rounded at the data end and square at the baseline", () => {
		const d = barPath(10, 20, 24, 60);
		// Starts at the baseline, curves at the top, returns to the baseline.
		assert.ok(d.startsWith("M10,80"), d);
		assert.equal((d.match(/Q/g) ?? []).length, 2);
		assert.ok(d.endsWith("Z"));
	});

	it("never rounds more than the bar can carry", () => {
		// A 1px-tall bar must not produce a radius bigger than itself.
		assert.ok(barPath(0, 0, 2, 1).includes("Q"));
		assert.doesNotThrow(() => barPath(0, 0, 1, 0));
	});
});
