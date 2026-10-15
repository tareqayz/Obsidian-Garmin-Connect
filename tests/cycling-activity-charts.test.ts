import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Units } from "../src/dashboard/activities";
import {
	availableMetrics,
	chartsTabView,
	expandedChartView,
	type ChartCard,
	type ChartsRoute,
	type CustomChart,
	type SeriesChart,
	type TrainingEffectChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import { expandedPlot, seriesPlot } from "../src/dashboard/activity-charts";
import { platformOffsetPlot, positionPlot, powerCurvePlot, powerPhasePlot, ringArc, timeInPositionPlot } from "../src/dashboard/cycling-activity-charts";
import {
	CURVE_SECONDS,
	positionSpans,
	RIDE_CHARTS,
	type PlatformOffsetData,
	type PositionData,
	type PowerCurveData,
	type PowerPhaseData,
	type TimeInPositionData,
} from "../src/dashboard/cycling-metrics";
import { PHONE } from "../src/dashboard/stat-charts";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { INDEX_ROWS, RIDE_ID, roadRide, TODAY } from "./cycling-ride-fixture";

/*
 * A ride's Charts tab, its landscape charts and its own cards' geometry,
 * against the road-cycling spec's golden numbers
 * (ref/activity-details/road-cycling/README.md: "Charts", "Rules › X axes /
 * Y axes", "Golden numbers"; `cycling-ride-fixture.ts`). Geometry is the
 * phone's (402 pt) and a pane card's (370, a third of the 1190 layout),
 * the Obsidian twin's (Figma 886:5, `ref/.../road-cycling/figma-obsidian.md`).
 */

const RIDE = roadRide();
const EXTRAS = { rows: INDEX_ROWS, today: TODAY };
const PANE = 370;

function tab(route: Partial<ChartsRoute> = {}, units: Units = "metric", detail: ActivityDetail = RIDE, rows = INDEX_ROWS): ChartCard[] {
	return chartsTabView(detail, { axis: "time", ...route }, units, RIDE_CHARTS, { rows, today: TODAY }).cards;
}

function card<T extends ChartCard>(id: string, route: Partial<ChartsRoute> = {}, units: Units = "metric"): T {
	const found = tab(route, units).find((c) => c.id === id);
	assert.ok(found, `no ${id} card`);
	return found as T;
}

const ticks = (chart: { x: { ticks: Array<{ text: string }> } }) => chart.x.ticks.map((t) => t.text);
const labels = (chart: SeriesChart) => chart.y.labels.map((l) => l.text);
const figures = (chart: ChartCard) => chart.figures.map((f) => [f.value, f.unit ?? "", f.label]);

function near(actual: number | undefined, expected: number, within = 0.01): void {
	assert.ok(actual !== undefined && Math.abs(actual - expected) <= within, `${actual} is not ${expected} ± ${within}`);
}

/** The area charts' time axis: 0:00 to the last sample's 3,440 s, round(k × T / 5). */
const AREA_TICKS = ["0:00", "11:28", "22:56", "34:24", "45:52", "57:20"];

describe("ride Charts: the tab (golden)", () => {
	it("lists the twenty cards in the phone's order", () => {
		assert.deepEqual(
			tab().map((c) => c.id),
			[
				"elevation",
				"speed",
				"power",
				"heart-rate",
				"stamina",
				"performance-condition",
				"training-effect",
				"bike-cadence",
				"lr-balance",
				"position",
				"time-in-position",
				"power-phase-balance",
				"pp-start",
				"pp-end",
				"platform-offset",
				"left-pco",
				"right-pco",
				"time-in-hr-zones",
				"time-in-power-zones",
				"power-curve",
			],
		);
	});

	it("puts a ? on the nine cards that have one", () => {
		assert.deepEqual(
			tab()
				.filter((c) => c.help)
				.map((c) => c.id),
			["stamina", "performance-condition", "training-effect", "position", "time-in-position", "power-phase-balance", "platform-offset", "time-in-hr-zones", "time-in-power-zones"],
		);
	});
});

describe("ride Charts: the charts of samples (golden)", () => {
	it("Elevation: -11 and 10 m, labels 10 0 -10, the bottom at 0.98 × -10.6 and the measured top", () => {
		const chart = card<SeriesChart>("elevation");
		assert.deepEqual(figures(chart), [
			["-11", "m", "Minimum"],
			["10", "m", "Maximum"],
		]);
		assert.deepEqual(labels(chart), ["10", "0", "-10"]);
		near(chart.y.bottom, -10.388);
		near(chart.y.top, 18.368);
		assert.deepEqual(ticks(chart), AREA_TICKS);
		assert.equal(chart.average, undefined);
		assert.equal(chart.fill, "elevation");
	});

	it("Speed: 28.8 and 43.6 km/h, labels 60 40 20 0, the top at 1.428 × 43.6 (pad 0.428), its average line", () => {
		const chart = card<SeriesChart>("speed");
		assert.equal(chart.title, "Speed");
		assert.deepEqual(figures(chart), [
			["28.8", "km/h", "Average"],
			["43.6", "km/h", "Maximum"],
		]);
		assert.deepEqual(labels(chart), ["60", "40", "20", "0"]);
		assert.equal(chart.y.bottom, 0);
		near(chart.y.top, 62.26);
		near(chart.average?.value, 28.782);
		assert.equal(chart.average?.dashed, false);
		assert.deepEqual([chart.mark, chart.fill], ["area", "pace"]);
		assert.deepEqual(ticks(chart), AREA_TICKS);
		assert.deepEqual(figures(card<SeriesChart>("speed", {}, "imperial")), [
			["17.9", "mph", "Average"],
			["27.1", "mph", "Maximum"],
		]);
	});

	it("Power: titled Power with no picker, 153 and 398 W, labels 400 200 0 on a 568.3 W top, in the usual frame", () => {
		const chart = card<SeriesChart>("power");
		assert.equal(chart.title, "Power");
		assert.equal(chart.picker, undefined);
		assert.deepEqual(figures(chart), [
			["153", "W", "Average"],
			["398", "W", "Maximum"],
		]);
		assert.deepEqual(labels(chart), ["400", "200", "0"]);
		near(chart.y.top, 568.344);
		assert.equal(chart.average?.value, 153);
		assert.equal(chart.frame, "chart");
		// The usual frame: the plot 25.2 pt under the figures, as the phone draws the ride's Power.
		assert.equal(seriesPlot(chart, PHONE).plot.top, 25.2);
	});

	it("Heart Rate: its Heart Rate | Heart Rate Zones picker, 156 and 170 bpm, labels 200 … 100 (pad 0.46)", () => {
		const chart = card<SeriesChart>("heart-rate");
		assert.deepEqual(chart.picker, {
			key: "heart",
			options: [
				{ value: "heart-rate", label: "Heart Rate" },
				{ value: "zones", label: "Heart Rate Zones" },
			],
			chosen: "heart-rate",
		});
		assert.deepEqual(figures(chart), [
			["156", "bpm", "Average"],
			["170", "bpm", "Maximum"],
		]);
		assert.deepEqual(labels(chart), ["200", "180", "160", "140", "120", "100"]);
		near(chart.y.bottom, 98.98);
		near(chart.y.top, 201.74);
		const zones = card<SeriesChart>("heart-rate", { picks: { heart: "zones" } });
		assert.deepEqual([zones.title, zones.mark], ["Heart Rate Zones", "line"]);
		assert.deepEqual(labels(zones), ["200", "180", "160", "140", "120", "100"]);
	});

	it("Stamina: 99 and 39 %, labels 100 … 0, its key", () => {
		const chart = card<SeriesChart>("stamina");
		assert.deepEqual(figures(chart), [
			["99", "%", "Beginning Potential"],
			["39", "%", "Ending Potential"],
		]);
		assert.deepEqual(labels(chart), ["100", "80", "60", "40", "20", "0"]);
		assert.deepEqual(
			chart.legend?.map((k) => k.label),
			["Stamina", "Potential"],
		);
	});

	it("Performance Condition: no figures, ±(3 + 1) for the ride's -3 … +2", () => {
		const chart = card<SeriesChart>("performance-condition");
		assert.deepEqual(chart.figures, []);
		assert.deepEqual([chart.y.bottom, chart.y.top], [-4, 4]);
		assert.deepEqual(labels(chart), ["+4", "+2", "0", "-2", "-4"]);
		assert.deepEqual(ticks(chart), AREA_TICKS);
	});

	it("Training Effect: 3.4 Aerobic, 0.0 Anaerobic", () => {
		const chart = card<TrainingEffectChart>("training-effect");
		assert.deepEqual(figures(chart), [
			["3.4", "", "Aerobic"],
			["0.0", "", "Anaerobic"],
		]);
		assert.deepEqual(
			chart.scales.map((s) => [s.value, s.colour]),
			[
				[3.4, "green"],
				[0, "grey"],
			],
		);
	});

	it("Cadence: the bike's, 81 and 103 rpm, an orange area from 0, labels 150 100 50 0", () => {
		const chart = card<SeriesChart>("bike-cadence");
		assert.equal(chart.title, "Cadence");
		assert.deepEqual(figures(chart), [
			["81", "rpm", "Average"],
			["103", "rpm", "Maximum"],
		]);
		assert.deepEqual(labels(chart), ["150", "100", "50", "0"]);
		assert.equal(chart.y.bottom, 0);
		near(chart.y.top, 147.084);
		assert.deepEqual([chart.mark, chart.fill, chart.average?.value], ["area", "stamina", 81]);
		assert.deepEqual(ticks(chart), AREA_TICKS);
	});

	it("L/R Balance: 49 and 51 %, the right's share as dots, 100% L on top, from 0:12 to 57:05", () => {
		const chart = card<SeriesChart>("lr-balance");
		assert.deepEqual(figures(chart), [
			["49", "%", "Left Balance"],
			["51", "%", "Right Balance"],
		]);
		assert.deepEqual(labels(chart), ["100% L", "50/50", "100% R"]);
		assert.deepEqual([chart.y.bottom, chart.y.top], [100, 0]);
		assert.deepEqual(ticks(chart), ["0:12", "11:35", "22:57", "34:20", "45:42", "57:05"]);
		assert.deepEqual([chart.mark, chart.colour, chart.average], ["dots", "purple", undefined]);
		// The right = 100 dot at 3,417 s sits on "100% R"; nothing past 57:05.
		const i = chart.points.y.indexOf(100);
		near(chart.points.x[i], (3417 - 12) / (3425 - 12), 1e-9);
		assert.ok(chart.points.x.every((x) => x >= 0 && x <= 1));
	});

	it("Power Phase: Start: both pedals' dots from where both have one (0:18) to 57:05, 270 … 90 through TDC", () => {
		const chart = card<SeriesChart>("pp-start");
		assert.equal(chart.title, "Power Phase: Start");
		assert.deepEqual(chart.figures, []);
		assert.deepEqual(chart.picker, {
			key: "ppStart",
			options: [
				{ value: "pp-start", label: "Power Phase: Start" },
				{ value: "peak-pp-start", label: "Peak Power Phase Start" },
			],
			chosen: "pp-start",
		});
		assert.deepEqual(ticks(chart), ["0:18", "11:39", "23:01", "34:22", "45:44", "57:05"]);
		assert.deepEqual(labels(chart), ["270", "315", "TDC 0", "45", "90"]);
		assert.deepEqual([chart.y.bottom, chart.y.top], [90, -90]);
		assert.deepEqual(
			chart.legend?.map((k) => [k.label, k.colour]),
			[
				["Left", "pedal-left"],
				["Right", "pedal-right"],
			],
		);
		// Left dots green, then right dots blue; 357.2° reads -2.8°, and the 108.3° sample is off the window.
		const left = chart.colours!.filter((c) => c === "green").length;
		assert.ok(left > 0 && chart.colours!.slice(left).every((c) => c === "pedal-right"));
		assert.ok(chart.points.y.some((y) => y !== null && Math.abs(y + 2.8) < 1e-6));
		assert.ok(chart.points.y.every((y) => y !== null && y >= -90 && y <= 90));
		assert.ok(!chart.points.y.some((y) => y !== null && Math.abs(y - 108.3) < 1e-6));
	});

	it("Power Phase: End: 135 … 315 with BDC, the left's 97° samples off the window", () => {
		const chart = card<SeriesChart>("pp-end");
		assert.equal(chart.title, "Power Phase: End");
		assert.deepEqual(chart.picker?.options.map((o) => o.label), ["Power Phase: End", "Peak Power Phase End"]);
		assert.deepEqual(labels(chart), ["135", "BDC 180", "225", "270", "315"]);
		assert.deepEqual([chart.y.bottom, chart.y.top], [315, 135]);
		assert.deepEqual(ticks(chart), ["0:18", "11:39", "23:01", "34:22", "45:44", "57:05"]);
		assert.ok(chart.points.y.every((y) => y !== null && y >= 135 && y <= 315));
	});

	it("the peak phases on the pickers: TDC 0 … 135 and 45 … BDC 180, on the same span", () => {
		const start = card<SeriesChart>("pp-start", { picks: { ppStart: "peak-pp-start" } });
		assert.equal(start.title, "Peak Power Phase Start");
		assert.equal(start.picker?.chosen, "peak-pp-start");
		assert.deepEqual(labels(start), ["TDC 0", "45", "90", "135"]);
		assert.deepEqual([start.y.bottom, start.y.top], [135, 0]);
		assert.deepEqual(ticks(start), ["0:18", "11:39", "23:01", "34:22", "45:44", "57:05"]);
		const end = card<SeriesChart>("pp-end", { picks: { ppEnd: "peak-pp-end" } });
		assert.equal(end.title, "Peak Power Phase End");
		assert.deepEqual(labels(end), ["45", "90", "135", "BDC 180"]);
		assert.deepEqual([end.y.bottom, end.y.top], [180, 45]);
	});

	it("the platform centre offsets: ±30 mm by 15 (the right's upside down), dashed averages 0 and -9, from 0:11 to 57:05", () => {
		const left = card<SeriesChart>("left-pco");
		const right = card<SeriesChart>("right-pco");
		assert.deepEqual(labels(left), ["30", "15", "0", "-15", "-30"]);
		assert.deepEqual(labels(right), ["-30", "-15", "0", "15", "30"]);
		assert.deepEqual([left.y.bottom, left.y.top, right.y.bottom, right.y.top], [-30, 30, 30, -30]);
		assert.deepEqual(left.average, { value: 0, dashed: true, strong: true });
		assert.deepEqual(right.average, { value: -9, dashed: true, strong: true });
		assert.deepEqual([left.colour, right.colour], ["red", "orange"]);
		for (const chart of [left, right]) {
			assert.deepEqual(ticks(chart), ["0:11", "11:34", "22:57", "34:19", "45:42", "57:05"]);
			assert.deepEqual(chart.figures, []);
		}
	});
});

describe("ride Charts: time in zones (golden)", () => {
	it("Heart Rate: five zones floored of the ride's time", () => {
		const zones = card<ZonesChart>("time-in-hr-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent]),
			[
				["Zone 5", "> 176 bpm", "Maximum", "0:00", "0%"],
				["Zone 4", "158 - 176 bpm", "Threshold", "30:29", "53%"],
				["Zone 3", "138 - 157 bpm", "Aerobic", "24:20", "42%"],
				["Zone 2", "118 - 137 bpm", "Easy", "2:02", "3%"],
				["Zone 1", "99 - 117 bpm", "Warm Up", "0:30", "0%"],
			],
		);
		assert.deepEqual(
			zones.rows.map((r) => r.colour),
			["zone-5", "zone-4", "zone-3", "zone-2", "zone-1"],
		);
	});

	it("Power: seven zones in watts, named and coloured as the phone's (Zone 1's white the theme's text)", () => {
		const zones = card<ZonesChart>("time-in-power-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent, r.colour]),
			[
				["Zone 7", "> 412 Watts", "Neuromuscular", "0:00", "0%", "power-zone-7"],
				["Zone 6", "329 - 412 Watts", "Anaerobic", "0:16", "0%", "power-zone-6"],
				["Zone 5", "287 - 328 Watts", "VO₂ Max", "0:48", "1%", "deep-orange"],
				["Zone 4", "246 - 286 Watts", "Threshold", "1:48", "3%", "yellow"],
				["Zone 3", "205 - 245 Watts", "Tempo", "5:40", "9%", "zone-3"],
				["Zone 2", "151 - 204 Watts", "Endurance", "25:33", "44%", "zone-2"],
				["Zone 1", "0 - 150 Watts", "Active Recovery", "23:15", "40%", "text"],
			],
		);
	});

	it("floors the shares (Z2 3.54 → 3%, power Z3 9.88 → 9%), the same of the zones' own sum", () => {
		const own = { ...RIDE_CHARTS, zoneTotal: "zones" as const };
		const percents = (id: string, spec = RIDE_CHARTS) => (chartsTabView(RIDE, { axis: "time" }, "metric", spec, EXTRAS).cards.find((c) => c.id === id) as ZonesChart).rows.map((r) => r.percent);
		assert.deepEqual(percents("time-in-hr-zones", own), percents("time-in-hr-zones"));
		assert.deepEqual(percents("time-in-power-zones", own), percents("time-in-power-zones"));
	});
});

describe("ride Charts: its own cards (golden)", () => {
	it("Position: Seated and Standing on the clock, 0:00 to the summary's 57:21, the pause not closed", () => {
		const position = card<CustomChart>("position");
		assert.deepEqual([position.title, position.plot, position.help, position.figures], ["Position", "position", true, []]);
		const data = position.data as PositionData;
		assert.deepEqual(
			data.lanes.map((l) => [l.label, l.colour]),
			[
				["Standing", "standing"],
				["Seated", "deep-orange"],
			],
		);
		assert.deepEqual(ticks(data), ["0:00", "11:28", "22:57", "34:25", "45:53", "57:21"]);
		const T = 3441.266;
		const standing = data.bars.filter((b) => b.lane === "standing").map((b) => [b.from * T, b.to * T]);
		// 1571 → 1577 → 1578 is one stretch; 1792 → 1895 spans the pause; 3493 → 3496 is past the axis' end.
		const expected = [
			[483, 487],
			[1253, 1260],
			[1469, 1471],
			[1571, 1578],
			[1792, 1895],
			[2133, 2138],
		];
		assert.equal(standing.length, expected.length);
		standing.forEach(([from, to], i) => {
			near(from, expected[i]![0]!, 1e-6);
			near(to, expected[i]![1]!, 1e-6);
		});
		assert.equal(data.bars.at(-1)?.to, 1);
		assert.equal(data.bars.length, 13);
	});

	it("Position's stretches: each event until the next, Seated before the first, neighbours joined", () => {
		const spans = positionSpans(RIDE);
		assert.deepEqual(spans[0], { from: 0, to: 483, lane: "seated" });
		assert.deepEqual(
			spans.filter((s) => s.lane === "standing").map((s) => [s.from, s.to]),
			[
				[483, 487],
				[1253, 1260],
				[1469, 1471],
				[1571, 1578],
				[1792, 1895],
				[2133, 2138],
				[3493, 3496],
			],
		);
		assert.deepEqual(spans.at(-1), { from: 3496, to: 3518.451, lane: "seated" });
	});

	it("Time in Position: Standing 0:36 1%, Seated 56:45 99%, rounded", () => {
		const data = card<CustomChart>("time-in-position").data as TimeInPositionData;
		assert.deepEqual(
			data.rows.map((r) => [r.label, r.time, r.percent, r.fill, r.colour]),
			[
				["Standing", "0:36", "1%", 0.01, "standing"],
				["Seated", "56:45", "99%", 0.99, "deep-orange"],
			],
		);
	});

	it("Power Phase and Balance: each pedal's arcs from the summary, 49 % and 51 %, the key's four blocks", () => {
		const data = card<CustomChart>("power-phase-balance").data as PowerPhaseData;
		assert.deepEqual(
			data.dials.map((d) => [d.label, d.phase, d.peak, d.balance]),
			[
				[
					"LEFT",
					{ start: 11.25, end: 217.96875, colour: "pedal-left" },
					{ start: 67.5, end: 118.125, colour: "peak-left" },
					{ value: "49", unit: "%", label: "Left Balance" },
				],
				[
					"RIGHT",
					{ start: 15.46875, end: 216.5625, colour: "pedal-right" },
					{ start: 68.90625, end: 118.125, colour: "peak-right" },
					{ value: "51", unit: "%", label: "Right Balance" },
				],
			],
		);
		assert.deepEqual(
			data.keys.map((k) => [k.title, k.colour, ...k.values.map((v) => `${v.value} ${v.label} ${v.sub}`)]),
			[
				["L Power Phase", "pedal-left", "11° Avg PP Start", "218° Avg PP End"],
				["R Power Phase", "pedal-right", "15° Avg PP Start", "217° Avg PP End"],
				["L Peak Power Phase", "peak-left", "68° Avg PPP Start", "118° Avg PPP End"],
				["R Peak Power Phase", "peak-right", "69° Avg PPP Start", "118° Avg PPP End"],
			],
		);
	});

	it("Platform Offset: -- for the left's 0 mm (its line still on the centre), -9 mm for the right, + outboard", () => {
		const data = card<CustomChart>("platform-offset").data as PlatformOffsetData;
		assert.deepEqual(data.pedals, [
			{ side: "left", label: "Left Pedal", value: "--", offset: 0, plus: "left" },
			{ side: "right", label: "Right Pedal", value: "-9 mm", offset: -9, plus: "right" },
		]);
		assert.deepEqual(
			data.keys.map((k) => k.label),
			["Center", "Average"],
		);
	});

	it("Power Curve (W): This Activity over the all-time Record of the index's sixteen power rides, 0 … 700 in quarters", () => {
		const curve = card<CustomChart>("power-curve");
		assert.equal(curve.title, "Power Curve (W)");
		assert.equal(curve.help, false);
		assert.deepEqual(curve.picker, {
			key: "curve",
			options: [
				{ value: "w", label: "Power Curve (W)" },
				{ value: "wkg", label: "Power Curve (W/kg)" },
			],
			chosen: "w",
		});
		const data = curve.data as PowerCurveData;
		assert.equal(data.subtitle, "Compare this activity’s power to your power curve.");
		assert.deepEqual(
			data.ticks.map((t) => t.text),
			["700", "525", "350", "175", "0"],
		);
		assert.deepEqual(
			data.durations.map((d) => d.label),
			["1 sec", "2 sec", "5 sec", "10 sec", "30 sec", "1 min", "2 min", "5 min", "10 min", "20 min", "30 min", "1 hr", "2 hr", "5 hr"],
		);
		assert.deepEqual(CURVE_SECONDS, [1, 2, 5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200, 18000]);
		assert.deepEqual(
			data.activity.map((v) => v.value),
			[398, 355, 340, 323, 251, 237, 218, 204, 194, 182, 164],
		);
		assert.equal(data.activity.at(-1)?.seconds, 1800);
		assert.deepEqual(
			data.record.map((v) => v.value),
			[687, 650, 626, 582, 498, 317, 286, 251, 240, 211, 193, 181, 167],
		);
		assert.equal(data.record.at(-1)?.seconds, 7200);
		assert.deepEqual(
			data.keys.map((k) => k.label),
			["This Activity", "Record"],
		);
		assert.equal(data.axisTitle, "Interval Length");
	});

	it("Power Curve (W/kg): both curves over the ride's 68.0 kg, 0 … 15 by 5", () => {
		const curve = card<CustomChart>("power-curve", { picks: { curve: "wkg" } });
		assert.equal(curve.title, "Power Curve (W/kg)");
		assert.equal(curve.picker?.chosen, "wkg");
		const data = curve.data as PowerCurveData;
		assert.equal(data.unit, "W/kg");
		assert.deepEqual(
			data.ticks.map((t) => t.text),
			["15", "10", "5", "0"],
		);
		assert.equal(data.activity[0]!.value.toFixed(2), "5.85");
		assert.equal(data.record[0]!.value.toFixed(2), "10.10");
	});

	it("Power Curve: W alone without a weigh-in, none without the ride's own curve", () => {
		const unweighed = { ...RIDE, weightKg: null };
		const curve = tab({ picks: { curve: "wkg" } }, "metric", unweighed).find((c) => c.id === "power-curve") as CustomChart;
		assert.equal(curve.title, "Power Curve (W)");
		assert.equal(curve.picker, undefined);
		const others = INDEX_ROWS.filter((r) => r.id !== RIDE_ID);
		assert.equal(
			tab({}, "metric", RIDE, others).find((c) => c.id === "power-curve"),
			undefined,
		);
	});
});

describe("ride Charts on the Distance axis (Inferred)", () => {
	const distance = tab({ axis: "distance" });

	it("steps 5 km from 0.00 to 25.00, the dot cards from 0 too", () => {
		for (const id of ["elevation", "speed", "lr-balance", "pp-start", "left-pco"]) {
			assert.deepEqual(ticks(distance.find((c) => c.id === id) as SeriesChart), ["0.00", "5.00", "10.00", "15.00", "20.00", "25.00"], id);
		}
	});

	it("places Position's stretches at the distance ridden by their clock time", () => {
		const data = (distance.find((c) => c.id === "position") as CustomChart).data as PositionData;
		assert.deepEqual(ticks(data), ["0.00", "5.00", "10.00", "15.00", "20.00", "25.00"]);
		const pause = data.bars.find((b) => b.lane === "standing" && b.to - b.from > 0.001 && b.from > 0.5)!;
		// The file keeps distances to 0.1 m; the axis ends at the last, 27,512.9 m.
		// 1792 s on the clock lies between the samples at 1560 and 1808 s.
		near(pause.from * 27512.9, 13116.3 + ((1792 - 1560) / (1808 - 1560)) * (14723.7 - 13116.3), 0.01);
		// The pause adds no distance: 1895 s on the clock is where the ride stopped (14,750.1 m).
		near(pause.to * 27512.9, 14750.1, 0.01);
	});
});

describe("ride landscape charts (golden)", () => {
	const view = (sub: string) => expandedChartView(RIDE, { axis: "time", sub }, "metric", RIDE_CHARTS, EXTRAS)!;

	it("offers its fifteen other charts as chips from Elevation, alphabetically, the colon dropped", () => {
		const elevation = view("chart:elevation");
		assert.equal(elevation.title, "Elevation");
		assert.deepEqual(
			elevation.chips.map((c) => c.label),
			[
				"Cadence",
				"Heart Rate",
				"Heart Rate Zones",
				"L/R Balance",
				"Left Platform Center Offset",
				"Peak Power Phase End",
				"Peak Power Phase Start",
				"Performance Condition",
				"Position",
				"Power",
				"Power Phase End",
				"Power Phase Start",
				"Right Platform Center Offset",
				"Speed",
				"Stamina",
			],
		);
		assert.deepEqual(availableMetrics(RIDE, RIDE_CHARTS).length, 16);
		assert.deepEqual(elevation.x?.ticks.map((t) => t.text), AREA_TICKS);
	});

	it("labels each overlay on the right as the phone, in its colour", () => {
		const overlays: Array<[string, string, string, string[]]> = [
			["bike-cadence", "Cadence", "orange", ["147", "110", "74", "37", "0"]],
			["heart-rate", "Heart Rate", "crimson", ["202", "176", "150", "125", "99"]],
			["heart-rate-zones", "Heart Rate Zones", "crimson", ["202", "176", "150", "125", "99"]],
			["lr-balance", "L/R Balance", "purple", ["100% L", "50/50", "100% R"]],
			["left-pco", "Left Platform Center Offset", "red", ["30", "15", "0", "-15", "-30"]],
			["peak-pp-end", "Peak Power Phase End", "pedal-left", ["45", "90", "135", "BDC 180"]],
			["peak-pp-start", "Peak Power Phase Start", "pedal-left", ["TDC 0", "45", "90", "135"]],
			["performance-condition", "Performance Condition", "grey", ["+4", "+2", "0", "-2", "-4"]],
			["power", "Power", "power-line", ["568", "426", "284", "142", "0"]],
			["pp-end", "Power Phase End", "pedal-left", ["135", "BDC 180", "225", "270", "315"]],
			["pp-start", "Power Phase Start", "pedal-left", ["270", "315", "TDC 0", "45", "90"]],
			["right-pco", "Right Platform Center Offset", "orange", ["-30", "-15", "0", "15", "30"]],
			["speed", "Speed", "blue", ["62", "47", "31", "16", "0"]],
		];
		for (const [metric, title, colour, right] of overlays) {
			const v = view(`chart:elevation:${metric}`);
			assert.equal(v.title, `Elevation & ${title}`);
			assert.equal(v.secondary?.colour, colour, metric);
			assert.deepEqual(
				v.secondary?.y.labels.map((l) => l.text),
				right,
				metric,
			);
			assert.deepEqual(v.x?.ticks.map((t) => t.text), AREA_TICKS, metric);
			assert.equal(v.swap, `chart:elevation:${metric}:swap`);
		}
	});

	it("keeps the keys of Power Phase, Peak, Stamina and Position under the axis", () => {
		const keys = (metric: string) => view(`chart:elevation:${metric}`).secondary?.legend?.map((k) => k.label);
		assert.deepEqual(keys("pp-start"), ["Left", "Right"]);
		assert.deepEqual(keys("peak-pp-end"), ["Left", "Right"]);
		assert.deepEqual(keys("stamina"), ["Stamina", "Potential"]);
		assert.deepEqual(keys("position"), ["Seated", "Standing"]);
		assert.equal(keys("speed"), undefined);
		assert.equal(view("chart:elevation:stamina").secondary?.colour, "stamina-line");
	});

	it("draws Position as lanes with no labels, on its own axis to 57:21", () => {
		const v = view("chart:elevation:position");
		assert.equal(v.secondary?.mark, "lanes");
		assert.deepEqual(v.secondary?.y.labels, []);
		assert.equal(v.secondary?.lanes?.bars.length, 13);
		assert.deepEqual(
			v.x?.ticks.map((t) => t.text),
			["0:00", "11:28", "22:57", "34:25", "45:53", "57:21"],
		);
		assert.equal(v.dim, true);
	});

	it("opens Position from the Stats badge as lanes, with the ride's other charts as chips", () => {
		const v = view("chart:position");
		assert.equal(v.title, "Position");
		assert.equal((v.primary as SeriesChart).mark, "lanes");
		assert.equal(v.chips.length, 15);
		assert.ok(!v.chips.some((c) => c.metric === "position"));
	});

	it("draws the dot charts from 0:00 as overlays, both pedals in their colours", () => {
		const v = view("chart:elevation:pp-start");
		assert.equal(v.secondary?.mark, "dots");
		assert.ok(v.secondary!.points.x.every((x) => x >= 0 && x <= 1));
		assert.deepEqual([...new Set(v.secondary?.colours)], ["green", "pedal-right"]);
	});

	it("gives up 27 pt of plot for an overlay's key, centred 25.3 under the axis title, the chips where they were", () => {
		// The phone's page state (624 pt under the bar) and a pane's (620), as the twin lays them.
		const dots = expandedPlot(view("chart:elevation:pp-start"), 402, 624);
		const plain = expandedPlot(view("chart:elevation:speed"), 402, 624);
		assert.deepEqual(plain.plot, { left: 46.76, right: 361.14, top: 62.14, bottom: 459.12 });
		assert.deepEqual(dots.plot, { left: 46.76, right: 361.14, top: 62.14, bottom: 432.12 });
		assert.deepEqual([dots.xTitle?.y, dots.keyY, dots.height, dots.chipsTop], [488.6, 513.9, 521.9, 556]);
		assert.equal(plain.chipsTop, dots.chipsTop);
		assert.equal(plain.keyY, undefined);
		assert.deepEqual(dots.keys?.map((k) => k.label), ["Left", "Right"]);
		assert.deepEqual([dots.keyLeft, dots.keyRight], [46.76, 361.14]);
		const pane = expandedPlot(view("chart:elevation:pp-start"), 1190, 620);
		assert.deepEqual(pane.plot, { left: 85.19, right: 1131.08, top: 64.95, bottom: 416.89 });
		assert.deepEqual([pane.xTitle?.y, pane.keyY, pane.chipsTop], [472.6, 497.9, 552]);
	});

	it("lays Position along the plot's bottom as an overlay, 18.67 pt a lane, Seated first", () => {
		const plot = expandedPlot(view("chart:elevation:position"), 402, 624);
		const bars = plot.overlayBars!;
		assert.equal(bars.length, 13);
		const seated = bars.filter((b) => b.colour === "deep-orange");
		const standing = bars.filter((b) => b.colour === "standing");
		assert.equal(bars.indexOf(standing[0]!), seated.length);
		assert.ok(seated.every((b) => b.y === 413.45 && b.height === 18.67));
		assert.ok(standing.every((b) => b.y === 394.78 && b.height === 37.34));
		assert.deepEqual(seated[0], { x: 46.76, y: 413.45, width: 44.12, height: 18.67, colour: "deep-orange" });
		assert.deepEqual(plot.rightLabels, []);
		assert.deepEqual(plot.keys?.map((k) => k.label), ["Seated", "Standing"]);
	});

	it("draws Position as the base in its lanes as on its card, Standing on top, Seated halfway (Inferred)", () => {
		const plot = expandedPlot(view("chart:position"), 402, 624);
		// The card's left on the phone, so "Standing" fits beside the plot.
		assert.deepEqual([plot.plot.left, plot.plot.right, plot.leftLabelRight], [73.83, 361.14, 66.33]);
		assert.deepEqual(plot.lanes, [
			{ y: 62.14, label: "Standing", colour: "standing" },
			{ y: 260.63, label: "Seated", colour: "deep-orange" },
		]);
		assert.deepEqual(plot.leftLabels, [
			{ y: 62.14, text: "Standing" },
			{ y: 260.63, text: "Seated" },
		]);
		assert.deepEqual(plot.bars?.[0], { x: 73.83, y: 260.63, width: 40.33, height: 198.49, colour: "deep-orange" });
		assert.ok(plot.bars?.filter((b) => b.colour === "standing").every((b) => b.y === 62.14 && b.height === 396.98));
		assert.equal(plot.keyY, undefined);
		assert.deepEqual([expandedPlot(view("chart:position"), 1190, 620).plot.left, expandedPlot(view("chart:position"), 1190, 620).leftLabelRight], [85.19, 70]);
	});

	it("opens every chart a badge names", () => {
		for (const base of ["speed", "elevation", "power", "heart-rate", "stamina", "training-effect", "lr-balance", "bike-cadence", "position", "pp-start", "peak-pp-start", "left-pco", "right-pco"]) {
			assert.ok(view(`chart:${base}`), base);
		}
	});
});

describe("ride cards' geometry at the phone's 402 and a pane's 370", () => {
	const data = <T>(id: string, route: Partial<ChartsRoute> = {}) => card<CustomChart>(id, route).data as T;

	it("Position: a 192 pt plot from 73.83 to 382.83, Standing on top, Seated halfway, bars from the baseline", () => {
		const plot = positionPlot(data<PositionData>("position"), PHONE);
		assert.deepEqual(plot.plot, { left: 73.83, right: 382.83, top: 50.37, bottom: 242.37 });
		assert.deepEqual(plot.grid, [50.37, 98.37, 146.37, 242.37]);
		assert.deepEqual(
			plot.lanes.map((l) => [l.label, l.y]),
			[
				["Standing", 50.37],
				["Seated", 146.37],
			],
		);
		assert.equal(plot.labelRight, 66.33);
		assert.deepEqual(
			plot.dots.map((d) => d.x),
			[73.83, 135.63, 197.43, 259.23, 321.03, 382.83],
		);
		// Seated first, Standing over it: the 1792 → 1895 s stretch, the widest, from the top line.
		const seated = plot.bars.filter((b) => b.colour === "deep-orange");
		const standing = plot.bars.filter((b) => b.colour === "standing");
		assert.equal(plot.bars.indexOf(standing[0]!), seated.length);
		assert.ok(seated.every((b) => b.y === 146.37 && b.height === 96));
		assert.ok(standing.every((b) => b.y === 50.37 && b.height === 192));
		const widest = standing.reduce((a, b) => (b.width > a.width ? b : a));
		near(widest.x, 73.83 + (1792 / 3441.266) * 309, 0.01);
		near(widest.width, (103 / 3441.266) * 309, 0.01);
		// The 2 s stretch is the hairline: 0.67 pt.
		assert.equal(Math.min(...standing.map((b) => b.width)), 0.67);
		assert.deepEqual(plot.xTitle, { x: 228.33, y: 289.68, text: "Time (h:m:s)" });
		const pane = positionPlot(data<PositionData>("position"), PANE, "pane");
		assert.deepEqual(pane.plot, { left: 80.83, right: 348, top: 50.37, bottom: 242.37 });
		assert.equal(pane.labelRight, 73.33);
	});

	it("Time in Position: the zone rows' tracks, 1% the 2.73 pt cap, 99% to 286.6", () => {
		const plot = timeInPositionPlot(data<TimeInPositionData>("time-in-position"), PHONE);
		assert.deepEqual(
			plot.bars.map((b) => [b.y, b.trackY, b.track, b.fill, b.colour]),
			[
				[16.24, 46.21, { x: 16, width: 273.33 }, { x: 16, width: 2.73 }, "standing"],
				[73.91, 103.88, { x: 16, width: 273.33 }, { x: 16, width: 270.6 }, "deep-orange"],
			],
		);
		// 16.24 + 44 + 13.67 + 44 + 30.62: the zone tables' foot, under the 44 pt row.
		assert.equal(plot.height, 148.53);
		assert.equal(timeInPositionPlot(data<TimeInPositionData>("time-in-position"), PANE).bars[1]!.track.width, 241.33);
	});

	it("Power Phase and Balance: the dials 73.2 in from the margins, arcs clockwise from TDC", () => {
		const plot = powerPhasePlot(data<PowerPhaseData>("power-phase-balance"), PHONE);
		const [left, right] = plot.dials;
		assert.deepEqual([left!.cx, left!.cy, right!.cx], [89.2, 95.44, 312.8]);
		assert.deepEqual(left!.track, { r: 62.45, width: 9.7 });
		assert.equal(left!.phase?.d, ringArc(89.2, 95.44, 57.6, 67.3, 11.25, 217.96875));
		// 206.7° of arc: the long way round; the peak's 50.6° the short way.
		assert.match(left!.phase!.d, /^M102\.33 29\.43 A67\.3 67\.3 0 1 1 /);
		assert.match(left!.peak!.d, / A73 73 0 0 1 /);
		assert.deepEqual(left!.marks[0], { x: 89.2, y: 42.44, r: 3, quarter: true });
		assert.deepEqual([left!.marks[1]!.r, left!.marks[1]!.quarter], [1.67, false]);
		// The twin's text centres: TDC 58.8, BDC 132.8, the side 97.55.
		assert.deepEqual([left!.tdc.y, left!.bdc.y, left!.label.y], [58.82, 132.82, 97.57]);
		assert.deepEqual(
			plot.dials.map((d) => d.balance),
			[
				{ x: 108.5, valueY: 207.28, labelY: 233.34 },
				{ x: 293.5, valueY: 207.28, labelY: 233.34 },
			],
		);
		assert.deepEqual(
			plot.keys.map((k) => [k.square.x, k.titleY, k.values.map((v) => v.x), k.divider.x]),
			[
				[16, 273.6, [54.33, 131.33], 92.33],
				[233.3, 273.6, [271.63, 348.63], 309.63],
				[16, 362.27, [54.33, 131.33], 92.33],
				[233.3, 362.27, [271.63, 348.63], 309.63],
			],
		);
		// Each value's line 23.53 under the title, its two-line label around 323.8.
		assert.deepEqual(plot.keys[0]!.values[0], { x: 54.33, valueY: 297.13, labelY: 316.05, subY: 331.55 });
		assert.equal(plot.height, 444.11);
		const pane = powerPhasePlot(data<PowerPhaseData>("power-phase-balance"), PANE, "pane");
		assert.deepEqual(
			pane.dials.map((d) => d.cx),
			[96.2, 277.97],
		);
	});

	it("Platform Offset: each pedal in its half, the right's average 9.45 pt toward its − side", () => {
		const plot = platformOffsetPlot(data<PlatformOffsetData>("platform-offset"), PHONE);
		assert.deepEqual(plot.divider, { x: 201, y1: 30.9, y2: 168.9 });
		const [left, right] = plot.pedals;
		assert.deepEqual([left!.cx, right!.cx], [108.5, 293.5]);
		// The dashed centre a point above the red line, as the twin draws them.
		assert.deepEqual(left!.centre, { x: 108.5, y1: 29.9, y2: 168.9 });
		assert.deepEqual(left!.average, { x: 108.5, y1: 30.9, y2: 168.9 });
		assert.deepEqual(right!.average, { x: 284.05, y1: 30.9, y2: 168.9 });
		// Garmin's pedal art, "+" outboard: the right's mirrored about its own left edge.
		assert.deepEqual([left!.art, right!.art], [
			{ x: 58.21, y: 38.61, mirrored: false },
			{ x: 343.79, y: 38.61, mirrored: true },
		]);
		assert.deepEqual([left!.value, right!.value], [
			{ x: 108.5, y: 184.34, text: "--" },
			{ x: 293.5, y: 184.34, text: "-9 mm" },
		]);
		assert.deepEqual([left!.label.y, right!.label.text], [204.34, "Right Pedal"]);
		assert.equal(plot.keysY, 228.9);
		assert.equal(plot.height, 252.5);
		const pane = platformOffsetPlot(data<PlatformOffsetData>("platform-offset"), PANE, "pane");
		// Halves of 23 … 351.17 inside the pane card's margins.
		assert.deepEqual(
			pane.pedals.map((p) => p.cx),
			[105.05, 269.13],
		);
	});

	it("Power Curve (W): 14 dots from 53.17 to 386.17, 0 … 700 over 188 pt, the curves on them", () => {
		const plot = powerCurvePlot(data<PowerCurveData>("power-curve"), PHONE);
		assert.deepEqual([plot.left, plot.right, plot.labelRight], [53.17, 386.17, 36.13]);
		assert.deepEqual(
			plot.grid.map((g) => [g.label, g.y, g.zero]),
			[
				["700", 65.4, false],
				["525", 112.4, false],
				["350", 159.4, false],
				["175", 206.4, false],
				["0", 253.4, true],
			],
		);
		assert.equal(plot.dots.length, 14);
		assert.deepEqual([plot.dots[1]!.x, plot.dots[13]!.x], [78.79, 386.17]);
		assert.deepEqual(plot.dots[0], { x: 53.17, y: 260.57, r: 2.835 });
		// The durations on end, centred at 287.47, half a point left of their dots.
		assert.deepEqual(plot.labels[0], { x: 52.67, y: 287.47, text: "1 sec" });
		// 687 W and 398 W at 1 sec; This Activity ends at 30 min, the Record at 2 hr.
		assert.deepEqual(plot.record.points[0], { x: 53.17, y: 68.89 });
		assert.deepEqual(plot.activity.points[0], { x: 53.17, y: 146.51 });
		assert.equal(plot.activity.points.at(-1)?.x, 309.32);
		assert.equal(plot.record.points.at(-1)?.x, 360.55);
		assert.ok(plot.activity.area.startsWith("M53.17 253.4 L53.17 146.51"));
		assert.ok(plot.activity.area.endsWith("L309.32 253.4 Z"));
		assert.deepEqual(plot.title, { x: 201, y: 327.27, text: "Interval Length" });
		assert.deepEqual([plot.subtitleY, plot.keysY, plot.height], [15.03, 366.42, 386.87]);
	});

	it("Power Curve (W/kg): narrower labels, the plot from 45.17", () => {
		const plot = powerCurvePlot(data<PowerCurveData>("power-curve", { picks: { curve: "wkg" } }), PHONE);
		assert.deepEqual([plot.left, plot.labelRight], [45.17, 28.13]);
		assert.deepEqual(
			plot.grid.map((g) => [g.label, g.y]),
			[
				["15", 65.4],
				["10", 128.07],
				["5", 190.73],
				["0", 253.4],
			],
		);
		const pane = powerCurvePlot(data<PowerCurveData>("power-curve"), PANE, "pane");
		assert.deepEqual([pane.left, pane.right, pane.labelRight, pane.title.x], [60.17, 351.34, 43.13, 185]);
	});

	it("the dot cards' frames: L/R Balance's wider labels, Power Phase 100 pt over its key, the offsets 150", () => {
		const plot = (id: string, route: Partial<ChartsRoute> = {}, pane = false) => seriesPlot(card<SeriesChart>(id, route), pane ? PANE : PHONE, pane ? "pane" : "phone");
		// L/R Balance: the usual 137 pt plot, from 54.83 for "100% L".
		const balance = plot("lr-balance");
		assert.deepEqual(balance.plot, { left: 54.83, right: 379.83, top: 25.2, bottom: 162.2 });
		assert.deepEqual([balance.labelRight, balance.height], [38.47, 223.86]);
		// Power Phase: 100 pt from 18.15, the dots 10 under it, the key 52.84 under them; End's labels 10 wider.
		const start = plot("pp-start");
		assert.deepEqual(start.plot, { left: 39.83, right: 379.83, top: 18.15, bottom: 118.15 });
		assert.deepEqual([start.labelRight, start.dots[0]!.y, start.xLabels[0]!.y, start.xTitle?.y, start.keyY, start.height], [34.8, 128.15, 141.13, 158.19, 180.99, 223.15]);
		const end = plot("pp-end");
		assert.deepEqual([end.plot.left, end.labelRight], [49.83, 44.8]);
		// The peaks: the dots 5 under the plot, the key where the phase's is.
		const peak = plot("pp-start", { picks: { ppStart: "peak-pp-start" } });
		assert.deepEqual([peak.dots[0]!.y, peak.xTitle?.y, peak.keyY, peak.height], [123.15, 156.19, 180.99, 223.15]);
		assert.equal(plot("pp-end", { picks: { ppEnd: "peak-pp-end" } }).plot.left, 49.83);
		// The offsets: 150 pt, labels every 15 mm 37.5 apart.
		const offset = plot("left-pco");
		assert.deepEqual(offset.plot, { left: 39.83, right: 379.83, top: 18.15, bottom: 168.15 });
		assert.deepEqual(offset.yLabels.map((l) => l.y), [18.15, 55.65, 93.15, 130.65, 168.15]);
		assert.deepEqual([offset.dots[0]!.y, offset.xTitle?.y, offset.keyY, offset.height], [173.15, 206.19, undefined, 223.15]);
		// A pane's card: 7 in, 2.83 short of the border, 3 pt more under the key or the axis.
		const panes = [plot("lr-balance", {}, true), plot("pp-start", {}, true), plot("left-pco", {}, true)];
		assert.deepEqual(
			panes.map((p) => [p.plot.left, p.plot.right, p.labelRight, p.height]),
			[
				[61.83, 345, 45.47, 226.93],
				[46.83, 345, 41.8, 226.15],
				[46.83, 345, 39.83, 226.22],
			],
		);
	});
});

describe("a ride without power (Inferred)", () => {
	const bare: ActivityDetail = {
		...RIDE,
		summary: Object.fromEntries(Object.entries(RIDE.summary).filter(([key]) => !/Power|Balance|PlatformCenter|seatedTime|standingTime|intensityFactor|trainingStressScore|totalWork/.test(key))),
		samples: Object.fromEntries(Object.entries(RIDE.samples).filter(([key]) => !/^(power|balanceRight|ppp?(Start|End)[LR]|pco[LR])$/.test(key))),
		powerZones: [],
		positions: undefined,
	};

	it("keeps the charts it has data for and drops power, the cycling dynamics and the power curve", () => {
		assert.deepEqual(
			tab({}, "metric", bare, INDEX_ROWS.filter((r) => r.id !== RIDE_ID)).map((c) => c.id),
			["elevation", "speed", "heart-rate", "stamina", "performance-condition", "training-effect", "bike-cadence", "time-in-hr-zones"],
		);
	});
});
