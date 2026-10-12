import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { addMonths, daysBetween, type PeriodAxis, type PeriodRange } from "../src/dashboard/periods";
import { PERFORMANCE_REGISTRY } from "../src/dashboard/performance-stats";
import { performanceStatRoute } from "../src/dashboard/routes";
import { CHART_TITLE, CURRENT_COPY, CURRENT_COPY_LINES, CURRENT_TITLE, HELP_TITLE, readingsSentence } from "../src/dashboard/running-lactate-threshold-copy";
import {
	BLOCK_DAYS,
	DASH,
	FLAT_PAD,
	LT_CHIPS,
	LT_CHIP_RULE,
	LT_SERIES,
	RANGE_PAD,
	axisStep,
	currentView,
	ltChart,
	ltChip,
	ltXAxis,
	ltYAxis,
	movedRoute,
	paceOf,
	paceText,
	pickPoints,
	runningLactateThresholdHelp,
	runningLactateThresholdView,
	seriesValues,
	withLtChip,
	yFraction,
	type LtAccount,
	type LtChipId,
	type LtContext,
	type LtCurrentView,
	type LtData,
	type LtLine,
	type LtPeriodView,
	type LtSeriesId,
	type LtValue,
	type LtYAxis,
} from "../src/dashboard/running-lactate-threshold-pages";
import { toggleChip } from "../src/dashboard/stat-controls";
import { mapAccount } from "../src/sync/account";
import { FTP_INDEX, rowsOfRanges, type FtpRow } from "../src/sync/ftp-index";
import { LACTATE_THRESHOLD_INDEX, thresholdRows, type LactateThresholdRow } from "../src/sync/lactate-threshold-index";
import { LATEST_2026_10_11, wattsPayload, wkgPayload } from "./ftp-fixture";
import { LATEST_LT, SHOTS, hrPayload, speedPayload, type Shot } from "./running-lactate-threshold-fixture";

/**
 * Golden numbers from ref/performance-stats/running-lactate-threshold/README.md:
 * the phone shots of Sunday 2026-10-11 21:26–21:27, the web report of 23:02
 * and the routes as Garmin answered them on Oct 12. The indexes' rows come
 * from the payloads through the indexes themselves — heart rate and speed
 * through the lactate threshold index, the running power through the FTP
 * index — and Current from `latestLactateThreshold` and
 * `powerToWeight/latest` through the account mapping. The windows roll daily
 * and 1y's month dots move with today, so the spans reproduce only with
 * today pinned.
 */
const TODAY = "2026-10-11";

const LT: LactateThresholdRow[] = thresholdRows(hrPayload("2024-10-08", TODAY), speedPayload("2024-10-08", TODAY)).map((r) => LACTATE_THRESHOLD_INDEX.normalize(r)!);
const POWER: FtpRow[] = rowsOfRanges(wattsPayload("2024-10-08", TODAY), wkgPayload("2024-10-08", TODAY)).map((r) => FTP_INDEX.normalize(r)!);
const DATA: LtData = { lt: LT, power: POWER };
/** account.json after the sync of the capture day, metric. */
const ACCOUNT: LtAccount = mapAccount({ lactate: [...LATEST_LT], ftp: [...LATEST_2026_10_11] })!;
const CTX: LtContext = { today: TODAY, complete: { lt: true, power: true }, account: ACCOUNT };

type Options = { offset?: number; sub?: string; data?: LtData; ctx?: Partial<LtContext> };
const view = (range: PeriodRange, opts: Options = {}) =>
	runningLactateThresholdView({ range, offset: opts.offset ?? 0, sub: opts.sub }, opts.data ?? DATA, { ...CTX, ...opts.ctx });
const period = (range: "4w" | "12w" | "1y", chip: LtChipId = "pace", opts: Options = {}) =>
	view(range, { ...opts, sub: chip === "pace" ? opts.sub : chip }) as LtPeriodView;

/** "4:28.66": a pace to the hundredth of a second, as the spec lists them. */
const mmss = (s: number) => `${Math.floor(s / 60)}:${(s - 60 * Math.floor(s / 60)).toFixed(2).padStart(5, "0")}`;
/** A line's points as "MM-DD value", values as the spec writes them: bpm and W whole, pace m:ss.ss, W/kg to 4 dp. */
const pts = (line: LtLine) =>
	line.points.map((p) => `${p.date.slice(5)} ${line.id === "pace" ? mmss(p.value) : line.id === "wkg" ? p.value.toFixed(4) : p.value}`);
const labels = (line: LtLine) => line.y!.labels.join(" ");

describe("the fixture", () => {
	it("is the history Garmin sent: 40 threshold days from 2025-08-03, 33 running power days from 2025-08-02", () => {
		assert.deepEqual([LT.length, LT[0]!.date, LT.at(-1)!.date], [40, "2025-08-03", "2026-09-19"]);
		const running = POWER.filter((r) => r.running !== undefined);
		assert.deepEqual([running.length, running[0]!.date, running.at(-1)!.date], [33, "2025-08-02", "2026-10-08"]);
	});

	it("is account.json as the account sync writes it: the threshold, and the running power with its W/kg", () => {
		assert.deepEqual(ACCOUNT.lactateThreshold, { date: "2026-09-19", heartRate: 182, speed: 3.72221, pace: "4:29" });
		assert.deepEqual(ACCOUNT.ftp?.running, {
			date: "2026-10-08",
			watts: 354,
			wattsPerKg: 5.21,
			ftpDate: "2026-09-19",
			weight: 68,
			weightDate: "2026-10-08",
			stale: false,
		});
	});
});

describe("the threshold and the running power line up (align.py)", () => {
	const ltDays = new Set(LT.map((r) => r.date));
	const powerDays = new Set(POWER.filter((r) => r.running !== undefined).map((r) => r.date));

	it("on 30 of the 40 threshold days: 40 threshold days, 33 power days, 30 in both", () => {
		assert.deepEqual([ltDays.size, powerDays.size, [...ltDays].filter((d) => powerDays.has(d)).length], [40, 33, 30]);
	});

	it("10 threshold-only days are estimates saved without a power change", () => {
		assert.deepEqual(
			[...ltDays].filter((d) => !powerDays.has(d)),
			["2025-08-11", "2025-08-21", "2025-09-06", "2025-09-15", "2025-10-12", "2025-12-07", "2026-01-16", "2026-03-18", "2026-05-17", "2026-06-29"],
		);
	});

	it("the 3 power-only days are weigh-ins, which never make a threshold row; 2025-08-03 and 10-13 weigh in on threshold days", () => {
		const powerOnly = [...powerDays].filter((d) => !ltDays.has(d));
		assert.deepEqual(powerOnly, ["2025-08-02", "2025-11-02", "2026-10-08"]);
		// A weigh-in gives every sport a row: the days with cycling and skiing too.
		const weighIns = POWER.filter((r) => r.cycling !== undefined && r.xc !== undefined).map((r) => r.date);
		assert.deepEqual(weighIns, ["2025-08-02", "2025-08-03", "2025-10-13", "2025-11-02", "2026-10-08"]);
		assert.ok(powerOnly.every((d) => weighIns.includes(d)));
		assert.deepEqual(weighIns.filter((d) => ltDays.has(d)), ["2025-08-03", "2025-10-13"]);
	});

	it("so 1y's heart rate has a December point power lacks, and power has Oct 8 heart rate lacks", () => {
		const v = period("1y", "power");
		assert.ok(v.chart!.left.points.some((p) => p.date === "2025-12-07"));
		assert.ok(!v.chart!.right.points.some((p) => p.date.startsWith("2025-12")));
		assert.equal(v.chart!.right.points.at(-1)!.date, "2026-10-08");
		assert.equal(v.chart!.left.points.at(-1)!.date, "2026-09-19");
	});
});

describe("Current", () => {
	const v = view("1d") as LtCurrentView;

	it('"182 bpm" · "4:29 /km" · "354 W" · "5.21 W/kg", row by row with their glyphs', () => {
		assert.deepEqual(
			v.cells.map((c) => [c.value, c.unit, c.label, c.shape]),
			[
				["182", "bpm", "Heart Rate", "circle"],
				["4:29", "/km", "Pace", "square"],
				["354", "W", "Power", "triangle"],
				["5.21", "W/kg", "Power (W/kg)", "diamond"],
			],
		);
	});

	it("rounds the pace half up to the second: 1000 ÷ 3.7222118 = 268.658 s → 4:29 (flooring gives 4:28)", () => {
		const exact = 1000 / (0.37222118000000004 * 10);
		assert.ok(Math.abs(exact - 268.6575) < 0.0001);
		assert.equal(paceText(exact), "4:29");
		assert.equal(paceText(Math.floor(exact)), "4:28");
		// account.json keeps the speed to 5 dp, as the index does: 3.72221 m/s, 268.6576 s; files written at 3 dp (3.722, 268.673 s) give 4:29 too.
		assert.equal(ACCOUNT.lactateThreshold!.speed, 3.72221);
		assert.ok(Math.abs(paceOf(3.72221, "metric") - exact) < 0.0004);
		assert.equal(paceText(paceOf(3.722, "metric")), "4:29");
		assert.equal(paceText(268.5), "4:29");
		assert.equal(paceText(268.49), "4:28");
	});

	it("gives the W/kg to 2 dp: 354 ÷ 68 = 5.205882 → 5.21", () => {
		assert.ok(Math.abs(354 / 68 - 5.205882352941177) < 1e-12);
		assert.equal(v.cells[3]!.value, "5.21");
	});

	it('"Your current threshold" over the phone\'s two lines; no date, no Based On, no period row, no stepper', () => {
		assert.deepEqual([v.range, v.title, v.copyLines, v.copy], ["1d", "Your current threshold", CURRENT_COPY_LINES, CURRENT_COPY]);
		assert.deepEqual(CURRENT_COPY_LINES, ["Based on our most recent estimates, you reach", "running lactate threshold at these levels."]);
		assert.equal(CURRENT_TITLE, "Your current threshold");
		assert.deepEqual([v.label, v.canGoBack], [null, false]);
		assert.deepEqual(Object.keys(v).sort(), ["canGoBack", "cells", "copy", "copyLines", "label", "range", "title"]);
		// The route's offset is not a day.
		assert.deepEqual(view("1d", { offset: -5 }), v);
	});

	it("shows the newest values however old: no staleness, and no request on view", () => {
		const old = currentView({ lactateThreshold: { date: "2024-01-01", heartRate: 170, speed: 3.5 }, ftp: { running: { watts: 300, wattsPerKg: 4.5, stale: true } } });
		assert.deepEqual(old.cells.map((c) => c.value), ["170", "4:46", "300", "4.50"]);
	});

	it("is the web's Most Recent and the Help's sentence too", () => {
		assert.deepEqual(v.cells.map((c) => `${c.value} ${c.unit}`), ["182 bpm", "4:29 /km", "354 W", "5.21 W/kg"]);
		const help = runningLactateThresholdHelp(ACCOUNT);
		assert.equal(help.title, HELP_TITLE);
		assert.equal(help.title, "Running Lactate Threshold");
		const about = help.sections.find((s) => s.title === "About Your Readings")!.parts[0]!;
		assert.equal(about.heading, "Your Lactate Threshold");
		assert.equal(
			about.paragraphs[0],
			"Currently, you reach your running lactate threshold when your heart rate during activity is 182 bpm, your pace reaches 4:29 /km and your running power is 354 Watts.",
		);
		assert.deepEqual(help.sections.map((s) => s.title), [undefined, "About Your Readings", "What Is LT?"]);
		assert.deepEqual(help.sections[2]!.parts.map((p) => p.heading), ["Your Training Limit", "LT & Training"]);
	});
});

describe("Current without data (Inferred)", () => {
	it('"--" in each cell without an account, the units kept', () => {
		for (const account of [null, undefined, {}]) {
			assert.deepEqual(currentView(account).cells.map((c) => `${c.value} ${c.unit}`), ["-- bpm", "-- /km", "-- W", "-- W/kg"]);
		}
		assert.equal(DASH, "--");
	});

	it("a power without a weigh-in: the W/kg cell '--'; a threshold without its speed: the pace '--'", () => {
		const c = currentView({ lactateThreshold: { heartRate: 182 }, ftp: { running: { watts: 354 } } });
		assert.deepEqual(c.cells.map((x) => x.value), ["182", "--", "354", "--"]);
		const p = currentView({ lactateThreshold: { speed: 3.722 } });
		assert.deepEqual(p.cells.map((x) => x.value), ["--", "4:29", "--", "--"]);
		assert.equal(readingsSentence({ heartRate: "-- bpm", pace: "4:29 /km", power: "-- Watts" }).includes("is -- bpm,"), true);
	});

	it('in imperial units the pace is a mile\'s: "7:12 /mi" (1609.344 ÷ 3.722)', () => {
		const c = currentView(ACCOUNT, "imperial");
		assert.deepEqual([c.cells[1]!.value, c.cells[1]!.unit], ["7:12", "/mi"]);
		assert.equal(paceText(paceOf(3.7222118, "imperial")), "7:12");
		assert.equal(runningLactateThresholdHelp(ACCOUNT, "imperial").sections[1]!.parts[0]!.paragraphs[0]!.includes("your pace reaches 7:12 /mi and"), true);
	});
});

describe("4w, Sep 14 – Oct 11", () => {
	it("one heart rate dot and one pace square, both on Sep 19, no line between", () => {
		const v = period("4w");
		assert.deepEqual([v.range, v.label, v.title, v.chip], ["4w", "Sep 14 - Oct 11", "Heart Rate", "pace"]);
		assert.deepEqual(v.span, { from: "2026-09-14", to: "2026-10-11" });
		assert.deepEqual(v.chart!.left.points, [{ date: "2026-09-19", x: 5 / 27, value: 182 }]);
		assert.deepEqual(pts(v.chart!.right), ["09-19 4:28.66"]);
		// Sep 14's heart rate was 184 (set Sep 9), but nothing is carried in.
		assert.equal(LT.filter((r) => r.date <= "2026-09-14").at(-1)!.hr, 184);
	});

	it("Power and W/kg: the Sep 19 heart rate, and a flat line from Sep 19 to Oct 8 with a marker at each end", () => {
		assert.deepEqual(pts(period("4w", "power").chart!.right), ["09-19 354", "10-08 354"]);
		assert.deepEqual(pts(period("4w", "wkg").chart!.right), ["09-19 5.2059", "10-08 5.2059"]);
		assert.deepEqual(pts(period("4w", "wkg").chart!.left), ["09-19 182"]);
	});

	it('axes: HR "195 … 175", pace "4:25 … 4:45", power "370 … 350", W/kg "10 8 6 4 2" — each flat, padded ±2.5', () => {
		assert.equal(labels(period("4w").chart!.left), "195 190 185 180 175");
		assert.equal(labels(period("4w").chart!.right), "4:25 4:30 4:35 4:40 4:45");
		assert.equal(labels(period("4w", "power").chart!.right), "370 365 360 355 350");
		assert.equal(labels(period("4w", "wkg").chart!.right), "10 8 6 4 2");
		// [179.5, 184.5] → s 5 → 175; [266.16, 271.16] → 265; [351.5, 356.5] → 350; [2.71, 7.71] → s 1 fails (2 + 4 < 7.71) → s 2 → 2.
		assert.deepEqual([axisStep(179.5, 184.5, 5), axisStep(266.16, 271.16, 5), axisStep(351.5, 356.5, 5), axisStep(2.7059, 7.7059, 1)], [5, 5, 5, 2]);
		assert.deepEqual(period("4w", "wkg").chart!.right.y, { min: 2, step: 2, max: 10, ticks: [10, 8, 6, 4, 2], labels: ["10", "8", "6", "4", "2"] });
	});

	it('has a dot a day under the plot, the ends large and labelled "09-14" and "10-11"', () => {
		const axis = period("4w").chart!.axis;
		assert.equal(axis.dots.length, 28);
		assert.deepEqual(axis.dots.flatMap((d, i) => (d.large ? [i] : [])), [0, 27]);
		assert.deepEqual(axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
	});

	it("has the chips, one on, and the legend: Heart Rate and the chip's series with their glyphs", () => {
		const v = period("4w", "power");
		assert.deepEqual(v.chips, [
			{ id: "pace", label: "Pace", on: false },
			{ id: "power", label: "Power", on: true },
			{ id: "wkg", label: "Power (W/kg)", on: false },
		]);
		assert.deepEqual(v.legend.map((k) => [k.label, k.shape]), [["Heart Rate", "circle"], ["Power", "triangle"]]);
		assert.deepEqual(period("4w").legend.map((k) => [k.label, k.shape]), [["Heart Rate", "circle"], ["Pace", "square"]]);
		assert.deepEqual(period("4w", "wkg").legend.map((k) => [k.label, k.shape]), [["Heart Rate", "circle"], ["Power (W/kg)", "diamond"]]);
		assert.equal(v.title, "Heart Rate");
		assert.equal(v.canGoBack, true);
	});
});

describe("12w, Jul 20 – Oct 11", () => {
	it("HR 182 · 184 · 186 · 184 · 182 on Jul 27, Aug 16, Aug 23, Sep 9, Sep 19; pace on the same days", () => {
		const v = period("12w");
		assert.deepEqual([v.label, v.span], ["Jul 20 - Oct 11", { from: "2026-07-20", to: "2026-10-11" }]);
		assert.deepEqual(pts(v.chart!.left), ["07-27 182", "08-16 184", "08-23 186", "09-09 184", "09-19 182"]);
		assert.deepEqual(pts(v.chart!.right), ["07-27 4:28.66", "08-16 4:30.68", "08-23 4:32.73", "09-09 4:28.66", "09-19 4:28.66"]);
		// Each at its own day, not its block's first: Jul 27 is day 7 of 83.
		assert.equal(v.chart!.left.points[0]!.x, 7 / 83);
	});

	it("power 354 · 351 · 350 · 353 · 354 · 354 and W/kg on those days plus Oct 8", () => {
		assert.deepEqual(pts(period("12w", "power").chart!.right), ["07-27 354", "08-16 351", "08-23 350", "09-09 353", "09-19 354", "10-08 354"]);
		assert.deepEqual(pts(period("12w", "wkg").chart!.right), [
			"07-27 5.2059",
			"08-16 5.1618",
			"08-23 5.1471",
			"09-09 5.1912",
			"09-19 5.2059",
			"10-08 5.2059",
		]);
	});

	it("is every row of the span: no block holds two, so the block's last can't be told from every row here", () => {
		const span = period("12w").span;
		for (const id of ["hr", "pace", "power", "wkg"] as const) {
			const values = seriesValues(id, DATA);
			assert.deepEqual(pickPoints("block", values, span), pickPoints("every", values, span), id);
		}
	});

	it('axes: HR "200 … 180", pace "4:25 … 4:45", power "365 … 345" (no pad would give 350), W/kg "9 8 7 6 5"', () => {
		assert.equal(labels(period("12w").chart!.left), "200 195 190 185 180");
		assert.equal(labels(period("12w").chart!.right), "4:25 4:30 4:35 4:40 4:45");
		assert.equal(labels(period("12w", "power").chart!.right), "365 360 355 350 345");
		assert.equal(labels(period("12w", "wkg").chart!.right), "9 8 7 6 5");
		// [349.8, 354.2] → 345; unpadded, [350, 354] would start at 350.
		assert.equal(Math.floor(350 / axisStep(350, 354, 5)) * 5, 350);
		assert.equal(period("12w", "power").chart!.right.y!.min, 345);
	});

	it('marks the 12 block starts and today, all large, "MM-DD" on end: 07-20 … 10-05 10-11 (the last gap 6 days)', () => {
		const axis = period("12w").chart!.axis;
		assert.equal(axis.dots.length, 13);
		assert.ok(axis.dots.every((d) => d.large) && axis.labels.every((l) => l.rotated));
		assert.deepEqual(axis.labels.map((l) => l.text), ["07-20", "07-27", "08-03", "08-10", "08-17", "08-24", "08-31", "09-07", "09-14", "09-21", "09-28", "10-05", "10-11"]);
		assert.deepEqual(axis.dots.map((d) => Math.round(d.x * 83)), [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 83]);
	});
});

describe("1y, Oct 13, 2025 – Oct 11, 2026", () => {
	it("HR: each calendar month's last change at its own day, 12 of 27 rows", () => {
		const v = period("1y");
		assert.deepEqual([v.label, v.span], ["Oct 13, 2025 - Oct 11, 2026", { from: "2025-10-13", to: "2026-10-11" }]);
		assert.deepEqual(pts(v.chart!.left), [
			"10-13 188",
			"11-10 186",
			"12-07 183",
			"01-26 185",
			"02-21 187",
			"03-27 184",
			"04-22 185",
			"05-30 186",
			"06-29 185",
			"07-27 182",
			"08-23 186",
			"09-19 182",
		]);
		assert.equal(pickPoints("every", seriesValues("hr", DATA), v.span).length, 27);
	});

	it("pace 4:03.24 · 4:01.61 · 4:01.61 · 4:04.90 · 4:08.28 · 4:18.99 · 4:15.32 · 4:18.99 · 4:22.77 · 4:28.66 · 4:32.73 · 4:28.66", () => {
		assert.deepEqual(
			period("1y").chart!.right.points.map((p) => mmss(p.value)),
			["4:03.24", "4:01.61", "4:01.61", "4:04.90", "4:08.28", "4:18.99", "4:15.32", "4:18.99", "4:22.77", "4:28.66", "4:32.73", "4:28.66"],
		);
	});

	it("October 2025 is Oct 13 (188): the Oct 12 row (186) is outside the period; nothing is carried in", () => {
		assert.deepEqual(LT.find((r) => r.date === "2025-10-12"), { date: "2025-10-12", hr: 186, speed: 4.1111 });
		assert.equal(period("1y").chart!.left.points[0]!.date, "2025-10-13");
		assert.equal(period("1y").chart!.left.points[0]!.x, 0);
	});

	it("leaves out the month's earlier changes, which would be visible points: Nov 5, Jan 15/16, Mar 8/12/17/18/22 …", () => {
		const drawn = new Set(period("1y").chart!.left.points.map((p) => p.date));
		for (const day of ["2025-11-05", "2026-01-15", "2026-01-16", "2026-03-08", "2026-03-12", "2026-03-17", "2026-03-18", "2026-03-22"]) assert.ok(!drawn.has(day), day);
	});

	it("power 380 · 389 · 383 · 378 · 366 · 369 · 366 · 360 · 354 · 350 · 354 · 354, 12 of 24 rows, Jun 13 and Oct 8, no December", () => {
		const v = period("1y", "power");
		assert.deepEqual(pts(v.chart!.right), [
			"10-13 380",
			"11-10 389",
			"01-26 383",
			"02-21 378",
			"03-27 366",
			"04-22 369",
			"05-30 366",
			"06-13 360",
			"07-27 354",
			"08-23 350",
			"09-19 354",
			"10-08 354",
		]);
		assert.equal(pickPoints("every", seriesValues("power", DATA), v.span).length, 24);
	});

	it("W/kg 5.6548 · 5.7206 · 5.6324 · 5.5588 · 5.3824 · 5.4265 · 5.3824 · 5.2941 · 5.2059 · 5.1471 · 5.2059 · 5.2059", () => {
		assert.deepEqual(
			period("1y", "wkg").chart!.right.points.map((p) => p.value.toFixed(4)),
			["5.6548", "5.7206", "5.6324", "5.5588", "5.3824", "5.4265", "5.3824", "5.2941", "5.2059", "5.1471", "5.2059", "5.2059"],
		);
	});

	it('axes: HR "200 … 180", pace "4:00 4:10 4:20 4:30 4:40" (s 5 fails, so 10), power "420 … 340" (s 10 fails, so 20), W/kg "9 … 5"', () => {
		assert.equal(labels(period("1y").chart!.left), "200 195 190 185 180");
		assert.equal(labels(period("1y").chart!.right), "4:00 4:10 4:20 4:30 4:40");
		assert.equal(labels(period("1y", "power").chart!.right), "420 400 380 360 340");
		assert.equal(labels(period("1y", "wkg").chart!.right), "9 8 7 6 5");
		assert.deepEqual([axisStep(240.06, 274.28, 5), axisStep(348.05, 390.95, 5)], [10, 20]);
	});

	it("a 10 % pad would fail the pace axis: 220–300", () => {
		const values = period("1y").chart!.right.points.map((p) => p.value);
		const [lo, hi] = [Math.min(...values), Math.max(...values)];
		const pad = 0.1 * (hi - lo);
		const s = axisStep(lo - pad, hi + pad, 5);
		assert.deepEqual([Math.floor((lo - pad) / s) * s, Math.floor((lo - pad) / s) * s + 4 * s], [220, 300]);
		assert.equal(RANGE_PAD, 0.05);
	});

	it("marks 13 dots at today − 12 months + k, Oct … Oct, on end; the first 2 days before the period's first day", () => {
		const axis = period("1y").chart!.axis;
		assert.equal(axis.dots.length, 13);
		assert.ok(axis.dots.every((d) => d.large) && axis.labels.every((l) => l.rotated));
		assert.deepEqual(axis.labels.map((l) => l.text), ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
		assert.deepEqual(axis.dots.map((d) => Math.round(d.x * 363)), Array.from({ length: 13 }, (_, k) => daysBetween("2025-10-13", addMonths("2025-10-11", k))));
		assert.equal(axis.dots[0]!.x, -2 / 363);
		assert.equal(axis.dots[12]!.x, 1);
	});

	it("falls 3 days before the period when the year back holds a Feb 29 (Inferred)", () => {
		const axis = ltXAxis("1y", { from: "2027-10-14", to: "2028-10-11" });
		assert.equal(Math.round(axis.dots[0]!.x * 363), -3);
	});
});

/** A shot's x for a fraction of the plot: linear, fitted on the axis' first and last dots. */
function xPx(shot: Shot, axis: PeriodAxis): (x: number) => number {
	const f0 = axis.dots[0]!.x;
	const f1 = axis.dots.at(-1)!.x;
	const p0 = shot.dots[0]!;
	const p1 = shot.dots.at(-1)!;
	return (x) => p0 + ((x - f0) / (f1 - f0)) * (p1 - p0);
}

/** A shot's y for a value: linear between the top and bottom gridlines, by the line's own axis. */
function yPx(shot: Shot, y: LtYAxis): (value: number) => number {
	return (value) => shot.grid[0] + yFraction(y, value) * (shot.grid[1] - shot.grid[0]);
}

describe("the nine range shots, in pixels (3 a point)", () => {
	const cases = (["4w", "12w", "1y"] as const).flatMap((range) => LT_CHIPS.map((chip) => [range, chip] as const));
	let worstMarker = 0;
	let worstDot = 0;

	for (const [range, chip] of cases) {
		it(`${range} ${chip}: every axis dot within 0.78 px and every marker within 2.17 px of where the view puts it`, () => {
			const shot = SHOTS[`${range}/${chip}`]!;
			const chart = period(range, chip).chart!;
			const x = xPx(shot, chart.axis);
			assert.equal(chart.axis.dots.length, shot.dots.length);
			chart.axis.dots.forEach((d, i) => {
				const off = Math.abs(x(d.x) - shot.dots[i]!);
				worstDot = Math.max(worstDot, off);
				assert.ok(off <= 0.78, `dot ${i}: ${off.toFixed(2)} px`);
			});
			for (const line of [chart.left, chart.right]) {
				const read = shot[line.id as LtSeriesId]!;
				const y = yPx(shot, line.y!);
				assert.equal(line.points.length, read.length, `${line.id}: ${line.points.length} points, ${read.length} markers`);
				line.points.forEach((p, i) => {
					const off = Math.max(Math.abs(x(p.x) - read[i]![0]), Math.abs(y(p.value) - read[i]![1]));
					worstMarker = Math.max(worstMarker, off);
					assert.ok(off <= 2.17 + 0.005, `${line.id} ${p.date}: ${off.toFixed(2)} px`);
				});
			}
		});
	}

	it("worst: a marker 2.17 px off (12w Power), a dot 0.78 px", () => {
		assert.equal(worstMarker.toFixed(2), "2.17");
		assert.equal(worstDot.toFixed(2), "0.78");
	});

	it("1y's dots are today − 12 months + k: the period's first day + k months, 2 days later, misses every one by 4–6 px", () => {
		for (const chip of LT_CHIPS) {
			const shot = SHOTS[`1y/${chip}`]!;
			const chart = period("1y", chip).chart!;
			const x = xPx(shot, chart.axis);
			const offs = Array.from({ length: 13 }, (_, k) => Math.abs(x(daysBetween("2025-10-13", addMonths("2025-10-13", k)) / 363) - shot.dots[k]!));
			assert.ok(Math.min(...offs) > 4 && Math.max(...offs) < 6, `${chip}: ${offs.map((o) => o.toFixed(1)).join(" ")}`);
		}
	});
});

/*
 * The web's routes over their own windows are Garmin's own picks: the
 * weekly route is each 7-day block's last change, blocks counted back from
 * its end; the monthly route each calendar month's last change inside the
 * window. Rows as the web's bodies and the probes have them, [updatedDate,
 * value] (api-samples/*-weekly-*, *-monthly-*).
 */
describe("the web's weekly and monthly routes", () => {
	const picked = (pick: "block" | "month", id: LtSeriesId, from: string, to: string) =>
		pickPoints(pick, seriesValues(id, DATA), { from, to }).map((p) => [p.date, id === "pace" ? Math.round((1000 / p.value) * 1e4) / 1e4 : p.value]);

	it("12w (Sunday blocks, Jul 26 – Oct 17): the same five changes as the phone's", () => {
		assert.deepEqual(picked("block", "hr", "2026-07-26", "2026-10-17"), [
			["2026-07-27", 182],
			["2026-08-16", 184],
			["2026-08-23", 186],
			["2026-09-09", 184],
			["2026-09-19", 182],
		]);
		// The speed route's weekly rows, × 10: 0.37222118, 0.36944341, 0.36666564, 0.37222118, 0.37222118.
		assert.deepEqual(picked("block", "pace", "2026-07-26", "2026-10-17").map(([, v]) => v), [3.7222, 3.6944, 3.6667, 3.7222, 3.7222]);
		// The Wednesday probe (Jul 23 – Oct 14, Thursday blocks) finds the same days.
		assert.deepEqual(picked("block", "hr", "2026-07-23", "2026-10-14").map(([d]) => d), ["2026-07-27", "2026-08-16", "2026-08-23", "2026-09-09", "2026-09-19"]);
	});

	it("12w −1 (May 3 – Jul 25): the Jun 28 – Jul 4 block holds Jun 29 (185) and Jul 2 (184), and the route gives Jul 2", () => {
		assert.deepEqual(picked("block", "hr", "2026-05-03", "2026-07-25"), [
			["2026-05-17", 187],
			["2026-05-30", 186],
			["2026-06-13", 187],
			["2026-07-02", 184],
		]);
	});

	it("1y (Nov 2, 2025 – Oct 31, 2026): 11 months, each month's last change", () => {
		assert.deepEqual(picked("month", "hr", "2025-11-02", "2026-10-31"), [
			["2025-11-10", 186],
			["2025-12-07", 183],
			["2026-01-26", 185],
			["2026-02-21", 187],
			["2026-03-27", 184],
			["2026-04-22", 185],
			["2026-05-30", 186],
			["2026-06-29", 185],
			["2026-07-27", 182],
			["2026-08-23", 186],
			["2026-09-19", 182],
		]);
	});

	it("1y −1 (Nov 2, 2024 – Oct 31, 2025): Aug 21, Sep 18, Oct 13; power 373, 371, 380 W and 5.5672, 5.5373, 5.6548 W/kg", () => {
		assert.deepEqual(picked("month", "hr", "2024-11-02", "2025-10-31"), [
			["2025-08-21", 185],
			["2025-09-18", 181],
			["2025-10-13", 188],
		]);
		assert.deepEqual(picked("month", "pace", "2024-11-02", "2025-10-31").map(([, v]) => v), [4.0278, 4, 4.1111]);
		assert.deepEqual(picked("month", "power", "2024-11-02", "2025-10-31").map(([, v]) => v), [373, 371, 380]);
		assert.deepEqual(picked("month", "wkg", "2024-11-02", "2025-10-31").map(([, v]) => v), [5.5672, 5.5373, 5.6548]);
	});

	it("clips the months to the window at both ends: to Oct 10 October is Oct 8's 183; from Nov 11 there is no November", () => {
		assert.deepEqual(picked("month", "hr", "2025-09-01", "2025-10-10"), [
			["2025-09-18", 181],
			["2025-10-08", 183],
		]);
		assert.deepEqual(picked("month", "hr", "2025-10-09", "2025-11-30"), [
			["2025-10-13", 188],
			["2025-11-10", 186],
		]);
		assert.deepEqual(picked("month", "hr", "2025-11-11", "2025-12-31"), [["2025-12-07", 183]]);
	});

	it("4w −1 (Aug 23 – Sep 19, daily): the three rows the web drew, HR 186, 184, 182", () => {
		assert.deepEqual(pickPoints("every", seriesValues("hr", DATA), { from: "2026-08-23", to: "2026-09-19" }).map((p) => p.value), [186, 184, 182]);
	});

	it("4w (Sep 20 – Oct 11): no threshold row, so the Pace view has nothing; the Power view only Oct 8's 354", () => {
		const span = { from: "2026-09-20", to: "2026-10-11" };
		assert.equal(ltChart("4w", "pace", DATA, span), null);
		const power = ltChart("4w", "power", DATA, span)!;
		assert.deepEqual([power.left.points, power.left.y], [[], null]);
		assert.deepEqual(pts(power.right), ["10-08 354"]);
	});
});

describe("previous periods (Inferred)", () => {
	it("are labelled by the default spans", () => {
		assert.equal(period("4w", "pace", { offset: -1 }).label, "Aug 17 - Sep 13");
		assert.equal(period("12w", "pace", { offset: -1 }).label, "Apr 27 - Jul 19");
		assert.equal(period("1y", "pace", { offset: -1 }).label, "Oct 14, 2024 - Oct 12, 2025");
	});

	it("4w −1: HR 186 · 184, pace 4:33 · 4:29, power 350 · 353, W/kg 5.1471 · 5.1912", () => {
		const v = period("4w", "pace", { offset: -1 });
		assert.deepEqual([pts(v.chart!.left), labels(v.chart!.left)], [["08-23 186", "09-09 184"], "200 195 190 185 180"]);
		assert.deepEqual([v.chart!.right.points.map((p) => paceText(p.value)), labels(v.chart!.right)], [["4:33", "4:29"], "4:25 4:30 4:35 4:40 4:45"]);
		const power = period("4w", "power", { offset: -1 }).chart!.right;
		assert.deepEqual([pts(power), labels(power)], [["08-23 350", "09-09 353"], "365 360 355 350 345"]);
		const wkg = period("4w", "wkg", { offset: -1 }).chart!.right;
		assert.deepEqual([pts(wkg), labels(wkg)], [["08-23 5.1471", "09-09 5.1912"], "9 8 7 6 5"]);
	});

	it("12w −1: the block rule shows — Jun 29 (185) and Jul 2 (184) share a block, and only Jul 2 is drawn", () => {
		const v = period("12w", "pace", { offset: -1 });
		assert.deepEqual([pts(v.chart!.left), labels(v.chart!.left)], [["05-17 187", "05-30 186", "06-13 187", "07-02 184"], "200 195 190 185 180"]);
		assert.equal(pickPoints("every", seriesValues("hr", DATA), v.span).length, 5);
		assert.equal(Math.floor(daysBetween(v.span.from, "2026-06-29") / BLOCK_DAYS), Math.floor(daysBetween(v.span.from, "2026-07-02") / BLOCK_DAYS));
		assert.deepEqual([v.chart!.right.points.map((p) => paceText(p.value)), labels(v.chart!.right)], [["4:15", "4:19", "4:23", "4:19"], "4:10 4:15 4:20 4:25 4:30"]);
		const power = period("12w", "power", { offset: -1 }).chart!.right;
		assert.deepEqual([pts(power), labels(power)], [["05-30 366", "06-13 360", "07-02 366"], "375 370 365 360 355"]);
		assert.equal(labels(period("12w", "wkg", { offset: -1 }).chart!.right), "9 8 7 6 5");
	});

	it("1y −1: HR 185 · 181 · 186 (Aug 21, Sep 18, Oct 12), pace 4:08 · 4:10 · 4:03, power 373 · 371 · 380 (Aug 15, Sep 18, Oct 8)", () => {
		const v = period("1y", "pace", { offset: -1 });
		assert.deepEqual([pts(v.chart!.left), labels(v.chart!.left)], [["08-21 185", "09-18 181", "10-12 186"], "200 195 190 185 180"]);
		assert.deepEqual([v.chart!.right.points.map((p) => paceText(p.value)), labels(v.chart!.right)], [["4:08", "4:10", "4:03"], "4:00 4:05 4:10 4:15 4:20"]);
		const power = period("1y", "power", { offset: -1 }).chart!.right;
		assert.deepEqual([pts(power), labels(power)], [["08-15 373", "09-18 371", "10-08 380"], "390 385 380 375 370"]);
		assert.equal(labels(period("1y", "wkg", { offset: -1 }).chart!.right), "9 8 7 6 5");
	});

	it("step back until both indexes are whole and neither holds a row before the period", () => {
		assert.equal(period("1y").canGoBack, true);
		assert.equal(period("1y", "pace", { offset: -1 }).canGoBack, false);
		assert.equal(period("1y", "pace", { offset: -1, ctx: { complete: { lt: false, power: true } } }).canGoBack, true);
		assert.equal(period("1y", "pace", { offset: -1, ctx: { complete: { lt: true, power: false } } }).canGoBack, true);
		// The power history starts a day before the threshold's: 4w on Jul 6 – Aug 2, 2025 holds power only.
		const v = period("4w", "power", { ctx: { today: "2025-08-02" } });
		assert.deepEqual([v.chart!.left.points.length, pts(v.chart!.right), v.canGoBack], [0, ["08-02 394"], false]);
	});
});

describe("imperial units (Inferred)", () => {
	const imperial = (range: "4w" | "12w" | "1y") => period(range, "pace", { ctx: { units: "imperial" } });

	it('pace a mile, the same rules on s/mi: 4w "7:05 … 7:25", 12w "7:10 … 7:30", 1y "6:20 6:40 7:00 7:20 7:40"', () => {
		assert.equal(labels(imperial("4w").chart!.right), "7:05 7:10 7:15 7:20 7:25");
		assert.equal(labels(imperial("12w").chart!.right), "7:10 7:15 7:20 7:25 7:30");
		assert.equal(labels(imperial("1y").chart!.right), "6:20 6:40 7:00 7:20 7:40");
		assert.deepEqual(imperial("4w").chart!.right.points.map((p) => paceText(p.value)), ["7:12"]);
		assert.equal(imperial("4w").units, "imperial");
	});

	it("leaves heart rate and power alone", () => {
		assert.deepEqual(imperial("1y").chart!.left, period("1y").chart!.left);
		assert.deepEqual(period("1y", "power", { ctx: { units: "imperial" } }).chart, period("1y", "power").chart);
	});
});

describe("empty states (Inferred)", () => {
	it("a side without a point is left unlabelled while the other draws: 4w to Oct 31 holds Oct 8's power and no threshold change", () => {
		const v = period("4w", "power", { ctx: { today: "2026-10-31" } });
		assert.deepEqual([v.chart!.left.points, v.chart!.left.y, v.empty], [[], null, undefined]);
		assert.deepEqual([pts(v.chart!.right), labels(v.chart!.right)], [["10-08 354"], "370 365 360 355 350"]);
	});

	it("neither side with a point: the web's line in the chart's place, the title, legend and chips kept", () => {
		const v = period("4w", "pace", { ctx: { today: "2026-10-31" } });
		assert.deepEqual([v.chart, v.empty], [null, "You have no data for this time period."]);
		assert.deepEqual([v.title, v.legend.map((k) => k.label), v.chips.map((c) => c.on)], ["Heart Rate", ["Heart Rate", "Pace"], [true, false, false]]);
	});

	it("no lactate threshold ever: the ranges' empty line, and '<' only while the history may still come", () => {
		const data: LtData = { lt: [], power: [] };
		assert.deepEqual([period("1y", "pace", { data }).chart, period("1y", "pace", { data }).empty], [null, "You have no data for this time period."]);
		assert.deepEqual(currentView(null).cells.map((c) => c.value), [DASH, DASH, DASH, DASH]);
		assert.equal(period("1y", "pace", { data }).canGoBack, false);
		assert.equal(period("1y", "pace", { data, ctx: { complete: { lt: false, power: true } } }).canGoBack, true);
	});

	it("power without a weigh-in: the W/kg chip draws heart rate alone", () => {
		const power = POWER.map(({ runningWkg: _r, ...rest }) => rest);
		const v = period("1y", "wkg", { data: { lt: LT, power } });
		assert.deepEqual([v.chart!.left.points.length, v.chart!.right.points, v.chart!.right.y], [12, [], null]);
		assert.equal(period("1y", "power", { data: { lt: LT, power } }).chart!.right.points.length, 12);
	});
});

describe("rules", () => {
	it("is the registry's stat: Current, 4w, 12w, 1y on the default spans, in the fitness group, opened by the lactateThreshold card", () => {
		const stat = PERFORMANCE_REGISTRY.page("running-lactate-threshold")!;
		assert.deepEqual([stat.ranges, stat.defaultRange, stat.rangeLabels, stat.group, stat.glance, stat.spans], [
			["1d", "4w", "12w", "1y"],
			"1d",
			{ "1d": "Current" },
			"fitness",
			["lactateThreshold"],
			undefined,
		]);
		assert.equal(runningLactateThresholdView(performanceStatRoute("running-lactate-threshold"), DATA, CTX).range, "1d");
	});

	it("names the series, their glyphs, their least steps and pace's inverted axis", () => {
		assert.deepEqual(
			Object.values(LT_SERIES).map((s) => [s.id, s.label, s.shape, s.minStep, s.inverted]),
			[
				["hr", "Heart Rate", "circle", 5, false],
				["pace", "Pace", "square", 5, true],
				["power", "Power", "triangle", 5, false],
				["wkg", "Power (W/kg)", "diamond", 1, false],
			],
		);
		assert.equal(CHART_TITLE, "Heart Rate");
	});

	it("keeps the chip in the route's sub: Power or W/kg, else Pace; the period stays", () => {
		assert.deepEqual(LT_CHIPS, ["pace", "power", "wkg"]);
		assert.deepEqual([ltChip(undefined), ltChip("power"), ltChip("wkg"), ltChip("hr"), ltChip("off:pace")], ["pace", "power", "wkg", "pace", "pace"]);
		const route = performanceStatRoute("running-lactate-threshold", { range: "1y", offset: -1 });
		const on = withLtChip(route, "wkg");
		assert.deepEqual(on, { ...route, sub: "wkg" });
		assert.deepEqual(withLtChip(on, "pace"), route);
		assert.ok(!("sub" in withLtChip(on, "pace")));
		assert.equal((runningLactateThresholdView(on, DATA, CTX) as LtPeriodView).chip, "wkg");
	});

	it("is single-select with one always on: a tap on the chip that is on keeps it, another switches", () => {
		assert.deepEqual(LT_CHIP_RULE, { multi: false, required: true });
		assert.deepEqual(toggleChip(["pace"], "pace", LT_CHIP_RULE), ["pace"]);
		assert.deepEqual(toggleChip(["pace"], "wkg", LT_CHIP_RULE), ["wkg"]);
	});

	it("opens each range on Pace: a range switch drops the chip, a period step keeps it (Inferred)", () => {
		const on = performanceStatRoute("running-lactate-threshold", { range: "4w", sub: "wkg" });
		assert.deepEqual(movedRoute(on, { ...on, offset: -1 }), { ...on, offset: -1 });
		const switched = movedRoute(on, { ...on, range: "12w" as const });
		assert.deepEqual([switched.range, "sub" in switched], ["12w", false]);
		assert.equal((runningLactateThresholdView(switched, DATA, CTX) as LtPeriodView).chip, "pace");
		assert.ok(!("sub" in movedRoute(on, { ...on, range: "1d" as const })));
	});

	it("cuts each axis by the one rule: flat ±2.5, else 5 % each side; steps 1, 2, 5 × 10ᵏ from the least", () => {
		assert.equal(FLAT_PAD, 2.5);
		const text = (id: LtSeriesId, values: number[]) => ltYAxis(id, values)!.labels.join(" ");
		// Steps of 2 are not for bpm: 12w's heart rate would be 180–188.
		assert.equal(text("hr", [182, 184, 186]), "200 195 190 185 180");
		assert.equal(axisStep(181.8, 186.2, 1), 2);
		// Nor 0.5 for W/kg: 1y's would be 5–7.
		assert.equal(text("wkg", [5.1471, 5.7206]), "9 8 7 6 5");
		// Beyond the shots (Inferred): [299, 321] → s 5 fails (295 + 20), so 10 from 290; a range over 4 × 50,
		// [85, 415] → s 100 fails (0 + 400), so 200 from 0; and nothing to plot.
		assert.equal(text("power", [300, 320]), "330 320 310 300 290");
		assert.deepEqual(ltYAxis("power", [100, 400])!.ticks, [800, 600, 400, 200, 0]);
		assert.equal(ltYAxis("hr", []), null);
		assert.equal(ltYAxis("hr", [Number.NaN]), null);
	});

	it("places a value top to bottom on its axis, pace's fastest at the top", () => {
		const hr = ltYAxis("hr", [182])!;
		assert.deepEqual([yFraction(hr, 195), yFraction(hr, 175), yFraction(hr, 182)], [0, 1, 0.65]);
		const pace = ltYAxis("pace", [268.66])!;
		assert.deepEqual([pace.ticks[0], pace.ticks[4]], [265, 285]);
		assert.deepEqual([yFraction(pace, 265), yFraction(pace, 285)], [0, 1]);
	});

	it("dates every point at its own day, 4w's every row, 12w's block-last, 1y's month-last", () => {
		const values: LtValue[] = [
			{ date: "2026-01-01", value: 1 },
			{ date: "2026-01-03", value: 2 },
			{ date: "2026-01-09", value: 3 },
			{ date: "2026-02-01", value: 4 },
		];
		const span = { from: "2026-01-01", to: "2026-02-04" };
		assert.deepEqual(pickPoints("every", values, span).map((p) => p.value), [1, 2, 3, 4]);
		assert.deepEqual(pickPoints("block", values, span).map((p) => [p.date, p.value]), [["2026-01-03", 2], ["2026-01-09", 3], ["2026-02-01", 4]]);
		assert.deepEqual(pickPoints("month", values, span).map((p) => [p.date, p.value]), [["2026-01-09", 3], ["2026-02-01", 4]]);
		assert.deepEqual(pickPoints("every", values, { from: "2026-01-02", to: "2026-01-09" }).map((p) => p.x), [1 / 7, 1]);
	});
});
