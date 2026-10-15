import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ACTIVITY_TYPES, discOf, FILTER_GROUPS, groupName, groupOf, OTHER_GROUP, SHOWN_GROUPS, subTypes, typeName } from "../src/dashboard/activity-types";
import { sportTitle } from "../src/dashboard/activity-labels";

// The type table (spec: ref/activities/all-activities, "Activity types and groups").

describe("the activity type table", () => {
	it("holds every type of Garmin's tree once, each named", () => {
		assert.equal(ACTIVITY_TYPES.length, 154);
		assert.equal(new Set(ACTIVITY_TYPES.map((t) => t.id)).size, 154);
		assert.equal(new Set(ACTIVITY_TYPES.map((t) => t.key)).size, 154);
		assert.ok(ACTIVITY_TYPES.every((t) => t.name.trim().length > 0));
	});

	it("names types as the app does", () => {
		assert.equal(typeName({ type: "road_biking" }), "Road Cycling");
		assert.equal(typeName({ type: "lap_swimming" }), "Pool Swimming");
		assert.equal(typeName({ type: "stair_climbing", typeId: 31 }), "Stair Stepper");
		assert.equal(typeName({ type: "obstacle_run" }), "Obstacle Course Racing");
		assert.equal(typeName({ type: "running" }), "Running");
		assert.equal(sportTitle("treadmill_running"), "Treadmill Running");
		// A type Garmin adds later reads from its key.
		assert.equal(typeName({ type: "zorbing" }), "Zorbing");
	});

	it("files a type under its filter group, an unknown one under its parent's, else Other", () => {
		assert.equal(groupOf({ type: "road_biking", typeId: 10, parentTypeId: 2 }), 2);
		assert.equal(groupOf({ type: "yoga" }), 29);
		assert.equal(groupOf({ type: "meditation" }), OTHER_GROUP);
		assert.equal(groupOf({ type: "zorbing", typeId: 9999, parentTypeId: 2 }), 2);
		assert.equal(groupOf({ type: "zorbing", typeId: 9999, parentTypeId: 9998 }), OTHER_GROUP);
		assert.equal(groupName(29), "Gym & Fitness Equipment");
	});

	it("lists the sheet's fifteen groups, five before Show All, each with its own row first", () => {
		assert.equal(FILTER_GROUPS.length, 15);
		assert.equal(SHOWN_GROUPS, 5);
		assert.deepEqual(FILTER_GROUPS.slice(0, SHOWN_GROUPS).map(groupName), ["Running", "Cycling", "Gym & Fitness Equipment", "Swimming", "Walking"]);
		for (const group of FILTER_GROUPS) assert.equal(ACTIVITY_TYPES.find((t) => t.id === group)?.order, 0, String(group));
	});

	it("orders a group's sub-types by name, code point by code point", () => {
		assert.deepEqual(subTypes(26).map((t) => t.name), ["Open Water Swimming", "Pool Swimming"]);
		assert.deepEqual(subTypes(2).slice(-3).map((t) => t.name), ["eBiking", "eEnduro Mountain Biking", "eMountain Biking"]);
		assert.ok(!subTypes(OTHER_GROUP).some((t) => t.key === "steps"));
	});

	it("gives each card the phone's disc: per type, else the group's, else neutral", () => {
		assert.equal(discOf({ type: "running" }), "orange");
		assert.equal(discOf({ type: "road_biking" }), "green");
		assert.equal(discOf({ type: "lap_swimming" }), "blue");
		assert.equal(discOf({ type: "stair_climbing" }), "orange");
		assert.equal(discOf({ type: "yoga" }), "cyan");
		assert.equal(discOf({ type: "hiking" }), "red");
		assert.equal(discOf({ type: "walking" }), "neutral");
		assert.equal(discOf({ type: "zorbing", parentTypeId: 2 }), "green");
	});
});
