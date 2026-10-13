import { toIsoDate } from "../garmin/endpoints";
import { num } from "./numbers";

/**
 * Where the last good recent sync got to, in `<dataFolder>/sync-state.json`:
 * what the next one works its range out from (see `recentRange`).
 *
 * In the data folder rather than the plugin's settings, so it vouches only for
 * the files beside it: a new or emptied data folder starts over.
 *
 * Pure. The store reads and writes the file.
 */

export const SYNC_STATE_VERSION = 1;

export interface SyncState {
	/** When the sync started, ISO. */
	syncedAt: string;
	/** The watch's last upload as Garmin reported it when the sync started, ISO. */
	deviceUpload?: string;
}

const instant = (v: unknown): string | undefined =>
	typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : undefined;

export function serializeSyncState(state: SyncState): string {
	return `${JSON.stringify({ version: SYNC_STATE_VERSION, ...state }, null, "\t")}\n`;
}

/** The state a file holds, or null when it holds none worth trusting. */
export function parseSyncState(text: string): SyncState | null {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const syncedAt = instant(r.syncedAt);
	if (!syncedAt) return null;
	const deviceUpload = instant(r.deviceUpload);
	return deviceUpload ? { syncedAt, deviceUpload } : { syncedAt };
}

/**
 * The local date nothing before which can have changed since the state was
 * written: the watch's upload when there was one, else the sync itself. The
 * earlier of the two, so a clock ahead of Garmin's never skips a day.
 */
export function markOf(state: SyncState | null): string | null {
	if (!state) return null;
	const times = [state.syncedAt, state.deviceUpload].filter((t): t is string => !!t).map(Date.parse);
	return toIsoDate(new Date(Math.min(...times)));
}

/** The watch's last upload in a `mylastused` payload, ISO, as `account.ts` reads it. */
export function deviceUploadOf(payload: Record<string, unknown> | null): string | undefined {
	const time = num(payload?.lastUsedDeviceUploadTime);
	return time === undefined ? undefined : new Date(time).toISOString();
}
