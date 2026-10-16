import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	chartsTabView,
	expandedChartView,
	lastAt,
	RUN_CHARTS,
	timeAxis,
	type ChartsSpec,
	type MetricDef,
	type SeriesChart,
} from "../src/dashboard/activity-chart-pages";
import { routeRuns, type MapSpec } from "../src/dashboard/activity-map";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { outdoorRun } from "./activity-run-fixture";

/*
 * The chart and map engine's hooks a ride brought, on a made-up activity of
 * six samples ten seconds apart: two dot series that start and end at
 * different samples (a ride's left and right pedals), a fixed window whose
 * overlay keeps its own labels, a chip worded apart from its card, lanes on
 * an axis of their own (a ride's Position), and a map overlay binned by the
 * activity's own zones. The run's charts never use them
 * (tests/run-page-baseline.test.ts holds that).
 */

const TIME = [0, 10, 20, 30, 40, 50];

function activity(): ActivityDetail {
	return {
		version: 6,
		id: 98765432199,
		name: "Engine Test",
		type: "road_biking",
		typeId: 10,
		parentTypeId: 2,
		start: "2026-10-13T11:57:21",
		summary: { duration: 52.5, averageHR: 120, maxHR: 140 },
		samples: {
			time: TIME,
			clock: TIME,
			distance: [0, 100, 200, 300, 400, 500],
			hr: [100, 110, 120, 130, 140, 135],
			power: [0, 150, 151, 205, 412, 413],
			// Left from 10 s to 40 s, right from 20 s to 50 s: both only from 20 to 40.
			left: [null, 5, 6, null, 8, null],
			right: [null, null, 16, 17, 18, 19],
			lat: [10, 10.001, 10.002, 10.003, 10.004, 10.005],
			lon: [20, 20.001, 20.002, 20.003, 20.004, 20.005],
		},
		laps: [],
		segments: [],
		hrZones: [],
		powerZones: [
			{ zone: 1, floor: 0, seconds: 10 },
			{ zone: 2, floor: 151, seconds: 10 },
			{ zone: 3, floor: 205, seconds: 10 },
			{ zone: 4, floor: 413, seconds: 10 },
		],
		weather: null,
		gear: [],
		device: null,
		weightKg: null,
		checked: [],
	};
}

const both = (d: ActivityDetail) => d.samples.left!.map((v, i) => (v !== null && d.samples.right![i] !== null ? v : null));

const PAIR: MetricDef = {
	title: "Pair: Start",
	chip: "Pair Start",
	has: (d) => (d.samples.left ?? []).some((v) => v !== null),
	values: (d) => both(d),
	series: (d) => [
		{ values: d.samples.left!, colour: "green" },
		{ values: d.samples.right!, colour: "blue" },
	],
	trim: true,
	keepLabels: true,
	mark: "dots",
	accent: "green",
	yAxis: () => ({
		bottom: 30,
		top: 0,
		labels: [
			{ value: 0, text: "TOP 0" },
			{ value: 15, text: "15" },
			{ value: 30, text: "30" },
		],
	}),
	figures: () => [],
	decorate: (chart) => {
		chart.legend = [
			{ label: "Left", colour: "green", kind: "dot" },
			{ label: "Right", colour: "blue", kind: "dot" },
		];
	},
};

const LANES: MetricDef = {
	title: "Lanes",
	has: () => true,
	values: () => [],
	mark: "lanes",
	accent: "orange",
	figures: () => [],
	lanes: (ctx) => ({
		lanes: [
			{ id: "up", label: "Up", colour: "blue" },
			{ id: "down", label: "Down", colour: "orange" },
		],
		bars: [
			{ from: 0, to: 0.5, lane: "down" },
			{ from: 0.5, to: 1, lane: "up" },
		],
		x: timeAxis(0, Number(ctx.detail.summary.duration)),
	}),
	decorate: (chart) => {
		chart.legend = [{ label: "Down", colour: "orange", kind: "dot" }];
	},
};

const SPEC: ChartsSpec = {
	cards: ["pair", "heart-rate", "power"],
	chips: ["heart-rate", "pair", "lanes", "power"],
	pickers: {},
	metrics: { pair: PAIR, lanes: LANES },
	runOverrides: { power: { title: "Power", accent: "orange", frame: "chart" } },
};

const cards = (axis: "time" | "distance" = "time") => chartsTabView(activity(), { axis }, "metric", SPEC).cards;
const card = (id: string, axis: "time" | "distance" = "time") => cards(axis).find((c) => c.id === id) as SeriesChart;

describe("dots in two series", () => {
	it("run their time axis from the first to the last sample where both have a value", () => {
		const pair = card("pair");
		assert.deepEqual(
			pair.x.ticks.map((t) => t.text),
			["0:20", "0:24", "0:28", "0:32", "0:36", "0:40"],
		);
	});

	it("draw each series' dots on that span, in turn, each in its colour", () => {
		const pair = card("pair");
		// Left at 20 and 40 s (its 10 s dot is before the axis); right at 20, 30 and 40 s (its 50 s dot is past it).
		assert.deepEqual(pair.points, { x: [0, 1, 0, 0.5, 1], y: [6, 8, 16, 17, 18] });
		assert.deepEqual(pair.colours, ["green", "green", "blue", "blue", "blue"]);
		assert.equal(pair.mark, "dots");
		assert.deepEqual(
			pair.legend?.map((k) => k.label),
			["Left", "Right"],
		);
	});

	it("start at 0 on the distance axis, as the run's dots do", () => {
		const pair = card("pair", "distance");
		assert.equal(pair.x.ticks[0]!.text, "0.00");
		assert.deepEqual(pair.points.x, [0.2, 0.4, 0.8, 0.4, 0.6, 0.8, 1]);
	});

	it("as an overlay: on the primary's axis from 0, with their key and their card's own labels", () => {
		const view = expandedChartView(activity(), { axis: "time", sub: "chart:heart-rate:pair" }, "metric", SPEC)!;
		assert.equal(view.title, "Heart Rate & Pair Start");
		assert.equal(view.secondary?.mark, "dots");
		assert.deepEqual(view.secondary?.points, { x: [0.2, 0.4, 0.8, 0.4, 0.6, 0.8, 1], y: [5, 6, 8, 16, 17, 18, 19] });
		assert.deepEqual(view.secondary?.colours, ["green", "green", "green", "blue", "blue", "blue", "blue"]);
		assert.deepEqual(
			view.secondary?.y.labels.map((l) => l.text),
			["TOP 0", "15", "30"],
		);
		assert.deepEqual(
			view.secondary?.legend?.map((k) => k.label),
			["Left", "Right"],
		);
		assert.deepEqual(
			view.chips.map((c) => c.label),
			["Lanes", "Pair Start", "Power"],
		);
		assert.equal(view.x?.ticks.at(-1)?.text, "0:50");
	});
});

describe("lastAt", () => {
	it("is the last sample with a value and a place, or the fallback", () => {
		assert.equal(lastAt([0, 10, 20], [1, 2, null], 99), 10);
		assert.equal(lastAt([0, null, 20], [1, 2, null], 99), 0);
		assert.equal(lastAt([0, 10], [null, null], 99), 99);
	});
});

describe("lanes", () => {
	it("open as a landscape base on their own axis, with no value labels", () => {
		const view = expandedChartView(activity(), { axis: "time", sub: "chart:lanes" }, "metric", SPEC)!;
		const primary = view.primary as SeriesChart;
		assert.equal(primary.mark, "lanes");
		assert.deepEqual(primary.points, { x: [], y: [] });
		assert.deepEqual(primary.y.labels, []);
		assert.deepEqual(
			primary.lanes?.lanes.map((l) => l.label),
			["Up", "Down"],
		);
		assert.equal(view.x?.ticks.at(-1)?.text, "0:53");
	});

	it("as an overlay: lanes and their key, and the landscape runs on their axis", () => {
		const view = expandedChartView(activity(), { axis: "time", sub: "chart:heart-rate:lanes" }, "metric", SPEC)!;
		assert.equal(view.secondary?.mark, "lanes");
		assert.deepEqual(view.secondary?.points, { x: [], y: [] });
		assert.deepEqual(view.secondary?.lanes?.bars, [
			{ from: 0, to: 0.5, lane: "down" },
			{ from: 0.5, to: 1, lane: "up" },
		]);
		assert.deepEqual(view.secondary?.y.labels, []);
		assert.deepEqual(
			view.secondary?.legend?.map((k) => k.label),
			["Down"],
		);
		// The summary's 52.5 s, where the samples end at 50.
		assert.deepEqual(
			view.x?.ticks.map((t) => t.text),
			["0:00", "0:11", "0:21", "0:32", "0:42", "0:53"],
		);
		assert.equal(view.dim, true);
	});
});

describe("a sport's overrides of the run's charts: colour and frame", () => {
	it("give the run's Power the sport's overlay colour and the usual frame", () => {
		const power = card("power");
		assert.equal(power.title, "Power");
		assert.equal(power.frame, "chart");
		const view = expandedChartView(activity(), { axis: "time", sub: "chart:heart-rate:power" }, "metric", SPEC)!;
		assert.equal(view.secondary?.colour, "orange");
		assert.equal(view.title, "Heart Rate & Power");
	});

	it("keep a run chart's own labels as an overlay when the sport says so", () => {
		const run = outdoorRun();
		const sub = "chart:heart-rate:performance-condition";
		const kept: ChartsSpec = { ...RUN_CHARTS, runOverrides: { "performance-condition": { keepLabels: true } } };
		assert.deepEqual(
			expandedChartView(run, { axis: "time", sub }, "metric", kept)?.secondary?.y.labels.map((l) => l.text),
			["+2", "0", "-2"],
		);
		assert.deepEqual(
			expandedChartView(run, { axis: "time", sub }, "metric")?.secondary?.y.labels.map((l) => l.text),
			["3", "2", "0", "-2", "-3"],
		);
	});

	it("keep a run chart's key as an overlay when the sport says so", () => {
		const run = outdoorRun();
		const sub = "chart:heart-rate:stamina";
		const kept: ChartsSpec = { ...RUN_CHARTS, runOverrides: { stamina: { keepKey: true } } };
		assert.deepEqual(
			expandedChartView(run, { axis: "time", sub }, "metric", kept)?.secondary?.legend?.map((k) => k.label),
			["Stamina", "Potential"],
		);
		assert.equal(expandedChartView(run, { axis: "time", sub }, "metric")?.secondary?.legend, undefined);
	});

	it("leave the run's own Power alone", () => {
		const run = outdoorRun();
		const power = chartsTabView(run, { axis: "time" }, "metric", RUN_CHARTS).cards.find((c) => c.id === "power") as SeriesChart;
		assert.equal(power.frame, undefined);
		assert.equal(expandedChartView(run, { axis: "time", sub: "chart:heart-rate:power" }, "metric")?.secondary?.colour, "purple");
	});
});

describe("a map overlay binned by the activity's zones", () => {
	const MAP: MapSpec = {
		overlays: ["none", "power"],
		overview: "power",
		defs: {
			none: { label: "None", ramp: ["#000"], legend: null },
			power: { label: "Power", ramp: ["z1", "z2", "z3"], legend: { low: "Less", high: "More" }, zones: { column: "power", scale: "power" } },
		},
		base: "#54a9fe",
	};

	it("colours each sample by the last floor it reaches, never past the ramp's last colour", () => {
		// 0 → zone 1, 150 → 1, 151 → 2, 205 → 3, 412 → 3, 413 → zone 4, held at the ramp's third colour.
		const runs = routeRuns(activity(), "power", MAP);
		assert.deepEqual(
			runs.map((r) => [r.bucket, r.points.length]),
			[
				[0, 2],
				[1, 2],
				[2, 4],
			],
		);
	});

	it("gives the base colour without floors", () => {
		const bare = { ...activity(), powerZones: [] };
		assert.deepEqual(
			routeRuns(bare, "power", MAP).map((r) => r.bucket),
			[null],
		);
	});
});
