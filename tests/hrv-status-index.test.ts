import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, HrvRange, HrvSummary } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SeriesTarget, type SyncSource } from "../src/sync/engine";
import {
	HRV_DAY,
	HRV_DAY_KEY,
	HRV_STATUS_INDEX,
	HRV_STEP_MS,
	hrvNightIn,
	hrvNightOf,
	rowOfNight,
	rowOfSummary,
	type HrvNight,
	type HrvStatusRow,
} from "../src/sync/hrv-status-index";
import { parseSeries, serializeSeries, type DaySeries } from "../src/sync/intraday";
import { SERIES_KEYS } from "../src/sync/intraday-registry";
import type { DayData, HrvData } from "../src/sync/metrics";

/*
 * Payloads as Garmin sent them on 2026-10-11 and 12
 * (ref/performance-stats/hrv-status/api-samples/), trimmed: `hrv/daily` rows
 * whole, `hrv/{date}` with its readings rebuilt from their values and the
 * first reading's time (every gap in them is a multiple of five minutes).
 */

const HOUR = 3_600_000;
const STEP = 300_000;
const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}.0`;
const at = (gmt: string) => Date.parse(`${gmt}Z`);

/** Five-minute readings from `firstGmt`, `skip` slots left out before the reading at an index. */
function readings(values: string, firstGmt: string, offset: number, skip: Record<number, number> = {}): NonNullable<HrvData["hrvReadings"]> {
	let t = at(firstGmt);
	return values.split(/\s+/).filter(Boolean).map((v, i) => {
		t += (skip[i] ?? 0) * STEP;
		const reading = { hrvValue: Number(v), readingTimeGMT: iso(t), readingTimeLocal: iso(t + offset) };
		t += STEP;
		return reading;
	});
}

const OCT_11_SUMMARY: HrvSummary = {
	calendarDate: "2026-10-11",
	weeklyAvg: 84,
	lastNightAvg: 79,
	lastNight5MinHigh: 105,
	baseline: { lowUpper: 69, balancedLow: 73, balancedUpper: 90, markerValue: 0.57351685 },
	status: "BALANCED",
	feedbackPhrase: "HRV_BALANCED_6",
	createTimeStamp: "2026-10-11T03:37:03.294",
};

/** The phone's night: 78 readings, 00:01:41 to 06:26:41, asleep 23:58:40 to 06:31:40 at +4 h. */
const OCT_11_VALUES =
	"76 95 75 70 76 80 72 74 85 102 76 71 71 70 69 73 65 65 65 79 70 70 64 71 62 66 66 63 80 80 62 61 53 80 75 92 " +
	"83 76 85 87 86 86 93 89 87 105 98 94 101 97 104 87 72 84 81 82 77 94 90 83 82 76 74 75 73 87 82 92 88 88 91 78 79 78 84 88 74 74";

const OCT_11: HrvData = {
	userProfilePk: 136055941,
	hrvSummary: OCT_11_SUMMARY,
	hrvReadings: readings(OCT_11_VALUES, "2026-10-10T20:01:41", 4 * HOUR),
	startTimestampGMT: "2026-10-10T19:58:40.0",
	endTimestampGMT: "2026-10-11T02:26:41.0",
	startTimestampLocal: "2026-10-10T23:58:40.0",
	endTimestampLocal: "2026-10-11T06:26:41.0",
	sleepStartTimestampGMT: "2026-10-10T19:58:40.0",
	sleepEndTimestampGMT: "2026-10-11T02:31:40.0",
	sleepStartTimestampLocal: "2026-10-10T23:58:40.0",
	sleepEndTimestampLocal: "2026-10-11T06:31:40.0",
};

/** 76 readings with a 25-minute gap, 05:59:50 → 06:24:50 local, at +4 h. */
const JUL_11: HrvData = {
	userProfilePk: 136055941,
	hrvSummary: {
		calendarDate: "2026-07-11",
		weeklyAvg: 85,
		lastNightAvg: 79,
		lastNight5MinHigh: 101,
		baseline: { lowUpper: 70, balancedLow: 74, balancedUpper: 93, markerValue: 0.5394592 },
		status: "BALANCED",
		feedbackPhrase: "HRV_BALANCED_6",
	},
	hrvReadings: readings(
		"88 82 75 70 81 72 95 85 80 89 93 65 76 84 78 85 78 69 69 77 75 83 82 74 75 77 88 90 92 97 83 91 87 91 81 77 83 73 " +
			"70 79 67 77 75 79 75 83 82 72 74 78 74 88 93 89 82 90 77 101 98 88 94 86 82 74 75 85 79 85 48 61 56 57 46 51 50 48",
		"2026-07-10T20:24:50",
		4 * HOUR,
		{ 68: 4 },
	),
	sleepStartTimestampGMT: "2026-07-10T20:21:32.0",
	sleepEndTimestampGMT: "2026-07-11T03:01:32.0",
	sleepStartTimestampLocal: "2026-07-11T00:21:32.0",
	sleepEndTimestampLocal: "2026-07-11T07:01:32.0",
};

/** A status but no overnight value: the summary, no readings, no sleep window. */
const SEP_17: HrvData = {
	userProfilePk: 136055941,
	hrvSummary: {
		calendarDate: "2026-09-17",
		weeklyAvg: 73,
		lastNightAvg: null,
		lastNight5MinHigh: null,
		baseline: { lowUpper: 71, balancedLow: 74, balancedUpper: 90, markerValue: 0.20222473 },
		status: "UNBALANCED",
		feedbackPhrase: "HRV_UNBALANCED_10",
		createTimeStamp: "2026-09-17T01:06:55.371",
	},
	hrvReadings: [],
	startTimestampGMT: "2026-09-17T01:06:20.0",
	endTimestampGMT: "2026-09-17T01:06:22.0",
	startTimestampLocal: "2026-09-17T04:06:20.0",
	endTimestampLocal: "2026-09-17T04:06:22.0",
	sleepStartTimestampGMT: null,
	sleepEndTimestampGMT: null,
	sleepStartTimestampLocal: null,
	sleepEndTimestampLocal: null,
};

/** Onboarding, before the readings Garmin keeps: no baseline, status NONE, no readings. */
const AUG_10_2025: HrvData = {
	userProfilePk: 136055941,
	hrvSummary: { calendarDate: "2025-08-10", weeklyAvg: 80, lastNightAvg: 76, lastNight5MinHigh: 93, baseline: null, status: "NONE", feedbackPhrase: "ONBOARDING_1" },
	hrvReadings: [],
	sleepStartTimestampGMT: null,
	sleepEndTimestampGMT: null,
	sleepStartTimestampLocal: null,
	sleepEndTimestampLocal: null,
};

/** `hrv/daily` rows: the first night, the first 7-day average, an ONBOARDING_2 night, the LOW night, Sep 17 and the capture day. */
const AUG_3_2025: HrvSummary = { calendarDate: "2025-08-03", weeklyAvg: null, lastNightAvg: 52, lastNight5MinHigh: 94, baseline: null, status: "NONE", feedbackPhrase: "ONBOARDING_1", createTimeStamp: "2025-08-04T03:20:12.633" };
const AUG_6_2025: HrvSummary = { calendarDate: "2025-08-06", weeklyAvg: 79, lastNightAvg: 89, lastNight5MinHigh: 114, baseline: null, status: "NONE", feedbackPhrase: "ONBOARDING_1", createTimeStamp: "2025-08-06T11:27:19.619" };
const MAR_19: HrvSummary = {
	calendarDate: "2026-03-19",
	weeklyAvg: null,
	lastNightAvg: 62,
	lastNight5MinHigh: 99,
	baseline: { lowUpper: 69, balancedLow: 73, balancedUpper: 96, markerValue: null },
	status: "NONE",
	feedbackPhrase: "ONBOARDING_2",
	createTimeStamp: "2026-03-19T02:53:18.732",
};
const SEP_22: HrvSummary = {
	calendarDate: "2026-09-22",
	weeklyAvg: 70,
	lastNightAvg: 78,
	lastNight5MinHigh: 109,
	baseline: { lowUpper: 70, balancedLow: 74, balancedUpper: 90, markerValue: 0.11810303 },
	status: "LOW",
	feedbackPhrase: "HRV_LOW_5",
	createTimeStamp: "2026-09-22T04:36:45.600",
};

/** Every night of the history: 2025-08-03 → 2026-10-11 but 19 nights without a row, 416 rows. */
const MISSING = new Set([
	"2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-10", "2026-01-30", "2026-02-12", "2026-02-21", "2026-02-25",
	"2026-03-07", "2026-03-14", "2026-03-15", "2026-03-17", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10", "2026-09-12",
]);
const HISTORY: string[] = [];
for (let t = at("2025-08-03T00:00:00"); t <= at("2026-10-11T00:00:00"); t += 24 * HOUR) {
	const date = iso(t).slice(0, 10);
	if (!MISSING.has(date)) HISTORY.push(date);
}

const daysIn = (start: string, end: string) => Math.round((at(`${end}T00:00:00`) - at(`${start}T00:00:00`)) / (24 * HOUR)) + 1;

/** `hrv/daily` as Garmin answers it: 367 days at most (HTTP 400 past it), null (204) for a span without a night. */
function rangeApi(calls: string[]): GarminApi {
	return {
		hrvDaily: async (start: string, end: string): Promise<HrvRange | null> => {
			calls.push(`${start} ${end}`);
			if (daysIn(start, end) > 367) throw new GarminApiError("HTTP 400", 400, "");
			const rows = HISTORY.filter((d) => d >= start && d <= end).map((d) => ({ ...OCT_11_SUMMARY, calendarDate: d }));
			return rows.length ? { hrvSummaries: rows, userProfilePk: 136055941 } : null;
		},
	} as unknown as GarminApi;
}

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => HRV_STATUS_INDEX.normalize(r));

/** The spec's example row. */
const OCT_11_ROW: HrvStatusRow = { date: "2026-10-11", weekly: 84, night: 79, high: 105, lowUpper: 69, balLow: 73, balHigh: 90, marker: 0.5735, status: "BALANCED", feedback: "HRV_BALANCED_6" };

describe("HRV_STATUS_INDEX — the definition", () => {
	it("is the hrv-status index of the hrv group: 367 days a window, the last 28 refreshed, fed by the day sync's hrv", () => {
		assert.deepEqual(
			[HRV_STATUS_INDEX.kind, HRV_STATUS_INDEX.folder, HRV_STATUS_INDEX.title, HRV_STATUS_INDEX.group, HRV_STATUS_INDEX.version, HRV_STATUS_INDEX.listKey],
			["hrv-status", "hrv-status", "HRV status", "hrv", 1, "days"],
		);
		assert.deepEqual([HRV_STATUS_INDEX.windowDays, HRV_STATUS_INDEX.refreshDays, HRV_STATUS_INDEX.emptyWindowsToStop, HRV_STATUS_INDEX.keepOld], [367, 28, 1, false]);
		assert.equal(HRV_STATUS_INDEX.maxHistoryDays, undefined);
		assert.deepEqual(HRV_STATUS_INDEX.keys, ["weekly", "night", "high", "lowUpper", "balLow", "balHigh", "marker", "status", "feedback"]);
		assert.deepEqual(HRV_STATUS_INDEX.fromDay?.needs, ["hrv"]);
		assert.equal(HRV_STATUS_INDEX.fromSummary, undefined);
	});

	it("writes the spec's row a line, the marker to 4 dp, and reads it back", () => {
		const row = HRV_STATUS_INDEX.normalize(rowOfSummary(OCT_11_SUMMARY))!;
		assert.deepEqual(row, OCT_11_ROW);
		const text = HRV_STATUS_INDEX.serializeYear("2026", [row]);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-11","weekly":84,"night":79,"high":105,"lowUpper":69,"balLow":73,"balHigh":90,"marker":0.5735,"status":"BALANCED","feedback":"HRV_BALANCED_6"}\n\t]\n}\n',
		);
		assert.deepEqual(HRV_STATUS_INDEX.parseYear(text), [row]);
	});

	it("keeps what an onboarding night has, NONE included, and drops what Garmin sends as null", () => {
		assert.deepEqual(normalized([AUG_3_2025, AUG_6_2025, MAR_19, SEP_17.hrvSummary].map(rowOfSummary)), [
			// Nights 1–3: no 7-day average, no baseline.
			{ date: "2025-08-03", night: 52, high: 94, status: "NONE", feedback: "ONBOARDING_1" },
			{ date: "2025-08-06", weekly: 79, night: 89, high: 114, status: "NONE", feedback: "ONBOARDING_1" },
			// After a gap: the baseline stays, the average and the marker go.
			{ date: "2026-03-19", night: 62, high: 99, lowUpper: 69, balLow: 73, balHigh: 96, status: "NONE", feedback: "ONBOARDING_2" },
			// A status without an overnight value.
			{ date: "2026-09-17", weekly: 73, lowUpper: 71, balLow: 74, balHigh: 90, marker: 0.2022, status: "UNBALANCED", feedback: "HRV_UNBALANCED_10" },
		]);
		// A marker far below the band is 0, still a place on the dial.
		assert.equal(HRV_STATUS_INDEX.normalize(rowOfSummary({ ...SEP_22, baseline: { ...SEP_22.baseline, markerValue: 0 } }))?.marker, 0);
	});
});

describe("HRV_STATUS_INDEX — a window", () => {
	it("asks hrv/daily for the window and keeps a row a night", async () => {
		const asked: string[] = [];
		const api = { hrvDaily: async (start: string, end: string) => (asked.push(`${start} ${end}`), { hrvSummaries: [SEP_22, OCT_11_SUMMARY], userProfilePk: 1 }) } as unknown as GarminApi;
		const rows = normalized(await HRV_STATUS_INDEX.fetchWindow(api, "2025-10-11", "2026-10-11"));
		assert.deepEqual(asked, ["2025-10-11 2026-10-11"]);
		assert.deepEqual(rows, [
			{ date: "2026-09-22", weekly: 70, night: 78, high: 109, lowUpper: 70, balLow: 74, balHigh: 90, marker: 0.1181, status: "LOW", feedback: "HRV_LOW_5" },
			OCT_11_ROW,
		]);
	});

	it("reads a span without a night (HTTP 204, null) as no rows", async () => {
		const api = { hrvDaily: async () => null } as unknown as GarminApi;
		assert.deepEqual(await HRV_STATUS_INDEX.fetchWindow(api, "2023-10-09", "2024-10-09"), []);
	});

	it("walks the whole history in three requests, never past the route's 367 days", async () => {
		const calls: string[] = [];
		const api = rangeApi(calls);
		const walk = await walkHistory(HRV_STATUS_INDEX, (start, end) => HRV_STATUS_INDEX.fetchWindow(api, start, end), { until: "2026-10-12" });
		// The probes' windows: 347 rows, 69 rows, then null.
		assert.deepEqual(calls, ["2025-10-11 2026-10-12", "2024-10-09 2025-10-10", "2023-10-08 2024-10-08"]);
		assert.ok(calls.every((c) => daysIn(...(c.split(" ") as [string, string])) === 367));
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete, walk.error], [3, 416, true, undefined]);
		assert.equal(walk.batch.rows.filter((r) => r.date >= "2025-10-11").length, 347);
		assert.equal([...walk.batch.rows].sort((a, b) => (a.date < b.date ? -1 : 1))[0]!.date, "2025-08-03");
		assert.deepEqual(walk.covered, { from: "2023-10-08", to: "2026-10-12" });
	});
});

describe("HRV_STATUS_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = HRV_STATUS_INDEX.fromDay!.read(day, date);
		return row ? HRV_STATUS_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the night's summary, which is the night's hrv/daily row field for field", () => {
		assert.deepEqual(read({ hrv: OCT_11 }, "2026-10-11"), OCT_11_ROW);
		assert.deepEqual(read({ hrv: SEP_17 }, "2026-09-17"), HRV_STATUS_INDEX.normalize(rowOfSummary(SEP_17.hrvSummary)));
	});

	it("finds no row for a night Garmin had nothing for (204), so the day is covered without one", () => {
		assert.equal(read({ hrv: null }, "2026-09-12"), null);
		assert.equal(read({}, "2026-09-12"), null);
	});

	/** The hrv group alone: `hrv/{date}` a day, as the samples answered it. */
	function hrvSource(calls: string[], nights: Record<string, HrvData | null | Error>): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (date?: string) => {
				calls.push(`${name}:${date ?? ""}`);
				if (name !== "hrv") throw new Error(`unexpected ${name}`);
				const night = nights[date!];
				if (night instanceof Error) throw night;
				return night ?? null;
			},
		});
	}

	class Sink implements DayIndexSink<HrvStatusRow> {
		held: { from?: string; to?: string } | null = { from: "2025-08-03", to: "2026-10-09" };
		merged: Array<DayIndexBatch<HrvStatusRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<HrvStatusRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	it("is fed by a routine sync for free, and asks one window for the rest of the last 28 days", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink();
		const report = await syncRange(hrvSource(calls, { "2026-10-11": OCT_11, "2026-10-10": null }), target, {
			from: "2026-10-10",
			to: "2026-10-11",
			groups: ["hrv"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: HRV_STATUS_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		// The run's two nights came with the day sync; rows made up to 26 days late are asked again.
		assert.deepEqual(windows, ["2026-09-14 2026-10-09"]);
		assert.equal(report.requests, 3);
		assert.deepEqual(sink.merged[0]!.rows, [OCT_11_ROW]);
		const dates = [...sink.merged[0]!.dates].sort();
		assert.deepEqual([dates.length, dates[0], dates[dates.length - 1]], [28, "2026-09-14", "2026-10-11"]);
	});

	it("leaves a night whose request failed to the window", async () => {
		const windows: string[] = [];
		await syncRange(hrvSource([], { "2026-10-11": OCT_11, "2026-10-10": new GarminApiError("HTTP 500", 500, "") }), target, {
			from: "2026-10-10",
			to: "2026-10-11",
			groups: ["hrv"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: HRV_STATUS_INDEX, sink: new Sink(), fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, ["2026-09-14 2026-10-10"]);
	});
});

/* ------------------------------------------------------------------ */
/*  The night's readings                                               */
/* ------------------------------------------------------------------ */

/** Oct 11 as HRV_DAY keeps it. */
const OCT_11_NIGHT: HrvNight = {
	sleepStart: at("2026-10-10T19:58:40"),
	sleepEnd: at("2026-10-11T02:31:40"),
	offset: 4 * HOUR,
	start: at("2026-10-10T20:01:41"),
	step: HRV_STEP_MS,
	values: OCT_11_VALUES.split(" ").map(Number),
	weekly: 84,
	night: 79,
	high: 105,
	lowUpper: 69,
	balLow: 73,
	balHigh: 90,
	marker: 0.5735,
	status: "BALANCED",
	feedback: "HRV_BALANCED_6",
};

describe("HRV_DAY — the night's readings", () => {
	it("is an extra of the hrv group with a key of its own, kept by the sync from the day's payload", () => {
		assert.equal(HRV_DAY.key, HRV_DAY_KEY);
		assert.equal(HRV_DAY.key, "hrvDay");
		assert.equal(HRV_DAY.group, "hrv");
		assert.ok(!SERIES_KEYS.has(HRV_DAY.key));
		assert.equal(typeof HRV_DAY.fromDay, "function");
	});

	it("asks hrv/{date}, the request the day sync makes", async () => {
		const asked: string[] = [];
		const api = { hrv: async (date: string) => (asked.push(date), OCT_11) } as unknown as GarminApi;
		assert.equal(await HRV_DAY.fetch(api, "2026-10-11"), OCT_11);
		assert.deepEqual(asked, ["2026-10-11"]);
	});

	it("keeps the sleep window, the watch's offset, the readings on a five-minute grid and the summary", () => {
		const night = HRV_DAY.map(OCT_11, "2026-10-11")!;
		assert.deepEqual(night, OCT_11_NIGHT);
		// 78 readings, none missing: 53 to 105, the web's "Data ranges from 53 to 105".
		assert.equal(night.values.length, 78);
		assert.deepEqual([Math.min(...(night.values as number[])), Math.max(...(night.values as number[]))], [53, 105]);
		// The last reading is the payload's end, five minutes before wake.
		assert.equal(night.start! + 77 * night.step, at("2026-10-11T02:26:41"));
		// The summary is the index's row.
		assert.deepEqual(rowOfNight(night, "2026-10-11"), OCT_11_ROW);
	});

	it("leaves a slot empty where the watch kept no reading", () => {
		const night = HRV_DAY.map(JUL_11, "2026-07-11")!;
		// 76 readings over 80 slots: 05:59:50 → 06:24:50 leaves four empty.
		assert.equal(night.values.length, 80);
		assert.deepEqual(night.values.slice(66, 74), [79, 85, null, null, null, null, 48, 61]);
		assert.equal(night.values.filter((v) => v !== null).length, 76);
		assert.deepEqual([night.start, night.offset, night.sleepStart, night.sleepEnd], [at("2026-07-10T20:24:50"), 4 * HOUR, at("2026-07-10T20:21:32"), at("2026-07-11T03:01:32")]);
	});

	it("keeps a night without readings as its summary: an empty grid and no window", () => {
		assert.deepEqual(HRV_DAY.map(SEP_17, "2026-09-17"), {
			step: HRV_STEP_MS,
			values: [],
			weekly: 73,
			lowUpper: 71,
			balLow: 74,
			balHigh: 90,
			marker: 0.2022,
			status: "UNBALANCED",
			feedback: "HRV_UNBALANCED_10",
		});
		assert.deepEqual(HRV_DAY.map(AUG_10_2025, "2025-08-10"), { step: HRV_STEP_MS, values: [], weekly: 80, night: 76, high: 93, status: "NONE", feedback: "ONBOARDING_1" });
	});

	it("is nothing for a night Garmin had nothing for (204)", () => {
		assert.equal(HRV_DAY.map(null, "2026-09-12"), null);
		assert.equal(hrvNightOf({ hrvReadings: [] }, "2026-09-12"), null);
	});

	it("reads back from the day's series file as it was kept", () => {
		const series = parseSeries(serializeSeries("2026-10-11", { extra: { [HRV_DAY_KEY]: HRV_DAY.map(OCT_11, "2026-10-11") } }));
		assert.deepEqual(hrvNightIn(series), OCT_11_NIGHT);
		const july = HRV_DAY.map(JUL_11, "2026-07-11")!;
		assert.deepEqual(hrvNightIn(parseSeries(serializeSeries("2026-07-11", { extra: { [HRV_DAY_KEY]: july } }))), july);
		assert.equal(hrvNightIn(null), null);
		assert.equal(hrvNightIn({ extra: { [HRV_DAY_KEY]: { step: 0, values: [] } } }), null);
		// Readings with no first time cannot be placed.
		assert.equal(hrvNightIn({ extra: { [HRV_DAY_KEY]: { step: STEP, values: [70] } } }), null);
	});

	it("is kept by a sync only for a night with readings, the payload the day sync already has", () => {
		assert.equal(HRV_DAY.fromDay!({ hrv: OCT_11 }, "2026-10-11"), OCT_11);
		assert.equal(HRV_DAY.fromDay!({ hrv: SEP_17 }, "2026-09-17"), null);
		assert.equal(HRV_DAY.fromDay!({ hrv: null }, "2026-09-12"), null);
		assert.equal(HRV_DAY.fromDay!({}, "2026-09-12"), null);
	});
});

describe("HRV_DAY — kept at sync time", () => {
	/** The series files in memory, through the real serializer. */
	class Store implements SeriesTarget {
		files = new Map<string, string>();
		async read(date: string): Promise<DaySeries | null> {
			const text = this.files.get(date);
			return text ? parseSeries(text) : null;
		}
		async write(date: string, series: DaySeries): Promise<"written" | "unchanged"> {
			const text = serializeSeries(date, series);
			if (this.files.get(date) === text) return "unchanged";
			this.files.set(date, text);
			return "written";
		}
	}

	const sync = (nights: Record<string, HrvData | null>, store: Store, calls: string[] = []) =>
		syncRange(
			new Proxy({} as SyncSource, {
				get: (_, name: string) => async (date?: string) => {
					calls.push(`${name}:${date}`);
					if (name !== "hrv") throw new Error(`unexpected ${name}`);
					return nights[date!] ?? null;
				},
			}),
			{ exists: () => true, write: async () => "written" },
			{ from: "2026-10-10", to: "2026-10-11", groups: ["hrv"], units: "metric", wait: async () => {}, series: store, extras: [HRV_DAY] },
		);

	it("keeps every synced night's readings in its series file, at no request of its own", async () => {
		const store = new Store();
		const calls: string[] = [];
		const report = await sync({ "2026-10-11": OCT_11, "2026-10-10": null }, store, calls);
		assert.deepEqual(calls, ["hrv:2026-10-11", "hrv:2026-10-10"]);
		assert.equal(report.requests, 2);
		assert.equal(report.seriesWritten, 1);
		assert.deepEqual([...store.files.keys()], ["2026-10-11"]);
		assert.deepEqual(hrvNightIn(await store.read("2026-10-11")), OCT_11_NIGHT);
	});

	it("leaves the file alone when the night comes back the same, or without the readings Garmin dropped", async () => {
		const store = new Store();
		await sync({ "2026-10-11": OCT_11 }, store);
		const before = store.files.get("2026-10-11");
		assert.equal((await sync({ "2026-10-11": OCT_11 }, store)).seriesWritten, 0);
		const dropped = { ...OCT_11, hrvReadings: [], sleepStartTimestampGMT: null, sleepEndTimestampGMT: null };
		assert.equal((await sync({ "2026-10-11": dropped }, store)).seriesWritten, 0);
		assert.equal(store.files.get("2026-10-11"), before);
	});
});
