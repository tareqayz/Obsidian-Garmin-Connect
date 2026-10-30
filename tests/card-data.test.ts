import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { SETTLE_MS } from "../src/dashboard/data-versions";
import { CardData, type CardHost } from "../src/embeds/card-data";
import type { SyncRunner } from "../src/sync/runner";
import { serializeDays } from "../src/sync/days";
import { STRESS_INDEX } from "../src/sync/stress-index";
import { forgetParsedDays } from "../src/sync/series-store";
import { MemoryVault } from "./support/memory-vault";
import { VirtualClock } from "./support/virtual-clock";

const DATA = "Garmin/data";
const series = (date: string, extra = {}) => JSON.stringify({ date, version: 1, ...extra });

let done: Array<() => void> = [];
afterEach(() => {
	for (const undo of done.splice(0)) undo();
});

function setup() {
	forgetParsedDays();
	const clock = new VirtualClock(Date.parse("2026-10-29T12:00:00Z"));
	clock.install();
	const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
	win.setInterval = () => 1;
	win.clearInterval = () => undefined;
	const vault = new MemoryVault();
	vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-10-27", { steps: 4_000 }], ["2026-10-28", { steps: 9_000 }]])));
	vault.seed(`${DATA}/series/2026-10-27.json`, series("2026-10-27"));
	vault.seed(`${DATA}/series/2026-10-28.json`, series("2026-10-28"));
	const runner = { syncingSince: 0, backfillProgress: null, onSyncing: () => () => undefined };
	const host: CardHost = { app: vault.asApp(), dataFolder: () => DATA, sync: () => runner as unknown as SyncRunner, homeOpen: () => false };
	const cards = new CardData(host);
	done.push(() => {
		cards.dispose();
		clock.uninstall();
	});
	const reads = (path: string) => vault.reads.filter((p) => p === `${DATA}/${path}`).length;
	return { clock, vault, cards, reads };
}

describe("CardData: what every card block reads", () => {
	it("reads each file once for ten blocks opening at once", async () => {
		const { cards, reads } = setup();
		cards.acquire();
		const days = await Promise.all(Array.from({ length: 10 }, () => cards.day("2026-10-28", false)));
		assert.equal(reads("days/2026.json"), 1);
		assert.equal(reads("series/2026-10-28.json"), 1);
		assert.ok(days.every((d) => d.model.steps?.steps === 9_000));
		assert.deepEqual([days[0]!.first, days[0]!.last, days[0]!.hasRow], ["2026-10-27", "2026-10-28", true]);
	});

	it("reads a day's series again only when that day's file changes", async () => {
		const { clock, vault, cards, reads } = setup();
		cards.acquire();
		await cards.day("2026-10-28", false);
		// Another day's file, which no block shows: nothing moves.
		vault.seed(`${DATA}/series/2026-10-20.json`, series("2026-10-20"));
		cards.onFile(`${DATA}/series/2026-10-20.json`);
		await cards.day("2026-10-28", false);
		assert.equal(reads("series/2026-10-28.json"), 1);
		// This day's file: once the writes settle, it is read again.
		let told = 0;
		cards.onChange(() => told++);
		vault.seed(`${DATA}/series/2026-10-28.json`, series("2026-10-28", { checked: ["stressDay"] }));
		cards.onFile(`${DATA}/series/2026-10-28.json`);
		await clock.runUntil(() => told > 0, SETTLE_MS + 1_000);
		await cards.day("2026-10-28", false);
		assert.equal(reads("series/2026-10-28.json"), 2);
	});

	it("shows a live block the newest synced day until today syncs", async () => {
		const { cards } = setup();
		const day = await cards.day("2099-01-01", true);
		assert.equal(day.date, "2026-10-28");
		assert.equal(cards.peek("ignored", true)?.date, "2026-10-28");
	});

	it("paints a block coming back at once, while its day is current", async () => {
		const { clock, vault, cards } = setup();
		cards.acquire();
		assert.equal(cards.peek("2026-10-28", false), null);
		const day = await cards.day("2026-10-28", false);
		assert.equal(cards.peek("2026-10-28", false), day);
		vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-10-28", { steps: 9_500 }]])));
		cards.onFile(`${DATA}/days/2026.json`);
		let told = 0;
		cards.onChange(() => told++);
		await clock.runUntil(() => told > 0, SETTLE_MS + 1_000);
		assert.equal(cards.peek("2026-10-28", false), null);
	});

	it("keeps its reads a while after the last block goes, then lets them go", async () => {
		const { clock, cards, reads } = setup();
		cards.acquire();
		await cards.day("2026-10-28", false);
		cards.release();
		// A hover preview coming back within the grace: no new read.
		cards.acquire();
		await cards.day("2026-10-28", false);
		assert.equal(reads("days/2026.json"), 1);
		cards.release();
		await clock.runUntil(() => false, 31_000).catch(() => undefined);
		await cards.day("2026-10-28", false);
		assert.equal(reads("days/2026.json"), 2);
	});

	it("reads a day index once for every chart, and again only when that index changes", async () => {
		const { clock, vault, cards, reads } = setup();
		cards.acquire();
		vault.seed(`${DATA}/${STRESS_INDEX.folder}/2026.json`, STRESS_INDEX.serializeYear("2026", [{ date: "2026-10-28", level: 20 }]));
		const [a, b] = await Promise.all([cards.index("stress"), cards.index("stress")]);
		assert.equal(reads(`${STRESS_INDEX.folder}/2026.json`), 1);
		assert.deepEqual(a.rows, b.rows);
		let told = 0;
		cards.onChange(() => told++);
		// An index no chart reads: nothing moves.
		cards.onFile(`${DATA}/heart-rate/2026.json`);
		await clock.runUntil(() => false, SETTLE_MS + 500).catch(() => undefined);
		assert.equal(told, 0);
		cards.onFile(`${DATA}/${STRESS_INDEX.folder}/2026.json`);
		await clock.runUntil(() => told > 0, SETTLE_MS + 1_000);
		await cards.index("stress");
		assert.equal(reads(`${STRESS_INDEX.folder}/2026.json`), 2);
	});

	it("reads an activity's details from the vault, again when its file changes, and never fetches", async () => {
		const { clock, vault, cards, reads } = setup();
		cards.acquire();
		assert.equal(await cards.activity(42), null);
		vault.seed(`${DATA}/activity-details/42.json`, "{}");
		let told = 0;
		cards.onChange(() => told++);
		cards.onFile(`${DATA}/activity-details/42.json`);
		await clock.runUntil(() => told > 0, SETTLE_MS + 1_000);
		await cards.activity(42);
		await cards.activity(42);
		assert.equal(reads("activity-details/42.json"), 1);
	});

	it("reads everything again after a reset, and tells the blocks", async () => {
		const { clock, cards, reads } = setup();
		cards.acquire();
		await cards.day("2026-10-28", false);
		let told = 0;
		cards.onChange(() => told++);
		cards.reset();
		await clock.runUntil(() => told > 0, 1_000);
		await cards.day("2026-10-28", false);
		assert.equal(reads("series/2026-10-28.json"), 2);
	});
});
