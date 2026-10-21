import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GarminRateLimitError } from "../src/garmin/errors";
import { ACTIVITY_DETAILS_KEY, chartKeys, DEFAULT_ACTIVITY_DETAILS, DEFAULT_DAY_DETAILS } from "../src/sync/datasets";
import type { AccountScan } from "../src/sync/scan";
import { afterScan, agreement, back, isRecommended, keptLabel, RECOMMENDED, startFlow } from "../src/ui/setup-flow";

const scan = (over: Partial<AccountScan> = {}): AccountScan => ({ scannedAt: "2026-10-14T06:00:00.000Z", days: 432, weeks: [], activities: 341, complete: true, ...over });

describe("setup flow", () => {
	it("starts at the sign-in, or at the scan when signed in already", () => {
		assert.deepEqual(startFlow(false), { step: "signin" });
		assert.deepEqual(startFlow(true), { step: "scan", view: "scanning" });
	});

	it("goes from a scan to the recommendation, an empty account, or an error to try again from", () => {
		assert.deepEqual(afterScan({ scan: scan() }), { step: "recommend" });
		assert.deepEqual(afterScan({ scan: scan({ days: 0, activities: 0 }) }), { step: "scan", view: "empty" });
		assert.deepEqual(afterScan({ scan: scan(), fatal: new GarminRateLimitError("slow down") }), { step: "scan", view: "error" });
		assert.deepEqual(afterScan(null), { step: "scan", view: "error" });
		// Activities without health data is still history.
		assert.deepEqual(afterScan({ scan: scan({ days: 0 }) }), { step: "recommend" });
	});

	it("goes back from Advanced options to the recommendation, and nowhere else", () => {
		assert.deepEqual(back({ step: "advanced" }), { step: "recommend" });
		assert.deepEqual(back({ step: "recommend" }), { step: "recommend" });
		assert.deepEqual(back({ step: "scan", view: "error" }), { step: "scan", view: "error" });
	});
});

describe("the recommendation", () => {
	it("is all of it, while the fallback defaults stay narrow", () => {
		assert.deepEqual(RECOMMENDED, { dayDetails: "all", activityDetails: "all" });
		assert.equal(isRecommended({ dayDetails: "all", activityDetails: "all" }), true);
		assert.equal(isRecommended({ dayDetails: "all", activityDetails: "opened" }), false);
		// The defaults stand in for a saved range that can't be read: they must never widen a download.
		assert.notEqual(DEFAULT_DAY_DETAILS, "all");
		assert.notEqual(DEFAULT_ACTIVITY_DETAILS, "all");
	});

	it("names what a vault set up before keeps", () => {
		assert.equal(keptLabel({ dayDetails: "90d", activityDetails: "opened" }), "last 90 days · activities you open");
		assert.equal(keptLabel({ dayDetails: "new", activityDetails: "1y" }), "new days only · activities from the last year");
		assert.equal(keptLabel(RECOMMENDED), "all history · all activities");
	});
});

describe("what the setup agrees to", () => {
	const groups = ["activity", "sleep", "workouts", "intraday"] as const;

	it("starting the download agrees to every chart index and to Day and Activity details", () => {
		const keys = agreement(groups);
		assert.deepEqual(keys.accepted, [...chartKeys(groups), "days@1", ACTIVITY_DETAILS_KEY]);
		assert.deepEqual(keys.deferred, []);
	});
});
