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
import { areaPath, dotPaths, expandedPlot, FRAMES, LANDSCAPE, marksOf, runWalkPlot, seriesPlot, stepPath, trainingEffectScales, zoneBars } from "../src/dashboard/activity-charts";
import { PANE_COLUMN } from "../src/dashboard/stat-charts";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/**
 * Positions are the phone's (ref/activity-details/outdoor-run/phone, 402 pt
 * portrait, 874 × 402 landscape), measured on the shots; a portrait box starts
 * 30 pt above its plot. Phase 2 moves the frames to the Obsidian twin.
 */
const PHONE = 402;

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

describe("seriesPlot: the portrait frame", () => {
	it("runs the plot from 39.7 to 379.7 pt, 137 pt tall, the tick dots 11.8 pt under it", () => {
		const p = seriesPlot(chart("heart-rate"), PHONE);
		assert.deepEqual(p.plot, { left: 39.7, right: 379.7, top: 30, bottom: 167 });
		// The phone's dots: 39.67, 107.67, 175.67, 244.0, 312.0, 379.67.
		nearAll(
			p.dots.map((d) => d.x),
			[39.67, 107.67, 175.67, 244, 312, 379.67],
			0.35,
		);
		assert.equal(p.dots[0]!.y, 178.8);
		assert.equal(p.dots[0]!.r, 3.85);
		assert.deepEqual(
			p.xLabels.map((l) => l.text),
			["0:00", "11:12", "22:24", "33:37", "44:49", "56:01"],
		);
		assert.equal(p.xLabels[0]!.y, 192);
		assert.deepEqual(p.xTitle, { x: 209.7, y: 213, text: "Time (h:m:s)" });
		assert.equal(p.labelRight, 34.2);
		assert.equal(p.height, 226.8);
	});

	it("moves Pace's plot to 44.7 pt, its labels with it", () => {
		const p = seriesPlot(chart("pace"), PHONE);
		assert.equal(p.plot.left, 44.7);
		assert.equal(p.labelRight, 39.4);
		nearAll(
			p.dots.map((d) => d.x),
			[44.67, 111.67, 178.67, 246, 313, 379.67],
			0.35,
		);
		// Grade-Adjusted and Lap Average Pace keep 39.7 on the phone.
		assert.equal(seriesPlot(chart("pace", { pace: "gap" }), PHONE).plot.left, 39.7);
		assert.equal(seriesPlot(chart("pace", { pace: "lap-pace" }), PHONE).plot.left, 39.7);
	});

	it("gives Stamina an 89 pt plot and its key a row under the axis", () => {
		const p = seriesPlot(chart("stamina"), PHONE);
		assert.deepEqual(p.plot, { left: 39.7, right: 379.7, top: 30, bottom: 119 });
		// 20% a label: 17.8 pt, as on the phone.
		near(label(p, "80") - label(p, "100"), 17.8);
		assert.equal(p.dots[0]!.y, 128);
		assert.equal(p.keyY, 185.3);
	});

	it("stretches across a pane's column at the phone's heights", () => {
		const p = seriesPlot(chart("heart-rate"), PANE_COLUMN);
		assert.deepEqual(p.plot, { left: 39.7, right: 725.7, top: 30, bottom: 167 });
		near(p.dots[5]!.x, 725.7);
		assert.equal(seriesPlot(chart("heart-rate"), 40).plot.right, 99.7);
	});
});

describe("seriesPlot: labels where the phone draws them", () => {
	it("spaces the labels as the phone does", () => {
		// Phone, between neighbouring labels: Pace 26.7, HR 44.45, Elevation 30.8, Power 37.4, Cadence 39.1, VR and GCT 34.3, VO 36.8 (/2 cm).
		const gap = (id: string, a: string, b: string, route: Partial<ChartsRoute> = {}) => {
			const p = seriesPlot(chart(id, route), PHONE);
			return label(p, b) - label(p, a);
		};
		near(gap("pace", "5:00", "5:20"), 26.7, 0.25);
		near(gap("heart-rate", "200", "150"), 44.45, 0.25);
		near(gap("elevation", "-10", "-15"), 30.8, 0.3);
		near(gap("power", "600", "400"), 37.4, 0.25);
		near(gap("cadence", "250", "200"), 39.1, 0.4);
		near(gap("vertical-ratio", "10", "9"), 34.3, 0.1);
		near(gap("ground-contact-time", "272", "252"), 34.3, 0.1);
		near(gap("vertical-oscillation", "12", "10"), 36.8, 0.6);
		near(gap("pace", "5:00", "5:20", { pace: "lap-pace" }), 38.2, 1);
	});

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

	it("puts the forced labels at the plot's ends and quarters", () => {
		const p = seriesPlot(chart("ground-contact-time"), PHONE);
		assert.deepEqual(
			p.yLabels.map((l) => [l.text, l.y]),
			[
				["291", 30],
				["272", 64.25],
				["252", 98.5],
				["233", 132.75],
				["214", 167],
			],
		);
	});
});

describe("seriesPlot: marks", () => {
	it("closes an area on the plot's bottom, a stop's pace drawn at the slow end", () => {
		const p = seriesPlot(chart("pace"), PHONE);
		const d = p.area!;
		// 0.877 and 0.616 m/s (19:00 and 27:03 /km) are past the slow end: on the plot's bottom.
		assert.ok(d.startsWith("M44.7 167 L45.1 167 L45.6 45.54 "), d.slice(0, 40));
		assert.ok(d.endsWith("L379.7 167 L44.7 167 Z"), d.slice(-40));
		assert.deepEqual(p.fill, { y1: 30, y2: 167 });
	});

	it("draws the average line at the summary's average", () => {
		const hr = seriesPlot(chart("heart-rate"), PHONE);
		// 167 bpm on 74.48 … 228.96.
		near(hr.average!.y, 167 - ((167 - 74.48) / (228.958 - 74.48)) * 137, 0.01);
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
		assert.ok(p.scatter![0]!.d.startsWith("M39.7 "));
		assert.match(p.scatter![0]!.d, /^M[\d.]+ [\d.]+h0\.01M/);
		assert.equal(p.scatterR, 2.35);
	});

	it("steps Performance Condition from its zero line, white", () => {
		const p = seriesPlot(chart("performance-condition"), PHONE);
		// ±3 over 137 pt: 0 at 98.5, +2 at 52.83, +1 at 75.67.
		assert.deepEqual(p.reference, { y: 98.5 });
		assert.ok(p.area!.startsWith("M"));
		assert.match(p.area!, /L[\d.]+ 52\.83 L[\d.]+ 52\.83/);
		assert.ok(p.area!.endsWith("L379.7 98.5 Z"));
	});

	it("blocks Lap Average Pace from each lap's pace down to the plot's bottom", () => {
		const p = seriesPlot(chart("pace", { pace: "lap-pace" }), PHONE);
		assert.equal(p.blocks!.length, 3);
		const [first, , last] = p.blocks!;
		near(first!.x, 39.7);
		near(first!.width, (355.056 / 3361) * 340, 0.01);
		near(first!.y + first!.height, 167);
		// The fastest lap tops out at 0.98 × its pace: 2.74 pt under the plot's top.
		near(last!.y, 30 + (137 * (296.03 - 290.11)) / (362.216 - 290.11), 0.02);
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
		// 194.5 bpm to 102 bpm on the HR axis.
		near(p.zones!.y1, 167 - ((194.5 - 74.48) / (228.958 - 74.48)) * 137, 0.01);
		near(p.zones!.y2, 167 - ((102 - 74.48) / (228.958 - 74.48)) * 137, 0.01);
	});

	it("lays Stamina's Potential over its area, and Impact Load Factor's line at 1.0", () => {
		assert.ok(seriesPlot(chart("stamina"), PHONE).potential!.startsWith("M39.7 30"));
		near(seriesPlot(chart("impact-load"), PHONE).reference!.y, 167 - 137 / 3.06, 0.01);
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

describe("runWalkPlot", () => {
	const p = runWalkPlot(find<RunWalkChart>(cards(), "run-walk"), PHONE);

	it("runs its plot from 46.7 to 382.9 pt with three lanes 30.1 pt apart", () => {
		assert.deepEqual(p.plot, { left: 46.7, right: 382.9, top: 30, bottom: 120.3 });
		assert.deepEqual(
			p.lanes.map((l) => [l.label, l.y]),
			[
				["Idle", 30],
				["Walk", 60.1],
				["Run", 90.2],
			],
		);
		assert.equal(p.labelRight, 41.9);
	});

	it("draws five tick dots, where the phone has them", () => {
		nearAll(
			p.dots.map((d) => d.x),
			[46.67, 114, 181.33, 248.33, 315.67],
			0.2,
		);
		assert.deepEqual(
			p.xLabels.map((l) => l.text),
			["0:00", "11:12", "22:24", "33:36", "44:49"],
		);
		near(p.dots[0]!.y, 129.9);
		assert.equal(p.keyY, 187.2);
	});

	it("raises each bar from the plot's bottom to its lane, the 3.8 s walk a hairline", () => {
		assert.deepEqual(
			p.bars.map((b) => [b.colour, b.y, b.height]),
			[
				["blue", 90.2, 30.1],
				["green", 60.1, 60.2],
				["blue", 90.2, 30.1],
			],
		);
		near(p.bars[0]!.x, 46.7);
		// The walk is about where the phone draws it (x 203.6 pt).
		near(p.bars[1]!.x, 203.6, 0.3);
		assert.equal(p.bars[1]!.width, 0.5);
		near(p.bars[2]!.x + p.bars[2]!.width, 382.9, 0.01);
	});
});

describe("trainingEffectScales", () => {
	const [aerobic, anaerobic] = trainingEffectScales(find<TrainingEffectChart>(cards(), "training-effect"), PHONE);

	it("lays five segments with 6 pt gaps and the red cap from 16 to 386 pt", () => {
		// The phone: 16.0, 88.67, 161.0, 233.67, 306.33, cap 378.67–386.0.
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

describe("zoneBars", () => {
	it("fills the floored share of a 16–289.3 pt track (74% → 607 of 820 px)", () => {
		const hr = zoneBars(find<ZonesChart>(cards(), "time-in-hr-zones"), PHONE);
		assert.deepEqual(hr[0]!.track, { x: 16, width: 273.33 });
		nearAll(
			hr.map((b) => b.fill?.width ?? 0),
			[0, 202.33, 59.67, 5.33, 0],
			0.5,
		);
		assert.equal(hr[0]!.fill, null);
		const power = zoneBars(find<ZonesChart>(cards(), "time-in-power-zones"), PHONE);
		nearAll(
			power.slice(0, 4).map((b) => b.fill?.width ?? 0),
			[0, 11, 35.67, 128.33],
			0.5,
		);
	});
});

describe("expandedPlot: the landscape chart", () => {
	const open = (sub: string) => expandedPlot(expandedChartView(RUN, { axis: "time", sub }, "metric")!);

	it("runs the plot from 117.7 to 768.7 pt with an overlay, to 780.7 alone, 73.3 to 276.6 down", () => {
		const overlaid = open("chart:heart-rate:cadence");
		assert.deepEqual(overlaid.plot, { left: 117.67, right: 768.67, top: 73.3, bottom: 276.6 });
		assert.equal(open("chart:heart-rate").plot.right, 780.67);
		nearAll(
			overlaid.dots.map((d) => d.x),
			[117.67, 247.87, 378.07, 508.27, 638.47, 768.67],
		);
		assert.equal(overlaid.dots[0]!.y, LANDSCAPE.dotY);
	});

	it("labels the primary on the left as the phone does: 200 at 111.4, 150 at 177, 100 at 243", () => {
		const p = open("chart:heart-rate");
		nearAll(
			p.leftLabels.map((l) => l.y),
			[111.4, 177, 243],
			0.5,
		);
		assert.equal(p.leftLabelRight, 110.6);
		// Its average, alone: the white line at 155.3 pt.
		near(p.primary.average!.y, 155.33, 0.6);
	});

	it("labels the overlay on the right from the axis' bottom to its top, in its colour", () => {
		const p = open("chart:heart-rate:cadence");
		assert.deepEqual(
			p.rightLabels.map((l) => [l.text, l.y]),
			[
				["272", 73.3],
				["228", 124.13],
				["185", 174.95],
				["141", 225.78],
				["98", 276.6],
			],
		);
		assert.equal(p.rightLabelLeft, 760.4);
		assert.equal(p.secondary!.colour, "deep-orange");
		assert.ok(p.secondary!.scatter!.length > 1);
		assert.equal(p.secondary!.scatterR, 2.5);
		assert.equal(p.dim, true);
		assert.equal(p.primary.average, undefined);
	});

	it("draws a line overlay, and the zones overlay with its gradient", () => {
		assert.ok(open("chart:heart-rate:elevation").secondary!.line!.startsWith("M117.67 "));
		const zones = open("chart:heart-rate:heart-rate-zones").secondary!;
		assert.ok(zones.line);
		assert.equal(zones.zones!.stops.length, 6);
	});

	it("lays Run/Walk's lanes across the landscape plot, and Training Effect's scales", () => {
		const rw = open("chart:run-walk:heart-rate");
		assert.deepEqual(
			rw.leftLabels.map((l) => l.text),
			["Idle", "Walk", "Run"],
		);
		assert.equal(rw.bars!.length, 3);
		assert.ok(rw.secondary!.line);
		const te = open("chart:training-effect");
		assert.equal(te.scales!.length, 2);
		assert.equal(te.scales![0]!.segments[0]!.x, 117.67);
		near(te.scales![0]!.knob.x, 117.67 + (4.3 / 5) * (780.67 - 117.67), 0.01);
		assert.deepEqual([te.dots, te.xTitle], [[], null]);
	});

	it("keeps the frames in one place", () => {
		assert.equal(FRAMES.chart.height, 137);
		assert.equal(FRAMES.stamina.height, 89);
		assert.equal(LANDSCAPE.width, 874);
	});
});
