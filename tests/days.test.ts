import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Properties } from "../src/sync/metrics";
import { dayRowOf, isDaysFile, mergeDay, parseDays, serializeDays, type DayProperties } from "../src/sync/days";

describe("day files", () => {
	it("round-trips a year's days", () => {
		const days: DayProperties = new Map<string, Properties>([
			["2026-10-02", { steps: 9000, hrv_status: "BALANCED" }],
			["2026-10-01", { steps: 8000, workouts: [{ type: "running", distance_km: 5 }] }],
		]);
		const text = serializeDays("2026", days);
		assert.deepEqual(parseDays(text), days);
		// Dates in order, so the same days always make the same text.
		assert.ok(text.indexOf("2026-10-01") < text.indexOf("2026-10-02"));
		assert.equal(serializeDays("2026", parseDays(text)), text);
	});

	it("writes only the year's own days", () => {
		const text = serializeDays("2026", new Map([["2025-12-31", { steps: 1 }], ["2026-01-01", { steps: 2 }]]));
		assert.deepEqual([...parseDays(text).keys()], ["2026-01-01"]);
	});

	it("merges a day over what it held, keeping keys the new write lacks", () => {
		const days = mergeDay(new Map([["2026-10-01", { steps: 8000, vo2max: 50 }]]), "2026-10-01", { steps: 8100 });
		assert.deepEqual(days.get("2026-10-01"), { steps: 8100, vo2max: 50 });
	});

	it("reads a malformed file as empty and drops malformed days", () => {
		assert.equal(parseDays("not json").size, 0);
		const days = parseDays(JSON.stringify({ days: { "2026-10-01": { steps: 1 }, nope: { steps: 2 }, "2026-10-02": [1] } }));
		assert.deepEqual([...days.keys()], ["2026-10-01"]);
	});

	it("names year files only", () => {
		assert.equal(isDaysFile("2026.json"), true);
		assert.equal(isDaysFile("index.json"), false);
	});

	it("splits a day into numbers, text and lists for Home", () => {
		const row = dayRowOf("2026-10-01", {
			date: "2026-10-01",
			steps: 8000,
			hrv_status: "BALANCED",
			empty: "",
			workouts: [{ type: "running" }, "stray"],
			health_snapshots: [],
		});
		assert.deepEqual(row, {
			date: "2026-10-01",
			values: { steps: 8000 },
			text: { hrv_status: "BALANCED" },
			workouts: [{ type: "running" }],
		});
	});
});
