import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import type { Activity } from "../src/garmin/endpoints";
import { parseDayCoverage, serializeDayCoverage, type Span } from "../src/sync/coverage";
import { parseMeta as parseDailyMeta } from "../src/sync/daily-stats";
import { parseDays, serializeDays } from "../src/sync/days";
import { NewerDataError } from "../src/sync/file-health";
import { parseMeta as parseActivityMeta, parseYear as parseActivityYear } from "../src/sync/activity-index";
import { forgetParsedDays, seenConflictCopies, VaultSeriesStore } from "../src/sync/series-store";
import { MemoryVault } from "./support/memory-vault";
import { clearNotices, notices } from "./support/obsidian";

const DATA = "Garmin/data";

function setup() {
	const vault = new MemoryVault();
	const store = new VaultSeriesStore(vault.asApp(), DATA);
	return { vault, store };
}

const coverage = (...spans: Span[]) => serializeDayCoverage({ spans });

function spansIn(vault: MemoryVault): Span[] {
	return parseDayCoverage(vault.text(`${DATA}/days/index.json`) ?? "")?.spans ?? [];
}

function activity(id: number, day: string): Activity {
	return { activityId: id, activityName: `Run ${id}`, startTimeLocal: `${day} 07:00:00`, beginTimestamp: Date.parse(`${day}T07:00:00Z`), activityType: { typeKey: "running" } } as unknown as Activity;
}

/** The newest `n` of a run a day ending on `last`, newest first: each day's run keeps its id from one listing to the next. */
function activities(n: number, last = "2026-10-15"): Activity[] {
	const out: Activity[] = [];
	const end = Date.parse(`${last}T00:00:00Z`);
	for (let i = 0; i < n; i++) {
		const at = end - i * 86_400_000;
		out.push(activity(at / 86_400_000, new Date(at).toISOString().slice(0, 10)));
	}
	return out;
}

beforeEach(() => clearNotices());

describe("VaultSeriesStore: a day file that can't be read", () => {
	const TRUNCATED = '{\n\t"version": 1,\n\t"year": 2026,\n\t"days": {\n\t\t"2026-01-01": {"steps": 1200},\n\t\t"2026-01-02": {"ste';

	it("is set aside rather than written over, and its days are fetched again", async () => {
		const { vault, store } = setup();
		vault.seed(`${DATA}/days/2026.json`, TRUNCATED);
		vault.seed(`${DATA}/days/index.json`, coverage(["2025-12-01", "2026-01-31", 1]));

		const days = store.dayBuffer();
		await days.write("2026-10-16", { steps: 9000 });
		await days.flush();

		// The new file holds what this run wrote, and nothing it misread.
		assert.deepEqual([...parseDays(vault.text(`${DATA}/days/2026.json`)!).keys()], ["2026-10-16"]);
		// The old one is kept, untouched, beside it.
		const aside = vault.list(`${DATA}/days`).filter((name) => name.startsWith("2026.unreadable-"));
		assert.equal(aside.length, 1);
		assert.equal(vault.text(`${DATA}/days/${aside[0]}`), TRUNCATED);
		// 2026's days no longer count as fetched; 2025's still do.
		assert.deepEqual(spansIn(vault), [["2025-12-01", "2025-12-31", 1]]);
		assert.equal(notices.length, 1);
		assert.match(notices[0]!, /days\/2026\.json couldn't be read\. It was kept as 2026\.unreadable-/);
	});

	it("leaves a readable year as it was, merging the run's days over it", async () => {
		const { vault, store } = setup();
		vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-01-01", { steps: 1200 }]])));
		const days = store.dayBuffer();
		await days.write("2026-10-16", { steps: 9000 });
		await days.flush();
		assert.deepEqual([...parseDays(vault.text(`${DATA}/days/2026.json`)!).keys()], ["2026-01-01", "2026-10-16"]);
		assert.deepEqual(vault.list(`${DATA}/days`), ["2026.json"]);
		assert.equal(notices.length, 0);
	});

	it("refuses to write over a year a newer build wrote", async () => {
		const { vault, store } = setup();
		const newer = '{\n\t"version": 2,\n\t"year": 2026,\n\t"days": {}\n}\n';
		vault.seed(`${DATA}/days/2026.json`, newer);
		const days = store.dayBuffer();
		await days.write("2026-10-16", { steps: 9000 });
		await assert.rejects(days.flush(), NewerDataError);
		assert.equal(vault.text(`${DATA}/days/2026.json`), newer);
	});
});

describe("VaultSeriesStore: a chart index year that can't be read", () => {
	it("is set aside, and the index is walked again from scratch", async () => {
		const { vault, store } = setup();
		await store.mergeDailyStats(
			{ rows: [{ date: "2025-06-01", steps: 5000 }, { date: "2026-10-15", steps: 7000 }], dates: ["2025-06-01", "2026-10-15"] },
			{ covered: { from: "2025-06-01", to: "2026-10-15" }, complete: true },
		);
		assert.equal(parseDailyMeta(vault.text(`${DATA}/daily-stats/index.json`)!)?.complete, true);
		vault.seed(`${DATA}/daily-stats/2025.json`, '{"version": 1, "year": 2025, "days": [{"date": "2025-06-01", "st');

		await store.mergeDailyStats({ rows: [{ date: "2026-10-16", steps: 8000 }], dates: ["2026-10-16"] }, { covered: { from: "2026-10-16", to: "2026-10-16" } });

		assert.equal(vault.list(`${DATA}/daily-stats`).filter((name) => name.startsWith("2025.unreadable-")).length, 1);
		const meta = parseDailyMeta(vault.text(`${DATA}/daily-stats/index.json`)!);
		assert.deepEqual(meta, { version: 1, complete: false });
	});

	it("resets the span once: a walk's later segments, on the same store, extend it again", async () => {
		const { vault, store } = setup();
		await store.mergeDailyStats({ rows: [{ date: "2025-06-01", steps: 5000 }], dates: ["2025-06-01"] }, { covered: { from: "2025-06-01", to: "2025-06-01" } });
		vault.seed(`${DATA}/daily-stats/2025.json`, "{ cut short");
		await store.mergeDailyStats({ rows: [{ date: "2026-10-16", steps: 8000 }], dates: ["2026-10-16"] }, { covered: { from: "2026-10-16", to: "2026-10-16" } });
		assert.deepEqual(parseDailyMeta(vault.text(`${DATA}/daily-stats/index.json`)!), { version: 1, complete: false });
		// The next segment, same store: its span stands.
		await store.mergeDailyStats({ rows: [{ date: "2026-10-15", steps: 7000 }], dates: ["2026-10-15"] }, { covered: { from: "2026-10-15", to: "2026-10-15" } });
		assert.deepEqual(parseDailyMeta(vault.text(`${DATA}/daily-stats/index.json`)!), { version: 1, complete: false, from: "2026-10-15", to: "2026-10-15" });
	});

	it("does the same for the activity index: the whole list is fetched again", async () => {
		const { vault, store } = setup();
		await store.mergeActivities([activity(1, "2026-10-01"), activity(2, "2025-03-01")], { complete: true, total: 2 });
		vault.seed(`${DATA}/activities/2025.json`, "<<<<<<< HEAD\n");

		await store.mergeActivities([activity(3, "2026-10-16")], { complete: false });

		assert.equal(vault.list(`${DATA}/activities`).filter((name) => name.startsWith("2025.unreadable-")).length, 1);
		assert.equal(parseActivityMeta(vault.text(`${DATA}/activities/index.json`)!)?.complete, false);
		assert.deepEqual(parseActivityYear(vault.text(`${DATA}/activities/2026.json`)!).map((row) => row.id), [3, 1]);
	});
});

describe("VaultSeriesStore: a listing that reached its end", () => {
	it("replaces the activity index when it is about as long as Garmin's count", async () => {
		const { vault, store } = setup();
		await store.mergeActivities(activities(300), { complete: true, total: 300 });
		// Ten deleted on Garmin since: the listing ends at 290.
		await store.mergeActivities(activities(290), { complete: true, total: 290 });
		assert.equal((await store.readActivities()).rows.length, 290);
		assert.equal(parseActivityMeta(vault.text(`${DATA}/activities/index.json`)!)?.total, 290);
	});

	it("keeps the index when a short page cut the listing far below the count", async () => {
		const { store } = setup();
		await store.mergeActivities(activities(300), { complete: true, total: 300 });
		// The third page came back with 37 rows: the walk took that for the end.
		await store.mergeActivities(activities(237), { complete: true, total: 300 });
		assert.equal((await store.readActivities()).rows.length, 300);
	});

	it("keeps it too when a routine sync's single short page claims the end", async () => {
		const { store } = setup();
		await store.mergeActivities(activities(300), { complete: true, total: 300 });
		await store.mergeActivities(activities(12), { complete: true });
		assert.equal((await store.readActivities()).rows.length, 300);
	});
});

describe("VaultSeriesStore: conflict copies", () => {
	it("notes the copies a sync service left, and says so once a session", async () => {
		const { vault, store } = setup();
		vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-10-01", { steps: 1 }]])));
		vault.seed(`${DATA}/days/2026 2.json`, serializeDays("2026", new Map([["2026-10-02", { steps: 2 }]])));
		vault.seed(`${DATA}/activities/2025.sync-conflict-20261016-113005-ABCDEFG.json`, "{}");

		const rows = await store.readDays();
		await store.readActivities();
		await store.readDays();

		assert.deepEqual(rows.map((row) => row.date), ["2026-10-01"], "the copy is not read");
		const seen = seenConflictCopies();
		assert.ok(seen.includes(`${DATA}/days/2026 2.json`));
		assert.ok(seen.includes(`${DATA}/activities/2025.sync-conflict-20261016-113005-ABCDEFG.json`));
		assert.equal(notices.filter((text) => text.includes("conflict copy")).length, 1);
	});
});

describe("VaultSeriesStore: backfill.json and the detail coverage", () => {
	it("changes backfill.json from what it holds now, keeping what another device wrote", async () => {
		const vault = new MemoryVault();
		const store = new VaultSeriesStore(vault.asApp(), "Garmin/data");
		await store.writeBackfill({ lease: { device: "mac", label: "Mac", heartbeat: "2026-10-14T06:00:00.000Z" } });
		// Another device pauses it, then this one's heartbeat comes in.
		await store.updateBackfill((state) => ({ ...state, paused: { reason: "user" } }));
		await store.updateBackfill((state) => ({ ...state, progress: { done: 120, since: "2026-10-14T05:00:00.000Z" } }));
		assert.deepEqual(await store.readBackfill(), {
			paused: { reason: "user" },
			lease: { device: "mac", label: "Mac", heartbeat: "2026-10-14T06:00:00.000Z" },
			progress: { done: 120, since: "2026-10-14T05:00:00.000Z" },
		});
	});

	it("books a batch of activities' versions in one write", async () => {
		const vault = new MemoryVault();
		const store = new VaultSeriesStore(vault.asApp(), "Garmin/data");
		await store.bookDetails(new Map([[1, 6], [2, 6], [3, 5]]));
		const writes = vault.writes.length;
		assert.deepEqual([...(await store.readDetailCoverage())].sort(), [[1, 6], [2, 6], [3, 5]]);
		// Nothing new to book: no write.
		await store.bookDetails(new Map([[1, 6]]));
		assert.equal(vault.writes.length, writes);
	});
});

describe("VaultSeriesStore: what a sync reads", () => {
	it("writes a series file it just read without reading it again", async () => {
		const vault = new MemoryVault();
		const store = new VaultSeriesStore(vault.asApp(), "Garmin/data");
		await store.write("2026-10-01", { date: "2026-10-01", steps: [{ start: 1, end: 2, steps: 10 }] } as never);
		const series = await store.read("2026-10-01");
		const reads = vault.reads.length;
		await store.write("2026-10-01", { ...series!, steps: [{ start: 1, end: 2, steps: 11 }] } as never);
		assert.equal(vault.reads.length, reads);
		assert.equal(vault.writes.filter((p) => p.endsWith("2026-10-01.json")).length, 2);
	});
});


describe("VaultSeriesStore: a merge reads the years it changes", () => {
	const reads = (vault: MemoryVault, from: number, folder: string) => vault.reads.slice(from).filter((p) => p.startsWith(`${DATA}/${folder}/`) && /\/\d{4}\.json$/.test(p)).map((p) => p.slice(-9, -5));
	const yearWrites = (vault: MemoryVault, from: number) => vault.writes.slice(from).filter((p) => /\/\d{4}\.json$/.test(p));

	it("a page of the activity list leaves older years alone, and still drops what Garmin deleted", async () => {
		const { vault, store } = setup();
		// Three years of a run a day.
		await store.mergeActivities(activities(1_000), { complete: true, total: 1_000 });
		// A sync's page of the newest 30, one of them deleted on Garmin since.
		let before = vault.reads.length;
		await store.mergeActivities(activities(31).filter((_, i) => i !== 5), { complete: false });
		// The first time this session, the years it leaves alone are checked once; this year is read once.
		assert.deepEqual(reads(vault, before, "activities").sort(), ["2024", "2025", "2026"]);
		assert.equal((await store.readActivities()).rows.length, 999);
		// The next sync's page reads this year alone, and writes it alone.
		before = vault.reads.length;
		const writes = vault.writes.length;
		await store.mergeActivities(activities(31).filter((_, i) => i !== 5 && i !== 6), { complete: false });
		assert.deepEqual(reads(vault, before, "activities"), ["2026"]);
		assert.deepEqual(yearWrites(vault, writes), [`${DATA}/activities/2026.json`]);
		assert.equal((await store.readActivities()).rows.length, 998);
	});

	it("a whole listing reads every year once, and rewrites what changed", async () => {
		const { vault, store } = setup();
		await store.mergeActivities(activities(1_000), { complete: true, total: 1_000 });
		const before = vault.reads.length;
		await store.mergeActivities(activities(990), { complete: true, total: 990 });
		assert.deepEqual(reads(vault, before, "activities").sort(), ["2024", "2025", "2026"]);
		assert.equal((await store.readActivities()).rows.length, 990);
	});

	it("a batch of days reads and writes only its own years", async () => {
		const { vault, store } = setup();
		const rows = (dates: string[]) => dates.map((date) => ({ date, steps: 1_000, stepGoal: 8_000 }));
		await store.mergeDailyStats({ rows: rows(["2024-06-01", "2025-06-01", "2026-06-01"]), dates: ["2024-06-01", "2025-06-01", "2026-06-01"] });
		await store.mergeDailyStats({ rows: rows(["2026-10-19"]), dates: ["2026-10-19"] });
		const before = vault.reads.length;
		const writes = vault.writes.length;
		await store.mergeDailyStats({ rows: rows(["2026-10-20"]), dates: ["2026-10-19", "2026-10-20"] });
		assert.deepEqual(reads(vault, before, "daily-stats"), ["2026"]);
		assert.deepEqual(yearWrites(vault, writes), [`${DATA}/daily-stats/2026.json`]);
		assert.deepEqual((await store.readDailyStats()).rows.map((r) => r.date), ["2024-06-01", "2025-06-01", "2026-06-01", "2026-10-20"]);
	});

	it("still sets aside a year a merge leaves alone once it no longer reads", async () => {
		const { vault, store } = setup();
		const rows = (dates: string[]) => dates.map((date) => ({ date, steps: 1_000 }));
		await store.mergeDailyStats({ rows: rows(["2025-06-01", "2026-06-01"]), dates: ["2025-06-01", "2026-06-01"] }, { covered: { from: "2025-06-01", to: "2026-06-01" }, complete: true });
		await store.mergeDailyStats({ rows: rows(["2026-10-19"]), dates: ["2026-10-19"] });
		// A sync service's conflict leaves 2025 broken.
		vault.seed(`${DATA}/daily-stats/2025.json`, "<<<<<<< HEAD");
		await store.mergeDailyStats({ rows: rows(["2026-10-20"]), dates: ["2026-10-20"] });
		assert.equal(vault.list(`${DATA}/daily-stats`).filter((name) => name.startsWith("2025.unreadable-")).length, 1);
		assert.equal(parseDailyMeta(vault.text(`${DATA}/daily-stats/index.json`)!)?.complete, false);
	});
});

describe("VaultSeriesStore: Home's reads of the day files", () => {
	it("parses a year file again only once it changed", async () => {
		forgetParsedDays();
		const { vault, store } = setup();
		vault.seed(`${DATA}/days/2025.json`, serializeDays("2025", new Map([["2025-06-01", { steps: 1 }]])));
		vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-10-01", { steps: 2 }]])));
		const dayReads = () => vault.reads.filter((p) => p.startsWith(`${DATA}/days/`)).length;

		assert.deepEqual((await store.readDays()).map((r) => r.date), ["2025-06-01", "2026-10-01"]);
		assert.equal(dayReads(), 2);
		// Nothing changed: nothing read.
		await store.readDays();
		assert.equal(dayReads(), 2);
		// A sync rewrote this year: that file alone is read again.
		vault.seed(`${DATA}/days/2026.json`, serializeDays("2026", new Map([["2026-10-01", { steps: 2 }], ["2026-10-02", { steps: 3 }]])));
		assert.deepEqual((await store.readDays()).map((r) => r.date), ["2025-06-01", "2026-10-01", "2026-10-02"]);
		assert.equal(dayReads(), 3);
		// Once no Garmin view is open, the parsed days go.
		forgetParsedDays();
		await store.readDays();
		assert.equal(dayReads(), 5);
	});
});

describe("VaultSeriesStore: what the indexes say about each day", () => {
	const rows = (dates: string[]) => dates.map((date) => ({ date, steps: 1_000 }));

	it("lists a chart store's days, read again only once its files change", async () => {
		const { vault, store } = setup();
		await store.mergeDailyStats({ rows: rows(["2026-10-01", "2026-10-03"]), dates: ["2026-10-01", "2026-10-02", "2026-10-03"] }, { covered: { from: "2026-10-01", to: "2026-10-03" }, complete: true });
		assert.deepEqual([...(await store.datesIn("daily-stats"))], ["2026-10-01", "2026-10-03"]);
		const reads = vault.reads.length;
		await store.datesIn("daily-stats");
		assert.equal(vault.reads.length, reads);
		await store.mergeDailyStats({ rows: rows(["2026-10-04"]), dates: ["2026-10-04"] }, { covered: { from: "2026-10-04", to: "2026-10-04" } });
		assert.ok((await store.datesIn("daily-stats")).has("2026-10-04"));
	});

	it("keeps the masks' verdicts in scan.json, through a scan run again", async () => {
		const { store } = setup();
		const scan = { scannedAt: "2026-10-01T00:00:00.000Z", days: 1, weeks: [["2026-09-28", 1]] as Array<[string, number]>, activities: 0, complete: true };
		await store.writeScan(scan);
		await store.writeVerdicts({ body: "trusted" });
		assert.deepEqual((await store.readScan())?.learned, { masks: { body: "trusted" } });
		await store.writeScan({ ...scan, scannedAt: "2026-10-21T00:00:00.000Z" });
		assert.deepEqual((await store.readScan())?.learned, { masks: { body: "trusted" } });
		const masks = await store.readMasks(["body"], new Map([["index:weight", { complete: true, from: "2026-01-01", to: "2026-10-20" }]]), await store.readScan());
		assert.deepEqual(masks.verdicts, { body: "trusted" });
		assert.deepEqual([...masks.facts.body!], []);
		assert.deepEqual(masks.spans.body, { from: "2026-01-01", to: "2026-10-20" });
	});
});

