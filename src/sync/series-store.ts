import { App, Notice, TFile, TFolder, normalizePath } from "obsidian";
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
import { DayBuffer, dayRowOf, isDaysFile, parseDays, type DayProperties } from "./days";
import type { AccountInfo } from "./account";
import { parseSyncState, serializeSyncState, type SyncState } from "./sync-state";
import { parseSeries, serializeSeries, type DaySeries } from "./intraday";
import { parseActivityDetail, serializeActivityDetail, type ActivityDetail, type ActivityDetailStore } from "./activity-detail";
import {
	addDays,
	detailVersionOf,
	dropDays,
	parseDayCoverage,
	parseDetailCoverage,
	serializeDayCoverage,
	serializeDetailCoverage,
	seriesVersion,
	type DayCoverage,
	type DetailCoverage,
	type Span,
} from "./coverage";
import { parseScan, serializeScan, type AccountScan, type Learned } from "./scan";
import { parseHorizon } from "./horizons";
import { DAY_DETAILS_VERSION } from "./datasets";
import { factSpan, factStores, type DayFacts, type FactSpans, type Masks, type MaskVerdicts } from "./day-facts";
import type { MetricGroup } from "./metrics";
import { parseBackfill, serializeBackfill, type BackfillState, type ChartMeta } from "./backfill";
import { NewerDataError, asideName, isConflictCopy, isReadable, versionOf } from "./file-health";

/**
 * Conflict copies seen this session, by path, whichever store saw them (see
 * `isConflictCopy`). The first one found says so once; the rest wait for
 * whoever lists them.
 */
const conflictCopies = new Set<string>();

/** Conflict copies of the sync's files seen in the data folder this session, oldest seen first. */
export function seenConflictCopies(): string[] {
	return [...conflictCopies];
}

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
/** Each downloaded activity's file version, beside the activity files. */
export const DETAIL_COVERAGE_FILE = "index.json";
/** Where the account's history starts and ends, as the last scan found it (see `scan.ts`). */
export const SCAN_FILE = "scan.json";
/** Whether the backfill is paused and which device runs it (see `backfill.ts`). */
export const BACKFILL_FILE = "backfill.json";

/** Bytes on disk by data set (see `diskUsage`). */
export interface DiskUsage {
	charts: number;
	days: number;
	details: number;
	other: number;
	total: number;
	files: number;
}

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
	/** Files this store set aside rather than write over, by their old path (see `put`). */
	private aside = new Set<string>();
	/** Series files' text as `read` found it, until `write` puts the day back: the write then reads nothing again. */
	private seriesTexts = new Map<string, string>();

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
		const path = this.path(date);
		const held = this.seriesTexts.get(path);
		this.seriesTexts.delete(path);
		return this.put(path, serializeSeries(date, series), held);
	}

	get daysFolder(): string {
		return this.join(DAYS_FOLDER);
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
			writeYear: (year, body, held) => this.put(this.join(`${DAYS_FOLDER}/${year}.json`), body, held),
		});
	}

	/**
	 * Every synced day, oldest first. A year file is parsed again only once it
	 * changed (`parsedDays`): Home rebuilds after every sync, and a sync
	 * rewrites this year's file at most.
	 */
	async readDays(): Promise<HomeDayRow[]> {
		const folder = this.app.vault.getAbstractFileByPath(this.daysFolder);
		const rows: HomeDayRow[] = [];
		if (!(folder instanceof TFolder)) return rows;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (!isDaysFile(child.name)) {
				this.noteCopy(child);
				continue;
			}
			const stamp = `${child.stat.mtime}:${child.stat.size}`;
			let year = parsedDays.get(child.path);
			if (year?.stamp !== stamp) {
				year = { stamp, rows: [...parseDays(await this.app.vault.cachedRead(child))].map(([date, properties]) => dayRowOf(date, properties)) };
				parsedDays.set(child.path, year);
			}
			rows.push(...year.rows);
		}
		return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	}

	async read(date: string): Promise<DaySeries | null> {
		const file = this.app.vault.getAbstractFileByPath(this.path(date));
		if (!(file instanceof TFile)) return null;
		const text = await this.app.vault.cachedRead(file);
		this.seriesTexts.set(file.path, text);
		return parseSeries(text);
	}

	activityDetailPath(id: number): string {
		return this.join(`${ACTIVITY_DETAILS_FOLDER}/${id}.json`);
	}

	async readActivityDetail(id: number): Promise<ActivityDetail | null> {
		const file = this.app.vault.getAbstractFileByPath(this.activityDetailPath(id));
		if (!(file instanceof TFile)) return null;
		return parseActivityDetail(await this.app.vault.cachedRead(file));
	}

	/** Writes the activity's file and books its version in the coverage. */
	async writeActivityDetail(id: number, detail: ActivityDetail): Promise<"written" | "unchanged"> {
		const outcome = await this.writeActivityDetailFile(id, detail);
		await this.bookDetails(new Map([[id, detail.version]]));
		return outcome;
	}

	/** The activity's file alone: a batch books its versions together (`bookDetails`). */
	writeActivityDetailFile(id: number, detail: ActivityDetail): Promise<"written" | "unchanged"> {
		return this.put(this.activityDetailPath(id), serializeActivityDetail(detail));
	}

	/** Books files' versions in the detail coverage: one read and one write, however many. */
	async bookDetails(versions: ReadonlyMap<number, number>): Promise<void> {
		if (!versions.size) return;
		const files = await this.readDetailCoverage();
		let changed = false;
		for (const [id, version] of versions) {
			if (files.get(id) === version) continue;
			files.set(id, version);
			changed = true;
		}
		if (changed) await this.put(this.detailCoveragePath, serializeDetailCoverage(files));
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

	get detailCoveragePath(): string {
		return this.join(`${ACTIVITY_DETAILS_FOLDER}/${DETAIL_COVERAGE_FILE}`);
	}

	/**
	 * Each downloaded activity's file version, by id. Built from the files the
	 * first time, reading only the start of each; an activity listed is one
	 * whose file is there.
	 */
	async readDetailCoverage(): Promise<DetailCoverage> {
		const file = this.app.vault.getAbstractFileByPath(this.detailCoveragePath);
		const held = file instanceof TFile ? parseDetailCoverage(await this.app.vault.cachedRead(file)) : null;
		if (held) return held;
		const files: DetailCoverage = new Map();
		for (const id of await this.activityDetailIds()) {
			const detail = this.app.vault.getAbstractFileByPath(this.activityDetailPath(id));
			if (!(detail instanceof TFile)) continue;
			const version = detailVersionOf(await this.app.vault.cachedRead(detail));
			if (version !== undefined) files.set(id, version);
		}
		await this.put(this.detailCoveragePath, serializeDetailCoverage(files));
		return files;
	}

	get scanPath(): string {
		return this.join(SCAN_FILE);
	}

	async readScan(): Promise<AccountScan | null> {
		const file = this.app.vault.getAbstractFileByPath(this.scanPath);
		return file instanceof TFile ? parseScan(await this.app.vault.cachedRead(file)) : null;
	}

	/** A new scan keeps what the download learned of the account: a scan run again doesn't make it learn twice. */
	async writeScan(scan: AccountScan): Promise<"written" | "unchanged"> {
		const learned = scan.learned ?? (await this.readScan())?.learned;
		return this.put(this.scanPath, serializeScan({ ...scan, ...(learned ? { learned } : {}) }));
	}

	/** Saves the masks' verdicts in scan.json, keeping the rest of it. Nothing without a scan. */
	writeVerdicts(masks: MaskVerdicts): Promise<void> {
		return this.writeLearned({ masks });
	}

	/** Saves the timelines' horizon in scan.json (`horizons.ts`). */
	writeHorizon(days: number | null): Promise<void> {
		return this.writeLearned({ horizon: { days, version: DAY_DETAILS_VERSION } });
	}

	private async writeLearned(change: Learned): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.scanPath);
		if (!(file instanceof TFile)) return;
		const text = await this.app.vault.read(file);
		const scan = parseScan(text);
		if (!scan) return;
		await this.put(this.scanPath, serializeScan({ ...scan, learned: { ...scan.learned, ...change } }), text);
	}

	/**
	 * What the complete chart indexes say about each day, for the history
	 * download's masks (`day-facts.ts`), with the verdicts scan.json keeps.
	 */
	async readMasks(groups: readonly MetricGroup[], charts: ReadonlyMap<string, ChartMeta | null>, scan: AccountScan | null): Promise<Masks> {
		const facts: DayFacts = {};
		const spans: FactSpans = {};
		for (const [route, stores] of factStores(groups, charts)) {
			const days = new Set<string>();
			for (const store of stores) for (const date of await this.datesIn(store)) days.add(date);
			facts[route] = days;
			spans[route] = factSpan(stores, charts);
		}
		const horizon = parseHorizon(scan?.learned?.horizon, DAY_DETAILS_VERSION);
		return { facts, spans, verdicts: scan?.learned?.masks ?? {}, ...(horizon !== undefined ? { horizon } : {}) };
	}

	/**
	 * The days a chart store lists a row for — daily stats, sleep or a
	 * registered index — kept with its files' modified times and sizes and
	 * read again only once one changed: the download asks before each unit.
	 */
	async datesIn(store: string): Promise<ReadonlySet<string>> {
		const def = store.startsWith("index:") ? DAY_INDEXES.find((d) => `index:${d.kind}` === store) : undefined;
		const folder = store === "daily-stats" ? DAILY_STATS_FOLDER : store === "sleep" ? SLEEP_FOLDER : def?.folder;
		if (!folder) return new Set();
		const dir = this.app.vault.getAbstractFileByPath(this.join(folder));
		if (!(dir instanceof TFolder)) return new Set();
		const stamp = dir.children
			.filter((child): child is TFile => child instanceof TFile && isYearFile(child.name))
			.map((child) => `${child.name}:${child.stat.mtime}:${child.stat.size}`)
			.sort()
			.join("|");
		const key = this.join(folder);
		const held = storeDates.get(key);
		if (held?.stamp === stamp) return held.dates;
		const rows: ReadonlyArray<{ date: string }> = store === "daily-stats" ? (await this.readDailyStats()).rows : store === "sleep" ? (await this.readSleep()).rows : def ? (await this.readDayIndex(def)).rows : [];
		const dates = new Set(rows.map((row) => row.date));
		storeDates.set(key, { stamp, dates });
		return dates;
	}

	/**
	 * Bytes on disk under the data folder, by data set, from the vault's own
	 * file sizes: Day details are the day files and series, Activity details
	 * the activities' pages, Charts & trends the indexes, and the rest is the small
	 * bookkeeping files.
	 */
	diskUsage(): DiskUsage {
		const usage: DiskUsage = { charts: 0, days: 0, details: 0, other: 0, total: 0, files: 0 };
		const root = this.app.vault.getAbstractFileByPath(this.join(""));
		if (!(root instanceof TFolder)) return usage;
		const charts = new Set([ACTIVITIES_FOLDER, DAILY_STATS_FOLDER, SLEEP_FOLDER, ...DAY_INDEXES.map((def) => def.folder)]);
		const walk = (folder: TFolder, set: keyof Omit<DiskUsage, "total" | "files">) => {
			for (const child of folder.children) {
				if (child instanceof TFolder) walk(child, set);
				else if (child instanceof TFile) {
					usage[set] += child.stat.size;
					usage.total += child.stat.size;
					usage.files += 1;
				}
			}
		};
		for (const child of root.children) {
			if (child instanceof TFolder) {
				const set = child.name === DAYS_FOLDER || child.name === SERIES_FOLDER ? "days" : child.name === ACTIVITY_DETAILS_FOLDER ? "details" : charts.has(child.name) ? "charts" : "other";
				walk(child, set);
			} else if (child instanceof TFile) {
				usage.other += child.stat.size;
				usage.total += child.stat.size;
				usage.files += 1;
			}
		}
		return usage;
	}

	/** Whether any day or activity has reached this device's data folder. */
	hasData(): boolean {
		for (const name of [DAYS_FOLDER, ACTIVITIES_FOLDER]) {
			const folder = this.app.vault.getAbstractFileByPath(this.join(name));
			if (folder instanceof TFolder && folder.children.some((child) => child instanceof TFile && /^\d{4}\.json$/.test(child.name))) return true;
		}
		return false;
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

	/**
	 * Changes backfill.json from what it holds now, read fresh: another device's
	 * pause, lease or progress written meanwhile is kept, not overwritten by a
	 * copy read a unit ago.
	 */
	async updateBackfill(change: (state: BackfillState) => BackfillState): Promise<"written" | "unchanged"> {
		return this.writeBackfill(change(await this.readBackfill()));
	}

	/** The chart indexes' metas by store (`activities`, `daily-stats`, `sleep`, `index:<kind>`): what the backfill plans walks from. */
	async readChartMetas(): Promise<Map<string, ChartMeta | null>> {
		const out = new Map<string, ChartMeta | null>();
		const [activities, daily, sleep] = await Promise.all([this.readActivitiesMeta(), this.readDailyStatsMeta(), this.readSleepMeta()]);
		out.set("activities", activities ? { complete: activities.complete === true } : null);
		const span = (m: { from?: string; to?: string }) => ({ ...(m.from ? { from: m.from } : {}), ...(m.to ? { to: m.to } : {}) });
		out.set("daily-stats", daily ? { complete: daily.complete === true, ...span(daily) } : null);
		out.set("sleep", sleep ? { complete: sleep.complete === true, ...span(sleep) } : null);
		for (const def of DAY_INDEXES) {
			const meta = await this.readDayIndexMeta(def);
			out.set(`index:${def.kind}`, meta ? { complete: meta.complete === true, ...span(meta) } : null);
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
			return parsed && typeof parsed === "object" ? (parsed) : null;
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

	/** Only what the activity index knows about itself: one small file. */
	async readActivitiesMeta(): Promise<IndexMeta | null> {
		const file = this.app.vault.getAbstractFileByPath(this.join(`${ACTIVITIES_FOLDER}/${ACTIVITY_META_FILE}`));
		return file instanceof TFile ? parseMeta(await this.app.vault.cachedRead(file)) : null;
	}

	/**
	 * Sets aside each of `folder`'s year files outside `only` that no longer
	 * reads, as a merge that rewrote it would (see `put`): a merge leaves those
	 * years alone, and must not leave one broken. Its rows are walked again
	 * (`lostYears`).
	 */
	private async checkYears(folder: string, only: ReadonlySet<string>): Promise<void> {
		const dir = this.app.vault.getAbstractFileByPath(this.join(folder));
		if (!(dir instanceof TFolder)) return;
		for (const child of [...dir.children]) {
			if (!(child instanceof TFile) || !isYearFile(child.name) || only.has(child.basename)) continue;
			const stamp = `${child.stat.mtime}:${child.stat.size}`;
			if (healthyYears.get(child.path) === stamp) continue;
			if (isReadable(await this.app.vault.cachedRead(child))) healthyYears.set(child.path, stamp);
			else await this.setAside(child);
		}
	}

	/** The years a chart folder holds a file for, from its listing alone. */
	private yearsIn(folder: string): string[] {
		const dir = this.app.vault.getAbstractFileByPath(this.join(folder));
		if (!(dir instanceof TFolder)) return [];
		return dir.children.filter((child): child is TFile => child instanceof TFile && isYearFile(child.name)).map((child) => child.basename);
	}

	/**
	 * Folds an activity listing into the index. Returns how many files changed:
	 * a year nobody touched keeps its text, so a routine sync rewrites only the
	 * current year, and only when an activity was added or edited.
	 */
	async mergeActivities(listing: readonly Activity[], opts: MergeOptions): Promise<number> {
		return this.mergeActivityRows(
			listing.map(rowOf).filter((r): r is ActivityRow => r !== null),
			opts,
		);
	}

	/** `mergeActivities` for a listing already made rows, as the history walk keeps it. */
	async mergeActivityRows(listed: readonly ActivityRow[], opts: MergeOptions): Promise<number> {
		// A short page partway down reads as the end of the list, so only a
		// listing about as long as Garmin's count may replace the index.
		const expected = opts.total ?? (await this.readActivitiesMeta())?.total;
		const whole = opts.complete && (expected === undefined || listed.length >= Math.floor(expected * WHOLE_LISTING));
		// A whole listing replaces every year; a page from the top changes only
		// the years from its oldest activity on, where a deleted one may drop out.
		const only = whole ? undefined : listingYears(listed, this.yearsIn(ACTIVITIES_FOLDER));
		if (only) await this.checkYears(ACTIVITIES_FOLDER, only);
		const current = await this.readIndex(only);
		const rows = mergeListing(dedupeById(current.rows), listed, whole);

		const meta: IndexMeta = { version: INDEX_VERSION, complete: whole || current.meta?.complete === true };
		const units = opts.units ?? current.meta?.units;
		if (units) meta.units = units;
		const total = opts.total ?? current.meta?.total;
		if (total !== undefined) meta.total = total;

		let written = 0;
		const years = byYear(rows);
		// A year whose every activity was deleted on Garmin is emptied, not left stale.
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${ACTIVITIES_FOLDER}/${year}.json`), serializeYear(year, list), current.texts.get(`${year}.json`))) === "written") written += 1;
		}
		// A year file set aside took its activities with it: list them all again.
		if (this.lostYears(ACTIVITIES_FOLDER)) meta.complete = false;
		if ((await this.put(this.join(`${ACTIVITIES_FOLDER}/${ACTIVITY_META_FILE}`), serializeMeta(meta), current.texts.get(ACTIVITY_META_FILE))) === "written") written += 1;
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
		const only = batchYears(batch);
		await this.checkYears(DAILY_STATS_FOLDER, only);
		const current = await this.readDailyIndex(only);
		const rows = mergeDays(dedupeByDate(current.rows), batch);

		const meta: DailyStatsMeta = { version: DAILY_STATS_VERSION, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendCoverage(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = daysByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${DAILY_STATS_FOLDER}/${year}.json`), serializeDailyYear(year, list), current.texts.get(`${year}.json`))) === "written") written += 1;
		}
		if (this.lostYears(DAILY_STATS_FOLDER)) forgetSpan(meta);
		if ((await this.put(this.join(`${DAILY_STATS_FOLDER}/${DAILY_STATS_META_FILE}`), serializeDailyMeta(meta), current.texts.get(DAILY_STATS_META_FILE))) === "written") written += 1;
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
		const only = batchYears(batch);
		await this.checkYears(SLEEP_FOLDER, only);
		const current = await this.readSleepIndex(only);
		const rows = mergeNights(dedupeNights(current.rows), batch);

		const meta: SleepIndexMeta = { version: SLEEP_INDEX_VERSION, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendCoverage(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = nightsByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${SLEEP_FOLDER}/${year}.json`), serializeSleepYear(year, list), current.texts.get(`${year}.json`))) === "written") written += 1;
		}
		if (this.lostYears(SLEEP_FOLDER)) forgetSpan(meta);
		if ((await this.put(this.join(`${SLEEP_FOLDER}/${SLEEP_META_FILE}`), serializeSleepMeta(meta), current.texts.get(SLEEP_META_FILE))) === "written") written += 1;
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
		const only = batchYears(batch);
		await this.checkYears(def.folder, only);
		const current = await this.readDayIndexFiles(def, only);
		const rows = def.merge(dedupeRows(current.rows), batch);

		const meta: DayIndexMeta = { version: def.version, complete: opts.complete === true || current.meta?.complete === true };
		const span = opts.covered ? extendSpan(current.meta, opts.covered.from, opts.covered.to) : current.meta;
		if (span?.from) meta.from = span.from;
		if (span?.to) meta.to = span.to;

		let written = 0;
		const years = rowsByYear(rows);
		for (const year of current.years) if (!years.has(year)) years.set(year, []);
		for (const [year, list] of years) {
			if ((await this.put(this.join(`${def.folder}/${year}.json`), def.serializeYear(year, list), current.texts.get(`${year}.json`))) === "written") written += 1;
		}
		if (this.lostYears(def.folder)) forgetSpan(meta);
		if ((await this.put(this.join(`${def.folder}/${DAY_INDEX_META_FILE}`), def.serializeMeta(meta), current.texts.get(DAY_INDEX_META_FILE))) === "written") written += 1;
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

	private async readDayIndexFiles<R extends DayRow>(def: DayIndexDef<R>, only?: ReadonlySet<string>): Promise<DayIndexData<R> & HeldFiles> {
		const folder = this.app.vault.getAbstractFileByPath(this.join(def.folder));
		const out: DayIndexData<R> & HeldFiles = { rows: [], meta: null, years: [], texts: new Map() };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === DAY_INDEX_META_FILE) {
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.meta = def.parseMeta(text);
			} else if (isYearFile(child.name)) {
				if (only && !only.has(child.basename)) continue;
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.years.push(child.basename);
				out.rows.push(...def.parseYear(text));
			} else this.noteCopy(child);
		}
		return out;
	}

	private async readSleepIndex(only?: ReadonlySet<string>): Promise<SleepIndex & HeldFiles> {
		const folder = this.app.vault.getAbstractFileByPath(this.sleepFolder);
		const out: SleepIndex & HeldFiles = { rows: [], meta: null, years: [], texts: new Map() };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === SLEEP_META_FILE) {
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.meta = parseSleepMeta(text);
			} else if (isYearFile(child.name)) {
				if (only && !only.has(child.basename)) continue;
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.years.push(child.basename);
				out.rows.push(...parseSleepYear(text));
			} else this.noteCopy(child);
		}
		return out;
	}

	private async readDailyIndex(only?: ReadonlySet<string>): Promise<DailyStatsIndex & HeldFiles> {
		const folder = this.app.vault.getAbstractFileByPath(this.dailyStatsFolder);
		const out: DailyStatsIndex & HeldFiles = { rows: [], meta: null, years: [], texts: new Map() };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === DAILY_STATS_META_FILE) {
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.meta = parseDailyMeta(text);
			} else if (isYearFile(child.name)) {
				if (only && !only.has(child.basename)) continue;
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.years.push(child.basename);
				out.rows.push(...parseDailyYear(text));
			} else this.noteCopy(child);
		}
		return out;
	}

	private async readIndex(only?: ReadonlySet<string>): Promise<ActivityIndex & HeldFiles> {
		const folder = this.app.vault.getAbstractFileByPath(this.activitiesFolder);
		const out: ActivityIndex & HeldFiles = { rows: [], meta: null, years: [], texts: new Map() };
		if (!(folder instanceof TFolder)) return out;
		for (const child of folder.children) {
			if (!(child instanceof TFile)) continue;
			if (child.name === ACTIVITY_META_FILE) {
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.meta = parseMeta(text);
			} else if (isYearFile(child.name)) {
				if (only && !only.has(child.basename)) continue;
				const text = await this.app.vault.cachedRead(child);
				out.texts.set(child.name, text);
				out.years.push(child.basename);
				out.rows.push(...parseYear(text));
			} else this.noteCopy(child);
		}
		return out;
	}

	/**
	 * Writes `body` to `path` unless the file already says the same. `known` is
	 * the file's text as the caller just read it, so it isn't read twice; the
	 * write itself still checks the file, should another device have changed
	 * it since.
	 *
	 * A file that can't be read is set aside, never written over: whatever
	 * built `body` read it as empty, and replacing it would lose everything it
	 * held (see `file-health.ts`). A file a newer build of the plugin wrote is
	 * left alone, and the write fails.
	 */
	private async put(path: string, body: string, known?: string): Promise<"written" | "unchanged"> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			const held = known ?? (await this.app.vault.read(existing));
			if (held === body) return "unchanged";
			if (!isReadable(held)) {
				await this.setAside(existing);
				await this.app.vault.create(path, body);
				await this.forgetAfterAside(path);
				return "written";
			}
			const next = versionOf(body);
			const newer = (text: string) => {
				const was = versionOf(text);
				return was !== undefined && next !== undefined && was > next;
			};
			if (newer(held)) throw new NewerDataError(path);
			await this.app.vault.process(existing, (now) => {
				// What the write sees gets the same tests, should the file have changed since the read.
				if (now !== held) {
					if (newer(now)) throw new NewerDataError(path);
					if (!isReadable(now)) throw new Error(`${path} changed while it was being written; the next sync tries again`);
				}
				return body;
			});
			return "written";
		}
		const dir = path.slice(0, path.lastIndexOf("/"));
		if (dir) await ensureFolder(this.app, dir);
		try {
			await this.app.vault.create(path, body);
		} catch (err) {
			// Another write made the file meanwhile — two readers building the same index at once: write over it as usual.
			if (this.app.vault.getAbstractFileByPath(path) instanceof TFile) return this.put(path, body);
			throw err;
		}
		return "written";
	}

	/** Moves an unreadable file out of the sync's way, beside where it was (see `asideName`). */
	private async setAside(file: TFile): Promise<void> {
		const from = file.path;
		const parent = file.parent && file.parent.path !== "/" ? file.parent.path : "";
		const at = (name: string) => normalizePath(parent ? `${parent}/${name}` : name);
		const base = asideName(file.name, new Date());
		let name = base;
		for (let n = 2; this.app.vault.getAbstractFileByPath(at(name)); n++) name = base.replace(/(\.json)?$/, `-${n}$1`);
		await this.app.vault.rename(file, at(name));
		this.aside.add(from);
		new Notice(`Garmin: ${from} couldn't be read. It was kept as ${name}, and the sync fetches its data again.`, 15000);
	}

	/**
	 * Drops what the day coverage claimed for a day file or series file set
	 * aside, so the backfill fetches those days again. The chart indexes forget
	 * in their merge instead (`lostYears`), which writes their meta next.
	 */
	private async forgetAfterAside(path: string): Promise<void> {
		const year = this.nameIn(DAYS_FOLDER, path, /^(\d{4})\.json$/);
		if (year) return this.forgetDays((date) => date.startsWith(`${year}-`));
		const date = this.nameIn(SERIES_FOLDER, path, /^(\d{4}-\d{2}-\d{2})\.json$/);
		if (date) return this.forgetDays((d) => d === date);
	}

	/** What `pattern` captures of a file's name directly inside `folder`, if it is one. */
	private nameIn(folder: string, path: string, pattern: RegExp): string | undefined {
		const prefix = `${this.join(folder)}/`;
		return path.startsWith(prefix) ? pattern.exec(path.slice(prefix.length))?.[1] : undefined;
	}

	/** Takes days out of the day coverage. With no coverage file there is nothing to take: it is built from the files when next read. */
	private async forgetDays(drop: (date: string) => boolean): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.dayCoveragePath);
		const held = file instanceof TFile ? parseDayCoverage(await this.app.vault.read(file)) : null;
		if (!held) return;
		await this.put(this.dayCoveragePath, serializeDayCoverage({ spans: dropDays(held.spans, drop) }));
	}

	/**
	 * Whether this store set aside one of `folder`'s year files since the last
	 * ask, and with it the rows it held. Asked once per merge: a walk's later
	 * segments, on the same store, mustn't reset the span again.
	 */
	private lostYears(folder: string): boolean {
		const prefix = `${this.join(folder)}/`;
		let lost = false;
		for (const path of [...this.aside]) {
			if (!path.startsWith(prefix) || !isYearFile(path.slice(prefix.length))) continue;
			this.aside.delete(path);
			lost = true;
		}
		return lost;
	}

	/** Notes a conflict copy beside the sync's files for the session; the first one found says so (see `seenConflictCopies`). */
	private noteCopy(file: TFile): void {
		if (!isConflictCopy(file.name) || conflictCopies.has(file.path)) return;
		conflictCopies.add(file.path);
		if (conflictCopies.size > 1) return;
		new Notice(
			`Garmin: a sync service left a conflict copy of a data file, ${file.path}. ` +
				"The plugin reads only the original; if days are missing, \"Sync a date range…\" fetches them again.",
			15000,
		);
	}

	private join(rest: string): string {
		return normalizePath(this.folder ? `${this.folder}/${rest}` : rest);
	}
}

/** How much of Garmin's count a listing that reached its end must hold to replace the activity index. */
const WHOLE_LISTING = 0.95;

/** A chart folder's files as a merge read them: the years parsed, and each file's text by name, for the write to compare against. */
interface HeldFiles {
	years: string[];
	texts: Map<string, string>;
}

/** Each chart store's days, by folder, with its year files' stamps (`datesIn`). */
const storeDates = new Map<string, { stamp: string; dates: ReadonlySet<string> }>();

/** Each day year file's days as Home reads them, with the file's modified time and size: parsed again only once it changes. */
const parsedDays = new Map<string, { stamp: string; rows: HomeDayRow[] }>();

/** Lets go of the parsed day files: no Garmin view is open to read them. */
export function forgetParsedDays(): void {
	parsedDays.clear();
}

/**
 * Year files found readable this session, by path, with the modified time and
 * size they had then: a merge that leaves a year alone checks it again only
 * once it changed — as a sync service's conflicting copy would change it.
 */
const healthyYears = new Map<string, string>();

/** The years a batch of days touches: those of the days it asked about and of the rows it brought. */
function batchYears(batch: { dates: readonly string[]; rows: ReadonlyArray<{ date: string }> }): Set<string> {
	const years = new Set<string>();
	for (const date of batch.dates) years.add(date.slice(0, 4));
	for (const row of batch.rows) years.add(row.date.slice(0, 4));
	return years;
}

/**
 * The years a page of the activity list can change: those its activities
 * start in, and every year held from its oldest on, where an activity
 * deleted on Garmin drops out (`mergeListing`).
 */
function listingYears(listed: readonly ActivityRow[], held: readonly string[]): Set<string> {
	const years = new Set(listed.map((row) => row.start.slice(0, 4)));
	const oldest = [...years].sort()[0];
	if (oldest) for (const year of held) if (year >= oldest) years.add(year);
	return years;
}

/** A chart index's meta once one of its year files was set aside: incomplete and with no span, so the backfill walks it again. */
function forgetSpan(meta: { complete: boolean; from?: string; to?: string }): void {
	meta.complete = false;
	delete meta.from;
	delete meta.to;
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
