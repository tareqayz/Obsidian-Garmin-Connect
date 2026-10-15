import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Units } from "../src/dashboard/activities";
import {
	CHART_COLOURS,
	chartsTabView,
	expandedChartView,
	type ChartCard,
	type SeriesChart,
	type TrainingEffectChart,
	type ZonesChart,
} from "../src/dashboard/activity-chart-pages";
import { seriesPlot, trainingEffectScales, zoneBars } from "../src/dashboard/activity-charts";
import { sportTitle } from "../src/dashboard/activity-labels";
import { mapOverlays } from "../src/dashboard/activity-map";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor } from "../src/dashboard/activity-sports";
import { lapsView, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { categoryRoute } from "../src/dashboard/routes";
import { duration } from "../src/dashboard/series";
import { RUNNING } from "../src/dashboard/sports/running";
import { POOL_SWIM } from "../src/dashboard/sports/swimming";
import { PHONE } from "../src/dashboard/stat-charts";
import { placedLengths, poolPlaces } from "../src/dashboard/swim-metrics";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { poolSwim, TODAY } from "./swim-fixture";

/*
 * The pool swim's page against its spec's golden numbers
 * (ref/activity-details/pool-swim/README.md, "Golden numbers"): activity
 * 24362982767, 1,100 m in a 25 m pool, 28 laps of which 14 are rests, 58
 * lengths of which 44 were swum. Every value below is on the phone's shots
 * (intervals 12–18 on the web's) or is the spec's rule for it.
 */

const POOL = poolSwim();
/** A pane's card: three columns of 370 in the 1190 layout. */
const PANE = 370;

const tableOf = (sections: StatsSection[]) => sections.map((s) => [s.title, s.help, s.rows.map((r) => [r.label, r.text])]);
const cardsOf = (axis: "time" | "distance", detail: ActivityDetail = POOL, units: Units = "metric") => chartsTabView(detail, { axis }, units, POOL_SWIM.charts).cards;
const find = <T extends ChartCard>(cards: ChartCard[], id: string) => cards.find((c) => c.id === id) as T;
const near = (actual: number, expected: number, within = 0.005) => assert.ok(Math.abs(actual - expected) <= within, `${actual} is not ${expected} ± ${within}`);
const yLabels = (chart: SeriesChart) => chart.y.labels.map((l) => l.text);
const xLabels = (chart: SeriesChart) => chart.x.ticks.map((t) => t.text);
const figures = (card: ChartCard) => card.figures.map((f) => [f.value, f.unit ?? "", f.label]);

/** The 44 lengths swum, in order (README, "Per-length bars"). */
const PACES = "2:25 1:42 1:44 1:37 1:48 1:52 1:23 1:45 1:48 1:09 1:38 1:40 1:48 1:48 1:50 1:46 2:10 1:50 1:52 1:24 1:58 1:49 1:43 2:44 1:36 1:09 1:37 1:44 1:45 1:59 1:58 2:00 1:56 1:52 1:40 1:22 1:43 1:51 1:50 2:04 1:39 1:49 1:52 1:30";
const STROKES = "12 12 11 10 10 11 9 12 11 7 11 10 12 10 11 10 12 11 11 8 11 11 11 11 12 7 11 11 12 12 12 12 11 10 11 8 11 11 11 11 11 11 11 9";
const SWOLF = "48 37 37 34 37 39 30 38 38 24 36 35 39 37 39 37 44 39 39 29 40 38 37 52 36 24 35 37 38 42 41 42 40 38 36 29 37 39 39 42 36 38 39 32";
/** Lengths swum in each of the 14 swum laps: the bars' runs between rests on the Time axis. */
const RUNS = [1, 3, 3, 3, 2, 4, 4, 4, 2, 2, 6, 2, 4, 4];

/** Runs of bars that touch: a gap starts a new one. */
function runsOf(blocks: NonNullable<SeriesChart["blocks"]>): number[] {
	const runs: number[] = [];
	blocks.forEach((b, i) => {
		if (i > 0 && Math.abs(blocks[i - 1]!.to - b.from) < 1e-9) runs[runs.length - 1]! += 1;
		else runs.push(1);
	});
	return runs;
}

describe("the pool swim's profile", () => {
	it("is the pool's, titled by the type table", () => {
		assert.equal(profileFor(POOL), POOL_SWIM);
		assert.equal(sportTitle(POOL.type), "Pool Swimming");
	});
});

describe("pool Overview (golden)", () => {
	const view = overviewView(POOL, "metric", TODAY, POOL_SWIM.overview);

	it("has no map, no note in its place and no weather: the date row comes first", () => {
		assert.equal(view.map, false);
		assert.equal(view.routeMissing, false);
		assert.equal(view.weather, null);
		assert.deepEqual(mapOverlays(POOL, POOL_SWIM.map), ["none"]);
		// Not even while the samples are on their way: Garmin says there is no route.
		const loading = { ...POOL, samples: {}, checked: POOL.checked.filter((b) => b !== "samples") };
		assert.equal(overviewView(loading, "metric", TODAY, POOL_SWIM.overview).routeMissing, false);
	});

	it("reads Sep 14 @ 11:50 PM, the name, and 1,100 m as the big figure", () => {
		assert.equal(view.when, "Sep 14 @ 11:50 PM");
		assert.equal(view.glyph, "swimming");
		assert.equal(view.private, true);
		assert.equal(view.title, "Pool Swim");
		assert.deepEqual(view.hero, { value: "1,100", unit: "m", label: "Distance" });
		assert.equal(view.distance, undefined);
	});

	it("has Total Time, Avg Pace per 100 m and Avg Heart Rate with their badges, and Total Calories, in the swims' order", () => {
		assert.deepEqual(view.figures, [
			{ value: "31:40", label: "Total Time" },
			{ value: "1:46", unit: "/100m", label: "Avg Pace", chart: "swim-pace" },
			{ value: "139", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" },
			{ value: "306", label: "Total Calories" },
		]);
	});

	it("evaluates Recovery (Low Aerobic), Normal, Hard 5/10", () => {
		assert.equal(view.benefit?.label, "Recovery (Low Aerobic)");
		assert.equal(view.feel, "Normal");
		assert.deepEqual(view.effort, { value: 5, score: "5/10", label: "Hard" });
	});

	it("links Swimming Personal Records and All Swimming Activities, and names the watch", () => {
		assert.deepEqual(view.links, [
			{ label: "Swimming Personal Records", icon: "medal", route: { page: "records", tab: "swimming" } },
			{ label: "All Swimming Activities", icon: "swimming", route: categoryRoute("swimming") },
		]);
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "18.29" });
		assert.equal(view.badges, undefined);
	});
});

describe("pool Stats (golden)", () => {
	const sections = statsView(POOL, "metric", POOL_SWIM.stats);

	it("reads every section in the phone's order: Strokes first, Calories rather than Nutrition, the tab ending at Intensity Minutes", () => {
		assert.deepEqual(tableOf(sections), [
			[
				"Strokes",
				false,
				[
					["Total Strokes", "470"],
					["Avg Stroke Rate", "24 spm"],
					["Avg Strokes", "10.7 /length"],
				],
			],
			[
				"Pace",
				true,
				[
					["Avg Pace", "1:46 /100m"],
					["Best Pace", "1:09 /100m"],
				],
			],
			[
				"Speed",
				false,
				[
					["Avg Speed", "3.4 km/h"],
					["Max Speed", "5.2 km/h"],
				],
			],
			[
				"Timing",
				false,
				[
					["Total Time", "31:40"],
					["Moving Time", "19:32"],
					["Elapsed Time", "31:48"],
				],
			],
			[
				"Heart Rate",
				true,
				[
					["Avg Heart Rate", "139 bpm"],
					["Max Heart Rate", "167 bpm"],
				],
			],
			[
				"Training Effect",
				true,
				[
					["Primary Benefit", "Recovery (Low Aerobic)"],
					["Aerobic", "2.4"],
					["Anaerobic", "1.5"],
					["Exercise Load", "62"],
				],
			],
			["Swimming Dynamics", false, [["Avg Swolf", "37"]]],
			[
				"Calories",
				false,
				[
					["Resting Calories", "44"],
					["Active Calories", "262"],
					["Total Calories", "306"],
				],
			],
			[
				"Intensity Minutes",
				false,
				[
					["Moderate", "7 min"],
					["Vigorous", "24 min"],
					["Total", "55 min"],
				],
			],
		]);
	});

	it("puts the badges on Total Strokes, Avg Pace, Avg Heart Rate, the two scores and Avg Swolf", () => {
		assert.deepEqual(
			sections.flatMap((s) => s.rows.filter((r) => r.chart).map((r) => [r.label, r.chart])),
			[
				["Total Strokes", "strokes"],
				["Avg Pace", "swim-pace"],
				["Avg Heart Rate", "heart-rate"],
				["Aerobic", "training-effect"],
				["Anaerobic", "training-effect"],
				["Avg Swolf", "swolf"],
			],
		);
		const benefit = sections.find((s) => s.id === "training-effect")!.rows[0]!;
		assert.deepEqual([benefit.value, benefit.sub], ["Recovery", "(Low Aerobic)"]);
		assert.equal(sections.flatMap((s) => s.rows).find((r) => r.label === "Vigorous")?.badge, "x2");
	});

	it("shows Max Stroke Rate, Avg Distance per Stroke and Nutrition & Hydration only with Garmin's values", () => {
		const more = { ...POOL, summary: { ...POOL.summary, maxSwimCadence: 31, averageStrokeDistance: 2.1, waterEstimated: 250, differenceBodyBattery: -4 } };
		const view = statsView(more, "metric", POOL_SWIM.stats);
		assert.deepEqual(
			view.find((s) => s.id === "strokes")!.rows.map((r) => r.text),
			["470", "24 spm", "31 spm", "10.7 /length", "2.10 m"],
		);
		const energy = view.find((s) => s.id === "nutrition")!;
		assert.equal(energy.title, "Nutrition & Hydration");
		assert.equal(energy.help, true);
		assert.equal(view.find((s) => s.id === "calories"), undefined);
		assert.deepEqual(view.at(-1)!.rows.map((r) => r.text), ["-4"]);
	});
});

describe("pool Laps: the interval table (golden)", () => {
	const view = lapsView(POOL, "metric", POOL_SWIM.laps);

	it("is Int · Time · Distance (m) · Avg Pace (min/100m), the run's widths", () => {
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.unit ?? "", c.width]),
			[
				["Int", "", 12.25],
				["Time", "", 26.12],
				["Distance", "m", 28.61],
				["Avg Pace", "min/100m", 29.03],
			],
		);
	});

	it("numbers all 28 laps, rests reading 0 and 0:00, and ends with the bold Total at the moving pace", () => {
		assert.deepEqual(
			view.rows.map((r) => [...r.cells, r.kind ?? ""]),
			[
				["1", "0:36.2", "25", "2:25", ""],
				["2", "0:23.8", "0", "0:00", "rest"],
				["3", "1:15.5", "75", "1:41", ""],
				["4", "0:33.0", "0", "0:00", "rest"],
				["5", "1:15.7", "75", "1:41", ""],
				["6", "0:43.9", "0", "0:00", "rest"],
				["7", "1:10.4", "75", "1:34", ""],
				["8", "1:13.8", "0", "0:00", "rest"],
				["9", "0:49.6", "50", "1:39", ""],
				["10", "0:55.4", "0", "0:00", "rest"],
				["11", "1:47.9", "100", "1:48", ""],
				["12", "0:47.4", "0", "0:00", "rest"],
				["13", "1:48.9", "100", "1:49", ""],
				["14", "1:50.3", "0", "0:00", "rest"],
				["15", "2:03.4", "100", "2:03", ""],
				["16", "0:39.6", "0", "0:00", "rest"],
				["17", "0:41.3", "50", "1:23", ""],
				["18", "0:50.1", "0", "0:00", "rest"],
				["19", "0:50.4", "50", "1:41", ""],
				["20", "0:52.4", "0", "0:00", "rest"],
				["21", "2:52.8", "150", "1:55", ""],
				["22", "0:52.9", "0", "0:00", "rest"],
				["23", "0:45.4", "50", "1:31", ""],
				["24", "0:44.0", "0", "0:00", "rest"],
				["25", "1:51.9", "100", "1:52", ""],
				["26", "1:11.7", "0", "0:00", "rest"],
				["27", "1:42.6", "100", "1:43", ""],
				["28", "0:29.9", "0", "0:00", "rest"],
				["Total", "31:40.4", "1,100", "1:46", "total"],
			],
		);
		assert.deepEqual(
			view.rows.map((r) => r.key),
			[...Array.from({ length: 28 }, (_, i) => String(i + 1)), "total"],
		);
	});

	it("keeps its header pinned while the rows scroll, as the phone does; the run's scrolls away", () => {
		assert.equal(POOL_SWIM.laps?.pinnedHeader, true);
		assert.equal(RUNNING.laps, undefined);
	});
});

describe("pool Charts on the Time axis (golden)", () => {
	const cards = cardsOf("time");

	it("has Pace, Strokes, Heart Rate, Training Effect, Swolf and the zones, with the phone's ?", () => {
		assert.deepEqual(
			cards.map((c) => [c.id, c.title, c.help]),
			[
				["swim-pace", "Pace", true],
				["strokes", "Strokes", false],
				["heart-rate", "Heart Rate", false],
				["training-effect", "Training Effect", true],
				["swolf", "Swolf", false],
				["time-in-hr-zones", "Time in Heart Rate Zones", true],
			],
		);
	});

	it("draws Pace as a bar per length on the speed-fitted axis: 47.43 s to 5:00, the average at 1:46, Best 1:09", () => {
		const pace = find<SeriesChart>(cards, "swim-pace");
		assert.deepEqual(figures(pace), [
			["1:46", "/100m", "Average"],
			["1:09", "/100m", "Best"],
		]);
		assert.equal(pace.mark, "blocks");
		assert.equal(pace.fill, "pace");
		near(pace.y.top, 47.43);
		assert.equal(pace.y.bottom, 300);
		assert.deepEqual(yLabels(pace), ["0:50", "1:40", "2:30", "3:20", "4:10", "5:00"]);
		assert.deepEqual(xLabels(pace), ["0:00", "6:20", "12:40", "19:00", "25:20", "31:40"]);
		assert.equal(pace.x.title, "Time (h:m:s)");
		near(pace.average!.value, 106.5);
		assert.equal(pace.average!.dashed, false);
	});

	it("draws Strokes and Swolf from 0 to their most ÷ 0.7: 17.14 and 74.29", () => {
		const strokes = find<SeriesChart>(cards, "strokes");
		assert.deepEqual(figures(strokes), [["10.7", "/length", "Average"]]);
		assert.equal(strokes.fill, "swim-strokes");
		assert.deepEqual([strokes.y.bottom, Number(strokes.y.top.toFixed(2))], [0, 17.14]);
		assert.deepEqual(yLabels(strokes), ["15", "10", "5", "0"]);
		near(strokes.average!.value, 10.7);
		const swolf = find<SeriesChart>(cards, "swolf");
		assert.deepEqual(figures(swolf), [["37", "", "Average"]]);
		assert.equal(swolf.fill, "swim-swolf");
		assert.deepEqual([swolf.y.bottom, Number(swolf.y.top.toFixed(2))], [0, 74.29]);
		assert.deepEqual(yLabels(swolf), ["60", "40", "20", "0"]);
		assert.equal(swolf.average!.value, 37);
		for (const chart of [strokes, swolf]) assert.deepEqual(xLabels(chart), ["0:00", "6:20", "12:40", "19:00", "25:20", "31:40"]);
	});

	it("draws Heart Rate over the samples with its picker: 80.36 to 204.66 bpm, labelled 200 150 100", () => {
		const hr = find<SeriesChart>(cards, "heart-rate");
		assert.deepEqual(hr.picker, {
			key: "heart",
			options: [
				{ value: "heart-rate", label: "Heart Rate" },
				{ value: "zones", label: "Heart Rate Zones" },
			],
			chosen: "heart-rate",
		});
		assert.deepEqual(figures(hr), [
			["139", "bpm", "Average"],
			["167", "bpm", "Maximum"],
		]);
		near(hr.y.bottom, 0.98 * 82);
		near(hr.y.top, 167 + 0.443 * 85);
		assert.deepEqual(yLabels(hr), ["200", "150", "100"]);
		// The plugin's /details heart rate runs 0 → 1,900 s; the phone's 0:01 … 31:37 is Garmin's thinned swimDetails (spec: not reproduced by choice).
		assert.deepEqual(xLabels(hr), ["0:00", "6:20", "12:40", "19:00", "25:20", "31:40"]);
		assert.equal(hr.points.x.length, 1902);
		assert.equal(hr.average!.value, 139);
		const zones = find<SeriesChart>(chartsTabView(POOL, { axis: "time", picks: { heart: "zones" } }, "metric", POOL_SWIM.charts).cards, "heart-rate");
		assert.equal(zones.title, "Heart Rate Zones");
		assert.equal(zones.mark, "line");
		assert.deepEqual(yLabels(zones), ["200", "150", "100"]);
	});

	it("reads Training Effect 2.4 Aerobic and 1.5 Anaerobic, the knobs blue and grey", () => {
		const te = find<TrainingEffectChart>(cards, "training-effect");
		assert.deepEqual(
			te.figures.map((f) => [f.value, f.label, f.dot]),
			[
				["2.4", "Aerobic", "blue"],
				["1.5", "Anaerobic", "grey"],
			],
		);
		assert.deepEqual(
			te.scales.map((s) => [s.value, CHART_COLOURS[s.colour]]),
			[
				[2.4, "#54a9fe"],
				[1.5, "#6c6c6c"],
			],
		);
		assert.deepEqual(
			trainingEffectScales(te, PHONE).map((s) => s.knob.x),
			[193.6, 127],
		);
	});

	it("shares the zones out of the activity's time, Garmin's white Zone 1 in the theme's text", () => {
		const zones = find<ZonesChart>(cards, "time-in-hr-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent, r.colour]),
			[
				["Zone 5", "> 184 bpm", "Maximum", "0:00", "0%", "zone-5"],
				["Zone 4", "165 - 184 bpm", "Threshold", "0:24", "1%", "zone-4"],
				["Zone 3", "144 - 164 bpm", "Aerobic", "13:12", "41%", "zone-3"],
				["Zone 2", "124 - 143 bpm", "Easy", "13:02", "41%", "zone-2"],
				["Zone 1", "103 - 123 bpm", "Warm Up", "3:47", "11%", "text"],
			],
		);
		// Zone 4's 1% still draws a sliver: 2.7 pt of the phone's track.
		assert.deepEqual(
			zoneBars(zones, PHONE).map((b) => b.fill?.width ?? 0),
			[0, 2.73, 112.07, 112.07, 30.07],
		);
		assert.equal(CHART_COLOURS.text, "var(--text-normal)");
	});
});

describe("pool per-length bars (golden)", () => {
	for (const axis of ["time", "distance"] as const) {
		it(`give each of the 44 lengths swum its pace, strokes and Swolf on the ${axis} axis`, () => {
			const cards = cardsOf(axis);
			assert.equal(find<SeriesChart>(cards, "swim-pace").blocks!.map((b) => duration(b.value)).join(" "), PACES);
			assert.equal(find<SeriesChart>(cards, "strokes").blocks!.map((b) => b.value).join(" "), STROKES);
			assert.equal(find<SeriesChart>(cards, "swolf").blocks!.map((b) => b.value).join(" "), SWOLF);
		});
	}

	it("put each bar on its length's own time, a gap at every rest, the axis to the last length's end", () => {
		const pace = find<SeriesChart>(cardsOf("time"), "swim-pace");
		const lengths = placedLengths(POOL);
		const end = lengths.at(-1)!.to;
		// The 58 lengths add up to 1,900.42 s, the timer's 1,900.416 give or take Garmin's rounding.
		near(end, 1900.419, 1e-6);
		assert.deepEqual(runsOf(pace.blocks!), RUNS);
		const swum = lengths.filter((p) => p.length.distance > 0);
		pace.blocks!.forEach((b, i) => {
			near(b.from, swum[i]!.from / end, 1e-12);
			near(b.to, swum[i]!.to / end, 1e-12);
		});
		// Length 1 is 0–36.248 s; the rest after it runs to 59.998 s, where length 3 starts.
		near(pace.blocks![0]!.to * end, 36.248, 1e-9);
		near(pace.blocks![1]!.from * end, 59.998, 1e-9);
	});

	it("put the bars end to end on the Distance axis, 25 m each, the rests taking no room (the web's placement)", () => {
		const pace = find<SeriesChart>(cardsOf("distance"), "swim-pace");
		assert.deepEqual(runsOf(pace.blocks!), [44]);
		pace.blocks!.forEach((b, i) => {
			near(b.from, (25 * i) / 1100, 1e-12);
			near(b.to, (25 * (i + 1)) / 1100, 1e-12);
		});
		assert.deepEqual(xLabels(pace), ["0", "220", "440", "660", "880", "1100"]);
		assert.equal(pace.x.title, "Distance (m)");
		// The slow length (2:44) at 575–600 m, where the phone draws it a length late.
		near(pace.blocks![23]!.from * 1100, 575, 1e-9);
	});

	it("sit at the phone's and a pane's geometry", () => {
		const time = find<SeriesChart>(cardsOf("time"), "swim-pace");
		const phone = seriesPlot(time, PHONE, "phone");
		assert.deepEqual(phone.plot, { left: 39.83, right: 379.83, top: 25.2, bottom: 162.2 });
		assert.deepEqual(phone.blocks!.slice(0, 3), [
			{ x: 39.83, y: 78.08, width: 6.49, height: 84.12 },
			{ x: 50.56, y: 54.54, width: 4.54, height: 107.66 },
			{ x: 55.1, y: 55.62, width: 4.63, height: 106.58 },
		]);
		assert.deepEqual(phone.average, { y: 57.24, dashed: false });
		assert.deepEqual(
			phone.yLabels.map((l) => [l.text, l.y]),
			[
				["0:50", 26.59],
				["1:40", 53.71],
				["2:30", 80.84],
				["3:20", 107.96],
				["4:10", 135.08],
				["5:00", 162.2],
			],
		);
		const pane = seriesPlot(time, PANE, "pane");
		assert.deepEqual(pane.plot, { left: 46.83, right: 345, top: 25.2, bottom: 162.2 });
		assert.deepEqual(pane.blocks![0], { x: 46.83, y: 78.08, width: 5.69, height: 84.12 });

		const distance = find<SeriesChart>(cardsOf("distance"), "swim-pace");
		const bars = seriesPlot(distance, PHONE, "phone").blocks!;
		assert.deepEqual(bars.slice(0, 3), [
			{ x: 39.83, y: 134.55, width: 7.73, height: 27.65 },
			{ x: 47.56, y: 82.15, width: 7.73, height: 80.05 },
			{ x: 55.28, y: 84.57, width: 7.73, height: 77.63 },
		]);
		// End to end across the plot.
		near(bars.at(-1)!.x + bars.at(-1)!.width, 379.83, 0.011);
		assert.deepEqual(seriesPlot(distance, PANE, "pane").blocks![0], { x: 46.83, y: 134.55, width: 6.78, height: 27.65 });

		const strokes = seriesPlot(find<SeriesChart>(cardsOf("time"), "strokes"), PHONE, "phone");
		// 12 strokes on 0–17.14: 96 pt of the 137.
		assert.deepEqual(strokes.blocks![0], { x: 39.83, y: 66.3, width: 6.49, height: 95.9 });
	});

	it("draw each run of touching bars as one outline, so no hairline shows between them", () => {
		const time = seriesPlot(find<SeriesChart>(cardsOf("time"), "swim-pace"), PHONE, "phone");
		// The 14 swims between the rests; length 1 alone.
		assert.equal(time.blockRuns!.length, 14);
		assert.equal(time.blockRuns![0], "M39.83 162.2 V78.08 H46.32 V162.2 Z");
		assert.ok(time.blockRuns![1]!.startsWith("M50.56 162.2 V54.54 H55.1 V55.62 H59.73 V"), time.blockRuns![1]);
		// On the Distance axis the rests take no room: one outline across the plot.
		const distance = seriesPlot(find<SeriesChart>(cardsOf("distance"), "swim-pace"), PHONE, "phone");
		assert.equal(distance.blockRuns!.length, 1);
		assert.ok(distance.blockRuns![0]!.endsWith("H379.83 V162.2 Z"), distance.blockRuns![0]);
	});
});

describe("pool Charts on the Distance axis (golden)", () => {
	const cards = cardsOf("distance");

	it("has every card, on equal fifths of the 1,100 m", () => {
		assert.deepEqual(
			cards.map((c) => c.id),
			["swim-pace", "strokes", "heart-rate", "training-effect", "swolf", "time-in-hr-zones"],
		);
		for (const card of cards) if (card.kind === "series") assert.deepEqual(xLabels(card), ["0", "220", "440", "660", "880", "1100"], card.id);
	});

	it("fits Pace without the rests: 54.34 to 167.83 s, labelled 0:50 1:40 2:30", () => {
		const pace = find<SeriesChart>(cards, "swim-pace");
		near(pace.y.top, 54.34);
		near(pace.y.bottom, 167.83);
		assert.deepEqual(yLabels(pace), ["0:50", "1:40", "2:30"]);
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "strokes")), ["15", "10", "5", "0"]);
		assert.deepEqual(yLabels(find<SeriesChart>(cards, "swolf")), ["60", "40", "20", "0"]);
	});

	it("draws the heart rate one point a length, at the second that length ended: 58 points, a rest dropping straight down", () => {
		const hr = find<SeriesChart>(cards, "heart-rate");
		const points = hr.points.x.map((x, i) => [Math.round(x * 1100), hr.points.y[i]]);
		assert.equal(points.length, 58);
		assert.deepEqual(points.slice(0, 6), [
			[25, 92],
			[25, 113],
			[50, 127],
			[75, 127],
			[100, 128],
			[100, 107],
		]);
		assert.deepEqual(points.slice(-2), [
			[1100, 158],
			[1100, 146],
		]);
		const values = hr.points.y.filter((v): v is number => v !== null);
		assert.deepEqual([Math.min(...values), Math.max(...values)], [92, 166]);
		// Bounded by those points, 92–166, not the swim's 82–167.
		near(hr.y.bottom, 90.16);
		near(hr.y.top, 198.78);
		assert.deepEqual(yLabels(hr), ["200", "180", "160", "140", "120", "100"]);
		assert.deepEqual(figures(hr), [
			["139", "bpm", "Average"],
			["167", "bpm", "Maximum"],
		]);
	});

	it("places the closing sample of each length at the metres swum by then, and the time axis at the lengths' end", () => {
		const distance = poolPlaces(POOL, "distance")!;
		assert.equal(distance.end, 1100);
		assert.equal(distance.at.filter((v) => v !== null).length, 58);
		// Length 1 ends at 36.248 s: the sample at 36 s (index 37, after the two at 0) sits at 25 m.
		assert.equal(distance.at[37], 25);
		assert.equal(POOL.samples.time![37], 36);
		const time = poolPlaces(POOL, "time")!;
		near(time.end, 1900.419, 1e-6);
		assert.equal(time.at, POOL.samples.time);
	});
});

describe("pool landscape charts", () => {
	it("open Pace with the swim's chips, alphabetical", () => {
		const view = expandedChartView(POOL, { axis: "time", sub: "chart:swim-pace" }, "metric", POOL_SWIM.charts)!;
		assert.equal(view.title, "Pace");
		assert.equal((view.primary as SeriesChart).mark, "blocks");
		assert.deepEqual(
			view.chips.map((c) => [c.label, c.sub]),
			[
				["Heart Rate", "chart:swim-pace:heart-rate"],
				["Heart Rate Zones", "chart:swim-pace:heart-rate-zones"],
				["Strokes", "chart:swim-pace:strokes"],
				["Swolf", "chart:swim-pace:swolf"],
			],
		);
	});

	it("overlay the bars as steps on their own axis, a pace with its top label only", () => {
		const strokes = expandedChartView(POOL, { axis: "time", sub: "chart:heart-rate:strokes" }, "metric", POOL_SWIM.charts)!;
		assert.equal(strokes.title, "Heart Rate & Strokes");
		assert.equal(strokes.secondary?.mark, "steps");
		assert.equal(strokes.secondary?.points.x.length, 88);
		assert.equal(strokes.secondary?.colour, "orange");
		const pace = expandedChartView(POOL, { axis: "distance", sub: "chart:heart-rate:swim-pace" }, "metric", POOL_SWIM.charts)!;
		assert.deepEqual(
			pace.secondary?.y.labels.map((l) => l.text),
			["0:54"],
		);
		assert.equal(pace.x?.title, "Distance (m)");
	});

	it("open from the Stats and Overview badges", () => {
		for (const id of ["swim-pace", "strokes", "swolf", "heart-rate", "training-effect"]) {
			assert.ok(expandedChartView(POOL, { axis: "time", sub: `chart:${id}` }, "metric", POOL_SWIM.charts), id);
		}
		assert.equal(expandedChartView(POOL, { axis: "time", sub: "chart:pace" }, "metric", POOL_SWIM.charts), null);
	});
});

describe("pool lengths", () => {
	it("are the laps' 58 lengths end to end, 44 swum, their strokes the summary's 470", () => {
		const lengths = placedLengths(POOL);
		assert.equal(lengths.length, 58);
		assert.equal(lengths.filter((p) => p.length.distance > 0).length, 44);
		assert.equal(
			find<SeriesChart>(cardsOf("time"), "strokes").blocks!.reduce((sum, b) => sum + b.value, 0),
			470,
		);
		near(lengths.at(-1)!.toMetres, 1100, 1e-9);
	});

	it("give the figures when the summary has none: 470 strokes over 44 lengths reads 10.7, the lengths' Swolf 37", () => {
		const { averageStrokes: _a, averageSWOLF: _b, ...summary } = POOL.summary;
		const cards = cardsOf("time", { ...POOL, summary });
		assert.deepEqual(figures(find(cards, "strokes")), [["10.7", "/length", "Average"]]);
		assert.deepEqual(figures(find(cards, "swolf")), [["37", "", "Average"]]);
	});
});

describe("pool edge states", () => {
	it("draws a drill length's pace but no strokes or Swolf (Inferred)", () => {
		const drill = {
			...POOL,
			laps: POOL.laps.map((lap) => (lap.n === 1 ? { ...lap, lengths: lap.lengths!.map(({ strokes: _s, swolf: _w, ...length }) => ({ ...length, stroke: "DRILL" })) } : lap)),
		};
		const cards = cardsOf("time", drill);
		assert.equal(find<SeriesChart>(cards, "swim-pace").blocks!.length, 44);
		assert.equal(find<SeriesChart>(cards, "strokes").blocks!.length, 43);
		assert.equal(find<SeriesChart>(cards, "swolf").blocks!.length, 43);
	});

	it("has no gaps without rests, and fits Pace on both axes alike", () => {
		const swum = { ...POOL, laps: POOL.laps.filter((lap) => !lap.rest) };
		const time = find<SeriesChart>(cardsOf("time", swum), "swim-pace");
		assert.deepEqual(runsOf(time.blocks!), [44]);
		near(time.y.top, 54.34);
		near(time.y.bottom, 167.83);
	});

	it("draws the bars, Training Effect and the zones before the samples arrive; Heart Rate waits", () => {
		const loading = { ...POOL, samples: {}, checked: POOL.checked.filter((b) => b !== "samples") };
		for (const axis of ["time", "distance"] as const) {
			assert.deepEqual(
				cardsOf(axis, loading).map((c) => c.id),
				["swim-pace", "strokes", "training-effect", "swolf", "time-in-hr-zones"],
			);
		}
		assert.deepEqual(xLabels(find<SeriesChart>(cardsOf("time", loading), "swim-pace")), ["0:00", "6:20", "12:40", "19:00", "25:20", "31:40"]);
	});

	it("leaves a swim without lengths to its samples: no bars, its heart rate on time", () => {
		const bare = { ...POOL, laps: POOL.laps.map(({ lengths: _, ...lap }) => lap) };
		assert.deepEqual(
			cardsOf("time", bare).map((c) => c.id),
			["heart-rate", "training-effect", "time-in-hr-zones"],
		);
		assert.deepEqual(cardsOf("distance", bare), []);
	});

	it("reads a yard pool in yards: per 100 yd, the axis and the table in yards (Inferred)", () => {
		const yards = { ...POOL, pool: { length: 25, unit: "yd" as const } };
		assert.deepEqual(overviewView(yards, "metric", TODAY, POOL_SWIM.overview).hero, { value: "1,203", unit: "yd", label: "Distance" });
		assert.deepEqual(overviewView(yards, "metric", TODAY, POOL_SWIM.overview).figures[1], { value: "1:37", unit: "/100yd", label: "Avg Pace", chart: "swim-pace" });
		const laps = lapsView(yards, "metric", POOL_SWIM.laps);
		assert.deepEqual(
			laps.columns.slice(2).map((c) => c.unit),
			["yd", "min/100yd"],
		);
		assert.deepEqual(laps.rows[0]!.cells, ["1", "0:36.2", "27", "2:13"]);
		const pace = find<SeriesChart>(cardsOf("distance", yards), "swim-pace");
		assert.deepEqual(xLabels(pace), ["0", "241", "481", "722", "962", "1203"]);
		assert.equal(pace.x.title, "Distance (yd)");
	});

	it("keeps a metre pool in metres in an imperial vault, its speeds in mph", () => {
		const view = statsView(POOL, "imperial", POOL_SWIM.stats);
		assert.deepEqual(
			view.find((s) => s.id === "pace")!.rows.map((r) => r.text),
			["1:46 /100m", "1:09 /100m"],
		);
		assert.deepEqual(
			view.find((s) => s.id === "speed")!.rows.map((r) => r.text),
			["2.1 mph", "3.3 mph"],
		);
		assert.deepEqual(overviewView(POOL, "imperial", TODAY, POOL_SWIM.overview).hero, { value: "1,100", unit: "m", label: "Distance" });
	});
});
