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
	MAX_RECENT_DAYS,
	recentRange,
	syncRange,
	walkHistory,
	type DailyStatsSink,
	type DayIndexRuntime,
	type SleepSink,
	type SyncReport,
} from "./engine";
import { fetchAccount } from "./account";
import { INTRADAY_EXTRAS } from "./intraday-extras";
import { DayJobs, loadDay, type IntradayLoad } from "./intraday-registry";
import { loadActivity, type ActivityLoad } from "./activity-detail";
import type { ActivityRow } from "./activity-index";
import type { MetricGroup } from "./metrics";
import { SYNC_SPEEDS, type SyncSpeed } from "./speed";
import { describe as describeRequests } from "../garmin/request-stats";
import { etaSeconds, fraction, formatEta, type SyncProgress } from "./progress";
import { VaultSeriesStore } from "./series-store";
import { NewerDataError } from "./file-health";
import type { DayBuffer } from "./days";
import { deviceUploadOf, markOf } from "./sync-state";
import { segmentOf, segmentWindows, STATS_WINDOW_DAYS, walkInSegments, type Segment, type SegmentOptions } from "./segments";
import { DAY_DETAILS_VERSION, rangeStart, type ActivityDetailsRange, type DayDetailsRange } from "./datasets";
import { heldElsewhere, LEASE_MS, nextChunk, planBackfill, rateLimitWait, RequestBudget, stillPaused, type PauseReason, type Task } from "./backfill";
import { chunkDays, DETAIL_REQUESTS, HOURLY_BUDGET, requestsPerChunk, requestsPerDay } from "./estimate";
import { historyStart, scanAccount, type ScanResult, type ScanStep } from "./scan";
import { RunnerLock, type Priority, type Release } from "./runner-lock";

export interface RunnerSettings {
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	dataFolder: string;

	syncSpeed: SyncSpeed;
	stopAfterEmptyDays: number;
	/** Null until the setup ran: nothing walks history in the background before it. */
	setup: { completedAt: string } | null;
	/** What to keep, and what was agreed to (see `datasets.ts`). */
	data: { dayDetails: DayDetailsRange; activityDetails: ActivityDetailsRange; accepted: string[] };
}

/** This device, for the backfill's lease. */
export interface DeviceIdentity {
	id: string;
	/** A name a person recognises: "Mac", "iPhone". */
	label: string;
}

/** The backfill as the pages and Settings show it. */
export interface BackfillProgress {
	/**
	 * - `running`: fetching, or between units.
	 * - `paused`: by the user, for a sign-in, after a 429 until `until`, or
	 *   (`update`, this device only) until the plugin is updated because
	 *   another device's newer build wrote the files.
	 * - `waiting`: inside the hourly budget, until `until`.
	 * - `elsewhere`: another device runs it (`device`).
	 */
	status: "running" | "paused" | "waiting" | "elsewhere";
	reason?: PauseReason | "update";
	/** ISO: when a 429's pause or the budget's wait ends. */
	until?: string;
	device?: string;
	/** What it is fetching. */
	task: Task["kind"];
	/** Requests spent this session, and about how many are left: the progress bar. */
	done: number;
	remaining: number;
	/** For Day details, the oldest day still to fetch. */
	reached?: string;
}

/** Activities per request when paging the whole history. The list honours 100. */
const HISTORY_PAGE = 100;

/**
 * The least time between two activities downloaded in the background: about
 * the pace of someone opening them one after another, ten requests each.
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

/** The days a run covers, worked out once the runner is held. */
interface DaysPlan {
	from: string;
	to: string;
	/** Requests spent working it out. */
	requests?: number;
	/** Lines for the done notice. */
	notes?: string[];
	/** Called with the report before the done notice. */
	finish?: (report: SyncReport) => Promise<void>;
	/** Every day's timelines, not only those inside Day details: a range asked for by hand. */
	allTimelines?: boolean;
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
	/** One thing talks to Garmin at a time, by priority (see `runner-lock.ts`). */
	private lock = new RunnerLock();
	/** On-view intraday loads waiting for the runner to be free, one job a day. */
	private intradayJobs = new DayJobs<IntradayLoad>();
	/** On-view activity loads waiting the same way, one job an activity. */
	private activityJobs = new DayJobs<ActivityLoad>();
	private draining = false;
	/** The backfill's plan, worked out again once used up or when what it depends on changes. */
	private backfillTasks: Task[] | null = null;
	/** Whether the plan may have work: the drain asks for a unit only then. */
	private backfillPending = false;
	/** Days and activities that failed this session, and walks that kept failing: left for the next. */
	private backfillSkip = { days: new Set<string>(), details: new Set<number>(), walks: new Set<string>() };
	/** Empty windows each walk ended its last segment on (see `WalkOptions.emptyStreak`). */
	private walkStreaks = new Map<string, number>();
	private backfillTimer: number | null = null;
	private backfillStopped = false;
	private backfillState: BackfillProgress | null = null;
	private backfillListeners = new Set<(progress: BackfillProgress | null) => void>();
	/** Requests the backfill spent this session, for the progress bar. */
	private backfillDone = 0;
	/** 429s in a row, for the growing pause. */
	private rateLimits = 0;
	/** When this device last wrote its lease. */
	private leaseWrittenAt = 0;
	private budget: RequestBudget;
	private historyState: HistoryProgress | null = null;
	private historyListeners = new Set<(progress: HistoryProgress | null) => void>();
	private statsHistoryState: StatsHistoryProgress | null = null;
	private statsHistoryListeners = new Set<(progress: StatsHistoryProgress | null) => void>();
	private sleepHistoryState: SleepHistoryProgress | null = null;
	private sleepHistoryListeners = new Set<(progress: SleepHistoryProgress | null) => void>();
	private indexHistoryState = new Map<string, IndexHistoryProgress>();
	private indexHistoryListeners = new Set<(kind: string, progress: IndexHistoryProgress | null) => void>();

	/**
	 * `isRun` picks the index rows that are runs: all an older Run details
	 * agreement downloads, before Activity details is agreed to.
	 */
	constructor(
		app: App,
		api: GarminApi,
		settings: () => RunnerSettings,
		private readonly isRun: (row: ActivityRow) => boolean = () => false,
		private readonly device: DeviceIdentity = { id: "this-device", label: "this device" },
	) {
		this.app = app;
		this.api = api;
		this.settings = settings;
		this.budget = new RequestBudget(() => HOURLY_BUDGET[this.settings().syncSpeed]);
	}

	get isRunning(): boolean {
		return this.running;
	}

	/** Whether anything holds the runner. */
	private get running(): boolean {
		return this.lock.busy;
	}

	/**
	 * The runner, for `priority` (see `RunnerLock`), with the sync speed applied
	 * — so a speed changed in settings takes effect from the next piece of
	 * work. The release hands it on and then starts any loads still waiting.
	 * Null when another sync holds it or waits for it.
	 */
	private async claim(priority: Priority): Promise<Release | null> {
		return this.applied(await this.lock.acquire(priority));
	}

	/** `claim`, but only if the runner is free now with nothing waiting ahead. */
	private claimNow(priority: Priority): Release | null {
		return this.applied(this.lock.tryAcquire(priority));
	}

	private applied(release: Release | null): Release | null {
		if (!release) return null;
		this.api.throttle.setLimits(SYNC_SPEEDS[this.settings().syncSpeed].limits);
		return () => {
			release();
			if (!this.lock.busy && this.loadsWaiting) window.setTimeout(() => this.kickIntraday(), 0);
		};
	}

	/**
	 * Everything since the last good recent sync, worked out once the runner is
	 * held (see `recentRange`): another device may have synced meanwhile.
	 */
	syncRecent(log?: Log): Promise<SyncReport | null> {
		return this.runPlan(() => this.planRecent(log), log);
	}

	private async planRecent(log?: Log): Promise<DaysPlan> {
		const startedAt = new Date().toISOString();
		const series = new VaultSeriesStore(this.app, this.settings().dataFolder);
		const { from, to, capped } = recentRange(markOf(await series.readSyncState()), toIsoDate());
		// Read before the days, so an upload that lands mid-sync is not taken as
		// seen. A failure costs only the precision: the mark falls back to the
		// sync's own time, and a 429 here stops the days too.
		let deviceUpload: string | undefined;
		try {
			deviceUpload = deviceUploadOf(await this.api.lastUsedDevice());
		} catch (err) {
			log?.warn(`last used device failed: ${explain(err)}`);
		}
		return {
			from,
			to,
			requests: 1,
			notes: capped ? [`Synced the last ${MAX_RECENT_DAYS} days only. Sync a range for the days before ${from}.`] : [],
			// Only a run that covered the whole range moves the mark: one stopped
			// early left its oldest days behind.
			finish: async (report) => {
				if (report.stoppedEarly) return;
				await series.writeSyncState(deviceUpload ? { syncedAt: startedAt, deviceUpload } : { syncedAt: startedAt });
			},
		};
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

	/**
	 * A chosen range, whole: every day's timelines too, since it was asked for
	 * by hand. It leaves the recent sync's mark alone: it need not cover what
	 * changed since.
	 */
	run(from: string, to: string, log?: Log): Promise<SyncReport | null> {
		return this.runPlan(async () => ({ from, to, allTimelines: true }), log);
	}

	private async runPlan(plan: () => Promise<DaysPlan>, log?: Log): Promise<SyncReport | null> {
		const report = await this.runDays(plan, log);
		// New days and activities may have joined, or gaps opened: the backfill looks again.
		if (report && !report.stoppedEarly) this.kickBackfill();
		return report;
	}

	private async runDays(plan: () => Promise<DaysPlan>, log?: Log): Promise<SyncReport | null> {
		if (!this.api.isAuthenticated) {
			new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			new Notice("A Garmin sync is already running.");
			return null;
		}

		const settings = this.settings();
		const startedAt = Date.now();
		const notice = new Notice(noticeBody({ done: 0, total: 0, date: null, eta: null }), 0);
		this.api.onSlowDown = (resumesAt) => {
			const seconds = Math.max(1, Math.round((resumesAt - Date.now()) / 1000));
			notice.setMessage(`Garmin asked us to slow down — resuming in ${seconds}s.`);
		};
		try {
			const { from, to, requests: planned = 0, notes = [], finish, allTimelines } = await plan();
			const units = await this.resolveUnits(settings.units);
			const series = new VaultSeriesStore(this.app, settings.dataFolder);
			// The day files are written a year at a time once the days are in.
			const days = series.dayBuffer();
			const report = await syncDays(days, () => syncRange(this.api, days, {
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
				...(allTimelines ? { intradayDays: spanDays(from, to) } : this.intradayFor(from, to)),
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
			}));
			notice.hide();
			await this.recordDays(series, report, log);

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

			report.requests += planned;
			report.warnings.push(...notes);
			try {
				await finish?.(report);
			} catch (err) {
				log?.warn(`sync state failed: ${explain(err)}`);
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
			release();
		}
	}

	/**
	 * Fills the activity index with the whole history: about one request per
	 * hundred activities, paged with the usual pause. Routine syncs keep it
	 * current from then on with the one page they already fetch.
	 *
	 * `auto` is a run nobody watches (the setup's): silent when the index is
	 * already complete or another sync is running.
	 */
	async syncActivityHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const notice = auto ? null : new Notice(historyBody({ fetched: 0 }), 0);
		try {
			if (auto && (await store.readActivities()).meta?.complete) return null;
			this.setHistory({ fetched: 0 });
			const got = await this.activityWalk(store, log, (fetched, total) => {
				this.setHistory({ fetched, total });
				notice?.setMessage(historyBody({ fetched, total }));
			});
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			log?.detail("activity history", `${got.fetched} activities, ${got.requests} requests`);
			if (!auto || stoppedEarly) {
				new Notice(
					stoppedEarly ? `Garmin activity history: ${got.fetched} fetched — stopped: ${stoppedEarly}` : `Garmin activity history: ${got.fetched} activities`,
					stoppedEarly ? 10000 : 5000,
				);
			}
			return { fetched: got.fetched, complete: got.complete, requests: got.requests, ...(stoppedEarly ? { stoppedEarly } : {}) };
		} catch (err) {
			notice?.hide();
			new Notice(`Garmin activity history failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			release();
			this.setHistory(null);
		}
	}

	/**
	 * The activity list, whole, merged into the index: about a request per
	 * hundred activities. A 429 or a dead session from the count throws; from
	 * the pages it comes back as `fatal`, with what came before it merged.
	 */
	private async activityWalk(
		store: VaultSeriesStore,
		log?: Log,
		onPage?: (fetched: number, total?: number) => void,
	): Promise<{ fetched: number; complete: boolean; requests: number; fatal?: unknown; error?: string }> {
		const units = await this.resolveUnits(this.settings().units);
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
		onPage?.(0, total);
		const got = await fetchAllActivities(this.api, { pageSize: HISTORY_PAGE, onPage: (fetched) => onPage?.(fetched, total) });
		requests += got.requests;
		// Even cut short, what came back is the newest stretch with no gaps,
		// which is what a routine sync merges too.
		await store.mergeActivities(got.activities, {
			complete: got.complete,
			units,
			...(total !== undefined ? { total } : got.complete ? { total: got.activities.length } : {}),
		});
		return {
			fetched: got.activities.length,
			complete: got.complete,
			requests,
			...(got.fatal ? { fatal: got.fatal } : {}),
			...(got.error ? { error: got.error } : {}),
		};
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
	 * `auto` is a run nobody watches (the setup's): silent when the index is
	 * already complete or another sync is running.
	 */
	async syncDailyStatsHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const notice = auto ? null : new Notice(statsHistoryBody({}), 0);
		try {
			if ((await store.readDailyStatsMeta())?.complete) {
				notice?.hide();
				if (!auto) new Notice("Garmin step, floor and intensity history is already complete.");
				return null;
			}
			this.setStatsHistory({});

			const notBefore = await this.notBefore(store);
			const got = await walkInSegments((emptyStreak) =>
				this.dailyStatsSegment(store, { notBefore, emptyStreak }, (reached) => {
					this.setStatsHistory({ reached });
					notice?.setMessage(statsHistoryBody({ reached }));
				}),
			);
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const days = got.rows;
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
			release();
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
	 * `auto` is a run nobody watches (the setup's): silent when the index is
	 * already complete or another sync is running.
	 */
	async syncSleepHistory(opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const notice = auto ? null : new Notice(historyNotice("Garmin sleep history", {}), 0);
		try {
			if ((await store.readSleepMeta())?.complete) {
				notice?.hide();
				if (!auto) new Notice("Garmin sleep history is already complete.");
				return null;
			}
			this.setSleepHistory({});

			const notBefore = await this.notBefore(store);
			const got = await walkInSegments((emptyStreak) =>
				this.sleepSegment(store, { notBefore, emptyStreak }, (reached) => {
					this.setSleepHistory({ reached });
					notice?.setMessage(historyNotice("Garmin sleep history", { reached }));
				}),
			);
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const nights = got.rows;
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
			release();
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
	 * `auto` is a run nobody watches (the setup's): silent when the index is
	 * already complete or another sync is running.
	 */
	async syncIndexHistory(kind: string, opts: { auto?: boolean; log?: Log } = {}): Promise<HistoryReport | null> {
		const { auto = false, log } = opts;
		const def = dayIndex(kind);
		if (!def) return null;
		const label = `Garmin ${def.title} history`;
		if (!this.api.isAuthenticated) {
			if (!auto) new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			if (!auto) new Notice("A Garmin sync is already running.");
			return null;
		}

		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const notice = auto ? null : new Notice(historyNotice(label, {}), 0);
		try {
			if ((await store.readDayIndexMeta(def))?.complete) {
				notice?.hide();
				if (!auto) new Notice(`${label} is already complete.`);
				return null;
			}
			this.setIndexHistory(kind, {});

			const notBefore = await this.notBefore(store);
			const got = await walkInSegments((emptyStreak) =>
				this.indexSegment(def, store, { notBefore, emptyStreak }, (reached) => {
					this.setIndexHistory(kind, { reached });
					notice?.setMessage(historyNotice(label, { reached }));
				}),
			);
			notice?.hide();

			const stoppedEarly = got.fatal ? explain(got.fatal) : got.error;
			const days = got.rows;
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
			release();
			this.setIndexHistory(kind, null);
		}
	}

	private setIndexHistory(kind: string, progress: IndexHistoryProgress | null): void {
		if (progress) this.indexHistoryState.set(kind, progress);
		else this.indexHistoryState.delete(kind);
		for (const listener of this.indexHistoryListeners) listener(kind, progress);
	}

	/** Books the days a run fetched whole in the day coverage. A failure costs a day fetched again later. */
	private async recordDays(store: VaultSeriesStore, report: SyncReport, log?: Log): Promise<void> {
		const full = report.days.filter((day) => day.full).map((day) => day.date);
		try {
			await store.recordDays(full, DAY_DETAILS_VERSION, this.settings().groups.includes("intraday"));
		} catch (err) {
			log?.warn(`day coverage failed: ${explain(err)}`);
		}
	}

	/**
	 * Where a walk may stop once its windows come back empty: past where the
	 * account's history starts, as the scan found it, or past the oldest
	 * activity, since a watch that recorded one recorded the rest.
	 */
	private async notBefore(store: VaultSeriesStore): Promise<string | undefined> {
		const [scan, index] = await Promise.all([store.readScan(), store.readActivities()]);
		const days = [historyStart(scan), index.rows.at(-1)?.start.slice(0, 10)].filter((d): d is string => !!d).sort();
		return days[0];
	}

	/**
	 * Finds where the account's history starts and ends (see `scan.ts`) and
	 * keeps it in `scan.json`, even cut short: a scan that stopped says so.
	 */
	async scan(opts: { onStep?: (step: ScanStep) => void; log?: Log } = {}): Promise<ScanResult | null> {
		if (!this.api.isAuthenticated) {
			new Notice("Sign in to Garmin Connect first.");
			return null;
		}
		const release = await this.claim("foreground");
		if (!release) {
			new Notice("A Garmin sync is already running.");
			return null;
		}
		const store = new VaultSeriesStore(this.app, this.settings().dataFolder);
		try {
			const got = await scanAccount(this.api, { today: toIsoDate(), ...(opts.onStep ? { onStep: opts.onStep } : {}) });
			for (const error of got.errors) opts.log?.warn(`scan: ${error}`);
			opts.log?.detail("scan", `${got.scan.days} days, ${got.scan.activities} activities, ${got.requests} requests`);
			try {
				await store.writeScan(got.scan);
			} catch (err) {
				opts.log?.warn(`scan file failed: ${explain(err)}`);
			}
			return got;
		} finally {
			release();
		}
	}

	/**
	 * One segment of the daily stats walk: at most a year of windows below
	 * what the index holds, merged at once. Routine syncs keep its top current.
	 */
	private async dailyStatsSegment(store: VaultSeriesStore, walk: SegmentOptions, onWindow?: (reached: string) => void): Promise<Segment> {
		const meta = await store.readDailyStatsMeta();
		if (meta?.complete) return { requests: 0, rows: 0, complete: true, emptyStreak: walk.emptyStreak };
		const got = await fetchDailyStatsHistory(this.api, {
			until: meta?.from ? shiftDay(meta.from, -1) : toIsoDate(),
			...(walk.notBefore ? { notBefore: walk.notBefore } : {}),
			emptyStreak: walk.emptyStreak,
			maxWindows: segmentWindows(STATS_WINDOW_DAYS),
			...(walk.shouldStop ? { shouldStop: walk.shouldStop } : {}),
			...(onWindow ? { onWindow } : {}),
		});
		// Even cut short, what came back runs unbroken from where it started.
		if (got.batch.dates.length) await store.mergeDailyStats(got.batch, { covered: got.covered, complete: got.complete });
		return segmentOf(got, got.batch.rows.length);
	}

	/** One segment of the sleep walk, as `dailyStatsSegment`. */
	private async sleepSegment(store: VaultSeriesStore, walk: SegmentOptions, onWindow?: (reached: string) => void): Promise<Segment> {
		const meta = await store.readSleepMeta();
		if (meta?.complete) return { requests: 0, rows: 0, complete: true, emptyStreak: walk.emptyStreak };
		const got = await fetchSleepHistory(this.api, {
			until: meta?.from ? shiftDay(meta.from, -1) : toIsoDate(),
			...(walk.notBefore ? { notBefore: walk.notBefore } : {}),
			emptyStreak: walk.emptyStreak,
			maxWindows: segmentWindows(STATS_WINDOW_DAYS),
			...(walk.shouldStop ? { shouldStop: walk.shouldStop } : {}),
			...(onWindow ? { onWindow } : {}),
		});
		if (got.batch.dates.length) await store.mergeSleep(got.batch, { covered: got.covered, complete: got.complete });
		return segmentOf(got, got.batch.rows.length);
	}

	/** One segment of a registered index's walk, as `dailyStatsSegment`, `windowDays` a window. */
	private async indexSegment(def: DayIndexDef, store: VaultSeriesStore, walk: SegmentOptions, onWindow?: (reached: string) => void): Promise<Segment> {
		const meta = await store.readDayIndexMeta(def);
		if (meta?.complete) return { requests: 0, rows: 0, complete: true, emptyStreak: walk.emptyStreak };
		const today = toIsoDate();
		const got = await walkHistory(def, (start, end) => def.fetchWindow(this.api, start, end), {
			until: meta?.from ? shiftDay(meta.from, -1) : today,
			today,
			...(walk.notBefore ? { notBefore: walk.notBefore } : {}),
			emptyStreak: walk.emptyStreak,
			maxWindows: segmentWindows(def.windowDays),
			...(walk.shouldStop ? { shouldStop: walk.shouldStop } : {}),
			...(onWindow ? { onWindow } : {}),
		});
		if (got.batch.dates.length || got.complete) {
			await store.mergeDayIndex(def, got.batch, { covered: got.covered, complete: got.complete });
		}
		return segmentOf(got, got.batch.rows.length);
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
		return this.intradayJobs.size > 0 || this.activityJobs.size > 0 || this.backfillReady;
	}

	/** A backfill unit may run: there may be work, nothing paused it, and Obsidian is not closing. */
	private get backfillReady(): boolean {
		return this.backfillPending && !this.backfillStopped && this.backfillTimer === null && this.api.isAuthenticated;
	}

	private kickIntraday(): void {
		if (this.running || this.draining || !this.loadsWaiting) return;
		void this.drainIntraday();
	}

	/**
	 * Runs what waits for the runner one piece at a time — a page's day, then
	 * a page's activity, then a unit of the backfill — with a pause before a
	 * run downloads. A sync that comes in goes first; a page's load goes ahead
	 * of the backfill. A 429 or a dead session answers every page load still
	 * waiting without asking Garmin again.
	 */
	private async drainIntraday(): Promise<void> {
		if (this.draining) return;
		this.draining = true;
		try {
			let rested = true;
			while (this.loadsWaiting) {
				const pageWaiting = this.intradayJobs.size > 0 || this.activityJobs.size > 0;
				const pause = pageWaiting ? 0 : this.backfillTasks?.[0]?.kind === "details" ? DOWNLOAD_PAUSE_MS : 0;
				if (!rested && pause > 0) {
					await pauseFor(pause);
					rested = true;
					// Then whatever waits by now: a page opened in the pause goes ahead of a download.
					continue;
				}
				rested = false;
				// A page's load goes after any sync waiting; the backfill only when nothing waits at all.
				const release = this.claimNow(pageWaiting ? "page" : "background");
				if (!release) break;
				const day = this.intradayJobs.take();
				const activity = day ? undefined : this.activityJobs.take();
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
					} else {
						await this.backfillUnit();
					}
				} catch (err) {
					day?.resolve({ series: null, missing: [...day.keys], reason: "failed", error: explain(err) });
					activity?.resolve({ detail: null, reason: "failed", error: explain(err) });
				} finally {
					release();
				}
				if (fatal === undefined) continue;
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

	/* ---------------------------------------------------------------- */
	/*  The backfill                                                     */
	/* ---------------------------------------------------------------- */

	/** The backfill in progress, or null when there is none. */
	get backfillProgress(): BackfillProgress | null {
		return this.backfillState;
	}

	/** Called with the backfill's progress after each unit, and with null once nothing is left. Returns the unsubscribe. */
	onBackfill(listener: (progress: BackfillProgress | null) => void): () => void {
		this.backfillListeners.add(listener);
		return () => this.backfillListeners.delete(listener);
	}

	private setBackfill(progress: BackfillProgress | null): void {
		this.backfillState = progress;
		for (const listener of this.backfillListeners) listener(progress);
	}

	/**
	 * Something the backfill depends on changed — a sync, a choice, a sign-in,
	 * startup: it works out its plan again and carries on in the background.
	 */
	kickBackfill(): void {
		this.backfillTasks = null;
		this.backfillPending = this.settings().setup !== null;
		if (this.backfillTimer === null) this.kickIntraday();
	}

	/** The user's Pause: kept in backfill.json, so every device stops. */
	async pauseBackfill(): Promise<void> {
		const store = new VaultSeriesStore(this.app, this.settings().dataFolder);
		await store.writeBackfill({ paused: { reason: "user" } });
		this.backfillPending = false;
		this.setBackfill(this.backfillState ? { ...this.backfillState, status: "paused", reason: "user" } : null);
	}

	/** The user's Resume, or a sign-in after "sign in to continue": lifts any pause. */
	async resumeBackfill(): Promise<void> {
		const store = new VaultSeriesStore(this.app, this.settings().dataFolder);
		const state = await store.readBackfill();
		if (state.paused) await store.writeBackfill({ ...(state.lease ? { lease: state.lease } : {}) });
		this.rateLimits = 0;
		this.clearBackfillTimer();
		this.kickBackfill();
	}

	/** Signed in again: a backfill paused for the sign-in carries on; one the user paused stays paused. */
	async signedIn(): Promise<void> {
		const store = new VaultSeriesStore(this.app, this.settings().dataFolder);
		const state = await store.readBackfill();
		if (state.paused?.reason === "sign-in") await store.writeBackfill({ ...(state.lease ? { lease: state.lease } : {}) });
		this.kickBackfill();
	}

	/** Obsidian is closing, or the plugin unloading: the unit in hand stops at its next day or window. */
	stop(): void {
		this.backfillStopped = true;
		this.clearBackfillTimer();
	}

	private clearBackfillTimer(): void {
		if (this.backfillTimer !== null) window.clearTimeout(this.backfillTimer);
		this.backfillTimer = null;
	}

	/** Tries the backfill again in `ms`: after a 429's pause, the budget's wait, or to see whether another device let go. */
	private backfillLater(ms: number): void {
		this.clearBackfillTimer();
		this.backfillTimer = window.setTimeout(() => {
			this.backfillTimer = null;
			this.kickBackfill();
		}, Math.max(1_000, ms));
	}

	/** What the backfill should fetch, worked out from what the vault holds and what was agreed to. */
	private async planBackfillFor(store: VaultSeriesStore): Promise<Task[]> {
		const settings = this.settings();
		const today = toIsoDate();
		const [scan, coverage, charts, index, detailFiles] = await Promise.all([
			store.readScan(),
			store.readDayCoverage(settings.groups.includes("intraday")),
			store.readChartMetas(),
			store.readActivities(),
			store.readDetailCoverage(),
		]);
		const tasks = planBackfill({
			today,
			groups: settings.groups,
			accepted: settings.data.accepted,
			dayDetails: settings.data.dayDetails,
			activityDetails: settings.data.activityDetails,
			scan,
			daySpans: coverage.spans,
			charts,
			activities: index.rows.map((row) => ({ id: row.id, date: row.start.slice(0, 10), run: this.isRun(row) })),
			detailFiles,
			...(settings.setup ? { since: settings.setup.completedAt.slice(0, 10) } : {}),
			skip: this.backfillSkip,
		});
		return tasks.filter((task) => task.kind !== "walk" || !this.backfillSkip.walks.has(task.store));
	}

	/** About how many requests the plan has left, for the progress bar. */
	private remainingRequests(tasks: readonly Task[]): number {
		const groups = this.settings().groups;
		let n = 0;
		for (const task of tasks) {
			if (task.kind === "activities") n += 10;
			else if (task.kind === "walk") n += 20;
			else if (task.kind === "details") n += task.ids.length * DETAIL_REQUESTS;
			else n += spanDays(task.from, task.to) * requestsPerDay(groups);
		}
		return n;
	}

	/**
	 * One unit of the backfill, about ten seconds of work: the activity list,
	 * a year of a few chart walks side by side, a chunk of days, or one run.
	 * Holds the runner as background work (see `drainIntraday`). Checks
	 * backfill.json first: a pause, or another device's fresh lease, stops it.
	 */
	private async backfillUnit(): Promise<void> {
		const settings = this.settings();
		const store = new VaultSeriesStore(this.app, settings.dataFolder);
		const now = Date.now();
		const state = await store.readBackfill();
		if (stillPaused(state, now)) {
			this.backfillPending = false;
			const until = state.paused!.until;
			if (until) this.backfillLater(Date.parse(until) - now);
			this.setBackfill({ status: "paused", reason: state.paused!.reason, ...(until ? { until } : {}), task: this.backfillState?.task ?? "days", done: this.backfillDone, remaining: this.backfillState?.remaining ?? 0 });
			return;
		}
		const elsewhere = heldElsewhere(state, this.device.id, now);
		if (elsewhere) {
			this.backfillLater(LEASE_MS / 2);
			this.setBackfill({ status: "elsewhere", device: elsewhere.label, task: this.backfillState?.task ?? "days", done: this.backfillDone, remaining: this.backfillState?.remaining ?? 0 });
			return;
		}

		this.backfillTasks ??= await this.planBackfillFor(store);
		const task = this.backfillTasks[0];
		if (!task) {
			this.backfillPending = false;
			if (state.lease?.device === this.device.id || state.paused) await store.writeBackfill({});
			this.setBackfill(null);
			return;
		}
		const cost = this.unitCost(task);
		const wait = this.budget.waitFor(cost, now);
		if (wait > 0) {
			this.backfillLater(wait);
			this.setBackfill({ status: "waiting", until: new Date(now + wait).toISOString(), task: task.kind, done: this.backfillDone, remaining: this.remainingRequests(this.backfillTasks) });
			return;
		}
		if (now - this.leaseWrittenAt > 60_000 || state.lease?.device !== this.device.id) {
			await store.writeBackfill({ lease: { device: this.device.id, label: this.device.label, heartbeat: new Date(now).toISOString() } });
			this.leaseWrittenAt = now;
		}
		this.setBackfill({
			status: "running",
			task: task.kind,
			done: this.backfillDone,
			remaining: this.remainingRequests(this.backfillTasks),
			...(task.kind === "days" ? { reached: task.to } : {}),
		});

		let requests = 0;
		let fatal: unknown;
		try {
			const got = await this.runUnit(task, store);
			requests = got.requests;
			fatal = got.fatal;
		} catch (err) {
			fatal = err;
		}
		this.budget.add(requests, Date.now());
		this.backfillDone += requests;

		if (fatal instanceof GarminAuthError) {
			await store.writeBackfill({ paused: { reason: "sign-in" } });
			this.backfillPending = false;
			this.setBackfill({ status: "paused", reason: "sign-in", task: task.kind, done: this.backfillDone, remaining: this.remainingRequests(this.backfillTasks) });
			return;
		}
		if (fatal instanceof GarminRateLimitError) {
			this.rateLimits += 1;
			const until = new Date(Date.now() + rateLimitWait(this.rateLimits)).toISOString();
			await store.writeBackfill({ paused: { reason: "rate-limit", until } });
			this.backfillLater(rateLimitWait(this.rateLimits));
			this.setBackfill({ status: "paused", reason: "rate-limit", until, task: task.kind, done: this.backfillDone, remaining: this.remainingRequests(this.backfillTasks) });
			return;
		}
		if (fatal instanceof NewerDataError) {
			// Another device runs a newer build. Its files stay as they are, and the
			// pause stays on this device: backfill.json would stop that one too.
			this.backfillPending = false;
			new Notice(`Garmin: ${fatal.message}`, 15000);
			this.setBackfill({ status: "paused", reason: "update", task: task.kind, done: this.backfillDone, remaining: this.remainingRequests(this.backfillTasks) });
			return;
		}
		if (fatal !== undefined) {
			// Something else went wrong with the whole unit: try again in a while rather than at once.
			const until = new Date(Date.now() + 10 * 60_000).toISOString();
			await store.writeBackfill({ paused: { reason: "error", until } });
			this.backfillLater(10 * 60_000);
			this.setBackfill({ status: "paused", reason: "error", until, task: task.kind, done: this.backfillDone, remaining: this.remainingRequests(this.backfillTasks) });
			return;
		}
		this.rateLimits = 0;
		const left = this.backfillTasks;
		const next = left[0];
		this.setBackfill(
			left.length
				? {
						status: "running",
						task: next?.kind ?? task.kind,
						done: this.backfillDone,
						remaining: this.remainingRequests(left),
						...(next?.kind === "days" ? { reached: next.to } : {}),
					}
				: null,
		);
		// Used up: plan once more, for whatever arrived meanwhile.
		if (!left.length) this.backfillTasks = null;
	}

	/** Requests a unit of `task` is about to spend, for the budget. */
	private unitCost(task: Task): number {
		const groups = this.settings().groups;
		if (task.kind === "activities") return 10;
		if (task.kind === "walk") return 20 * SYNC_SPEEDS[this.settings().syncSpeed].parallelDays;
		if (task.kind === "details") return DETAIL_REQUESTS;
		const chunk = nextChunk(task, chunkDays(groups, this.settings().syncSpeed));
		return spanDays(chunk.from, chunk.to) * requestsPerDay(groups) + requestsPerChunk(groups);
	}

	/** Runs one unit of a task, and moves the plan on past it. */
	private async runUnit(task: Task, store: VaultSeriesStore): Promise<{ requests: number; fatal?: unknown }> {
		const tasks = this.backfillTasks!;
		const settings = this.settings();
		if (task.kind === "activities") {
			const got = await this.activityWalk(store);
			// Done, or failed for a reason that is not the whole account's: the details and walks read it next either way.
			if (!got.fatal) tasks.shift();
			return { requests: got.requests, ...(got.fatal ? { fatal: got.fatal } : {}) };
		}
		if (task.kind === "walk") {
			// The walks at the plan's head go side by side, each into its own index.
			const walks = tasks.filter((t): t is Extract<Task, { kind: "walk" }> => t.kind === "walk").slice(0, SYNC_SPEEDS[settings.syncSpeed].parallelDays);
			const notBefore = await this.notBefore(store);
			const segments = await Promise.all(
				walks.map(async (walk) => ({ walk, got: await this.walkSegment(walk.store, store, { ...(notBefore ? { notBefore } : {}), emptyStreak: this.walkStreaks.get(walk.store) ?? 0, shouldStop: () => this.backfillStopped }) })),
			);
			let requests = 0;
			let fatal: unknown;
			for (const { walk, got } of segments) {
				requests += got.requests;
				this.walkStreaks.set(walk.store, got.emptyStreak);
				if (got.fatal) fatal ??= got.fatal;
				const done = got.complete || got.requests === 0;
				// A walk whose request failed is left for the next session rather than asked again at once.
				if (got.error) this.backfillSkip.walks.add(walk.store);
				if (done || got.error) tasks.splice(tasks.indexOf(walk), 1);
			}
			return { requests, ...(fatal ? { fatal } : {}) };
		}
		if (task.kind === "details") {
			const id = task.ids[0]!;
			const load = await this.loadActivityFor(id, true);
			if (load.fatal) return { requests: DETAIL_REQUESTS, fatal: load.fatal };
			task.ids.shift();
			if (load.reason) this.backfillSkip.details.add(id);
			if (!task.ids.length) tasks.shift();
			return { requests: DETAIL_REQUESTS };
		}
		const chunk = nextChunk(task, chunkDays(settings.groups, settings.syncSpeed));
		const report = await this.chunkSync(store, chunk);
		const fatal = report.fatal ?? (report.stoppedEarly && report.stoppedEarly !== "cancelled" ? new Error(report.stoppedEarly) : undefined);
		if (fatal) return { requests: report.requests, fatal };
		// What came back incomplete is left for the next session.
		for (const day of report.days) if (!day.full) this.backfillSkip.days.add(day.date);
		if (chunk.from <= task.from) tasks.shift();
		else task.to = shiftDay(chunk.from, -1);
		return { requests: report.requests };
	}

	/** One segment of a chart index's walk, by its store name. */
	private walkSegment(name: string, store: VaultSeriesStore, walk: SegmentOptions): Promise<Segment> {
		if (name === "daily-stats") return this.dailyStatsSegment(store, walk);
		if (name === "sleep") return this.sleepSegment(store, walk);
		const def = dayIndex(name.replace(/^index:/, ""));
		return def ? this.indexSegment(def, store, walk) : Promise.resolve({ requests: 0, rows: 0, complete: true, emptyStreak: 0 });
	}

	/**
	 * A chunk of days for the backfill: each day's file and full timelines,
	 * the activities listed by date, no chart index fed (their walks fill
	 * them), the days written a year file at a time and booked in the day
	 * coverage.
	 */
	private async chunkSync(store: VaultSeriesStore, chunk: { from: string; to: string }): Promise<SyncReport> {
		const settings = this.settings();
		const units = await this.resolveUnits(settings.units);
		const days = store.dayBuffer();
		const report = await syncDays(days, () =>
			syncRange(this.api, days, {
				from: chunk.from,
				to: chunk.to,
				groups: settings.groups,
				units,
				series: store,
				extras: INTRADAY_EXTRAS,
				indexes: [],
				activityRange: true,
				intradayDays: spanDays(chunk.from, chunk.to),
				parallelDays: SYNC_SPEEDS[settings.syncSpeed].parallelDays,
				shouldStop: () => this.backfillStopped,
			}),
		);
		await this.recordDays(store, report);
		return report;
	}

	/**
	 * How many of a routine run's days fetch their timelines: those inside
	 * the Day details range — for "New days only", the days since the setup.
	 * Before the setup, the engine's default: the newest week.
	 */
	private intradayFor(from: string, to: string): { intradayDays?: number } {
		const settings = this.settings();
		if (!settings.setup) return {};
		if (settings.data.dayDetails === "all") return { intradayDays: spanDays(from, to) };
		const start = settings.data.dayDetails === "new" ? settings.setup.completedAt.slice(0, 10) : rangeStart(settings.data.dayDetails, toIsoDate());
		const first = start && start > from ? start : from;
		return { intradayDays: first > to ? 0 : spanDays(first, to) };
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
		this.backfillTasks = null;
		this.backfillPending = false;
		this.backfillSkip = { days: new Set(), details: new Set(), walks: new Set() };
		this.walkStreaks.clear();
		this.clearBackfillTimer();
		this.setBackfill(null);
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
/** Days from `from` to `to`, inclusive. */
function spanDays(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * A run into a day buffer, then the buffer written. Days whose year file could
 * not be written count as failed, so nothing takes them for synced; a run that
 * throws still writes the days it got.
 */
async function syncDays(days: DayBuffer, run: () => Promise<SyncReport>): Promise<SyncReport> {
	let report: SyncReport;
	try {
		report = await run();
	} catch (err) {
		await days.flush().catch(() => undefined);
		throw err;
	}
	try {
		await days.flush();
	} catch (err) {
		const error = explain(err);
		for (const day of report.days) {
			if (day.status !== "written") continue;
			day.status = "failed";
			day.error = `day file: ${error}`;
			delete day.full;
			report.written -= 1;
			report.failed += 1;
		}
		report.warnings.push(`day files failed: ${error}`);
	}
	return report;
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
