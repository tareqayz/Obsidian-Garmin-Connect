import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AXIS_DOT, FTP_FRAMES, FTP_X, LABEL_LIFT, PLOT_INSET, POINT_RADIUS, ROTATED_SHIFT, ftpPlot, type FtpPlot, type FtpRange } from "../src/dashboard/ftp-charts";
import { WKG_SUB, ftpView, type FtpContext } from "../src/dashboard/ftp-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { mapAccount } from "../src/sync/account";
import { FTP_INDEX, rowsOfRanges, type FtpRow } from "../src/sync/ftp-index";
import { LATEST_2026_10_11, wattsPayload, wkgPayload } from "./ftp-fixture";

/*
 * The Obsidian twin (Figma page 430:6120): each chart's box starts at the
 * Y Axis' top — y 344 on the phone frames, (32, 240.21) in the 12w panes —
 * and runs to the foot of the X Axis. Positions are the twin's nodes in the
 * box: a 1 pt gridline's top plus 0.5, a label's top plus half its 14 pt
 * line, a dot's corner plus its radius. The data are the golden rows of
 * ref/performance-stats/ftp (TODAY 2026-10-11).
 */

const TODAY = "2026-10-11";
const ROWS: FtpRow[] = rowsOfRanges(wattsPayload("2024-10-08", TODAY), wkgPayload("2024-10-08", TODAY)).map((r) => FTP_INDEX.normalize(r)!);
const CTX: FtpContext = { today: TODAY, complete: true, account: mapAccount({ ftp: [...LATEST_2026_10_11], settings: { userData: { gender: "MALE" } } }) };

/** The phone's box top: the Y Axis instance's y on every range frame. */
const PHONE_TOP = 344;

function plot(range: FtpRange, opts: { wkg?: boolean; tab?: string; offset?: number; width?: number } = {}): FtpPlot {
	const view = ftpView({ range, offset: opts.offset ?? 0, tab: opts.tab, ...(opts.wkg ? { sub: WKG_SUB } : {}) }, ROWS, CTX);
	return ftpPlot(view.chart, range, view.unit!, opts.width ?? PHONE);
}

const near = (actual: number, expected: number, tolerance = 0.01, what = "") =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${what} ${actual} is not ${expected}`);

/** The twin's dots, page corner + 4, in the box. */
function sameDots(p: FtpPlot, corners: ReadonlyArray<readonly [number, number]>, top = PHONE_TOP) {
	assert.equal(p.points.length, corners.length);
	p.points.forEach((pt, i) => {
		near(pt.x, corners[i]![0] + 4, 0.01, `dot ${i} x`);
		near(pt.y, corners[i]![1] + 4 - top, 0.01, `dot ${i} y`);
	});
}

describe("the FTP chart's frames", () => {
	it("keep the twin's boxes: 276 pt on 4w, 282 on 12w and 1y, gridlines from 15 or 13.67 to 223.33 or 209.67", () => {
		assert.deepEqual(FTP_FRAMES["4w"], { top: 15, baseline: 223.33, gridInset: 25.33, dotY: 254.17, labelY: 267.34, rotated: false, height: 276 });
		assert.deepEqual(FTP_FRAMES["12w"], { top: 13.67, baseline: 209.67, gridInset: 29.67, dotY: 236.17, labelY: 259, rotated: true, height: 282 });
		assert.deepEqual({ ...FTP_FRAMES["1y"], gridInset: 29.67 }, FTP_FRAMES["12w"]);
		assert.equal(FTP_FRAMES["1y"].gridInset, 32.67);
		// The X Axis sits at 590 (4w) or 572 (12w, 1y) on the phone: 246 and 228 into the box.
		assert.equal(FTP_FRAMES["4w"].dotY, 590 - PHONE_TOP + 8.17);
		assert.equal(FTP_FRAMES["12w"].dotY, 572 - PHONE_TOP + 8.17);
	});

	it("start the plot at 48 (Watts) or 45 (W/kg) and end it 33.33 short of the edge: 368.67 on the phone", () => {
		assert.deepEqual(FTP_X, { watts: { plot: 48, grid: 40, labelRight: 32 }, wkg: { plot: 45, grid: 37, labelRight: 29.67 } });
		assert.equal(PHONE - PLOT_INSET, 368.67);
		assert.deepEqual([LABEL_LIFT, ROTATED_SHIFT, POINT_RADIUS, AXIS_DOT.small, AXIS_DOT.large], [0.6, 0.49, 4, 2, 4]);
	});
});

describe("4w on the phone (twins 727:178, 727:342)", () => {
	it("Watts: gridlines at 359 … 567.33 from 40 to 376.67, labels 0.6 above their own values, right on 32", () => {
		const p = plot("4w");
		assert.equal(p.height, 276);
		assert.deepEqual(p.grid.map((g) => [g.y + PHONE_TOP, g.x1, g.x2]), [
			[359, 40, 376.67],
			[411.08, 40, 376.67],
			[463.17, 40, 376.67],
			[515.25, 40, 376.67],
			[567.33, 40, 376.67],
		]);
		// The Y Axis' label tops 7.4, 60.18, 112.95, 165.73, 215.73, plus 7.
		assert.deepEqual(p.ticks, [
			{ y: 14.4, text: "350" },
			{ y: 67.18, text: "312" },
			{ y: 119.95, text: "274" },
			{ y: 172.73, text: "236" },
			{ y: 222.73, text: "200" },
		]);
		assert.equal(p.labelRight, 32);
		sameDots(p, [[329.04, 460.55]]);
		assert.equal(p.line, "");
	});

	it("draws a dot a day on the axis, the ends large, and 'MM-DD' centred under them", () => {
		const p = plot("4w");
		assert.equal(p.dots.length, 28);
		assert.deepEqual(p.dots[0], { x: 48, y: 254.17, r: 4 });
		assert.deepEqual(p.dots[1], { x: 59.88, y: 254.17, r: 2 });
		assert.deepEqual(p.dots[27], { x: 368.67, y: 254.17, r: 4 });
		// The twin's X Axis ticks: corners 57.88, 69.75 … 354.79 for the small ones.
		near(p.dots[26]!.x, 354.79 + 2, 0.01);
		assert.deepEqual(p.labels, [
			{ x: 48, y: 267.34, text: "09-14", rotated: false },
			{ x: 368.67, y: 267.34, text: "10-11", rotated: false },
		]);
	});

	it("W/kg: gridlines from 37, labels right on 29.67 at 14.4, 83.84, 153.29, 222.73; the plot from 45", () => {
		const p = plot("4w", { wkg: true });
		assert.deepEqual(p.grid.map((g) => [g.x1, g.x2]), Array(5).fill([37, 376.67]));
		assert.deepEqual(p.ticks.map((t) => t.y), [14.4, 83.84, 153.29, 222.73]);
		assert.equal(p.labelRight, 29.67);
		sameDots(p, [[328.71, 491.85]]);
		assert.deepEqual([p.dots[0]!.x, p.labels[0]!.x], [45, 45]);
	});

	it("Cross Country Skiing Watts (Inferred, 728:885): 111 on [50, 200]", () => {
		const p = plot("4w", { tab: "xc" });
		assert.deepEqual(p.ticks.map((t) => t.text), ["200", "162", "124", "86", "50"]);
		sameDots(p, [[329.04, 478.61]]);
	});
});

describe("12w and 1y on the phone (twins 727:502, 727:800, 727:957, 728:732)", () => {
	it("12w Watts: gridlines at 357.67 … 553.67 to 372.33; labels at their values; the dot at the 10-05 block", () => {
		const p = plot("12w");
		assert.equal(p.height, 282);
		assert.deepEqual(p.grid.map((g) => [r(g.y + PHONE_TOP), g.x2]), [
			[357.67, 372.33],
			[406.67, 372.33],
			[455.67, 372.33],
			[504.67, 372.33],
			[553.67, 372.33],
		]);
		// Label tops 6.07, 55.72, 105.38, 155.03, 202.07, plus 7.
		assert.deepEqual(p.ticks.map((t) => t.y), [13.07, 62.72, 112.38, 162.03, 209.07]);
		near(p.points[0]!.x, 345.49, 0.01);
		near(p.points[0]!.y, 112.98, 0.01);
	});

	it("12w: twelve Ø 8 dots at the blocks' first days, labels on end half a point left of them, centred 259", () => {
		const p = plot("12w");
		assert.equal(p.dots.length, 12);
		assert.ok(p.dots.every((d) => d.r === 4 && d.y === 236.17));
		// The twin's tick corners: 44, 71.04, 98.09 … 341.49.
		[44, 71.04, 98.09, 125.13, 152.18, 179.22, 206.27, 233.31, 260.36, 287.4, 314.44, 341.49].forEach((corner, i) => near(p.dots[i]!.x, corner + 4, 0.01, `tick ${i}`));
		// …and the labels' centres, 47.51, 74.55 … 345.
		[47.51, 74.55, 101.6, 128.64, 155.69, 182.73, 209.78, 236.82, 263.87, 290.91, 317.95, 345].forEach((x, i) => near(p.labels[i]!.x, x, 0.01, `label ${i}`));
		assert.ok(p.labels.every((l) => l.rotated && l.y === 259));
		assert.deepEqual(p.labels.map((l) => l.text).slice(0, 3), ["7-20", "7-27", "8-03"]);
	});

	it("1y Watts: 274 · 274 · 274 joined flat to 369.33's gridlines", () => {
		const p = plot("1y");
		assert.ok(p.grid.every((g) => g.x1 === 40 && g.x2 === 369.33));
		sameDots(p, [[44, 452.98], [56.37, 452.98], [359.37, 452.98]]);
		assert.equal(p.line, "M48 112.98 L60.37 112.98 L363.37 112.98");
	});

	it("1y W/kg: the line steps down from 4.0774 to 4.0294, as the twin's vector (45, 483.28) → (363.32, 486.42)", () => {
		const p = plot("1y", { wkg: true });
		sameDots(p, [[41, 479.28], [53.48, 482.42], [359.32, 482.42]]);
		assert.equal(p.line, "M45 139.28 L57.48 142.42 L363.32 142.42");
		// Label tops 6.07, 71.4, 136.74, 202.07, plus 7.
		assert.deepEqual(p.ticks.map((t) => [t.text, t.y]), [["6", 13.07], ["5", 78.4], ["4", 143.74], ["3", 209.07]]);
		// Month dots from Oct 13: the twin's corners 41, 68.64, 95.39 … 339.7.
		[41, 68.64, 95.39, 123.03, 150.67, 175.64, 203.28, 230.03, 257.67, 284.42, 312.06, 339.7].forEach((corner, i) => near(p.dots[i]!.x, corner + 4, 0.01, `month ${i}`));
		assert.equal(p.labels[0]!.x, 44.51);
	});

	it("1y −1 (Inferred, 728:740): on [100, 300] the labels land on the gridlines", () => {
		const p = plot("1y", { offset: -1 });
		assert.deepEqual(p.ticks.map((t) => t.y), [13.07, 62.07, 111.07, 160.07, 209.07]);
		assert.deepEqual(p.grid.map((g) => r(g.y - LABEL_LIFT)), p.ticks.map((t) => t.y));
		sameDots(p, [[297.53, 465.39], [328.45, 428.15], [340.82, 425.21]]);
	});

	it("Cross Country Skiing 1y W/kg (727:1112): 1.6518 · 1.6324 · 1.6324 on [0, 3]", () => {
		const p = plot("1y", { wkg: true, tab: "xc" });
		assert.deepEqual(p.ticks.map((t) => t.text), ["3", "2", "1", "0"]);
		assert.deepEqual(p.points.map((pt) => pt.y), [101.75, 103.02, 103.02]);
	});
});

describe("in a pane's 748 pt column (twins 730:1988, 730:2104)", () => {
	it("12w Watts keeps the phone's insets: gridlines 40 → 718.33, the plot 48 → 714.67, the dot at (666.48, 112.98)", () => {
		const p = plot("12w", { width: PANE_COLUMN });
		assert.equal(PANE_COLUMN, 748);
		assert.equal(p.height, 282);
		assert.ok(p.grid.every((g) => g.x1 === 40 && g.x2 === 718.33));
		near(p.points[0]!.x, 666.48, 0.02);
		near(p.points[0]!.y, 112.98, 0.01);
		// The detached X Axis' tick corners: 44, 100.23, 156.45 … 662.48.
		[44, 100.23, 156.45, 212.68, 268.9, 325.13, 381.35, 437.58, 493.8, 550.03, 606.25, 662.48].forEach((corner, i) => near(p.dots[i]!.x, corner + 4, 0.02, `tick ${i}`));
		[47.51, 103.74, 159.96].forEach((x, i) => near(p.labels[i]!.x, x, 0.02, `label ${i}`));
	});

	it("12w W/kg: the plot from 45, the gridlines from 37", () => {
		const p = plot("12w", { wkg: true, width: PANE_COLUMN });
		assert.ok(p.grid.every((g) => g.x1 === 37 && g.x2 === 718.33));
		assert.equal(p.dots[0]!.x, 45);
		near(p.points[0]!.x, 45 + (77 / 83) * (714.67 - 45), 0.01);
	});
});

describe("without a row", () => {
	it("keeps the box and puts the no-data line halfway down the gridlines (twin 728:644: centred 455.67)", () => {
		const view = ftpView({ range: "12w", offset: -1 }, ROWS, CTX);
		assert.equal(view.chart, null);
		const p = ftpPlot(view.chart, "12w", "watts", PHONE);
		assert.deepEqual([p.height, p.grid, p.ticks, p.dots, p.labels, p.points, p.line], [282, [], [], [], [], [], ""]);
		assert.equal(p.middle + PHONE_TOP, 455.67);
		assert.equal(ftpPlot(null, "4w", "wkg", PHONE).middle, 119.17);
	});
});

const r = (n: number) => Math.round(n * 100) / 100;
