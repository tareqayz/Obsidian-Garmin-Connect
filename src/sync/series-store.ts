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
import type { SeriesTarget } from "./engine";
import { ensureFolder, trimSlashes } from "./frontmatter";
import type { AccountInfo } from "./account";
import { parseSeries, serializeSeries, type DaySeries } from "./intraday";

export const SERIES_FOLDER = "series";
export const ACCOUNT_FILE = "account.json";
export const ACTIVITIES_FOLDER = "activities";
export const ACTIVITY_META_FILE = "index.json";

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
 * Intraday series, one JSON file per day, beside the day notes:
 * `<dataFolder>/series/<date>.json`. Plus `<dataFolder>/account.json` for the
 * few facts that belong to no day, and the activity index in
 * `<dataFolder>/activities/` (see `activity-index.ts`).
 *
 * Files rather than frontmatter because a day of heart rate is hundreds of
 * points (see `intraday.ts`). Written through the vault API so Obsidian Sync and
 * the file explorer see them like any other file, and skipped when the text
 * would not change, for the same mtime reason as `writeFrontmatter`.
 */
export class VaultSeriesStore implements SeriesTarget {
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

	async read(date: string): Promise<DaySeries | null> {
		const file = this.app.vault.getAbstractFileByPath(this.path(date));
		if (!(file instanceof TFile)) return null;
		return parseSeries(await this.app.vault.cachedRead(file));
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

	/** Whether a vault path is one of the files this store writes. */
	owns(path: string): boolean {
		return (
			path === this.accountPath ||
			path.startsWith(`${this.join(SERIES_FOLDER)}/`) ||
			path.startsWith(`${this.activitiesFolder}/`)
		);
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

/** One row per activity, even if an edit moved it across a year boundary between two files. */
function dedupeById(rows: readonly ActivityRow[]): ActivityRow[] {
	const byId = new Map<number, ActivityRow>();
	for (const row of rows) {
		const seen = byId.get(row.id);
		if (!seen || row.begin > seen.begin) byId.set(row.id, row);
	}
	return [...byId.values()];
}
