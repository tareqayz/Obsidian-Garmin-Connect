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
 * A day's properties over what `days` held for it, in place. Merged rather
 * than replaced, as frontmatter was: a group switched off since does not wipe
 * the values it wrote.
 */
function mergeInto(days: DayProperties, date: string, properties: Properties): Properties {
	const merged = { ...(days.get(date) ?? {}), ...properties };
	days.set(date, merged);
	return merged;
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

/** Where a `DayBuffer` reads and writes year files. `VaultSeriesStore` in the plugin. */
export interface DayYearStore {
	/** The year file's text as it stands now, or null when there is none. */
	readYear(year: string): Promise<string | null>;
	/** Skips the write when the text would not change. `held` is the file's text as just read, so it isn't read again. */
	writeYear(year: string, body: string, held?: string): Promise<"written" | "unchanged">;
}

/**
 * Days a sync writes, held and then written a year file at a time. A year
 * file holds the whole year, and a sync service uploads every rewrite of it,
 * so a run of a few hundred days must not rewrite it once a day.
 *
 * `write` answers as a write to the file would, from the year as it stood
 * when first read. `flush` reads each year again and merges the held days
 * over it, so a day another device wrote meanwhile is kept.
 */
export class DayBuffer {
	/** What the run wrote, by date: merged over the file at flush. */
	private incoming: DayProperties = new Map();
	/** Each year as first read, with the run's days merged in: what `write` compares against. */
	private seen = new Map<string, DayProperties>();
	/** Each year's text as first read: a file still the same at flush needs no second parse. */
	private firstText = new Map<string, string | null>();

	constructor(private readonly store: DayYearStore) {}

	/** Every day has somewhere to go: its year file. */
	exists(): boolean {
		return true;
	}

	async write(date: string, properties: Properties): Promise<"written" | "unchanged"> {
		const year = date.slice(0, 4);
		let days = this.seen.get(year);
		if (!days) {
			const text = await this.store.readYear(year);
			this.firstText.set(year, text);
			days = text ? parseDays(text) : new Map();
			this.seen.set(year, days);
		}
		const before = JSON.stringify(days.get(date));
		if (before === JSON.stringify(mergeInto(days, date, properties))) return "unchanged";
		mergeInto(this.incoming, date, properties);
		return "written";
	}

	/** Days held and not yet written. */
	get pending(): number {
		return this.incoming.size;
	}

	/** Writes each year the run changed, once. Resolves with the files written. */
	async flush(): Promise<number> {
		const held = this.incoming;
		this.incoming = new Map();
		let written = 0;
		const years = [...new Set([...held.keys()].map((date) => date.slice(0, 4)))].sort();
		for (const year of years) {
			const text = await this.store.readYear(year);
			// Unchanged since the first read: the run's days are merged into that already.
			let days = text === this.firstText.get(year) ? this.seen.get(year) : undefined;
			if (!days) {
				days = text ? parseDays(text) : new Map<string, Properties>();
				for (const [date, properties] of held) if (date.startsWith(`${year}-`)) mergeInto(days, date, properties);
			}
			if ((await this.store.writeYear(year, serializeDays(year, days), text ?? undefined)) === "written") written += 1;
			this.seen.delete(year);
			this.firstText.delete(year);
		}
		return written;
	}
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
