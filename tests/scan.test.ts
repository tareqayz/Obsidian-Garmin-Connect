import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { Activity, DailyStepStat, WeeklyStepsRow } from "../src/garmin/endpoints";
import { GarminApiError, GarminRateLimitError } from "../src/garmin/errors";
import { shiftDate } from "../src/sync/day-index";
import { daysSince, historyStart, parseScan, scanAccount, serializeScan, type ScanSource } from "../src/sync/scan";

const TODAY = "2026-10-14";

/** An account whose wellness data starts on `first`, every day since, with `listed` activities on the list. */
class FakeAccount implements ScanSource {
	calls: string[] = [];
	fail: Record<string, unknown> = {};
	constructor(
		private readonly first: string | null,
		private readonly listed = 341,
		private readonly firstActivity = "2025-08-03",
	) {}
	private guard(call: string) {
		this.calls.push(call);
		const key = Object.keys(this.fail).find((k) => call.startsWith(k));
		if (key) throw this.fail[key];
	}
	async lastUsedDevice() {
		this.guard("mylastused");
		return { lastUsedDeviceUploadTime: Date.parse("2026-10-14T02:12:00Z") };
	}
	async activityCount() {
		this.guard("count");
		return { totalCount: this.listed ? this.listed + 5 : 0, multisportChildCount: this.listed ? 5 : 0 };
	}
	async activities(start = 0, limit = 20): Promise<Activity[]> {
		this.guard(`activities:${start}:${limit}`);
		return start === this.listed - 1 ? ([{ activityId: 1, startTimeLocal: `${this.firstActivity} 07:57:31` }] as Activity[]) : [];
	}
	async weeklySteps(end: string, weeks = 52): Promise<WeeklyStepsRow[]> {
		this.guard(`weekly:${end}`);
		const rows: WeeklyStepsRow[] = [];
		const start = shiftDate(end, -(weeks * 7 - 1));
		for (let week = start; week <= end; week = shiftDate(week, 7)) {
			const last = shiftDate(week, 6);
			if (!this.first || last < this.first) continue;
			let days = 0;
			for (let d = week; d <= last && d <= end; d = shiftDate(d, 1)) if (d >= this.first) days += 1;
			rows.push({ calendarDate: week, values: { totalSteps: days * 10000, wellnessDataDaysCount: days } });
		}
		return rows;
	}
	async dailyStepStats(start: string, end: string): Promise<DailyStepStat[]> {
		this.guard(`daily:${start}:${end}`);
		const rows: DailyStepStat[] = [];
		for (let d = start; d <= end; d = shiftDate(d, 1)) if (this.first && d >= this.first) rows.push({ calendarDate: d, totalSteps: 10000 });
		return rows;
	}
}

describe("account scan", () => {
	it("finds the last upload, the oldest activity and the first day in a request a year and four more", async () => {
		const source = new FakeAccount("2025-08-02");
		const steps: string[] = [];
		const got = await scanAccount(source, { today: TODAY, now: () => new Date("2026-10-14T06:00:00Z"), onStep: (s) => steps.push(s.step) });
		assert.deepEqual(source.calls, [
			"mylastused",
			"count",
			"activities:340:1",
			"weekly:2026-10-14",
			"weekly:2025-10-15",
			"weekly:2024-10-16",
			"daily:2025-07-31:2025-08-06",
		]);
		assert.equal(got.requests, 7);
		assert.equal(got.fatal, undefined);
		const { scan } = got;
		assert.equal(scan.lastUpload, "2026-10-14T02:12:00.000Z");
		assert.equal(scan.firstActivity, "2025-08-03");
		assert.equal(scan.activities, 341);
		assert.equal(scan.firstDay, "2025-08-02");
		assert.equal(scan.days, 439);
		assert.deepEqual(scan.weeks[0], ["2025-07-31", 5]);
		assert.equal(scan.complete, true);
		assert.deepEqual(steps, ["upload", "activities", "health", "health", "health"]);
	});

	it("keeps walking an empty year that is newer than the oldest activity", async () => {
		// Steps start years after the first run: the empty years between are walked through, until one reaches past the run.
		const source = new FakeAccount("2026-03-01", 10, "2023-06-01");
		const got = await scanAccount(source, { today: TODAY });
		assert.deepEqual(source.calls.filter((c) => c.startsWith("weekly")), ["weekly:2026-10-14", "weekly:2025-10-15", "weekly:2024-10-16", "weekly:2023-10-18"]);
		assert.equal(got.scan.firstDay, "2026-03-01");
		assert.equal(got.scan.complete, true);
	});

	it("asks nothing more of an empty account", async () => {
		const source = new FakeAccount(null, 0);
		const got = await scanAccount(source, { today: TODAY });
		assert.deepEqual(source.calls, ["mylastused", "count", "weekly:2026-10-14"]);
		assert.deepEqual([got.scan.days, got.scan.activities, got.scan.firstDay, got.scan.complete], [0, 0, undefined, true]);
	});

	it("needs no request to pin a first week that is full", async () => {
		const source = new FakeAccount("2025-07-31");
		const got = await scanAccount(source, { today: TODAY });
		assert.ok(!source.calls.some((c) => c.startsWith("daily")));
		assert.equal(got.scan.firstDay, "2025-07-31");
	});

	it("stops at a 429 with what it found, not complete", async () => {
		const source = new FakeAccount("2023-01-01");
		const slow = new GarminRateLimitError("slow down", 30);
		source.fail["weekly:2024-10-16"] = slow;
		const got = await scanAccount(source, { today: TODAY });
		assert.equal(got.fatal, slow);
		assert.equal(got.scan.complete, false);
		assert.ok(got.scan.days > 700);
		assert.equal(got.scan.firstDay, got.scan.weeks[0]![0]);
	});

	it("says what failed and stops the weeks there, since a failed year says nothing of the ones before", async () => {
		const source = new FakeAccount("2023-01-01");
		source.fail["mylastused"] = new GarminApiError("mylastused: HTTP 500", 500, "");
		source.fail["weekly:2025-10-15"] = new GarminApiError("weekly: HTTP 500", 500, "");
		const got = await scanAccount(source, { today: TODAY });
		assert.equal(got.fatal, undefined);
		assert.equal(got.errors.length, 2);
		assert.equal(got.scan.lastUpload, undefined);
		assert.equal(got.scan.complete, false);
		assert.ok(!source.calls.includes("weekly:2024-10-16"));
	});
});

describe("what a scan tells the estimates", () => {
	const scan = {
		scannedAt: "2026-10-14T06:00:00.000Z",
		days: 19,
		weeks: [
			["2025-07-31", 5],
			["2025-08-07", 7],
			["2025-08-14", 7],
		] as Array<[string, number]>,
		activities: 3,
		firstDay: "2025-08-02",
		firstActivity: "2025-08-03",
		complete: true,
	};

	it("starts the history at the earlier of the first day and the first activity", () => {
		assert.equal(historyStart(scan), "2025-08-02");
		assert.equal(historyStart({ ...scan, firstActivity: "2025-07-01" }), "2025-07-01");
		assert.equal(historyStart(null), undefined);
	});

	it("counts the days with data from a day on", () => {
		assert.equal(daysSince(scan, "2025-01-01"), 19);
		assert.equal(daysSince(scan, "2025-08-07"), 14);
		// A week straddling the day counts its days from then on.
		assert.equal(daysSince(scan, "2025-08-10"), 4 + 7);
		assert.equal(daysSince(scan, "2026-01-01"), 0);
	});

	it("round-trips scan.json, and refuses another version", () => {
		assert.deepEqual(parseScan(serializeScan(scan)), scan);
		// What the download learned of the account rides along, read by allowlist.
		const learned = { ...scan, learned: { masks: { body: "trusted" as const, hrv: 2 } } };
		assert.deepEqual(parseScan(serializeScan(learned)), learned);
		assert.deepEqual(parseScan(serializeScan({ ...scan, learned: { masks: { body: "maybe" } } } as never)), scan);
		assert.equal(parseScan(JSON.stringify({ ...scan, version: 2 })), null);
		assert.equal(parseScan("nope"), null);
	});
});
