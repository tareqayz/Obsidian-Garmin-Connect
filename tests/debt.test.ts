import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { UPGRADED_VERSION } from "../src/sync/activity-detail";
import type { ChartMeta } from "../src/sync/backfill";
import { ACTIVITY_DETAILS_KEY, ACTIVITY_DETAILS_STORE, ACTIVITY_DETAILS_VERSION, chartKeys, consentKey, dataSet, LEGACY_RUNS_STORE } from "../src/sync/datasets";
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
	activityDetails: "opened",
	scan,
	daySpans: [[shiftDate(TODAY, -29), TODAY, 1]],
	charts: new Map(),
	activities: [],
	detailFiles: new Map(),
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

	it("offers activity details only when they download, missing or older ones as the agreement allows", () => {
		const activities = [
			{ id: 3, date: "2026-10-02", run: false, profile: "other" as const },
			{ id: 2, date: "2026-10-01", run: true, profile: "run" as const },
			{ id: 1, date: "2026-09-01", run: true, profile: "run" as const },
		];
		const detailFiles = new Map([[1, 1]]);
		const base = { accepted: chartKeys(["sleep", "fitness"]), charts: complete(ALL_CHARTS), activities, detailFiles };
		const line = (accepted: string[] = []) =>
			debtItems(input({ ...base, activityDetails: "all", accepted: [...base.accepted, ...accepted] })).map((i) => [i.key, i.units, i.detail]);
		const change = dataSet("activity-details").changes[ACTIVITY_DETAILS_VERSION]?.summary;
		assert.deepEqual(debtItems(input({ ...base })).filter((i) => i.set === "activity-details"), []);
		// Never agreed to: every activity without a file of today's version.
		assert.deepEqual(line(), [[ACTIVITY_DETAILS_KEY, 3, "2 activities · 1 saved by an older version"]]);
		// An older agreement fills the gaps already: only what it saved is asked about.
		const older = `1 activity saved by an older version${change ? `: ${change.charAt(0).toLowerCase()}${change.slice(1).replace(/\.$/, "")}` : ""}`;
		assert.deepEqual(line([consentKey(ACTIVITY_DETAILS_STORE, ACTIVITY_DETAILS_VERSION - 1)]), [[ACTIVITY_DETAILS_KEY, 1, older]]);
		// Run details fills the runs' gaps: the other sports, and what an older version saved, are asked about.
		assert.deepEqual(line([consentKey(LEGACY_RUNS_STORE, ACTIVITY_DETAILS_VERSION - 1)]), [[ACTIVITY_DETAILS_KEY, 2, "1 activity · 1 saved by an older version"]]);
		assert.deepEqual(line([ACTIVITY_DETAILS_KEY]), []);
	});

	it("counts the runs saved by the version before as upgrades, which the estimate prices apart", () => {
		const activities = [
			{ id: 4, date: "2026-10-03", run: true, profile: "run" as const },
			{ id: 3, date: "2026-10-02", run: false, profile: "other" as const },
			{ id: 2, date: "2026-10-01", run: true, profile: "run" as const },
			{ id: 1, date: "2026-09-01", run: true, profile: "run" as const },
		];
		// A run at the version before (upgraded in place), a ride at it (fetched whole), a run older still, and a gap.
		const detailFiles = new Map([[1, UPGRADED_VERSION], [2, UPGRADED_VERSION - 1], [3, UPGRADED_VERSION]]);
		const accepted = [...chartKeys(["sleep", "fitness"]), consentKey(LEGACY_RUNS_STORE, UPGRADED_VERSION)];
		const [item] = debtItems(input({ accepted, charts: complete(ALL_CHARTS), activities, detailFiles, activityDetails: "all" })).filter((i) => i.set === "activity-details");
		assert.equal(item?.units, 3);
		assert.equal(item?.upgrades, 1);
		assert.equal("upgrades" in debtItems(input({ accepted, charts: complete(ALL_CHARTS), activities, detailFiles: new Map(), activityDetails: "all" }))[0]!, false);
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
