import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_RATIO, paceText, ratioOf, SHARE_RATIOS, shareFileName, shareStats, shareView } from "../src/dashboard/activity-share";
import { PACE_RAMP } from "../src/dashboard/activity-map";
import type { ActivityDetail } from "../src/sync/activity-detail";
import { outdoorRun, TODAY, treadmillRun } from "./activity-run-fixture";

/*
 * Share Activity's data. The hike's figures are Garmin's own on the issue #44
 * shot of its TRANSPARENT image: 2:48:48 TOTAL TIME, 6.14 km DISTANCE,
 * 27:27 /km AVG PACE, "Mar 4 @ 9:22 AM". The ids, names and the route (a
 * made-up loop around a made-up origin) are invented.
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

function hike(): ActivityDetail {
	return detail({ summary: HIKE_SUMMARY, samples: loop(), hasPolyline: true });
}

describe("share ratios", () => {
	it("are Garmin's three, Full Portrait first and ticked", () => {
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
	it("gives the hike Garmin's header and three figures", () => {
		const view = shareView(hike(), "metric", "2026-03-10");
		assert.equal(view.title, "Ridge Hike");
		assert.equal(view.when, "Mar 4 @ 9:22 AM");
		assert.equal(view.date, "2026-03-04");
		assert.equal(view.glyph, "trekking");
		assert.deepEqual(view.stats, [
			{ value: "2:48:48", label: "Total Time" },
			{ value: "6.14", unit: "km", label: "Distance" },
			{ value: "27:27", unit: "/km", label: "Avg Pace" },
		]);
	});

	it("reads miles and minutes per mile in imperial", () => {
		const stats = shareStats(hike(), "imperial");
		assert.deepEqual(stats.slice(1), [
			{ value: "3.82", unit: "mi", label: "Distance" },
			{ value: "44:11", unit: "/mi", label: "Avg Pace" },
		]);
	});

	it("names an unnamed activity after its sport, and adds the year from another year", () => {
		const view = shareView(detail({ name: "  ", summary: HIKE_SUMMARY }), "metric", "2027-01-02");
		assert.equal(view.title, "Hiking");
		assert.equal(view.when, "Mar 4, 2026 @ 9:22 AM");
	});

	it("paces a run, as its Overview does", () => {
		const view = shareView(outdoorRun(), "metric", TODAY);
		assert.equal(view.glyph, "run");
		assert.deepEqual(view.stats, [
			{ value: "56:01", label: "Total Time" },
			{ value: "10.01", unit: "km", label: "Distance" },
			{ value: "5:36", unit: "/km", label: "Avg Pace" },
		]);
	});

	it("times a ride by its speed", () => {
		const ride = detail({ type: "road_biking", typeId: 10, parentTypeId: 2, summary: { distance: 40210, duration: 4980, averageSpeed: 8.074 } });
		assert.deepEqual(shareStats(ride, "metric"), [
			{ value: "1:23:00", label: "Total Time" },
			{ value: "40.21", unit: "km", label: "Distance" },
			{ value: "29.1", unit: "km/h", label: "Avg Speed" },
		]);
	});

	it("gives a pool swim its pool's unit and a pace per 100", () => {
		const swim = detail({
			type: "lap_swimming",
			typeId: 27,
			parentTypeId: 26,
			pool: { length: 25, unit: "m" },
			summary: { distance: 1100, duration: 1650, averageSpeed: 1100 / 1650 },
		});
		assert.deepEqual(shareStats(swim, "imperial"), [
			{ value: "27:30", label: "Total Time" },
			{ value: "1,100", unit: "m", label: "Distance" },
			{ value: "2:30", unit: "/100m", label: "Avg Pace" },
		]);
	});

	it("fills a session without a distance with calories and heart rate", () => {
		const strength = detail({ type: "strength_training", typeId: 13, parentTypeId: 29, summary: { duration: 2712, calories: 301.4, averageHR: 118.6 } });
		assert.deepEqual(shareStats(strength, "metric"), [
			{ value: "45:12", label: "Total Time" },
			{ value: "301", label: "Total Calories" },
			{ value: "119", unit: "bpm", label: "Avg Heart Rate" },
		]);
	});

	it("keeps to three figures, and to the ones there are", () => {
		assert.equal(shareStats(hike(), "metric").length, 3);
		assert.deepEqual(shareStats(detail({ summary: { duration: 600 } }), "metric"), [{ value: "10:00", label: "Total Time" }]);
	});

	it("draws the route, coloured by pace, from start to end", () => {
		const route = shareView(hike(), "metric").route;
		assert.ok(route);
		assert.equal(route.points.length, 40);
		assert.deepEqual(route.start, [10, 20]);
		assert.deepEqual(route.end, route.points[route.points.length - 1]);
		assert.ok(route.runs.length >= 2);
		for (const run of route.runs) assert.ok(PACE_RAMP.includes(run.color), run.color);
		// The runs share their joins, so together they cover every point.
		assert.equal(route.runs.reduce((n, run) => n + run.points.length, 0), 40 + route.runs.length - 1);
	});

	it("has no route without GPS", () => {
		assert.equal(shareView(treadmillRun(), "metric", TODAY).route, null);
		assert.equal(shareView(detail({ summary: HIKE_SUMMARY }), "metric").route, null);
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
