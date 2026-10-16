/**
 * Whether a data file can be trusted before the store writes over it.
 *
 * A file another program left half-written — a crash mid-save, a git merge's
 * conflict markers, a sync client's partial download — reads as no data at
 * all, and a merge built on "no data" would replace years of history with the
 * few days it fetched. So the store sets such a file aside instead of writing
 * over it, and refuses to write an older format over what a newer build of
 * the plugin wrote on another device.
 *
 * Pure.
 */

/** A write that would put this build's older format over a file a newer build wrote. */
export class NewerDataError extends Error {
	constructor(readonly path: string) {
		super(`${path} was written by a newer version of Garmin Connect. Update the plugin on this device, then sync again.`);
		this.name = "NewerDataError";
	}
}

/** JSON with an object at the top, as every file the sync writes is. */
export function isReadable(text: string): boolean {
	try {
		const parsed: unknown = JSON.parse(text);
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
	} catch {
		return false;
	}
}

/**
 * The version a data file declares, from the start of its text without
 * parsing the rest: `{"version": 3, …` or, for a series file,
 * `{"date": "…", "version": 2, …`.
 */
export function versionOf(text: string): number | undefined {
	const match = /^\s*\{\s*(?:"date"\s*:\s*"[^"]*"\s*,\s*)?"version"\s*:\s*(\d+)/.exec(text.slice(0, 96));
	return match ? Number(match[1]) : undefined;
}

/**
 * The name a file set aside takes: `2026.json` becomes
 * `2026.unreadable-20261016-113000.json`. Kept beside the original for
 * whoever wants to look inside, and no longer a name the sync reads.
 */
export function asideName(name: string, now: Date): string {
	const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
	const dot = name.lastIndexOf(".");
	return dot > 0 ? `${name.slice(0, dot)}.unreadable-${stamp}${name.slice(dot)}` : `${name}.unreadable-${stamp}`;
}

/** The names the sync gives its own files: a year, a date, an activity id, an index. */
const OWN = /^(?:\d{4}-\d{2}-\d{2}|\d+|index)\.json$/;
const COPY_OF_OWN = /^(?:\d{4}-\d{2}-\d{2}|\d+|index)(.+)\.json$/;

/**
 * A copy a sync service left beside one of the sync's files: iCloud's and
 * Obsidian Sync's `2026 2.json`, Syncthing's `2026.sync-conflict-….json`,
 * Dropbox's `2026 (… conflicted copy …).json`. The sync reads only the file
 * itself, so whatever only the copy holds goes unseen. A file the store set
 * aside is not one.
 */
export function isConflictCopy(name: string): boolean {
	if (OWN.test(name)) return false;
	const suffix = COPY_OF_OWN.exec(name)?.[1];
	return suffix !== undefined && !suffix.startsWith(".unreadable-");
}
