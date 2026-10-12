import type { Activity } from "../src/garmin/endpoints";
import { POWER_DURATIONS, rowOf, sortRows, type ActivityRow } from "../src/sync/activity-index";

/**
 * The Cycling Power Curve tests' data: the account's 15 rides with power, as
 * the activity list sent them on 2026-10-12 16:09
 * (ref/performance-stats/cycling-power-curve/api-samples/activities-search-cycling-all.json),
 * run through the activity index's own `rowOf`, so the page reads what a
 * sync would have stored. The spec's redacted fixture
 * (`pc-fixture-rides-redacted.json`) holds the same rows; the GMT start is
 * the list's, which puts the September and early October rides at −07 and
 * the later ones at +04. Ids are synthetic, names and places left out.
 * Everything the page shows rolls with the date, so the golden numbers only
 * reproduce with today pinned to the capture day.
 * Not a test file: the pages tests import it (and the charts tests will).
 */
export const TODAY = "2026-10-11";

/**
 * Local start, GMT start, duration in seconds, then each best average power
 * the list sent as `maxAvgPower_<seconds>`, in W. Oldest first. All road
 * biking (typeId 10 under cycling, 2); none excluded from the power curve.
 */
const LISTED = `
2025-09-01T18:29:40 2025-09-02T01:29:40 2926.15 1:441 2:406 5:355 10:341 20:308 30:276 60:222 120:188 300:180 600:166 1200:148 1800:147
2025-09-06T08:30:57 2025-09-06T15:30:57 3419.61 1:388 2:379 5:356 10:338 20:325 30:307 60:282 120:251 300:235 600:219 1200:188 1800:183 3600:136
2025-09-10T09:15:00 2025-09-10T16:15:00 3565.9 1:620 2:601 5:559 10:436 20:315 30:281 60:268 120:248 300:225 600:193 1200:165 1800:147 3600:89
2025-09-13T07:47:57 2025-09-13T14:47:57 15693.14 1:687 2:592 5:493 10:427 20:320 30:312 60:276 120:245 300:197 600:172 1200:156 1800:154 3600:129 7200:125
2025-09-15T16:39:23 2025-09-15T23:39:23 11983.37 1:628 2:614 5:504 10:396 20:304 30:299 60:278 120:258 300:221 600:202 1200:170 1800:171 3600:161 7200:142
2025-09-27T16:02:32 2025-09-27T23:02:32 11369.39 1:659 2:650 5:610 10:470 20:358 30:344 60:317 120:286 300:225 600:208 1200:180 1800:175 3600:157 7200:146
2025-09-29T19:11:35 2025-09-30T02:11:35 329.74 1:453 2:357 5:244 10:194 20:156 30:148 60:109 120:102 300:61
2025-10-01T06:57:55 2025-10-01T13:57:55 6487.05 1:584 2:568 5:487 10:481 20:387 30:318 60:240 120:217 300:184 600:173 1200:170 1800:168 3600:140
2025-10-04T09:37:53 2025-10-04T16:37:53 1003.59 1:430 2:427 5:351 10:292 20:206 30:179 60:174 120:171 300:134 600:92
2025-10-04T15:18:36 2025-10-04T22:18:36 12688.73 1:645 2:640 5:612 10:540 20:409 30:330 60:254 120:230 300:199 600:180 1200:170 1800:162 3600:145 7200:140
2025-10-13T09:26:10 2025-10-13T05:26:10 3127.27 1:671 2:643 5:626 10:582 20:425 30:351 60:270 120:246 300:228 600:205 1200:196 1800:193
2025-10-13T10:42:08 2025-10-13T06:42:08 1571.54 1:639 2:634 5:582 10:573 20:543 30:498 60:308 120:264 300:177 600:171 1200:146
2025-10-15T09:39:09 2025-10-15T05:39:09 7365.45 1:364 2:352 5:336 10:322 20:250 30:236 60:226 120:212 300:204 600:197 1200:189 1800:171 3600:166 7200:148
2025-10-20T18:13:04 2025-10-20T14:13:04 1398.88 1:386 2:371 5:353 10:309 20:285 30:272 60:263 120:261 300:251 600:240 1200:211
2025-10-25T07:22:19 2025-10-25T03:22:19 10137.97 1:523 2:406 5:395 10:385 20:376 30:350 60:291 120:271 300:217 600:195 1200:187 1800:186 3600:181 7200:167
`;

/** A listed ride as the list sends it, under a synthetic id: every `maxAvgPower_*` it has, the rest as the live rows carry them. */
export function listedRide(line: string, id: number): Activity {
	const [local, gmt, duration, ...bests] = line.trim().split(/\s+/);
	const activity: Activity = {
		activityId: id,
		startTimeLocal: local!.replace("T", " "),
		startTimeGMT: gmt!.replace("T", " "),
		beginTimestamp: Date.parse(`${gmt}Z`),
		duration: Number(duration),
		activityType: { typeKey: "road_biking", typeId: 10, parentTypeId: 2 },
		excludeFromPowerCurveReports: false,
	};
	for (const best of bests) {
		const [seconds, watts] = best.split(":");
		activity[`maxAvgPower_${seconds}`] = Number(watts);
	}
	return activity;
}

const LINES = LISTED.trim().split("\n");

/** The activity index's rows for the 15 rides, newest first: ids 2001 (Sep 1, 2025) to 2015 (Oct 25, 2025), newer higher. */
export const RIDES: ActivityRow[] = sortRows(LINES.map((line, i) => rowOf(listedRide(line, 2001 + i))!));

/** A ride's id by its local start, to the minute: "2025-10-13T09:26". */
export function rideAt(start: string): number {
	const row = RIDES.find((r) => r.start.startsWith(start));
	if (!row) throw new Error(`no ride at ${start}`);
	return row.id;
}

/** The spec's fixture lines: "09-01 18:29 1:441 2:406 …", oldest first. */
export function fixtureLine(row: ActivityRow): string {
	const bests = POWER_DURATIONS.filter((s) => row.power?.[String(s)] !== undefined).map((s) => `${s}:${row.power![String(s)]}`);
	return [row.start.slice(5, 10), row.start.slice(11, 16), ...bests].join(" ");
}
