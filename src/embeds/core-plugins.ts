import { moment, type App, type TFile } from "obsidian";
import { noteDay, type DailyNotes } from "./dates";

interface CoreOptions {
	folder?: string;
	format?: string;
}

/**
 * A core plugin's settings, while it is on. Internal plugins aren't in the
 * public API, so this is a defensive read that falls back to nothing, the way
 * obsidian-daily-notes-interface reads them.
 */
function coreOptions(app: App, id: string): CoreOptions | null {
	try {
		const internal = (app as unknown as { internalPlugins?: { getEnabledPluginById?(id: string): { options?: CoreOptions } | null } }).internalPlugins;
		const plugin = internal?.getEnabledPluginById?.(id);
		return plugin ? (plugin.options ?? {}) : null;
	} catch {
		return null;
	}
}

/** The core Daily notes plugin's folder and format, while it is on. */
export function dailyNotesOf(app: App): DailyNotes | null {
	const options = coreOptions(app, "daily-notes");
	return options ? { folder: options.folder?.trim() ?? "", format: options.format?.trim() || "YYYY-MM-DD" } : null;
}

/** The core Templates plugin's folder, while it is on and has one. */
export function templatesFolderOf(app: App): string | null {
	return coreOptions(app, "templates")?.folder?.trim() || null;
}

/**
 * The part of `moment` this file calls. The Community directory's scanner has no type for `moment`
 * (see types/scanner/moment.d.ts), so the call goes through this one.
 */
type StrictMoment = (text: string, format: string, strict: true) => { isValid(): boolean; format(format: string): string };

/** The day `text` names in a moment format, read strictly and only if it reads back the same. */
export function parseDay(text: string, format: string): string | null {
	const at = (moment as StrictMoment)(text, format, true);
	return at.isValid() && at.format(format) === text ? at.format("YYYY-MM-DD") : null;
}

/** The day a note is about, if it says one: see `dates.ts`. */
export function dayOfNote(app: App, file: TFile): string | null {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter ?? null;
	return noteDay({ path: file.path, frontmatter, daily: dailyNotesOf(app), parse: parseDay })?.date ?? null;
}
