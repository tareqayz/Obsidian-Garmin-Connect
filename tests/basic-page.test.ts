import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CHART_COLOURS, chartsTabView, expandedChartView, type ChartCard, type SeriesChart, type TrainingEffectChart, type ZonesChart } from "../src/dashboard/activity-chart-pages";
import { seriesPlot, trainingEffectScales, zoneBars } from "../src/dashboard/activity-charts";
import { sportTitle } from "../src/dashboard/activity-labels";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor } from "../src/dashboard/activity-sports";
import { lapsView, statsView, type StatsSection } from "../src/dashboard/activity-stats-pages";
import { categoryRoute } from "../src/dashboard/routes";
import { BASIC } from "../src/dashboard/sports/basic";
import { PHONE } from "../src/dashboard/stat-charts";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { stairStepper, TODAY } from "./basic-fixture";

/*
 * The basic page against its spec's golden numbers and corrections
 * (ref/activity-details/basic/README.md) on Garmin's Stair Stepper
 * (`basic-fixture.ts`).
 */

const STAIRS: ActivityDetail = stairStepper();

/** A sport Garmin sends no speed or distance for at all (yoga, strength: no shot, Inferred). */
function still(): ActivityDetail {
	const { averageSpeed: _speed, distance: _distance, ...summary } = STAIRS.summary;
	return { ...STAIRS, type: "yoga", typeId: 43, parentTypeId: 29, summary, laps: STAIRS.laps.map(({ speed: _s, ...lap }) => lap) };
}

const tableOf = (sections: StatsSection[]) => sections.map((s) => [s.title, s.help, s.rows.map((r) => [r.label, r.text])]);
const cardsOf = (detail: ActivityDetail = STAIRS, axis: "time" | "distance" = "time") => chartsTabView(detail, { axis }, "metric", BASIC.charts).cards;
const find = <T extends ChartCard>(cards: ChartCard[], id: string) => cards.find((c) => c.id === id) as T;
const near = (actual: number, expected: number, within = 0.005) => assert.ok(Math.abs(actual - expected) <= within, `${actual} is not ${expected} ± ${within}`);

describe("the basic page's profile", () => {
	it("is every other sport's, titled by the type table", () => {
		assert.equal(profileFor(STAIRS), BASIC);
		assert.equal(sportTitle(STAIRS.type), "Stair Stepper");
	});
});

describe("basic Overview (golden)", () => {
	const view = overviewView(STAIRS, "metric", TODAY, BASIC.overview);

	it("has no map, the date row first, and Total Time as the big figure", () => {
		assert.deepEqual([view.map, view.routeMissing, view.weather], [false, false, null]);
		assert.equal(view.when, "Aug 28 @ 7:01 PM");
		assert.equal(view.glyph, "stairs-up");
		assert.deepEqual(view.hero, { value: "34:52", label: "Total Time" });
	});

	it("keeps Garmin's oddities: 0.0 km/h and -- m, the badge on Avg Heart Rate only", () => {
		assert.deepEqual(view.figures, [
			{ value: "0.0", unit: "km/h", label: "Avg Speed" },
			{ value: "146", unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" },
			{ value: "--", unit: "m", label: "Total Ascent" },
			{ value: "354", label: "Total Calories" },
		]);
	});

	it("shows only the benefit with no self-evaluation, the group's link and the watch", () => {
		assert.equal(view.benefit?.label, "Base (Low Aerobic)");
		assert.deepEqual([view.feel, view.effort], [null, null]);
		assert.deepEqual(view.links, [{ label: "All Gym & Fitness Equipment Activities", icon: "stairs-up", route: categoryRoute("gym") }]);
		assert.deepEqual(view.device, { name: "Forerunner 970", firmware: "17.39" });
	});

	it("drops the speed and ascent figures for a sport Garmin sends no speed for (Inferred)", () => {
		assert.deepEqual(
			overviewView(still(), "metric", TODAY, BASIC.overview).figures.map((f) => f.label),
			["Avg Heart Rate", "Total Calories"],
		);
	});
});

describe("basic Stats (golden)", () => {
	it("reads the eight sections, HELP on four, Garmin's standstill zeros included", () => {
		assert.deepEqual(tableOf(statsView(STAIRS, "metric", BASIC.stats)), [
			["Pace", true, [["Avg Pace", "0:00 /km"]]],
			["Speed", false, [["Avg Speed", "0.0 km/h"]]],
			[
				"Timing",
				false,
				[
					["Total Time", "34:52"],
					["Elapsed Time", "34:52"],
				],
			],
			[
				"Heart Rate",
				true,
				[
					["Avg Heart Rate", "146 bpm"],
					["Max Heart Rate", "162 bpm"],
				],
			],
			[
				"Training Effect",
				true,
				[
					["Primary Benefit", "Base (Low Aerobic)"],
					["Aerobic", "2.9"],
					["Anaerobic", "0.1"],
					["Exercise Load", "62"],
				],
			],
			[
				"Nutrition & Hydration",
				true,
				[
					["Resting Calories", "48"],
					["Active Calories", "306"],
					["Total Calories Burned", "354"],
					["Est. Sweat Loss", "398 ml"],
				],
			],
			[
				"Intensity Minutes",
				false,
				[
					["Moderate", "4 min"],
					["Vigorous", "30 min"],
					["Total", "64 min"],
				],
			],
			["Body Battery", false, [["Net Impact", "-7"]]],
		]);
	});

	it("has no Pace or Speed for a sport without a speed (Inferred)", () => {
		assert.deepEqual(
			statsView(still(), "metric", BASIC.stats).map((s) => s.id),
			["timing", "heart-rate", "training-effect", "nutrition", "intensity-minutes", "body-battery"],
		);
	});
});

describe("basic Laps (golden)", () => {
	it("is the one lap of 0.00 km at 0.0 km/h and its bold Total", () => {
		const view = lapsView(STAIRS, "metric", BASIC.laps);
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.unit ?? ""]),
			[
				["Lap", ""],
				["Time", ""],
				["Distance", "km"],
				["Avg Speed", "km/h"],
			],
		);
		assert.deepEqual(view.rows, [
			{ key: "1", cells: ["1", "34:52.3", "0.00", "0.0"] },
			{ key: "total", kind: "total", cells: ["Total", "34:52.3", "0.00", "0.0"] },
		]);
		// Its header stays put while a longer table scrolls, as the swims' do.
		assert.equal(BASIC.laps?.pinnedHeader, true);
	});

	it("reads Lap · Time for a sport without a distance or a speed (Inferred)", () => {
		const view = lapsView(still(), "metric", BASIC.laps);
		assert.deepEqual(
			view.columns.map((c) => [c.label, c.width]),
			[
				["Lap", 12.25],
				["Time", 26.12],
			],
		);
		assert.deepEqual(
			view.rows.map((r) => r.cells),
			[
				["1", "34:52.3"],
				["Total", "34:52.3"],
			],
		);
	});
});

describe("basic Charts (golden and the spec's corrections)", () => {
	const cards = cardsOf();

	it("has Heart Rate, Training Effect and the zones, on time only: no Distance axis without a distance", () => {
		assert.deepEqual(
			cards.map((c) => [c.id, c.help]),
			[
				["heart-rate", false],
				["training-effect", true],
				["time-in-hr-zones", true],
			],
		);
		assert.deepEqual(cardsOf(STAIRS, "distance"), []);
	});

	it("labels Heart Rate 200 150 100 by the 5.5 rule (correction 1), on 81.34–197.0 bpm and the 34:52 timer", () => {
		const hr = find<SeriesChart>(cards, "heart-rate");
		near(hr.y.bottom, 0.98 * 83);
		near(hr.y.top, 162 + 0.443 * 79);
		assert.deepEqual(
			hr.y.labels.map((l) => l.text),
			["200", "150", "100"],
		);
		assert.deepEqual(
			hr.x.ticks.map((t) => t.text),
			["0:00", "6:58", "13:57", "20:55", "27:54", "34:52"],
		);
		assert.deepEqual(
			hr.figures.map((f) => [f.value, f.unit, f.label]),
			[
				["146", "bpm", "Average"],
				["162", "bpm", "Maximum"],
			],
		);
		assert.equal(hr.average?.value, 146);
		// 200 sits 3.6 pt over the plot's top, inside the labels' 6 pt slack.
		assert.deepEqual(
			seriesPlot(hr, PHONE, "phone").yLabels.map((l) => [l.text, l.y]),
			[
				["200", 21.64],
				["150", 80.87],
				["100", 140.1],
			],
		);
		const zonesLine = find<SeriesChart>(chartsTabView(STAIRS, { axis: "time", picks: { heart: "zones" } }, "metric", BASIC.charts).cards, "heart-rate");
		assert.deepEqual(
			zonesLine.y.labels.map((l) => l.text),
			["200", "150", "100"],
		);
	});

	it("reads Training Effect 2.9 and 0.1: the blue knob in the 2–3 segment, the grey at the left end", () => {
		const te = find<TrainingEffectChart>(cards, "training-effect");
		assert.deepEqual(
			te.scales.map((s) => [s.label, s.value, s.colour]),
			[
				["Aerobic", 2.9, "blue"],
				["Anaerobic", 0.1, "grey"],
			],
		);
		assert.deepEqual(
			trainingEffectScales(te, PHONE).map((s) => s.knob.x),
			[230.6, 23.4],
		);
	});

	it("shares the zones out of the activity's time, Garmin's white Zone 1 in the theme's text (correction 2)", () => {
		const zones = find<ZonesChart>(cards, "time-in-hr-zones");
		assert.deepEqual(
			zones.rows.map((r) => [r.title, r.range, r.name, r.time, r.percent, r.colour]),
			[
				["Zone 5", "> 184 bpm", "Maximum", "0:00", "0%", "zone-5"],
				["Zone 4", "165 - 184 bpm", "Threshold", "0:00", "0%", "zone-4"],
				["Zone 3", "144 - 164 bpm", "Aerobic", "28:03", "80%", "zone-3"],
				["Zone 2", "124 - 143 bpm", "Easy", "2:09", "6%", "zone-2"],
				["Zone 1", "103 - 123 bpm", "Warm Up", "4:08", "11%", "text"],
			],
		);
		assert.deepEqual(
			zoneBars(zones, PHONE).map((b) => [b.fill?.width ?? 0, CHART_COLOURS[b.colour]]),
			[
				[0, "#e02c2c"],
				[0, "#ea670e"],
				[218.66, "#0b963f"],
				[16.4, "#1976d2"],
				[30.07, "var(--text-normal)"],
			],
		);
	});

	it("opens the landscape Heart Rate with its zones as the one chip", () => {
		const view = expandedChartView(STAIRS, { axis: "time", sub: "chart:heart-rate" }, "metric", BASIC.charts)!;
		assert.deepEqual(
			view.chips.map((c) => c.label),
			["Heart Rate Zones"],
		);
		assert.deepEqual(
			(view.primary as SeriesChart).y.labels.map((l) => l.text),
			["200", "150", "100"],
		);
	});
});
