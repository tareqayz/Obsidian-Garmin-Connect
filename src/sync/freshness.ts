import type { Activity } from "../garmin/endpoints";
import { toIsoDate } from "../garmin/endpoints";
import { rowOf } from "./activity-index";
import type { MetricGroup } from "./metrics";
import type { SyncState } from "./sync-state";

/**
 * Whether a sync has anything to fetch, decided from two requests: the watch's
 * last upload and the newest page of the activity list. Garmin's data changes
 * when a device uploads or an activity is added or edited; the rest of a day
 * settles within hours. A sync that started on its own and finds neither
 * moved since the last good one stops there, writing nothing.
 *
 * Pure.
 */

/** Activities the probe lists: enough to see one added, renamed or deleted at the top. */
export const PROBE_PAGE = 10;

/** After an upload, Garmin keeps scoring the night and the day for a while: a sync this soon after one doesn't settle it. */
export const UPLOAD_SETTLE_MS = 10 * 60_000;

/** The longest a skip may lean on the last full sync: what no upload announces — a weigh-in typed in the app, a rescored day — comes in at least this often. */
export const MAX_QUIET_MS = 3 * 3_600_000;

/** How often an automatic sync fetches the account file — the watch, thresholds, records — when nothing says it changed. */
export const ACCOUNT_EVERY_MS = 6 * 3_600_000;

/**
 * Whether a full sync fetches the account file: always when someone asked
 * for the sync, and otherwise when the newest activities changed (a record,
 * a new threshold), the probe couldn't say, or it's `ACCOUNT_EVERY_MS` old.
 */
export function wantsAccount(state: SyncState | null, probe: Probe, ctx: { now: number; manual: boolean }): boolean {
	if (ctx.manual || !state?.accountAt) return true;
	if (!probe.list.ok || probe.list.key !== state.list) return true;
	return ctx.now - Date.parse(state.accountAt) >= ACCOUNT_EVERY_MS;
}

/** What the probe found. */
export interface Probe {
	/** The `mylastused` call went through; `upload` is its time, undefined for an account with no device. */
	device: { ok: true; upload?: string; payload: Record<string, unknown> | null } | { ok: false };
	/** The newest page of the activity list, and its key (`listKey`). */
	list: { ok: true; page: Activity[]; key: string } | { ok: false };
}

/** What makes the files a sync writes: changed, every day is written again. */
export interface FingerprintInput {
	groups: readonly MetricGroup[];
	/** The setting, not what it resolved to: no request needed. */
	units: string;
	dayDetails: string;
	dataVersion: number;
	pluginVersion: string;
}

export type FullReason = "no-state" | "dirty" | "settings" | "new-day" | "quiet" | "device-unknown" | "upload" | "settling" | "activities";

/**
 * Whether a sync may stop at the probe. It may when the last full sync was
 * clean and recent, on the same day, under the same settings, and since it
 * the watch hasn't uploaded (or its upload has settled) and the list's top is
 * as it was. Otherwise it says why the sync goes on.
 */
export function shouldSkip(state: SyncState | null, probe: Probe, ctx: { now: number; fingerprint: string }): { skip: true } | { skip: false; reason: FullReason } {
	if (!state) return { skip: false, reason: "no-state" };
	if (!state.list || !state.fingerprint) return { skip: false, reason: "dirty" };
	if (state.fingerprint !== ctx.fingerprint) return { skip: false, reason: "settings" };
	if (toIsoDate(new Date(state.syncedAt)) !== toIsoDate(new Date(ctx.now))) return { skip: false, reason: "new-day" };
	if (ctx.now - Date.parse(state.syncedAt) >= MAX_QUIET_MS) return { skip: false, reason: "quiet" };
	if (!probe.device.ok) return { skip: false, reason: "device-unknown" };
	if (probe.device.upload !== state.deviceUpload) return { skip: false, reason: "upload" };
	if (state.deviceUpload && Date.parse(state.syncedAt) - Date.parse(state.deviceUpload) < UPLOAD_SETTLE_MS) return { skip: false, reason: "settling" };
	if (!probe.list.ok || probe.list.key !== state.list) return { skip: false, reason: "activities" };
	return { skip: true };
}

/**
 * The local day a full sync goes back to: the watch's last upload as the last
 * good sync saw it, or, when the watch hasn't uploaded since, the day of that
 * sync itself — a watch left in a drawer doesn't make every sync fetch the
 * same days again.
 */
export function markFor(state: SyncState | null, probe: Probe): string | null {
	if (!state) return null;
	const unchanged = probe.device.ok && probe.device.upload !== undefined && probe.device.upload === state.deviceUpload;
	if (unchanged) return toIsoDate(new Date(state.syncedAt));
	const times = [state.syncedAt, state.deviceUpload].filter((t): t is string => !!t).map(Date.parse);
	return toIsoDate(new Date(Math.min(...times)));
}

/**
 * What a full sync leaves for the next one. Its start, and the watch's upload
 * as the probe saw it — or as the state had it, when the probe couldn't say,
 * so days uploaded since are still fetched. The list's key and the
 * fingerprint only after a clean run: one that failed somewhere tries again
 * in full. A run whose only warnings are the last one's is clean, or a
 * lasting warning would make every sync a full one.
 */
export function nextSyncState(
	state: SyncState | null,
	probe: Probe,
	run: { startedAt: string; fingerprint: string; failed: number; warnings: readonly string[]; account?: boolean },
): SyncState {
	const upload = probe.device.ok ? probe.device.upload : state?.deviceUpload;
	const warn = run.warnings.length ? warnSignature(run.warnings) : undefined;
	const clean = run.failed === 0 && probe.list.ok && (!warn || warn === state?.warn);
	// Fetched whole this run, or as the last state had it.
	const accountAt = run.account ? run.startedAt : state?.accountAt;
	return {
		syncedAt: run.startedAt,
		...(upload ? { deviceUpload: upload } : {}),
		...(clean && probe.list.ok ? { list: probe.list.key, fingerprint: run.fingerprint } : {}),
		...(warn ? { warn } : {}),
		...(accountAt ? { accountAt } : {}),
	};
}

/** A key for the newest activities: the fields a day's workouts and the activity index keep, so volatile ones don't count. */
export function listKey(page: readonly Activity[]): string {
	return hash(
		page
			.map((activity) => {
				const a = activity as Activity & Record<string, unknown>;
				return JSON.stringify([rowOf(activity), a.averageHR ?? null, a.maxHR ?? null, a.steps ?? null, a.movingDuration ?? null]);
			})
			.join("\n"),
	);
}

export function fingerprintOf(input: FingerprintInput): string {
	return hash(JSON.stringify([[...input.groups].sort(), input.units, input.dayDetails, input.dataVersion, input.pluginVersion]));
}

/** The warnings a run ended with, as a key: the same lasting warning makes the same key. */
export function warnSignature(warnings: readonly string[]): string {
	return hash([...warnings].sort().join("\n"));
}

/** cyrb53: a short, stable, well-spread hash, as base 36. */
function hash(text: string): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
