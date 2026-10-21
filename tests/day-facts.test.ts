import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ChartMeta } from "../src/sync/backfill";
import {
	AUDIT_DAYS,
	auditedRoutes,
	emptyRoutes,
	factSpan,
	factStores,
	parseVerdicts,
	plannedSkips,
	routeEmpty,
	skippedRoutes,
	tally,
	type Masks,
} from "../src/sync/day-facts";
import { ALL_GROUPS } from "../src/sync/metrics";

const complete = (stores: string[], span: Partial<ChartMeta> = {}) => new Map<string, ChartMeta | null>(stores.map((s) => [s, { complete: true, ...span }]));
const SUMMARY_STORES = ["daily-stats", "index:stress", "index:body-battery", "index:heart-rate", "index:respiration", "index:pulse-ox"];

describe("which indexes vouch for a route", () => {
	it("a route's own index, once complete; the summary only once every summary-fed index with its group on is", () => {
		const charts = complete(["index:weight", ...SUMMARY_STORES.slice(1)]);
		charts.set("index:health-status", { complete: false });
		const stores = factStores(ALL_GROUPS, charts);
		assert.deepEqual([...stores.keys()], ["body"]);
		// Daily stats complete too: now the summary can be vouched for.
		charts.set("daily-stats", { complete: true });
		assert.deepEqual(factStores(ALL_GROUPS, charts).get("summary"), SUMMARY_STORES);
		// With Activity off, daily stats isn't needed.
		charts.set("daily-stats", { complete: false });
		assert.deepEqual(factStores(ALL_GROUPS.filter((g) => g !== "activity"), charts).get("summary"), SUMMARY_STORES.slice(1));
		// With Body composition off, nothing vouches for the weigh-in.
		assert.equal(factStores(ALL_GROUPS.filter((g) => g !== "body"), charts).has("body"), false);
	});

	it("only between the latest start and the earliest end of a route's indexes", () => {
		const charts = new Map<string, ChartMeta | null>([
			["daily-stats", { complete: true, from: "2025-01-01", to: "2026-10-20" }],
			["index:stress", { complete: true, from: "2025-03-01", to: "2026-10-19" }],
		]);
		assert.deepEqual(factSpan(["daily-stats", "index:stress"], charts), { from: "2025-03-01", to: "2026-10-19" });
		const facts = { summary: new Set(["2025-06-02"]) };
		const spans = { summary: { from: "2025-03-01", to: "2026-10-19" } };
		assert.deepEqual([...emptyRoutes("2025-06-01", facts, spans)], ["summary"]);
		assert.deepEqual([...emptyRoutes("2025-06-02", facts, spans)], []);
		// Outside the span, a missing row says nothing.
		assert.deepEqual([...emptyRoutes("2025-02-01", facts, spans)], []);
		assert.deepEqual([...emptyRoutes("2026-10-20", facts, spans)], []);
	});
});

describe("a mask earns its trust", () => {
	const masks = (verdicts: Masks["verdicts"]): Masks => ({ facts: { body: new Set(["2026-01-05"]), health: new Set() }, spans: {}, verdicts });

	it("skips only once trusted, asks to check it until then, and the estimate reckons it trusted unless it was turned off", () => {
		assert.deepEqual([...skippedRoutes("2026-01-06", masks({}))], []);
		assert.deepEqual([...auditedRoutes("2026-01-06", masks({}))].sort(), ["body", "health"]);
		assert.deepEqual([...plannedSkips("2026-01-06", masks({}))].sort(), ["body", "health"]);
		const trusted = masks({ body: "trusted", health: "off" });
		assert.deepEqual([...skippedRoutes("2026-01-06", trusted)], ["body"]);
		assert.deepEqual([...auditedRoutes("2026-01-06", trusted)], []);
		assert.deepEqual([...plannedSkips("2026-01-06", trusted)], ["body"]);
		// A weigh-in day is never left out.
		assert.deepEqual([...skippedRoutes("2026-01-05", trusted)], []);
	});

	it(`is trusted after ${AUDIT_DAYS} empty days, and off for good after one with data`, () => {
		let verdicts = tally({}, Array.from({ length: AUDIT_DAYS - 1 }, () => ({ route: "body" as const, empty: true })));
		assert.equal(verdicts.body, AUDIT_DAYS - 1);
		verdicts = tally(verdicts, [{ route: "body", empty: true }, { route: "hrv", empty: false }]);
		assert.deepEqual(verdicts, { body: "trusted", hrv: "off" });
		// Settled verdicts stay settled.
		assert.deepEqual(tally(verdicts, [{ route: "hrv", empty: true }, { route: "body", empty: false }]), verdicts);
	});

	it("reads back only verdicts it could have written", () => {
		assert.deepEqual(parseVerdicts({ body: "trusted", health: 3, hrv: "maybe", readiness: 9, sleep: "trusted" }), { body: "trusted", health: 3 });
		assert.deepEqual(parseVerdicts("trusted"), {});
	});
});

describe("what counts as an empty answer", () => {
	const opts = { groups: ALL_GROUPS, units: "metric" as const, date: "2026-01-06" };

	it("a route is empty when the day file would keep nothing from it", () => {
		assert.equal(routeEmpty("body", { body: { dateWeightList: [], totalAverage: {} } } as never, {}, opts), true);
		assert.equal(routeEmpty("body", { body: { totalAverage: { weight: 72_000 } } } as never, {}, opts), false);
		assert.equal(routeEmpty("summary", { summary: { calendarDate: "2026-01-06" } } as never, {}, opts), true);
		assert.equal(routeEmpty("summary", { summary: { calendarDate: "2026-01-06", totalSteps: 4_200 } } as never, {}, opts), false);
	});

	it("the summary is not empty while the day's timelines hold something", () => {
		const intraday = { stress: { stressValuesArray: [[Date.parse("2026-01-06T08:00:00Z"), 30]] } };
		assert.equal(routeEmpty("summary", { summary: { calendarDate: "2026-01-06" } } as never, intraday as never, opts), false);
	});
});
