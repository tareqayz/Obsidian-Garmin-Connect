import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { GarminApi, RunningTolerance } from "../src/garmin/endpoints";
import { RESERVED_INDEX_NAMES, shiftDate, type DayIndexBatch, type DayIndexDef, type DayRow } from "../src/sync/day-index";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import type { DayData } from "../src/sync/metrics";
import {
	RUNNING_TOLERANCE_INDEX,
	RUNNING_TOLERANCE_WEEKS_INDEX,
	rowOfTolerance,
	rowOfWeek,
	sundayOf,
	weekRowsIn,
	weeklyRequest,
	type RunningToleranceRow,
	type RunningToleranceWeekRow,
} from "../src/sync/running-tolerance-index";
import { DAILY_OCT_5_12, FIRST_DAY, HOLES, historyDays, weekIndexOf, weekPayloads } from "./running-tolerance-fixture";

/*
 * The two Running Tolerance indexes against Garmin's own answers
 * (ref/performance-stats/running-tolerance/README.md, Data plan; samples in
 * its api-samples/, the account id left out).
 */

const DAY_MS = 86_400_000;
const daysIn = (start: string, end: string) => Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS) + 1;
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The capture day's daily row: Current's 28.2 km / 37 km/w / 22.5 km. */
const OCT_11 = DAILY_OCT_5_12.find((r) => r.calendarDate === "2026-10-11")!;
const OCT_11_ROW: RunningToleranceRow = { date: "2026-10-11", load: 28158, distance: 22478, tolerance: 37070, phrase: "MEDIUM_LOAD" };

/** Weekly rows of a mid-week window, cut as Garmin cuts them (`probe-weekly-midweek-2026-09-16_2026-10-07.json`). */
const MIDWEEK: RunningTolerance[] = [
	{ calendarDate: "2026-09-19", totalImpactLoad: 18230, totalDistance: 16427, tolerance: 37507, startOfWeek: "2026-09-16", endOfWeek: "2026-09-19", weekIndex: 1915 },
	{ calendarDate: "2026-09-26", totalImpactLoad: 23076, totalDistance: 20705, tolerance: 37561, startOfWeek: "2026-09-20", endOfWeek: "2026-09-26", weekIndex: 1916 },
	{ calendarDate: "2026-10-03", totalImpactLoad: 28140, totalDistance: 25185, tolerance: 37489, startOfWeek: "2026-09-27", endOfWeek: "2026-10-03", weekIndex: 1917 },
	{ calendarDate: "2026-10-07", totalImpactLoad: 0, totalDistance: 0, tolerance: 37734, startOfWeek: "2026-10-04", endOfWeek: "2026-10-07", weekIndex: 1918 },
];

/** A window from Thursday Jan 22, a day without a daily row (`probe-weekly-holestart-2026-01-22_2026-01-31.json`). */
const HOLE_START: RunningTolerance[] = [
	{ userProfilePK: 1, calendarDate: "2026-01-24", totalImpactLoad: 36210, totalDistance: 28028, tolerance: 52330, startOfWeek: "2026-01-23", endOfWeek: "2026-01-24", weekIndex: 1881 },
	{ userProfilePK: 1, calendarDate: "2026-01-31", totalImpactLoad: 40930, totalDistance: 33213, tolerance: 52417, startOfWeek: "2026-01-25", endOfWeek: "2026-01-31", weekIndex: 1882 },
];

/**
 * Garmin's weekly route over the fixture, for whole-week requests: the
 * weeks whose Sunday falls in the request, as sent. Refuses what Garmin
 * would (over 366 days) and what this index must never ask (a cut week).
 */
function weeklyApi(asked: string[]): GarminApi {
	const weeks = weekPayloads();
	return {
		runningTolerance: async (start: string, end: string, aggregation: string) => {
			asked.push(`${start} ${end} ${aggregation}`);
			assert.equal(aggregation, "weekly");
			assert.ok(daysIn(start, end) <= 366, `${start}..${end} is over the 366-day cap`);
			assert.equal(weekday(start), 0, `${start} is not a Sunday`);
			assert.equal(weekday(end), 6, `${end} is not a Saturday`);
			return weeks.filter((w) => w.startOfWeek! >= start && w.startOfWeek! <= end);
		},
	} as unknown as GarminApi;
}

/** Garmin's daily route over the history: a row for every day with data, in no date order. */
function dailyApi(asked: string[]): GarminApi {
	const days = historyDays();
	return {
		runningTolerance: async (start: string, end: string, aggregation: string) => {
			asked.push(`${start} ${end} ${aggregation}`);
			assert.ok(daysIn(start, end) <= 366, `${start}..${end} is over the 366-day cap`);
			const rows = days.filter((d) => d >= start && d <= end).map((d, i) => ({ calendarDate: d, acuteImpactLoad: 20000 + i, acuteDistance: 15000, acuteTolerance: 37000, runningToleranceFeedBackPhrase: "MEDIUM_LOAD" }));
			// Garmin's order is not the calendar's.
			return [...rows.filter((_, i) => i % 2), ...rows.filter((_, i) => !(i % 2))];
		},
	} as unknown as GarminApi;
}

class Sink<R extends DayRow> implements DayIndexSink<R> {
	constructor(public held: { from?: string; to?: string } | null) {}
	merged: Array<{ batch: DayIndexBatch<R>; covered: { from: string; to: string } | null }> = [];
	async coverage() {
		return this.held;
	}
	async merge(batch: DayIndexBatch<R>, covered: { from: string; to: string } | null) {
		this.merged.push({ batch, covered });
		return 1;
	}
}

const target: DayTarget = { exists: () => true, write: async () => "written" };

/** The training group alone: a status a day, and the day sync's daily running tolerance once for the run. */
function trainingSource(calls: string[], daily: readonly RunningTolerance[] = []): SyncSource {
	return new Proxy({} as SyncSource, {
		get: (_, name: string) => async (a?: string, b?: string) => {
			calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
			if (name === "trainingStatus") return null;
			if (name === "runningTolerance") return daily.filter((r) => r.calendarDate! >= a! && r.calendarDate! <= b!);
			throw new Error(`unexpected ${name}`);
		},
	});
}

/* ------------------------------------------------------------------ */
/*  The daily index                                                    */
/* ------------------------------------------------------------------ */

describe("RUNNING_TOLERANCE_INDEX — the definition", () => {
	it("is the running-tolerance index of the training group: a year a window, the last two days refreshed, fed by the day sync", () => {
		const def = RUNNING_TOLERANCE_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], ["running-tolerance", "running-tolerance", "running tolerance", "training", 1, "days"]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld], [365, 2, 1, false]);
		assert.equal(def.maxHistoryDays, undefined);
		// Metres, and the phrase key.
		assert.deepEqual(def.keys, ["load", "distance", "tolerance", "phrase"]);
		assert.deepEqual(def.fromDay?.needs, ["runningTolerance"]);
		assert.equal(def.fromSummary, undefined);
	});

	it("writes the spec's example row a line, in metres", () => {
		const text = RUNNING_TOLERANCE_INDEX.serializeYear("2026", [OCT_11_ROW]);
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n\t\t{"date":"2026-10-11","load":28158,"distance":22478,"tolerance":37070,"phrase":"MEDIUM_LOAD"}\n\t]\n}\n');
		assert.deepEqual(RUNNING_TOLERANCE_INDEX.parseYear(text), [OCT_11_ROW]);
	});
});

describe("RUNNING_TOLERANCE_INDEX — a window", () => {
	it("asks the daily aggregation and keeps each day's metres and phrase, sorted whatever Garmin's order", async () => {
		const asked: string[] = [];
		const api = { runningTolerance: async (start: string, end: string, aggregation: string) => (asked.push(`${start} ${end} ${aggregation}`), DAILY_OCT_5_12) } as unknown as GarminApi;
		const got = await RUNNING_TOLERANCE_INDEX.fetchWindow(api, "2026-10-05", "2026-10-12");
		assert.deepEqual(asked, ["2026-10-05 2026-10-12 daily"]);
		const rows = RUNNING_TOLERANCE_INDEX.merge([], { rows: got.map((r) => RUNNING_TOLERANCE_INDEX.normalize(r)!), dates: [] });
		assert.deepEqual(rows.map((r) => r.date), ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]);
		assert.deepEqual(rows[6], OCT_11_ROW);
		// Monday with no run: the load decayed, the 7-day distance held.
		assert.deepEqual(rows[7], { date: "2026-10-12", load: 25137, distance: 22478, tolerance: 37070, phrase: "MEDIUM_LOAD" });
	});

	it("maps a row's fields, leaving out the account and what Garmin sends as null", () => {
		assert.deepEqual(RUNNING_TOLERANCE_INDEX.normalize(rowOfTolerance(OCT_11)), OCT_11_ROW);
		assert.deepEqual(RUNNING_TOLERANCE_INDEX.normalize(rowOfTolerance({ calendarDate: "2026-01-04", acuteImpactLoad: 0, acuteDistance: null, acuteTolerance: 63729 })), {
			date: "2026-01-04",
			load: 0,
			tolerance: 63729,
		});
		assert.equal(RUNNING_TOLERANCE_INDEX.normalize(rowOfTolerance({ calendarDate: "2026-01-04" })), null);
		assert.equal(RUNNING_TOLERANCE_INDEX.normalize(rowOfTolerance(null)), null);
	});

	it("walks the history in three requests: 364 days, 56, then an empty year", async () => {
		const asked: string[] = [];
		const api = dailyApi(asked);
		const counts: number[] = [];
		const walk = await walkHistory(RUNNING_TOLERANCE_INDEX, async (start, end) => {
			const rows = await RUNNING_TOLERANCE_INDEX.fetchWindow(api, start, end);
			counts.push(rows.length);
			return rows;
		}, { until: "2026-10-12" });
		assert.deepEqual(asked, ["2025-10-13 2026-10-12 daily", "2024-10-13 2025-10-12 daily", "2023-10-14 2024-10-12 daily"]);
		// The two holes cost a row each: 2026-01-22 in the first window, 2025-10-11 in the second.
		assert.deepEqual(counts, [364, 56, 0]);
		assert.deepEqual([walk.requests, walk.batch.rows.length, walk.complete], [3, 420, true]);
		assert.equal(walk.batch.rows.map((r) => r.date).sort()[0], FIRST_DAY);
		assert.ok(HOLES.every((d) => walk.batch.dates.includes(d) && !walk.batch.rows.some((r) => r.date === d)));
	});
});

describe("RUNNING_TOLERANCE_INDEX — the day sync", () => {
	const read = (day: DayData, date: string) => {
		const row = RUNNING_TOLERANCE_INDEX.fromDay!.read(day, date);
		return row ? RUNNING_TOLERANCE_INDEX.normalize({ ...row, date }) : null;
	};

	it("reads the day's row of the range call, and finds none on a day Garmin sent none for", () => {
		assert.deepEqual(read({ runningTolerance: OCT_11 }, "2026-10-11"), OCT_11_ROW);
		assert.equal(read({ runningTolerance: null }, "2026-01-22"), null);
		assert.equal(read({}, "2026-01-22"), null);
	});

	it("is fed by a routine sync at no request of its own, in metres", async () => {
		const calls: string[] = [];
		const windows: string[] = [];
		const sink = new Sink<RunningToleranceRow>({ from: FIRST_DAY, to: "2026-10-10" });
		const report = await syncRange(trainingSource(calls, DAILY_OCT_5_12), target, {
			from: "2026-10-11",
			to: "2026-10-12",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RUNNING_TOLERANCE_INDEX, sink, fetchWindow: async (start, end) => (windows.push(`${start} ${end}`), []) }],
		});
		assert.deepEqual(windows, []);
		assert.deepEqual(calls.filter((c) => c.startsWith("runningTolerance")), ["runningTolerance:2026-10-11 2026-10-12"]);
		// A status a day for two days, and running tolerance once.
		assert.equal(report.requests, 3);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.batch.rows, [{ date: "2026-10-12", load: 25137, distance: 22478, tolerance: 37070, phrase: "MEDIUM_LOAD" }, OCT_11_ROW]);
		assert.deepEqual([...sink.merged[0]!.batch.dates].sort(), ["2026-10-11", "2026-10-12"]);
	});

	it("covers a day Garmin has no row for, so a stale one would go", async () => {
		const jan = (d: string) => ({ calendarDate: d, acuteImpactLoad: 6708, acuteDistance: 8152, acuteTolerance: 52330, runningToleranceFeedBackPhrase: "LOW_LOAD_14DAYS" });
		const sink = new Sink<RunningToleranceRow>({ from: FIRST_DAY, to: "2026-01-20" });
		await syncRange(trainingSource([], [jan("2026-01-21"), jan("2026-01-23")]), target, {
			from: "2026-01-21",
			to: "2026-01-23",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RUNNING_TOLERANCE_INDEX, sink, fetchWindow: async () => [] }],
		});
		assert.deepEqual(sink.merged[0]!.batch.rows.map((r) => r.date), ["2026-01-23", "2026-01-21"]);
		assert.deepEqual([...sink.merged[0]!.batch.dates].sort(), ["2026-01-21", "2026-01-22", "2026-01-23"]);
	});
});

/* ------------------------------------------------------------------ */
/*  The weekly index                                                   */
/* ------------------------------------------------------------------ */

describe("the two indexes", () => {
	it("take kinds and folders no registered index, no store folder and not each other use", () => {
		const mine: readonly DayIndexDef[] = [RUNNING_TOLERANCE_INDEX, RUNNING_TOLERANCE_WEEKS_INDEX];
		for (const def of DAY_INDEXES) {
			if (mine.includes(def)) continue;
			for (const own of mine) {
				assert.notEqual(def.kind, own.kind);
				assert.notEqual(def.folder, own.folder);
			}
		}
		for (const own of mine) assert.equal(RESERVED_INDEX_NAMES.includes(own.folder), false);
		assert.notEqual(RUNNING_TOLERANCE_INDEX.folder, RUNNING_TOLERANCE_WEEKS_INDEX.folder);
	});
});

describe("RUNNING_TOLERANCE_WEEKS_INDEX — the definition", () => {
	it("is the running-tolerance-weeks index of the training group: weeks keyed by their Sunday, 350 days a window, two weeks refreshed", () => {
		const def = RUNNING_TOLERANCE_WEEKS_INDEX;
		assert.deepEqual([def.kind, def.folder, def.title, def.group, def.version, def.listKey], [
			"running-tolerance-weeks",
			"running-tolerance-weeks",
			"weekly running tolerance",
			"training",
			1,
			"weeks",
		]);
		assert.deepEqual([def.windowDays, def.refreshDays, def.emptyWindowsToStop, def.keepOld], [350, 14, 1, false]);
		assert.deepEqual(def.keys, ["from", "to", "load", "distance", "tolerance"]);
		// The daily payload has no weekly totals: every week costs the window's request.
		assert.equal(def.fromDay, undefined);
		assert.equal(def.fromSummary, undefined);
	});

	it("writes the spec's example week, Garmin's own days kept beside its Sunday", () => {
		const row = RUNNING_TOLERANCE_WEEKS_INDEX.normalize(rowOfWeek(weekPayloads().find((w) => w.startOfWeek === "2025-10-05")))!;
		const text = RUNNING_TOLERANCE_WEEKS_INDEX.serializeYear("2025", [row]);
		// Oct 11, 2025 had no daily row, so Garmin's week ends on the 10th.
		assert.equal(text, '{\n\t"version": 1,\n\t"year": 2025,\n\t"weeks": [\n\t\t{"date":"2025-10-05","from":"2025-10-05","to":"2025-10-10","load":50380,"distance":41924,"tolerance":97731}\n\t]\n}\n');
		assert.deepEqual(RUNNING_TOLERANCE_WEEKS_INDEX.parseYear(text), [row]);
	});
});

describe("RUNNING_TOLERANCE_WEEKS_INDEX — a window", () => {
	it("asks whole Sunday weeks: back to the Sunday, on to the Saturday", () => {
		assert.deepEqual(weeklyRequest("2026-09-16", "2026-10-07"), { start: "2026-09-13", end: "2026-10-10" });
		// Already whole, and a Saturday end after today, which Garmin answers with the week so far.
		assert.deepEqual(weeklyRequest("2026-09-27", "2026-10-10"), { start: "2026-09-27", end: "2026-10-10" });
		assert.deepEqual(weeklyRequest("2026-09-29", "2026-10-12"), { start: "2026-09-27", end: "2026-10-17" });
		assert.equal(sundayOf("2026-10-11"), "2026-10-11");
		assert.equal(sundayOf("2026-01-01"), "2025-12-28");
	});

	it("keeps every week the window touches, each asked whole", async () => {
		const asked: string[] = [];
		const rows = (await RUNNING_TOLERANCE_WEEKS_INDEX.fetchWindow(weeklyApi(asked), "2026-09-16", "2026-10-07")).map((r) => RUNNING_TOLERANCE_WEEKS_INDEX.normalize(r));
		assert.deepEqual(asked, ["2026-09-13 2026-10-10 weekly"]);
		// Sep 13's week from its Sunday and Oct 4's to its Saturday, where Garmin would cut them at the 16th and the 7th.
		assert.deepEqual(rows, [
			{ date: "2026-09-13", from: "2026-09-13", to: "2026-09-19", load: 18230, distance: 16427, tolerance: 37507 },
			{ date: "2026-09-20", from: "2026-09-20", to: "2026-09-26", load: 23076, distance: 20705, tolerance: 37561 },
			{ date: "2026-09-27", from: "2026-09-27", to: "2026-10-03", load: 28140, distance: 25185, tolerance: 37489 },
			{ date: "2026-10-04", from: "2026-10-04", to: "2026-10-10", load: 10590, distance: 10009, tolerance: 37734 },
		]);
	});

	it("would get cut weeks from a window asked as it falls: the first from a Wednesday, the last holding only its days", () => {
		// Why the request is widened: the same window asked as is (`probe-weekly-midweek-…`).
		const rows = weekRowsIn(MIDWEEK, "2026-09-13", "2026-10-07").map((r) => RUNNING_TOLERANCE_WEEKS_INDEX.normalize(r));
		assert.deepEqual(rows[0], { date: "2026-09-13", from: "2026-09-16", to: "2026-09-19", load: 18230, distance: 16427, tolerance: 37507 });
		assert.deepEqual(rows[3], { date: "2026-10-04", from: "2026-10-04", to: "2026-10-07", load: 0, distance: 0, tolerance: 37734 });
	});

	it("keys a row by its week's Sunday whatever day Garmin starts it on, and keeps Garmin's days", () => {
		// A window from Thursday Jan 22, a day without a daily row: Garmin starts the week on the 23rd.
		assert.deepEqual(weekRowsIn(HOLE_START, "2026-01-18", "2026-01-31").map((r) => RUNNING_TOLERANCE_WEEKS_INDEX.normalize(r)), [
			{ date: "2026-01-18", from: "2026-01-23", to: "2026-01-24", load: 36210, distance: 28028, tolerance: 52330 },
			{ date: "2026-01-25", from: "2026-01-25", to: "2026-01-31", load: 40930, distance: 33213, tolerance: 52417 },
		]);
		// weekIndex counts the same Sundays: weeks since 1989-12-31.
		assert.deepEqual(HOLE_START.map((w) => w.weekIndex), [weekIndexOf("2026-01-18"), weekIndexOf("2026-01-25")]);
		assert.equal(rowOfWeek({ calendarDate: "2026-10-12" })?.date, "2026-10-11");
		assert.equal(rowOfWeek({}), null);
	});

	it("keeps Garmin's weekly rows as sent: the six weeks that disagree with its daily rows are not repaired", async () => {
		const rows = (await RUNNING_TOLERANCE_WEEKS_INDEX.fetchWindow(weeklyApi([]), "2026-07-19", "2026-09-12")).map((r) => RUNNING_TOLERANCE_WEEKS_INDEX.normalize(r)!);
		const values = (date: string) => {
			const row = rows.find((r) => r.date === date)!;
			return [row.load, row.distance, row.tolerance];
		};
		// Jul 19–25 had no run, and the daily rows say 0 km at 38462; Garmin's week says 30 km. The phone draws 30.
		assert.deepEqual(values("2026-07-19"), [30040, 19964, 36128]);
		// Aug 2–8 and Aug 23–29 carry the same totals, as do Aug 30 – Sep 5 and Sep 6–12: the phone's twin bars.
		assert.deepEqual(values("2026-08-02"), [24580, 23080, 35752]);
		assert.deepEqual(values("2026-08-23"), [24580, 23080, 35776]);
		assert.deepEqual(values("2026-08-16"), [40530, 37453, 36968]);
		assert.deepEqual(values("2026-08-30"), [29060, 21246, 38016]);
		assert.deepEqual(values("2026-09-06"), [29060, 21246, 36670]);
	});

	it("walks the history in three requests on Oct 12: 51 weeks, 11, then an empty window", async () => {
		const asked: string[] = [];
		const api = weeklyApi(asked);
		const counts: number[] = [];
		const walk = await walkHistory(RUNNING_TOLERANCE_WEEKS_INDEX, async (start, end) => {
			const rows = await RUNNING_TOLERANCE_WEEKS_INDEX.fetchWindow(api, start, end);
			counts.push(rows.length);
			return rows;
		}, { until: "2026-10-12" });
		// Windows [2025-10-28 … 2026-10-12], [2024-11-12 … 2025-10-27], [2023-11-28 … 2024-11-11], each asked as whole weeks.
		assert.deepEqual(asked, ["2025-10-26 2026-10-17 weekly", "2024-11-10 2025-11-01 weekly", "2023-11-26 2024-11-16 weekly"]);
		// Oct 26 – Nov 1, 2025 touches the first two windows, and comes the same from both.
		assert.deepEqual(counts, [51, 11, 0]);
		assert.deepEqual([walk.requests, walk.complete], [3, true]);
		const sundays = walk.batch.rows.map((r) => r.date).sort();
		assert.deepEqual(sundays.filter((d, i) => sundays[i + 1] === d), ["2025-10-26"]);
		// Every week of the history, each kept once by its Sunday.
		const merged = RUNNING_TOLERANCE_WEEKS_INDEX.merge([], walk.batch);
		assert.equal(merged.length, 61);
		assert.deepEqual([merged[0]!.date, merged.at(-1)!.date], [FIRST_DAY, "2026-10-11"]);
		assert.ok(merged.every((r) => weekday(r.date) === 0));
	});
});

describe("RUNNING_TOLERANCE_WEEKS_INDEX — routine syncs", () => {
	it("asks one request a sync: this week and last week, whole", async () => {
		const calls: string[] = [];
		const asked: string[] = [];
		const api = weeklyApi(asked);
		const sink = new Sink<RunningToleranceWeekRow>({ from: "2023-11-28", to: "2026-10-11" });
		const report = await syncRange(trainingSource(calls), target, {
			from: "2026-10-12",
			to: "2026-10-12",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RUNNING_TOLERANCE_WEEKS_INDEX, sink, fetchWindow: (start, end) => RUNNING_TOLERANCE_WEEKS_INDEX.fetchWindow(api, start, end) }],
		});
		// Monday Oct 12: the 14 days back reach Tuesday Sep 29, asked from Sunday Sep 27 to Saturday Oct 17.
		assert.deepEqual(asked, ["2026-09-27 2026-10-17 weekly"]);
		// The day sync's status and running tolerance, and the window.
		assert.equal(report.requests, 3);
		const { batch, covered } = sink.merged[0]!;
		// Tuesday Sep 29 is in Sep 27's week, which comes too, whole.
		assert.deepEqual(batch.rows.map((r) => r.date), ["2026-09-27", "2026-10-04", "2026-10-11"]);
		assert.equal(batch.dates.length, 14);
		assert.deepEqual([[...batch.dates].sort()[0], covered], ["2026-09-29", { from: "2026-09-29", to: "2026-10-12" }]);
	});

	it("brings the week that was current at the last sync up to date after weeks away", async () => {
		const asked: string[] = [];
		const api = weeklyApi(asked);
		// The last sync was Thursday Sep 10: it kept Sep 6–12 as the week stood that day.
		const sink = new Sink<RunningToleranceWeekRow>({ from: "2023-11-28", to: "2026-09-10" });
		await syncRange(trainingSource([]), target, {
			from: "2026-10-10",
			to: "2026-10-12",
			groups: ["training"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: RUNNING_TOLERANCE_WEEKS_INDEX, sink, fetchWindow: (start, end) => RUNNING_TOLERANCE_WEEKS_INDEX.fetchWindow(api, start, end) }],
		});
		// The stretch since, Sep 11 → Oct 12, asked from Sep 6's Sunday: that week comes whole.
		assert.deepEqual(asked, ["2026-09-06 2026-10-17 weekly"]);
		const rows = sink.merged[0]!.batch.rows;
		assert.deepEqual(rows.map((r) => r.date), ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11"]);
		assert.deepEqual(rows[0], { date: "2026-09-06", from: "2026-09-06", to: "2026-09-12", load: 29060, distance: 21246, tolerance: 36670 });
	});

	it("covers this week and last week whatever the day: 14 days back always reach the Sunday before last", () => {
		for (let day = "2026-10-11"; day <= "2026-10-17"; day = shiftDate(day, 1)) {
			const from = shiftDate(day, -(RUNNING_TOLERANCE_WEEKS_INDEX.refreshDays - 1));
			assert.ok(from <= shiftDate(sundayOf(day), -7), `${day}: ${from}`);
		}
	});
});
