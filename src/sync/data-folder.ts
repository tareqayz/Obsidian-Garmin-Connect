import { App, TFile, normalizePath } from "obsidian";
import type { NoteTarget, WriteOutcome } from "./engine";
import { ensureFolder, trimSlashes, writeFrontmatter } from "./frontmatter";
import { applyPrefix, type Properties } from "./metrics";
import { withLink, type LinkOption } from "./link";

export interface DataFolderOptions {
	folder: string;
	/** Empty by default — a dedicated folder has nothing to collide with. */
	prefix: string;
	/** Optional hub link written unprefixed, so the graph view has an edge. */
	link?: LinkOption;
}

/**
 * One note per day in a folder of its own.
 *
 * The point is that it owns its notes: nothing here can damage something you
 * wrote, every day in a range is writable so backfill works without notes
 * existing first, and the data stays as properties — so a Bases view renders it
 * as a table while Dataview can still query it.
 */
export class DataFolderTarget implements NoteTarget {
	private app: App;
	private options: DataFolderOptions;

	constructor(app: App, options: DataFolderOptions) {
		this.app = app;
		this.options = options;
	}

	/** Always — this target creates whatever it needs. */
	exists(): boolean {
		return true;
	}

	async write(date: string, properties: Properties): Promise<WriteOutcome> {
		const file = await this.open(date);
		// The row key every view sorts on. Prefixed like everything else so it
		// cannot collide with a `date` property of the user's own.
		return writeFrontmatter(
			this.app,
			file,
			withLink(
				applyPrefix({ date, ...properties }, this.options.prefix),
				this.options.link,
			),
		);
	}

	path(date: string): string {
		const folder = trimSlashes(this.options.folder);
		return normalizePath(folder ? `${folder}/${date}.md` : `${date}.md`);
	}

	private async open(date: string): Promise<TFile> {
		const path = this.path(date);
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;

		const folder = trimSlashes(this.options.folder);
		if (folder) await ensureFolder(this.app, folder);
		return this.app.vault.create(path, "");
	}
}
