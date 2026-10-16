import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { dropDays } from "../src/sync/coverage";
import { asideName, isConflictCopy, isReadable, NewerDataError, versionOf } from "../src/sync/file-health";

describe("file health", () => {
	it("reads a file as readable only when it is a JSON object", () => {
		assert.equal(isReadable('{"version": 1, "days": {}}'), true);
		assert.equal(isReadable('{"version": 1, "days": {"2026-10-01": {"steps": 1'), false, "cut short mid-write");
		assert.equal(isReadable('<<<<<<< HEAD\n{"version": 1}\n=======\n{"version": 1}\n>>>>>>> theirs\n'), false, "git conflict markers");
		assert.equal(isReadable(""), false);
		assert.equal(isReadable("[]"), false);
		assert.equal(isReadable("null"), false);
	});

	it("reads the version at the top of a file, a series file's after its date", () => {
		assert.equal(versionOf('{\n\t"version": 3,\n\t"year": 2026,\n\t"activities": []\n}\n'), 3);
		assert.equal(versionOf('{"date":"2026-10-16","version":2,"heartRate":[]}\n'), 2);
		assert.equal(versionOf('{\n\t"complete": true,\n\t"version": 3\n}'), undefined, "only at the top");
		assert.equal(versionOf('{"fullName": "A"}'), undefined);
		assert.equal(versionOf("not json"), undefined);
	});

	it("names a file set aside so the sync no longer reads it", () => {
		const at = new Date("2026-10-16T11:30:05Z");
		assert.equal(asideName("2026.json", at), "2026.unreadable-20261016-113005.json");
		assert.equal(asideName("index.json", at), "index.unreadable-20261016-113005.json");
		assert.equal(isConflictCopy(asideName("2026.json", at)), false, "not a conflict copy either");
	});

	it("spots the copies sync services leave beside the sync's files", () => {
		for (const name of ["2026 2.json", "index 2.json", "2026-10-16 3.json", "24706138262 2.json", "2026.sync-conflict-20261016-113005-ABCDEFG.json", "2026 (Ana's conflicted copy 2026-10-16).json", "2026 (1).json"]) {
			assert.equal(isConflictCopy(name), true, name);
		}
		for (const name of ["2026.json", "index.json", "2026-10-16.json", "24706138262.json", "notes.md", ".DS_Store", "readme.json"]) {
			assert.equal(isConflictCopy(name), false, name);
		}
	});

	it("says which file a newer build wrote and what to do", () => {
		const err = new NewerDataError("Garmin/data/days/2026.json");
		assert.equal(err.path, "Garmin/data/days/2026.json");
		assert.match(err.message, /newer version of Garmin Connect\. Update the plugin on this device/);
	});
});

describe("day coverage", () => {
	it("drops the days a test picks and keeps the rest", () => {
		const spans = [["2025-12-30", "2026-01-02", 1], ["2026-03-01", "2026-03-02", 0]] as const;
		assert.deepEqual(dropDays(spans, (date) => date.startsWith("2026-")), [["2025-12-30", "2025-12-31", 1]]);
		assert.deepEqual(dropDays(spans, (date) => date === "2026-01-01"), [["2025-12-30", "2025-12-31", 1], ["2026-01-02", "2026-01-02", 1], ["2026-03-01", "2026-03-02", 0]]);
		assert.deepEqual(dropDays([], () => true), []);
	});
});
