/**
 * How the contract check fetches each endpoint it covers.
 *
 * Every probe goes through the plugin's own `GarminApi`, so this exercises the
 * paths, headers and query parameters the plugin actually sends. A check that
 * built its own requests could pass while the plugin was broken.
 */

import type { GarminApi } from "../../src/garmin/endpoints";
import type { CatalogueEntry } from "./catalogue";

export interface Window {
	/** Recent complete days, newest first. */
	days: string[];
	rangeStart: string;
	rangeEnd: string;
}

/** The plugin pauses between days for the same reason: 429s are account-wide. */
export const PAUSE_MS = 250;

export const sleep = (ms: number): Promise<void> =>
	new Promise((done) => setTimeout(done, ms));

/**
 * UTC, deliberately. A runner's clock is UTC, and guessing the account's
 * timezone would sometimes ask for a day that has not finished. The cost is
 * that the newest sampled day can trail the account's own "yesterday", which is
 * why the window is several days wide rather than one.
 */
export function isoDay(offsetDays: number, now = new Date()): string {
	const day = new Date(now.getTime() - offsetDays * 86_400_000);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
}

export function buildWindow(days: number, rangeDays: number, now = new Date()): Window {
	return {
		days: Array.from({ length: days }, (_, i) => isoDay(i + 1, now)),
		rangeStart: isoDay(rangeDays, now),
		rangeEnd: isoDay(1, now),
	};
}

/** One day at a time, with a pause between, rather than a burst of parallel calls. */
async function perDay(w: Window, fetch: (date: string) => Promise<unknown>): Promise<unknown[]> {
	const out: unknown[] = [];
	for (const day of w.days) {
		out.push(await fetch(day));
		await sleep(PAUSE_MS);
	}
	return out;
}

/**
 * Keyed by catalogue id. Intraday endpoints take one day rather than the whole
 * window: their payloads run to thousands of points and a second day adds
 * nothing the first did not already show.
 */
export const PROBES: Record<string, (api: GarminApi, w: Window) => Promise<unknown[]>> = {
	"social-profile": async (api) => [await api.socialProfile()],
	"user-profile": async (api) => [await api.userSettings()],
	"user-summary": (api, w) => perDay(w, (d) => api.dailySummary(d)),
	"sleep-data": (api, w) => perDay(w, (d) => api.sleep(d)),
	"hrv-data": (api, w) => perDay(w, (d) => api.hrv(d)),
	"training-readiness": (api, w) => perDay(w, (d) => api.trainingReadiness(d)),
	"endurance-score": (api, w) => perDay(w, (d) => api.enduranceScore(d)),
	"training-status": (api, w) => perDay(w, (d) => api.trainingStatus(d)),
	"daily-weigh-ins": (api, w) => perDay(w, (d) => api.bodyComposition(d)),
	"heart-rates": async (api, w) => [await api.heartRate(w.days[0]!)],
	"all-day-stress": async (api, w) => [await api.stress(w.days[0]!)],
	"rhr-day": async (api, w) => [await api.restingHeartRate(w.days[0]!)],
	"max-metrics-range": async (api, w) => [await api.maxMetrics(w.rangeStart, w.rangeEnd)],
	"race-predictions": async (api, w) => [await api.racePredictions(w.rangeStart, w.rangeEnd)],
	"body-battery": async (api, w) => [await api.bodyBattery(w.rangeStart, w.rangeEnd)],
	"get-activities": async (api) => [await api.activities(0, 20)],
};

/**
 * The catalogue says *what* is checked and this file says *how*. Neither is
 * much use if they disagree, and the failure mode is silent — an endpoint
 * marked `check: true` with no probe is simply never fetched.
 */
export function assertProbesMatchCatalogue(checked: readonly CatalogueEntry[]): void {
	const wanted = new Set(checked.map((entry) => entry.id));
	const have = new Set(Object.keys(PROBES));
	const missing = [...wanted].filter((id) => !have.has(id)).sort();
	const extra = [...have].filter((id) => !wanted.has(id)).sort();
	if (!missing.length && !extra.length) return;
	throw new Error(
		[
			"api/endpoints.json and scripts/api/probes.ts disagree about what is checked.",
			...missing.map((id) => `  "check": true with no probe: ${id}`),
			...extra.map((id) => `  probe with no "check": true: ${id}`),
		].join("\n"),
	);
}
