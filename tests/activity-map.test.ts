import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { PACE_RAMP, RAMP_SLOTS, hasRoute, lapMarkers, overlayBucket, routeBounds, routeEnds, routePoints, routeRuns } from "../src/dashboard/activity-map";
import { buildActivityDetail, type ActivityDetail } from "../src/sync/activity-detail";

// A made-up route around a made-up origin: no one's run.
const ORIGIN: [number, number] = [10, 20];

function detailWith(samples: ActivityDetail["samples"], extra: Partial<ActivityDetail> = {}): ActivityDetail {
	const base = buildActivityDetail(1, { summary: { activityName: "Test", activityTypeDTO: { typeKey: "running" }, summaryDTO: {} } }, null)!;
	return { ...base, samples, ...extra };
}

/** Eight points east along the origin's latitude, with speeds that rise. */
const ROUTE = detailWith({
	lat: [10, 10, 10, null, 10, 10, 10, 10, 10],
	lon: [20, 20.001, 20.002, null, 20.003, 20.004, 20.005, 20.006, 20.007],
	speed: [2, 2, 2, 2, 3, 3, 4, 4, 4],
	clock: [0, 10, 20, 30, 40, 50, 60, 70, 80],
}, {
	laps: [
		{ n: 1, duration: 40, distance: 300, end: [10, 20.003] },
		{ n: 2, duration: 40, distance: 300, end: [10, 20.007] },
	],
	segments: [
		{ type: "RWD_RUN", start: 0, end: 39, duration: 39, distance: 300 },
		{ type: "RWD_WALK", start: 40, end: 59, duration: 19, distance: 20 },
		{ type: "RWD_RUN", start: 60, end: 80, duration: 20, distance: 280 },
	],
});

describe("routePoints", () => {
	it("keeps the samples with a position, and which sample each came from", () => {
		const points = routePoints(ROUTE);
		assert.equal(points.length, 8);
		assert.deepEqual(points[3], { at: [10, 20.003], sample: 4 });
		assert.ok(hasRoute(ROUTE));
	});

	it("is empty without GPS", () => {
		assert.deepEqual(routePoints(detailWith({ speed: [2, 3] })), []);
		assert.equal(hasRoute(detailWith({})), false);
		assert.equal(routeBounds([]), null);
		assert.equal(routeEnds([]), null);
	});

	it("knows its box and its ends", () => {
		const points = routePoints(ROUTE);
		assert.deepEqual(routeBounds(points), [ORIGIN, [10, 20.007]]);
		assert.deepEqual(routeEnds(points), { start: ORIGIN, end: [10, 20.007] });
	});
});

describe("routeRuns", () => {
	it("cuts the route where the pace slot changes, each run starting where the last ended", () => {
		// No summary here: best and average come from the samples (4 and 26/9 m/s).
		const runs = routeRuns(ROUTE, "pace");
		assert.deepEqual(
			runs.map((r) => r.bucket),
			[0, 5, 9],
		);
		assert.deepEqual(runs[1]!.points[0], runs[0]!.points.at(-1));
		assert.deepEqual(runs[2]!.points.at(-1), [10, 20.007]);
	});

	it("is one uncoloured run with no overlay, and colours run/walk by segment", () => {
		assert.deepEqual(
			routeRuns(ROUTE, "none").map((r) => r.bucket),
			[null],
		);
		assert.deepEqual(
			routeRuns(ROUTE, "run-walk").map((r) => r.bucket),
			[0, 1, 0],
		);
	});

	it("has no colour where the overlay's column is missing", () => {
		assert.deepEqual(
			routeRuns(ROUTE, "power").map((r) => r.bucket),
			[null],
		);
	});
});

describe("the pace ramp", () => {
	// The captured run's summary: best 5:08 /km (3.247 m/s), average 5:36 (2.978 m/s).
	const run = detailWith({ speed: [3.247, 3.19, 3.1, 2.978, 2.9, 2.8, 2.7, 0] }, { summary: { maxSpeed: 3.247, averageSpeed: 2.978 } });
	const slotOf = overlayBucket(run, "pace");

	it("has Garmin's ten slots, the two middle ones the same green", () => {
		assert.equal(PACE_RAMP.length, RAMP_SLOTS);
		assert.equal(PACE_RAMP[4], PACE_RAMP[5]);
	});

	it("puts the best pace in the fastest slot and the average between the greens", () => {
		// 308–313 s/km is the fast slot on the phone's map.
		assert.equal(slotOf(0), 9);
		assert.equal(slotOf(1), 9);
		assert.equal(slotOf(3), 5);
		// Slower than the mirrored slow end (363.6 s/km): the slowest slot.
		assert.equal(slotOf(6), 0);
		// Standing still has no colour.
		assert.equal(slotOf(7), null);
	});

	it("bins in steps of pace, not of speed", () => {
		// 3.1 m/s = 322.6 s/km: slot 7 (318–323 on the phone); 2.9 m/s = 344.8 s/km: slot 3 (340–344).
		assert.equal(slotOf(2), 7);
		assert.equal(slotOf(4), 3);
	});
});

describe("lapMarkers", () => {
	it("marks where each lap but the last ended", () => {
		assert.deepEqual(lapMarkers(ROUTE), [{ n: 1, at: [10, 20.003] }]);
	});
});
