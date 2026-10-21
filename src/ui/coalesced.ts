/**
 * A refresh that runs one at a time, and at most every `gapMs`. A call while
 * one runs asks for one more run after it; calls before that one starts join
 * it. Each call's promise settles once a run that started after the call has
 * ended, so it has seen whatever change made the call.
 */
export class Coalesced {
	private current: Promise<void> | null = null;
	private next: Promise<void> | null = null;
	private last = Number.NEGATIVE_INFINITY;

	constructor(
		private readonly task: () => Promise<void>,
		private readonly gapMs: number,
		private readonly clock: { now(): number; wait(ms: number): Promise<void> } = {
			now: () => Date.now(),
			wait: (ms) => new Promise((done) => window.setTimeout(done, ms)),
		},
	) {}

	run(): Promise<void> {
		// Not started yet: it will read what changed since, so the call joins it.
		if (this.next) return this.next;
		const before = this.current;
		const run: Promise<void> = Promise.resolve().then(async () => {
			if (before) await before.catch(() => undefined);
			const gap = this.last + this.gapMs - this.clock.now();
			if (gap > 0) await this.clock.wait(gap);
			this.next = null;
			this.current = run;
			this.last = this.clock.now();
			try {
				await this.task();
			} finally {
				if (this.current === run) this.current = null;
			}
		});
		this.next = run;
		return run;
	}
}
