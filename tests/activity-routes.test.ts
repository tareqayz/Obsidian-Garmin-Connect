import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { activityMapRoute, activityRoute, allRoute, HOME, pushOrReturn, readRoute, readStack, routeKey, type AllRoute, type Route } from "../src/dashboard/routes";

const ID = 12345678901;

describe("an activity route's picks", () => {
	it("folds the fields a route saved before picks in, so a saved workspace keeps its choices", () => {
		assert.deepEqual(readRoute({ page: "activity", id: ID, tab: "charts", axis: "time", pace: "gap", heart: "zones", power: "per-kg" }), {
			page: "activity",
			id: ID,
			tab: "charts",
			axis: "time",
			picks: { pace: "gap", heart: "zones", power: "per-kg" },
		});
		// Only the values the run's pickers had.
		assert.deepEqual(readRoute({ page: "activity", id: ID, tab: "charts", axis: "time", pace: "fast", heart: 3 }), { page: "activity", id: ID, tab: "charts", axis: "time" });
	});

	it("keeps a sport's own keys and values as tokens; picks wins over a legacy field", () => {
		const route = readRoute({ page: "activity", id: ID, tab: "charts", axis: "time", pace: "gap", picks: { pace: "lap-pace", curve: "w-kg", phase: "peak" } });
		assert.deepEqual(route, { page: "activity", id: ID, tab: "charts", axis: "time", picks: { pace: "lap-pace", curve: "w-kg", phase: "peak" } });
	});

	it("drops what isn't a token, a key that could reach a prototype, and more than eight", () => {
		const raw = JSON.parse('{"page":"activity","id":12345678901,"tab":"charts","axis":"time","picks":{"__proto__":"x","constructor":"<b>","ok":"fine","bad key":"x","n":3,"empty":""}}') as unknown;
		assert.deepEqual(readRoute(raw), { page: "activity", id: ID, tab: "charts", axis: "time", picks: { ok: "fine" } });
		const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, `v${i}`]));
		const picks = (readRoute({ page: "activity", id: ID, tab: "charts", axis: "time", picks: many }) as Extract<Route, { page: "activity" }>).picks!;
		assert.deepEqual(Object.keys(picks), ["k0", "k1", "k2", "k3", "k4", "k5", "k6", "k7"]);
		for (const bad of [null, "pace", ["pace"], {}]) assert.deepEqual(readRoute({ page: "activity", id: ID, picks: bad }), activityRoute(ID), JSON.stringify(bad));
	});
});

describe("an activity map's overlay", () => {
	it("is a token, whichever sport's: the page falls back to none for one it doesn't offer", () => {
		for (const overlay of ["power", "speed", "none", "run-walk"]) {
			assert.deepEqual(readRoute({ page: "activity-map", id: ID, overlay, laps: true }), activityMapRoute(ID, overlay));
		}
		for (const overlay of ["<b>", "", 42, null, "a".repeat(65)]) {
			assert.deepEqual(readRoute({ page: "activity-map", id: ID, overlay }), activityMapRoute(ID), String(overlay));
		}
		assert.deepEqual(activityMapRoute(ID, "none"), { page: "activity-map", id: ID, overlay: "none", laps: true });
	});
});

describe("routeKey", () => {
	const a: Route = { page: "activity", id: ID, tab: "charts", axis: "time", picks: { pace: "gap" } };
	const b: Route = { page: "activity", id: ID, tab: "charts", axis: "time", picks: { pace: "lap-pace" } };

	it("tells apart routes that differ only inside picks", () => {
		assert.notEqual(routeKey(a), routeKey(b));
		assert.equal(pushOrReturn([HOME, a], b).length, 3);
		assert.equal(pushOrReturn([HOME, a, b], a).length, 2);
	});

	it("is the same whatever order the keys were written in, at every level", () => {
		const shuffled = { picks: { power: "watts", pace: "gap" }, axis: "time", tab: "charts", id: ID, page: "activity" } as Route;
		const ordered: Route = { page: "activity", id: ID, tab: "charts", axis: "time", picks: { pace: "gap", power: "watts" } };
		assert.equal(routeKey(shuffled), routeKey(ordered));
		assert.notEqual(routeKey(allRoute({ types: [2, 10] })), routeKey(allRoute({ types: [10, 2] })));
	});
});

describe("the All Activities route", () => {
	const all = (fields: Record<string, unknown>) => readRoute({ page: "all", ...fields }) as AllRoute;

	it("reads a bare route as before: everything, newest first", () => {
		assert.deepEqual(readRoute({ page: "all" }), { page: "all" });
		assert.deepEqual(allRoute(), { page: "all" });
		assert.deepEqual(readStack([{ page: "home" }, { page: "activities" }, { page: "all" }]), [HOME, { page: "activities" }, { page: "all" }]);
	});

	it("trims the search and keeps 80 characters of it, emoji whole", () => {
		assert.equal(all({ q: "  Dubai Running  " }).q, "Dubai Running");
		assert.equal(all({ q: "x".repeat(100) }).q, "x".repeat(80));
		assert.equal(all({ q: `${"🏃".repeat(79)}ab` }).q, `${"🏃".repeat(79)}a`);
		assert.equal(all({ q: `${"a".repeat(79)} b` }).q, "a".repeat(79));
		for (const q of ["   ", "", 5, null]) assert.equal("q" in all({ q }), false, String(q));
	});

	it("knows three sorts; newest first has none", () => {
		for (const sort of ["oldest", "az", "za"]) assert.equal(all({ sort }).sort, sort);
		for (const sort of ["newest", "AZ", 1]) assert.equal("sort" in all({ sort }), false, String(sort));
	});

	it("keeps types as positive whole ids, each once, at most 64", () => {
		assert.deepEqual(all({ types: [2, 10, 2, 0, -1, 1.5, "3", 2 ** 53, 26] }).types, [2, 10, 26]);
		assert.equal(all({ types: Array.from({ length: 100 }, (_, i) => i + 1) }).types!.length, 64);
		for (const types of [[], [0], "2", null]) assert.equal("types" in all({ types }), false, JSON.stringify(types));
	});

	it("keeps real days, in order", () => {
		assert.deepEqual([all({ from: "2026-01-01", to: "2026-10-15" }).from, all({ from: "2026-01-01", to: "2026-10-15" }).to], ["2026-01-01", "2026-10-15"]);
		const swapped = all({ from: "2026-10-15", to: "2026-01-01" });
		assert.deepEqual([swapped.from, swapped.to], ["2026-01-01", "2026-10-15"]);
		assert.deepEqual(all({ from: "2026-02-30", to: "2026-13-01" }), { page: "all" });
		assert.deepEqual(all({ to: "2024-02-29" }), { page: "all", to: "2024-02-29" });
		assert.deepEqual(all({ from: "2026-1-1" }), { page: "all" });
	});

	it("keeps each range's ends finite and at least 0, in order", () => {
		assert.deepEqual(all({ dmin: 5000, dmax: 10000, tmin: 600, tmax: 3600, amin: 0, amax: 200 }), {
			page: "all",
			dmin: 5000,
			dmax: 10000,
			tmin: 600,
			tmax: 3600,
			amin: 0,
			amax: 200,
		});
		assert.deepEqual(all({ dmin: 10000, dmax: 5000 }), { page: "all", dmin: 5000, dmax: 10000 });
		assert.deepEqual(all({ dmin: -1, dmax: Infinity, tmin: NaN, tmax: "60", amin: null, amax: 12.5 }), { page: "all", amax: 12.5 });
	});

	it("keeps event types as tokens, each once; the flags only when true", () => {
		assert.deepEqual(all({ events: ["race", "training", "race", "<b>", 3, ""] }).events, ["race", "training"]);
		assert.equal("events" in all({ events: [] }), false);
		assert.deepEqual(all({ fav: true, pr: true }), { page: "all", fav: true, pr: true });
		for (const flag of [false, "true", 1, null]) assert.deepEqual(all({ fav: flag, pr: flag }), { page: "all" }, String(flag));
	});

	it("builds a filtered route that reads back as itself", () => {
		const route = allRoute({ q: "Dubai", sort: "oldest", types: [26, 29], from: "2026-01-01", to: "2026-10-15", dmin: 0, dmax: 150000, tmin: 0, tmax: 86400, amin: 10, amax: 500, events: ["race"], fav: true, pr: true });
		assert.deepEqual(readRoute(JSON.parse(JSON.stringify(route))), route);
		assert.equal(routeKey(readRoute(JSON.parse(JSON.stringify(route)))!), routeKey(route));
		// What allRoute is given is checked as a saved route would be.
		assert.deepEqual(allRoute({ types: [2, 2], dmin: 10, dmax: 5 }), { page: "all", types: [2], dmin: 5, dmax: 10 });
	});
});
