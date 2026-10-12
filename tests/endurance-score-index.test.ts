import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { EnduranceGroup, EnduranceScore, EnduranceStats, GarminApi } from "../src/garmin/endpoints";
import type { DayIndexBatch } from "../src/sync/day-index";
import {
	ENDURANCE_DAY,
	ENDURANCE_SCORE_INDEX,
	decodeContributors,
	encodeContributors,
	enduranceDateOf,
	enduranceDayIn,
	enduranceDayOf,
	rowOfEnduranceDay,
	rowsOfEnduranceStats,
	type EnduranceScoreRow,
} from "../src/sync/endurance-score-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import type { DaySeries } from "../src/sync/intraday";
import type { DayData } from "../src/sync/metrics";
import { enduranceRows } from "./endurance-score-fixture";

/*
 * Payloads as Garmin sent them on 2026-10-11/12
 * (ref/performance-stats/endurance-score/api-samples/ and the web capture),
 * the account and device ids left out.
 */

const SCALE = {
	gaugeLowerLimit: 3570,
	classificationLowerLimitIntermediate: 5100,
	classificationLowerLimitTrained: 5800,
	classificationLowerLimitWellTrained: 6600,
	classificationLowerLimitExpert: 7300,
	classificationLowerLimitSuperior: 8100,
	classificationLowerLimitElite: 8800,
	gaugeUpperLimit: 10560,
};

/** The capture day, `2026-10-11.json`: the phone's "6,413 · Trained", phrase 55; the day route lists Running first. */
const OCT_11: EnduranceScore = {
	calendarDate: "2026-10-11",
	overallScore: 6413,
	classification: 3,
	feedbackPhrase: 55,
	primaryTrainingDevice: true,
	...SCALE,
	contributors: [
		{ activityTypeId: null, group: 0, contribution: 93.54 },
		{ activityTypeId: 31, group: null, contribution: 2.37 },
		{ activityTypeId: 13, group: null, contribution: 2.06 },
		{ activityTypeId: null, group: 8, contribution: 2.03 },
	],
};

/** The web's 1d-prev. */
const OCT_10: EnduranceScore = {
	...OCT_11,
	calendarDate: "2026-10-10",
	overallScore: 6401,
	contributors: [
		{ activityTypeId: null, group: 0, contribution: 93.15 },
		{ activityTypeId: 31, group: null, contribution: 2.51 },
		{ activityTypeId: 13, group: null, contribution: 2.18 },
		{ activityTypeId: null, group: 8, contribution: 2.16 },
	],
};

/** `probe-day-calibrating-2025-08-10.json`: no score, class 0, phrase 2, Miscellaneous 100. */
const AUG_10_2025: EnduranceScore = {
	calendarDate: "2025-08-10",
	overallScore: null,
	classification: 0,
	feedbackPhrase: 2,
	primaryTrainingDevice: true,
	...SCALE,
	contributors: [{ activityTypeId: null, group: 8, contribution: 100 }],
};

const day = (average: number | null, list: Array<[number | null, number | null, number]>): EnduranceGroup => ({
	groupAverage: average,
	groupMax: average,
	enduranceContributorDTOList: list.map(([activityTypeId, group, contribution]) => ({ activityTypeId, group, contribution })),
});

/** `probe-stats-daily-today-2026-10-06_2026-10-12.json` at 05:33 on Oct 12: a key a day, the stats route listing a type first, today null. */
const WEEK: EnduranceStats = {
	startDate: "2026-10-06",
	endDate: "2026-10-12",
	avg: 6407,
	max: 6413,
	groupMap: {
		"2026-10-06": day(6412, [[31, null, 2.47], [null, 0, 93.27], [13, null, 2.14], [null, 8, 2.12]]),
		"2026-10-07": day(6410, [[31, null, 2.47], [null, 0, 93.27], [13, null, 2.14], [null, 8, 2.12]]),
		"2026-10-08": day(6406, [[31, null, 2.56], [null, 0, 93], [13, null, 2.22], [null, 8, 2.22]]),
		"2026-10-09": day(6404, [[31, null, 2.56], [null, 0, 93], [13, null, 2.22], [null, 8, 2.22]]),
		"2026-10-10": day(6401, [[31, null, 2.51], [null, 0, 93.15], [13, null, 2.18], [null, 8, 2.16]]),
		"2026-10-11": day(6413, [[31, null, 2.37], [null, 0, 93.54], [13, null, 2.06], [null, 8, 2.03]]),
		"2026-10-12": day(null, []),
	},
	// The newest scored day on or before the end: Oct 11.
	enduranceScoreDTO: OCT_11,
};

/** `probe-stats-daily-first-2025-07-20_2025-09-05.json`, a few of its 48 keys: before the history, calibrating, the first scores. */
const FIRST: EnduranceStats = {
	startDate: "2025-07-20",
	endDate: "2025-09-05",
	avg: 7391,
	max: 7807,
	groupMap: {
		"2025-07-31": day(null, []),
		"2025-08-01": day(null, []),
		"2025-08-02": day(null, [[null, 8, 100]]),
		"2025-08-15": day(null, [[null, 8, 100]]),
		"2025-08-16": day(6830, [[null, 6, 11.11], [null, 0, 88.89], [null, 8, 0]]),
		"2025-08-17": day(6963, [[null, 6, 9.13], [null, 0, 90.87], [null, 8, 0]]),
		"2025-09-05": day(7704, [[null, 6, 8.69], [3, null, 15.82], [null, 0, 73.53], [null, 8, 1.96]]),
	},
	enduranceScoreDTO: { calendarDate: "2025-09-05", overallScore: 7704, classification: 5, feedbackPhrase: 80, ...SCALE },
};

/** `probe-stats-daily-before-2024-08-01_2025-08-01.json`: 366 null keys and no DTO. */
const BEFORE: EnduranceStats = {
	startDate: "2024-08-01",
	endDate: "2025-08-01",
	avg: null,
	max: null,
	groupMap: { "2024-08-01": day(null, []), "2025-07-31": day(null, []), "2025-08-01": day(null, []) },
	enduranceScoreDTO: null,
};

const ROWS = enduranceRows();
const FIRST_DAY = "2025-08-02";

const normalized = (rows: ReadonlyArray<unknown>) => rows.map((r) => ENDURANCE_SCORE_INDEX.normalize(r)).filter((r) => r !== null);
const statsApi = (payload: (start: string, end: string) => EnduranceStats | null, asked: string[] = []) =>
	({
		enduranceStats: async (start: string, end: string, aggregation: string) => (asked.push(`${start} ${end} ${aggregation}`), payload(start, end)),
	}) as unknown as GarminApi;

describe("ENDURANCE_SCORE_INDEX — the definition", () => {
	it("is the endurance-score index of the fitness group: a year a window, the last two days refreshed, rows kept, fed by the day sync's endurance", () => {
		assert.deepEqual(
			[ENDURANCE_SCORE_INDEX.kind, ENDURANCE_SCORE_INDEX.folder, ENDURANCE_SCORE_INDEX.title, ENDURANCE_SCORE_INDEX.group, ENDURANCE_SCORE_INDEX.version, ENDURANCE_SCORE_INDEX.listKey],
			["endurance-score", "endurance-score", "endurance score", "fitness", 1, "days"],
		);
		assert.deepEqual(
			[ENDURANCE_SCORE_INDEX.windowDays, ENDURANCE_SCORE_INDEX.refreshDays, ENDURANCE_SCORE_INDEX.emptyWindowsToStop, ENDURANCE_SCORE_INDEX.keepOld],
			[365, 2, 1, true],
		);
		// Inside the route's 401-day cap.
		assert.ok(ENDURANCE_SCORE_INDEX.windowDays <= 401);
		assert.equal(ENDURANCE_SCORE_INDEX.maxHistoryDays, undefined);
		assert.deepEqual(ENDURANCE_SCORE_INDEX.keys, ["score", "classId", "phraseId", "contrib"]);
		assert.deepEqual(ENDURANCE_SCORE_INDEX.columns.contrib, { text: true });
		assert.deepEqual(ENDURANCE_SCORE_INDEX.fromDay?.needs, ["endurance"]);
		assert.equal(ENDURANCE_SCORE_INDEX.fromSummary, undefined);
	});

	it("writes the spec's example rows a line each, keeping a calibrating day's class 0 and phrase 2, and reads them back", () => {
		const rows = normalized([
			{ date: "2025-08-10", classId: 0, phraseId: 2, contrib: "g8:100" },
			{ date: "2025-09-07", score: 7791, contrib: "g0:73.41 t3:14.76 g6:8.1 g8:3.73" },
		]) as EnduranceScoreRow[];
		const text = ENDURANCE_SCORE_INDEX.serializeYear("2025", rows);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2025,\n\t"days": [\n' +
				'\t\t{"date":"2025-08-10","classId":0,"phraseId":2,"contrib":"g8:100"},\n' +
				'\t\t{"date":"2025-09-07","score":7791,"contrib":"g0:73.41 t3:14.76 g6:8.1 g8:3.73"}\n\t]\n}\n',
		);
		assert.deepEqual(ENDURANCE_SCORE_INDEX.parseYear(text), rows);
		// The whole history: 436 rows in two year files, about 45 KB.
		const size = ["2025", "2026"].reduce((n, year) => n + ENDURANCE_SCORE_INDEX.serializeYear(year, ROWS.filter((r) => r.date.startsWith(year))).length, 0);
		assert.ok(size > 30_000 && size < 50_000, `${size} bytes`);
	});

	it("keeps a day sync's class and phrase when a window refresh brings the score and list again", () => {
		const synced = ENDURANCE_SCORE_INDEX.normalize(rowOfEnduranceDay(OCT_11))!;
		const window = normalized(rowsOfEnduranceStats(WEEK, "2026-10-06", "2026-10-12")) as EnduranceScoreRow[];
		const oct10 = window.find((r) => r.date === "2026-10-10")!;
		assert.deepEqual(oct10, { date: "2026-10-10", score: 6401, contrib: "g0:93.15 t31:2.51 t13:2.18 g8:2.16" });
		const before = { ...synced, date: "2026-10-10", phraseId: 63 };
		const merged = ENDURANCE_SCORE_INDEX.merge([before], { rows: [oct10], dates: ["2026-10-10"] });
		assert.deepEqual(merged, [{ date: "2026-10-10", score: 6401, classId: 3, phraseId: 63, contrib: "g0:93.15 t31:2.51 t13:2.18 g8:2.16" }]);
		// A day asked about and found empty loses its row, as on every index.
		assert.deepEqual(ENDURANCE_SCORE_INDEX.merge([before], { rows: [], dates: ["2026-10-10"] }), []);
	});
});

describe("contrib — the contributor list as text", () => {
	it("writes the day route's list as the spec does, and the stats route's same entries the same way", () => {
		assert.equal(encodeContributors(OCT_11.contributors), "g0:93.54 t31:2.37 t13:2.06 g8:2.03");
		// The stats route sends Oct 11 as t31, g0, t13, g8: one text whichever route wrote the day.
		assert.equal(encodeContributors(WEEK.groupMap!["2026-10-11"]!.enduranceContributorDTOList), "g0:93.54 t31:2.37 t13:2.06 g8:2.03");
		assert.equal(encodeContributors(FIRST.groupMap!["2025-09-05"]!.enduranceContributorDTOList), "g0:73.53 t3:15.82 g6:8.69 g8:1.96");
	});

	it("puts Miscellaneous last whatever its share, keeps a 0 and a 100, and breaks a tie group first, then by id", () => {
		assert.equal(encodeContributors([{ group: 8, contribution: 46.67 }, { group: 0, contribution: 38.38 }, { activityTypeId: 3, contribution: 14.95 }]), "g0:38.38 t3:14.95 g8:46.67");
		assert.equal(encodeContributors(AUG_10_2025.contributors), "g8:100");
		assert.equal(encodeContributors(FIRST.groupMap!["2025-08-16"]!.enduranceContributorDTOList), "g0:88.89 g6:11.11 g8:0");
		assert.equal(encodeContributors([{ activityTypeId: 163, contribution: 2.2 }, { activityTypeId: 13, contribution: 2.2 }, { group: 6, contribution: 2.2 }]), "g6:2.2 t13:2.2 t163:2.2");
	});

	it("rounds a share to two decimals, drops trailing zeros, and leaves out what it cannot place", () => {
		assert.equal(encodeContributors([{ group: 0, contribution: 93.21429 }, { activityTypeId: 31, contribution: 2.4871428 }, { group: 8, contribution: 2.10 }]), "g0:93.21 t31:2.49 g8:2.1");
		assert.equal(
			encodeContributors([{ group: null, activityTypeId: null, contribution: 5 }, { group: 0, contribution: null }, { group: 1, contribution: -1 }, { group: 0, contribution: 95 }, null, "x"]),
			"g0:95",
		);
		for (const empty of [[], null, undefined, "g0:1", {}]) assert.equal(encodeContributors(empty), undefined);
	});

	it("reads the text back entry for entry, skipping a malformed one", () => {
		assert.deepEqual(decodeContributors("g0:93.54 t31:2.37 t13:2.06 g8:2.03"), [
			{ kind: "g", id: 0, share: 93.54 },
			{ kind: "t", id: 31, share: 2.37 },
			{ kind: "t", id: 13, share: 2.06 },
			{ kind: "g", id: 8, share: 2.03 },
		]);
		assert.deepEqual(decodeContributors(" g8:100  x3:1 t:2 g1:-4 t163:0.38 "), [
			{ kind: "g", id: 8, share: 100 },
			{ kind: "t", id: 163, share: 0.38 },
		]);
		assert.deepEqual([decodeContributors(undefined), decodeContributors("")], [[], []]);
	});
});

describe("ENDURANCE_SCORE_INDEX — a window", () => {
	it("asks the stats route daily and keeps each day's score and list, and the DTO day's class and phrase; today's null key is no row", async () => {
		const asked: string[] = [];
		const rows = normalized(await ENDURANCE_SCORE_INDEX.fetchWindow(statsApi(() => WEEK, asked), "2026-10-06", "2026-10-12"));
		assert.deepEqual(asked, ["2026-10-06 2026-10-12 daily"]);
		assert.deepEqual(rows, [
			{ date: "2026-10-06", score: 6412, contrib: "g0:93.27 t31:2.47 t13:2.14 g8:2.12" },
			{ date: "2026-10-07", score: 6410, contrib: "g0:93.27 t31:2.47 t13:2.14 g8:2.12" },
			{ date: "2026-10-08", score: 6406, contrib: "g0:93 t31:2.56 t13:2.22 g8:2.22" },
			{ date: "2026-10-09", score: 6404, contrib: "g0:93 t31:2.56 t13:2.22 g8:2.22" },
			{ date: "2026-10-10", score: 6401, contrib: "g0:93.15 t31:2.51 t13:2.18 g8:2.16" },
			{ date: "2026-10-11", score: 6413, classId: 3, phraseId: 55, contrib: "g0:93.54 t31:2.37 t13:2.06 g8:2.03" },
		]);
	});

	it("keeps the calibrating days (no score, Miscellaneous 100) and the first scores; the days before have nothing", async () => {
		const rows = normalized(await ENDURANCE_SCORE_INDEX.fetchWindow(statsApi(() => FIRST), "2025-07-20", "2025-09-05"));
		assert.deepEqual(rows, [
			{ date: "2025-08-02", contrib: "g8:100" },
			{ date: "2025-08-15", contrib: "g8:100" },
			{ date: "2025-08-16", score: 6830, contrib: "g0:88.89 g6:11.11 g8:0" },
			{ date: "2025-08-17", score: 6963, contrib: "g0:90.87 g6:9.13 g8:0" },
			// The window's newest scored day brings its class and phrase.
			{ date: "2025-09-05", score: 7704, classId: 5, phraseId: 80, contrib: "g0:73.53 t3:15.82 g6:8.69 g8:1.96" },
		]);
		assert.deepEqual(normalized(await ENDURANCE_SCORE_INDEX.fetchWindow(statsApi(() => BEFORE), "2024-08-01", "2025-08-01")), []);
		assert.deepEqual(normalized(await ENDURANCE_SCORE_INDEX.fetchWindow(statsApi(() => null), "2024-08-01", "2025-08-01")), []);
	});

	it("leaves out keys outside the window, and a DTO day outside it brings nothing", () => {
		// Today before the watch syncs: the DTO is yesterday, outside a window of today alone.
		assert.deepEqual(normalized(rowsOfEnduranceStats(WEEK, "2026-10-12", "2026-10-12")), []);
		assert.deepEqual(normalized(rowsOfEnduranceStats(WEEK, "2026-10-10", "2026-10-10")), [{ date: "2026-10-10", score: 6401, contrib: "g0:93.15 t31:2.51 t13:2.18 g8:2.16" }]);
		assert.deepEqual(normalized(rowsOfEnduranceStats({ groupMap: { "not a day": day(1, [[null, 0, 100]]) } }, "2000-01-01", "2100-01-01")), []);
	});

	it("dates a payload by its calendar day", () => {
		assert.equal(enduranceDateOf({ calendarDate: "2026-10-11" }), "2026-10-11");
		assert.equal(enduranceDateOf({ calendarDate: "2026-10-11T00:00:00.0" }), "2026-10-11");
		assert.equal(enduranceDateOf({}), undefined);
		assert.equal(enduranceDateOf(null), undefined);
	});

	/** The stats route over the fixture: a key for every day of the window, the lists in the route's own order. */
	function historyApi(calls: string[]): GarminApi {
		const byDate = new Map(ROWS.map((r) => [r.date, r]));
		return statsApi((start, end) => {
			calls.push(`${start} ${end}`);
			const groupMap: Record<string, EnduranceGroup> = {};
			for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
				const date = new Date(t).toISOString().slice(0, 10);
				const row = byDate.get(date);
				const list = decodeContributors(row?.contrib)
					.reverse()
					.map((e) => ({ activityTypeId: e.kind === "t" ? e.id : null, group: e.kind === "g" ? e.id : null, contribution: e.share }));
				groupMap[date] = { groupAverage: row?.score ?? null, groupMax: row?.score ?? null, enduranceContributorDTOList: list };
			}
			return { startDate: start, endDate: end, groupMap, enduranceScoreDTO: null };
		});
	}

	it("walks the history in three requests from today, two once the newest year is in: 436 rows from 2025-08-02, 14 without a score", async () => {
		assert.equal(ROWS.length, 436);
		const calls: string[] = [];
		const api = historyApi(calls);
		const fetch = (start: string, end: string) => ENDURANCE_SCORE_INDEX.fetchWindow(api, start, end);

		const whole = await walkHistory(ENDURANCE_SCORE_INDEX, fetch, { until: "2026-10-12" });
		// The spec's walk: 364 rows, then 72 from 2025-08-02, then an empty year.
		assert.deepEqual(calls, ["2025-10-13 2026-10-12", "2024-10-13 2025-10-12", "2023-10-14 2024-10-12"]);
		assert.deepEqual([whole.requests, whole.batch.rows.length, whole.complete], [3, 436, true]);
		assert.equal(whole.batch.rows.map((r) => r.date).sort()[0], FIRST_DAY);
		assert.equal(whole.batch.rows.filter((r) => r.score === undefined).length, 14);
		// Every day's list comes back as the fixture holds it, whatever order the route sent.
		const byDate = new Map(whole.batch.rows.map((r) => [r.date, r.contrib]));
		assert.ok(ROWS.every((r) => byDate.get(r.date) === r.contrib));

		calls.length = 0;
		const older = await walkHistory(ENDURANCE_SCORE_INDEX, fetch, { until: "2025-10-12" });
		assert.deepEqual(calls, ["2024-10-13 2025-10-12", "2023-10-14 2024-10-12"]);
		assert.deepEqual([older.requests, older.batch.rows.length, older.complete], [2, 72, true]);
	});
});

describe("ENDURANCE_SCORE_INDEX — the day sync", () => {
	const read = (data: DayData, date: string) => {
		const row = ENDURANCE_SCORE_INDEX.fromDay!.read(data, date);
		return row ? ENDURANCE_SCORE_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's payload whole: score, class, phrase and list; a calibrating day's too", () => {
		assert.deepEqual(read({ endurance: OCT_11 }, "2026-10-11"), { date: "2026-10-11", score: 6413, classId: 3, phraseId: 55, contrib: "g0:93.54 t31:2.37 t13:2.06 g8:2.03" });
		// The spec's third example row.
		assert.deepEqual(read({ endurance: AUG_10_2025 }, "2025-08-10"), { date: "2025-08-10", classId: 0, phraseId: 2, contrib: "g8:100" });
		// A phrase id sent as a numeric string is still the id.
		assert.equal(read({ endurance: { ...OCT_11, feedbackPhrase: "63" } }, "2026-10-11")!.phraseId, 63);
		assert.equal(read({ endurance: { ...OCT_11, feedbackPhrase: "STABLE" } }, "2026-10-11")!.phraseId, undefined);
	});

	it("finds no row on a day without a score: HTTP 204 is endurance null", () => {
		assert.equal(read({ endurance: null }, "2026-10-12"), null);
		assert.equal(read({}, "2026-10-12"), null);
	});

	/** The fitness group alone: max metrics and hill scores for the run, endurance and fitness age a day. */
	function fitnessSource(calls: string[], days: readonly EnduranceScore[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "enduranceScore") return days.find((d) => d.calendarDate === a) ?? null;
				if (name === "maxMetrics" || name === "hillScores") return [];
				if (name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<EnduranceScoreRow> {
		constructor(public held: { from?: string; to?: string } | null) {}
		merged: Array<DayIndexBatch<EnduranceScoreRow>> = [];
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<EnduranceScoreRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	it("is fed by a routine sync at no request of its own: the run's days cover the two it refreshes", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-09" });
		// At 05:33 on Oct 12 the day route had nothing for the 12th.
		await syncRange(fitnessSource(calls, [OCT_10, OCT_11]), target, {
			from: "2026-10-10",
			to: "2026-10-12",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: ENDURANCE_SCORE_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		assert.deepEqual(calls.filter((c) => c.startsWith("enduranceScore")).sort(), ["enduranceScore:2026-10-10", "enduranceScore:2026-10-11", "enduranceScore:2026-10-12"]);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [
			{ date: "2026-10-11", score: 6413, classId: 3, phraseId: 55, contrib: "g0:93.54 t31:2.37 t13:2.06 g8:2.03" },
			{ date: "2026-10-10", score: 6401, classId: 3, phraseId: 55, contrib: "g0:93.15 t31:2.51 t13:2.18 g8:2.16" },
		]);
		// The 12th is covered with no row.
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-10", "2026-10-11", "2026-10-12"]);
	});

	it("asks one window for yesterday when the run covers only today: the score can land after the last sync of it", async () => {
		const windows: string[] = [];
		const sink = new Sink({ from: FIRST_DAY, to: "2026-10-11" });
		await syncRange(fitnessSource([], [OCT_11]), target, {
			from: "2026-10-12",
			to: "2026-10-12",
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: ENDURANCE_SCORE_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), rowsOfEnduranceStats(WEEK, start, end)) }],
		});
		assert.deepEqual(windows, ["2026-10-11 2026-10-11"]);
		assert.deepEqual([...sink.merged[0]!.dates].sort(), ["2026-10-11", "2026-10-12"]);
		assert.deepEqual(sink.merged[0]!.rows, [{ date: "2026-10-11", score: 6413, classId: 3, phraseId: 55, contrib: "g0:93.54 t31:2.37 t13:2.06 g8:2.03" }]);
	});
});

describe("ENDURANCE_DAY — an old day's phrase on view", () => {
	it("keeps the class, the phrase and the dial's scale of the day's payload", async () => {
		assert.equal(ENDURANCE_DAY.key, "enduranceDay");
		assert.equal(ENDURANCE_DAY.group, "fitness");
		assert.equal(ENDURANCE_DAY.fromDay, undefined);
		const asked: string[] = [];
		const api = { enduranceScore: async (date: string) => (asked.push(date), OCT_11) } as unknown as GarminApi;
		assert.equal(await ENDURANCE_DAY.fetch(api, "2026-10-11"), OCT_11);
		assert.deepEqual(asked, ["2026-10-11"]);
		const block = { classId: 3, phraseId: 55, low: 3570, high: 10560, limits: [5100, 5800, 6600, 7300, 8100, 8800] };
		assert.deepEqual(ENDURANCE_DAY.map(OCT_11, "2026-10-11"), block);
		assert.deepEqual(enduranceDayOf(AUG_10_2025), { ...block, classId: 0, phraseId: 2 });
	});

	it("has nothing for a day without a payload, and a scale only when it is whole", () => {
		assert.equal(enduranceDayOf(null), null);
		assert.deepEqual(enduranceDayOf({ classification: 4, feedbackPhrase: 54, gaugeLowerLimit: 3570, classificationLowerLimitElite: 8800 }), { classId: 4, phraseId: 54, low: 3570 });
	});

	it("is read back from the day's series file", () => {
		const series = { extra: { enduranceDay: { classId: 4, phraseId: 54 } } } as unknown as DaySeries;
		assert.deepEqual(enduranceDayIn(series), { classId: 4, phraseId: 54 });
		assert.equal(enduranceDayIn({ extra: {} } as unknown as DaySeries), null);
		assert.equal(enduranceDayIn(null), null);
	});
});
