import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { NOT_ENOUGH_DATA, batteryFeedback, factorLabel, shortFeedbackType } from "../src/dashboard/body-battery-copy";
import {
	batteryDayView,
	batteryPeriodView,
	batteryTimelineOf,
	batteryView,
	factorsOf,
	gaugeOf,
	signed,
	type BatteryData,
	type BatteryDayView,
	type BatteryFactor,
	type BatteryInput,
	type BatteryPeriodView,
	type BatteryRoute,
} from "../src/dashboard/body-battery-pages";
import { HEALTH_STATS } from "../src/dashboard/health-stats";
import { dayCardRoute, meanOf, stepRoute, switchRange, weeksOf } from "../src/dashboard/periods";
import type { BodyBatteryEvent } from "../src/garmin/endpoints";
import type { BatteryRow } from "../src/sync/body-battery-index";
import { mapSeries } from "../src/sync/intraday";
import type { StressDay } from "../src/sync/stress-index";

/** The capture day: everything below is in true dates (ref/health-stats/body-battery/README.md). */
const TODAY = "2026-10-08";
/**
 * The phone's 1d pages showed the day before's summary under each day's label
 * (`phone/INDEX.md`: data date = label − 1): its 1d pages are the plugin's
 * pages of the day before, as Stress's were. Its 7d and 4w lists were dated
 * right.
 */
const PHONE_DATA_DAY = "2026-10-07";

/**
 * Every day's low / high from the account's first day to the capture, as
 * `stats/bodybattery/daily` sent them live at 02:50 (Oct 8 partial: 25 / 27),
 * "-" for a day it left out: Aug 18 2026, Jun 24, Apr 1, Feb 6 and Jan 5 – 9.
 */
const FIRST_DAY = "2025-08-02";
const HISTORY = `24/51 24/93 47/100 18/100 5/66 5/81 8/66 27/89 32/87 13/80 5/42 5/50 34/100 16/100 8/68 5/81 5/70 19/96 5/49 8/99
9/100 5/19 5/82 14/88 5/91 5/55 5/49 14/73 13/70 11/93 16/83 26/100 18/100 12/75 15/90 21/100 21/71 6/95 6/71 5/37
6/80 5/55 5/100 6/83 7/89 5/68 5/59 9/89 24/74 32/90 17/75 35/93 27/96 35/96 26/93 17/98 6/100 6/47 5/52 5/66
5/95 5/34 16/91 5/44 5/57 23/86 20/84 20/80 19/100 5/28 5/59 20/64 23/69 40/62 11/72 45/92 21/89 6/89 42/100 13/92
14/84 20/82 41/99 7/60 5/44 5/69 27/87 26/86 6/82 6/58 5/54 5/56 12/74 18/94 31/82 12/94 39/87 20/100 24/83 27/100
23/86 35/88 35/81 48/100 25/97 22/100 29/79 38/100 23/100 12/80 12/83 21/94 19/83 12/82 11/58 7/87 7/60 21/75 28/75 11/100
8/64 5/23 5/32 5/48 21/64 17/80 10/53 8/57 18/88 19/68 32/77 5/75 5/74 8/67 16/50 10/60 22/97 14/80 13/52 21/85
29/100 28/82 24/64 25/80 14/80 14/92 22/82 16/55 19/87 38/94 17/100 17/72 17/79 14/85 10/61 47/49 - - - -
- 34/42 5/43 7/82 23/100 19/74 22/100 36/100 18/75 11/79 5/96 5/16 16/80 45/100 10/100 10/55 19/91 6/72 13/53 7/64
13/56 5/63 12/75 23/100 20/84 30/98 16/22 21/91 - 5/44 8/60 14/86 25/98 19/68 16/56 18/100 5/79 6/58 5/61 5/70
5/70 9/59 26/95 5/71 5/81 23/94 48/93 10/17 5/40 11/93 8/73 36/100 35/77 33/99 33/99 34/100 20/97 9/39 8/88 5/76
5/41 5/53 20/85 27/63 10/54 13/50 17/96 5/58 5/63 5/35 5/10 5/77 33/100 26/78 30/100 8/15 10/81 9/96 8/53 18/94
5/79 9/56 - 18/61 26/100 17/100 17/70 14/100 11/59 11/88 19/78 10/100 10/62 8/81 12/69 42/90 57/63 12/31 32/98 8/35
8/75 25/93 30/97 5/26 5/60 8/76 11/97 10/64 10/69 23/80 33/100 25/94 25/94 31/100 12/73 12/69 31/86 64/100 6/78 6/78
31/93 10/96 10/75 21/96 23/99 26/78 14/100 36/98 10/100 5/32 5/56 15/97 17/73 20/92 29/84 12/71 10/55 21/100 21/86 30/90
30/100 17/83 7/67 5/13 5/44 5/29 5/68 22/100 59/100 26/98 33/98 32/87 45/100 14/100 14/100 29/100 28/98 17/90 24/95 22/100
16/96 11/65 5/50 5/80 5/29 5/78 - 23/71 5/43 5/42 6/78 5/54 5/61 28/92 31/100 28/100 19/88 22/100 35/100 42/100
61/100 8/66 5/63 26/89 20/94 17/81 23/79 30/100 21/61 52/100 25/100 31/100 32/100 20/79 21/77 6/58 5/94 36/100 24/99 13/68
11/63 20/98 23/91 60/100 31/100 11/71 5/51 29/77 40/100 44/100 52/100 9/100 5/61 5/33 5/30 8/75 31/91 35/100 23/100 17/96
34/100 - 38/89 36/100 24/99 30/100 9/100 5/40 6/81 37/100 42/99 14/100 6/78 14/100 13/85 12/67 15/81 5/68 5/63 15/81
20/87 24/100 23/85 35/100 42/100 44/100 5/77 5/59 27/96 20/73 8/57 16/58 17/83 29/100 13/98 17/82 23/96 28/100 24/98 23/58
56/100 25/100 24/77 38/100 21/72 22/99 20/95 32/99 36/100 36/100 43/99 27/100 25/27`;

/** Charged / drained from the summaries (= the reports route), Sep 11 – Oct 8. */
const CHARGED = `09-11 88/55 09-12 6/78 09-13 71/30 09-14 71/74 09-15 63/67 09-16 79/59 09-17 26/53 09-18 98/46 09-19 50/71 09-20 52/85
09-21 65/59 09-22 82/56 09-23 80/78 09-24 59/74 09-25 74/43 09-26 64/55 09-27 35/75 09-28 73/54 09-29 61/67 09-30 57/71
10-01 75/77 10-02 98/58 10-03 44/69 10-04 64/57 10-05 85/65 10-06 84/59 10-07 18/73 10-08 0/2`;

/** The dynamic feedback types of the days whose copy the phone or the web showed (reports route). */
const FEEDBACK: Record<string, string> = {
	"2026-08-17": "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE",
	"2026-09-30": "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE",
	"2026-10-01": "SLEEP_PREPARATION_STRESSFUL_AND_INACTIVE",
	"2026-10-02": "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE",
	"2026-10-03": "SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE",
	"2026-10-04": "SLEEP_PREPARATION_NOT_STRESS_DATA_AND_INACTIVE",
	"2026-10-05": "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE",
	"2026-10-06": "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE",
	"2026-10-07": "SLEEP_PREPARATION_BALANCED_AND_INACTIVE",
};

/** What only the summaries had: Oct 7's newest level and level at wake, Oct 8's newest at 01:15. */
const SUMMARY_ONLY: Record<string, Partial<BatteryRow>> = {
	"2026-10-07": { latest: 27, atWake: 100 },
	"2026-10-08": { latest: 25 },
};

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The Body Battery index as a sync leaves it on the capture day, with any day replaced. */
function indexRows(replace: Record<string, Partial<BatteryRow>> = {}): BatteryRow[] {
	const charged = new Map(
		CHARGED.split(/\s+/)
			.reduce<string[][]>((pairs, token, i) => (i % 2 ? (pairs[pairs.length - 1]!.push(token), pairs) : [...pairs, [token]]), [])
			.map(([day, pair]) => [`2026-${day}`, pair!.split("/").map(Number) as [number, number]]),
	);
	const rows: BatteryRow[] = [];
	HISTORY.split(/\s+/).forEach((token, i) => {
		const date = shift(FIRST_DAY, i);
		const row: BatteryRow = { date };
		if (token !== "-") {
			const [low, high] = token.split("/").map(Number);
			Object.assign(row, { high, low });
			const cd = charged.get(date);
			if (cd) Object.assign(row, { charged: cd[0], drained: cd[1] });
			Object.assign(row, SUMMARY_ONLY[date] ?? {});
			if (FEEDBACK[date]) row.feedback = FEEDBACK[date];
		}
		const next = { ...row, ...replace[date] };
		if (Object.keys(next).length > 1) rows.push(next);
	});
	return rows;
}

const ROWS = indexRows();
/** Oct 8 as the phone's 7d and 4w cards had it at 05:45, after a later sync: a high of 63. */
const PHONE_ROWS = indexRows({ [TODAY]: { high: 63 } });
const data = (rows = ROWS, complete = true): BatteryData => ({ rows, complete });

const day = (offset: number, extra: Partial<BatteryInput> = {}, today = TODAY): BatteryDayView =>
	batteryDayView({ data: data(), route: { range: "1d", offset }, today, ...extra });
const period = (range: BatteryRoute["range"], offset: number, today = TODAY, rows = ROWS): BatteryPeriodView =>
	batteryPeriodView({ data: data(rows), route: { range, offset }, today });

const pairs = (view: BatteryPeriodView) => view.columns.map((c) => (c.high === undefined ? "--" : `${c.high}/${c.low}`));
const cards = (view: BatteryPeriodView) => view.days.map((c) => `${c.date.slice(5)} ${c.high}/${c.low}`);
const rowsOf = (factors: BatteryFactor[]) => factors.map((f) => [f.label, f.duration, f.impact].filter(Boolean).join(" · "));

/* ------------------------------------------------------------------ */
/*  Events, as the series file keeps them                              */
/* ------------------------------------------------------------------ */

/** A `bodyBattery/events` element, as Garmin sends it, less the arrays. */
function event(type: string, startGmt: string, minutes: number, impact: number, feedbackType: string, shortFeedback: string, activity?: [string, string, number]): BodyBatteryEvent {
	return {
		event: { eventType: type, eventStartTimeGmt: startGmt, timezoneOffset: 14_400_000, durationInMilliseconds: minutes * 60_000, bodyBatteryImpact: impact, feedbackType, shortFeedback },
		activityName: activity?.[0] ?? null,
		activityType: activity?.[1] ?? null,
		activityId: activity?.[2] ?? null,
		averageStress: null,
	};
}

/** The day's events through the series file's own mapping, as a 1d page reads them. */
const markers = (...events: BodyBatteryEvent[]) => mapSeries({ bodyBatteryEvents: events }).bodyBatteryEvents ?? [];

/** api-samples/bodyBattery-events-2026-10-0{3..8}.json, and Oct 1 – 2 from the reports route. */
const EVENTS = {
	"2026-10-01": markers(
		event("SLEEP", "2026-09-30T20:27:40.0", 452, 73, "NONE", "NONE"),
		event("NAP", "2026-10-01T18:13:27.0", 30, 0, "NONE", "NONE"),
		event("NAP", "2026-10-01T18:46:56.0", 15, 0, "NONE", "NONE"),
	),
	"2026-10-02": markers(
		event("SLEEP", "2026-10-01T22:50:49.0", 368, 68, "NONE", "NONE"),
		event("RECOVERY", "2026-10-02T06:37:40.0", 49, -1, "RECOVERY_BODY_BATTERY_NOT_INCREASE", "RESTFUL_PERIOD"),
	),
	"2026-10-03": markers(
		event("SLEEP", "2026-10-02T17:21:00.0", 715, 61, "NONE", "NONE"),
		event("ACTIVITY", "2026-10-03T10:59:19.0", 44, -10, "EXERCISE_TRAINING_EFFECT_4", "HIGHLY_IMPROVING_LACTATE_THRESHOLD", ["Dubai Running", "running", 24589239622]),
	),
	"2026-10-04": markers(event("SLEEP", "2026-10-03T19:35:14.0", 501, 66, "NONE", "NONE"), event("STRESS", "2026-10-04T10:34:29.0", 34, -6, "STRESS", "STRESSFUL_PERIOD")),
	"2026-10-05": markers(
		event("SLEEP", "2026-10-04T21:00:39.0", 396, 62, "NONE", "NONE"),
		event("NAP", "2026-10-05T13:41:58.0", 87, 9, "NAP_RECOVERING_BODY_BATTERY_INCREASE", "RESTFUL_NAP"),
	),
	"2026-10-06": markers(
		event("SLEEP", "2026-10-05T19:16:58.0", 484, 48, "NONE", "NONE"),
		event("RECOVERY", "2026-10-06T13:59:44.0", 47, 1, "RECOVERY_BODY_BATTERY_INCREASE", "BODY_BATTERY_RECHARGE"),
		event("RECOVERY", "2026-10-06T16:43:04.0", 36, 2, "RECOVERY_EVENING", "RESTFUL_PERIOD"),
	),
	"2026-10-07": markers(event("SLEEP", "2026-10-06T17:54:19.0", 600, 55, "NONE", "NONE")),
	"2026-10-08": markers(),
} as const;

/** Seconds asleep, the night that ended on each day (sleep stats; Sep 30 and Oct 1 to the minute, as the phone printed them). */
const SLEPT: Record<string, number> = {
	"2026-09-30": 3 * 3600 + 35 * 60,
	"2026-10-01": 7 * 3600 + 30 * 60,
	"2026-10-02": 21960,
	"2026-10-03": 35040,
	"2026-10-04": 29760,
	"2026-10-05": 23580,
	"2026-10-06": 27600,
	"2026-10-07": 35940,
};

/* ------------------------------------------------------------------ */
/*  The day's readings                                                 */
/* ------------------------------------------------------------------ */

const H = 3_600_000;
const STEP = 180_000;

/** Oct 7's 460 Body Battery readings (dailyStress-2026-10-07.json): a 23-hour day from UTC+3 to UTC+4. */
const OCT_7_BATTERY = `82 82 82 83 83 84 85 85 85 86 86 87 88 88 89 89 89 90 90 91 92 92 92 93 93 94 94 94 94 95 95 95 96 96 96 97 98 98 99 99 99 99 100 100 100 100
100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100 100
100 100 100 99 99 99 99 99 98 98 97 97 97 97 97 97 97 97 97 97 97 96 96 96 96 96 95 95 95 95 94 94 94 93 92 91 90 90 90 89 89 88 88 88 88 88
88 88 88 87 87 86 86 86 86 86 85 85 85 85 84 84 84 84 84 84 84 83 83 83 82 82 82 82 82 82 81 81 80 80 80 80 79 79 78 78 77 77 77 77 77 77
77 77 77 77 77 77 76 76 76 75 75 74 74 74 74 74 73 73 73 73 73 73 73 72 72 72 72 71 71 71 71 70 70 70 70 70 70 70 70 70 69 69 69 68 68 68
67 67 67 66 66 66 66 66 66 65 65 65 65 65 64 64 64 64 63 63 63 63 63 63 62 62 62 62 62 62 61 61 61 61 60 60 60 59 59 59 58 58 58 57 57 57
57 57 57 57 57 57 56 56 56 56 55 55 55 54 54 54 54 53 53 53 53 52 52 51 51 51 51 50 50 50 49 49 49 49 49 49 49 49 49 49 48 48 48 48 48 48
48 48 47 47 47 47 46 46 46 45 45 45 45 45 45 45 45 45 45 44 44 44 44 43 43 43 43 43 42 42 41 41 41 41 40 39 39 39 39 39 39 39 38 38 38 38
38 37 37 36 36 36 36 35 35 34 34 34 33 33 33 32 32 32 32 31 31 31 31 31 31 30 30 30 29 29 29 29 29 28 28 28 28 28 28 28 28 28 27 27 27 27`
	.split(/\s+/)
	.map(Number);

/** Oct 7's readings as `STRESS_DAY` keeps them: the curve, its two estimated stretches (16:00–16:36 and 16:51–17:33 UTC), no stress kept here. */
const OCT_7: StressDay = {
	start: Date.parse("2026-10-06T21:00:00Z"),
	end: Date.parse("2026-10-07T20:00:00Z"),
	startOffset: 3 * H,
	endOffset: 4 * H,
	step: STEP,
	levels: [],
	battery: OCT_7_BATTERY,
	batteryRuns: [
		["MODELED", 380, 13],
		["MODELED", 397, 15],
	],
};

/** Today to 01:08 (dailyStress-2026-10-08.json): 23 readings each, the battery 27 → 25, the newest stress unmeasurable. */
const OCT_8: StressDay = {
	start: Date.parse("2026-10-07T20:00:00Z"),
	end: Date.parse("2026-10-07T21:08:00Z"),
	startOffset: 4 * H,
	endOffset: 4 * H,
	step: STEP,
	levels: [40, 30, 30, 23, 26, 25, 30, 20, 20, 25, 23, 28, 20, 46, 49, 30, 52, 21, 22, 20, 22, 24, -1],
	battery: [27, 27, 27, 27, 27, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 25],
};

/* ------------------------------------------------------------------ */

describe("ranges", () => {
	it("pages through 1d, 7d and 4w: no 1y on the phone or the web", () => {
		assert.deepEqual(HEALTH_STATS.find((s) => s.id === "body-battery")?.ranges, ["1d", "7d", "4w"]);
		assert.equal(batteryView({ data: data(), route: { range: "1d", offset: 0 }, today: TODAY }).range, "1d");
		assert.equal(batteryView({ data: data(), route: { range: "7d", offset: 0 }, today: TODAY }).range, "7d");
		assert.equal(batteryView({ data: data(), route: { range: "4w", offset: 0 }, today: TODAY }).range, "4w");
		// A route that names a range the page does not have reads as its longest.
		assert.equal(batteryView({ data: data(), route: { range: "1y", offset: 0 }, today: TODAY }).range, "4w");
	});
});

describe("1d, a past day", () => {
	it("Oct 7 as the web showed it: the ring 100 High / 27 Low, Easy day, Sleep · 9h 59m · +55", () => {
		const view = day(-1, { readings: OCT_7, events: EVENTS["2026-10-07"], sleep: { seconds: SLEPT["2026-10-07"], wake: 24859 } });
		assert.equal(view.label, "Wednesday, October 7");
		assert.deepEqual(view.ring, { high: "100", low: "27", filled: true });
		assert.equal(view.gauge, undefined);
		assert.deepEqual(view.feedback, {
			headline: "Easy day",
			copy: "You've had an easy and low-stress day. Consider doing some yoga, meditation or another light and relaxing activity to help improve your sleep quality.",
		});
		assert.equal(view.feedbackType, "SLEEP_PREPARATION_BALANCED_AND_INACTIVE");
		assert.deepEqual(rowsOf(view.factors), ["Sleep · 9h 59m · +55"]);
		assert.deepEqual([view.factors[0]!.trend, view.factors[0]!.info, view.factors[0]!.minutes], ["up", false, 600]);
		assert.deepEqual([view.canGoBack, view.canGoForward], [true, true]);
	});

	it("keeps the Charged and Drained tiles on a past day, as the phone does: +18 / -73 on Oct 7", () => {
		assert.deepEqual(day(-1).tiles, [
			{ value: "+18", label: "Charged" },
			{ value: "-73", label: "Drained" },
		]);
	});

	it("a day without data: a grey ring of --, -- tiles, Not enough data, no Factors", () => {
		for (const offset of [-51, -275]) {
			// Aug 18 (synced, no readings) and Jan 6 (nothing at all) read the same.
			const view = day(offset, { events: [] });
			assert.ok(["2026-08-18", "2026-01-06"].includes(view.date));
			assert.deepEqual(view.ring, { high: "--", low: "--", filled: false });
			assert.deepEqual(view.tiles.map((t) => t.value), ["--", "--"]);
			assert.equal(view.feedback, NOT_ENOUGH_DATA);
			assert.deepEqual(view.factors, []);
		}
	});

	it("a history day the summaries never saw: its ring, and Not enough data without a feedback type", () => {
		const view = day(-30);
		assert.equal(view.date, "2026-09-08");
		assert.deepEqual(view.ring, { high: "85", low: "23", filled: true });
		assert.deepEqual(view.tiles.map((t) => t.value), ["--", "--"]);
		assert.equal(view.feedback, NOT_ENOUGH_DATA);
		assert.equal(view.feedbackType, undefined);
	});
});

describe("1d, today", () => {
	it("Oct 8 at 01:12 as the web showed it: the gauge 25 over 100, its first segment full, -- / -2, Not enough data, no Factors", () => {
		const view = day(0, { readings: OCT_8, events: EVENTS["2026-10-08"] });
		assert.equal(view.label, "Today");
		assert.equal(view.ring, undefined);
		assert.deepEqual(view.gauge, { value: "25", max: "100", segments: [1, 0, 0, 0] });
		assert.deepEqual(view.tiles.map((t) => [t.label, t.value]), [
			["Charged", "--"],
			["Drained", "-2"],
		]);
		assert.equal(view.feedback, NOT_ENOUGH_DATA);
		assert.equal(view.feedback?.copy, "We didn't gather enough data to determine your battery level. Wear your device continuously for the most accurate Body Battery readings.");
		assert.deepEqual(view.factors, []);
		assert.equal(view.canGoForward, false);
	});

	it("reads the gauge off the curve's newest reading when the summary has no newest level", () => {
		const rows = indexRows({ [TODAY]: { latest: undefined } });
		const view = batteryDayView({ data: data(rows), route: { range: "1d", offset: 0 }, today: TODAY, readings: OCT_8 });
		assert.equal(view.gauge?.value, "25");
		assert.equal(batteryDayView({ data: data(rows), route: { range: "1d", offset: 0 }, today: TODAY }).gauge?.value, "--");
	});

	it("fills each 25-point segment as far as the level reaches into it", () => {
		assert.deepEqual(gaugeOf(25).segments, [1, 0, 0, 0]);
		assert.deepEqual(gaugeOf(63).segments, [1, 1, 0.52, 0]);
		assert.deepEqual(gaugeOf(100).segments, [1, 1, 1, 1]);
		assert.deepEqual(gaugeOf(0).segments, [0, 0, 0, 0]);
		assert.deepEqual(gaugeOf(undefined), { value: "--", max: "100", segments: [0, 0, 0, 0] });
	});

	it("writes charged with a plus, drained with a minus, and -- for 0 or nothing", () => {
		assert.deepEqual([signed(18, "+"), signed(73, "-"), signed(0, "+"), signed(0, "-"), signed(undefined, "+")], ["+18", "-73", "--", "--", "--"]);
	});
});

describe("the copy", () => {
	it("the phone's days, each the day before's data under its label: copy by the dynamic feedback type", () => {
		const copyOn = (offset: number) => {
			const view = day(offset, {}, PHONE_DATA_DAY);
			return `${view.feedback?.headline}: ${view.feedback?.copy.split(".")[0]}`;
		};
		// "Today": Oct 7, on a gauge.
		const today = day(0, {}, PHONE_DATA_DAY);
		assert.deepEqual([today.label, today.gauge !== undefined], ["Today", true]);
		assert.deepEqual(
			[0, -1, -2, -3, -4, -5, -6, -7].map(copyOn),
			[
				"Easy day: You've had an easy and low-stress day",
				"Easy day: You've had an easy day with plenty of relaxing moments",
				"Easy day: You've had an easy day with plenty of relaxing moments",
				"Easy day: Your typical bedtime is approaching",
				"Demanding day: You've had a demanding day",
				"Easy day: You've had an easy day with plenty of relaxing moments",
				"Stressful day: Today has been stressful",
				"Easy day: You've had an easy day with plenty of relaxing moments",
			],
		);
		// The 4w-prev "--" card for Aug 18 opened Aug 17's data.
		assert.equal(day(-51, {}, PHONE_DATA_DAY).feedback?.headline, "Active Day");
	});

	it("Oct 1 settles it: its dynamic type (Stressful day), not its end-of-day one (Easy day)", () => {
		assert.equal(batteryFeedback("SLEEP_PREPARATION_STRESSFUL_AND_INACTIVE")?.headline, "Stressful day");
		assert.equal(batteryFeedback("SLEEP_PREPARATION_STRESSFUL_AND_INACTIVE")?.copy, "Today has been stressful. On days like this, try to take relaxation breaks and make time for some physical activity. You can focus now on winding down before bedtime to help improve your sleep quality.");
		assert.equal(day(-7).feedback?.headline, "Stressful day");
	});

	it("no type, or a no-data one, reads Not enough data", () => {
		for (const type of [undefined, "", "NO_DATA", "EARLY_MORNING_NO_DATA"]) assert.equal(batteryFeedback(type), NOT_ENOUGH_DATA);
	});

	it("a long type whose wording is unknown takes its short type's; a short type unknown too has none", () => {
		assert.equal(shortFeedbackType("SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE_AND_BB_LOW"), "SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE");
		assert.equal(shortFeedbackType("SLEEP_PREPARATION_RECOVERING_AND_INACTIVE_AND_BB_LOW_MORNING_AND_NOW"), "SLEEP_PREPARATION_RECOVERING_AND_INACTIVE");
		assert.equal(shortFeedbackType("SLEEP_PREPARATION_STRESSFUL_AND_HARD_EXERCISE"), "SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE");
		assert.equal(batteryFeedback("SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE_AND_BB_LOW")?.headline, "Demanding day");
		assert.equal(batteryFeedback("SLEEP_PREPARATION_RECOVERING_AND_INTENSIVE_EXERCISE"), null);
		assert.equal(batteryFeedback("DAY_RECOVERING_AND_INACTIVE"), null);
		// Oct 2 under a type never read: no copy, the type kept for the page.
		const view = batteryDayView({ data: data(indexRows({ "2026-10-02": { feedback: "SLEEP_PREPARATION_BALANCED_AND_EXERCISE" } })), route: { range: "1d", offset: -6 }, today: TODAY });
		assert.deepEqual([view.date, view.feedback, view.feedbackType], ["2026-10-02", null, "SLEEP_PREPARATION_BALANCED_AND_EXERCISE"]);
	});
});

describe("Factors", () => {
	it("lists the phone's rows newest first, the night last, each with its label, duration and signed impact", () => {
		// The phone gave each day's events with the night before's sleep time, as it showed the summary.
		const phone = (date: keyof typeof EVENTS) => rowsOf(factorsOf(EVENTS[date], SLEPT[shift(date, -1)]));
		assert.deepEqual(phone("2026-10-07"), ["Sleep · 7h 40m · +55"]);
		assert.deepEqual(phone("2026-10-06"), ["Low Stress · 36m · +2", "Low Stress · 47m · +1", "Sleep · 6h 33m · +48"]);
		assert.deepEqual(phone("2026-10-05"), ["Nap · 1h 27m · +9", "Sleep · 8h 16m · +62"]);
		assert.deepEqual(phone("2026-10-04"), ["High Stress · 34m · -6", "Sleep · 9h 44m · +66"]);
		assert.deepEqual(phone("2026-10-03"), ["Dubai Running · 44m · -10", "Sleep · 6h 6m · +61"]);
		assert.deepEqual(phone("2026-10-02"), ["Low Stress · 49m", "Sleep · 7h 30m · +68"]);
		assert.deepEqual(phone("2026-10-01"), ["Sleep · 3h 35m · +73"]);
	});

	it("gives a Sleep row the night's sleep time, not the event's window, which it falls back on", () => {
		// Oct 3: 9h 44m asleep in a 715-minute window; Oct 7: 9h 59m in 10h.
		assert.deepEqual(rowsOf(factorsOf(EVENTS["2026-10-03"], SLEPT["2026-10-03"])), ["Dubai Running · 44m · -10", "Sleep · 9h 44m · +61"]);
		assert.deepEqual(rowsOf(factorsOf(EVENTS["2026-10-07"])), ["Sleep · 10h · +55"]);
	});

	it("marks every row but Sleep with an (i), and points the arrow the impact's way", () => {
		const oct4 = factorsOf(EVENTS["2026-10-04"], SLEPT["2026-10-04"]);
		assert.deepEqual(oct4.map((f) => [f.type, f.info, f.trend]), [
			["STRESS", true, "down"],
			["SLEEP", false, "up"],
		]);
		assert.deepEqual(factorsOf(EVENTS["2026-10-05"]).map((f) => f.info), [true, false]);
		// A Low Stress row that did not raise the battery: no value, no arrow.
		const oct2 = factorsOf(EVENTS["2026-10-02"])[0]!;
		assert.deepEqual([oct2.label, oct2.impact, oct2.trend], ["Low Stress", "", undefined]);
	});

	it("keeps what the row's sheet needs: the start, the window, the short feedback and the activity", () => {
		const [run] = factorsOf(EVENTS["2026-10-03"]);
		assert.deepEqual(run, {
			type: "ACTIVITY",
			label: "Dubai Running",
			info: true,
			duration: "44m",
			impact: "-10",
			trend: "down",
			start: Date.parse("2026-10-03T10:59:19Z"),
			minutes: 44,
			feedback: "HIGHLY_IMPROVING_LACTATE_THRESHOLD",
			activityId: 24589239622,
		});
	});

	it("names an activity without a name, and an unknown type in words", () => {
		assert.equal(factorLabel("ACTIVITY"), "Activity");
		assert.equal(factorLabel("SOME_EVENT"), "Some Event");
		assert.deepEqual(factorsOf(undefined), []);
		assert.deepEqual(factorsOf([{ impact: 3 }, { type: " " }]), []);
	});
});

describe("1d timeline", () => {
	it("before the readings are in: a 24-hour axis labelled every four hours, nothing drawn", () => {
		const t = day(0).timeline;
		assert.equal(t.state, "pending");
		assert.deepEqual([t.hours, t.ticks.length], [24, 25]);
		assert.deepEqual(
			t.ticks.filter((k) => k.large).map((k) => k.label),
			["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"],
		);
		assert.deepEqual([t.curve, t.bars], [[], []]);
	});

	it("Oct 7 runs 23 hours: 24 dots, its ends labelled with their offsets, a step a reading, 28 of them estimated", () => {
		const t = batteryTimelineOf(OCT_7, 24859);
		assert.equal(t.state, "drawn");
		assert.deepEqual([t.hours, t.ticks.length], [23, 24]);
		assert.deepEqual(t.zones, { start: "GMT +03:00", end: "GMT +04:00" });
		assert.equal(t.curve.length, 460);
		assert.deepEqual([t.curve[0]!.level, Math.max(...t.curve.map((s) => s.level)), Math.min(...t.curve.map((s) => s.level)), t.curve[459]!.level], [82, 100, 27, 27]);
		assert.deepEqual([t.curve[0]!.x0, t.curve[0]!.x1, t.curve[459]!.x1], [0, 1 / 460, 1]);
		const estimated = t.curve.flatMap((s, i) => (s.estimated ? [i] : []));
		assert.equal(estimated.length, 28);
		assert.deepEqual([estimated[0], estimated[12], estimated[13], estimated[27]], [380, 392, 397, 411]);
		// The night ended at 06:54:19.
		assert.equal(t.wake, 24859 / (23 * 3600));
	});

	it("today runs on a 24-hour axis, the curve and the stress bars up to the newest reading", () => {
		const t = batteryTimelineOf(OCT_8);
		assert.deepEqual([t.state, t.hours, t.ticks.length, t.zones], ["drawn", 24, 25, undefined]);
		assert.deepEqual(t.curve.map((s) => s.level), [27, 27, 27, 27, 27, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 25]);
		assert.equal(t.curve[22]!.x1, (23 * STEP) / (24 * H));
		assert.equal(t.curve.some((s) => s.estimated), false);
		assert.deepEqual([t.bars.length, t.unmeasurable.length], [22, 1]);
	});

	it("a day without the curve draws its stress, and one without either is empty", () => {
		// Aug 18: readings at −1 and −2, no Body Battery array.
		const aug18 = batteryTimelineOf({ start: Date.parse("2026-08-17T21:00:00Z"), end: Date.parse("2026-08-18T21:00:00Z"), step: STEP, levels: [-1, -2, -1] });
		assert.deepEqual([aug18.state, aug18.curve, aug18.unmeasurable.length, aug18.active.length], ["drawn", [], 2, 1]);
		assert.equal(batteryTimelineOf(null).state, "empty");
		const onlyBattery = batteryTimelineOf({ start: Date.parse("2026-05-10T20:00:00Z"), end: Date.parse("2026-05-11T20:00:00Z"), step: STEP, levels: [], battery: [60, null, 61] });
		assert.deepEqual([onlyBattery.state, onlyBattery.curve.map((s) => s.level), onlyBattery.bars], ["drawn", [60, 61], []]);
	});
});

describe("7d", () => {
	it("Oct 2 - 8 as the web drew it: seven high / low pairs, today's partial 27 / 25 included", () => {
		const view = period("7d", 0);
		assert.equal(view.label, "Oct 2 - 8");
		assert.equal(view.title, "Daily Values");
		assert.deepEqual(pairs(view), ["95/20", "99/32", "100/36", "100/36", "99/43", "100/27", "27/25"]);
		assert.deepEqual(view.columns.map((c) => c.x), [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]);
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"]);
		assert.deepEqual(view.axis.labels.map((l) => l.x), view.columns.map((c) => c.x));
		assert.ok(view.axis.dots.every((d) => d.large));
		assert.deepEqual([view.canGoBack, view.canGoForward], [true, false]);
	});

	it("rounds the period's means half up: 620 / 7 = 88.57 → 89 high, 219 / 7 → 31 low; lowest 20, highest 100", () => {
		const view = period("7d", 0);
		assert.deepEqual(view.averages, { high: 89, low: 31 });
		assert.deepEqual([view.lowest, view.highest], [20, 100]);
	});

	it("Sep 25 - Oct 1, a week back: 30 / 87, where floor would give 29 / 86", () => {
		const view = period("7d", -1);
		assert.equal(view.label, "Sep 25 - Oct 1");
		assert.deepEqual(pairs(view), ["58/23", "100/56", "100/25", "77/24", "100/38", "72/21", "99/22"]);
		assert.deepEqual(view.averages, { high: 87, low: 30 });
		assert.deepEqual([view.lowest, view.highest], [21, 100]);
		assert.equal(view.canGoForward, true);
	});

	it("the phone's cards, newest first, dated as the label is: Thursday, October 8 · 63 High · 25 Low …", () => {
		const view = period("7d", 0, TODAY, PHONE_ROWS);
		assert.deepEqual(cards(view), ["10-08 63/25", "10-07 100/27", "10-06 99/43", "10-05 100/36", "10-04 100/36", "10-03 99/32", "10-02 95/20"]);
		assert.deepEqual([view.days[0]!.weekday, view.days[0]!.detail], ["Thursday", "October 8"]);
		assert.deepEqual(cards(period("7d", -1, TODAY, PHONE_ROWS)), ["10-01 99/22", "09-30 72/21", "09-29 100/38", "09-28 77/24", "09-27 100/25", "09-26 100/56", "09-25 58/23"]);
	});
});

describe("4w", () => {
	it("Sep 11 - Oct 8: 28 pairs, Oct 8 at 27 / 25, the axis' ends labelled 09-11 and 10-08; 25 / 86", () => {
		const view = period("4w", 0);
		assert.equal(view.label, "Sep 11 - Oct 8");
		assert.equal(view.columns.length, 28);
		assert.equal(pairs(view)[27], "27/25");
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["09-11", "10-08"]);
		assert.deepEqual(view.axis.dots.map((d) => d.large).filter(Boolean).length, 2);
		assert.deepEqual(view.averages, { high: 86, low: 25 });
		assert.deepEqual([view.lowest, view.highest], [5, 100]);
	});

	it("the phone's 28 cards for Sep 11 - Oct 8, with Oct 8 at 63 / 25", () => {
		const view = period("4w", 0, TODAY, PHONE_ROWS);
		assert.equal(
			view.days.map((c) => `${c.high}/${c.low}`).join(" "),
			"63/25 100/27 99/43 100/36 100/36 99/32 95/20 99/22 72/21 100/38 77/24 100/25 100/56 58/23 98/24 100/28 96/23 82/17 98/13 100/29 83/17 58/16 57/8 73/20 96/27 59/5 77/5 100/44",
		);
	});

	it("Aug 14 - Sep 10: 27 pairs and Aug 18 drawn as nothing, its card --; ÷ 27, 21 / 89", () => {
		const view = period("4w", -1);
		assert.equal(view.label, "Aug 14 - Sep 10");
		assert.deepEqual(view.columns[4], { date: "2026-08-18", x: 4 / 27 });
		assert.equal(pairs(view).filter((p) => p !== "--").length, 27);
		assert.deepEqual(view.averages, { high: 89, low: 21 });
		assert.deepEqual([view.lowest, view.highest], [5, 100]);
		// Sep 3 reads 68 in the shot; the INDEX's OCR line has 89.
		assert.equal(
			view.days.map((c) => `${c.high}/${c.low}`).join(" "),
			"100/42 100/35 85/23 100/24 87/20 81/15 63/5 68/5 81/15 67/12 85/13 100/14 78/6 100/14 99/42 100/37 81/6 40/5 100/9 100/30 99/24 100/36 89/38 --/-- 100/34 96/17 100/23 100/35",
		);
		const aug18 = view.days.find((c) => c.date === "2026-08-18")!;
		assert.deepEqual([aug18.weekday, aug18.detail, aug18.offset], ["Tuesday", "August 18", -51]);
	});

	it("a window before the history: no column drawn, every card --, no figures", () => {
		const view = period("4w", -16);
		assert.equal(view.to, "2025-07-17");
		assert.ok(view.columns.every((c) => c.high === undefined && c.low === undefined));
		assert.deepEqual([view.averages, view.lowest, view.highest], [{}, undefined, undefined]);
		assert.equal(view.canGoBack, false);
		assert.equal(batteryPeriodView({ data: data(ROWS, false), route: { range: "4w", offset: -16 }, today: TODAY }).canGoBack, true);
	});
});

/** `stats/bodybattery/weekly/2026-10-08/52`: each week's first day, its average daily low / high. */
const WEEKLY = `2025-10-10:21/64 10-17:22/91 10-24:12/69 10-31:17/77 11-07:30/91 11-14:23/91 11-21:14/77 11-28:12/58 12-05:16/71 12-12:13/69 12-19:22/83 12-26:21/81
2026-01-02:24/65 01-09:18/74 01-16:19/78 01-23:11/70 01-30:18/76 02-06:15/69 02-13:8/71 02-20:17/70 02-27:27/92 03-06:10/68 03-13:12/60 03-20:17/66
03-27:11/73 04-03:16/85 04-10:22/71 04-17:16/69 04-24:17/83 05-01:26/86 05-08:18/88 05-15:15/79 05-22:20/83 05-29:11/58 06-05:33/98 06-12:21/97
06-19:9/62 06-26:12/67 07-03:31/93 07-10:20/81 07-17:27/88 07-24:19/88 07-31:31/86 08-07:16/70 08-14:31/98 08-21:22/88 08-28:11/83 09-04:23/88
09-11:18/74 09-18:22/94 09-25:30/87 10-02:31/89`;

describe("the rounding, proven on the weekly route", () => {
	let year = "";
	const weekly = WEEKLY.split(/\s+/).map((entry) => {
		const [date, pair] = entry.split(":");
		if (date!.length === 10) year = date!.slice(0, 4);
		const [low, high] = pair!.split("/").map(Number);
		return { from: date!.length === 10 ? date! : `${year}-${date}`, low: low!, high: high! };
	});
	const means = (rounding: "round" | "floor", key: "low" | "high") => weeksOf(ROWS, TODAY, (r) => r[key], rounding).map((w) => w.value);

	it("rounds half up over the days with data: all 104 weekly values, today's partial day counted", () => {
		assert.deepEqual(weeksOf(ROWS, TODAY, (r) => r.low, "round").map((w) => w.from), weekly.map((w) => w.from));
		assert.deepEqual(means("round", "low"), weekly.map((w) => w.low));
		assert.deepEqual(means("round", "high"), weekly.map((w) => w.high));
	});

	it("is not Stress's floor (59 of 104), nor half-even: the weeks of Feb 6 and Aug 14 average 14.5 and 30.5 over six days", () => {
		const floor = [...means("floor", "low").map((v, i) => v === weekly[i]!.low), ...means("floor", "high").map((v, i) => v === weekly[i]!.high)];
		assert.equal(floor.filter(Boolean).length, 59);
		const feb6 = weeksOf(ROWS, TODAY, (r) => r.low, "round").find((w) => w.from === "2026-02-06")!;
		const aug14 = weeksOf(ROWS, TODAY, (r) => r.low, "round").find((w) => w.from === "2026-08-14")!;
		assert.deepEqual([feb6.value, feb6.days, aug14.value, aug14.days], [15, 6, 31, 6]);
	});

	it("a year of those weeks would read 19 / 79 (998 / 52, 4087 / 52), were there a 1y", () => {
		assert.deepEqual([meanOf(weekly.map((w) => w.low), "round"), meanOf(weekly.map((w) => w.high), "round")], [19, 79]);
	});
});

describe("moving between pages", () => {
	it("a day card switches the page in place to 1d on its day", () => {
		const oct5 = period("7d", 0).days.find((c) => c.date === "2026-10-05")!;
		assert.equal(oct5.offset, -3);
		assert.deepEqual(dayCardRoute(oct5.date, TODAY), { range: "1d", offset: -3 });
		assert.equal(batteryDayView({ data: data(), route: dayCardRoute(oct5.date, TODAY), today: TODAY }).label, "Monday, October 5");
	});

	it("< steps back a day, seven days or 28, and > never past the current period", () => {
		assert.equal(period("7d", -1).to, "2026-10-01");
		assert.equal(period("4w", -1).to, "2026-09-10");
		assert.deepEqual(stepRoute({ range: "4w", offset: 0 }, 1), { range: "4w", offset: 0 });
		assert.deepEqual(switchRange({ range: "1d", offset: -3 }, "4w", TODAY), { range: "4w", offset: 0, date: "2026-10-05" });
	});
});
