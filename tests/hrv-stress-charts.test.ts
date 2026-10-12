import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HRV_STRESS_BOX, barPath, hrvStressPlot, type HrvStressPlot } from "../src/dashboard/hrv-stress-charts";
import { hrvStressView, type HrvStressView } from "../src/dashboard/hrv-stress-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { HRV_STRESS_INDEX, rowsOfHrvStress, type HrvStressRow } from "../src/sync/hrv-stress-index";

/*
 * The chart against the Obsidian twin (Figma page 430:6132): the phones
 * 805:9 (7d), 805:67 (4w) and the Inferred 805:164 (7d · results), and the 7d
 * pane 806:134691, from each node's box. A phone's chart box sits at page
 * (0, 174.86), 9.86 under the header; a pane's at (32, 149) in its 748 pt
 * column. The twin's dots were measured off the phone, so a dot is checked
 * to 0.3 pt.
 */
const TODAY = "2026-10-11";
const view = (range: "7d" | "4w", rows: readonly HrvStressRow[] = []): HrvStressView => hrvStressView({ range, offset: 0 }, rows, { today: TODAY, complete: true });
const plot = (range: "7d" | "4w", width: number, rows: readonly HrvStressRow[] = []): HrvStressPlot => hrvStressPlot(view(range, rows), width);

const near = (actual: number, expected: number, tolerance = 0.01, what = "") =>
	assert.ok(Math.abs(actual - expected) <= tolerance + 1e-9, `${what} ${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01, what = "") => {
	assert.equal(actual.length, expected.length, `${what}: ${actual.length} values, not ${expected.length}`);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance, `${what} ${i}`));
};

const PHONE_BOX = 174.86;
const PANE_BOX = { x: 32, y: 149 };

/** The twin's Inferred week (805:164): Oct 5 42, Oct 6 28, Oct 8 55, Oct 9 73, Oct 10 92, Oct 11 31, through the index's mapper. */
const WEEK: HrvStressRow[] = rowsOfHrvStress(
	[
		["2026-10-05", 42],
		["2026-10-06", 28],
		["2026-10-08", 55],
		["2026-10-09", 73],
		["2026-10-10", 92],
		["2026-10-11", 31],
	].map(([calendarDate, stressLevel]) => ({ calendarDate, stressLevel })),
).map((r) => HRV_STRESS_INDEX.normalize(r)!);

describe("the empty page (805:9, 805:67)", () => {
	it("is a 193.14 pt box at any width, its foot at page 368 on the phone", () => {
		for (const width of [PHONE, PANE_COLUMN]) assert.equal(plot("7d", width).height, 193.14);
		near(PHONE_BOX + HRV_STRESS_BOX.height, 368);
	});

	it('puts "No data available" in a 16 pt box at page (16, 264.42), 370 wide, and draws no y axis', () => {
		const p = plot("7d", PHONE);
		assert.deepEqual([p.empty!.left, p.empty!.right - p.empty!.left, p.empty!.height], [16, 370, 16]);
		near(PHONE_BOX + p.empty!.top, 264.42);
		assert.deepEqual([p.grid, p.ticks, p.bars], [[], [], []]);
	});

	it("7d: 7 dots centred at page y 347.33 from x 26.83 to 376.83 (58.33 apart), the ends Ø 8; 10-05 and 10-11 under the ends at 359.7", () => {
		const p = plot("7d", PHONE);
		nearAll(p.dots.map((d) => d.x), Array.from({ length: 7 }, (_, i) => 26.83 + (350 * i) / 6), 0.01, "dot");
		near(p.dots[1]!.x - p.dots[0]!.x, 58.33, 0.01, "a day");
		assert.deepEqual(p.dots.map((d) => d.r), [4, 2, 2, 2, 2, 2, 4]);
		assert.ok(p.dots.every((d) => Math.abs(PHONE_BOX + d.y - 347.33) < 0.01));
		assert.deepEqual(p.labels.map((l) => l.text), ["10-05", "10-11"]);
		nearAll(p.labels.map((l) => l.x), [26.7, 376.86], 0.15, "end label");
		assert.ok(p.labels.every((l) => Math.abs(PHONE_BOX + l.y - 359.7) < 0.01));
	});

	it("4w: 28 dots 12.96 apart, within 0.01 of the twin's (left + 2 for the Ø 4 ones); 09-14 and 10-11", () => {
		const p = plot("4w", PHONE);
		const twin = [26.83, ...[37.79, 50.76, 63.72, 76.68, 89.64, 102.61, 115.57, 128.53, 141.5, 154.46, 167.42, 180.39, 193.35, 206.31, 219.27, 232.24, 245.2, 258.16, 271.13, 284.09, 297.05, 310.02, 322.98, 335.94, 348.9, 361.87].map((l) => l + 2), 376.83];
		nearAll(p.dots.map((d) => d.x), twin, 0.01, "dot");
		assert.deepEqual([p.dots.length, p.dots.filter((d) => d.r === 4).length], [28, 2]);
		assert.deepEqual(p.labels.map((l) => l.text), ["09-14", "10-11"]);
	});
});

describe("the pane (806:134691, 7d)", () => {
	const p = plot("7d", PANE_COLUMN);

	it("spreads the 7 dots over the column with the phone's insets: page 58.83 → 754.83, 116 a day, at y 321.47", () => {
		nearAll(p.dots.map((d) => PANE_BOX.x + d.x), Array.from({ length: 7 }, (_, i) => 58.83 + 116 * i), 0.01, "dot");
		assert.ok(p.dots.every((d) => Math.abs(PANE_BOX.y + d.y - 321.47) < 0.01));
		// The twin's end label boxes, 40 wide: left 6.70 and 702.86 in the frame.
		nearAll(p.labels.map((l) => l.x - 20), [6.7, 702.86], 0.15, "end label box");
	});

	it('centres "No data available" on the column: page 48 → 764 at y 238.56', () => {
		near(PANE_BOX.x + p.empty!.left, 48);
		near(PANE_BOX.x + p.empty!.right, 764);
		near(PANE_BOX.y + p.empty!.top, 238.56);
	});
});

describe("7d · results (Inferred, 805:164)", () => {
	const p = plot("7d", PHONE, WEEK);

	it("moves the axis to the y-labelled plot, 48.83 → 369.17, and drops the empty line", () => {
		assert.equal(p.empty, null);
		near(p.dots[0]!.x, 48.83);
		near(p.dots[6]!.x, 369.17);
		nearAll(p.labels.map((l) => l.x), [48.7, 369.19], 0.15, "end label");
	});

	it("draws the 0–100 axis: gridlines at page 207.33 … 327.33, 30 apart, x 41 → 377, labelled 100 … 0 0.39 above them", () => {
		nearAll(p.grid.map((g) => PHONE_BOX + g.y), [207.33, 237.33, 267.33, 297.33, 327.33], 0.01, "gridline");
		assert.ok(p.grid.every((g) => g.x1 === 41 && g.x2 === 377));
		assert.deepEqual(p.ticks.map((t) => t.text), ["100", "75", "50", "25", "0"]);
		// The twin's labels: 14 pt boxes from page 199.94, 30 apart.
		nearAll(p.ticks.map((t) => PHONE_BOX + t.y), [206.94, 236.94, 266.94, 296.94, 326.94], 0.01, "label");
		assert.equal(p.labelRight, 33.5);
	});

	it("stands a bar a day on the 0 line, 1.2 pt a point, centred on its day within 0.3 of the twin's, in its level", () => {
		const twinLeft = [40.23, 93.9, 200.23, 253.57, 306.9, 360.57];
		const twinTop = [276.93, 293.73, 261.33, 239.73, 216.93, 290.13];
		nearAll(p.bars.map((b) => b.x), twinLeft.map((l) => l + 8.6), 0.3, "bar centre");
		nearAll(p.bars.map((b) => PHONE_BOX + b.top), twinTop, 0.01, "bar top");
		assert.ok(p.bars.every((b) => Math.abs(PHONE_BOX + b.bottom - 327.33) < 0.01));
		assert.deepEqual(p.bars.map((b) => b.level), ["moderate", "low", "moderate", "high", "very-high", "low"]);
		// Oct 7 had no test: no bar on its dot.
		assert.equal(p.bars.length, 6);
	});

	it("gives each bar a round top of half its 17.2 pt width", () => {
		const bar = p.bars[0]!;
		assert.equal(bar.path, `M40.23 ${bar.bottom} L40.23 ${Math.round((bar.top + 8.6) * 100) / 100} A8.6 8.6 0 0 1 57.43 ${Math.round((bar.top + 8.6) * 100) / 100} L57.43 ${bar.bottom} Z`);
	});
});

describe("barPath", () => {
	it("flattens the top of a bar shorter than half its width, and draws nothing for a 0", () => {
		assert.equal(barPath(100, 147.67, 152.47), "M91.4 152.47 L91.4 152.47 A8.6 4.8 0 0 1 108.6 152.47 L108.6 152.47 Z");
		assert.equal(barPath(100, 152.47, 152.47), "");
	});
});
