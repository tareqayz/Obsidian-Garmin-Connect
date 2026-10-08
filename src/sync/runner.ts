import { Notice, TFile, normalizePath, type App } from "obsidian";
import type { GarminApi } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { GarminAuthError, GarminBlockedError, GarminRateLimitError } from "../garmin/errors";
import type { Log } from "../log";
import { basesView } from "./bases-view";
import { DailyNoteTarget, resolveDailyNoteOptions } from "./daily-note";
import { DataFolderTarget } from "./data-folder";
import type { DayIndexDef, IndexHistoryProgress } from "./day-index";
import { DAY_INDEXES, dayIndex } from "./day-indexes";
import {
	MultiTarget,
	fetchAllActivities,
	fetchDailyStatsHistory,
	fetchSleepHistory,
	lastNDays,
	syncRange,
	walkHistory,
	type DailyStatsSink,
	type DayIndexRuntime,
	type NoteTarget,
	type SleepSink,
	type SyncReport,
} from "./engine";
import { ensureFolder, trimSlashes } from "./frontmatter";
import { fetchAccount } from "./account";
import { INTRADAY_EXTRAS } from "./intraday-extras";
import { DayJobs, loadDay, type IntradayLoad } from "./intraday-registry";
import { linkTargetFor, type LinkOption } from "./link";
import type { MetricGroup } from "./metrics";
import { etaSeconds, fraction, formatEta, type SyncProgress } from "./progress";
import { VaultSeriesStore } from "./series-store";

export type StorageMode = "dataFolder" | "dailyNotes" | "both";

export interface RunnerSettings {
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	storageMode: StorageMode;
	dataFolder: string;
	dataFolderPrefix: string;
	createBasesView: boolean;
	basesFolder: string;

	linkToBase: boolean;
	linkProperty: string;

	prefix: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	createMissingNotes: boolean;

	pauseBetweenDays: number;
	stopAfterEmptyDays: number;
}

const BASES_FILE = "Garmin Health.base";

/** Activities per request when paging the whole history. The list honours 100. */
const HISTORY_PAGE = 100;

/** A history sync in progress, for the Activities pages' banner. */
export interface HistoryProgress {
	fetched: number;
	/** How many the list holds, when the count came back. */
	total?: number;
}

export interface HistoryReport {
	fetched: number;
	complete: boolean;
	requests: number;
	stoppedEarly?: string;
}

/** A daily stats history sync in progress, for the Steps, Floors and Intensity Minutes pages' banner. */
export interface StatsHistoryProgress {
	/** The oldest day fetched so far, once the first window is in. */
	reached?: string;
}

/** A sleep history sync in progress, for the Sleep page's banner. */
export interface SleepHistoryProgress {
	/** The oldest day fetched so far, once the first window is in. */
	reached?: string;
}

/**
 * Turns settings into a sync run and reports it.
 *
 * The engine itself knows nothing about Obsidian; this is where the two meet.
 */
export class SyncRunner {
	private app: App;
	private api: GarminApi;
	private settings: () => RunnerSettings;
	private unitsCache: "metric" | "imperial" | null = null;
	private busy = false;
	/** The automatic history walks are under way, one after the other. */
	private chainActive = false;
	/** On-view intraday loads waiting for the runner to be free, one job a day. */
	private intradayJobs = new DayJobs<IntradayLoad>();
	private draining = false;
	/** The history sync starts itself once a session, after the first sync, until it has finished once. */
	private historyTried = false;
	private historyState: HistoryProgress | null = null;
	private historyListeners = new Set<(progress: HistoryProgress | null) => void>();
	private statsHistoryState: StatsHistoryProgress | null = null;
	private statsHistoryListeners = new Set<(progress: StatsHistoryProgress | null) => void>();
	private sleepHistoryState: SleepHistoryProgress | null = null;
	private sleepHistoryListeners = new Set<(progress: SleepHistoryProgress | null) => void>();
	private indexHistoryState = new Map<string, IndexHistoryProgress>();
	private indexHistoryListeners = new Set<(kind: string, progress: IndexHistoryProgress | null) => void>();

	constructor(app: App, api: GarminApi, settings: () => RunnerSettings) {
		this.app = app;
		this.api = api;
		this.settings = settings;
	}

	get isRunning(): boolean {
		return this.running;
	}

	/**
	 * One thing talks to Garmin at a time. Whatever waited for the runner —
	 * an on-view intraday load — gets its turn once the current work is done,
	 * on a later task, so a sync that hands over to the history walks keeps
	 * the runner until they are done.
	 */
	private get running(): boolean {
		return this.busy;
	}

	private set running(value: boolean) {
		this.busy = value;
		if (!value && this.intradayJobs.size) window.setTimeout(() => this.kickIntraday(), 0);
	}

	syncRecent(log?: Log): Promise<SyncReport | null> {
		const { from, to } = lastNDays(this.settings().syncDays, toIsoDate());
		return this.run(from, to, log);
	}

	syncToday(log?: Log): Promise<SyncReport | null> {
		const today = toIsoDate();
		return this.run(today, today, log);
	}

	/** The history sync in progress, or null. */
	get historyProgress(): HistoryProgress | null {
		return this.historyState;
	}

	/** Called with each step of a history sync, and with null when it ends. Returns the unsubscribe. */
	onHistory(listener: (progress: HistoryProgress | null) => void): () => void {
		this.historyListeners.add(listener);
		return () => this.historyListeners.delete(listener);
	}

	/** The daily stats history sync in progress, or null. */
	get statsHistoryProgress(): StatsHistoryProgress | null {
		return this.statsHistoryState;
	}

	/** Called with each window of a daily stats history sync, and with null when it ends. Returns the unsubscribe. */
	onStatsHistory(listener: (progress: StatsHistoryProgress | null) => void): () => void {
		this.statsHistoryListeners.add(listener);
		return () => this.statsHistoryListeners.delete(listener);
	}

	/** The sleep history sync in progress, or null. */
	get sleepHistoryProgress(): SleepHistoryProgress | null {
		return this.sleepHistoryState;
	}

	/** Called with each window of a sleep history sync, and with null when it ends. Returns the unsubscribe. */
	onSleepHistory(listener: (progress: SleepHistoryProgress | null) => void): () => void {
		this.sleepHistoryListeners.add(listener);
		return () => this.sleepHistoryListeners.delete(listener);
	}

	/** The registered day indexes' history walks in progress, by kind. */
	get indexHistoryProgress(): Record<string, IndexHistoryProgress> {
		return Object.fromEntries(this.indexHistoryState);
	}

	/** Called with each window of a registered index's history walk, and with null when it ends. Returns the unsubscribe. */
	onIndexHistory(listener: (kind: string, progress: IndexHistoryProgress | null) => void): () => void {
		this.indexHistoryListeners.add(listener);
		return () => this.indexHistoryListeners.delete(listener);
	}

	async run(from: string, to: string, log?: Log): Promise<SyncReport | null> {
		const report = await this.runDays(from, to, log);
		// Not awaited: Home's sync button should not spin through the history
		// requests. Skipped after a 429 or a dead session, as the account is.
		// One after the other, since a sync refuses to start while one runs.
		if (report && !report.stoppedEarly && !this.historyTried) {
			this.historyTried = true;
			const groups = this.settings().groups;
			// Between walks, a page waiting on an intraday load gets its day first.
			void (async () => {
				this.chainActive = true;
				try {
					if (groups.includes("workouts")) await this.syncActivityHistory({ auto: true, log });
					await this.drainIntraday();
					if (groups.includes("activity")) await this.syncDailyStatsHistory({ auto: true, log });
					await this.drainIntraday();
					if (groups.includes("sleep")) await this.syncSleepHistory({ auto: true, log });
					for (const def of DAY_INDEXES) {
						await this.drainIntraday();
						if (groups.includes(def.group)) await this.syncIndexHistory(def.kind, { auto: true, log });
					}
				} finally {
					this.chainActive = false;
					void this.drainIntraday();
				}
			})();
		}
		return report;
	}

	private async runDays(from: string, to: string, log?: Log): Promise<SyncReport | null> {
		if (this.running) {
			new Notice("A Garmin sync is already running.");
			return null;
		}
		if (!this.api.isAuthenticated) {
			new Notice("Sign in to Garmin Connect first.");
			return null;
		}

		const settings = this.settings();
		const startedAt = Date.now();
		const notice = new Notice(noticeBody({ done: 0, total: 0, date: null, eta: null }), 0);
		this.running = true;
		try {
			const units = await this.resolveUnits(settings.units);
			const series = new VaultSeriesStore(this.app, settings.dataFolder);
			const report = await syncRange(this.api, this.buildTarget(settings), {
				from,
				to,
				groups: settings.groups,
				units,
				series,
				activities: { merge: (listing, complete) => series.mergeActivities(listing, { complete, units }) },
				dailyStats: dailyStatsSink(series),
				sleep: sleepSink(series),
				indexes: DAY_INDEXES.map((def) => this.indexRuntime(series, def)),
				pauseBetweenDays: settings.pauseBetweenDays,
				stopAfterEmptyDays: settings.stopAfterEmptyDays,
				log,
				onProgress: (done, total, date) => {
					notice.setMessage(
						noticeBody({
							done,
							total,
							date,
							eta: etaSeconds(Date.now() - startedAt, done, total),
						}),
					);
				},
			});
			notice.hide();

			// Once per sync, not per day: who you are, the watch, and the numbers
			// Garmin only serves as "latest". Skipped after a 429 or a dead
			// session, which every one of these calls would hit too.
			if (settings.groups.includes("profile") && !report.stoppedEarly) {
				const got = await fetchAccount(this.api, toIsoDate(), units, log);
				report.requests += got.requests;
				report.warnings.push(...got.warnings.map((w) => `account ${w}`));
				if (got.account) {
					try {
						await series.writeAccount(got.account);
					} catch (err) {
						log?.warn(`account file failed: ${explain(err)}`);
					}
				}
			}

			// Only worth creating once there is something for it to show.
			if (report.written > 0) await this.ensureBasesView(settings, units);

			new Notice(describe(report), report.failed || report.stoppedEarly ? 10000 : 5000);
			return report;
		} catch (err) {
			notice.hide();
			new Notice(`Garmin sync failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
		}
	}

	/**
	 * Fills the activity index with the whole history: about one request per
	 * hundred activities, paged with the usual pause. Routine syncs keep it
	 * current from then on with the one page they already fetch.
	 *
	 * `auto` is the run a sync starts by itself: silent when the index is
	 * already complete or another sync is running.
	 */
	async syncActivityHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (this.running) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		this.running = true;
		const notice = auto ? null : new Notice(historyBody({ fetched: 0 }), 0);
		try {
			if (auto && (await store.readActivities()).meta?.complete) return null;
			this.setHistory({ fetched: 0 });
			const units = await this.resolveUnits(settings.units);
			let requests = 0;

			// Only to say "n of N" while it runs; the list itself decides when it ends.
			let total: number | undefined;
			try {
				requests += 1;
				const count = await this.api.activityCount();
				if (typeof count.totalCount === "number") total = Math.max(0, count.totalCount - (count.multisportChildCount ?? 0));
			} catch (err) {
				if (err instanceof GarminRateLimitError || err instanceof GarminAuthError) throw err;
				log?.warn(`activity count failed: ${explain(err)}`);
			}
			this.setHistory({ fetched: 0, total });
			notice?.setMessage(historyBody({ fetched: 0, total }));

			const got = await fetchAllActivities(this.api, {
				pageSize: HISTORY_PAGE,
				pause: settings.pauseBetweenDays,
				onPage: (fetched) => {
					this.setHistory({ fetched, total });
					notice?.setMessage(historyBody({ fetched, total }));
				},
			});
			requests += got.requests;

			// Even cut short, what came back is the newest stretch with no gaps,
			// which is what a routine sync merges too.
			await store.mergeActivities(got.activities, {
				complete: got.complete,
				units,
				...(total !== undefined ? { total } : got.complete ? { total: got.activities.length } : {}),
			});
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			log?.detail("activity history", `${got.activities.length} activities, ${requests} requests`);
			if (!auto || stoppedEarly) {
				new Notice(
					stoppedEarly
						? `Garmin activity history: ${got.activities.length} fetched — stopped: ${stoppedEarly}`
						: `Garmin activity history: ${got.activities.length} activities`,
					stoppedEarly ? 10000 : 5000,
				);
			}
			return { fetched: got.activities.length, complete: got.complete, requests, ...(stoppedEarly ? { stoppedEarly } : {}) };
		} catch (err) {
			notice?.hide();
			new Notice(`Garmin activity history failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
			this.setHistory(null);
		}
	}

	private setHistory(progress: HistoryProgress | null): void {
		this.historyState = progress;
		for (const listener of this.historyListeners) listener(progress);
	}

	/**
	 * Fills the daily stats index — steps, floors and intensity minutes — back
	 * to the start of the account's history: three requests per 28 days, about
	 * 40 for a year. Routine syncs keep it current from then on with the daily
	 * summaries they already fetch. A run cut short keeps what it fetched and
	 * carries on from there next time.
	 *
	 * `auto` is the run a sync starts by itself: silent when the index is
	 * already complete or another sync is running.
	 */
	async syncDailyStatsHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (this.running) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		this.running = true;
		const notice = auto ? null : new Notice(statsHistoryBody({}), 0);
		try {
			const meta = await store.readDailyStatsMeta();
			if (meta?.complete) {
				notice?.hide();
				if (!auto) new Notice("Garmin step, floor and intensity history is already complete.");
				return null;
			}
			this.setStatsHistory({});

			// Carry on below what the index already holds; routine syncs keep its top current.
			const until = meta?.from ? shiftDay(meta.from, -1) : toIsoDate();
			const oldestActivity = (await store.readActivities()).rows.at(-1)?.start.slice(0, 10);
			const got = await fetchDailyStatsHistory(this.api, {
				until,
				...(oldestActivity ? { notBefore: oldestActivity } : {}),
				pause: settings.pauseBetweenDays,
				onWindow: (reached) => {
					this.setStatsHistory({ reached });
					notice?.setMessage(statsHistoryBody({ reached }));
				},
			});

			// Even cut short, what came back runs unbroken from where it started.
			if (got.batch.dates.length) await store.mergeDailyStats(got.batch, { covered: got.covered, complete: got.complete });
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const days = got.batch.rows.length;
			log?.detail("daily stats history", `${days} days, ${got.requests} requests`);
			if (!auto || stoppedEarly) {
				new Notice(
					stoppedEarly
						? `Garmin step, floor and intensity history: ${days} days fetched — stopped: ${stoppedEarly}`
						: `Garmin step, floor and intensity history: ${days} days`,
					stoppedEarly ? 10000 : 5000,
				);
			}
			return { fetched: days, complete: got.complete, requests: got.requests, ...(stoppedEarly ? { stoppedEarly } : {}) };
		} catch (err) {
			notice?.hide();
			new Notice(`Garmin step, floor and intensity history failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
			this.setStatsHistory(null);
		}
	}

	private setStatsHistory(progress: StatsHistoryProgress | null): void {
		this.statsHistoryState = progress;
		for (const listener of this.statsHistoryListeners) listener(progress);
	}

	/**
	 * Fills the sleep index with the whole history: about 14 requests a year,
	 * 28 nights each, with the usual pause. Routine syncs keep its top current.
	 *
	 * `auto` is the run a sync starts by itself: silent when the index is
	 * already complete or another sync is running.
	 */
	async syncSleepHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (this.running) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		this.running = true;
		const notice = auto ? null : new Notice(historyNotice("Garmin sleep history", {}), 0);
		try {
			const meta = await store.readSleepMeta();
			if (meta?.complete) {
				notice?.hide();
				if (!auto) new Notice("Garmin sleep history is already complete.");
				return null;
			}
			this.setSleepHistory({});

			// Carry on below what the index already holds; routine syncs keep its top current.
			const until = meta?.from ? shiftDay(meta.from, -1) : toIsoDate();
			const oldestActivity = (await store.readActivities()).rows.at(-1)?.start.slice(0, 10);
			const got = await fetchSleepHistory(this.api, {
				until,
				...(oldestActivity ? { notBefore: oldestActivity } : {}),
				pause: settings.pauseBetweenDays,
				onWindow: (reached) => {
					this.setSleepHistory({ reached });
					notice?.setMessage(historyNotice("Garmin sleep history", { reached }));
				},
			});

			if (got.batch.dates.length) await store.mergeSleep(got.batch, { covered: got.covered, complete: got.complete });
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const nights = got.batch.rows.length;
			log?.detail("sleep history", `${nights} nights, ${got.requests} requests`);
			if (!auto || stoppedEarly) {
				new Notice(
					stoppedEarly ? `Garmin sleep history: ${nights} nights fetched — stopped: ${stoppedEarly}` : `Garmin sleep history: ${nights} nights`,
					stoppedEarly ? 10000 : 5000,
				);
			}
			return { fetched: nights, complete: got.complete, requests: got.requests, ...(stoppedEarly ? { stoppedEarly } : {}) };
		} catch (err) {
			notice?.hide();
			new Notice(`Garmin sleep history failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
			this.setSleepHistory(null);
		}
	}

	private setSleepHistory(progress: SleepHistoryProgress | null): void {
		this.sleepHistoryState = progress;
		for (const listener of this.sleepHistoryListeners) listener(progress);
	}

	/**
	 * Fills a registered day index with its whole history, `windowDays` a
	 * request with the usual pause, back to where its history starts or as far
	 * as Garmin keeps it. Routine syncs keep its top current. A walk cut short
	 * keeps what it fetched and carries on from there next time.
	 *
	 * `auto` is the run a sync starts by itself: silent when the index is
	 * already complete or another sync is running.
	 */
	async syncIndexHistory(kind: string, opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		const def = dayIndex(kind);
		if (!def) return null;
		const label = `Garmin ${def.title} history`;
		if (this.running) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		this.running = true;
		const notice = auto ? null : new Notice(historyNotice(label, {}), 0);
		try {
			const meta = await store.readDayIndexMeta(def);
			if (meta?.complete) {
				notice?.hide();
				if (!auto) new Notice(`${label} is already complete.`);
				return null;
			}
			this.setIndexHistory(kind, {});

			// Carry on below what the index already holds; routine syncs keep its top current.
			const today = toIsoDate();
			const until = meta?.from ? shiftDay(meta.from, -1) : today;
			const oldestActivity = (await store.readActivities()).rows.at(-1)?.start.slice(0, 10);
			const got = await walkHistory(def, (start, end) => def.fetchWindow(this.api, start, end), {
				until,
				today,
				...(oldestActivity ? { notBefore: oldestActivity } : {}),
				pause: settings.pauseBetweenDays,
				onWindow: (reached) => {
					this.setIndexHistory(kind, { reached });
					notice?.setMessage(historyNotice(label, { reached }));
				},
			});

			// Even cut short, what came back runs unbroken from where it started.
			if (got.batch.dates.length || got.complete) {
				await store.mergeDayIndex(def, got.batch, { covered: got.covered, complete: got.complete });
			}
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const days = got.batch.rows.length;
			log?.detail(`${def.kind} history`, `${days} days, ${got.requests} requests`);
			if (!auto || stoppedEarly) {
				new Notice(stoppedEarly ? `${label}: ${days} days fetched — stopped: ${stoppedEarly}` : `${label}: ${days} days`, stoppedEarly ? 10000 : 5000);
			}
			return { fetched: days, complete: got.complete, requests: got.requests, ...(stoppedEarly ? { stoppedEarly } : {}) };
		} catch (err) {
			notice?.hide();
			new Notice(`${label} failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
			this.setIndexHistory(kind, null);
		}
	}

	private setIndexHistory(kind: string, progress: IndexHistoryProgress | null): void {
		if (progress) this.indexHistoryState.set(kind, progress);
		else this.indexHistoryState.delete(kind);
		for (const listener of this.indexHistoryListeners) listener(kind, progress);
	}

	/** A registered index as the engine feeds it: the store's files, and the window fetch bound to this account. */
	private indexRuntime(store: VaultSeriesStore, def: DayIndexDef): DayIndexRuntime {
		return {
			def,
			sink: {
				coverage: () => store.readDayIndexMeta(def),
				merge: (batch, covered) => store.mergeDayIndex(def, batch, { covered }),
			},
			fetchWindow: (start, end) => def.fetchWindow(this.api, start, end),
		};
	}

	/* ---------------------------------------------------------------- */
	/*  Intraday on view                                                 */
	/* ---------------------------------------------------------------- */

	/**
	 * A day's intraday blocks for a page: whatever of `keys` the day's series
	 * file lacks is fetched, merged into the file and handed back. The file's
	 * own blocks (`stress`, `bodyBattery`, `heartRate`, `bodyBatteryEvents`)
	 * load for any day this way, and so does every registered extra
	 * (`intraday-extras.ts`).
	 *
	 * Never alongside a sync: the load waits for the runner, and asking again
	 * for a day already waiting joins that load. Without a session, or with
	 * the blocks' group off, it resolves at once with what the file has and
	 * says why the rest is missing. It never rejects.
	 */
	async loadIntraday(date: string, keys: readonly string[]): Promise<IntradayLoad> {
		// Most views find the file has it all; those never wait for a sync.
		let now: IntradayLoad;
		try {
			now = withoutFatal(await this.loadDayFor(date, keys, false));
		} catch (err) {
			return { series: null, missing: [...new Set(keys)], reason: "failed", error: explain(err) };
		}
		if (!now.missing.length || now.reason !== "signed-out" || !this.api.isAuthenticated) return now;
		const pending = this.intradayJobs.add(date, keys);
		this.kickIntraday();
		return pending;
	}

	/** One day's load. With `fetch` false, only what the file has and why the rest is missing. */
	private async loadDayFor(date: string, keys: readonly string[], fetch: boolean): Promise<IntradayLoad & { fatal?: unknown }> {
		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		return loadDay(this.api, store, date, keys, {
			signedIn: fetch && this.api.isAuthenticated,
			groups: settings.groups,
			extras: INTRADAY_EXTRAS,
			today: toIsoDate(),
		});
	}

	private kickIntraday(): void {
		if (this.running || this.chainActive || this.draining || !this.intradayJobs.size) return;
		void this.drainIntraday();
	}

	/**
	 * Runs the waiting loads one day at a time, holding the runner, with the
	 * usual pause between days. A sync that starts in a pause goes first; the
	 * rest wait for it. A 429 or a dead session answers every load still
	 * waiting without asking Garmin again.
	 */
	private async drainIntraday(): Promise<void> {
		if (this.draining) return;
		this.draining = true;
		try {
			for (let first = true; !this.running && this.intradayJobs.size; first = false) {
				const pause = this.settings().pauseBetweenDays;
				if (!first && pause > 0) {
					await pauseFor(pause);
					if (this.running) break;
				}
				const job = this.intradayJobs.take();
				if (!job) break;
				this.running = true;
				let fatal: unknown;
				try {
					const load = await this.loadDayFor(job.date, job.keys, true);
					fatal = load.fatal;
					job.resolve(fatal === undefined ? withoutFatal(load) : { ...withoutFatal(load), error: explain(fatal) });
				} catch (err) {
					job.resolve({ series: null, missing: [...job.keys], reason: "failed", error: explain(err) });
				} finally {
					this.running = false;
				}
				if (fatal === undefined) continue;
				for (let rest = this.intradayJobs.take(); rest; rest = this.intradayJobs.take()) {
					const now = await this.loadDayFor(rest.date, rest.keys, false).catch(() => null);
					const series = now?.series ?? null;
					const missing = now ? now.missing : [...rest.keys];
					rest.resolve(missing.length ? { series, missing, reason: "failed", error: explain(fatal) } : { series, missing });
				}
			}
		} finally {
			this.draining = false;
		}
	}

	private buildTarget(settings: RunnerSettings): NoteTarget {
		const link = this.linkOption(settings);
		const dataFolder = () =>
			new DataFolderTarget(this.app, {
				folder: settings.dataFolder,
				prefix: settings.dataFolderPrefix,
				link,
			});
		const dailyNotes = () =>
			new DailyNoteTarget(
				this.app,
				resolveDailyNoteOptions(this.app, {
					folder: settings.dailyNoteFolder,
					format: settings.dailyNoteFormat,
					createIfMissing: settings.createMissingNotes,
					prefix: settings.prefix,
					link,
				}),
			);

		switch (settings.storageMode) {
			case "dailyNotes":
				return dailyNotes();
			case "both":
				return new MultiTarget([dataFolder(), dailyNotes()]);
			default:
				return dataFolder();
		}
	}

	/* ---------------------------------------------------------------- */
	/*  Bases view                                                       */
	/* ---------------------------------------------------------------- */

	/**
	 * The link every day note points at, or nothing.
	 *
	 * Pointless without the view it links to, so a mode that never creates one
	 * gets no link rather than a property resolving to a missing file.
	 */
	linkOption(settings = this.settings()): LinkOption | undefined {
		if (!settings.linkToBase || !settings.linkProperty) return undefined;
		if (settings.storageMode === "dailyNotes" || !settings.createBasesView) return undefined;
		return { property: settings.linkProperty, target: linkTargetFor(this.basesPath(settings)) };
	}

	basesPath(settings = this.settings()): string {
		const folder = trimSlashes(settings.basesFolder);
		return normalizePath(folder ? `${folder}/${BASES_FILE}` : BASES_FILE);
	}

	/**
	 * Creates the table view if it is not there. Never overwrites: once you have
	 * adjusted columns or filters, a sync must not undo that.
	 */
	async ensureBasesView(
		settings = this.settings(),
		units?: "metric" | "imperial",
	): Promise<"created" | "exists" | "skipped"> {
		if (settings.storageMode === "dailyNotes" || !settings.createBasesView) return "skipped";
		const path = this.basesPath(settings);
		if (this.app.vault.getAbstractFileByPath(path)) return "exists";

		const base = trimSlashes(settings.basesFolder);
		if (base) await ensureFolder(this.app, base);
		await this.app.vault.create(
			path,
			basesView({
				// The filter follows the notes, which need not sit beside the view.
				folder: trimSlashes(settings.dataFolder) || "/",
				prefix: settings.dataFolderPrefix,
				groups: settings.groups,
				units: units ?? (await this.resolveUnits(settings.units)),
			}),
		);
		return "created";
	}

	/** Rebuilds the view from current settings, replacing what is there. */
	async rewriteBasesView(): Promise<string> {
		const settings = this.settings();
		const path = this.basesPath(settings);
		const units = await this.resolveUnits(settings.units);
		const content = basesView({
			folder: trimSlashes(settings.dataFolder) || "/",
			prefix: settings.dataFolderPrefix,
			groups: settings.groups,
			units,
		});

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await this.app.vault.modify(existing, content);
		else {
			const folder = trimSlashes(settings.basesFolder);
			if (folder) await ensureFolder(this.app, folder);
			await this.app.vault.create(path, content);
		}
		return path;
	}

	/* ---------------------------------------------------------------- */

	/** Ask Garmin which unit system the account uses, once per session. */
	private async resolveUnits(setting: RunnerSettings["units"]): Promise<"metric" | "imperial"> {
		if (setting !== "auto") return setting;
		if (this.unitsCache) return this.unitsCache;
		try {
			const settings = (await this.api.userSettings()) as {
				userData?: { measurementSystem?: string };
			};
			const system = settings?.userData?.measurementSystem ?? "";
			this.unitsCache = system.startsWith("statute") ? "imperial" : "metric";
		} catch {
			// Not worth failing a sync over; metric is the safer default.
			this.unitsCache = "metric";
		}
		return this.unitsCache;
	}

	/** Called on sign-out, so a second account does not inherit the first's units. */
	reset(): void {
		this.unitsCache = null;
		this.historyTried = false;
	}
}

export function describe(report: SyncReport): string {
	const parts = [`${report.written} written`];
	if (report.unchanged) parts.push(`${report.unchanged} unchanged`);
	if (report.skipped) parts.push(`${report.skipped} skipped`);
	if (report.failed) parts.push(`${report.failed} failed`);

	let summary = `Garmin sync: ${parts.join(", ")}`;
	if (report.stoppedEarly) summary += ` — stopped: ${report.stoppedEarly}`;
	// A range endpoint returning nothing used to be invisible: the run reported
	// "N written" while a whole metric was quietly missing from every note.
	if (report.warnings.length) summary += `\n${report.warnings.join("\n")}`;
	return summary;
}

/**
 * The progress Notice.
 *
 * A fragment rather than a string because a bar is not something a string can
 * say, and setMessage takes either. The toast is Obsidian's own chrome and
 * lives outside .gcd-root, so the rail's two colours come from styles.css
 * rather than the dashboard tokens.
 */
function noticeBody(progress: SyncProgress): DocumentFragment {
	const fragment = document.createDocumentFragment();
	const wrap = document.createElement("div");
	wrap.className = "gcn-sync";

	const line = document.createElement("div");
	line.className = "gcn-line";
	const title = document.createElement("span");
	title.textContent = "Garmin sync";
	const count = document.createElement("span");
	count.className = "gcn-count";
	count.textContent = progress.total > 0 ? `${progress.done} of ${progress.total}` : "starting…";
	line.append(title, count);

	const rail = document.createElement("div");
	rail.className = progress.total > 0 ? "gcn-rail" : "gcn-rail is-indeterminate";
	const fill = document.createElement("div");
	fill.className = "gcn-fill";
	if (progress.total > 0) fill.style.width = `${Math.round(fraction(progress) * 100)}%`;
	rail.append(fill);

	wrap.append(line, rail);

	// The day and the time left are the two things a count alone cannot answer:
	// how far back the run has reached, and whether it is worth waiting for.
	const detail = [progress.date, formatEta(progress.eta)].filter(Boolean).join(" · ");
	if (detail) {
		const el = document.createElement("div");
		el.className = "gcn-detail";
		el.textContent = detail;
		wrap.append(el);
	}

	fragment.append(wrap);
	return fragment;
}

/** The history sync's Notice: the same bar as a day sync's, counting activities. */
function historyBody(progress: HistoryProgress): DocumentFragment {
	const fragment = document.createDocumentFragment();
	const wrap = document.createElement("div");
	wrap.className = "gcn-sync";

	const line = document.createElement("div");
	line.className = "gcn-line";
	const title = document.createElement("span");
	title.textContent = "Garmin activity history";
	const count = document.createElement("span");
	count.className = "gcn-count";
	count.textContent =
		progress.total !== undefined
			? `${progress.fetched} of ${progress.total}`
			: progress.fetched > 0
				? `${progress.fetched} so far`
				: "starting…";
	line.append(title, count);

	const rail = document.createElement("div");
	const known = progress.total !== undefined && progress.total > 0;
	rail.className = known ? "gcn-rail" : "gcn-rail is-indeterminate";
	const fill = document.createElement("div");
	fill.className = "gcn-fill";
	if (known) fill.style.width = `${Math.min(100, Math.round((progress.fetched / progress.total!) * 100))}%`;
	rail.append(fill);

	wrap.append(line, rail);
	fragment.append(wrap);
	return fragment;
}

/** The daily stats history sync's Notice: how far back it has reached. */
function statsHistoryBody(progress: StatsHistoryProgress): DocumentFragment {
	return historyNotice("Garmin step, floor and intensity history", progress);
}

/** A history walk's Notice: what it fetches and how far back it has reached. */
function historyNotice(label: string, progress: { reached?: string }): DocumentFragment {
	const fragment = document.createDocumentFragment();
	const wrap = document.createElement("div");
	wrap.className = "gcn-sync";

	const line = document.createElement("div");
	line.className = "gcn-line";
	const title = document.createElement("span");
	title.textContent = label;
	const count = document.createElement("span");
	count.className = "gcn-count";
	count.textContent = progress.reached ? `back to ${monthOf(progress.reached)}` : "starting…";
	line.append(title, count);

	// How far back the account goes is unknown until the walk finds its start.
	const rail = document.createElement("div");
	rail.className = "gcn-rail is-indeterminate";
	const fill = document.createElement("div");
	fill.className = "gcn-fill";
	rail.append(fill);

	wrap.append(line, rail);
	fragment.append(wrap);
	return fragment;
}

/** `2026-03-08` → "March 2026". */
export function monthOf(date: string): string {
	return new Date(`${date.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftDay(date: string, days: number): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

function pauseFor(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** A load as a page gets it: the queue's fatal error stays behind. */
function withoutFatal(load: IntradayLoad & { fatal?: unknown }): IntradayLoad {
	const out: IntradayLoad = { series: load.series, missing: load.missing };
	if (load.reason) out.reason = load.reason;
	if (load.error !== undefined) out.error = load.error;
	return out;
}

/** The engine's view of the sleep index on disk. */
function sleepSink(store: VaultSeriesStore): SleepSink {
	return {
		coverage: () => store.readSleepMeta(),
		merge: (batch, covered) => store.mergeSleep(batch, { covered }),
	};
}

/** The engine's view of the daily stats index on disk. */
function dailyStatsSink(store: VaultSeriesStore): DailyStatsSink {
	return {
		coverage: () => store.readDailyStatsMeta(),
		merge: (batch, covered) => store.mergeDailyStats(batch, { covered }),
	};
}

function explain(err: unknown): string {
	if (err instanceof GarminRateLimitError) {
		return `rate limited by Garmin${err.retryAfter ? `, retry in ${err.retryAfter}s` : ""}`;
	}
	if (err instanceof GarminBlockedError) {
		return "Garmin's edge refused the request — this is a bot challenge, not your password";
	}
	if (err instanceof GarminAuthError) return "session expired — sign in again";
	return err instanceof Error ? err.message : String(err);
}
