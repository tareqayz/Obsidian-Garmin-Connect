import type { DayRow } from "../src/dashboard/series";
import type { Activity, TrainingLoadBalanceEntry } from "../src/garmin/endpoints";
import { rowOf, sortRows, type ActivityRow } from "../src/sync/activity-index";
import { dayRowOf } from "../src/sync/days";
import { mapDay } from "../src/sync/metrics";
import { TRAINING_STATUS_INDEX, type TrainingStatusRow } from "../src/sync/training-status-index";
import { ROWS as STATUS_HISTORY } from "./training-status-fixture";

/**
 * The Load tests' data, from the payloads of 2026-10-12 09:41–09:43
 * (ref/performance-stats/training-load/api-samples/) and the Training Status
 * samples (../training-status/api-samples/), run through the plugin's own
 * mappers — the activity index's `rowOf`, the day sync's `mapDay`, the
 * Training Status index's `normalize` — so the page reads what a sync would
 * have stored. The 4w windows roll daily, so the golden numbers only
 * reproduce with today pinned to the capture day. Not a test file: the
 * pages tests import it (and the charts tests will).
 */
export const TODAY = "2026-10-11";

/**
 * The 30 newest activities as `activitylist-service` listed them
 * (`activities-search-0-30-redacted.json`): id (made up, in the real ids'
 * order), local start, GMT start, type, type id, parent type id, distance
 * (m), duration (s), exercise load, primary benefit, aerobic and anaerobic
 * training effect — Garmin's floats as sent. Oldest is Aug 23: the 4w −1
 * period's Aug 17 – 22 is not in it.
 */
const LISTED = `
90000000032 2026-10-11T08:21:37 2026-10-11T04:21:37 running 1 17 12469.4697265625 4097.23583984375 203.8532257080078 LACTATE_THRESHOLD 4.5 0.20000000298023224
90000000031 2026-10-10T08:19:48 2026-10-10T04:19:48 running 1 17 10009 3360.820068359375 171.5507354736328 LACTATE_THRESHOLD 4.300000190734863 0
90000000030 2026-10-03T14:59:19 2026-10-03T10:59:19 running 1 17 8008.75 2493.64111328125 164.75930786132812 LACTATE_THRESHOLD 4.099999904632568 0
90000000029 2026-09-28T08:03:23 2026-09-28T05:03:23 running 1 17 11093.3203125 3709.126953125 195.7162322998047 LACTATE_THRESHOLD 4.400000095367432 0.20000000298023224
90000000028 2026-09-27T16:05:42 2026-09-27T13:05:42 running 1 17 6084.3701171875 1840.22998046875 121.26181030273438 LACTATE_THRESHOLD 3.5999999046325684 0
90000000027 2026-09-25T05:56:48 2026-09-25T02:56:48 running 1 17 7813.75 2405.412109375 166.1392059326172 VO2MAX 4.099999904632568 0
90000000026 2026-09-23T06:55:05 2026-09-23T03:55:05 running 1 17 7456.919921875 2532.81591796875 141.45799255371094 LACTATE_THRESHOLD 3.799999952316284 0
90000000025 2026-09-22T14:06:02 2026-09-22T11:06:02 treadmill_running 18 1 5436.8701171875 1566.3470458984375 134.14447021484375 TEMPO 3.700000047683716 0
90000000024 2026-09-19T11:07:48 2026-09-19T08:07:48 running 1 17 2573.5400390625 723.5419921875 62.02104187011719 TEMPO 2.799999952316284 0
90000000023 2026-09-16T14:13:23 2026-09-16T11:13:23 running 1 17 4691.1201171875 1683.0999755859375 70.51893615722656 AEROBIC_BASE 3 0
90000000022 2026-09-15T13:51:48 2026-09-15T10:51:48 running 1 17 9163.4599609375 3352.8310546875 88.90252685546875 AEROBIC_BASE 3.200000047683716 0
90000000021 2026-09-14T23:50:17 2026-09-14T20:50:17 lap_swimming 27 26 1100 1900.416015625 62.407440185546875 RECOVERY 2.4000000953674316 1.5
90000000020 2026-09-12T21:05:57 2026-09-12T18:05:57 running 1 17 3797.050048828125 1120.68701171875 119.70242309570312 TEMPO 3.0999999046325684 2.299999952316284
90000000019 2026-09-12T08:32:51 2026-09-12T05:32:51 running 1 17 1692.260009765625 511.89801025390625 49.28497314453125 TEMPO 2.4000000953674316 0.6000000238418579
90000000018 2026-09-12T07:44:29 2026-09-12T04:44:29 running 1 17 5544.27001953125 1935.239990234375 88.9580078125 AEROBIC_BASE 3.200000047683716 0
90000000017 2026-09-09T18:38:23 2026-09-09T15:38:23 running 1 17 5125.06005859375 1808.633056640625 99.04685974121094 TEMPO 3.299999952316284 0
90000000016 2026-09-07T17:34:31 2026-09-07T14:34:31 running 1 17 1331.0400390625 455.5169982910156 28.08251953125 TEMPO 2.0999999046325684 0
90000000015 2026-09-07T17:02:02 2026-09-07T14:02:02 running 1 17 3757.52001953125 1303.9859619140625 74.85665893554688 TEMPO 3.0999999046325684 0
90000000014 2026-09-05T14:52:35 2026-09-05T11:52:35 running 1 17 6013.83984375 1997.1800537109375 103.85186767578125 AEROBIC_BASE 3.299999952316284 0.20000000298023224
90000000013 2026-09-04T21:06:19 2026-09-04T18:06:19 treadmill_running 18 1 10156.6396484375 3710.3701171875 59.50238037109375 AEROBIC_BASE 2.799999952316284 0
90000000012 2026-09-03T21:11:22 2026-09-03T17:11:22 running 1 17 8518.4296875 3361.930908203125 79.2484130859375 AEROBIC_BASE 3.0999999046325684 0
90000000011 2026-08-31T19:02:33 2026-08-31T15:02:33 running 1 17 2231.340087890625 816.3410034179688 46.743377685546875 TEMPO 2.5 0
90000000010 2026-08-31T18:09:21 2026-08-31T14:09:21 running 1 17 5504.47998046875 1797.2740478515625 132.38746643066406 LACTATE_THRESHOLD 3.799999952316284 0
90000000009 2026-08-30T08:53:33 2026-08-30T05:53:33 running 1 17 5031.31982421875 1639.0770263671875 148.31649780273438 TEMPO 3.5 2.299999952316284
90000000008 2026-08-29T15:05:39 2026-08-29T12:05:39 running 1 17 1887.3599853515625 711.8569946289062 36.02619934082031 RECOVERY 2.299999952316284 0
90000000007 2026-08-28T19:01:25 2026-08-28T16:01:25 stair_climbing 31 29 0 2092.2958984375 61.71232604980469 AEROBIC_BASE 2.9000000953674316 0.10000000149011612
90000000006 2026-08-24T10:57:21 2026-08-24T07:57:21 running 1 17 7164.419921875 2304.47900390625 124.88330078125 TEMPO 3.700000047683716 0
90000000005 2026-08-23T22:23:06 2026-08-23T19:23:06 treadmill_running 18 1 6717.6298828125 2392.615966796875 48.978607177734375 AEROBIC_BASE 2.5999999046325684 0
90000000004 2026-08-23T11:50:31 2026-08-23T08:50:31 running 1 17 2306.909912109375 784.1849975585938 57.36763000488281 TEMPO 2.9000000953674316 0
90000000003 2026-08-23T10:53:10 2026-08-23T07:53:10 running 1 17 5006.22021484375 1706.8299560546875 98.96066284179688 LACTATE_THRESHOLD 3.5 0
`;

/** A listed activity as the list sends it. */
export function listed(line: string): Activity {
	const [id, local, gmt, typeKey, typeId, parentTypeId, distance, duration, load, benefit, aerobic, anaerobic] = line.trim().split(/\s+/);
	return {
		activityId: Number(id),
		startTimeLocal: local!.replace("T", " "),
		startTimeGMT: gmt!.replace("T", " "),
		activityType: { typeKey, typeId: Number(typeId), parentTypeId: Number(parentTypeId) },
		distance: Number(distance),
		duration: Number(duration),
		activityTrainingLoad: Number(load),
		trainingEffectLabel: benefit,
		aerobicTrainingEffect: Number(aerobic),
		anaerobicTrainingEffect: Number(anaerobic),
	};
}

/** The activity index's rows for them, newest first, as the index keeps them. */
export const ACTIVITIES: ActivityRow[] = sortRows(
	LISTED.trim()
		.split("\n")
		.map((line) => rowOf(listed(line))!),
);

/**
 * `trainingloadbalance/latest/{date}`'s entries (`load-balance-*.json`), the
 * same as the aggregated route's `mostRecentTrainingLoadBalance` the day sync
 * stores: Oct 11 (the golden day), Oct 10 (the web's ‹ day), Sep 12 (an
 * ANAEROBIC_SHORTAGE day) and 2025-08-09 (the first record).
 */
export const BALANCES: Readonly<Record<string, TrainingLoadBalanceEntry>> = {
	"2026-10-11": entry("2026-10-11", [204.27565, 399, 800], [1355.2607, 402, 869], [17.689514, 66, 267], "AEROBIC_LOW_SHORTAGE"),
	"2026-10-10": entry("2026-10-10", [204.27565, 399, 800], [1153.6572, 402, 869], [17.689514, 66, 267], "AEROBIC_LOW_SHORTAGE"),
	"2026-09-12": entry("2026-09-12", [574.98834, 273, 600], [1094.9519, 327, 655], [83.97699, 109, 327], "ANAEROBIC_SHORTAGE"),
	"2025-08-09": entry("2025-08-09", [537.8247, 216, 480], [263.42932, 266, 529], [191.63153, 87, 263], "AEROBIC_HIGH_SHORTAGE"),
};

type Bucket = [load: number, min: number, max: number];

function entry(date: string, low: Bucket, high: Bucket, anaerobic: Bucket, phrase: string): TrainingLoadBalanceEntry {
	return {
		calendarDate: date,
		deviceId: 3600000001,
		monthlyLoadAerobicLow: low[0],
		monthlyLoadAerobicHigh: high[0],
		monthlyLoadAnaerobic: anaerobic[0],
		monthlyLoadAerobicLowTargetMin: low[1],
		monthlyLoadAerobicLowTargetMax: low[2],
		monthlyLoadAerobicHighTargetMin: high[1],
		monthlyLoadAerobicHighTargetMax: high[2],
		monthlyLoadAnaerobicTargetMin: anaerobic[1],
		monthlyLoadAnaerobicTargetMax: anaerobic[2],
		trainingBalanceFeedbackPhrase: phrase,
		primaryTrainingDevice: true,
	};
}

/** A day file as the day sync writes it from the day's `trainingStatus` (`mapDay`), with whatever else the day holds. */
export function dayOf(date: string, balance: TrainingLoadBalanceEntry | null, values: Record<string, number> = {}): DayRow {
	const training = { mostRecentTrainingLoadBalance: { metricsTrainingLoadBalanceDTOMap: balance ? { "3600000001": balance } : null } };
	return dayRowOf(date, { ...values, ...mapDay({ training }, { groups: ["training"], units: "metric", date }) });
}

/**
 * The day files the tests read, oldest first: the four records, and Oct 12
 * before the watch synced (the aggregated route's load balance null, the day
 * holding only its steps).
 */
export const DAYS: DayRow[] = [
	dayOf("2025-08-09", BALANCES["2025-08-09"]!),
	dayOf("2026-09-12", BALANCES["2026-09-12"]!),
	dayOf("2026-10-10", BALANCES["2026-10-10"]!),
	dayOf("2026-10-11", BALANCES["2026-10-11"]!),
	dayOf("2026-10-12", null, { steps: 1234 }),
];

/**
 * The 4w −1 period's rows (Aug 17 – Sep 13), whole, from
 * `probe-weekly-3660-2016-10-14_2026-10-11.json`, in the Training Status
 * fixture's `FULL` format: date, code, phrase, acute, chronic, ratio, acwr,
 * pct, feedback, trend, sport.
 */
const PREVIOUS = `
2026-08-17 7 PRODUCTIVE_2 307 277 1.1 OPTIMAL 47 FEEDBACK_2 2 RUNNING
2026-08-18 4 MAINTAINING_4 233 276 0.8 OPTIMAL 33 FEEDBACK_2 2 RUNNING
2026-08-19 4 MAINTAINING_4 183 269 0.6 LOW 25 FEEDBACK_1 2 RUNNING
2026-08-20 5 RECOVERY_2 150 262 0.5 LOW 20 FEEDBACK_1 2 RUNNING
2026-08-21 5 RECOVERY_2 125 251 0.4 LOW 16 FEEDBACK_1 2 RUNNING
2026-08-22 4 MAINTAINING_4 241 264 0.9 OPTIMAL 38 FEEDBACK_2 2 RUNNING
2026-08-23 7 PRODUCTIVE_6 463 303 1.5 HIGH 66 FEEDBACK_4 2 RUNNING
2026-08-24 3 OVERREACHING_1 557 325 1.7 HIGH 80 FEEDBACK_4 1 RUNNING
2026-08-25 3 OVERREACHING_1 476 320 1.4 OPTIMAL 61 FEEDBACK_3 1 RUNNING
2026-08-26 2 UNPRODUCTIVE_5 394 315 1.2 OPTIMAL 52 FEEDBACK_2 1 RUNNING
2026-08-27 2 UNPRODUCTIVE_5 338 306 1.1 OPTIMAL 47 FEEDBACK_2 1 RUNNING
2026-08-28 2 UNPRODUCTIVE_5 361 310 1.1 OPTIMAL 47 FEEDBACK_2 1 RUNNING
2026-08-29 2 UNPRODUCTIVE_5 343 310 1.1 OPTIMAL 47 FEEDBACK_2 1 RUNNING
2026-08-30 2 UNPRODUCTIVE_5 463 335 1.3 OPTIMAL 57 FEEDBACK_3 1 RUNNING
2026-08-31 2 UNPRODUCTIVE_4 604 369 1.6 HIGH 73 FEEDBACK_4 1 RUNNING
2026-09-01 2 UNPRODUCTIVE_4 493 367 1.3 OPTIMAL 57 FEEDBACK_3 1 RUNNING
2026-09-02 2 UNPRODUCTIVE_4 397 362 1 OPTIMAL 42 FEEDBACK_2 1 RUNNING
2026-09-03 8 STRAINED_1 428 370 1.1 OPTIMAL 47 FEEDBACK_2 1 RUNNING
2026-09-04 8 STRAINED_1 440 373 1.1 OPTIMAL 47 FEEDBACK_2 1 RUNNING
2026-09-05 4 MAINTAINING_6 500 388 1.2 OPTIMAL 52 FEEDBACK_2 2 RUNNING
2026-09-06 4 MAINTAINING_2 415 380 1 OPTIMAL 42 FEEDBACK_2 2 RUNNING
2026-09-07 4 MAINTAINING_2 461 397 1.1 OPTIMAL 47 FEEDBACK_2 2 RUNNING
2026-09-08 4 MAINTAINING_2 371 389 0.9 OPTIMAL 38 FEEDBACK_2 2 RUNNING
2026-09-09 7 PRODUCTIVE_3 411 403 1 OPTIMAL 42 FEEDBACK_2 3 RUNNING
2026-09-10 7 PRODUCTIVE_3 332 392 0.8 OPTIMAL 33 FEEDBACK_2 3 RUNNING
2026-09-11 7 PRODUCTIVE_3 275 377 0.7 LOW 29 FEEDBACK_1 3 RUNNING
2026-09-12 7 PRODUCTIVE_3 547 422 1.2 OPTIMAL 52 FEEDBACK_2 3 RUNNING
2026-09-13 7 PRODUCTIVE_3 458 412 1.1 OPTIMAL 47 FEEDBACK_2 3 RUNNING
`;

function statusRow(line: string): TrainingStatusRow {
	const [date, code, phrase, acute, chronic, ratio, acwr, pct, feedback, trend, sport] = line
		.trim()
		.split(/\s+/)
		.map((v) => (v === "-" ? undefined : v));
	const n = (v: string | undefined) => (v === undefined ? undefined : Number(v));
	return TRAINING_STATUS_INDEX.normalize({
		date,
		code: n(code),
		phrase,
		acute: n(acute),
		chronic: n(chronic),
		ratio: n(ratio),
		acwr,
		acwrPct: n(pct),
		acwrFeedback: feedback,
		trend: n(trend),
		trendSport: sport,
	})!;
}

/**
 * The Training Status index as the walk leaves it (the Training Status
 * fixture's 435 rows, 2025-08-02 → 2026-10-11, whole on the 4w Sep 14 –
 * Oct 11), with the −1 period's rows made whole too.
 */
export const STATUS: TrainingStatusRow[] = (() => {
	const previous = new Map(
		PREVIOUS.trim()
			.split("\n")
			.map((line) => {
				const row = statusRow(line);
				return [row.date, row] as const;
			}),
	);
	return STATUS_HISTORY.map((row) => previous.get(row.date) ?? row);
})();

/* ------------------------------------------------------------------ */
/*  What the phone drew (402 pt wide, 3 px a pt)                       */
/* ------------------------------------------------------------------ */

/**
 * Positions read off the five shots of 2026-10-11 21:17–21:18 by the spec's
 * pixel checks (golden-training-load.py, tl_dots.py, tl_band.py,
 * tl_marks.py), in phone points. The chart geometry is the twin's business
 * (training-load-charts.ts); these pin the values and axes the view hands it.
 */
export const PHONE = {
	focus: {
		/** Each bar runs from x 201 for 185 pt × its share of the scale. */
		x: 201,
		width: 185,
		/** Bar ends, Anaerobic (a lens), High Aerobic, Low Aerobic. */
		ends: [203.33, 386.0, 229.0],
		/** The Optimal Range boxes' outer stroke edges. */
		boxes: [
			[209.67, 237.67],
			[255.67, 320.0],
			[255.0, 310.33],
		],
	},
	exercise: {
		/** The bars' flat bottoms, and the plot's height for 0 … 3S. */
		baseline: 389.67,
		height: 102.73,
		/** The 12 bars' heights, Sep 14 … Oct 11. */
		heights: [28.33, 40.67, 32.33, 28.33, 61.33, 64.33, 75.67, 55.33, 89.33, 75.33, 78.67, 93.0],
		/** The y labels' ink centres, top first: "225", "150", "75", "0". */
		labels: [286.83, 321.17, 355.33, 389.5],
	},
	acute: {
		/** The zero gridline and the top one (centres). */
		baseline: 524.17,
		top: 394.5,
		grid: [394.5, 437.5, 480.83, 524.17],
		/** "1.1k", "750", "375", "0": their ink centres. */
		labels: [385.33, 431.5, 477.83, 523.83],
		/** The 28 white dots' centres, Sep 14 … Oct 11. */
		dots: [
			477.0, 462.67, 461.17, 471.67, 480.67, 480.17, 488.83, 496.83, 484.5, 469.33, 477.33, 460.67, 469.17, 458.33, 437.67, 450.5, 462.5, 474.17,
			485.67, 470.67, 480.17, 490.17, 498.0, 505.33, 511.0, 513.67, 489.5, 462.83,
		],
		/**
		 * The band's green edges at each slot but the last, top and bottom, and
		 * whether the bottom is clean (no dot within 6 pt of it).
		 */
		band: [
			[449.33, 484.67, 1],
			[445.0, 482.33, 1],
			[444.0, 481.67, 1],
			[446.0, 482.67, 1],
			[448.33, 476.67, 0],
			[448.0, 476.0, 0],
			[450.67, 484.67, 0],
			[453.0, 486.33, 1],
			[449.33, 480.67, 0],
			[446.67, 483.0, 1],
			[449.33, 484.33, 1],
			[445.0, 482.33, 1],
			[448.33, 484.0, 1],
			[445.67, 482.67, 1],
			[441.33, 479.67, 1],
			[442.0, 480.67, 1],
			[444.0, 481.67, 1],
			[446.0, 482.67, 1],
			[448.33, 482.0, 0],
			[443.67, 481.33, 1],
			[446.33, 476.0, 0],
			[448.67, 484.0, 1],
			[451.0, 485.33, 1],
			[453.67, 486.67, 1],
			[457.33, 488.33, 1],
			[460.67, 490.33, 1],
			[457.0, 485.33, 0],
		],
		/** Chip on: the chronic squares' centres where a whole 7 pt square shows, by slot. */
		chronic: [
			[1, 471.5],
			[2, 470.83],
			[6, 475.17],
			[7, 476.83],
			[8, 474.5],
			[11, 471.5],
			[13, 472.17],
			[14, 468.17],
			[15, 469.5],
			[16, 470.83],
			[18, 473.5],
			[20, 472.5],
			[21, 473.83],
			[22, 475.5],
			[23, 477.17],
			[24, 479.5],
			[25, 481.83],
			[26, 479.5],
			[27, 475.83],
		],
		/** Chip on: the grey acute dots' centres. */
		grey: [
			477.0, 462.67, 461.17, 471.5, 480.67, 480.17, 488.67, 496.83, 484.5, 469.33, 477.33, 460.5, 469.17, 458.33, 437.67, 450.5, 462.5, 474.17, 485.67,
			470.67, 480.17, 490.33, 498.0, 505.33, 511.0, 513.67, 489.5, 462.83,
		],
	},
	ratio: {
		/** 0 at the zero line, 2.3 133.33 pt up. */
		baseline: 524.17,
		height: 133.33,
		/** "2+", "1.5", "0.8", "0": lines and labels together. */
		grid: [390.83, 437.17, 477.83, 524.17],
		dots: [
			471.5, 460.17, 460.0, 466.33, 477.5, 477.67, 483.67, 494.83, 483.17, 466.33, 471.33, 454.67, 465.83, 454.17, 437.33, 448.83, 460.17, 471.83, 483.0,
			466.33, 477.67, 488.83, 495.33, 506.5, 512.33, 512.33, 483.33, 454.33,
		],
	},
	/** Training Readiness' Acute Load sheet, the same 4 weeks in a taller frame: its lines, and its labels' centres by value. */
	readiness: {
		grid: [353.17, 408.83, 464.5, 520.17],
		labels: [
			[1125, 341.33],
			[750, 401.17],
			[375, 460.5],
		],
	},
} as const;
