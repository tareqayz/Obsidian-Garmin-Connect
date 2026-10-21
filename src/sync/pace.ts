import type { ThrottleLimits } from "../garmin/throttle";

/**
 * How hard the plugin leans on Garmin. Not a setting: Garmin publishes no
 * limit, so one was measured instead (`npm run api:ramp`, see
 * `docs/garmin-api.md`, Request pace), and the plugin keeps well under it.
 *
 * `limits` paces every request the client makes; `parallel` is how many days
 * a sync fetches at once and how many history walks run side by side, which is
 * what lets a sync use the pace — a day's requests already go out together,
 * and a day takes as long as its slowest.
 */
export interface Pace {
	limits: ThrottleLimits;
	parallel: number;
}

// About 40% of the fastest pace measured clean (47 requests/s for a minute,
// 2026-10-12). What a short test cannot see — a quota over hours, or an
// account flagged for the pattern — is why the margin is wide.
export const PACE: Pace = { limits: { rate: 20, burst: 27, concurrency: 27 }, parallel: 3 };

/**
 * How long Garmin takes to answer, in seconds, measured 2026-10-12 against the
 * routes a download asks (`docs/garmin-api.md`, Request pace): what a time
 * estimate adds to the pace. A running download measures its own.
 */
export interface Latency {
	/** A request on its own: a history window or a list page, its merge included. */
	window: number;
	/** Requests sent together, which land with the slowest: a day's, an activity's. */
	batch: number;
	/** A unit's own file work around its requests. */
	overhead: number;
}

export const LATENCY: Latency = { window: 0.6, batch: 0.85, overhead: 0.3 };

/** Roughly how long a day takes: the pace caps it, or latency split across the days fetched at once. */
export function secondsPerDay(requestsPerDay: number, latency: Latency = LATENCY): number {
	return Math.max(requestsPerDay / PACE.limits.rate, latency.batch / PACE.parallel);
}

/**
 * A date range asking more than this goes to the history download, which runs
 * in the background and picks up where it left off; one asking less syncs at
 * once.
 */
export const FOREGROUND_RANGE_REQUESTS = 1_000;
