/**
 * One thing talks to Garmin at a time, by priority:
 *
 * - **foreground**: a sync, a history walk, the scan — something a person
 *   asked for and watches. It waits for whoever holds the runner and goes
 *   next. A second one, while one holds or waits, is turned away: two syncs
 *   never queue.
 * - **page**: a page's on-view load. After any foreground waiting.
 * - **background**: a unit of backfill or a run downloading. Only when
 *   nothing at all is waiting, so it never delays anything else for longer
 *   than the unit it is in.
 *
 * The runner passes from holder to waiter inside the release, so nothing can
 * slip in between.
 *
 * Pure.
 */

export type Priority = "foreground" | "page" | "background";

const RANK: Record<Priority, number> = { foreground: 0, page: 1, background: 2 };

/** Gives the runner back. Calling it again does nothing. */
export type Release = () => void;

interface Waiter {
	priority: Priority;
	grant: (release: Release) => void;
}

export class RunnerLock {
	private holder: Priority | null = null;
	private queue: Waiter[] = [];

	/** Who holds the runner, if anyone. */
	get holding(): Priority | null {
		return this.holder;
	}

	get busy(): boolean {
		return this.holder !== null;
	}

	/** How many wait, of one priority or of any. */
	waiting(priority?: Priority): number {
		return priority ? this.queue.filter((w) => w.priority === priority).length : this.queue.length;
	}

	/**
	 * The runner, once it is yours: resolves with its release. Null at once
	 * for a foreground request while another foreground one holds or waits.
	 */
	acquire(priority: Priority): Promise<Release | null> {
		if (priority === "foreground" && (this.holder === "foreground" || this.waiting("foreground") > 0)) return Promise.resolve(null);
		const now = this.tryAcquire(priority);
		if (now) return Promise.resolve(now);
		return new Promise((resolve) => {
			const waiter: Waiter = { priority, grant: resolve };
			// After everything of its own priority or higher, ahead of everything lower.
			const at = this.queue.findIndex((w) => RANK[w.priority] > RANK[priority]);
			if (at < 0) this.queue.push(waiter);
			else this.queue.splice(at, 0, waiter);
		});
	}

	/**
	 * The runner now, or null: it is free and nothing waits ahead — nothing of
	 * the same or a higher priority, and for background nothing at all.
	 */
	tryAcquire(priority: Priority): Release | null {
		if (this.holder !== null) return null;
		if (this.queue.some((w) => RANK[w.priority] <= RANK[priority] || priority === "background")) return null;
		this.holder = priority;
		return this.releaser();
	}

	private releaser(): Release {
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const next = this.queue.shift();
			this.holder = next ? next.priority : null;
			next?.grant(this.releaser());
		};
	}
}
