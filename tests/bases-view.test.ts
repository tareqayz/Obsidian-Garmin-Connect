import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { load as loadYaml } from "js-yaml";
import { basesView } from "../src/sync/bases-view";
import { ALL_GROUPS } from "../src/sync/metrics";

interface Base {
	filters?: { and?: string[] };
	properties?: Record<string, { displayName?: string }>;
	views?: Array<{ type?: string; name?: string; order?: string[] }>;
}

const parse = (s: string) => loadYaml(s) as Base;

describe("basesView", () => {
	it("is valid YAML with the shape Bases documents", () => {
		const base = parse(basesView({ folder: "Garmin", prefix: "", groups: ALL_GROUPS, units: "metric" }));
		assert.equal(base.views?.[0]?.type, "table");
		assert.ok(Array.isArray(base.filters?.and));
		assert.ok(Array.isArray(base.views?.[0]?.order));
	});

	it("scopes the view to the data folder", () => {
		const base = parse(basesView({ folder: "Garmin", prefix: "", groups: ALL_GROUPS, units: "metric" }));
		assert.deepEqual(base.filters?.and, ['file.inFolder("Garmin")']);
	});

	it("quotes a folder name containing quotes or spaces without breaking the YAML", () => {
		const base = parse(
			basesView({ folder: 'My "Health" Data', prefix: "", groups: ALL_GROUPS, units: "metric" }),
		);
		assert.deepEqual(base.filters?.and, ['file.inFolder("My \\"Health\\" Data")']);
	});

	it("leads with the date column, which is the row key", () => {
		const base = parse(basesView({ folder: "Garmin", prefix: "", groups: ALL_GROUPS, units: "metric" }));
		assert.equal(base.views?.[0]?.order?.[0], "note.date");
	});

	it("lists columns only for the groups that are on", () => {
		const base = parse(
			basesView({ folder: "Garmin", prefix: "", groups: ["heart"], units: "metric" }),
		);
		assert.deepEqual(base.views?.[0]?.order, [
			"note.date",
			"note.resting_hr",
			"note.min_hr",
			"note.max_hr",
		]);
	});

	it("picks the distance column that matches the unit setting", () => {
		const metric = parse(
			basesView({ folder: "G", prefix: "", groups: ["activity"], units: "metric" }),
		);
		const imperial = parse(
			basesView({ folder: "G", prefix: "", groups: ["activity"], units: "imperial" }),
		);
		assert.ok(metric.views?.[0]?.order?.includes("note.distance_km"));
		assert.ok(!metric.views?.[0]?.order?.includes("note.distance_mi"));
		assert.ok(imperial.views?.[0]?.order?.includes("note.distance_mi"));
		assert.ok(!imperial.views?.[0]?.order?.includes("note.distance_km"));
	});

	it("applies the prefix to metric columns but never to date", () => {
		const base = parse(
			basesView({ folder: "Garmin", prefix: "g_", groups: ["heart"], units: "metric" }),
		);
		assert.deepEqual(base.views?.[0]?.order, [
			"note.date",
			"note.g_resting_hr",
			"note.g_min_hr",
			"note.g_max_hr",
		]);
	});

	it("gives every column a readable display name", () => {
		const base = parse(
			basesView({ folder: "Garmin", prefix: "", groups: ["heart", "sleep"], units: "metric" }),
		);
		assert.equal(base.properties?.date?.displayName, "Date");
		assert.equal(base.properties?.resting_hr?.displayName, "Resting HR");
		assert.equal(base.properties?.sleep_hours?.displayName, "Sleep (h)");
		// Every ordered column has an entry.
		for (const column of base.views![0]!.order!) {
			assert.ok(base.properties?.[column.replace("note.", "")], `no displayName for ${column}`);
		}
	});

	it("falls back to every group when none are selected", () => {
		const base = parse(basesView({ folder: "G", prefix: "", groups: [], units: "metric" }));
		assert.ok((base.views?.[0]?.order?.length ?? 0) > 10);
	});
});
