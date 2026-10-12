import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CSS_BOX, CSS_FRAMES, cssPlot, type CssPlot } from "../src/dashboard/critical-swim-speed-charts";
import { criticalSwimSpeedView, paceText, type CssChart, type CssPeriodView, type CssRange } from "../src/dashboard/critical-swim-speed-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { CRITICAL_SWIM_SPEED_INDEX, rowsOfCriticalSwimSpeed, type CriticalSwimSpeedRow } from "../src/sync/critical-swim-speed-index";

/*
 * The charts against the Obsidian twin (Figma page 430:6122): the phones
 * 800:53 (7d), 800:158 (12w), 800:291 (1y) and the Inferred 800:467 (12w ·
 * results), and the 12w pane 802:480, from each node's box. A phone's chart
 * box sits at page (0, 244), a pane's at (32, 200.71) in its 748 pt column,
 * so the twin's page values are the box's plus those. The twin's gridlines
 * and dots were measured off the phone (pixel reads), not laid out evenly,
 * so the checks allow what the spec allows them: 0.17 pt for a gridline, 0.3
 * for a dot, 0.25 for a label.
 */
const TODAY = "2026-10-11";
const view = (range: CssRange, rows: readonly CriticalSwimSpeedRow[] = [], offset = 0): CssPeriodView =>
	criticalSwimSpeedView({ range, offset }, rows, { today: TODAY, complete: true }) as CssPeriodView;
const plot = (range: CssRange, width: number, rows: readonly CriticalSwimSpeedRow[] = []): CssPlot => cssPlot(view(range, rows).chart, range, width);

const near = (actual: number, expected: number, tolerance = 0.01, what = "") =>
	assert.ok(Math.abs(actual - expected) <= tolerance + 1e-9, `${what} ${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01, what = "") => {
	assert.equal(actual.length, expected.length, `${what}: ${actual.length} values, not ${expected.length}`);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance, `${what} ${i}`));
};

/** The phone's chart box, page y; the pane's, page x and y. */
const PHONE_BOX = 244;
const PANE_BOX = { x: 32, y: 200.71 };

/** The twin's Y Axis (799:21 / 799:32 / 799:43) and X Axis (799:55 / 799:65 / 799:90), box coordinates: centres. */
const TWIN = {
	grid7d: [20.83, 65.5, 110.17, 154.5, 199.17],
	grid12w: [19.5, 61.17, 102.5, 143.83, 185.5],
	/** The labels' 14 pt boxes' tops + 7. */
	labels7d: [20.44, 64.78, 109.44, 154.11, 198.78],
	labels12w: [19.11, 60.44, 102.11, 143.44, 184.78],
	dots7d: [48.83, 102.5, 155.5, 208.83, 262.17, 315.5, 369.17],
	ends7d: [48.78, 368.94],
	dots12w: Array.from({ length: 12 }, (_, k) => 48.83 + 27 * k),
	labels12wX: Array.from({ length: 12 }, (_, k) => 47.7 + 27 * k),
	dots1y: [48.83, 76.17, 102.83, 130.17, 157.5, 182.17, 209.5, 235.83, 263.17, 289.5, 316.83, 344.17],
	labels1yX: [47.87, 75.21, 101.87, 129.21, 156.54, 181.21, 208.54, 234.87, 262.21, 288.54, 315.87, 343.21],
};

describe("the chart's box", () => {
	it("is 254 pt tall on every range at any width, the plot from x 48.83 to 32.83 short of its right edge: 369.17 on the phone, 715.17 in a pane", () => {
		for (const range of ["7d", "12w", "1y"] as const) {
			for (const width of [PHONE, PANE_COLUMN]) {
				const p = plot(range, width);
				assert.equal(p.height, 254);
				const ends = p.dots.length ? [p.dots[0]!.x, p.dots.at(-1)!.x] : [];
				if (range === "7d") assert.deepEqual(ends, [48.83, width - 32.83]);
			}
		}
		assert.deepEqual([CSS_BOX.plotLeft, CSS_BOX.plotInset, CSS_BOX.height], [48.83, 32.83, 254]);
		// The pane's last day: page 747.17.
		near(PANE_BOX.x + plot("7d", PANE_COLUMN).dots.at(-1)!.x, 747.17);
	});

	it("puts the empty line's 16 pt box 100.41 down, inset 16: page (16, 344.41) 370 wide on the phone, (48, 301.12) 716 wide in a pane", () => {
		const phone = plot("7d", PHONE).empty;
		assert.deepEqual([phone.left, phone.right - phone.left, phone.height], [16, 370, 16]);
		near(PHONE_BOX + phone.top, 344.41);
		const pane = plot("12w", PANE_COLUMN).empty;
		near(PANE_BOX.x + pane.left, 48);
		near(PANE_BOX.y + pane.top, 301.12);
		near(pane.right - pane.left, 716);
	});

	it("has the table follow 51.67 under it on every range: the title at page 549.67 on the phone, 506.38 in a pane", () => {
		near(PHONE_BOX + CSS_BOX.height + 51.67, 549.67);
		near(PANE_BOX.y + CSS_BOX.height + 51.67, 506.38);
	});
});

describe("7d", () => {
	const p = plot("7d", PHONE);

	it("draws five gridlines from x 41 to 377, centred 264.83 … 443.17 down the page, within 0.17 of the twin's", () => {
		nearAll(p.grid.map((g) => g.y), TWIN.grid7d, 0.17, "gridline");
		near(PHONE_BOX + p.grid[0]!.y, 264.83);
		near(PHONE_BOX + p.grid[4]!.y, 443.17);
		assert.ok(p.grid.every((g) => g.x1 === 41 && g.x2 === 377));
		assert.deepEqual([CSS_FRAMES["7d"].top, CSS_FRAMES["7d"].baseline, CSS_FRAMES["7d"].gridInset], [20.83, 199.17, 25]);
	});

	it('labels them "0:40" … "5:20", right-aligned on 33.5, each centred within 0.25 of the twin\'s', () => {
		assert.deepEqual(p.ticks.map((t) => t.text), ["0:40", "1:50", "3:00", "4:10", "5:20"]);
		nearAll(p.ticks.map((t) => t.y), TWIN.labels7d, 0.25, "label");
		assert.equal(p.labelRight, 33.5);
	});

	it("crosses the empty line's box with the middle gridline, as the phone does", () => {
		const middle = p.grid[2]!.y;
		assert.ok(middle > p.empty.top && middle < p.empty.top + p.empty.height, `${middle} misses ${p.empty.top} + 16`);
	});

	it("marks a dot a day at page y 471, the ends Ø 8 and the rest Ø 4, within 0.3 of the twin's; 10-05 and 10-11 under the ends at 483.37", () => {
		nearAll(p.dots.map((d) => d.x), TWIN.dots7d, 0.3, "dot");
		assert.deepEqual(p.dots.map((d) => d.r), [4, 2, 2, 2, 2, 2, 4]);
		assert.ok(p.dots.every((d) => PHONE_BOX + d.y === 471));
		assert.deepEqual(p.labels.map((l) => [l.text, l.rotated]), [["10-05", false], ["10-11", false]]);
		nearAll(p.labels.map((l) => l.x), TWIN.ends7d, 0.25, "end label");
		assert.ok(p.labels.every((l) => Math.abs(PHONE_BOX + l.y - 483.37) < 0.01));
	});

	it("has no point and no line without a result", () => {
		assert.deepEqual([p.points, p.line], [[], ""]);
	});
});

describe("12w and 1y", () => {
	it("12w: five gridlines from x 41 to 372.67, centred 263.5 … 429.5 down the page (41.5 apart), labelled within 0.25", () => {
		const p = plot("12w", PHONE);
		nearAll(p.grid.map((g) => g.y), TWIN.grid12w, 0.17, "gridline");
		near(PHONE_BOX + p.grid[0]!.y, 263.5);
		near(PHONE_BOX + p.grid[4]!.y, 429.5);
		assert.ok(p.grid.every((g) => g.x1 === 41 && g.x2 === 372.67));
		nearAll(p.ticks.map((t) => t.y), TWIN.labels12w, 0.25, "label");
	});

	it("1y: the same gridlines, to 369.67", () => {
		const p = plot("1y", PHONE);
		nearAll(p.grid.map((g) => g.y), TWIN.grid12w, 0.17, "gridline");
		assert.ok(p.grid.every((g) => g.x2 === 369.67));
	});

	it("12w: 12 dots of 8 at page y 453, 27 pt (7 days) apart; their labels on end at 475.6, 1.13 left of each dot", () => {
		const p = plot("12w", PHONE);
		nearAll(p.dots.map((d) => d.x), TWIN.dots12w, 0.2, "dot");
		assert.ok(p.dots.every((d) => d.r === 4 && PHONE_BOX + d.y === 453));
		nearAll(p.labels.map((l) => l.x), TWIN.labels12wX, 0.2, "label");
		assert.ok(p.labels.every((l) => l.rotated && Math.abs(PHONE_BOX + l.y - 475.6) < 0.01));
		assert.deepEqual(p.labels.map((l) => l.text).join(" "), "7-20 7-27 8-03 8-10 8-17 8-24 8-31 9-07 9-14 9-21 9-28 10-05");
	});

	it("1y: 12 dots on the month starts, within 0.3 of the twin's; their labels 0.96 left of each dot", () => {
		const p = plot("1y", PHONE);
		nearAll(p.dots.map((d) => d.x), TWIN.dots1y, 0.3, "dot");
		nearAll(p.labels.map((l) => l.x), TWIN.labels1yX, 0.3, "label");
		assert.deepEqual(p.labels.map((l) => l.text).join(" "), "Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep");
	});
});

describe("the pane (802:480, 12w)", () => {
	const p = plot("12w", PANE_COLUMN);

	it("keeps the phone's heights and insets: gridlines page 73 → 750.67, centred 220.21 … 386.21", () => {
		assert.ok(p.grid.every((g) => PANE_BOX.x + g.x1 === 73 && Math.abs(PANE_BOX.x + g.x2 - 750.67) < 0.01));
		nearAll(
			p.grid.map((g) => PANE_BOX.y + g.y),
			[220.21, 261.88, 303.21, 344.54, 386.21],
			0.17,
			"gridline",
		);
	});

	it("spreads the 12 block dots over the stretched day scale: 48.83 … 667.0 in the frame (56.2 a block), at page y 409.71", () => {
		const blocks = Array.from({ length: 12 }, (_, k) => 48.83 + ((715.17 - 48.83) * 7 * k) / 83);
		nearAll(p.dots.map((d) => d.x), blocks, 0.01, "dot");
		near(p.dots.at(-1)!.x, 667.0, 0.01, "last dot");
		near(p.dots[1]!.x - p.dots[0]!.x, 56.2, 0.01, "a block");
		assert.ok(p.dots.every((d) => Math.abs(PANE_BOX.y + d.y - 409.71) < 0.01));
		// The twin's label boxes: 12 wide, left 41.70 + 56.2k.
		nearAll(p.labels.map((l) => l.x - 6), Array.from({ length: 12 }, (_, k) => 41.7 + 56.2 * k), 0.1, "label box");
	});
});

describe("12w · results (Inferred, 800:467)", () => {
	/** The twin's three results, through the index's mapper: 1:41 on Aug 13, 1:40 on Sep 10, 1:38 on Oct 8. */
	const RESULTS: CriticalSwimSpeedRow[] = rowsOfCriticalSwimSpeed({
		criticalSwimSpeedDTOList: [
			{ calendarDate: "2026-08-13", speed: 100 / 101 },
			{ calendarDate: "2026-09-10", speed: 1.0 },
			{ calendarDate: "2026-10-08", speed: 1.0256 },
		],
	}).map((r) => CRITICAL_SWIM_SPEED_INDEX.normalize(r)!);
	const v = view("12w", RESULTS);

	it("dates the table's rows with their year, newest first, as the twin does", () => {
		assert.deepEqual(v.table.rows.map((r) => r.cells), [["1:38", "Oct 8, 2026"], ["1:40", "Sep 10, 2026"], ["1:41", "Aug 13, 2026"]]);
		assert.equal(v.empty, undefined);
	});

	it("places the dots at the blocks' first days (Aug 10, Sep 7, Oct 5) and on the twin's 1:30 … 1:50 axis where the twin draws them, within 0.2", () => {
		assert.deepEqual(v.chart.points.map((p) => p.day), ["2026-08-10", "2026-09-07", "2026-10-05"]);
		// The twin's axis, 5 s apart from 1:30; the view's own (Running Lactate Threshold's rule) starts at 1:35.
		const twin: CssChart = { ...v.chart, y: { ticks: [90, 95, 100, 105, 110], labels: ["1:30", "1:35", "1:40", "1:45", "1:50"] } };
		const p = cssPlot(twin, "12w", PHONE);
		nearAll(p.points.map((pt) => pt.x), [129.83, 237.83, 345.83], 0.2, "dot x");
		nearAll(p.points.map((pt) => PHONE_BOX + pt.y), [354.77, 346.5, 325.84], 0.1, "dot y");
		assert.deepEqual(p.line.split(" ").filter((s) => /^[ML]/.test(s)).length, 3);
		assert.equal(p.pointRadius, 4);
	});

	it("draws the view's own axis from Running Lactate Threshold's rule: 1:35 … 1:55 for 1:38 – 1:41 (the twin's labels start a step lower)", () => {
		assert.deepEqual(v.chart.y.labels, ["1:35", "1:40", "1:45", "1:50", "1:55"]);
		const p = cssPlot(v.chart, "12w", PHONE);
		// Every point between the top and the bottom gridline, the fastest highest.
		assert.ok(p.points.every((pt) => pt.y >= p.grid[0]!.y && pt.y <= p.grid[4]!.y));
		assert.ok(p.points[2]!.y < p.points[1]!.y && p.points[1]!.y < p.points[0]!.y);
		assert.deepEqual(v.chart.points.map((pt) => paceText(pt.pace)), ["1:41", "1:40", "1:38"]);
	});

	it("clamps a pace to the axis' ends", () => {
		const chart: CssChart = { ...v.chart, points: [{ date: "2026-10-08", day: "2026-10-05", x: 1, pace: 500 }] };
		const p = cssPlot(chart, "12w", PHONE);
		assert.equal(p.points[0]!.y, p.grid[4]!.y);
	});
});
