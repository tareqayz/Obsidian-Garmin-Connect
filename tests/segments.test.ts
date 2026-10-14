import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GarminRateLimitError } from "../src/garmin/errors";
import { segmentWindows, walkInSegments, type Segment } from "../src/sync/segments";

const segment = (over: Partial<Segment> = {}): Segment => ({ requests: 14, rows: 300, complete: false, emptyStreak: 0, ...over });

describe("history walks in segments", () => {
	it("sizes a segment to a year of windows", () => {
		assert.deepEqual([28, 31, 365, 367, 3660].map(segmentWindows), [14, 12, 1, 1, 1]);
	});

	it("walks segment after segment until one finds where the history starts, carrying the empty streak", async () => {
		const streaks: number[] = [];
		const steps = [segment({ emptyStreak: 1 }), segment({ rows: 10, emptyStreak: 3 }), segment({ rows: 0, complete: true, emptyStreak: 4 })];
		const got = await walkInSegments(async (emptyStreak) => (streaks.push(emptyStreak), steps.shift()!));
		assert.deepEqual(streaks, [0, 1, 3]);
		assert.deepEqual(got, { requests: 42, rows: 310, complete: true, emptyStreak: 4 });
	});

	it("stops at a failed segment, keeping what the segments before it merged", async () => {
		const fatal = new GarminRateLimitError("slow down", 30);
		let calls = 0;
		const got = await walkInSegments(async () => (++calls === 2 ? segment({ requests: 3, rows: 20, fatal }) : segment()));
		assert.equal(calls, 2);
		assert.equal(got.fatal, fatal);
		assert.deepEqual([got.requests, got.rows, got.complete], [17, 320, false]);
	});

	it("stops once a segment has nothing to ask, and after the segment cap", async () => {
		let calls = 0;
		await walkInSegments(async () => (++calls, segment({ requests: 0, rows: 0 })));
		assert.equal(calls, 1);
		calls = 0;
		await walkInSegments(async () => (++calls, segment()), 3);
		assert.equal(calls, 3);
	});
});
