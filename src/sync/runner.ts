import { Notice, TFile, normalizePath, type App } from "obsidian";
import type { GarminApi } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { GarminAuthError, GarminBlockedError, GarminRateLimitError } from "../garmin/errors";
import type { Log } from "../log";
import { basesView } from "./bases-view";
import { DailyNoteTarget, resolveDailyNoteOptions } from "./daily-note";
import { DataFolderTarget } from "./data-folder";
import { MultiTarget, fetchAllActivities, lastNDays, syncRange, type NoteTarget, type SyncReport } from "./engine";
import { ensureFolder, trimSlashes } from "./frontmatter";
import { fetchAccount } from "./account";
import { linkTargetFor, type LinkOption } from "./link";
import type { MetricGroup } from "./metrics";
import { etaSeconds, fraction, formatEta, type SyncProgress } from "./progress";
import { VaultSeriesStore } from "./series-store";

export type StorageMode = "dataFolder" | "dailyNotes" | "both";

export interface RunnerSettings {
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";

	storageMode: StorageMode;
	dataFolder: string;
	dataFolderPrefix: string;
	createBasesView: boolean;
	basesFolder: string;

	linkToBase: boolean;
	linkProperty: string;

	prefix: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	createMissingNotes: boolean;

	pauseBetweenDays: number;
	stopAfterEmptyDays: number;
}

const BASES_FILE = "Garmin Health.base";

/** Activities per request when paging the whole history. The list honours 100. */
const HISTORY_PAGE = 100;

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
	private running = false;
	/** The history sync starts itself once a session, after the first sync, until it has finished once. */
	private historyTried = false;
	private historyState: HistoryProgress | null = null;
	private historyListeners = new Set<(progress: HistoryProgress | null) => void>();

	constructor(app: App, api: GarminApi, settings: () => RunnerSettings) {
		this.app = app;
		this.api = api;
		this.settings = settings;
	}

	get isRunning(): boolean {
		return this.running;
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

	async run(from: string, to: string, log?: Log): Promise<SyncReport | null> {
		const report = await this.runDays(from, to, log);
		// Not awaited: Home's sync button should not spin through four more
		// requests. Skipped after a 429 or a dead session, as the account is.
		if (report && !report.stoppedEarly && !this.historyTried && this.settings().groups.includes("workouts")) {
			this.historyTried = true;
			void this.syncActivityHistory({ auto: true, log });
		}
		return report;
	}

	private async runDays(from: string, to: string, log?: Log): Promise<SyncReport | null> {
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
		try {
			const units = await this.resolveUnits(settings.units);
			const series = new VaultSeriesStore(this.app, settings.dataFolder);
			const report = await syncRange(this.api, this.buildTarget(settings), {
				from,
				to,
				groups: settings.groups,
				units,
				series,
				activities: { merge: (listing, complete) => series.mergeActivities(listing, { complete, units }) },
				pauseBetweenDays: settings.pauseBetweenDays,
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

			// Only worth creating once there is something for it to show.
			if (report.written > 0) await this.ensureBasesView(settings, units);

			new Notice(describe(report), report.failed || report.stoppedEarly ? 10000 : 5000);
			return report;
		} catch (err) {
			notice.hide();
			new Notice(`Garmin sync failed: ${explain(err)}`, 10000);
			return null;
		} finally {
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
				pause: settings.pauseBetweenDays,
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

	private buildTarget(settings: RunnerSettings): NoteTarget {
		const link = this.linkOption(settings);
		const dataFolder = () =>
			new DataFolderTarget(this.app, {
				folder: settings.dataFolder,
				prefix: settings.dataFolderPrefix,
				link,
			});
		const dailyNotes = () =>
			new DailyNoteTarget(
				this.app,
				resolveDailyNoteOptions(this.app, {
					folder: settings.dailyNoteFolder,
					format: settings.dailyNoteFormat,
					createIfMissing: settings.createMissingNotes,
					prefix: settings.prefix,
					link,
				}),
			);

		switch (settings.storageMode) {
			case "dailyNotes":
				return dailyNotes();
			case "both":
				return new MultiTarget([dataFolder(), dailyNotes()]);
			default:
				return dataFolder();
		}
	}

	/* ---------------------------------------------------------------- */
	/*  Bases view                                                       */
	/* ---------------------------------------------------------------- */

	/**
	 * The link every day note points at, or nothing.
	 *
	 * Pointless without the view it links to, so a mode that never creates one
	 * gets no link rather than a property resolving to a missing file.
	 */
	linkOption(settings = this.settings()): LinkOption | undefined {
		if (!settings.linkToBase || !settings.linkProperty) return undefined;
		if (settings.storageMode === "dailyNotes" || !settings.createBasesView) return undefined;
		return { property: settings.linkProperty, target: linkTargetFor(this.basesPath(settings)) };
	}

	basesPath(settings = this.settings()): string {
		const folder = trimSlashes(settings.basesFolder);
		return normalizePath(folder ? `${folder}/${BASES_FILE}` : BASES_FILE);
	}

	/**
	 * Creates the table view if it is not there. Never overwrites: once you have
	 * adjusted columns or filters, a sync must not undo that.
	 */
	async ensureBasesView(
		settings = this.settings(),
		units?: "metric" | "imperial",
	): Promise<"created" | "exists" | "skipped"> {
		if (settings.storageMode === "dailyNotes" || !settings.createBasesView) return "skipped";
		const path = this.basesPath(settings);
		if (this.app.vault.getAbstractFileByPath(path)) return "exists";

		const base = trimSlashes(settings.basesFolder);
		if (base) await ensureFolder(this.app, base);
		await this.app.vault.create(
			path,
			basesView({
				// The filter follows the notes, which need not sit beside the view.
				folder: trimSlashes(settings.dataFolder) || "/",
				prefix: settings.dataFolderPrefix,
				groups: settings.groups,
				units: units ?? (await this.resolveUnits(settings.units)),
			}),
		);
		return "created";
	}

	/** Rebuilds the view from current settings, replacing what is there. */
	async rewriteBasesView(): Promise<string> {
		const settings = this.settings();
		const path = this.basesPath(settings);
		const units = await this.resolveUnits(settings.units);
		const content = basesView({
			folder: trimSlashes(settings.dataFolder) || "/",
			prefix: settings.dataFolderPrefix,
			groups: settings.groups,
			units,
		});

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) await this.app.vault.modify(existing, content);
		else {
			const folder = trimSlashes(settings.basesFolder);
			if (folder) await ensureFolder(this.app, folder);
			await this.app.vault.create(path, content);
		}
		return path;
	}

	/* ---------------------------------------------------------------- */

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
 * lives outside .gcd-root, so the rail's two colours come from styles.css
 * rather than the dashboard tokens.
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
