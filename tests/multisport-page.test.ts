import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { legAt, legsOf, LEG_COLOURS } from "../src/dashboard/activity-legs";
import { hasRoute, lapMarkers, legPins, mapOverlays, overlayFor, overviewOverlay, rampOf, routeRuns } from "../src/dashboard/activity-map";
import { overviewView } from "../src/dashboard/activity-overview";
import { profileFor, sportOf } from "../src/dashboard/activity-sports";
import { categoryRoute } from "../src/dashboard/routes";
import { BASIC } from "../src/dashboard/sports/basic";
import { MULTISPORT, TRANSITION } from "../src/dashboard/sports/multisport";
import { SWIM_ROUTE } from "../src/dashboard/sports/swimming";
import { ACTIVITY_BLOCKS, blocksToFetch, parseActivityDetail, serializeActivityDetail } from "../src/sync/activity-detail";
import { LEG_IDS, MULTISPORT_ID, multisport, POLYLINE, TODAY, transition } from "./multisport-fixture";

/*
 * The multisport page against its spec's golden numbers
 * (ref/activity-details/multisport/README.md, issue #23) on the race of
 * `multisport-fixture.ts`: swim, transition, ride, transition, run.
 */

const RACE = multisport();

describe("a multisport's file", () => {
	it("keeps its legs from the summary's children, in race order", () => {
		assert.deepEqual(RACE.legs, [
			{ id: LEG_IDS[0], type: "open_water_swimming" },
			{ id: LEG_IDS[1], type: "transition_v2" },
			{ id: LEG_IDS[2], type: "road_biking" },
			{ id: LEG_IDS[3], type: "transition_v2" },
			{ id: LEG_IDS[4], type: "running" },
		]);
	});

	it("keeps the race's polyline as its track, not the first leg's rows", () => {
		assert.deepEqual(Object.keys(RACE.samples).sort(), ["clock", "lat", "lon"]);
		assert.equal(RACE.samples.lat?.length, POLYLINE.length);
		assert.equal(RACE.samples.clock?.[0], 0);
		assert.equal(RACE.samples.clock?.at(-1), Math.round(13037 + 0.99 * 5797.862));
	});

	it("reads an older one without legs as lacking its summary and samples: two requests on its next view", () => {
		const { legs: _legs, ...old } = RACE;
		const read = parseActivityDetail(serializeActivityDetail({ ...old, checked: [...ACTIVITY_BLOCKS] }));
		assert.ok(read);
		assert.deepEqual(blocksToFetch(read), ["summary", "samples"]);
		assert.deepEqual(blocksToFetch(parseActivityDetail(serializeActivityDetail({ ...RACE, checked: [...ACTIVITY_BLOCKS] }))), []);
	});

	it("names a leg's multisport", () => {
		assert.equal(transition().parentId, MULTISPORT_ID);
		assert.equal(RACE.parentId, undefined);
	});
});

describe("the multisport's legs", () => {
	const legs = legsOf(RACE);

	it("pairs each leg with its lap's totals", () => {
		assert.deepEqual(
			legs.map((leg) => [leg.kind, leg.glyph, leg.start, leg.duration, leg.calories]),
			[
				["swim", "swimming", 0, 2520.712, 487],
				["transition", "chevrons-right", 2556, 186.02, 17],
				["ride", "bike", 2742, 10140.009, 1527],
				["transition", "chevrons-right", 12882, 155.971, 22],
				["run", "run", 13037, 5797.862, 1363],
			],
		);
	});

	it("finds the leg a moment falls in", () => {
		assert.deepEqual([legAt(legs, 0), legAt(legs, 2555), legAt(legs, 2556), legAt(legs, 12881), legAt(legs, 18000)], [0, 0, 1, 2, 4]);
	});

	it("drops the totals when the laps don't line up with the legs", () => {
		assert.equal(legsOf({ ...RACE, laps: RACE.laps.slice(1) })[0].duration, undefined);
	});
});

describe("multisport page (golden)", () => {
	const view = overviewView(RACE, "metric", TODAY, MULTISPORT.overview);

	it("is a page of its own, not the basic page", () => {
		assert.equal(sportOf(RACE), "multisport");
		assert.equal(profileFor(RACE), MULTISPORT);
	});

	it("shows the race: 112.85 km, 5:13:21, 3,416", () => {
		assert.equal(view.when, "Oct 25, 2025 @ 6:36 AM");
		assert.equal(view.glyph, "link");
		assert.equal(view.title, "Coastal Multisport");
		assert.deepEqual(view.hero, { value: "112.85", unit: "km", label: "Distance" });
		assert.deepEqual(view.figures, [
			{ value: "5:13:21", label: "Total Time" },
			{ value: "3,416", label: "Total Calories" },
		]);
	});

	it("evaluates it as the phone: Threshold, Normal, Maximum 10/10", () => {
		assert.equal(view.benefit?.label, "Threshold (High Aerobic)");
		assert.equal(view.feel, "Normal");
		assert.deepEqual(view.effort?.score, "10/10");
	});

	it("lists the legs as the phone does, each opening its own page", () => {
		assert.deepEqual(
			view.legs?.map((leg) => [leg.id, leg.glyph, leg.title, leg.distance, leg.line]),
			[
				[LEG_IDS[0], "swimming", "Open Water Swimming", "1,836 m", "42:01 • 2:17 /100m"],
				[LEG_IDS[1], "chevrons-right", "Transition", "0.16 km", "3:06 • 17 Calories"],
				[LEG_IDS[2], "bike", "Road Cycling", "89.76 km", "2:49:00 • 31.9 km/h"],
				[LEG_IDS[3], "chevrons-right", "Transition", "0.14 km", "2:36 • 22 Calories"],
				[LEG_IDS[4], "run", "Running", "20.95 km", "1:36:38 • 4:37 /km"],
			],
		);
	});

	it("reads imperial legs in yards, miles, /mi and mph (Inferred)", () => {
		const legs = overviewView(RACE, "imperial", TODAY, MULTISPORT.overview).legs ?? [];
		assert.deepEqual(
			legs.map((leg) => [leg.distance, leg.line]),
			[
				["2,008 yd", "42:01 • 2:06 /100yd"],
				["0.10 mi", "3:06 • 17 Calories"],
				["55.77 mi", "2:49:00 • 19.8 mph"],
				["0.09 mi", "2:36 • 22 Calories"],
				["13.02 mi", "1:36:38 • 7:25 /mi"],
			],
		);
	});

	it("earns the Brick badge with the app's words, and links to All Multisport Activities", () => {
		assert.deepEqual(view.badges, [{ name: "Brick", description: "Record a multisport activity. (Requires compatible device.)" }]);
		assert.deepEqual(view.links, [{ label: "All Multisport Activities", icon: "link", route: categoryRoute("multisport") }]);
	});

	it("draws no Activity Legs for any other sport", () => {
		assert.equal(overviewView(transition(), "metric", TODAY, TRANSITION.overview).legs, undefined);
	});
});

describe("multisport map", () => {
	const spec = MULTISPORT.map;

	it("draws the whole race, each leg in its colour", () => {
		assert.ok(hasRoute(RACE));
		assert.deepEqual(mapOverlays(RACE, spec), ["legs"]);
		const overlay = overlayFor(RACE, overviewOverlay(spec), spec);
		assert.equal(overlay, "legs");
		const ramp = rampOf(overlay, spec);
		assert.deepEqual(
			routeRuns(RACE, overlay, spec).map((run) => (run.bucket === null ? null : ramp[run.bucket])),
			[LEG_COLOURS.swim, LEG_COLOURS.transition, LEG_COLOURS.ride, LEG_COLOURS.transition, LEG_COLOURS.run],
		);
	});

	it("pins each leg's start with its figure, and numbers no laps", () => {
		assert.deepEqual(
			legPins(RACE).map((pin) => [pin.glyph, pin.at]),
			[
				["swimming", [0.5, 10]],
				["chevrons-right", [0.51, 10.01]],
				["bike", [0.52, 10.02]],
				["chevrons-right", [0.53, 10.03]],
				["run", [0.54, 10.04]],
			],
		);
		assert.deepEqual(lapMarkers(RACE), []);
	});

	it("draws plain until a file without legs has fetched them again", () => {
		const { legs: _legs, ...old } = RACE;
		assert.equal(overlayFor(old, "legs", spec), "none");
		assert.deepEqual(legPins(old), []);
	});
});

describe("a multisport's leg page", () => {
	const leg = transition();
	const view = overviewView(leg, "metric", TODAY, TRANSITION.overview);

	it("is its sport's page, named by its sport; a transition the basic page with its own figures", () => {
		assert.equal(profileFor(leg), TRANSITION);
		assert.equal(TRANSITION.stats, BASIC.stats);
		assert.equal(view.title, "Transition");
	});

	it("shows a transition's Total Time, Avg Speed, Total Ascent and Total Calories, no heart rate (shot 1212)", () => {
		assert.deepEqual(view.hero, { value: "0.16", unit: "km", label: "Distance" });
		assert.deepEqual(view.figures, [
			{ value: "3:06", label: "Total Time" },
			{ value: "3.1", unit: "km/h", label: "Avg Speed" },
			{ value: "3", unit: "m", label: "Total Ascent" },
			{ value: "17", label: "Total Calories" },
		]);
		assert.equal(view.benefit?.label, "Base (Low Aerobic)");
	});

	it("draws a transition's route plain red, as the phone, without the pace colours", () => {
		assert.equal(TRANSITION.map, SWIM_ROUTE);
		assert.equal(overviewOverlay(TRANSITION.map), "none");
	});
});
