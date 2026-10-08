import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DOT, PANE_COLUMN, PHONE, linePath, plotBox, type ChartFrame } from "../src/dashboard/stat-charts";

/** A made-up frame, with the ticks a heart-rate chart might have rather than Stress's 0 to 100. */
const FRAME: ChartFrame = { left: 40, inset: 20, gridLeft: 30, gridInset: 10, top: 10, baseline: 110, labelRight: 25, dotY: 120, labelY: 130, height: 150 };
const AXIS = {
	dots: [
		{ x: 0, large: true },
		{ x: 0.5, large: false },
		{ x: 1, large: true },
	],
	labels: [
		{ x: 0, text: "09-11" },
		{ x: 1, text: "Oct", rotated: true },
	],
};

describe("plotBox", () => {
	it("puts the gridlines on the ticks, top first, between the frame's top and baseline", () => {
		const { box } = plotBox(FRAME, PHONE, [120, 80, 40], AXIS);
		assert.deepEqual(
			box.grid.map((g) => [g.label, g.y, g.x1, g.x2]),
			[
				["120", 10, 30, 392],
				["80", 60, 30, 392],
				["40", 110, 30, 392],
			],
		);
		assert.deepEqual([box.width, box.height, box.left, box.right, box.top, box.baseline, box.labelRight], [402, 150, 40, 382, 10, 110, 25]);
		assert.deepEqual(
			plotBox(FRAME, PHONE, [120, 80, 40], AXIS, ["120 bpm", "", "40"]).box.grid.map((g) => g.label),
			["120 bpm", "", "40"],
		);
	});

	it("places the axis' dots and labels on the plot, and scales a stat's marks, clamped to the ticks", () => {
		const { box, scale } = plotBox(FRAME, PHONE, [120, 80, 40], AXIS);
		assert.deepEqual(box.dots, [
			{ x: 40, y: 120, r: DOT.large },
			{ x: 211, y: 120, r: DOT.small },
			{ x: 382, y: 120, r: DOT.large },
		]);
		assert.deepEqual(box.labels, [
			{ x: 40, y: 130, text: "09-11", rotated: false },
			{ x: 382, y: 130, text: "Oct", rotated: true },
		]);
		assert.deepEqual([scale.x(0), scale.x(1), scale.span], [40, 382, 342]);
		assert.deepEqual([scale.y(100), scale.y(140), scale.y(0)], [35, 10, 110]);
	});

	it("stretches with the pane and never squeezes the plot under 60", () => {
		assert.equal(plotBox(FRAME, PANE_COLUMN, [100, 0], AXIS).box.right, 728);
		assert.equal(plotBox(FRAME, 50, [100, 0], AXIS).box.right, 100);
	});
});

describe("linePath", () => {
	it("breaks the line where a value is missing: no segment to either side", () => {
		assert.equal(
			linePath([
				[0, 1],
				[10.004, 2],
				[20, null],
				[30, 4],
				[40, null],
			]),
			"M0 1 L10 2 M30 4",
		);
		assert.equal(linePath([]), "");
	});
});
