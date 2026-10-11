/**
 * Where a map's tiles come from, as the activity pages see it. The route draws
 * without one: with tiles off, offline, or refused, the page still shows where
 * the activity went.
 *
 * Pure: no Obsidian import.
 */
export interface TileSource {
	/** The map's attribution line, which has to stay visible. */
	attribution: string;
	/** The deepest zoom the server draws. */
	maxZoom: number;
	/**
	 * A tile as an object URL. Rejects when it can't be had, and the map draws
	 * on without it. A tile no longer wanted before its request starts is
	 * dropped (`signal`); one already on its way can't be stopped.
	 */
	load(z: number, x: number, y: number, signal?: AbortSignal): Promise<string>;
	/** Done with a URL `load` gave. */
	release(url: string): void;
}

/** OpenStreetMap's tile usage policy asks for a week at least, whatever the headers say. */
export const MIN_KEEP_SECONDS = 7 * 86_400;

/**
 * Seconds a tile may be kept, from its response headers (`cache-control`'s
 * `max-age`, else `expires`), and never less than `floor`.
 */
export function keepFor(headers: Record<string, string>, now = Date.now(), floor = MIN_KEEP_SECONDS): number {
	const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
	const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(lower["cache-control"] ?? "");
	if (maxAge) return Math.max(floor, Number(maxAge[1]));
	const expires = Date.parse(lower.expires ?? "");
	if (Number.isFinite(expires)) return Math.max(floor, Math.round((expires - now) / 1000));
	return floor;
}

/** The User-Agent tile requests carry, so the tile server can tell who is asking. */
export function tileUserAgent(version: string): string {
	return `ObsidianGarminConnect/${version} (+https://github.com/tareqayz/Obsidian-Garmin-Connect)`;
}
