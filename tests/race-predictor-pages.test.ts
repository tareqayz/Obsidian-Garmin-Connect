import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { performanceStatRoute } from "../src/dashboard/routes";
import { toggleChip } from "../src/dashboard/stat-controls";
import { CURRENT_COPY, CURRENT_TITLE, RACE_HELP } from "../src/dashboard/race-predictor-copy";
import {
	DASH,
	RACE_CHIPS,
	RACE_DISTANCES,
	dailyLines,
	monthEndLines,
	paceLabel,
	paceTicks,
	raceSub,
	racePredictorView,
	racesOff,
	racesOn,
	raceTime,
	withRaces,
	type RaceCurrentView,
	type RaceId,
	type RaceLine,
	type RacePeriodView,
	type RacePredictorContext,
	type RaceUnits,
} from "../src/dashboard/race-predictor-pages";
import { NO_DATA } from "../src/dashboard/vo2-max-pages";
import type { RacePredictionRow } from "../src/sync/race-predictor-index";
import { ROWS, ROWS_OCT_12, TODAY } from "./race-predictor-fixture";

/**
 * Golden numbers from ref/performance-stats/race-predictor/README.md, with
 * today pinned to the capture day: the phone shots of Sunday 2026-10-11
 * 21:21, the web report of 22:51, and the daily rows as Garmin sent them at
 * 04:03 on Oct 12 (`race-predictor-fixture.ts`).
 */

const CTX: RacePredictorContext = { today: TODAY, complete: true, units: "metric" };

function view(range: "1d" | "4w" | "6m" | "1y", opts: { offset?: number; sub?: string; rows?: readonly RacePredictionRow[]; ctx?: Partial<RacePredictorContext> } = {}) {
	return racePredictorView({ range, offset: opts.offset ?? 0, sub: opts.sub }, opts.rows ?? ROWS, { ...CTX, ...opts.ctx });
}
const current = (opts: Parameters<typeof view>[1] = {}) => view("1d", opts) as RaceCurrentView;
const period = (range: "4w" | "6m" | "1y", opts: Parameters<typeof view>[1] = {}) => view(range, opts) as RacePeriodView;

const line = (v: RacePeriodView, id: RaceId): RaceLine => v.chart!.lines.find((l) => l.id === id)!;
const r3 = (n: number) => n.toFixed(3);

describe("the fixture", () => {
	it("starts the history on 2025-08-09: the null-filled days before it are no rows", () => {
		assert.equal(ROWS[0]!.date, "2025-08-09");
		assert.equal(ROWS.find((r) => r.date === "2025-08-08"), undefined);
		assert.equal(ROWS[ROWS.length - 1]!.date, TODAY);
	});
});

describe("Current", () => {
	const v = current();

	it("21:15 · 45:32 · 1:43:54 · 3:49:34: the newest row, Oct 11's 1275 / 2732 / 6234 / 13774 s", () => {
		assert.deepEqual(v.times.map((t) => t.time), ["21:15", "45:32", "1:43:54", "3:49:34"]);
		assert.deepEqual(v.times.map((t) => t.seconds), [1275, 2732, 6234, 13774]);
		assert.equal(v.date, TODAY);
	});

	it("names and shapes each distance as the phone does, in the grid's column-by-column order", () => {
		assert.deepEqual(v.times.map((t) => [t.id, t.label, t.shape]), [
			["5k", "5k", "circle"],
			["10k", "10k", "triangle"],
			["half", "Half", "square"],
			["marathon", "Marathon", "diamond"],
		]);
	});

	it("has the runner's heading and copy, and no date, period row or stepper", () => {
		assert.equal(v.title, "Your Predictions");
		assert.equal(v.title, CURRENT_TITLE);
		assert.equal(
			v.copy,
			"Based on your current performance, we predict that you can complete these race distances with the following times. The more runs you track, the more accurate the predictions will become.",
		);
		assert.equal(v.copy, CURRENT_COPY);
		// Set as the phone breaks it: four centred lines.
		assert.deepEqual(v.copyLines, [
			"Based on your current performance, we predict",
			"that you can complete these race distances with",
			"the following times. The more runs you track, the",
			"more accurate the predictions will become.",
		]);
		assert.deepEqual([v.range, v.label, v.canGoBack, v.canGoForward], ["1d", null, false, false]);
		// Not a day stepper: the route's offset changes nothing.
		assert.deepEqual(current({ offset: -5 }).times, v.times);
	});

	it("is Garmin's `latest`: Oct 11's row at 22:51 that evening, Oct 12's at 04:03 next morning", () => {
		// The web's Most Recent at 22:51: "21:15 5K", "45:32 10K", "1:43:54 Half", "3:49:34 Marathon".
		assert.deepEqual(current({ rows: ROWS_OCT_12 }).times.map((t) => t.time), ["21:15", "45:32", "1:43:54", "3:49:34"]);
		const morning = current({ rows: ROWS_OCT_12, ctx: { today: "2026-10-12" } });
		assert.equal(morning.date, "2026-10-12");
		assert.deepEqual(morning.times.map((t) => t.seconds), [1275, 2733, 6237, 13778]);
		assert.deepEqual(morning.times.map((t) => t.time), ["21:15", "45:33", "1:43:57", "3:49:38"]);
	});

	it("shows the newest row however old: today without a row yet shows yesterday's (Inferred)", () => {
		const v13 = current({ rows: ROWS_OCT_12, ctx: { today: "2026-10-13" } });
		assert.equal(v13.date, "2026-10-12");
		assert.equal(current({ ctx: { today: "2027-03-01" } }).date, TODAY);
	});

	it("without any prediction keeps the heading and the copy, '--' for each time (Inferred)", () => {
		const none = current({ rows: [] });
		assert.deepEqual(none.times.map((t) => t.time), [DASH, DASH, DASH, DASH]);
		assert.equal(DASH, "--");
		assert.deepEqual(none.times.map((t) => t.seconds), [undefined, undefined, undefined, undefined]);
		assert.equal(none.date, undefined);
		assert.equal(none.title, CURRENT_TITLE);
	});
});

describe("4w, Sep 14 – Oct 11", () => {
	const v = period("4w");

	it("is labelled by its 28 days and plots every one of them, on each line", () => {
		assert.equal(v.label, "Sep 14 - Oct 11");
		assert.deepEqual(v.span, { from: "2026-09-14", to: TODAY });
		assert.equal(v.title, "Pace");
		assert.equal(v.unit, "km");
		assert.deepEqual(v.chart!.lines.map((l) => [l.id, l.points.length]), [["5k", 28], ["10k", 28], ["half", 28], ["marathon", 28]]);
		const fiveK = line(v, "5k").points;
		assert.deepEqual([fiveK[0]!.date, fiveK[27]!.date], ["2026-09-14", TODAY]);
		assert.deepEqual(fiveK.map((p) => Math.round(p.x * 27 * 1000) / 1000), Array.from({ length: 28 }, (_, i) => i));
	});

	it("ticks 4:14 4:40 5:05 5:31: 5k Oct 3 1270 s → 254.000 at the top, Marathon Sep 24 13958 s → 330.797 at the bottom", () => {
		assert.deepEqual(v.chart!.labels, ["4:14", "4:40", "5:05", "5:31"]);
		assert.deepEqual(v.chart!.ticks.map(r3), ["254.000", "279.599", "305.198", "330.797"]);
		// The top and bottom gridlines are the extreme points themselves.
		const top = line(v, "5k").points.find((p) => p.date === "2026-10-03")!;
		const bottom = line(v, "marathon").points.find((p) => p.date === "2026-09-24")!;
		assert.deepEqual([top.seconds, top.value, bottom.seconds], [1270, 254, 13958]);
		assert.equal(v.chart!.ticks[0], top.value);
		assert.equal(v.chart!.ticks[3], bottom.value);
		assert.equal(bottom.value, 13958 / 42.195);
	});

	it("plots pace unrounded: seconds ÷ 5, 10, 21.0975, 42.195", () => {
		const last = (id: RaceId) => line(v, id).points[27]!.value;
		assert.deepEqual([last("5k"), last("10k"), last("half"), last("marathon")], [1275 / 5, 2732 / 10, 6234 / 21.0975, 13774 / 42.195]);
		assert.deepEqual(RACE_DISTANCES.map((d) => d.km), [5, 10, 21.0975, 42.195]);
	});

	it("draws each line's shape only at its two ends", () => {
		for (const l of v.chart!.lines) {
			assert.deepEqual(l.points.flatMap((p, i) => (p.marker ? [i] : [])), [0, 27], l.id);
		}
	});

	it("marks a dot a day under the plot, the ends large and labelled 09-14 and 10-11", () => {
		const axis = v.chart!.axis;
		assert.equal(axis.dots.length, 28);
		assert.deepEqual(axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 27]);
		assert.deepEqual(axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
	});

	it("keys all four distances, then four chips, all on", () => {
		assert.deepEqual(v.legend.map((k) => [k.label, k.shape]), [["5k", "circle"], ["10k", "triangle"], ["Half", "square"], ["Marathon", "diamond"]]);
		assert.deepEqual(v.chips, [
			{ id: "5k", label: "5k", on: true },
			{ id: "10k", label: "10k", on: true },
			{ id: "half", label: "Half", on: true },
			{ id: "marathon", label: "Marathon", on: true },
		]);
		assert.deepEqual(v.on, ["5k", "10k", "half", "marathon"]);
		assert.deepEqual([v.canGoBack, v.canGoForward, v.empty], [true, false, undefined]);
	});
});

describe("6m, May 31 – Oct 11", () => {
	const v = period("6m");

	it("plots the five month ends and today, evenly spaced", () => {
		assert.equal(v.label, "May 31 - Oct 11");
		assert.deepEqual(v.span, { from: "2026-05-31", to: TODAY });
		assert.deepEqual(
			line(v, "5k").points.map((p) => `${p.slot.slice(5)} ${p.x.toFixed(1)}`),
			["05-31 0.0", "06-30 0.2", "07-31 0.4", "08-31 0.6", "09-30 0.8", "10-11 1.0"],
		);
	});

	it("values each slot from its month's newest row: the spec's table, in seconds and rounded paces", () => {
		const at = (i: number) => v.chart!.lines.map((l) => l.points[i]!.seconds).join(" ");
		assert.deepEqual([0, 1, 2, 3, 4, 5].map(at), [
			"1197 2527 5640 12487",
			"1226 2588 5877 13055",
			"1258 2685 6113 13522",
			"1274 2728 6219 13850",
			"1274 2727 6221 13785",
			"1275 2732 6234 13774",
		]);
		const paces = (i: number) => v.chart!.lines.map((l) => paceLabel(l.points[i]!.value)).join(" ");
		assert.deepEqual([0, 5].map(paces), ["3:59 4:13 4:27 4:56", "4:15 4:33 4:55 5:26"]);
	});

	it("ticks 3:59 4:29 4:59 5:28: 5k May 31 1197 → 239.400; Marathon Aug 31 13850 → 328.238", () => {
		assert.deepEqual(v.chart!.labels, ["3:59", "4:29", "4:59", "5:28"]);
		assert.deepEqual(v.chart!.ticks.map(r3), ["239.400", "269.013", "298.625", "328.238"]);
		// Rounding the ends first would read 4:58 for 298.625; flooring, 4:58 too.
		assert.equal(paceLabel(Math.round(239.4) + ((Math.round(328.238) - Math.round(239.4)) * 2) / 3), "4:58");
	});

	it("draws a shape on every point, over a large labelled dot per slot", () => {
		for (const l of v.chart!.lines) assert.ok(l.points.every((p) => p.marker), l.id);
		const axis = v.chart!.axis;
		assert.ok(axis.dots.every((d) => d.large));
		assert.deepEqual(axis.labels.map((l) => l.text), ["05-31", "06-30", "07-31", "08-31", "09-30", "10-11"]);
		assert.ok(axis.labels.every((l) => !l.rotated));
	});
});

describe("1y, Nov 30, 2025 – Oct 11, 2026", () => {
	const v = period("1y");

	it("plots eleven month ends and today, every point marked", () => {
		assert.equal(v.label, "Nov 30, 2025 - Oct 11, 2026");
		assert.deepEqual(v.chart!.lines.map((l) => l.points.length), [12, 12, 12, 12]);
		assert.ok(v.chart!.lines.every((l) => l.points.every((p) => p.marker)));
		assert.deepEqual(line(v, "5k").points.map((p) => p.seconds), [1098, 1100, 1110, 1137, 1152, 1178, 1197, 1226, 1258, 1274, 1274, 1275]);
	});

	it("ticks 3:40 4:16 4:52 5:28: 5k Nov 30, 2025 1098 → 219.600; Marathon Aug 31 13850 → 328.238", () => {
		assert.deepEqual(v.chart!.labels, ["3:40", "4:16", "4:52", "5:28"]);
		assert.deepEqual(v.chart!.ticks.map(r3), ["219.600", "255.813", "292.025", "328.238"]);
	});

	it("labels every slot MM-DD, on end", () => {
		const axis = v.chart!.axis;
		assert.equal(axis.dots.length, 12);
		assert.ok(axis.dots.every((d) => d.large));
		assert.deepEqual(
			axis.labels.map((l) => l.text).join(" "),
			"11-30 12-31 01-31 02-28 03-31 04-30 05-31 06-30 07-31 08-31 09-30 10-11",
		);
		assert.ok(axis.labels.every((l) => l.rotated === true));
		assert.deepEqual(axis.labels.map((l) => Math.round(l.x * 11)), Array.from({ length: 12 }, (_, i) => i));
	});

	it("values the month slots, not their mean, best or first day: the spec's month-end table", () => {
		const paces = (i: number) => v.chart!.lines.map((l) => paceLabel(l.points[i]!.value)).join(" ");
		assert.deepEqual(Array.from({ length: 12 }, (_, i) => paces(i)), [
			"3:40 3:51 4:04 4:26",
			"3:40 3:52 4:07 4:35",
			"3:42 3:55 4:13 4:43",
			"3:47 4:03 4:23 4:56",
			"3:50 4:05 4:23 4:53",
			"3:56 4:10 4:24 4:52",
			"3:59 4:13 4:27 4:56",
			"4:05 4:19 4:39 5:09",
			"4:12 4:29 4:50 5:20",
			"4:15 4:33 4:55 5:28",
			"4:15 4:33 4:55 5:27",
			"4:15 4:33 4:55 5:26",
		]);
	});
});

describe("the slots", () => {
	it("take the newest row on or before the slot: today's, and never a later one", () => {
		// With Oct 12's row in the index and today still Oct 11, the last slot is Oct 11's.
		const v = period("6m", { rows: ROWS_OCT_12 });
		assert.deepEqual(v.chart!.lines.map((l) => l.points[5]!.seconds), [1275, 2732, 6234, 13774]);
		assert.equal(line(v, "5k").points[5]!.date, TODAY);
	});

	it("while today has no row, today's slot takes the month's newest and 4w ends at yesterday (Inferred)", () => {
		const v = period("6m", { ctx: { today: "2026-10-12" } });
		assert.equal(v.label, "May 31 - Oct 12");
		const last = line(v, "5k").points[5]!;
		assert.deepEqual([last.slot, last.date, last.seconds], ["2026-10-12", TODAY, 1275]);
		const w = period("4w", { ctx: { today: "2026-10-12" } });
		assert.equal(w.label, "Sep 15 - Oct 12");
		const points = line(w, "5k").points;
		assert.deepEqual([points.length, points[points.length - 1]!.date], [27, TODAY]);
		// The axis still runs to today; the end markers sit on the line's own ends.
		assert.deepEqual(w.chart!.axis.labels.map((l) => l.text), ["09-15", "10-12"]);
		assert.deepEqual(points.flatMap((p, i) => (p.marker ? [i] : [])), [0, 26]);
	});
});

describe("previous periods (Inferred)", () => {
	it("4w −1, Aug 17 – Sep 13: 4:13 4:39 5:05 5:31", () => {
		const v = period("4w", { offset: -1 });
		assert.equal(v.label, "Aug 17 - Sep 13");
		assert.deepEqual(v.chart!.labels, ["4:13", "4:39", "5:05", "5:31"]);
		assert.deepEqual(v.chart!.lines.map((l) => l.points.length), [28, 28, 28, 28]);
		assert.deepEqual([v.canGoBack, v.canGoForward], [true, true]);
	});

	it("6m −1, Nov 30, 2025 – Apr 30, 2026: 3:40 4:05 4:31 4:56", () => {
		const v = period("6m", { offset: -1 });
		assert.equal(v.label, "Nov 30, 2025 - Apr 30, 2026");
		assert.deepEqual(v.chart!.labels, ["3:40", "4:05", "4:31", "4:56"]);
		assert.deepEqual(v.chart!.axis.labels.map((l) => l.text), ["11-30", "12-31", "01-31", "02-28", "03-31", "04-30"]);
		assert.deepEqual([v.canGoBack, v.canGoForward], [true, true]);
	});

	it("1y −1, Nov 30, 2024 – Oct 31, 2025: twelve slots, the last three with data, 3:39 3:57 4:15 4:34", () => {
		const v = period("1y", { offset: -1 });
		assert.equal(v.label, "Nov 30, 2024 - Oct 31, 2025");
		assert.equal(v.chart!.axis.dots.length, 12);
		assert.deepEqual(
			v.chart!.lines.map((l) => l.points.map((p) => `${p.slot.slice(5)} ${paceLabel(p.value)}`).join(" ")),
			["08-31 3:46 09-30 3:45 10-31 3:39", "08-31 3:56 09-30 3:55 10-31 3:49", "08-31 4:09 09-30 4:08 10-31 4:02", "08-31 4:34 09-30 4:28 10-31 4:23"],
		);
		assert.deepEqual(line(v, "5k").points.map((p) => Math.round(p.x * 11)), [9, 10, 11]);
		assert.deepEqual(v.chart!.labels, ["3:39", "3:57", "4:15", "4:34"]);
		// The index is whole and starts 2025-08-09: nothing before this period.
		assert.deepEqual([v.canGoBack, v.canGoForward], [false, true]);
		assert.equal(period("1y", { offset: -1, ctx: { complete: false } }).canGoBack, true);
	});

	it("step back while a period before holds a row: 6m −2 is the last with data", () => {
		// A past year's label without the spaces, as every period's (`periodLabel`).
		assert.equal(period("6m", { offset: -2 }).label, "May 31-Oct 31, 2025");
		assert.deepEqual(line(period("6m", { offset: -2 }), "marathon").points.map((p) => p.slot), ["2025-08-31", "2025-09-30", "2025-10-31"]);
		assert.equal(period("6m", { offset: -2 }).canGoBack, false);
		assert.equal(period("1y").canGoBack, true);
	});

	it("a 4w across the history's start draws from Aug 9 (Inferred)", () => {
		const v = period("4w", { offset: -15 });
		assert.equal(v.label, "Jul 21-Aug 17, 2025");
		const points = line(v, "5k").points;
		assert.deepEqual([points.length, points[0]!.date, Math.round(points[0]!.x * 27)], [9, "2025-08-09", 19]);
		assert.deepEqual(points.flatMap((p, i) => (p.marker ? [i] : [])), [0, 8]);
		assert.equal(v.canGoBack, false);
	});
});

describe("the web's numbers, from the same rows", () => {
	/** Garmin's web axis is speed, m/s: its a11y line gives the extreme speeds over the four lines exactly. */
	const METRES: Readonly<Record<RaceId, number>> = { "5k": 5000, "10k": 10000, half: 21097.5, marathon: 42195 };
	function speedRange(lines: readonly RaceLine[]): string {
		const speeds = lines.flatMap((l) => l.points.map((p) => METRES[l.id] / p.seconds));
		return `${Math.min(...speeds)} to ${Math.max(...speeds)}`;
	}
	const daily = (from: string, to: string) => dailyLines({ from, to }, ROWS, "metric").lines;
	const months = (from: string, to: string) => monthEndLines({ from, to }, ROWS, "metric", false).lines;

	it("4 Weeks (Sunday blocks): Sep 20 – Oct 11 and Aug 23 – Sep 19", () => {
		assert.equal(speedRange(daily("2026-09-20", TODAY)), "3.022997564120934 to 3.937007874015748");
		assert.equal(speedRange(daily("2026-08-23", "2026-09-19")), "3.0178086110713775 to 3.943217665615142");
	});

	it("6 Months and 1 Year (calendar months, the monthly route), and their previous periods", () => {
		assert.equal(speedRange(months("2026-05-01", "2026-10-31")), "3.0465703971119136 to 4.177109440267335");
		assert.equal(speedRange(months("2025-11-01", "2026-04-30")), "3.3761401824291886 to 4.553734061930784");
		assert.equal(speedRange(months("2025-11-01", "2026-10-31")), "3.0465703971119136 to 4.553734061930784");
		assert.equal(speedRange(months("2024-11-01", "2025-10-31")), "3.6560956589550297 to 4.562043795620438");
	});

	it("labels its speed ticks as paces rounded to the second, as the phone's are: floor fails every state", () => {
		const floor = (pace: number) => `${Math.floor(Math.floor(pace) / 60)}:${String(Math.floor(pace) % 60).padStart(2, "0")}`;
		const states: Array<[number[], string]> = [
			[[2.75, 3, 3.25, 3.5, 3.75, 4], "6:04 5:33 5:08 4:46 4:27 4:10"],
			[[2.75, 3, 3.25, 3.5, 3.75, 4, 4.25], "6:04 5:33 5:08 4:46 4:27 4:10 3:55"],
			[[3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75], "5:08 4:46 4:27 4:10 3:55 3:42 3:31"],
			[[2.5, 3, 3.5, 4, 4.5, 5], "6:40 5:33 4:46 4:10 3:42 3:20"],
			[[3.5, 3.75, 4, 4.25, 4.5, 4.75], "4:46 4:27 4:10 3:55 3:42 3:31"],
		];
		for (const [speeds, text] of states) {
			assert.equal(speeds.map((s) => paceLabel(1000 / s)).join(" "), text);
			assert.notEqual(speeds.map((s) => floor(1000 / s)).join(" "), text);
		}
	});
});

describe("Garmin's monthly route is the slots' rule", () => {
	/**
	 * `racepredictions/monthly` as sent: each row `date=5k/10k/half/marathon`,
	 * a bare date for a month without a prediction (dated its 1st). Live at
	 * 04:05 on Oct 12, and the web's two at 22:51 on Oct 11.
	 */
	const MONTHLY: Array<{ name: string; from: string; to: string; rows: readonly RacePredictionRow[]; sent: string }> = [
		{
			name: "monthly-2026-05-01_2026-10-31",
			from: "2026-05-01",
			to: "2026-10-31",
			rows: ROWS_OCT_12,
			sent: "2026-05-31=1197/2527/5640/12487 2026-06-30=1226/2588/5877/13055 2026-07-31=1258/2685/6113/13522 2026-08-31=1274/2728/6219/13850 2026-09-30=1274/2727/6221/13785 2026-10-12=1275/2733/6237/13778",
		},
		{
			name: "monthly-2024-11-01_2025-10-31",
			from: "2024-11-01",
			to: "2025-10-31",
			rows: ROWS_OCT_12,
			sent: "2024-11-01 2024-12-01 2025-01-01 2025-02-01 2025-03-01 2025-04-01 2025-05-01 2025-06-01 2025-07-01 2025-08-31=1132/2362/5259/11541 2025-09-30=1123/2354/5225/11314 2025-10-31=1096/2291/5103/11083",
		},
		{
			name: "probe-monthly-mid-2026-05-15_2026-08-15",
			from: "2026-05-15",
			to: "2026-08-15",
			rows: ROWS_OCT_12,
			sent: "2026-05-31=1197/2527/5640/12487 2026-06-30=1226/2588/5877/13055 2026-07-31=1258/2685/6113/13522 2026-08-15=1263/2708/6150/13597",
		},
		{
			name: "probe-monthly-366-2025-10-12_2026-10-12",
			from: "2025-10-12",
			to: "2026-10-12",
			rows: ROWS_OCT_12,
			sent:
				"2025-10-31=1096/2291/5103/11083 2025-11-30=1098/2309/5145/11213 2025-12-31=1100/2317/5206/11592 2026-01-31=1110/2348/5337/11937 2026-02-28=1137/2430/5556/12498 2026-03-31=1152/2450/5554/12343 " +
				"2026-04-30=1178/2497/5578/12318 2026-05-31=1197/2527/5640/12487 2026-06-30=1226/2588/5877/13055 2026-07-31=1258/2685/6113/13522 2026-08-31=1274/2728/6219/13850 2026-09-30=1274/2727/6221/13785 2026-10-12=1275/2733/6237/13778",
		},
		{
			name: "web 6 Months (22:51)",
			from: "2026-05-01",
			to: "2026-10-31",
			rows: ROWS,
			sent: "2026-05-31=1197/2527/5640/12487 2026-06-30=1226/2588/5877/13055 2026-07-31=1258/2685/6113/13522 2026-08-31=1274/2728/6219/13850 2026-09-30=1274/2727/6221/13785 2026-10-11=1275/2732/6234/13774",
		},
		{
			name: "web 1 Year (22:51)",
			from: "2025-11-01",
			to: "2026-10-31",
			rows: ROWS,
			sent:
				"2025-11-30=1098/2309/5145/11213 2025-12-31=1100/2317/5206/11592 2026-01-31=1110/2348/5337/11937 2026-02-28=1137/2430/5556/12498 2026-03-31=1152/2450/5554/12343 2026-04-30=1178/2497/5578/12318 " +
				"2026-05-31=1197/2527/5640/12487 2026-06-30=1226/2588/5877/13055 2026-07-31=1258/2685/6113/13522 2026-08-31=1274/2728/6219/13850 2026-09-30=1274/2727/6221/13785 2026-10-11=1275/2732/6234/13774",
		},
	];

	for (const sample of MONTHLY) {
		it(`${sample.name}: a slot per row, each the daily row at its date; a null month is a slot without a point`, () => {
			const { axis, lines } = monthEndLines({ from: sample.from, to: sample.to }, sample.rows, "metric", false);
			const sent = sample.sent.split(" ");
			assert.equal(axis.dots.length, sent.length);
			const ours = lines[0]!.points.map((p, i) => `${p.date}=${lines.map((l) => l.points[i]!.seconds).join("/")}`);
			assert.deepEqual(ours, sent.filter((r) => r.includes("=")));
		});
	}
});

describe("the chips (Inferred: route `sub`)", () => {
	it("turn lines off through the route's sub, in the chips' order", () => {
		assert.deepEqual(racesOn(undefined), ["5k", "10k", "half", "marathon"]);
		assert.deepEqual(racesOff("off:half.10k"), ["10k", "half"]);
		assert.equal(raceSub(["5k", "marathon"]), "off:10k.half");
		assert.equal(raceSub(["marathon", "half", "10k", "5k"]), undefined);
		// Another page's sub, or one turning all four off, turns none off.
		assert.deepEqual(racesOff("month:2026-03"), []);
		assert.deepEqual(racesOff("off:5k.10k.half.marathon"), []);
		assert.deepEqual(racesOff("off:nope"), []);
	});

	it("take a tap as StatChips reports it: several on, the last one staying on", () => {
		const route = performanceStatRoute("race-predictor", { range: "4w" });
		assert.equal(route.sub, undefined);
		const off10k = withRaces(route, toggleChip(period("4w").on, "10k", RACE_CHIPS));
		assert.equal(off10k.sub, "off:10k");
		// Through the route's own check, as a saved one is read back.
		assert.equal(performanceStatRoute("race-predictor", { range: "4w", sub: off10k.sub }).sub, "off:10k");
		const back = withRaces(off10k, toggleChip(racesOn(off10k.sub), "10k", RACE_CHIPS));
		assert.equal("sub" in back, false);
		// The last line on stays on.
		assert.deepEqual(toggleChip(["half"], "half", RACE_CHIPS), ["half"]);
		assert.deepEqual(RACE_CHIPS, { multi: true, required: true });
	});

	it("leave the lines that are on, the chips showing which, the legend whole", () => {
		const v = period("4w", { sub: "off:5k.half" });
		assert.deepEqual(v.chart!.lines.map((l) => l.id), ["10k", "marathon"]);
		assert.deepEqual(v.chips.map((c) => c.on), [false, true, false, true]);
		assert.deepEqual(v.on, ["10k", "marathon"]);
		assert.equal(v.legend.length, 4);
	});

	it("hide a line and move nothing else: the axis stays cut from all four, as the twin's Half off (536:648)", () => {
		const all = period("4w");
		const off = period("4w", { sub: "off:half" });
		assert.deepEqual(off.chart!.lines.map((l) => l.id), ["5k", "10k", "marathon"]);
		assert.deepEqual(off.chart!.ticks, all.chart!.ticks);
		assert.deepEqual(off.chart!.labels, ["4:14", "4:40", "5:05", "5:31"]);
		assert.deepEqual(line(off, "marathon").points, line(all, "marathon").points);
		// The 5k alone over 1y keeps 3:40 … 5:28: the marathon's 5:28 still bounds the axis.
		assert.deepEqual(period("1y", { sub: "off:10k.half.marathon" }).chart!.labels, ["3:40", "4:16", "4:52", "5:28"]);
	});

	it("hold across ranges and periods, which keep the route's sub", () => {
		const v = racePredictorView(performanceStatRoute("race-predictor", { range: "6m", offset: -1, sub: "off:marathon" }), ROWS, CTX) as RacePeriodView;
		assert.deepEqual(v.chart!.lines.map((l) => l.id), ["5k", "10k", "half"]);
		assert.equal(v.label, "Nov 30, 2025 - Apr 30, 2026");
	});
});

describe("the y axis", () => {
	it("is four paces in thirds from the fastest to the slowest, the ends the extreme values", () => {
		const ticks = paceTicks([254, 330.7974878, 300]);
		assert.equal(ticks[0], 254);
		assert.equal(ticks[3], 330.7974878);
		assert.deepEqual(paceTicks([]), []);
	});

	it("widens a spread under 3 s about its middle, so no two labels are the same (Inferred)", () => {
		assert.deepEqual(paceTicks([254, 254]), [252.5, 253.5, 254.5, 255.5]);
		assert.deepEqual(paceTicks([254, 254]).map(paceLabel), ["4:13", "4:14", "4:15", "4:16"]);
		assert.deepEqual(paceTicks([254, 255]).map(paceLabel), ["4:13", "4:14", "4:15", "4:16"]);
		// The phone's spreads are over a minute; 3 s exactly is kept as it is.
		assert.deepEqual(paceTicks([254, 257]), [254, 255, 256, 257]);
	});

	it("labels m:ss rounded half up, and a time h:mm:ss from an hour", () => {
		assert.deepEqual([paceLabel(279.5), paceLabel(279.4999), paceLabel(59.5)], ["4:40", "4:39", "1:00"]);
		assert.deepEqual([raceTime(1275), raceTime(3599), raceTime(3600), raceTime(13774), raceTime(undefined)], ["21:15", "59:59", "1:00:00", "3:49:34", "--"]);
	});
});

describe("imperial (Inferred): seconds a mile, the same rules", () => {
	const imperial = (range: "4w" | "6m" | "1y") => period(range, { ctx: { units: "imperial" as RaceUnits } });

	it("4w 6:49 7:30 8:11 8:52 · 6m 6:25 7:13 8:01 8:48 · 1y 5:53 6:52 7:50 8:48", () => {
		assert.deepEqual(imperial("4w").chart!.labels, ["6:49", "7:30", "8:11", "8:52"]);
		assert.deepEqual(imperial("6m").chart!.labels, ["6:25", "7:13", "8:01", "8:48"]);
		assert.deepEqual(imperial("1y").chart!.labels, ["5:53", "6:52", "7:50", "8:48"]);
		assert.equal(imperial("4w").unit, "mi");
	});

	it("leaves Current's times alone", () => {
		assert.deepEqual(current({ ctx: { units: "imperial" } }).times.map((t) => t.time), ["21:15", "45:32", "1:43:54", "3:49:34"]);
	});
});

describe("without data", () => {
	it("a range without a row says the web's no-data line in place of the chart", () => {
		for (const range of ["4w", "6m", "1y"] as const) {
			const v = period(range, { rows: [] });
			assert.deepEqual([v.chart, v.empty], [null, NO_DATA], range);
			assert.equal(v.empty, "You have no data for this time period.");
		}
		// 1y −2 is before the history.
		assert.deepEqual([period("1y", { offset: -2 }).chart, period("1y", { offset: -2 }).empty], [null, NO_DATA]);
	});

	it("before the first sync the index may hold more, so '<' stays", () => {
		assert.equal(period("4w", { rows: [], ctx: { complete: false } }).canGoBack, true);
		assert.equal(period("4w", { rows: [] }).canGoBack, false);
	});
});

describe("Help (from the web; the phone's is unseen)", () => {
	it("is the web dialog's title, paragraphs and heading", () => {
		assert.equal(RACE_HELP.title, "Race Predictor");
		assert.equal(RACE_HELP.sections.length, 2);
		assert.match(RACE_HELP.sections[0]!.paragraphs[0]!, /^Race Predictor uses your training history and VO₂ Max/);
		assert.equal(RACE_HELP.sections[1]!.heading, "Race Predictor in Garmin Connect");
	});
});
