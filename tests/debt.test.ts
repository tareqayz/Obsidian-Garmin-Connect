import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChartMeta } from "../src/sync/backfill";
import { chartKeys } from "../src/sync/datasets";
import { shiftDate } from "../src/sync/day-index";
import { chartTitle, debtItems, pendingItems, type DebtInput } from "../src/sync/debt";
import type { AccountScan } from "../src/sync/scan";

const TODAY = "2026-10-14";
const scan: AccountScan = { scannedAt: `${TODAY}T06:00:00.000Z`, firstDay: "2025-08-02", days: 432, weeks: [["2025-07-31", 5]], activities: 341, complete: true };
const complete = (stores: string[]) => new Map<string, ChartMeta | null>(stores.map((s) => [s, { complete: true }]));

const input = (over: Partial<DebtInput> = {}): DebtInput => ({
	today: TODAY,
	groups: ["sleep", "fitness"],
	accepted: [],
	deferred: [],
	dayDetails: "30d",
	runDetails: "opened",
	scan,
	daySpans: [[shiftDate(TODAY, -29), TODAY, 1]],
	charts: new Map(),
	runs: [],
	runFiles: new Map(),
	...over,
});

const ALL_CHARTS = chartKeys(["sleep", "fitness"]).map((k) => k.replace(/@\d+$/, ""));

describe("what an update offers", () => {
	it("offers a chart index never walked, named as a person reads it, and nothing already complete", () => {
		const charts = complete(ALL_CHARTS.filter((s) => s !== "index:heat-acclimation"));
		const items = debtItems(input({ accepted: chartKeys(["sleep"]), charts }));
		assert.deepEqual(
			items.map((i) => [i.key, i.title, i.detail]),
			[["index:heat-acclimation@1", "Heat acclimation history", "new"]],
		);
		// The whole history: the days the scan's weeks hold.
		assert.equal(items[0]!.units, 5);
	});

	it("says a chart index agreed to at an older version is fetched again", () => {
		const charts = complete(ALL_CHARTS.filter((s) => s !== "index:vo2-max"));
		const items = debtItems(input({ accepted: [...chartKeys(["sleep", "fitness"]).filter((k) => !k.startsWith("index:vo2-max")), "index:vo2-max@0"], charts }));
		assert.deepEqual(items.map((i) => [i.title, i.detail]), [["VO₂ max history", "updated: fetched again"]]);
	});

	it("offers the days of the range an older version saved, and the gaps too when Day details were never agreed to", () => {
		const daySpans = [[shiftDate(TODAY, -29), shiftDate(TODAY, -20), 0] as const, [shiftDate(TODAY, -9), TODAY, 1] as const];
		const charts = complete(ALL_CHARTS);
		// A vault from before the setup: ten old days and ten missing ones in its 30.
		const fresh = debtItems(input({ accepted: chartKeys(["sleep", "fitness"]), charts, daySpans }));
		assert.deepEqual(fresh.map((i) => [i.key, i.units, i.detail]), [["days@1", 20, "20 days"]]);
		// Agreed to at an older version: its gaps fill without asking, only the old days are asked about.
		const older = debtItems(input({ accepted: [...chartKeys(["sleep", "fitness"]), "days@0"], charts, daySpans }));
		assert.equal(older[0]!.units, 10);
		assert.match(older[0]!.detail, /^10 days saved by an older version/);
	});

	it("offers runs only when they download, missing or older ones as the agreement allows", () => {
		const runs = [
			{ id: 2, date: "2026-10-01" },
			{ id: 1, date: "2026-09-01" },
		];
		const runFiles = new Map([[1, 1]]);
		const base = { accepted: chartKeys(["sleep", "fitness"]), charts: complete(ALL_CHARTS), runs, runFiles };
		assert.deepEqual(debtItems(input({ ...base })).filter((i) => i.set === "run-details"), []);
		assert.deepEqual(debtItems(input({ ...base, runDetails: "all" })).map((i) => [i.key, i.units]), [["runs@5", 2]]);
		assert.deepEqual(debtItems(input({ ...base, runDetails: "all", accepted: [...base.accepted, "runs@4"] })).map((i) => [i.units, i.detail]), [[1, "1 run saved by an older version"]]);
		assert.deepEqual(debtItems(input({ ...base, runDetails: "all", accepted: [...base.accepted, "runs@5"] })), []);
	});

	it("asks about what was put off with Later no more, though Settings still lists it", () => {
		const charts = complete(ALL_CHARTS.filter((s) => s !== "sleep"));
		const later = input({ accepted: chartKeys(["fitness"]), deferred: ["sleep@1"], charts });
		assert.deepEqual(pendingItems(later), []);
		assert.deepEqual(debtItems(later).map((i) => i.key), ["sleep@1"]);
	});

	it("names every store's history", () => {
		assert.deepEqual(["activities", "daily-stats", "sleep", "index:hrv-status", "index:nope"].map(chartTitle), [
			"Activity history",
			"Steps, floors and intensity history",
			"Sleep history",
			"HRV status history",
			"Index:nope history",
		]);
	});
});
