import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	AVERAGES_FRAMES,
	LEGEND_GAP,
	SIDE_COLUMN,
	TIMELINE_FRAME,
	averagesFrame,
	averagesPlot,
	legendRows,
	legendWidth,
	timelinePlot,
	type AveragesPlot,
} from "../src/dashboard/hrv-status-charts";
import { hrvStatusView, nightTimeline, type HrvPeriodView } from "../src/dashboard/hrv-status-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { HRV_DAY, HRV_STATUS_INDEX, type HrvStatusRow } from "../src/sync/hrv-status-index";
import type { HrvData } from "../src/sync/metrics";

/*
 * The Obsidian twin (Figma page 430:6108). Phone frames: 1d 508:95933, 7d
 * 508:96058 / 508:96227 (chip off / on), 4w 508:96408 / 508:96696, 4w − 1
 * 508:98612. Panes: 1d 511:2120, 7d 512:2159, 4w (chip on) 512:2295.
 * Positions are the twin's nodes: a dot's box corner plus half its size,
 * less the box's own top — the timeline's title foot (617.54 on the phone,
 * 171 in the pane), the Y Axis' top (244 on the phone, 214.49 in the pane).
 * The data is the golden night and fortnights of
 * ref/performance-stats/hrv-status (TODAY 2026-10-11).
 */

const TODAY = "2026-10-11";
const HOUR = 3_600_000;
const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}.0`;

/** The phone's night: 78 readings from 00:01:41, asleep 23:58:40 → 06:31:40 at +4 h. */
const VALUES =
	"76 95 75 70 76 80 72 74 85 102 76 71 71 70 69 73 65 65 65 79 70 70 64 71 62 66 66 63 80 80 62 61 53 80 75 92 " +
	"83 76 85 87 86 86 93 89 87 105 98 94 101 97 104 87 72 84 81 82 77 94 90 83 82 76 74 75 73 87 82 92 88 88 91 78 79 78 84 88 74 74";
const t0 = Date.parse("2026-10-10T20:01:41Z");
const NIGHT_PAYLOAD: HrvData = {
	hrvSummary: { weeklyAvg: 84, lastNightAvg: 79, lastNight5MinHigh: 105, baseline: { lowUpper: 69, balancedLow: 73, balancedUpper: 90, markerValue: 0.57351685 }, status: "BALANCED", feedbackPhrase: "HRV_BALANCED_6" },
	hrvReadings: VALUES.split(" ").map((v, i) => ({ hrvValue: Number(v), readingTimeGMT: iso(t0 + i * 300_000), readingTimeLocal: iso(t0 + i * 300_000 + 4 * HOUR) })),
	sleepStartTimestampGMT: "2026-10-10T19:58:40.0",
	sleepEndTimestampGMT: "2026-10-11T02:31:40.0",
	sleepStartTimestampLocal: "2026-10-10T23:58:40.0",
	sleepEndTimestampLocal: "2026-10-11T06:31:40.0",
};
const TIMELINE = nightTimeline(HRV_DAY.map(NIGHT_PAYLOAD, TODAY));

/** Sep 14 – Oct 11, `MM-DD weekly/night lowUpper/balLow/balHigh status`, and Aug 17 – Sep 13 for 4w − 1. */
const NIGHTS = `
08-17 75/83 71/75/92 BALANCED  08-18 80/- 70/74/93 BALANCED  08-19 81/- 70/74/93 BALANCED  08-20 82/85 70/74/92 BALANCED
08-21 83/86 70/74/92 BALANCED  08-22 84/86 70/74/92 BALANCED  08-23 85/83 70/74/92 BALANCED  08-24 82/69 71/74/92 BALANCED
08-25 82/82 70/74/92 BALANCED  08-26 81/79 71/75/92 BALANCED  08-27 81/81 71/75/92 BALANCED  08-28 80/84 71/75/92 BALANCED
08-29 78/70 71/75/92 BALANCED  08-30 77/76 71/75/92 BALANCED  08-31 78/75 71/75/92 BALANCED  09-01 76/72 71/75/92 BALANCED
09-02 75/68 71/75/92 BALANCED  09-03 74/73 71/75/92 UNBALANCED  09-04 72/71 71/75/92 UNBALANCED  09-05 73/81 71/75/92 UNBALANCED
09-06 75/86 71/75/92 BALANCED  09-07 76/87 71/75/91 BALANCED  09-08 78/81 71/74/91 BALANCED  09-09 79/79 70/74/91 BALANCED
09-10 80/77 70/74/91 BALANCED  09-11 80/72 70/74/90 BALANCED  09-13 77/67 70/74/91 BALANCED
09-14 76/81 70/74/91 BALANCED  09-15 76/85 71/74/91 BALANCED  09-16 74/62 71/75/91 UNBALANCED  09-17 73/- 71/74/90 UNBALANCED
09-18 72/68 71/74/90 UNBALANCED  09-19 72/71 71/74/90 UNBALANCED  09-20 73/73 70/74/90 UNBALANCED  09-21 71/70 70/74/90 UNBALANCED
09-22 70/78 70/74/90 LOW  09-23 73/82 70/74/90 UNBALANCED  09-24 75/84 70/74/90 BALANCED  09-25 73/58 70/73/90 BALANCED
09-26 74/78 69/73/90 BALANCED  09-27 76/85 69/73/90 BALANCED  09-28 76/74 69/73/90 BALANCED  09-29 77/81 69/73/89 BALANCED
09-30 75/72 69/73/89 BALANCED  10-01 76/85 69/73/90 BALANCED  10-02 79/80 69/72/90 BALANCED  10-03 80/85 69/72/90 BALANCED
10-04 80/84 69/73/90 BALANCED  10-05 82/84 69/73/90 BALANCED  10-06 81/80 69/73/90 BALANCED  10-07 84/88 69/73/89 BALANCED
10-08 84/89 69/73/90 BALANCED  10-09 84/79 69/73/90 BALANCED  10-10 84/86 69/73/90 BALANCED  10-11 84/79 69/73/90 BALANCED
`;
const ROWS: HrvStatusRow[] = NIGHTS.trim()
	.split(/\s{2,}|\n/)
	.filter(Boolean)
	.map((entry) => {
		const [md, figures, base, status] = entry.trim().split(/\s+/);
		const [weekly, night] = figures!.split("/").map((v) => (v === "-" ? null : Number(v)));
		const [lowUpper, balLow, balHigh] = base!.split("/").map(Number);
		return HRV_STATUS_INDEX.normalize({ date: `2026-${md}`, weekly, night, lowUpper, balLow, balHigh, status })!;
	});

const period = (range: "7d" | "4w", offset = 0, sub?: string) => hrvStatusView({ range, offset, sub }, ROWS, { today: TODAY, complete: true }) as HrvPeriodView;
const near = (a: number, b: number, tolerance = 0.01) => Math.abs(a - b) <= tolerance;

function samePoints(p: AveragesPlot, twin: ReadonlyArray<readonly [number, number]>, tolerance = 0.01) {
	assert.equal(p.points.length, twin.length);
	p.points.forEach((pt, i) => {
		const [x, y] = twin[i]!;
		assert.ok(near(pt.x, x, tolerance) && near(pt.y, y, tolerance), `${pt.date} at (${pt.x}, ${pt.y}), the twin's (${x.toFixed(2)}, ${y.toFixed(2)})`);
	});
}
/** The twin's Status Marker boxes (10 pt), as centres in the chart box. */
const marks = (xs: readonly number[], ys: readonly number[], top: number) => xs.map((x, i) => [x + 5, ys[i]! + 5 - top] as const);

describe("the Nightly Timeline, phone (508:95933) and pane (511:2120)", () => {
	const phone = timelinePlot(TIMELINE, PHONE);
	const pane = timelinePlot(TIMELINE, PANE_COLUMN);
	const PHONE_TOP = 617.54;

	it("lays five 0.5 pt gridlines 50 apart from 651.17, x 33 to 25.33 short of the edge, labelled 120…40", () => {
		assert.deepEqual(
			phone.grid.map((g) => [g.label, g.y, g.x1, g.x2]),
			[["120", 33.63, 33, 376.67], ["100", 83.63, 33, 376.67], ["80", 133.63, 33, 376.67], ["60", 183.63, 33, 376.67], ["40", 233.63, 33, 376.67]],
		);
		assert.equal((PHONE_TOP + phone.grid[0]!.y).toFixed(2), "651.17");
		assert.equal(phone.labelRight, 23.84);
		assert.deepEqual([pane.grid[0]!.x2, pane.right], [722.67, 723.1]);
		assert.equal(phone.height, TIMELINE_FRAME.height);
	});

	it("runs the sleep window from x 33 to 377.1: the first reading at 35.64, each 2.5 pt a ms", () => {
		assert.deepEqual([phone.left, phone.right], [33, 377.1]);
		assert.ok(phone.line.startsWith("M35.64 143.63 L40.02 96.13 "), phone.line.slice(0, 40));
		// The twin's vector: its first two vertices at (35.63, 761.16) and (40.00, 713.67) on the page.
		assert.ok(near(PHONE_TOP + 143.63, 761.16, 0.02) && near(PHONE_TOP + 96.13, 713.67, 0.02));
		// The last reading, 06:26:41 at 74: the vector's right end, 372.74.
		assert.ok(phone.line.endsWith("L372.74 148.63"), phone.line.slice(-30));
	});

	it("dots the whole hours where the twin does, 00:00 under the sleep disc", () => {
		const twin = [84.7018, 137.2361, 189.7705, 242.3048, 294.8392, 347.3735].map((x) => x + 2);
		assert.equal(phone.dots.length, 7);
		twin.forEach((x, i) => assert.ok(near(phone.dots[i + 1]!.x, x), `${i + 1}:00 at ${phone.dots[i + 1]!.x}, the twin's ${x}`));
		assert.ok(phone.dots.every((d) => d.y === 258.46 && d.r === 2));
		assert.equal((PHONE_TOP + 258.46).toFixed(2), "876.00");
		assert.ok(Math.abs(phone.dots[0]!.x - phone.discs[0]!.x) < 10.2);
		const paneTwin = [170.7001, 276.0589, 381.4176, 486.7764, 592.1352, 697.494].map((x) => x + 2 - 32);
		paneTwin.forEach((x, i) => assert.ok(near(pane.dots[i + 1]!.x, x), `pane ${i + 1}:00 at ${pane.dots[i + 1]!.x}, the twin's ${x}`));
	});

	it("puts the discs 4.17 in from sleep start and 4.6 in from wake, and the times under the plot's ends", () => {
		assert.deepEqual(phone.discs, [
			{ kind: "sleep", x: 37.17, y: 258.63 },
			{ kind: "wake", x: 372.5, y: 258.63 },
		]);
		assert.deepEqual(pane.discs.map((d) => d.x), [37.17, 718.5]);
		assert.deepEqual(phone.labels, [
			{ x: 33, y: 274.39, text: "11:58 PM", rotated: false },
			{ x: 377.1, y: 274.39, text: "6:31 AM", rotated: false },
		]);
		// The twin's 26.335 + 10.835 and 885.93 + 6, from the title's foot at 617.54.
		assert.equal((PHONE_TOP + 258.63).toFixed(2), "876.17");
		assert.equal((PHONE_TOP + 274.39).toFixed(2), "891.93");
	});

	it("keeps the gridlines alone while the night loads, and says so without readings", () => {
		const pending = timelinePlot(nightTimeline(undefined), PHONE);
		assert.deepEqual([pending.line, pending.dots, pending.discs, pending.labels, pending.empty], ["", [], [], [], undefined]);
		assert.equal(pending.grid.length, 5);
		assert.deepEqual(timelinePlot(nightTimeline(null), PHONE).empty, { x: 205.05, y: 133.63 });
	});
});

describe("the 7-day Averages, phone", () => {
	const TOP = 244;

	it("7d (508:96058): gridlines x 41.33–368.67 at 253.83 + 58.33k, labelled 98 87 76 64 at 25.9", () => {
		const p = averagesPlot(period("7d").chart, "7d", PHONE);
		assert.equal(p.height, 237);
		assert.equal(p.labelRight, 25.9);
		assert.deepEqual(p.grid.map((g) => [g.label, g.x1, g.x2]), [["98", 41.33, 368.67], ["87", 41.33, 368.67], ["76", 41.33, 368.67], ["64", 41.33, 368.67]]);
		p.grid.forEach((g, k) => assert.ok(near(TOP + g.y, 253.83 + 58.333 * k, 0.01), `line ${k} at ${TOP + g.y}`));
	});

	it("7d: the marks, the band and the axis where the twin draws them", () => {
		const p = averagesPlot(period("7d").chart, "7d", PHONE);
		const xs = [36.5, 91.055, 145.61, 200.165, 254.72, 309.275, 363.83];
		samePoints(p, marks(xs, [334.3856, 339.5708, 324.0153, 324.0153, 324.0153, 324.0153, 324.0153], TOP));
		assert.ok(p.points.every((pt) => pt.shape === "circle" && pt.tone === "green"));
		// The band (508:96065): 41.5 → 368.83, 297.90 down to 386.05, the top 5.19 lower on Oct 7.
		assert.equal(p.band.length, 1);
		assert.ok(p.band[0]!.startsWith("M41.5 53.9L96.06 53.9L150.61 59.09L"), p.band[0]);
		assert.ok(p.band[0]!.includes("L368.83 142.05"), p.band[0]);
		// The X Axis (507:108) at 449: 8.33 pt ends, 4.33 pt days, centred 461.005; labels 473.93.
		assert.deepEqual(p.dots.map((d) => d.r), [4.165, 2.165, 2.165, 2.165, 2.165, 2.165, 4.165]);
		assert.ok(p.dots.every((d, i) => near(d.x, xs[i]! + 5) && near(TOP + d.y, 461.005, 0.01)));
		assert.deepEqual(p.labels.map((l) => [l.text, l.x]), [["10-05", 41.5], ["10-11", 368.83]]);
		assert.ok(near(TOP + p.labels[0]!.y, 473.93));
		assert.equal(p.overnight, "");
	});

	it("7d with the chip (508:96227): the dashed line through 84 80 88 89 79 86 79, the chart unchanged", () => {
		const on = averagesPlot(period("7d", 0, "overnight").chart, "7d", PHONE);
		// The twin's vector (508:96235): its first vertex 329.02 down, its fourth 303.09.
		assert.ok(on.overnight.startsWith("M41.5 85.02 L96.06 105.76 L150.61 64.27 L205.17 59.09 "), on.overnight);
		assert.deepEqual(on.grid, averagesPlot(period("7d").chart, "7d", PHONE).grid);
	});

	it("4w (508:96408): gridlines x 50–369 at 261.5 + 57.11k, labels at 35, 28 marks", () => {
		const p = averagesPlot(period("4w").chart, "4w", PHONE);
		assert.deepEqual([p.height, p.labelRight, p.grid[0]!.x1, p.grid[0]!.x2], [237, 35, 50, 369]);
		p.grid.forEach((g, k) => assert.ok(near(TOP + g.y, 261.5 + 57.11 * k, 0.02), `line ${k} at ${TOP + g.y}`));
		const xs = Array.from({ length: 28 }, (_, d) => 44.83 + 11.8272 * d);
		const ys = [353.52, 353.52, 361.777, 365.9055, 370.034, 370.034, 365.9055, 374.1625, 378.291, 365.9055, 357.6485, 365.9055, 361.777, 353.52, 353.52, 349.3915, 357.6485, 353.52, 341.1345, 337.006, 337.006, 328.7489, 332.8774, 320.4919, 320.4919, 320.4919, 320.4919, 320.4919];
		samePoints(p, marks(xs, ys, TOP), 0.02);
		assert.deepEqual(p.points.slice(0, 10).map((pt) => pt.shape), ["circle", "circle", "square", "square", "square", "square", "square", "square", "triangle", "square"]);
		// The triangle's centroid is the value: its apex 4.89 up, its base 2.44 down, 8.33 wide.
		const low = p.points[8]!;
		assert.equal(low.d, `M${low.x} ${Math.round((low.y - 4.887) * 100) / 100}L${Math.round((low.x + 4.165) * 100) / 100} ${Math.round((low.y + 2.443) * 100) / 100}H${Math.round((low.x - 4.165) * 100) / 100}Z`);
		assert.deepEqual(p.labels.map((l) => [l.text, l.x]), [["09-14", 49.83], ["10-11", 369.16]]);
	});

	it("4w with the chip on (508:96696): the legend's second row lifts the axis to 411.67, lines at 257.17 + 47.22k", () => {
		const view = period("4w", 0, "overnight");
		const rows = legendRows(view.chart!.legend, PHONE - 32);
		assert.equal(rows.length, 2);
		const p = averagesPlot(view.chart, "4w", PHONE, rows.length);
		assert.equal(p.height, 199.67);
		p.grid.forEach((g, k) => assert.ok(near(TOP + g.y, 257.17 + 47.22 * k, 0.02), `line ${k} at ${TOP + g.y}`));
		const xs = Array.from({ length: 28 }, (_, d) => 44.83 + 11.8272 * d);
		const ys = [332.3884, 332.3884, 339.2155, 342.6291, 346.0426, 346.0426, 342.6291, 349.4562, 352.8697, 342.6291, 335.802, 342.6291, 339.2155, 332.3884, 332.3884, 328.9749, 335.802, 332.3884, 322.1478, 318.7342, 318.7342, 311.9071, 315.3207, 305.08, 305.08, 305.08, 305.08, 305.08];
		samePoints(p, marks(xs, ys, TOP), 0.02);
		assert.ok(near(TOP + p.dots[0]!.y, 411.67 + 12.005, 0.01));
		// The dashed line breaks over Sep 17.
		assert.equal(p.overnight.split("M").length - 1, 2);
	});

	it("4w − 1 (508:98612): 102 90 77 65 on the same frame, Sep 12 skipped", () => {
		const p = averagesPlot(period("4w", -1).chart, "4w", PHONE);
		assert.deepEqual(p.grid.map((g) => g.label), ["102", "90", "77", "65"]);
		const twin = [[44.83, 382.9852], [56.6572, 359.9879], [364.1644, 373.7863]] as const;
		for (const [i, [x, y]] of [0, 1, 26].map((i, k) => [i, twin[k]!] as const)) {
			assert.ok(near(p.points[i]!.x, x + 5, 0.02) && near(TOP + p.points[i]!.y, y + 5, 0.02), `${p.points[i]!.date}`);
		}
	});
});

describe("the 7-day Averages, pane (512:2159, 512:2295)", () => {
	const TOP = 214.49;

	it("stretches 7d across the 748 pt column: days 112.22 apart from 41.5, lines to 714.67", () => {
		const p = averagesPlot(period("7d").chart, "7d", PANE_COLUMN);
		const xs = [36.5, 148.7217, 260.9433, 373.165, 485.3867, 597.6083, 709.83];
		samePoints(p, marks(xs, [90.3856, 95.5708, 80.0153, 80.0153, 80.0153, 80.0153, 80.0153], 0), 0.02);
		assert.deepEqual([p.grid[0]!.x1, p.grid[0]!.x2, p.height], [41.33, 714.67, 237]);
		assert.ok(near(TOP + p.dots[0]!.y, 214.49 + 205 + 12.005, 0.01));
	});

	it("keeps 4w's full height with the chip on: the legend is in the side column", () => {
		const p = averagesPlot(period("4w", 0, "overnight").chart, "4w", PANE_COLUMN);
		assert.equal(p.height, 237);
		const xs = Array.from({ length: 28 }, (_, d) => 44.83 + 24.6422 * d);
		samePoints(p, marks(xs, [109.52, 109.52, 117.777, 121.9055, 126.034, 126.034, 121.9055, 130.1625, 134.291, 121.9055, 113.6485, 121.9055, 117.777, 109.52, 109.52, 105.3915, 113.6485, 109.52, 97.1345, 93.006, 93.006, 84.7489, 88.8774, 76.4919, 76.4919, 76.4919, 76.4919, 76.4919], 0), 0.02);
		assert.deepEqual(legendRows(period("4w", 0, "overnight").chart!.legend, SIDE_COLUMN).map((r) => r.map((i) => i.label)), [["Balanced", "Unbalanced", "Low", "Baseline"], ["Overnight Avg"]]);
	});
});

describe("the legends", () => {
	it("fit the twin's rows: four items on the phone's 370, a fifth below", () => {
		const items = (labels: string) => labels.split(", ").map((label) => ({ label }));
		assert.deepEqual(legendRows(items("Balanced, Baseline"), 370).map(legendWidth), [155.33]);
		assert.deepEqual(legendRows(items("Balanced, Baseline, Overnight Avg"), 370).map(legendWidth), [268.66]);
		assert.deepEqual(legendRows(items("Balanced, Unbalanced, Baseline"), 370).map(legendWidth), [257.66]);
		assert.deepEqual(legendRows(items("Balanced, Unbalanced, Low, Baseline"), 370).map(legendWidth), [318.99]);
		assert.deepEqual(legendRows(items("Balanced, Unbalanced, Low, Baseline, Overnight Avg"), 370).map(legendWidth), [318.99, 98]);
		assert.equal(LEGEND_GAP, 15.33);
	});

	it("lift the chart only on the phone, and only for a second row", () => {
		assert.equal(averagesFrame("4w", 1), AVERAGES_FRAMES["4w"]);
		assert.deepEqual(averagesFrame("4w", 2), { ...AVERAGES_FRAMES["4w"], top: 13.17, bottom: 154.83, axisTop: 167.67, height: 199.67 });
		// A 7d legend that wraps follows 4w's (Inferred).
		assert.deepEqual(averagesFrame("7d", 2), { ...AVERAGES_FRAMES["7d"], top: 5.5, bottom: 150.83, axisTop: 167.67, height: 199.67 });
	});
});
