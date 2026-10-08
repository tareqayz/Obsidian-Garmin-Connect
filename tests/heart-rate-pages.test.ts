import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	heartRateDayView,
	heartRatePeriodView,
	heartRateView,
	heartRateWeeks,
	zoneFloorsOf,
	zoneOf,
	type HeartRateDayView,
	type HeartRatePageData,
	type HeartRatePeriodView,
	type HeartRateRoute,
	type HeartRateStat,
} from "../src/dashboard/heart-rate-pages";
import { dayCardRoute, meanOf, stepRoute, switchRange, weekCardRoute } from "../src/dashboard/periods";
import type { HeartRateZones } from "../src/garmin/endpoints";
import type { HeartDay, HeartRateRow } from "../src/sync/heart-rate-index";

/** The capture day: everything below is in true dates (ref/health-stats/heart-rate/README.md). */
const TODAY = "2026-10-08";
/**
 * The phone was still showing the day before's data under each day's label
 * when it was shot (ref/health-stats/heart-rate/phone/INDEX.md): its "Today"
 * is the plugin's Oct 7.
 */
const PHONE_DATA_DAY = "2026-10-07";

/**
 * Every daily row from the account's first day to the capture, as
 * `stats/heartRate/daily` sent them live at 02:50 (api-samples/history and
 * the two 4w windows; Oct 8 partial, as at the web capture): resting / High
 * / low, "_" for a null value, "-" for a day without a row (Jan 5 – 9, Feb 6,
 * Apr 1, Jun 24, Aug 18).
 */
const FIRST_DAY = "2025-08-02";
const DAILY = `74/122/70 45/158/44 44/83/43 46/191/43 51/169/46 48/187/46 51/171/48 48/106/45 51/114/48 52/185/49 54/113/53 53/114/51 45/89/43 46/187/44
51/191/48 52/176/46 49/156/48 45/169/27 45/144/44 45/178/44 47/186/45 51/179/56 48/101/45 46/188/45 51/177/47 51/186/50 52/169/52 54/110/51
49/112/48 48/194/46 47/180/45 45/187/43 46/167/44 52/134/47 48/158/47 48/177/45 49/162/46 46/180/44 51/171/48 49/167/47 47/122/45 49/180/47
48/174/44 47/108/44 46/178/44 48/166/45 47/103/46 50/178/47 53/94/50 48/100/47 45/179/44 46/95/43 46/103/44 48/98/45 49/177/46 46/181/45
46/177/44 50/130/47 51/187/47 48/95/44 47/179/45 54/97/46 47/185/44 53/190/63 51/174/46 50/99/47 46/171/45 50/190/49 46/179/45 53/146/51
51/120/47 52/187/50 52/176/48 54/97/53 54/187/52 51/181/47 48/156/45 47/183/45 47/169/43 50/173/45 44/112/42 48/176/46 48/111/45 51/153/51
51/185/50 52/110/50 49/108/47 50/96/47 50/185/47 55/160/47 54/106/44 49/184/47 53/173/48 51/167/49 47/152/44 49/178/45 46/95/44 49/106/46
45/94/43 46/176/44 50/179/47 50/136/49 49/180/46 46/90/44 45/181/42 48/188/44 48/156/44 47/102/45 46/125/43 47/188/45 49/166/45 46/173/44
49/193/45 51/177/49 51/185/49 50/176/48 52/91/50 50/107/48 48/89/47 44/183/42 51/137/47 53/166/53 46/185/45 48/184/45 52/99/50 50/112/47
53/108/51 50/176/44 49/189/45 47/100/45 48/157/46 49/183/45 53/161/50 52/182/48 54/161/53 48/169/43 47/188/46 49/97/48 50/156/49 49/168/47
50/176/47 49/103/46 52/166/49 50/110/49 50/185/45 48/154/45 47/109/46 50/108/48 49/174/46 48/166/45 47/190/44 52/109/44 46/180/44 51/110/49
49/110/47 53/89/57 - - - - - 52/87/47 55/188/55 51/102/48 47/160/45 48/107/46 44/168/42 45/168/38
48/111/46 47/106/43 42/118/41 50/109/49 _/115/45 48/97/45 45/192/43 49/191/47 51/105/43 51/192/49 53/100/68 54/164/71 55/127/66 58/189/52
49/102/45 48/109/47 50/110/47 47/179/45 53/123/49 48/100/46 - 53/184/49 52/111/46 48/110/46 48/190/46 54/114/70 55/85/49 47/175/46
52/174/48 51/110/48 55/159/67 55/188/52 54/163/51 51/105/49 49/97/47 57/198/52 50/152/47 47/142/45 48/102/47 54/104/54 50/103/48 48/159/47
54/99/50 49/148/47 44/116/43 45/112/44 48/131/44 45/133/43 50/99/46 49/94/46 46/184/45 50/183/48 56/97/53 49/94/49 52/183/49 48/189/45
54/109/60 56/103/57 46/155/44 55/179/57 52/171/37 57/110/51 56/119/60 51/88/49 48/191/45 50/148/48 46/182/43 55/96/50 49/98/46 47/183/45
53/170/50 50/178/45 50/180/35 55/170/54 - 55/97/52 48/112/46 46/186/45 54/147/52 48/183/46 54/99/52 49/179/44 51/95/50 48/185/43
54/99/48 53/178/50 50/100/48 45/73/43 54/95/59 50/186/49 48/114/45 54/181/56 53/164/51 45/93/44 44/122/42 53/189/58 50/185/45 47/184/46
49/182/46 52/153/48 51/94/44 46/158/42 45/108/43 46/139/44 45/177/44 45/174/38 49/195/45 49/85/47 46/98/44 46/86/44 48/181/45 49/171/45
48/100/45 47/191/46 43/125/41 47/180/46 49/116/45 48/137/46 46/124/44 48/155/46 50/176/48 58/118/52 51/137/49 46/140/44 48/177/47 51/154/48
46/102/44 54/176/56 51/109/48 46/152/45 53/147/48 51/189/48 49/90/46 50/187/49 54/166/52 50/194/72 55/134/54 54/115/53 51/101/48 46/86/46
46/111/45 47/178/45 50/184/47 50/101/48 46/103/45 51/157/47 44/93/43 44/168/43 48/180/44 51/177/48 50/96/48 45/171/42 _/105/45 52/168/48
56/118/54 50/121/47 54/112/53 47/82/45 - 53/123/52 56/185/56 47/146/45 54/162/51 54/185/49 51/163/50 46/118/44 48/176/46 49/92/46
48/101/46 48/137/44 50/123/47 49/106/47 48/102/46 53/148/54 55/172/52 48/189/47 51/111/49 50/136/48 49/106/47 47/92/45 54/106/57 49/106/47
45/172/43 46/95/43 46/102/43 52/109/50 52/112/53 52/102/49 49/94/47 47/170/44 48/188/45 53/191/50 46/120/44 48/172/46 49/169/47 47/99/44
48/174/47 54/139/49 53/101/52 48/102/44 46/111/45 46/103/44 45/162/45 46/180/44 53/194/50 51/177/57 58/105/55 50/118/49 51/107/46 51/144/48
47/131/44 50/187/48 51/146/48 - 53/109/46 46/148/45 48/110/46 48/177/45 50/185/48 53/194/51 50/95/48 48/105/45 47/91/44 47/157/45
49/172/46 50/192/48 50/189/48 53/106/49 50/127/48 52/164/49 53/162/48 52/180/49 50/107/47 45/181/43 45/92/43 45/164/43 46/105/45 48/124/43
50/184/47 51/124/48 48/145/45 50/168/48 48/166/46 48/96/47 49/105/46 49/182/48 49/160/47 50/117/49 46/193/44 49/185/47 50/113/48 52/192/48
49/107/48 49/184/47 50/187/47 47/102/43 49/101/47 49/121/47 46/100/45 46/188/45 47/109/45 48/99/46 49/108/45 49/108/46 52/76/59`;

/** The seven-day averages a sync on the capture day had from the summaries; a history day has none. */
const AVG7: Record<string, number> = { "2026-10-06": 48, "2026-10-07": 48, "2026-10-08": 48 };

const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The heart rate index as a sync leaves it on the capture day, less any day in `drop`. */
function indexRows(drop: readonly string[] = []): HeartRateRow[] {
	const rows: HeartRateRow[] = [];
	DAILY.split(/\s+/).forEach((cell, i) => {
		const date = shift(FIRST_DAY, i);
		if (cell === "-" || drop.includes(date)) return;
		const [resting, high, low] = cell.split("/").map((v) => (v === "_" ? undefined : Number(v)));
		const row: HeartRateRow = { date };
		if (resting !== undefined) row.resting = resting;
		if (high !== undefined) row.high = high;
		if (low !== undefined) row.low = low;
		if (AVG7[date] !== undefined) row.avg7 = AVG7[date];
		rows.push(row);
	});
	return rows;
}

const ROWS = indexRows();
const data = (rows = ROWS, complete = true): HeartRatePageData => ({ rows, complete });

const H = 3_600_000;
const STEP = 120_000;

/**
 * Oct 6's 720 samples, a two-minute slot each from 21:00Z (UTC+3), as
 * dailyHeartRate sent them (api-samples/dailyHeartRate-2026-10-06.json).
 */
const OCT_6_VALUES = `57 59 69 61 58 53 56 57 56 56 56 53 54 54 54 54 53 55 53 54 55 54 54 54 55 55 53 54 54 54
54 54 53 54 55 55 59 52 53 51 53 53 53 53 61 57 53 50 50 52 52 53 53 55 51 54 55 54 55 53
54 56 55 54 58 51 51 50 54 53 51 55 57 55 53 59 55 59 57 57 57 57 55 56 56 62 57 52 53 54
54 53 55 55 55 55 55 56 57 55 60 58 61 58 58 57 55 55 55 56 66 58 84 72 59 57 54 53 59 54
51 53 52 53 53 55 52 54 55 54 55 56 56 55 55 55 58 53 58 61 67 62 64 57 62 54 56 56 57 58
63 60 58 62 57 58 56 57 57 57 57 59 58 58 60 59 59 52 53 62 54 54 53 54 56 56 59 53 55 55
56 54 53 53 53 56 57 57 60 58 65 75 72 70 72 68 65 67 67 66 77 73 75 79 82 68 60 63 60 62
68 64 63 66 66 66 63 75 66 67 62 66 68 67 68 78 85 84 93 93 102 96 91 96 97 99 93 96 96 92
81 82 70 86 82 76 78 77 78 72 71 77 80 81 79 76 86 82 85 80 71 75 76 80 83 78 79 79 70 72
72 71 73 76 91 88 70 71 77 80 80 86 89 69 70 72 72 67 67 75 75 75 73 75 79 76 74 76 79 78
72 73 78 85 86 75 76 74 77 84 74 76 89 77 88 81 70 74 70 74 71 68 68 65 67 71 74 68 68 69
69 70 68 70 71 69 71 66 65 72 76 78 69 72 80 75 75 67 73 73 76 75 76 72 80 72 72 70 71 72
65 68 68 64 69 69 73 74 71 66 70 71 71 67 71 68 71 76 59 57 60 63 62 62 60 59 55 57 64 66
62 62 62 69 64 60 62 58 61 58 62 61 56 64 71 64 60 56 63 61 70 61 65 61 62 59 59 62 62 65
65 60 65 58 58 61 77 84 81 72 71 73 73 73 67 67 68 65 78 77 67 72 59 62 60 67 65 59 63 63
71 70 69 69 64 69 63 63 65 66 71 69 67 70 65 70 72 66 67 70 70 74 66 68 71 73 72 70 76 67
73 67 65 65 67 69 65 65 67 62 65 63 68 69 71 70 72 65 62 63 64 65 66 66 68 67 65 68 63 61
58 54 55 55 55 54 55 64 59 61 64 60 59 62 60 63 58 62 64 57 59 72 60 56 71 67 70 70 64 57
49 53 55 55 54 55 55 62 58 59 60 59 62 59 61 59 59 60 60 59 61 59 63 61 62 59 59 60 63 67
60 64 64 67 83 73 83 82 80 76 94 102 101 108 87 83 82 63 68 69 63 63 59 63 63 61 62 58 60 61
61 59 57 56 60 56 55 55 55 57 71 60 59 58 62 58 60 57 61 70 69 68 58 56 55 56 51 53 50 50
51 51 51 51 50 50 52 49 52 51 51 51 52 51 52 51 52 52 53 49 50 53 52 51 52 52 50 53 52 50
51 51 52 51 51 51 52 51 50 52 52 50 51 50 50 50 50 48 49 50 50 50 48 50 50 49 50 50 54 48
48 47 48 48 47 50 53 53 51 49 51 45 47 48 47 49 49 50 50 49 49 51 51 48 50 51 50 50 50 50`.split(/\s+/).map(Number);

const OCT_6: HeartDay = {
	start: Date.parse("2026-10-05T21:00:00Z"),
	end: Date.parse("2026-10-06T21:00:00Z"),
	startOffset: 3 * H,
	endOffset: 3 * H,
	step: STEP,
	values: OCT_6_VALUES,
	resting: 49,
	avg7: 48,
	high: 108,
	low: 45,
};

/** Oct 7's bounds and figures, with a few samples: the day the clocks went from UTC+3 to UTC+4. */
const OCT_7: HeartDay = {
	start: Date.parse("2026-10-06T21:00:00Z"),
	end: Date.parse("2026-10-07T20:00:00Z"),
	startOffset: 3 * H,
	endOffset: 4 * H,
	step: STEP,
	values: [50, 53, 49, null, 51],
	resting: 49,
	avg7: 48,
	high: 108,
	low: 46,
};

const day = (offset: number, opts: { today?: string; rows?: HeartRateRow[]; samples?: HeartDay | null; wake?: number } = {}): HeartRateDayView =>
	heartRateDayView({ data: data(opts.rows ?? ROWS), route: { range: "1d", offset }, today: opts.today ?? TODAY, samples: opts.samples, wake: opts.wake });
const period = (range: HeartRateRoute["range"], offset: number, rows = ROWS, today = TODAY): HeartRatePeriodView =>
	heartRatePeriodView({ data: data(rows), route: { range, offset }, today, includeToday: true });

const shown = (s: HeartRateStat) => (s.unit ? `${s.value} ${s.unit}` : s.value);
const figures = (view: HeartRateDayView) => [view.figures.avg7, view.figures.resting, view.figures.high, view.figures.low].map(shown);
const averages = (view: HeartRatePeriodView) => view.stats.map((s) => [s.label, shown(s)]);
const cards = (view: HeartRatePeriodView) => view.days.map((c) => `${c.date.slice(5)} ${c.resting}/${c.high}`);
const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16);

describe("1d", () => {
	it("Oct 7: 48 · 49 · 108 as the web shows them, low 46; the phone's Resting and High", () => {
		const view = day(-1, { samples: OCT_7 });
		assert.equal(view.label, "Wednesday, October 7");
		assert.equal(view.title, "Daily Timeline");
		assert.deepEqual(figures(view), ["48 bpm", "49 bpm", "108 bpm", "46 bpm"]);
		assert.deepEqual(view.figures.avg7.label, "7-Day Avg Resting");
		assert.deepEqual(
			view.stats.map((s) => [s.label, shown(s)]),
			[
				["Resting", "49 bpm"],
				["High", "108 bpm"],
			],
		);
		assert.deepEqual([view.canGoBack, view.canGoForward], [true, true]);
		// The day ran 23 hours: its ends carry their clock's offset.
		assert.deepEqual([view.timeline.state, view.timeline.hours, view.timeline.ticks.length], ["drawn", 23, 24]);
		assert.deepEqual(view.timeline.timeZones, { start: "GMT +03:00", end: "GMT +04:00" });
	});

	it("today, Oct 8 to 01:06: 48 · 52 · 76, low 59, and no >", () => {
		const view = day(0);
		assert.equal(view.label, "Today");
		assert.deepEqual(figures(view), ["48 bpm", "52 bpm", "76 bpm", "59 bpm"]);
		assert.equal(view.canGoForward, false);
	});

	it("the phone's 1d pages, a day ahead of their data: Today 49 / 108, then 49 / 108, 48 / 99, 47 / 109, 46 / 188, 46 / 100", () => {
		const pages = [0, -1, -2, -3, -4, -5].map((offset) => day(offset, { today: PHONE_DATA_DAY }));
		assert.equal(pages[0]!.label, "Today");
		assert.deepEqual(
			pages.map((v) => v.stats.map((s) => s.value).join(" / ")),
			["49 / 108", "49 / 108", "48 / 99", "47 / 109", "46 / 188", "46 / 100"],
		);
	});

	it("Oct 6 with its samples: 720 points over 24 hours, the highest 108 at 16:26Z, the lowest 45 at 20:22Z", () => {
		const t = day(-2, { samples: OCT_6 }).timeline;
		assert.deepEqual([t.state, t.hours, t.points.length, t.timeZones], ["drawn", 24, 720, undefined]);
		assert.deepEqual([clock(t.highest!.at), t.highest!.value, clock(t.lowest!.at), t.lowest!.value], ["16:26", 108, "20:22", 45]);
		assert.deepEqual([t.highest!.x, t.lowest!.x], [583 / 720, 701 / 720]);
		assert.ok(t.points.every((p) => p.value !== null));
	});

	it("a day without a resting value (Jun 18): -- where dailyHeartRate sends its raw minimum, and Garmin's High though the samples reach 168", () => {
		const samples: HeartDay = {
			start: Date.parse("2026-06-17T21:00:00Z"),
			end: Date.parse("2026-06-18T21:00:00Z"),
			startOffset: 3 * H,
			endOffset: 3 * H,
			step: STEP,
			values: [51, 55, null, 105, 168, 112],
			resting: 43,
			high: 105,
			low: 45,
		};
		const view = day(-112, { samples });
		assert.equal(view.date, "2026-06-18");
		assert.deepEqual(figures(view), ["--", "--", "105 bpm", "45 bpm"]);
		assert.equal(view.figures.resting.unit, undefined);
		assert.deepEqual([view.timeline.highest!.value, view.timeline.lowest!.value], [168, 51]);
	});

	it("a day before the samples (2025-10-31): the index's numbers, the stored seven-day average as sent, an empty 35-hour axis", () => {
		const samples: HeartDay = {
			start: Date.parse("2025-10-30T20:00:00Z"),
			end: Date.parse("2025-11-01T07:00:00Z"),
			startOffset: 4 * H,
			endOffset: -7 * H,
			step: STEP,
			values: [],
			resting: 54,
			avg7: 50,
		};
		const view = day(-342, { samples });
		assert.equal(view.date, "2025-10-31");
		assert.equal(view.label, "Friday, October 31, 2025");
		// The rows' own mean over Oct 25 – 31 is 361 / 7 = 51.571: never recomputed.
		const week = ROWS.filter((r) => r.date >= "2025-10-25" && r.date <= "2025-10-31").map((r) => r.resting!);
		assert.deepEqual([week.reduce((a, b) => a + b, 0), week.length, meanOf(week, "round")], [361, 7, 52]);
		assert.deepEqual(figures(view), ["50 bpm", "54 bpm", "106 bpm", "44 bpm"]);
		assert.deepEqual([view.timeline.state, view.timeline.hours, view.timeline.points], ["empty", 35, []]);
		assert.deepEqual(view.timeline.timeZones, { start: "GMT +04:00", end: "GMT -07:00" });
		assert.deepEqual(
			view.timeline.ticks.filter((k) => k.label).map((k) => [k.x, k.label]),
			[
				[0, "12 AM"],
				[1, "12 AM"],
			],
		);
	});

	it("while the samples load: the index's numbers over a 24-hour axis labelled every four hours, and no line", () => {
		const view = day(-3);
		assert.deepEqual(figures(view), ["--", "48 bpm", "99 bpm", "46 bpm"]);
		const t = view.timeline;
		assert.deepEqual([t.state, t.hours, t.ticks.length, t.points, t.highest], ["pending", 24, 25, [], undefined]);
		assert.deepEqual(
			t.ticks.filter((k) => k.large).map((k) => k.label),
			["12 AM", "4 AM", "8 AM", "12 PM", "4 PM", "8 PM", "12 AM"],
		);
	});

	it("a day without data (Aug 18, Jan 6): -- everywhere and an empty axis", () => {
		for (const offset of [-51, -275]) {
			const view = day(offset, { samples: null });
			assert.ok(["2026-08-18", "2026-01-06"].includes(view.date));
			assert.deepEqual(figures(view), ["--", "--", "--", "--"]);
			assert.deepEqual([view.timeline.state, view.timeline.hours], ["empty", 24]);
		}
	});

	it("a day the index has not reached yet: the day's payload gives every figure", () => {
		const view = heartRateDayView({ data: data([], false), route: { range: "1d", offset: -1 }, today: TODAY, samples: OCT_7 });
		assert.deepEqual(figures(view), ["48 bpm", "49 bpm", "108 bpm", "46 bpm"]);
		// Older days may still come: the history is being fetched.
		assert.equal(view.canGoBack, true);
	});

	it("today runs to its midnight, 24 hours, whatever the last sync was", () => {
		const start = Date.parse("2026-10-07T20:00:00Z");
		const samples: HeartDay = { start, end: start + 68 * 60_000, startOffset: 4 * H, step: STEP, values: [72, 70, 66] };
		const t = day(0, { samples }).timeline;
		assert.deepEqual([t.hours, t.ticks.length, t.points.map((p) => p.x)], [24, 25, [0, 1 / 720, 2 / 720]]);
		// A day kept while it was still today is drawn over 24 hours too, its end not being a midnight.
		assert.equal(day(-1, { samples: { ...samples, endOffset: 4 * H } }).timeline.hours, 24);
	});

	it("puts the clock marker where the night ended, and none outside the day", () => {
		// Oct 7's sleep ended at 06:55, 23 hours that day.
		assert.equal(day(-1, { samples: OCT_7, wake: 24_900 }).timeline.wake, 24_900 / (23 * 3600));
		assert.equal(day(-3, { wake: 24_900 }).timeline.wake, 24_900 / 86_400);
		assert.equal(day(-3, { wake: -600 }).timeline.wake, undefined);
	});
});

describe("7d", () => {
	it("Oct 2 - 8, today partial: round(337 / 7) = 48 and round(788 / 7) = 113, seven cards newest first", () => {
		const view = period("7d", 0);
		assert.equal(view.label, "Oct 2 - 8");
		assert.equal(view.title, "Daily Readings");
		assert.deepEqual(averages(view), [
			["Avg Resting", "48 bpm"],
			["Avg High", "113 bpm"],
		]);
		assert.deepEqual(view.averages, { resting: 48, high: 113, low: 47 });
		assert.deepEqual(cards(view), ["10-08 52/76", "10-07 49/108", "10-06 49/108", "10-05 48/99", "10-04 47/109", "10-03 46/188", "10-02 46/100"]);
		assert.deepEqual([view.days[0]!.weekday, view.days[0]!.detail, view.days[0]!.low], ["Thursday", "October 8", "59"]);
		assert.deepEqual(view.points.map((p) => p.resting), [46, 46, 47, 48, 49, 49, 52]);
		assert.deepEqual(view.points.map((p) => p.high), [100, 188, 109, 99, 108, 108, 76]);
		assert.deepEqual(view.axis.labels.map((l) => l.text), ["10-02", "10-08"]);
		assert.deepEqual([view.dots, view.canGoBack, view.canGoForward], [true, true, false]);
	});

	it("counts today: without Oct 8's row the averages would be 48 and 119", () => {
		assert.deepEqual(period("7d", 0, indexRows([TODAY])).averages, { resting: 48, high: 119, low: 45 });
	});

	it("Sep 25 - Oct 1, a week back: 49 and 994 / 7 = 142", () => {
		const view = period("7d", -1);
		assert.equal(view.label, "Sep 25 - Oct 1");
		assert.deepEqual(averages(view).map(([, v]) => v), ["49 bpm", "142 bpm"]);
		assert.deepEqual(cards(view), ["10-01 49/121", "09-30 49/101", "09-29 47/102", "09-28 50/187", "09-27 49/184", "09-26 49/107", "09-25 52/192"]);
		assert.equal(view.canGoForward, true);
	});
});

describe("4w", () => {
	it("Sep 11 - Oct 8: round(1367 / 28) = 49 and round(3844 / 28) = 137, 28 cards", () => {
		const view = period("4w", 0);
		assert.equal(view.label, "Sep 11 - Oct 8");
		assert.deepEqual(averages(view).map(([, v]) => v), ["49 bpm", "137 bpm"]);
		assert.equal(view.days.length, 28);
		assert.deepEqual(cards(view).slice(0, 5), ["10-08 52/76", "10-07 49/108", "10-06 49/108", "10-05 48/99", "10-04 47/109"]);
		assert.deepEqual([view.axis.dots.length, view.axis.labels.map((l) => l.text)], [28, ["09-11", "10-08"]]);
		// Today counts here too: without it, 49 and 140.
		assert.deepEqual(period("4w", 0, indexRows([TODAY])).averages, { resting: 49, high: 140, low: 46 });
	});

	it("Aug 14 - Sep 10: Aug 18 has no row, so ÷ 27: round(1329 / 27) = 49, round(3920 / 27) = 145", () => {
		const view = period("4w", -1);
		assert.equal(view.label, "Aug 14 - Sep 10");
		assert.deepEqual(averages(view).map(([, v]) => v), ["49 bpm", "145 bpm"]);
		assert.deepEqual(cards(view).slice(0, 5), ["09-10 46/105", "09-09 45/164", "09-08 45/92", "09-07 45/181", "09-06 50/107"]);
		const aug18 = view.days.find((c) => c.date === "2026-08-18")!;
		assert.deepEqual([aug18.weekday, aug18.resting, aug18.high, aug18.low], ["Tuesday", "--", "--", "--"]);
		// No point there, and both lines break.
		assert.deepEqual(view.points[4], { x: 4 / 27, resting: null, high: null, low: null });
	});
});

/** `stats/heartRate/weekly/2026-10-08/52`: each week's first day, resting / High / low. */
const WEEKLY_2026_10_08 = `25-10-10 52/156/50 25-10-17 47/154/44 25-10-24 51/142/48 25-10-31 50/151/46 25-11-07 48/137/46 25-11-14 47/158/44
25-11-21 50/157/48 25-11-28 49/149/47 25-12-05 49/146/46 25-12-12 50/159/48 25-12-19 50/152/47 25-12-26 48/148/45
26-01-02 51/103/51 26-01-09 50/135/47 26-01-16 47/118/44 26-01-23 51/153/55 26-01-30 50/130/47 26-02-06 52/132/51
26-02-13 52/153/52 26-02-20 51/128/49 26-02-27 48/128/45 26-03-06 50/133/48 26-03-13 53/145/50 26-03-20 51/132/49
26-03-27 52/163/47 26-04-03 50/143/48 26-04-10 51/131/49 26-04-17 50/150/49 26-04-24 48/145/45 26-05-01 47/142/44
26-05-08 47/146/45 26-05-15 50/147/47 26-05-22 50/147/48 26-05-29 52/141/53 26-06-05 48/131/46 26-06-12 47/141/45
26-06-19 52/121/50 26-06-26 51/162/49 26-07-03 49/116/47 26-07-10 51/130/49 26-07-17 49/114/47 26-07-24 49/158/46
26-07-31 49/118/46 26-08-07 51/149/49 26-08-14 50/144/47 26-08-21 49/137/47 26-08-28 50/158/48 26-09-04 48/142/45
26-09-11 49/144/46 26-09-18 49/151/47 26-09-25 49/142/47 26-10-02 48/113/47`;

/** `stats/heartRate/weekly/2025-10-09/52`: the ten weeks with data, from the account's first day on. */
const WEEKLY_2025_10_09 = `25-08-01 51/152/49 25-08-08 51/127/48 25-08-15 48/172/43 25-08-22 49/169/49 25-08-29 49/155/46
25-09-05 48/162/46 25-09-12 48/155/45 25-09-19 48/121/46 25-09-26 49/149/45 25-10-03 49/170/48`;

/** The weekly payload's rows as `YYYY-MM-DD r/h/l`. */
function weekly(text: string): string[] {
	const cells = text.split(/\s+/);
	const out: string[] = [];
	for (let i = 0; i < cells.length; i += 2) out.push(`20${cells[i]} ${cells[i + 1]}`);
	return out;
}

describe("1y", () => {
	it("Oct 10, 2025 - Oct 8, 2026: round(2582 / 52) = 50 and round(7325 / 52) = 141, from the weeks", () => {
		const view = period("1y", 0);
		assert.equal(view.label, "Oct 10, 2025 - Oct 8, 2026");
		assert.equal(view.title, "Weekly Averages");
		assert.deepEqual(averages(view), [
			["Avg Resting", "50 bpm"],
			["Avg High", "141 bpm"],
		]);
		// A low figure would tell the two means apart: 2470 / 52 weeks = 48, where the days' would be 47.
		assert.equal(view.figures.low.value, "48");
		assert.equal(meanOf(ROWS.filter((r) => r.date >= "2025-10-10" && r.low !== undefined).map((r) => r.low!), "round"), 47);
		assert.equal(view.weeks.length, 52);
		assert.deepEqual(
			view.weeks.slice(0, 5).map((w) => `${w.title}: ${w.resting}/${w.high}`),
			["October 2 - 8: 48/113", "Sep 25 - Oct 1: 49/142", "September 18 - 24: 49/151", "September 11 - 17: 49/144", "September 4 - 10: 48/142"],
		);
		assert.deepEqual([view.weeks[0]!.offset, view.weeks[51]!.offset, view.weeks[51]!.title], [0, -51, "October 10 - 16, 2025"]);
	});

	it("rebuilds stats/heartRate/weekly from the daily rows, every week and every figure: round half up of each window's mean", () => {
		const rebuilt = (end: string) =>
			heartRateWeeks(ROWS, end)
				.filter((w) => w.days > 0)
				.map((w) => `${w.from} ${w.resting}/${w.high}/${w.low}`);
		assert.deepEqual(rebuilt(TODAY), weekly(WEEKLY_2026_10_08));
		assert.deepEqual(rebuilt("2025-10-09"), weekly(WEEKLY_2025_10_09));
	});

	it("rounds ties up and averages only the days with a value", () => {
		const weeks = new Map(heartRateWeeks(ROWS, TODAY).map((w) => [w.from, w]));
		// Jan 9 – 15: Jan 9 has no row, six resting values make 297 / 6 = 49.5.
		assert.deepEqual([weeks.get("2026-01-09")!.resting, weeks.get("2026-01-09")!.days], [50, 6]);
		// Aug 14 – 20: six lows (Aug 18 has no row) make 279 / 6 = 46.5; half to even would give 46.
		assert.equal(weeks.get("2026-08-14")!.low, 47);
		// Jan 16 – 22: Jan 21 has heart rate but no resting value, so six resting values, 280 / 6 = 46.667.
		assert.deepEqual([weeks.get("2026-01-16")!.resting, weeks.get("2026-01-16")!.high, weeks.get("2026-01-16")!.days], [47, 118, 7]);
	});

	it("draws a point a week at its first day over twelve calendar months, each with its marker", () => {
		const view = period("1y", 0);
		assert.equal(view.dots, true);
		assert.equal(view.points.length, 52);
		assert.deepEqual([view.points[0]!.x, view.points[51]!.x], [0, 357 / 365]);
		assert.deepEqual([view.points[51]!.resting, view.points[51]!.high, view.points[51]!.low], [48, 113, 47]);
		assert.deepEqual(
			view.axis.labels.map((l) => l.text),
			["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
		);
	});

	it("Oct 11, 2024 - Oct 9, 2025: ten weeks with data, 49 and 153; the weeks' resting 48 to 51 and High 121 to 172", () => {
		const view = period("1y", -1);
		assert.equal(view.label, "Oct 11, 2024 - Oct 9, 2025");
		assert.deepEqual(averages(view).map(([, v]) => v), ["49 bpm", "153 bpm"]);
		assert.equal(view.weeks.length, 10);
		const resting = view.weeks.map((w) => Number(w.resting));
		const high = view.weeks.map((w) => Number(w.high));
		assert.deepEqual([Math.min(...resting), Math.max(...resting), Math.min(...high), Math.max(...high)], [48, 51, 121, 172]);
		assert.deepEqual([view.weeks[0]!.title, view.weeks[9]!.title], ["October 3 - 9, 2025", "August 1 - 7, 2025"]);
		// The line runs only over the weeks with data; nothing is older once the index is complete.
		assert.equal(view.points.filter((p) => p.resting !== null).length, 10);
		assert.equal(view.canGoBack, false);
		assert.equal(heartRatePeriodView({ data: data(ROWS, false), route: { range: "1y", offset: -1 }, today: TODAY, includeToday: true }).canGoBack, true);
	});

	it("shows -- with no data at all", () => {
		const view = heartRatePeriodView({ data: data([]), route: { range: "1y", offset: 0 }, today: TODAY });
		assert.deepEqual(averages(view).map(([, v]) => v), ["--", "--"]);
		assert.deepEqual([view.figures.low.value, view.figures.low.unit], ["--", undefined]);
		assert.deepEqual(view.weeks, []);
	});
});

describe("the phone's periods: today left out", () => {
	const phone = (range: HeartRateRoute["range"], offset: number) => heartRatePeriodView({ data: data(), route: { range, offset }, today: TODAY });

	it("7d Oct 2 - 8: today's card reads --, its point is not drawn, 48 and 119 over Oct 2 – 7 (twin 334:710)", () => {
		const view = phone("7d", 0);
		assert.deepEqual(averages(view).map(([, v]) => v), ["48 bpm", "119 bpm"]);
		assert.deepEqual(cards(view)[0], "10-08 --/--");
		assert.deepEqual(view.points[6], { x: 1, resting: null, high: null, low: null });
		assert.equal(view.line, true);
	});

	it("4w Sep 11 - Oct 8: 49 and 140", () => {
		assert.deepEqual(averages(phone("4w", 0)).map(([, v]) => v), ["49 bpm", "140 bpm"]);
	});

	it("1y: the 51 Thu – Wed weeks ending yesterday inside the period, dots alone, the phone's week titles", () => {
		const view = phone("1y", 0);
		assert.equal(view.weeks.length, 51);
		assert.deepEqual(averages(view).map(([, v]) => v), ["50 bpm", "141 bpm"]);
		assert.equal(view.line, false);
		const titles = view.weeks.map((w) => w.title);
		assert.deepEqual(titles.slice(0, 2), ["Oct 1 - 7", "Sep 24 - 30"]);
		assert.ok(titles.includes("Aug 27 - Sep 2") && titles.includes("Dec 25-31, 2025") && titles.includes("Nov 27 - Dec 3, 2025"));
		assert.equal(titles.at(-1), "Oct 16-22, 2025");
		assert.equal(view.points[0]!.x, 6 / 365);
	});
});

describe("moving between pages", () => {
	it("a day card switches the page in place to 1d on its day", () => {
		const oct5 = period("7d", 0).days.find((c) => c.date === "2026-10-05")!;
		assert.equal(oct5.offset, -3);
		const route = dayCardRoute(oct5.date, TODAY);
		assert.deepEqual(route, { range: "1d", offset: -3 });
		const view = heartRateDayView({ data: data(), route, today: TODAY });
		assert.deepEqual([view.label, ...view.stats.map((s) => s.value)], ["Monday, October 5", "48", "99"]);
	});

	it("a week card switches the page to 7d on exactly that week", () => {
		const year = period("1y", 0);
		const card = year.weeks.find((w) => w.title === "Sep 25 - Oct 1")!;
		assert.equal(card.offset, -1);
		const route = weekCardRoute({ range: "1y", offset: 0 }, card.to, TODAY);
		assert.deepEqual(route, { range: "7d", offset: -1 });
		const view = heartRatePeriodView({ data: data(), route, today: TODAY, includeToday: true });
		assert.deepEqual([view.label, view.averages.resting, view.averages.high], ["Sep 25 - Oct 1", 49, 142]);
	});

	it("< steps a whole period back, and 1d reopens on the day it last showed", () => {
		assert.equal(period("4w", stepRoute({ range: "4w", offset: 0 }, -1).offset).label, "Aug 14 - Sep 10");
		const week = switchRange({ range: "1d", offset: -3 }, "7d", TODAY);
		assert.deepEqual(switchRange(week, "1d", TODAY), { range: "1d", offset: -3 });
	});

	it("builds the view the route asks for", () => {
		assert.equal(heartRateView({ data: data(), route: { range: "1d", offset: 0 }, today: TODAY }).range, "1d");
		assert.equal(heartRateView({ data: data(), route: { range: "4w", offset: 0 }, today: TODAY }).range, "4w");
		assert.equal(heartRateView({ data: data(), route: { range: "1y", offset: 0 }, today: TODAY }).range, "1y");
	});
});

describe("zones, a hook for the line's colours", () => {
	/** `heartRateZones/` as the web fetched it (web body 04). */
	const ZONES: HeartRateZones[] = [
		{ trainingMethod: "HR_MAX", restingHeartRateUsed: null, zone1Floor: 102, zone2Floor: 122, zone3Floor: 143, zone4Floor: 163, zone5Floor: 184, maxHeartRateUsed: 204, sport: "DEFAULT" },
		{ trainingMethod: "HR_MAX", restingHeartRateUsed: null, zone1Floor: 99, zone2Floor: 118, zone3Floor: 138, zone4Floor: 158, zone5Floor: 177, maxHeartRateUsed: 197, sport: "CYCLING" },
	];

	it("reads the DEFAULT sport's floors and places a bpm in its zone", () => {
		const floors = zoneFloorsOf(ZONES)!;
		assert.deepEqual(floors, [102, 122, 143, 163, 184]);
		assert.deepEqual([45, 101, 102, 108, 143, 188].map((bpm) => zoneOf(bpm, floors)), [0, 0, 1, 1, 3, 5]);
	});

	it("finds no floors without a DEFAULT sport or with floors out of order", () => {
		assert.equal(zoneFloorsOf([ZONES[1]!]), undefined);
		assert.equal(zoneFloorsOf([{ ...ZONES[0]!, zone3Floor: 120 }]), undefined);
		assert.equal(zoneFloorsOf([{ ...ZONES[0]!, zone5Floor: null }]), undefined);
		assert.equal(zoneFloorsOf(null), undefined);
	});
});
