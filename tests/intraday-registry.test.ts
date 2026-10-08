import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi } from "../src/garmin/endpoints";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";
import { serializeSeries, type DaySeries } from "../src/sync/intraday";
import { INTRADAY_EXTRAS } from "../src/sync/intraday-extras";
import {
	BUILT_IN_LOADERS,
	DayJobs,
	SERIES_KEYS,
	defineIntraday,
	hasBlock,
	loadDay,
	loaderOf,
	loadersFor,
	mergeBlocks,
	missingKeys,
	type IntradayDef,
} from "../src/sync/intraday-registry";

/** What `dailyStress` sends for a day, trimmed to what the mapper reads. */
const STRESS = {
	calendarDate: "2025-03-01",
	startTimestampGMT: "2025-02-28T20:00:00.0",
	stressValuesArray: [
		[1_000, 25],
		[2_000, -1],
	],
	bodyBatteryValuesArray: [[1_000, "MEASURED", 70, 2.0]],
};

const RESPIRATION = defineIntraday({
	key: "respiration",
	group: "respiration",
	fetch: async (api: GarminApi, date: string) => (api as unknown as FakeApi).respiration(date),
	map: (payload: { values?: Array<[number, number]> } | null) => (payload?.values?.length ? payload.values : null),
});

class FakeApi {
	calls: string[] = [];
	fail: Record<string, unknown> = {};
	stressPayload: unknown = STRESS;
	private guard(name: string, date: string) {
		this.calls.push(`${name}:${date}`);
		if (this.fail[name]) throw this.fail[name];
	}
	async stress(date: string) {
		this.guard("stress", date);
		return this.stressPayload;
	}
	async heartRate(date: string) {
		this.guard("heartRate", date);
		return { startTimestampGMT: "2025-02-28T20:00:00.0", heartRateValues: [[1_000, 51]] };
	}
	async bodyBatteryEvents(date: string) {
		this.guard("bodyBatteryEvents", date);
		return [];
	}
	async respiration(date: string) {
		this.guard("respiration", date);
		return { values: [[1_000, 14]] as Array<[number, number]> };
	}
}

/** The series store, in memory, writing through the real serializer. */
class MemoryStore {
	files = new Map<string, string>();
	writes = 0;
	failWrites = false;
	async read(date: string): Promise<DaySeries | null> {
		const text = this.files.get(date);
		if (!text) return null;
		const { date: _d, version: _v, ...series } = JSON.parse(text) as Record<string, unknown>;
		return series as DaySeries;
	}
	async write(date: string, series: DaySeries): Promise<"written" | "unchanged"> {
		if (this.failWrites) throw new Error("read-only vault");
		const text = serializeSeries(date, series);
		if (this.files.get(date) === text) return "unchanged";
		this.files.set(date, text);
		this.writes += 1;
		return "written";
	}
}

const OPTS = { signedIn: true, groups: ["intraday", "respiration"] as const, extras: [RESPIRATION as IntradayDef], today: "2026-10-08" };
const api = (fake: FakeApi) => fake as unknown as GarminApi;

describe("hasBlock and missingKeys", () => {
	it("finds the file's own blocks, extras, and days checked without data", () => {
		const series: DaySeries = { stress: [[1, 20]], extra: { respiration: [[1, 14]] }, checked: ["heartRate"] };
		assert.equal(hasBlock(series, "stress"), true);
		assert.equal(hasBlock(series, "respiration"), true);
		assert.equal(hasBlock(series, "heartRate"), true);
		assert.equal(hasBlock(series, "bodyBattery"), false);
		assert.equal(hasBlock(null, "stress"), false);
		assert.deepEqual(missingKeys(series, ["stress", "bodyBattery", "bodyBattery", "pulseOx"]), ["bodyBattery", "pulseOx"]);
	});
});

describe("loadersFor", () => {
	it("asks once for stress and Body Battery, which share a request", () => {
		const { loaders, unknown } = loadersFor(["bodyBattery", "stress", "heartRate"], []);
		assert.deepEqual(
			loaders.map((l) => l.keys),
			[["stress", "bodyBattery"], ["heartRate"]],
		);
		assert.deepEqual(unknown, []);
	});

	it("finds registered extras and names what nothing can fetch", () => {
		const { loaders, unknown } = loadersFor(["respiration", "pulseOx", "pulseOx"], [RESPIRATION as IntradayDef]);
		assert.deepEqual(loaders.map((l) => [l.keys, l.where]), [[["respiration"], "extra"]]);
		assert.deepEqual(unknown, ["pulseOx"]);
	});
});

describe("built-in loaders", () => {
	it("map the stress payload into the blocks a sync writes, and the day's start", () => {
		const stress = BUILT_IN_LOADERS.find((l) => l.keys.includes("stress"))!;
		assert.deepEqual(stress.blocks(STRESS, "2025-03-01"), {
			stress: [
				[1_000, 25],
				[2_000, null],
			],
			bodyBattery: [[1_000, 70]],
			dayStart: Date.parse("2025-02-28T20:00:00Z"),
		});
		assert.deepEqual(stress.blocks(null, "2025-03-01"), { stress: undefined, bodyBattery: undefined, dayStart: undefined });
	});

	it("keep to the intraday group, as a sync does", () => {
		for (const loader of BUILT_IN_LOADERS) assert.equal(loader.group, "intraday");
	});
});

describe("mergeBlocks", () => {
	const stress = BUILT_IN_LOADERS.find((l) => l.keys.includes("stress"))!;

	it("adds the blocks after what the file had, keeping its keys and their order", () => {
		const before: DaySeries = { sleepLevels: [{ start: 1, end: 2, level: 1 }], dayStart: 5 };
		const merged = mergeBlocks(before, [{ loader: stress, blocks: stress.blocks(STRESS, "2025-03-01") }]);
		assert.deepEqual(Object.keys(merged), ["sleepLevels", "dayStart", "stress", "bodyBattery", "checked"]);
		// The file's own day start stays: a payload's only fills a gap.
		assert.equal(merged.dayStart, 5);
		assert.deepEqual(merged.checked, ["bodyBattery", "stress"]);
	});

	it("fills a missing day start from the payload", () => {
		const merged = mergeBlocks(null, [{ loader: stress, blocks: stress.blocks(STRESS, "2025-03-01") }]);
		assert.equal(merged.dayStart, Date.parse("2025-02-28T20:00:00Z"));
	});

	it("marks a block Garmin had nothing for as checked, and keeps extras under extra", () => {
		const resp = loaderOf(RESPIRATION as IntradayDef);
		const merged = mergeBlocks({ stress: [[1, 2]] }, [
			{ loader: resp, blocks: { respiration: [[1, 14]] } },
			{ loader: BUILT_IN_LOADERS.find((l) => l.keys.includes("heartRate"))!, blocks: { heartRate: undefined } },
		]);
		assert.deepEqual(merged, { stress: [[1, 2]], extra: { respiration: [[1, 14]] }, checked: ["heartRate", "respiration"] });
		const emptied = mergeBlocks(merged, [{ loader: resp, blocks: { respiration: null } }]);
		assert.equal(emptied.extra, undefined);
		assert.equal(hasBlock(emptied, "respiration"), true);
	});

	it("makes the same text from the same answer, so an unchanged day is not rewritten", () => {
		const blocks = [{ loader: stress, blocks: stress.blocks(STRESS, "2025-03-01") }];
		const once = mergeBlocks({ heartRate: [[1, 50]] }, blocks);
		const twice = mergeBlocks(once, blocks);
		assert.equal(serializeSeries("2025-03-01", twice), serializeSeries("2025-03-01", once));
	});
});

describe("loadDay", () => {
	it("fetches what an old day lacks, writes it into the day's file and hands it back", async () => {
		const fake = new FakeApi();
		const store = new MemoryStore();
		store.files.set("2025-03-01", serializeSeries("2025-03-01", { sleepLevels: [{ start: 1, end: 2, level: 0 }] }));
		const load = await loadDay(api(fake), store, "2025-03-01", ["stress", "respiration"], OPTS);
		assert.deepEqual(fake.calls.sort(), ["respiration:2025-03-01", "stress:2025-03-01"]);
		assert.deepEqual(load.missing, []);
		assert.equal(load.reason, undefined);
		assert.deepEqual(load.series?.extra, { respiration: [[1_000, 14]] });
		assert.deepEqual(await store.read("2025-03-01"), load.series);
		assert.deepEqual(Object.keys(load.series!), ["sleepLevels", "stress", "bodyBattery", "dayStart", "extra", "checked"]);
	});

	it("asks nothing when the file has it all, or Garmin had nothing last time", async () => {
		const fake = new FakeApi();
		fake.stressPayload = null;
		const store = new MemoryStore();
		const first = await loadDay(api(fake), store, "2025-03-01", ["stress"], OPTS);
		assert.deepEqual(first.missing, []);
		assert.deepEqual(first.series?.checked, ["bodyBattery", "stress"]);
		const again = await loadDay(api(fake), store, "2025-03-01", ["stress", "bodyBattery"], OPTS);
		assert.deepEqual(again.missing, []);
		assert.equal(fake.calls.length, 1);
		assert.equal(store.writes, 1);
	});

	it("says why it could not, without asking Garmin", async () => {
		const fake = new FakeApi();
		const store = new MemoryStore();
		assert.equal((await loadDay(api(fake), store, "2025-03-01", ["stress"], { ...OPTS, signedIn: false })).reason, "signed-out");
		assert.equal((await loadDay(api(fake), store, "2025-03-01", ["stress"], { ...OPTS, groups: ["respiration"] })).reason, "off");
		assert.equal((await loadDay(api(fake), store, "2026-10-09", ["stress"], OPTS)).reason, "unavailable");
		assert.equal((await loadDay(api(fake), store, "2025-03-01", ["pulseOx"], OPTS)).reason, "unavailable");
		assert.equal((await loadDay(api(fake), store, "03/01/2025", ["stress"], OPTS)).reason, "unavailable");
		assert.deepEqual(fake.calls, []);
		assert.equal(store.writes, 0);
	});

	it("keeps what came back when one request fails, and names the failure", async () => {
		const fake = new FakeApi();
		fake.fail.heartRate = new GarminApiError("bad gateway", 502, "");
		const store = new MemoryStore();
		const load = await loadDay(api(fake), store, "2025-03-01", ["stress", "heartRate"], OPTS);
		assert.deepEqual(load.missing, ["heartRate"]);
		assert.equal(load.reason, "failed");
		assert.equal(load.error, "bad gateway");
		assert.equal(load.fatal, undefined);
		assert.ok(hasBlock(await store.read("2025-03-01"), "stress"));
	});

	it("hands a 429 back as fatal, for the queue to stop on", async () => {
		const fake = new FakeApi();
		fake.fail.stress = new GarminRateLimitError("rate limited", 60);
		const store = new MemoryStore();
		const load = await loadDay(api(fake), store, "2025-03-01", ["stress"], OPTS);
		assert.equal(load.reason, "failed");
		assert.ok(load.fatal instanceof GarminRateLimitError);
		assert.equal(store.writes, 0);
	});

	it("reports a file it could not write", async () => {
		const store = new MemoryStore();
		store.failWrites = true;
		const load = await loadDay(api(new FakeApi()), store, "2025-03-01", ["heartRate"], OPTS);
		assert.equal(load.reason, "failed");
		assert.match(load.error ?? "", /read-only vault/);
		assert.equal(load.series, null);
	});
});

describe("DayJobs", () => {
	it("joins a second ask for a waiting day, and hands out the longest-waiting day first", async () => {
		const jobs = new DayJobs<string>();
		const a = jobs.add("2026-10-01", ["stress"]);
		const b = jobs.add("2026-10-02", ["heartRate"]);
		const a2 = jobs.add("2026-10-01", ["bodyBattery", "stress"]);
		assert.equal(a2, a);
		assert.equal(jobs.size, 2);
		const first = jobs.take()!;
		assert.deepEqual([first.date, first.keys], ["2026-10-01", ["stress", "bodyBattery"]]);
		first.resolve("one");
		jobs.take()!.resolve("two");
		assert.equal(jobs.take(), undefined);
		assert.deepEqual(await Promise.all([a, a2, b]), ["one", "one", "two"]);
	});
});

describe("defineIntraday and INTRADAY_EXTRAS", () => {
	it("refuses a key the series file uses, or one that is not a key", () => {
		const base = { group: "intraday" as const, fetch: async () => null, map: () => null };
		assert.throws(() => defineIntraday({ ...base, key: "stress" }), /own key/);
		assert.throws(() => defineIntraday({ ...base, key: "Pulse Ox" }), /key/);
		assert.doesNotThrow(() => defineIntraday({ ...base, key: "pulse-ox" }));
	});

	it("holds extras with keys of their own", () => {
		const keys = new Set<string>();
		for (const def of INTRADAY_EXTRAS) {
			assert.ok(!SERIES_KEYS.has(def.key), def.key);
			assert.ok(!keys.has(def.key), `${def.key} registered twice`);
			keys.add(def.key);
		}
	});
});
