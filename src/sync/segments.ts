/**
 * History walks a segment at a time.
 *
 * Each segment is merged into its index as soon as it is in, so a walk cut
 * short — Obsidian closed, a 429 — loses a segment at most, and the index's
 * own span is where the next segment starts.
 *
 * Pure: the runner hands in each segment's step.
 */

/** Days of windows in a segment. */
export const SEGMENT_DAYS = 365;
/** About thirteen years of segments: what a walk was capped at in one piece. */
export const MAX_SEGMENTS = 13;
/** The daily stats and sleep walks' window. */
export const STATS_WINDOW_DAYS = 28;

/** The windows in one segment of a walk whose windows are `windowDays` long. */
export function segmentWindows(windowDays: number): number {
	return Math.max(1, Math.ceil(SEGMENT_DAYS / windowDays));
}

export interface SegmentOptions {
	notBefore?: string;
	/** Carried over from the segment above (see `WalkOptions.emptyStreak`). */
	emptyStreak: number;
	shouldStop?: () => boolean;
}

/** One segment of a history walk, merged into its index. */
export interface Segment {
	requests: number;
	/** Days, or nights, it found. */
	rows: number;
	complete: boolean;
	emptyStreak: number;
	fatal?: unknown;
	error?: string;
}

export function segmentOf(got: { requests: number; complete: boolean; emptyStreak: number; fatal?: unknown; error?: string }, rows: number): Segment {
	return {
		requests: got.requests,
		rows,
		complete: got.complete,
		emptyStreak: got.emptyStreak,
		...(got.fatal ? { fatal: got.fatal } : {}),
		...(got.error ? { error: got.error } : {}),
	};
}

/** Segment after segment until the walk is complete, a request fails or nothing is left to ask. */
export async function walkInSegments(step: (emptyStreak: number) => Promise<Segment>, segments = MAX_SEGMENTS): Promise<Segment> {
	const total: Segment = { requests: 0, rows: 0, complete: false, emptyStreak: 0 };
	for (let n = 0; n < segments; n++) {
		const got = await step(total.emptyStreak);
		total.requests += got.requests;
		total.rows += got.rows;
		total.complete = got.complete;
		total.emptyStreak = got.emptyStreak;
		if (got.fatal) total.fatal = got.fatal;
		if (got.error) total.error = got.error;
		if (got.complete || got.fatal || got.error || got.requests === 0) break;
	}
	return total;
}
