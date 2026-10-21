/**
 * Time that moves only when a test says so: `setTimeout` queues on a heap of
 * its own, and `runUntil` lets every promise settle before it jumps to the
 * next timer. A download that takes an hour of Garmin's time runs in moments.
 *
 * `install` puts it where the plugin's code looks — `window.setTimeout`,
 * `window.clearTimeout` and `Date.now` — and gives the real ones back after.
 */
export class VirtualClock {
	private at: number;
	private seq = 0;
	private timers: Array<{ id: number; at: number; run: () => void }> = [];
	private restore: (() => void) | null = null;

	constructor(start: number) {
		this.at = start;
	}

	readonly now = (): number => this.at;

	readonly setTimeout = (run: () => void, ms = 0): number => {
		const id = ++this.seq;
		this.timers.push({ id, at: this.at + Math.max(0, ms), run });
		return id;
	};

	readonly clearTimeout = (id: number | undefined): void => {
		this.timers = this.timers.filter((t) => t.id !== id);
	};

	readonly wait = (ms: number): Promise<void> => new Promise((done) => this.setTimeout(done, ms));

	install(): void {
		const g = globalThis as unknown as { window?: unknown };
		const hadWindow = "window" in g;
		const window = g.window;
		const dateNow = Date.now;
		g.window = { ...(typeof window === "object" && window ? window : {}), setTimeout: this.setTimeout, clearTimeout: this.clearTimeout };
		Date.now = this.now;
		this.restore = () => {
			if (hadWindow) g.window = window;
			else delete g.window;
			Date.now = dateNow;
		};
	}

	uninstall(): void {
		this.restore?.();
		this.restore = null;
	}

	/**
	 * Settles every promise, then moves to the next timer and runs it, until
	 * `done` says so. Throws when nothing is left to wait for, or past `limit`
	 * ms of virtual time.
	 */
	async runUntil(done: () => boolean, limit: number): Promise<void> {
		const end = this.at + limit;
		for (;;) {
			await settle();
			if (done()) return;
			this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
			const next = this.timers.shift();
			if (!next) throw new Error("nothing left to wait for, and not done");
			if (next.at > end) throw new Error(`not done after ${limit} ms`);
			this.at = Math.max(this.at, next.at);
			next.run();
		}
	}
}

/** Every pending promise, and every one they start, settled. */
async function settle(): Promise<void> {
	for (let i = 0; i < 3; i++) await new Promise((done) => setImmediate(done));
}
