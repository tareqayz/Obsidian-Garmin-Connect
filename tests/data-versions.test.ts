import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ACCOUNT, ACTIVITIES, activityKey, DataVersions, DAYS, keysOfPath, SERIES, seriesKey, SETTLE_MS, type DataPaths } from "../src/dashboard/data-versions";
import { VirtualClock } from "./support/virtual-clock";

function setup(hold: () => number | null = () => null) {
	const clock = new VirtualClock(1_000_000);
	const moved: Array<[string, number]> = [];
	const data = new DataVersions({
		holdUntil: () => hold(),
		moved: (key, version) => moved.push([key, version]),
		now: clock.now,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	return { clock, moved, data };
}

describe("DataVersions", () => {
	it("moves a version once a burst of events settles", async () => {
		const { clock, moved, data } = setup();
		data.bump(DAYS);
		data.bump(DAYS);
		data.bump(DAYS);
		await clock.runUntil(() => moved.length > 0, SETTLE_MS);
		assert.deepEqual(moved, [[DAYS, 1]]);
		assert.equal(data.version(DAYS), 1);
	});

	it("shares a read per version, and reads again once it moves", async () => {
		const { clock, moved, data } = setup();
		let reads = 0;
		const load = () => Promise.resolve(++reads);
		assert.deepEqual(await Promise.all([data.cached(DAYS, load), data.cached(DAYS, load), data.cached(DAYS, load)]), [1, 1, 1]);
		data.bump(DAYS);
		await clock.runUntil(() => moved.length > 0, SETTLE_MS);
		assert.equal(await data.cached(DAYS, load), 2);
	});

	it("tries a failed read again on the next ask", async () => {
		const { data } = setup();
		await assert.rejects(data.cached(ACCOUNT, () => Promise.reject(new Error("unreadable"))));
		assert.equal(await data.cached(ACCOUNT, () => Promise.resolve("read")), "read");
	});

	it("holds a move while a sync writes, then lets it go when the sync ends", async () => {
		let syncing = true;
		const { clock, moved, data } = setup(() => (syncing ? clock.now() + 30_000 : null));
		data.bump(SERIES);
		data.bump(SERIES);
		syncing = false;
		data.syncEnded();
		await clock.runUntil(() => moved.length > 0, SETTLE_MS);
		assert.deepEqual(moved, [[SERIES, 1]]);
	});

	it("drops its timers on dispose", async () => {
		const { clock, moved, data } = setup();
		data.bump(DAYS);
		data.dispose();
		await assert.rejects(clock.runUntil(() => moved.length > 0, 1_000));
		assert.deepEqual(moved, []);
	});
});

describe("keysOfPath", () => {
	const DATA = "Garmin/data";
	const store: DataPaths = {
		dayIndexOf: (path) => (path.startsWith(`${DATA}/stress/`) ? { kind: "stress" } : undefined),
		owns: (path) => path.startsWith(`${DATA}/`) && !path.startsWith(`${DATA}/activity-details/`),
		isSeriesPath: (path) => path.startsWith(`${DATA}/series/`),
		dayCoveragePath: `${DATA}/days/index.json`,
		detailCoveragePath: `${DATA}/activity-details/index.json`,
		sleepFolder: `${DATA}/sleep`,
		dailyStatsFolder: `${DATA}/daily-stats`,
		daysFolder: `${DATA}/days`,
		accountPath: `${DATA}/account.json`,
		activitiesFolder: `${DATA}/activities`,
		activityDetailsFolder: `${DATA}/activity-details`,
	};

	it("names what a path moves, and whether Home rebuilds", () => {
		assert.deepEqual(keysOfPath(store, `${DATA}/stress/2026.json`), { keys: ["stress"], rebuild: false });
		assert.deepEqual(keysOfPath(store, `${DATA}/series/2026-10-28.json`), { keys: [SERIES, seriesKey("2026-10-28")], rebuild: true });
		assert.deepEqual(keysOfPath(store, `${DATA}/days/2026.json`), { keys: [DAYS], rebuild: true });
		assert.deepEqual(keysOfPath(store, `${DATA}/account.json`), { keys: [ACCOUNT], rebuild: true });
		assert.deepEqual(keysOfPath(store, `${DATA}/sleep/2026.json`), { keys: ["sleep"], rebuild: true });
		assert.deepEqual(keysOfPath(store, `${DATA}/daily-stats/index.json`), { keys: ["daily-stats"], rebuild: true });
		assert.deepEqual(keysOfPath(store, `${DATA}/activities/2026.json`), { keys: [ACTIVITIES], rebuild: true });
		// An activity's details: for a card showing that activity; Home's pages load their own.
		assert.deepEqual(keysOfPath(store, `${DATA}/activity-details/12.json`), { keys: [activityKey(12)], rebuild: false });
	});

	it("ignores the coverage files and everything the store doesn't write", () => {
		assert.deepEqual(keysOfPath(store, `${DATA}/days/index.json`), { keys: [], rebuild: false });
		assert.deepEqual(keysOfPath(store, `${DATA}/activity-details/index.json`), { keys: [], rebuild: false });
		assert.deepEqual(keysOfPath(store, "Daily/2026-10-28.md"), { keys: [], rebuild: false });
	});
});
