import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { focusRoute, glanceRoute, todayItemRoute } from "../src/dashboard/card-routes";
import { activityRoute, healthStatRoute, performanceStatRoute, sleepRoute, statsRoute } from "../src/dashboard/routes";
import type { ActivityRow } from "../src/sync/activity-index";

const BUILT = {
	health: ["heart-rate", "stress", "body-battery"],
	performance: ["training-readiness", "training-status", "hrv-status"],
};

describe("card routes: the page a card opens", () => {
	it("opens Steps, Floors and Intensity Minutes on the card's day", () => {
		assert.deepEqual(glanceRoute("steps", 0, BUILT), statsRoute("steps"));
		assert.deepEqual(glanceRoute("floors", -2, BUILT), { page: "stats", stat: "floors", range: "1d", offset: -2, totals: "monthly" });
		assert.deepEqual(glanceRoute("intensity", -1, BUILT), statsRoute("intensity", -1));
	});

	it("opens a sleep card on its night", () => {
		assert.deepEqual(glanceRoute("sleep", -3, BUILT), sleepRoute(-3));
		assert.deepEqual(focusRoute("sleep", -3, BUILT), sleepRoute(-3));
	});

	it("opens a Health or Performance Stats day page on the card's day", () => {
		assert.deepEqual(glanceRoute("heartRate", -4, BUILT), healthStatRoute("heart-rate", { offset: -4 }));
		assert.deepEqual(glanceRoute("hrv", -1, BUILT), performanceStatRoute("hrv-status", { offset: -1 }));
		assert.deepEqual(glanceRoute("readiness", 0, BUILT), performanceStatRoute("training-readiness"));
	});

	it("opens nothing for a card without a page, or one this build lacks", () => {
		assert.equal(glanceRoute("calories", 0, BUILT), null);
		assert.equal(glanceRoute("stress", 0, { health: [], performance: [] }), null);
	});

	it("opens the In Focus cards as Home does: Body Battery its 1d page on the card's day", () => {
		assert.deepEqual(focusRoute("bodyBattery", -2, BUILT), healthStatRoute("body-battery", { offset: -2 }));
		assert.equal(focusRoute("bodyBattery", 0, { health: [], performance: [] }), null);
		assert.deepEqual(focusRoute("activities", -5, BUILT), { page: "all" });
		assert.deepEqual(focusRoute("steps", -1, BUILT), statsRoute("steps", -1));
		assert.deepEqual(focusRoute("readiness", -1, BUILT), glanceRoute("readiness", -1, BUILT));
		assert.deepEqual(focusRoute("trainingStatus", 0, BUILT), glanceRoute("trainingStatus", 0, BUILT));
	});

	it("opens an activity the index holds, never a Health Snapshot", () => {
		const rows = [{ id: 42, name: "Morning Run", type: "running", start: "2026-10-28T07:12:33", begin: 0 }] satisfies ActivityRow[];
		assert.deepEqual(todayItemRoute({ kind: "activity", name: "Morning Run", start: "2026-10-28T07:12" }, rows), activityRoute(42));
		assert.equal(todayItemRoute({ kind: "activity", name: "Evening Ride", start: "2026-10-28T18:00" }, rows), null);
		assert.equal(todayItemRoute({ kind: "snapshot", title: "Health Snapshot - Morning", start: "2026-10-28T07:12" }, rows), null);
	});
});
