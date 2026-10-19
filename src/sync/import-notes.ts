import type { App } from "obsidian";
import type { DayProperties } from "./days";
import type { Properties } from "./metrics";
import type { VaultSeriesStore } from "./series-store";
import { trimSlashes } from "./vault-paths";

/** Where a build before JSON-only storage kept a day's properties. */
export interface LegacyNotes {
	dataFolder: string;
	/** The data folder's prefix: blank unless someone set one. */
	dataFolderPrefix: string;
	/** Daily notes' prefix, `garmin_` by default. */
	prefix: string;
}

/**
 * Copies the days the old builds wrote as note frontmatter into the day files,
 * once: only while `days/` does not exist yet, and never over a day the JSON
 * already holds. The notes themselves are left where they are.
 *
 * Reads the metadata cache, so it waits for the vault to be indexed.
 */
export async function importDayNotes(app: App, store: VaultSeriesStore, legacy: LegacyNotes): Promise<number> {
	if (app.vault.getAbstractFileByPath(store.daysFolder)) return 0;

	const folder = trimSlashes(legacy.dataFolder);
	const sources = [
		{ folder, prefix: legacy.dataFolderPrefix },
		// A daily note may live anywhere; its prefixed date marks it.
		...(legacy.prefix ? [{ folder: null, prefix: legacy.prefix }] : []),
	];

	const days: DayProperties = new Map();
	for (const source of sources) {
		for (const file of app.vault.getMarkdownFiles()) {
			if (source.folder !== null && !file.path.startsWith(source.folder ? `${source.folder}/` : "")) continue;
			const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
			const date: unknown = frontmatter?.[`${source.prefix}date`];
			if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
			// Earlier sources win: the data folder was authoritative in "both" mode.
			if (days.has(date)) continue;
			days.set(date, unprefixed(frontmatter!, source.prefix));
		}
	}
	if (days.size === 0) return 0;
	await store.writeDays(days);
	return days.size;
}

function unprefixed(frontmatter: Record<string, unknown>, prefix: string): Properties {
	const out: Properties = {};
	for (const [key, value] of Object.entries(frontmatter)) {
		if (prefix && !key.startsWith(prefix)) continue;
		const name = prefix ? key.slice(prefix.length) : key;
		if (name === "date") continue;
		if (typeof value === "number") out[name] = value;
		// Not the hub link to the old table view: a wikilink is no metric.
		else if (typeof value === "string" && !value.startsWith("[[")) out[name] = value;
		else if (Array.isArray(value)) {
			// The workouts and Health Snapshots lists; a note's tags are not ours.
			const rows = value.filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v));
			if (rows.length) out[name] = rows;
		}
	}
	return out;
}
