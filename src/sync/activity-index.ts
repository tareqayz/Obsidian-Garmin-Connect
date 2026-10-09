import type { Activity } from "../garmin/endpoints";
import { num } from "./numbers";

/**
 * The activity index: every activity on the account, one short row each, in
 * `<dataFolder>/activities/<year>.json` plus `activities/index.json`.
 *
 * The day notes' `workouts` list cannot feed the Activities pages. It covers
 * only the days a sync has reached, and it rounds for reading: a year of runs
 * summed from rows rounded to 10 m comes to 1,169 km where the app says
 * 1,168.9. So the index keeps Garmin's own numbers, in metres and seconds, and
 * the pages format them.
 *
 * Pure. The engine hands it listings, the store reads and writes the files.
 */

export const INDEX_VERSION = 1;

export interface ActivityRow {
	id: number;
	name?: string;
	/** Garmin's typeKey: `running`, `treadmill_running`, `lap_swimming`… */
	type: string;
	typeId?: number;
	/** The next type up Garmin's tree: running (1) for treadmill_running. */
	parentTypeId?: number;
	/** The local start, `YYYY-MM-DDTHH:mm:ss`: the clock where it happened. */
	start: string;
	/** Epoch ms. Garmin orders the list by it. */
	begin: number;
	/** Metres. */
	distance?: number;
	/** Seconds: Garmin's `duration`, the time the app shows. */
	duration?: number;
	/** Metres climbed. */
	ascent?: number;
	calories?: number;
}

export interface IndexMeta {
	version: typeof INDEX_VERSION;
	/** Whether the index holds the whole history, not only what recent syncs reached. */
	complete: boolean;
	/** The account's units when last synced, so the pages need no day note to format. */
	units?: "metric" | "imperial";
	/** How long the list was when last counted. Sizes the history sync before it runs. */
	total?: number;
}

/**
 * How far inside a listing's oldest row a missing row must be before it counts
 * as deleted. Garmin orders the list by start time; a day's margin covers an
 * activity recorded in another timezone sorting a little out of place.
 */
const DELETE_MARGIN_MS = 86_400_000;

/** One activity from the list, or null when it lacks an id or a start. */
export function rowOf(activity: Activity): ActivityRow | null {
	const id = activity.activityId;
	if (typeof id !== "number" || !Number.isFinite(id)) return null;
	const start = localStart(activity.startTimeLocal);
	if (!start) return null;
	const begin = num(activity.beginTimestamp) ?? epochOfGmt(activity.startTimeGMT) ?? epochOfGmt(start);
	if (begin === undefined) return null;

	const row: ActivityRow = { id, type: activity.activityType?.typeKey || "other", start, begin };
	if (activity.activityName) row.name = activity.activityName;
	const typeId = num(activity.activityType?.typeId);
	if (typeId !== undefined) row.typeId = typeId;
	const parentTypeId = num(activity.activityType?.parentTypeId);
	if (parentTypeId !== undefined) row.parentTypeId = parentTypeId;
	setPositive(row, "distance", activity.distance);
	setPositive(row, "duration", activity.duration);
	setPositive(row, "ascent", activity.elevationGain);
	setPositive(row, "calories", activity.calories);
	return withKeyOrder(row);
}

/**
 * Folds a listing into the index.
 *
 * A listing is what the activity list returned from its first page down: the
 * newest activities, with nothing missing between them. A complete one is the
 * whole history and replaces the index. A partial one updates the rows it
 * covers and drops the ones Garmin no longer lists, but only well inside the
 * window it covered; below that it says nothing.
 */
export function mergeListing(
	rows: readonly ActivityRow[],
	listing: readonly ActivityRow[],
	complete: boolean,
): ActivityRow[] {
	// An empty answer is far likelier a hiccup than every activity deleted.
	if (listing.length === 0) return sortRows(rows);
	if (complete) return sortRows(dedupe(listing));

	const listed = new Map(listing.map((r) => [r.id, r]));
	const oldest = Math.min(...listing.map((r) => r.begin));
	const kept = rows.filter((r) => !listed.has(r.id) && r.begin < oldest + DELETE_MARGIN_MS);
	return sortRows([...kept, ...listed.values()]);
}

/** Rows by the year they started in, local time. */
export function byYear(rows: readonly ActivityRow[]): Map<string, ActivityRow[]> {
	const years = new Map<string, ActivityRow[]>();
	for (const row of rows) {
		const year = row.start.slice(0, 4);
		const list = years.get(year);
		if (list) list.push(row);
		else years.set(year, [row]);
	}
	return years;
}

/** Newest first, then by id, so equal starts still sort the same way every time. */
export function sortRows(rows: readonly ActivityRow[]): ActivityRow[] {
	return [...rows].sort((a, b) => b.begin - a.begin || b.id - a.id);
}

/**
 * A year file. One row per line, keys in a fixed order and no timestamp, so
 * the same rows always produce the same text and an unchanged year is never
 * rewritten (and never re-uploaded by a sync service).
 */
export function serializeYear(year: string, rows: readonly ActivityRow[]): string {
	const lines = sortRows(rows).map((r) => `\t\t${JSON.stringify(withKeyOrder(r))}`);
	const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
	return `{\n\t"version": ${INDEX_VERSION},\n\t"year": ${Number(year)},\n\t"activities": ${body}\n}\n`;
}

/** The rows of a year file. Malformed rows are dropped; a malformed file is empty. */
export function parseYear(text: string): ActivityRow[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	const list = (parsed as { activities?: unknown } | null)?.activities;
	if (!Array.isArray(list)) return [];
	const rows: ActivityRow[] = [];
	for (const item of list) {
		const row = validRow(item);
		if (row) rows.push(row);
	}
	return rows;
}

export function serializeMeta(meta: IndexMeta): string {
	const out: Record<string, unknown> = { version: INDEX_VERSION, complete: meta.complete };
	if (meta.units) out.units = meta.units;
	if (meta.total !== undefined) out.total = meta.total;
	return `${JSON.stringify(out, null, "\t")}\n`;
}

export function parseMeta(text: string): IndexMeta | null {
	try {
		const raw = JSON.parse(text) as Record<string, unknown> | null;
		if (!raw || typeof raw !== "object" || raw.version !== INDEX_VERSION) return null;
		const meta: IndexMeta = { version: INDEX_VERSION, complete: raw.complete === true };
		if (raw.units === "metric" || raw.units === "imperial") meta.units = raw.units;
		const total = num(raw.total);
		if (total !== undefined) meta.total = total;
		return meta;
	} catch {
		return null;
	}
}

/** `2026.json`, and not `2026 2.json`, the copy a sync conflict leaves behind. */
export function isYearFile(name: string): boolean {
	return /^\d{4}\.json$/.test(name);
}

/* ------------------------------------------------------------------ */

const START = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const NUMERIC = ["typeId", "parentTypeId", "distance", "duration", "ascent", "calories"] as const;

function validRow(item: unknown): ActivityRow | null {
	if (!item || typeof item !== "object") return null;
	const raw = item as Record<string, unknown>;
	const id = num(raw.id);
	const begin = num(raw.begin);
	if (id === undefined || begin === undefined) return null;
	if (typeof raw.type !== "string" || !raw.type) return null;
	if (typeof raw.start !== "string" || !START.test(raw.start)) return null;

	const row: ActivityRow = { id, type: raw.type, start: raw.start, begin };
	if (typeof raw.name === "string" && raw.name) row.name = raw.name;
	for (const key of NUMERIC) {
		const value = num(raw[key]);
		if (value !== undefined) row[key] = value;
	}
	return withKeyOrder(row);
}

/** The one key order every row is written in. */
function withKeyOrder(row: ActivityRow): ActivityRow {
	const out: ActivityRow = { id: row.id } as ActivityRow;
	if (row.name !== undefined) out.name = row.name;
	out.type = row.type;
	if (row.typeId !== undefined) out.typeId = row.typeId;
	if (row.parentTypeId !== undefined) out.parentTypeId = row.parentTypeId;
	out.start = row.start;
	out.begin = row.begin;
	if (row.distance !== undefined) out.distance = row.distance;
	if (row.duration !== undefined) out.duration = row.duration;
	if (row.ascent !== undefined) out.ascent = row.ascent;
	if (row.calories !== undefined) out.calories = row.calories;
	return out;
}

/** The last of each id wins: a listing is newest first, and a row only ever gets fresher. */
function dedupe(rows: readonly ActivityRow[]): ActivityRow[] {
	return [...new Map(rows.map((r) => [r.id, r])).values()];
}

/** `2026-10-03 14:59:19` → `2026-10-03T14:59:19`. */
function localStart(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/);
	return match ? `${match[1]}T${match[2]}${match[3] ?? ":00"}` : undefined;
}

function epochOfGmt(value: unknown): number | undefined {
	const start = localStart(value);
	if (!start) return undefined;
	const ms = Date.parse(`${start}Z`);
	return Number.isFinite(ms) ? ms : undefined;
}

/** To the centimetre, the hundredth of a second: past what any page shows, short of float noise. */
function setPositive(row: ActivityRow, key: "distance" | "duration" | "ascent" | "calories", value: unknown): void {
	const n = num(value);
	if (n !== undefined && n > 0) row[key] = Math.round(n * 100) / 100;
}

