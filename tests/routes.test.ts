import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GlanceId } from "../src/dashboard/glance";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import {
	HOME,
	activityMapRoute,
	activityRoute,
	categoryRoute,
	healthStatRoute,
	moveStatRoute,
	performanceStatRoute,
	performanceTargetRoute,
	pop,
	push,
	pushOrReturn,
	readRoute,
	readStack,
	replace,
	sleepRoute,
	statOfRoute,
	statsRoute,
	top,
	type Route,
} from "../src/dashboard/routes";

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

describe("health-stat routes", () => {
	it("open on the stat's default range and the current period", () => {
		assert.deepEqual(healthStatRoute("stress"), { page: "health-stat", stat: "stress", range: "1d", offset: 0 });
		assert.deepEqual(healthStatRoute("heart-rate", { range: "4w", offset: -2, tab: "resting", sub: "zones", date: "2026-10-01" }), {
			page: "health-stat",
			stat: "heart-rate",
			range: "4w",
			offset: -2,
			tab: "resting",
			sub: "zones",
			date: "2026-10-01",
		});
	});

	it("check what an opener is handed as they check a saved route", () => {
		assert.deepEqual(healthStatRoute("health-status", { range: "7d", offset: 3 }), { page: "health-stat", stat: "health-status", range: "1d", offset: 0 });
		assert.deepEqual(healthStatRoute("stress", { offset: 1.5, tab: "" }), healthStatRoute("stress"));
	});

	it("read back what the pages accept, repairing the rest", () => {
		const route = healthStatRoute("body-battery", { range: "1y", offset: -4, sub: "events" });
		assert.deepEqual(readRoute(route), route);
		assert.deepEqual(readRoute({ page: "health-stat", stat: "stress", range: "5y", offset: 7 }), healthStatRoute("stress"));
		assert.equal((readRoute({ page: "health-stat", stat: "stress", offset: -3 }) as { offset: number }).offset, -3);
		assert.equal((readRoute({ page: "health-stat", stat: "stress", offset: "-3" }) as { offset: number }).offset, 0);
		// A stat with one range has nothing else to be on.
		assert.equal((readRoute({ page: "health-stat", stat: "health-status", range: "4w" }) as { range: string }).range, "1d");
	});

	it("refuse an unknown stat, and Sleep, which keeps its own route", () => {
		assert.equal(readRoute({ page: "health-stat", stat: "darts" }), null);
		assert.equal(readRoute({ page: "health-stat", stat: "sleep", range: "1d" }), null);
		assert.equal(readRoute({ page: "health-stat" }), null);
	});

	it("keep a tab, a sub-page and a day only when they look like one", () => {
		const read = (extra: Record<string, unknown>) => readRoute({ page: "health-stat", stat: "stress", ...extra }) as Record<string, unknown>;
		assert.equal(read({ tab: "summary" }).tab, "summary");
		assert.equal(read({ sub: "hrv" }).sub, "hrv");
		assert.equal(read({ sub: "2026-10-01T12:07" }).sub, "2026-10-01T12:07");
		assert.equal(read({ tab: "<img src=x>" }).tab, undefined);
		assert.equal(read({ sub: "../../etc" }).sub, undefined);
		assert.equal(read({ tab: "x".repeat(65) }).tab, undefined);
		assert.equal(read({ tab: 3 }).tab, undefined);
		assert.equal(read({ date: "2026-10-01" }).date, "2026-10-01");
		assert.equal(read({ date: "yesterday" }).date, undefined);
		assert.equal("tab" in read({}), false);
	});

	it("survive a reload in a stack", () => {
		const route = healthStatRoute("respiration", { range: "7d", offset: -1 });
		assert.deepEqual(readStack([{ page: "more" }, { page: "health" }, route]), [HOME, { page: "more" }, { page: "health" }, route]);
	});
});

describe("performance-stat routes", () => {
	it("open on the stat's default range and the current period", () => {
		assert.deepEqual(performanceStatRoute("vo2-max"), { page: "performance-stat", stat: "vo2-max", range: "1d", offset: 0 });
		assert.deepEqual(performanceStatRoute("training-effect"), { page: "performance-stat", stat: "training-effect", range: "7d", offset: 0 });
		assert.deepEqual(performanceStatRoute("vo2-max", { range: "12w", offset: -2, tab: "cycling", sub: "fitness-age", date: "2026-10-01" }), {
			page: "performance-stat",
			stat: "vo2-max",
			range: "12w",
			offset: -2,
			tab: "cycling",
			sub: "fitness-age",
			date: "2026-10-01",
		});
	});

	it("take the ranges Performance adds where the stat has them, and only there", () => {
		assert.equal(performanceStatRoute("cycling-power-curve", { range: "3m" }).range, "3m");
		assert.equal(performanceStatRoute("race-predictor", { range: "6m" }).range, "6m");
		assert.equal(performanceStatRoute("hill-score", { range: "12w" }).range, "12w");
		assert.equal(performanceStatRoute("race-predictor", { range: "12w" }).range, "1d");
		assert.equal(performanceStatRoute("training-effect", { range: "1y" }).range, "7d");
		// A day stepper only: there is nothing else to be on.
		assert.equal(performanceStatRoute("training-readiness", { range: "4w" }).range, "1d");
		// Health's pages never take them.
		assert.deepEqual(readRoute({ page: "health-stat", stat: "stress", range: "12w" }), healthStatRoute("stress"));
		assert.deepEqual(healthStatRoute("stress", { range: "6m" }), healthStatRoute("stress"));
	});

	it("read back what the pages accept, repairing the rest", () => {
		const route = performanceStatRoute("training-load", { tab: "training", offset: -3 });
		assert.deepEqual(readRoute(route), route);
		assert.deepEqual(readRoute({ page: "performance-stat", stat: "ftp", range: "5y", offset: 7 }), performanceStatRoute("ftp"));
		assert.equal((readRoute({ page: "performance-stat", stat: "ftp", offset: -3 }) as { offset: number }).offset, -3);
		assert.equal((readRoute({ page: "performance-stat", stat: "ftp", offset: 1.5 }) as { offset: number }).offset, 0);
		assert.equal((readRoute({ page: "performance-stat", stat: "ftp", offset: "-3" }) as { offset: number }).offset, 0);
		assert.deepEqual(readRoute({ page: "performance" }), { page: "performance" });
	});

	it("refuse an unknown stat, Cycling Ability, which has no page, and the other section's stats", () => {
		assert.equal(readRoute({ page: "performance-stat", stat: "darts" }), null);
		assert.equal(readRoute({ page: "performance-stat", stat: "cycling-ability", range: "1d" }), null);
		assert.equal(readRoute({ page: "performance-stat", stat: "stress" }), null);
		assert.equal(readRoute({ page: "health-stat", stat: "vo2-max" }), null);
		assert.equal(readRoute({ page: "performance-stat" }), null);
	});

	it("keep a tab, a sub-page and a day only when they look like one", () => {
		const read = (extra: Record<string, unknown>) => readRoute({ page: "performance-stat", stat: "hill-score", ...extra }) as Record<string, unknown>;
		assert.equal(read({ tab: "contributors" }).tab, "contributors");
		assert.equal(read({ sub: "2026-03" }).sub, "2026-03");
		assert.equal(read({ tab: "<img src=x>" }).tab, undefined);
		assert.equal(read({ sub: "../../etc" }).sub, undefined);
		assert.equal(read({ sub: "x".repeat(65) }).sub, undefined);
		assert.equal(read({ date: "2026-10-01" }).date, "2026-10-01");
		assert.equal(read({ date: "2026-10-1" }).date, undefined);
		assert.equal("tab" in read({}), false);
	});

	it("open the pages only another page links to", () => {
		assert.deepEqual(performanceStatRoute("heat-acclimation", { range: "4w" }), { page: "performance-stat", stat: "heat-acclimation", range: "4w", offset: 0 });
		assert.deepEqual(performanceStatRoute("training-load", { tab: "focus" }), { page: "performance-stat", stat: "training-load", range: "4w", offset: 0, tab: "focus" });
	});

	it("survive a reload in a stack, and go back down to a page already open", () => {
		const status = performanceStatRoute("training-status");
		const load = performanceStatRoute("training-load", { tab: "focus" });
		const stack = readStack([{ page: "more" }, { page: "performance" }, status, load]);
		assert.deepEqual(stack, [HOME, { page: "more" }, { page: "performance" }, status, load]);
		assert.deepEqual(pop(stack), [HOME, { page: "more" }, { page: "performance" }, status]);
		assert.deepEqual(pushOrReturn([...stack, activityRoute(1)], status), [HOME, { page: "more" }, { page: "performance" }, status]);
	});
});

describe("stat page moves", () => {
	it("keep the page's tab and sub-page, and carry the day 1d last showed", () => {
		const route = performanceStatRoute("vo2-max", { range: "4w", offset: -1, tab: "cycling", sub: "fitness-age" });
		assert.deepEqual(moveStatRoute(route, { range: "12w", offset: 0, date: "2026-10-09" }), {
			page: "performance-stat",
			stat: "vo2-max",
			range: "12w",
			offset: 0,
			tab: "cycling",
			sub: "fitness-age",
			date: "2026-10-09",
		});
		assert.deepEqual(moveStatRoute(route, { range: "4w", offset: -2 }), { ...route, offset: -2 });
	});

	it("move a Health page as the shell always has, key for key", () => {
		const route = healthStatRoute("stress", { range: "7d", offset: -1 });
		assert.deepEqual(moveStatRoute(route, { range: "1d", offset: -3 }), { page: "health-stat", stat: "stress", range: "1d", offset: -3 });
		assert.equal(
			JSON.stringify(moveStatRoute(route, { range: "4w", offset: 0, date: "2026-10-05" })),
			'{"page":"health-stat","stat":"stress","range":"4w","offset":0,"date":"2026-10-05"}',
		);
	});

	it("find the stat behind a route in its own section", () => {
		assert.equal(statOfRoute(healthStatRoute("stress"))?.title, "Stress");
		assert.equal(statOfRoute(performanceStatRoute("ftp"))?.title, "FTP");
		assert.deepEqual(statOfRoute(performanceStatRoute("vo2-max"))?.rangeLabels, { "1d": "Current" });
	});
});

describe("Performance cards' routes", () => {
	const target = (id: GlanceId) => PERFORMANCE_REGISTRY.glanceTarget(id)!;

	it("open the card's stat on its tab, a day page on the day Home shows", () => {
		assert.deepEqual(performanceTargetRoute(target("cyclingVo2"), -1), { page: "performance-stat", stat: "vo2-max", range: "1d", offset: -1, tab: "cycling" });
		assert.deepEqual(performanceTargetRoute(target("xcSkiFtp")), { page: "performance-stat", stat: "ftp", range: "1d", offset: 0, tab: "xc" });
		assert.deepEqual(performanceTargetRoute(target("readiness"), -2), performanceStatRoute("training-readiness", { offset: -2 }));
		// A page without a day opens on its current period.
		assert.deepEqual(performanceTargetRoute(target("loadFocus"), -1), { page: "performance-stat", stat: "training-load", range: "4w", offset: 0, tab: "focus" });
		assert.deepEqual(performanceTargetRoute(target("trainingLoad"), -1).tab, "training");
	});

	it("open on the range and sub-page a link names", () => {
		const hill = PERFORMANCE_REGISTRY.page("hill-score")!;
		assert.deepEqual(performanceTargetRoute({ stat: hill, range: "1y", sub: "2026-03" }, -1), {
			page: "performance-stat",
			stat: "hill-score",
			range: "1y",
			offset: 0,
			sub: "2026-03",
		});
	});
});

describe("activity routes", () => {
	const ID = 12345678901;

	it("open on Overview, and the map coloured by pace with its laps", () => {
		assert.deepEqual(activityRoute(ID), { page: "activity", id: ID, tab: "overview", axis: "time" });
		assert.deepEqual(activityMapRoute(ID), { page: "activity-map", id: ID, overlay: "pace", laps: true });
	});

	it("read back what the page accepts, repairing the rest", () => {
		const full = { page: "activity", id: ID, tab: "charts", axis: "distance", sub: "chart:heart-rate:cadence", pace: "gap", heart: "zones", power: "per-kg" };
		assert.deepEqual(readRoute(full), full);
		assert.deepEqual(readRoute({ page: "activity", id: ID, tab: "maps", axis: "speed", sub: "<b>", pace: "fast" }), activityRoute(ID));
		assert.deepEqual(readRoute({ page: "activity-map", id: ID, overlay: "power", laps: false }), { page: "activity-map", id: ID, overlay: "power", laps: false });
		assert.deepEqual(readRoute({ page: "activity-map", id: ID, overlay: "speed" }), activityMapRoute(ID));
	});

	it("refuse an id that can't be Garmin's", () => {
		for (const id of [0, -1, 1.5, "123", 2 ** 53, null]) {
			assert.equal(readRoute({ page: "activity", id }), null);
			assert.equal(readRoute({ page: "activity-map", id }), null);
		}
	});
});

describe("pushOrReturn", () => {
	it("goes back down to a page already open instead of stacking a loop", () => {
		const running = categoryRoute("running");
		const stack: Route[] = [HOME, { page: "activities" }, running, activityRoute(1)];
		assert.deepEqual(pushOrReturn(stack, categoryRoute("running")), [HOME, { page: "activities" }, running]);
		// The same route, its keys in another order.
		const reordered = { metric: "distance", offset: 0, range: "7d", sub: null, category: "running", page: "category" } as Route;
		assert.equal(pushOrReturn(stack, reordered).length, 3);
	});

	it("pushes a page that isn't open, or is open with other settings", () => {
		const stack: Route[] = [HOME, { page: "activities" }, { ...(categoryRoute("running") as Extract<Route, { page: "category" }>), range: "1y" }, activityRoute(1)];
		assert.equal(pushOrReturn(stack, categoryRoute("running")).length, 5);
		assert.equal(pushOrReturn(stack, { page: "records", tab: "running" }).length, 5);
	});
});
