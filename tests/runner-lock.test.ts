import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { RunnerLock, type Release } from "../src/sync/runner-lock";

/** Lets the granted promises settle. */
const settle = () => new Promise<void>((done) => setTimeout(done, 0));

describe("runner lock", () => {
	it("gives the runner to one holder at a time, and back on release", async () => {
		const lock = new RunnerLock();
		const release = (await lock.acquire("background"))!;
		assert.equal(lock.holding, "background");
		assert.equal(lock.tryAcquire("page"), null);
		release();
		assert.equal(lock.busy, false);
		// A second call of the same release does nothing.
		const next = lock.tryAcquire("page")!;
		release();
		assert.equal(lock.holding, "page");
		next();
	});

	it("lets a sync wait for a background unit and go before the pages and units queued behind it", async () => {
		const lock = new RunnerLock();
		const order: string[] = [];
		const unit = lock.tryAcquire("background")!;
		const waits = [
			lock.acquire("page").then((r) => (order.push("page"), r)),
			lock.acquire("background").then((r) => (order.push("background"), r)),
			lock.acquire("foreground").then((r) => (order.push("foreground"), r)),
		];
		assert.equal(lock.waiting(), 3);
		unit();
		await settle();
		assert.deepEqual(order, ["foreground"]);
		const releases = (await Promise.race([waits[2]!])) as Release;
		releases();
		await settle();
		assert.deepEqual(order, ["foreground", "page"]);
		((await waits[0]!) as Release)();
		await settle();
		assert.deepEqual(order, ["foreground", "page", "background"]);
		((await waits[1]!) as Release)();
		assert.equal(lock.busy, false);
	});

	it("turns away a second sync while one holds or waits, but never a page or a unit", async () => {
		const lock = new RunnerLock();
		const sync = (await lock.acquire("foreground"))!;
		assert.equal(await lock.acquire("foreground"), null);
		const page = lock.acquire("page");
		sync();
		const pageRelease = (await page)!;
		const waiting = lock.acquire("foreground");
		assert.equal(await lock.acquire("foreground"), null);
		pageRelease();
		((await waiting)!)();
		assert.equal(lock.busy, false);
	});

	it("starts a background unit only when nothing at all waits", async () => {
		const lock = new RunnerLock();
		const page = lock.tryAcquire("page")!;
		const queued = lock.acquire("page");
		page();
		// The queued page holds the runner now; nothing can start beside it.
		assert.equal(lock.tryAcquire("background"), null);
		const second = (await queued)!;
		const another = lock.acquire("page");
		second();
		assert.equal(lock.tryAcquire("background"), null);
		((await another)!)();
		assert.ok(lock.tryAcquire("background"));
	});

	it("hands the runner on inside the release, so nothing slips in between", async () => {
		const lock = new RunnerLock();
		const first = lock.tryAcquire("background")!;
		const sync = lock.acquire("foreground");
		first();
		// Before the waiter's promise settles, the runner is already its.
		assert.equal(lock.holding, "foreground");
		assert.equal(lock.tryAcquire("page"), null);
		((await sync)!)();
	});
});
