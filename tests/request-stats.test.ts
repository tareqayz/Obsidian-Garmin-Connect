import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { RequestStats, type RequestSample } from "../src/garmin/request-stats";

const sample = (at: number, ms = 200): RequestSample => ({ endpoint: "/x", status: 200, ms, attempt: 1, at });

describe("request stats", () => {
	it("keeps the newest samples in a ring", () => {
		const stats = new RequestStats(3);
		for (const at of [1, 2, 3, 4, 5]) stats.record(sample(at));
		assert.deepEqual(stats.since().map((s) => s.at), [3, 4, 5]);
	});

	it("finds what started since a moment, an answer that came back late included", () => {
		const stats = new RequestStats();
		stats.record(sample(1_000));
		stats.record(sample(10_000));
		// Started at 9,000 but answered last.
		stats.record(sample(9_000, 5_000));
		assert.deepEqual(stats.since(5_000).map((s) => s.at), [10_000, 9_000]);
		assert.equal(stats.summary(5_000).count, 2);
		stats.clear();
		assert.deepEqual(stats.since(), []);
	});
});
