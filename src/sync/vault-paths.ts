import { App, normalizePath } from "obsidian";

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

/**
 * Why `path` can't hold the plugin's files, or null when it can: the vault's
 * root (the sync's folders would sit among your notes), a `.` or `..` part, a
 * hidden folder (Obsidian doesn't see inside one, so the files would go
 * unread), or the vault's settings folder.
 */
export function folderProblem(path: string, configDir: string): string | null {
	const clean = normalizePath(path.trim());
	if (clean === "/" || clean === "") return "Choose a folder, not the vault's root.";
	const parts = clean.split("/");
	if (parts.some((part) => part === "." || part === "..")) return "A folder name can't be . or ..";
	if (parts.some((part) => part.startsWith("."))) return "Choose a folder Obsidian can see: one whose name doesn't start with a dot.";
	const config = normalizePath(configDir);
	if (clean === config || clean.startsWith(`${config}/`)) return "Choose a folder outside the vault's settings folder.";
	return null;
}
