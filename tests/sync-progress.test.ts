import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { etaSeconds, formatEta, fraction, type SyncProgress } from "../src/sync/progress";

const run = (over: Partial<SyncProgress> = {}): SyncProgress => ({
	done: 0,
	total: 0,
	date: null,
	eta: null,
	...over,
});

describe("fraction", () => {
	it("is the share of the range that is done", () => {
		assert.equal(fraction(run({ done: 12, total: 30 })), 0.4);
	});

	it("is zero while the total is unknown", () => {
		// The engine only counts the due days once it has worked them out, and a
		// bar drawn from a zero total would sit at 100% or NaN.
		assert.equal(fraction(run({ done: 0, total: 0 })), 0);
		assert.equal(fraction(run({ done: 3, total: 0 })), 0);
	});

	it("clamps, so a miscount cannot overfill the bar", () => {
		assert.equal(fraction(run({ done: 40, total: 30 })), 1);
		assert.equal(fraction(run({ done: -2, total: 30 })), 0);
	});
});

describe("etaSeconds", () => {
	it("extrapolates from the pace so far", () => {
		// 12 days in 12s is a second a day, so the remaining 18 take 18s.
		assert.equal(etaSeconds(12_000, 12, 30), 18);
	});

	it("says nothing when there is no pace to go on", () => {
		assert.equal(etaSeconds(0, 0, 30), null);
		assert.equal(etaSeconds(5_000, 30, 30), null);
		assert.equal(etaSeconds(5_000, 3, 0), null);
	});

	it("never counts down to zero while days are left", () => {
		assert.equal(etaSeconds(1, 29, 30), 1);
	});
});

describe("formatEta", () => {
	it("rounds hard rather than claiming the second", () => {
		assert.equal(formatEta(18), "about 20s left");
		assert.equal(formatEta(47), "about 45s left");
		assert.equal(formatEta(240), "about 4m left");
	});

	it("stops counting once the end is in sight", () => {
		assert.equal(formatEta(4), "nearly done");
	});

	it("is empty when there is no estimate, so callers can join on it", () => {
		assert.equal(formatEta(null), "");
	});
});
