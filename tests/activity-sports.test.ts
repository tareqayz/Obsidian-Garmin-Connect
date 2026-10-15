import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	chartsTabView,
	expandedChartView,
	readChartSub,
	RUN_CHARTS,
	type ChartCard,
	type ChartsSpec,
	type CustomChart,
	type SeriesChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import { seriesPlot } from "../src/dashboard/activity-charts";
import {
	baseOf,
	mapLegend,
	mapOverlays,
	OVERLAY_LABELS,
	overlayFor,
	overlayLabel,
	overviewOverlay,
	rampOf,
	ROUTE_BASE,
	routeRuns,
	RUN_MAP,
	type MapSpec,
} from "../src/dashboard/activity-map";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor, sportOf, SPORT_IDS } from "../src/dashboard/activity-sports";
import { lapsView, RUN_STATS, statsView, summaryOf, heartRateRows, type StatsSpec } from "../src/dashboard/activity-stats-pages";
import { MAP_OVERLAYS } from "../src/dashboard/routes";
import { BASIC } from "../src/dashboard/sports/basic";
import { CYCLING } from "../src/dashboard/sports/cycling";
import { RUNNING } from "../src/dashboard/sports/running";
import { OPEN_WATER_SWIM, POOL_SWIM } from "../src/dashboard/sports/swimming";
import { PHONE } from "../src/dashboard/stat-charts";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { outdoorRun, TODAY, treadmillRun } from "./activity-run-fixture";

/** An index row's or a file's type, as `sportOf` reads it. */
const typed = (type: string, typeId?: number, parentTypeId?: number) => ({ type, ...(typeId === undefined ? {} : { typeId }), ...(parentTypeId === undefined ? {} : { parentTypeId }) });

describe("sportOf", () => {
	it("reads the running family as running, by Garmin's tree or, without ids, by the key", () => {
		for (const row of [typed("running", 1, 17), typed("treadmill_running", 18, 1), typed("trail_running", 6, 1), typed("track_running", 152, 1), typed("indoor_running")]) {
			assert.equal(sportOf(row), "running", row.type);
		}
	});

	it("reads rides as cycling", () => {
		assert.equal(sportOf(typed("road_biking", 10, 2)), "cycling");
		assert.equal(sportOf(typed("cycling", 2, 17)), "cycling");
		assert.equal(sportOf(typed("mountain_biking", 5, 2)), "cycling");
	});

	it("tells the two swims apart by their type", () => {
		assert.equal(sportOf(typed("lap_swimming", 27, 26)), "pool-swim");
		assert.equal(sportOf(typed("open_water_swimming", 28, 26)), "open-water-swim");
	});

	it("gives every other sport the basic page, an unknown one too", () => {
		for (const row of [typed("stair_climbing", 31, 29), typed("yoga", 43, 29), typed("strength_training", 13, 29), typed("walking", 9, 17), typed("underwater_hockey"), typed("new_sport", 999, 4)]) {
			assert.equal(sportOf(row), "basic", row.type);
		}
	});
});

describe("profileFor", () => {
	it("draws a run with the run's own code: a profile of nothing but its id", () => {
		assert.deepEqual(profileFor(outdoorRun()), { id: "running" });
		assert.equal(profileFor(treadmillRun()), RUNNING);
	});

	it("has one profile per sport, the stubs the basic page until their builders land", () => {
		assert.equal(profileFor(typed("road_biking", 10, 2)), CYCLING);
		assert.equal(profileFor(typed("lap_swimming", 27, 26)), POOL_SWIM);
		assert.equal(profileFor(typed("open_water_swimming", 28, 26)), OPEN_WATER_SWIM);
		assert.equal(profileFor(typed("stair_climbing", 31, 29)), BASIC);
		assert.deepEqual(
			SPORT_IDS.map((id) => [RUNNING, CYCLING, POOL_SWIM, OPEN_WATER_SWIM, BASIC].find((p) => p.id === id)?.id),
			["running", "cycling", "pool-swim", "open-water-swim", "basic"],
		);
		assert.equal(CYCLING.charts, BASIC.charts);
	});
});

describe("the run's defaults, spelled out", () => {
	const runs: Array<[string, ActivityDetail]> = [
		["outdoor", outdoorRun()],
		["treadmill", treadmillRun()],
	];

	it("keeps the Laps tab's column widths in the view: 12.25, 26.12, 28.61 and 29.03%", () => {
		const view = lapsView(outdoorRun(), "metric");
		assert.deepEqual(
			view.columns.map((c) => c.width),
			[12.25, 26.12, 28.61, 29.03],
		);
		assert.deepEqual(
			view.rows.map((r) => r.key),
			["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
		);
		assert.ok(view.rows.every((r) => r.kind === undefined));
	});

	it("draws the same map from RUN_MAP as from no spec at all", () => {
		for (const [name, detail] of runs) {
			assert.deepEqual(mapOverlays(detail, RUN_MAP), mapOverlays(detail), name);
			for (const overlay of MAP_OVERLAYS) {
				assert.equal(overlayFor(detail, overlay, RUN_MAP), overlayFor(detail, overlay), `${name} ${overlay}`);
				assert.deepEqual(routeRuns(detail, overlay, RUN_MAP), routeRuns(detail, overlay), `${name} ${overlay}`);
				assert.deepEqual(mapLegend(overlay, RUN_MAP), mapLegend(overlay), overlay);
				assert.deepEqual(rampOf(overlay, RUN_MAP), rampOf(overlay), overlay);
				assert.equal(overlayLabel(overlay, RUN_MAP), OVERLAY_LABELS[overlay]);
				assert.equal(overlayLabel(overlay), OVERLAY_LABELS[overlay]);
			}
		}
		assert.equal(baseOf(RUN_MAP), ROUTE_BASE);
		assert.equal(baseOf(), ROUTE_BASE);
		assert.equal(overviewOverlay(RUN_MAP), "pace");
		assert.equal(overviewOverlay(), "pace");
	});

	it("reads the same Stats from RUN_STATS as from no spec", () => {
		for (const [name, detail] of runs) assert.deepEqual(statsView(detail, "metric", RUN_STATS), statsView(detail, "metric"), name);
	});

	it("reads the same Charts from RUN_CHARTS as from no spec", () => {
		for (const [name, detail] of runs) {
			assert.deepEqual(chartsTabView(detail, { axis: "time" }, "metric", RUN_CHARTS), chartsTabView(detail, { axis: "time" }, "metric"), name);
		}
	});
});

describe("a sport's Overview spec", () => {
	it("replaces the hero, the figures and the links, and passes sensors and badges through when there are any", () => {
		const detail: ActivityDetail = {
			...outdoorRun(),
			sensors: [{ name: "Rally 100/200", firmware: "4.1", battery: "OK" }],
			badges: [{ name: "Climber 1", description: "Climb 500 feet during a cycling activity." }],
		};
		const view = overviewView(detail, "metric", TODAY, {
			hero: () => ({ value: "1,100", unit: "m", label: "Distance" }),
			figures: () => [{ value: "57:21", label: "Total Time" }],
			links: () => [],
		});
		assert.deepEqual(view.hero, { value: "1,100", unit: "m", label: "Distance" });
		assert.equal(view.distance, undefined);
		assert.deepEqual(view.figures, [{ value: "57:21", label: "Total Time" }]);
		assert.deepEqual(view.links, []);
		assert.deepEqual(view.sensors, detail.sensors);
		assert.deepEqual(view.badges, detail.badges);
		const none = overviewView({ ...outdoorRun(), sensors: [], badges: [] }, "metric", TODAY);
		assert.equal("sensors" in none, false);
		assert.equal("badges" in none, false);
	});
});

describe("a sport's Stats spec", () => {
	it("lists its sections in its order with its HELP links, leaving out the empty ones", () => {
		const spec: StatsSpec = {
			table: (detail) => [
				["empty", "Nothing", []],
				["heart-rate", "Heart Rate", heartRateRows(summaryOf(detail))],
			],
			help: ["heart-rate"],
		};
		assert.deepEqual(
			statsView(outdoorRun(), "metric", spec).map((s) => [s.id, s.title, s.help, s.rows.length]),
			[["heart-rate", "Heart Rate", true, 2]],
		);
	});
});

/*
 * A made-up sport on the outdoor run: a Temperature chart the run doesn't
 * have (its own MetricDef), a custom card, a heart-rate picker under its own
 * key, and seven power zones.
 */
const TEMPS = [30, 30.5, 31, 32, 33, 33, 33.5, 34, 34];
const SPEC: ChartsSpec = {
	cards: ["heart-rate", "temperature", "dial", "time-in-power-zones"],
	chips: ["heart-rate", "temperature"],
	pickers: {
		"heart-rate": {
			key: "hr",
			title: "Heart Rate",
			options: [
				{ value: "bpm", metric: "heart-rate" },
				{ value: "zones", metric: "heart-rate-zones" },
			],
		},
		dial: { key: "dial", title: "Dial", options: [] },
	},
	metrics: {
		temperature: {
			title: "Temperature",
			has: (detail) => (detail.samples.temp ?? []).some((v) => v !== null),
			values: (detail) => detail.samples.temp ?? [],
			mark: "line",
			accent: "orange",
			axis: { pad: 0.5 },
			figures: () => [{ value: "32", unit: "°C", label: "Average" }],
			average: { value: () => 32 },
			frame: "power",
			decorate: (chart) => {
				chart.reference = 30;
			},
		},
	},
	custom: {
		dial: (ctx, pick) => ({ title: "Dial", figures: [], plot: "dial", data: { pick, end: ctx.end, rows: ctx.extras.rows?.length ?? 0 } }),
	},
	help: ["dial", "time-in-power-zones"],
	zoneNames: { power: { 1: "Active Recovery", 2: "Endurance", 3: "Tempo", 4: "Threshold", 5: "VO₂ Max", 6: "Anaerobic", 7: "Neuromuscular" } },
};

function hotRun(): ActivityDetail {
	const run = outdoorRun();
	const zone = (n: number, seconds: number, floor: number) => ({ zone: n, floor, seconds });
	return {
		...run,
		samples: { ...run.samples, temp: TEMPS },
		powerZones: [zone(1, 600, 0), zone(2, 600, 151), zone(3, 600, 206), zone(4, 600, 246), zone(5, 300, 287), zone(6, 200, 329), zone(7, 60, 413)],
	};
}

describe("a sport's Charts spec", () => {
	const detail = hotRun();
	const cards = chartsTabView(detail, { axis: "time", picks: { hr: "zones", dial: "w-kg" } }, "metric", SPEC, { rows: [], today: TODAY }).cards;
	const find = <T extends ChartCard>(id: string) => cards.find((c) => c.id === id) as T;

	it("lists its cards in its order, each with data", () => {
		assert.deepEqual(
			cards.map((c) => c.id),
			["heart-rate", "temperature", "dial", "time-in-power-zones"],
		);
	});

	it("keeps a picker's choice under its own key", () => {
		const hr = find<SeriesChart>("heart-rate");
		assert.equal(hr.title, "Heart Rate Zones");
		assert.equal(hr.picker?.key, "hr");
		assert.equal(hr.picker?.chosen, "zones");
	});

	it("draws a chart of its own by its MetricDef: title, mark, axis, figures, average, frame and decoration", () => {
		const temp = find<SeriesChart>("temperature");
		assert.equal(temp.title, "Temperature");
		assert.equal(temp.mark, "line");
		assert.equal(temp.help, false);
		assert.deepEqual(temp.figures, [{ value: "32", unit: "°C", label: "Average" }]);
		assert.deepEqual(temp.average, { value: 32, dashed: false });
		assert.equal(temp.reference, 30);
		assert.equal(temp.frame, "power");
		// pad 0.5: 34 + 0.5 × (34 − 30) = 36; the bottom at 0.98 × 30.
		assert.equal(temp.y.top, 36);
		assert.equal(temp.y.bottom, 0.98 * 30);
		// The frame it names: Power's plot sits 5.5 pt down.
		assert.equal(seriesPlot(temp, PHONE).plot.top, 5.5);
	});

	it("hands a custom card the context, the extras and the route's choice for its picker", () => {
		const dial = find<CustomChart>("dial");
		assert.equal(dial.kind, "custom");
		assert.equal(dial.help, true);
		assert.deepEqual(dial.data, { pick: "w-kg", end: 3361, rows: 0 });
	});

	it("names seven power zones by the spec, coloured up to zone-7", () => {
		const zones = find<ZonesChart>("time-in-power-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.colour]),
			[
				["Zone 7", "> 412 Watts", "Neuromuscular", "zone-7"],
				["Zone 6", "329 - 412 Watts", "Anaerobic", "zone-6"],
				["Zone 5", "287 - 328 Watts", "VO₂ Max", "zone-5"],
				["Zone 4", "246 - 286 Watts", "Threshold", "zone-4"],
				["Zone 3", "206 - 245 Watts", "Tempo", "zone-3"],
				["Zone 2", "151 - 205 Watts", "Endurance", "zone-2"],
				["Zone 1", "0 - 150 Watts", "Active Recovery", "zone-1"],
			],
		);
		assert.equal(zones.help, true);
		const coloured = chartsTabView(detail, { axis: "time" }, "metric", { ...SPEC, zoneColours: { power: { 4: "yellow" } } }).cards;
		assert.equal((coloured.find((c) => c.id === "time-in-power-zones") as ZonesChart).rows.find((r) => r.zone === 4)?.colour, "yellow");
	});

	it("opens its own chart in landscape, overlaid in its accent, among its chips only", () => {
		const view = expandedChartView(detail, { axis: "time", sub: "chart:heart-rate:temperature" }, "metric", SPEC)!;
		assert.equal(view.title, "Heart Rate & Temperature");
		assert.equal(view.secondary?.metric, "temperature");
		assert.equal(view.secondary?.colour, "orange");
		assert.equal(view.secondary?.mark, "line");
		assert.deepEqual(
			view.chips.map((c) => c.label),
			["Temperature"],
		);
		const swapped = expandedChartView(detail, { axis: "time", sub: "chart:heart-rate:temperature:swap" }, "metric", SPEC)!;
		assert.equal(swapped.title, "Temperature & Heart Rate");
		assert.equal(expandedChartView(detail, { axis: "time", sub: "chart:cadence" }, "metric", SPEC), null);
	});

	it("reads a landscape sub against the sport's charts", () => {
		assert.deepEqual(readChartSub("chart:temperature", SPEC.chips), { base: "temperature", overlay: null, swapped: false });
		assert.equal(readChartSub("chart:temperature"), null);
		assert.deepEqual(readChartSub("chart:training-effect", SPEC.chips), { base: "training-effect", overlay: null, swapped: false });
	});

	it("can't redefine one of the run's charts", () => {
		const spec: ChartsSpec = { ...SPEC, cards: ["heart-rate"], pickers: {}, metrics: { "heart-rate": { ...SPEC.metrics!.temperature!, title: "Not Heart Rate" } } };
		const hr = chartsTabView(detail, { axis: "time" }, "metric", spec).cards[0] as SeriesChart;
		assert.equal(hr.title, "Heart Rate");
		assert.equal(hr.mark, "area");
		assert.equal(hr.frame, undefined);
	});
});

describe("a sport's map spec", () => {
	const RED = "#e02c2c";
	const SPEC: MapSpec = {
		overlays: ["none", "power", "cadence"],
		overview: "power",
		defs: {
			none: { label: "None", ramp: [], legend: null },
			power: { label: "Power", ramp: ["#111", "#222", "#333", "#444", "#555", "#666", "#777", "#888", "#999", "#aaa"], legend: { low: "Less Power", high: "More Power" } },
			cadence: { label: "Cadence", ramp: ["#c00", "#c11", "#c22", "#c33", "#c44", "#c55", "#c66", "#c77", "#c88", "#c99"], legend: { low: "Lower", high: "Higher" }, values: { column: "cadence", average: "averageRunCadence", best: "maxRunCadence", positive: true } },
		},
		base: RED,
	};

	it("offers its overlays with data, in its words and colours", () => {
		const run = outdoorRun();
		assert.deepEqual(mapOverlays(run, SPEC), ["none", "power", "cadence"]);
		assert.equal(overlayFor(run, "pace", SPEC), "none");
		assert.equal(overviewOverlay(SPEC), "power");
		assert.deepEqual(mapLegend("power", SPEC), { kind: "ramp", low: "Less Power", high: "More Power", colors: SPEC.defs.power!.ramp });
		assert.equal(mapLegend("none", SPEC), null);
		assert.equal(rampOf("cadence", SPEC), SPEC.defs.cadence!.ramp);
		assert.equal(baseOf(SPEC), RED);
		assert.equal(overlayLabel("cadence", SPEC), "Cadence");
		// Its own value overlay is binned as the run's are: some runs in colour.
		assert.ok(routeRuns(run, "cadence", SPEC).some((r) => r.bucket !== null));
		assert.ok(routeRuns(run, "cadence").every((r) => r.bucket === null));
	});

	it("draws an open-water swim's plain red route: no overlay but none", () => {
		const open: MapSpec = { overlays: ["none"], overview: "none", defs: {}, base: RED };
		assert.deepEqual(mapOverlays(outdoorRun(), open), ["none"]);
		assert.equal(overlayFor(outdoorRun(), overviewOverlay(open), open), "none");
		assert.equal(mapLegend("none", open), null);
		assert.equal(baseOf(open), RED);
	});
});
