import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	chartsTabView,
	expandedChartView,
	type ChartCard,
	type ChartsRoute,
	type RunWalkChart,
	type SeriesChart,
	type TrainingEffectChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import { areaPath, dotPaths, EXPANDED, expandedPlot, FRAMES, marksOf, runWalkPlot, seriesPlot, stepPath, trainingEffectScales, zoneBars } from "../src/dashboard/activity-charts";
import { PANE_COLUMN } from "../src/dashboard/stat-charts";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/**
 * Positions are the phone's (ref/activity-details/outdoor-run/phone, 402 pt
 * portrait, 874 × 402 landscape), measured on the shots; a portrait box starts
 * 30 pt above its plot. Phase 2 moves the frames to the Obsidian twin.
 */
const PHONE = 402;
/** Where a phone section's chart box starts: under the figures (68.47 + 52). */
const FIGURES_BOTTOM = 120.47;

const near = (actual: number, expected: number, tolerance = 0.01) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected} ± ${tolerance}`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance = 0.01) => {
	assert.equal(actual.length, expected.length, `${actual} vs ${expected}`);
	actual.forEach((v, i) => near(v, expected[i]!, tolerance));
};

/*
 * The captured run's extremes and summary (made-up id, no position), as in
 * activity-chart-pages.test.ts: what puts each axis where the phone has it.
 */
function run(): ActivityDetail {
	const base = buildActivityDetail(
		98765432101,
		{
			summary: {
				activityName: "Chart Run",
				activityTypeDTO: { typeKey: "running" },
				summaryDTO: {
					startTimeGMT: "2026-10-10T04:19:48.0",
					distance: 10009,
					duration: 3360.82,
					averageSpeed: 2.977999925613403,
					maxSpeed: 3.246999979019165,
					avgGradeAdjustedSpeed: 2.9739999771118164,
					averageHR: 167,
					maxHR: 182,
					averagePower: 294,
					maxPower: 442,
					averageRunCadence: 171.296875,
					strideLength: 104.15999755859376,
					verticalOscillation: 8.919999694824218,
					groundContactTime: 256.8999938964844,
					trainingEffect: 4.300000190734863,
					anaerobicTrainingEffect: 0,
					beginPotentialStamina: 100,
					endPotentialStamina: 53,
				},
			},
			hrZones: [1, 2, 3, 4, 5].map((n, i) => ({ zoneNumber: n, secsInZone: [4, 72.001, 758.992, 2493.367, 0][i], zoneLowBoundary: [102, 122, 143, 163, 184][i] })),
			powerZones: [1, 2, 3, 4, 5].map((n, i) => ({ zoneNumber: n, secsInZone: [1154.621, 1593.776, 444.944, 141.001, 12.998][i], zoneLowBoundary: [227, 280, 318, 354, 407][i] })),
		},
		null,
	)!;
	return {
		...base,
		samples: {
			time: [0, 4, 9, 360, 1566, 1567, 1569, 2400, 3361],
			distance: [0, 2, 19.5, 1015.1, 4605.9, 4607.3, 4610.7, 7100, 10009],
			clock: [0, 4, 9, 360, 1566, 1605, 1607, 2438, 3399],
			hr: [76, 78, 87, 150, 169, 155, 155, 175, 182],
			speed: [0.877, 0.616, 3.191, 2.9, 3.247, 1.288, 1.26, 3, 3],
			gap: [0.877, 0.616, 3.191, 2.95, 3.881, 1.3, 1.3, 3, 3],
			cadence: [100, 0, 176, 171, 170, 104, 219, 163, 171],
			stride: [null, null, 108.7, 102, 35.1, 114.6, 100, 105, 106],
			vr: [null, null, 8.11, 8.58, 12.72, 7.77, 8.7, 9.18, 8.6],
			vo: [5.44, null, 8.83, 4.47, 9.63, 8.07, 8.27, 9, 9.2],
			gct: [null, null, 246, 218, 270, 245, 250, 255, 258],
			elevation: [-5.8, -6.2, -6.5, -21.8, -15, -15, -15, -10, -12],
			power: [70, 0, 318, 442, 290, 280, 280, 300, 300],
			stamina: [100, 100, 100, 94, 77, 77, 77, 65, 53],
			potential: [100, 100, 100, 94, 77, 77, 77, 65, 53],
			performance: [null, null, null, 2, 1, 1, 1, 0, 0],
			impact: [1.53, 1, 1.2, 0.5, 1, 1, 1, 1, 1],
		},
		laps: [
			{ n: 1, duration: 355.056, distance: 1000, speed: 2.815999984741211 },
			{ n: 2, duration: 3003.1, distance: 9000, speed: 3.0350000858306885 },
			{ n: 3, duration: 2.664, distance: 9, speed: 3.378000020980835 },
		],
		segments: [
			{ type: "RWD_RUN", start: 0, end: 1566, duration: 1565.904, distance: 4605.95 },
			{ type: "RWD_WALK", start: 1579, end: 1579, duration: 0, distance: 0 },
			{ type: "RWD_WALK", start: 1604, end: 1607, duration: 3.776, distance: 4.79 },
			{ type: "RWD_RUN", start: 1608, end: 3399, duration: 1791.083, distance: 5398.27 },
		],
	};
}

const RUN = run();
const cards = (route: Partial<ChartsRoute> = {}) => chartsTabView(RUN, { axis: "time", ...route }, "metric").cards;
const find = <T extends ChartCard>(list: ChartCard[], id: string) => list.find((c) => c.id === id) as T;
const chart = (id: string, route: Partial<ChartsRoute> = {}) => find<SeriesChart>(cards(route), id);
const label = (plot: { yLabels: Array<{ y: number; text: string }> }, text: string) => plot.yLabels.find((l) => l.text === text)!.y;

describe("seriesPlot: the twin's phone section (406:1830, box from the figures' bottom at 120.47)", () => {
	it("runs the plot from 39.83 to 379.83 pt, 137 pt tall, the tick dots 11.83 pt under it", () => {
		const p = seriesPlot(chart("heart-rate"), PHONE);
		assert.deepEqual(p.plot, { left: 39.83, right: 379.83, top: 25.2, bottom: 162.2 });
		// The twin's tick centres: 39.83, 107.83, 175.83, 244.17, 312.17, 379.83.
		nearAll(
			p.dots.map((d) => d.x),
			[39.83, 107.83, 175.83, 244.17, 312.17, 379.83],
			0.35,
		);
		// 294.44 in the section.
		near(p.dots[0]!.y + FIGURES_BOTTOM, 294.44, 0.1);
		assert.equal(p.dots[0]!.r, 4.165);
		assert.deepEqual(
			p.xLabels.map((l) => l.text),
			["0:00", "11:12", "22:24", "33:37", "44:49", "56:01"],
		);
		near(p.xLabels[0]!.y + FIGURES_BOTTOM, 307.84, 0.35);
		near(p.xTitle.y + FIGURES_BOTTOM, 327.61, 0.35);
		assert.equal(p.xTitle.text, "Time (h:m:s)");
		assert.equal(p.labelRight, 32.83);
		// The section ends at 344.33.
		near(p.height + FIGURES_BOTTOM, 344.33);
	});

	it("puts the y labels where the twin has them: 200 at 171.64, 100 at 259.97", () => {
		const p = seriesPlot(chart("heart-rate"), PHONE);
		near(label(p, "200") + FIGURES_BOTTOM, 171.64, 0.35);
		near(label(p, "100") + FIGURES_BOTTOM, 259.97, 0.35);
	});

	it("moves Pace's plot to 44.83 pt, its labels to 37.83 (406:1801)", () => {
		const p = seriesPlot(chart("pace"), PHONE);
		assert.equal(p.plot.left, 44.83);
		assert.equal(p.labelRight, 37.83);
		nearAll(
			p.dots.map((d) => d.x),
			[44.83, 111.83, 178.83, 246.17, 313.17, 379.83],
			0.35,
		);
		near(label(p, "5:00") + FIGURES_BOTTOM, 143.37, 0.2);
		near(label(p, "6:40") + FIGURES_BOTTOM, 277.04, 0.7);
		// The average line (5:36) at 191.42.
		near(p.average!.y + FIGURES_BOTTOM, 191.42, 0.6);
		// Grade-Adjusted and Lap Average Pace keep 39.83 (411:1567, 411:1462).
		assert.equal(seriesPlot(chart("pace", { pace: "gap" }), PHONE).plot.left, 39.83);
		assert.equal(seriesPlot(chart("pace", { pace: "lap-pace" }), PHONE).plot.left, 39.83);
	});

	it("sets the forced labels 2 pt further right, at the plot's ends and quarters (406:1614)", () => {
		const p = seriesPlot(chart("ground-contact-time"), PHONE);
		assert.equal(p.labelRight, 34.83);
		assert.deepEqual(
			p.yLabels.map((l) => [l.text, l.y]),
			[
				["291", 25.2],
				["272", 59.45],
				["252", 93.7],
				["233", 127.95],
				["214", 162.2],
			],
		);
		near(p.yLabels[0]!.y + FIGURES_BOTTOM, 145.71, 0.1);
	});

	it("raises Power's plot 19.7 pt, as the twin and the phone do (406:1426): 600 W at 151.01, 0 at 263.34", () => {
		const p = seriesPlot(chart("power"), PHONE);
		assert.deepEqual(p.plot, { left: 39.83, right: 379.83, top: 5.5, bottom: 142.5 });
		near(label(p, "600") + FIGURES_BOTTOM, 151.01, 0.1);
		near(label(p, "0") + FIGURES_BOTTOM, 263.34, 0.4);
		near(p.dots[0]!.y + FIGURES_BOTTOM, 274.47, 0.4);
		near(p.height + FIGURES_BOTTOM, 344.33, 0.4);
		assert.equal(seriesPlot(chart("power", { power: "per-kg" }), PHONE).plot.top, 5.5);
	});

	it("gives Stamina an 89.33 pt plot and its key a row under the axis (406:1452)", () => {
		const p = seriesPlot(chart("stamina"), PHONE);
		assert.deepEqual(p.plot, { left: 39.83, right: 379.83, top: 25.2, bottom: 114.53 });
		near(label(p, "100") + FIGURES_BOTTOM, 145.71, 0.1);
		near(label(p, "0") + FIGURES_BOTTOM, 234.71, 0.35);
		near(p.dots[0]!.y + FIGURES_BOTTOM, 244.57, 0.05);
		near(p.keyY! + FIGURES_BOTTOM, 302.67, 0.05);
		near(p.height + FIGURES_BOTTOM, 344.33);
	});

	it("draws a pane's card inside its border: plot 46.83 to 343 in 368 pt (415:3321)", () => {
		const p = seriesPlot(chart("heart-rate"), 368, "pane");
		assert.deepEqual(p.plot, { left: 46.83, right: 343, top: 25.2, bottom: 162.2 });
		assert.equal(p.labelRight, 39.83);
		nearAll(
			p.dots.map((d) => d.x),
			[46.83, 106.07, 165.3, 224.83, 284.07, 343],
			0.35,
		);
		assert.equal(seriesPlot(chart("pace"), 368, "pane").plot.left, 51.83);
		assert.equal(seriesPlot(chart("ground-contact-time"), 368, "pane").labelRight, 41.83);
	});

	it("stretches across whatever width it gets at the twin's heights", () => {
		const p = seriesPlot(chart("heart-rate"), PANE_COLUMN);
		assert.deepEqual(p.plot, { left: 39.83, right: 725.83, top: 25.2, bottom: 162.2 });
		assert.equal(seriesPlot(chart("heart-rate"), 40).plot.right, 99.83);
	});
});

describe("seriesPlot: labels where the phone draws them", () => {
	it("draws a label up to 6 pt past the plot: VO's 12 at 5.3 above, Pace's 5:00 at 2.0, GAP's 4:10 at 1.0, Stride's 1.5 at 0.3", () => {
		const above = (id: string, text: string, route: Partial<ChartsRoute> = {}) => {
			const p = seriesPlot(chart(id, route), PHONE);
			return p.plot.top - label(p, text);
		};
		near(above("vertical-oscillation", "12"), 5.3, 0.5);
		near(above("pace", "5:00"), 2, 0.5);
		near(above("pace", "4:10", { pace: "gap" }), 1, 0.5);
		near(above("stride-length", "1.5"), 0.3, 0.5);
		// VO's "4" would sit 7 pt below: not drawn.
		assert.ok(!seriesPlot(chart("vertical-oscillation"), PHONE).yLabels.some((l) => l.text === "4"));
	});
});

describe("seriesPlot: marks", () => {
	/** A value's y on the twin's phone plot (25.2 to 162.2). */
	const yOn = (v: number, bottom: number, top: number) => 162.2 - ((v - bottom) / (top - bottom)) * 137;

	it("closes an area on the plot's bottom, a stop's pace drawn at the slow end", () => {
		const p = seriesPlot(chart("pace"), PHONE);
		const d = p.area!;
		// 0.877 and 0.616 m/s (19:00 and 27:03 /km) are past the slow end: on the plot's bottom.
		assert.ok(d.startsWith("M44.83 162.2 L45.23 162.2 L45.73 "), d.slice(0, 40));
		assert.ok(d.endsWith("L379.83 162.2 L44.83 162.2 Z"), d.slice(-40));
		assert.deepEqual(p.fill, { y1: 25.2, y2: 162.2 });
	});

	it("draws the average line at the summary's average, dashed on the dot charts", () => {
		const hr = seriesPlot(chart("heart-rate"), PHONE);
		near(hr.average!.y, yOn(167, 74.48, 228.958), 0.01);
		assert.equal(hr.average!.dashed, false);
		assert.equal(seriesPlot(chart("ground-contact-time"), PHONE).average!.dashed, true);
	});

	it("draws the dot charts' dots by band, each a zero-length stroke", () => {
		const p = seriesPlot(chart("ground-contact-time"), PHONE);
		assert.deepEqual(
			p.scatter!.map((s) => [s.colour, s.d.split("M").length - 1]),
			[
				["green", 6],
				["blue", 1],
			],
		);
		// GCT starts at its first sample (0:09): that dot is on the axis' start.
		assert.ok(p.scatter![0]!.d.startsWith("M39.83 "));
		assert.match(p.scatter![0]!.d, /^M[\d.]+ [\d.]+h0\.01M/);
		assert.equal(p.scatterR, 2.35);
	});

	it("steps Performance Condition from its zero line", () => {
		const p = seriesPlot(chart("performance-condition"), PHONE);
		// ±3 over 137 pt: 0 at 93.7, +2 at 48.03.
		assert.deepEqual(p.reference, { y: 93.7 });
		assert.match(p.area!, /L[\d.]+ 48\.03 L[\d.]+ 48\.03/);
		assert.ok(p.area!.endsWith("L379.83 93.7 Z"));
	});

	it("blocks Lap Average Pace from each lap's pace down to the plot's bottom", () => {
		const p = seriesPlot(chart("pace", { pace: "lap-pace" }), PHONE);
		assert.equal(p.blocks!.length, 3);
		const [first, , last] = p.blocks!;
		near(first!.x, 39.83);
		near(first!.width, (355.056 / 3361) * 340, 0.01);
		near(first!.y + first!.height, 162.2);
		// The fastest lap tops out at 0.98 × its pace.
		near(last!.y, 25.2 + (137 * (296.03 - 290.11)) / (362.216 - 290.11), 0.02);
	});

	it("shades the Heart Rate Zones line by its stops, top first", () => {
		const p = seriesPlot(chart("heart-rate", { heart: "zones" }), PHONE);
		assert.ok(p.line);
		assert.equal(p.area, undefined);
		assert.deepEqual(
			p.zones!.stops.map((s) => s.colour),
			["red", "orange", "orange", "green", "blue", "sky"],
		);
		assert.equal(p.zones!.stops[0]!.offset, 0);
		assert.equal(p.zones!.stops[5]!.offset, 1);
		near(p.zones!.y1, yOn(194.5, 74.48, 228.958), 0.01);
		near(p.zones!.y2, yOn(102, 74.48, 228.958), 0.01);
	});

	it("lays Stamina's Potential over its area, and Impact Load Factor's line at 1.0", () => {
		assert.ok(seriesPlot(chart("stamina"), PHONE).potential!.startsWith("M39.83 25.2"));
		near(seriesPlot(chart("impact-load"), PHONE).reference!.y, 162.2 - 137 / 3.06, 0.01);
	});
});

describe("paths", () => {
	const x = (at: number) => at * 100;
	const y = (v: number) => 100 - v;

	it("breaks an area where a value is missing, each piece closed on the base", () => {
		assert.equal(areaPath({ x: [0, 0.1, 0.2, 0.3, 0.4], y: [10, 20, null, 30, 40] }, x, y, 100), "M0 90 L10 80 L10 100 L0 100 Z M30 70 L40 60 L40 100 L30 100 Z");
		assert.equal(areaPath({ x: [0, 1], y: [null, null] }, x, y, 100), "");
	});

	it("holds each step until the next sample", () => {
		assert.equal(stepPath({ x: [0, 0.1, 0.2, 0.3], y: [null, 2, 1, 1] }, x, y, 100), "M10 100 L10 98 L20 98 L20 99 L30 99 L30 100 Z");
		// A level held over many samples is one segment; a gap ends the shape.
		assert.equal(stepPath({ x: [0, 0.1, 0.2, 0.3, 0.4, 0.5], y: [1, 1, 1, null, 3, 3] }, x, y, 100), "M0 100 L0 99 L30 99 L30 100 Z M40 100 L40 97 L50 97 L50 100 Z");
	});

	it("groups dots by colour, in the order the colours come", () => {
		assert.deepEqual(dotPaths({ x: [0, 0.5, 1], y: [1, null, 3] }, ["red", null, "blue"], "green", x, y), [
			{ colour: "red", d: "M0 99h0.01" },
			{ colour: "blue", d: "M100 97h0.01" },
		]);
		assert.deepEqual(dotPaths({ x: [0], y: [5] }, undefined, "blue", x, y), [{ colour: "blue", d: "M0 95h0.01" }]);
	});

	it("draws a chart in any plot rectangle", () => {
		const marks = marksOf(chart("heart-rate"), { left: 0, right: 100, top: 0, bottom: 100 }, 2);
		assert.ok(marks.area!.startsWith("M0 "));
		assert.deepEqual(marks.fill, { y1: 0, y2: 100 });
	});
});

describe("runWalkPlot (406:1667)", () => {
	const p = runWalkPlot(find<RunWalkChart>(cards(), "run-walk"), PHONE);

	it("runs its plot from 46.83 to 383.08 pt with three lanes 30.22 pt apart", () => {
		assert.deepEqual(p.plot, { left: 46.83, right: 383.08, top: 23.86, bottom: 114.53 });
		assert.deepEqual(
			p.lanes.map((l) => l.label),
			["Idle", "Walk", "Run"],
		);
		// The twin's row lines: 144.33, 174.67, 204.67 in the section.
		nearAll(
			p.lanes.map((l) => l.y + FIGURES_BOTTOM),
			[144.33, 174.67, 204.67],
			0.15,
		);
		assert.equal(p.labelRight, 40.5);
	});

	it("draws five tick dots, where the twin has them", () => {
		nearAll(
			p.dots.map((d) => d.x),
			[46.83, 114.17, 181.5, 248.5, 315.83],
			0.2,
		);
		assert.deepEqual(
			p.xLabels.map((l) => l.text),
			["0:00", "11:12", "22:24", "33:36", "44:49"],
		);
		near(p.dots[0]!.y + FIGURES_BOTTOM, 244.84, 0.01);
		near(p.keyY + FIGURES_BOTTOM, 302.67, 0.01);
		near(p.height + FIGURES_BOTTOM, 344.33);
	});

	it("raises each bar from the plot's bottom to its lane, the 3.8 s walk a hairline", () => {
		assert.deepEqual(
			p.bars.map((b) => [b.colour, b.y, b.height]),
			[
				["blue", 84.31, 30.22],
				["green", 54.08, 60.45],
				["blue", 84.31, 30.22],
			],
		);
		near(p.bars[0]!.x, 46.83);
		// The twin's walk at x 203.33, 0.67 wide.
		near(p.bars[1]!.x, 203.33, 0.35);
		assert.equal(p.bars[1]!.width, 0.67);
		near(p.bars[2]!.x + p.bars[2]!.width, 383.08, 0.01);
	});

	it("moves in a pane's card as the twin does (415:3749)", () => {
		const pane = runWalkPlot(find<RunWalkChart>(cards(), "run-walk"), 368, "pane");
		assert.deepEqual([pane.plot.left, pane.plot.right, pane.labelRight], [53.85, 343.06, 47.5]);
	});
});

describe("trainingEffectScales (406:1389)", () => {
	const [aerobic, anaerobic] = trainingEffectScales(find<TrainingEffectChart>(cards(), "training-effect"), PHONE);

	it("lays five segments with 6 pt gaps and the red cap from 16 to 386 pt", () => {
		// The twin's bands: 16, 88.67, 161, 233.67, 306.33, cap 378.67–386.
		nearAll(
			aerobic!.segments.map((s) => s.x),
			[16, 88.67, 161, 233.67, 306.33, 378.67],
			0.25,
		);
		nearAll(
			aerobic!.segments.map((s) => s.width),
			[66.53, 66.53, 66.53, 66.53, 66.53, 7.33],
		);
		assert.deepEqual(
			aerobic!.segments.map((s) => s.colour),
			["grey", "grey", "blue", "green", "orange", "red"],
		);
	});

	it("centres the knob at 16 + value / 5 × 370, ignoring the gaps: 4.3 at 334.2, 0.0 at 16", () => {
		assert.deepEqual(aerobic!.knob, { x: 334.2, colour: "orange" });
		assert.deepEqual(anaerobic!.knob, { x: 16, colour: "grey" });
	});
});

describe("zoneBars (406:1698, 406:1710)", () => {
	it("fills the floored share of a 16–289.33 pt track, as the twin's fills", () => {
		const hr = zoneBars(find<ZonesChart>(cards(), "time-in-hr-zones"), PHONE);
		assert.deepEqual(hr[0]!.track, { x: 16, width: 273.33 });
		nearAll(
			hr.map((b) => b.fill?.width ?? 0),
			[0, 202.33, 60, 5.33, 0],
			0.2,
		);
		assert.equal(hr[0]!.fill, null);
		const power = zoneBars(find<ZonesChart>(cards(), "time-in-power-zones"), PHONE);
		nearAll(
			power.map((b) => b.fill?.width ?? 0),
			[0, 11, 35.67, 128.33, 92.92],
			0.2,
		);
	});
});

describe("expandedPlot (pane 416:86199, phone 411:1340)", () => {
	const view = (sub: string) => expandedChartView(RUN, { axis: "time", sub }, "metric")!;
	/** The twin's pane: 1190 wide, 620 under its bar. */
	const pane = (sub: string) => expandedPlot(view(sub), 1190, 620);
	const BAR = 44;

	it("fills the room under the bar: the pane's plot 85.19–1131.08, 108.95–487.89 on the page", () => {
		const p = pane("chart:heart-rate:cadence");
		assert.equal(p.layout, "pane");
		assert.deepEqual(p.plot, { left: 85.19, right: 1131.08, top: 64.95, bottom: 443.89 });
		// The twin's ticks: 85.19 … 1131.08 (its row runs past the plot; here it is the plot's).
		nearAll(
			p.dots.map((d) => d.x),
			[85.19, 294.48, 503.76, 713.04, 922.33, 1131.08],
			0.45,
		);
		near(p.dots[0]!.y + BAR, 512.47, 0.01);
		near(p.chipsTop + BAR, 596, 0.01);
		near(p.xTitle!.y + BAR, 543.6, 0.01);
	});

	it("labels the primary on the left and the overlay on the right, in its colour", () => {
		const p = pane("chart:heart-rate:cadence");
		assert.equal(p.leftLabelRight, 70);
		nearAll(
			p.leftLabels.map((l) => l.y + BAR),
			[179.89, 302.47, 425.03],
			0.3,
		);
		assert.deepEqual(
			p.rightLabels.map((l) => l.text),
			["272", "228", "185", "141", "98"],
		);
		nearAll(
			p.rightLabels.map((l) => l.y + BAR),
			[108.95, 203.54, 298.74, 393.3, 487.89],
			0.35,
		);
		assert.equal(p.rightLabelLeft, 1120);
		assert.equal(p.secondary!.colour, "deep-orange");
		assert.ok(p.secondary!.scatter!.length > 1);
		assert.equal(p.secondary!.scatterR, 2.5);
		assert.equal(p.dim, true);
		assert.equal(p.primary.average, undefined);
	});

	it("lays the phone's chart out as the twin does when the room matches", () => {
		const p = expandedPlot(view("chart:heart-rate:cadence"), 402, 624.02);
		assert.equal(p.layout, "phone");
		assert.deepEqual(p.plot, { left: 46.76, right: 361.14, top: 62.14, bottom: 459.14 });
		near(p.leftLabels[0]!.y + BAR, 180.45, 0.15);
		near(p.rightLabels[0]!.y + BAR, 106.14, 0.01);
		near(p.rightLabels[4]!.y + BAR, 503.12, 0.05);
		assert.equal(p.rightLabelLeft, 360);
		near(p.dots[0]!.y + BAR, 528.47, 0.05);
		near(p.chipsTop + BAR, 600, 0.05);
	});

	it("keeps a least plot on a short view, and the whole width alone", () => {
		const short = expandedPlot(view("chart:heart-rate"), 402, 200);
		assert.equal(short.plot.bottom - short.plot.top, 160);
		const alone = pane("chart:heart-rate");
		assert.equal(alone.plot.right, 1131.08);
		assert.ok(alone.primary.average);
		assert.equal(alone.rightLabels.length, 0);
	});

	it("draws a line overlay, and the zones overlay with its gradient", () => {
		assert.ok(pane("chart:heart-rate:elevation").secondary!.line!.startsWith("M85.19 "));
		const zones = pane("chart:heart-rate:heart-rate-zones").secondary!;
		assert.ok(zones.line);
		assert.equal(zones.zones!.stops.length, 6);
	});

	it("lays Run/Walk's lanes across the plot, and Training Effect's scales", () => {
		const rw = pane("chart:run-walk:heart-rate");
		assert.deepEqual(
			rw.leftLabels.map((l) => l.text),
			["Idle", "Walk", "Run"],
		);
		assert.equal(rw.bars!.length, 3);
		assert.ok(rw.secondary!.line);
		const te = pane("chart:training-effect");
		assert.equal(te.scales!.length, 2);
		assert.equal(te.scales![0]!.segments[0]!.x, 85.19);
		near(te.scales![0]!.knob.x, 85.19 + (4.3 / 5) * (1131.08 - 85.19), 0.01);
		assert.deepEqual([te.dots, te.xTitle], [[], null]);
	});

	it("keeps the frames in one place", () => {
		assert.equal(FRAMES.phone.chart.height, 137);
		assert.equal(FRAMES.pane.stamina.height, 89.33);
		assert.equal(EXPANDED.pane.left, 85.19);
	});
});
