import type { DayRow } from "./series";

/**
 * Small helpers for reading synced day rows, shared by Home and At a Glance.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings throughout, the same as the day
 * notes they were read from.
 */

export const DAY_MS = 86_400_000;

/** Local midnight of a `YYYY-MM-DD` day, as epoch ms. */
export function dayStart(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(y!, m! - 1, d!).getTime();
}

export function addDays(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const next = new Date(y!, m! - 1, d! + days);
	return isoOf(next);
}

function isoOf(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Garmin's enum spellings → words: `VERY_GOOD` → "Very good". */
export function humanize(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const words = value
		.replace(/_\d+$/, "")
		.toLowerCase()
		.split(/[_\s]+/)
		.filter(Boolean);
	if (!words.length) return undefined;
	const text = words.join(" ");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Every word capitalised, the way Garmin labels a status: "Low Need". */
export function titleCase(value: string | undefined): string | undefined {
	const text = humanize(value);
	return text?.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** `7.5` → "7h 30m". */
export function hoursText(hours: number | undefined): string | undefined {
	if (hours === undefined || !Number.isFinite(hours)) return undefined;
	const total = Math.round(hours * 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Minutes → "1:20:23"-style, the way Garmin totals activity time. */
export function clockText(minutes: number): string {
	const total = Math.round(minutes * 60);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function rowOn(rows: readonly DayRow[], date: string): DayRow | undefined {
	for (let i = rows.length - 1; i >= 0; i--) {
		if (rows[i]!.date === date) return rows[i];
		if (rows[i]!.date < date) break;
	}
	return undefined;
}

export function num(row: DayRow | undefined, key: string): number | undefined {
	const v = row?.values[key];
	return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function str(row: DayRow | undefined, key: string): string | undefined {
	const v = row?.text?.[key];
	return typeof v === "string" && v ? v : undefined;
}

/**
 * The newest row on or before `date` that carries `key`, no more than
 * `maxAgeDays` before it.
 *
 * Several of Garmin's numbers are not daily — VO2 Max moves after a qualifying
 * run, a weigh-in is whenever you step on the scale — and the app shows the
 * latest one it has, with its date, rather than a blank. How far back it will
 * look differs by stat, hence the limit.
 */
export function latestWith(rows: readonly DayRow[], date: string, key: string, maxAgeDays = Infinity): DayRow | undefined {
	const oldest = Number.isFinite(maxAgeDays) ? addDays(date, -maxAgeDays) : "";
	for (let i = rows.length - 1; i >= 0; i--) {
		const r = rows[i]!;
		if (r.date > date) continue;
		if (r.date < oldest) break;
		if (num(r, key) !== undefined || str(r, key) !== undefined) return r;
	}
	return undefined;
}

export function lastDays(rows: readonly DayRow[], date: string, days: number): Array<{ date: string; row?: DayRow }> {
	const out: Array<{ date: string; row?: DayRow }> = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = addDays(date, -i);
		out.push({ date: d, row: rowOn(rows, d) });
	}
	return out;
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

export function weekdayLetter(date: string): string {
	return WEEKDAY[new Date(dayStart(date)).getDay()]!;
}

/** Distance in the unit the note was written in. */
export function distanceOf(row: DayRow | undefined): { value: number; unit: "km" | "mi" } | undefined {
	const km = num(row, "distance_km");
	if (km !== undefined) return { value: km, unit: "km" };
	const mi = num(row, "distance_mi");
	if (mi !== undefined) return { value: mi, unit: "mi" };
	return undefined;
}

/**
 * Which unit system the vault was synced in, read off the notes themselves.
 *
 * The setting can say `auto`, which is only resolved at sync time, so the
 * newest note that carries a distance is the reliable answer.
 */
export function unitsOf(rows: readonly DayRow[]): "metric" | "imperial" {
	for (let i = rows.length - 1; i >= 0; i--) {
		const d = distanceOf(rows[i]);
		if (d) return d.unit === "mi" ? "imperial" : "metric";
	}
	return "metric";
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 23". */
export function shortDate(date: string): string {
	return `${MONTH[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** "Sep 23", or "Nov 2, 2025" once it is from another year — how the app dates a reading. */
export function readingDate(date: string, today: string): string {
	return date.slice(0, 4) === today.slice(0, 4) ? shortDate(date) : `${shortDate(date)}, ${date.slice(0, 4)}`;
}
