import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { plotFor, roundedBar, type ChartSpec } from "../src/dashboard/stats-charts";

const spec = (over: Partial<ChartSpec>): ChartSpec => ({
	frame: "steps-7d",
	title: "Daily Totals",
	ticks: [0, 4500, 9000, 13500, 18000],
	labels: ["0", "4.5k", "9k", "13.5k", "18k"],
	bars: [],
	lines: [],
	dots: [],
	xLabels: [],
	markers: [],
	...over,
});

describe("plotFor", () => {
	it("spans the app's plot at the phone's width and stretches with the pane", () => {
		const phone = plotFor(spec({}), 402);
		assert.deepEqual(
			phone.grid.map((g) => g.y),
			[251.75, 192, 132.25, 72.5, 12.75],
		);
		assert.deepEqual([phone.grid[0]!.x1, phone.grid[0]!.x2], [57.2, 368.8]);
		assert.equal(plotFor(spec({}), 800).grid[0]!.x2, 766.8);
	});

	it("centres bars on their slot, rounded at the top, and skips empty ones", () => {
		const plot = plotFor(spec({ bars: [{ x: 0, from: 0, to: 9000, tone: "green" }, { x: 1, from: 0, to: 0, tone: "blue" }] }), 402);
		assert.equal(plot.bars.length, 1);
		assert.equal(plot.bars[0]!.d, roundedBar(48.6, 132.25, 17.2, 119.5, 8.6, "top"));
		assert.equal(plot.bars[0]!.tone, "green");
	});

	it("runs the floors goal between the outer bars' edges", () => {
		const plot = plotFor(spec({ frame: "floors-7d", ticks: [-70, -35, 0, 35, 70], labels: [], goal: 10, strongZero: true }), 402);
		assert.equal(plot.goal?.x1, 49.3);
		assert.equal(plot.goal?.x2, 371.8);
		assert.deepEqual(
			plot.grid.map((g) => g.strong),
			[false, false, true, false, false],
		);
	});

	it("closes a line's area down to the floor and puts markers on the dot row or the goal", () => {
		const plot = plotFor(
			spec({
				frame: "intensity-day",
				ticks: [100, 150, 200, 250],
				labels: [],
				lines: [{ points: [[0, 141], [0.5, 141], [0.5, 245]], tone: "normal", area: true }],
				markers: [{ kind: "wake", x: 0.25 }, { kind: "goal", x: 0.5, value: 150 }],
			}),
			402,
		);
		assert.match(plot.areas[0]!, /Z$/);
		assert.deepEqual(plot.markers, [
			{ kind: "wake", cx: 123, cy: 156.4 },
			{ kind: "goal", cx: 204, cy: 89.7 },
		]);
	});
});

describe("roundedBar", () => {
	it("rounds the end away from zero, never more than the bar is tall", () => {
		assert.equal(roundedBar(0, 0, 4, 1.3, 2, "top"), "M0 1.3 V1.3 A1.3 1.3 0 0 1 1.3 0 H2.7 A1.3 1.3 0 0 1 4 1.3 V1.3 Z");
		assert.match(roundedBar(0, 10, 17, 40, 8.5, "bottom"), /^M0 10 V41.5 A8.5 8.5 0 0 0 8.5 50/);
		assert.equal(roundedBar(0, 0, 4, 0, 2, "top"), "M0 0 h4 v0 h-4 Z");
	});
});
