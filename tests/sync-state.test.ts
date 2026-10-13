import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { toIsoDate } from "../src/garmin/endpoints";
import { deviceUploadOf, markOf, parseSyncState, serializeSyncState } from "../src/sync/sync-state";

const SYNCED = "2026-09-12T08:30:00.000Z";
const UPLOAD = "2026-09-08T21:10:00.000Z";
const local = (iso: string) => toIsoDate(new Date(iso));

describe("sync state", () => {
	it("reads back what it wrote", () => {
		assert.deepEqual(parseSyncState(serializeSyncState({ syncedAt: SYNCED, deviceUpload: UPLOAD })), {
			syncedAt: SYNCED,
			deviceUpload: UPLOAD,
		});
		assert.deepEqual(parseSyncState(serializeSyncState({ syncedAt: SYNCED })), { syncedAt: SYNCED });
	});

	it("trusts nothing without a sync time it can read", () => {
		assert.equal(parseSyncState("not json"), null);
		assert.equal(parseSyncState("[]"), null);
		assert.equal(parseSyncState(JSON.stringify({ deviceUpload: UPLOAD })), null);
		assert.equal(parseSyncState(JSON.stringify({ syncedAt: "yesterday-ish" })), null);
	});

	it("drops an upload time it cannot read, keeping the sync time", () => {
		assert.deepEqual(parseSyncState(JSON.stringify({ syncedAt: SYNCED, deviceUpload: 5 })), { syncedAt: SYNCED });
	});
});

describe("markOf", () => {
	it("is null before the first sync", () => {
		assert.equal(markOf(null), null);
	});

	it("is the watch's upload, which a watch left offline keeps behind the sync", () => {
		assert.equal(markOf({ syncedAt: SYNCED, deviceUpload: UPLOAD }), local(UPLOAD));
	});

	it("is the sync's own time without an upload", () => {
		assert.equal(markOf({ syncedAt: SYNCED }), local(SYNCED));
	});

	it("is the earlier of the two when the clocks disagree", () => {
		assert.equal(markOf({ syncedAt: UPLOAD, deviceUpload: SYNCED }), local(UPLOAD));
	});
});

describe("deviceUploadOf", () => {
	it("reads the upload time mylastused reports", () => {
		assert.equal(deviceUploadOf({ lastUsedDeviceUploadTime: Date.parse(UPLOAD) }), UPLOAD);
	});

	it("is undefined when there is none", () => {
		assert.equal(deviceUploadOf(null), undefined);
		assert.equal(deviceUploadOf({ lastUsedDeviceName: "Forerunner" }), undefined);
	});
});
