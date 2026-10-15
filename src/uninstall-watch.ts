/**
 * Obsidian has no uninstall hook: uninstalling disables the plugin — its
 * `onunload` runs — and then deletes the plugin's folder (read from Obsidian
 * 1.14.4's own code). A disable or an update leaves the folder where it is.
 * So `onunload` looks again a moment later, a few times: the folder gone
 * means the plugin was uninstalled, and the data it synced into the vault is
 * still there, which is worth a question.
 *
 * Plain timers, not the plugin's registered ones, which unloading clears.
 * Each check is one `exists`; the watch ends at the first answer either way,
 * and within ten seconds at most.
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

export const UNINSTALL_CHECKS: readonly number[] = [1500, 4000, 10000];

export function watchForUninstall(watch: UninstallWatch): void {
	const delays = watch.delays ?? UNINSTALL_CHECKS;
	const setTimer = watch.setTimer ?? ((run, ms) => window.setTimeout(run, ms));
	const check = (index: number) => {
		if (index >= delays.length) return;
		const wait = delays[index]! - (index ? delays[index - 1]! : 0);
		setTimer(() => {
			watch.exists().then(
				(there) => (there ? check(index + 1) : watch.onGone()),
				// A vault that cannot answer is not one to prompt over.
				() => undefined,
			);
		}, wait);
	};
	check(0);
}
