import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { UNINSTALL_CHECKS, watchForUninstall } from "../src/uninstall-watch";

/** Runs the watch with timers that fire in order, the folder there at the first `present` checks. */
async function watch(present: number, fail = false): Promise<{ checks: number; gone: number; waits: number[] }> {
	const timers: Array<() => void> = [];
	const waits: number[] = [];
	let checks = 0;
	let gone = 0;
	watchForUninstall({
		exists: async () => {
			checks += 1;
			if (fail) throw new Error("adapter gone");
			return checks <= present;
		},
		onGone: () => (gone += 1),
		setTimer: (run, ms) => {
			waits.push(ms);
			timers.push(run);
		},
	});
	for (let i = 0; i < timers.length; i++) {
		timers[i]!();
		await new Promise((done) => setTimeout(done, 0));
	}
	return { checks, gone, waits };
}

describe("watching for an uninstall", () => {
	it("prompts once when the plugin's folder is gone at the first look", async () => {
		assert.deepEqual(await watch(0), { checks: 1, gone: 1, waits: [1500] });
	});

	it("keeps looking while the folder is there, and prompts once it goes", async () => {
		assert.deepEqual(await watch(1), { checks: 2, gone: 1, waits: [1500, 2500] });
		assert.deepEqual(await watch(2), { checks: 3, gone: 1, waits: [1500, 2500, 6000] });
	});

	it("never prompts for a disable or an update, which leave the folder", async () => {
		const got = await watch(99);
		assert.deepEqual(got, { checks: UNINSTALL_CHECKS.length, gone: 0, waits: [1500, 2500, 6000] });
	});

	it("gives up quietly when the vault cannot answer", async () => {
		assert.deepEqual(await watch(0, true), { checks: 1, gone: 0, waits: [1500] });
	});
});
