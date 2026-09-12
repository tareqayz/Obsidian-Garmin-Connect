import type { Activity, DailySummary, SleepData } from "../garmin/endpoints";
import { GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import { silentLog, type Log } from "../log";
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
	activities(start?: number, limit?: number): Promise<Activity[]>;
}

export type WriteOutcome = "written" | "unchanged" | "missing";

/** Where a day's properties end up. Obsidian lives behind this. */
export interface NoteTarget {
	/** Local lookup only — a missing note must cost zero requests. */
	exists(date: string): boolean;
	write(date: string, properties: Properties): Promise<WriteOutcome>;
}

export interface SyncOptions {
	/** Inclusive ISO dates. */
	from: string;
	to: string;
	groups: readonly MetricGroup[];
	units: "metric" | "imperial";
	prefix: string;
	/** Leave days without a daily note alone instead of creating one. */
	requireExistingNote: boolean;
	/** Courtesy pause between days, in ms. */
	pauseBetweenDays?: number;
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
	written: number;
	unchanged: number;
	skipped: number;
	failed: number;
	/** Set when the sync gave up before finishing the range. */
	stoppedEarly?: string;
	requests: number;
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
		written: 0,
		unchanged: 0,
		skipped: 0,
		failed: 0,
		requests: 0,
	};
	if (dates.length === 0) return report;

	log.step(`Syncing ${dates.length} day(s): ${opts.from} → ${opts.to}`);

	// Days with no note are skipped before any request, so decide that first and
	// only fetch activities if some day actually needs them.
	const due = opts.requireExistingNote ? dates.filter((d) => target.exists(d)) : [...dates];
	for (const date of dates) {
		if (!due.includes(date)) {
			report.days.push({ date, status: "no-note" });
			report.skipped += 1;
		}
	}
	if (due.length === 0) {
		log.warn("no daily notes exist for this range — nothing fetched");
		return finish(report, log);
	}

	let workoutsByDate = new Map<string, Activity[]>();
	if (wanted.workouts) {
		try {
			const { activities, requests } = await fetchActivitiesFor(source, opts.from);
			report.requests += requests;
			workoutsByDate = bucketWorkoutsByDate(activities);
			log.detail("workouts found", activities.length);
		} catch (err) {
			if (isFatal(err)) return stop(report, err, log);
			log.warn(`activity list failed: ${message(err)}`);
		}
	}

	let done = 0;
	for (const date of due) {
		if (opts.shouldStop?.()) {
			report.stoppedEarly = "cancelled";
			break;
		}

		const fetched = await fetchDay(source, date, wanted);
		report.requests += fetched.requests;
		if (fetched.fatal) return stop(report, fetched.fatal, log);

		const data: DayData = { ...fetched.data, workouts: workoutsByDate.get(date) ?? [] };
		const properties = mapDay(data, {
			groups: opts.groups,
			units: opts.units,
			prefix: opts.prefix,
		});
		const count = Object.keys(properties).length;

		const result: DayResult = { date, status: "no-data", properties: count };
		if (fetched.warnings.length) result.warnings = fetched.warnings;

		if (count === 0) {
			log.detail(date, "no data");
			report.skipped += 1;
		} else {
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
	const jobs: Array<{ name: keyof DayData; run: () => Promise<unknown> }> = [];
	if (wanted.summary) jobs.push({ name: "summary", run: () => source.dailySummary(date) });
	if (wanted.sleep) jobs.push({ name: "sleep", run: () => source.sleep(date) });
	if (wanted.hrv) jobs.push({ name: "hrv", run: () => source.hrv(date) });
	if (wanted.readiness) jobs.push({ name: "readiness", run: () => source.trainingReadiness(date) });

	const settled = await Promise.allSettled(jobs.map((j) => j.run()));

	const out: DayFetch = { data: {}, warnings: [], requests: jobs.length };
	settled.forEach((result, i) => {
		const name = jobs[i]!.name;
		if (result.status === "fulfilled") {
			assign(out.data, name, result.value);
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
		default:
			break;
	}
}

const ACTIVITY_PAGE = 50;
const MAX_ACTIVITY_PAGES = 5;

/**
 * Walks the activity list back to `from` rather than asking per day — one paged
 * call covers the whole range, where per-day queries would be one request each.
 */
async function fetchActivitiesFor(
	source: SyncSource,
	from: string,
): Promise<{ activities: Activity[]; requests: number }> {
	const activities: Activity[] = [];
	let requests = 0;

	for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
		const batch = await source.activities(page * ACTIVITY_PAGE, ACTIVITY_PAGE);
		requests += 1;
		if (!batch.length) break;
		activities.push(...batch);

		const oldest = batch
			.map((a) => localDateOf(a.startTimeLocal))
			.filter((d): d is string => Boolean(d))
			.sort()[0];
		if (oldest && oldest < from) break;
		if (batch.length < ACTIVITY_PAGE) break;
	}

	return { activities, requests };
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
