import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GLANCE_STATS } from "../src/dashboard/glance";
import {
	HEALTH_RANGES,
	HEALTH_REGISTRY,
	HEALTH_STATS,
	glanceStat,
	healthStat,
	hubStats,
	pageStat,
	pageStats,
} from "../src/dashboard/health-stats";
import { dayOf, periodOf, rangeLabel } from "../src/dashboard/periods";
import { statPeriodLabel } from "../src/dashboard/stat-registry";
import { ALL_GROUPS } from "../src/sync/metrics";

describe("HEALTH_STATS", () => {
	it("lists the stats in the phone's order", () => {
		assert.deepEqual(
			HEALTH_STATS.map((s) => s.id),
			[
				"sleep",
				"health-status",
				"lifestyle-logging",
				"weight",
				"pulse-ox",
				"pulse-ox-acclimation",
				"respiration",
				"heart-rate",
				"blood-pressure",
				"stress",
				"body-battery",
				"fitness-age",
				"health-snapshot",
			],
		);
		assert.deepEqual(
			HEALTH_STATS.map((s) => s.title),
			[
				"Sleep",
				"Health Status",
				"Lifestyle Logging",
				"Weight",
				"Pulse Ox",
				"Pulse Ox Acclimation",
				"Respiration",
				"Heart Rate",
				"Blood Pressure",
				"Stress",
				"Body Battery",
				"Fitness Age",
				"Health Snapshot",
			],
		);
	});

	it("gives every stat ranges in the control's order, a default among them, and an existing group", () => {
		for (const stat of HEALTH_STATS) {
			assert.ok(stat.ranges.length > 0, stat.id);
			assert.deepEqual(
				stat.ranges,
				HEALTH_RANGES.filter((r) => stat.ranges.includes(r)),
				`${stat.id}: ranges out of order or unknown`,
			);
			assert.ok(stat.ranges.includes(stat.defaultRange), stat.id);
			assert.ok(ALL_GROUPS.includes(stat.group), `${stat.id}: no group ${stat.group}`);
		}
	});

	it("names only At a Glance cards that exist, each for one stat at most", () => {
		const known = new Set(GLANCE_STATS.map((g) => g.id));
		const claimed = new Map<string, string>();
		for (const stat of HEALTH_STATS) {
			for (const id of stat.glance ?? []) {
				assert.ok(known.has(id), `${stat.id}: no glance card ${id}`);
				assert.equal(claimed.get(id), undefined, `${id} claimed twice`);
				claimed.set(id, stat.id);
			}
		}
	});

	it("keeps Health Status to a day at a time, as the phone has it", () => {
		assert.deepEqual(healthStat("health-status")?.ranges, ["1d"]);
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

describe("registered pages", () => {
	it("leaves Sleep and the unbuilt stats off the shared route", () => {
		assert.equal(pageStat("sleep"), undefined);
		assert.equal(pageStat("darts"), undefined);
		assert.equal(pageStat("stress")?.title, "Stress");
		assert.equal(healthStat("sleep")?.title, "Sleep");
	});

	it("gives commands to registered pages only, in the app's order whatever order they were registered in", () => {
		assert.deepEqual(pageStats([]), []);
		assert.deepEqual(
			pageStats(["body-battery", "sleep", "stress", "nonsense"]).map((s) => s.id),
			["stress", "body-battery"],
		);
	});

	it("lists Sleep in the hub, then the registered stats", () => {
		assert.deepEqual(
			hubStats([]).map((s) => s.id),
			["sleep"],
		);
		assert.deepEqual(
			hubStats(["fitness-age", "heart-rate"]).map((s) => s.id),
			["sleep", "heart-rate", "fitness-age"],
		);
	});

	it("lists the Lifestyle Logging placeholder in the hub and the commands, in the app's order", () => {
		const registered = ["weight", "pulse-ox", "pulse-ox-acclimation", "blood-pressure", "lifestyle-logging"];
		assert.deepEqual(
			hubStats(registered).map((s) => s.id),
			["sleep", "lifestyle-logging", "weight", "pulse-ox", "pulse-ox-acclimation", "blood-pressure"],
		);
		assert.ok(pageStats(registered).some((s) => s.id === "lifestyle-logging"));
	});

	it("opens a glance card's page once the page is built", () => {
		assert.equal(glanceStat("stress", []), undefined);
		assert.equal(glanceStat("stress", ["stress"])?.id, "stress");
		assert.equal(glanceStat("bodyBattery", ["stress", "body-battery"])?.id, "body-battery");
		// Sleep's card keeps its own route.
		assert.equal(glanceStat("sleep", ["stress"]), undefined);
		assert.equal(glanceStat("steps", ["stress"]), undefined);
	});
});

describe("the shared registry behind Health Stats", () => {
	it("keeps Sleep in the hub and off the shared route", () => {
		assert.deepEqual(
			HEALTH_REGISTRY.hubStats([]).map((s) => s.id),
			["sleep"],
		);
		assert.equal(HEALTH_REGISTRY.page("sleep"), undefined);
		assert.equal(HEALTH_REGISTRY.glanceTarget("stress", ["stress"])?.stat.id, "stress");
	});

	it("words a Health page's period as Health's own labels do, should a page leave its label to the shell", () => {
		const today = "2026-10-08";
		for (const stat of HEALTH_STATS) {
			for (const range of stat.ranges) {
				for (const offset of [0, -1, -12]) {
					const route = { range, offset };
					const span = range === "1d" ? { from: dayOf(route, today), to: dayOf(route, today) } : periodOf(range, offset, today);
					assert.equal(statPeriodLabel(stat, route, today), rangeLabel(range, span, today), `${stat.id} ${range} ${offset}`);
				}
			}
		}
	});
});
