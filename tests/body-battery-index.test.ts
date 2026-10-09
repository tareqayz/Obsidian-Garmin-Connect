import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { DailyStatRow, DailySummary, GarminApi } from "../src/garmin/endpoints";
import { BODY_BATTERY_INDEX, reportOf, rowOfStat, rowsOfWindow, type BatteryRow } from "../src/sync/body-battery-index";
import { DAY_INDEXES, dayIndex } from "../src/sync/day-indexes";
import { walkHistory } from "../src/sync/engine";
import { INTRADAY_EXTRAS } from "../src/sync/intraday-extras";
import { loadersFor } from "../src/sync/intraday-registry";
import { STRESS_DAY_KEY } from "../src/sync/stress-index";

/*
 * Every payload below is Garmin's, trimmed to the fields read
 * (ref/health-stats/body-battery/api-samples/: history/, reports-history/ and
 * the web's summaries of Oct 7 and Oct 8).
 */

/** `stats/bodybattery/daily`, Aug 14 – Sep 10: Aug 18, synced without readings, is left out. */
const AUGUST_STATS: DailyStatRow[] = [
	{ calendarDate: "2026-08-17", values: { lowBodyBattery: 34, highBodyBattery: 100 } },
	{ calendarDate: "2026-08-19", values: { lowBodyBattery: 38, highBodyBattery: 89 } },
];

/** `bodyBattery/reports/daily` for the same days: every calendar day, Aug 18 with nulls and a NO_DATA feedback. */
const AUGUST_REPORTS: unknown[] = [
	{
		date: "2026-08-17",
		charged: 64,
		drained: 67,
		bodyBatteryValuesArray: [[1786914000000, 37], [1786939740000, 100], [1786942800000, 98], [1786971420000, 48], [1786971600000, 48], [1786986900000, 34]],
		bodyBatteryDynamicFeedbackEvent: {
			eventTimestampGmt: "2026-08-17T18:44:31.0",
			bodyBatteryLevel: "HIGH",
			feedbackShortType: "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE",
			feedbackLongType: "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE",
		},
		endOfDayBodyBatteryDynamicFeedbackEvent: { feedbackLongType: "SLEEP_TIME_PASSED_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE" },
		bodyBatteryActivityEvent: [{ eventType: "SLEEP", eventStartTimeGmt: "2026-08-16T18:41:29.0", durationInMilliseconds: 34740000, bodyBatteryImpact: 83 }],
	},
	{
		date: "2026-08-18",
		charged: null,
		drained: null,
		bodyBatteryValuesArray: [[1787011200001, null], [1787011200002, null]],
		bodyBatteryDynamicFeedbackEvent: { eventTimestampGmt: "2026-08-18T20:00:43.0", bodyBatteryLevel: "HIGH", feedbackShortType: "NO_DATA", feedbackLongType: "NO_DATA" },
	},
	{
		date: "2026-08-19",
		charged: 14,
		drained: 56,
		bodyBatteryDynamicFeedbackEvent: { feedbackShortType: "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE", feedbackLongType: "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE" },
		endOfDayBodyBatteryDynamicFeedbackEvent: { feedbackLongType: "SLEEP_TIME_PASSED_RECOVERING_AND_INACTIVE" },
	},
];

/** Jan 3 – 10: Jan 4 has a row and only a no-data feedback, Jan 5 – 9 nothing at all, Jan 10 NO_DATA beside a row. */
const JANUARY_STATS: DailyStatRow[] = [
	{ calendarDate: "2026-01-03", values: { lowBodyBattery: 10, highBodyBattery: 61 } },
	{ calendarDate: "2026-01-04", values: { lowBodyBattery: 47, highBodyBattery: 49 } },
	{ calendarDate: "2026-01-10", values: { lowBodyBattery: 34, highBodyBattery: 42 } },
];
const JANUARY_REPORTS: unknown[] = [
	{ date: "2026-01-03", charged: 71, drained: 36, bodyBatteryDynamicFeedbackEvent: { feedbackLongType: "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE" } },
	// The short type is null here; the long one is still there.
	{ date: "2026-01-04", charged: 0, drained: 2, bodyBatteryDynamicFeedbackEvent: { feedbackShortType: null, feedbackLongType: "EARLY_MORNING_NO_DATA" } },
	...["05", "06", "07", "08", "09"].map((d) => ({ date: `2026-01-${d}`, charged: null, drained: null, startTimestampGMT: null })),
	{ date: "2026-01-10", charged: 8, drained: 0, bodyBatteryDynamicFeedbackEvent: { feedbackShortType: "NO_DATA", feedbackLongType: "NO_DATA" } },
];

/** The Body Battery fields of the Oct 7 summary (the Sleep web capture), the rest left out. */
const SUMMARY_OCT_7: DailySummary = {
	calendarDate: "2026-10-07",
	averageStressLevel: 27,
	bodyBatteryChargedValue: 18,
	bodyBatteryDrainedValue: 73,
	bodyBatteryHighestValue: 100,
	bodyBatteryLowestValue: 27,
	bodyBatteryMostRecentValue: 27,
	bodyBatteryDuringSleep: 55,
	bodyBatteryAtWakeTime: 100,
	bodyBatteryVersion: 3,
	bodyBatteryDynamicFeedbackEvent: {
		eventTimestampGmt: "2026-10-07T19:28:11",
		bodyBatteryLevel: "HIGH",
		feedbackShortType: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE",
		feedbackLongType: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE",
	},
	endOfDayBodyBatteryDynamicFeedbackEvent: {
		eventTimestampGmt: "2026-10-07T19:50:34",
		bodyBatteryLevel: "HIGH",
		feedbackShortType: "SLEEP_TIME_PASSED_BALANCED_AND_INACTIVE",
		feedbackLongType: "SLEEP_TIME_PASSED_BALANCED_AND_INACTIVE",
	},
};

/** Oct 8 at 01:15, before the day's first feedback: no feedback keys at all, nulls for the night. */
const SUMMARY_OCT_8: DailySummary = {
	calendarDate: "2026-10-08",
	bodyBatteryChargedValue: 0,
	bodyBatteryDrainedValue: 2,
	bodyBatteryHighestValue: 27,
	bodyBatteryLowestValue: 25,
	bodyBatteryMostRecentValue: 25,
	bodyBatteryDuringSleep: null,
	bodyBatteryAtWakeTime: null,
	bodyBatteryVersion: 3,
};

const day = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
function datesOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = day(d, 1)) out.push(d);
	return out;
}

/** The API double: both routes, each call booked. */
function apiOf(stats: (start: string, end: string) => DailyStatRow[], reports: (start: string, end: string) => unknown[]) {
	const asked: string[] = [];
	const api = {
		bodyBatteryDaily: async (start: string, end: string) => (asked.push(`stats ${start} ${end}`), stats(start, end)),
		bodyBattery: async (start: string, end: string) => (asked.push(`reports ${start} ${end}`), reports(start, end)),
	} as unknown as GarminApi;
	return { api, asked };
}

const fetchWindow = async (api: GarminApi, start: string, end: string) =>
	(await BODY_BATTERY_INDEX.fetchWindow(api, start, end)).map((r) => BODY_BATTERY_INDEX.normalize(r));

describe("BODY_BATTERY_INDEX — the definition", () => {
	it("is registered under its own folder and kind, in the stress group, 28 days a window", () => {
		assert.equal(dayIndex("body-battery"), BODY_BATTERY_INDEX);
		assert.ok(DAY_INDEXES.includes(BODY_BATTERY_INDEX));
		assert.deepEqual(
			[BODY_BATTERY_INDEX.kind, BODY_BATTERY_INDEX.folder, BODY_BATTERY_INDEX.title, BODY_BATTERY_INDEX.group, BODY_BATTERY_INDEX.version],
			["body-battery", "body-battery", "body battery", "stress", 1],
		);
		assert.deepEqual([BODY_BATTERY_INDEX.windowDays, BODY_BATTERY_INDEX.emptyWindowsToStop, BODY_BATTERY_INDEX.refreshDays], [28, 2, 0]);
		assert.deepEqual(BODY_BATTERY_INDEX.keys, ["high", "low", "charged", "drained", "latest", "atWake", "feedback"]);
		assert.equal(BODY_BATTERY_INDEX.keepOld, true);
		assert.equal(typeof BODY_BATTERY_INDEX.fromSummary, "function");
	});

	it("needs no intraday extra of its own: the 1d page's curve and events load by keys that exist", () => {
		const { loaders, unknown } = loadersFor([STRESS_DAY_KEY, "bodyBatteryEvents"], INTRADAY_EXTRAS);
		assert.deepEqual(unknown, []);
		assert.deepEqual(loaders.map((l) => l.keys), [[STRESS_DAY_KEY], ["bodyBatteryEvents"]]);
	});

	it("writes a row a line, keys in a fixed order, 0 kept", () => {
		const text = BODY_BATTERY_INDEX.serializeYear("2026", [
			{ date: "2026-10-08", high: 27, low: 25, charged: 0, drained: 2, latest: 25 },
			{ date: "2026-10-07", feedback: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE", atWake: 100, latest: 27, drained: 73, charged: 18, low: 27, high: 100 },
		]);
		assert.equal(
			text,
			[
				"{",
				'\t"version": 1,',
				'\t"year": 2026,',
				'\t"days": [',
				'\t\t{"date":"2026-10-07","high":100,"low":27,"charged":18,"drained":73,"latest":27,"atWake":100,"feedback":"SLEEP_PREPARATION_BALANCED_AND_INACTIVE"},',
				'\t\t{"date":"2026-10-08","high":27,"low":25,"charged":0,"drained":2,"latest":25}',
				"\t]",
				"}",
				"",
			].join("\n"),
		);
		assert.deepEqual(BODY_BATTERY_INDEX.parseYear(text).map((r) => r.date), ["2026-10-07", "2026-10-08"]);
	});
});

describe("BODY_BATTERY_INDEX — a history window", () => {
	it("asks both routes for the same window: the high and low from one, charged, drained and the feedback from the other", async () => {
		const { api, asked } = apiOf(() => AUGUST_STATS, () => AUGUST_REPORTS);
		const rows = await fetchWindow(api, "2026-08-14", "2026-09-10");
		assert.deepEqual(asked.sort(), ["reports 2026-08-14 2026-09-10", "stats 2026-08-14 2026-09-10"]);
		assert.deepEqual(rows, [
			{ date: "2026-08-17", high: 100, low: 34, charged: 64, drained: 67, feedback: "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE" },
			{ date: "2026-08-19", high: 89, low: 38, charged: 14, drained: 56, feedback: "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE" },
		]);
	});

	it("keeps the dynamic feedback type, not the end-of-day one, and the long type over the short", () => {
		assert.deepEqual(reportOf(AUGUST_REPORTS[0]), {
			date: "2026-08-17",
			charged: 64,
			drained: 67,
			feedback: "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE",
		});
		assert.equal(reportOf({ date: "2026-09-16", bodyBatteryDynamicFeedbackEvent: { feedbackShortType: "SLEEP_PREPARATION_RECOVERING_AND_EXERCISE", feedbackLongType: "SLEEP_PREPARATION_RECOVERING_AND_EXERCISE_AND_BB_LOW_MORNING_AND_NOW" } }).feedback, "SLEEP_PREPARATION_RECOVERING_AND_EXERCISE_AND_BB_LOW_MORNING_AND_NOW");
		assert.deepEqual(reportOf(null), { date: undefined, charged: undefined, drained: undefined, feedback: undefined });
		assert.deepEqual(rowOfStat(null), { date: undefined, high: undefined, low: undefined });
	});

	it("leaves the days without data out, whatever feedback the reports route gives them, and keeps a no-data feedback beside a row", () => {
		const held: BatteryRow[] = [
			{ date: "2026-01-04", high: 50, low: 40 },
			{ date: "2026-01-06", high: 70, low: 20, charged: 30 },
		];
		const merged = BODY_BATTERY_INDEX.merge(held, { rows: rowsOfWindow(JANUARY_STATS, JANUARY_REPORTS) as BatteryRow[], dates: datesOf("2026-01-02", "2026-01-29") });
		assert.deepEqual(merged, [
			{ date: "2026-01-03", high: 61, low: 10, charged: 71, drained: 36, feedback: "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE" },
			{ date: "2026-01-04", high: 49, low: 47, charged: 0, drained: 2, feedback: "EARLY_MORNING_NO_DATA" },
			{ date: "2026-01-10", high: 42, low: 34, charged: 8, drained: 0, feedback: "NO_DATA" },
		]);
	});

	it("makes no row of a stats row without a level, nor of a reports day alone", () => {
		const rows = rowsOfWindow([{ calendarDate: "2026-02-06", values: { lowBodyBattery: null, highBodyBattery: null } }], [{ date: "2026-02-06", charged: 5, drained: 1 }, { date: "2026-02-07", charged: 3, drained: 2 }]);
		assert.deepEqual(rows, []);
		assert.deepEqual(rowsOfWindow(null, null), []);
	});

	it("keeps the newest level and the level at wake a day's summary gave when a window brings the day back", () => {
		const held: BatteryRow[] = [{ date: "2026-10-07", high: 100, low: 27, charged: 18, drained: 73, latest: 27, atWake: 100, feedback: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE" }];
		const fresh = rowsOfWindow(
			[{ calendarDate: "2026-10-07", values: { lowBodyBattery: 27, highBodyBattery: 100 } }],
			[{ date: "2026-10-07", charged: 18, drained: 73, bodyBatteryDynamicFeedbackEvent: { feedbackLongType: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE" } }],
		);
		assert.deepEqual(BODY_BATTERY_INDEX.merge(held, { rows: fresh as BatteryRow[], dates: ["2026-10-07"] }), held);
	});

	it("walks back to the account's first day, two requests a window, and stops after two empty windows", async () => {
		const { api, asked } = apiOf(
			(start, end) => datesOf(start, end).filter((d) => d >= "2025-08-02").map((d) => ({ calendarDate: d, values: { lowBodyBattery: 20, highBodyBattery: 90 } })),
			// Every calendar day, before the history too, as the route sends them.
			(start, end) => datesOf(start, end).map((d) => (d >= "2025-08-02" ? { date: d, charged: 60, drained: 55 } : { date: d, charged: null, drained: null })),
		);
		const walk = await walkHistory(BODY_BATTERY_INDEX, (start, end) => BODY_BATTERY_INDEX.fetchWindow(api, start, end), { until: "2025-09-11" });
		const windows = ["2025-08-15 2025-09-11", "2025-07-18 2025-08-14", "2025-06-20 2025-07-17", "2025-05-23 2025-06-19"];
		assert.deepEqual(asked, windows.flatMap((w) => [`stats ${w}`, `reports ${w}`]));
		assert.equal(walk.complete, true);
		assert.equal(walk.batch.rows.length, 41);
		assert.deepEqual(BODY_BATTERY_INDEX.normalize(walk.batch.rows[0]), { date: "2025-08-15", high: 90, low: 20, charged: 60, drained: 55 });
	});

	it("fails the window when either route fails, so the walk asks again rather than keep half a row", async () => {
		const { api } = apiOf(
			() => AUGUST_STATS,
			() => {
				throw new Error("HTTP 400");
			},
		);
		await assert.rejects(BODY_BATTERY_INDEX.fetchWindow(api, "2026-08-14", "2026-09-10"), /HTTP 400/);
	});
});

describe("BODY_BATTERY_INDEX — the daily summary", () => {
	const fromSummary = (summary: DailySummary, date: string) => {
		const row = BODY_BATTERY_INDEX.fromSummary!(summary, date);
		return row ? BODY_BATTERY_INDEX.normalize({ ...row, date }) : null;
	};

	it("makes the run's own day from its summary: the newest level, the level at wake and the running feedback type", () => {
		assert.deepEqual(fromSummary(SUMMARY_OCT_7, "2026-10-07"), {
			date: "2026-10-07",
			high: 100,
			low: 27,
			charged: 18,
			drained: 73,
			latest: 27,
			atWake: 100,
			feedback: "SLEEP_PREPARATION_BALANCED_AND_INACTIVE",
		});
	});

	it("keeps today's partial day before its first feedback, charged 0 and all", () => {
		assert.deepEqual(fromSummary(SUMMARY_OCT_8, "2026-10-08"), { date: "2026-10-08", high: 27, low: 25, charged: 0, drained: 2, latest: 25 });
	});

	it("finds no day in a summary without a level, whatever feedback it carries", () => {
		const aug18: DailySummary = {
			bodyBatteryChargedValue: null,
			bodyBatteryDrainedValue: null,
			bodyBatteryHighestValue: null,
			bodyBatteryLowestValue: null,
			bodyBatteryMostRecentValue: null,
			bodyBatteryDynamicFeedbackEvent: { feedbackShortType: "NO_DATA", feedbackLongType: "NO_DATA" },
		};
		assert.equal(fromSummary(aug18, "2026-08-18"), null);
		assert.equal(fromSummary({}, "2026-08-18"), null);
	});
});
