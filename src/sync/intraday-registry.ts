import type { DailyStress, GarminApi, HeartRateData } from "../garmin/endpoints";
import { GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import { epochOf, mapSeries, type DaySeries } from "./intraday";
import type { MetricGroup } from "./metrics";

/**
 * Intraday blocks a page loads on view: a day's chart for any date, not only
 * the newest days a sync spends intraday requests on (`INTRADAY_DAYS`).
 *
 * A key names a block of the day's series file. The file's own blocks keep
 * their keys (`stress`, `bodyBattery`, `heartRate`, `bodyBatteryEvents`), so
 * a page reads an old day's stress where it reads today's. A stat that needs
 * a payload of its own registers it with `defineIntraday` in
 * `intraday-extras.ts`, and its block is kept under `extra[key]`.
 *
 * `loadDay` is one day's load: whatever of the asked keys the file lacks is
 * fetched, merged in and written back. The runner queues these and runs them
 * only while nothing else is syncing (`SyncRunner.loadIntraday`).
 *
 * Pure: the API and the store are handed in.
 */

/** A stat's own day payload, kept in the series file under `extra[key]`. */
export interface IntradayDef<P = unknown, B = unknown> {
	/** Lowercase first, letters, digits and hyphens; not one of the series file's own keys. */
	key: string;
	/** The settings group whose requests it costs: nothing is fetched while it is off. */
	group: MetricGroup;
	fetch(api: GarminApi, date: string): Promise<P>;
	/** What to keep, or null when Garmin had nothing that day. */
	map(payload: P, date: string): B | null | undefined;
}

/** A load as a page gets it back. */
export interface IntradayLoad {
	/** The day's series after the load, or null when the day has no file. */
	series: DaySeries | null;
	/** Keys asked for that the day still lacks. A key fetched without data is not missing: Garmin had none. */
	missing: string[];
	/** Why `missing` is not empty. */
	reason?: IntradayMiss;
	/** What went wrong, when the reason is "failed". */
	error?: string;
}

/**
 * - `signed-out`: no session to fetch with.
 * - `off`: the block's settings group is off.
 * - `failed`: the request or the write failed; `error` says how.
 * - `unavailable`: nothing can fetch the key, or the day is still to come.
 */
export type IntradayMiss = "signed-out" | "off" | "failed" | "unavailable";

/** One request and the keys it fills. */
export interface IntradayLoader {
	/** The keys this one request fills, whatever was asked. */
	keys: readonly string[];
	group: MetricGroup;
	/** Top-level keys of the series file, or under `extra`. */
	where: "series" | "extra";
	fetch(api: GarminApi, date: string): Promise<unknown>;
	/**
	 * The payload's blocks by key; a key left out, or null, had nothing. A
	 * series key beyond `keys` only fills a gap — the day's start.
	 */
	blocks(payload: unknown, date: string): Record<string, unknown>;
}

/** Every key the series file uses itself. An extra may not take one. */
export const SERIES_KEYS: ReadonlySet<string> = new Set([
	"date",
	"version",
	"dayStart",
	"stress",
	"bodyBattery",
	"heartRate",
	"steps",
	"floors",
	"intensity",
	"sleepLevels",
	"sleep",
	"bodyBatteryEvents",
	"extra",
	"checked",
]);

/**
 * The series file's own blocks a page can load for an old day, under the
 * `intraday` group as a sync fetches them. One stress request fills both
 * stress and Body Battery. Steps, floors and intensity minutes are left to
 * their pages, which read only what a sync wrote.
 */
export const BUILT_IN_LOADERS: readonly IntradayLoader[] = [
	{
		keys: ["stress", "bodyBattery"],
		group: "intraday",
		where: "series",
		fetch: (api, date) => api.stress(date),
		blocks: (payload) => {
			const stress = (payload ?? null) as DailyStress | null;
			const series = mapSeries({ stress });
			return { stress: series.stress, bodyBattery: series.bodyBattery, dayStart: dayStartOf(stress) };
		},
	},
	{
		keys: ["heartRate"],
		group: "intraday",
		where: "series",
		fetch: (api, date) => api.heartRate(date),
		blocks: (payload) => {
			const heartRate = (payload ?? null) as HeartRateData | null;
			return { heartRate: mapSeries({ heartRate }).heartRate, dayStart: dayStartOf(heartRate) };
		},
	},
	{
		keys: ["bodyBatteryEvents"],
		group: "intraday",
		where: "series",
		fetch: (api, date) => api.bodyBatteryEvents(date),
		blocks: (payload) => ({ bodyBatteryEvents: mapSeries({ bodyBatteryEvents: Array.isArray(payload) ? payload : null }).bodyBatteryEvents }),
	},
];

/** A stat's payload, checked. Throws on a key that cannot work, so the mistake fails the build's tests. */
export function defineIntraday<P, B>(def: IntradayDef<P, B>): IntradayDef<P, B> {
	if (typeof def.key !== "string" || !KEY.test(def.key)) throw new Error(`defineIntraday: key ${JSON.stringify(def.key)} must be lowercase first, then letters, digits and hyphens`);
	if (SERIES_KEYS.has(def.key)) throw new Error(`defineIntraday: "${def.key}" is the series file's own key`);
	if (typeof def.fetch !== "function" || typeof def.map !== "function") throw new Error(`defineIntraday(${def.key}): fetch and map are required`);
	return def;
}

/** An extra as a loader: its one key, under `extra`. */
export function loaderOf(def: IntradayDef): IntradayLoader {
	return {
		keys: [def.key],
		group: def.group,
		where: "extra",
		fetch: (api, date) => def.fetch(api, date),
		blocks: (payload, date) => ({ [def.key]: def.map(payload, date) }),
	};
}

/** The requests that fill `keys`, each once, and the keys nothing can fill. */
export function loadersFor(keys: readonly string[], extras: readonly IntradayDef[]): { loaders: IntradayLoader[]; unknown: string[] } {
	const all = [...BUILT_IN_LOADERS, ...extras.map(loaderOf)];
	const loaders: IntradayLoader[] = [];
	const unknown: string[] = [];
	for (const key of keys) {
		const loader = all.find((l) => l.keys.includes(key));
		if (!loader) {
			if (!unknown.includes(key)) unknown.push(key);
		} else if (!loaders.includes(loader)) loaders.push(loader);
	}
	return { loaders, unknown };
}

/** Whether the day has `key`: its block, or a load that found Garmin had none. */
export function hasBlock(series: DaySeries | null | undefined, key: string): boolean {
	if (!series) return false;
	if (series.checked?.includes(key)) return true;
	if (SERIES_KEYS.has(key)) return (series as Record<string, unknown>)[key] !== undefined;
	return series.extra?.[key] !== undefined;
}

/** The asked keys the day lacks, each once. */
export function missingKeys(series: DaySeries | null | undefined, keys: readonly string[]): string[] {
	return [...new Set(keys)].filter((key) => !hasBlock(series, key));
}

/** One loader's answer. */
export interface LoadedBlocks {
	loader: IntradayLoader;
	blocks: Record<string, unknown>;
}

/**
 * The series with the loaded blocks in. A loader's keys take what it found
 * and are marked checked, data or not; the file's other keys keep their
 * values and their order, so the same answer makes the same text.
 */
export function mergeBlocks(series: DaySeries | null | undefined, loaded: readonly LoadedBlocks[]): DaySeries {
	const out: Record<string, unknown> = { ...(series ?? {}) };
	const extra: Record<string, unknown> = { ...(series?.extra ?? {}) };
	const checked = new Set(series?.checked ?? []);
	for (const { loader, blocks } of loaded) {
		const target = loader.where === "extra" ? extra : out;
		for (const key of loader.keys) {
			checked.add(key);
			const value = blocks[key];
			if (value === undefined || value === null) delete target[key];
			else target[key] = value;
		}
		if (loader.where !== "series") continue;
		for (const [key, value] of Object.entries(blocks)) {
			if (loader.keys.includes(key) || value === undefined || value === null || !SERIES_KEYS.has(key)) continue;
			if (out[key] === undefined) out[key] = value;
		}
	}
	if (Object.keys(extra).length) out.extra = extra;
	else delete out.extra;
	out.checked = [...checked].sort();
	return out as DaySeries;
}

/** Where a day's series is read from and written to. `VaultSeriesStore` in the plugin. */
export interface DaySeriesStore {
	read(date: string): Promise<DaySeries | null>;
	/** Skips the write when the text would not change. */
	write(date: string, series: DaySeries): Promise<"written" | "unchanged">;
}

export interface LoadDayOptions {
	signedIn: boolean;
	groups: readonly MetricGroup[];
	/** The registered extras: `INTRADAY_EXTRAS`. */
	extras: readonly IntradayDef[];
	/** No day after this one is asked for. */
	today: string;
}

/**
 * Loads one day: reads its series file, fetches what of `keys` it lacks,
 * merges that in and writes the file back. `fatal` is a 429 or a dead
 * session, which every later load would hit too.
 */
export async function loadDay(
	api: GarminApi,
	store: DaySeriesStore,
	date: string,
	keys: readonly string[],
	opts: LoadDayOptions,
): Promise<IntradayLoad & { fatal?: unknown }> {
	const before = DATE.test(date) ? await store.read(date) : null;
	const wanted = missingKeys(before, keys);
	if (!wanted.length) return { series: before, missing: [] };
	if (!DATE.test(date) || date > opts.today) return { series: before, missing: wanted, reason: "unavailable" };
	const { loaders } = loadersFor(wanted, opts.extras);
	const allowed = loaders.filter((l) => opts.groups.includes(l.group));
	if (!allowed.length) return { series: before, missing: wanted, reason: loaders.length ? "off" : "unavailable" };
	if (!opts.signedIn) return { series: before, missing: wanted, reason: "signed-out" };

	const settled = await Promise.allSettled(allowed.map((l) => l.fetch(api, date)));

	const loaded: LoadedBlocks[] = [];
	let fatal: unknown;
	let error: string | undefined;
	settled.forEach((result, i) => {
		const loader = allowed[i]!;
		if (result.status === "rejected") {
			if (isFatal(result.reason)) {
				if (fatal === undefined) fatal = result.reason;
			} else if (error === undefined) error = message(result.reason);
			return;
		}
		try {
			loaded.push({ loader, blocks: loader.blocks(result.value, date) });
		} catch (err) {
			if (error === undefined) error = message(err);
		}
	});

	let series = before;
	if (loaded.length) {
		const merged = mergeBlocks(before, loaded);
		try {
			await store.write(date, merged);
			series = merged;
		} catch (err) {
			if (error === undefined) error = `series file: ${message(err)}`;
		}
	}

	const missing = missingKeys(series, keys);
	if (!missing.length) return { series, missing };
	if (fatal !== undefined) return { series, missing, reason: "failed", error: message(fatal), fatal };
	if (error !== undefined) return { series, missing, reason: "failed", error };
	return { series, missing, reason: allowed.length < loaders.length ? "off" : "unavailable" };
}

/**
 * Loads waiting for the runner, one job a day: asking again for a day that is
 * still waiting joins its job, and both callers get the one answer.
 */
export class DayJobs<R> {
	private waiting = new Map<string, { keys: Set<string>; promise: Promise<R>; resolve: (result: R) => void }>();

	get size(): number {
		return this.waiting.size;
	}

	add(date: string, keys: readonly string[]): Promise<R> {
		const job = this.waiting.get(date);
		if (job) {
			for (const key of keys) job.keys.add(key);
			return job.promise;
		}
		let resolve!: (result: R) => void;
		const promise = new Promise<R>((r) => (resolve = r));
		this.waiting.set(date, { keys: new Set(keys), promise, resolve });
		return promise;
	}

	/** The job that has waited longest, out of the queue. */
	take(): { date: string; keys: string[]; resolve: (result: R) => void } | undefined {
		const first = this.waiting.entries().next();
		if (first.done) return undefined;
		const [date, job] = first.value;
		this.waiting.delete(date);
		return { date, keys: [...job.keys], resolve: job.resolve };
	}
}

/* ------------------------------------------------------------------ */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z][A-Za-z0-9-]*$/;

/** Midnight on the watch's clock, as these payloads send it. */
function dayStartOf(payload: unknown): number | undefined {
	return payload && typeof payload === "object" ? epochOf((payload as Record<string, unknown>).startTimestampGMT) : undefined;
}

/** Errors that make every later request pointless. */
function isFatal(err: unknown): boolean {
	return err instanceof GarminRateLimitError || err instanceof GarminAuthError;
}

function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
