import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { chartsTabView, fitStep, RUN_CHARTS, type ChartsSpec, type SeriesChart } from "../src/dashboard/activity-chart-pages";
import { outdoorRun } from "./activity-run-fixture";

// What a sport may change on one of the run's own charts (`ChartsSpec.runOverrides`),
// and the two axis rules the ride and the swims brought: `step: "fit"` and `reach`.

const RUN = outdoorRun();
const card = (spec: ChartsSpec, id: string) => chartsTabView(RUN, { axis: "time" }, "metric", spec).cards.find((c) => c.id === id) as SeriesChart;

describe("a sport's overrides of the run's charts", () => {
	it("leave the run's charts alone when there are none", () => {
		assert.deepEqual(card({ ...RUN_CHARTS, runOverrides: {} }, "power"), card(RUN_CHARTS, "power"));
	});

	it("give one of them its own title and axis", () => {
		const ride: ChartsSpec = { ...RUN_CHARTS, pickers: {}, runOverrides: { power: { title: "Power", axis: { pad: 0.428 } } } };
		const power = card(ride, "power");
		assert.equal(power.title, "Power");
		// 0–442 W on the run's samples: the top 442 + 0.428 × 442, not the run's 1.66 × 442.
		assert.ok(Math.abs(power.y.top - (442 + 0.428 * 442)) < 1e-6, String(power.y.top));
		assert.equal(card(RUN_CHARTS, "power").title, "Power (W)");
	});

	it("bound Performance Condition at ±(its largest value + reach)", () => {
		const ride: ChartsSpec = { ...RUN_CHARTS, runOverrides: { "performance-condition": { axis: { reach: 1 } } } };
		const pc = card(ride, "performance-condition");
		// The run's samples reach +2: ±3.
		assert.deepEqual([pc.y.bottom, pc.y.top], [-3, 3]);
	});
});

describe("fitStep", () => {
	it("is the smallest 1, 2 or 5 × 10ⁿ with at most 5.5 steps in the range", () => {
		assert.equal(fitStep(130), 50);
		assert.equal(fitStep(100), 20);
		assert.equal(fitStep(5), 1);
		assert.equal(fitStep(0.5), 0.1);
		assert.equal(fitStep(0), 1);
	});
});
