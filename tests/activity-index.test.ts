import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Activity } from "../src/garmin/endpoints";
import {
	byYear,
	isYearFile,
	mergeListing,
	parseMeta,
	parseYear,
	rowOf,
	serializeMeta,
	serializeYear,
	type ActivityRow,
} from "../src/sync/activity-index";

const HOUR = 3_600_000;

/** The run the phone showed on 2026-10-03, as the activity list sends it (trimmed). */
const dubaiRun: Activity = {
	activityId: 20460000001,
	activityName: "Dubai Running",
	startTimeLocal: "2026-10-03 14:59:19",
	startTimeGMT: "2026-10-03 10:59:19",
	beginTimestamp: 1791025159000,
	activityType: { typeId: 1, typeKey: "running", parentTypeId: 17, isHidden: false },
	distance: 8008.75,
	duration: 2493.6399536132812,
	elevationGain: 52,
	calories: 581,
	averageHR: 151,
};

function row(id: number, begin: number, over: Partial<ActivityRow> = {}): ActivityRow {
	const start = new Date(begin).toISOString().slice(0, 19);
	return { id, type: "running", typeId: 1, parentTypeId: 17, start, begin, distance: 5000, ...over };
}

describe("rowOf", () => {
	it("keeps Garmin's raw metres and seconds, and the local start", () => {
		assert.deepEqual(rowOf(dubaiRun), {
			id: 20460000001,
			name: "Dubai Running",
			type: "running",
			typeId: 1,
			parentTypeId: 17,
			start: "2026-10-03T14:59:19",
			begin: 1791025159000,
			distance: 8008.75,
			duration: 2493.64,
			ascent: 52,
			calories: 581,
		});
	});

	it("leaves out what an activity does not have", () => {
		const yoga = rowOf({
			activityId: 1,
			activityName: "Yoga",
			startTimeLocal: "2026-09-30 06:10:00",
			beginTimestamp: 1790748600000,
			activityType: { typeId: 163, typeKey: "yoga", parentTypeId: 29 },
			distance: null,
			duration: 1800,
			elevationGain: null,
			calories: 90,
		});
		assert.deepEqual(Object.keys(yoga!), ["id", "name", "type", "typeId", "parentTypeId", "start", "begin", "duration", "calories"]);
	});

	it("falls back to the GMT start when there is no timestamp", () => {
		const r = rowOf({ ...dubaiRun, beginTimestamp: undefined });
		assert.equal(r!.begin, Date.UTC(2026, 9, 3, 10, 59, 19));
	});

	it("skips an activity without an id or a start", () => {
		assert.equal(rowOf({ ...dubaiRun, activityId: undefined }), null);
		assert.equal(rowOf({ ...dubaiRun, startTimeLocal: undefined }), null);
	});
});

describe("mergeListing", () => {
	const t0 = Date.UTC(2026, 8, 1);
	const index = [row(1, t0), row(2, t0 + 24 * HOUR), row(3, t0 + 60 * HOUR), row(4, t0 + 72 * HOUR)];

	it("adds new activities and refreshes the ones it lists", () => {
		const listing = [row(5, t0 + 96 * HOUR), row(4, t0 + 72 * HOUR, { name: "Renamed" }), row(3, t0 + 60 * HOUR)];
		const merged = mergeListing(index, listing, false);
		assert.deepEqual(merged.map((r) => r.id), [5, 4, 3, 2, 1]);
		assert.equal(merged[1]!.name, "Renamed");
	});

	it("drops an activity Garmin stopped listing, well inside the window", () => {
		// Lists 4 and 2, oldest at t0+24h: 3 (t0+60h) is more than a day inside it, so it was deleted.
		const merged = mergeListing(index, [row(4, t0 + 72 * HOUR), row(2, t0 + 24 * HOUR)], false);
		assert.deepEqual(merged.map((r) => r.id), [4, 2, 1]);
	});

	it("keeps a missing activity within a day of the window's edge, and everything older", () => {
		const nearEdge = [...index, row(6, t0 + 30 * HOUR)];
		const merged = mergeListing(nearEdge, [row(4, t0 + 72 * HOUR), row(3, t0 + 60 * HOUR), row(2, t0 + 24 * HOUR)], false);
		assert.deepEqual(merged.map((r) => r.id), [4, 3, 6, 2, 1]);
	});

	it("replaces everything with a complete listing", () => {
		const merged = mergeListing(index, [row(9, t0 + 200 * HOUR), row(1, t0)], true);
		assert.deepEqual(merged.map((r) => r.id), [9, 1]);
	});

	it("ignores an empty listing rather than wiping the index", () => {
		assert.deepEqual(mergeListing(index, [], true).map((r) => r.id), [4, 3, 2, 1]);
	});

	it("changes nothing the second time round", () => {
		const listing = [row(5, t0 + 96 * HOUR), row(4, t0 + 72 * HOUR)];
		const once = mergeListing(index, listing, false);
		const twice = mergeListing(once, listing, false);
		assert.equal(serializeYear("2026", twice), serializeYear("2026", once));
	});
});

describe("year files", () => {
	it("files an activity under its local year, whatever the GMT one", () => {
		const newYearsEve = row(1, Date.UTC(2026, 0, 1, 0, 30), { start: "2025-12-31T20:30:00" });
		const years = byYear([newYearsEve, row(2, Date.UTC(2026, 0, 2))]);
		assert.deepEqual([...years.keys()].sort(), ["2025", "2026"]);
		assert.deepEqual(years.get("2025")!.map((r) => r.id), [1]);
	});

	it("writes one row per line in a fixed order, and reads it back", () => {
		const rows = [row(1, Date.UTC(2026, 8, 1)), rowOf(dubaiRun)!];
		const text = serializeYear("2026", rows);
		assert.equal(text.split("\n")[0], "{");
		assert.match(text, /^\t\t\{"id":20460000001,"name":"Dubai Running","type":"running",/m);
		// Newest first.
		assert.ok(text.indexOf("20460000001") < text.indexOf('"id":1,'));
		assert.deepEqual(parseYear(text), [rowOf(dubaiRun), rows[0]]);
		assert.equal(serializeYear("2026", parseYear(text)), text);
	});

	it("writes an empty year as an empty list", () => {
		assert.deepEqual(parseYear(serializeYear("2024", [])), []);
	});

	it("drops malformed rows and survives a malformed file", () => {
		const text = JSON.stringify({ activities: [{ id: 1 }, { id: 2, type: "running", start: "2026-09-01T07:00:00", begin: 5, distance: "far" }] });
		assert.deepEqual(parseYear(text), [{ id: 2, type: "running", start: "2026-09-01T07:00:00", begin: 5 }]);
		assert.deepEqual(parseYear("{ not json"), []);
	});

	it("reads only year files, not sync-conflict copies", () => {
		assert.ok(isYearFile("2026.json"));
		assert.ok(!isYearFile("2026 2.json"));
		assert.ok(!isYearFile("index.json"));
	});
});

describe("index meta", () => {
	it("round-trips and rejects another version", () => {
		const meta = { version: 1 as const, complete: true, units: "metric" as const, total: 338 };
		assert.deepEqual(parseMeta(serializeMeta(meta)), meta);
		assert.equal(parseMeta('{"version":2,"complete":true}'), null);
		assert.equal(parseMeta("nope"), null);
	});
});
