import { App, TFile, TFolder, normalizePath } from "obsidian";
import type { Activity } from "../garmin/endpoints";
import {
	INDEX_VERSION,
	byYear,
	isYearFile,
	mergeListing,
	parseMeta,
	parseYear,
	rowOf,
	serializeMeta,
	serializeYear,
	sortRows,
	type ActivityRow,
	type IndexMeta,
} from "./activity-index";
import {
	DAILY_STATS_VERSION,
	byYear as daysByYear,
	extendCoverage,
	mergeDays,
	parseMeta as parseDailyMeta,
	parseYear as parseDailyYear,
	serializeMeta as serializeDailyMeta,
	serializeYear as serializeDailyYear,
	type DailyStatsBatch,
	type DailyStatsMeta,
	type DailyStatsRow,
} from "./daily-stats";
import type { SeriesTarget } from "./engine";
import { dedupeByDate as dedupeRows, extendSpan, rowsByYear, type DayIndexBatch, type DayIndexData, type DayIndexDef, type DayIndexMeta, type DayRow } from "./day-index";
import { DAY_INDEXES } from "./day-indexes";
import {
	SLEEP_INDEX_VERSION,
	mergeNights,
	nightsByYear,
	parseSleepMeta,
	parseSleepYear,
	serializeSleepMeta,
	serializeSleepYear,
	type SleepBatch,
	type SleepIndexMeta,
	type SleepRow,
} from "./sleep-index";
import { ensureFolder, trimSlashes } from "./vault-paths";
import type { DayRow as HomeDayRow } from "../dashboard/series";
import { DayBuffer, dayRowOf, isDaysFile, mergeDay, parseDays, serializeDays, type DayProperties } from "./days";
import type { Properties } from "./metrics";
import type { AccountInfo } from "./account";
import { parseSyncState, serializeSyncState, type SyncState } from "./sync-state";
import { parseSeries, serializeSeries, type DaySeries } from "./intraday";
import { parseActivityDetail, serializeActivityDetail, type ActivityDetail, type ActivityDetailStore } from "./activity-detail";
import {
	addDays,
	detailVersionOf,
	parseDayCoverage,
	parseRunCoverage,
	serializeDayCoverage,
	serializeRunCoverage,
	seriesVersion,
	type DayCoverage,
	type RunCoverage,
	type Span,
} from "./coverage";
import { parseScan, serializeScan, type AccountScan } from "./scan";
import { parseBackfill, serializeBackfill, type BackfillState, type ChartMeta } from "./backfill";

export const SERIES_FOLDER = "series";
/** Every day's properties, a file a year (see `days.ts`). */
export const DAYS_FOLDER = "days";
export const ACCOUNT_FILE = "account.json";
/** Where the last recent sync got to (see `sync-state.ts`). */
export const SYNC_STATE_FILE = "sync-state.json";
export const ACTIVITIES_FOLDER = "activities";
export const ACTIVITY_META_FILE = "index.json";
export const DAILY_STATS_FOLDER = "daily-stats";
export const DAILY_STATS_META_FILE = "index.json";
export const SLEEP_FOLDER = "sleep";
export const SLEEP_META_FILE = "index.json";
/** Every registered day index keeps its meta in a file of this name, beside its year files. */
export const DAY_INDEX_META_FILE = "index.json";
/**
 * One file per activity a page has opened (see `activity-detail.ts`). Not under
 * `activities/`: a write there would rebuild Home, and these files are the
 * activity page's alone.
 */
export const ACTIVITY_DETAILS_FOLDER = "activity-details";
/** The days whose details were fetched whole, and at which version (see `coverage.ts`). */
export const DAY_COVERAGE_FILE = "index.json";
/** Each downloaded run's file version, beside the run files. */
export const RUN_COVERAGE_FILE = "index.json";
/** Where the account's history starts and ends, as the last scan found it (see `scan.ts`). */
export const SCAN_FILE = "scan.json";
/** Whether the backfill is paused and which device runs it (see `backfill.ts`). */
export const BACKFILL_FILE = "backfill.json";

export interface SleepIndex {
	/** Oldest first. */
	rows: SleepRow[];
	/** Null until a sync has written the index. */
	meta: SleepIndexMeta | null;
}

export interface DailyStatsIndex {
	/** Oldest first. */
	rows: DailyStatsRow[];
	/** Null until a sync has written the index. */
	meta: DailyStatsMeta | null;
}

export interface DailyStatsMergeOptions {
	/** The days the batch fetched end to end, when it fetched every one of them. */
	covered?: { from: string; to: string } | null;
	/** Fetching back past the batch found nothing: the index now holds the whole history. */
	complete?: boolean;
}

export interface ActivityIndex {
	/** Newest first. */
	rows: ActivityRow[];
	/** Null until a sync has written the index. */
	meta: IndexMeta | null;
}

export interface MergeOptions {
	/** The listing is the whole history: it replaces the index. */
	complete: boolean;
	units?: "metric" | "imperial";
	/** The list's length, when the sync counted it. */
	total?: number;
}

/**
 * Every file the sync writes, all of it JSON under the data folder. Each day's
 * properties in `<dataFolder>/days/<year>.json` (see `days.ts`), intraday
 * series a file a day in `<dataFolder>/series/<date>.json`, plus `<dataFolder>/account.json` for the
 * few facts that belong to no day, the activity index in
 * `<dataFolder>/activities/` (see `activity-index.ts`) and the daily stats
 * index in `<dataFolder>/daily-stats/` (see `daily-stats.ts`), the sleep
 * index in `<dataFolder>/sleep/` (see `sleep-index.ts`), each registered
 * day index in `<dataFolder>/<folder>/` (see `day-index.ts`), and a file for
 * each activity whose page has opened in `<dataFolder>/activity-details/`
 * (see `activity-detail.ts`).
 *
 * Written through the vault API so Obsidian Sync and the file explorer see
 * them like any other file, and skipped when the text would not change: every
 * sync re-reads the same days, and a needless write bumps the file's mtime,
 * which Obsidian Sync and LiveSync both treat as a change to propagate.
 */
export class VaultSeriesStore implements SeriesTarget, ActivityDetailStore {
	private app: App;
	private folder: string;

	constructor(app: App, dataFolder: string) {
		this.app = app;
		this.folder = trimSlashes(dataFolder);
	}

	path(date: string): string {
		return this.join(`${SERIES_FOLDER}/${date}.json`);
	}

	get accountPath(): string {
		return this.join(ACCOUNT_FILE);
	}

	async write(date: string, series: DaySeries): Promise<"written" | "unchanged"> {
		return this.put(this.path(date), serializeSeries(date, series));
	}

	get daysFolder(): string {
		return this.join(DAYS_FOLDER);
	}

	/** Folds a day's properties into its year file, over whatever the day already held. */
	async writeDay(date: string, properties: Properties): Promise<"written" | "unchanged"> {
		const year = date.slice(0, 4);
		const path = this.join(`${DAYS_FOLDER}/${year}.json`);
		const file = this.app.vault.getAbstractFileByPath(path);
		const days = file instanceof TFile ? parseDays(await this.app.vault.read(file)) : new Map();
		return this.put(path, serializeDays(year, mergeDay(days, date, properties)));
	}

	/** Several days at once, a write a year: the import from the old day notes. */
	async writeDays(incoming: DayProperties): Promise<number> {
		const buffer = this.dayBuffer();
		for (const [date, properties] of incoming) await buffer.write(date, properties);
		return buffer.flush();
	}

	/**
	 * The day files as a sync's target: days held, then written a year file
	 * at a time by `flush` (see `DayBuffer`).
	 */
	dayBuffer(): DayBuffer {
		return new DayBuffer({
			readYear: async (year) => {
				const file = this.app.vault.getAbstractFileByPath(this.join(`${DAYS_FOLDER}/${year}.json`));
				return file instanceof TFile ? this.app.vault.read(file) : null;
			},
			writeYear: (year, body) => this.put(this.join(`${DAYS_FOLDER}/${year}.json`), body),
		});
	}

	/** Every synced day, oldest first. */
	async readDays(): Promise<HomeDayRow[]> {
		const folder = this.app.vault.getAbstractFileByPath(this.daysFolder);
		const rows: HomeDayRow[] = [];
		if (!(folder instanceof TFolder)) return rows;
		for (const child of folder.children) {
			if (!(child instanceof TFile) || !isDaysFile(child.name)) continue;
			for (const [date, properties] of parseDays(await this.app.vault.cachedRead(child))) {
				rows.push(dayRowOf(date, properties));
			}
		}
		return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	}

	async read(date: string): Promise<DaySeries | null> {
		const file = this.app.vault.getAbstractFileByPath(this.path(date));
		if (!(file instanceof TFile)) return null;
		return parseSeries(await this.app.vault.cachedRead(file));
	}

	activityDetailPath(id: number): string {
		return this.join(`${ACTIVITY_DETAILS_FOLDER}/${id}.json`);
	}

	async readActivityDetail(id: number): Promise<ActivityDetail | null> {
		const file = this.app.vault.getAbstractFileByPath(this.activityDetailPath(id));
		if (!(file instanceof TFile)) return null;
		return parseActivityDetail(await this.app.vault.cachedRead(file));
	}

	/** Writes the run's file and books its version in the run coverage. */
	async writeActivityDetail(id: number, detail: ActivityDetail): Promise<"written" | "unchanged"> {
		const outcome = await this.put(this.activityDetailPath(id), serializeActivityDetail(detail));
		const runs = await this.readRunCoverage();
		if (runs.get(id) !== detail.version) {
			runs.set(id, detail.version);
			await this.put(this.runCoveragePath, serializeRunCoverage(runs));
		}
		return outcome;
	}

	/** The activities with a detail file, by id, read from the folder's listing. */
	async activityDetailIds(): Promise<Set<number>> {
		const ids = new Set<number>();
		const folder = this.app.vault.getAbstractFileByPath(this.join(ACTIVITY_DETAILS_FOLDER));
		if (!(folder instanceof TFolder)) return ids;
		for (const child of folder.children) {
			const id = child instanceof TFile ? /^(\d+)\.json$/.exec(child.name)?.[1] : undefined;
			if (id) ids.add(Number(id));
		}
		return ids;
	}

	get runCoveragePath(): string {
		return this.join(`${ACTIVITY_DETAILS_FOLDER}/${RUN_COVERAGE_FILE}`);
	}

	/**
	 * Each downloaded run's file version, by id. Built from the run files the
	 * first time, reading only the start of each; a run listed is a run whose
	 * file is there.
	 */
	async readRunCoverage(): Promise<RunCoverage> {
		const file = this.app.vault.getAbstractFileByPath(this.runCoveragePath);
		const held = file instanceof TFile ? parseRunCoverage(await this.app.vault.cachedRead(file)) : null;
		if (held) return held;
		const runs: RunCoverage = new Map();
		for (const id of await this.activityDetailIds()) {
			const detail = this.app.vault.getAbstractFileByPath(this.activityDetailPath(id));
			if (!(detail instanceof TFile)) continue;
			const version = detailVersionOf(await this.app.vault.cachedRead(detail));
			if (version !== undefined) runs.set(id, version);
		}
		await this.put(this.runCoveragePath, serializeRunCoverage(runs));
		return runs;
	}

	get scanPath(): string {
		return this.join(SCAN_FILE);
	}

	async readScan(): Promise<AccountScan | null> {
		const file = this.app.vault.getAbstractFileByPath(this.scanPath);
		return file instanceof TFile ? parseScan(await this.app.vault.cachedRead(file)) : null;
	}

	async writeScan(scan: AccountScan): Promise<"written" | "unchanged"> {
		return this.put(this.scanPath, serializeScan(scan));
	}

	get backfillPath(): string {
		return this.join(BACKFILL_FILE);
	}

	/** Read fresh, not from the cache: another device may have written it a moment ago. */
	async readBackfill(): Promise<BackfillState> {
		const file = this.app.vault.getAbstractFileByPath(this.backfillPath);
		return file instanceof TFile ? parseBackfill(await this.app.vault.read(file)) : {};
	}

	async writeBackfill(state: BackfillState): Promise<"written" | "unchanged"> {
		return this.put(this.backfillPath, serializeBackfill(state));
	}

	/** The chart indexes' metas by store (`activities`, `daily-stats`, `sleep`, `index:<kind>`): what the backfill plans walks from. */
	async readChartMetas(): Promise<Map<string, ChartMeta | null>> {
		const out = new Map<string, ChartMeta | null>();
		const [activities, daily, sleep] = await Promise.all([this.readActivities(), this.readDailyStatsMeta(), this.readSleepMeta()]);
		out.set("activities", activities.meta ? { complete: activities.meta.complete === true } : null);
		out.set("daily-stats", daily ? { complete: daily.complete === true, ...(daily.from ? { from: daily.from } : {}) } : null);
		out.set("sleep", sleep ? { complete: sleep.complete === true, ...(sleep.from ? { from: sleep.from } : {}) } : null);
		for (const def of DAY_INDEXES) {
			const meta = await this.readDayIndexMeta(def);
			out.set(`index:${def.kind}`, meta ? { complete: meta.complete === true, ...(meta.from ? { from: meta.from } : {}) } : null);
		}
		return out;
	}

	get dayCoveragePath(): string {
		return this.join(`${DAYS_FOLDER}/${DAY_COVERAGE_FILE}`);
	}

	/**
	 * The days whose details were fetched whole (see `coverage.ts`). The
	 * first time, built from the files the vault holds: the series files'
	 * timelines (`seriesVersion`), or every day file's day when `intraday`
	 * is off and the day file is all a day's details are.
	 */
	async readDayCoverage(intraday: boolean): Promise<DayCoverage> {
		const file = this.app.vault.getAbstractFileByPath(this.dayCoveragePath);
		const held = file instanceof TFile ? parseDayCoverage(await this.app.vault.cachedRead(file)) : null;
		if (held) return held;
		let spans: Span[] = [];
		if (intraday) {
			const folder = this.app.vault.getAbstractFileByPath(this.join(SERIES_FOLDER));
			const byVersion = new Map<number, string[]>();
			if (folder instanceof TFolder) {
				for (const child of folder.children) {
					const date = child instanceof TFile ? /^(\d{4}-\d{2}-\d{2})\.json$/.exec(child.name)?.[1] : undefined;
					if (!date || !(child instanceof TFile)) continue;
					const version = seriesVersion(parseSeries(await this.app.vault.cachedRead(child)));
					if (version !== undefined) byVersion.set(version, [...(byVersion.get(version) ?? []), date]);
				}
			}
			for (const [version, dates] of byVersion) spans = addDays(spans, dates, version);
		} else {
			spans = addDays([], (await this.readDays()).map((row) => row.date), 1);
		}
		const coverage = { spans };
		await this.put(this.dayCoveragePath, serializeDayCoverage(coverage));
		return coverage;
	}

	/** Books days a sync fetched whole at `version` of the day details. */
	async recordDays(dates: readonly string[], version: number, intraday: boolean): Promise<void> {
		if (!dates.length) return;
		const coverage = await this.readDayCoverage(intraday);
		const next = { spans: addDays(coverage.spans, dates, version) };
		await this.put(this.dayCoveragePath, serializeDayCoverage(next));
	}

	async writeAccount(account: AccountInfo): Promise<"written" | "unchanged"> {
		return this.put(this.accountPath, `${JSON.stringify(account, null, "\t")}\n`);
	}

	async readAccount(): Promise<AccountInfo | null> {
		const file = this.app.vault.getAbstractFileByPath(this.accountPath);
		if (!(file instanceof TFile)) return null;
		try {
			const parsed = JSON.parse(await this.app.vault.cachedRead(file)) as unknown;
			return parsed && typeof parsed === "object" ? (parsed as AccountInfo) : null;
		} catch {
			return null;
		}
	}

	get syncStatePath(): string {
		return this.join(SYNC_STATE_FILE);
	}

	async writeSyncState(state: SyncState): Promise<"written" | "unchanged"> {
		return this.put(this.syncStatePath, serializeSyncState(state));
	}

	/** Read fresh, not cached: another device may have synced since. */
	async readSyncState(): Promise<SyncState | null> {
		const file = this.app.vault.getAbstractFileByPath(this.syncStatePath);
		return file instanceof TFile ? parseSyncState(await this.app.vault.read(file)) : null;
	}

	get activitiesFolder(): string {
		return this.join(ACTIVITIES_FOLDER);
	}

	/** Every activity the index holds, newest first, and what it knows about itself. */
	async readActivities(): Promise<ActivityIndex> {
		const { rows, meta } = await this.readIndex();
		return { rows: sortRows(dedupeById(rows)), meta };
	}

	/**
	 * Folds an activity listing into the index. Returns how many files changed:
	 * a year nobody touched keeps its text, so a routine sync rewrites only the
	 * current year, and only when an activity was added or edited.
	 */
	async mergeActivities(listing: readonly Activity[], opts: MergeOptions): Promise<number> {
		const current = await this.readIndex();
		const listed = listing.map(rowOf).filter((r): r is ActivityRow => r !== null);
		const rows = mergeListing(dedupeById(current.rows), listed, opts.complete);

		const meta: IndexMeta = { version: INDEX_VERSION, complete: opts.complete || current.meta?.complete === true };
		const units = opts.units ?? current.meta?.units;
		if (units) meta.units = units;
		const total = opts.total ?? current.meta?.total;
		if (total !== undefined) meta.total = total;

		let written = 0;
		const years = byYear(rows);
		// A year whose every activity was deleted on Garmin is emptied, not left stale.
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${ACTIVITIES_FOLDER}/${year}.json`), serializeYear(year, list))) === "written") written += 1;
		}
		if ((await this.put(this.join(`${ACTIVITIES_FOLDER}/${ACTIVITY_META_FILE}`), serializeMeta(meta))) === "written") written += 1;
		return written;
	}

	get dailyStatsFolder(): string {
		return this.join(DAILY_STATS_FOLDER);
	}

	/** Only what the daily stats index knows about itself: one small file. */
	async readDailyStatsMeta(): Promise<DailyStatsMeta | null> {
		const file = this.app.vault.getAbstractFileByPath(this.join(`${DAILY_STATS_FOLDER}/${DAILY_STATS_META_FILE}`));
		return file instanceof TFile ? parseDailyMeta(await this.app.vault.cachedRead(file)) : null;
	}

	/** Every day the daily stats index holds, oldest first, and what it knows about itself. */
	async readDailyStats(): Promise<DailyStatsIndex> {
		const { rows, meta } = await this.readDailyIndex();
		return { rows: dedupeByDate(rows), meta };
	}

	/**
	 * Folds a batch of days into the daily stats index. Returns how many files
	 * changed: a routine sync touches this year's file and the index, and only
	 * when a number moved.
	 */
	async mergeDailyStats(batch: DailyStatsBatch, opts: DailyStatsMergeOptions = {}): Promise<number> {
		const current = await this.readDailyIndex();
		const rows = mergeDays(dedupeByDate(current.rows), batch);

		const meta: DailyStatsMeta = { version: DAILY_STATS_VERSION, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendCoverage(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = daysByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${DAILY_STATS_FOLDER}/${year}.json`), serializeDailyYear(year, list))) === "written") written += 1;
		}
		if ((await this.put(this.join(`${DAILY_STATS_FOLDER}/${DAILY_STATS_META_FILE}`), serializeDailyMeta(meta))) === "written") written += 1;
		return written;
	}

	get sleepFolder(): string {
		return this.join(SLEEP_FOLDER);
	}

	/** Only what the sleep index knows about itself: one small file. */
	async readSleepMeta(): Promise<SleepIndexMeta | null> {
		const file = this.app.vault.getAbstractFileByPath(this.join(`${SLEEP_FOLDER}/${SLEEP_META_FILE}`));
		return file instanceof TFile ? parseSleepMeta(await this.app.vault.cachedRead(file)) : null;
	}

	/** Every night the sleep index holds, oldest first, and what it knows about itself. */
	async readSleep(): Promise<SleepIndex> {
		const { rows, meta } = await this.readSleepIndex();
		return { rows: dedupeNights(rows), meta };
	}

	/**
	 * Folds a batch of nights into the sleep index. Returns how many files
	 * changed: a routine sync touches this year's file and the index, and only
	 * when a night moved.
	 */
	async mergeSleep(batch: SleepBatch, opts: DailyStatsMergeOptions = {}): Promise<number> {
		const current = await this.readSleepIndex();
		const rows = mergeNights(dedupeNights(current.rows), batch);

		const meta: SleepIndexMeta = { version: SLEEP_INDEX_VERSION, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendCoverage(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = nightsByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${SLEEP_FOLDER}/${year}.json`), serializeSleepYear(year, list))) === "written") written += 1;
		}
		if ((await this.put(this.join(`${SLEEP_FOLDER}/${SLEEP_META_FILE}`), serializeSleepMeta(meta))) === "written") written += 1;
		return written;
	}

	/** Only what a registered day index knows about itself: one small file. */
	async readDayIndexMeta<R extends DayRow>(def: DayIndexDef<R>): Promise<DayIndexMeta | null> {
		const file = this.app.vault.getAbstractFileByPath(this.join(`${def.folder}/${DAY_INDEX_META_FILE}`));
		return file instanceof TFile ? def.parseMeta(await this.app.vault.cachedRead(file)) : null;
	}

	/** Every row a registered day index holds, oldest first, and what it knows about itself. */
	async readDayIndex<R extends DayRow>(def: DayIndexDef<R>): Promise<DayIndexData<R>> {
		const { rows, meta } = await this.readDayIndexFiles(def);
		return { rows: dedupeRows(rows), meta };
	}

	/**
	 * Folds a batch into a registered day index. Returns how many files
	 * changed: a routine sync touches this year's file and the index, and only
	 * when a row moved.
	 */
	async mergeDayIndex<R extends DayRow>(def: DayIndexDef<R>, batch: DayIndexBatch<R>, opts: DailyStatsMergeOptions = {}): Promise<number> {
		const current = await this.readDayIndexFiles(def);
		const rows = def.merge(dedupeRows(current.rows), batch);

		const meta: DayIndexMeta = { version: def.version, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendSpan(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = rowsByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${def.folder}/${year}.json`), def.serializeYear(year, list))) === "written") written += 1;
		}
		if ((await this.put(this.join(`${def.folder}/${DAY_INDEX_META_FILE}`), def.serializeMeta(meta))) === "written") written += 1;
		return written;
	}

	/** The registered day index whose folder holds a vault path, if any. */
	dayIndexOf(path: string): DayIndexDef | undefined {
		return DAY_INDEXES.find((def) => path.startsWith(`${this.join(def.folder)}/`));
	}

	/** Whether a vault path is a day's series file. */
	isSeriesPath(path: string): boolean {
		return path.startsWith(`${this.join(SERIES_FOLDER)}/`);
	}

	/** Whether a vault path is one of the files this store writes. */
	owns(path: string): boolean {
		return (
			path === this.accountPath ||
			path.startsWith(`${this.daysFolder}/`) ||
			path.startsWith(`${this.join(SERIES_FOLDER)}/`) ||
			path.startsWith(`${this.activitiesFolder}/`) ||
			path.startsWith(`${this.dailyStatsFolder}/`) ||
			path.startsWith(`${this.sleepFolder}/`) ||
			this.dayIndexOf(path) !== undefined
		);
	}

	private async readDayIndexFiles<R extends DayRow>(def: DayIndexDef<R>): Promise<DayIndexData<R> & { years: string[] }> {
		const folder = this.app.vault.getAbstractFileByPath(this.join(def.folder));
		const out: DayIndexData<R> & { years: string[] } = { rows: [], meta: null, years: [] };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === DAY_INDEX_META_FILE) {
				out.meta = def.parseMeta(await this.app.vault.cachedRead(child));
			} else if (isYearFile(child.name)) {
				out.years.push(child.basename);
				out.rows.push(...def.parseYear(await this.app.vault.cachedRead(child)));
			}
		}
		return out;
	}

	private async readSleepIndex(): Promise<SleepIndex & { years: string[] }> {
		const folder = this.app.vault.getAbstractFileByPath(this.sleepFolder);
		const out: SleepIndex & { years: string[] } = { rows: [], meta: null, years: [] };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === SLEEP_META_FILE) {
				out.meta = parseSleepMeta(await this.app.vault.cachedRead(child));
			} else if (isYearFile(child.name)) {
				out.years.push(child.basename);
				out.rows.push(...parseSleepYear(await this.app.vault.cachedRead(child)));
			}
		}
		return out;
	}

	private async readDailyIndex(): Promise<DailyStatsIndex & { years: string[] }> {
		const folder = this.app.vault.getAbstractFileByPath(this.dailyStatsFolder);
		const out: DailyStatsIndex & { years: string[] } = { rows: [], meta: null, years: [] };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === DAILY_STATS_META_FILE) {
				out.meta = parseDailyMeta(await this.app.vault.cachedRead(child));
			} else if (isYearFile(child.name)) {
				out.years.push(child.basename);
				out.rows.push(...parseDailyYear(await this.app.vault.cachedRead(child)));
			}
		}
		return out;
	}

	private async readIndex(): Promise<ActivityIndex & { years: string[] }> {
		const folder = this.app.vault.getAbstractFileByPath(this.activitiesFolder);
		const out: ActivityIndex & { years: string[] } = { rows: [], meta: null, years: [] };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === ACTIVITY_META_FILE) {
				out.meta = parseMeta(await this.app.vault.cachedRead(child));
			} else if (isYearFile(child.name)) {
				out.years.push(child.basename);
				out.rows.push(...parseYear(await this.app.vault.cachedRead(child)));
			}
		}
		return out;
	}

	private async put(path: string, body: string): Promise<"written" | "unchanged"> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			if ((await this.app.vault.read(existing)) === body) return "unchanged";
			await this.app.vault.modify(existing, body);
			return "written";
		}
		const dir = path.slice(0, path.lastIndexOf("/"));
		if (dir) await ensureFolder(this.app, dir);
		await this.app.vault.create(path, body);
		return "written";
	}

	private join(rest: string): string {
		return normalizePath(this.folder ? `${this.folder}/${rest}` : rest);
	}
}

/** One row a day, oldest first, whatever order the year files were read in. */
function dedupeByDate(rows: readonly DailyStatsRow[]): DailyStatsRow[] {
	const byDate = new Map<string, DailyStatsRow>();
	for (const row of rows) byDate.set(row.date, row);
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** One night a day, oldest first. */
function dedupeNights(rows: readonly SleepRow[]): SleepRow[] {
	const byDate = new Map<string, SleepRow>();
	for (const row of rows) byDate.set(row.date, row);
	return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** One row per activity, even if an edit moved it across a year boundary between two files. */
function dedupeById(rows: readonly ActivityRow[]): ActivityRow[] {
	const byId = new Map<number, ActivityRow>();
	for (const row of rows) {
		const seen = byId.get(row.id);
		if (!seen || row.begin > seen.begin) byId.set(row.id, row);
	}
	return [...byId.values()];
}
