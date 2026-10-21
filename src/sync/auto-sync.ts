import { toIsoDate } from "../garmin/endpoints";
import type { FailCause, SyncOutcome } from "./sync-outcome";

/**
 * When a sync starts on its own. Obsidian starting, Home coming into view and
 * the app coming back to the front each ask (`poke`). A sync runs when the
 * last one, on this device or any other, is 15 minutes old or from another
 * day. Its probe (`freshness.ts`) then stops it at two requests when nothing
 * moved. After a failure it waits before trying again: a minute when offline,
 * five after Garmin asked to slow down, half an hour after its bot check.
 *
 * The rules are pure (`autoSyncDue`, `nextLocal`); `AutoSync` holds the timer.
 */

/** How old the last sync must be before the next one starts on its own. */
export const AUTO_SYNC_EVERY_MS = 15 * 60_000;
/** Asks this close together are one: Obsidian's start and Home's showing come in a burst. */
export const COALESCE_MS = 750;
/** How long a failed automatic sync waits before the next try, by what stopped it. */
export const BACKOFF_MS: Record<FailCause, number> = {
	offline: 60_000,
	"rate-limited": 5 * 60_000,
	blocked: 30 * 60_000,
	"signed-out": 30 * 60_000,
	other: 5 * 60_000,
};

/** Where this device keeps `AutoSyncLocal`: localStorage, per vault and device, so a check never writes to the vault. */
export const AUTO_SYNC_KEY = "garmin-connect-auto";

/** What this device remembers between automatic syncs. */
export interface AutoSyncLocal {
	/** When an automatic sync last finished here, epoch ms. */
	checkedAt: number;
	/** After a failure: no automatic sync before this, epoch ms. */
	retryAt?: number;
}

/** The stored value, or null for anything else. */
export function parseLocal(raw: unknown): AutoSyncLocal | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.checkedAt !== "number" || !Number.isFinite(r.checkedAt)) return null;
	return typeof r.retryAt === "number" && Number.isFinite(r.retryAt) ? { checkedAt: r.checkedAt, retryAt: r.retryAt } : { checkedAt: r.checkedAt };
}

/**
 * Whether a sync is due: past any wait after a failure, and the later of this
 * device's last check and the last sync on any device (`syncedAt`) is
 * `AUTO_SYNC_EVERY_MS` old or from another local day.
 */
export function autoSyncDue(now: number, local: AutoSyncLocal | null, syncedAt: number | null): boolean {
	if (local?.retryAt !== undefined && now < local.retryAt) return false;
	const last = Math.max(local?.checkedAt ?? 0, syncedAt ?? 0);
	if (!last) return true;
	if (toIsoDate(new Date(last)) !== toIsoDate(new Date(now))) return true;
	return now - last >= AUTO_SYNC_EVERY_MS;
}

/**
 * What this device remembers after an automatic sync. One that failed, or
 * that Garmin stopped, keeps the last check and waits before the next try;
 * any other ending counts as a check.
 */
export function nextLocal(local: AutoSyncLocal | null, outcome: SyncOutcome, now: number): AutoSyncLocal {
	const failed = outcome.kind === "failed" || (outcome.kind === "stopped" && outcome.cause !== undefined);
	if (!failed) return { checkedAt: now };
	return { checkedAt: local?.checkedAt ?? 0, retryAt: now + BACKOFF_MS[outcome.cause ?? "other"] };
}

export interface AutoSyncDeps {
	now(): number;
	/** Whether a sync may start on its own now: the setting on, the setup done, signed in, nothing else syncing, Garmin not resting the download. */
	allowed(): boolean;
	loadLocal(): AutoSyncLocal | null;
	saveLocal(local: AutoSyncLocal): void;
	/** When a sync last finished on any device, epoch ms (`sync-state.json`), or null. */
	syncedAt(): Promise<number | null>;
	/** A recent sync started on its own; null when the runner was busy. */
	sync(): Promise<SyncOutcome | null>;
	setTimeout(run: () => void, ms: number): number;
	clearTimeout(id: number): void;
}

export class AutoSync {
	private timer = 0;
	private running: Promise<void> | null = null;
	/** Nothing starts before this: right after Obsidian starts, the vault is still being indexed. */
	private readonly notBefore: number;

	constructor(
		private readonly deps: AutoSyncDeps,
		startDelayMs = 0,
	) {
		this.notBefore = deps.now() + startDelayMs;
	}

	/** Something happened that may make a sync due. Asks within `COALESCE_MS` of each other are one. */
	poke(): void {
		if (this.timer) return;
		const wait = Math.max(COALESCE_MS, this.notBefore - this.deps.now());
		this.timer = this.deps.setTimeout(() => {
			this.timer = 0;
			void this.check();
		}, wait);
	}

	/** Runs a sync if one is due, one at a time. */
	check(): Promise<void> {
		if (this.running) return this.running;
		if (!this.deps.allowed()) return Promise.resolve();
		const run = this.run().finally(() => {
			if (this.running === run) this.running = null;
		});
		this.running = run;
		return run;
	}

	stop(): void {
		if (this.timer) this.deps.clearTimeout(this.timer);
		this.timer = 0;
	}

	private async run(): Promise<void> {
		const local = this.deps.loadLocal();
		let syncedAt: number | null = null;
		try {
			syncedAt = await this.deps.syncedAt();
		} catch {
			// Unreadable: this device's own check decides.
		}
		if (!autoSyncDue(this.deps.now(), local, syncedAt)) return;
		const outcome = await this.deps.sync();
		// The runner was busy with a sync of its own, whose mark counts instead.
		if (!outcome) return;
		this.deps.saveLocal(nextLocal(local, outcome, this.deps.now()));
	}
}
