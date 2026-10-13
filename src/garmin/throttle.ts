/**
 * One pace for every request the plugin makes to Garmin.
 *
 * Garmin's budget is per account, not per feature: a sync, a history walk and a
 * run's page download all draw on it. So the pace is kept here, on the client,
 * rather than as pauses sprinkled between days and windows — a token bucket
 * (requests per second, with a small burst) and a cap on requests in flight.
 *
 * When Garmin answers 429 the whole client stops until it said to come back,
 * the rate halves, and it climbs back a step at a time once requests have gone
 * through cleanly for a while (additive increase, multiplicative decrease).
 */

export interface ThrottleLimits {
	/** Sustained requests per second. */
	rate: number;
	/** Requests the bucket holds: how many may start at once after a quiet spell. */
	burst: number;
	/** Requests in flight at once. */
	concurrency: number;
}

export interface ThrottleOptions extends ThrottleLimits {
	now?: () => number;
	wait?: (ms: number) => Promise<void>;
}

/** Never slowed below this: one request every four seconds still finishes a sync. */
export const MIN_RATE = 0.25;

/** How long requests must go through cleanly before the rate climbs a step. */
export const RECOVER_AFTER_MS = 60_000;

export class Throttle {
	private limits: ThrottleLimits;
	/** The rate in force: `limits.rate`, or less after a 429. */
	private current: number;
	private tokens: number;
	private refilledAt: number;
	private inFlight = 0;
	private pausedUntil = 0;
	private lastChange = 0;
	private readonly queue: Array<() => void> = [];
	private timer = false;
	private readonly now: () => number;
	private readonly wait: (ms: number) => Promise<void>;

	constructor(opts: ThrottleOptions) {
		this.now = opts.now ?? Date.now;
		this.wait = opts.wait ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
		this.limits = { rate: opts.rate, burst: opts.burst, concurrency: opts.concurrency };
		this.current = opts.rate;
		this.tokens = opts.burst;
		this.refilledAt = this.now();
	}

	/** For the settings screen: a new speed takes effect on the next request. */
	setLimits(limits: ThrottleLimits): void {
		// Not slowed by a 429: the new rate, whatever it is. Slowed: stay slowed.
		const slowed = this.current < this.limits.rate;
		this.current = slowed ? Math.min(this.current, limits.rate) : limits.rate;
		this.limits = { ...limits };
		this.tokens = Math.min(this.tokens, limits.burst);
		this.pump();
	}

	get rate(): number {
		return this.current;
	}

	/** Epoch ms until which nothing is sent, or 0. */
	get resumesAt(): number {
		return this.pausedUntil > this.now() ? this.pausedUntil : 0;
	}

	/** Runs `job` when the pace allows, holding a slot for as long as it runs. */
	async run<T>(job: () => Promise<T>): Promise<T> {
		await new Promise<void>((start) => {
			this.queue.push(start);
			this.pump();
		});
		try {
			return await job();
		} finally {
			this.inFlight -= 1;
			this.pump();
		}
	}

	/**
	 * Garmin said 429: stop everything for `pauseMs`, and halve the rate. The
	 * other requests that were in flight come back 429 too; they extend the pause
	 * but do not halve the rate again, or one burst would floor it.
	 */
	slowDown(pauseMs: number): void {
		const now = this.now();
		if (now >= this.pausedUntil) {
			this.current = Math.max(MIN_RATE, this.current / 2);
			this.lastChange = now;
		}
		this.pausedUntil = Math.max(this.pausedUntil, now + pauseMs);
		this.tokens = 0;
	}

	/** A request went through: after a clean spell, climb a quarter of the way back. */
	succeeded(): void {
		if (this.current >= this.limits.rate) return;
		if (this.now() - this.lastChange < RECOVER_AFTER_MS) return;
		this.current = Math.min(this.limits.rate, this.current + this.limits.rate / 4);
		this.lastChange = this.now();
	}

	private refill(): void {
		const now = this.now();
		this.tokens = Math.min(this.limits.burst, this.tokens + ((now - this.refilledAt) / 1000) * this.current);
		this.refilledAt = now;
	}

	private pump(): void {
		while (this.queue.length && this.inFlight < this.limits.concurrency) {
			const now = this.now();
			if (now < this.pausedUntil) return this.later(this.pausedUntil - now);
			this.refill();
			if (this.tokens < 1) return this.later(Math.ceil(((1 - this.tokens) / this.current) * 1000));
			this.tokens -= 1;
			this.inFlight += 1;
			this.queue.shift()!();
		}
	}

	private later(ms: number): void {
		if (this.timer) return;
		this.timer = true;
		void this.wait(Math.max(1, ms)).then(() => {
			this.timer = false;
			this.pump();
		});
	}
}
