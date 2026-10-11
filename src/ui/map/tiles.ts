import { requestUrl } from "obsidian";
import { keepFor, tileUserAgent, type TileSource } from "./tile-source";

/**
 * OpenStreetMap's standard tiles for the activity maps.
 *
 * Fetched through Obsidian's `requestUrl` rather than `<img>`: on a phone that
 * is native HTTP, so neither CORS nor the webview's Referer decides whether a
 * tile loads, and every request names this plugin in its User-Agent, as the
 * tile usage policy asks. Tiles are kept in IndexedDB — on this device, never
 * in the vault — for as long as their headers allow and a week at least, so a
 * map opened twice asks once. A few at a time, never in bulk.
 */
export function openStreetMapTiles(version: string): TileSource {
	const agent = tileUserAgent(version);
	return {
		attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxZoom: 19,
		async load(z, x, y, signal) {
			const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
			const kept = await cached(url);
			if (kept) return URL.createObjectURL(new Blob([kept.bytes], { type: kept.type }));
			const res = await queued(signal, () => requestUrl({ url, headers: { "User-Agent": agent }, throw: false }));
			if (res.status !== 200) throw new Error(`tile ${z}/${x}/${y}: HTTP ${res.status}`);
			const type = res.headers["content-type"] ?? res.headers["Content-Type"] ?? "image/png";
			const bytes = res.arrayBuffer;
			void keep({ url, type, bytes, expires: Date.now() + keepFor(res.headers) * 1000, used: Date.now() });
			return URL.createObjectURL(new Blob([bytes], { type }));
		},
		release(url) {
			URL.revokeObjectURL(url);
		},
	};
}

/* ------------------------------------------------------------------ */
/*  A few requests at a time                                           */
/* ------------------------------------------------------------------ */

const CONCURRENT = 4;
let active = 0;
const waiting: Array<() => void> = [];

/** Runs `request` when a slot is free; a tile unwanted before then never asks. */
async function queued<T>(signal: AbortSignal | undefined, request: () => Promise<T>): Promise<T> {
	if (active >= CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
	active += 1;
	try {
		if (signal?.aborted) throw new DOMException("tile no longer wanted", "AbortError");
		return await request();
	} finally {
		active -= 1;
		waiting.shift()?.();
	}
}

/* ------------------------------------------------------------------ */
/*  The tile cache                                                     */
/* ------------------------------------------------------------------ */

interface KeptTile {
	url: string;
	type: string;
	bytes: ArrayBuffer;
	/** Epoch ms after which it is fetched again. */
	expires: number;
	/** Epoch ms it was last drawn: the oldest go first. */
	used: number;
}

const DB_NAME = "garmin-connect-map-tiles";
const STORE = "tiles";
/** About 50 MB of OpenStreetMap tiles. */
const MAX_TILES = 2500;

let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
	db ??= new Promise((resolve) => {
		if (typeof indexedDB === "undefined") return resolve(null);
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const store = req.result.createObjectStore(STORE, { keyPath: "url" });
			store.createIndex("used", "used");
		};
		req.onsuccess = () => resolve(req.result);
		// No cache is a slower map, not a broken one.
		req.onerror = () => resolve(null);
	});
	return db;
}

async function cached(url: string): Promise<KeptTile | null> {
	const handle = await open();
	if (!handle) return null;
	const tile = await new Promise<KeptTile | null>((resolve) => {
		const req = handle.transaction(STORE).objectStore(STORE).get(url);
		req.onsuccess = () => resolve((req.result as KeptTile | undefined) ?? null);
		req.onerror = () => resolve(null);
	});
	if (!tile || tile.expires < Date.now()) return null;
	void keep({ ...tile, used: Date.now() }, false);
	return tile;
}

async function keep(tile: KeptTile, evict = true): Promise<void> {
	const handle = await open();
	if (!handle) return;
	await new Promise<void>((resolve) => {
		const tx = handle.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(tile);
		tx.oncomplete = () => resolve();
		tx.onerror = () => resolve();
	});
	if (evict) await trim(handle);
}

/** Drops the least recently drawn tiles once there are more than `MAX_TILES`. */
async function trim(handle: IDBDatabase): Promise<void> {
	await new Promise<void>((resolve) => {
		const tx = handle.transaction(STORE, "readwrite");
		const store = tx.objectStore(STORE);
		const count = store.count();
		count.onsuccess = () => {
			let extra = count.result - MAX_TILES;
			if (extra <= 0) return;
			const cursor = store.index("used").openCursor();
			cursor.onsuccess = () => {
				const at = cursor.result;
				if (!at || extra <= 0) return;
				at.delete();
				extra -= 1;
				at.continue();
			};
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => resolve();
	});
}
