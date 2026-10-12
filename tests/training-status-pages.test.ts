import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { performanceStatRoute } from "../src/dashboard/routes";
import {
	LOAD_FOCUS_WORDS,
	NO_DATA,
	NO_STATUS_YET,
	STATUS_BY_CODE,
	STATUS_WORDS,
	TRAINING_STATUS_HELP,
	basedOnLine,
	loadFocusLine,
	statusCopy,
	statusOfPhrase,
} from "../src/dashboard/training-status-copy";
import {
	SINCE_DAYS,
	axisOf,
	blocksOf,
	currentRow,
	hrvValue,
	loadValue,
	runDates,
	runOfSub,
	runSub,
	sinceOf,
	statusOf,
	trainingStatusView,
	withSelection,
	type TrainingStatusContext,
	type TrainingStatusCurrentView,
	type TrainingStatusPeriodView,
	type TrainingStatusRoute,
} from "../src/dashboard/training-status-pages";
import { shiftDate } from "../src/sync/day-index";
import type { TrainingStatusRow } from "../src/sync/training-status-index";
import { BY_DATE, DAYS, HRV, ROWS, TODAY, VO2 } from "./training-status-fixture";

/**
 * Golden numbers from ref/performance-stats/training-status/README.md: the
 * phone shots of Sunday 2026-10-11 21:09–21:19, the web of 22:37–22:43 and
 * the payloads of 2026-10-11 22:29 and 2026-10-12 05:19–05:38 — the spec's
 * 88 checks (golden-training-status.py) that reach the page. The 4w, 12w and
 * 6m windows roll daily, so they only reproduce with today pinned.
 */

/** A man of 23, as the VO₂ Max page grades him. */
const CTX: TrainingStatusContext = { today: TODAY, complete: true, days: DAYS, vo2: VO2, age: 23, sex: "male", hrv: HRV };

function view(range: TrainingStatusRoute["range"], opts: { offset?: number; sub?: string; ctx?: Partial<TrainingStatusContext>; rows?: TrainingStatusRow[] } = {}) {
	const route: TrainingStatusRoute = { range, offset: opts.offset ?? 0, ...(opts.sub ? { sub: opts.sub } : {}) };
	return trainingStatusView(route, opts.rows ?? ROWS, { ...CTX, ...opts.ctx });
}
const current = (opts: Parameters<typeof view>[1] = {}) => view("1d", opts) as TrainingStatusCurrentView;
const period = (range: "4w" | "12w" | "6m", opts: Parameters<typeof view>[1] = {}) => view(range, opts) as TrainingStatusPeriodView;
const table = (v: TrainingStatusPeriodView) => v.table.map((r) => `${r.word} · ${r.dates}`);
const runs = (v: TrainingStatusPeriodView) => v.strip!.blocks.filter((b) => b.status !== null);

describe("the fixture", () => {
	it("is the whole history: 435 rows from 2025-08-02, 2025-08-08 missing, 28 phrases", () => {
		assert.equal(ROWS.length, 435);
		assert.deepEqual([ROWS[0]!.date, ROWS[ROWS.length - 1]!.date], ["2025-08-02", TODAY]);
		assert.equal(BY_DATE.has("2025-08-08"), false);
		assert.equal(new Set(ROWS.map((r) => r.phrase)).size, 28);
		// Every phrase's prefix is its code's status, one to one.
		for (const row of ROWS) assert.equal(statusOfPhrase(row.phrase), STATUS_BY_CODE[row.code!], row.date);
	});
});

describe("Current — Sunday 2026-10-11", () => {
	it("is the newest row: the yellow badge and Maintaining, code 4", () => {
		const v = current();
		assert.deepEqual([v.date, v.status, v.word, v.icon, v.label, v.canGoBack], [TODAY, "maintaining", "Maintaining", "runner-bars", null, false]);
		assert.equal(v.empty, undefined);
	});

	it("reads Load Focus off the day file, Since off the run, Based on off the trend's sport, and MAINTAINING_2's copy", () => {
		const v = current();
		assert.equal(v.focus, "Load Focus - Low Aerobic Shortage");
		assert.equal(v.since, "Since Oct 11");
		assert.equal(v.basedOn, "Based on your Running VO₂ Max Trend");
		assert.equal(
			v.copy,
			["Your current training load is sufficient to", "maintain your fitness. To see improvement, try", "varying the intensity of your activities between", "low aerobic, high aerobic and anaerobic."].join(" "),
		);
	});

	it("has the four rows the phone showed, each opening its page as the phone did", () => {
		assert.deepEqual(
			current().factors.map((f) => [f.title, f.value, f.route]),
			[
				["VO₂ Max", "55 - Excellent", { page: "performance-stat", stat: "vo2-max", range: "1d", offset: 0 }],
				["HRV Status", "84 ms - Balanced", { page: "performance-stat", stat: "hrv-status", range: "1d", offset: 0 }],
				["Load", "498 - Optimal", { page: "performance-stat", stat: "training-load", range: "4w", offset: 0, tab: "focus" }],
				["Heat Acclimation", "97%", { page: "performance-stat", stat: "heat-acclimation", range: "1d", offset: 0 }],
			],
		);
	});

	it("ignores the route's offset: there is no date row, as Home's In Focus card may open it on Home's day", () => {
		assert.deepEqual(current({ offset: -3 }), current());
	});
});

describe("Since — max(the run's first day, the day − 13)", () => {
	const cases: Array<[string, string]> = [
		[TODAY, TODAY],
		["2026-10-09", "2026-10-06"],
		["2026-10-02", "2026-09-23"],
		["2026-09-20", "2026-09-09"],
		// Capped 13 days back: the run began Sep 4 and Aug 22.
		["2025-09-20", "2025-09-07"],
		["2025-09-05", "2025-08-23"],
		// After the missing Aug 8, though both sides are No Status.
		["2025-08-09", "2025-08-09"],
	];
	for (const [day, since] of cases) {
		it(`${day} → ${since}, Garmin's sinceDate`, () => {
			assert.equal(sinceOf(BY_DATE, day), since);
			// Current on that day says it.
			const v = current({ ctx: { today: day } });
			assert.equal(v.since, `Since ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(since.slice(5, 7)) - 1]} ${Number(since.slice(8))}`);
		});
	}

	it("never reaches more than 13 days back, and is nothing for a day without a row", () => {
		assert.equal(SINCE_DAYS, 13);
		for (const row of ROWS) assert.ok(sinceOf(BY_DATE, row.date)! >= shiftDate(row.date, -13), row.date);
		assert.equal(sinceOf(BY_DATE, "2025-08-08"), undefined);
		// Current's own row is the newest on or before today.
		assert.equal(currentRow(ROWS, "2026-10-12")?.date, TODAY);
		assert.equal(currentRow(ROWS, "2025-08-01"), undefined);
	});
});

describe("4w — Sep 14 – Oct 11", () => {
	const v = period("4w");

	it("is the 28 days to today, with the steppers of the current period", () => {
		assert.deepEqual([v.label, v.from, v.to, v.days, v.canGoBack, v.canGoForward], ["Sep 14 - Oct 11", "2026-09-14", TODAY, 28, true, false]);
	});

	it("draws six runs, grouped by code: Productive Sep 14 – 20 holds PRODUCTIVE_3 and _5", () => {
		assert.deepEqual(
			v.strip!.blocks.map((b) => [b.start, b.days, b.status, b.key]),
			[
				[0, 7, "productive", "run:2026-09-14"],
				[7, 2, "peaking", "run:2026-09-21"],
				[9, 10, "productive", "run:2026-09-23"],
				[19, 3, "maintaining", "run:2026-10-03"],
				[22, 5, "recovery", "run:2026-10-06"],
				[27, 1, "maintaining", "run:2026-10-11"],
			],
		);
		assert.equal(v.strip!.selected, undefined);
	});

	it("labels seven slots every 4 days from day 2", () => {
		assert.deepEqual(v.axis.map((a) => a.text), ["09-16", "09-20", "09-24", "09-28", "10-02", "10-06", "10-10"]);
		assert.deepEqual(v.axis.map((a) => a.x), [1, 3, 5, 7, 9, 11, 13].map((k) => k / 14));
	});

	it("lists the six runs newest first, as the phone did", () => {
		assert.deepEqual(table(v), [
			"Maintaining · Since Oct 11",
			"Recovery · Oct 6 - 10",
			"Maintaining · Oct 3 - 5",
			"Productive · Sep 23 - Oct 2",
			"Peaking · Sep 21 - 22",
			"Productive · Sep 14 - 20",
		]);
		assert.ok(v.table.every((r) => !r.selected && !r.dimmed));
	});
});

/** The 12w table: the shots' 23 rows, and the two that fell between and below them (Aug 18 - 19, Jul 20 - 21). */
const TABLE_12W = [
	"Maintaining · Since Oct 11",
	"Recovery · Oct 6 - 10",
	"Maintaining · Oct 3 - 5",
	"Productive · Sep 23 - Oct 2",
	"Peaking · Sep 21 - 22",
	"Productive · Sep 9 - 20",
	"Maintaining · Sep 5 - 8",
	"Strained · Sep 3 - 4",
	"Unproductive · Aug 26 - Sep 2",
	"Overreaching · Aug 24 - 25",
	"Productive · Sunday, August 23",
	"Maintaining · Saturday, August 22",
	"Recovery · Aug 20 - 21",
	"Maintaining · Aug 18 - 19",
	"Productive · Aug 16 - 17",
	"Strained · Aug 12 - 15",
	"Productive · Aug 8 - 11",
	"Recovery · Aug 6 - 7",
	"Maintaining · Aug 4 - 5",
	"Productive · Jul 30 - Aug 3",
	"Maintaining · Jul 27 - 29",
	"Detraining · Jul 25 - 26",
	"Recovery · Jul 23 - 24",
	"Peaking · Wednesday, July 22",
	"Recovery · Jul 20 - 21",
];

describe("12w — Jul 20 – Oct 11", () => {
	const v = period("12w");

	it("is the 84 days to today", () => {
		assert.deepEqual([v.label, v.from, v.to, v.days], ["Jul 20 - Oct 11", "2026-07-20", TODAY, 84]);
	});

	it("draws 25 runs over every day, clipped to the period: 4w's Sep 14 - 20 is Sep 9 - 20 here", () => {
		assert.equal(runs(v).length, 25);
		assert.equal(v.strip!.blocks.length, 25);
		assert.deepEqual(runs(v).map((r) => r.status), [
			"recovery", "peaking", "recovery", "detraining", "maintaining", "productive", "maintaining", "recovery", "productive", "strained",
			"productive", "maintaining", "recovery", "maintaining", "productive", "overreaching", "unproductive", "strained", "maintaining", "productive",
			"peaking", "productive", "maintaining", "recovery", "maintaining",
		]);
		assert.deepEqual(runs(v).find((r) => r.from === "2026-09-09"), { start: 51, days: 12, from: "2026-09-09", to: "2026-09-20", status: "productive", key: "run:2026-09-09" });
		// Overreaching stays apart from Strained, as red is from magenta.
		assert.deepEqual(runs(v).slice(15, 18).map((r) => r.status), ["overreaching", "unproductive", "strained"]);
	});

	it("labels seven slots every 12 days from day 6", () => {
		assert.deepEqual(v.axis.map((a) => a.text), ["07-26", "08-07", "08-19", "08-31", "09-12", "09-24", "10-06"]);
	});

	it("lists the 25 runs newest first: the 23 on the shots, in their order, and the two predicted", () => {
		assert.deepEqual(table(v), TABLE_12W);
	});
});

describe("12w — a row selected", () => {
	it("Overreaching · Aug 24 - 25 (02-scroll-1): its block keeps its height, every other row dims", () => {
		const v = period("12w", { sub: "run:2026-08-24" });
		assert.equal(v.selected, "run:2026-08-24");
		const at = v.strip!.selected!;
		assert.deepEqual([at, v.strip!.blocks[at]!.start, v.strip!.blocks[at]!.days, v.strip!.blocks[at]!.status], [15, 35, 2, "overreaching"]);
		const picked = v.table.filter((r) => r.selected);
		assert.deepEqual(picked.map((r) => `${r.word} · ${r.dates}`), ["Overreaching · Aug 24 - 25"]);
		assert.ok(v.table.every((r) => r.dimmed === !r.selected));
		// The rest of the page is as it was.
		assert.deepEqual(table(v), TABLE_12W);
	});

	it("Detraining · Jul 25 - 26 (03-scroll-2): five days in", () => {
		const v = period("12w", { sub: "run:2026-07-25" });
		const block = v.strip!.blocks[v.strip!.selected!]!;
		assert.deepEqual([block.start, block.days, block.status], [5, 2, "detraining"]);
		assert.deepEqual(v.table.filter((r) => !r.dimmed).map((r) => r.word), ["Detraining"]);
	});

	it("is nothing for a sub that names no run of the period", () => {
		for (const sub of ["run:2026-08-25", "run:2026-01-01", "month:2026-08", "overnight"]) {
			const v = period("12w", { sub });
			assert.equal(v.selected, undefined, sub);
			assert.equal(v.strip!.selected, undefined, sub);
			assert.ok(v.table.every((r) => !r.selected && !r.dimmed), sub);
		}
	});

	it("is set and cleared by a row's tap: a second tap clears it (Inferred)", () => {
		const route = performanceStatRoute("training-status", { range: "12w" });
		const on = withSelection(route, runSub("2026-08-24"));
		assert.deepEqual(on, { ...route, sub: "run:2026-08-24" });
		assert.deepEqual(withSelection(on, null), route);
		assert.equal(runOfSub(on.sub), "2026-08-24");
		assert.equal(runOfSub("run:2026-8-24"), undefined);
		assert.equal(runOfSub(undefined), undefined);
	});
});

describe("6m — Apr 13 – Oct 11, the same daily rule (Inferred)", () => {
	const v = period("6m");

	it("is the 182 days to today, 50 runs, 14 of them a single day", () => {
		assert.deepEqual([v.label, v.from, v.days], ["Apr 13 - Oct 11", "2026-04-13", 182]);
		assert.equal(runs(v).length, 50);
		assert.equal(runs(v).filter((r) => r.days === 1).length, 14);
	});

	it("labels seven slots every 26 days from day 13", () => {
		assert.deepEqual(v.axis.map((a) => a.text), ["04-26", "05-22", "06-17", "07-13", "08-08", "09-03", "09-29"]);
	});

	it("lists 50 runs, agreeing with Current: Since Oct 11 down to Apr 13 - 20", () => {
		const rows = table(v);
		assert.equal(rows.length, 50);
		assert.deepEqual(rows.slice(0, 3), ["Maintaining · Since Oct 11", "Recovery · Oct 6 - 10", "Maintaining · Oct 3 - 5"]);
		assert.deepEqual(rows.slice(23, 27), ["Peaking · Wednesday, July 22", "Recovery · Jul 19 - 21", "Productive · Saturday, July 18", "Recovery · Jul 16 - 17"]);
		assert.deepEqual(rows.slice(-3), ["Maintaining · Apr 22 - 24", "Recovery · Tuesday, April 21", "Maintaining · Apr 13 - 20"]);
	});
});

describe("previous periods (Inferred)", () => {
	it("4w −1, Aug 17 – Sep 13: ten runs, the newest a range, '>' on", () => {
		const v = period("4w", { offset: -1 });
		assert.deepEqual([v.label, v.canGoBack, v.canGoForward], ["Aug 17 - Sep 13", true, true]);
		assert.deepEqual(v.axis.map((a) => a.text), ["08-19", "08-23", "08-27", "08-31", "09-04", "09-08", "09-12"]);
		assert.deepEqual(table(v), [
			"Productive · Sep 9 - 13",
			"Maintaining · Sep 5 - 8",
			"Strained · Sep 3 - 4",
			"Unproductive · Aug 26 - Sep 2",
			"Overreaching · Aug 24 - 25",
			"Productive · Sunday, August 23",
			"Maintaining · Saturday, August 22",
			"Recovery · Aug 20 - 21",
			"Maintaining · Aug 18 - 19",
			"Productive · Monday, August 17",
		]);
	});

	it("12w −1, Apr 27 – Jul 19: 23 runs from Recovery · Sunday, July 19", () => {
		const v = period("12w", { offset: -1 });
		assert.equal(v.label, "Apr 27 - Jul 19");
		assert.deepEqual(v.axis.map((a) => a.text), ["05-03", "05-15", "05-27", "06-08", "06-20", "07-02", "07-14"]);
		const rows = table(v);
		assert.equal(rows.length, 23);
		assert.deepEqual([rows[0], rows[rows.length - 1]], ["Recovery · Sunday, July 19", "Productive · Apr 27 - May 13"]);
	});

	it("6m −1, Oct 13, 2025 – Apr 12, 2026: last year's dates carry their year", () => {
		const v = period("6m", { offset: -1 });
		assert.deepEqual([v.label, v.from, v.to], ["Oct 13, 2025 - Apr 12, 2026", "2025-10-13", "2026-04-12"]);
		assert.deepEqual(v.axis.map((a) => a.text), ["10-26", "11-21", "12-17", "01-12", "02-07", "03-05", "03-31"]);
		const rows = table(v);
		assert.equal(rows.length, 56);
		assert.equal(rows[0], "Maintaining · Sunday, April 12");
		for (const row of ["No Status · Jan 11 - 13", "Maintaining · Dec 30, 2025 - Jan 4, 2026", "Peaking · Dec 28-29, 2025", "Maintaining · Friday, December 12, 2025"]) {
			assert.ok(rows.includes(row), row);
		}
		assert.equal(rows[rows.length - 1], "Maintaining · Oct 13-14, 2025");
	});

	it("12w at the history's start: a run over 14 days counts all its days, where Current's Since stops at 13", () => {
		const v = period("12w", { offset: -4 });
		assert.equal(v.label, "Aug 18-Nov 9, 2025");
		assert.ok(table(v).includes("Productive · Aug 22-Sep 22, 2025"));
		assert.equal(sinceOf(BY_DATE, "2025-09-22"), "2025-09-09");
	});

	it("before the history: the missing day and the empty days are empty slots; '<' stops once the index is complete", () => {
		const v = period("4w", { offset: -15 });
		assert.deepEqual([v.from, v.to, v.canGoBack, v.canGoForward], ["2025-07-21", "2025-08-17", false, true]);
		assert.deepEqual(
			v.strip!.blocks.map((b) => [b.start, b.days, b.status]),
			[
				[0, 12, null],
				[12, 6, "none"],
				[18, 1, null],
				[19, 2, "none"],
				[21, 3, "productive"],
				[24, 1, "peaking"],
				[25, 1, "recovery"],
				[26, 1, "maintaining"],
				[27, 1, "unproductive"],
			],
		);
		assert.deepEqual(table(v).slice(-2), ["No Status · Aug 9-10, 2025", "No Status · Aug 2-7, 2025"]);
		// While the history is still coming, "<" stays.
		assert.equal(period("4w", { offset: -15, ctx: { complete: false } }).canGoBack, true);
	});

	it("a period without a row: the web's empty line and no strip", () => {
		const v = period("4w", { offset: -16 });
		assert.deepEqual([v.strip, v.table, v.empty, v.canGoBack], [null, [], NO_DATA, false]);
		assert.equal(v.axis.length, 7);
	});
});

describe("edge states (Inferred)", () => {
	it("today without a row yet: Current shows yesterday's with its Since, the strip's last slot stays empty", () => {
		const ctx = { today: "2026-10-12" };
		const c = current({ ctx });
		assert.deepEqual([c.date, c.word, c.since, c.focus], [TODAY, "Maintaining", "Since Oct 11", "Load Focus - Low Aerobic Shortage"]);
		const v = period("4w", { ctx });
		assert.equal(v.label, "Sep 15 - Oct 12");
		assert.deepEqual(v.strip!.blocks[v.strip!.blocks.length - 1], { start: 27, days: 1, from: "2026-10-12", to: "2026-10-12", status: null });
		assert.equal(table(v)[0], "Maintaining · Since Oct 11");
	});

	it("No Status: no Based-on line, no copy, and the Load row's number alone when the load is not rated", () => {
		const c = current({ ctx: { today: "2025-08-07" } });
		assert.deepEqual([c.status, c.word, c.since, c.basedOn, c.copy], ["none", "No Status", "Since Aug 2", undefined, undefined]);
		assert.equal(c.factors.find((f) => f.id === "load")!.value, "971");
		const after = current({ ctx: { today: "2025-08-09" } });
		assert.deepEqual([after.word, after.since, after.basedOn], ["No Status", "Since Aug 9", undefined]);
		assert.equal(after.factors.find((f) => f.id === "load")!.value, "845 - Optimal");
	});

	it("Paused while Garmin's training status is: its word, whatever the code", () => {
		const rows = ROWS.map((r) => (r.date === TODAY ? { ...r, paused: 1 } : r));
		const c = current({ rows });
		assert.deepEqual([c.status, c.word], ["paused", "Paused"]);
		assert.equal(table(period("4w", { rows }))[0], "Paused · Since Oct 11");
		assert.equal(statusOf({ code: 7, paused: 1 }), "paused");
		assert.equal(statusOf({ phrase: "STRAINED_4" }), "strained");
		assert.equal(statusOf({ code: 42, phrase: "PEAKING_1" }), "peaking");
		assert.equal(statusOf({}), "none");
	});

	it("no rows ever: No Status with the Help's 'How to Get Training Status', and the ranges' empty line", () => {
		const c = current({ rows: [], ctx: { days: [], vo2: [], hrv: [] } });
		assert.deepEqual([c.date, c.status, c.word, c.since, c.focus, c.empty], [undefined, "none", "No Status", undefined, undefined, NO_STATUS_YET]);
		assert.deepEqual(c.factors.map((f) => f.value), ["--", "--", "--", "--"]);
		assert.equal(NO_STATUS_YET.title, "How to Get Training Status");
		const v = period("12w", { rows: [], ctx: { complete: false } });
		assert.deepEqual([v.empty, v.strip, v.canGoBack], [NO_DATA, null, true]);
	});

	it("a cycling trend reads the Cycling tab's VO₂ Max and opens it (Inferred)", () => {
		const rows = ROWS.map((r) => (r.date === TODAY ? { ...r, trendSport: "CYCLING" } : r));
		const c = current({ rows });
		assert.equal(c.basedOn, "Based on your Cycling VO₂ Max Trend");
		const vo2 = c.factors[0]!;
		assert.deepEqual([vo2.value, vo2.route], ["57 - Superior", { page: "performance-stat", stat: "vo2-max", range: "1d", offset: 0, tab: "cycling" }]);
	});

	it("rows without what they need: the number alone, or '--'", () => {
		// No age or sex: the VO₂ number alone, as the VO₂ Max page's dial.
		assert.equal(current({ ctx: { age: undefined } }).factors[0]!.value, "55");
		// Onboarding nights: an average without a status, or none.
		assert.equal(hrvValue([{ date: TODAY, weekly: 80, status: "NONE" }], TODAY), "80 ms");
		assert.equal(hrvValue([{ date: TODAY, night: 52, status: "NONE" }], TODAY), "--");
		assert.equal(hrvValue([{ date: "2026-10-12", weekly: 90, status: "LOW" }], TODAY), "--");
		// The load's words: Low, High and Very High (Overreaching on 2026-01-24).
		assert.equal(loadValue(BY_DATE.get("2026-01-24")), "738 - Very High");
		assert.equal(loadValue(BY_DATE.get("2026-09-28")), "702 - High");
		assert.equal(loadValue(BY_DATE.get("2026-10-10")), "281 - Low");
		assert.equal(loadValue(undefined), "--");
		// A heat source stands in for the day files' when the page has one; nothing at all is "--".
		assert.equal(current({ ctx: { heat: { date: TODAY, pct: 95 } } }).factors[3]!.value, "95%");
		assert.equal(current({ ctx: { days: [] } }).factors[3]!.value, "--");
		assert.equal(current({ ctx: { today: "2026-10-10" } }).factors[3]!.value, "79%");
		// No phrase in the day file that day: no Load Focus line.
		assert.equal(current({ ctx: { days: DAYS.slice(0, 2) } }).focus, undefined);
	});
});

describe("the parts", () => {
	it("blocks and labels of any span: a run is clipped to it, and a stretch without rows is one empty block", () => {
		const blocks = blocksOf(BY_DATE, { from: "2025-08-05", to: "2025-08-11" });
		assert.deepEqual(blocks.map((b) => [b.from, b.to, b.status]), [
			["2025-08-05", "2025-08-07", "none"],
			["2025-08-08", "2025-08-08", null],
			["2025-08-09", "2025-08-10", "none"],
			["2025-08-11", "2025-08-11", "productive"],
		]);
		assert.deepEqual(axisOf({ from: "2026-09-14", to: TODAY }).map((a) => a.date), ["2026-09-16", "2026-09-20", "2026-09-24", "2026-09-28", "2026-10-02", "2026-10-06", "2026-10-10"]);
	});

	it("a run's dates: Since for the current period's newest even a single day, never Today", () => {
		assert.equal(runDates({ from: TODAY, to: TODAY }, true, TODAY), "Since Oct 11");
		assert.equal(runDates({ from: "2026-08-23", to: "2026-08-23" }, false, TODAY), "Sunday, August 23");
		assert.equal(runDates({ from: "2026-09-23", to: "2026-10-02" }, false, TODAY), "Sep 23 - Oct 2");
		assert.equal(runDates({ from: "2025-12-28", to: "2025-12-29" }, false, TODAY), "Dec 28-29, 2025");
		assert.equal(runDates({ from: "2025-12-12", to: "2025-12-12" }, false, TODAY), "Friday, December 12, 2025");
	});
});

describe("the words", () => {
	it("a word a status, in the Help's terms", () => {
		assert.deepEqual(STATUS_BY_CODE.map((s) => STATUS_WORDS[s]), ["No Status", "Detraining", "Unproductive", "Overreaching", "Maintaining", "Recovery", "Peaking", "Productive", "Strained"]);
		assert.equal(STATUS_WORDS.paused, "Paused");
		const help = TRAINING_STATUS_HELP[1]!.parts[0]!.note!.split(" ");
		for (const word of Object.values(STATUS_WORDS)) assert.ok(help.join(" ").includes(word), word);
	});

	it("copy for MAINTAINING_2 only; the other 27 phrases have none yet", () => {
		const phrases = new Set(ROWS.map((r) => r.phrase!));
		assert.deepEqual([...phrases].filter((p) => statusCopy(p)), ["MAINTAINING_2"]);
	});

	it("Load Focus, seen for one phrase and Garmin's spelling for the rest", () => {
		assert.equal(loadFocusLine("AEROBIC_LOW_SHORTAGE"), "Load Focus - Low Aerobic Shortage");
		assert.deepEqual(Object.keys(LOAD_FOCUS_WORDS).map(loadFocusLine), [
			"Load Focus - Low Aerobic Shortage",
			"Load Focus - High Aerobic Shortage",
			"Load Focus - Anaerobic Shortage",
			"Load Focus - Low Aerobic Focus",
			"Load Focus - High Aerobic Focus",
			"Load Focus - Balanced",
			"Load Focus - Above Targets",
		]);
		assert.equal(loadFocusLine("SOMETHING_NEW"), "Load Focus - Something New");
		assert.equal(loadFocusLine(undefined), undefined);
	});

	it("Based on: Running as seen, Cycling Inferred, nothing for NONE", () => {
		assert.deepEqual(["RUNNING", "CYCLING", "NONE", undefined].map(basedOnLine), ["Based on your Running VO₂ Max Trend", "Based on your Cycling VO₂ Max Trend", undefined, undefined]);
	});
});
