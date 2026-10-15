import { normalizePath, TFile, TFolder, type App, type TAbstractFile } from "obsidian";
import { DAY_INDEXES } from "../sync/day-indexes";
import { diagnosticsNotes, planDelete, type DeletePlan, type PathEntry } from "../sync/owned-paths";

/**
 * Moves the plugin's files to the trash — the user's trash setting decides
 * which — and the data folder after them once it is empty. What counts as
 * the plugin's is `owned-paths.ts`. Needs only the app, so the prompt after
 * an uninstall can run it once the plugin itself is gone.
 */

/** A file or folder of the vault as `owned-paths.ts` reads it. */
export function entryOf(file: TAbstractFile): PathEntry {
	if (file instanceof TFolder) return { name: file.name, path: file.path, children: file.children.map(entryOf) };
	return { name: file.name, path: file.path, size: file instanceof TFile ? file.stat.size : 0 };
}

/** What deleting would remove: for the confirmation's sizes. */
export function deletePlan(app: App, dataFolder: string): DeletePlan {
	const folder = app.vault.getAbstractFileByPath(normalizePath(dataFolder));
	return planDelete(folder ? entryOf(folder) : null, DAY_INDEXES.map((def) => def.folder));
}

/** The diagnostics notes the plugin saved, for the confirmation's checkbox. */
export function diagnosticsIn(app: App, logFolder: string): PathEntry[] {
	const folder = app.vault.getAbstractFileByPath(normalizePath(logFolder));
	return diagnosticsNotes(folder ? entryOf(folder) : null);
}

export async function deleteSyncedFiles(
	app: App,
	opts: { dataFolder: string; logFolder?: string },
): Promise<{ files: number; bytes: number }> {
	const plan = deletePlan(app, opts.dataFolder);
	const notes = opts.logFolder ? diagnosticsIn(app, opts.logFolder) : [];
	for (const path of [...plan.trash, ...notes.map((note) => note.path)]) {
		const file = app.vault.getAbstractFileByPath(path);
		if (file) await app.fileManager.trashFile(file);
	}
	// The data folder, then the default's "Garmin" above it, once nothing is left in them.
	const folder = app.vault.getAbstractFileByPath(normalizePath(opts.dataFolder));
	if (folder instanceof TFolder && folder.children.length === 0) {
		const parent = folder.parent;
		await app.fileManager.trashFile(folder);
		if (parent && !parent.isRoot() && parent.children.length === 0) await app.fileManager.trashFile(parent);
	}
	return { files: plan.files + notes.length, bytes: plan.bytes + notes.reduce((sum, note) => sum + (note.size ?? 0), 0) };
}
