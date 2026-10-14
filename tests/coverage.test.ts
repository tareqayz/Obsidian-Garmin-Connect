import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	addDays,
	daysIn,
	detailVersionOf,
	gaps,
	parseDayCoverage,
	parseRunCoverage,
	serializeDayCoverage,
	serializeRunCoverage,
	seriesVersion,
	stale,
	versionOn,
	type Span,
} from "../src/sync/coverage";
import { serializeActivityDetail } from "../src/sync/activity-detail";

describe("day coverage spans", () => {
	it("joins consecutive days of one version and keeps a gap a gap", () => {
		assert.deepEqual(addDays([], ["2026-10-03", "2026-10-01", "2026-10-02", "2026-10-05"], 1), [
			["2026-10-01", "2026-10-03", 1],
			["2026-10-05", "2026-10-05", 1],
		]);
	});

	it("gives a day fetched again the new version, splitting the span it sat in", () => {
		const spans: Span[] = [["2026-10-01", "2026-10-10", 0]];
		assert.deepEqual(addDays(spans, ["2026-10-04", "2026-10-05"], 1), [
			["2026-10-01", "2026-10-03", 0],
			["2026-10-04", "2026-10-05", 1],
			["2026-10-06", "2026-10-10", 0],
		]);
		// Filling the gap between two spans of one version joins them.
		assert.deepEqual(addDays([["2026-10-01", "2026-10-02", 1], ["2026-10-04", "2026-10-05", 1]], ["2026-10-03"], 1), [["2026-10-01", "2026-10-05", 1]]);
		// Across a month and a year.
		assert.deepEqual(addDays([], ["2025-12-31", "2026-01-01"], 1), [["2025-12-31", "2026-01-01", 1]]);
	});

	it("answers a day's version, the stretches never fetched and those fetched at an older version", () => {
		const spans: Span[] = [
			["2026-10-01", "2026-10-03", 0],
			["2026-10-06", "2026-10-07", 1],
		];
		assert.deepEqual([versionOn(spans, "2026-10-02"), versionOn(spans, "2026-10-04"), versionOn(spans, "2026-10-07")], [0, undefined, 1]);
		const range = { from: "2026-09-30", to: "2026-10-08" };
		assert.deepEqual(gaps(spans, range), [
			{ from: "2026-09-30", to: "2026-09-30" },
			{ from: "2026-10-04", to: "2026-10-05" },
			{ from: "2026-10-08", to: "2026-10-08" },
		]);
		assert.deepEqual(stale(spans, range, 1), [{ from: "2026-10-01", to: "2026-10-03" }]);
		assert.deepEqual(stale(spans, range, 2), [
			{ from: "2026-10-01", to: "2026-10-03" },
			{ from: "2026-10-06", to: "2026-10-07" },
		]);
		assert.equal(daysIn(gaps(spans, range)), 4);
		assert.deepEqual(gaps(spans, { from: "2026-10-09", to: "2026-10-01" }), []);
	});

	it("round-trips the file, dropping what isn't a span and refusing another version", () => {
		const spans: Span[] = [
			["2026-10-01", "2026-10-03", 0],
			["2026-10-04", "2026-10-07", 1],
		];
		const text = serializeDayCoverage({ spans });
		assert.deepEqual(parseDayCoverage(text), { spans });
		assert.equal(serializeDayCoverage(parseDayCoverage(text)!), text);
		const messy = JSON.stringify({ version: 1, spans: [["2026-10-01", "2026-10-02", 1], ["2026-10-09", "2026-10-08", 1], ["x", "2026-10-02", 1], ["2026-10-05", "2026-10-05", 1.5], "nope"] });
		assert.deepEqual(parseDayCoverage(messy), { spans: [["2026-10-01", "2026-10-02", 1]] });
		assert.equal(parseDayCoverage(JSON.stringify({ version: 2, spans: [] })), null);
		assert.equal(parseDayCoverage("not json"), null);
	});
});

describe("a series file's version, for the first build of the coverage", () => {
	const night = { sleepLevels: [{ start: 0, end: 1, level: 1 }] };
	const detail = { start: 0, end: 1 };
	it("reads today's files as 1", () => {
		assert.equal(seriesVersion({ stress: [[1, 20]], heartRate: [[1, 50]], steps: [{ start: 1, end: 2, steps: 9 }], dayStart: 1, ...night, sleep: detail }), 1);
		// No floors, no minutes and no night that day: still today's.
		assert.equal(seriesVersion({ heartRate: [[1, 50]], dayStart: 1 }), 1);
	});

	it("reads files from before the day's start and the night's detail as 0", () => {
		assert.equal(seriesVersion({ stress: [[1, 20]], heartRate: [[1, 50]], ...night }), 0);
		assert.equal(seriesVersion({ heartRate: [[1, 50]], dayStart: 1, ...night }), 0);
	});

	it("reads a night alone as a day whose details were never fetched", () => {
		assert.equal(seriesVersion(night), undefined);
		assert.equal(seriesVersion({ ...night, sleep: detail }), undefined);
		assert.equal(seriesVersion(null), undefined);
	});
});

describe("run coverage", () => {
	it("round-trips by id, in id order", () => {
		const runs = new Map([
			[24589239622, 1],
			[19938710621, 5],
		]);
		const text = serializeRunCoverage(runs);
		assert.ok(text.indexOf("19938710621") < text.indexOf("24589239622"));
		assert.deepEqual(parseRunCoverage(text), runs);
		assert.deepEqual(parseRunCoverage(JSON.stringify({ version: 1, runs: { "12": 5, x: 5, "13": "5" } })), new Map([[12, 5]]));
		assert.equal(parseRunCoverage(JSON.stringify({ version: 1, runs: [] })), null);
	});

	it("reads a run file's version from the start of its text", () => {
		const text = serializeActivityDetail({ version: 5, id: 7 } as never);
		assert.equal(detailVersionOf(text), 5);
		assert.equal(detailVersionOf('{"version":1,"id":3}'), 1);
		assert.equal(detailVersionOf('{"id":3,"version":5}'), undefined);
	});
});
