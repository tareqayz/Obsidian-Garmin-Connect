import { Notice, type App } from "obsidian";
import type { GarminApi } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { GarminAuthError, GarminBlockedError, GarminRateLimitError } from "../garmin/errors";
import type { Log } from "../log";
import type { DayIndexDef, IndexHistoryProgress } from "./day-index";
import { DAY_INDEXES, dayIndex } from "./day-indexes";
import {
	fetchAllActivities,
	fetchDailyStatsHistory,
	fetchSleepHistory,
	lastNDays,
	syncRange,
	walkHistory,
	type DailyStatsSink,
	type DayIndexRuntime,
	type DayTarget,
	type SleepSink,
	type SyncReport,
} from "./engine";
import { fetchAccount } from "./account";
import { INTRADAY_EXTRAS } from "./intraday-extras";
import { DayJobs, loadDay, type IntradayLoad } from "./intraday-registry";
import { loadActivity, runsToDownload, type ActivityLoad } from "./activity-detail";
import type { ActivityRow } from "./activity-index";
import type { MetricGroup } from "./metrics";
import { SYNC_SPEEDS, type SyncSpeed } from "./speed";
import { describe as describeRequests } from "../garmin/request-stats";
import { etaSeconds, fraction, formatEta, type SyncProgress } from "./progress";
import { VaultSeriesStore } from "./series-store";

export interface RunnerSettings {
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	dataFolder: string;

	syncSpeed: SyncSpeed;
	stopAfterEmptyDays: number;
	/** Download every run's page in the background, not only the ones opened. */
	downloadRuns: boolean;
}

/** Activities per request when paging the whole history. The list honours 100. */
const HISTORY_PAGE = 100;

/**
 * The least time between two runs downloaded in the background: about the
 * pace of someone opening their runs one after another, ten requests each.
 */
const DOWNLOAD_PAUSE_MS = 2000;

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
	/** On-view activity loads waiting the same way, one job an activity. */
	private activityJobs = new DayJobs<ActivityLoad>();
	/** Runs to download in the background ("Download runs"), newest first: after the pages' loads. */
	private downloads: number[] = [];
	/** Runs whose download failed this session, not asked for again until a reload. */
	private downloadFailed = new Set<number>();
	/** The background download under way, which a sync or history walk waits for rather than being turned away. */
	private downloadInHand: Promise<void> | null = null;
	/** Syncs and walks waiting for that download: no other starts meanwhile. */
	private waitingForRunner = 0;
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

	/**
	 * `isRun` picks the index rows that are runs, the ones whose page opens:
	 * what "Download runs" downloads.
	 */
	constructor(
		app: App,
		api: GarminApi,
		settings: () => RunnerSettings,
		private readonly isRun: (row: ActivityRow) => boolean = () => false,
	) {
		this.app = app;
		this.api = api;
		this.settings = settings;
	}

	get isRunning(): boolean {
		return this.running;
	}

	/**
	 * One thing talks to Garmin at a time. Whatever waited for the runner —
	 * an on-view intraday or activity load — gets its turn once the current work is done,
	 * on a later task, so a sync that hands over to the history walks keeps
	 * the runner until they are done.
	 */
	private get running(): boolean {
		return this.busy;
	}

	private set running(value: boolean) {
		// Every piece of work starts here, so a speed changed in settings takes
		// effect from the next one.
		if (value) this.api.throttle.setLimits(SYNC_SPEEDS[this.settings().syncSpeed].limits);
		this.busy = value;
		if (!value && this.loadsWaiting) window.setTimeout(() => this.kickIntraday(), 0);
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
		if (report?.stoppedEarly) this.downloads = [];
		// Not awaited: Home's sync button should not spin through the history
		// requests. Skipped after a 429 or a dead session, as the account is.
		// One after the other, since a sync refuses to start while one runs.
		// The runs to download come last, after the walks.
		if (report && !report.stoppedEarly && this.historyTried && !this.chainActive) void this.queueDownloads();
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
					void this.queueDownloads();
				}
			})();
		}
		return report;
	}

	private async runDays(from: string, to: string, log?: Log): Promise<SyncReport | null> {
		if (this.downloadInHand) await this.yieldDownload();
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
		this.api.onSlowDown = (resumesAt) => {
			const seconds = Math.max(1, Math.round((resumesAt - Date.now()) / 1000));
			notice.setMessage(`Garmin asked us to slow down — resuming in ${seconds}s.`);
		};
		try {
			const units = await this.resolveUnits(settings.units);
			const series = new VaultSeriesStore(this.app, settings.dataFolder);
			const report = await syncRange(this.api, dayTarget(series), {
				from,
				to,
				groups: settings.groups,
				units,
				series,
				activities: { merge: (listing, complete) => series.mergeActivities(listing, { complete, units }) },
				dailyStats: dailyStatsSink(series),
				sleep: sleepSink(series),
				indexes: DAY_INDEXES.map((def) => this.indexRuntime(series, def)),
				extras: INTRADAY_EXTRAS,
				parallelDays: SYNC_SPEEDS[settings.syncSpeed].parallelDays,
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

			log?.detail("requests", describeRequests(this.api.stats.summary(startedAt)));
			new Notice(describe(report), report.failed || report.stoppedEarly ? 10000 : 5000);
			return report;
		} catch (err) {
			notice.hide();
			new Notice(`Garmin sync failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.api.onSlowDown = null;
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
		if (this.downloadInHand) await this.yieldDownload();
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
		if (this.downloadInHand) await this.yieldDownload();
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
		if (this.downloadInHand) await this.yieldDownload();
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
		if (this.downloadInHand) await this.yieldDownload();
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

	/**
	 * An activity's page, for the page: its detail file, with whatever blocks it
	 * lacks fetched and written into it first — every block for an activity
	 * opened for the first time, or one renamed or trimmed since (the index
	 * says). Queued like `loadIntraday`, and like it never rejects.
	 */
	async loadActivity(id: number): Promise<ActivityLoad> {
		let now: ActivityLoad;
		try {
			now = withoutActivityFatal(await this.loadActivityFor(id, false));
		} catch (err) {
			return { detail: null, reason: "failed", error: explain(err) };
		}
		if (now.reason !== "signed-out" || !this.api.isAuthenticated) return now;
		const pending = this.activityJobs.add(String(id), []);
		this.kickIntraday();
		return pending;
	}

	/** One activity's load. With `fetch` false, only what the file has and why the rest is missing. */
	private async loadActivityFor(id: number, fetch: boolean): Promise<ActivityLoad & { fatal?: unknown }> {
		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const row = (await store.readActivities()).rows.find((r) => r.id === id);
		return loadActivity(this.api, store, id, {
			signedIn: fetch && this.api.isAuthenticated,
			groups: settings.groups,
			row: row ? { name: row.name, distance: row.distance, duration: row.duration } : null,
		});
	}

	private get loadsWaiting(): boolean {
		return this.intradayJobs.size > 0 || this.activityJobs.size > 0 || this.downloadsReady;
	}

	/** Runs to download now: none during the history walks, or while a sync waits for the runner. */
	private get downloadsReady(): boolean {
		if (!this.downloads.length || this.chainActive || this.waitingForRunner > 0) return false;
		const settings = this.settings();
		return settings.downloadRuns && settings.groups.includes("workouts") && this.api.isAuthenticated;
	}

	private kickIntraday(): void {
		if (this.running || this.chainActive || this.draining || !this.loadsWaiting) return;
		void this.drainIntraday();
	}

	/**
	 * A run downloading in the background gives way: whoever wants the runner
	 * waits for that one run rather than being turned away, and no other
	 * download starts meanwhile. Awaited only then, so a busy check and the
	 * claim after it stay in one turn.
	 */
	private async yieldDownload(): Promise<void> {
		const inHand = this.downloadInHand;
		if (!this.running || !inHand) return;
		this.waitingForRunner += 1;
		try {
			await inHand;
		} finally {
			this.waitingForRunner -= 1;
		}
	}

	/**
	 * "Download runs": every run the index lists without a detail file, newest
	 * first, for the drain to download once nothing else needs the runner. Read
	 * again after each sync, so a new run joins and one opened meanwhile drops out.
	 */
	private async queueDownloads(): Promise<void> {
		const settings = this.settings();
		if (!settings.downloadRuns || !settings.groups.includes("workouts")) {
			this.downloads = [];
		} else {
			try {
				const store = new VaultSeriesStore(this.app, settings.dataFolder);
				const [index, saved] = await Promise.all([store.readActivities(), store.activityDetailIds()]);
				this.downloads = runsToDownload(index.rows, this.isRun, saved, this.downloadFailed);
			} catch {
				this.downloads = [];
			}
		}
		this.kickIntraday();
	}

	/** "Download runs" switched on: start now rather than after the next sync. */
	startDownloads(): void {
		if (!this.chainActive) void this.queueDownloads();
	}

	/**
	 * Runs the waiting loads one at a time — days first, then activities, then
	 * the runs downloading in the background — holding the runner, with the
	 * usual pause between them and a longer one before a download. A sync
	 * that starts in a pause goes first; the rest wait for it. A 429 or a dead
	 * session answers every load still waiting without asking Garmin again,
	 * and drops the downloads until the next sync.
	 */
	private async drainIntraday(): Promise<void> {
		if (this.draining) return;
		this.draining = true;
		try {
			let rested = true;
			while (!this.running && this.loadsWaiting) {
				const pageWaiting = this.intradayJobs.size > 0 || this.activityJobs.size > 0;
				const pause = pageWaiting ? 0 : DOWNLOAD_PAUSE_MS;
				if (!rested && pause > 0) {
					await pauseFor(pause);
					rested = true;
					// Then whatever waits by now: a page opened in the pause goes ahead of a download.
					continue;
				}
				rested = false;
				const day = this.intradayJobs.take();
				const activity = day ? undefined : this.activityJobs.take();
				const download = day || activity || !this.downloadsReady ? undefined : this.downloads.shift();
				if (!day && !activity && download === undefined) break;
				this.running = true;
				let fatal: unknown;
				try {
					if (day) {
						const load = await this.loadDayFor(day.date, day.keys, true);
						fatal = load.fatal;
						day.resolve(fatal === undefined ? withoutFatal(load) : { ...withoutFatal(load), error: explain(fatal) });
					} else if (activity) {
						const load = await this.loadActivityFor(Number(activity.date), true);
						fatal = load.fatal;
						const page = withoutActivityFatal(load);
						activity.resolve(fatal === undefined ? page : { ...page, error: explain(fatal) });
					} else if (download !== undefined) {
						const pending = this.loadActivityFor(download, true);
						this.downloadInHand = pending.then(
							() => undefined,
							() => undefined,
						);
						const load = await pending;
						fatal = load.fatal;
						if (load.reason === "off") this.downloads = [];
						else if (load.reason) this.downloadFailed.add(download);
					}
				} catch (err) {
					day?.resolve({ series: null, missing: [...day.keys], reason: "failed", error: explain(err) });
					activity?.resolve({ detail: null, reason: "failed", error: explain(err) });
					if (download !== undefined) this.downloadFailed.add(download);
				} finally {
					this.downloadInHand = null;
					this.running = false;
				}
				if (fatal === undefined) continue;
				this.downloads = [];
				for (let rest = this.intradayJobs.take(); rest; rest = this.intradayJobs.take()) {
					const now = await this.loadDayFor(rest.date, rest.keys, false).catch(() => null);
					const series = now?.series ?? null;
					const missing = now ? now.missing : [...rest.keys];
					rest.resolve(missing.length ? { series, missing, reason: "failed", error: explain(fatal) } : { series, missing });
				}
				for (let rest = this.activityJobs.take(); rest; rest = this.activityJobs.take()) {
					const now = await this.loadActivityFor(Number(rest.date), false).catch(() => null);
					const detail = now?.detail ?? null;
					rest.resolve(now && !now.reason ? { detail } : { detail, reason: "failed", error: explain(fatal) });
				}
			}
		} finally {
			this.draining = false;
		}
	}

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
		this.downloads = [];
		this.downloadFailed.clear();
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
 * lives outside the plugin's views, so the rail's two colours come from
 * styles.css.
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

/** An activity load as a page gets it: the queue's fatal error stays behind. */
function withoutActivityFatal(load: ActivityLoad & { fatal?: unknown }): ActivityLoad {
	const out: ActivityLoad = { detail: load.detail };
	if (load.reason) out.reason = load.reason;
	if (load.error !== undefined) out.error = load.error;
	return out;
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
/** Every day of the range is writable: the store makes the year file it needs. */
function dayTarget(store: VaultSeriesStore): DayTarget {
	return { exists: () => true, write: (date, properties) => store.writeDay(date, properties) };
}

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
