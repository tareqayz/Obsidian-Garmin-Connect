/**
 * The versions of what the pages read, moved when the files behind them
 * change, and the reads held for as long as a version holds. Pure: the timers,
 * the clock and when a move has to wait come in through `VersionsHost`.
 *
 * A sync writes a year file and its meta together, so a move waits for the
 * burst of file events to settle (`SETTLE_MS`). While a sync or the history
 * download writes, moves wait their turn (`rebuildAt`), and the end of a sync
 * lets go of what it held (`syncEnded`).
 */

/** The series files' key: any day's. */
export const SERIES = "#series";
/** The day files' key. */
export const DAYS = "#days";
/** `account.json`'s key. */
export const ACCOUNT = "#account";
/** The activity index's key. */
export const ACTIVITIES = "#activities";

/** One day's series file: `#series:2026-10-28`. */
export function seriesKey(date: string): string {
	return `${SERIES}:${date}`;
}

/** The activity details' key: any activity's. */
export const ACTIVITY = "#activity";

/** One activity's details file: `#activity:20612345678`. */
export function activityKey(id: number): string {
	return `${ACTIVITY}:${id}`;
}

/** How long a burst of file events gets to settle before a version moves. */
export const SETTLE_MS = 150;

export interface VersionsHost {
	/** When the next move may come, given when the last one came (`rebuildAt`), or null: once the burst settles. */
	holdUntil(last: number): number | null;
	/** A key's version moved. */
	moved(key: string, version: number): void;
	now(): number;
	setTimeout(run: () => void, ms: number): number;
	clearTimeout(id: number): void;
}

export class DataVersions {
	private versions = new Map<string, number>();
	private timers = new Map<string, number>();
	/** When each version last moved: while a backfill writes, a key waits its turn. */
	private movedAt = new Map<string, number>();
	/** What was read, by key, for as long as its version holds. */
	private cache = new Map<string, { version: number; data: Promise<unknown> }>();

	constructor(private readonly host: VersionsHost) {}

	version(key: string): number {
		return this.versions.get(key) ?? 0;
	}

	/** A read once per version of `key`, shared by everyone asking: a failed one is tried again on the next ask. */
	cached<T>(key: string, load: () => Promise<T>): Promise<T> {
		const version = this.version(key);
		const hit = this.cache.get(key);
		if (hit?.version === version) return hit.data as Promise<T>;
		const data = load();
		this.cache.set(key, { version, data });
		data.catch(() => {
			if (this.cache.get(key)?.data === data) this.cache.delete(key);
		});
		return data;
	}

	/**
	 * Moves one version, once a burst of file events settles: a sync writes a
	 * year file and the meta together. While a backfill writes, at most every
	 * `REBUILD_EVERY_MS`, and while a sync writes, once it ends (`rebuildAt`).
	 */
	bump(key: string): void {
		this.cache.delete(key);
		const fire = () => {
			this.timers.delete(key);
			this.cache.delete(key);
			this.movedAt.set(key, this.host.now());
			const version = this.version(key) + 1;
			this.versions.set(key, version);
			this.host.moved(key, version);
		};
		const hold = this.host.holdUntil(this.movedAt.get(key) ?? 0);
		if (hold !== null) {
			if (this.timers.has(key)) return;
			this.timers.set(key, this.host.setTimeout(fire, Math.max(SETTLE_MS, hold - this.host.now())));
			return;
		}
		const timer = this.timers.get(key);
		if (timer !== undefined) this.host.clearTimeout(timer);
		this.timers.set(key, this.host.setTimeout(fire, SETTLE_MS));
	}

	/** A sync ended: what it held back goes now, once the last of its events settle. */
	syncEnded(): void {
		for (const [key, timer] of [...this.timers]) {
			this.host.clearTimeout(timer);
			this.timers.delete(key);
			this.bump(key);
		}
	}

	/** Every read let go: the data folder changed under the readers, or nothing reads any more. */
	forget(): void {
		this.cache.clear();
	}

	dispose(): void {
		for (const timer of this.timers.values()) this.host.clearTimeout(timer);
		this.timers.clear();
		this.cache.clear();
	}
}

/** What the store tells about a path in the data folder. `VaultSeriesStore` is one. */
export interface DataPaths {
	dayIndexOf(path: string): { kind: string } | undefined;
	owns(path: string): boolean;
	isSeriesPath(path: string): boolean;
	readonly dayCoveragePath: string;
	readonly detailCoveragePath: string;
	readonly sleepFolder: string;
	readonly dailyStatsFolder: string;
	readonly daysFolder: string;
	readonly accountPath: string;
	readonly activitiesFolder: string;
	readonly activityDetailsFolder: string;
}

/**
 * What a change to a vault path moves: the keys whose readers should read
 * again, and whether Home's own model is built from it (`rebuild`). A
 * registered index reaches only the pages that read it, and the coverage files
 * are the backfill's bookkeeping, read by no page.
 */
export function keysOfPath(store: DataPaths, path: string): { keys: string[]; rebuild: boolean } {
	const def = store.dayIndexOf(path);
	if (def) return { keys: [def.kind], rebuild: false };
	if (path.startsWith(`${store.activityDetailsFolder}/`)) {
		const id = /(\d+)\.json$/.exec(path)?.[1];
		return { keys: id ? [activityKey(Number(id))] : [], rebuild: false };
	}
	if (!store.owns(path)) return { keys: [], rebuild: false };
	if (path === store.dayCoveragePath || path === store.detailCoveragePath) return { keys: [], rebuild: false };
	if (store.isSeriesPath(path)) {
		const date = /(\d{4}-\d{2}-\d{2})\.json$/.exec(path)?.[1];
		return { keys: date ? [SERIES, seriesKey(date)] : [SERIES], rebuild: true };
	}
	if (path.startsWith(`${store.sleepFolder}/`)) return { keys: ["sleep"], rebuild: true };
	if (path.startsWith(`${store.dailyStatsFolder}/`)) return { keys: ["daily-stats"], rebuild: true };
	if (path.startsWith(`${store.daysFolder}/`)) return { keys: [DAYS], rebuild: true };
	if (path === store.accountPath) return { keys: [ACCOUNT], rebuild: true };
	if (path.startsWith(`${store.activitiesFolder}/`)) return { keys: [ACTIVITIES], rebuild: true };
	return { keys: [], rebuild: true };
}
