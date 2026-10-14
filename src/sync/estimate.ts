import type { Span } from "./coverage";
import { versionOn } from "./coverage";
import { DAY_DETAILS_VERSION, RUN_DETAILS_VERSION, rangeStart, type DataSetId, type DayDetailsRange, type RunDetailsRange } from "./datasets";
import { shiftDate } from "./day-index";
import { DAY_INDEXES } from "./day-indexes";
import { endpointsFor, type MetricGroup } from "./metrics";
import { daysSince, historyStart, type AccountScan } from "./scan";
import { secondsPerDay, SYNC_SPEEDS, type SyncSpeed } from "./speed";

/**
 * How much a choice of data sets stores and how long its backfill takes, for
 * the setup and Settings → Data. Sizes were measured on a vault of 439 days
 * and 233 runs on 2026-10-14; times follow the sync speed and the backfill's
 * hourly budget. Every figure is an estimate, shown as "about".
 *
 * Pure.
 */

/** A day's file. */
export const DAY_FILE_BYTES = 3_700;
/** A day's full timelines: the median series file with intraday. */
export const TIMELINE_BYTES = 40_000;
/** A run's page. */
export const RUN_BYTES = 154_000;
/** A row on the activity list. */
export const ACTIVITY_ROW_BYTES = 355;
/** Requests a run's page takes. */
export const RUN_REQUESTS = 10;
/** A run downloads no faster than one each this long: a pause between runs, and its requests. */
export const RUN_SECONDS = 2.85;
/** How long one window of a history walk waits on Garmin. */
export const WINDOW_SECONDS = 0.6;
/** Day chunks are sized to take about this long, so a sync never waits longer for one. */
export const CHUNK_SECONDS = 10;

/**
 * Requests an hour a backfill stays under, by speed: well inside the
 * ~17,600 an hour measured clean (`docs/garmin-api.md`, Request pace), for a
 * quota Garmin may count over hours.
 */
export const HOURLY_BUDGET: Record<SyncSpeed, number> = { gentle: 5_000, normal: 10_000, fast: 15_000 };

/** Bytes a day each chart index keeps, measured. Sparse ones (a row a week or a test) count `SPARSE_ROW_BYTES`. */
const ROW_BYTES: Record<string, number> = {
	"training-readiness": 415,
	"health-status": 359,
	sleep: 291,
	"training-status": 184,
	"daily-stats": 164,
	"hrv-status": 156,
	"body-battery": 130,
	"heat-acclimation": 110,
	"running-tolerance": 98,
	stress: 89,
	"hill-score": 89,
	"fitness-age": 87,
	"endurance-score": 84,
	"race-predictions": 83,
	"heart-rate": 59,
	respiration: 46,
	"pulse-ox": 35,
	"vo2-max": 20,
};
const SPARSE_ROW_BYTES = 5;

/** Per-day requests the groups ask for, intraday's six included. */
export function requestsPerDay(groups: readonly MetricGroup[]): number {
	const w = endpointsFor(groups);
	const perDay = [w.summary, w.sleep, w.hrv, w.readiness, w.endurance, w.training, w.body, w.fitnessAge, w.health].filter(Boolean).length;
	return perDay + (w.intraday ? 6 : 0);
}

/** Requests a backfill chunk of days costs on top of its days: one per range route, the activity list among them. */
export function requestsPerChunk(groups: readonly MetricGroup[]): number {
	const w = endpointsFor(groups);
	return [w.maxMetrics, w.races, w.workouts, w.hillScores, w.runningTolerance, w.healthSnapshots].filter(Boolean).length;
}

/** Days in a chunk: as many as fit in about `CHUNK_SECONDS` at the speed. */
export function chunkDays(groups: readonly MetricGroup[], speed: SyncSpeed): number {
	return Math.max(1, Math.floor(CHUNK_SECONDS / secondsPerDay(requestsPerDay(groups), SYNC_SPEEDS[speed])));
}

/** Seconds for `requests` that take `seconds` at the speed's pace, held to the hourly budget. */
export function withBudget(requests: number, seconds: number, speed: SyncSpeed): number {
	const budget = HOURLY_BUDGET[speed];
	if (requests <= budget || seconds <= 0) return seconds;
	const hours = Math.ceil(requests / budget) - 1;
	return hours * 3600 + ((requests - hours * budget) / requests) * seconds;
}

/** What the vault already holds, so only the rest counts. */
export interface Held {
	/** The day coverage's spans. */
	daySpans?: readonly Span[];
	/** The run coverage: file version by run. */
	runs?: ReadonlyMap<number, number>;
	/** The chart indexes' metas by store (`index:<kind>`, `daily-stats`, `sleep`, `activities`): complete, or how far back they reach. */
	charts?: ReadonlyMap<string, { complete: boolean; from?: string }>;
}

export interface EstimateInput {
	today: string;
	groups: readonly MetricGroup[];
	speed: SyncSpeed;
	scan: AccountScan;
	dayDetails: DayDetailsRange;
	runDetails: RunDetailsRange;
	/** The runs on the activity index, by local day: what Run details would download. */
	runs: ReadonlyArray<{ id: number; date: string }>;
	held?: Held;
}

export interface SetEstimate {
	id: DataSetId;
	/** Days, or runs, to fetch. */
	units: number;
	bytes: number;
	requests: number;
	seconds: number;
	/** What keeping every new day, or run, adds a year. */
	bytesPerYear: number;
}

export interface Estimate {
	sets: SetEstimate[];
	bytes: number;
	requests: number;
	seconds: number;
	bytesPerYear: number;
	/** The biggest single file the choice keeps: Obsidian Sync's Standard plan takes 5 MB a file. */
	largestFile: number;
}

export function estimate(input: EstimateInput): Estimate {
	const start = historyStart(input.scan);
	const parts = [charts(input, start), dayDetails(input, start), runDetails(input, start)];
	const sets = parts.map((part) => part.set);
	const requests = sum(sets, (s) => s.requests);
	// The budget holds across the whole backfill, not set by set.
	const raw = sum(parts, (part) => part.raw);
	const activitiesPerYear = perYear(input.scan.activities, input.scan, input.today);
	return {
		sets,
		bytes: sum(sets, (s) => s.bytes),
		requests,
		seconds: withBudget(requests, raw, input.speed),
		bytesPerYear: sum(sets, (s) => s.bytesPerYear),
		largestFile: Math.max(365 * DAY_FILE_BYTES, Math.round(activitiesPerYear * ACTIVITY_ROW_BYTES)),
	};
}

/** A set's estimate, and its time before the hourly budget. */
interface Part {
	set: SetEstimate;
	raw: number;
}

/** The chart indexes: a walk each over the history they do not hold yet. */
function charts(input: EstimateInput, start: string | undefined): Part {
	const on = new Set(input.groups);
	const held = input.held?.charts;
	const parallel = SYNC_SPEEDS[input.speed].parallelDays;
	/** Days still to walk for a store, and those of them with data. */
	const toWalk = (store: string): { days: number; withData: number } => {
		const meta = held?.get(store);
		if (!start || meta?.complete) return { days: 0, withData: 0 };
		const until = meta?.from ? shiftDate(meta.from, -1) : input.today;
		if (until < start) return { days: 0, withData: 0 };
		const days = spanDays(start, until);
		return { days, withData: Math.max(0, daysSince(input.scan, start) - (meta?.from ? daysSince(input.scan, meta.from) : 0)) };
	};

	let requests = 0;
	let bytes = 0;
	let rowBytes = 0;
	if (on.has("workouts") && !held?.get("activities")?.complete) requests += 1 + Math.ceil(input.scan.activities / 100);
	if (on.has("workouts")) bytes += held?.get("activities")?.complete ? 0 : input.scan.activities * ACTIVITY_ROW_BYTES;
	if (on.has("activity")) {
		// Three requests a window with steps, one a window without, and the empty windows that end the walk.
		const walk = toWalk("daily-stats");
		const windows = Math.ceil(walk.days / 28);
		const withSteps = Math.min(windows, Math.ceil(walk.withData / 28));
		requests += walk.days ? withSteps * 3 + (windows - withSteps) + 4 : 0;
		bytes += walk.withData * ROW_BYTES["daily-stats"]!;
		rowBytes += ROW_BYTES["daily-stats"]!;
	}
	if (on.has("sleep")) {
		const walk = toWalk("sleep");
		requests += walk.days ? Math.ceil(walk.days / 28) + 4 : 0;
		bytes += walk.withData * ROW_BYTES.sleep!;
		rowBytes += ROW_BYTES.sleep!;
	}
	for (const def of DAY_INDEXES) {
		if (!on.has(def.group)) continue;
		const walk = toWalk(`index:${def.kind}`);
		const row = ROW_BYTES[def.kind] ?? SPARSE_ROW_BYTES;
		if (walk.days) requests += (Math.ceil(walk.days / def.windowDays) + def.emptyWindowsToStop) * def.requestsPerWindow;
		bytes += walk.withData * row;
		rowBytes += row;
	}
	// The walks of different indexes go side by side, as many as the days a sync fetches at once.
	const raw = (requests * WINDOW_SECONDS) / parallel;
	const activitiesPerYear = perYear(input.scan.activities, input.scan, input.today);
	return {
		raw,
		set: {
			id: "charts",
			units: start ? daysSince(input.scan, start) : 0,
			bytes,
			requests,
			seconds: withBudget(requests, raw, input.speed),
			bytesPerYear: Math.round(365 * rowBytes + (on.has("workouts") ? activitiesPerYear * ACTIVITY_ROW_BYTES : 0)),
		},
	};
}

/** Each day of the range with data that the coverage does not hold at today's version. */
function dayDetails(input: EstimateInput, start: string | undefined): Part {
	const intraday = input.groups.includes("intraday");
	const dayBytes = DAY_FILE_BYTES + (intraday ? TIMELINE_BYTES : 0);
	const from = rangeStart(input.dayDetails, input.today, start);
	let units = 0;
	if (from) {
		const covered = countCovered(input.held?.daySpans ?? [], from, input.today);
		units = Math.max(0, daysSince(input.scan, from) - covered);
	}
	const chunks = units ? Math.ceil(units / chunkDays(input.groups, input.speed)) : 0;
	const preset = SYNC_SPEEDS[input.speed];
	const perChunk = requestsPerChunk(input.groups);
	const requests = units * requestsPerDay(input.groups) + chunks * perChunk;
	const raw = units * secondsPerDay(requestsPerDay(input.groups), preset) + (chunks * perChunk) / preset.limits.rate;
	return {
		raw,
		set: {
			id: "day-details",
			units,
			bytes: units * dayBytes,
			requests,
			seconds: withBudget(requests, raw, input.speed),
			bytesPerYear: 365 * dayBytes,
		},
	};
}

/** Each run in the range without a file of today's version. */
function runDetails(input: EstimateInput, start: string | undefined): Part {
	const from = rangeStart(input.runDetails, input.today, start);
	const held = input.held?.runs;
	const units = from ? input.runs.filter((run) => run.date >= from && held?.get(run.id) !== RUN_DETAILS_VERSION).length : 0;
	const lastYear = shiftDate(input.today, -364);
	const runsPerYear = input.runs.filter((run) => run.date >= lastYear).length;
	const requests = units * RUN_REQUESTS;
	const raw = units * RUN_SECONDS;
	return {
		raw,
		set: {
			id: "run-details",
			units,
			bytes: units * RUN_BYTES,
			requests,
			seconds: withBudget(requests, raw, input.speed),
			bytesPerYear: input.runDetails === "opened" ? 0 : runsPerYear * RUN_BYTES,
		},
	};
}

/** Days of `from..to` the spans hold at today's version of Day details. */
function countCovered(spans: readonly Span[], from: string, to: string): number {
	let n = 0;
	for (let date = from; date <= to; date = shiftDate(date, 1)) if (versionOn(spans, date) === DAY_DETAILS_VERSION) n += 1;
	return n;
}

/** How many of `count` fall in a year, over the span the scan covers. */
function perYear(count: number, scan: AccountScan, today: string): number {
	const start = historyStart(scan);
	if (!start || !count) return 0;
	return (count * 365) / Math.max(30, spanDays(start, today));
}

function spanDays(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function sum<T>(items: readonly T[], of: (item: T) => number): number {
	return items.reduce((total, item) => total + of(item), 0);
}

/** "≈ 3.9 MB", "≈ 640 KB", "< 1 KB". */
export function formatBytes(bytes: number): string {
	if (bytes < 1_000) return bytes > 0 ? "< 1 KB" : "0 KB";
	if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
	if (bytes < 10_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
	if (bytes < 1_000_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
	return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/** "under a minute", "about 4 minutes", "about 2.5 hours". */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return "under a minute";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
	const hours = seconds / 3600;
	if (hours < 1.25) return "about 1 hour";
	if (hours < 10) return `about ${Math.round(hours * 2) / 2} hours`;
	return `about ${Math.round(hours)} hours`;
}
