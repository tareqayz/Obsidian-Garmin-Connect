import { getContext, setContext } from "svelte";

/**
 * Sync, as the bars of the pages Home shows reach it: Home owns the state and
 * the action, and a context spares every page from passing them down.
 */
export interface SyncControl {
	/** A pane shows ↻ in every page's bar; a phone keeps back and title. */
	readonly inBars: boolean;
	readonly canSync: boolean;
	readonly syncing: boolean;
	/** The last sync's word, or null before one ran. */
	readonly message: string | null;
	sync(): void;
}

const KEY = Symbol("gch-sync");

export function provideSync(control: SyncControl): void {
	setContext(KEY, control);
}

/** Undefined outside Home: a page drawn on its own has no Sync. */
export function useSync(): SyncControl | undefined {
	return getContext<SyncControl | undefined>(KEY);
}
