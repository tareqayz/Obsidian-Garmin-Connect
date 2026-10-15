import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	CHART_COLOURS,
	chartsTabView,
	expandedChartView,
	type ChartCard,
	type SeriesChart,
	type TrainingEffectChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import { seriesPlot } from "../src/dashboard/activity-charts";
import { effortColor, sportTitle } from "../src/dashboard/activity-labels";
import { baseOf, lapMarkers, mapLegend, mapOverlays, overlayFor, overlayLabel, overviewOverlay, routeEnds, routePoints, routeRuns } from "../src/dashboard/activity-map";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor } from "../src/dashboard/activity-sports";
import { lapsView, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { categoryRoute } from "../src/dashboard/routes";
import { OPEN_WATER_SWIM, SWIM_ROUTE } from "../src/dashboard/sports/swimming";
import { PHONE } from "../src/dashboard/stat-charts";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { openWaterSwim, TODAY } from "./swim-fixture";

/*
 * The open-water swim's page against its spec's golden numbers
 * (ref/activity-details/open-water-swim/README.md, "Golden numbers"):
 * activity 20780627494, 519.39 m in 11:37.7 with a 36 s pause before the
 * first stroke, two laps, 699 samples. Every value below is on the phone's
 * shots (Zone 1 on the web's) or is the spec's rule for it.
 */

const SWIM = openWaterSwim();

const tableOf = (sections: StatsSection[]) => sections.map((s) => [s.title, s.help, s.rows.map((r) => [r.label, r.text])]);
const cardsOf = (axis: "time" | "distance", detail: ActivityDetail = SWIM) => chartsTabView(detail, { axis }, "metric", OPEN_WATER_SWIM.charts).cards;
const find = <T extends ChartCard>(cards: ChartCard[], id: string) => cards.find((c) => c.id === id) as T;
const near = (actual: number, expected: number, within = 0.005) => assert.ok(Math.abs(actual - expected) <= within, `${actual} is not ${expected} ± ${within}`);
const yLabels = (chart: SeriesChart) => chart.y.labels.map((l) => l.text);
const xLabels = (chart: SeriesChart) => chart.x.ticks.map((t) => t.text);
const figures = (card: ChartCard) => card.figures.map((f) => [f.value, f.unit ?? "", f.label]);
const TIME = ["0:00", "2:19", "4:39", "6:58", "9:18", "11:37"];

describe("the open-water swim's profile", () => {
	it("is open water's, titled by the type table", () => {
		assert.equal(profileFor(SWIM), OPEN_WATER_SWIM);
		assert.equal(sportTitle(SWIM.type), "Open Water Swimming");
	});
});

describe("open-water Overview (golden)", () => {
	const view = overviewView(SWIM, "metric", TODAY, OPEN_WATER_SWIM.overview);

	it("has the map with the weather chip: 31°, the sun, a 6 on the wind dial at 30°", () => {
		assert.equal(view.map, true);
		assert.equal(view.routeMissing, false);
		assert.deepEqual(view.weather, { temp: "31°", icon: "sun", wind: "6", windFrom: 30 });
	});

	it("reads Oct 24, 2025 @ 9:30 AM (a past year), and 519 m as the big figure", () => {
		assert.equal(view.when, "Oct 24, 2025 @ 9:30 AM");
		assert.equal(view.glyph, "swimming");
		assert.deepEqual(view.hero, { value: "519", unit: "m", label: "Distance" });
	});

	it("has the pool's figures in the pool's order", () => {
		assert.deepEqual(view.figures, [
			{ value: "11:38", label: "Total Time" },
			{ value: "2:14", unit: "/100m", label: "Avg Pace", chart: "swim-pace" },
			{ value: "145", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" },
			{ value: "143", label: "Total Calories" },
		]);
	});

	it("evaluates Recovery (Low Aerobic), Normal, Moderate 3/10 with a green dot", () => {
		assert.equal(view.benefit?.label, "Recovery (Low Aerobic)");
		assert.equal(view.feel, "Normal");
		assert.deepEqual(view.effort, { value: 3, score: "3/10", label: "Moderate" });
		assert.equal(effortColor(3), "#0b963f");
		assert.equal(effortColor(5), "#f5bf2a");
	});

	it("links Swimming Personal Records and All Swimming Activities, and names the watch", () => {
		assert.deepEqual(view.links, [
			{ label: "Swimming Personal Records", icon: "medal", route: { page: "records", tab: "swimming" } },
			{ label: "All Swimming Activities", icon: "swimming", route: categoryRoute("swimming") },
		]);
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "12.72" });
	});
});

describe("open-water map: one plain red route", () => {
	it("offers no overlay but None, opens in it, and has no legend", () => {
		assert.equal(OPEN_WATER_SWIM.map, SWIM_ROUTE);
		assert.deepEqual(mapOverlays(SWIM, SWIM_ROUTE), ["none"]);
		assert.equal(overviewOverlay(SWIM_ROUTE), "none");
		assert.equal(overlayFor(SWIM, "pace", SWIM_ROUTE), "none");
		assert.equal(overlayLabel("none", SWIM_ROUTE), "None");
		assert.equal(mapLegend("none", SWIM_ROUTE), null);
		assert.equal(baseOf(SWIM_ROUTE), "#ff0000");
	});

	it("draws every position as one run in the route's red, joined across the gaps under water", () => {
		const points = routePoints(SWIM);
		assert.equal(points.length, 676);
		const runs = routeRuns(SWIM, "none", SWIM_ROUTE);
		assert.deepEqual(
			runs.map((r) => [r.bucket, r.points.length]),
			[[null, 676]],
		);
	});

	it("marks lap 1's end, and ends where it began (the made-up loop, as the real swim)", () => {
		assert.deepEqual(
			lapMarkers(SWIM).map((m) => m.n),
			[1],
		);
		assert.deepEqual(routeEnds(routePoints(SWIM)), { start: [10, 20], end: [10, 20] });
	});
});

describe("open-water Stats (golden)", () => {
	const sections = statsView(SWIM, "metric", OPEN_WATER_SWIM.stats);

	it("reads every section in the phone's order, Strokes after Training Effect, no Max Speed", () => {
		assert.deepEqual(tableOf(sections), [
			[
				"Pace",
				true,
				[
					["Avg Pace", "2:14 /100m"],
					["Avg Moving Pace", "2:13 /100m"],
					["Best Pace", "1:13 /100m"],
				],
			],
			[
				"Speed",
				false,
				[
					["Avg Speed", "2.7 km/h"],
					["Avg Moving Speed", "2.7 km/h"],
				],
			],
			[
				"Timing",
				false,
				[
					["Total Time", "11:38"],
					["Moving Time", "11:29"],
					["Elapsed Time", "12:14"],
				],
			],
			[
				"Heart Rate",
				true,
				[
					["Avg Heart Rate", "145 bpm"],
					["Max Heart Rate", "162 bpm"],
				],
			],
			[
				"Training Effect",
				true,
				[
					["Primary Benefit", "Recovery (Low Aerobic)"],
					["Aerobic", "2.1"],
					["Anaerobic", "1.0"],
					["Exercise Load", "52"],
				],
			],
			[
				"Strokes",
				false,
				[
					["Total Strokes", "343"],
					["Avg Stroke Rate", "29 spm"],
					["Max Stroke Rate", "39 spm"],
					["Avg Distance per Stroke", "1.51 m"],
					["Avg Swolf", "50"],
				],
			],
			[
				"Nutrition & Hydration",
				true,
				[
					["Resting Calories", "16"],
					["Active Calories", "127"],
					["Total Calories Burned", "143"],
					["Est. Sweat Loss", "171 ml"],
				],
			],
			[
				"Temperature",
				false,
				[
					["Avg Temperature", "28 °C"],
					["Min Temperature", "27 °C"],
					["Max Temperature", "34 °C"],
				],
			],
			[
				"Intensity Minutes",
				false,
				[
					["Moderate", "1 min"],
					["Vigorous", "10 min"],
					["Total", "21 min"],
				],
			],
			["Body Battery", false, [["Net Impact", "-2"]]],
		]);
	});

	it("puts the badges on Avg Pace, Avg Heart Rate, the two scores, Avg Stroke Rate and Avg Temperature", () => {
		assert.deepEqual(
			sections.flatMap((s) => s.rows.filter((r) => r.chart).map((r) => [r.label, r.chart])),
			[
				["Avg Pace", "swim-pace"],
				["Avg Heart Rate", "heart-rate"],
				["Aerobic", "training-effect"],
				["Anaerobic", "training-effect"],
				["Avg Stroke Rate", "stroke-rate"],
				["Avg Temperature", "temperature"],
			],
		);
	});

	it("leaves out Strokes and Temperature without them", () => {
		const { totalNumberOfStrokes: _a, averageSwimCadence: _b, maxSwimCadence: _c, averageStrokeDistance: _d, averageSWOLF: _e, averageTemperature: _f, minTemperature: _g, maxTemperature: _h, ...rest } = SWIM.summary;
		const ids = statsView({ ...SWIM, summary: rest }, "metric", OPEN_WATER_SWIM.stats).map((s) => s.id);
		assert.deepEqual(ids, ["pace", "speed", "timing", "heart-rate", "training-effect", "nutrition", "intensity-minutes", "body-battery"]);
	});
});

describe("open-water Laps (golden)", () => {
	it("is Lap · Time · Distance (m) · Avg Pace (min/100m), two laps and the bold Total", () => {
		const view = lapsView(SWIM, "metric", OPEN_WATER_SWIM.laps);
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.unit ?? "", c.width]),
			[
				["Lap", "", 12.25],
				["Time", "", 26.12],
				["Distance", "m", 28.61],
				["Avg Pace", "min/100m", 29.03],
			],
		);
		assert.deepEqual(view.rows, [
			{ key: "1", cells: ["1", "11:10.3", "500", "2:14"] },
			{ key: "2", cells: ["2", "0:27.4", "19", "2:21"] },
			{ key: "total", kind: "total", cells: ["Total", "11:37.7", "519", "2:14"] },
		]);
	});
});

describe("open-water Charts on the Time axis (golden)", () => {
	const cards = cardsOf("time");

	it("has Pace, Heart Rate, Training Effect, Strokes, Temperature and the zones", () => {
		assert.deepEqual(
			cards.map((c) => [c.id, c.title, c.help]),
			[
				["swim-pace", "Pace", true],
				["heart-rate", "Heart Rate", false],
				["training-effect", "Training Effect", true],
				["stroke-rate", "Strokes", false],
				["temperature", "Temperature", false],
				["time-in-hr-zones", "Time in Heart Rate Zones", true],
			],
		);
	});

	it("draws Pace as an area from 0.98 × the best pace to 5:00, Average only", () => {
		const pace = find<SeriesChart>(cards, "swim-pace");
		assert.deepEqual(figures(pace), [["2:14", "/100m", "Average"]]);
		assert.deepEqual([pace.mark, pace.fill], ["area", "pace"]);
		near(pace.y.top, 0.98 * (100 / 1.363));
		assert.equal(pace.y.bottom, 300);
		assert.deepEqual(yLabels(pace), ["1:40", "2:30", "3:20", "4:10", "5:00"]);
		assert.deepEqual(xLabels(pace), TIME);
		near(pace.average!.value, 134.41);
		// Its slowest samples (8:10 at 474 s …) and the stop before the first stroke sit on the bottom.
		const slow = pace.points.y.filter((v) => v !== null && v > 300);
		assert.equal(slow.length, 8);
		assert.ok(slow.includes(Infinity));
		assert.equal(pace.points.y.filter((v) => v === null).length, 4);
	});

	it("draws Heart Rate with its picker, 98.98 to 189.02 bpm", () => {
		const hr = find<SeriesChart>(cards, "heart-rate");
		assert.ok(hr.picker);
		assert.deepEqual(figures(hr), [
			["145", "bpm", "Average"],
			["162", "bpm", "Maximum"],
		]);
		near(hr.y.bottom, 0.98 * 101);
		near(hr.y.top, 162 + 0.443 * 61);
		assert.deepEqual(yLabels(hr), ["180", "160", "140", "120", "100"]);
		assert.deepEqual(xLabels(hr), TIME);
	});

	it("reads Training Effect 2.1 and 1.0", () => {
		const te = find<TrainingEffectChart>(cards, "training-effect");
		assert.deepEqual(
			te.figures.map((f) => [f.value, f.label, f.dot]),
			[
				["2.1", "Aerobic", "blue"],
				["1.0", "Anaerobic", "grey"],
			],
		);
	});

	it("draws Strokes as an orange area of the stroke rate, 0 to 39 ÷ 0.7", () => {
		const strokes = find<SeriesChart>(cards, "stroke-rate");
		assert.deepEqual(figures(strokes), [
			["29", "spm", "Average"],
			["39", "spm", "Maximum"],
		]);
		assert.deepEqual([strokes.mark, strokes.fill], ["area", "swim-strokes"]);
		assert.equal(strokes.y.bottom, 0);
		near(strokes.y.top, 55.71);
		assert.deepEqual(yLabels(strokes), ["40", "20", "0"]);
		assert.equal(strokes.average!.value, 29);
	});

	it("draws Temperature as grey steps on whole degrees, 26 to 36, the average line at the samples' mean", () => {
		const temperature = find<SeriesChart>(cards, "temperature");
		assert.deepEqual(figures(temperature), [
			["27", "°C", "Minimum"],
			["34", "°C", "Maximum"],
		]);
		assert.deepEqual([temperature.mark, temperature.fill, temperature.frame], ["steps", "swim-temperature", "forced"]);
		assert.deepEqual([temperature.y.bottom, temperature.y.top], [26, 36]);
		assert.deepEqual(yLabels(temperature), ["36", "34", "31", "28", "26"]);
		near(temperature.average!.value, 27.65);
		assert.deepEqual(xLabels(temperature), TIME);
		// 34 °C held to 30 s, 29 to 90 s, 28 to 210 s, then 27: 13.7 pt a degree on the phone.
		const plot = seriesPlot(temperature, PHONE, "phone");
		assert.equal(plot.labelRight, 34.83);
		assert.equal(plot.area, "M39.83 162.2 L39.83 52.6 L54.46 52.6 L54.46 121.1 L83.73 121.1 L83.73 134.8 L142.27 134.8 L142.27 148.5 L379.83 148.5 L379.83 162.2 Z");
		assert.deepEqual(plot.average, { y: 139.54, dashed: false });
	});

	it("shares the zones out of the activity's time, Garmin's white Zone 1 in the theme's text", () => {
		const zones = find<ZonesChart>(cards, "time-in-hr-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent, r.colour]),
			[
				["Zone 5", "> 177 bpm", "Maximum", "0:00", "0%", "zone-5"],
				["Zone 4", "158 - 177 bpm", "Threshold", "1:22", "11%", "zone-4"],
				["Zone 3", "139 - 157 bpm", "Aerobic", "8:02", "69%", "zone-3"],
				["Zone 2", "119 - 138 bpm", "Easy", "2:11", "18%", "zone-2"],
				["Zone 1", "99 - 118 bpm", "Warm Up", "0:03", "0%", "text"],
			],
		);
		assert.equal(CHART_COLOURS.text, "var(--text-normal)");
	});
});

describe("open-water Charts on the Distance axis (golden)", () => {
	const cards = cardsOf("distance");

	it("has every card, on nice steps of metres: 0 … 500, the plot running on to 519 m", () => {
		assert.deepEqual(
			cards.map((c) => c.id),
			["swim-pace", "heart-rate", "training-effect", "stroke-rate", "temperature", "time-in-hr-zones"],
		);
		for (const card of cards) {
			if (card.kind !== "series") continue;
			assert.deepEqual(xLabels(card), ["0", "100", "200", "300", "400", "500"], card.id);
			assert.equal(card.x.title, "Distance (m)");
			near(card.x.ticks.at(-1)!.at, 500 / 519.4, 1e-9);
		}
	});

	it("keeps each chart's y axis and figures", () => {
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "swim-pace")), ["1:40", "2:30", "3:20", "4:10", "5:00"]);
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "heart-rate")), ["180", "160", "140", "120", "100"]);
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "stroke-rate")), ["40", "20", "0"]);
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "temperature")), ["36", "34", "31", "28", "26"]);
	});
});

describe("open-water landscape charts", () => {
	it("open with the swim's chips, alphabetical", () => {
		const view = expandedChartView(SWIM, { axis: "time", sub: "chart:heart-rate" }, "metric", OPEN_WATER_SWIM.charts)!;
		assert.deepEqual(
			view.chips.map((c) => c.label),
			["Heart Rate Zones", "Pace", "Strokes", "Temperature"],
		);
		const temperature = expandedChartView(SWIM, { axis: "time", sub: "chart:heart-rate:temperature" }, "metric", OPEN_WATER_SWIM.charts)!;
		assert.equal(temperature.title, "Heart Rate & Temperature");
		assert.equal(temperature.secondary?.mark, "steps");
		assert.equal(temperature.secondary?.colour, "grey");
		assert.deepEqual(
			temperature.secondary?.y.labels.map((l) => l.text),
			["36", "34", "31", "28", "26"],
		);
	});

	it("open from the Stats and Overview badges", () => {
		for (const id of ["swim-pace", "stroke-rate", "temperature", "heart-rate", "training-effect"]) {
			assert.ok(expandedChartView(SWIM, { axis: "time", sub: `chart:${id}` }, "metric", OPEN_WATER_SWIM.charts), id);
		}
	});
});

describe("open-water edge states", () => {
	it("has no map, weather or note without a route", () => {
		const blind = { ...SWIM, hasPolyline: false, samples: { ...SWIM.samples, lat: [], lon: [] } };
		const view = overviewView(blind, "metric", TODAY, OPEN_WATER_SWIM.overview);
		assert.deepEqual([view.map, view.routeMissing, view.weather], [false, false, null]);
	});

	it("leaves out the Strokes and Temperature cards without their samples", () => {
		const { strokeRate: _a, temperature: _b, ...samples } = SWIM.samples;
		assert.deepEqual(
			cardsOf("time", { ...SWIM, samples }).map((c) => c.id),
			["swim-pace", "heart-rate", "training-effect", "time-in-hr-zones"],
		);
	});

	it("reads yards, °F and mph in an imperial vault (Inferred)", () => {
		const view = overviewView(SWIM, "imperial", TODAY, OPEN_WATER_SWIM.overview);
		assert.deepEqual(view.hero, { value: "568", unit: "yd", label: "Distance" });
		assert.deepEqual(view.figures[1], { value: "2:03", unit: "/100yd", label: "Avg Pace", chart: "swim-pace" });
		const sections = statsView(SWIM, "imperial", OPEN_WATER_SWIM.stats);
		assert.deepEqual(
			sections.find((s) => s.id === "temperature")!.rows.map((r) => r.text),
			["82 °F", "81 °F", "93 °F"],
		);
		assert.deepEqual(
			sections.find((s) => s.id === "speed")!.rows.map((r) => r.text),
			["1.7 mph", "1.7 mph"],
		);
		const temperature = find<SeriesChart>(chartsTabView(SWIM, { axis: "distance" }, "imperial", OPEN_WATER_SWIM.charts).cards, "temperature");
		assert.deepEqual(figures(temperature), [
			["81", "°F", "Minimum"],
			["93", "°F", "Maximum"],
		]);
		assert.equal(temperature.x.title, "Distance (yd)");
	});
});
