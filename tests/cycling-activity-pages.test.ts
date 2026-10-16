import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { mapLegend, mapOverlays, overlayBucket, overlayFor, overlayLabel, overviewOverlay, rampOf, routeRuns } from "../src/dashboard/activity-map";
import { overviewView, weatherChip } from "../src/dashboard/activity-overview";
import { profileFor, sportOf } from "../src/dashboard/activity-sports";
import { lapsView, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { categoryRoute } from "../src/dashboard/routes";
import { CYCLING, RIDE_MAP } from "../src/dashboard/sports/cycling";
import { POWER_RAMP } from "../src/dashboard/sports/cycling-palette";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { roadRide, TODAY } from "./cycling-ride-fixture";

/*
 * A ride's Overview, Stats, Laps and map against the road-cycling spec's
 * golden numbers (ref/activity-details/road-cycling/README.md, "Golden
 * numbers"; activity 90000000033 under a made-up id, `cycling-ride-fixture.ts`).
 */

const RIDE = roadRide();
const table = (sections: StatsSection[]) => sections.map((s) => [s.title, s.rows.map((r) => [r.label, r.text])]);

/** The ride with these summary keys gone: a ride without a power meter, a distance, … */
function without(detail: ActivityDetail, keys: readonly string[], columns: readonly string[] = []): ActivityDetail {
	const summary = { ...detail.summary };
	for (const key of keys) delete summary[key];
	const samples = { ...detail.samples };
	for (const column of columns) delete samples[column];
	return { ...detail, summary, samples };
}

const POWER_KEYS = [
	"averagePower",
	"maxPower",
	"normalizedPower",
	"maxPowerTwentyMinutes",
	"leftBalance",
	"rightBalance",
	"intensityFactor",
	"trainingStressScore",
	"functionalThresholdPower",
	"totalWork",
	"seatedTime",
	"standingTime",
	"averageSeatedPower",
	"maxSeatedPower",
	"averageStandingPower",
	"maxStandingPower",
	"leftPowerPhaseStart",
	"leftPowerPhaseEnd",
	"leftPowerPhaseArcLength",
	"leftPowerPhasePeakStart",
	"leftPowerPhasePeakEnd",
	"leftPowerPhasePeakArcLength",
	"rightPowerPhaseStart",
	"rightPowerPhaseEnd",
	"rightPowerPhaseArcLength",
	"rightPowerPhasePeakStart",
	"rightPowerPhasePeakEnd",
	"rightPowerPhasePeakArcLength",
	"leftPlatformCenterOffset",
	"rightPlatformCenterOffset",
	"totalNumberOfStrokes",
];

describe("the cycling profile", () => {
	it("draws every cycling type's page", () => {
		assert.equal(profileFor(RIDE), CYCLING);
		assert.equal(CYCLING.id, "cycling");
		for (const type of [
			{ type: "road_biking", typeId: 10, parentTypeId: 2 },
			{ type: "mountain_biking", typeId: 5, parentTypeId: 2 },
			{ type: "indoor_cycling", typeId: 25, parentTypeId: 2 },
			{ type: "cycling", typeId: 2, parentTypeId: 17 },
		]) {
			assert.equal(sportOf(type), "cycling", type.type);
		}
	});
});

describe("ride Overview (golden)", () => {
	const view = overviewView(RIDE, "metric", TODAY, CYCLING.overview);

	it("leads with the distance, 27.51 km, under the date line and the name", () => {
		assert.deepEqual(view.hero, { value: "27.51", unit: "km", label: "Distance" });
		assert.equal(view.when, "Oct 13 @ 11:57 AM");
		assert.equal(view.glyph, "bike");
		assert.equal(view.private, true);
		assert.equal(view.map, true);
		assert.equal(view.routeMissing, false);
	});

	it("has Total Time, Avg Speed, Total Ascent and Avg Power, the last three opening their charts", () => {
		assert.deepEqual(view.figures, [
			{ value: "57:21", label: "Total Time" },
			{ value: "28.8", unit: "km/h", label: "Avg Speed", chart: "speed" },
			{ value: "196", unit: "m", label: "Total Ascent", chart: "elevation" },
			{ value: "153", unit: "W", label: "Avg Power", chart: "power" },
		]);
		assert.deepEqual(
			overviewView(RIDE, "imperial", TODAY, CYCLING.overview).figures.map((f) => [f.value, f.unit]),
			[
				["57:21", undefined],
				["17.9", "mph"],
				["643", "ft"],
				["153", "W"],
			],
		);
	});

	it("evaluates Tempo (High Aerobic), Normal, Moderate 3/10", () => {
		assert.equal(view.benefit?.label, "Tempo (High Aerobic)");
		assert.equal(view.feel, "Normal");
		assert.deepEqual(view.effort, { value: 3, score: "3/10", label: "Moderate" });
	});

	it("shows the badge Climber 1 with the app's description", () => {
		assert.deepEqual(view.badges, [{ name: "Climber 1", description: "Climb 500 feet during a cycling activity." }]);
	});

	it("links the cycling records and All Cycling Activities, no Reports", () => {
		assert.deepEqual(view.links, [
			{ label: "Cycling Personal Records", icon: "medal", route: { page: "records", tab: "cycling" } },
			{ label: "All Cycling Activities", icon: "bike", route: categoryRoute("cycling") },
		]);
	});

	it("lists the Forerunner 970 18.32 and the pedals: Rally 100/200, 4.1, Battery OK, no serial", () => {
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "18.32" });
		assert.deepEqual(view.sensors, [{ name: "Rally 100/200", product: 3578, type: "BIKE_POWER", firmware: "4.1", battery: "OK" }]);
		assert.ok(!JSON.stringify(RIDE).includes("serial"));
	});

	it("puts 34° and a 17 km/h wind from 170° on the map, Mostly Cloudy", () => {
		assert.deepEqual(weatherChip(RIDE, "metric"), { temp: "34°", icon: "cloud", wind: "17", windFrom: 170 });
	});

	it("shows Avg Heart Rate where a ride without power has no Avg Power, and Total Time without a distance (Inferred)", () => {
		const bare = without(RIDE, POWER_KEYS);
		assert.deepEqual(overviewView(bare, "metric", TODAY, CYCLING.overview).figures.at(-1), { value: "156", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" });
		const still = without(RIDE, ["distance"]);
		assert.deepEqual(overviewView(still, "metric", TODAY, CYCLING.overview).hero, { value: "57:21", label: "Total Time" });
	});
});

describe("ride Stats (golden)", () => {
	const sections = statsView(RIDE, "metric", CYCLING.stats);

	it("reads its sixteen sections, top to bottom, every row as the phone", () => {
		assert.deepEqual(table(sections), [
			[
				"Speed",
				[
					["Avg Speed", "28.8 km/h"],
					["Avg Moving Speed", "29.1 km/h"],
					["Max Speed", "43.6 km/h"],
				],
			],
			[
				"Timing",
				[
					["Total Time", "57:21"],
					["Moving Time", "56:48"],
					["Elapsed Time", "58:38"],
				],
			],
			[
				"Heart Rate",
				[
					["Avg Heart Rate", "156 bpm"],
					["Max Heart Rate", "170 bpm"],
				],
			],
			[
				"Stamina",
				[
					["Beginning Potential", "99%"],
					["Ending Potential", "39%"],
					["Min Stamina", "39%"],
				],
			],
			[
				"Training Effect",
				[
					["Primary Benefit", "Tempo (High Aerobic)"],
					["Aerobic", "3.4"],
					["Anaerobic", "0.0"],
					["Exercise Load", "103"],
				],
			],
			[
				"Power",
				[
					["Avg Power", "153 W"],
					["Max Power", "398 W"],
					["Max Avg Power (20 min.)", "182 W"],
					["L/R Balance", "49% L / 51% R"],
					["Normalized Power (NP)", "167 W"],
					["Intensity Factor (IF)", "0.609"],
					["Training Stress Score (TSS)", "35.1"],
					["FTP Setting", "274 W"],
					["Work", "526 kJ"],
				],
			],
			[
				"Nutrition & Hydration",
				[
					["Resting Calories", "79"],
					["Active Calories", "526"],
					["Total Calories Burned", "605"],
					["Est. Sweat Loss", "878 ml"],
				],
			],
			[
				"Cadence",
				[
					["Avg Bike Cadence", "81 rpm"],
					["Max Bike Cadence", "103 rpm"],
				],
			],
			[
				"Elevation",
				[
					["Total Ascent", "196 m"],
					["Total Descent", "180 m"],
					["Min Elevation", "-11 m"],
					["Max Elevation", "10 m"],
				],
			],
			[
				"Cycling Dynamics - Time in Position",
				[
					["Total Seated Time", "56:45 • 99%"],
					["Total Standing Time", "0:36 • 1%"],
				],
			],
			[
				"Cycling Dynamics - Power in Position",
				[
					["Avg Seated Power", "154 W"],
					["Max Seated Power", "398 W"],
					["Avg Standing Power", "99 W"],
					["Max Standing Power", "329 W"],
				],
			],
			[
				"Cycling Dynamics - PP",
				[
					["L Power Phase", "11° - 218°"],
					["R Power Phase", "15° - 217°"],
					["L Power Phase Arc Length", "207°"],
					["R Power Phase Arc Length", "201°"],
					["L Peak Power Phase", "68° - 118°"],
					["R Peak Power Phase", "69° - 118°"],
					["L Peak Power Phase Arc Length", "51°"],
					["R Peak Power Phase Arc Length", "49°"],
				],
			],
			[
				"Cycling Dynamics - Avg PCO",
				[
					["L PCO", "0 mm"],
					["R PCO", "-9 mm"],
				],
			],
			["Pedal Strokes", [["Total Pedal Strokes", "4,427"]]],
			[
				"Intensity Minutes",
				[
					["Moderate", "6 min"],
					["Vigorous", "50 min"],
					["Total", "106 min"],
				],
			],
			["Body Battery", [["Net Impact", "-15"]]],
		]);
	});

	it("splits Primary Benefit over two lines and puts x2 on Vigorous", () => {
		const rows = sections.flatMap((s) => s.rows);
		assert.equal(rows.find((r) => r.label === "Primary Benefit")?.sub, "(High Aerobic)");
		assert.equal(rows.find((r) => r.label === "Vigorous")?.badge, "x2");
	});

	it("has HELP on its seven headings", () => {
		assert.deepEqual(
			sections.filter((s) => s.help).map((s) => s.id),
			["heart-rate", "stamina", "training-effect", "nutrition", "cd-time-in-position", "cd-pp", "cd-avg-pco"],
		);
	});

	it("puts its fourteen chart badges where the phone does, each on a chart the ride opens", () => {
		assert.deepEqual(
			sections.flatMap((s) => s.rows.filter((r) => r.chart).map((r) => [r.label, r.chart])),
			[
				["Avg Speed", "speed"],
				["Avg Heart Rate", "heart-rate"],
				["Beginning Potential", "stamina"],
				["Aerobic", "training-effect"],
				["Anaerobic", "training-effect"],
				["Avg Power", "power"],
				["L/R Balance", "lr-balance"],
				["Avg Bike Cadence", "bike-cadence"],
				["Total Ascent", "elevation"],
				["Total Seated Time", "position"],
				["L Power Phase", "pp-start"],
				["L Peak Power Phase", "peak-pp-start"],
				["L PCO", "left-pco"],
				["R PCO", "right-pco"],
			],
		);
		const bases = new Set([...CYCLING.charts!.chips, "training-effect"]);
		for (const row of sections.flatMap((s) => s.rows)) if (row.chart) assert.ok(bases.has(row.chart), row.chart);
	});

	it("reads speeds in mph and heights in feet in imperial", () => {
		const imperial = statsView(RIDE, "imperial", CYCLING.stats);
		assert.deepEqual(
			imperial.find((s) => s.id === "speed")?.rows.map((r) => r.text),
			["17.9 mph", "18.1 mph", "27.1 mph"],
		);
		assert.equal(imperial.find((s) => s.id === "elevation")?.rows[0]?.text, "643 ft");
	});

	it("drops the power and cycling dynamics sections for a ride without power (Inferred)", () => {
		const bare = statsView(without(RIDE, POWER_KEYS), "metric", CYCLING.stats).map((s) => s.id);
		assert.deepEqual(bare, ["speed", "timing", "heart-rate", "stamina", "training-effect", "nutrition", "cadence", "elevation", "intensity-minutes", "body-battery"]);
	});

	it("gives Total Seated Time its badge only with the ride's position events", () => {
		const noEvents = { ...RIDE, positions: undefined };
		const row = statsView(noEvents, "metric", CYCLING.stats)
			.flatMap((s) => s.rows)
			.find((r) => r.label === "Total Seated Time");
		assert.equal(row?.text, "56:45 • 99%");
		assert.equal(row?.chart, undefined);
	});
});

describe("ride Laps (golden)", () => {
	it("is Lap · Time · Distance · Avg Speed, the six laps and the bold Total", () => {
		const view = lapsView(RIDE, "metric", CYCLING.laps);
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.unit ?? "", c.width]),
			[
				["Lap", "", 12.25],
				["Time", "", 26.12],
				["Distance", "km", 28.61],
				["Avg Speed", "km/h", 29.03],
			],
		);
		assert.deepEqual(
			view.rows.map((r) => [r.kind ?? "", ...r.cells]),
			[
				["", "1", "10:33.3", "5.00", "28.4"],
				["", "2", "9:08.7", "5.00", "32.8"],
				["", "3", "11:25.3", "5.00", "26.3"],
				["", "4", "9:59.7", "5.00", "30.0"],
				["", "5", "10:19.9", "5.00", "29.0"],
				["", "6", "5:54.4", "2.51", "25.5"],
				["total", "Total", "57:21.3", "27.51", "28.8"],
			],
		);
	});

	it("reads miles and mph in imperial", () => {
		const view = lapsView(RIDE, "imperial", CYCLING.laps);
		assert.deepEqual(
			view.columns.slice(2).map((c) => c.unit),
			["mi", "mph"],
		);
		assert.deepEqual(view.rows.at(-1)?.cells, ["Total", "57:21.3", "17.10", "17.9"]);
	});
});

describe("ride map", () => {
	it("offers None, Speed, Heart Rate, Power and Elevation, and opens on Power", () => {
		assert.deepEqual(mapOverlays(RIDE, RIDE_MAP), ["none", "speed", "heart-rate", "power", "elevation"]);
		assert.equal(overviewOverlay(RIDE_MAP), "power");
		assert.equal(overlayFor(RIDE, "power", RIDE_MAP), "power");
		assert.equal(overlayFor(RIDE, "pace", RIDE_MAP), "none");
		assert.equal(overlayLabel("speed", RIDE_MAP), "Speed");
	});

	it("words the Power legend Less Power … More Power over the seven zone colours", () => {
		assert.deepEqual(mapLegend("power", RIDE_MAP), { kind: "ramp", low: "Less Power", high: "More Power", colors: POWER_RAMP });
		assert.deepEqual(POWER_RAMP, ["#c3c3c3", "#3b97f3", "#82c91e", "#faca48", "#f98925", "#d32020", "#5a30d7"]);
		assert.equal(rampOf("power", RIDE_MAP), POWER_RAMP);
		assert.equal(mapLegend("none", RIDE_MAP), null);
	});

	it("colours each sample by its power zone, the ride's own floors 0/151/205/246/287/329/413", () => {
		const bucket = overlayBucket(RIDE, "power", RIDE_MAP);
		const at = (clock: number) => bucket(RIDE.samples.clock!.indexOf(clock));
		// 0 W, 151 W, 228 W, 276 W, 292 W, 334 W and 398 W: zones 1 to 6; the pause's sample has none.
		assert.deepEqual(
			[0, 1560, 430, 68, 1522, 3066, 3317].map(at),
			[0, 1, 2, 3, 4, 5, 5],
		);
		assert.equal(at(1895), null);
		// 150 W is still zone 1, 412 W zone 6, 413 W zone 7.
		const edges = { ...RIDE, samples: { ...RIDE.samples, power: [150, 412, 413] } };
		assert.deepEqual(
			[0, 1, 2].map(overlayBucket(edges, "power", RIDE_MAP)),
			[0, 5, 6],
		);
	});

	it("draws the route in runs of one zone, joined end to end", () => {
		const runs = routeRuns(RIDE, "power", RIDE_MAP);
		assert.ok(runs.length > 10);
		for (let i = 1; i < runs.length; i += 1) assert.deepEqual(runs[i]!.points[0], runs[i - 1]!.points.at(-1));
		assert.ok(runs.every((r) => r.bucket === null || (r.bucket >= 0 && r.bucket < POWER_RAMP.length)));
	});

	it("bins Speed as the run's value overlays, slow to fast over ten slots", () => {
		const bucket = overlayBucket(RIDE, "speed", RIDE_MAP);
		const at = (clock: number) => bucket(RIDE.samples.clock!.indexOf(clock));
		// Best 12.111 m/s is the fast end; the slow end (3.879) as far below the average (7.995) as the best is above it.
		assert.equal(at(435), 9);
		assert.equal(at(1012), 5);
		// A standstill, and anything slower than the slow end, takes its colour, as on the run's value overlays.
		assert.equal(at(0), 0);
		assert.equal(at(1895), 0);
	});
});
