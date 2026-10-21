import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Activity } from "../src/garmin/endpoints";
import { fingerprintOf, listKey, markFor, MAX_QUIET_MS, nextSyncState, shouldSkip, UPLOAD_SETTLE_MS, type Probe } from "../src/sync/freshness";
import { ALL_GROUPS } from "../src/sync/metrics";
import { parseSyncState, serializeSyncState, type SyncState } from "../src/sync/sync-state";

const run = (id: number, name = `Run ${id}`, day = "2026-10-20"): Activity =>
	({ activityId: id, activityName: name, startTimeLocal: `${day} 07:00:00`, beginTimestamp: Date.parse(`${day}T05:00:00Z`), activityType: { typeKey: "running" }, distance: 10_000 }) as unknown as Activity;

const PAGE = [run(3), run(2), run(1)];
const KEY = listKey(PAGE);
const FINGERPRINT = fingerprintOf({ groups: ALL_GROUPS, units: "auto", dayDetails: "all", dataVersion: 1, pluginVersion: "1.2.0" });

/** Noon on Oct 21, local time, and a state a clean sync left two hours earlier. */
const NOW = new Date(2026, 9, 21, 12, 0).getTime();
const UPLOAD = new Date(NOW - 3 * 3_600_000).toISOString();
const STATE: SyncState = { syncedAt: new Date(NOW - 2 * 3_600_000).toISOString(), deviceUpload: UPLOAD, list: KEY, fingerprint: FINGERPRINT };
const probe = (over: Partial<Probe> = {}): Probe => ({ device: { ok: true, upload: UPLOAD, payload: {} }, list: { ok: true, page: PAGE, key: KEY }, ...over });
const ctx = { now: NOW, fingerprint: FINGERPRINT };

describe("the probe", () => {
	it("skips when nothing moved since a clean sync the same day", () => {
		assert.deepEqual(shouldSkip(STATE, probe(), ctx), { skip: true });
	});

	it("syncs in full for every reason a skip could miss something", () => {
		const reason = (state: SyncState | null, p = probe(), c = ctx) => {
			const got = shouldSkip(state, p, c);
			return got.skip ? "skip" : got.reason;
		};
		assert.equal(reason(null), "no-state");
		assert.equal(reason({ syncedAt: STATE.syncedAt, deviceUpload: UPLOAD }), "dirty");
		assert.equal(reason({ ...STATE, fingerprint: "other" }), "settings");
		assert.equal(reason({ ...STATE, syncedAt: new Date(2026, 9, 20, 23, 0).toISOString() }), "new-day");
		assert.equal(reason({ ...STATE, syncedAt: new Date(NOW - MAX_QUIET_MS).toISOString() }), "quiet");
		assert.equal(reason(STATE, probe({ device: { ok: false } })), "device-unknown");
		assert.equal(reason(STATE, probe({ device: { ok: true, upload: new Date(NOW - 60_000).toISOString(), payload: {} } })), "upload");
		// The last sync ran right after an upload: Garmin may still have been scoring it.
		assert.equal(reason({ ...STATE, syncedAt: new Date(Date.parse(UPLOAD) + UPLOAD_SETTLE_MS - 1).toISOString() }), "settling");
		assert.equal(reason(STATE, probe({ list: { ok: true, page: [run(4), ...PAGE], key: listKey([run(4), ...PAGE]) } })), "activities");
		assert.equal(reason(STATE, probe({ list: { ok: false } })), "activities");
	});

	it("keys the list by what the vault keeps of it: a rename counts, an unread field doesn't", () => {
		assert.notEqual(listKey([run(3, "Long run"), run(2), run(1)]), KEY);
		const noisy = PAGE.map((a) => ({ ...a, ownerProfileImageUrlSmall: "https://example.com/x.png" }) as Activity);
		assert.equal(listKey(noisy), KEY);
		assert.equal(fingerprintOf({ groups: [...ALL_GROUPS].reverse(), units: "auto", dayDetails: "all", dataVersion: 1, pluginVersion: "1.2.0" }), FINGERPRINT);
	});
});

describe("what a full sync covers and leaves behind", () => {
	it("goes back to the last upload seen, or to the last sync when the watch hasn't uploaded since", () => {
		const old: SyncState = { syncedAt: new Date(2026, 9, 21, 9, 0).toISOString(), deviceUpload: new Date(2026, 9, 15, 20, 0).toISOString() };
		// The watch uploaded again: the days since its last upload may have changed.
		assert.equal(markFor(old, probe({ device: { ok: true, upload: new Date(2026, 9, 21, 11, 0).toISOString(), payload: {} } })), "2026-10-15");
		// Still in a drawer: only the days since the last sync.
		assert.equal(markFor(old, probe({ device: { ok: true, upload: old.deviceUpload, payload: {} } })), "2026-10-21");
		assert.equal(markFor(null, probe()), null);
	});

	it("records the keys only after a clean run, and keeps the old upload when the probe couldn't say", () => {
		const started = new Date(NOW).toISOString();
		assert.deepEqual(nextSyncState(STATE, probe(), { startedAt: started, fingerprint: FINGERPRINT, failed: 0, warnings: [] }), { syncedAt: started, deviceUpload: UPLOAD, list: KEY, fingerprint: FINGERPRINT });
		assert.deepEqual(nextSyncState(STATE, probe({ device: { ok: false } }), { startedAt: started, fingerprint: FINGERPRINT, failed: 1, warnings: [] }), { syncedAt: started, deviceUpload: UPLOAD });
		// A warning the last run had too doesn't make the run unclean.
		const warned = nextSyncState(STATE, probe(), { startedAt: started, fingerprint: FINGERPRINT, failed: 0, warnings: ["VO2 Max: HTTP 500"] });
		assert.equal(warned.list, undefined);
		const again = nextSyncState(warned, probe(), { startedAt: started, fingerprint: FINGERPRINT, failed: 0, warnings: ["VO2 Max: HTTP 500"] });
		assert.equal(again.list, KEY);
	});

	it("round-trips the state file, and an older build's file still reads", () => {
		const state: SyncState = { ...STATE, warn: "abc123" };
		assert.deepEqual(parseSyncState(serializeSyncState(state)), state);
		assert.deepEqual(parseSyncState(JSON.stringify({ version: 1, syncedAt: STATE.syncedAt })), { syncedAt: STATE.syncedAt });
		assert.deepEqual(parseSyncState(JSON.stringify({ version: 1, syncedAt: STATE.syncedAt, list: "../../etc" })), { syncedAt: STATE.syncedAt });
	});
});
