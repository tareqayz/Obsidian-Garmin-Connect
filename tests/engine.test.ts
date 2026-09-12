import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GarminApiError, GarminAuthError, GarminRateLimitError } from "../src/garmin/errors";
import {
	dateRange,
	lastNDays,
	syncRange,
	type NoteTarget,
	type SyncOptions,
	type SyncSource,
	type WriteOutcome,
} from "../src/sync/engine";
import { ALL_GROUPS } from "../src/sync/metrics";
import type { Activity } from "../src/garmin/endpoints";

/* ------------------------------------------------------------------ */
/*  Doubles                                                            */
/* ------------------------------------------------------------------ */

class FakeSource implements SyncSource {
	calls: string[] = [];
	steps = 8000;
	failWith: Record<string, unknown> = {};
	activityList: Activity[] = [];
	activityPages = 0;

	private guard(name: string, date?: string) {
		this.calls.push(date ? `${name}:${date}` : name);
		const err = this.failWith[name];
		if (err) throw err;
	}

	async dailySummary(date: string) {
		this.guard("dailySummary", date);
		return { calendarDate: date, totalSteps: this.steps };
	}
	async sleep(date: string) {
		this.guard("sleep", date);
		return { dailySleepDTO: { sleepTimeSeconds: 27000 } };
	}
	async hrv(date: string) {
		this.guard("hrv", date);
		return { hrvSummary: { lastNightAvg: 42 } };
	}
	async trainingReadiness(date: string) {
		this.guard("trainingReadiness", date);
		return [{ score: 71, level: "HIGH" }];
	}
	async activities(start = 0, limit = 50) {
		this.guard(`activities:${start}:${limit}`);
		this.activityPages += 1;
		return this.activityList;
	}
}

class FakeTarget implements NoteTarget {
	written = new Map<string, Record<string, unknown>>();
	outcome: WriteOutcome = "written";
	throwFor: string | null = null;

	constructor(private present: Set<string> = new Set()) {}

	exists(date: string): boolean {
		return this.present.has(date);
	}

	async write(date: string, properties: Record<string, unknown>): Promise<WriteOutcome> {
		if (this.throwFor === date) throw new Error("disk on fire");
		this.written.set(date, properties);
		return this.outcome;
	}
}

const options = (over: Partial<SyncOptions> = {}): SyncOptions => ({
	from: "2026-09-10",
	to: "2026-09-12",
	groups: ["activity"],
	units: "metric",
	prefix: "garmin_",
	requireExistingNote: true,
	wait: async () => {},
	...over,
});

/* ------------------------------------------------------------------ */
/*  Dates                                                             */
/* ------------------------------------------------------------------ */

describe("dateRange", () => {
	it("is inclusive and newest first, so a cut-short sync covered the recent days", () => {
		assert.deepEqual(dateRange("2026-09-10", "2026-09-12"), [
			"2026-09-12",
			"2026-09-11",
			"2026-09-10",
		]);
	});

	it("handles a single day", () => {
		assert.deepEqual(dateRange("2026-09-12", "2026-09-12"), ["2026-09-12"]);
	});

	it("crosses a month and a DST boundary without losing or duplicating a day", () => {
		assert.deepEqual(dateRange("2026-10-30", "2026-11-02"), [
			"2026-11-02",
			"2026-11-01",
			"2026-10-31",
			"2026-10-30",
		]);
	});

	it("is empty when the range is inverted", () => {
		assert.deepEqual(dateRange("2026-09-12", "2026-09-10"), []);
	});
});

describe("lastNDays", () => {
	it("counts today as one of the days", () => {
		assert.deepEqual(lastNDays(3, "2026-09-12"), { from: "2026-09-10", to: "2026-09-12" });
		assert.deepEqual(lastNDays(1, "2026-09-12"), { from: "2026-09-12", to: "2026-09-12" });
	});
});

/* ------------------------------------------------------------------ */
/*  Syncing                                                            */
/* ------------------------------------------------------------------ */

describe("syncRange", () => {
	it("skips days with no daily note without spending a request", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12"]));
		const report = await syncRange(source, target, options());

		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 1);
		assert.ok(source.calls.includes("dailySummary:2026-09-12"));
		assert.equal(report.skipped, 2);
		assert.equal(report.written, 1);
	});

	it("makes no requests at all when nothing in the range has a note", async () => {
		const source = new FakeSource();
		const report = await syncRange(source, new FakeTarget(), options());
		assert.deepEqual(source.calls, []);
		assert.equal(report.requests, 0);
		assert.equal(report.skipped, 3);
	});

	it("writes the mapped properties", async () => {
		const target = new FakeTarget(new Set(["2026-09-12"]));
		await syncRange(new FakeSource(), target, options());
		assert.deepEqual(target.written.get("2026-09-12"), { garmin_steps: 8000 });
	});

	it("counts unchanged days apart from written ones", async () => {
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11"]));
		target.outcome = "unchanged";
		const report = await syncRange(new FakeSource(), target, options());
		assert.equal(report.unchanged, 2);
		assert.equal(report.written, 0);
	});

	it("reports a day as no-data instead of writing an empty note", async () => {
		const source = new FakeSource();
		source.steps = -1; // Garmin's "not measured"
		const target = new FakeTarget(new Set(["2026-09-12"]));
		const report = await syncRange(source, target, options());

		assert.equal(target.written.size, 0);
		assert.equal(report.days.find((d) => d.date === "2026-09-12")!.status, "no-data");
	});

	it("keeps the rest of a day when one endpoint fails", async () => {
		const source = new FakeSource();
		source.failWith.sleep = new GarminApiError("sleep: HTTP 500", 500, "");
		const target = new FakeTarget(new Set(["2026-09-12"]));

		const report = await syncRange(
			source,
			target,
			options({ from: "2026-09-12", groups: ["activity", "sleep"] }),
		);

		assert.equal(report.written, 1);
		assert.deepEqual(target.written.get("2026-09-12"), { garmin_steps: 8000 });
		const day = report.days[0]!;
		assert.match(day.warnings!.join(), /sleep/);
	});

	it("abandons the whole range on a 429 rather than hammering", async () => {
		const source = new FakeSource();
		source.failWith.dailySummary = new GarminRateLimitError("rate limited", 60);
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));

		const report = await syncRange(source, target, options());

		assert.match(report.stoppedEarly!, /rate limited/);
		// One day attempted, then stopped — not three.
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 1);
	});

	it("abandons the range when the session dies mid-sync", async () => {
		const source = new FakeSource();
		source.failWith.dailySummary = new GarminAuthError("token rejected");
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11"]));

		const report = await syncRange(source, target, options());
		assert.match(report.stoppedEarly!, /token rejected/);
	});

	it("records a write failure without abandoning the range", async () => {
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11"]));
		target.throwFor = "2026-09-12";
		const report = await syncRange(new FakeSource(), target, options());

		assert.equal(report.failed, 1);
		assert.equal(report.written, 1);
		assert.equal(report.days.find((d) => d.date === "2026-09-12")!.status, "failed");
	});

	it("stops between days when asked", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		let seen = 0;
		const report = await syncRange(
			source,
			target,
			options({ shouldStop: () => seen++ >= 1 }),
		);
		assert.equal(report.stoppedEarly, "cancelled");
		assert.equal(report.written, 1);
	});

	it("reports days oldest first even though it fetches newest first", async () => {
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		const report = await syncRange(new FakeSource(), target, options());
		assert.deepEqual(
			report.days.map((d) => d.date),
			["2026-09-10", "2026-09-11", "2026-09-12"],
		);
	});

	it("does nothing for an inverted range", async () => {
		const source = new FakeSource();
		const report = await syncRange(
			source,
			new FakeTarget(),
			options({ from: "2026-09-12", to: "2026-09-10" }),
		);
		assert.deepEqual(source.calls, []);
		assert.equal(report.days.length, 0);
	});
});

describe("syncRange — workouts", () => {
	it("fetches the activity list once for the whole range, not once per day", async () => {
		const source = new FakeSource();
		source.activityList = [
			{ startTimeLocal: "2026-09-12 07:00:00", activityName: "Run" },
			{ startTimeLocal: "2026-09-10 18:00:00", activityName: "Ride" },
		];
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));

		await syncRange(source, target, options({ groups: ["workouts"] }));

		assert.equal(source.activityPages, 1, "one page covered the range");
		assert.equal((target.written.get("2026-09-12")!.garmin_workouts as unknown[]).length, 1);
		assert.ok(!target.written.has("2026-09-11"));
	});

	it("carries on without workouts when the activity list fails", async () => {
		const source = new FakeSource();
		source.failWith["activities:0:50"] = new GarminApiError("activities: HTTP 500", 500, "");
		const target = new FakeTarget(new Set(["2026-09-12"]));

		const report = await syncRange(
			source,
			target,
			options({ from: "2026-09-12", groups: ["activity", "workouts"] }),
		);
		assert.equal(report.written, 1);
		assert.deepEqual(target.written.get("2026-09-12"), { garmin_steps: 8000 });
	});

	it("stops before any day when the activity list is rate limited", async () => {
		const source = new FakeSource();
		source.failWith["activities:0:50"] = new GarminRateLimitError("rate limited");
		const target = new FakeTarget(new Set(["2026-09-12"]));

		const report = await syncRange(source, target, options({ groups: ALL_GROUPS }));
		assert.match(report.stoppedEarly!, /rate limited/);
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 0);
	});
});

describe("syncRange — request budget", () => {
	it("counts the requests it made", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11"]));
		const report = await syncRange(
			source,
			target,
			options({ groups: ["activity", "sleep", "hrv"] }),
		);
		// 3 endpoints × 2 days.
		assert.equal(report.requests, 6);
	});

	it("pauses between days, but not after the last one", async () => {
		const waits: number[] = [];
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		await syncRange(
			new FakeSource(),
			target,
			options({ pauseBetweenDays: 250, wait: async (ms) => void waits.push(ms) }),
		);
		assert.deepEqual(waits, [250, 250]);
	});
});
