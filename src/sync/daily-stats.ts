import type { DailyFloorStat, DailyIntensityStat, DailyStepStat, DailySummary } from "../garmin/endpoints";

/**
 * The daily stats index: steps, floors and intensity minutes for every day of
 * the account's history, one short row a day, in
 * `<dataFolder>/daily-stats/<year>.json` plus `daily-stats/index.json`.
 *
 * The Steps, Floors and Intensity Minutes pages cannot read these off the day
 * notes. A year of the app's charts needs a year of days, which the notes only
 * have once a sync has reached each one. And a note's distance is the day's
 * total, rides and swims included, where the Steps page counts only what was
 * walked or run. So the index keeps Garmin's own daily figures: filled once from
 * the range endpoints, 28 days a request, then kept current from the daily
 * summaries a routine sync fetches anyway.
 *
 * Pure. The engine hands it payloads; the store reads and writes the files.
 */

export const DAILY_STATS_VERSION = 1;

export interface DailyStatsRow {
	/** The local calendar day, `YYYY-MM-DD`. */
	date: string;
	steps?: number;
	stepGoal?: number;
	/** Metres on foot. */
	distance?: number;
	/** The day's whole burn, kcal. Only the daily summary carries it, so a backfilled day has none. */
	calories?: number;
	/** Whole floors. */
	floorsUp?: number;
	floorsDown?: number;
	floorsGoal?: number;
	moderate?: number;
	vigorous?: number;
	/** The intensity-minutes goal of the week the day falls in. */
	intensityGoal?: number;
}

export interface DailyStatsMeta {
	version: typeof DAILY_STATS_VERSION;
	/** The oldest and newest day fetched, with every day between them fetched too. */
	from?: string;
	to?: string;
	/** Whether fetching further back than `from` found nothing: the index holds the whole history. */
	complete: boolean;
}

/** What one fetch saw: the rows, and every day it asked about, rows or not. */
export interface DailyStatsBatch {
	rows: DailyStatsRow[];
	/** A day asked about with no row had no data; any row the index held for it goes. */
	dates: string[];
}

const NUMERIC = ["steps", "stepGoal", "distance", "calories", "floorsUp", "floorsDown", "floorsGoal", "moderate", "vigorous", "intensityGoal"] as const;
type NumericKey = (typeof NUMERIC)[number];

/**
 * A day from its daily summary, or null on a day the watch recorded nothing.
 * Floors come rounded down: the summary keeps fractions of a floor, the app
 * and the range endpoint whole ones.
 */
export function rowFromSummary(date: string, summary: DailySummary | null | undefined): DailyStatsRow | null {
	if (!summary || summary.includesWellnessData === false) return null;
	const row: DailyStatsRow = { date };
	set(row, "steps", summary.totalSteps);
	set(row, "stepGoal", summary.dailyStepGoal);
	set(row, "distance", summary.wellnessDistanceMeters);
	set(row, "calories", summary.totalKilocalories);
	set(row, "floorsUp", wholeFloors(summary.floorsAscended));
	set(row, "floorsDown", wholeFloors(summary.floorsDescended));
	set(row, "floorsGoal", summary.userFloorsAscendedGoal);
	set(row, "moderate", summary.moderateIntensityMinutes);
	set(row, "vigorous", summary.vigorousIntensityMinutes);
	set(row, "intensityGoal", summary.intensityMinutesGoal);
	return row.steps === undefined && row.floorsUp === undefined && row.moderate === undefined ? null : row;
}

/** The three range responses for one window, folded into a row per day that any of them has. */
export function rowsFromRanges(
	steps: readonly DailyStepStat[],
	floors: readonly DailyFloorStat[],
	intensity: readonly DailyIntensityStat[],
): DailyStatsRow[] {
	const byDate = new Map<string, DailyStatsRow>();
	const rowFor = (date: unknown): DailyStatsRow | null => {
		if (typeof date !== "string" || !DATE.test(date)) return null;
		let row = byDate.get(date);
		if (!row) byDate.set(date, (row = { date }));
		return row;
	};
	for (const day of steps) {
		const row = rowFor(day?.calendarDate);
		if (!row) continue;
		set(row, "steps", day.totalSteps);
		set(row, "stepGoal", day.stepGoal);
		set(row, "distance", day.totalDistance);
	}
	for (const day of floors) {
		const row = rowFor(day?.calendarDate);
		if (!row) continue;
		set(row, "floorsUp", day.values?.wellnessFloorsAscended);
		set(row, "floorsDown", day.values?.wellnessFloorsDescended);
		set(row, "floorsGoal", day.values?.wellnessUserFloorsAscendedGoal);
	}
	for (const day of intensity) {
		const row = rowFor(day?.calendarDate);
		if (!row) continue;
		set(row, "moderate", day.moderateValue);
		set(row, "vigorous", day.vigorousValue);
		set(row, "intensityGoal", day.weeklyGoal);
	}
	return sortDays([...byDate.values()].map(withKeyOrder));
}

/**
 * Folds a batch into the index. Every day the batch asked about is replaced
 * by what it found, or dropped when it found nothing; a field the batch could
 * not see keeps its old value, which is how a backfilled day keeps the
 * calories an earlier routine sync gave it.
 */
export function mergeDays(rows: readonly DailyStatsRow[], batch: DailyStatsBatch): DailyStatsRow[] {
	const asked = new Set(batch.dates);
	const fresh = new Map(batch.rows.map((r) => [r.date, r]));
	const old = new Map(rows.map((r) => [r.date, r]));
	const out = rows.filter((r) => !asked.has(r.date) && !fresh.has(r.date));
	for (const [date, row] of fresh) {
		const before = old.get(date);
		out.push(withKeyOrder(before ? { ...before, ...row } : row));
	}
	return sortDays(out);
}

/** The covered stretch after a fetch of `from..to`: joined on when it touches what was there, otherwise unchanged. */
export function extendCoverage(meta: DailyStatsMeta | null, from: string, to: string): Pick<DailyStatsMeta, "from" | "to"> {
	if (!meta?.from || !meta.to) return { from, to };
	// Touching means no day between them was skipped.
	if (from > nextDay(meta.to) || to < previousDay(meta.from)) return { from: meta.from, to: meta.to };
	return { from: from < meta.from ? from : meta.from, to: to > meta.to ? to : meta.to };
}

/** Rows by the year of their date. */
export function byYear(rows: readonly DailyStatsRow[]): Map<string, DailyStatsRow[]> {
	const years = new Map<string, DailyStatsRow[]>();
	for (const row of rows) {
		const year = row.date.slice(0, 4);
		const list = years.get(year);
		if (list) list.push(row);
		else years.set(year, [row]);
	}
	return years;
}

/** Oldest first. */
export function sortDays(rows: readonly DailyStatsRow[]): DailyStatsRow[] {
	return [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * A year file. One day per line, keys in a fixed order and no timestamp, so
 * the same days always make the same text and an unchanged year is never
 * rewritten — or re-uploaded by a sync service.
 */
export function serializeYear(year: string, rows: readonly DailyStatsRow[]): string {
	const lines = sortDays(rows).map((r) => `\t\t${JSON.stringify(withKeyOrder(r))}`);
	const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
	return `{\n\t"version": ${DAILY_STATS_VERSION},\n\t"year": ${Number(year)},\n\t"days": ${body}\n}\n`;
}

/** The days of a year file. Malformed rows are dropped; a malformed file is empty. */
export function parseYear(text: string): DailyStatsRow[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	const list = (parsed as { days?: unknown } | null)?.days;
	if (!Array.isArray(list)) return [];
	const rows: DailyStatsRow[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const raw = item as Record<string, unknown>;
		if (typeof raw.date !== "string" || !DATE.test(raw.date)) continue;
		const row: DailyStatsRow = { date: raw.date };
		for (const key of NUMERIC) set(row, key, raw[key]);
		rows.push(withKeyOrder(row));
	}
	return rows;
}

export function serializeMeta(meta: DailyStatsMeta): string {
	const out: Record<string, unknown> = { version: DAILY_STATS_VERSION };
	if (meta.from) out.from = meta.from;
	if (meta.to) out.to = meta.to;
	out.complete = meta.complete;
	return `${JSON.stringify(out, null, "\t")}\n`;
}

export function parseMeta(text: string): DailyStatsMeta | null {
	try {
		const raw = JSON.parse(text) as Record<string, unknown> | null;
		if (!raw || typeof raw !== "object" || raw.version !== DAILY_STATS_VERSION) return null;
		const meta: DailyStatsMeta = { version: DAILY_STATS_VERSION, complete: raw.complete === true };
		if (typeof raw.from === "string" && DATE.test(raw.from)) meta.from = raw.from;
		if (typeof raw.to === "string" && DATE.test(raw.to)) meta.to = raw.to;
		return meta;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function set(row: DailyStatsRow, key: NumericKey, value: unknown): void {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) row[key] = Math.round(value);
}

/** A hair over, so 31.9999999 floors still count as 32. */
function wholeFloors(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? Math.floor(value + 1e-6) : undefined;
}

/** The one key order every row is written in. */
function withKeyOrder(row: DailyStatsRow): DailyStatsRow {
	const out: DailyStatsRow = { date: row.date };
	for (const key of NUMERIC) if (row[key] !== undefined) out[key] = row[key];
	return out;
}

function shift(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

const nextDay = (date: string) => shift(date, 1);
const previousDay = (date: string) => shift(date, -1);
