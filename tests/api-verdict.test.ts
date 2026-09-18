import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { CatalogueEntry, RecordedSchema } from "../scripts/api/catalogue";
import type { Window } from "../scripts/api/probes";
import { inferAll } from "../scripts/api/schema";
import { changed, check, failed, isFatal, report } from "../scripts/api/verdict";

const entry: CatalogueEntry = {
	id: "max-metrics-range",
	method: "GET",
	path: "/metrics-service/metrics/maxmet/daily/{startDate}/{endDate}",
	service: "metrics-service",
	plugin: "GarminApi.maxMetrics",
	check: true,
	critical: ["[].calendarDate", "[].generic.vo2MaxPreciseValue"],
	schema: "schema/max-metrics-range.json",
};

const day = (extra: Record<string, unknown> = {}) => ({
	calendarDate: "2026-09-17",
	generic: { vo2MaxPreciseValue: 51.2, vo2MaxValue: 51, ...extra },
});

function recorded(samples: unknown[]): RecordedSchema {
	return {
		endpoint: entry.id,
		path: entry.path,
		firstRecorded: "2026-09-01T00:00:00.000Z",
		updatedAt: "2026-09-17T00:00:00.000Z",
		samples: samples.length,
		shape: inferAll(samples),
	};
}

const baseline = recorded([[day()]]);

describe("check", () => {
	it("calls an endpoint with no recording new rather than broken", () => {
		const result = check(entry, [[day()]], null);
		assert.equal(result.verdict, "new");
		assert.deepEqual(result.changes, []);
	});

	it("passes an unchanged response", () => {
		assert.equal(check(entry, [[day()]], baseline).verdict, "ok");
	});

	it("does not read an empty response as a broken contract", () => {
		// A rest day, an account with the metric switched off, a date Garmin has
		// not computed yet: all normal, none of them news.
		const result = check(entry, [[]], baseline);
		assert.equal(result.verdict, "no-data");
		assert.deepEqual(result.changes, []);
	});

	it("warns, but does not fail, on a change the plugin does not read", () => {
		const result = check(entry, [[day({ heatAltitudeAcclimation: 3 })]], baseline);
		assert.equal(result.verdict, "warn");
		assert.deepEqual(
			result.changes.map((c) => c.kind),
			["field-added"],
		);
	});

	it("fails when a field the plugin reads stops arriving", () => {
		const gone = [{ calendarDate: "2026-09-17", generic: { vo2MaxValue: 51 } }];
		const result = check(entry, [gone], baseline);
		assert.equal(result.verdict, "fail");
		assert.deepEqual(
			result.critical.find((c) => c.path === "[].generic.vo2MaxPreciseValue"),
			{ path: "[].generic.vo2MaxPreciseValue", status: "missing" },
		);
	});

	it("fails when the whole container Garmin nests it in disappears", () => {
		const flattened = [{ calendarDate: "2026-09-17", vo2MaxPreciseValue: 51.2 }];
		const result = check(entry, [flattened], baseline);
		assert.equal(result.verdict, "fail");
		assert.ok(result.changes.some((c) => c.kind === "field-removed" && c.path === "[].generic"));
	});

	// The open VO2 Max question in TODO.md looks exactly like this from inside a
	// note: the sync runs, the property never appears, and nothing errors.
	it("separates a field that is present but always null from one that is absent", () => {
		const empty = [{ calendarDate: "2026-09-17", generic: { vo2MaxPreciseValue: null, vo2MaxValue: null } }];
		const result = check(entry, [empty], recorded([empty]));
		assert.equal(result.verdict, "ok");
		assert.equal(
			result.critical.find((c) => c.path === "[].generic.vo2MaxPreciseValue")?.status,
			"null",
		);
	});

	it("stays quiet when only some days carry the metric", () => {
		const result = check(entry, [[day(), { calendarDate: "2026-09-16" }]], baseline);
		assert.equal(result.critical.find((c) => c.path === "[].generic.vo2MaxPreciseValue")?.status, "ok");
		assert.notEqual(result.verdict, "fail");
	});
});

describe("isFatal", () => {
	const critical = ["[].generic.vo2MaxPreciseValue"];

	it("never fails on something new", () => {
		assert.equal(isFatal({ path: "[].other", kind: "field-added", detail: "" }, critical), false);
		assert.equal(isFatal({ path: "[].generic.vo2MaxPreciseValue", kind: "type-widened", detail: "" }, critical), false);
	});

	it("fails on a removal at or above a path the plugin reads", () => {
		assert.equal(isFatal({ path: "[].generic.vo2MaxPreciseValue", kind: "field-removed", detail: "" }, critical), true);
		assert.equal(isFatal({ path: "[].generic", kind: "field-removed", detail: "" }, critical), true);
	});

	it("ignores a removal somewhere the plugin never looks", () => {
		assert.equal(isFatal({ path: "[].cycling", kind: "field-removed", detail: "" }, critical), false);
	});

	it("fails when the response itself changes kind, critical paths or not", () => {
		assert.equal(isFatal({ path: "", kind: "container-changed", detail: "" }, []), true);
	});
});

describe("report", () => {
	const window: Window = {
		days: ["2026-09-17", "2026-09-16", "2026-09-15"],
		rangeStart: "2026-09-04",
		rangeEnd: "2026-09-17",
	};

	it("leads with the counts and the window it sampled", () => {
		const text = report([check(entry, [[day()]], baseline)], window, "2026-09-18");
		assert.match(text, /# Garmin API contract — 2026-09-18/);
		assert.match(text, /1 endpoints · 0 failing/);
		assert.match(text, /Sampled 2026-09-17, 2026-09-16, 2026-09-15/);
	});

	it("emphasises the changes that broke something and names the dead path", () => {
		const gone = [{ calendarDate: "2026-09-17", generic: { vo2MaxValue: 51 } }];
		const text = report([check(entry, [gone], baseline)], window, "2026-09-18");
		assert.match(text, /\*\*field-removed\*\* `\[\]\.generic\.vo2MaxPreciseValue`/);
		assert.match(text, /\| `\[\]\.generic\.vo2MaxPreciseValue` \| missing \|/);
		assert.match(text, /GarminApi\.maxMetrics/);
	});

	it("reports no values, only field names and types", () => {
		// The report goes into an issue body, which may be public.
		const text = report([check(entry, [[day()]], null)], window, "2026-09-18");
		assert.equal(text.includes("51.2"), false);
		assert.equal(text.includes("2026-09-17\n"), false);
	});
});

describe("run verdicts", () => {
	const ok = check(entry, [[day()]], baseline);
	const warn = check(entry, [[day({ extra: 1 })]], baseline);
	const fail = check(entry, [[{ calendarDate: "x", generic: {} }]], baseline);

	it("fails a run on a broken contract, not on an advisory change", () => {
		assert.equal(failed([ok, warn]), false);
		assert.equal(failed([ok, fail]), true);
		assert.equal(changed([ok, warn]), true);
		assert.equal(changed([ok]), false);
	});
});
