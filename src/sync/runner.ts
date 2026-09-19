import { Notice, TFile, normalizePath, type App } from "obsidian";
import type { GarminApi } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { GarminAuthError, GarminBlockedError, GarminRateLimitError } from "../garmin/errors";
import type { Log } from "../log";
import { basesView } from "./bases-view";
import { DailyNoteTarget, resolveDailyNoteOptions } from "./daily-note";
import { DataFolderTarget } from "./data-folder";
import { MultiTarget, lastNDays, syncRange, type NoteTarget, type SyncReport } from "./engine";
import { ensureFolder, trimSlashes } from "./frontmatter";
import { linkTargetFor, type LinkOption } from "./link";
import type { MetricGroup } from "./metrics";
import { etaSeconds, fraction, formatEta, type SyncProgress } from "./progress";

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

	async run(from: string, to: string, log?: Log): Promise<SyncReport | null> {
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
			const report = await syncRange(this.api, this.buildTarget(settings), {
				from,
				to,
				groups: settings.groups,
				units,
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
