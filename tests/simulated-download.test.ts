import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { App } from "obsidian";
import { GarminApi, toIsoDate, type Activity } from "../src/garmin/endpoints";
import { MemoryTokenStore } from "../src/garmin/tokens";
import { DEFAULT_SETTINGS, defaultData, type GarminSettings } from "../src/settings-data";
import type { DetailProfile } from "../src/sync/cost";
import { costContext, unitsOf } from "../src/sync/cost";
import { ACTIVITY_DETAILS_KEY, DAY_DETAILS_KEY, type ActivityDetailsRange, type DayDetailsRange } from "../src/sync/datasets";
import { shiftDate } from "../src/sync/day-index";
import { DAY_INDEXES } from "../src/sync/day-indexes";
import { fetchDailyStatsHistory, fetchSleepHistory, walkHistory } from "../src/sync/engine";
import { estimate } from "../src/sync/estimate";
import { MISSES_TO_LEARN } from "../src/sync/horizons";
import { ALL_GROUPS } from "../src/sync/metrics";
import { PACE } from "../src/sync/pace";
import { BUDGET_KEY, SyncRunner } from "../src/sync/runner";
import { VaultSeriesStore } from "../src/sync/series-store";
import { activitiesOf, MEASURED, scanOf } from "./support/account-fixture";
import { FakeGarmin, listRow } from "./support/fake-garmin";
import { MemoryVault } from "./support/memory-vault";
import { VirtualClock } from "./support/virtual-clock";

/**
 * The estimate against the download itself: the real runner, engine, client,
 * throttle and hourly budget, run against a Garmin that answers every request
 * in `LATENCY` seconds, on a clock that only moves when nothing else can.
 */
const LATENCY = 0.25;

interface Scenario {
	days: number;
	activities: Partial<Record<DetailProfile, number>>;
	accepted: string[];
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
	/** Requests the hour spent already, and how long ago. */
	spent?: { requests: number; ago: number };
	/** The weight index whole, with weigh-ins on these days, and its mask trusted: the other days ask no weigh-in. */
	weighIns?: string[];
	/** The mask not yet trusted: the download checks it first. */
	unchecked?: boolean;
}

interface Snapshot {
	at: number;
	share: number;
	seconds?: number;
}

async function simulate(s: Scenario): Promise<{ seconds: number; requests: number; lookups: number; predicted: { seconds: number; requests: number }; end: number; snapshots: Snapshot[]; weighIns: string[]; verdicts: Record<string, unknown>; horizon: number | null | undefined }> {
	const clock = new VirtualClock(Date.now());
	clock.install();
	try {
		const today = toIsoDate();
		const first = shiftDate(today, -(s.days - 1));
		const activities = activitiesOf(first, today, s.activities);
		const byId = new Map(activities.map((a) => [a.id, a]));

		const vault = new MemoryVault();
		const local = new Map<string, unknown>();
		if (s.spent) local.set(BUDGET_KEY, { entries: [{ at: clock.now() - s.spent.ago, requests: s.spent.requests }] });
		const app = { vault, loadLocalStorage: (key: string) => local.get(key) ?? null, saveLocalStorage: (key: string, value: unknown) => local.set(key, value) } as unknown as App;
		const store = new VaultSeriesStore(app, "Garmin/data");
		const scan = scanOf(first, today, new Set(), activities.length);
		await store.writeScan(scan);
		if (s.weighIns) {
			const weight = DAY_INDEXES.find((d) => d.kind === "weight")!;
			const rows = s.weighIns.map((date) => weight.normalize({ date, w: 72_000 })!);
			await store.mergeDayIndex(weight, { rows, dates: s.weighIns }, { covered: { from: first, to: today }, complete: true });
			if (!s.unchecked) await store.writeVerdicts({ body: "trusted" });
		}
		await store.mergeActivities(activities.map(listRow) as unknown as Activity[], { complete: true, units: "metric", total: activities.length });

		const settings: GarminSettings = {
			...DEFAULT_SETTINGS,
			units: "metric",
			setup: { completedAt: `${today}T00:00:00.000Z` },
			data: { ...defaultData(), dayDetails: s.dayDetails, activityDetails: s.activityDetails, accepted: s.accepted },
		};
		const http = new FakeGarmin(clock, LATENCY * 1000, activities);
		const tokens = new MemoryTokenStore();
		await tokens.save({ refreshToken: "refresh", diClientId: "client", savedAt: 1 });
		const api = new GarminApi({ http, store: tokens, now: clock.now, wait: clock.wait, limits: PACE.limits });
		await api.restore();
		const runner = new SyncRunner(app, api, () => settings, (row) => byId.get(row.id)!, { id: "sim", label: "Sim" });

		// What the setup would say, from the files the download plans from.
		const [coverage, charts, index, detailFiles] = await Promise.all([store.readDayCoverage(true), store.readChartMetas(), store.readActivities(), store.readDetailCoverage()]);
		const masks = await store.readMasks(settings.groups, charts, await store.readScan());
		const predicted = estimate({
			today,
			groups: settings.groups,
			accepted: s.accepted,
			dayDetails: s.dayDetails,
			activityDetails: s.activityDetails,
			since: today,
			scan,
			daySpans: coverage.spans,
			charts,
			activities: index.rows.map((row) => byId.get(row.id)!),
			detailFiles,
			masks,
			budget: runner.budgetOutlook(),
			now: clock.now(),
			latency: { window: LATENCY, batch: LATENCY, overhead: 0 },
		});

		const started = clock.now();
		let seen = false;
		let done = false;
		const snapshots: Snapshot[] = [];
		runner.onBackfill((progress) => {
			if (progress) seen = true;
			else if (seen) done = true;
			if (progress?.status === "running") snapshots.push({ at: clock.now(), share: progress.done / Math.max(1, progress.done + progress.remaining), ...(progress.seconds !== undefined ? { seconds: progress.seconds } : {}) });
		});
		runner.kickBackfill();
		await clock.runUntil(() => done, 48 * 3_600_000);
		// The account's profile is looked up once a session, not once a download: counted apart.
		const lookups = http.asked.filter((url) => url.includes("/socialProfile")).length;
		// The days a weigh-in was asked for: the route takes the day in its path.
		const weighIns = http.asked.map((url) => /\/weight-service\/weight\/dayview\/(\d{4}-\d{2}-\d{2})/.exec(url)?.[1]).filter((d): d is string => !!d);
		const learned = (await store.readScan())?.learned;
		const verdicts = learned?.masks ?? {};
		return { seconds: (clock.now() - started) / 1000, requests: http.asked.length - lookups, lookups, predicted: { seconds: predicted.seconds, requests: predicted.requests }, end: clock.now(), snapshots, weighIns, verdicts, horizon: learned?.horizon?.days };
	} finally {
		clock.uninstall();
	}
}

function within(actual: number, expected: number, share: number): boolean {
	return Math.abs(actual - expected) <= share * expected;
}

describe("a simulated download against its estimate", () => {
	it("Day details: 90 days, the requests exact and the time within 10%", async () => {
		const got = await simulate({ days: 120, activities: { run: 20 }, accepted: [DAY_DETAILS_KEY], dayDetails: "90d", activityDetails: "opened" });
		assert.equal(got.requests, got.predicted.requests);
		assert.equal(got.lookups, 1);
		assert.ok(within(got.seconds, got.predicted.seconds, 0.1), `${got.seconds} s against ${got.predicted.seconds} s`);
	});

	it("Day details with the weigh-in mask trusted: no weigh-in asked but on weigh-in days, and the requests still exact", async () => {
		const today = toIsoDate();
		const weighIns = [shiftDate(today, -3), shiftDate(today, -40)];
		const got = await simulate({ days: 60, activities: { run: 5 }, accepted: [DAY_DETAILS_KEY], dayDetails: "all", activityDetails: "opened", weighIns });
		assert.equal(got.requests, got.predicted.requests);
		assert.deepEqual(got.weighIns.sort(), [...weighIns].sort());
	});

	it("checks a mask before it trusts it: the first chunk asks every day, then only the weigh-in days", async () => {
		const today = toIsoDate();
		const weighIns = [shiftDate(today, -3), shiftDate(today, -40)];
		const got = await simulate({ days: 60, activities: { run: 5 }, accepted: [DAY_DETAILS_KEY], dayDetails: "all", activityDetails: "opened", weighIns, unchecked: true });
		assert.equal(got.verdicts.body, "trusted");
		// The first chunk's days, newest first, then the older weigh-in alone.
		const first = got.weighIns.filter((d) => d !== shiftDate(today, -40));
		assert.ok(first.length >= 5 && first.length <= 13, String(first.length));
		assert.ok(got.weighIns.includes(shiftDate(today, -40)));
		// The estimate reckoned the mask trusted from the start: the check is the difference.
		assert.equal(got.requests - got.predicted.requests, got.weighIns.length - weighIns.length);
	});

	it("learns Garmin's horizon: after a few days past it come back without timelines, it stops asking them", async () => {
		const got = await simulate({ days: 240, activities: { run: 5 }, accepted: [DAY_DETAILS_KEY], dayDetails: "all", activityDetails: "opened" });
		// The fake keeps 140 days, as Garmin was seen to.
		assert.equal(got.horizon, 140);
		// The estimate reckoned with the horizon from the start: learning it costs the misses that showed it,
		// the rest of their chunk, and one day asked again to check it.
		const extra = got.requests - got.predicted.requests;
		assert.ok(extra >= (MISSES_TO_LEARN + 1) * 4 && extra <= (MISSES_TO_LEARN + 13 + 1) * 4, String(extra));
	});

	it("learns the download's own pace: halfway, the time left is within 10%", async () => {
		// The runner reckons with Garmin's measured latency; this one answers faster.
		const got = await simulate({ days: 200, activities: { run: 10 }, accepted: [DAY_DETAILS_KEY], dayDetails: "all", activityDetails: "opened" });
		const halfway = got.snapshots.find((s) => s.share >= 0.5)!;
		const left = (got.end - halfway.at) / 1000;
		assert.ok(halfway.seconds !== undefined && within(halfway.seconds, left, 0.1), `${halfway.seconds} s said, ${left} s taken`);
	});

	it("Activity details: 120 activities of every kind, the requests exact and the time within 10%", async () => {
		const got = await simulate({
			days: 365,
			activities: { run: 60, indoorRun: 10, ride: 12, gpsOther: 8, pool: 15, gym: 15 },
			accepted: [ACTIVITY_DETAILS_KEY],
			dayDetails: "new",
			activityDetails: "all",
		});
		assert.equal(got.requests, got.predicted.requests);
		assert.equal(got.lookups, 1);
		assert.ok(within(got.seconds, got.predicted.seconds, 0.1), `${got.seconds} s against ${got.predicted.seconds} s`);
	});

	it("both, starting from an hour nearly spent: it waits as the estimate says", async () => {
		const got = await simulate({
			days: 60,
			activities: { run: 30, pool: 10 },
			accepted: [DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY],
			dayDetails: "all",
			activityDetails: "all",
			spent: { requests: 7_800, ago: 30 * 60_000 },
		});
		assert.equal(got.requests, got.predicted.requests);
		assert.equal(got.lookups, 1);
		// Half an hour's wait for the hour to free up, then the download.
		assert.ok(got.seconds > 30 * 60, String(got.seconds));
		assert.ok(within(got.seconds, got.predicted.seconds, 0.1), `${got.seconds} s against ${got.predicted.seconds} s`);
	});
});

describe("the engine's history walks against the cost model", () => {
	const ctx = costContext({ today: MEASURED.today, groups: ALL_GROUPS, scan: MEASURED.scan, charts: new Map(), activities: MEASURED.activities, detailFiles: new Map() });
	const notBefore = ctx.notBefore!;
	/** A day the scan saw data on: the windows that hold one answer with a row. */
	const withData = (start: string, end: string) => MEASURED.scan.weeks.some(([week, n]) => n > 0 && week <= end && shiftDate(week, 6) >= start && end >= MEASURED.first);
	const modelled = (store: string) => unitsOf([{ kind: "walk", store }], ctx).reduce((n, u) => n + u.requests, 0);

	it("daily stats: three requests a window with steps, one without, back past the history's start", async () => {
		const got = await fetchDailyStatsHistory(
			{
				dailyStepStats: async (start: string, end: string) => (withData(start, end) ? [{ calendarDate: end, values: { totalSteps: 5_000, stepGoal: 8_000, totalDistance: 4_000 } }] : []),
				dailyFloorStats: async () => [],
				dailyIntensityStats: async () => [],
			} as never,
			{ until: MEASURED.today, notBefore, maxWindows: 400 },
		);
		assert.equal(got.requests, modelled("daily-stats"));
	});

	it("sleep: a request a window, back past the history's start", async () => {
		const got = await fetchSleepHistory({ sleepStats: async (start: string, end: string) => (withData(start, end) ? [{ calendarDate: end, values: { sleepScore: 80 } }] : []) } as never, {
			until: MEASURED.today,
			notBefore,
			maxWindows: 400,
		});
		assert.equal(got.requests, modelled("sleep"));
	});

	it("a registered index: its windows reach the history's start, and its empty ones end it", async () => {
		for (const kind of ["stress", "health-status", "hrv-status", "ftp", "weight", "body-battery", "respiration"]) {
			const def = DAY_INDEXES.find((d) => d.kind === kind)!;
			// A row the index keeps: the date and its first number column.
			const column = def.keys.find((key) => !(def.columns as Record<string, { text?: boolean }>)[key]?.text)!;
			const got = await walkHistory(def, async (start, end) => (withData(start, end) ? [{ date: end, [column]: 1 } as never] : []), { until: MEASURED.today, today: MEASURED.today, notBefore, maxWindows: 400 });
			// The model reckons every window back to the start had data, so the empty ones still follow.
			assert.equal(got.requests, modelled(`index:${kind}`), kind);
		}
	});
});
