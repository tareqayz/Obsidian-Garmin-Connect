import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { LEVEL, alignmentPlot, durationPlot, needPlot, ringArcs, scorePlot, timelinePlot, timesPlot } from "../src/dashboard/sleep-charts";
import { sleepPeriodView, type AlignmentView, type CoachView, type SleepData, type Timeline } from "../src/dashboard/sleep-pages";
import type { SleepRow } from "../src/sync/sleep-index";

/** Positions are the Figma twin's (Obsidian / Sleep, 176:4 and 176:5) at the phone's 402pt. */
const PHONE = 402;

const night: Timeline = {
	bars: [
		{ x0: 0, x1: 0.1, stage: "light" },
		{ x0: 0.1, x1: 0.2, stage: "deep" },
		{ x0: 0.2, x1: 0.25, stage: "rem" },
		{ x0: 0.25, x1: 0.26, stage: "awake" },
	],
	hours: [0.05, 0.17],
	startLabel: "11:35 PM",
	endLabel: "7:56 AM",
	overlays: [
		{ id: "awake", chip: "Awake/Restlessness", legend: "Restless Moments", kind: "awake", points: [], ticks: [[0.5, 1], [0.75, 3]] },
		{ id: "rhr", chip: "Resting Heart Rate", legend: "Resting Heart Rate", kind: "line", points: [[0, 48], [0.5, null], [1, 66]], axis: [42, 48, 54, 60, 66], labels: ["", "48", "54", "60", "66"] },
	],
};

describe("timelinePlot", () => {
	it("stacks the stages as the score page draws them", () => {
		const plot = timelinePlot(night, null, PHONE, LEVEL.score);
		assert.equal(plot.left, 49);
		assert.equal(plot.right, 359);
		assert.equal(plot.baseline, 165.8);
		assert.deepEqual(
			plot.grid.map((g) => [g.label, g.y]),
			[
				["Awake", 12],
				["REM", 50.45],
				["Light", 88.9],
				["Deep", 127.35],
			],
		);
		assert.deepEqual(
			plot.bars.map((b) => [b.stage, b.x, b.y, b.h]),
			[
				["light", 49, 88.9, 76.9],
				["deep", 80, 127.35, 38.45],
				["rem", 111, 50.45, 115.35],
				["awake", 126.5, 12, 153.8],
			],
		);
		assert.equal(plot.dotY, 175.05);
		assert.equal(plot.labelY, 193.9);
	});

	it("draws a restless moment as a tick, stacked when a minute had several", () => {
		const plot = timelinePlot(night, night.overlays[0]!, PHONE, LEVEL.score);
		assert.deepEqual(
			plot.ticks.map((t) => [t.x, t.y]),
			[
				[204, 143.8],
				[281.5, 143.8],
				[281.5, 117.8],
				[281.5, 91.8],
			].map(([x, y]) => [Math.round(x!), y]),
		);
		assert.equal(plot.line, undefined);
	});

	it("puts a line overlay on its own axis, labelled at the stage lines on the right", () => {
		const plot = timelinePlot(night, night.overlays[1]!, PHONE, LEVEL.score);
		assert.equal(plot.line, "M49 127.35 M359 12");
		assert.equal(plot.rightX, 371.7);
		assert.deepEqual(
			plot.rightLabels.map((l) => [l.text, l.y]),
			[
				["48", 127.35],
				["54", 88.9],
				["60", 50.45],
				["66", 12],
			],
		);
	});

	it("runs shorter on a factor page", () => {
		const plot = timelinePlot(night, null, PHONE, LEVEL.factor);
		assert.equal(plot.baseline, 125.6);
		assert.equal(plot.height, 161.6);
	});
});

describe("ringArcs", () => {
	it("goes clockwise from twelve with a hair between stages", () => {
		const arcs = ringArcs([
			{ stage: "deep", fraction: 0.25 },
			{ stage: "light", fraction: 0.75 },
		]);
		assert.deepEqual(
			arcs.map((a) => a.stage),
			["deep", "light"],
		);
		assert.match(arcs[0]!.d, /^M83\.\d+ 2\.85 A80\.15 80\.15 0 0 1 163\.15 82\.\d+$/);
	});
});

describe("needPlot", () => {
	const coach = (need: number, baseline?: number): CoachView => ({
		need: "",
		needMinutes: need,
		...(baseline !== undefined ? { baselineMinutes: baseline } : {}),
		title: "",
		text: "",
		adjustments: [],
	});

	it("spans the bar with the larger of need and baseline", () => {
		assert.deepEqual(needPlot(coach(420, 420), undefined), { width: 190.8, start: 0, need: 190.8, needLabel: "" });
		const adjusted = needPlot(coach(390, 420), "7h baseline");
		assert.equal(adjusted.baseline, 190.8);
		assert.equal(adjusted.need, 177.17);
		assert.equal(adjusted.baselineLabel, "7h baseline");
	});
});

describe("alignmentPlot", () => {
	const aligned: AlignmentView = {
		title: "Aligned",
		subtitle: "With Internal Rhythm",
		text: "",
		axisStart: -180,
		internal: { start: -30, end: 390, mid: 180 },
		last: { start: -24.77, end: 476.23, mid: 226 },
		stats: [],
	};

	it("lays twelve hours across the tracks from six before the rhythm's midpoint", () => {
		const plot = alignmentPlot(aligned, PHONE);
		assert.deepEqual(plot.internal, { x1: 93.08, x2: 308.92, mid: 201 });
		assert.deepEqual(plot.target, { x1: 170.17, x2: 231.83 });
		assert.equal(plot.last?.x1, 95.77);
		assert.equal(plot.dots.length, 25);
		assert.deepEqual(
			plot.labels.map((l) => l.text),
			["9 PM", "11 PM", "1 AM", "3 AM", "5 AM", "7 AM", "9 AM"],
		);
	});

	it("clips a bedtime before the axis to its edge", () => {
		const plot = alignmentPlot({ ...aligned, last: { start: -186, end: 414, mid: 114 } }, PHONE);
		assert.equal(plot.last?.x1, 16);
	});
});

/** A week of nights for the period charts: bed and wake in seconds from midnight. */
const rows: SleepRow[] = [
	{ date: "2026-10-01", score: 91, seconds: 27000, need: 390, bed: 1660, wake: 28780, align: "BEHIND" },
	{ date: "2026-10-02", score: 75, seconds: 21960, need: 390, bed: 10249, wake: 32329 },
	{ date: "2026-10-07", score: 94, seconds: 35940, need: 390, bed: -11141, wake: 24859, align: "AHEAD" },
];
const data: SleepData = { rows, complete: true, units: "metric" };
const week = sleepPeriodView({ data, route: { range: "7d", offset: 0, tab: "score" }, today: "2026-10-07" });

describe("period charts", () => {
	it("put a week's scores from the plot's left edge to its right", () => {
		const plot = scorePlot(week, null, PHONE);
		assert.equal(plot.left, 54.7);
		assert.equal(plot.right, 351.3);
		assert.deepEqual(plot.dots[0], { x: 54.7, y: 23.62 });
		assert.equal(plot.dots.at(-1)!.x, 351.3);
		assert.deepEqual(
			plot.grid.map((g) => g.y),
			[8, 51.4, 94.8, 138.2, 181.6],
		);
		// Oct 3 - 6 have no score: the line stops at Oct 2 and starts again at Oct 7.
		assert.equal(plot.line.match(/M/g)?.length, 2);
	});

	it("draw a met need green and a missed one blue over grey", () => {
		const plot = durationPlot(week, PHONE);
		assert.deepEqual(
			plot.bars.map((b) => b.kind),
			["met", "need", "duration", "met"],
		);
		assert.deepEqual(
			plot.grid.map((g) => g.label),
			["12h", "9h", "6h", "3h"],
		);
	});

	it("draw bed to wake on sixteen hours from the axis' top hour", () => {
		const plot = timesPlot(week, PHONE);
		assert.equal(week.times.top, -5);
		assert.equal(plot.grid[0]!.label, "7 PM");
		assert.equal(plot.bars.length, 3);
		assert.equal(plot.bars[2]!.aligned, false);
		assert.ok(plot.avgBed !== undefined && plot.avgBed > 8);
	});
});
