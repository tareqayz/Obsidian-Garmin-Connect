import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { averagesPlot, timelinePlot } from "../src/dashboard/respiration-charts";
import {
	respirationDayView,
	respirationPeriodView,
	respirationTicks,
	respirationView,
	type RespirationPageData,
	type RespirationRoute,
} from "../src/dashboard/respiration-pages";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import type { RespirationDay } from "../src/garmin/endpoints";
import { respirationDayOf, type RespirationRow } from "../src/sync/respiration-index";

/** The capture day (ref/health-stats/respiration/README.md). */
const TODAY = "2026-10-08";

/** awake/sleep from Aug 14, live 2026-10-08 03:18: "--" no row, "-" no night. */
const DAILY = `14/14 14/14 14/14 14/14 -- 14/- 14/14
14/14 14/14 14/14 14/13 14/14 14/14 15/14
14/14 14/14 14/14 14/14 14/14 13/14 14/13
13/13 13/12 14/13 14/13 14/13 14/13 13/14
13/14 14/- 14/14 14/14 16/14 13/15 14/-
13/13 14/14 14/14 13/14 15/14 15/14 14/14
14/14 14/14 15/14 16/14 14/14 13/15 13/14
13/14 13/14 14/13 14/14 14/14 14/14 13/-`;

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function indexRows(oct8Sleep?: number): RespirationRow[] {
	const rows: RespirationRow[] = [];
	DAILY.split(/\s+/).forEach((cell, i) => {
		if (cell === "--") return;
		const [awake, sleep] = cell.split("/");
		const row: RespirationRow = { date: shift("2026-08-14", i), awake: Number(awake) };
		if (sleep !== "-") row.sleep = Number(sleep);
		rows.push(row);
	});
	if (oct8Sleep !== undefined) rows[rows.length - 1]!.sleep = oct8Sleep;
	return rows;
}

const data = (rows = indexRows()): RespirationPageData => ({ rows, complete: true });
const route = (range: RespirationRoute["range"], offset = 0): RespirationRoute => ({ range, offset });

/** Oct 7's hourly rows, hour end in GMT from 22:00 Oct 6 (average/high/low, -2 no reading). */
const OCT7 =
	"13.91/17/9 13.68/19/11 14.66/17/10 14.01/19/11 14.18/17/11 12.75/17/8 13.45/17/11 14.07/19/10 14.04/18/11 14.83/18/12 13.91/19/10 12.81/18/8 13.18/17/8 14.25/19/10 14.87/21/9 15/20/11 15.32/20/7 13.84/19/9 13.62/17/8 -2 -2 13.82/19/7 13.46/18/7";

function oct7(): RespirationDay {
	const start = Date.parse("2026-10-06T21:00:00Z");
	return {
		calendarDate: "2026-10-07",
		startTimestampGMT: "2026-10-06T21:00:00.0",
		endTimestampGMT: "2026-10-07T20:00:00.0",
		startTimestampLocal: "2026-10-07T00:00:00.0",
		endTimestampLocal: "2026-10-08T00:00:00.0",
		sleepStartTimestampGMT: "2026-10-06T17:54:19.0",
		sleepEndTimestampGMT: "2026-10-07T03:54:19.0",
		lowestRespirationValue: 7,
		highestRespirationValue: 21,
		avgWakingRespirationValue: 14,
		respirationAveragesValuesArray: OCT7.split(" ").map((cell, i) => {
			const [avg, high, low] = cell.split("/").map(Number);
			return [start + (i + 1) * 3_600_000, avg!, high ?? null, low ?? null];
		}),
	};
}

/** Oct 8 as the web fetched it at 01:17. */
function oct8(): RespirationDay {
	return {
		startTimestampGMT: "2026-10-07T20:00:00.0",
		endTimestampGMT: "2026-10-07T21:08:00.0",
		startTimestampLocal: "2026-10-08T00:00:00.0",
		endTimestampLocal: "2026-10-08T01:08:00.0",
		lowestRespirationValue: 7,
		highestRespirationValue: 20,
		avgWakingRespirationValue: 13,
		respirationAveragesValuesArray: [
			[1791406800000, 13.32, 20, 7],
			[1791407280000, -2, null, null],
		],
	};
}

describe("respiration y axis", () => {
	it("follows the phone's five-gridline rule", () => {
		assert.deepEqual(respirationTicks(7, 20), [21, 17, 13, 9, 5]);
		assert.deepEqual(respirationTicks(7, 21), [22, 18, 14, 10, 6]);
		assert.deepEqual(respirationTicks(13, 14), [15, 14, 13, 12, 11]);
		assert.deepEqual(respirationTicks(13, 16), [18, 16, 14, 12, 10]);
		assert.deepEqual(respirationTicks(8, 42), [43, 34, 25, 16, 7]);
	});
});

describe("respiration 1d", () => {
	it("Oct 7: Lowest 7, Highest 21, Awake 14; 21 bars over a 23-hour day; the −2 hours break the line", () => {
		const view = respirationDayView({ data: data(indexRows(13)), route: route("1d", -1), today: TODAY, day: respirationDayOf(oct7()) });
		assert.equal(view.label, "Wednesday, October 7");
		assert.deepEqual(view.stats.map((s) => `${s.value} ${s.unit} ${s.label}`), ["7 brpm Lowest", "21 brpm Highest", "14 brpm Awake Avg"]);
		const t = view.timeline;
		assert.equal(t.hours, 23);
		assert.equal(t.bars.length, 21);
		assert.deepEqual(t.ticks, [22, 18, 14, 10, 6]);
		assert.equal(t.line.filter((p) => p.value === null).length, 2);
		assert.deepEqual(t.markers.map((m) => m.kind), ["wake"]);
		assert.ok(Math.abs(t.markers[0]!.x - (6 * 3600 + 54 * 60 + 19) / (23 * 3600)) < 1e-9);
		assert.equal(t.axis.labels.length, 2);
		assert.deepEqual(view.sleep.map((n) => `${n.weekday} ${n.value}`), ["Wednesday 14 brpm", "Thursday 13 brpm"]);
		assert.deepEqual(view.sleep.map((n) => n.sleepOffset), [-1, 0]);
	});

	it("Today at 01:17: 7 / 20 / 13, one bar at 01:00, the in-progress hour draws nothing", () => {
		const view = respirationDayView({ data: data(indexRows(13)), route: route("1d"), today: TODAY, day: respirationDayOf(oct8()) });
		assert.equal(view.label, "Today");
		assert.deepEqual(view.stats.map((s) => s.value), ["7", "20", "13"]);
		assert.equal(view.timeline.hours, 24);
		assert.deepEqual(view.timeline.bars, [{ x: 1 / 24, avg: 13.32, high: 20, low: 7 }]);
		assert.deepEqual(view.timeline.ticks, [21, 17, 13, 9, 5]);
		assert.deepEqual(view.sleep.map((n) => `${n.weekday} ${n.detail} ${n.value}`), ["Thursday Oct 8 13 brpm"]);
		assert.equal(view.timeline.axis.labels.map((l) => l.text).join(" "), "12 AM 4 AM 8 AM 12 PM 4 PM 8 PM 12 AM");
	});

	it("shows dashes while nothing is in", () => {
		const view = respirationDayView({ data: data([]), route: route("1d"), today: TODAY });
		assert.equal(view.timeline.state, "pending");
		assert.deepEqual(view.stats.map((s) => s.value), ["--", "--", "--"]);
		assert.equal(respirationDayOf({ startTimestampGMT: null } as RespirationDay), null);
	});
});

describe("respiration 7d and 4w", () => {
	const cases: Array<[RespirationRoute["range"], number, string, number[]]> = [
		["7d", 0, "Oct 2 - 8", [15, 14, 13, 12, 11]],
		["7d", -1, "Sep 25 - Oct 1", [18, 16, 14, 12, 10]],
		["4w", 0, "Sep 11 - Oct 8", [18, 16, 14, 12, 10]],
		["4w", -1, "Aug 14 - Sep 10", [17, 15, 13, 11, 9]],
	];
	for (const [range, offset, label, ticks] of cases) {
		it(`${label}: Sleep Avg 14, Awake Avg 14 (rounded)`, () => {
			const view = respirationPeriodView({ data: data(), route: route(range, offset), today: TODAY });
			assert.equal(view.label, label);
			assert.deepEqual(view.averages, { sleep: 14, awake: 14 });
			assert.deepEqual(view.ticks, ticks);
		});
	}

	it("4w-prev would floor to 13 / 13: the divisor is the days with a value", () => {
		const view = respirationPeriodView({ data: data(), route: route("4w", -1), today: TODAY });
		assert.equal(view.points.filter((p) => p.sleep !== null).length, 26);
		assert.equal(view.points.filter((p) => p.awake !== null).length, 27);
		const aug18 = view.days.find((d) => d.date === "2026-08-18")!;
		const aug19 = view.days.find((d) => d.date === "2026-08-19")!;
		assert.deepEqual([aug18.sleep, aug18.awake, aug19.sleep, aug19.awake], ["--", "--", "--", "14 brpm"]);
	});

	it("lists the days newest first, with today's partial values", () => {
		const view = respirationView({ data: data(indexRows(13)), route: route("7d"), today: TODAY });
		if (view.range !== "7d") throw new Error(view.range);
		assert.deepEqual(view.days.slice(0, 2).map((d) => `${d.weekday} ${d.detail} ${d.sleep} ${d.awake}`), ["Thursday Oct 8 13 brpm 13 brpm", "Wednesday Oct 7 14 brpm 14 brpm"]);
		assert.equal(view.days.at(-1)!.offset, -6);
	});
});

describe("respiration geometry (twin 340:3, 340:962, 341:1238)", () => {
	it("1d phone: the plot runs 60 to 361, the first hour's bar centred at 72.5", () => {
		const p = timelinePlot(respirationDayView({ data: data(), route: route("1d"), today: TODAY, day: respirationDayOf(oct8()) }).timeline, PHONE, false);
		assert.equal(p.grid[0]!.y, 71.9);
		assert.equal(p.grid[4]!.y, 177.6);
		assert.equal(p.dots[0]!.x, 60);
		assert.equal(p.dots.at(-1)!.x, 361);
		assert.equal(p.bars[0]!.x, 72.54);
		assert.equal(p.highs[0]!.y, 78.51);
	});

	it("7d phone and pane: points from 31.5 to 373.6, and 62.4 to 722.9", () => {
		const view = respirationPeriodView({ data: data(), route: route("7d"), today: TODAY });
		const phone = averagesPlot(view, PHONE, false);
		assert.equal(phone.points[0]!.x, 31.5);
		assert.equal(phone.points.filter((p) => p.series === "awake").at(-1)!.x, 373.6);
		assert.equal(phone.grid[1]!.y, 98.65);
		const pane = averagesPlot(view, PANE_COLUMN, true);
		assert.equal(pane.points[0]!.x, 62.4);
		assert.equal(pane.grid[0]!.x2, 722.9);
	});
});
