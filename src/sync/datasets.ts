import { ACTIVITY_DETAIL_VERSION } from "./activity-detail";

/**
 * The data sets a backfill fills, and the version of what each stores.
 *
 * Bump a set's version whenever a release stores something new for days it
 * already holds: the days held at an older version are then what the next
 * backfill offers to fetch again.
 */

/** The day files plus each day's full timelines. */
export const DAY_DETAILS_VERSION = 1;

/** A downloaded run's file: `ACTIVITY_DETAIL_VERSION`, which `activity-detail.ts` owns. */
export const RUN_DETAILS_VERSION = ACTIVITY_DETAIL_VERSION;
