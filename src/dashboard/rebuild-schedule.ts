/**
 * When Home may redraw while files change under it. Pure.
 *
 * A sync writes its days one after another, and each write would redraw Home:
 * a dozen rebuilds, each parsing every day file, for one sync. So while a sync
 * writes, Home waits for its end (`HomeView.syncEnded`), and redraws then,
 * once. While the history download writes, it redraws at most every
 * `REBUILD_EVERY_MS`, so the page fills in as the download goes.
 */

/** The longest Home goes without redrawing while files keep changing. */
export const REBUILD_EVERY_MS = 30_000;

/**
 * The earliest the next redraw may come, epoch ms, given when the last one
 * came; null when it may come now, once the burst of file events settles.
 * While a sync writes: `REBUILD_EVERY_MS` after it started, or after the last
 * redraw — a sync is over well before, and its end redraws at once.
 */
export function rebuildAt(last: number, state: { syncingSince: number; backfilling: boolean }): number | null {
	if (state.syncingSince) return Math.max(state.syncingSince, last) + REBUILD_EVERY_MS;
	if (state.backfilling) return last + REBUILD_EVERY_MS;
	return null;
}
