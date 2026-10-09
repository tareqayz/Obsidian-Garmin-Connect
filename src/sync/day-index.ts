import type { DailySummary, GarminApi } from "../garmin/endpoints";
import type { MetricGroup } from "./metrics";

/**
 * Day indexes: one short row a day for a stat's whole history, a file per
 * year in `<dataFolder>/<folder>/<year>.json` plus `<folder>/index.json`. The
 * shape the sleep index has (`sleep-index.ts`), generalised, so a Health Stats
 * page adds its index by describing it instead of copying the code that keeps
 * one.
 *
 * `defineDayIndex` takes what is particular to a stat — its columns, its merge
 * policy, its window fetch, how far back to look — and hands back the
 * definition with the parse and serialize functions for its files. The store
 * reads and writes them (`series-store.ts`), the engine walks the history and
 * keeps the index current (`walkHistory` and `feedIndex` in `engine.ts`), and
 * the runner starts both (`runner.ts`). A stat registers its definition once,
 * in `day-indexes.ts`.
 *
 * Pure.
 */

/** What every row has: the local calendar day it describes, `YYYY-MM-DD`. */
export interface DayRow {
	date: string;
}

/** How a column is kept. A number is rounded to whole units unless `precision` says otherwise. */
export interface ColumnSpec {
	/** Decimal places kept, 0 to 6. */
	precision?: number;
	/** Below zero is a reading, not Garmin's "not measured" (−1, −2). */
	signed?: boolean;
	/** A word — a status, a qualifier — rather than a number. Trimmed; empty is absent. */
	text?: boolean;
}

/** Every field of a row but its date, with how it is kept. The declaration order is the order rows are written in. */
export type DayColumns<R extends DayRow> = { readonly [K in Exclude<keyof R, "date"> & string]-?: ColumnSpec };

/**
 * A row as a fetch builds it: any value for any column — null, a negative
 * sentinel, a string where a number belongs. The definition cleans it up, so
 * a mapper can hand Garmin's fields straight over.
 */
export type DayRowInput<R extends DayRow> = { date?: unknown } & { [K in Exclude<keyof R, "date">]?: unknown };

export interface DayIndexMeta {
	version: number;
	/** The oldest and newest day fetched, with every day between them fetched too. */
	from?: string;
	to?: string;
	/** Fetching further back than `from` found nothing: the index holds the whole history. */
	complete: boolean;
}

/** What one fetch saw: the rows, and every day it asked about, row or not. */
export interface DayIndexBatch<R extends DayRow = DayRow> {
	rows: R[];
	/** A day asked about with no row had nothing; any row the index held for it goes. */
	dates: string[];
}

/** An index as a page reads it. */
export interface DayIndexData<R extends DayRow = DayRow> {
	/** Oldest first. */
	rows: R[];
	/** Null until a sync has written the index. */
	meta: DayIndexMeta | null;
}

/** How a page reads an index: `readIndex<StressRow>("stress")`. */
export type ReadIndex = <R extends DayRow = DayRow>(kind: string) => Promise<DayIndexData<R>>;

/** A history walk in progress, for a page's banner. */
export interface IndexHistoryProgress {
	/** The oldest day fetched so far, once the first window is in. */
	reached?: string;
}

/** What a stat says about its index. See the Health Stats foundation in `docs/architecture.md`. */
export interface DayIndexSpec<R extends DayRow> {
	/** The index's id: `readIndex(kind)`, the history command, the progress map. Lowercase, hyphenated. */
	kind: string;
	/** As it reads mid-sentence: "Sync <title> history", "Garmin <title> history". */
	title: string;
	/** The folder under the data folder. Lowercase, hyphenated. */
	folder: string;
	/** Bumped when a row's meaning changes: an index of another version is fetched again. */
	version: number;
	/** The list's key in a year file. `days` unless the stat reads better otherwise ("nights"). */
	listKey?: string;
	columns: DayColumns<R>;
	/**
	 * Merge policy. True: a field the new row lacks keeps the value the index
	 * had, as daily stats keeps the calories a backfill cannot see. False: the
	 * new row replaces the old one whole, as a night does.
	 */
	keepOld: boolean;
	/** The settings group the index belongs to: nothing is fetched while it is off. */
	group: MetricGroup;
	/**
	 * Days a window request covers: 28 unless the endpoint takes more
	 * (respiration's range 31, fitness age's 29). Weight, blood pressure, pulse
	 * ox and Health Status have no cap, so they ask for the most and get the
	 * whole history in one request. At most `MAX_WINDOW_DAYS` (3660).
	 */
	windowDays?: number;
	/**
	 * Days back from a routine sync's last day fetched again on every sync,
	 * held or not, for a stat Garmin revises late (Health Status rescores days
	 * up to 26 days on). 0, the default, fetches only what the index lacks. A
	 * row that comes back the same writes nothing.
	 */
	refreshDays?: number;
	/** Windows in a row without a row that end a history walk, once past `notBefore`. */
	emptyWindowsToStop: number;
	/** How far back from today Garmin keeps the stat at all; a walk stops there. */
	maxHistoryDays?: number;
	/** One window, `start`..`end` inclusive, as rows. The definition owns the request. */
	fetchWindow(api: GarminApi, start: string, end: string): Promise<ReadonlyArray<DayRowInput<R>>>;
	/**
	 * A day's row from the daily summary a routine sync fetched anyway, so the
	 * run's own days cost nothing. Null when the summary has nothing for it.
	 * The row's date is `date` whatever the row says.
	 */
	fromSummary?(summary: DailySummary, date: string): DayRowInput<R> | null | undefined;
}

export interface DayIndexDef<R extends DayRow = DayRow> {
	readonly kind: string;
	readonly title: string;
	readonly folder: string;
	readonly version: number;
	readonly listKey: string;
	readonly columns: DayColumns<R>;
	/** The columns in the order a row is written, after its date. */
	readonly keys: readonly string[];
	readonly keepOld: boolean;
	readonly group: MetricGroup;
	readonly windowDays: number;
	readonly refreshDays: number;
	readonly emptyWindowsToStop: number;
	readonly maxHistoryDays?: number;
	fetchWindow(api: GarminApi, start: string, end: string): Promise<ReadonlyArray<DayRowInput<R>>>;
	fromSummary?(summary: DailySummary, date: string): DayRowInput<R> | null | undefined;
	/** A clean row: a valid date, only the columns, each kept as its spec says, in order. Null when nothing is left. */
	normalize(row: unknown): R | null;
	/** Folds a batch into the rows. Every day asked about is replaced by what was found, or dropped. */
	merge(rows: readonly R[], batch: DayIndexBatch<R>): R[];
	/** A year file: one row per line, keys in a fixed order, no timestamp, so unchanged rows make unchanged text. */
	serializeYear(year: string, rows: readonly R[]): string;
	/** The rows of a year file. Malformed rows are dropped; a malformed file is empty. */
	parseYear(text: string): R[];
	serializeMeta(meta: DayIndexMeta): string;
	/** Null for a malformed file or one of another version. */
	parseMeta(text: string): DayIndexMeta | null;
}

/** Folders and kinds the store already uses for something else. */
export const RESERVED_INDEX_NAMES: readonly string[] = ["series", "activities", "daily-stats", "sleep"];

/** Days a window covers unless a definition says otherwise: most of Garmin's range endpoints refuse a 29th day. */
export const DEFAULT_WINDOW_DAYS = 28;

/** The widest window, and the longest refresh, a definition may ask for: about ten years. */
export const MAX_WINDOW_DAYS = 3660;

/**
 * A stat's index, checked. Throws on a definition that cannot work, so the
 * mistake fails the build's tests instead of a sync.
 */
export function defineDayIndex<R extends DayRow>(spec: DayIndexSpec<R>): DayIndexDef<R> {
	const problem = problemWith(spec as unknown as DayIndexSpec<DayRow>);
	if (problem) throw new Error(`defineDayIndex(${JSON.stringify(spec.kind)}): ${problem}`);

	const listKey = spec.listKey ?? "days";
	const columns = spec.columns as unknown as Readonly<Record<string, ColumnSpec>>;
	const keys = Object.keys(columns);
	const version = spec.version;

	function normalize(raw: unknown): R | null {
		if (!raw || typeof raw !== "object") return null;
		const row = raw as Record<string, unknown>;
		if (typeof row.date !== "string" || !DATE.test(row.date)) return null;
		const out: Record<string, unknown> = { date: row.date };
		let any = false;
		for (const key of keys) {
			const value = cell(columns[key]!, row[key]);
			if (value === undefined) continue;
			out[key] = value;
			any = true;
		}
		return any ? (out as unknown as R) : null;
	}

	function merge(rows: readonly R[], batch: DayIndexBatch<R>): R[] {
		const asked = new Set(batch.dates);
		const fresh = new Map<string, R>();
		for (const raw of batch.rows) {
			const row = normalize(raw);
			if (row) fresh.set(row.date, row);
		}
		const old = new Map(rows.map((r) => [r.date, r]));
		const out = rows.filter((r) => !asked.has(r.date) && !fresh.has(r.date));
		for (const [date, row] of fresh) {
			const before = spec.keepOld ? old.get(date) : undefined;
			const next = before ? normalize({ ...before, ...row }) : row;
			if (next) out.push(next);
		}
		return sortByDate(out);
	}

	function serializeYear(year: string, rows: readonly R[]): string {
		const clean = sortByDate(rows.map(normalize).filter((r): r is R => r !== null));
		const lines = clean.map((r) => `\t\t${JSON.stringify(r)}`);
		const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
		return `{\n\t"version": ${version},\n\t"year": ${Number(year)},\n\t${JSON.stringify(listKey)}: ${body}\n}\n`;
	}

	function parseYear(text: string): R[] {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return [];
		}
		const list = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>)[listKey] : undefined;
		if (!Array.isArray(list)) return [];
		return list.map(normalize).filter((r): r is R => r !== null);
	}

	function serializeMeta(meta: DayIndexMeta): string {
		const out: Record<string, unknown> = { version };
		if (meta.from) out.from = meta.from;
		if (meta.to) out.to = meta.to;
		out.complete = meta.complete;
		return `${JSON.stringify(out, null, "\t")}\n`;
	}

	function parseMeta(text: string): DayIndexMeta | null {
		try {
			const raw = JSON.parse(text) as Record<string, unknown> | null;
			if (!raw || typeof raw !== "object" || raw.version !== version) return null;
			const meta: DayIndexMeta = { version, complete: raw.complete === true };
			if (typeof raw.from === "string" && DATE.test(raw.from)) meta.from = raw.from;
			if (typeof raw.to === "string" && DATE.test(raw.to)) meta.to = raw.to;
			return meta;
		} catch {
			return null;
		}
	}

	const def: DayIndexDef<R> = {
		kind: spec.kind,
		title: spec.title,
		folder: spec.folder,
		version,
		listKey,
		columns: spec.columns,
		keys,
		keepOld: spec.keepOld,
		group: spec.group,
		windowDays: spec.windowDays ?? DEFAULT_WINDOW_DAYS,
		refreshDays: spec.refreshDays ?? 0,
		emptyWindowsToStop: spec.emptyWindowsToStop,
		...(spec.maxHistoryDays !== undefined ? { maxHistoryDays: spec.maxHistoryDays } : {}),
		fetchWindow: (api, start, end) => spec.fetchWindow(api, start, end),
		normalize,
		merge,
		serializeYear,
		parseYear,
		serializeMeta,
		parseMeta,
	};
	if (spec.fromSummary) def.fromSummary = (summary, date) => spec.fromSummary!(summary, date);
	return def;
}

/* ------------------------------------------------------------------ */
/*  Rows                                                               */
/* ------------------------------------------------------------------ */

/** Oldest first. */
export function sortByDate<R extends DayRow>(rows: readonly R[]): R[] {
	return [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** One row a day, oldest first, whatever order the year files were read in. A later row for a day wins. */
export function dedupeByDate<R extends DayRow>(rows: readonly R[]): R[] {
	const byDate = new Map<string, R>();
	for (const row of rows) byDate.set(row.date, row);
	return sortByDate([...byDate.values()]);
}

/** Rows by the year of their date. */
export function rowsByYear<R extends DayRow>(rows: readonly R[]): Map<string, R[]> {
	const years = new Map<string, R[]>();
	for (const row of rows) {
		const year = row.date.slice(0, 4);
		const list = years.get(year);
		if (list) list.push(row);
		else years.set(year, [row]);
	}
	return years;
}

/** The covered stretch after a fetch of `from..to`: joined on when it touches what was held, otherwise unchanged. */
export function extendSpan(held: { from?: string; to?: string } | null | undefined, from: string, to: string): { from: string; to: string } {
	if (!held?.from || !held.to) return { from, to };
	// Touching means no day between them was skipped.
	if (from > shiftDate(held.to, 1) || to < shiftDate(held.from, -1)) return { from: held.from, to: held.to };
	return { from: from < held.from ? from : held.from, to: to > held.to ? to : held.to };
}

/** `YYYY-MM-DD` moved by whole days, on the calendar rather than the clock. */
export function shiftDate(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME = /^[a-z0-9][a-z0-9-]*$/;
const KEY = /^[A-Za-z][A-Za-z0-9]*$/;
/** Keys a year file uses itself, or that would shadow a row's date. */
const FILE_KEYS = new Set(["date", "version", "year"]);

function cell(spec: ColumnSpec, value: unknown): number | string | undefined {
	if (spec.text) {
		if (typeof value !== "string") return undefined;
		const text = value.trim();
		return text ? text : undefined;
	}
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	if (value < 0 && !spec.signed) return undefined;
	const scale = 10 ** (spec.precision ?? 0);
	return Math.round(value * scale) / scale;
}

function problemWith(spec: DayIndexSpec<DayRow>): string | null {
	if (typeof spec.kind !== "string" || !NAME.test(spec.kind)) return "kind must be lowercase letters, digits and hyphens";
	if (RESERVED_INDEX_NAMES.includes(spec.kind)) return `kind "${spec.kind}" is taken`;
	if (typeof spec.folder !== "string" || !NAME.test(spec.folder)) return "folder must be lowercase letters, digits and hyphens";
	if (RESERVED_INDEX_NAMES.includes(spec.folder)) return `folder "${spec.folder}" is taken`;
	if (typeof spec.title !== "string" || !spec.title.trim()) return "title is empty";
	if (!Number.isInteger(spec.version) || spec.version < 1) return "version must be a whole number from 1";
	if (spec.listKey !== undefined && (!KEY.test(spec.listKey) || FILE_KEYS.has(spec.listKey))) return `listKey "${spec.listKey}" cannot be used`;
	const columns = Object.entries((spec.columns ?? {}) as Record<string, ColumnSpec>);
	if (!columns.length) return "no columns";
	for (const [key, column] of columns) {
		if (!KEY.test(key) || FILE_KEYS.has(key)) return `column "${key}" cannot be used`;
		if (!column || typeof column !== "object") return `column "${key}" needs a spec`;
		if (column.text && (column.precision !== undefined || column.signed)) return `column "${key}" is text: no precision or sign`;
		if (column.precision !== undefined && (!Number.isInteger(column.precision) || column.precision < 0 || column.precision > 6)) {
			return `column "${key}": precision must be 0 to 6`;
		}
	}
	const windowDays = spec.windowDays ?? DEFAULT_WINDOW_DAYS;
	if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > MAX_WINDOW_DAYS) {
		return `windowDays must be 1 to ${MAX_WINDOW_DAYS}`;
	}
	const refreshDays = spec.refreshDays ?? 0;
	if (!Number.isInteger(refreshDays) || refreshDays < 0 || refreshDays > MAX_WINDOW_DAYS) {
		return `refreshDays must be 0 to ${MAX_WINDOW_DAYS}`;
	}
	if (!Number.isInteger(spec.emptyWindowsToStop) || spec.emptyWindowsToStop < 1) return "emptyWindowsToStop must be 1 or more";
	if (spec.maxHistoryDays !== undefined && (!Number.isInteger(spec.maxHistoryDays) || spec.maxHistoryDays < 1)) {
		return "maxHistoryDays must be 1 or more";
	}
	if (typeof spec.fetchWindow !== "function") return "fetchWindow is missing";
	return null;
}
