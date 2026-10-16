import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { UNINSTALL_CHECKS, watchForUninstall } from "../src/uninstall-watch";

/**
 * Runs the watch with timers that fire in order: the folder there at the first
 * `present` checks, or as `present` lists check by check.
 */
async function watch(present: number | boolean[], fail = false): Promise<{ checks: number; gone: number; waits: number[] }> {
	const timers: Array<() => void> = [];
	const waits: number[] = [];
	let checks = 0;
	let gone = 0;
	watchForUninstall({
		exists: async () => {
			checks += 1;
			if (fail) throw new Error("adapter gone");
			return Array.isArray(present) ? (present[checks - 1] ?? true) : checks <= present;
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
	it("prompts once the plugin's folder is gone at two looks in a row", async () => {
		assert.deepEqual(await watch(0), { checks: 2, gone: 1, waits: [1500, 2500] });
	});

	it("keeps looking while the folder is there, and prompts once it has gone for two looks", async () => {
		assert.deepEqual(await watch(1), { checks: 3, gone: 1, waits: [1500, 2500, 6000] });
		assert.deepEqual(await watch(2), { checks: 4, gone: 1, waits: [1500, 2500, 6000, 5000] });
	});

	it("doesn't ask over one miss — a sync service rewriting the folder — or a miss at the last look", async () => {
		assert.deepEqual(await watch([false, true, true, true]), { checks: 4, gone: 0, waits: [1500, 2500, 6000, 5000] });
		assert.deepEqual(await watch(3), { checks: 4, gone: 0, waits: [1500, 2500, 6000, 5000] });
	});

	it("never prompts for a disable or an update, which leave the folder", async () => {
		const got = await watch(99);
		assert.deepEqual(got, { checks: UNINSTALL_CHECKS.length, gone: 0, waits: [1500, 2500, 6000, 5000] });
	});

	it("gives up quietly when the vault cannot answer", async () => {
		assert.deepEqual(await watch(0, true), { checks: 1, gone: 0, waits: [1500] });
	});
});
