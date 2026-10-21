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
 * Requests an hour this device's history download stays under, with the syncs
 * and page loads counted in: under half the ~17,600 an hour measured clean
 * once on one account. Every install looks alike to Garmin, so a quota it
 * counts over hours, or a rule against the pattern, would meet every user at
 * once; the margin is for that.
 */
export const HOURLY_BUDGET = 8_000;

/** How long a 429 that reaches the history download halves the budget for. */
export const HALVING_MS = 24 * 3_600_000;

/**
 * Measured 2026-10-12: a day's requests go out together and the day lands with
 * the slowest, about 0.85 s at Garmin's usual response times.
 */
export const DAY_SECONDS = 0.85;

/** Roughly how long a day takes: the pace caps it, or latency split across the days fetched at once. */
export function secondsPerDay(requestsPerDay: number): number {
	return Math.max(requestsPerDay / PACE.limits.rate, DAY_SECONDS / PACE.parallel);
}
