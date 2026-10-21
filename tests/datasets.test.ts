import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ACTIVITY_DETAILS_KEY, chartKeys, consentKey, DAY_DETAILS_KEY, LEGACY_RUNS_KEY, parseConsentKey, rangeStart } from "../src/sync/datasets";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { ALL_GROUPS } from "../src/sync/metrics";

describe("data-set ranges", () => {
	it("start a range so many days back, never before the history", () => {
		assert.equal(rangeStart("30d", "2026-10-14"), "2026-09-15");
		assert.equal(rangeStart("90d", "2026-10-14"), "2026-07-17");
		assert.equal(rangeStart("1y", "2026-10-14"), "2025-10-15");
		assert.equal(rangeStart("1y", "2026-10-14", "2026-01-01"), "2026-01-01");
		assert.equal(rangeStart("all", "2026-10-14", "2019-03-02"), "2019-03-02");
	});

	it("backfill nothing for new days only, activities opened, or all before a scan", () => {
		assert.equal(rangeStart("new", "2026-10-14", "2019-03-02"), null);
		assert.equal(rangeStart("opened", "2026-10-14", "2019-03-02"), null);
		assert.equal(rangeStart("all", "2026-10-14"), null);
	});
});

describe("consent keys", () => {
	it("name a store at a version", () => {
		assert.equal(consentKey("index:stress", 1), "index:stress@1");
		assert.deepEqual(parseConsentKey("index:heat-acclimation@2"), { store: "index:heat-acclimation", version: 2 });
		assert.equal(parseConsentKey("nope"), null);
		assert.deepEqual([DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY, LEGACY_RUNS_KEY], ["days@1", "activity-details@6", "runs@5"]);
	});

	it("list every chart index of the groups on, and only those", () => {
		const all = chartKeys(ALL_GROUPS);
		assert.equal(all.length, 3 + DAY_INDEXES.length);
		assert.ok(all.includes("activities@3") && all.includes("daily-stats@1") && all.includes("sleep@1"));
		assert.deepEqual(chartKeys(["sleep", "spo2"]), ["sleep@1", "index:pulse-ox@2"]);
	});
});
