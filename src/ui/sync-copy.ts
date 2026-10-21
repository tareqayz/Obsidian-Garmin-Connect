import { formatBytes, formatDuration } from "../sync/estimate";

/**
 * How the sync and the history download put sizes and times into words, in
 * every dialog. Never a request count: how the plugin talks to Garmin is its
 * own business (`docs/garmin-api.md` has the numbers).
 *
 * Pure.
 */

/** "≈ 4.2 MB", or "under 1 KB" where "≈ < 1 KB" would read oddly. */
export function sizeText(bytes: number): string {
	return bytes < 1_000 ? "under 1 KB" : `≈ ${formatBytes(bytes)}`;
}

/** "≈ 4.2 MB · about 3 minutes". */
export function sizeAndTime(bytes: number, seconds: number): string {
	return `${sizeText(bytes)} · ${formatDuration(seconds)}`;
}
