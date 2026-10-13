import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { MIN_RATE, RECOVER_AFTER_MS, Throttle } from "../src/garmin/throttle";

/** A clock that only moves when the throttle waits on it. */
function clocked(limits: { rate: number; burst: number; concurrency: number }) {
	let clock = 0;
	const waits: number[] = [];
	const throttle = new Throttle({
		...limits,
		now: () => clock,
		// The clock moves a turn later, as a real timer's would: jobs already let
		// through read the time they started at, not the time of the next wait.
		wait: async (ms) => {
			waits.push(ms);
			await new Promise((r) => setImmediate(r));
			clock += ms;
		},
	});
	return { throttle, waits, now: () => clock, advance: (ms: number) => void (clock += ms) };
}

/** Runs `n` jobs that each take no time, and returns the clock at each start. */
async function starts(throttle: Throttle, now: () => number, n: number): Promise<number[]> {
	const at: number[] = [];
	await Promise.all(Array.from({ length: n }, () => throttle.run(async () => void at.push(now()))));
	return at;
}

describe("Throttle", () => {
	it("lets a burst through at once, then paces the rest at the rate", async () => {
		const { throttle, now } = clocked({ rate: 4, burst: 3, concurrency: 10 });
		const at = await starts(throttle, now, 7);
		assert.deepEqual(at.slice(0, 3), [0, 0, 0]);
		// Four a second after the burst: one every 250ms.
		assert.deepEqual(at.slice(3), [250, 500, 750, 1000]);
	});

	it("never has more than `concurrency` in flight", async () => {
		const { throttle } = clocked({ rate: 1000, burst: 1000, concurrency: 2 });
		let inFlight = 0;
		let peak = 0;
		let finished = 0;
		const releases: Array<() => void> = [];
		const jobs = Array.from({ length: 5 }, () =>
			throttle.run(async () => {
				inFlight += 1;
				peak = Math.max(peak, inFlight);
				await new Promise<void>((done) => releases.push(done));
				inFlight -= 1;
				finished += 1;
			}),
		);
		while (finished < 5) {
			await new Promise((r) => setImmediate(r));
			releases.shift()?.();
		}
		await Promise.all(jobs);
		assert.equal(peak, 2);
	});

	it("pauses everything for as long as a 429 asked, and halves the rate", async () => {
		const { throttle, now } = clocked({ rate: 4, burst: 1, concurrency: 10 });
		await starts(throttle, now, 1);
		throttle.slowDown(30_000);
		assert.equal(throttle.rate, 2);
		const at = await starts(throttle, now, 2);
		assert.ok(at[0]! >= 30_000, `started at ${at[0]}`);
		// Half the rate: 500ms apart.
		assert.equal(at[1]! - at[0]!, 500);
	});

	it("halves the rate once for a burst of 429s, not once per request", () => {
		const { throttle } = clocked({ rate: 8, burst: 8, concurrency: 8 });
		for (let i = 0; i < 8; i++) throttle.slowDown(10_000);
		assert.equal(throttle.rate, 4);
	});

	it("does not slow below MIN_RATE", () => {
		const { throttle, advance } = clocked({ rate: 1, burst: 1, concurrency: 1 });
		for (let i = 0; i < 10; i++) {
			throttle.slowDown(1);
			advance(2);
		}
		assert.equal(throttle.rate, MIN_RATE);
	});

	it("climbs back a quarter at a time after a clean spell", () => {
		const { throttle, advance } = clocked({ rate: 8, burst: 8, concurrency: 8 });
		throttle.slowDown(1000);
		assert.equal(throttle.rate, 4);
		throttle.succeeded();
		assert.equal(throttle.rate, 4, "too soon to climb");
		advance(RECOVER_AFTER_MS);
		throttle.succeeded();
		assert.equal(throttle.rate, 6);
		advance(RECOVER_AFTER_MS);
		throttle.succeeded();
		advance(RECOVER_AFTER_MS);
		throttle.succeeded();
		assert.equal(throttle.rate, 8, "never past the limit");
	});

	it("takes new limits at once", async () => {
		const { throttle, now } = clocked({ rate: 1, burst: 1, concurrency: 1 });
		throttle.setLimits({ rate: 10, burst: 1, concurrency: 1 });
		assert.equal(throttle.rate, 10);
		const at = await starts(throttle, now, 3);
		assert.deepEqual(at, [0, 100, 200]);
	});
});
