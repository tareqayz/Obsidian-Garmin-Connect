import type { ThrottleLimits } from "../garmin/throttle";

/**
 * How hard a sync leans on Garmin. A choice of three rather than numbers: the
 * numbers only mean something next to a limit Garmin does not publish, which
 * `npm run api:ramp` measured instead (see `docs/garmin-api.md`).
 *
 * `limits` paces every request the client makes; `parallelDays` is how many
 * days a sync fetches at once, which is what lets it use the pace — a day's
 * requests already go out together, and a day takes as long as its slowest.
 */
export type SyncSpeed = "gentle" | "normal" | "fast";

export interface SpeedPreset {
	limits: ThrottleLimits;
	parallelDays: number;
}

export const SYNC_SPEEDS: Record<SyncSpeed, SpeedPreset> = {
	// Below the old 250 ms pause between days, which measured ~10 requests/s.
	gentle: { limits: { rate: 8, burst: 9, concurrency: 9 }, parallelDays: 1 },
	// About 40% of the fastest pace measured clean (47 requests/s for a minute,
	// 2026-10-12). What a short test cannot see — a quota over hours, or an
	// account flagged for the pattern — is why the margin is wide.
	normal: { limits: { rate: 20, burst: 27, concurrency: 27 }, parallelDays: 3 },
	// About two thirds of it.
	fast: { limits: { rate: 32, burst: 45, concurrency: 45 }, parallelDays: 5 },
};

export const SPEED_LABELS: Record<SyncSpeed, string> = {
	gentle: "Gentle",
	normal: "Normal",
	fast: "Fast",
};

export function isSyncSpeed(value: unknown): value is SyncSpeed {
	return value === "gentle" || value === "normal" || value === "fast";
}

/** The speed that stands in for a `pauseBetweenDays` saved by an older build. */
export function speedFromPause(pauseMs: unknown): SyncSpeed {
	if (typeof pauseMs !== "number") return "normal";
	if (pauseMs <= 0) return "fast";
	if (pauseMs >= 1000) return "gentle";
	return "normal";
}

/**
 * Measured 2026-10-12: a day's requests go out together and the day lands with
 * the slowest, about 0.85 s at Garmin's usual response times.
 */
export const DAY_SECONDS = 0.85;

/** Roughly how long a day takes at `preset`: the pace caps it, or latency split across the days fetched at once. */
export function secondsPerDay(requestsPerDay: number, preset: SpeedPreset): number {
	return Math.max(requestsPerDay / preset.limits.rate, DAY_SECONDS / preset.parallelDays);
}
