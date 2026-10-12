import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, TrainingStatus, TrainingStatusEntry, TrainingStatusHistory } from "../src/garmin/endpoints";
import { shiftDate, type DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import type { DayData } from "../src/sync/metrics";
import {
	TRAINING_STATUS_INDEX,
	entriesOfHistory,
	primaryStatus,
	rowOfDay,
	rowOfStatus,
	statusDateOf,
	type TrainingStatusRow,
} from "../src/sync/training-status-index";

/*
 * Payloads as Garmin sent them on 2026-10-11 and 12
 * (ref/performance-stats/training-status/api-samples/): the capture day's
 * entry (`daily-2026-10-11.json`, the same in `aggregated-2026-10-11.json`
 * and the weekly rows), the two rows around the missing 2025-08-08
 * (`probe-weekly-gap-2025-08-07_2025-08-09.json`), the empty window before
 * the history and today before the watch synced. The device id is the
 * Forerunner 970's; the Edge 840 never had a row and is made up below.
 */

const WATCH = 3611994638;

/** The capture day: MAINTAINING_2, acute 498 over chronic 393, OPTIMAL. */
const OCT_11: TrainingStatusEntry = {
	calendarDate: "2026-10-11",
	sinceDate: "2026-10-11",
	weeklyTrainingLoad: null,
	trainingStatus: 4,
	timestamp: 1791697268000,
	deviceId: WATCH,
	loadTunnelMin: null,
	loadTunnelMax: null,
	loadLevelTrend: null,
	sport: "RUNNING",
	subSport: "GENERIC",
	fitnessTrendSport: "RUNNING",
	fitnessTrend: 2,
	trainingStatusFeedbackPhrase: "MAINTAINING_2",
	trainingPaused: false,
	acuteTrainingLoadDTO: {
		acwrPercent: 52,
		acwrStatus: "OPTIMAL",
		acwrStatusFeedback: "FEEDBACK_2",
		dailyTrainingLoadAcute: 498,
		maxTrainingLoadChronic: 589.5,
		minTrainingLoadChronic: 314.40000000000003,
		dailyTrainingLoadChronic: 393,
		dailyAcuteChronicWorkloadRatio: 1.2,
	},
	primaryTrainingDevice: true,
};

/** The history's first status: No Status, no trend, the load not rated. */
const AUG_7_2025: TrainingStatusEntry = {
	calendarDate: "2025-08-07",
	sinceDate: null,
	weeklyTrainingLoad: null,
	trainingStatus: 0,
	timestamp: 1754635234000,
	deviceId: WATCH,
	sport: null,
	subSport: null,
	fitnessTrendSport: null,
	fitnessTrend: null,
	trainingStatusFeedbackPhrase: "NO_STATUS_1",
	trainingPaused: false,
	acuteTrainingLoadDTO: {
		acwrPercent: null,
		acwrStatus: "NONE",
		acwrStatusFeedback: "NONE",
		dailyTrainingLoadAcute: 971,
		maxTrainingLoadChronic: 1267.5,
		minTrainingLoadChronic: 676,
		dailyTrainingLoadChronic: 845,
		dailyAcuteChronicWorkloadRatio: null,
	},
	primaryTrainingDevice: true,
};

/** After the missing day: still No Status, the trend sport NONE and the load rated. */
const AUG_9_2025: TrainingStatusEntry = {
	...AUG_7_2025,
	calendarDate: "2025-08-09",
	timestamp: 1754746834000,
	fitnessTrendSport: "NONE",
	fitnessTrend: 0,
	trainingStatusFeedbackPhrase: "NO_STATUS_2",
	acuteTrainingLoadDTO: { ...AUG_7_2025.acuteTrainingLoadDTO, acwrPercent: 42, acwrStatus: "OPTIMAL", acwrStatusFeedback: "FEEDBACK_2", dailyTrainingLoadAcute: 845 },
};

/** `trainingstatus/weekly` as it answers a span: the recorded devices and a list per device, oldest first. */
function weekly(from: string, to: string, rows: TrainingStatusEntry[]): TrainingStatusHistory {
	return {
		userId: 136055941,
		fromCalendarDate: from,
		toCalendarDate: to,
		showSelector: false,
		recordedDevices: rows.length ? [{ deviceId: WATCH, deviceName: "Forerunner 970", category: 0 }] : [],
		reportData: rows.length ? { [WATCH]: rows } : {},
	};
}

/** The spec's example row. */
const OCT_11_ROW: TrainingStatusRow = {
	date: "2026-10-11",
	code: 4,
	phrase: "MAINTAINING_2",
	acute: 498,
	chronic: 393,
	ratio: 1.2,
	acwr: "OPTIMAL",
	acwrPct: 52,
	acwrFeedback: "FEEDBACK_2",
	trend: 2,
	trendSport: "RUNNING",
};

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => TRAINING_STATUS_INDEX.normalize(r));

/** The history's days: 2025-08-02 → 2026-10-11, all but 2025-08-08: 435 rows. */
const HISTORY: string[] = [];
for (let day = "2025-08-02"; day <= "2026-10-11"; day = shiftDate(day, 1)) if (day !== "2025-08-08") HISTORY.push(day);

describe("TRAINING_STATUS_INDEX — the definition", () => {
	it("is the training-status index of the training group: a year a window, the last two days refreshed, fed by the day sync's training status", () => {
		assert.deepEqual(
			[TRAINING_STATUS_INDEX.kind, TRAINING_STATUS_INDEX.folder, TRAINING_STATUS_INDEX.title, TRAINING_STATUS_INDEX.group, TRAINING_STATUS_INDEX.version, TRAINING_STATUS_INDEX.listKey],
			["training-status", "training-status", "training status", "training", 1, "days"],
		);
		assert.deepEqual(
			[TRAINING_STATUS_INDEX.windowDays, TRAINING_STATUS_INDEX.refreshDays, TRAINING_STATUS_INDEX.emptyWindowsToStop, TRAINING_STATUS_INDEX.keepOld],
			[365, 2, 1, false],
		);
		assert.equal(TRAINING_STATUS_INDEX.maxHistoryDays, undefined);
		// The columns Load's Training Load tab and Training Readiness's acute timeline read too, in this order.
		assert.deepEqual(TRAINING_STATUS_INDEX.keys, ["code", "phrase", "acute", "chronic", "ratio", "acwr", "acwrPct", "acwrFeedback", "trend", "trendSport", "paused"]);
		assert.deepEqual(TRAINING_STATUS_INDEX.fromDay?.needs, ["training"]);
		assert.equal(TRAINING_STATUS_INDEX.fromSummary, undefined);
	});

	it("writes the spec's example row a line and reads it back: no sinceDate, no min/max chronic, no timestamp", () => {
		const row = TRAINING_STATUS_INDEX.normalize(rowOfStatus(OCT_11))!;
		assert.deepEqual(row, OCT_11_ROW);
		const text = TRAINING_STATUS_INDEX.serializeYear("2026", [row]);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-11","code":4,"phrase":"MAINTAINING_2","acute":498,"chronic":393,"ratio":1.2,"acwr":"OPTIMAL","acwrPct":52,"acwrFeedback":"FEEDBACK_2","trend":2,"trendSport":"RUNNING"}\n\t]\n}\n',
		);
		assert.deepEqual(TRAINING_STATUS_INDEX.parseYear(text), [row]);
	});

	it("keeps No Status's code 0 and trend 0, and drops what Garmin sends as null", () => {
		assert.deepEqual(normalized([rowOfStatus(AUG_7_2025), rowOfStatus(AUG_9_2025)]), [
			// NO_STATUS_1: no ratio, no gauge place, no trend; the load not rated.
			{ date: "2025-08-07", code: 0, phrase: "NO_STATUS_1", acute: 971, chronic: 845, acwr: "NONE", acwrFeedback: "NONE" },
			// NO_STATUS_2: rated, the trend 0 for the sport NONE.
			{ date: "2025-08-09", code: 0, phrase: "NO_STATUS_2", acute: 845, chronic: 845, acwr: "OPTIMAL", acwrPct: 42, acwrFeedback: "FEEDBACK_2", trend: 0, trendSport: "NONE" },
		]);
		// Detraining on 2026-01-10 sends a ratio of 0, and VERY_HIGH appears at 2.0 and 2.1.
		const jan10 = { ...OCT_11, calendarDate: "2026-01-10", acuteTrainingLoadDTO: { ...OCT_11.acuteTrainingLoadDTO, dailyAcuteChronicWorkloadRatio: 0, acwrPercent: 0 } };
		assert.deepEqual([TRAINING_STATUS_INDEX.normalize(rowOfStatus(jan10))?.ratio, TRAINING_STATUS_INDEX.normalize(rowOfStatus(jan10))?.acwrPct], [0, 0]);
	});

	it("marks a paused day 1 and leaves the column out otherwise (never seen paused)", () => {
		assert.equal(TRAINING_STATUS_INDEX.normalize(rowOfStatus({ ...OCT_11, trainingPaused: true }))?.paused, 1);
		assert.equal("paused" in TRAINING_STATUS_INDEX.normalize(rowOfStatus(OCT_11))!, false);
	});

	it("dates an entry by its calendar day", () => {
		assert.equal(statusDateOf({ calendarDate: "2026-10-11" }), "2026-10-11");
		assert.equal(statusDateOf({ calendarDate: "2026-10-11T00:00:00.0" }), "2026-10-11");
		assert.equal(statusDateOf({}), undefined);
		assert.equal(statusDateOf(null), undefined);
		assert.equal(TRAINING_STATUS_INDEX.normalize(rowOfStatus({ trainingStatus: 4 })), null);
	});
});

describe("TRAINING_STATUS_INDEX — a window", () => {
	it("asks trainingstatus/weekly for the window and keeps a row a day", async () => {
		const asked: string[] = [];
		const api = { trainingStatusWeekly: async (start: string, end: string) => (asked.push(`${start} ${end}`), weekly(start, end, [AUG_7_2025, AUG_9_2025])) } as unknown as GarminApi;
		const rows = normalized(await TRAINING_STATUS_INDEX.fetchWindow(api, "2025-08-07", "2025-08-09"));
		assert.deepEqual(asked, ["2025-08-07 2025-08-09"]);
		// 2025-08-08 has no status, so no row: the probe's two rows around it.
		assert.deepEqual(rows.map((r) => [r?.date, r?.code, r?.phrase]), [
			["2025-08-07", 0, "NO_STATUS_1"],
			["2025-08-09", 0, "NO_STATUS_2"],
		]);
	});

	it("reads a span without a status (reportData {}) or a null answer as no rows", async () => {
		for (const answer of [weekly("2025-07-01", "2025-07-31", []), null]) {
			const api = { trainingStatusWeekly: async () => answer } as unknown as GarminApi;
			assert.deepEqual(await TRAINING_STATUS_INDEX.fetchWindow(api, "2025-07-01", "2025-07-31"), []);
		}
	});

	it("keeps the primary training device's row where two devices have the day, else the first device's", () => {
		const EDGE = 3500000001;
		const edge = (entry: TrainingStatusEntry): TrainingStatusEntry => ({ ...entry, deviceId: EDGE, trainingStatus: 7, trainingStatusFeedbackPhrase: "PRODUCTIVE_3", primaryTrainingDevice: false });
		const answer: TrainingStatusHistory = {
			reportData: { [EDGE]: [edge(AUG_9_2025), edge(OCT_11)], [WATCH]: [OCT_11], "9": [{ calendarDate: "2026-10-11", trainingStatus: 8, primaryTrainingDevice: false }] },
		};
		assert.deepEqual(entriesOfHistory(answer).map((e) => [e.calendarDate, e.deviceId, e.trainingStatusFeedbackPhrase]), [
			// Only the Edge has Aug 9: its row stands.
			["2025-08-09", EDGE, "PRODUCTIVE_3"],
			// The watch is the primary device: its row, whichever device is listed first.
			["2026-10-11", WATCH, "MAINTAINING_2"],
		]);
		// Without a flag, the first device's, as the day files take it.
		assert.equal(primaryStatus({ a: { trainingStatus: 5 }, b: { trainingStatus: 6 } })?.trainingStatus, 5);
		assert.equal(primaryStatus({ a: { trainingStatus: 5 }, b: { trainingStatus: 6, primaryTrainingDevice: true } })?.trainingStatus, 6);
		assert.equal(primaryStatus(null), undefined);
		assert.deepEqual(entriesOfHistory({ reportData: null }), []);
	});

	it("walks the whole history in three requests, a year each: 364 rows, 71, then the empty year", async () => {
		const calls: string[] = [];
		const api = {
			trainingStatusWeekly: async (start: string, end: string) => {
				calls.push(`${start} ${end}`);
				const days = HISTORY.filter((d) => d >= start && d <= end);
				return weekly(start, end, days.map((d) => ({ ...OCT_11, calendarDate: d, sinceDate: null })));
			},
		} as unknown as GarminApi;
		const walk = await walkHistory(TRAINING_STATUS_INDEX, (start, end) => TRAINING_STATUS_INDEX.fetchWindow(api, start, end), { until: "2026-10-12" });
		// The Data plan's windows: today has no row yet (Oct 12, 05:38).
		assert.deepEqual(calls, ["2025-10-13 2026-10-12", "2024-10-13 2025-10-12", "2023-10-14 2024-10-12"]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete, walk.error], [3, 435, true, undefined]);
		assert.equal(walk.batch.rows.filter((r) => r.date >= "2025-10-13").length, 364);
		assert.equal(walk.batch.rows.filter((r) => r.date <= "2025-10-12").length, 71);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], "2025-08-02");
		assert.deepEqual(walk.covered, { from: "2023-10-14", to: "2026-10-12" });
	});
});

describe("TRAINING_STATUS_INDEX — the day sync", () => {
	/** `trainingstatus/aggregated/{date}`: the status map, keyed by device, as the day sync fetches it. */
	const aggregated = (entry: TrainingStatusEntry): TrainingStatus => ({
		mostRecentVO2Max: null,
		mostRecentTrainingLoadBalance: null,
		mostRecentTrainingStatus: { latestTrainingStatusData: { [WATCH]: entry }, recordedDevices: [], showSelector: false, lastPrimarySyncDate: entry.calendarDate },
		heatAltitudeAcclimationDTO: null,
	});
	/** Today before the watch syncs: every part null (2026-10-12). */
	const NOTHING: TrainingStatus = { mostRecentVO2Max: null, mostRecentTrainingLoadBalance: null, mostRecentTrainingStatus: null, heatAltitudeAcclimationDTO: null };
	const OCT_10: TrainingStatusEntry = {
		...OCT_11,
		calendarDate: "2026-10-10",
		sinceDate: "2026-10-06",
		trainingStatus: 5,
		trainingStatusFeedbackPhrase: "RECOVERY_2",
		acuteTrainingLoadDTO: { ...OCT_11.acuteTrainingLoadDTO, dailyTrainingLoadAcute: 281, dailyTrainingLoadChronic: 362, dailyAcuteChronicWorkloadRatio: 0.7, acwrStatus: "LOW", acwrPercent: 29, acwrStatusFeedback: "FEEDBACK_1" },
	};
	const OCT_10_ROW: TrainingStatusRow = { ...OCT_11_ROW, date: "2026-10-10", code: 5, phrase: "RECOVERY_2", acute: 281, chronic: 362, ratio: 0.7, acwr: "LOW", acwrPct: 29, acwrFeedback: "FEEDBACK_1" };

	const read = (day: DayData, date: string) => {
		const row = TRAINING_STATUS_INDEX.fromDay!.read(day, date);
		return row ? TRAINING_STATUS_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's aggregated status, which is the day's weekly row but its sinceDate", () => {
		assert.deepEqual(read({ training: aggregated(OCT_11) }, "2026-10-11"), OCT_11_ROW);
		assert.deepEqual(rowOfDay({ training: aggregated(OCT_11) }, "2026-10-11"), rowOfStatus(OCT_11));
		// The flat spelling an older account might send.
		assert.deepEqual(read({ training: { latestTrainingStatusData: { [WATCH]: OCT_11 } } }, "2026-10-11"), OCT_11_ROW);
	});

	it("finds no row for a day without a status, so the day is covered without one", () => {
		assert.equal(read({ training: NOTHING }, "2026-10-12"), null);
		assert.equal(read({ training: null }, "2026-10-12"), null);
		assert.equal(read({}, "2026-10-12"), null);
		// An entry of another day (the daily route answers today with yesterday's) is never this day's.
		assert.equal(read({ training: aggregated(OCT_11) }, "2026-10-12"), null);
	});

	/** The training group alone: the aggregated status a day, and running tolerance once for the run. */
	function trainingSource(calls: string[], days: Record<string, TrainingStatus | null>): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "trainingStatus") return days[a!] ?? null;
				if (name === "runningTolerance") return [];
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<TrainingStatusRow> {
		constructor(public held: { from?: string; to?: string } | null) {}
		merged: Array<DayIndexBatch<TrainingStatusRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<TrainingStatusRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	it("is fed by a routine sync at no request of its own: the run's days cover the two it refreshes", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink({ from: "2025-08-02", to: "2026-10-09" });
		const report = await syncRange(trainingSource(calls, { "2026-10-10": aggregated(OCT_10), "2026-10-11": aggregated(OCT_11), "2026-10-12": NOTHING }), target, {
			from: "2026-10-10",
			to: "2026-10-12",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: TRAINING_STATUS_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		// A status a day for three days, and running tolerance once.
		assert.equal(report.requests, 4);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [OCT_11_ROW, OCT_10_ROW]);
		// Today is covered with no row, so a stale one would go.
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-10", "2026-10-11", "2026-10-12"]);
	});

	it("asks one window for yesterday when the run covers only today: its row can land after the last sync of it", async () => {
		const windows: string[] = [];
		const sink = new Sink({ from: "2025-08-02", to: "2026-10-11" });
		await syncRange(trainingSource([], { "2026-10-12": NOTHING }), target, {
			from: "2026-10-12",
			to: "2026-10-12",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: TRAINING_STATUS_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), [rowOfStatus(OCT_11)]) }],
		});
		assert.deepEqual(windows, ["2026-10-11 2026-10-11"]);
		assert.deepEqual(sink.merged[0]!.rows, [OCT_11_ROW]);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-11", "2026-10-12"]);
	});

	it("leaves a day whose request failed to the window", async () => {
		const windows: string[] = [];
		const failing = new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string) => {
				if (name === "runningTolerance") return [];
				if (name === "trainingStatus" && a === "2026-10-10") throw new Error("HTTP 500");
				return a === "2026-10-11" ? aggregated(OCT_11) : null;
			},
		});
		await syncRange(failing, target, {
			from: "2026-10-10",
			to: "2026-10-11",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: TRAINING_STATUS_INDEX, sink: new Sink({ from: "2025-08-02", to: "2026-10-09" }), fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, ["2026-10-10 2026-10-10"]);
	});
});
