import type { App, TFile } from "obsidian";
import type { GarminSettings } from "../settings";
import { trimSlashes } from "../sync/frontmatter";
import type { DayRow } from "./series";

/**
 * Reads synced days back out of the vault.
 *
 * Everything comes from the metadata cache rather than file reads, so a year of
 * notes costs nothing to scan. Keys are stripped of their prefix here, which is
 * what lets the dashboard work the same whichever storage mode wrote them.
 */
export function collectRows(app: App, settings: GarminSettings): DayRow[] {
	const sources: Array<{ folder: string | null; prefix: string }> = [];
	if (settings.storageMode !== "dailyNotes") {
		sources.push({ folder: trimSlashes(settings.dataFolder), prefix: settings.dataFolderPrefix });
	}
	if (settings.storageMode !== "dataFolder") {
		// No folder filter: a daily note may live anywhere, and the date property
		// is a more reliable marker than re-deriving the filename format.
		sources.push({ folder: null, prefix: settings.prefix });
	}

	const byDate = new Map<string, DayRow>();
	const files = app.vault.getMarkdownFiles();

	for (const source of sources) {
		for (const file of files) {
			if (source.folder && !inFolder(file, source.folder)) continue;
			const row = rowFrom(app, file, source.prefix);
			// Earlier sources win: the data folder is authoritative in "both" mode.
			if (row && !byDate.has(row.date)) byDate.set(row.date, row);
		}
	}

	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function inFolder(file: TFile, folder: string): boolean {
	return file.path.startsWith(`${folder}/`);
}

function rowFrom(app: App, file: TFile, prefix: string): DayRow | null {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter) return null;

	const date = frontmatter[`${prefix}date`];
	if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

	const values: Record<string, number> = {};
	const text: Record<string, string> = {};
	let workouts: Array<Record<string, unknown>> | undefined;

	for (const [key, value] of Object.entries(frontmatter)) {
		if (prefix && !key.startsWith(prefix)) continue;
		const name = prefix ? key.slice(prefix.length) : key;
		if (name === "date") continue;

		if (typeof value === "number" && Number.isFinite(value)) values[name] = value;
		// Garmin's qualitative properties — "BALANCED", "PRODUCTIVE_1" — and the
		// day's activity list. Both were dropped before, which is why a workout
		// could be synced into a note and still be invisible on the dashboard.
		else if (typeof value === "string" && value) text[name] = value;
		else if (name === "workouts" && Array.isArray(value)) {
			workouts = value.filter(
				(row): row is Record<string, unknown> =>
					Boolean(row) && typeof row === "object" && !Array.isArray(row),
			);
		}
	}

	return { date, values, text, ...(workouts?.length ? { workouts } : {}) };
}
