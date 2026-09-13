import type { Properties } from "./metrics";

export interface LinkOption {
	/** Property name, e.g. "link". Written unprefixed: it is yours, not a metric. */
	property: string;
	/** Wikilink target as it should appear inside the brackets. */
	target: string;
}

/**
 * Adds the hub link property to a day's properties.
 *
 * The value is a wikilink string rather than a plain path so Obsidian treats
 * the property as a link — which is what puts an edge in the graph view and a
 * backlink on the target.
 */
export function withLink(properties: Properties, link?: LinkOption): Properties {
	if (!link?.property || !link.target) return properties;
	return { ...properties, [link.property]: `[[${link.target}]]` };
}

/**
 * A vault path reduced to what belongs inside a wikilink.
 *
 * The extension is dropped for notes — Obsidian links those by name — but kept
 * for anything else, including a `.base`, where the name alone resolves to
 * nothing.
 */
export function linkTargetFor(path: string): string {
	// No normalizePath here: this file stays free of Obsidian so it can be
	// tested directly, and a vault path is already normalised by its caller.
	const clean = path.replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
	return clean.endsWith(".md") ? clean.slice(0, -3) : clean;
}
