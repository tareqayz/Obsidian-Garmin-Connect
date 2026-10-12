import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { daysBetween } from "../src/dashboard/periods";
import { GarminApi } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import { MemoryTokenStore } from "../src/garmin/tokens";
import { MAX_WINDOW_DAYS, type DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import {
	HRV_STRESS_INDEX,
	HRV_STRESS_MAX,
	HRV_STRESS_SCORE_KEYS,
	HRV_STRESS_TIME_KEYS,
	hrvStressScoreOf,
	rowsOfHrvStress,
	type HrvStressRow,
} from "../src/sync/hrv-stress-index";
import { FixtureHttpClient, type FixtureRule } from "./support/fixture-http";

/*
 * The HRV stress index against the route as Garmin answered it on
 * 2026-10-12 (ref/performance-stats/hrv-stress/README.md, "Data plan"): the
 * account has never run a test, so every window — the whole history
 * included — is `[]`. The mapper's field names are Inferred; its tests use
 * synthetic tests.
 */

const HOST = "https://connectapi.garmin.com";
const PROFILE = { url: "/userprofile-service/socialProfile", json: { displayName: "abc-123", profileId: 12345678 } };

type Test = Record<string, unknown>;

const normalized = (payload: ReadonlyArray<Test | null> | null | undefined) => rowsOfHrvStress(payload).map((r) => HRV_STRESS_INDEX.normalize(r));

/** The route as a stub: the given tests inside each window, `[]` otherwise; a reversed window throws, as the wrapper does. */
function hrvStressApi(calls: string[], tests: Test[] = []): GarminApi {
	return {
		hrvStressDaily: async (start: string, end: string) => {
			calls.push(`daily ${start} ${end}`);
			if (start > end) throw new TypeError("reversed");
			return tests.filter((t) => typeof t.calendarDate === "string" && t.calendarDate >= start && t.calendarDate <= end);
		},
	} as unknown as GarminApi;
}

/** A signed-in client on canned responses; retries don't wait. */
async function liveApi(rules: FixtureRule[]) {
	const http = new FixtureHttpClient([
		{ url: "/mobile/api/login", times: 1, json: { responseStatus: { type: "SUCCESSFUL" }, serviceTicketId: "ST" } },
		{ url: "diauth", times: 1, json: { access_token: "a", refresh_token: "r", expires_in: 3600 } },
		...rules,
	]);
	const api = new GarminApi({ http, store: new MemoryTokenStore(), wait: async () => {} });
	await api.login("u", "p");
	return { http, api, asked: () => http.urls.filter((u) => u.includes("manualstresslevel")) };
}

describe("HRV_STRESS_INDEX — the definition", () => {
	it("is the hrv-stress index of the hrv group: 3660 days a window, one empty window ends the walk, nothing refreshed", () => {
		const def = HRV_STRESS_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], ["hrv-stress", "hrv-stress", "HRV stress", "hrv", 1, "days"]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld, def.requestsPerWindow], [3660, 0, 1, false, 1]);
		// The widest window a definition may ask: the route has no cap.
		assert.equal(def.windowDays, MAX_WINDOW_DAYS);
		assert.equal(def.maxHistoryDays, undefined);
		assert.equal(def.fromDay, undefined);
		assert.equal(def.fromSummary, undefined);
		assert.deepEqual(def.keys, ["score", "n"]);
	});

	it('writes the spec\'s example row, {"date":"2026-10-08","score":42,"n":1}', () => {
		const rows = normalized([{ calendarDate: "2026-10-08", stressLevel: 42 }]);
		assert.deepEqual(rows, [{ date: "2026-10-08", score: 42, n: 1 }]);
		const text = HRV_STRESS_INDEX.serializeYear("2026", rows.map((r) => r!));
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n\t\t{"date":"2026-10-08","score":42,"n":1}\n\t]\n}\n');
		assert.deepEqual(HRV_STRESS_INDEX.parseYear(text), rows);
	});
});

describe("HRV_STRESS_INDEX — no test vs an error", () => {
	it("maps the empty answer, and a null body, to no rows", () => {
		assert.deepEqual(rowsOfHrvStress([]), []);
		assert.deepEqual(rowsOfHrvStress(null), []);
		assert.deepEqual(rowsOfHrvStress(undefined), []);
	});

	it("asks the whole window by the profile's numeric id, and reads [] and a 204 as a window without a test", async () => {
		const { api, asked } = await liveApi([
			PROFILE,
			{ url: "/2016-10-04/2026-10-11", times: 1, json: [] },
			{ url: "/2006-09-27/2016-10-03", times: 1, status: 204, text: "" },
		]);
		assert.deepEqual(await HRV_STRESS_INDEX.fetchWindow(api, "2016-10-04", "2026-10-11"), []);
		assert.deepEqual(await HRV_STRESS_INDEX.fetchWindow(api, "2006-09-27", "2016-10-03"), []);
		assert.deepEqual(asked(), [
			`${HOST}/metrics-service/internal/manualstresslevel/daily/12345678/2016-10-04/2026-10-11`,
			`${HOST}/metrics-service/internal/manualstresslevel/daily/12345678/2006-09-27/2016-10-03`,
		]);
	});

	it("throws for an error rather than reading it as no test: a 5xx after two retries, a profile without a numeric id, a reversed window", async () => {
		const broken = await liveApi([PROFILE, { url: "manualstresslevel", status: 500, text: "" }]);
		await assert.rejects(() => HRV_STRESS_INDEX.fetchWindow(broken.api, "2016-10-04", "2026-10-11"), GarminApiError);
		assert.equal(broken.asked().length, 3);
		const anonymous = await liveApi([{ url: "/userprofile-service/socialProfile", json: { displayName: "abc-123" } }]);
		await assert.rejects(() => HRV_STRESS_INDEX.fetchWindow(anonymous.api, "2016-10-04", "2026-10-11"), GarminApiError);
		assert.deepEqual(anonymous.asked(), []);
		// Garmin's HTTP 500, three times over, is refused before it is asked.
		const reversed = await liveApi([PROFILE, { url: "manualstresslevel", json: [] }]);
		await assert.rejects(() => HRV_STRESS_INDEX.fetchWindow(reversed.api, "2026-10-11", "2026-10-05"), TypeError);
		assert.deepEqual(reversed.asked(), []);
	});

	it("keeps a failed walk incomplete, its window not covered, where an empty one is covered and complete", async () => {
		const failed = await walkHistory(HRV_STRESS_INDEX, async () => {
			throw new GarminApiError("HTTP 500", 500, "");
		}, { until: "2026-10-11" });
		assert.deepEqual([failed.complete, failed.batch.rows, failed.batch.dates.length, failed.covered], [false, [], 0, null]);
		assert.match(failed.error!, /^2016-10-04\.\.2026-10-11: /);
		const quiet = await walkHistory(HRV_STRESS_INDEX, (start, end) => HRV_STRESS_INDEX.fetchWindow(hrvStressApi([]), start, end), { until: "2026-10-11" });
		assert.deepEqual([quiet.complete, quiet.batch.rows, quiet.batch.dates.length], [true, [], 3660]);
	});
});

describe("rowsOfHrvStress — the Inferred mapper", () => {
	it("reads the first whole number in 0–100 among stressLevel, stressScore, hrvStressScore, manualStressLevel, value", () => {
		assert.deepEqual(HRV_STRESS_SCORE_KEYS, ["stressLevel", "stressScore", "hrvStressScore", "manualStressLevel", "value"]);
		assert.equal(HRV_STRESS_MAX, 100);
		assert.equal(hrvStressScoreOf({ stressLevel: 42, value: 7 }), 42);
		assert.equal(hrvStressScoreOf({ stressLevel: null, stressScore: "42", hrvStressScore: 42.5, manualStressLevel: 101, value: 7 }), 7);
		assert.equal(hrvStressScoreOf({ stressScore: -1, value: 0 }), 0);
		assert.equal(hrvStressScoreOf({ value: 100 }), 100);
		assert.equal(hrvStressScoreOf({ hrv: 42 }), undefined);
	});

	it("dates a test by its calendarDate, else its local time", () => {
		assert.deepEqual(HRV_STRESS_TIME_KEYS, ["timestampLocal", "startTimestampLocal"]);
		assert.deepEqual(
			normalized([
				{ calendarDate: "2026-10-08", timestampLocal: "2026-10-09T07:00:00.0", stressLevel: 42 },
				{ timestampLocal: "2026-10-01T06:58:10.0", stressLevel: 30 },
				{ startTimestampLocal: "2026-09-20T07:01:00.0", stressLevel: 75 },
				{ timestampGMT: "2026-09-19T03:01:00.0", stressLevel: 90 },
			]),
			[
				{ date: "2026-09-20", score: 75, n: 1 },
				{ date: "2026-10-01", score: 30, n: 1 },
				{ date: "2026-10-08", score: 42, n: 1 },
			],
		);
	});

	it("keeps a day's last test — by its local time where it has one, else the route's order — and counts them", () => {
		assert.deepEqual(
			normalized([
				{ calendarDate: "2026-10-08", timestampLocal: "2026-10-08T21:00:00.0", stressLevel: 60 },
				{ calendarDate: "2026-10-08", timestampLocal: "2026-10-08T07:00:00.0", stressLevel: 40 },
				{ calendarDate: "2026-10-07", stressLevel: 20 },
				{ calendarDate: "2026-10-07", stressLevel: 25 },
			]),
			[
				{ date: "2026-10-07", score: 25, n: 2 },
				{ date: "2026-10-08", score: 60, n: 2 },
			],
		);
	});

	it("skips what has no day or no score", () => {
		assert.deepEqual(
			normalized([null, { calendarDate: "2026-10-08" }, { stressLevel: 42 }, { calendarDate: "10/08/2026", stressLevel: 42 }, { calendarDate: "2026-10-09", stressLevel: 33 }]),
			[{ date: "2026-10-09", score: 33, n: 1 }],
		);
	});
});

describe("HRV_STRESS_INDEX — the history walk", () => {
	it("is complete with no rows after one request on the recording account: one empty 3660-day window", async () => {
		const calls: string[] = [];
		const api = hrvStressApi(calls);
		const walk = await walkHistory(HRV_STRESS_INDEX, (start, end) => HRV_STRESS_INDEX.fetchWindow(api, start, end), { until: "2026-10-11" });
		assert.deepEqual(calls, ["daily 2016-10-04 2026-10-11"]);
		assert.equal(daysBetween("2016-10-04", "2026-10-11") + 1, 3660);
		assert.deepEqual([walk.complete, walk.error, walk.batch.rows, walk.requests], [true, undefined, [], 1]);
		assert.deepEqual(walk.covered, { from: "2016-10-04", to: "2026-10-11" });
	});

	it("takes one more window when the first holds a test (Inferred)", async () => {
		const calls: string[] = [];
		const api = hrvStressApi(calls, [{ calendarDate: "2020-03-02", stressLevel: 42 }]);
		const walk = await walkHistory(HRV_STRESS_INDEX, (start, end) => HRV_STRESS_INDEX.fetchWindow(api, start, end), { until: "2026-10-11" });
		assert.deepEqual(calls, ["daily 2016-10-04 2026-10-11", "daily 2006-09-27 2016-10-03"]);
		assert.deepEqual([walk.complete, walk.requests, walk.batch.rows], [true, 2, [{ date: "2020-03-02", score: 42, n: 1 }]]);
	});
});

describe("HRV_STRESS_INDEX — a routine sync", () => {
	/** The hrv group's own day sync: `hrv/{date}` a day, no night on file. */
	function hrvSource(calls: string[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (date?: string) => {
				calls.push(`${name}:${date ?? ""}`);
				if (name === "hrv") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<HrvStressRow> {
		merged: Array<DayIndexBatch<HrvStressRow>> = [];
		constructor(public held: { from?: string; to?: string } | null) {}
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<HrvStressRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	async function sync(from: string, to: string, held: { from?: string; to?: string } | null, groups: Array<"hrv" | "sleep"> = ["hrv"]) {
		const source: string[] = [];
		const api: string[] = [];
		const sink = new Sink(held);
		const stub = hrvStressApi(api, [{ calendarDate: "2026-10-08", stressLevel: 42 }]);
		const report = await syncRange(groups.includes("hrv") ? hrvSource(source) : new Proxy({} as SyncSource, { get: () => async () => null }), target, {
			from,
			to,
			groups,
			units: "metric",
			wait: async () => {},
			indexes: [{ def: HRV_STRESS_INDEX, sink, fetchWindow: (start, end) => HRV_STRESS_INDEX.fetchWindow(stub, start, end) }],
		});
		return { report, sink, api, source };
	}

	it("asks one window for the run's days: one request", async () => {
		const { report, sink, api, source } = await sync("2026-10-05", "2026-10-11", { from: "2016-10-04", to: "2026-10-10" });
		assert.deepEqual(api, ["daily 2026-10-05 2026-10-11"]);
		assert.equal(report.requests - source.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [{ date: "2026-10-08", score: 42, n: 1 }]);
		const dates = [...sink.merged[0]!.dates].sort();
		assert.deepEqual([dates.length, dates[0], dates.at(-1)], [7, "2026-10-05", "2026-10-11"]);
	});

	it("reaches back to the index's newest day after a vault was left closed, still in one window", async () => {
		const { api } = await sync("2026-10-05", "2026-10-11", { from: "2016-10-04", to: "2025-01-31" });
		assert.deepEqual(api, ["daily 2025-02-01 2026-10-11"]);
	});

	it("asks nothing while the hrv group is off", async () => {
		const { api, sink } = await sync("2026-10-11", "2026-10-11", null, ["sleep"]);
		assert.deepEqual(api, []);
		assert.equal(sink.merged.length, 0);
	});
});
