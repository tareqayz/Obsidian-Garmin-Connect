import { App, TFile, normalizePath, moment } from "obsidian";
import type { NoteTarget, WriteOutcome } from "./engine";
import { differs } from "./diff";
import type { Properties } from "./metrics";

/**
 * Obsidian re-exports moment, but its type declarations resolve through the
 * external `moment` package, which is not a dependency here. Type the sliver we
 * use so the build does not depend on it being installed.
 */
type MomentFn = (input?: string, format?: string) => { format(fmt: string): string };
const formatWith = moment as unknown as MomentFn;

export interface DailyNoteOptions {
	/** Blank means "whatever the core Daily Notes plugin is set to". */
	folder: string;
	format: string;
	createIfMissing: boolean;
}

export const DAILY_NOTE_DEFAULTS = { folder: "", format: "YYYY-MM-DD" };

interface CoreOptions {
	folder?: string;
	format?: string;
}

/**
 * Reads the core Daily Notes plugin's settings.
 *
 * Internal plugins are not in the public API, so this is a defensive cast with
 * a fallback — the same approach `obsidian-daily-notes-interface` takes. Users
 * can override folder and format in our settings if it ever stops working.
 */
export function coreDailyNoteOptions(app: App): CoreOptions {
	try {
		const internal = (
			app as unknown as {
				internalPlugins?: {
					getEnabledPluginById?(id: string): { options?: CoreOptions } | null;
				};
			}
		).internalPlugins;
		return internal?.getEnabledPluginById?.("daily-notes")?.options ?? {};
	} catch {
		return {};
	}
}

export function resolveDailyNoteOptions(app: App, overrides: Partial<DailyNoteOptions>) {
	const core = coreDailyNoteOptions(app);
	return {
		folder: overrides.folder || core.folder || DAILY_NOTE_DEFAULTS.folder,
		format: overrides.format || core.format || DAILY_NOTE_DEFAULTS.format,
		createIfMissing: overrides.createIfMissing ?? false,
	};
}

/** `"2026-09-12"` rendered with the vault's daily-note format (moment tokens). */
export function dailyNoteName(date: string, format: string): string {
	return formatWith(date, "YYYY-MM-DD").format(format);
}

/* ------------------------------------------------------------------ */
/*  Note target                                                        */
/* ------------------------------------------------------------------ */

export class DailyNoteTarget implements NoteTarget {
	private app: App;
	private options: DailyNoteOptions;
	/** Built once per sync so a moved note is still found without a vault walk per day. */
	private byName: Map<string, TFile> | null = null;

	constructor(app: App, options: DailyNoteOptions) {
		this.app = app;
		this.options = options;
	}

	exists(date: string): boolean {
		return this.find(date) !== null;
	}

	async write(date: string, properties: Properties): Promise<WriteOutcome> {
		let file = this.find(date);
		if (!file) {
			if (!this.options.createIfMissing) return "missing";
			file = await this.create(date);
			this.byName = null;
		}

		// Skip writes that would change nothing. Without this every sync bumps
		// the file's mtime, which Obsidian Sync and LiveSync both react to.
		const existing = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		if (!differs(existing, properties)) return "unchanged";

		// processFrontMatter is the official API and keeps the metadata cache in
		// step. It rewrites the whole block, so it is only ever called on files
		// this sync is genuinely changing.
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			for (const [key, value] of Object.entries(properties)) {
				frontmatter[key] = value;
			}
		});
		return "written";
	}

	private find(date: string): TFile | null {
		const name = dailyNoteName(date, this.options.format);
		const folder = this.options.folder.replace(/^\/+|\/+$/g, "");
		const direct = normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);

		const exact = this.app.vault.getAbstractFileByPath(direct);
		if (exact instanceof TFile) return exact;

		// A format containing "/" pins the note to one folder, so a name-only
		// match would be wrong.
		if (name.includes("/")) return null;
		return this.index().get(`${name}.md`) ?? null;
	}

	/** Basename → file, so notes the user has moved are still found. */
	private index(): Map<string, TFile> {
		if (this.byName) return this.byName;
		const map = new Map<string, TFile>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			if (!map.has(file.name)) map.set(file.name, file);
		}
		this.byName = map;
		return map;
	}

	private async create(date: string): Promise<TFile> {
		const name = dailyNoteName(date, this.options.format);
		const folder = this.options.folder.replace(/^\/+|\/+$/g, "");
		const path = normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);

		const dir = path.slice(0, path.lastIndexOf("/"));
		if (dir) await this.ensureFolder(dir);

		// Deliberately empty: the daily-note template is not applied, because
		// expanding only some of its placeholders would be worse than none.
		return this.app.vault.create(path, "");
	}

	private async ensureFolder(path: string): Promise<void> {
		const parts = normalizePath(path).split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}
}
