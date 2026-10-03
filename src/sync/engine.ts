import {
	maxMetricsDate,
	type Activity,
	type BodyBatteryEvent,
	type BodyComposition,
	type DailyStress,
	type DailySummary,
	type EnduranceScore,
	type FitnessAge,
	type HealthSnapshot,
	type HealthStatus,
	type HeartRateData,
	type HillScore,
	type MaxMetrics,
	type RacePrediction,
	type RunningTolerance,
	type SleepData,
	type StepsChartEntry,
	type TrainingStatus,
} from "../garmin/endpoints";
import { GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import { silentLog, type Log } from "../log";
import { isEmptySeries, mapSeries, type DaySeries, type IntradayPayloads } from "./intraday";
import {
	bucketWorkoutsByDate,
	endpointsFor,
	localDateOf,
	mapDay,
	type DayData,
	type HrvData,
	type MetricGroup,
	type Properties,
	type ReadinessEntry,
} from "./metrics";

/** The slice of GarminApi the engine needs. Narrow enough to fake in a test. */
export interface SyncSource {
	dailySummary(date: string): Promise<DailySummary>;
	sleep(date: string): Promise<SleepData>;
	hrv(date: string): Promise<Record<string, unknown> | null>;
	trainingReadiness(date: string): Promise<unknown[]>;
	enduranceScore(date: string): Promise<EnduranceScore | null>;
	trainingStatus(date: string): Promise<TrainingStatus | null>;
	bodyComposition(date: string): Promise<BodyComposition | null>;
	fitnessAge(date: string): Promise<FitnessAge | null>;
	healthStatus(date: string): Promise<HealthStatus | null>;
	/** Intraday: several hundred points each, so only for the newest days of a run. */
	stress(date: string): Promise<DailyStress | null>;
	heartRate(date: string): Promise<HeartRateData>;
	stepsChart(date: string): Promise<StepsChartEntry[]>;
	bodyBatteryEvents(date: string): Promise<BodyBatteryEvent[]>;
	/** Range endpoints: one call covers the whole window. */
	maxMetrics(start: string, end?: string): Promise<MaxMetrics[]>;
	racePredictions(start: string, end?: string): Promise<RacePrediction[]>;
	hillScores(start: string, end?: string): Promise<HillScore[]>;
	runningTolerance(start: string, end?: string): Promise<RunningTolerance[]>;
	healthSnapshots(start: string, end?: string): Promise<HealthSnapshot[]>;
	activities(start?: number, limit?: number): Promise<Activity[]>;
}

export type WriteOutcome = "written" | "unchanged" | "missing";

/** Where a day's intraday series end up — a file per day, not frontmatter. */
export interface SeriesTarget {
	write(date: string, series: DaySeries): Promise<"written" | "unchanged">;
}

/** Where a day's properties end up. Obsidian lives behind this. */
export interface NoteTarget {
	/**
	 * Can this day be written at all? Local lookup only — answering "no" must
	 * cost zero requests. A target that creates its own notes always says yes.
	 */
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}

/**
 * Where the activity list ends up besides the day notes: the activity index
 * the Activities pages read (`activity-index.ts`).
 */
export interface ActivitySink {
	/**
	 * Folds in what the list returned, newest first from its first page.
	 * `complete` says it reached the end of the list: the whole history.
	 * Resolves with how many files changed.
	 */
	merge(listing: readonly Activity[], complete: boolean): Promise<number>;
}

export interface SyncOptions {
	/** Inclusive ISO dates. */
	from: string;
	to: string;
	groups: readonly MetricGroup[];
	units: "metric" | "imperial";
	/** Where intraday series go. Without one the `intraday` group fetches nothing. */
	series?: SeriesTarget;
	/**
	 * Where the activity list goes for the activity index. Fed whenever the
	 * `workouts` group is on, even when no day in the range can be written.
	 */
	activities?: ActivitySink;
	/**
	 * How many of the newest days in a run get intraday series. They cost four
	 * requests a day, and a year's backfill of them would be 1,460 requests for
	 * charts nobody scrolls back to. Defaults to `INTRADAY_DAYS`.
	 */
	intradayDays?: number;
	/** Courtesy pause between days, in ms. */
	pauseBetweenDays?: number;
	/**
	 * Give up after this many consecutive days with nothing in them.
	 *
	 * The sync walks newest to oldest, so a backfill that reaches past the start
	 * of your Garmin history hits an unbroken run of empty days. Without this it
	 * would keep asking — four requests a day, all the way to the start date —
	 * and almost certainly trip Garmin's rate limit on the way. 0 disables it.
	 */
	stopAfterEmptyDays?: number;
	log?: Log;
	onProgress?: (done: number, total: number, date: string) => void;
	/** Checked between days so a long backfill can be interrupted. */
	shouldStop?: () => boolean;
	/** Injectable for tests. */
	wait?: (ms: number) => Promise<void>;
}

export type DayStatus = "written" | "unchanged" | "no-note" | "no-data" | "failed";

export interface DayResult {
	date: string;
	status: DayStatus;
	/** How many properties were mapped. */
	properties?: number;
	/** Endpoints that failed for this day without stopping the sync. */
	warnings?: string[];
	error?: string;
}

export interface SyncReport {
	days: DayResult[];
	/**
	 * Problems that were not specific to one day — a range endpoint failing, say.
	 * Without these a missing metric looks like Garmin simply had no data.
	 */
	warnings: string[];
	written: number;
	unchanged: number;
	skipped: number;
	failed: number;
	/** Set when the sync gave up before finishing the range. */
	stoppedEarly?: string;
	requests: number;
	/** Days whose series file was created or changed. */
	seriesWritten: number;
	/** Activity index files created or changed. */
	activityFilesWritten: number;
}

/**
 * Writes the same day to several places.
 *
 * A day counts as written if anywhere took it; unchanged only when every target
 * agreed there was nothing to do.
 */
export class MultiTarget implements NoteTarget {
	private targets: NoteTarget[];

	constructor(targets: NoteTarget[]) {
		this.targets = targets;
	}

	exists(date: string): boolean {
		return this.targets.some((t) => t.exists(date));
	}

	async write(date: string, properties: Properties): Promise<WriteOutcome> {
		const outcomes: WriteOutcome[] = [];
		for (const target of this.targets) {
			if (!target.exists(date)) {
				outcomes.push("missing");
				continue;
			}
			outcomes.push(await target.write(date, properties));
		}
		if (outcomes.includes("written")) return "written";
		if (outcomes.includes("unchanged")) return "unchanged";
		return "missing";
	}
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function utcOf(iso: string): number {
	const [y, m, d] = iso.split("-").map(Number);
	return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
}

function isoOf(utc: number): string {
	return new Date(utc).toISOString().slice(0, 10);
}

/** Inclusive range, newest first — so a sync cut short by a 429 covered the days that matter most. */
export function dateRange(from: string, to: string): string[] {
	const start = utcOf(from);
	const end = utcOf(to);
	if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
	const dates: string[] = [];
	for (let t = end; t >= start; t -= DAY_MS) dates.push(isoOf(t));
	return dates;
}

/**
 * Garmin rejects a race-prediction range longer than a year, and the other range
 * endpoints are undocumented, so every range request is cut to windows of this
 * size. A 407-day backfill asking for 407 days in one go is out of contract.
 */
export const RANGE_CHUNK_DAYS = 365;

/** See `SyncOptions.intradayDays`. A week covers the dashboard's today and yesterday with room to spare. */
export const INTRADAY_DAYS = 7;

/**
 * Windows for the range calls whose limits nobody has published. The web app
 * asks for 28 days of hill score and a week of snapshots; staying at or under
 * what it asks for is the safe side of an unknown limit.
 */
const SHORT_RANGE_DAYS = 28;

/** Splits an inclusive range into windows of at most `size` days, oldest first. */
export function chunkRange(from: string, to: string, size = RANGE_CHUNK_DAYS): Array<{ from: string; to: string }> {
	const start = utcOf(from);
	const end = utcOf(to);
	if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];

	const windows: Array<{ from: string; to: string }> = [];
	for (let cursor = start; cursor <= end; cursor += size * DAY_MS) {
		const stop = Math.min(cursor + (size - 1) * DAY_MS, end);
		windows.push({ from: isoOf(cursor), to: isoOf(stop) });
	}
	return windows;
}

/** The last `days` days ending today (inclusive). */
export function lastNDays(days: number, today: string): { from: string; to: string } {
	const end = utcOf(today);
	return { from: isoOf(end - (Math.max(1, days) - 1) * DAY_MS), to: today };
}

/* ------------------------------------------------------------------ */
/*  Sync                                                               */
/* ------------------------------------------------------------------ */

const defaultWait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function syncRange(
	source: SyncSource,
	target: NoteTarget,
	opts: SyncOptions,
): Promise<SyncReport> {
	const log = opts.log ?? silentLog;
	const wait = opts.wait ?? defaultWait;
	const wanted = endpointsFor(opts.groups);
	const dates = dateRange(opts.from, opts.to);

	const report: SyncReport = {
		days: [],
		warnings: [],
		written: 0,
		unchanged: 0,
		skipped: 0,
		failed: 0,
		requests: 0,
		seriesWritten: 0,
		activityFilesWritten: 0,
	};
	if (dates.length === 0) return report;

	log.step(`Syncing ${dates.length} day(s): ${opts.from} → ${opts.to}`);

	// Days with nowhere to go are skipped before any request, so decide that
	// first and only fetch activities if some day actually needs them.
	const due = dates.filter((d) => target.exists(d));
	for (const date of dates) {
		if (!due.includes(date)) {
			report.days.push({ date, status: "no-note" });
			report.skipped += 1;
		}
	}
	// The activity index wants the list even when no note does: it is how a
	// new activity reaches the Activities pages.
	const indexing = Boolean(wanted.workouts && opts.activities);
	if (due.length === 0 && !indexing) {
		log.warn("nothing in this range can be written to — nothing fetched");
		return finish(report, log);
	}

	let workoutsByDate = new Map<string, Activity[]>();
	if (wanted.workouts) {
		try {
			const { activities, requests, reachedEnd } = await fetchActivitiesFor(source, opts.from);
			report.requests += requests;
			workoutsByDate = bucketWorkoutsByDate(activities);
			log.detail("workouts found", activities.length);
			if (opts.activities) {
				try {
					report.activityFilesWritten += await opts.activities.merge(activities, reachedEnd);
				} catch (err) {
					note(report, log, `activity index: ${message(err)}`);
				}
			}
		} catch (err) {
			if (isFatal(err)) return stop(report, err, log);
			log.warn(`activity list failed: ${message(err)}`);
		}
	}
	if (due.length === 0) {
		log.warn("nothing in this range can be written to");
		return finish(report, log);
	}

	// VO2 Max and race predictions come back for a whole range in one request,
	// so they are fetched once here rather than four hundred times below.
	const oldest = due[due.length - 1] ?? opts.from;
	const newest = due[0] ?? opts.to;

	let maxMetricsByDate = new Map<string, MaxMetrics>();
	if (wanted.maxMetrics) {
		const got = await fetchRange(oldest, newest, (a, b) => source.maxMetrics(a, b));
		report.requests += got.requests;
		maxMetricsByDate = byDate(got.rows, maxMetricsDate);
		if (got.fatal) return stop(report, got.fatal, log);
		if (got.error) note(report, log, `VO2 Max: ${got.error}`);
		else if (maxMetricsByDate.size === 0) {
			note(report, log, "VO2 Max: Garmin returned no rows for this range");
		}
		log.detail("VO2 Max days", maxMetricsByDate.size);
	}

	let racesByDate = new Map<string, RacePrediction>();
	if (wanted.races) {
		const got = await fetchRange(oldest, newest, (a, b) => source.racePredictions(a, b));
		report.requests += got.requests;
		racesByDate = byCalendarDate(got.rows);
		if (got.fatal) return stop(report, got.fatal, log);
		if (got.error) note(report, log, `race predictions: ${got.error}`);
		else if (racesByDate.size === 0) {
			note(report, log, "race predictions: Garmin returned no rows for this range");
		}
		log.detail("race prediction days", racesByDate.size);
	}

	let hillByDate = new Map<string, HillScore>();
	if (wanted.hillScores) {
		const got = await fetchRange(oldest, newest, (a, b) => source.hillScores(a, b), SHORT_RANGE_DAYS);
		report.requests += got.requests;
		if (got.fatal) return stop(report, got.fatal, log);
		if (got.error) note(report, log, `hill score: ${got.error}`);
		// Several devices can report the same day; the primary one wins.
		hillByDate = byDate(
			[...got.rows].sort((a, b) => Number(a.primaryTrainingDevice === true) - Number(b.primaryTrainingDevice === true)),
			(row) => row?.calendarDate,
		);
	}

	let toleranceByDate = new Map<string, RunningTolerance>();
	if (wanted.runningTolerance) {
		const got = await fetchRange(oldest, newest, (a, b) => source.runningTolerance(a, b), SHORT_RANGE_DAYS);
		report.requests += got.requests;
		if (got.fatal) return stop(report, got.fatal, log);
		if (got.error) note(report, log, `running tolerance: ${got.error}`);
		toleranceByDate = byCalendarDate(got.rows);
	}

	const snapshotsByDate = new Map<string, HealthSnapshot[]>();
	if (wanted.healthSnapshots) {
		const got = await fetchRange(oldest, newest, (a, b) => source.healthSnapshots(a, b), SHORT_RANGE_DAYS);
		report.requests += got.requests;
		if (got.fatal) return stop(report, got.fatal, log);
		if (got.error) note(report, log, `health snapshots: ${got.error}`);
		for (const row of got.rows) {
			const date = row?.calendarDate;
			if (typeof date !== "string") continue;
			snapshotsByDate.set(date, [...(snapshotsByDate.get(date) ?? []), row]);
		}
	}

	const emptyLimit = opts.stopAfterEmptyDays ?? 0;
	const intradayDays = Math.max(0, opts.intradayDays ?? INTRADAY_DAYS);
	let emptyRun = 0;
	let done = 0;

	for (const [index, date] of due.entries()) {
		if (opts.shouldStop?.()) {
			report.stoppedEarly = "cancelled";
			break;
		}

		const withSeries = Boolean(wanted.intraday && opts.series);
		const fetched = await fetchDay(source, date, {
			...wanted,
			intraday: withSeries && index < intradayDays,
		});
		report.requests += fetched.requests;
		if (fetched.fatal) return stop(report, fetched.fatal, log);

		// The hypnogram rides in the sleep payload, so every day with sleep gets
		// a series file, not only the newest few that paid for the rest.
		const series = withSeries ? mapSeries({ ...fetched.intraday, sleep: fetched.data.sleep }) : null;

		const data: DayData = {
			...fetched.data,
			workouts: workoutsByDate.get(date) ?? [],
			maxMetrics: maxMetricsByDate.get(date) ?? null,
			races: racesByDate.get(date) ?? null,
			hillScore: hillByDate.get(date) ?? null,
			runningTolerance: toleranceByDate.get(date) ?? null,
			healthSnapshots: snapshotsByDate.get(date) ?? null,
			series,
		};
		const properties = mapDay(data, { groups: opts.groups, units: opts.units, date });
		const count = Object.keys(properties).length;

		const result: DayResult = { date, status: "no-data", properties: count };
		if (fetched.warnings.length) result.warnings = fetched.warnings;

		if (series && !isEmptySeries(series) && opts.series) {
			try {
				if ((await opts.series.write(date, series)) === "written") report.seriesWritten += 1;
			} catch (err) {
				(result.warnings ??= []).push(`series file: ${message(err)}`);
				log.warn(`${date}: series file failed: ${message(err)}`);
			}
		}

		if (count === 0) {
			log.detail(date, "no data");
			report.skipped += 1;
			emptyRun += 1;
		} else {
			emptyRun = 0;
			try {
				const outcome = await target.write(date, properties);
				result.status = outcome === "missing" ? "no-note" : outcome;
				if (outcome === "written") report.written += 1;
				else if (outcome === "unchanged") report.unchanged += 1;
				else report.skipped += 1;
				log.detail(date, `${count} properties — ${result.status}`);
			} catch (err) {
				result.status = "failed";
				result.error = message(err);
				report.failed += 1;
				log.fail(`${date}: ${result.error}`);
			}
		}

		report.days.push(result);

		if (emptyLimit > 0 && emptyRun >= emptyLimit) {
			report.stoppedEarly =
				`nothing found for ${emptyRun} days running, back to ${date} — ` +
				"the account looks to have no data older than that";
			log.warn(report.stoppedEarly);
			break;
		}

		// Incremented on its own line: `onProgress?.(++done)` would skip the
		// increment entirely whenever no progress callback is supplied, and the
		// pause-between-days check below reads `done`.
		done += 1;
		opts.onProgress?.(done, due.length, date);

		const pause = opts.pauseBetweenDays ?? 0;
		if (pause > 0 && done < due.length) await wait(pause);
	}

	return finish(report, log);
}

/* ------------------------------------------------------------------ */
/*  Fetching                                                           */
/* ------------------------------------------------------------------ */

interface DayFetch {
	data: DayData;
	intraday: IntradayPayloads;
	warnings: string[];
	requests: number;
	/** Set when the sync must abandon the whole range, not just this day. */
	fatal?: unknown;
}

async function fetchDay(
	source: SyncSource,
	date: string,
	wanted: ReturnType<typeof endpointsFor>,
): Promise<DayFetch> {
	const jobs: Array<{ name: keyof DayData | IntradayJob; run: () => Promise<unknown> }> = [];
	if (wanted.summary) jobs.push({ name: "summary", run: () => source.dailySummary(date) });
	if (wanted.sleep) jobs.push({ name: "sleep", run: () => source.sleep(date) });
	if (wanted.hrv) jobs.push({ name: "hrv", run: () => source.hrv(date) });
	if (wanted.readiness) jobs.push({ name: "readiness", run: () => source.trainingReadiness(date) });
	if (wanted.endurance) jobs.push({ name: "endurance", run: () => source.enduranceScore(date) });
	if (wanted.training) jobs.push({ name: "training", run: () => source.trainingStatus(date) });
	if (wanted.body) jobs.push({ name: "body", run: () => source.bodyComposition(date) });
	if (wanted.fitnessAge) jobs.push({ name: "fitnessAge", run: () => source.fitnessAge(date) });
	if (wanted.health) jobs.push({ name: "health", run: () => source.healthStatus(date) });
	if (wanted.intraday) {
		jobs.push({ name: "intraday.stress", run: () => source.stress(date) });
		jobs.push({ name: "intraday.heartRate", run: () => source.heartRate(date) });
		jobs.push({ name: "intraday.steps", run: () => source.stepsChart(date) });
		jobs.push({ name: "intraday.bodyBatteryEvents", run: () => source.bodyBatteryEvents(date) });
	}

	const settled = await Promise.allSettled(jobs.map((j) => j.run()));

	const out: DayFetch = { data: {}, intraday: {}, warnings: [], requests: jobs.length };
	settled.forEach((result, i) => {
		const name = jobs[i]!.name;
		if (result.status === "fulfilled") {
			if (isIntradayJob(name)) assignIntraday(out.intraday, name, result.value);
			else assign(out.data, name, result.value);
			return;
		}
		// One endpoint being unavailable for one day must not lose the rest of
		// the day — but a 429 or a dead session means every later call fails too.
		if (isFatal(result.reason) && !out.fatal) out.fatal = result.reason;
		else out.warnings.push(`${name}: ${message(result.reason)}`);
	});

	return out;
}

function assign(data: DayData, name: keyof DayData, value: unknown): void {
	switch (name) {
		case "summary":
			data.summary = (value ?? null) as DailySummary | null;
			break;
		case "sleep":
			data.sleep = (value ?? null) as SleepData | null;
			break;
		case "hrv":
			data.hrv = (value ?? null) as HrvData | null;
			break;
		case "readiness":
			data.readiness = Array.isArray(value) ? (value as ReadinessEntry[]) : null;
			break;
		case "endurance":
			data.endurance = (value ?? null) as DayData["endurance"];
			break;
		case "training":
			data.training = (value ?? null) as TrainingStatus | null;
			break;
		case "body":
			data.body = (value ?? null) as BodyComposition | null;
			break;
		case "fitnessAge":
			data.fitnessAge = (value ?? null) as FitnessAge | null;
			break;
		case "health":
			data.health = (value ?? null) as HealthStatus | null;
			break;
		default:
			break;
	}
}

type IntradayJob = `intraday.${keyof Omit<IntradayPayloads, "sleep">}`;

function isIntradayJob(name: string): name is IntradayJob {
	return name.startsWith("intraday.");
}

function assignIntraday(out: IntradayPayloads, name: IntradayJob, value: unknown): void {
	switch (name) {
		case "intraday.stress":
			out.stress = (value ?? null) as DailyStress | null;
			break;
		case "intraday.heartRate":
			out.heartRate = (value ?? null) as HeartRateData | null;
			break;
		case "intraday.steps":
			out.steps = Array.isArray(value) ? (value as StepsChartEntry[]) : null;
			break;
		case "intraday.bodyBatteryEvents":
			out.bodyBatteryEvents = Array.isArray(value) ? (value as BodyBatteryEvent[]) : null;
			break;
	}
}

/**
 * Runs a range request in year-long chunks and merges the results.
 *
 * A chunk that fails is reported rather than swallowed: a metric silently
 * missing from a year of notes is worse than a warning.
 */
async function fetchRange<T>(
	from: string,
	to: string,
	fetch: (start: string, end: string) => Promise<T[]>,
	chunkDays = RANGE_CHUNK_DAYS,
): Promise<{ rows: T[]; requests: number; error?: string; fatal?: unknown }> {
	const rows: T[] = [];
	let requests = 0;
	for (const window of chunkRange(from, to, chunkDays)) {
		try {
			rows.push(...(await fetch(window.from, window.to)));
			requests += 1;
		} catch (err) {
			requests += 1;
			if (isFatal(err)) return { rows, requests, fatal: err };
			return { rows, requests, error: `${window.from}..${window.to}: ${message(err)}` };
		}
	}
	return { rows, requests };
}

function note(report: SyncReport, log: Log, text: string): void {
	report.warnings.push(text);
	log.warn(text);
}

/** Indexes a range response by the day it describes. */
function byCalendarDate<T extends { calendarDate?: string }>(rows: readonly T[]): Map<string, T> {
	return byDate(rows, (row) => row?.calendarDate);
}

function byDate<T>(rows: readonly T[], dateOf: (row: T) => string | undefined): Map<string, T> {
	const map = new Map<string, T>();
	for (const row of rows) {
		const date = dateOf(row);
		if (typeof date === "string") map.set(date, row);
	}
	return map;
}

const ACTIVITY_PAGE = 50;
const MAX_ACTIVITY_PAGES = 5;

/**
 * Walks the activity list back to `from` rather than asking per day — one paged
 * call covers the whole range, where per-day queries would be one request each.
 * `reachedEnd` says a short page came back: there is nothing older at all.
 */
async function fetchActivitiesFor(
	source: SyncSource,
	from: string,
): Promise<{ activities: Activity[]; requests: number; reachedEnd: boolean }> {
	const activities: Activity[] = [];
	let requests = 0;

	for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
		const batch = await source.activities(page * ACTIVITY_PAGE, ACTIVITY_PAGE);
		requests += 1;
		activities.push(...batch);
		if (batch.length < ACTIVITY_PAGE) return { activities, requests, reachedEnd: true };

		const oldest = batch
			.map((a) => localDateOf(a.startTimeLocal))
			.filter((d): d is string => Boolean(d))
			.sort()[0];
		if (oldest && oldest < from) break;
	}

	return { activities, requests, reachedEnd: false };
}

export interface HistoryOptions {
	/** Activities per request. The list honours 100. */
	pageSize?: number;
	/** Courtesy pause between pages, in ms. */
	pause?: number;
	onPage?: (fetched: number) => void;
	shouldStop?: () => boolean;
	/** Injectable for tests. */
	wait?: (ms: number) => Promise<void>;
}

export interface HistoryFetch {
	/** Newest first, from the first page down, with nothing missing in between. */
	activities: Activity[];
	requests: number;
	/** The list ran out: this is the whole history. */
	complete: boolean;
	/** A 429 or a dead session. What came before it is still a usable listing. */
	fatal?: unknown;
	error?: string;
}

/**
 * Pages through the whole activity list, for the activity index. About one
 * request per hundred activities, once; routine syncs only read the first page.
 */
export async function fetchAllActivities(
	source: Pick<SyncSource, "activities">,
	opts: HistoryOptions = {},
): Promise<HistoryFetch> {
	const size = Math.max(1, opts.pageSize ?? 100);
	const wait = opts.wait ?? defaultWait;
	const out: HistoryFetch = { activities: [], requests: 0, complete: false };
	const seen = new Set<unknown>();

	for (let page = 0; ; page++) {
		if (opts.shouldStop?.()) return out;
		let batch: Activity[];
		try {
			batch = await source.activities(page * size, size);
		} catch (err) {
			out.requests += 1;
			if (isFatal(err)) out.fatal = err;
			else out.error = message(err);
			return out;
		}
		out.requests += 1;

		// A list that ignored `start` would hand back the same page forever.
		const fresh = batch.filter((a) => !seen.has(a.activityId));
		if (batch.length && !fresh.length) {
			out.error = "the activity list stopped advancing";
			return out;
		}
		for (const a of fresh) seen.add(a.activityId);
		out.activities.push(...fresh);
		opts.onPage?.(out.activities.length);

		if (batch.length < size) {
			out.complete = true;
			return out;
		}
		if (opts.pause) await wait(opts.pause);
	}
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Errors that make every remaining request pointless. */
function isFatal(err: unknown): boolean {
	return err instanceof GarminRateLimitError || err instanceof GarminAuthError;
}

function message(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function stop(report: SyncReport, err: unknown, log: Log): SyncReport {
	report.stoppedEarly =
		err instanceof GarminRateLimitError
			? `rate limited by Garmin — ${message(err)}`
			: message(err);
	log.fail(`stopped: ${report.stoppedEarly}`);
	return finish(report, log);
}

function finish(report: SyncReport, log: Log): SyncReport {
	report.days.sort((a, b) => a.date.localeCompare(b.date));
	log.detail(
		"result",
		`${report.written} written, ${report.unchanged} unchanged, ` +
			`${report.skipped} skipped, ${report.failed} failed, ${report.requests} requests`,
	);
	return report;
}
