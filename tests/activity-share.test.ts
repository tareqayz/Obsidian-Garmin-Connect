import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_RATIO, paceText, ratioOf, SHARE_RATIOS, shareFileName, shareSetOf, shareView, type ShareFigure } from "../src/dashboard/activity-share";
import { PACE_RAMP } from "../src/dashboard/activity-map";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { outdoorRun, TODAY, treadmillRun } from "./activity-run-fixture";

/*
 * Share Activity's data. The figures are Garmin's own, from its saved share
 * images (ref/share/phone): a hike (2:48:48, 6.14 km, 27:27 /km, 312 m, 739),
 * a run (161 bpm, 13.01 km, 5:19 /km, 1:09:07, 868), a ride (37:38,
 * 20.46 km, 32.6 km/h, 43 m, 178 W), a pool swim (8:51, 200 m, 1:52 /100m,
 * 113 bpm, 65) and yoga (82 bpm, 2:59, 18 brpm, 7). The summaries here are
 * built to give those figures; the ids, names and the route (a made-up loop
 * around a made-up origin) are invented.
 */

function detail(over: Partial<ActivityDetail>): ActivityDetail {
	return {
		version: 6,
		id: 98765400001,
		name: "Ridge Hike",
		type: "hiking",
		typeId: 3,
		parentTypeId: 17,
		start: "2026-03-04T09:22:10",
		summary: {},
		samples: {},
		laps: [],
		segments: [],
		hrZones: [],
		powerZones: [],
		weather: null,
		gear: [],
		device: null,
		weightKg: null,
		checked: [],
		...over,
	};
}

/** A loop: east, north, west, back, with a slow first half and a fast second one. */
function loop(): Record<string, number[]> {
	const lat: number[] = [];
	const lon: number[] = [];
	const speed: number[] = [];
	const corners: Array<[number, number]> = [
		[10, 20],
		[10, 20.01],
		[10.01, 20.01],
		[10.01, 20],
		[10, 20],
	];
	for (let leg = 0; leg < 4; leg += 1) {
		const [a, b] = [corners[leg], corners[leg + 1]];
		for (let i = 0; i < 10; i += 1) {
			lat.push(a[0] + ((b[0] - a[0]) * i) / 10);
			lon.push(a[1] + ((b[1] - a[1]) * i) / 10);
			speed.push(leg < 2 ? 0.5 : 0.8);
		}
	}
	return { lat, lon, speed };
}

const HIKE_SUMMARY = { distance: 6140, duration: 10128, averageSpeed: 1000 / 1647, calories: 739, averageHR: 112, elevationGain: 312 };

const hike = () => detail({ summary: HIKE_SUMMARY, samples: loop(), hasPolyline: true });
const run = () =>
	detail({ type: "running", typeId: 1, parentTypeId: 17, summary: { distance: 13010, duration: 4147, averageSpeed: 13010 / 4147, averageHR: 161, calories: 868 } });
const ride = () =>
	detail({
		type: "road_biking",
		typeId: 10,
		parentTypeId: 2,
		summary: { distance: 20460, duration: 2258, averageSpeed: 20460 / 2258, elevationGain: 43, averagePower: 178, calories: 520 },
	});
const swim = () =>
	detail({
		type: "lap_swimming",
		typeId: 27,
		parentTypeId: 26,
		pool: { length: 25, unit: "m" },
		summary: { distance: 200, duration: 531, averageSpeed: 100 / 112, averageHR: 113, calories: 65 },
	});
const yoga = () =>
	detail({ type: "yoga", typeId: 163, parentTypeId: 29, summary: { averageHR: 82, avgRespirationRate: 17.95, calories: 7, duration: 179.081, maxHR: 92 } });

/** The five as "value unit · label", for short assertions. */
const read = (figures: ShareFigure[]) => figures.map((f) => `${f.value}${f.unit ? ` ${f.unit}` : ""} · ${f.label}`);

describe("share ratios", () => {
	it("are Garmin's three, Full Portrait first and ticked, drawn 1080 wide", () => {
		assert.deepEqual(
			SHARE_RATIOS.map((r) => [r.id, r.label, r.width, r.height]),
			[
				["9:16", "Full Portrait (9:16)", 1080, 1920],
				["4:5", "Vertical (4:5)", 1080, 1350],
				["1:1", "Square (1:1)", 1080, 1080],
			],
		);
		assert.equal(DEFAULT_RATIO, "9:16");
		assert.equal(ratioOf("1:1").height, 1080);
	});
});

describe("shareView", () => {
	it("gives the hike Garmin's header and five figures", () => {
		const view = shareView(hike(), "metric", "2026-03-10");
		assert.equal(view.title, "Ridge Hike");
		assert.equal(view.when, "Mar 4 @ 9:22 AM");
		assert.equal(view.date, "2026-03-04");
		assert.equal(view.glyph, "trekking");
		assert.deepEqual(read(view.figures), ["2:48:48 · Total Time", "6.14 km · Distance", "27:27 /km · Avg Pace", "312 m · Total Ascent", "739 · Total Calories"]);
		assert.deepEqual(view.time, { value: "2:48:48", label: "Total Time" });
	});

	it("leads a run with its heart rate", () => {
		assert.deepEqual(read(shareView(run(), "metric").figures), [
			"161 bpm · Avg Heart Rate",
			"13.01 km · Distance",
			"5:19 /km · Avg Pace",
			"1:09:07 · Total Time",
			"868 · Total Calories",
		]);
	});

	it("gives a ride its speed and power", () => {
		assert.deepEqual(read(shareView(ride(), "metric").figures), [
			"37:38 · Total Time",
			"20.46 km · Distance",
			"32.6 km/h · Avg Speed",
			"43 m · Total Ascent",
			"178 W · Avg Power",
		]);
	});

	it("gives a pool swim its pool's unit and a pace per 100", () => {
		assert.deepEqual(read(shareView(swim(), "imperial").figures), [
			"8:51 · Total Time",
			"200 m · Distance",
			"1:52 /100m · Avg Pace",
			"113 bpm · Avg Heart Rate",
			"65 · Total Calories",
		]);
	});

	it("gives yoga its breathing, and Max Heart Rate where Garmin counts poses", () => {
		assert.deepEqual(read(shareView(yoga(), "metric").figures), [
			"82 bpm · Avg Heart Rate",
			"2:59 · Total Time",
			"18 brpm · Avg Respiration Rate",
			"92 bpm · Max Heart Rate",
			"7 · Total Calories",
		]);
	});

	it("reads miles and minutes per mile in imperial", () => {
		assert.deepEqual(read(shareView(hike(), "imperial").figures).slice(1, 4), ["3.82 mi · Distance", "44:11 /mi · Avg Pace", "1,024 ft · Total Ascent"]);
	});

	it("shows -- for a figure the activity hasn't got, as Garmin does", () => {
		const bare = detail({ type: "strength_training", typeId: 13, parentTypeId: 29, summary: { duration: 2712, calories: 301.4, averageHR: 118.6 } });
		assert.equal(shareSetOf(bare), "gym");
		assert.deepEqual(read(shareView(bare, "metric").figures), [
			"119 bpm · Avg Heart Rate",
			"45:12 · Total Time",
			"301 · Total Calories",
			"-- · Max Heart Rate",
			"-- · Avg Respiration Rate",
		]);
	});

	it("names an unnamed activity after its sport, and adds the year from another year", () => {
		const view = shareView(detail({ name: "  ", summary: HIKE_SUMMARY }), "metric", "2027-01-02");
		assert.equal(view.title, "Hiking");
		assert.equal(view.when, "Mar 4, 2026 @ 9:22 AM");
	});

	it("paces a run from the fixture, as its Overview does", () => {
		assert.deepEqual(read(shareView(outdoorRun(), "metric", TODAY).figures).slice(0, 3), ["167 bpm · Avg Heart Rate", "10.01 km · Distance", "5:36 /km · Avg Pace"]);
	});

	it("draws the route, coloured by pace, from start to end", () => {
		const route = shareView(hike(), "metric").route;
		assert.ok(route);
		assert.equal(route.points.length, 40);
		assert.deepEqual(route.start, [10, 20]);
		assert.deepEqual(route.end, route.points[route.points.length - 1]);
		assert.ok(route.runs.length >= 2);
		for (const r of route.runs) assert.ok(PACE_RAMP.includes(r.color), r.color);
		// The runs share their joins, so together they cover every point.
		assert.equal(route.runs.reduce((n, r) => n + r.points.length, 0), 40 + route.runs.length - 1);
	});

	it("has no route without GPS", () => {
		assert.equal(shareView(treadmillRun(), "metric", TODAY).route, null);
		assert.equal(shareView(run(), "metric").route, null);
	});
});

describe("shareSetOf", () => {
	it("picks the set by sport, and by distance for the rest", () => {
		assert.deepEqual([hike(), run(), ride(), swim(), yoga()].map(shareSetOf), ["foot", "run", "ride", "swim", "yoga"]);
		assert.equal(shareSetOf(detail({ type: "walking", typeId: 9, parentTypeId: 17 })), "foot");
		assert.equal(shareSetOf(detail({ type: "treadmill_running", typeId: 18, parentTypeId: 1 })), "run");
		assert.equal(shareSetOf(detail({ type: "resort_skiing", typeId: 251, parentTypeId: 165, summary: { distance: 9000 } })), "other");
	});
});

describe("paceText", () => {
	it("shows a pace slower than 30 min/km, which the day figures drop", () => {
		assert.equal(paceText(1000 / 2400, "metric"), "40:00");
		assert.equal(paceText(1000 / 3723, "metric"), "1:02:03");
	});

	it("has none at a standstill", () => {
		assert.equal(paceText(0, "metric"), undefined);
		assert.equal(paceText(undefined, "metric"), undefined);
	});
});

describe("shareFileName", () => {
	it("is the name and the day", () => {
		assert.equal(shareFileName({ title: "Ridge Hike", date: "2026-03-04" }), "Ridge Hike 2026-03-04.png");
	});

	it("drops what a file name or a link can't hold", () => {
		assert.equal(shareFileName({ title: 'Run: "5k" / #1 [fast]?', date: "2026-03-04" }), "Run 5k 1 fast 2026-03-04.png");
		assert.equal(shareFileName({ title: "Tab\there", date: "2026-03-04" }), "Tab here 2026-03-04.png");
	});

	it("falls back to Activity, and cuts a long name", () => {
		assert.equal(shareFileName({ title: "///", date: "2026-03-04" }), "Activity 2026-03-04.png");
		assert.equal(shareFileName({ title: "x".repeat(200), date: "2026-03-04" }), `${"x".repeat(80)} 2026-03-04.png`);
	});
});
