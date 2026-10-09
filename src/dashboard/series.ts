/**
 * The day row Home reads out of frontmatter, and two small helpers the pages
 * share.
 *
 * Pure: no Obsidian, no DOM, no clock except what is passed in.
 */

import { DAY_MS } from "./day";

/** One synced day, as Home reads it back out of frontmatter. */
export interface DayRow {
	date: string;
	values: Record<string, number>;
	/**
	 * Garmin's qualitative properties — `hrv_status`, `training_status`. Kept
	 * apart from `values` so nothing tries to average them.
	 */
	text?: Record<string, string>;
	/** The day's activities, as `mapWorkout` wrote them. */
	workouts?: Array<Record<string, unknown>>;
	/** The day's Health Snapshots, as `mapSnapshot` wrote them. */
	snapshots?: Array<Record<string, unknown>>;
}

/** `YYYY-MM-DD` moved by whole days, in UTC so a DST change cannot skip or repeat one. */
export function shiftDate(iso: string, days: number): string {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Seconds → "24:31" or "3:12:04": an activity's time, or a personal record's. */
export function duration(seconds: number): string {
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const sec = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
