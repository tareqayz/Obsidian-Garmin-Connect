import { ACTIVITY_DETAIL_VERSION } from "./activity-detail";
import { INDEX_VERSION as ACTIVITY_INDEX_VERSION } from "./activity-index";
import { DAILY_STATS_VERSION } from "./daily-stats";
import { shiftDate } from "./day-index";
import { DAY_INDEXES } from "./day-indexes";
import type { MetricGroup } from "./metrics";
import { SLEEP_INDEX_VERSION } from "./sleep-index";

/**
 * The data sets the setup offers and a backfill fills, what version of each
 * the vault holds, and the consent keys a release asks about.
 *
 * - **Charts & trends**: every stat page's 7d / 4w / 1y history, the activity
 *   list and the sleep scores — the chart indexes. Always the whole history:
 *   about 0.9 MB and 150 requests a year.
 * - **Day details**: each day's file and its full timelines, back as far as
 *   the chosen range. Every new day is kept whatever the range.
 * - **Run details**: a run's page — map, charts, splits, laps — for the
 *   chosen range, or only the runs opened.
 *
 * **When a release stores more for days the vault already holds**, bump the
 * version here (or the index's own `version`) and add a line to `changes`.
 * The days held at an older version are then what the next update offers to
 * fetch again, and the setup's estimates follow. `tests/dataset-shapes.test.ts`
 * fails when what a set stores changes without a bump.
 *
 * Pure.
 */

/** The day files plus each day's full timelines. */
export const DAY_DETAILS_VERSION = 1;

/** A downloaded run's file: `ACTIVITY_DETAIL_VERSION`, which `activity-detail.ts` owns. */
export const RUN_DETAILS_VERSION = ACTIVITY_DETAIL_VERSION;

export type DataSetId = "charts" | "day-details" | "run-details";

/** What a version of a set added, for the update dialog. */
export interface DataChange {
	summary: string;
	/**
	 * Whether the days already held must be fetched again for it. A change
	 * rebuilt from the files the vault holds is done without asking.
	 */
	refetch: boolean;
}

export interface DataSet {
	id: DataSetId;
	label: string;
	blurb: string;
	/** What each version added, by version. Version 1 is where the sets began. */
	changes: Readonly<Record<number, DataChange>>;
}

export const DATA_SETS: readonly DataSet[] = [
	{
		id: "charts",
		label: "Charts & trends",
		blurb: "Every stat's 7-day, 4-week and 1-year charts, your activity list and sleep scores.",
		changes: {},
	},
	{
		id: "day-details",
		label: "Day details",
		blurb: "Open any past day: heart rate, stress, Body Battery, steps, floors and sleep stages through the day.",
		changes: { 1: { summary: "Day files with full timelines, floors, intensity minutes and the night's detail.", refetch: true } },
	},
	{
		id: "run-details",
		label: "Run details",
		blurb: "Map, pace and heart-rate charts, splits and laps for each run.",
		changes: { 5: { summary: "Run pages: samples, laps, splits, zones, weather, gear and device.", refetch: true } },
	},
];

export function dataSet(id: DataSetId): DataSet {
	return DATA_SETS.find((set) => set.id === id)!;
}

/* ------------------------------------------------------------------ */
/*  Ranges                                                             */
/* ------------------------------------------------------------------ */

/** How far back Day details go. Every new day is kept whatever the choice. */
export type DayDetailsRange = "new" | "30d" | "90d" | "1y" | "all";

/** Which runs get their page downloaded: from the range on, or only the runs opened. */
export type RunDetailsRange = "opened" | "90d" | "1y" | "all";

export const DAY_DETAILS_RANGES: ReadonlyArray<{ id: DayDetailsRange; label: string }> = [
	{ id: "new", label: "New days only" },
	{ id: "30d", label: "Last 30 days" },
	{ id: "90d", label: "Last 90 days" },
	{ id: "1y", label: "Last year" },
	{ id: "all", label: "All history" },
];

export const RUN_DETAILS_RANGES: ReadonlyArray<{ id: RunDetailsRange; label: string }> = [
	{ id: "opened", label: "Only runs I open" },
	{ id: "90d", label: "Last 90 days" },
	{ id: "1y", label: "Last year" },
	{ id: "all", label: "All runs" },
];

export const DEFAULT_DAY_DETAILS: DayDetailsRange = "90d";
export const DEFAULT_RUN_DETAILS: RunDetailsRange = "opened";

export function isDayDetailsRange(value: unknown): value is DayDetailsRange {
	return DAY_DETAILS_RANGES.some((r) => r.id === value);
}

export function isRunDetailsRange(value: unknown): value is RunDetailsRange {
	return RUN_DETAILS_RANGES.some((r) => r.id === value);
}

const SPAN_DAYS: Record<"30d" | "90d" | "1y", number> = { "30d": 30, "90d": 90, "1y": 365 };

/**
 * The oldest day a range backfills, or null when it backfills nothing:
 * "new days only", "only runs I open", or "all" before anything says where
 * the history starts.
 */
export function rangeStart(range: DayDetailsRange | RunDetailsRange, today: string, historyStart?: string): string | null {
	if (range === "new" || range === "opened") return null;
	if (range === "all") return historyStart ?? null;
	const from = shiftDate(today, -(SPAN_DAYS[range] - 1));
	return historyStart && historyStart > from ? historyStart : from;
}

/* ------------------------------------------------------------------ */
/*  Consent keys                                                       */
/* ------------------------------------------------------------------ */

/**
 * What a release asks once about: a store at a version, `<store>@<version>`.
 * A new index, or a version bump, is a key the ledger has not seen.
 */
export type ConsentKey = string;

export function consentKey(store: string, version: number): ConsentKey {
	return `${store}@${version}`;
}

/** A key's store and version, or null for one that isn't a key. */
export function parseConsentKey(key: string): { store: string; version: number } | null {
	const match = /^([a-z0-9:-]+)@(\d+)$/.exec(key);
	return match ? { store: match[1]!, version: Number(match[2]) } : null;
}

/** The chart indexes' keys for the groups on: what Charts & trends is made of. */
export function chartKeys(groups: readonly MetricGroup[]): ConsentKey[] {
	const on = new Set(groups);
	const keys: ConsentKey[] = [];
	if (on.has("workouts")) keys.push(consentKey("activities", ACTIVITY_INDEX_VERSION));
	if (on.has("activity")) keys.push(consentKey("daily-stats", DAILY_STATS_VERSION));
	if (on.has("sleep")) keys.push(consentKey("sleep", SLEEP_INDEX_VERSION));
	for (const def of DAY_INDEXES) if (on.has(def.group)) keys.push(consentKey(`index:${def.kind}`, def.version));
	return keys;
}

export const DAY_DETAILS_KEY: ConsentKey = consentKey("days", DAY_DETAILS_VERSION);
export const RUN_DETAILS_KEY: ConsentKey = consentKey("runs", RUN_DETAILS_VERSION);
