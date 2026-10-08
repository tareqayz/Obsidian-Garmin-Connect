import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { healthStat, hubStats, pageStats } from "../src/dashboard/health-stats";

const REGISTERED = ["weight", "pulse-ox", "pulse-ox-acclimation", "blood-pressure", "lifestyle-logging"];

describe("lifestyle logging and wave C registrations", () => {
	it("lists the placeholder in the hub and the commands, in the app's order", () => {
		assert.deepEqual(hubStats(REGISTERED).map((s) => s.id), ["sleep", "lifestyle-logging", "weight", "pulse-ox", "pulse-ox-acclimation", "blood-pressure"]);
		assert.ok(pageStats(REGISTERED).some((s) => s.id === "lifestyle-logging"));
	});
	it("sets each stat's ranges from its spec", () => {
		assert.deepEqual(healthStat("lifestyle-logging")?.ranges, ["1d"]);
		assert.deepEqual(healthStat("weight")?.ranges, ["1d", "7d", "4w", "1y"]);
		assert.deepEqual(healthStat("pulse-ox")?.ranges, ["1d", "7d", "4w"]);
		assert.deepEqual(healthStat("pulse-ox-acclimation")?.ranges, ["7d", "4w"]);
		assert.equal(healthStat("pulse-ox-acclimation")?.defaultRange, "7d");
		assert.deepEqual(healthStat("blood-pressure")?.ranges, ["1d", "7d", "4w", "1y"]);
	});
});
