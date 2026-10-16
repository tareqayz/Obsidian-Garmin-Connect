/**
 * Obsidian has no uninstall hook: uninstalling disables the plugin — its
 * `onunload` runs — and then deletes the plugin's folder (read from Obsidian
 * 1.14.4's own code). A disable or an update leaves the folder where it is.
 * So `onunload` looks again a moment later, a few times: the folder gone
 * means the plugin was uninstalled, and the data it synced into the vault is
 * still there, which is worth a question.
 *
 * Plain timers, not the plugin's registered ones, which unloading clears.
 * Each check is one `exists`. The folder has to be gone at two looks in a row
 * — one miss could be a sync service rewriting it — and the watch ends within
 * fifteen seconds; a folder gone only at the last look isn't asked about.
 *
 * Pure: the checks and the timer are handed in.
 */

export interface UninstallWatch {
	/** Whether the plugin's folder is still there. */
	exists: () => Promise<boolean>;
	/** The folder is gone: called once. */
	onGone: () => void;
	/** Milliseconds after the unload to look, in order. */
	delays?: readonly number[];
	/** Injectable for tests. */
	setTimer?: (run: () => void, ms: number) => unknown;
}

export const UNINSTALL_CHECKS: readonly number[] = [1500, 4000, 10000, 15000];

/** Looks in a row that must find the folder gone. */
const MISSES_IN_A_ROW = 2;

export function watchForUninstall(watch: UninstallWatch): void {
	const delays = watch.delays ?? UNINSTALL_CHECKS;
	const setTimer = watch.setTimer ?? ((run, ms) => window.setTimeout(run, ms));
	const check = (index: number, missed: number) => {
		if (index >= delays.length) return;
		const wait = delays[index]! - (index ? delays[index - 1]! : 0);
		setTimer(() => {
			watch.exists().then(
				(there) => {
					const misses = there ? 0 : missed + 1;
					if (misses >= MISSES_IN_A_ROW) watch.onGone();
					else check(index + 1, misses);
				},
				// A vault that cannot answer is not one to prompt over.
				() => undefined,
			);
		}, wait);
	};
	check(0, 0);
}
