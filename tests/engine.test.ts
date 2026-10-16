import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GarminApiError, GarminAuthError, GarminBlockedError, GarminRateLimitError, GarminRefreshError } from "../src/garmin/errors";
import {
	RANGE_CHUNK_DAYS,
	chunkRange,
	dateRange,
	fetchAllActivities,
	fetchDailyStatsHistory,
	fetchSleepHistory,
	lastNDays,
	MAX_RECENT_DAYS,
	recentRange,
	syncRange,
	type ActivitySink,
	type DailyStatsSink,
	type SleepSink,
	type DayTarget,
	type SyncOptions,
	type SeriesTarget,
	type SyncSource,
	type WriteOutcome,
} from "../src/sync/engine";
import type { DailyStatsBatch } from "../src/sync/daily-stats";
import type { SleepBatch } from "../src/sync/sleep-index";
import { parseSeries, serializeSeries, type DaySeries } from "../src/sync/intraday";
import { defineIntraday } from "../src/sync/intraday-registry";
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
	rangeCalls = 0;
	maxMetricsRows: Array<{
		calendarDate?: string;
		generic: { calendarDate?: string; vo2MaxPreciseValue: number };
	}> = [];
	raceRows: Array<{ calendarDate: string; time5K: number }> = [];

	private guard(name: string, date?: string) {
		this.calls.push(date ? `${name}:${date}` : name);
		const err = this.failWith[name];
		if (err) throw err;
	}

	async dailySummary(date: string): Promise<{ calendarDate: string; totalSteps: number | null }> {
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
	async trainingStatus(date: string) {
		this.guard("trainingStatus", date);
		return { acuteTrainingLoadDTO: { dailyTrainingLoadAcute: 900 } };
	}
	async bodyComposition(date: string) {
		this.guard("bodyComposition", date);
		return { totalAverage: { weight: 78000, bmi: 23.4 } };
	}
	async enduranceScore(date: string) {
		this.guard("enduranceScore", date);
		return { calendarDate: date, overallScore: 7100 };
	}
	async fitnessAge(date: string) {
		this.guard("fitnessAge", date);
		return { fitnessAge: 34.6, chronologicalAge: 40 };
	}
	async stress(date: string) {
		this.guard("stress", date);
		return {
			stressValuesArray: [
				[1_000, 20],
				[2_000, -1],
			],
			bodyBatteryValuesArray: [[1_000, "MEASURED", 60, 2.0]],
		};
	}
	async heartRate(date: string) {
		this.guard("heartRate", date);
		return {
			heartRateValues: [
				[1_000, 58],
				[2_000, 61],
				[3_000, null],
			] as Array<[number, number | null]>,
		};
	}
	async stepsChart(date: string) {
		this.guard("stepsChart", date);
		return [{ startGMT: "2026-09-12T08:00:00.0", endGMT: "2026-09-12T08:15:00.0", steps: 412 }];
	}
	async bodyBatteryEvents(date: string) {
		this.guard("bodyBatteryEvents", date);
		return [];
	}
	async floorsChart(date: string) {
		this.guard("floorsChart", date);
		return {
			floorValuesArray: [
				["2026-09-12T08:00:00.0", "2026-09-12T08:15:00.0", 2, 0],
				["2026-09-12T08:15:00.0", "2026-09-12T08:30:00.0", 0, 0],
			],
		};
	}
	async intensityMinutesChart(date: string) {
		this.guard("intensityMinutesChart", date);
		return { startDayMinutes: 40, endDayMinutes: 70, imValuesArray: [[1_000, 30]] };
	}
	/** Days the range endpoints know about, keyed by date. */
	stats: Record<string, { steps: number; up?: number; moderate?: number }> = {};
	statCalls: string[] = [];
	private inRange(start: string, end: string) {
		return Object.keys(this.stats)
			.filter((d) => d >= start && d <= end)
			.sort();
	}
	async dailyStepStats(start: string, end: string) {
		this.guard("dailyStepStats");
		this.statCalls.push(`steps:${start}:${end}`);
		return this.inRange(start, end).map((d) => ({ calendarDate: d, totalSteps: this.stats[d]!.steps, totalDistance: 700, stepGoal: 8000 }));
	}
	async dailyFloorStats(start: string, end: string) {
		this.guard("dailyFloorStats");
		this.statCalls.push(`floors:${start}:${end}`);
		return this.inRange(start, end).map((d) => ({ calendarDate: d, values: { wellnessFloorsAscended: this.stats[d]!.up ?? 0, wellnessFloorsDescended: 1, wellnessUserFloorsAscendedGoal: 10 } }));
	}
	async dailyIntensityStats(start: string, end: string) {
		this.guard("dailyIntensityStats");
		this.statCalls.push(`im:${start}:${end}`);
		return this.inRange(start, end).map((d) => ({ calendarDate: d, weeklyGoal: 150, moderateValue: this.stats[d]!.moderate ?? 0, vigorousValue: 0 }));
	}
	/** Nights the sleep stats know about: date → score. */
	nights: Record<string, number> = {};
	sleepCalls: string[] = [];
	async sleepStats(start: string, end: string) {
		this.guard("sleepStats");
		this.sleepCalls.push(`${start}:${end}`);
		return Object.keys(this.nights)
			.filter((d) => d >= start && d <= end)
			.sort()
			.map((d) => ({
				calendarDate: d,
				values: { sleepScore: this.nights[d], totalSleepTimeInSeconds: 27000, localSleepStartTimeInMillis: Date.parse(`${d}T00:00:00Z`) - 1800_000 },
			}));
	}
	async healthStatus(date: string) {
		this.guard("healthStatus", date);
		return {
			outliersCount: 1,
			metrics: [
				{ type: "HRV", value: 65, status: "BELOW", baselineLowerLimit: 66, baselineUpperLimit: 92 },
				{ type: "SPO2", value: null, status: "ONBOARDING", baselineLowerLimit: 0, baselineUpperLimit: 0 },
			],
		};
	}
	async hillScores(start: string, end = start) {
		this.guard(`hillScores:${start}:${end}`);
		return [{ calendarDate: end, overallScore: 29, primaryTrainingDevice: true }];
	}
	async runningTolerance(start: string, end = start) {
		this.guard(`runningTolerance:${start}:${end}`);
		return [{ calendarDate: end, acuteTolerance: 37561, acuteDistance: 23278 }];
	}
	async healthSnapshots(start: string, end = start) {
		this.guard(`healthSnapshots:${start}:${end}`);
		return [
			{
				calendarDate: end,
				startTimestampLocal: `${end}T12:07:35.0`,
				summaryTypeDataList: [{ summaryType: "HEART_RATE", avgValue: 76 }],
			},
		];
	}
	async maxMetrics(start: string, end = start) {
		this.guard(`maxMetrics:${start}:${end}`);
		this.rangeCalls += 1;
		return this.maxMetricsRows;
	}
	async racePredictions(start: string, end = start) {
		this.guard(`racePredictions:${start}:${end}`);
		this.rangeCalls += 1;
		return this.raceRows;
	}
}

class FakeTarget implements DayTarget {
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

describe("recentRange", () => {
	it("covers the first few days before there is a last sync", () => {
		assert.deepEqual(recentRange(null, "2026-09-12"), { from: "2026-09-10", to: "2026-09-12", capped: false });
	});

	it("goes back over the day before the mark, which Garmin is still revising", () => {
		assert.deepEqual(recentRange("2026-09-08", "2026-09-12"), { from: "2026-09-07", to: "2026-09-12", capped: false });
	});

	it("covers yesterday and today when the mark is today", () => {
		assert.deepEqual(recentRange("2026-09-12", "2026-09-12"), { from: "2026-09-11", to: "2026-09-12", capped: false });
	});

	it("still covers yesterday and today when the mark is in the future", () => {
		assert.deepEqual(recentRange("2026-09-20", "2026-09-12"), { from: "2026-09-11", to: "2026-09-12", capped: false });
	});

	it("crosses a year", () => {
		assert.deepEqual(recentRange("2026-01-01", "2026-01-02"), { from: "2025-12-31", to: "2026-01-02", capped: false });
	});

	it("caps a long gap and says so", () => {
		assert.deepEqual(recentRange("2026-07-01", "2026-09-12"), { from: "2026-08-14", to: "2026-09-12", capped: true });
		assert.equal(MAX_RECENT_DAYS, 30);
	});

	it("is not capped when the settle day is the oldest it allows", () => {
		assert.deepEqual(recentRange("2026-08-15", "2026-09-12"), { from: "2026-08-14", to: "2026-09-12", capped: false });
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
		assert.deepEqual(target.written.get("2026-09-12"), { steps: 8000 });
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
		assert.deepEqual(target.written.get("2026-09-12"), { steps: 8000 });
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

	it("abandons the range when Garmin's edge refuses the client: asking on keeps a block in place", async () => {
		const source = new FakeSource();
		source.failWith.dailySummary = new GarminBlockedError("Garmin's edge refused the request", 403);
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));

		const report = await syncRange(source, target, options());
		assert.match(report.stoppedEarly!, /edge refused/);
		assert.ok(report.fatal instanceof GarminBlockedError);
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 1);
	});

	it("abandons the range when Garmin can't refresh the session just now", async () => {
		const source = new FakeSource();
		source.failWith.dailySummary = new GarminRefreshError("Garmin couldn't refresh the session (HTTP 502)", 502);
		const report = await syncRange(source, new FakeTarget(new Set(["2026-09-12", "2026-09-11"])), options());
		assert.ok(report.fatal instanceof GarminRefreshError);
	});

	it("fails a day whose answer can't be read, and goes on to the next", async () => {
		const source = new FakeSource();
		const original = source.dailySummary.bind(source);
		source.dailySummary = async (date: string) => {
			const summary = await original(date);
			if (date !== "2026-09-11") return summary;
			// A shape the mappers don't expect: reading it throws.
			return Object.defineProperty({ ...summary }, "totalSteps", {
				enumerable: true,
				get() {
					throw new TypeError("summary.metrics is not iterable");
				},
			});
		};
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));

		const report = await syncRange(source, target, options());

		assert.equal(report.stoppedEarly, undefined);
		const failed = report.days.find((d) => d.date === "2026-09-11")!;
		assert.equal(failed.status, "failed");
		assert.match(failed.error!, /couldn't be read: summary\.metrics is not iterable/);
		assert.equal(failed.full, undefined, "left for the next sync");
		assert.ok(target.written.has("2026-09-12"));
		assert.ok(target.written.has("2026-09-10"));
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
		assert.equal((target.written.get("2026-09-12")!.workouts as unknown[]).length, 1);
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
		assert.deepEqual(target.written.get("2026-09-12"), { steps: 8000 });
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

describe("syncRange — activity index", () => {
	class Sink implements ActivitySink {
		calls: Array<{ count: number; complete: boolean }> = [];
		fail = false;
		async merge(listing: readonly Activity[], complete: boolean): Promise<number> {
			if (this.fail) throw new Error("vault is read-only");
			this.calls.push({ count: listing.length, complete });
			return 1;
		}
	}

	it("feeds the index even when no day in the range can be written", async () => {
		const source = new FakeSource();
		source.activityList = [{ activityId: 1, startTimeLocal: "2026-09-12 07:00:00" }];
		const sink = new Sink();

		const report = await syncRange(source, new FakeTarget(), options({ groups: ["workouts"], activities: sink }));

		assert.deepEqual(source.calls, ["activities:0:50"], "the list, and nothing per day");
		assert.deepEqual(sink.calls, [{ count: 1, complete: true }], "a short first page is the whole history");
		assert.equal(report.activityFilesWritten, 1);
		assert.equal(report.requests, 1);
	});

	it("says the listing is partial when the list goes on past the range", async () => {
		const source = new FakeSource();
		source.activityList = Array.from({ length: 50 }, (_, i) => ({ activityId: i, startTimeLocal: "2026-08-01 07:00:00" }));
		const sink = new Sink();

		await syncRange(source, new FakeTarget(new Set(["2026-09-12"])), options({ groups: ["workouts"], activities: sink }));

		assert.equal(source.activityPages, 1, "the first page already reached back past the range");
		assert.deepEqual(sink.calls, [{ count: 50, complete: false }]);
	});

	it("keeps syncing the days when the index cannot be written", async () => {
		const source = new FakeSource();
		source.activityList = [{ activityId: 1, startTimeLocal: "2026-09-12 07:00:00", activityName: "Run" }];
		const sink = new Sink();
		sink.fail = true;
		const target = new FakeTarget(new Set(["2026-09-12"]));

		const report = await syncRange(source, target, options({ groups: ["workouts"], activities: sink }));

		assert.equal(report.written, 1);
		assert.match(report.warnings.join("\n"), /activity index: vault is read-only/);
	});

	it("still fetches nothing without the workouts group", async () => {
		const source = new FakeSource();
		await syncRange(source, new FakeTarget(), options({ groups: ["activity"], activities: new Sink() }));
		assert.deepEqual(source.calls, []);
	});
});

describe("fetchAllActivities", () => {
	const history = Array.from({ length: 250 }, (_, i) => ({ activityId: 1000 - i, startTimeLocal: "2026-01-01 07:00:00" }));
	const paged = (failAt?: number, err: unknown = new GarminRateLimitError("rate limited")) => {
		const calls: string[] = [];
		return {
			calls,
			async activities(start = 0, limit = 20) {
				calls.push(`${start}:${limit}`);
				if (start === failAt) throw err;
				return history.slice(start, start + limit);
			},
		};
	};

	it("pages to the end, a hundred at a time, pausing between pages", async () => {
		const source = paged();
		const waits: number[] = [];
		const seen: number[] = [];
		const got = await fetchAllActivities(source, { pause: 250, wait: async (ms) => void waits.push(ms), onPage: (n) => seen.push(n) });

		assert.deepEqual(source.calls, ["0:100", "100:100", "200:100"]);
		assert.equal(got.activities.length, 250);
		assert.equal(got.complete, true);
		assert.equal(got.requests, 3);
		assert.deepEqual(seen, [100, 200, 250]);
		assert.deepEqual(waits, [250, 250], "no pause after the last page");
	});

	it("stops on a 429 and keeps what came before it", async () => {
		const got = await fetchAllActivities(paged(100), { wait: async () => {} });
		assert.equal(got.activities.length, 100);
		assert.equal(got.complete, false);
		assert.ok(got.fatal instanceof GarminRateLimitError);
	});

	it("reports any other failure without calling it fatal", async () => {
		const got = await fetchAllActivities(paged(200, new GarminApiError("HTTP 500", 500, "")), { wait: async () => {} });
		assert.equal(got.activities.length, 200);
		assert.equal(got.fatal, undefined);
		assert.match(got.error!, /500/);
	});

	it("gives up on a list that ignores the page it was asked for", async () => {
		const stuck = { async activities() { return history.slice(0, 100); } };
		const got = await fetchAllActivities(stuck, { wait: async () => {} });
		assert.equal(got.activities.length, 100);
		assert.equal(got.complete, false);
		assert.match(got.error!, /stopped advancing/);
	});

	it("can be stopped between pages", async () => {
		let pages = 0;
		const got = await fetchAllActivities(paged(), { wait: async () => {}, onPage: () => void pages++, shouldStop: () => pages >= 1 });
		assert.equal(got.requests, 1);
		assert.equal(got.complete, false);
	});
});

/* ------------------------------------------------------------------ */
/*  Daily stats index                                                 */
/* ------------------------------------------------------------------ */

class FakeDailySink implements DailyStatsSink {
	held: { from?: string; to?: string } | null = null;
	merged: Array<{ batch: DailyStatsBatch; covered: { from: string; to: string } | null }> = [];
	fail = false;
	async coverage() {
		return this.held;
	}
	async merge(batch: DailyStatsBatch, covered: { from: string; to: string } | null) {
		if (this.fail) throw new Error("disk full");
		this.merged.push({ batch, covered });
		return 1;
	}
}

describe("syncRange — daily stats index", () => {
	const all = new Set(["2026-09-10", "2026-09-11", "2026-09-12"]);

	it("takes the days from the summaries the sync fetched anyway, at no extra cost", async () => {
		const source = new FakeSource();
		const sink = new FakeDailySink();
		const report = await syncRange(source, new FakeTarget(all), options({ dailyStats: sink }));
		assert.deepEqual(source.statCalls, []);
		assert.equal(report.requests, 3);
		const { batch, covered } = sink.merged[0]!;
		assert.deepEqual(
			batch.rows.map((r) => [r.date, r.steps]),
			[
				["2026-09-12", 8000],
				["2026-09-11", 8000],
				["2026-09-10", 8000],
			],
		);
		assert.deepEqual(covered, { from: "2026-09-10", to: "2026-09-12" });
		assert.equal(report.dailyStatsFilesWritten, 1);
	});

	it("asks the range endpoints for the days it could not write, three requests a window", async () => {
		const source = new FakeSource();
		source.stats = { "2026-09-10": { steps: 5000, up: 3 }, "2026-09-11": { steps: 6000, moderate: 20 } };
		const sink = new FakeDailySink();
		await syncRange(source, new FakeTarget(new Set(["2026-09-12"])), options({ dailyStats: sink }));
		assert.deepEqual(source.statCalls, ["steps:2026-09-10:2026-09-11", "floors:2026-09-10:2026-09-11", "im:2026-09-10:2026-09-11"]);
		const { batch, covered } = sink.merged[0]!;
		assert.deepEqual([...batch.dates].sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
		const byDate = new Map(batch.rows.map((r) => [r.date, r]));
		assert.equal(byDate.get("2026-09-10")?.floorsUp, 3);
		assert.equal(byDate.get("2026-09-11")?.moderate, 20);
		assert.equal(byDate.get("2026-09-12")?.steps, 8000);
		assert.deepEqual(covered, { from: "2026-09-10", to: "2026-09-12" });
	});

	it("fills the stretch since the index's newest day", async () => {
		const source = new FakeSource();
		const sink = new FakeDailySink();
		sink.held = { from: "2026-08-01", to: "2026-09-01" };
		await syncRange(source, new FakeTarget(all), options({ dailyStats: sink }));
		assert.deepEqual(source.statCalls, ["steps:2026-09-02:2026-09-09", "floors:2026-09-02:2026-09-09", "im:2026-09-02:2026-09-09"]);
		assert.deepEqual(sink.merged[0]!.covered, { from: "2026-09-02", to: "2026-09-12" });
	});

	it("feeds the index even when no day in the range can be written", async () => {
		const source = new FakeSource();
		source.stats = { "2026-09-11": { steps: 4000 } };
		const sink = new FakeDailySink();
		await syncRange(source, new FakeTarget(), options({ dailyStats: sink }));
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 0);
		assert.deepEqual(
			sink.merged[0]!.batch.rows.map((r) => r.date),
			["2026-09-11"],
		);
	});

	it("is left alone without the activity group", async () => {
		const source = new FakeSource();
		const sink = new FakeDailySink();
		await syncRange(source, new FakeTarget(all), options({ groups: ["sleep"], dailyStats: sink }));
		assert.deepEqual(sink.merged, []);
		assert.deepEqual(source.statCalls, []);
	});

	it("keeps what earlier days gave it when a 429 ends the run, and fetches nothing more", async () => {
		const source = new FakeSource();
		const original = source.dailySummary.bind(source);
		source.dailySummary = async (date: string) => {
			if (date === "2026-09-11") throw new GarminRateLimitError("rate limited", 60);
			return original(date);
		};
		const sink = new FakeDailySink();
		const report = await syncRange(source, new FakeTarget(all), options({ dailyStats: sink }));
		assert.match(report.stoppedEarly ?? "", /rate limited/);
		assert.deepEqual(source.statCalls, []);
		assert.deepEqual(sink.merged[0]!.batch.dates, ["2026-09-12"]);
		assert.equal(sink.merged[0]!.covered, null);
	});

	it("leaves out a day the watch recorded nothing", async () => {
		const source = new FakeSource();
		source.dailySummary = async (date: string) => {
			const empty = { calendarDate: date, totalSteps: null, includesWellnessData: false };
			return empty;
		};
		const sink = new FakeDailySink();
		await syncRange(source, new FakeTarget(all), options({ dailyStats: sink }));
		assert.deepEqual(sink.merged[0]!.batch.rows, []);
		assert.equal(sink.merged[0]!.batch.dates.length, 3);
	});

	it("keeps syncing the days when the index cannot be written", async () => {
		const source = new FakeSource();
		const sink = new FakeDailySink();
		sink.fail = true;
		const target = new FakeTarget(all);
		const report = await syncRange(source, target, options({ dailyStats: sink }));
		assert.equal(report.written, 3);
		assert.ok(report.warnings.some((w) => w.includes("daily stats: disk full")));
	});
});

describe("fetchDailyStatsHistory", () => {
	/** Steps every day from `from` to `to`; nothing before. */
	function history(from: string, to: string, failAt?: { call: number; err: unknown }) {
		const days: string[] = [];
		for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days.push(d);
		const calls: string[] = [];
		const hit = (name: string, a: string, b: string) => {
			calls.push(`${name} ${a} ${b}`);
			if (failAt && calls.length === failAt.call) throw failAt.err;
			return days.filter((d) => d >= a && d <= b);
		};
		return {
			calls,
			dailyStepStats: async (a: string, b: string) => hit("steps", a, b).map((d) => ({ calendarDate: d, totalSteps: 1000, totalDistance: 800, stepGoal: 5000 })),
			dailyFloorStats: async (a: string, b: string) => hit("floors", a, b).map((d) => ({ calendarDate: d, values: { wellnessFloorsAscended: 2, wellnessFloorsDescended: 1 } })),
			dailyIntensityStats: async (a: string, b: string) => hit("im", a, b).map((d) => ({ calendarDate: d, weeklyGoal: 150, moderateValue: 5, vigorousValue: 1 })),
		};
	}

	it("walks back 28 days at a time until windows come back empty", async () => {
		const source = history("2026-08-15", "2026-09-12");
		const reached: string[] = [];
		const got = await fetchDailyStatsHistory(source, { until: "2026-09-12", emptyWindows: 2, onWindow: (d) => reached.push(d) });
		assert.equal(got.complete, true);
		// Two windows with data (three requests each), then two empty ones (one each).
		assert.equal(got.requests, 8);
		assert.deepEqual(reached, ["2026-08-16", "2026-07-19", "2026-06-21", "2026-05-24"]);
		assert.equal(got.batch.rows.length, 29);
		assert.equal(got.batch.dates.length, 112);
		assert.deepEqual(got.covered, { from: "2026-05-24", to: "2026-09-12" });
		assert.deepEqual(source.calls.slice(0, 3), ["steps 2026-08-16 2026-09-12", "floors 2026-08-16 2026-09-12", "im 2026-08-16 2026-09-12"]);
	});

	it("keeps walking through empty windows newer than the oldest activity", async () => {
		const source = history("2026-08-15", "2026-09-12");
		const got = await fetchDailyStatsHistory(source, { until: "2026-09-12", emptyWindows: 1, notBefore: "2026-06-01" });
		assert.equal(got.complete, true);
		assert.equal(got.covered?.from, "2026-05-24");
	});

	it("stops on a 429, keeping the windows before it", async () => {
		const source = history("2026-08-15", "2026-09-12", { call: 4, err: new GarminRateLimitError("rate limited") });
		const got = await fetchDailyStatsHistory(source, { until: "2026-09-12" });
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.equal(got.complete, false);
		assert.equal(got.batch.rows.length, 28);
		assert.deepEqual(got.covered, { from: "2026-08-16", to: "2026-09-12" });
	});

	it("reports any other failure without calling it fatal", async () => {
		const source = history("2026-08-15", "2026-09-12", { call: 2, err: new GarminApiError("bad gateway", 502, "") });
		const got = await fetchDailyStatsHistory(source, { until: "2026-09-12" });
		assert.equal(got.fatal, undefined);
		assert.match(got.error ?? "", /2026-08-16\.\.2026-09-12: bad gateway/);
		assert.equal(got.covered, null);
	});

	it("can be stopped between windows", async () => {
		const source = history("2026-01-01", "2026-09-12");
		let windows = 0;
		const got = await fetchDailyStatsHistory(source, { until: "2026-09-12", onWindow: () => (windows += 1), shouldStop: () => windows >= 2 });
		assert.equal(windows, 2);
		assert.equal(got.complete, false);
	});
});

/* ------------------------------------------------------------------ */
/*  Sleep index                                                       */
/* ------------------------------------------------------------------ */

class FakeSleepSink implements SleepSink {
	held: { from?: string; to?: string } | null = null;
	merged: Array<{ batch: SleepBatch; covered: { from: string; to: string } | null }> = [];
	async coverage() {
		return this.held;
	}
	async merge(batch: SleepBatch, covered: { from: string; to: string } | null) {
		this.merged.push({ batch, covered });
		return 2;
	}
}

describe("syncRange — sleep index", () => {
	const all = new Set(["2026-09-10", "2026-09-11", "2026-09-12"]);

	it("asks the sleep stats for the run's days in one request", async () => {
		const source = new FakeSource();
		source.nights = { "2026-09-11": 84, "2026-09-12": 91 };
		const sink = new FakeSleepSink();
		const report = await syncRange(source, new FakeTarget(all), options({ groups: ["sleep"], sleep: sink }));
		assert.deepEqual(source.sleepCalls, ["2026-09-10:2026-09-12"]);
		assert.equal(report.requests, 4);
		const { batch, covered } = sink.merged[0]!;
		assert.deepEqual(
			batch.rows.map((r) => [r.date, r.score, r.bed]),
			[
				["2026-09-11", 84, -1800],
				["2026-09-12", 91, -1800],
			],
		);
		assert.deepEqual([...batch.dates].sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
		assert.deepEqual(covered, { from: "2026-09-10", to: "2026-09-12" });
		assert.equal(report.sleepFilesWritten, 2);
	});

	it("fills the stretch since the index's newest night, 28 days a request", async () => {
		const source = new FakeSource();
		const sink = new FakeSleepSink();
		sink.held = { from: "2026-07-01", to: "2026-08-01" };
		await syncRange(source, new FakeTarget(all), options({ groups: ["sleep"], sleep: sink }));
		assert.deepEqual(source.sleepCalls, ["2026-08-02:2026-08-29", "2026-08-30:2026-09-12"]);
		assert.deepEqual(sink.merged[0]!.covered, { from: "2026-08-02", to: "2026-09-12" });
	});

	it("is left alone without the sleep group", async () => {
		const source = new FakeSource();
		const sink = new FakeSleepSink();
		await syncRange(source, new FakeTarget(all), options({ groups: ["activity"], sleep: sink }));
		assert.deepEqual(source.sleepCalls, []);
		assert.deepEqual(sink.merged, []);
	});

	it("stops the run on a 429 from the sleep stats", async () => {
		const source = new FakeSource();
		source.failWith.sleepStats = new GarminRateLimitError("rate limited", 60);
		const sink = new FakeSleepSink();
		const report = await syncRange(source, new FakeTarget(all), options({ groups: ["sleep"], sleep: sink }));
		assert.match(report.stoppedEarly ?? "", /rate limited/);
		assert.deepEqual(sink.merged, []);
	});

	it("keeps what it got, without claiming coverage, when a window fails", async () => {
		const source = new FakeSource();
		source.failWith.sleepStats = new GarminApiError("bad gateway", 502, "");
		const sink = new FakeSleepSink();
		const report = await syncRange(source, new FakeTarget(all), options({ groups: ["sleep"], sleep: sink }));
		assert.equal(report.stoppedEarly, undefined);
		assert.deepEqual(sink.merged, []);
		assert.ok(report.warnings.some((w) => w.includes("sleep stats 2026-09-10..2026-09-12: bad gateway")));
	});
});

describe("fetchSleepHistory", () => {
	function nights(from: string, to: string, failAt?: { call: number; err: unknown }) {
		const days: string[] = [];
		for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) days.push(d);
		const calls: string[] = [];
		return {
			calls,
			sleepStats: async (a: string, b: string) => {
				calls.push(`${a} ${b}`);
				if (failAt && calls.length === failAt.call) throw failAt.err;
				return days.filter((d) => d >= a && d <= b).map((d) => ({ calendarDate: d, values: { sleepScore: 80, totalSleepTimeInSeconds: 25000 } }));
			},
		};
	}

	it("walks back 28 nights a request until windows come back empty", async () => {
		const source = nights("2026-08-15", "2026-09-12");
		const reached: string[] = [];
		const got = await fetchSleepHistory(source, { until: "2026-09-12", emptyWindows: 2, onWindow: (d) => reached.push(d) });
		assert.equal(got.complete, true);
		assert.equal(got.requests, 4);
		assert.deepEqual(reached, ["2026-08-16", "2026-07-19", "2026-06-21", "2026-05-24"]);
		assert.equal(got.batch.rows.length, 29);
		assert.deepEqual(got.covered, { from: "2026-05-24", to: "2026-09-12" });
	});

	it("keeps walking through empty windows newer than the oldest activity", async () => {
		const source = nights("2026-08-15", "2026-09-12");
		const got = await fetchSleepHistory(source, { until: "2026-09-12", emptyWindows: 1, notBefore: "2026-06-01" });
		assert.equal(got.complete, true);
		assert.equal(got.covered?.from, "2026-05-24");
	});

	it("stops on a 429, keeping the windows before it", async () => {
		const source = nights("2026-01-01", "2026-09-12", { call: 2, err: new GarminRateLimitError("rate limited") });
		const got = await fetchSleepHistory(source, { until: "2026-09-12" });
		assert.ok(got.fatal instanceof GarminRateLimitError);
		assert.equal(got.complete, false);
		assert.equal(got.batch.rows.length, 28);
		assert.deepEqual(got.covered, { from: "2026-08-16", to: "2026-09-12" });
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

describe("syncRange — parallelDays", () => {
	const range = { from: "2026-08-20", to: "2026-09-12" };

	it("writes the same days, in the same order, as one day at a time", async () => {
		const run = async (parallelDays: number) => {
			const written: string[] = [];
			const target: DayTarget = {
				exists: () => true,
				write: async (date, properties) => {
					written.push(`${date}:${Object.keys(properties).length}`);
					return "written";
				},
			};
			const report = await syncRange(new FakeSource(), target, options({ ...range, parallelDays }));
			return { written, requests: report.requests };
		};
		const one = await run(1);
		const four = await run(4);
		assert.deepEqual(four.written, one.written);
		assert.equal(four.requests, one.requests);
	});

	it("has at most parallelDays days in flight", async () => {
		const source = new FakeSource();
		let inFlight = 0;
		let peak = 0;
		const original = source.dailySummary.bind(source);
		source.dailySummary = async (date: string) => {
			inFlight += 1;
			peak = Math.max(peak, inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight -= 1;
			return original(date);
		};
		const always: DayTarget = { exists: () => true, write: async () => "written" };
		await syncRange(source, always, options({ ...range, groups: ["activity"], parallelDays: 3 }));
		assert.equal(peak, 3);
	});

	it("still stops after empty days, fetching at most parallelDays - 1 days past the stop", async () => {
		const source = new FakeSource();
		const original = source.dailySummary.bind(source);
		source.dailySummary = async (date: string) =>
			date >= "2026-09-08" ? original(date) : { calendarDate: date, totalSteps: null };
		const always: DayTarget = { exists: () => true, write: async () => "written" };
		const report = await syncRange(
			source,
			always,
			options({ from: "2026-08-01", to: "2026-09-12", stopAfterEmptyDays: 3, parallelDays: 4 }),
		);
		assert.match(report.stoppedEarly ?? "", /back to 2026-09-05/);
		// 8 days written or skipped, then up to 3 more already asked for.
		assert.ok(source.calls.filter((c) => c.startsWith("dailySummary")).length <= 11);
	});
});

/* ------------------------------------------------------------------ */

describe("syncRange — a target that creates its own files", () => {
	it("covers every day in the range, so backfill needs nothing to exist first", async () => {
		const source = new FakeSource();
		const written: string[] = [];
		const target: DayTarget = {
			exists: () => true,
			write: async (date) => {
				written.push(date);
				return "written";
			},
		};
		const report = await syncRange(source, target, options());
		assert.deepEqual(written.sort(), ["2026-09-10", "2026-09-11", "2026-09-12"]);
		assert.equal(report.skipped, 0);
	});
});

/* ------------------------------------------------------------------ */
/*  Intraday series                                                    */
/* ------------------------------------------------------------------ */

class FakeSeries implements SeriesTarget {
	written = new Map<string, DaySeries>();
	async write(date: string, series: DaySeries) {
		this.written.set(date, series);
		return "written" as const;
	}
}

describe("syncRange — intraday", () => {
	it("writes series to their own target and only the latest HR to the note", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12"]));
		const series = new FakeSeries();
		const report = await syncRange(
			source,
			target,
			options({ from: "2026-09-12", groups: ["intraday"], series }),
		);

		assert.deepEqual(target.written.get("2026-09-12"), { hr_latest: 61 });
		const day = series.written.get("2026-09-12")!;
		assert.deepEqual(day.stress, [
			[1_000, 20],
			[2_000, null],
		]);
		assert.deepEqual(day.bodyBattery, [[1_000, 60]]);
		assert.equal(day.steps![0]!.steps, 412);
		// Quiet floor buckets are left out; minutes keep Garmin's bucket-end stamp.
		assert.deepEqual(day.floors, [
			{ start: Date.parse("2026-09-12T08:00:00Z"), end: Date.parse("2026-09-12T08:15:00Z"), up: 2, down: 0 },
		]);
		assert.deepEqual(day.intensity, [[1_000, 30]]);
		assert.equal(report.seriesWritten, 1);
		assert.equal(report.requests, 6);
	});

	it("spends intraday requests only on the newest days of a run", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		await syncRange(
			source,
			target,
			options({ groups: ["activity", "intraday"], series: new FakeSeries(), intradayDays: 2 }),
		);
		assert.deepEqual(
			source.calls.filter((c) => c.startsWith("stress")),
			["stress:2026-09-12", "stress:2026-09-11"],
		);
	});

	it("fetches nothing intraday without somewhere to put it", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12"]));
		await syncRange(source, target, options({ from: "2026-09-12", groups: ["intraday"] }));
		assert.deepEqual(source.calls, []);
	});
});

/** The series files in memory, through the real serializer. */
class MemorySeries implements SeriesTarget {
	files = new Map<string, string>();
	reads = 0;
	async read(date: string): Promise<DaySeries | null> {
		this.reads += 1;
		const text = this.files.get(date);
		return text ? parseSeries(text) : null;
	}
	async write(date: string, series: DaySeries): Promise<"written" | "unchanged"> {
		const text = serializeSeries(date, series);
		if (this.files.get(date) === text) return "unchanged";
		this.files.set(date, text);
		return "written";
	}
	put(date: string, series: DaySeries) {
		this.files.set(date, serializeSeries(date, series));
	}
	get(date: string): DaySeries | null {
		const text = this.files.get(date);
		return text ? parseSeries(text) : null;
	}
}

describe("syncRange — extras kept at sync time", () => {
	/** An extra the sync keeps from the day's own hrv payload (as HRV Status keeps its readings). */
	const NIGHTLY = defineIntraday({
		key: "nightly",
		group: "hrv",
		fetch: async () => null,
		map: (payload: { hrvSummary?: { lastNightAvg?: number | null } } | null) => (typeof payload?.hrvSummary?.lastNightAvg === "number" ? { avg: payload.hrvSummary.lastNightAvg } : null),
		fromDay: (day) => day.hrv,
	});
	/** An extra a page loads on view only. */
	const ON_VIEW = defineIntraday({ key: "onView", group: "hrv", fetch: async () => [1], map: (payload: number[]) => payload });

	const DAYS = new Set(["2026-09-10", "2026-09-11", "2026-09-12"]);

	it("keeps a block from every synced day's own payload, at no request of its own", async () => {
		const source = new FakeSource();
		const series = new MemorySeries();
		const report = await syncRange(source, new FakeTarget(DAYS), options({ groups: ["hrv"], series, extras: [NIGHTLY, ON_VIEW] }));
		// The hrv a day the day files need, and nothing else: every day, not only the newest few.
		assert.deepEqual(source.calls.sort(), ["hrv:2026-09-10", "hrv:2026-09-11", "hrv:2026-09-12"]);
		assert.equal(report.requests, 3);
		assert.equal(report.seriesWritten, 3);
		assert.deepEqual(series.get("2026-09-10"), { extra: { nightly: { avg: 42 } } });
	});

	it("folds it into the day's file, keeping what the file holds, and leaves an unchanged day alone", async () => {
		const series = new MemorySeries();
		series.put("2026-09-12", { stress: [[1_000, 20]], extra: { onView: [1] }, checked: ["onView"] });
		const opts = options({ from: "2026-09-12", groups: ["hrv"], series, extras: [NIGHTLY, ON_VIEW] });
		await syncRange(new FakeSource(), new FakeTarget(DAYS), opts);
		assert.deepEqual(series.get("2026-09-12"), { stress: [[1_000, 20]], extra: { onView: [1], nightly: { avg: 42 } }, checked: ["onView"] });
		const again = await syncRange(new FakeSource(), new FakeTarget(DAYS), opts);
		assert.equal(again.seriesWritten, 0);
	});

	it("never drops a kept block when the day has nothing for it, or its request failed", async () => {
		const series = new MemorySeries();
		series.put("2026-09-12", { extra: { nightly: { avg: 40 } } });
		const before = series.files.get("2026-09-12");
		const empty = new FakeSource();
		empty.hrv = async () => null as never;
		const opts = options({ from: "2026-09-12", groups: ["hrv"], series, extras: [NIGHTLY] });
		assert.equal((await syncRange(empty, new FakeTarget(DAYS), opts)).seriesWritten, 0);
		const failing = new FakeSource();
		failing.failWith.hrv = new GarminApiError("hrv: HTTP 500", 500, "");
		assert.equal((await syncRange(failing, new FakeTarget(DAYS), opts)).seriesWritten, 0);
		assert.equal(series.files.get("2026-09-12"), before);
	});

	it("carries a kept block through the sync's own write of a day, which still drops what a page loaded", async () => {
		const series = new MemorySeries();
		series.put("2026-09-12", { extra: { nightly: { avg: 40 }, onView: [1] }, checked: ["onView"] });
		const source = new FakeSource();
		source.failWith.hrv = new GarminApiError("hrv: HTTP 500", 500, "");
		await syncRange(source, new FakeTarget(DAYS), options({ from: "2026-09-12", groups: ["hrv", "intraday"], series, extras: [NIGHTLY, ON_VIEW] }));
		const day = series.get("2026-09-12")!;
		assert.deepEqual(day.stress, [
			[1_000, 20],
			[2_000, null],
		]);
		assert.deepEqual([day.extra, day.checked], [{ nightly: { avg: 40 } }, undefined]);
		// A fresh payload replaces it.
		await syncRange(new FakeSource(), new FakeTarget(DAYS), options({ from: "2026-09-12", groups: ["hrv", "intraday"], series, extras: [NIGHTLY] }));
		assert.deepEqual(series.get("2026-09-12")!.extra, { nightly: { avg: 42 } });
	});

	it("keeps nothing while the extra's group is off, or without somewhere to put it", async () => {
		const series = new MemorySeries();
		const source = new FakeSource();
		await syncRange(source, new FakeTarget(DAYS), options({ groups: ["activity"], series, extras: [NIGHTLY] }));
		assert.equal(source.calls.filter((c) => c.startsWith("hrv")).length, 0);
		assert.deepEqual([series.files.size, series.reads], [0, 0]);
		const report = await syncRange(new FakeSource(), new FakeTarget(DAYS), options({ groups: ["hrv"], extras: [NIGHTLY] }));
		assert.equal(report.seriesWritten, 0);
	});

	it("rides only with the day's own series when the target cannot read the file", async () => {
		const blind = new FakeSeries();
		await syncRange(new FakeSource(), new FakeTarget(DAYS), options({ from: "2026-09-12", groups: ["hrv"], series: blind, extras: [NIGHTLY] }));
		assert.equal(blind.written.size, 0);
		await syncRange(new FakeSource(), new FakeTarget(DAYS), options({ from: "2026-09-12", groups: ["hrv", "intraday"], series: blind, extras: [NIGHTLY] }));
		assert.deepEqual(blind.written.get("2026-09-12")!.extra, { nightly: { avg: 42 } });
	});
});

describe("syncRange — a backfill's chunk", () => {
	const run = (date: string, id: number): Activity => ({ activityId: id, activityName: "Run", startTimeLocal: `${date} 07:00:00`, distance: 5000, duration: 1800, activityType: { typeKey: "running" } }) as Activity;

	/** A source that lists activities by date as well. */
	class DatedSource extends FakeSource {
		dated: Activity[] = [];
		async activitiesByDate(from: string, to: string, start = 0, limit = 100) {
			this.calls.push(`activitiesByDate:${from}:${to}:${start}:${limit}`);
			return this.dated.slice(start, start + limit);
		}
	}

	it("lists its own window by date instead of paging back from the newest, and leaves the activity index alone", async () => {
		const source = new DatedSource();
		source.dated = [run("2026-09-11", 2), run("2026-09-10", 1)];
		const merged: number[] = [];
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		await syncRange(source, target, options({ groups: ["activity", "workouts"], activityRange: true, activities: { merge: async (listing) => (merged.push(listing.length), 1) } }));
		assert.deepEqual(source.calls.filter((c) => c.startsWith("activit")), ["activitiesByDate:2026-09-10:2026-09-12:0:100"]);
		assert.equal(source.activityPages, 0);
		assert.deepEqual(merged, []);
		assert.equal((target.written.get("2026-09-11")!.workouts as unknown[]).length, 1);
	});

	it("pages the window while full pages come back", async () => {
		const source = new DatedSource();
		source.dated = Array.from({ length: 150 }, (_, i) => run("2026-09-11", i + 1));
		await syncRange(source, new FakeTarget(new Set(["2026-09-11"])), options({ from: "2026-09-11", to: "2026-09-11", groups: ["workouts"], activityRange: true }));
		assert.deepEqual(source.calls.filter((c) => c.startsWith("activit")), ["activitiesByDate:2026-09-11:2026-09-11:0:100", "activitiesByDate:2026-09-11:2026-09-11:100:100"]);
	});

	it("keeps the error it stopped on, so the backfill can tell a 429 from a dead session", async () => {
		const slow = new GarminRateLimitError("slow down", 30);
		const source = new FakeSource();
		source.failWith.dailySummary = slow;
		const report = await syncRange(source, new FakeTarget(new Set(["2026-09-12"])), options({ from: "2026-09-12" }));
		assert.equal(report.fatal, slow);
		const dead = new GarminAuthError("session expired");
		const gone = new FakeSource();
		gone.failWith.dailySummary = dead;
		assert.equal((await syncRange(gone, new FakeTarget(new Set(["2026-09-12"])), options({ from: "2026-09-12" }))).fatal, dead);
	});

	it("marks a day full only when everything its groups ask for came back, intraday included", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11", "2026-09-10"]));
		const report = await syncRange(source, target, options({ groups: ["activity", "intraday"], series: new FakeSeries(), intradayDays: 2 }));
		assert.deepEqual(
			report.days.map((d) => [d.date, d.full ?? false]),
			[
				["2026-09-10", false],
				["2026-09-11", true],
				["2026-09-12", true],
			],
		);
		// Without intraday asked for, a day is full once its requests are in.
		const plain = await syncRange(new FakeSource(), target, options({ groups: ["activity"] }));
		assert.ok(plain.days.every((d) => d.full));
		// A request that failed leaves the day to fetch again.
		const failing = new FakeSource();
		failing.failWith.heartRate = new GarminApiError("heartRate: HTTP 500", 500, "");
		const partial = await syncRange(failing, target, options({ from: "2026-09-12", groups: ["activity", "intraday"], series: new FakeSeries() }));
		assert.equal(partial.days.find((d) => d.date === "2026-09-12")!.full, undefined);
	});
});

describe("syncRange — a day's series keeps what the sync did not fetch", () => {
	/** A day as an earlier sync left it, with every intraday block. */
	const FULL: DaySeries = {
		stress: [[1_000, 20]],
		bodyBattery: [[1_000, 60]],
		heartRate: [[1_000, 55]],
		steps: [{ start: 1_000, end: 2_000, steps: 100 }],
		floors: [{ start: 1_000, end: 2_000, up: 2, down: 0 }],
		intensity: [[2_000, 10]],
		dayStart: 1_000,
		bodyBatteryEvents: [{ type: "SLEEP" }],
	};
	const WEEK_AND_A_DAY = new Set(dateRange("2026-09-03", "2026-09-10"));
	/** The night's hypnogram, which every synced day fetches with its sleep. */
	const withNight = (source: FakeSource) => {
		source.sleep = async (date: string) => {
			source.calls.push(`sleep:${date}`);
			return { dailySleepDTO: { sleepTimeSeconds: 27000 }, sleepLevels: [{ startGMT: `${date}T00:00:00.0`, endGMT: `${date}T06:00:00.0`, activityLevel: 1 }] } as never;
		};
		return source;
	};

	it("keeps the timelines of a run's oldest day, which fetched only its night", async () => {
		const series = new MemorySeries();
		series.put("2026-09-03", FULL);
		const source = withNight(new FakeSource());
		await syncRange(source, new FakeTarget(WEEK_AND_A_DAY), options({ from: "2026-09-03", to: "2026-09-10", groups: ["sleep", "intraday"], series }));
		// Seven days fetched their intraday requests; the eighth only its night.
		assert.deepEqual(
			source.calls.filter((c) => c.startsWith("stress:")),
			dateRange("2026-09-04", "2026-09-10").map((d) => `stress:${d}`),
		);
		const day = series.get("2026-09-03")!;
		assert.deepEqual({ ...day, sleepLevels: undefined }, { ...FULL, sleepLevels: undefined });
		assert.deepEqual(day.sleepLevels, [{ start: Date.parse("2026-09-03T00:00:00Z"), end: Date.parse("2026-09-03T06:00:00Z"), level: 1 }]);
	});

	it("keeps a block Garmin no longer sends for a day it fetched again", async () => {
		const series = new MemorySeries();
		series.put("2026-09-12", FULL);
		const source = new FakeSource();
		source.stepsChart = async (date: string) => {
			source.calls.push(`stepsChart:${date}`);
			return [];
		};
		await syncRange(source, new FakeTarget(new Set(["2026-09-12"])), options({ from: "2026-09-12", groups: ["intraday"], series }));
		const day = series.get("2026-09-12")!;
		assert.deepEqual(day.steps, FULL.steps);
		// What came back replaces the file's copy.
		assert.deepEqual(day.stress, [
			[1_000, 20],
			[2_000, null],
		]);
	});
});

describe("syncRange — health, hill score, running tolerance", () => {
	it("maps Health Status per day and range metrics onto their own day", async () => {
		const source = new FakeSource();
		const target = new FakeTarget(new Set(["2026-09-12", "2026-09-11"]));
		const report = await syncRange(source, target, options({ groups: ["health", "fitness", "training"] }));
		const day = target.written.get("2026-09-12")!;
		assert.equal(day.health_hrv, 65);
		assert.equal(day.health_hrv_status, "BELOW");
		assert.equal(day.health_spo2_status, "ONBOARDING");
		assert.ok(!("health_spo2_baseline_low" in day), "a 0–0 baseline is no baseline");
		assert.deepEqual(day.health_snapshots, [{ start: "2026-09-12T12:07", hr: 76 }]);
		assert.equal(day.hill_score, 29);
		assert.equal(day.running_tolerance, 37561);
		assert.equal(day.running_tolerance_distance_km, 23.28);
		assert.ok(!("hill_score" in target.written.get("2026-09-11")!));
		// One call each for the three range metrics, whatever the day count.
		assert.equal(source.calls.filter((c) => /^(hillScores|runningTolerance|healthSnapshots):/.test(c)).length, 3);
		// maxMetrics has no rows in this fake: that is an account without VO2 Max, not a warning.
		assert.deepEqual(report.warnings, []);
	});

	it("asks running tolerance a year a request, inside the route's 366-day cap", async () => {
		const source = new FakeSource();
		await syncRange(source, { exists: () => true, write: async () => "written" }, options({ from: "2025-09-06", to: "2026-10-11", groups: ["training"] }));
		// 401 days: a year, then the rest, where 28-day windows took fifteen requests.
		assert.deepEqual(
			source.calls.filter((c) => c.startsWith("runningTolerance:")),
			["runningTolerance:2025-09-06:2026-09-05", "runningTolerance:2026-09-06:2026-10-11"],
		);
	});
});

describe("syncRange — max metrics", () => {
	it("finds the day on the generic sub-object, where Garmin puts it", async () => {
		const source = new FakeSource();
		source.maxMetricsRows = [{ generic: { calendarDate: "2026-09-12", vo2MaxPreciseValue: 52.3 } }];
		const target = new FakeTarget(new Set(["2026-09-12"]));
		const report = await syncRange(source, target, options({ from: "2026-09-12", groups: ["fitness"] }));
		assert.equal(target.written.get("2026-09-12")!.vo2max, 52.3);
		assert.deepEqual(report.warnings, []);
	});
});

/* ------------------------------------------------------------------ */
/*  Running off the end of the account's history                       */
/* ------------------------------------------------------------------ */

describe("syncRange — stopAfterEmptyDays", () => {
	/** A source with data only from `startsOn` onwards. */
	class SparseSource extends FakeSource {
		constructor(private startsOn: string) {
			super();
		}
		override async dailySummary(date: string) {
			const summary = await super.dailySummary(date);
			// Garmin answers for a date before your history, just with nothing in it.
			return date >= this.startsOn ? summary : { calendarDate: date, totalSteps: null };
		}
	}

	const always: DayTarget = { exists: () => true, write: async () => "written" };

	it("gives up once it has walked past the start of your history", async () => {
		const source = new SparseSource("2026-09-08");
		const report = await syncRange(
			source,
			always,
			options({ from: "2026-08-01", to: "2026-09-12", stopAfterEmptyDays: 3 }),
		);

		assert.match(report.stoppedEarly ?? "", /no data older/);
		// 5 days of data, then 3 empties, then stop — not all 43 days.
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 8);
	});

	it("names the date it gave up at, so a real gap can be told apart", async () => {
		const report = await syncRange(
			new SparseSource("2026-09-11"),
			always,
			options({ from: "2026-08-01", to: "2026-09-12", stopAfterEmptyDays: 2 }),
		);
		assert.match(report.stoppedEarly ?? "", /back to 2026-09-09/);
	});

	it("keeps going through a gap shorter than the limit", async () => {
		const source = new FakeSource();
		// One hollow day in the middle must not end the run.
		const original = source.dailySummary.bind(source);
		source.dailySummary = async (date: string) =>
			date === "2026-09-11" ? { calendarDate: date, totalSteps: null } : original(date);

		const report = await syncRange(source, always, options({ stopAfterEmptyDays: 2 }));
		assert.equal(report.stoppedEarly, undefined);
		assert.equal(report.written, 2);
		assert.equal(report.skipped, 1);
	});

	it("walks the whole range when the guard is off", async () => {
		const source = new SparseSource("2026-09-12");
		const report = await syncRange(
			source,
			always,
			options({ from: "2026-09-01", to: "2026-09-12", stopAfterEmptyDays: 0 }),
		);
		assert.equal(report.stoppedEarly, undefined);
		assert.equal(source.calls.filter((c) => c.startsWith("dailySummary")).length, 12);
	});
});

describe("syncRange — range-fetched metrics", () => {
	const always: DayTarget = { exists: () => true, write: async () => "written" };

	it("asks for VO2 Max and race predictions once for the whole window", async () => {
		const source = new FakeSource();
		source.maxMetricsRows = [{ calendarDate: "2026-09-12", generic: { vo2MaxPreciseValue: 48.6 } }];
		source.raceRows = [{ calendarDate: "2026-09-12", time5K: 1471 }];

		const report = await syncRange(
			source,
			always,
			options({ groups: ["fitness", "races"] }),
		);

		// Three days in the range, but one call each — not three.
		assert.equal(source.rangeCalls, 2);
		assert.ok(source.calls.includes("maxMetrics:2026-09-10:2026-09-12"));
		assert.ok(source.calls.includes("racePredictions:2026-09-10:2026-09-12"));
		assert.equal(report.written, 3);
	});

	it("matches each day to its own row and leaves the rest without", async () => {
		const written = new Map<string, Record<string, unknown>>();
		const target: DayTarget = {
			exists: () => true,
			write: async (date, props) => {
				written.set(date, props);
				return "written";
			},
		};
		const source = new FakeSource();
		source.maxMetricsRows = [{ calendarDate: "2026-09-11", generic: { vo2MaxPreciseValue: 48.6 } }];

		await syncRange(source, target, options({ groups: ["fitness", "activity"] }));
		assert.equal(written.get("2026-09-11")!.vo2max, 48.6);
		assert.ok(!("vo2max" in written.get("2026-09-12")!));
	});

	it("carries on without them when the range call fails", async () => {
		const source = new FakeSource();
		source.failWith["maxMetrics:2026-09-10:2026-09-12"] = new GarminApiError("boom", 500, "");
		const report = await syncRange(
			source,
			always,
			options({ groups: ["fitness", "activity"] }),
		);
		assert.equal(report.stoppedEarly, undefined);
		assert.equal(report.written, 3);
	});

	it("stops before any day when the range call is rate limited", async () => {
		const source = new FakeSource();
		source.failWith["maxMetrics:2026-09-10:2026-09-12"] = new GarminRateLimitError("slow down");
		const report = await syncRange(source, always, options({ groups: ["fitness"] }));
		assert.match(report.stoppedEarly ?? "", /rate limited/);
		assert.equal(source.calls.filter((c) => c.startsWith("enduranceScore")).length, 0);
	});
});

describe("chunkRange", () => {
	it("leaves a short range in one piece", () => {
		assert.deepEqual(chunkRange("2026-09-01", "2026-09-12"), [
			{ from: "2026-09-01", to: "2026-09-12" },
		]);
	});

	it("splits a range longer than Garmin accepts", () => {
		// Garmin rejects a race-prediction range longer than a year.
		const windows = chunkRange("2025-08-02", "2026-09-12");
		assert.equal(windows.length, 2);
		assert.equal(windows[0]!.from, "2025-08-02");
		assert.equal(windows[1]!.to, "2026-09-12");
		for (const w of windows) {
			assert.ok(dateRange(w.from, w.to).length <= RANGE_CHUNK_DAYS, `${w.from}..${w.to}`);
		}
	});

	it("covers every day exactly once", () => {
		const all = chunkRange("2024-01-01", "2026-09-12").flatMap((w) => dateRange(w.from, w.to));
		assert.equal(new Set(all).size, all.length, "no day appears twice");
		assert.equal(all.length, dateRange("2024-01-01", "2026-09-12").length);
	});

	it("is empty for an inverted range", () => {
		assert.deepEqual(chunkRange("2026-09-12", "2026-09-01"), []);
	});
});

describe("syncRange — range endpoints that come back empty", () => {
	const always: DayTarget = { exists: () => true, write: async () => "written" };

	it("chunks a multi-year backfill instead of asking for it all at once", async () => {
		const source = new FakeSource();
		const asked: string[] = [];
		source.racePredictions = async (start: string, end = start) => {
			asked.push(`${start}..${end}`);
			return [];
		};
		await syncRange(
			source,
			always,
			options({ from: "2024-01-01", to: "2026-09-12", groups: ["races"] }),
		);
		assert.ok(asked.length >= 3, `expected several windows, got ${asked.join(", ")}`);
		for (const window of asked) {
			const [a, b] = window.split("..");
			assert.ok(dateRange(a!, b!).length <= RANGE_CHUNK_DAYS, window);
		}
	});

	it("keeps quiet when a range endpoint returns nothing: an account without that data isn't a problem", async () => {
		const source = new FakeSource();
		source.maxMetricsRows = [];
		const report = await syncRange(source, always, options({ groups: ["fitness"] }));
		assert.doesNotMatch(report.warnings.join(" "), /VO2 Max/);
	});

	it("says so when a range endpoint fails, without losing the rest of the sync", async () => {
		const source = new FakeSource();
		source.failWith["racePredictions:2026-09-10:2026-09-12"] = new GarminApiError("HTTP 400", 400, "");
		const report = await syncRange(
			source,
			always,
			options({ groups: ["races", "activity"] }),
		);
		assert.match(report.warnings.join(" "), /race predictions: .*400/);
		assert.equal(report.written, 3, "the rest of the sync still ran");
	});
});
