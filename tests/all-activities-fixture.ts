import type { ActivityRow } from "../src/sync/activity-index";

/**
 * Made-up activity index rows for All Activities' tests: no real names or
 * places. The figures on the hand-made rows are the spec's card goldens
 * (ref/activities/all-activities/README.md, "The cards on screen"), so each
 * rounding and truncation rule is checked on the number that showed it.
 */

export const TODAY = "2026-10-15";

/** A row starting at a local time `offset` hours ahead of GMT. */
function row(id: number, start: string, offset: number, type: string, typeId: number, parentTypeId: number, over: Partial<ActivityRow> = {}): ActivityRow {
	return { id, type, typeId, parentTypeId, start, begin: Date.parse(`${start}Z`) - offset * 3_600_000, ...over };
}

/** 22 rows, newest first by local start, covering every rule. */
export const ROWS: readonly ActivityRow[] = [
	row(101, "2026-10-13T11:57:21", 4, "road_biking", 10, 2, { name: "Harbour Road Cycling", distance: 27512.88, duration: 3441.27, ascent: 196 }),
	row(102, "2026-10-11T08:21:37", 4, "running", 1, 17, { name: "Harbour Running", distance: 12469.47, duration: 4096.6, ascent: 52, pr: true }),
	row(103, "2026-10-10T08:19:48", 4, "running", 1, 17, { name: "Harbour Running", distance: 10009, duration: 3360.82, ascent: 41 }),
	row(104, "2026-09-22T14:06:00", 4, "treadmill_running", 18, 1, { name: "Treadmill Running", distance: 5440, duration: 1566 }),
	row(105, "2026-09-14T23:50:17", 4, "lap_swimming", 27, 26, { name: "Pool Swim", distance: 1100, duration: 1900.42, pool: "m" }),
	// A pool swim not named so: a search for "pool" doesn't find it, as Garmin's doesn't. 1,100 yd.
	row(106, "2026-09-02T07:15:00", 4, "lap_swimming", 27, 26, { name: "Long Set", distance: 1005.84, duration: 1500, pool: "yd" }),
	row(107, "2026-08-28T19:01:25", 4, "stair_climbing", 31, 29, { name: "Stair Stepper", duration: 2092.296 }),
	row(108, "2026-08-08T16:27:00", 4, "strength_training", 13, 29, { name: "Strength", duration: 1768.828 }),
	row(109, "2026-07-02T16:25:00", 4, "yoga", 163, 29, { name: "Yoga", duration: 681.92 }),
	row(110, "2026-07-01T17:34:00", 4, "yoga", 163, 29, { name: "Yoga", duration: 300.873 }),
	// A type Garmin added after the table, filed under Cycling by its parent.
	row(119, "2026-06-06T10:00:00", 4, "zorbing", 990, 2, { name: "Zorb Session", distance: 3000, duration: 900 }),
	row(118, "2026-05-05T06:00:00", 4, "running", 1, 17, { name: "Café Run", distance: 5000, duration: 1800, event: "training" }),
	row(120, "2026-04-04T19:00:00", 4, "casual_walking", 15, 9, { name: "Evening Walk", distance: 3200, duration: 2400, event: "transportation" }),
	// No name: the card, search and the name sorts read its sport's, "Meditation".
	row(117, "2026-03-15T21:00:00", 4, "meditation", 202, 4, { duration: 600 }),
	// Steps: a type the sheet hides, which "All Other" still selects.
	row(122, "2026-02-03T12:00:00", 4, "steps", 108, 17, { name: "Steps", distance: 4000 }),
	// Neither a distance nor a time.
	row(121, "2026-02-02T20:00:00", 4, "breathwork", 164, 4, { name: "Breathwork" }),
	// The same morning in two time zones: 06:59 (+04) is 02:59 GMT, 06:13 (+03) is 03:13 GMT.
	row(111, "2026-01-28T06:59:00", 4, "strength_training", 13, 29, { name: "Strength", duration: 4096.6 }),
	row(112, "2026-01-28T06:13:00", 3, "running", 1, 17, { name: "Northport Running", distance: 7000, duration: 2400, ascent: 30 }),
	row(114, "2025-10-25T06:36:00", 4, "multi_sport", 89, 17, { name: "Coastal Multisport", distance: 112850, duration: 14000, ascent: 900, event: "race" }),
	row(113, "2025-10-24T09:30:20", 4, "open_water_swimming", 28, 26, { name: "Open Water Swimming", distance: 519.39, duration: 697.68 }),
	row(115, "2025-08-20T07:21:00", -6, "hiking", 3, 17, { name: "Lakeside Hiking", distance: 8220, duration: 9000, ascent: 640, favorite: true }),
	row(116, "2025-08-20T02:42:00", -6, "hiking", 3, 17, { name: "Lakeside Hiking", distance: 9050, duration: 10000, ascent: 700 }),
];

/**
 * The capture day's account by type, as Garmin's web list counted it on
 * 2026-10-15: 341 activities, the multisport's legs left out as the list (and
 * so the index) leaves them. The names are made up but keep the counts the
 * spec's searches found: 36 named after one place ("Harbour" here), 25 of the
 * 26 pool swims named "Pool Swim", and 229 named "… Running", four runs being
 * named for their workout instead.
 */
const CENSUS: ReadonlyArray<[type: string, typeId: number, parentTypeId: number, names: ReadonlyArray<[name: string, count: number]>]> = [
	["running", 1, 17, [["Harbour Running", 31], ["Lakeside Running", 178], ["Base", 1], ["Recovery", 1], ["Anaerobic", 1], ["Sprint", 1]]],
	["treadmill_running", 18, 1, [["Treadmill Running", 18]]],
	["track_running", 8, 1, [["Track Running", 1]]],
	["trail_running", 6, 1, [["Trail Running", 1]]],
	["road_biking", 10, 2, [["Harbour Road Cycling", 5], ["Lakeside Road Cycling", 11]]],
	["lap_swimming", 27, 26, [["Pool Swim", 25], ["Long Set", 1]]],
	["open_water_swimming", 28, 26, [["Open Water Swimming", 2]]],
	["stair_climbing", 31, 29, [["Stair Stepper", 13]]],
	["strength_training", 13, 29, [["Strength", 15]]],
	["yoga", 163, 29, [["Yoga", 24]]],
	["mobility", 255, 29, [["Mobility", 2]]],
	["meditation", 202, 4, [["Meditation", 1]]],
	["hiking", 3, 17, [["Lakeside Hiking", 8]]],
	["multi_sport", 89, 17, [["Multisport", 1]]],
];

/** The census as rows, one every 20 hours back from the day before the capture. */
export const CENSUS_ROWS: readonly ActivityRow[] = (() => {
	const rows: ActivityRow[] = [];
	const first = Date.parse("2026-10-14T07:00:00Z");
	for (const [type, typeId, parentTypeId, names] of CENSUS) {
		for (const [name, count] of names) {
			for (let i = 0; i < count; i++) {
				const local = first - rows.length * 20 * 3_600_000;
				const start = new Date(local).toISOString().slice(0, 19);
				rows.push(row(1000 + rows.length, start, 4, type, typeId, parentTypeId, { name, duration: 1800 }));
			}
		}
	}
	return rows;
})();
