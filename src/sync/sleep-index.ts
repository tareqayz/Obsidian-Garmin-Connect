import type { SleepStatsDay } from "../garmin/endpoints";

/**
 * The sleep index: one short row a night for the account's whole history, in
 * `<dataFolder>/sleep/<year>.json` plus `sleep/index.json`.
 *
 * The Sleep pages' 7d, 4w and 1y views need weeks and years of nights, and
 * Garmin's own daily figures: the daily sleep stats carry respiration to two
 * decimals where a night's sleep payload rounds it, and the app's averages
 * come out of the precise values. So the index is filled from the range
 * endpoint, 28 nights a request, and a routine sync refreshes its window.
 *
 * A night is filed under the day it ended on, as Garmin files it. Bed and
 * wake times are kept as seconds from that day's local midnight, negative
 * before it: that is the scale the app averages on, so a week of 11:45 PM and
 * 12:15 AM bedtimes averages to midnight, and a nap at noon counts as noon.
 *
 * Pure. The engine hands it payloads; the store reads and writes the files.
 */

export const SLEEP_INDEX_VERSION = 1;

export interface SleepRow {
	/** The local calendar day the night ended on, `YYYY-MM-DD`. */
	date: string;
	score?: number;
	/** Garmin's word for the score: EXCELLENT, GOOD, FAIR or POOR. */
	quality?: string;
	/** Asleep, in seconds, and its stages. */
	seconds?: number;
	deep?: number;
	light?: number;
	rem?: number;
	awake?: number;
	/** The night's sleep need, in minutes. */
	need?: number;
	/** Seconds from the day's local midnight. */
	bed?: number;
	wake?: number;
	/** Average overnight heart rate and resting heart rate, bpm. */
	hr?: number;
	rhr?: number;
	/** Body Battery gained overnight. */
	bb?: number;
	/** Breaths a minute, two decimals. */
	resp?: number;
	spo2?: number;
	/** Skin temperature against the baseline, °C and °F. */
	skinC?: number;
	skinF?: number;
	/** Average overnight HRV and its 7-day average, ms, and the HRV status that morning. */
	hrv?: number;
	hrv7d?: number;
	hrvStatus?: string;
	/** ALIGNED, AHEAD or BEHIND, and the optimal sleep window in minutes from midnight. */
	align?: string;
	alignStart?: number;
	alignEnd?: number;
}

export interface SleepIndexMeta {
	version: typeof SLEEP_INDEX_VERSION;
	/** The oldest and newest day fetched, with every day between them fetched too. */
	from?: string;
	to?: string;
	/** Whether fetching further back than `from` found nothing: the index holds the whole history. */
	complete: boolean;
}

/** What one fetch saw: the nights, and every day it asked about, night or not. */
export interface SleepBatch {
	rows: SleepRow[];
	/** A day asked about with no night had none; any row the index held for it goes. */
	dates: string[];
}

const NUMERIC = [
	"score",
	"seconds",
	"deep",
	"light",
	"rem",
	"awake",
	"need",
	"bed",
	"wake",
	"hr",
	"rhr",
	"bb",
	"resp",
	"spo2",
	"skinC",
	"skinF",
	"hrv",
	"hrv7d",
	"alignStart",
	"alignEnd",
] as const;
const TEXT = ["quality", "hrvStatus", "align"] as const;
/** The order every row is written in: the numbers, then the words. */
const KEYS = ["score", "quality", ...NUMERIC.slice(1), ...TEXT.slice(1)] as const;
type NumericKey = (typeof NUMERIC)[number];
type TextKey = (typeof TEXT)[number];

/** These can go below zero: a night that drained Body Battery, a cooler skin, an evening bedtime. */
const SIGNED = new Set<NumericKey>(["bb", "skinC", "skinF", "bed", "wake", "alignStart", "alignEnd"]);

/** A window of the range endpoint, as rows. Nights without a score or a duration are not nights. */
export function rowsFromSleepStats(days: readonly SleepStatsDay[]): SleepRow[] {
	const out: SleepRow[] = [];
	for (const day of days) {
		const date = day?.calendarDate;
		const v = day?.values;
		if (typeof date !== "string" || !DATE.test(date) || !v) continue;
		const row: SleepRow = { date };
		set(row, "score", v.sleepScore);
		setText(row, "quality", v.sleepScoreQuality);
		set(row, "seconds", v.totalSleepTimeInSeconds);
		set(row, "deep", v.deepTime);
		set(row, "light", v.lightTime);
		set(row, "rem", v.remTime);
		set(row, "awake", v.awakeTime);
		set(row, "need", v.sleepNeed);
		set(row, "bed", fromMidnight(date, v.localSleepStartTimeInMillis));
		set(row, "wake", fromMidnight(date, v.localSleepEndTimeInMillis));
		set(row, "hr", v.avgHeartRate);
		set(row, "rhr", v.restingHeartRate);
		set(row, "bb", v.bodyBatteryChange);
		set(row, "resp", v.respiration);
		set(row, "spo2", v.spO2);
		set(row, "skinC", v.skinTempC);
		set(row, "skinF", v.skinTempF);
		set(row, "hrv", v.avgOvernightHrv);
		set(row, "hrv7d", v.hrv7dAverage);
		setText(row, "hrvStatus", v.hrvStatus);
		setText(row, "align", v.sleepAlignmentStatus);
		set(row, "alignStart", v.sleepAlignmentOswStart);
		set(row, "alignEnd", v.sleepAlignmentOswEnd);
		if (row.score === undefined && row.seconds === undefined) continue;
		out.push(withKeyOrder(row));
	}
	return sortNights(out);
}

/**
 * Folds a batch into the index. Every day the batch asked about is replaced
 * by what it found, or dropped when it found nothing: a night the watch later
 * moved or deleted goes with it.
 */
export function mergeNights(rows: readonly SleepRow[], batch: SleepBatch): SleepRow[] {
	const asked = new Set(batch.dates);
	const fresh = new Map(batch.rows.map((r) => [r.date, r]));
	const out = rows.filter((r) => !asked.has(r.date) && !fresh.has(r.date));
	for (const row of fresh.values()) out.push(withKeyOrder(row));
	return sortNights(out);
}

/** Oldest first. */
export function sortNights(rows: readonly SleepRow[]): SleepRow[] {
	return [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Rows by the year of their date. */
export function nightsByYear(rows: readonly SleepRow[]): Map<string, SleepRow[]> {
	const years = new Map<string, SleepRow[]>();
	for (const row of rows) {
		const year = row.date.slice(0, 4);
		const list = years.get(year);
		if (list) list.push(row);
		else years.set(year, [row]);
	}
	return years;
}

/** A year file: one night per line, keys in a fixed order, no timestamp, so unchanged nights make unchanged text. */
export function serializeSleepYear(year: string, rows: readonly SleepRow[]): string {
	const lines = sortNights(rows).map((r) => `\t\t${JSON.stringify(withKeyOrder(r))}`);
	const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
	return `{\n\t"version": ${SLEEP_INDEX_VERSION},\n\t"year": ${Number(year)},\n\t"nights": ${body}\n}\n`;
}

/** The nights of a year file. Malformed rows are dropped; a malformed file is empty. */
export function parseSleepYear(text: string): SleepRow[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}
	const list = (parsed as { nights?: unknown } | null)?.nights;
	if (!Array.isArray(list)) return [];
	const rows: SleepRow[] = [];
	for (const item of list) {
		if (!item || typeof item !== "object") continue;
		const raw = item as Record<string, unknown>;
		if (typeof raw.date !== "string" || !DATE.test(raw.date)) continue;
		const row: SleepRow = { date: raw.date };
		for (const key of NUMERIC) set(row, key, raw[key]);
		for (const key of TEXT) setText(row, key, raw[key]);
		rows.push(withKeyOrder(row));
	}
	return rows;
}

export function serializeSleepMeta(meta: SleepIndexMeta): string {
	const out: Record<string, unknown> = { version: SLEEP_INDEX_VERSION };
	if (meta.from) out.from = meta.from;
	if (meta.to) out.to = meta.to;
	out.complete = meta.complete;
	return `${JSON.stringify(out, null, "\t")}\n`;
}

export function parseSleepMeta(text: string): SleepIndexMeta | null {
	try {
		const raw = JSON.parse(text) as Record<string, unknown> | null;
		if (!raw || typeof raw !== "object" || raw.version !== SLEEP_INDEX_VERSION) return null;
		const meta: SleepIndexMeta = { version: SLEEP_INDEX_VERSION, complete: raw.complete === true };
		if (typeof raw.from === "string" && DATE.test(raw.from)) meta.from = raw.from;
		if (typeof raw.to === "string" && DATE.test(raw.to)) meta.to = raw.to;
		return meta;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------ */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Local wall-clock millis → seconds from the local midnight of `date`. The
 * range endpoint sends local times as epoch millis, so reading them as UTC
 * gives back the clock on the watch.
 */
function fromMidnight(date: string, localMillis: unknown): number | undefined {
	if (typeof localMillis !== "number" || !Number.isFinite(localMillis) || localMillis <= 0) return undefined;
	return Math.round((localMillis - Date.parse(`${date}T00:00:00Z`)) / 1000);
}

function set(row: SleepRow, key: NumericKey, value: unknown): void {
	if (typeof value !== "number" || !Number.isFinite(value)) return;
	if (value < 0 && !SIGNED.has(key)) return;
	row[key] = Math.round(value * 100) / 100;
}

function setText(row: SleepRow, key: TextKey, value: unknown): void {
	if (typeof value === "string" && value.trim()) row[key] = value.trim();
}

function withKeyOrder(row: SleepRow): SleepRow {
	const out: SleepRow = { date: row.date };
	for (const key of KEYS) {
		const value = row[key];
		if (value !== undefined) (out as unknown as Record<string, unknown>)[key] = value;
	}
	return out;
}
