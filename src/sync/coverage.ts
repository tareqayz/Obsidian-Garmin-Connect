import { shiftDate } from "./day-index";
import type { DaySeries } from "./intraday";

/**
 * What the vault holds of the data sets a backfill fills, and at which
 * version of each (see `datasets.ts`): the days whose details were fetched
 * whole, and the runs whose page was downloaded.
 *
 * The chart indexes keep their own coverage in each index's `index.json`.
 * These two live beside their files: `days/index.json` and
 * `activity-details/index.json`.
 *
 * A file another device overwrote can only have lost entries — a day or a
 * run looked at again — never claim one it did not fetch.
 *
 * Pure. The store reads and writes the files.
 */

/** Version of the coverage files' own shape. */
export const COVERAGE_FILE_VERSION = 1;

/** `[from, to, version]`: consecutive days, inclusive, all fetched at that version of the data set. */
export type Span = readonly [from: string, to: string, version: number];

/** A stretch of days, inclusive. */
export interface DateRange {
	from: string;
	to: string;
}

/**
 * The spans with `dates` recorded at `version`, merged: a date already held
 * takes the new version, and touching spans of one version join.
 */
export function addDays(spans: readonly Span[], dates: readonly string[], version: number): Span[] {
	if (!dates.length) return [...spans];
	const byDate = new Map<string, number>();
	for (const [from, to, v] of spans) for (const date of daysOf(from, to)) byDate.set(date, v);
	for (const date of dates) byDate.set(date, version);
	return spansOf(byDate);
}

/** The spans without the dates `drop` picks: days to fetch again. */
export function dropDays(spans: readonly Span[], drop: (date: string) => boolean): Span[] {
	const byDate = new Map<string, number>();
	for (const [from, to, v] of spans) for (const date of daysOf(from, to)) if (!drop(date)) byDate.set(date, v);
	return spansOf(byDate);
}

/** The version a date was fetched at, or undefined when it wasn't. */
export function versionOn(spans: readonly Span[], date: string): number | undefined {
	for (const [from, to, v] of spans) if (date >= from && date <= to) return v;
	return undefined;
}

/** The stretches of `range` no span covers, oldest first. */
export function gaps(spans: readonly Span[], range: DateRange): DateRange[] {
	return stretches(range, (date) => versionOn(spans, date) === undefined);
}

/** The stretches of `range` fetched at a version older than `version`, oldest first. */
export function stale(spans: readonly Span[], range: DateRange, version: number): DateRange[] {
	return stretches(range, (date) => {
		const held = versionOn(spans, date);
		return held !== undefined && held < version;
	});
}

/** How many days the stretches hold. */
export function daysIn(ranges: readonly DateRange[]): number {
	return ranges.reduce((sum, r) => sum + daysOf(r.from, r.to).length, 0);
}

/* ------------------------------------------------------------------ */
/*  Day details: days/index.json                                       */
/* ------------------------------------------------------------------ */

export interface DayCoverage {
	spans: Span[];
}

export function serializeDayCoverage(coverage: DayCoverage): string {
	const lines = coverage.spans.map((span) => `\t\t${JSON.stringify(span)}`);
	const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
	return `{\n\t"version": ${COVERAGE_FILE_VERSION},\n\t"spans": ${body}\n}\n`;
}

/** Null when the file isn't one: it is then built again from the files it describes. */
export function parseDayCoverage(text: string): DayCoverage | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	const raw = parsed as { version?: unknown; spans?: unknown } | null;
	if (!raw || raw.version !== COVERAGE_FILE_VERSION || !Array.isArray(raw.spans)) return null;
	const byDate = new Map<string, number>();
	for (const span of raw.spans) {
		if (!Array.isArray(span) || span.length !== 3) continue;
		const [from, to, v] = span as unknown[];
		if (!isDate(from) || !isDate(to) || from > to || !Number.isInteger(v)) continue;
		for (const date of daysOf(from, to)) byDate.set(date, v as number);
	}
	return { spans: spansOf(byDate) };
}

/**
 * The version a series file's timelines were fetched at, for the one-time
 * build of `days/index.json` from the files a vault already holds:
 *
 * - 1, today's: the intraday blocks with the day's start (written since the
 *   floors and intensity charts, 2026-10-05), and the night's detail beside
 *   its hypnogram (since 2026-10-07).
 * - 0: intraday blocks from before that.
 * - Undefined: no intraday at all — only the night, which every synced day
 *   gets. The day's details were never fetched.
 *
 * Floors and intensity minutes are no test: a day without any leaves its
 * block out.
 */
export function seriesVersion(series: DaySeries | null | undefined): number | undefined {
	if (!series || (!series.heartRate && !series.stress && !series.steps)) return undefined;
	const current = series.dayStart !== undefined && (!series.sleepLevels || series.sleep !== undefined);
	return current ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/*  Activity details: activity-details/index.json                      */
/* ------------------------------------------------------------------ */

/** Each downloaded activity's file version, by activity id. */
export type DetailCoverage = Map<number, number>;

export function serializeDetailCoverage(files: DetailCoverage): string {
	const ids = [...files.keys()].sort((a, b) => a - b);
	const lines = ids.map((id) => `\t\t"${id}": ${files.get(id)}`);
	const body = lines.length ? `{\n${lines.join(",\n")}\n\t}` : "{}";
	return `{\n\t"version": ${COVERAGE_FILE_VERSION},\n\t"activities": ${body}\n}\n`;
}

/** The coverage, under `activities`, or `runs` as it was called when only runs had a page. */
export function parseDetailCoverage(text: string): DetailCoverage | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return null;
	}
	const raw = parsed as { version?: unknown; activities?: unknown; runs?: unknown } | null;
	const files = raw?.activities ?? raw?.runs;
	if (!raw || raw.version !== COVERAGE_FILE_VERSION || !files || typeof files !== "object" || Array.isArray(files)) return null;
	const out: DetailCoverage = new Map();
	for (const [id, v] of Object.entries(files)) {
		if (/^\d+$/.test(id) && Number.isInteger(v)) out.set(Number(id), v as number);
	}
	return out;
}

/** An activity file's version from the start of its text, without parsing the rest (`{"version":5,…`). */
export function detailVersionOf(text: string): number | undefined {
	const match = /^\s*\{\s*"version"\s*:\s*(\d+)/.exec(text.slice(0, 64));
	return match ? Number(match[1]) : undefined;
}

/* ------------------------------------------------------------------ */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: unknown): value is string {
	return typeof value === "string" && DATE.test(value);
}

/** Every date from `from` to `to`, oldest first. */
function daysOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let date = from; date <= to; date = shiftDate(date, 1)) out.push(date);
	return out;
}

/** Consecutive dates of one version as spans, oldest first. */
function spansOf(byDate: ReadonlyMap<string, number>): Span[] {
	const spans: Array<[string, string, number]> = [];
	for (const date of [...byDate.keys()].sort()) {
		const v = byDate.get(date)!;
		const last = spans[spans.length - 1];
		if (last && last[2] === v && shiftDate(last[1], 1) === date) last[1] = date;
		else spans.push([date, date, v]);
	}
	return spans;
}

/** The runs of days in `range` for which `test` holds, oldest first. */
function stretches(range: DateRange, test: (date: string) => boolean): DateRange[] {
	const out: DateRange[] = [];
	if (!isDate(range.from) || !isDate(range.to) || range.from > range.to) return out;
	for (const date of daysOf(range.from, range.to)) {
		if (!test(date)) continue;
		const last = out[out.length - 1];
		if (last && shiftDate(last.to, 1) === date) last.to = date;
		else out.push({ from: date, to: date });
	}
	return out;
}
