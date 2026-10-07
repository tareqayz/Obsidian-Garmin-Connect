import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { HOME, categoryRoute, pop, push, readRoute, readStack, replace, sleepRoute, statsRoute, top, type Route } from "../src/dashboard/routes";

describe("route stack", () => {
	it("pushes, replaces the top and pops back", () => {
		let stack: Route[] = [HOME];
		stack = push(stack, { page: "more" });
		stack = push(stack, { page: "activities" });
		stack = push(stack, categoryRoute("running"));
		stack = replace(stack, { ...(categoryRoute("running") as Extract<Route, { page: "category" }>), range: "1y" });
		assert.deepEqual(
			stack.map((r) => r.page),
			["home", "more", "activities", "category"],
		);
		assert.equal((top(stack) as Extract<Route, { page: "category" }>).range, "1y");
		stack = pop(stack);
		assert.equal(top(stack).page, "activities");
	});

	it("never pops Home", () => {
		assert.deepEqual(pop([HOME]), [HOME]);
		assert.deepEqual(pop([]), [HOME]);
	});

	it("keeps Home at the bottom when the stack runs deep", () => {
		let stack: Route[] = [HOME];
		for (let i = 0; i < 20; i++) stack = push(stack, { page: "all" });
		assert.equal(stack.length, 8);
		assert.equal(stack[0]!.page, "home");
	});

	it("opens a category on its first tab", () => {
		assert.deepEqual(categoryRoute("gym"), { page: "category", category: "gym", sub: null, range: "7d", offset: 0, metric: "time" });
	});
});

describe("readRoute", () => {
	it("accepts what the pages accept", () => {
		assert.deepEqual(readRoute({ page: "records", tab: "running" }), { page: "records", tab: "running" });
		assert.deepEqual(readRoute({ page: "month", category: "running", sub: 18, month: "2026-09", metric: "time" }), {
			page: "month",
			category: "running",
			sub: 18,
			month: "2026-09",
			metric: "time",
		});
	});

	it("rejects what they do not", () => {
		assert.equal(readRoute({ page: "settings" }), null);
		assert.equal(readRoute({ page: "records", tab: "golf" }), null);
		assert.equal(readRoute({ page: "category", category: "darts" }), null);
		assert.equal(readRoute({ page: "month", category: "running", month: "2026-13" }), null);
		assert.equal(readRoute("home"), null);
	});

	it("repairs a category page's settings rather than refusing it", () => {
		assert.deepEqual(readRoute({ page: "category", category: "gym", sub: -3, range: "5y", offset: 4, metric: "distance" }), {
			page: "category",
			category: "gym",
			sub: null,
			range: "7d",
			offset: 0,
			metric: "time",
		});
		assert.equal((readRoute({ page: "category", category: "running", offset: -3 }) as { offset: number }).offset, -3);
	});
});

describe("readStack", () => {
	it("puts Home at the bottom and drops what it cannot read", () => {
		assert.deepEqual(readStack([{ page: "more" }, { page: "nope" }, { page: "activities" }]), [HOME, { page: "more" }, { page: "activities" }]);
		assert.deepEqual(readStack([HOME, HOME, { page: "all" }]), [HOME, { page: "all" }]);
		assert.deepEqual(readStack(undefined), [HOME]);
		assert.deepEqual(readStack("all"), [HOME]);
	});
});

describe("stats routes", () => {
	it("open on today", () => {
		assert.deepEqual(statsRoute("floors"), { page: "stats", stat: "floors", range: "1d", offset: 0, totals: "monthly" });
	});

	it("read back what the pages accept, and only the past", () => {
		assert.deepEqual(readRoute({ page: "stats", stat: "intensity", range: "4w", offset: -3, totals: "weekly" }), {
			page: "stats",
			stat: "intensity",
			range: "4w",
			offset: -3,
			totals: "weekly",
		});
		assert.deepEqual(readRoute({ page: "stats", stat: "steps", range: "2y", offset: 4, totals: "daily" }), statsRoute("steps"));
		assert.equal(readRoute({ page: "stats", stat: "sleep" }), null);
	});
});

describe("sleep routes", () => {
	it("open on a night's score", () => {
		assert.deepEqual(sleepRoute(), { page: "sleep", range: "1d", offset: 0, tab: "score" });
		assert.deepEqual(sleepRoute(-1), { page: "sleep", range: "1d", offset: -1, tab: "score" });
		assert.deepEqual(sleepRoute(2), sleepRoute());
	});

	it("read back what the pages accept, and only the past", () => {
		assert.deepEqual(readRoute({ page: "health" }), { page: "health" });
		assert.deepEqual(readRoute({ page: "sleep", range: "1y", offset: -2, tab: "coach" }), { page: "sleep", range: "1y", offset: -2, tab: "coach" });
		assert.deepEqual(readRoute({ page: "sleep", range: "3d", offset: 5, tab: "notes" }), sleepRoute());
		assert.deepEqual(readRoute({ page: "sleep-factor", factor: "deep", date: "2026-10-04" }), { page: "sleep-factor", factor: "deep", date: "2026-10-04" });
		assert.equal(readRoute({ page: "sleep-factor", factor: "snoring", date: "2026-10-04" }), null);
		assert.equal(readRoute({ page: "sleep-factor", factor: "rem", date: "yesterday" }), null);
	});
});
