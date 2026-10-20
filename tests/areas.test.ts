import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	AREAS,
	DIVIDER,
	areaItems,
	areaOf,
	areaStack,
	areaTitle,
	atAreaRoot,
	inArea,
	itemKey,
	pageArea,
	railFocus,
	visibleAreas,
	type AreaEntry,
	type AreaId,
} from "../src/dashboard/areas";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { HOME, activityMapRoute, activityRoute, categoryRoute, healthStatRoute, performanceStatRoute, sleepRoute, statsRoute, type Route } from "../src/dashboard/routes";

/** One of each page kind: a new kind fails to compile here until it is given an area. */
const PAGES: { [P in Route["page"]]: [Extract<Route, { page: P }>, AreaId] } = {
	home: [{ page: "home" }, "home"],
	glance: [{ page: "glance" }, "home"],
	activities: [{ page: "activities" }, "activities"],
	category: [categoryRoute("running") as Extract<Route, { page: "category" }>, "activities"],
	month: [{ page: "month", category: "cycling", sub: null, month: "2026-09", metric: "distance" }, "activities"],
	records: [{ page: "records", tab: "running" }, "activities"],
	all: [{ page: "all" }, "activities"],
	stats: [statsRoute("steps") as Extract<Route, { page: "stats" }>, "activities"],
	activity: [activityRoute(1), "activities"],
	"activity-map": [activityMapRoute(1), "activities"],
	health: [{ page: "health" }, "health"],
	sleep: [sleepRoute() as Extract<Route, { page: "sleep" }>, "health"],
	"sleep-factor": [{ page: "sleep-factor", factor: "deep", date: "2026-10-15" }, "health"],
	"health-stat": [healthStatRoute("stress"), "health"],
	performance: [{ page: "performance" }, "performance"],
	"performance-stat": [performanceStatRoute("vo2-max"), "performance"],
};

const labels = (entries: AreaEntry[]) => entries.map((e) => (e === DIVIDER ? "—" : e.label));

describe("areas", () => {
	it("are Home and the three the More page held, in its order", () => {
		assert.deepEqual(
			AREAS.map((a) => a.id),
			["home", "activities", "health", "performance"],
		);
		assert.equal(areaTitle("health"), "Health Stats");
	});

	it("show Performance Stats once its hub lists a built page", () => {
		assert.deepEqual(
			visibleAreas([]).map((a) => a.id),
			["home", "activities", "health"],
		);
		// Pages the hub doesn't list (Load opens from Training Status) don't count.
		assert.deepEqual(
			visibleAreas(["training-load"]).map((a) => a.id),
			["home", "activities", "health"],
		);
		assert.equal(visibleAreas(["vo2-max"]).length, 4);
	});

	it("give every page an area", () => {
		for (const [route, area] of Object.values(PAGES)) assert.equal(pageArea(route), area, route.page);
	});
});

describe("area stacks", () => {
	it("open an area on its own page", () => {
		assert.deepEqual(areaStack("home"), [HOME]);
		assert.deepEqual(areaStack("health"), [HOME, { page: "health" }]);
	});

	it("open a page inside its area, as the commands do", () => {
		const sleep = sleepRoute();
		assert.deepEqual(inArea(sleep), [HOME, { page: "health" }, sleep]);
		assert.deepEqual(inArea(statsRoute("floors")), [HOME, { page: "activities" }, statsRoute("floors")]);
		const vo2 = performanceStatRoute("vo2-max");
		assert.deepEqual(inArea(vo2), [HOME, { page: "performance" }, vo2]);
		assert.deepEqual(inArea({ page: "glance" }), [HOME, { page: "glance" }]);
		// An area's own page, and Home, are not stacked on themselves.
		assert.deepEqual(inArea({ page: "activities" }), [HOME, { page: "activities" }]);
		assert.deepEqual(inArea(HOME), [HOME]);
	});

	it("name the area a stack was entered through, for the phone's tabs", () => {
		assert.equal(areaOf([HOME]), "home");
		assert.equal(areaOf([HOME, { page: "performance" }, performanceStatRoute("ftp")]), "performance");
		// A page opened from a Home card stays under Home.
		assert.equal(areaOf([HOME, sleepRoute()]), "home");
	});

	it("know Home and the areas' own pages, where the phone shows the tabs", () => {
		assert.equal(atAreaRoot([HOME]), true);
		assert.equal(atAreaRoot([HOME, { page: "activities" }]), true);
		assert.equal(atAreaRoot([HOME, { page: "glance" }]), false);
		assert.equal(atAreaRoot([HOME, { page: "health" }, sleepRoute()]), false);
	});
});

describe("area items", () => {
	it("list Activities' pages in the app's order, Steps, Floors and Intensity Minutes after a line", () => {
		assert.deepEqual(labels(areaItems("activities", { health: [], performance: [] })), [
			"Running",
			"Cycling",
			"Gym & Fitness Equipment",
			"Swimming",
			"Hiking",
			"Multisport",
			"Other",
			"All Activities",
			"—",
			"Steps",
			"Floors",
			"Intensity Minutes",
		]);
	});

	it("list Sleep first in Health Stats, on the newest night, then the built pages", () => {
		const items = areaItems("health", { health: ["stress", "weight"], performance: [] }, -1);
		assert.deepEqual(labels(items), ["Sleep", "Weight", "Stress"]);
		assert.deepEqual((items[0] as Exclude<AreaEntry, typeof DIVIDER>).route, sleepRoute(-1));
	});

	it("list Performance Stats' hub pages, never the ones Training Status opens", () => {
		const built = PERFORMANCE_REGISTRY.pageStats(["training-status", "training-load", "heat-acclimation", "vo2-max"]).map((s) => s.id);
		assert.deepEqual(labels(areaItems("performance", { health: [], performance: built })), ["Training Status", "VO₂ Max"]);
	});

	it("give Home no pages", () => {
		assert.deepEqual(areaItems("home", { health: ["stress"], performance: ["vo2-max"] }), []);
	});

	it("key each page to its row, and leave out what the rail doesn't list", () => {
		assert.equal(itemKey(PAGES.month[0]), "category:cycling");
		assert.equal(itemKey(PAGES["sleep-factor"][0]), "health:sleep");
		assert.equal(itemKey(healthStatRoute("stress")), "health:stress");
		assert.equal(itemKey(performanceStatRoute("training-load")), null);
		assert.equal(itemKey(activityRoute(1)), null);
		assert.equal(itemKey({ page: "health" }), null);
		// Every row's own route keys back to it.
		const built = { health: ["stress"], performance: ["vo2-max"] };
		for (const area of ["activities", "health", "performance"] as const) {
			for (const entry of areaItems(area, built)) if (entry !== DIVIDER) assert.equal(itemKey(entry.route), entry.key);
		}
	});
});

describe("rail focus", () => {
	it("lights the page you are on, however you got there", () => {
		assert.deepEqual(railFocus([HOME, sleepRoute()]), { area: "health", item: "health:sleep" });
		assert.deepEqual(railFocus([HOME, { page: "health" }, healthStatRoute("stress")]), { area: "health", item: "health:stress" });
	});

	it("keeps the page a deeper one was opened from", () => {
		const status = performanceStatRoute("training-status");
		assert.deepEqual(railFocus([HOME, { page: "performance" }, status, performanceStatRoute("training-load")]), {
			area: "performance",
			item: "performance:training-status",
		});
		const running = categoryRoute("running");
		assert.deepEqual(railFocus([HOME, { page: "activities" }, running, PAGES.month[0], activityRoute(1)]), {
			area: "activities",
			item: "category:cycling",
		});
		assert.deepEqual(railFocus([HOME, { page: "activities" }, running, activityRoute(1)]), { area: "activities", item: "category:running" });
	});

	it("opens the area with no row lit on an area's own page, an activity from Home, or Home", () => {
		assert.deepEqual(railFocus([HOME, { page: "performance" }]), { area: "performance", item: null });
		assert.deepEqual(railFocus([HOME, activityRoute(7)]), { area: "activities", item: null });
		assert.deepEqual(railFocus([HOME, { page: "glance" }]), { area: "home", item: null });
		assert.deepEqual(railFocus([HOME]), { area: "home", item: null });
	});
});
