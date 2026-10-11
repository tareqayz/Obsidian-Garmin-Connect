import type { DayRow } from "../dashboard/series";
import type { Properties } from "./metrics";

/**
 * The day file: every property the sync maps for a day, in
 * `<dataFolder>/days/<year>.json`, keyed by date.
 *
 * This is where a day's summary lives — steps, sleep, HRV, the day's workouts.
 * It used to be one markdown note per day with the values as frontmatter; JSON
 * keeps the data out of the vault's notes and reads back without the metadata
 * cache.
 *
 * Pure. The store reads and writes the files.
 */

export const DAYS_VERSION = 1;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A year file's days, by date. */
export type DayProperties = Map<string, Properties>;

/**
 * A day's properties over what the file already held. Merged rather than
 * replaced, as frontmatter was: a group switched off since does not wipe the
 * values it wrote.
 */
export function mergeDay(days: DayProperties, date: string, properties: Properties): DayProperties {
	const next = new Map(days);
	next.set(date, { ...(days.get(date) ?? {}), ...properties });
	return next;
}

/**
 * A year file. One day per line, dates in order and no timestamp, so the same
 * days always make the same text and an unchanged year is never rewritten.
 */
export function serializeDays(year: string, days: DayProperties): string {
	const dates = [...days.keys()].filter((d) => d.startsWith(`${year}-`)).sort();
	const lines = dates.map((d) => `\t\t${JSON.stringify(d)}: ${JSON.stringify(days.get(d))}`);
	const body = lines.length ? `{\n${lines.join(",\n")}\n\t}` : "{}";
	return `{\n\t"version": ${DAYS_VERSION},\n\t"year": ${Number(year)},\n\t"days": ${body}\n}\n`;
}

/** The days of a year file. Malformed days are dropped; a malformed file is empty. */
export function parseDays(text: string): DayProperties {
	const out: DayProperties = new Map();
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return out;
	}
	const days = (parsed as { days?: unknown } | null)?.days;
	if (!days || typeof days !== "object" || Array.isArray(days)) return out;
	for (const [date, value] of Object.entries(days)) {
		if (!DATE.test(date) || !value || typeof value !== "object" || Array.isArray(value)) continue;
		out.set(date, value as Properties);
	}
	return out;
}

/** `2026.json`, not `index.json` or anything else a folder may hold. */
export function isDaysFile(name: string): boolean {
	return /^\d{4}\.json$/.test(name);
}

/**
 * A day as Home reads it: numbers apart from Garmin's qualitative strings —
 * "BALANCED", "PRODUCTIVE_1" — so nothing tries to average them, and the day's
 * activities and Health Snapshots as lists.
 */
export function dayRowOf(date: string, properties: Record<string, unknown>): DayRow {
	const values: Record<string, number> = {};
	const text: Record<string, string> = {};
	let workouts: Array<Record<string, unknown>> | undefined;
	let snapshots: Array<Record<string, unknown>> | undefined;

	for (const [name, value] of Object.entries(properties)) {
		if (name === "date") continue;
		if (typeof value === "number" && Number.isFinite(value)) values[name] = value;
		else if (typeof value === "string" && value) text[name] = value;
		else if (name === "workouts" && Array.isArray(value)) workouts = objects(value);
		else if (name === "health_snapshots" && Array.isArray(value)) snapshots = objects(value);
	}

	return {
		date,
		values,
		text,
		...(workouts?.length ? { workouts } : {}),
		...(snapshots?.length ? { snapshots } : {}),
	};
}

function objects(list: unknown[]): Array<Record<string, unknown>> {
	return list.filter(
		(row): row is Record<string, unknown> =>
			Boolean(row) && typeof row === "object" && !Array.isArray(row),
	);
}
