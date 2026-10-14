/**
 * What "Delete synced data" removes: the files the plugin wrote under the
 * data folder, and nothing else. The data folder is the user's to point
 * anywhere — even at a folder that holds notes — so it is never deleted
 * whole: an owned folder goes whole only when everything in it is the
 * plugin's, and the data folder itself only once nothing is left in it.
 *
 * Pure: the vault is described to it as a tree.
 */

/** A file, or a folder with its children, from the vault. */
export interface PathEntry {
	name: string;
	path: string;
	/** Bytes, for a file. */
	size?: number;
	/** Present for a folder. */
	children?: PathEntry[];
}

export interface DeletePlan {
	/** Paths to move to the trash: owned folders whole, or owned files one by one. */
	trash: string[];
	/** Files the plugin wrote that `trash` covers. */
	files: number;
	bytes: number;
	/** Whether the data folder is empty once `trash` is gone, so it can go too. */
	emptyAfter: boolean;
}

/** Folders the sync writes under the data folder; the registered indexes' folders are added by the caller. */
export const OWNED_FOLDERS: readonly string[] = ["days", "series", "activities", "activity-details", "daily-stats", "sleep"];

/** Files the sync writes at the data folder's top. */
export const OWNED_FILES: readonly string[] = ["account.json", "sync-state.json", "scan.json", "backfill.json"];

/** An iCloud or Obsidian Sync conflict copy keeps the name and adds " 2". */
const COPY = "(?: \\d+)?";

/** The names the sync gives what it writes inside its folders. */
const OWNED_NAMES = [
	new RegExp(`^\\d{4}${COPY}\\.json$`),
	new RegExp(`^index${COPY}\\.json$`),
	new RegExp(`^\\d{4}-\\d{2}-\\d{2}${COPY}\\.json$`),
	new RegExp(`^\\d+${COPY}\\.json$`),
];

const isFolder = (entry: PathEntry): boolean => entry.children !== undefined;

function ownedFile(name: string): boolean {
	return OWNED_NAMES.some((pattern) => pattern.test(name));
}

function ownedTopFile(name: string): boolean {
	return OWNED_FILES.some((file) => new RegExp(`^${file.replace(".json", "")}${COPY}\\.json$`).test(name));
}

/** What deleting the synced data in `root` (the data folder) removes. `indexFolders` are the registered indexes' folders. */
export function planDelete(root: PathEntry | null, indexFolders: readonly string[]): DeletePlan {
	const plan: DeletePlan = { trash: [], files: 0, bytes: 0, emptyAfter: true };
	if (!root || !isFolder(root)) return plan;
	const folders = new Set([...OWNED_FOLDERS, ...indexFolders]);
	for (const entry of root.children!) {
		if (isFolder(entry)) {
			if (!folders.has(entry.name)) {
				plan.emptyAfter = false;
				continue;
			}
			const owned = entry.children!.filter((child) => !isFolder(child) && ownedFile(child.name));
			const all = owned.length === entry.children!.length;
			if (all) plan.trash.push(entry.path);
			else {
				plan.trash.push(...owned.map((child) => child.path));
				plan.emptyAfter = false;
			}
			plan.files += owned.length;
			plan.bytes += owned.reduce((sum, child) => sum + (child.size ?? 0), 0);
		} else if (ownedTopFile(entry.name)) {
			plan.trash.push(entry.path);
			plan.files += 1;
			plan.bytes += entry.size ?? 0;
		} else plan.emptyAfter = false;
	}
	return plan;
}

/** The diagnostics notes in the log folder: what "Also delete diagnostics notes" adds. */
export function diagnosticsNotes(folder: PathEntry | null): PathEntry[] {
	if (!folder || !isFolder(folder)) return [];
	return folder.children!.filter((child) => !isFolder(child) && /^garmin-probe-.*\.md$/.test(child.name));
}
