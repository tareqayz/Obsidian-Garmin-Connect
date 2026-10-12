import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { daysBetween } from "../src/dashboard/periods";
import type { BiometricChange, GarminApi } from "../src/garmin/endpoints";
import { GarminApiError } from "../src/garmin/errors";
import type { DayIndexBatch } from "../src/sync/day-index";
import { syncRange, walkHistory, type DayIndexSink, type DayTarget, type SyncSource } from "../src/sync/engine";
import { FTP_INDEX, FTP_SERIES, WKG_COLUMN, rowsOfRanges, type FtpRow } from "../src/sync/ftp-index";
import { CHANGES, specRows, wattsPayload, wkgPayload } from "./ftp-fixture";

/*
 * The FTP index against the routes as Garmin answered them on 2026-10-12
 * (ref/performance-stats/ftp/README.md, "Data plan"; the rows in
 * ftp-fixture.ts).
 */

/**
 * The two routes as Garmin answers them: the fixture's rows for the window,
 * and HTTP 400 past the cap (end − start ≤ 366 days), as the probes found.
 */
function ftpApi(calls: string[], fail?: "watts" | "wkg"): GarminApi {
	const cap = (start: string, end: string) => {
		if (daysBetween(start, end) > 366) throw new GarminApiError("HTTP 400", 400, "");
	};
	return {
		functionalThresholdPowerRange: async (start: string, end: string, sport?: string) => {
			calls.push(`watts ${start} ${end}${sport ? ` ${sport}` : ""}`);
			cap(start, end);
			if (fail === "watts") throw new GarminApiError("HTTP 500", 500, "");
			return wattsPayload(start, end);
		},
		powerToWeightRange: async (start: string, end: string, aggregation: string, sport?: string) => {
			calls.push(`wkg ${start} ${end} ${aggregation}${sport ? ` ${sport}` : ""}`);
			cap(start, end);
			if (fail === "wkg") throw new GarminApiError("HTTP 500", 500, "");
			return wkgPayload(start, end);
		},
	} as unknown as GarminApi;
}

const window = async (start: string, end: string, calls: string[] = []) =>
	(await FTP_INDEX.fetchWindow(ftpApi(calls), start, end)).map((r) => FTP_INDEX.normalize(r)!);

/** The spec's example row: the 2026-10-08 weigh-in, every sport. */
const OCT_8: FtpRow = { date: "2026-10-08", cycling: 274, cyclingWkg: 4.0294, xc: 111, xcWkg: 1.6324, running: 354, runningWkg: 5.2059 };

describe("FTP_INDEX — the definition", () => {
	it("is the ftp index of the fitness group: 367 days a window, two empty windows end the walk, nothing refreshed", () => {
		assert.deepEqual(
			[FTP_INDEX.kind, FTP_INDEX.folder, FTP_INDEX.title, FTP_INDEX.group, FTP_INDEX.version, FTP_INDEX.listKey],
			["ftp", "ftp", "FTP", "fitness", 1, "days"],
		);
		assert.deepEqual([FTP_INDEX.windowDays, FTP_INDEX.refreshDays, FTP_INDEX.emptyWindowsToStop, FTP_INDEX.keepOld], [367, 0, 2, false]);
		// Each window asks two routes, and is booked as two requests.
		assert.equal(FTP_INDEX.requestsPerWindow, 2);
		assert.equal(FTP_INDEX.maxHistoryDays, undefined);
		// The day sync never asks these routes: no free feed.
		assert.equal(FTP_INDEX.fromDay, undefined);
		assert.equal(FTP_INDEX.fromSummary, undefined);
		assert.deepEqual(FTP_INDEX.keys, ["cycling", "cyclingWkg", "xc", "xcWkg", "running", "runningWkg"]);
	});

	it("names each of Garmin's series, and each sport's W/kg column", () => {
		assert.deepEqual(FTP_SERIES, { cycling: "cycling", cross_country_skiing: "xc", running: "running" });
		assert.deepEqual(WKG_COLUMN, { cycling: "cyclingWkg", xc: "xcWkg", running: "runningWkg" });
	});

	it("writes a year file a row a line, the watts whole and the W/kg to 4 dp", () => {
		const rows = rowsOfRanges(wattsPayload("2026-10-01", "2026-10-11"), wkgPayload("2026-10-01", "2026-10-11")).map((r) => FTP_INDEX.normalize(r)!);
		const text = FTP_INDEX.serializeYear("2026", rows);
		assert.equal(
			text,
			'{\n\t"version": 1,\n\t"year": 2026,\n\t"days": [\n' +
				'\t\t{"date":"2026-10-08","cycling":274,"cyclingWkg":4.0294,"xc":111,"xcWkg":1.6324,"running":354,"runningWkg":5.2059}\n\t]\n}\n',
		);
		assert.deepEqual(FTP_INDEX.parseYear(text), [OCT_8]);
	});
});

describe("FTP_INDEX — a window", () => {
	it("asks the watts, then the W/kg, both daily and without a sport, for the same window", async () => {
		const calls: string[] = [];
		await window("2025-10-10", "2026-10-11", calls);
		assert.deepEqual(calls, ["watts 2025-10-10 2026-10-11", "wkg 2025-10-10 2026-10-11 daily"]);
	});

	it("merges the two routes by day: one row a day, each sport's W and W/kg side by side", async () => {
		const rows = await window("2025-10-13", "2026-10-11");
		// 30 rows of each route on 24 days.
		assert.equal(wattsPayload("2025-10-13", "2026-10-11").length, 30);
		assert.equal(rows.length, 24);
		assert.deepEqual(rows.at(-1), OCT_8);
		// 274 ÷ 67.199, the 2025-10-13 weigh-in: the 1y's higher first W/kg dot.
		assert.deepEqual(rows[0], { date: "2025-10-13", cycling: 274, cyclingWkg: 4.0774, xc: 111, xcWkg: 1.6518, running: 380, runningWkg: 5.6548 });
		// A running-only change.
		assert.deepEqual(rows.find((r) => r.date === "2026-09-19"), { date: "2026-09-19", running: 354, runningWkg: 5.2059 });
	});

	it("holds the whole history as the spec's fixture has it: 35 days from 2025-08-02, 15 in 2025, 20 in 2026", async () => {
		const rows = [...(await window("2024-10-08", "2025-10-09")), ...(await window("2025-10-10", "2026-10-11"))];
		assert.equal(CHANGES.length, 46);
		assert.deepEqual(rows, specRows());
		assert.deepEqual([rows.length, rows.filter((r) => r.date < "2026").length, rows[0]!.date], [35, 15, "2025-08-02"]);
	});

	it("keeps change points: an FTP change gives its sport a row, a weigh-in every sport", async () => {
		const rows = [...(await window("2024-10-08", "2025-10-09")), ...(await window("2025-10-10", "2026-10-11"))];
		const count = (key: keyof FtpRow) => rows.filter((r) => r[key] !== undefined).length;
		assert.deepEqual([count("cycling"), count("xc"), count("running")], [8, 5, 33]);
		// The weigh-ins (2025-08-02, 08-03, 10-13, 11-02, 2026-10-08) are exactly the days with all three.
		const whole = rows.filter((r) => r.cycling !== undefined && r.xc !== undefined && r.running !== undefined).map((r) => r.date);
		assert.deepEqual(whole, ["2025-08-02", "2025-08-03", "2025-10-13", "2025-11-02", "2026-10-08"]);
		// The cycling FTP's own changes: 186 → 221 → 224 → 227 → 274.
		assert.deepEqual(
			rows.filter((r) => r.cycling !== undefined && r.xc === undefined).map((r) => `${r.date} ${r.cycling}`),
			["2025-09-01 221", "2025-09-06 224", "2025-09-15 227"],
		);
		// Cycling holds 274 W from 2025-11-02 to 2026-10-08 without a row: 340 days.
		assert.equal(daysBetween("2025-11-02", "2026-10-08"), 340);
		assert.ok(!rows.some((r) => r.cycling !== undefined && r.date > "2025-11-02" && r.date < "2026-10-08"));
	});

	it("finds no row in a window without a change", async () => {
		assert.deepEqual(await window("2023-10-07", "2024-10-07"), []);
		// No sport changed and nobody weighed in between Nov 10 and Jan 15.
		assert.deepEqual(await window("2025-11-11", "2026-01-14"), []);
	});

	it("fails the whole window if either request fails, so the window is asked again", async () => {
		const calls: string[] = [];
		await assert.rejects(() => FTP_INDEX.fetchWindow(ftpApi(calls, "watts"), "2025-10-10", "2026-10-11"), GarminApiError);
		// One after the other: the W/kg isn't asked once the watts failed.
		assert.deepEqual(calls, ["watts 2025-10-10 2026-10-11"]);
		await assert.rejects(() => FTP_INDEX.fetchWindow(ftpApi([], "wkg"), "2025-10-10", "2026-10-11"), GarminApiError);
	});
});

describe("rowsOfRanges", () => {
	const at = (day: string, series: string, value: unknown, extra: Partial<BiometricChange> = {}) =>
		({ from: day, until: day, series, value, updatedDate: day, ...extra }) as BiometricChange;

	it("dates a row by its from, else its updatedDate, and reads the series case-insensitively", () => {
		const rows = rowsOfRanges([at("2026-10-08", "CYCLING", 274), { series: "running", value: 354, updatedDate: "2026-10-08T00:00:00" }], [at("2026-10-08", "Cycling", 4.0294)]);
		assert.deepEqual(rows, [{ date: "2026-10-08", cycling: 274, cyclingWkg: 4.0294, running: 354 }]);
	});

	it("leaves out a series it doesn't know, a row without a day, and what is null", () => {
		const rows = rowsOfRanges(
			[at("2026-10-08", "rowing", 200), at("2026-10-08", "cycling", null), { series: "cycling", value: 274 }, null],
			[at("2026-10-08", "cycling", 4.0294)],
		).map((r) => FTP_INDEX.normalize(r));
		assert.deepEqual(rows, [{ date: "2026-10-08", cyclingWkg: 4.0294 }]);
		assert.deepEqual(rowsOfRanges(null, undefined), []);
	});
});

describe("FTP_INDEX — the history walk", () => {
	it("walks the whole history in four windows, eight requests: two with rows, then two empty", async () => {
		const calls: string[] = [];
		const api = ftpApi(calls);
		const windows: string[] = [];
		const walk = await walkHistory(FTP_INDEX, (start, end) => (windows.push(`${start} ${end}`), FTP_INDEX.fetchWindow(api, start, end)), { until: "2026-10-11" });
		assert.deepEqual(windows, ["2025-10-10 2026-10-11", "2024-10-08 2025-10-09", "2023-10-07 2024-10-07", "2022-10-05 2023-10-06"]);
		// Every window is 367 calendar days, inside the cap — across Feb 29, 2024 too.
		for (const w of windows) assert.equal(daysBetween(w.slice(0, 10), w.slice(11)), 366);
		assert.deepEqual([walk.complete, walk.error, walk.batch.rows.length], [true, undefined, 35]);
		// Two requests a window, booked as such.
		assert.equal(calls.length, 8);
		assert.equal(walk.requests, 8);
		assert.deepEqual(walk.covered, { from: "2022-10-05", to: "2026-10-11" });
	});
});

describe("FTP_INDEX — a routine sync", () => {
	/** The fitness group's own day sync: max metrics and hill scores for the run, endurance and fitness age a day. */
	function fitnessSource(calls: string[]): SyncSource {
		return new Proxy({} as SyncSource, {
			get: (_, name: string) => async (a?: string, b?: string) => {
				calls.push(`${name}:${a ?? ""}${b ? ` ${b}` : ""}`);
				if (name === "maxMetrics" || name === "hillScores") return [];
				if (name === "enduranceScore" || name === "fitnessAge") return null;
				throw new Error(`unexpected ${name}`);
			},
		});
	}

	class Sink implements DayIndexSink<FtpRow> {
		merged: Array<DayIndexBatch<FtpRow>> = [];
		constructor(public held: { from?: string; to?: string } | null) {}
		async coverage() {
			return this.held;
		}
		async merge(batch: DayIndexBatch<FtpRow>) {
			this.merged.push(batch);
			return 1;
		}
	}

	const target: DayTarget = { exists: () => true, write: async () => "written" };

	async function sync(from: string, to: string, held: { from?: string; to?: string } | null) {
		const source: string[] = [];
		const api: string[] = [];
		const sink = new Sink(held);
		const ftp = ftpApi(api);
		const report = await syncRange(fitnessSource(source), target, {
			from,
			to,
			groups: ["fitness"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: FTP_INDEX, sink, fetchWindow: (start, end) => FTP_INDEX.fetchWindow(ftp, start, end) }],
		});
		return { report, sink, api, source };
	}

	it("asks one window for the run's days: two requests, the watts and the W/kg", async () => {
		const { report, sink, api, source } = await sync("2026-10-05", "2026-10-11", { from: "2025-08-02", to: "2026-10-10" });
		assert.deepEqual(api, ["watts 2026-10-05 2026-10-11", "wkg 2026-10-05 2026-10-11 daily"]);
		// The report counts both: the day sync's own requests, then the index's two.
		assert.equal(report.requests - source.length, 2);
		assert.equal(sink.merged.length, 1);
		assert.deepEqual(sink.merged[0]!.rows, [OCT_8]);
		// Every day of the window was asked: a day without a change holds no row.
		const dates = [...sink.merged[0]!.dates].sort();
		assert.deepEqual([dates.length, dates[0], dates.at(-1)], [7, "2026-10-05", "2026-10-11"]);
	});

	it("reaches back to the index's newest day after a vault was left closed, still in one window", async () => {
		const { api } = await sync("2026-10-05", "2026-10-11", { from: "2025-08-02", to: "2026-09-20" });
		assert.deepEqual(api, ["watts 2026-09-21 2026-10-11", "wkg 2026-09-21 2026-10-11 daily"]);
	});

	it("asks nothing while the fitness group is off", async () => {
		const sink = new Sink(null);
		const api: string[] = [];
		const ftp = ftpApi(api);
		const nothing = new Proxy({} as SyncSource, { get: () => async () => null });
		await syncRange(nothing, target, {
			from: "2026-10-11",
			to: "2026-10-11",
			groups: ["sleep"],
			units: "metric",
			wait: async () => {},
			indexes: [{ def: FTP_INDEX, sink, fetchWindow: (start, end) => FTP_INDEX.fetchWindow(ftp, start, end) }],
		});
		assert.deepEqual(api, []);
		assert.equal(sink.merged.length, 0);
	});
});
