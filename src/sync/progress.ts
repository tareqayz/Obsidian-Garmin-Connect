/**
 * What a sync says about itself while it runs.
 *
 * The engine counts days and knows nothing about drawing; this is the shape the
 * Notice reads to draw its bar.
 */
export interface SyncProgress {
	/** Days finished. */
	done: number;
	/**
	 * Days in the range. Zero until the first day lands: the engine only knows
	 * the count once it has worked out which days are actually due, which is
	 * what the indeterminate bar is for.
	 */
	total: number;
	/** The last day to land, ISO. Null before the first one. */
	date: string | null;
	/** Seconds left at the pace so far; null while there is no pace to go on. */
	eta: number | null;
}

/** Share of the range that is done, 0 to 1. Zero while the total is unknown. */
export function fraction(progress: SyncProgress): number {
	if (progress.total <= 0) return 0;
	return Math.max(0, Math.min(1, progress.done / progress.total));
}

/**
 * Seconds left at the pace so far.
 *
 * A sync is one round of requests per day plus the configured pause, so the
 * mean day is a fair predictor of the next one. Null until a day has actually
 * landed, because a guess made from no evidence is worse than no guess.
 */
export function etaSeconds(elapsedMs: number, done: number, total: number): number | null {
	if (done <= 0 || total <= 0 || done >= total) return null;
	const perDay = elapsedMs / done;
	return Math.max(1, Math.round((perDay * (total - done)) / 1000));
}

/**
 * Rounded hard on purpose: a countdown precise to the second is one the reader
 * gets to catch out, and being caught out is worse than being vague.
 */
export function formatEta(seconds: number | null): string {
	if (seconds === null) return "";
	if (seconds < 10) return "nearly done";
	if (seconds < 60) return `about ${Math.round(seconds / 5) * 5}s left`;
	return `about ${Math.round(seconds / 60)}m left`;
}
