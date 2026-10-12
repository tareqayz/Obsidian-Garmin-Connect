import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, HillScore } from "../src/garmin/endpoints";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import { HILL_SCORE_INDEX, hillDateOf, primaryHillRows, rowOfHillScore, type HillScoreRow } from "../src/sync/hill-score-index";
import type { DayData } from "../src/sync/metrics";

/*
 * `hillScoreDTOList` rows as Garmin sent them on 2026-10-11
 * (ref/performance-stats/hill-score/api-samples/graphql-daily-2026-09-14_2026-10-11.json
 * and probe-rest-daily-first-2025-07-20_2025-09-06.json), the account and
 * device ids left out.
 */

/** The capture day: the phone's "29 · Challenger", Hill Endurance 7, Hill Strength 14, phrase 42. */
const OCT_11: HillScore = {
	calendarDate: "2026-10-11",
	strengthScore: 14,
	enduranceScore: 7,
	hillScoreClassificationId: 2,
	overallScore: 29,
	hillScoreFeedbackPhraseId: 42,
	vo2Max: null,
	vo2MaxPreciseValue: null,
	primaryTrainingDevice: true,
};

/** The web's 1d-prev: endurance 6, phrase 4. */
const OCT_10: HillScore = { ...OCT_11, calendarDate: "2026-10-10", enduranceScore: 6, hillScoreFeedbackPhraseId: 4 };

/** A calibrating day: Garmin's first two weeks have a row, class 0 and phrase 1, and no scores. */
const AUG_10_2025: HillScore = {
	calendarDate: "2025-08-10",
	strengthScore: null,
	enduranceScore: null,
	hillScoreClassificationId: 0,
	overallScore: null,
	hillScoreFeedbackPhraseId: 1,
	vo2Max: null,
	vo2MaxPreciseValue: null,
	primaryTrainingDevice: true,
};

/** The first score. */
const AUG_16_2025: HillScore = { ...OCT_11, calendarDate: "2025-08-16", overallScore: 47, strengthScore: 52, enduranceScore: 31, hillScoreFeedbackPhraseId: 4 };

/** Every day of the history has a row: 436, 2025-08-02 → 2026-10-11. */
const FIRST_DAY = "2025-08-02";

function historyDays(from: string, to: string): string[] {
	const out: string[] = [];
	for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
	return out;
}

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => HILL_SCORE_INDEX.normalize(r));

describe("HILL_SCORE_INDEX — the definition", () => {
	it("is the hill-score index of the fitness group: a year a window, the last two days refreshed, fed by the day sync's hillScore", () => {
		assert.deepEqual(
			[HILL_SCORE_INDEX.kind, HILL_SCORE_INDEX.folder, HILL_SCORE_INDEX.title, HILL_SCORE_INDEX.group, HILL_SCORE_INDEX.version, HILL_SCORE_INDEX.listKey],
			["hill-score", "hill-score", "hill score", "fitness", 1, "days"],
		);
		assert.deepEqual(
			[HILL_SCORE_INDEX.windowDays, HILL_SCORE_INDEX.refreshDays, HILL_SCORE_INDEX.emptyWindowsToStop, HILL_SCORE_INDEX.keepOld],
			[365, 2, 1, false],
		);
		assert.equal(HILL_SCORE_INDEX.maxHistoryDays, undefined);
		// Five whole-number columns in this order; no VO₂, which the list never carries.
		assert.deepEqual(HILL_SCORE_INDEX.keys, ["score", "strength", "endurance", "classId", "phraseId"]);
		assert.deepEqual(HILL_SCORE_INDEX.fromDay?.needs, ["hillScore"]);
		assert.equal(HILL_SCORE_INDEX.fromSummary, undefined);
	});

	it("writes a year file a row a line, keeping a calibrating day's class 0 and phrase 1", () => {
		const rows = [rowOfHillScore(AUG_10_2025), rowOfHillScore(AUG_16_2025)].map((r) => HILL_SCORE_INDEX.normalize(r)!) as HillScoreRow[];
		const text = HILL_SCORE_INDEX.serializeYear("2025", rows);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2025,\n\t"days": [\n' +
				'\t\t{"date":"2025-08-10","classId":0,"phraseId":1},\n' +
				'\t\t{"date":"2025-08-16","score":47,"strength":52,"endurance":31,"classId":2,"phraseId":4}\n\t]\n}\n',
		);
		assert.deepEqual(HILL_SCORE_INDEX.parseYear(text), rows);
	});
});

describe("HILL_SCORE_INDEX — a window", () => {
	it("asks hillScoreScalar for the window and keeps each day's scores, class and phrase", async () => {
		const asked: string[] = [];
		const api = { hillScores: async (start: string, end: string) => (asked.push(`${start} ${end}`), [OCT_11, OCT_10, AUG_16_2025, AUG_10_2025]) } as unknown as GarminApi;
		const rows = normalized(await HILL_SCORE_INDEX.fetchWindow(api, "2025-10-12", "2026-10-11"));
		assert.deepEqual(asked, ["2025-10-12 2026-10-11"]);
		assert.deepEqual(rows, [
			{ date: "2026-10-11", score: 29, strength: 14, endurance: 7, classId: 2, phraseId: 42 },
			{ date: "2026-10-10", score: 29, strength: 14, endurance: 6, classId: 2, phraseId: 4 },
			{ date: "2025-08-16", score: 47, strength: 52, endurance: 31, classId: 2, phraseId: 4 },
			// The spec's example row: no scores while calibrating.
			{ date: "2025-08-10", classId: 0, phraseId: 1 },
		]);
	});

	it("keeps the primary training device's row where two devices scored the day, as the day sync does", () => {
		const other: HillScore = { ...OCT_11, deviceId: 2, overallScore: 31, primaryTrainingDevice: false };
		const primary: HillScore = { ...OCT_11, deviceId: 1 };
		for (const list of [[other, primary], [primary, other]]) {
			assert.deepEqual(primaryHillRows(list).map((r) => [r.calendarDate, r.overallScore]), [["2026-10-11", 29]]);
		}
		// A day only another device scored keeps that row; a row without a day is none.
		const lone: HillScore = { ...OCT_10, primaryTrainingDevice: false };
		assert.deepEqual(primaryHillRows([lone, { overallScore: 40 }]).map((r) => r.calendarDate), ["2026-10-10"]);
	});

	it("dates a row by its calendar day, and drops what Garmin sends as null", () => {
		assert.equal(hillDateOf({ calendarDate: "2026-10-11" }), "2026-10-11");
		assert.equal(hillDateOf({ calendarDate: "2026-10-11T00:00:00.0" }), "2026-10-11");
		assert.equal(hillDateOf({}), undefined);
		assert.equal(hillDateOf(null), undefined);
		assert.deepEqual(HILL_SCORE_INDEX.normalize(rowOfHillScore({ calendarDate: "2026-01-01", overallScore: 37, strengthScore: null, enduranceScore: 12 })), {
			date: "2026-01-01",
			score: 37,
			endurance: 12,
		});
		assert.equal(HILL_SCORE_INDEX.normalize(rowOfHillScore({ calendarDate: "2026-01-01" })), null);
	});

	it("walks the history in two requests once the newest year is in, and three from today", async () => {
		const days = historyDays(FIRST_DAY, "2026-10-11");
		assert.equal(days.length, 436);
		const api = {
			hillScores: async (start: string, end: string): Promise<HillScore[]> =>
				days
					.filter((d) => d >= start && d <= end)
					.reverse()
					.map((d) => (d < "2025-08-16" ? { ...AUG_10_2025, calendarDate: d } : { ...OCT_11, calendarDate: d })),
		} as unknown as GarminApi;
		const calls: string[] = [];
		const fetch = (start: string, end: string) => (calls.push(`${start} ${end}`), HILL_SCORE_INDEX.fetchWindow(api, start, end));

		const walk = await walkHistory(HILL_SCORE_INDEX, fetch, { until: "2025-10-11" });
		// The spec's walk: 71 rows, then an empty year ends it.
		assert.deepEqual(calls, ["2024-10-12 2025-10-11", "2023-10-13 2024-10-11"]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete], [2, 71, true]);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], FIRST_DAY);

		calls.length = 0;
		const whole = await walkHistory(HILL_SCORE_INDEX, fetch, { until: "2026-10-11" });
		assert.deepEqual(calls, ["2025-10-12 2026-10-11", "2024-10-12 2025-10-11", "2023-10-13 2024-10-11"]);
		assert.deepEqual([whole.requests, whole.batch.rows.length, whole.complete], [3, 436, true]);
		// The fourteen calibrating rows are kept with the rest.
		assert.equal(whole.batch.rows.filter((r) => r.score === undefined).length, 14);
	});
});

describe("HILL_SCORE_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = HILL_SCORE_INDEX.fromDay!.read(day, date);
		return row ? HILL_SCORE_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's hillScore row, a calibrating one too", () => {
		assert.deepEqual(read({ hillScore: OCT_11 }, "2026-10-11"), { date: "2026-10-11", score: 29, strength: 14, endurance: 7, classId: 2, phraseId: 42 });
		assert.deepEqual(read({ hillScore: AUG_10_2025 }, "2025-08-10"), { date: "2025-08-10", classId: 0, phraseId: 1 });
	});

	it("finds no row on a day the watch has not scored: the range call sent none for it", () => {
		assert.equal(read({ hillScore: null }, "2026-10-12"), null);
		assert.equal(read({}, "2026-10-12"), null);
	});

	/** The fitness group alone: max metrics and hill scores for the run, endurance and fitness age a day. */
	function fitnessSource(calls: string[], hill: readonly HillScore[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "hillScores") return hill.filter((r) => r.calendarDate! >= a! && r.calendarDate! <= b!);
				if (name === "maxMetrics") return [];
				if (name === "enduranceScore" || name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<HillScoreRow> {
		constructor(public held: { from?: string; to?: string } | null) {}
		merged: Array<DayIndexBatch<HillScoreRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<HillScoreRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	it("is fed by a routine sync at no request of its own: the run's days cover the two it refreshes", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-09" });
		// At 00:17 on Oct 12 the list stopped at Oct 11: the watch had not scored the 12th.
		const report = await syncRange(fitnessSource(calls, [OCT_10, OCT_11]), target, {
			from: "2026-10-10",
			to: "2026-10-12",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: HILL_SCORE_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		assert.deepEqual(calls.filter((c) => c.startsWith("hillScores")), ["hillScores:2026-10-10 2026-10-12"]);
		// One range call each for max metrics and hill scores, two calls a day for three days.
		assert.equal(report.requests, 8);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [
			{ date: "2026-10-11", score: 29, strength: 14, endurance: 7, classId: 2, phraseId: 42 },
			{ date: "2026-10-10", score: 29, strength: 14, endurance: 6, classId: 2, phraseId: 4 },
		]);
		// The 12th is covered with no row, so a stale one would go.
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-10", "2026-10-11", "2026-10-12"]);
	});

	it("asks one window for yesterday when the run covers only today: Garmin's row can land after the last sync of it", async () => {
		const windows: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-11" });
		await syncRange(fitnessSource([], [OCT_11]), target, {
			from: "2026-10-12",
			to: "2026-10-12",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: HILL_SCORE_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), [rowOfHillScore(OCT_11)]) }],
		});
		assert.deepEqual(windows, ["2026-10-11 2026-10-11"]);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-11", "2026-10-12"]);
	});

	it("asks the day sync's hill scores a year a request, inside the route's 401-day cap", async () => {
		const calls: string[] = [];
		await syncRange(fitnessSource(calls, []), target, {
			from: "2025-09-06",
			to: "2026-10-11",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
		});
		// 401 days: a year, then the rest, where 28-day windows took fifteen requests.
		assert.deepEqual(calls.filter((c) => c.startsWith("hillScores")), ["hillScores:2025-09-06 2026-09-05", "hillScores:2026-09-06 2026-10-11"]);
	});
});
