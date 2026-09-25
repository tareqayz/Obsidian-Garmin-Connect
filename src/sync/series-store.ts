import { App, TFile, normalizePath } from "obsidian";
import type { SeriesTarget } from "./engine";
import { ensureFolder, trimSlashes } from "./frontmatter";
import type { AccountInfo } from "./account";
import { parseSeries, serializeSeries, type DaySeries } from "./intraday";

export const SERIES_FOLDER = "series";
export const ACCOUNT_FILE = "account.json";

/**
 * Intraday series, one JSON file per day, beside the day notes:
 * `<dataFolder>/series/<date>.json`. Plus `<dataFolder>/account.json` for the
 * few facts that belong to no day.
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
