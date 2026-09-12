import { Notice, type App } from "obsidian";
import type { GarminApi } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { GarminAuthError, GarminBlockedError, GarminRateLimitError } from "../garmin/errors";
import type { Log } from "../log";
import { DailyNoteTarget, resolveDailyNoteOptions } from "./daily-note";
import { lastNDays, syncRange, type SyncReport } from "./engine";
import type { MetricGroup } from "./metrics";

export interface RunnerSettings {
	syncDays: number;
	groups: MetricGroup[];
	units: "metric" | "imperial" | "auto";
	prefix: string;
	dailyNoteFolder: string;
	dailyNoteFormat: string;
	createMissingNotes: boolean;
	pauseBetweenDays: number;
}

/**
 * Turns settings into a sync run and reports it to the user.
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
		const target = new DailyNoteTarget(
			this.app,
			resolveDailyNoteOptions(this.app, {
				folder: settings.dailyNoteFolder,
				format: settings.dailyNoteFormat,
				createIfMissing: settings.createMissingNotes,
			}),
		);

		const progress = new Notice("Garmin sync: starting…", 0);
		this.running = true;
		try {
			const units = await this.resolveUnits(settings.units);
			const report = await syncRange(this.api, target, {
				from,
				to,
				groups: settings.groups,
				units,
				prefix: settings.prefix,
				requireExistingNote: !settings.createMissingNotes,
				pauseBetweenDays: settings.pauseBetweenDays,
				log,
				onProgress: (done, total, date) => {
					progress.setMessage(`Garmin sync: ${done}/${total} (${date})`);
				},
			});
			progress.hide();
			new Notice(describe(report), report.failed || report.stoppedEarly ? 10000 : 5000);
			return report;
		} catch (err) {
			progress.hide();
			new Notice(`Garmin sync failed: ${explain(err)}`, 10000);
			return null;
		} finally {
			this.running = false;
		}
	}

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
	const summary = `Garmin sync: ${parts.join(", ")}`;
	return report.stoppedEarly ? `${summary} — stopped: ${report.stoppedEarly}` : summary;
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
