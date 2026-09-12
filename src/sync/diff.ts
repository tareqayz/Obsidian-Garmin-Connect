import type { Properties } from "./metrics";

/**
 * Would writing these properties change anything?
 *
 * Every sync re-reads the same days, so most runs have nothing to say. Skipping
 * those writes keeps the file's mtime still, which matters because Obsidian Sync
 * and LiveSync both treat a touched file as a change to propagate.
 */
export function differs(existing: Record<string, unknown>, incoming: Properties): boolean {
	for (const [key, value] of Object.entries(incoming)) {
		if (!deepEqual(existing[key], value)) return true;
	}
	return false;
}

export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null || a === undefined || b === undefined) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
	}
	if (typeof a === "object" && typeof b === "object") {
		const ao = a as Record<string, unknown>;
		const bo = b as Record<string, unknown>;
		const ak = Object.keys(ao);
		const bk = Object.keys(bo);
		return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
	}
	return false;
}
