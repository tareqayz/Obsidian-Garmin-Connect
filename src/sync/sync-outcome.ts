import { GarminAuthError, GarminBlockedError, GarminNetworkError, GarminRateLimitError } from "../garmin/errors";
import type { SyncReport } from "./engine";

/**
 * How a sync went, in words a person reads: Home's line beside ↻ and the
 * notices. What it did in detail stays in the report, for debug info.
 *
 * Pure.
 */

/** What started a sync, which decides what it may skip and what it says. */
export type SyncTrigger = "auto" | "button" | "command" | "setup";

export interface SyncOutcome {
	/**
	 * - `up-to-date`: the probe found nothing new (an automatic sync), or a
	 *   full sync changed no file.
	 * - `synced`: days were written.
	 * - `stopped`: cut short — by you, by Garmin, or past the history's start.
	 * - `failed`: nothing came of it.
	 */
	kind: "up-to-date" | "synced" | "stopped" | "failed";
	/** Days whose files changed. */
	days: number;
	/** Days Garmin's answer couldn't be read for. */
	failed: number;
	/** Why it stopped or failed, in a few words. */
	reason?: string;
	/** When it ended, ISO. */
	at: string;
}

export function outcomeOf(report: SyncReport, at: string): SyncOutcome {
	const days = report.days.filter((day) => day.status === "written" || day.seriesWritten).length;
	if (report.stoppedEarly) return { kind: "stopped", days, failed: report.failed, reason: stopReason(report), at };
	return { kind: days || report.failed ? "synced" : "up-to-date", days, failed: report.failed, at };
}

export function failedOutcome(err: unknown, at: string): SyncOutcome {
	return { kind: "failed", days: 0, failed: 0, reason: reasonOf(err), at };
}

/** "3 days updated, 1 failed.", "Up to date.", "Stopped: Garmin asked to slow down." */
export function outcomeText(o: SyncOutcome): string {
	if (o.kind === "failed") return `Couldn't sync: ${o.reason ?? "something went wrong"}.`;
	const counted = o.days === 1 ? "1 day updated" : `${o.days} days updated`;
	const done = o.days ? (o.failed ? `${counted}, ${o.failed} failed` : counted) : o.failed ? `${o.failed} ${o.failed === 1 ? "day" : "days"} failed` : "";
	if (o.kind === "stopped") return [done, o.reason ? `stopped: ${o.reason}` : "stopped"].filter(Boolean).join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";
	return done ? `${done.replace(/^./, (c) => c.toUpperCase())}.` : "Up to date.";
}

/** Home's line beside ↻: "Synced 2:05 PM", "Sync stopped", "Couldn't sync". */
export function outcomeLine(o: SyncOutcome, time: (iso: string) => string): string {
	if (o.kind === "failed") return "Couldn't sync";
	if (o.kind === "stopped") return "Sync stopped";
	return `Synced ${time(o.at)}`;
}

function stopReason(report: SyncReport): string | undefined {
	if (report.fatal !== undefined) return reasonOf(report.fatal);
	if (report.stoppedEarly === "cancelled") return undefined;
	if (/^nothing found for/.test(report.stoppedEarly ?? "")) return "nothing older on Garmin";
	return report.stoppedEarly;
}

/** A sync's error in a few words. */
export function reasonOf(err: unknown): string {
	if (err instanceof GarminRateLimitError) return "Garmin asked to slow down";
	if (err instanceof GarminBlockedError) return "Garmin's bot check refused this device";
	if (err instanceof GarminAuthError) return "your session ended, so sign in again";
	return err instanceof Error ? err.message : String(err);
}

/** A failure a quiet sync stays quiet about: no network, not Garmin. */
export function isOffline(err: unknown): boolean {
	return err instanceof GarminNetworkError;
}
