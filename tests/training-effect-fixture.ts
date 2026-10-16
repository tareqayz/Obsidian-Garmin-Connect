import type { Activity } from "../src/garmin/endpoints";
import { rowOf, sortRows, type ActivityRow } from "../src/sync/activity-index";

/**
 * The Training Effect tests' data: the 31 activities of Aug 17 – Oct 11 as
 * the activity list sent them on 2026-10-12 12:34–12:35
 * (ref/performance-stats/training-effect/api-samples/activities-search-*.json),
 * run through the activity index's own `rowOf`, so the page reads what a sync
 * would have stored. The spec's redacted fixture
 * (`te-fixture-2026-08-17-2026-10-11-redacted.json`) holds the same rows to a
 * tenth. Ids are synthetic and only the two runs the detail shots open carry
 * a name, the shots' "Morning Run". The 7d and 4w windows roll daily, so
 * the golden numbers only reproduce with today pinned to the capture day.
 * Not a test file: the pages tests import it (and the charts tests will).
 */
export const TODAY = "2026-10-11";

/**
 * Local start, GMT start, type key, type id, parent type id, aerobic and
 * anaerobic training effect (Garmin's floats as sent), primary benefit, both
 * message keys, exercise load. Newest first, as the list sends them.
 */
const LISTED = `
2026-10-11T08:21:37 2026-10-11T04:21:37 running 1 17 4.5 0.20000000298023224 LACTATE_THRESHOLD HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 NO_ANAEROBIC_BENEFIT_0 203.8532257080078
2026-10-10T08:19:48 2026-10-10T04:19:48 running 1 17 4.300000190734863 0 LACTATE_THRESHOLD HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 NO_ANAEROBIC_BENEFIT_0 171.5507354736328
2026-10-03T14:59:19 2026-10-03T10:59:19 running 1 17 4.099999904632568 0 LACTATE_THRESHOLD HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 NO_ANAEROBIC_BENEFIT_0 164.75930786132812
2026-09-28T08:03:23 2026-09-28T05:03:23 running 1 17 4.400000095367432 0.20000000298023224 LACTATE_THRESHOLD HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 NO_ANAEROBIC_BENEFIT_0 195.7162322998047
2026-09-27T16:05:42 2026-09-27T13:05:42 running 1 17 3.5999999046325684 0 LACTATE_THRESHOLD IMPROVING_LACTATE_THRESHOLD_12 NO_ANAEROBIC_BENEFIT_0 121.26181030273438
2026-09-25T05:56:48 2026-09-25T02:56:48 running 1 17 4.099999904632568 0 VO2MAX HIGHLY_IMPROVING_VO2_MAX_16 NO_ANAEROBIC_BENEFIT_0 166.1392059326172
2026-09-23T06:55:05 2026-09-23T03:55:05 running 1 17 3.799999952316284 0 LACTATE_THRESHOLD IMPROVING_LACTATE_THRESHOLD_12 NO_ANAEROBIC_BENEFIT_0 141.45799255371094
2026-09-22T14:06:02 2026-09-22T11:06:02 treadmill_running 18 1 3.700000047683716 0 TEMPO IMPACTING_TEMPO_22 NO_ANAEROBIC_BENEFIT_0 134.14447021484375
2026-09-19T11:07:48 2026-09-19T08:07:48 running 1 17 2.799999952316284 0 TEMPO MAINTAINING_TEMPO_21 NO_ANAEROBIC_BENEFIT_0 62.02104187011719
2026-09-16T14:13:23 2026-09-16T11:13:23 running 1 17 3 0 AEROBIC_BASE IMPROVING_AEROBIC_BASE_8 NO_ANAEROBIC_BENEFIT_0 70.51893615722656
2026-09-15T13:51:48 2026-09-15T10:51:48 running 1 17 3.200000047683716 0 AEROBIC_BASE IMPROVING_AEROBIC_BASE_8 NO_ANAEROBIC_BENEFIT_0 88.90252685546875
2026-09-14T23:50:17 2026-09-14T20:50:17 lap_swimming 27 26 2.4000000953674316 1.5 RECOVERY MINOR_AEROBIC_BENEFIT_0 MINOR_FAST_FORCE_BENEFIT_5 62.407440185546875
2026-09-12T21:05:57 2026-09-12T18:05:57 running 1 17 3.0999999046325684 2.299999952316284 TEMPO IMPACTING_TEMPO_22 MAINTAINING_ANAEROBIC_BASE_1 119.70242309570312
2026-09-12T08:32:51 2026-09-12T05:32:51 running 1 17 2.4000000953674316 0.6000000238418579 TEMPO MAINTAINING_TEMPO_21 NO_ANAEROBIC_BENEFIT_0 49.28497314453125
2026-09-12T07:44:29 2026-09-12T04:44:29 running 1 17 3.200000047683716 0 AEROBIC_BASE IMPROVING_AEROBIC_BASE_8 NO_ANAEROBIC_BENEFIT_0 88.9580078125
2026-09-09T18:38:23 2026-09-09T15:38:23 running 1 17 3.299999952316284 0 TEMPO IMPACTING_TEMPO_22 NO_ANAEROBIC_BENEFIT_0 99.04685974121094
2026-09-07T17:34:31 2026-09-07T14:34:31 running 1 17 2.0999999046325684 0 TEMPO MAINTAINING_TEMPO_21 NO_ANAEROBIC_BENEFIT_0 28.08251953125
2026-09-07T17:02:02 2026-09-07T14:02:02 running 1 17 3.0999999046325684 0 TEMPO IMPACTING_TEMPO_22 NO_ANAEROBIC_BENEFIT_0 74.85665893554688
2026-09-05T14:52:35 2026-09-05T11:52:35 running 1 17 3.299999952316284 0.20000000298023224 AEROBIC_BASE IMPROVING_AEROBIC_BASE_8 NO_ANAEROBIC_BENEFIT_0 103.85186767578125
2026-09-04T21:06:19 2026-09-04T18:06:19 treadmill_running 18 1 2.799999952316284 0 AEROBIC_BASE MAINTAINING_AEROBIC_BASE_7 NO_ANAEROBIC_BENEFIT_0 59.50238037109375
2026-09-03T21:11:22 2026-09-03T17:11:22 running 1 17 3.0999999046325684 0 AEROBIC_BASE IMPROVING_AEROBIC_BASE_8 NO_ANAEROBIC_BENEFIT_0 79.2484130859375
2026-08-31T19:02:33 2026-08-31T15:02:33 running 1 17 2.5 0 TEMPO MAINTAINING_TEMPO_21 NO_ANAEROBIC_BENEFIT_0 46.743377685546875
2026-08-31T18:09:21 2026-08-31T14:09:21 running 1 17 3.799999952316284 0 LACTATE_THRESHOLD IMPROVING_LACTATE_THRESHOLD_12 NO_ANAEROBIC_BENEFIT_0 132.38746643066406
2026-08-30T08:53:33 2026-08-30T05:53:33 running 1 17 3.5 2.299999952316284 TEMPO IMPACTING_TEMPO_22 MAINTAINING_ANAEROBIC_BASE_1 148.31649780273438
2026-08-29T15:05:39 2026-08-29T12:05:39 running 1 17 2.299999952316284 0 RECOVERY MINOR_AEROBIC_BENEFIT_0 NO_ANAEROBIC_BENEFIT_0 36.02619934082031
2026-08-28T19:01:25 2026-08-28T16:01:25 stair_climbing 31 29 2.9000000953674316 0.10000000149011612 AEROBIC_BASE MAINTAINING_AEROBIC_FITNESS_1 NO_ANAEROBIC_BENEFIT_0 61.71232604980469
2026-08-24T10:57:21 2026-08-24T07:57:21 running 1 17 3.700000047683716 0 TEMPO IMPACTING_TEMPO_22 NO_ANAEROBIC_BENEFIT_0 124.88330078125
2026-08-23T22:23:06 2026-08-23T19:23:06 treadmill_running 18 1 2.5999999046325684 0 AEROBIC_BASE MAINTAINING_AEROBIC_BASE_7 NO_ANAEROBIC_BENEFIT_0 48.978607177734375
2026-08-23T11:50:31 2026-08-23T08:50:31 running 1 17 2.9000000953674316 0 TEMPO MAINTAINING_TEMPO_21 NO_ANAEROBIC_BENEFIT_0 57.36763000488281
2026-08-23T10:53:10 2026-08-23T07:53:10 running 1 17 3.5 0 LACTATE_THRESHOLD IMPROVING_LACTATE_THRESHOLD_12 NO_ANAEROBIC_BENEFIT_0 98.96066284179688
2026-08-22T12:00:27 2026-08-22T09:00:27 treadmill_running 18 1 3.5 1 AEROBIC_BASE IMPROVING_AEROBIC_ENDURANCE_9 MINOR_ANAEROBIC_BENEFIT_15 110.551025390625
`;

/** The two runs the detail shots open, by local start: their name, as the shots read it. */
const NAMED: Readonly<Record<string, string>> = {
	"2026-10-11T08:21:37": "Morning Run",
	"2026-10-10T08:19:48": "Morning Run",
};

/** A listed activity as the list sends it, under a synthetic id. */
export function listed(line: string, id: number): Activity {
	const [local, gmt, typeKey, typeId, parentTypeId, aerobic, anaerobic, benefit, aerobicMsg, anaerobicMsg, load] = line.trim().split(/\s+/);
	const activity: Activity = {
		activityId: id,
		startTimeLocal: local!.replace("T", " "),
		startTimeGMT: gmt!.replace("T", " "),
		activityType: { typeKey, typeId: Number(typeId), parentTypeId: Number(parentTypeId) },
		aerobicTrainingEffect: Number(aerobic),
		anaerobicTrainingEffect: Number(anaerobic),
		trainingEffectLabel: benefit,
		aerobicTrainingEffectMessage: aerobicMsg,
		anaerobicTrainingEffectMessage: anaerobicMsg,
		activityTrainingLoad: Number(load),
	};
	const name = NAMED[local!];
	if (name) activity.activityName = name;
	return activity;
}

const LINES = LISTED.trim().split("\n");

/** The activity index's rows for them, newest first; ids 1001 (Aug 22) to 1031 (Oct 11), newer higher. */
export const ACTIVITIES: ActivityRow[] = sortRows(LINES.map((line, i) => rowOf(listed(line, 1000 + LINES.length - i))!));

/** A row's id by its local start, to the minute: "2026-10-11T08:21". */
export function idAt(start: string): number {
	const row = ACTIVITIES.find((r) => r.start.startsWith(start));
	if (!row) throw new Error(`no activity at ${start}`);
	return row.id;
}

/**
 * What the phone drew, in points (402 × 874, 3 px a point), from the spec's
 * anatomy and pixel reads: each chart's feet and 25.6 pt a unit (5 is
 * 128 pt), the bars' and dots' centres and heights, and the detail pages'
 * knobs and value labels.
 */
export const PHONE = {
	unit: 25.6,
	feet: { aerobic: 355.0, anaerobic: 542.33 },
	/** The aerobic chart's y labels, 5 down to 0, centred on their values. */
	yLabels: [226.83, 252.5, 278.17, 303.5, 329.17, 354.83],
	"7d": {
		/** A dot a day, Oct 5 – Oct 11. */
		dots: [45.16, 97.5, 149.83, 201.83, 254.17, 306.5, 358.84],
		/** Oct 10 and Oct 11: left, right, height. */
		aerobic: [
			[288.33, 324.67, 110.0],
			[340.33, 377.0, 115.33],
		],
		/** Oct 11's 0.2: its round top takes most of it. */
		anaerobic: [4.67],
		width: [36.33, 36.67],
	},
	"4w": {
		/** The first and last of the 28 dots. */
		dots: [31.5, 372.5],
		/** Day slots with an aerobic bar, Sep 14 the first, and their heights. */
		slots: [0, 1, 2, 5, 8, 9, 11, 13, 14, 19, 26, 27],
		heights: [61.33, 82.0, 76.67, 71.67, 94.67, 97.33, 105.0, 92.0, 112.67, 105.0, 110.0, 115.33],
		/** Sep 14's 1.5, Sep 28's and Oct 11's 0.2. */
		anaerobic: [38.0, 4.67, 4.67],
		width: [8.67, 9.0],
	},
	/** The knobs' centres and the value labels' ink centres, Aerobic then Anaerobic. */
	detail: {
		"2026-10-11": { knobs: [349.0, 30.67], labels: [348.84, 30.66] },
		"2026-10-10": { knobs: [334.33, 16.0], labels: [334.33, 16.0] },
	},
} as const;
