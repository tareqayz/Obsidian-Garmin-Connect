import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { chartsTabView, expandedChartView, RUN_CHARTS, type ChartsSpec, type SeriesChart, type XAxis } from "../src/dashboard/activity-chart-pages";
import type { ActivityDetail } from "../src/sync/activity-detail";

/*
 * The chart engine's hooks the swims brought, on a made-up activity of six
 * samples ten seconds apart whose samples carry no distance (a pool swim's):
 * a sport places the samples on an axis itself (`ChartsSpec.places`), and
 * draws its own Distance axis (`ChartsSpec.distanceAxis`). The run's charts
 * never use them (tests/run-page-baseline.test.ts holds that).
 */

function activity(): ActivityDetail {
	return {
		version: 6,
		id: 98765432198,
		name: "Engine Test",
		type: "lap_swimming",
		typeId: 27,
		parentTypeId: 26,
		start: "2026-09-14T23:50:17",
		summary: { duration: 52.5, distance: 100, averageHR: 120, maxHR: 140 },
		samples: {
			time: [0, 10, 20, 30, 40, 50],
			// One value, as a pool swim's sumDistance has: no axis of its own.
			distance: [0, null, null, null, null, null],
			hr: [100, 110, 120, 130, 140, 135],
		},
		laps: [],
		segments: [],
		hrZones: [],
		powerZones: [],
		weather: null,
		gear: [],
		device: null,
		weightKg: null,
		checked: [],
	};
}

/** Metres in equal fifths, as a pool's axis reads. */
const fifths = (end: number): XAxis => ({ ticks: [0, 1, 2, 3, 4, 5].map((k) => ({ at: k / 5, text: String(Math.round((k * end) / 5)) })), title: "Distance (m)" });

const SPEC: ChartsSpec = {
	...RUN_CHARTS,
	cards: ["heart-rate"],
	// The samples at 10, 30 and 50 s close lengths ending at 25, 50 and 100 m; the time axis is the samples' own.
	places: (_, axis) => (axis === "distance" ? { at: [null, 25, null, 50, null, 100], end: 100 } : undefined),
	distanceAxis: (end) => fifths(end),
};

const card = (spec: ChartsSpec, axis: "time" | "distance") => chartsTabView(activity(), { axis }, "metric", spec).cards.find((c) => c.id === "heart-rate") as SeriesChart | undefined;

describe("a sport's places for the samples", () => {
	it("give an axis the samples don't: without them a pool swim has no Distance charts", () => {
		assert.deepEqual(chartsTabView(activity(), { axis: "distance" }, "metric", { ...SPEC, places: undefined }).cards, []);
		assert.ok(card(SPEC, "distance"));
	});

	it("draw only the samples placed, each at its place", () => {
		const hr = card(SPEC, "distance")!;
		assert.deepEqual(hr.points, { x: [0.25, 0.5, 1], y: [110, 130, 135] });
	});

	it("bound the y axis by the samples placed: 110–135, not the activity's 100–140", () => {
		const hr = card(SPEC, "distance")!;
		assert.ok(Math.abs(hr.y.bottom - 0.98 * 110) < 1e-9, String(hr.y.bottom));
		assert.ok(Math.abs(hr.y.top - (135 + 0.443 * 25)) < 1e-9, String(hr.y.top));
		const time = card(SPEC, "time")!;
		assert.ok(Math.abs(time.y.bottom - 0.98 * 100) < 1e-9, String(time.y.bottom));
	});

	it("leave an axis they don't place to the samples", () => {
		assert.deepEqual(card(SPEC, "time"), card({ ...SPEC, places: undefined, distanceAxis: undefined }, "time"));
	});

	it("end the axis where they say; an end at 0 is no axis", () => {
		const late: ChartsSpec = { ...SPEC, places: (_, axis) => (axis === "time" ? { at: [0, 10, 20, 30, 40, 50], end: 100 } : undefined) };
		assert.deepEqual(card(late, "time")!.points.x, [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
		assert.equal(card(late, "time")!.x.ticks.at(-1)!.text, "1:40");
		const none: ChartsSpec = { ...SPEC, places: () => ({ at: [], end: 0 }) };
		assert.deepEqual(chartsTabView(activity(), { axis: "time" }, "metric", none).cards, []);
	});
});

describe("a sport's Distance axis", () => {
	it("labels the Distance charts with the sport's ticks", () => {
		const hr = card(SPEC, "distance")!;
		assert.deepEqual(
			hr.x.ticks.map((t) => t.text),
			["0", "20", "40", "60", "80", "100"],
		);
		assert.equal(hr.x.title, "Distance (m)");
	});

	it("carries into the landscape chart, its places too", () => {
		const view = expandedChartView(activity(), { axis: "distance", sub: "chart:heart-rate" }, "metric", SPEC)!;
		assert.equal(view.x?.title, "Distance (m)");
		assert.deepEqual((view.primary as SeriesChart).points.x, [0.25, 0.5, 1]);
	});
});
