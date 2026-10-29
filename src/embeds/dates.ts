import { shiftDate } from "../dashboard/series";
import { isDay, type DateSpec } from "./spec";

/**
 * Which day a card block shows. Pure: the daily-note format is read with a
 * parser passed in (`moment`'s strict parse, in the plugin).
 *
 * The first that applies:
 * 1. the block's own `date:`;
 * 2. the note's path, when it is a daily note: inside the Daily notes folder
 *    and parsed by its format, strictly, back to the same text;
 * 3. the note's `date` property (its day part);
 * 4. a `YYYY-MM-DD` in the note's name;
 * 5. today, live: it moves with the day, and shows the newest synced day
 *    until today has synced, as Home does.
 */

export interface DailyNotes {
	/** The folder daily notes go in; "" for the vault's root. */
	folder: string;
	/** moment's tokens: `YYYY-MM-DD`, `YYYY/MM/YYYY-MM-DD`… */
	format: string;
}

export interface CardDateInput {
	explicit?: DateSpec;
	/** The note's vault path: `Daily/2026-10-28.md`. */
	path: string;
	frontmatter?: Record<string, unknown> | null;
	/** The core Daily notes plugin's settings, while it is on. */
	daily?: DailyNotes | null;
	today: string;
	/** The day `text` names in `format`, `YYYY-MM-DD`, or null unless it reads back the same. */
	parse: (text: string, format: string) => string | null;
}

export interface CardDate {
	date: string;
	/** Today, and moving with it: Home's day to show. */
	live: boolean;
	source: "block" | "daily-note" | "property" | "name" | "today";
	/** The note's own day, if it has one: a block on another day says which. */
	noteDay?: string;
}

export function resolveCardDate(input: CardDateInput): CardDate {
	const own = noteDay(input);
	const explicit = input.explicit;
	if (explicit?.kind === "date") return { date: explicit.date, live: false, source: "block", ...(own ? { noteDay: own.date } : {}) };
	if (explicit?.kind === "yesterday") return { date: shiftDate(input.today, -1), live: false, source: "block", ...(own ? { noteDay: own.date } : {}) };
	if (explicit?.kind === "today") return { date: input.today, live: true, source: "block", ...(own ? { noteDay: own.date } : {}) };
	if (own) return { date: own.date, live: false, source: own.source, noteDay: own.date };
	return { date: input.today, live: true, source: "today" };
}

/** The day a note is about, if it says: a daily note's name, its `date` property, a date in its name. */
export function noteDay(input: Pick<CardDateInput, "path" | "frontmatter" | "daily" | "parse">): { date: string; source: "daily-note" | "property" | "name" } | null {
	const daily = input.daily ? dailyNoteDay(input.path, input.daily, input.parse) : null;
	if (daily) return { date: daily, source: "daily-note" };
	const property = propertyDay(input.frontmatter);
	if (property) return { date: property, source: "property" };
	const named = nameDay(input.path);
	return named ? { date: named, source: "name" } : null;
}

/** The day a daily note's path names, read with the Daily notes format. */
export function dailyNoteDay(path: string, daily: DailyNotes, parse: CardDateInput["parse"]): string | null {
	if (!path.toLowerCase().endsWith(".md")) return null;
	const folder = daily.folder.replace(/^\/+|\/+$/g, "");
	if (folder && !path.startsWith(`${folder}/`)) return null;
	const inside = path.slice(folder ? folder.length + 1 : 0, -".md".length);
	const date = parse(inside, daily.format || "YYYY-MM-DD");
	return date && isDay(date) ? date : null;
}

/** A `date` property's day: `2026-10-28`, or the day part of `2026-10-28T09:15`. */
export function propertyDay(frontmatter: Record<string, unknown> | null | undefined): string | null {
	const value = frontmatter?.date;
	if (typeof value !== "string") return null;
	const day = value.trim().slice(0, 10);
	return isDay(day) ? day : null;
}

/** A `YYYY-MM-DD` in a note's name: "Run 2026-10-28" or "2026-10-28 Long run". */
export function nameDay(path: string): string | null {
	const name = path.split("/").pop()?.replace(/\.md$/i, "") ?? "";
	const day = /(?:^|\D)(\d{4}-\d{2}-\d{2})(?!\d)/.exec(name)?.[1];
	return day && isDay(day) ? day : null;
}
