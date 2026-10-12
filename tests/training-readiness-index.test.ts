import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, TrainingReadinessReading } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import { shiftDate, type DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SeriesTarget, type SyncSource } from "../src/sync/engine";
import { parseSeries, serializeSeries, type DaySeries } from "../src/sync/intraday";
import { SERIES_KEYS } from "../src/sync/intraday-registry";
import type { DayData } from "../src/sync/metrics";
import {
	AFTER_ACTIVITY,
	READINESS_DAY,
	READINESS_DAY_KEY,
	REALTIME,
	TRAINING_READINESS_INDEX,
	WAKE_UP,
	dayReadings,
	minuteOfDay,
	morningOf,
	morningReading,
	newestOf,
	readinessDayIn,
	readinessDayOf,
	rowOfDay,
	rowOfReading,
	rowsOfReadings,
	type ReadinessReading,
	type TrainingReadinessRow,
} from "../src/sync/training-readiness-index";
import { ALL, dayReadingsOf, historyCounts, rangeOf } from "./training-readiness-fixture";

/*
 * The index and the extra, against the payloads of 2026-10-12
 * (ref/performance-stats/training-readiness/api-samples/, through
 * training-readiness-fixture.ts) and the spec's Fixture table: each day's
 * morning reading (M) and, where it differs, its newest (N).
 */

/** Oct 11 as `trainingreadiness/2026-10-11` sent it at 22:29 (`2026-10-11.json`), whole. */
const OCT_11_PAYLOAD: TrainingReadinessReading[] = [
	{
		userProfilePK: 136055941,
		calendarDate: "2026-10-11",
		timestamp: "2026-10-11T05:41:11.0",
		timestampLocal: "2026-10-11T09:41:11.0",
		deviceId: 3611994638,
		level: "POOR",
		feedbackLong: "POOR_RT_HIGH_SS_GOOD_OR_MOD",
		feedbackShort: "LET_YOUR_BODY_RECOVER",
		score: 18,
		sleepScore: 89,
		sleepScoreFactorPercent: 88,
		sleepScoreFactorFeedback: "GOOD",
		recoveryTime: 4931,
		recoveryTimeFactorPercent: 10,
		recoveryTimeFactorFeedback: "POOR",
		acwrFactorPercent: 79,
		acwrFactorFeedback: "GOOD",
		acuteLoad: 498,
		stressHistoryFactorPercent: 84,
		stressHistoryFactorFeedback: "GOOD",
		hrvFactorPercent: 90,
		hrvFactorFeedback: "GOOD",
		hrvWeeklyAverage: 84,
		sleepHistoryFactorPercent: 66,
		sleepHistoryFactorFeedback: "MODERATE",
		validSleep: true,
		inputContext: "AFTER_POST_EXERCISE_RESET",
		primaryActivityTracker: true,
		recoveryTimeChangePhrase: "NO_CHANGE_SLEEP",
	},
	{
		userProfilePK: 136055941,
		calendarDate: "2026-10-11",
		timestamp: "2026-10-11T03:36:43.0",
		timestampLocal: "2026-10-11T07:36:43.0",
		deviceId: 3611994638,
		level: "MODERATE",
		feedbackLong: "MOD_RT_MOD_SS_GOOD",
		feedbackShort: "BOOSTED_BY_GOOD_SLEEP",
		score: 64,
		sleepScore: 89,
		sleepScoreFactorPercent: 88,
		sleepScoreFactorFeedback: "GOOD",
		recoveryTime: 1966,
		recoveryTimeFactorPercent: 47,
		recoveryTimeFactorFeedback: "MODERATE",
		acwrFactorPercent: 100,
		acwrFactorFeedback: "VERY_GOOD",
		acuteLoad: 238,
		stressHistoryFactorPercent: 84,
		stressHistoryFactorFeedback: "GOOD",
		hrvFactorPercent: 90,
		hrvFactorFeedback: "GOOD",
		hrvWeeklyAverage: 84,
		sleepHistoryFactorPercent: 66,
		sleepHistoryFactorFeedback: "MODERATE",
		validSleep: true,
		inputContext: "AFTER_WAKEUP_RESET",
		primaryActivityTracker: true,
		recoveryTimeChangePhrase: "NO_CHANGE_SLEEP",
	},
];

/** The spec's example row: Oct 10's morning reading, 07:24:57. */
const OCT_10_ROW: TrainingReadinessRow = {
	date: "2026-10-10",
	time: 444,
	ctx: "AFTER_WAKEUP_RESET",
	score: 80,
	level: "HIGH",
	short: "WELL_RECOVERED",
	long: "HIGH_RT_HIGHEST_SS_AVAILABLE",
	sleep: 90,
	sleepPct: 90,
	sleepFb: "VERY_GOOD",
	recovery: 1,
	recoveryPct: 99,
	recoveryFb: "GOOD",
	acute: 63,
	acwrPct: 100,
	acwrFb: "VERY_GOOD",
	hrv: 84,
	hrvPct: 87,
	hrvFb: "GOOD",
	sleepHistPct: 40,
	sleepHistFb: "MODERATE",
	stressHistPct: 86,
	stressHistFb: "GOOD",
};

/**
 * The spec's Fixture table, Sep 14 – Oct 12: `MM-DD M-time context score
 * level`, then the newest reading's where it differs. Contexts W wake-up,
 * A after an activity, R realtime.
 */
const TABLE = `
09-14 06:26 W 83 HIGH
09-15 10:51 W 49 LOW | 15:17 A 34 LOW
09-16 05:03 W 21 POOR | 22:01 W 5 POOR
09-17 06:48 W 44 LOW | 12:36 R 56 MODERATE
09-18 07:17 W 58 MODERATE | 17:41 W 41 LOW
09-19 06:51 W 78 HIGH | 11:22 A 65 MODERATE
09-20 06:16 W 82 HIGH
09-21 08:11 W 76 HIGH
09-22 07:35 W 79 HIGH | 16:20 R 50 MODERATE
09-23 06:10 W 76 HIGH | 15:52 R 52 MODERATE
09-24 06:47 W 82 HIGH | 12:09 A 86 HIGH
09-25 05:33 W 39 LOW | 23:20 R 25 LOW
09-26 06:56 W 57 MODERATE | 21:20 R 75 HIGH
09-27 07:24 W 88 HIGH | 16:43 A 66 MODERATE
09-28 07:29 W 78 HIGH | 13:20 R 25 LOW
09-29 07:22 W 62 MODERATE
09-30 05:58 W 51 MODERATE
10-01 08:00 W 67 MODERATE
10-02 08:59 W 70 MODERATE
10-03 09:38 W 82 HIGH | 17:20 R 50 MODERATE
10-04 08:26 W 83 HIGH
10-05 08:28 W 90 HIGH
10-06 06:21 W 100 PRIME
10-07 06:54 W 100 PRIME
10-08 06:03 W 94 HIGH
10-09 06:00 W 53 MODERATE
10-10 07:24 W 80 HIGH | 19:30 R 26 LOW
10-11 07:36 W 64 MODERATE | 09:41 A 18 POOR
10-12 06:00 W 19 POOR
`;

const CTX: Readonly<Record<string, string>> = { W: WAKE_UP, A: AFTER_ACTIVITY, R: REALTIME };

/** A reading the way the table writes it. */
function brief(r: Pick<ReadinessReading, "time" | "ctx" | "score" | "level"> | undefined): string {
	if (!r || r.time === undefined) return "-";
	const letter = Object.keys(CTX).find((k) => CTX[k] === r.ctx) ?? "?";
	const hh = String(Math.floor(r.time / 60)).padStart(2, "0");
	const mm = String(r.time % 60).padStart(2, "0");
	return `${hh}:${mm} ${letter} ${r.score ?? "-"} ${r.level ?? "-"}`;
}

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => TRAINING_READINESS_INDEX.normalize(r)!).sort((a, b) => (a.date < b.date ? -1 : 1));

describe("TRAINING_READINESS_INDEX — the definition", () => {
	it("is the training-readiness index of the readiness group: 367 days a window, the last two refreshed, fed by the day sync's readings", () => {
		const def = TRAINING_READINESS_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], ["training-readiness", "training-readiness", "training readiness", "readiness", 1, "days"]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld], [367, 2, 1, false]);
		assert.equal(def.maxHistoryDays, undefined);
		assert.deepEqual(def.keys, [
			"time",
			"ctx",
			"score",
			"level",
			"short",
			"long",
			"sleep",
			"sleepPct",
			"sleepFb",
			"recovery",
			"recoveryPct",
			"recoveryFb",
			"acute",
			"acwrPct",
			"acwrFb",
			"hrv",
			"hrvPct",
			"hrvFb",
			"sleepHistPct",
			"sleepHistFb",
			"stressHistPct",
			"stressHistFb",
		]);
		assert.deepEqual(def.fromDay?.needs, ["readiness"]);
		assert.equal(def.fromSummary, undefined);
	});

	it("writes the spec's example row a line, in the spec's column order, and reads it back", () => {
		const row = TRAINING_READINESS_INDEX.normalize(rowOfDay({ readiness: dayReadingsOf("2026-10-10") }, "2026-10-10"))!;
		assert.deepEqual(row, OCT_10_ROW);
		const text = TRAINING_READINESS_INDEX.serializeYear("2026", [row]);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-10","time":444,"ctx":"AFTER_WAKEUP_RESET","score":80,"level":"HIGH","short":"WELL_RECOVERED","long":"HIGH_RT_HIGHEST_SS_AVAILABLE",' +
				'"sleep":90,"sleepPct":90,"sleepFb":"VERY_GOOD","recovery":1,"recoveryPct":99,"recoveryFb":"GOOD","acute":63,"acwrPct":100,"acwrFb":"VERY_GOOD",' +
				'"hrv":84,"hrvPct":87,"hrvFb":"GOOD","sleepHistPct":40,"sleepHistFb":"MODERATE","stressHistPct":86,"stressHistFb":"GOOD"}\n\t]\n}\n',
		);
		assert.deepEqual(TRAINING_READINESS_INDEX.parseYear(text), [row]);
	});

	it("keeps the watch's minute, truncated: 07:24:57 is 444, not 445", () => {
		assert.equal(minuteOfDay("2026-10-10T07:24:57.0"), 444);
		assert.equal(minuteOfDay("2026-10-11T09:41:11.0"), 581);
		assert.equal(minuteOfDay("2026-10-08T00:20:41.0"), 20);
		assert.equal(minuteOfDay("2026-10-10T23:59:59.0"), 1439);
		for (const bad of [undefined, null, "", "2026-10-10", "2026-10-10T25:00:00", 1791662320000]) assert.equal(minuteOfDay(bad), undefined);
	});

	it("keeps what an onboarding reading has: no score, NONE and UNKNOWN kept, a percent of 0 kept", () => {
		// 2025-08-03: three readings, the first wake-up one at 06:54:58 the morning's (the second wake-up one is 20:19).
		const row = TRAINING_READINESS_INDEX.normalize(rowOfDay({ readiness: dayReadingsOf("2025-08-03") }, "2025-08-03"));
		assert.deepEqual(row, {
			date: "2025-08-03",
			time: 414,
			ctx: "AFTER_WAKEUP_RESET",
			level: "NONE",
			short: "UNKNOWN",
			long: "UNKNOWN",
			sleep: 49,
			sleepPct: 0,
			sleepFb: "NONE",
			recovery: 160,
			recoveryPct: 0,
			recoveryFb: "NONE",
			acwrPct: 0,
			acwrFb: "NONE",
			hrv: 511,
			hrvPct: 0,
			hrvFb: "NONE",
			sleepHistPct: 0,
			sleepHistFb: "NONE",
			stressHistPct: 0,
			stressHistFb: "NONE",
		});
	});

	it("maps a reading field for field, and a reading without a sleep score without one", () => {
		const overnight = dayReadingsOf("2026-10-08").find((r) => r.inputContext === REALTIME)!;
		assert.deepEqual(TRAINING_READINESS_INDEX.normalize(rowOfReading(overnight)), {
			date: "2026-10-08",
			time: 20,
			ctx: "UPDATE_REALTIME_VARIABLES",
			score: 94,
			level: "HIGH",
			short: overnight.feedbackShort,
			long: overnight.feedbackLong,
			sleepPct: 0,
			sleepFb: "NONE",
			recovery: overnight.recoveryTime,
			recoveryPct: overnight.recoveryTimeFactorPercent,
			recoveryFb: overnight.recoveryTimeFactorFeedback,
			acute: overnight.acuteLoad,
			acwrPct: overnight.acwrFactorPercent,
			acwrFb: overnight.acwrFactorFeedback,
			hrv: overnight.hrvWeeklyAverage,
			hrvPct: overnight.hrvFactorPercent,
			hrvFb: overnight.hrvFactorFeedback,
			sleepHistPct: overnight.sleepHistoryFactorPercent,
			sleepHistFb: overnight.sleepHistoryFactorFeedback,
			stressHistPct: overnight.stressHistoryFactorPercent,
			stressHistFb: overnight.stressHistoryFactorFeedback,
		});
		assert.equal(rowOfReading(null).date, undefined);
	});
});

describe("Training Readiness — which reading", () => {
	const days = TABLE.trim().split("\n").map((line) => line.trim().split(" | "));

	it("keeps each day's morning reading: the spec's Fixture, Sep 14 – Oct 12", () => {
		const rows = normalized(rowsOfReadings(rangeOf("2026-09-14", "2026-10-12")));
		assert.equal(rows.length, 29);
		assert.deepEqual(
			rows.map((r) => `${r.date.slice(5)} ${brief(r)}`),
			days.map(([m]) => m!),
		);
	});

	it("knows each day's newest reading: today's", () => {
		for (const [m, n] of days) {
			const date = `2026-${m!.slice(0, 5)}`;
			const kept = readinessDayOf(dayReadingsOf(date), date)!;
			assert.equal(`${date.slice(5)} ${brief(newestOf(kept))}`, `${date.slice(5)} ${n ?? m!.slice(6)}`, date);
			assert.equal(`${date.slice(5)} ${brief(morningOf(kept))}`, m, date);
		}
	});

	it("passes over an overnight realtime reading: Oct 8 shows 06:03's wake-up 94, not 00:20's", () => {
		const oct8 = dayReadingsOf("2026-10-08");
		assert.deepEqual(
			dayReadings(oct8).map((r) => [r.timestampLocal?.slice(11, 16), r.inputContext]),
			[
				["00:20", REALTIME],
				["06:03", WAKE_UP],
			],
		);
		assert.equal(morningReading(oct8)?.timestampLocal, "2026-10-08T06:03:31.0");
	});

	it("takes the first of two wake-up readings: Sep 25's 05:33, not 16:56's after a daytime sleep", () => {
		const wakes = dayReadings(dayReadingsOf("2026-09-25")).filter((r) => r.inputContext === WAKE_UP);
		assert.deepEqual(
			wakes.map((r) => r.timestampLocal?.slice(11, 16)),
			["05:33", "16:56"],
		);
		assert.equal(morningReading(dayReadingsOf("2026-09-25"))?.score, 39);
	});

	it("falls back to the day's first reading without a wake-up one: 2026-01-10, the only such day", () => {
		const jan10 = dayReadingsOf("2026-01-10");
		assert.deepEqual(
			jan10.map((r) => r.inputContext),
			[REALTIME],
		);
		assert.equal(brief(TRAINING_READINESS_INDEX.normalize(rowOfDay({ readiness: jan10 }, "2026-01-10"))!), "12:42 R 93 HIGH");
	});

	it("orders a day by Garmin's GMT timestamp: the watch's clock stepped back an hour on 2026-01-28", () => {
		const jan28 = dayReadingsOf("2026-01-28");
		// By the watch's clock 07:07 (48) is the newest; by GMT 06:59 (3) is, an hour after the zone changed.
		assert.deepEqual(
			dayReadings(jan28).map((r) => [r.timestampLocal?.slice(11, 16), r.score]),
			[
				["04:29", 46],
				["07:07", 48],
				["06:59", 3],
			],
		);
		const kept = readinessDayOf(jan28, "2026-01-28")!;
		assert.equal(brief(newestOf(kept)), "06:59 A 3 POOR");
		assert.equal(brief(morningOf(kept)), "04:29 W 46 LOW");
		// The next day starts with a reading made before midnight GMT.
		assert.equal(brief(TRAINING_READINESS_INDEX.normalize(rowOfDay({ readiness: dayReadingsOf("2026-01-29") }, "2026-01-29"))!), "04:29 W 27 LOW");
	});

	it("leaves out another tracker's readings and another day's", () => {
		const oct11 = dayReadingsOf("2026-10-11");
		const other: TrainingReadinessReading = { ...oct11[1]!, timestamp: "2026-10-11T01:00:00.0", timestampLocal: "2026-10-11T05:00:00.0", primaryActivityTracker: false };
		assert.equal(morningReading([...oct11, other])?.timestampLocal, "2026-10-11T07:36:43.0");
		assert.equal(rowOfDay({ readiness: oct11 }, "2026-10-12"), null);
		assert.deepEqual(dayReadings("nonsense"), []);
		assert.deepEqual(dayReadings([null, 3, "x"]), []);
	});
});

describe("TRAINING_READINESS_INDEX — a window", () => {
	it("asks the range route for the window and keeps a row a day with readings", async () => {
		const asked: string[] = [];
		const api = { trainingReadinessRange: async (start: string, end: string) => (asked.push(`${start} ${end}`), rangeOf(start, end)) } as unknown as GarminApi;
		const rows = normalized(await TRAINING_READINESS_INDEX.fetchWindow(api, "2026-09-15", "2026-10-12"));
		assert.deepEqual(asked, ["2026-09-15 2026-10-12"]);
		// 72 readings on 28 days (the GraphQL query's 72 too).
		assert.equal(rangeOf("2026-09-15", "2026-10-12").length, 72);
		assert.equal(rows.length, 28);
		assert.deepEqual(rows.find((r) => r.date === "2026-10-10"), OCT_10_ROW);
	});

	it("reads a span without readings ([]) as no rows", async () => {
		const api = { trainingReadinessRange: async () => [] } as unknown as GarminApi;
		assert.deepEqual(await TRAINING_READINESS_INDEX.fetchWindow(api, "2023-10-08", "2024-10-08"), []);
		assert.deepEqual(rowsOfReadings(null), []);
	});

	it("walks the whole history in three requests, never past the route's 367 days", async () => {
		const counts = historyCounts();
		// The history as the probes saw it: 1,111 readings on 432 days from 2025-08-02.
		assert.equal(counts.size, 432);
		assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 1111);
		const calls: string[] = [];
		const served: number[] = [];
		const api = {
			trainingReadinessRange: async (start: string, end: string) => {
				calls.push(`${start} ${end}`);
				const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
				if (days > 367) throw new GarminApiError("HTTP 400", 400, "");
				const out: TrainingReadinessReading[] = [];
				for (const [date, n] of counts) {
					if (date < start || date > end) continue;
					for (let i = 0; i < n; i++) {
						// The first of a day's readings on waking, the rest through the day; 2026-01-10 had none on waking.
						const hour = String(6 + i).padStart(2, "0");
						const ctx = i === 0 && date !== "2026-01-10" ? WAKE_UP : REALTIME;
						out.push({ calendarDate: date, timestamp: `${date}T${hour}:00:00.0`, timestampLocal: `${date}T${hour}:00:00.0`, inputContext: ctx, score: 50 + i, level: "MODERATE" });
					}
				}
				served.push(out.length);
				return out.reverse();
			},
		} as unknown as GarminApi;
		const walk = await walkHistory(TRAINING_READINESS_INDEX, (start, end) => TRAINING_READINESS_INDEX.fetchWindow(api, start, end), { until: "2026-10-12" });
		assert.deepEqual(calls, ["2025-10-11 2026-10-12", "2024-10-09 2025-10-10", "2023-10-08 2024-10-08"]);
		// The probes' answers: 908 readings, 203 from 2025-08-02, then [].
		assert.deepEqual(served, [908, 203, 0]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete, walk.error], [3, 432, true, undefined]);
		assert.equal(normalized(walk.batch.rows)[0]!.date, "2025-08-02");
		assert.equal(walk.batch.rows.filter((r) => r.date >= "2025-10-11").length, 362);
		assert.deepEqual(walk.covered, { from: "2023-10-08", to: "2026-10-12" });
		// Every day's row is its morning reading: the wake-up one, or 2026-01-10's first.
		const rows = normalized(walk.batch.rows);
		assert.ok(rows.every((r) => r.time === 360));
		assert.equal(rows.find((r) => r.date === "2026-01-10")?.ctx, REALTIME);
	});
});

/* ------------------------------------------------------------------ */
/*  The day sync                                                       */
/* ------------------------------------------------------------------ */

/** The readiness group alone: `trainingreadiness/{date}` a day, as the samples answered it. */
function readinessSource(calls: string[], days: Record<string, TrainingReadinessReading[] | Error>): SyncSource {
	return new Proxy({} as SyncSource, {
		get: (_, name: string) => async (date?: string) => {
			calls.push(`${name}:${date ?? ""}`);
			if (name !== "trainingReadiness") throw new Error(`unexpected ${name}`);
			const day = days[date!];
			if (day instanceof Error) throw day;
			return day ?? [];
		},
	});
}

class Sink implements DayIndexSink<TrainingReadinessRow> {
	constructor(public held: { from?: string; to?: string } | null = { from: "2025-08-02", to: "2026-10-10" }) {}
	rows = new Map<string, TrainingReadinessRow>();
	merged: Array<DayIndexBatch<TrainingReadinessRow>> = [];
	async coverage() {
		return this.held;
	}
	async merge(batch: DayIndexBatch<TrainingReadinessRow>, covered: { from: string; to: string } | null) {
		this.merged.push(batch);
		for (const date of batch.dates) this.rows.delete(date);
		for (const raw of batch.rows) {
			const row = TRAINING_READINESS_INDEX.normalize(raw);
			if (row) this.rows.set(row.date, row);
		}
		if (covered && this.held?.to && covered.to > this.held.to) this.held = { ...this.held, to: covered.to };
		return 1;
	}
}

const target: DayTarget = { exists: () => true, write: async () => "written" };

describe("TRAINING_READINESS_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = TRAINING_READINESS_INDEX.fromDay!.read(day, date);
		return row ? TRAINING_READINESS_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's morning reading out of every reading the day sync fetched", () => {
		assert.deepEqual(read({ readiness: dayReadingsOf("2026-10-10") }, "2026-10-10"), OCT_10_ROW);
		assert.equal(brief(read({ readiness: OCT_11_PAYLOAD }, "2026-10-11")!), "07:36 W 64 MODERATE");
	});

	it("finds no row for a day without a reading, so the day is covered without one", () => {
		assert.equal(read({ readiness: [] }, "2026-10-12"), null);
		assert.equal(read({ readiness: null }, "2026-01-07"), null);
		assert.equal(read({}, "2026-10-20"), null);
	});

	const sync = (source: SyncSource, sink: Sink, from: string, to: string, windows: string[]) =>
		syncRange(source, target, {
			from,
			to,
			groups: ["readiness"],
			units: "metric",
			wait: async () => {},
			indexes: [
				{
					def: TRAINING_READINESS_INDEX,
					sink,
					fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), rowsOfReadings(rangeOf(start, end))),
				},
			],
		});

	it("is fed by a routine sync for free: the last two days refreshed cost nothing when the run covers them", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink();
		const report = await sync(readinessSource(calls, { "2026-10-11": OCT_11_PAYLOAD, "2026-10-10": dayReadingsOf("2026-10-10") }), sink, "2026-10-10", "2026-10-11", windows);
		assert.deepEqual(calls, ["trainingReadiness:2026-10-11", "trainingReadiness:2026-10-10"]);
		assert.deepEqual(windows, []);
		assert.equal(report.requests, 2);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-10", "2026-10-11"]);
		assert.deepEqual(
			sink.merged[0]!.rows.map((r) => `${r.date} ${brief(r)}`).sort(),
			["2026-10-10 07:24 W 80 HIGH", "2026-10-11 07:36 W 64 MODERATE"],
		);
	});

	it("lands today's morning reading on a later sync the same day, though the morning's sync found none", async () => {
		// 2026-10-12 05:00: the watch has not synced, `[]`; 07:00: its 06:00 wake-up reading is in.
		const sink = new Sink({ from: "2025-08-02", to: "2026-10-11" });
		sink.rows.set("2026-10-11", TRAINING_READINESS_INDEX.normalize(rowOfDay({ readiness: OCT_11_PAYLOAD }, "2026-10-11"))!);
		const windows: string[] = [];
		const early = { "2026-10-11": OCT_11_PAYLOAD, "2026-10-12": [] };
		await sync(readinessSource([], early), sink, "2026-10-11", "2026-10-12", windows);
		// Covered with no row: both routes answer [] for it, so no window is asked either.
		assert.deepEqual(windows, []);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-11", "2026-10-12"]);
		assert.equal(sink.rows.has("2026-10-12"), false);
		assert.equal(sink.held?.to, "2026-10-12");

		const later = { "2026-10-11": OCT_11_PAYLOAD, "2026-10-12": dayReadingsOf("2026-10-12") };
		await sync(readinessSource([], later), sink, "2026-10-11", "2026-10-12", windows);
		assert.deepEqual(windows, []);
		assert.equal(brief(sink.rows.get("2026-10-12")), "06:00 W 19 POOR");
		assert.equal(brief(sink.rows.get("2026-10-11")), "07:36 W 64 MODERATE");
	});

	it("asks the window for yesterday when the run is today alone, for a morning reading that landed late", async () => {
		const sink = new Sink({ from: "2025-08-02", to: "2026-10-11" });
		const windows: string[] = [];
		await sync(readinessSource([], { "2026-10-12": dayReadingsOf("2026-10-12") }), sink, "2026-10-12", "2026-10-12", windows);
		assert.deepEqual(windows, ["2026-10-11 2026-10-11"]);
		assert.equal(brief(sink.rows.get("2026-10-11")), "07:36 W 64 MODERATE");
		assert.equal(brief(sink.rows.get("2026-10-12")), "06:00 W 19 POOR");
	});

	it("leaves a day whose request failed to the window", async () => {
		const sink = new Sink();
		const windows: string[] = [];
		await sync(
			readinessSource([], { "2026-10-11": OCT_11_PAYLOAD, "2026-10-10": new GarminApiError("HTTP 500", 500, "") }),
			sink,
			"2026-10-10",
			"2026-10-11",
			windows,
		);
		assert.deepEqual(windows, ["2026-10-10 2026-10-10"]);
		assert.deepEqual(sink.rows.get("2026-10-10"), OCT_10_ROW);
	});
});

/* ------------------------------------------------------------------ */
/*  The day's readings                                                 */
/* ------------------------------------------------------------------ */

/** Oct 11 as READINESS_DAY keeps it: both readings, oldest first, each the index's row without its date. */
const OCT_11_KEPT: ReadinessReading[] = [
	{
		time: 456,
		ctx: "AFTER_WAKEUP_RESET",
		score: 64,
		level: "MODERATE",
		short: "BOOSTED_BY_GOOD_SLEEP",
		long: "MOD_RT_MOD_SS_GOOD",
		sleep: 89,
		sleepPct: 88,
		sleepFb: "GOOD",
		recovery: 1966,
		recoveryPct: 47,
		recoveryFb: "MODERATE",
		acute: 238,
		acwrPct: 100,
		acwrFb: "VERY_GOOD",
		hrv: 84,
		hrvPct: 90,
		hrvFb: "GOOD",
		sleepHistPct: 66,
		sleepHistFb: "MODERATE",
		stressHistPct: 84,
		stressHistFb: "GOOD",
	},
	{
		time: 581,
		ctx: "AFTER_POST_EXERCISE_RESET",
		score: 18,
		level: "POOR",
		short: "LET_YOUR_BODY_RECOVER",
		long: "POOR_RT_HIGH_SS_GOOD_OR_MOD",
		sleep: 89,
		sleepPct: 88,
		sleepFb: "GOOD",
		recovery: 4931,
		recoveryPct: 10,
		recoveryFb: "POOR",
		acute: 498,
		acwrPct: 79,
		acwrFb: "GOOD",
		hrv: 84,
		hrvPct: 90,
		hrvFb: "GOOD",
		sleepHistPct: 66,
		sleepHistFb: "MODERATE",
		stressHistPct: 84,
		stressHistFb: "GOOD",
	},
];

describe("READINESS_DAY — the day's readings", () => {
	it("is an extra of the readiness group with a key of its own, kept by the sync from the day's payload", () => {
		assert.equal(READINESS_DAY.key, READINESS_DAY_KEY);
		assert.equal(READINESS_DAY.key, "readinessDay");
		assert.equal(READINESS_DAY.group, "readiness");
		assert.ok(!SERIES_KEYS.has(READINESS_DAY.key));
		assert.equal(typeof READINESS_DAY.fromDay, "function");
	});

	it("asks trainingreadiness/{date}, the request the day sync makes", async () => {
		const asked: string[] = [];
		const api = { trainingReadiness: async (date: string) => (asked.push(date), OCT_11_PAYLOAD) } as unknown as GarminApi;
		assert.equal(await READINESS_DAY.fetch(api, "2026-10-11"), OCT_11_PAYLOAD);
		assert.deepEqual(asked, ["2026-10-11"]);
	});

	it("keeps every reading of the day, oldest first, each the index's row without its date", () => {
		assert.deepEqual(READINESS_DAY.map(OCT_11_PAYLOAD, "2026-10-11"), OCT_11_KEPT);
		// Oct 10: 07:24's wake-up, 09:16's after a run, 19:30's realtime.
		assert.deepEqual(
			READINESS_DAY.map(dayReadingsOf("2026-10-10"), "2026-10-10")!.map(brief),
			["07:24 W 80 HIGH", "09:16 A 10 POOR", "19:30 R 26 LOW"],
		);
		// The busiest day of the fixture: nine readings on Sep 18.
		assert.equal(READINESS_DAY.map(dayReadingsOf("2026-09-18"), "2026-09-18")!.length, 9);
	});

	it("is nothing for a day without a reading: a missed day, today before the watch syncs, the future", () => {
		assert.equal(READINESS_DAY.map([], "2026-01-07"), null);
		assert.equal(READINESS_DAY.map(null, "2026-10-20"), null);
		assert.equal(readinessDayOf({ not: "a list" }, "2026-10-20"), null);
	});

	it("reads back from the day's series file as it was kept", () => {
		const series = parseSeries(serializeSeries("2026-10-11", { extra: { [READINESS_DAY_KEY]: READINESS_DAY.map(OCT_11_PAYLOAD, "2026-10-11") } }));
		assert.deepEqual(readinessDayIn(series), OCT_11_KEPT);
		assert.equal(readinessDayIn(null), null);
		assert.equal(readinessDayIn({}), null);
		assert.equal(readinessDayIn({ extra: { [READINESS_DAY_KEY]: "nonsense" } }), null);
		assert.equal(readinessDayIn({ extra: { [READINESS_DAY_KEY]: [] } }), null);
		// A reading it cannot read is left out; the rest stay, in order.
		assert.deepEqual(readinessDayIn({ extra: { [READINESS_DAY_KEY]: [null, { score: "x" }, OCT_11_KEPT[1]] } }), [OCT_11_KEPT[1]]);
	});

	it("is kept by a sync only for a day with a reading, the payload the day sync already has", () => {
		assert.equal(READINESS_DAY.fromDay!({ readiness: OCT_11_PAYLOAD }, "2026-10-11"), OCT_11_PAYLOAD);
		assert.equal(READINESS_DAY.fromDay!({ readiness: [] }, "2026-10-12"), null);
		assert.equal(READINESS_DAY.fromDay!({ readiness: null }, "2026-10-12"), null);
		assert.equal(READINESS_DAY.fromDay!({}, "2026-10-12"), null);
	});
});

describe("READINESS_DAY — kept at sync time", () => {
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

	const sync = (days: Record<string, TrainingReadinessReading[]>, store: Store, calls: string[] = []) =>
		syncRange(readinessSource(calls, days), target, {
			from: "2026-10-10",
			to: "2026-10-11",
			groups: ["readiness"],
			units: "metric",
			wait: async () => {},
			series: store,
			extras: [READINESS_DAY],
		});

	it("keeps every synced day's readings in its series file, at no request of its own, so today's newest works offline", async () => {
		const store = new Store();
		const calls: string[] = [];
		const report = await sync({ "2026-10-11": OCT_11_PAYLOAD, "2026-10-10": dayReadingsOf("2026-10-10") }, store, calls);
		assert.deepEqual(calls, ["trainingReadiness:2026-10-11", "trainingReadiness:2026-10-10"]);
		assert.equal(report.requests, 2);
		assert.equal(report.seriesWritten, 2);
		assert.deepEqual(readinessDayIn(await store.read("2026-10-11")), OCT_11_KEPT);
		assert.equal(brief(newestOf(readinessDayIn(await store.read("2026-10-11")))), "09:41 A 18 POOR");
		assert.equal(brief(morningOf(readinessDayIn(await store.read("2026-10-10")))), "07:24 W 80 HIGH");
	});

	it("leaves the file alone when the day comes back the same, or empty", async () => {
		const store = new Store();
		await sync({ "2026-10-11": OCT_11_PAYLOAD }, store);
		const before = store.files.get("2026-10-11");
		assert.equal((await sync({ "2026-10-11": OCT_11_PAYLOAD }, store)).seriesWritten, 0);
		assert.equal((await sync({ "2026-10-11": [] }, store)).seriesWritten, 0);
		assert.equal(store.files.get("2026-10-11"), before);
		// A day without a reading gets no file.
		assert.equal(store.files.has("2026-10-10"), false);
	});

	it("takes the day's later readings on the next sync", async () => {
		const store = new Store();
		await sync({ "2026-10-11": [OCT_11_PAYLOAD[1]!] }, store);
		assert.equal(brief(newestOf(readinessDayIn(await store.read("2026-10-11")))), "07:36 W 64 MODERATE");
		await sync({ "2026-10-11": OCT_11_PAYLOAD }, store);
		assert.equal(brief(newestOf(readinessDayIn(await store.read("2026-10-11")))), "09:41 A 18 POOR");
	});
});

describe("Training Readiness — the payloads", () => {
	it("are what the fixture rebuilds: Oct 11's two readings field for field", () => {
		assert.deepEqual(dayReadingsOf("2026-10-11"), OCT_11_PAYLOAD);
	});

	it("put a reading's local date on its calendar day, every reading of the fixture", () => {
		assert.ok(ALL.every((r) => r.timestampLocal!.slice(0, 10) === r.calendarDate));
	});

	it("come newest first, as the range route sends them", () => {
		const month = rangeOf("2026-09-14", "2026-10-12");
		assert.equal(month.length, 73);
		assert.ok(month.every((r, i) => i === 0 || r.timestamp! <= month[i - 1]!.timestamp!));
		// The route's cap: 367 days from today reach back to 2025-10-11.
		assert.equal(shiftDate("2026-10-12", -(TRAINING_READINESS_INDEX.windowDays - 1)), "2025-10-11");
	});
});
