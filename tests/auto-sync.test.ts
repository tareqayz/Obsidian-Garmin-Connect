import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { AUTO_SYNC_EVERY_MS, AutoSync, autoSyncDue, BACKOFF_MS, COALESCE_MS, nextLocal, parseLocal, type AutoSyncLocal } from "../src/sync/auto-sync";
import type { SyncOutcome } from "../src/sync/sync-outcome";

/** Noon, local time: far from midnight either way. */
const NOON = new Date(2026, 9, 21, 12, 0).getTime();
const MIN = 60_000;
const at = new Date(NOON).toISOString();

describe("when a sync is due on its own", () => {
	it("is due on a first run, 15 minutes after the last sync on any device, and on a new day", () => {
		assert.equal(autoSyncDue(NOON, null, null), true);
		assert.equal(autoSyncDue(NOON, { checkedAt: NOON - 10 * MIN }, null), false);
		assert.equal(autoSyncDue(NOON, { checkedAt: NOON - AUTO_SYNC_EVERY_MS }, null), true);
		// Another device synced five minutes ago: not yet, whatever this one did.
		assert.equal(autoSyncDue(NOON, { checkedAt: NOON - 60 * MIN }, NOON - 5 * MIN), false);
		// Two minutes after midnight, the last check from before it: a new day is due at once.
		const justAfter = new Date(2026, 9, 22, 0, 2).getTime();
		assert.equal(autoSyncDue(justAfter, { checkedAt: justAfter - 4 * MIN }, null), true);
	});

	it("waits out a failure's backoff, then is due again", () => {
		const local: AutoSyncLocal = { checkedAt: NOON - 60 * MIN, retryAt: NOON + MIN };
		assert.equal(autoSyncDue(NOON, local, null), false);
		assert.equal(autoSyncDue(NOON + MIN, local, null), true);
	});

	it("remembers a check, or keeps the last one and waits after a failure", () => {
		const outcome = (o: Partial<SyncOutcome>): SyncOutcome => ({ kind: "synced", days: 1, failed: 0, at, ...o });
		const local = { checkedAt: NOON - 60 * MIN };
		assert.deepEqual(nextLocal(local, outcome({}), NOON), { checkedAt: NOON });
		assert.deepEqual(nextLocal(local, outcome({ kind: "up-to-date", days: 0 }), NOON), { checkedAt: NOON });
		assert.deepEqual(nextLocal(local, outcome({ kind: "failed", cause: "offline" }), NOON), { checkedAt: local.checkedAt, retryAt: NOON + BACKOFF_MS.offline });
		assert.deepEqual(nextLocal(local, outcome({ kind: "stopped", cause: "rate-limited" }), NOON), { checkedAt: local.checkedAt, retryAt: NOON + 5 * MIN });
		// Stopped with no cause — cancelled, or past the history's start — is a check like any other.
		assert.deepEqual(nextLocal(local, outcome({ kind: "stopped" }), NOON), { checkedAt: NOON });
	});

	it("reads back only what it wrote", () => {
		assert.deepEqual(parseLocal({ checkedAt: 5, retryAt: 9 }), { checkedAt: 5, retryAt: 9 });
		assert.deepEqual(parseLocal({ checkedAt: 5, retryAt: "soon" }), { checkedAt: 5 });
		assert.equal(parseLocal("1792580426588"), null);
		assert.equal(parseLocal(null), null);
	});
});

describe("the automatic sync's timer", () => {
	function setup(opts: { allowed?: () => boolean; local?: AutoSyncLocal | null; syncedAt?: number | null; startDelay?: number } = {}) {
		let now = NOON;
		const timers: Array<{ at: number; run: () => void; id: number }> = [];
		let nextId = 1;
		let local = opts.local ?? null;
		const syncs: Array<(outcome: SyncOutcome | null) => void> = [];
		const auto = new AutoSync(
			{
				now: () => now,
				allowed: opts.allowed ?? (() => true),
				loadLocal: () => local,
				saveLocal: (next) => void (local = next),
				syncedAt: async () => opts.syncedAt ?? null,
				sync: () => new Promise((done) => syncs.push(done)),
				setTimeout: (run, ms) => {
					const id = nextId++;
					timers.push({ at: now + ms, run, id });
					return id;
				},
				clearTimeout: (id) => void timers.splice(timers.findIndex((t) => t.id === id) >>> 0, 1),
			},
			opts.startDelay ?? 0,
		);
		const settle = () => new Promise<void>((done) => setImmediate(done));
		const advance = async (ms: number) => {
			now += ms;
			for (const t of timers.filter((t) => t.at <= now)) {
				timers.splice(timers.indexOf(t), 1);
				t.run();
			}
			await settle();
		};
		return { auto, syncs, advance, settle, local: () => local, timers };
	}

	it("makes a burst of asks one sync, after the start's delay", async () => {
		const { auto, syncs, advance } = setup({ startDelay: 5_000 });
		auto.poke();
		auto.poke();
		auto.poke();
		await advance(COALESCE_MS);
		assert.equal(syncs.length, 0, "not before the vault is indexed");
		await advance(5_000);
		assert.equal(syncs.length, 1);
	});

	it("runs one at a time, and remembers the check", async () => {
		const { auto, syncs, advance, settle, local } = setup();
		const first = auto.check();
		const second = auto.check();
		await settle();
		assert.equal(syncs.length, 1);
		await advance(30_000);
		syncs[0]!({ kind: "up-to-date", days: 0, failed: 0, at });
		await Promise.all([first, second]);
		assert.deepEqual(local(), { checkedAt: NOON + 30_000 });
		// Asked again a minute later: not due.
		auto.poke();
		await advance(COALESCE_MS);
		assert.equal(syncs.length, 1);
	});

	it("starts nothing when it may not — the setting off, signed out, another sync running", async () => {
		const { auto, syncs, settle } = setup({ allowed: () => false });
		await auto.check();
		await settle();
		assert.equal(syncs.length, 0);
	});

	it("leaves its record alone when the runner was busy with a sync of its own", async () => {
		const { auto, syncs, settle, local } = setup({ local: { checkedAt: NOON - 60 * MIN } });
		const run = auto.check();
		await settle();
		syncs[0]!(null);
		await run;
		assert.deepEqual(local(), { checkedAt: NOON - 60 * MIN });
	});
});
