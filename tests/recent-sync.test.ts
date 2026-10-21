import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { GarminApi } from "../src/garmin/endpoints";
import { GarminRateLimitError } from "../src/garmin/errors";
import { MemoryTokenStore } from "../src/garmin/tokens";
import { DEFAULT_SETTINGS, defaultData, type GarminSettings } from "../src/settings-data";
import { PACE } from "../src/sync/pace";
import { SyncRunner } from "../src/sync/runner";
import { failedOutcome, outcomeLine, outcomeText, type SyncOutcome } from "../src/sync/sync-outcome";
import { FakeGarmin } from "./support/fake-garmin";
import { MemoryVault } from "./support/memory-vault";
import { clearNotices, notices } from "./support/obsidian";
import { VirtualClock } from "./support/virtual-clock";

/** Obsidian's DOM helpers, as far as the progress notice uses them: nothing is drawn in a test. */
const element = () => ({ className: "", textContent: "", style: {}, append() {} });
Object.assign(globalThis, { createFragment: element, createDiv: element, createSpan: element });

describe("a sync's outcome in words", () => {
	const at = "2026-10-21T13:05:00.000Z";
	it("says what changed, and nothing about requests", () => {
		assert.equal(outcomeText({ kind: "up-to-date", days: 0, failed: 0, at }), "Up to date.");
		assert.equal(outcomeText({ kind: "synced", days: 1, failed: 0, at }), "1 day updated.");
		assert.equal(outcomeText({ kind: "synced", days: 3, failed: 1, at }), "3 days updated, 1 failed.");
		assert.equal(outcomeText({ kind: "stopped", days: 2, failed: 0, reason: "Garmin asked to slow down", at }), "2 days updated, stopped: Garmin asked to slow down.");
		assert.equal(outcomeText({ kind: "stopped", days: 0, failed: 0, at }), "Stopped.");
		assert.equal(outcomeText(failedOutcome(new GarminRateLimitError("x"), at)), "Couldn't sync: Garmin asked to slow down.");
	});

	it("puts Home's line beside ↻ in two or three words", () => {
		const time = () => "1:05 PM";
		assert.equal(outcomeLine({ kind: "synced", days: 3, failed: 0, at }, time), "Synced 1:05 PM");
		assert.equal(outcomeLine({ kind: "up-to-date", days: 0, failed: 0, at }, time), "Synced 1:05 PM");
		assert.equal(outcomeLine(failedOutcome(new Error("x"), at), time), "Couldn't sync");
	});
});

describe("the recent sync, against a simulated Garmin", () => {
	async function setup() {
		const clock = new VirtualClock(Date.now());
		clock.install();
		const vault = new MemoryVault();
		const local = new Map<string, unknown>();
		const app = { vault, loadLocalStorage: (key: string) => local.get(key) ?? null, saveLocalStorage: (key: string, value: unknown) => local.set(key, value) } as unknown as App;
		// Not set up: no history download joins in after each sync.
		const settings: GarminSettings = { ...DEFAULT_SETTINGS, units: "metric", data: defaultData() };
		const http = new FakeGarmin(clock, 250, []);
		const tokens = new MemoryTokenStore();
		await tokens.save({ refreshToken: "refresh", diClientId: "client", savedAt: 1 });
		const api = new GarminApi({ http, store: tokens, now: clock.now, wait: clock.wait, limits: PACE.limits });
		await api.restore();
		const runner = new SyncRunner(app, api, () => settings, (row) => ({ id: row.id, date: row.start.slice(0, 10), run: false, profile: "other" }), { id: "sim", label: "Sim" }, "1.2.0");
		const sync = async (trigger: Parameters<SyncRunner["syncRecent"]>[0]) => {
			let outcome: SyncOutcome | null | undefined;
			void runner.syncRecent(trigger).then((o) => (outcome = o));
			await clock.runUntil(() => outcome !== undefined, 3_600_000);
			return outcome!;
		};
		return { clock, vault, http, sync };
	}

	it("stops at its probe when started on its own and nothing moved; ↻ always syncs in full", async () => {
		const { clock, vault, http, sync } = await setup();
		try {
			// Two full syncs: the second one's state is clean even if the first one's warned.
			await sync("command");
			await sync("command");
			const asked = http.asked.length;
			const writes = vault.writes.length;
			clearNotices();
			const quiet = await sync("auto");
			assert.equal(quiet.kind, "up-to-date");
			// The two requests of the probe, and nothing else.
			assert.deepEqual(http.asked.slice(asked).map((u) => u.split("?")[0]!.split("/").slice(-1)[0]).sort(), ["activities", "mylastused"]);
			assert.equal(vault.writes.length, writes);
			assert.deepEqual(notices, []);
			// Home's button: never a skip.
			await sync("button");
			assert.ok(http.asked.length - asked > 20, String(http.asked.length - asked));
		} finally {
			clock.uninstall();
		}
	});

	it("tells the palette's sync how it went, and stays quiet for Home's", async () => {
		const { clock, sync } = await setup();
		try {
			clearNotices();
			await sync("command");
			assert.ok(notices.some((n) => /^Garmin: (up to date|\d+ days? updated)/.test(n)), notices.join(" | "));
			clearNotices();
			await sync("button");
			assert.deepEqual(notices.filter((n) => n.startsWith("Garmin:")), []);
		} finally {
			clock.uninstall();
		}
	});
});
