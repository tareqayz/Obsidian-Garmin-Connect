import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Units } from "../src/dashboard/activities";
import { chartsTabView, expandedChartView, type ChartCard, type SeriesChart, type ZonesChart } from "../src/dashboard/activity-chart-pages";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor } from "../src/dashboard/activity-sports";
import { lapsView, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { categoryRoute } from "../src/dashboard/routes";
import { BASIC } from "../src/dashboard/sports/basic";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

/*
 * The basic page on Garmin's Stair Stepper (ref/activity-details/basic: the
 * summary of activity 24150511862 and shots 1163–1169), with a made-up id and
 * a few made-up samples carrying the phone's heart-rate range (83–162 bpm) on
 * its 34:52 timer. Its zones are the shot's: 4:08, 2:09 and 28:03 above 103,
 * 124 and 144 bpm.
 */

const ID = 98765432103;
const TODAY = "2026-10-15";
const START = Date.parse("2026-08-28T16:01:25Z");

const SUMMARY = {
	activityName: "Stair Stepper",
	activityTypeDTO: { typeId: 31, typeKey: "stair_climbing", parentTypeId: 29 },
	accessControlRuleDTO: { typeKey: "private" },
	summaryDTO: {
		startTimeLocal: "2026-08-28T19:01:25.0",
		startTimeGMT: "2026-08-28T16:01:25.0",
		distance: 0,
		duration: 2092.296,
		movingDuration: 0,
		elapsedDuration: 2092.296,
		averageSpeed: 0,
		calories: 354,
		bmrCalories: 48,
		averageHR: 146,
		maxHR: 162,
		minHR: 83,
		trainingEffect: 2.9000000953674316,
		anaerobicTrainingEffect: 0.10000000149011612,
		trainingEffectLabel: "AEROBIC_BASE",
		activityTrainingLoad: 61.71232604980469,
		waterEstimated: 398,
		moderateIntensityMinutes: 4,
		vigorousIntensityMinutes: 30,
		steps: 322,
		differenceBodyBattery: -7,
	},
};

/** clock (s), then sumDuration, sumDistance, heart rate and cadence: the steps' cadence is no chart Garmin shows here. */
const ROWS: Array<[number, number, number, number, number]> = [
	[0, 0, 0, 87, 0],
	[60, 60, 0, 83, 40],
	[600, 600, 0, 150, 70],
	[1200, 1200, 0, 155, 77],
	[2092, 2092, 0, 162, 72],
];

const PAYLOADS = {
	summary: SUMMARY,
	samples: {
		metricDescriptors: ["directTimestamp", "sumDuration", "sumDistance", "directHeartRate", "directDoubleCadence"].map((key, metricsIndex) => ({ metricsIndex, key })),
		activityDetailMetrics: ROWS.map(([clock, ...rest]) => ({ metrics: [START + clock * 1000, ...rest] })),
	},
	laps: { lapDTOs: [{ lapIndex: 1, startTimeGMT: "2026-08-28T16:01:25.0", duration: 2092.296, distance: 0, averageSpeed: 0 }] },
	segments: { splits: [] },
	hrZones: [
		{ zoneNumber: 1, secsInZone: 248, zoneLowBoundary: 103 },
		{ zoneNumber: 2, secsInZone: 129, zoneLowBoundary: 124 },
		{ zoneNumber: 3, secsInZone: 1683, zoneLowBoundary: 144 },
		{ zoneNumber: 4, secsInZone: 0, zoneLowBoundary: 165 },
		{ zoneNumber: 5, secsInZone: 0, zoneLowBoundary: 185 },
	],
	powerZones: [],
	weather: null,
	gear: [],
	device: { productDisplayName: "Forerunner 970", versionMajorMinor: "17.39" },
	weight: null,
};

function stairStepper(): ActivityDetail {
	return buildActivityDetail(ID, PAYLOADS, null)!;
}

const STAIRS = stairStepper();
const table = (sections: StatsSection[]) => sections.map((s) => [s.title, s.rows.map((r) => [r.label, r.text])]);
const cardsOf = (detail: ActivityDetail, units: Units = "metric", axis: "time" | "distance" = "time") => chartsTabView(detail, { axis }, units, BASIC.charts).cards;
const find = <T extends ChartCard>(cards: ChartCard[], id: string) => cards.find((c) => c.id === id) as T;

describe("the basic profile", () => {
	it("is the Stair Stepper's", () => {
		assert.equal(profileFor(STAIRS), BASIC);
		assert.equal(BASIC.id, "basic");
	});
});

describe("basic Overview: the Stair Stepper (golden)", () => {
	const view = overviewView(STAIRS, "metric", TODAY, BASIC.overview);

	it("shows Total Time where a distance would be, and no distance", () => {
		assert.deepEqual(view.hero, { value: "34:52", label: "Total Time" });
		assert.equal(view.distance, undefined);
		assert.equal(view.when, "Aug 28 @ 7:01 PM");
		assert.equal(view.glyph, "stairs-up");
		assert.equal(view.title, "Stair Stepper");
	});

	it("has Avg Speed 0.0 km/h, Avg Heart Rate 146 bpm with its badge, Total Ascent -- m and 354 calories", () => {
		assert.deepEqual(view.figures, [
			{ value: "0.0", unit: "km/h", label: "Avg Speed" },
			{ value: "146", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" },
			{ value: "--", unit: "m", label: "Total Ascent" },
			{ value: "354", label: "Total Calories" },
		]);
		const imperial = overviewView(STAIRS, "imperial", TODAY, BASIC.overview).figures;
		assert.deepEqual(
			imperial.map((f) => [f.value, f.unit]),
			[
				["0.0", "mph"],
				["146", "bpm"],
				["--", "ft"],
				["354", undefined],
			],
		);
	});

	it("links the group's page with the activity's own figure, and no records row", () => {
		assert.deepEqual(view.links, [{ label: "All Gym & Fitness Equipment Activities", icon: "stairs-up", route: categoryRoute("gym") }]);
		assert.equal(view.benefit?.label, "Base (Low Aerobic)");
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "17.39" });
	});

	it("has no map, and no note in its place once the samples are in", () => {
		assert.equal(view.map, false);
		assert.equal(view.routeMissing, false);
		assert.equal(view.sensors, undefined);
		assert.equal(view.badges, undefined);
	});

	it("shows a distance as the big figure when there is one", () => {
		const walk = { ...STAIRS, summary: { ...STAIRS.summary, distance: 5000 } };
		assert.deepEqual(overviewView(walk, "metric", TODAY, BASIC.overview).hero, { value: "5.00", unit: "km", label: "Distance" });
	});
});

describe("basic Stats: the Stair Stepper (golden)", () => {
	const sections = statsView(STAIRS, "metric", BASIC.stats);

	it("reads every section with data, in the phone's order, Garmin's standstill zeros included", () => {
		assert.deepEqual(table(sections), [
			["Pace", [["Avg Pace", "0:00 /km"]]],
			["Speed", [["Avg Speed", "0.0 km/h"]]],
			["Timing", [["Total Time", "34:52"], ["Elapsed Time", "34:52"]]],
			["Heart Rate", [["Avg Heart Rate", "146 bpm"], ["Max Heart Rate", "162 bpm"]]],
			[
				"Training Effect",
				[
					["Primary Benefit", "Base (Low Aerobic)"],
					["Aerobic", "2.9"],
					["Anaerobic", "0.1"],
					["Exercise Load", "62"],
				],
			],
			[
				"Nutrition & Hydration",
				[
					["Resting Calories", "48"],
					["Active Calories", "306"],
					["Total Calories Burned", "354"],
					["Est. Sweat Loss", "398 ml"],
				],
			],
			["Intensity Minutes", [["Moderate", "4 min"], ["Vigorous", "30 min"], ["Total", "64 min"]]],
			["Body Battery", [["Net Impact", "-7"]]],
		]);
	});

	it("has HELP on Pace, Heart Rate, Training Effect and Nutrition & Hydration, as the phone", () => {
		assert.deepEqual(
			sections.filter((s) => s.help).map((s) => s.title),
			["Pace", "Heart Rate", "Training Effect", "Nutrition & Hydration"],
		);
	});

	it("puts the badges on Avg Heart Rate and the two Training Effect scores only, and x2 on Vigorous", () => {
		assert.deepEqual(
			sections.flatMap((s) => s.rows.filter((r) => r.chart).map((r) => [r.label, r.chart])),
			[
				["Avg Heart Rate", "heart-rate"],
				["Aerobic", "training-effect"],
				["Anaerobic", "training-effect"],
			],
		);
		assert.equal(sections.flatMap((s) => s.rows).find((r) => r.label === "Vigorous")?.badge, "x2");
	});

	it("shows Moving Time only when there was some", () => {
		const moved = { ...STAIRS, summary: { ...STAIRS.summary, movingDuration: 600 } };
		const timing = statsView(moved, "metric", BASIC.stats).find((s) => s.id === "timing")!;
		assert.deepEqual(
			timing.rows.map((r) => r.label),
			["Total Time", "Moving Time", "Elapsed Time"],
		);
	});
});

describe("basic Laps: the Stair Stepper (golden)", () => {
	it("is Lap · Time · Distance · Avg Speed, the one lap and its bold Total", () => {
		const view = lapsView(STAIRS, "metric", BASIC.laps);
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.unit ?? "", c.width]),
			[
				["Lap", "", 12.25],
				["Time", "", 26.12],
				["Distance", "km", 28.61],
				["Avg Speed", "km/h", 29.03],
			],
		);
		assert.deepEqual(view.rows, [
			{ key: "1", cells: ["1", "34:52.3", "0.00", "0.0"] },
			{ key: "total", kind: "total", cells: ["Total", "34:52.3", "0.00", "0.0"] },
		]);
		assert.deepEqual(
			lapsView(STAIRS, "imperial", BASIC.laps).columns.slice(2).map((c) => c.unit),
			["mi", "mph"],
		);
	});
});

describe("basic Charts: the Stair Stepper (golden)", () => {
	const cards = cardsOf(STAIRS);

	it("has Heart Rate, Training Effect and Time in Heart Rate Zones: no pace without movement, no cadence", () => {
		assert.deepEqual(
			cards.map((c) => c.id),
			["heart-rate", "training-effect", "time-in-hr-zones"],
		);
	});

	it("draws Heart Rate with its picker, 146 and 162 bpm, on the 34:52 timer", () => {
		const hr = find<SeriesChart>(cards, "heart-rate");
		assert.deepEqual(hr.picker, {
			key: "heart",
			options: [
				{ value: "heart-rate", label: "Heart Rate" },
				{ value: "zones", label: "Heart Rate Zones" },
			],
			chosen: "heart-rate",
		});
		assert.deepEqual(
			hr.figures.map((f) => [f.value, f.unit, f.label]),
			[
				["146", "bpm", "Average"],
				["162", "bpm", "Maximum"],
			],
		);
		assert.deepEqual(
			hr.x.ticks.map((t) => t.text),
			["0:00", "6:58", "13:57", "20:55", "27:54", "34:52"],
		);
		assert.equal(hr.help, false);
	});

	it("reads Training Effect 2.9 and 0.1, with its ?", () => {
		const te = find<ChartCard>(cards, "training-effect");
		assert.deepEqual(
			te.figures.map((f) => [f.value, f.label]),
			[
				["2.9", "Aerobic"],
				["0.1", "Anaerobic"],
			],
		);
		assert.equal(te.help, true);
	});

	it("shares the zones out of the activity's time: 11, 6 and 80%, where the zones' own sum gives 12, 6 and 81", () => {
		const zones = find<ZonesChart>(cards, "time-in-hr-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent]),
			[
				["Zone 5", "> 184 bpm", "Maximum", "0:00", "0%"],
				["Zone 4", "165 - 184 bpm", "Threshold", "0:00", "0%"],
				["Zone 3", "144 - 164 bpm", "Aerobic", "28:03", "80%"],
				["Zone 2", "124 - 143 bpm", "Easy", "2:09", "6%"],
				["Zone 1", "103 - 123 bpm", "Warm Up", "4:08", "11%"],
			],
		);
		const byZones = find<ZonesChart>(chartsTabView(STAIRS, { axis: "time" }, "metric", { ...BASIC.charts!, zoneTotal: "zones" }).cards, "time-in-hr-zones");
		assert.deepEqual(
			byZones.rows.map((r) => r.percent),
			["0%", "0%", "81%", "6%", "12%"],
		);
	});

	it("adds Pace for an activity that moved", () => {
		const moving = { ...STAIRS, summary: { ...STAIRS.summary, averageSpeed: 1.2, maxSpeed: 1.5 }, samples: { ...STAIRS.samples, speed: [0, 1.1, 1.2, 1.3, 1.2] } };
		assert.deepEqual(
			cardsOf(moving).map((c) => c.id),
			["pace", "heart-rate", "training-effect", "time-in-hr-zones"],
		);
	});

	it("opens the landscape Heart Rate with the sport's chips, and no chart it doesn't offer", () => {
		const view = expandedChartView(STAIRS, { axis: "time", sub: "chart:heart-rate" }, "metric", BASIC.charts)!;
		assert.equal(view.title, "Heart Rate");
		assert.deepEqual(
			view.chips.map((c) => c.label),
			["Heart Rate Zones"],
		);
		assert.equal(expandedChartView(STAIRS, { axis: "time", sub: "chart:cadence" }, "metric", BASIC.charts), null);
		assert.equal(expandedChartView(STAIRS, { axis: "time", sub: "chart:training-effect" }, "metric", BASIC.charts)?.title, "Training Effect");
	});
});
