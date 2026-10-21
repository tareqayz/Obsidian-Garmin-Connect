import type { DetailCandidate } from "../../src/sync/backfill";
import type { DetailProfile } from "../../src/sync/cost";
import { shiftDate } from "../../src/sync/day-index";
import type { AccountScan } from "../../src/sync/scan";

/**
 * Accounts shaped like the measured vault, made up: the same span, the same
 * mix of sports and the same empty days, with nothing of anyone's in them.
 */

/** Weeks start on Sunday, as the scan dates them by their first day. */
function weekOf(date: string): string {
	const day = new Date(`${date}T12:00:00Z`).getUTCDay();
	return shiftDate(date, -day);
}

/** A scan of `first..today`, every day with data but `empty`. */
export function scanOf(first: string, today: string, empty: ReadonlySet<string> = new Set(), activities = 0): AccountScan {
	const weeks = new Map<string, number>();
	let days = 0;
	for (let date = first; date <= today; date = shiftDate(date, 1)) {
		if (empty.has(date)) continue;
		weeks.set(weekOf(date), (weeks.get(weekOf(date)) ?? 0) + 1);
		days += 1;
	}
	return {
		scannedAt: `${today}T06:00:00.000Z`,
		firstDay: first,
		days,
		weeks: [...weeks].sort(([a], [b]) => (a < b ? -1 : 1)),
		activities,
		complete: true,
	};
}

/** `counts` activities of each profile, spread evenly over `first..today`, newest first. */
export function activitiesOf(first: string, today: string, counts: Partial<Record<DetailProfile, number>>): DetailCandidate[] {
	const profiles = Object.entries(counts).flatMap(([profile, n]) => Array.from({ length: n ?? 0 }, () => profile as DetailProfile));
	const span = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
	return profiles
		.map((profile, i) => ({
			id: i + 1,
			date: shiftDate(first, Math.floor((i * span) / profiles.length)),
			run: profile === "run" || profile === "indoorRun",
			profile,
			...(profile === "ride" ? { power: true } : {}),
		}))
		.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
}

/** The measured vault: Aug 2, 2025 to Oct 21, 2026, five days off in January, and 344 activities. */
export const MEASURED = (() => {
	const first = "2025-08-02";
	const today = "2026-10-21";
	const empty = new Set(["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
	const activities = activitiesOf(first, today, { run: 217, indoorRun: 18, ride: 16, gpsOther: 11, pool: 27, gym: 55 });
	return { first, today, scan: scanOf(first, today, empty, activities.length), activities };
})();

/** Ten years every day, and 3,000 activities in the measured vault's mix. */
export const TEN_YEARS = (() => {
	const today = "2026-10-21";
	const first = shiftDate(today, -3649);
	const activities = activitiesOf(first, today, { run: 1_892, indoorRun: 157, ride: 140, gpsOther: 96, pool: 235, gym: 480 });
	return { first, today, scan: scanOf(first, today, new Set(), activities.length), activities };
})();
