import { App, TFile, normalizePath } from "obsidian";
import { differs } from "./diff";
import type { Properties } from "./metrics";

/**
 * Writes properties into a note's frontmatter, skipping the write entirely when
 * nothing would change.
 *
 * The dirty check is not an optimisation. Every sync re-reads the same days, so
 * most runs have nothing to say, and a needless write bumps the file's mtime —
 * which Obsidian Sync and LiveSync both treat as a change to propagate.
 */
export async function writeFrontmatter(
	app: App,
	file: TFile,
	properties: Properties,
): Promise<"written" | "unchanged"> {
	const existing = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	if (!differs(existing, properties)) return "unchanged";

	// processFrontMatter is the official API and keeps the metadata cache in
	// step. It rewrites the whole block, so it is only ever reached for files
	// this sync is genuinely changing.
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		for (const [key, value] of Object.entries(properties)) {
			frontmatter[key] = value;
		}
	});
	return "written";
}

export async function ensureFolder(app: App, path: string): Promise<void> {
	const parts = normalizePath(path).split("/").filter(Boolean);
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			await app.vault.createFolder(current);
		}
	}
}

export function trimSlashes(path: string): string {
	return path.replace(/^\/+|\/+$/g, "");
}
