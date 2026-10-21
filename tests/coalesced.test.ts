import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Coalesced } from "../src/ui/coalesced";

/** A clock that moves only when told to. */
function manualClock() {
	let t = 0;
	const waiting: Array<{ at: number; done: () => void }> = [];
	return {
		now: () => t,
		wait: (ms: number) => new Promise<void>((done) => waiting.push({ at: t + ms, done })),
		async advance(ms: number) {
			t += ms;
			for (const w of waiting.filter((w) => w.at <= t)) {
				waiting.splice(waiting.indexOf(w), 1);
				w.done();
			}
			await settle();
		},
	};
}

const settle = () => new Promise<void>((done) => setImmediate(done));

describe("a refresh run one at a time", () => {
	it("runs a burst of calls as two runs: one now, and one after it that sees the rest", async () => {
		const clock = manualClock();
		const starts: number[] = [];
		let finish!: () => void;
		const refresh = new Coalesced(() => {
			starts.push(clock.now());
			return new Promise<void>((done) => (finish = done));
		}, 3_000, clock);

		const first = refresh.run();
		await settle();
		assert.deepEqual(starts, [0]);
		// Three more while it runs: one more run, after it.
		const calls = [refresh.run(), refresh.run(), refresh.run()];
		assert.equal(calls[0], calls[1]);
		assert.equal(calls[1], calls[2]);
		finish();
		await first;
		await settle();
		assert.deepEqual(starts, [0], "the next run waits out the gap");
		await clock.advance(3_000);
		assert.deepEqual(starts, [0, 3_000]);
		finish();
		await calls[0];
	});

	it("runs at once when the last run is more than the gap ago, and keeps going after a failure", async () => {
		const clock = manualClock();
		let runs = 0;
		const refresh = new Coalesced(async () => {
			runs += 1;
			if (runs === 1) throw new Error("vault busy");
		}, 3_000, clock);
		await assert.rejects(refresh.run(), /vault busy/);
		await clock.advance(5_000);
		await refresh.run();
		assert.equal(runs, 2);
	});
});
