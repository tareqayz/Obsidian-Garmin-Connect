import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	clockText,
	durationTicks,
	factorView,
	hm,
	latestNightOffset,
	overlayTicks,
	rangePosition,
	RANGE_BAR,
	sleepDayView,
	sleepPeriodView,
	timesAxis,
	weeksEnding,
	type SleepData,
	type SleepRoute,
} from "../src/dashboard/sleep-pages";
import type { DaySeries, SleepDetail } from "../src/sync/intraday";
import type { SleepRow } from "../src/sync/sleep-index";

/** The day the app was measured. */
const TODAY = "2026-10-07";

/**
 * The four weeks the app was measured over, as the sleep index holds them:
 * date, score, seconds asleep, need (min), bed and wake (s from the day's
 * midnight), avg and resting HR, Body Battery change, respiration, skin temp.
 * Sep 12 and 17 had no sleep.
 */
const NIGHTS: Array<[string, number, number, number, number, number, number, number, number, number, number, string]> = [
	["09-10", 97, 25740, 420, -4025, 21715, 49, 46, 50, 14.09, -0.2, "ALIGNED"],
	["09-11", 57, 13380, 390, 63159, 76659, 55, 48, 55, 14.75, 0.1, "NOT_ALIGNED"],
	["09-13", 85, 26580, 440, -3631, 23129, 59, 51, 51, 14.67, 0, "ALIGNED"],
	["09-14", 95, 26796, 390, -3629, 23167, 53, 48, 70, 14.31, -0.1, "ALIGNED"],
	["09-15", 58, 15300, 420, 14414, 30434, 54, 50, 53, 14.12, 0.2, "BEHIND"],
	["09-16", 45, 11280, 480, 58609, 70009, 59, 48, 33, 15.88, 0.3, "NOT_ALIGNED"],
	["09-18", 65, 15480, 390, 45854, 61634, 54, 49, 30, 13.92, 0.1, "NOT_ALIGNED"],
	["09-19", 91, 25080, 420, -1340, 23800, 52, 49, 30, 14.5, -0.6, "ALIGNED"],
	["09-20", 90, 27780, 420, -7312, 20528, 53, 49, 69, 14.67, 0, "AHEAD"],
	["09-21", 90, 27540, 420, -1100, 26680, 55, 50, 69, 14.46, 0.3, "ALIGNED"],
	["09-22", 87, 22380, 420, 2199, 25179, 50, 46, 71, 14.12, 0, "ALIGNED"],
	["09-23", 96, 25560, 440, -4002, 21678, 55, 49, 73, 14.46, 0, "ALIGNED"],
	["09-24", 94, 27000, 390, -3212, 23848, 54, 50, 68, 14.6, -0.2, "ALIGNED"],
	["09-25", 50, 12780, 390, 44287, 57487, 60, 52, 26, 14.89, 0.6, "NOT_ALIGNED"],
	["09-26", 89, 24780, 480, -2300, 22480, 53, 49, 48, 14.75, 0.1, "ALIGNED"],
	["09-27", 100, 25320, 390, 580, 25900, 52, 49, 34, 14.5, -0.2, "ALIGNED"],
	["09-28", 81, 21120, 400, 4836, 26316, 57, 50, 53, 14.37, 0.4, "BEHIND"],
	["09-29", 99, 25860, 420, -632, 25228, 50, 47, 59, 14.54, -0.2, "ALIGNED"],
	["09-30", 53, 12900, 420, -23, 13597, 56, 49, 34, 15.07, 0.6, "AHEAD"],
	["10-01", 91, 27000, 390, 1660, 28780, 52, 49, 73, 14.89, 0, "BEHIND"],
	["10-02", 75, 21960, 390, 10249, 32329, 51, 46, 68, 14.23, -0.4, "BEHIND"],
	["10-03", 73, 35040, 420, -9540, 33360, 52, 46, 61, 14.5, -0.1, "ALIGNED"],
	["10-04", 98, 29760, 420, -1486, 28574, 50, 47, 66, 13.92, -0.3, "ALIGNED"],
	["10-05", 88, 23580, 390, 3639, 27399, 53, 48, 62, 14.74, -0.3, "BEHIND"],
	["10-06", 84, 27600, 390, -6182, 22858, 56, 49, 48, 14.88, 0.1, "ALIGNED"],
	["10-07", 94, 35940, 390, -11141, 24859, 51, 49, 55, 14.52, 0, "AHEAD"],
];

const rows: SleepRow[] = NIGHTS.map(([d, score, seconds, need, bed, wake, hr, rhr, bb, resp, skinC, align]) => ({
	date: `2026-${d}`,
	score,
	seconds,
	need,
	bed,
	wake,
	hr,
	rhr,
	bb,
	resp,
	skinC,
	align,
}));

const data = (over: Partial<SleepData> = {}): SleepData => ({ rows, complete: true, units: "metric", ...over });
const route = (over: Partial<SleepRoute>): SleepRoute => ({ range: "1d", offset: 0, tab: "score", ...over });

describe("formatting", () => {
	it("truncates durations to the minute", () => {
		assert.deepEqual([29760, 35940, 300, 25200, 59].map(hm), ["8h 16m", "9h 59m", "5m", "7h", "0m"]);
	});

	it("truncates average clock times towards midnight, as the app does", () => {
		assert.deepEqual([-1829, 28308, 2953, 27222, 7303, 31471].map(clockText), ["11:30 PM", "7:51 AM", "12:49 AM", "7:33 AM", "2:01 AM", "8:44 AM"]);
	});
});

describe("axes", () => {
	it("centre an overlay on its data in four equal steps", () => {
		assert.deepEqual(overlayTicks(45, 63), [42, 48, 54, 60, 66]);
		assert.deepEqual(overlayTicks(47, 117), [44, 63, 82, 101, 120]);
	});

	it("give durations twelve hours, stretched in threes", () => {
		assert.deepEqual(durationTicks(9.98), [0, 3, 6, 9, 12]);
		assert.deepEqual(durationTicks(13.2), [0, 3.75, 7.5, 11.25, 15]);
	});

	it("start the bedtime axis on the odd hour at or before the earliest bedtime", () => {
		assert.deepEqual(timesAxis([-11141, 1660]), { top: -5, labels: ["7 PM", "11 PM", "3 AM", "7 AM", ""] });
		assert.deepEqual(timesAxis([-8640, 2953]), { top: -3, labels: ["9 PM", "1 AM", "5 AM", "9 AM", ""] });
	});

	it("put a value on the range bar inside its optimal range proportionally", () => {
		assert.equal(rangePosition(4761.6, 4761.6, 9820.8), RANGE_BAR.low);
		assert.equal(rangePosition(9820.8, 4761.6, 9820.8), RANGE_BAR.high);
		assert.ok(Math.abs(rangePosition(6780, 4761.6, 9820.8) - 0.4011) < 0.001);
		assert.equal(rangePosition(99999, 4761.6, 9820.8), RANGE_BAR.max);
	});
});

describe("a week", () => {
	const view = sleepPeriodView({ data: data(), route: route({ range: "7d" }), today: TODAY });

	it("averages its nights as the app did for Oct 1 - 7", () => {
		assert.equal(view.label, "Oct 1 - 7");
		assert.deepEqual(
			view.averages.map((s) => [s.label, s.value, s.unit]),
			[
				["Avg Score", "86", undefined],
				["Avg Overnight Heart Rate", "52", "bpm"],
				["Avg Resting Heart Rate", "48", "bpm"],
				["Avg Body Battery Change", "+62", undefined],
				["Avg SpO₂", "--", undefined],
				["Avg Respiration", "15", "brpm"],
				["Avg Skin Temp Change", "-0.1°", undefined],
			],
		);
		assert.deepEqual(
			view.duration.stats.map((s) => s.value),
			["7h 58m", "6h 39m"],
		);
		assert.deepEqual(
			view.times.stats.map((s) => `${s.value} ${s.unit}`),
			["11:30 PM", "7:51 AM"],
		);
	});

	it("lists its nights newest first and opens each one's day", () => {
		assert.deepEqual(view.cards[0], { key: "2026-10-07", title: "Wednesday", detail: "October 7", score: "94", duration: "9h 59m", day: "2026-10-07" });
		assert.deepEqual(view.cards.at(-1), { key: "2026-10-01", title: "Thursday", detail: "October 1", score: "91", duration: "7h 30m", day: "2026-10-01" });
	});

	it("draws a dot a night from edge to edge, and a respiration overlay rounded down", () => {
		assert.deepEqual(
			view.score.points.map((p) => p.value),
			[91, 75, 73, 98, 88, 84, 94],
		);
		assert.equal(view.score.points[6]!.x, 1);
		const resp = view.score.overlays.find((o) => o.id === "respiration")!;
		assert.deepEqual(
			resp.points.map((p) => p.value),
			[14, 14, 14, 13, 14, 14, 14],
		);
		assert.equal(
			view.score.overlays.find((o) => o.id === "pulseOx"),
			undefined,
			"no SpO₂ on this watch, so no chip",
		);
	});
});

describe("four weeks", () => {
	it("average the nights there were, as the app did for Sep 10 - Oct 7", () => {
		const view = sleepPeriodView({ data: data(), route: route({ range: "4w" }), today: TODAY });
		assert.equal(view.label, "Sep 10 - Oct 7");
		assert.deepEqual(
			view.averages.map((s) => s.value),
			["82", "54", "49", "+54", "--", "15", "0.0°"],
		);
		assert.deepEqual(
			view.duration.stats.map((s) => s.value),
			["6h 33m", "6h 53m"],
		);
		assert.deepEqual(
			view.times.stats.map((s) => `${s.value} ${s.unit}`),
			["2:01 AM", "8:44 AM"],
		);
		assert.equal(view.cards.length, 26);
		assert.equal(view.score.points.filter((p) => p.value === null).length, 2);
	});
});

describe("a year", () => {
	it("is fifty-two weeks of seven days ending today, each the mean of its nights", () => {
		const weeks = weeksEnding(rows, TODAY);
		assert.equal(weeks.length, 52);
		assert.deepEqual(
			weeks.slice(-4).map((w) => [w.from, w.to, w.score, hm(w.seconds!)]),
			[
				["2026-09-10", "2026-09-16", 73, "5h 30m"],
				["2026-09-17", "2026-09-23", 87, "6h 39m"],
				["2026-09-24", "2026-09-30", 81, "5h 56m"],
				["2026-10-01", "2026-10-07", 86, "7h 58m"],
			],
		);
	});

	it("averages its weeks, each week's best and each week's worst", () => {
		const view = sleepPeriodView({ data: data(), route: route({ range: "1y" }), today: TODAY });
		assert.equal(view.label, "Oct 9, 2025 - Oct 7, 2026");
		// (73 + 87 + 81 + 86) / 4, (97 + 96 + 100 + 98) / 4, (45 + 65 + 50 + 73) / 4.
		assert.deepEqual(
			view.scoreStats.map((s) => s.value),
			["82", "98", "58"],
		);
		assert.deepEqual(
			view.cards.map((c) => [c.title, c.score, c.duration]),
			[
				["Oct 1 - 7", "86", "7h 58m"],
				["Sep 24 - 30", "81", "5h 56m"],
				["Sep 17 - 23", "87", "6h 39m"],
				["Sep 10 - 16", "73", "5h 30m"],
			],
		);
		assert.equal(view.times.alignment, false);
		assert.equal(view.score.dots, false);
	});
});

/** 2026-10-04 as the series file keeps it: asleep 23:35:14 to 07:56:14, UTC+4. */
const OFFSET = 4 * 3_600_000;
const START = Date.parse("2026-10-03T23:35:14Z") - OFFSET;
const END = Date.parse("2026-10-04T07:56:14Z") - OFFSET;
const NIGHT: SleepDetail = {
	start: START,
	end: END,
	offset: OFFSET,
	score: 98,
	quality: "EXCELLENT",
	seconds: 29760,
	deep: 6780,
	light: 16260,
	rem: 6720,
	awake: 300,
	avgStress: 8,
	avgHr: 50,
	restingHr: 47,
	bodyBatteryChange: 66,
	respAvg: 13,
	respLow: 8,
	hrv: 84,
	hrvStatus: "BALANCED",
	skinC: -0.3,
	awakeCount: 0,
	restlessCount: 53,
	feedback: "POSITIVE_HIGHLY_RECOVERING",
	personal: "HARD_EXERCISE_POS_EXCELLENT_OR_GOOD_SLEEP_HARD_CLOSE_BED",
	factors: {
		duration: { qualifier: "EXCELLENT", optimalStart: 25200, optimalEnd: 25200 },
		stress: { qualifier: "EXCELLENT", optimalStart: 0, optimalEnd: 15 },
		deep: { qualifier: "EXCELLENT", value: 23, optimalStart: 16, optimalEnd: 33, idealStart: 4761.6, idealEnd: 9820.8 },
		light: { qualifier: "GOOD", value: 55, optimalStart: 30, optimalEnd: 64, idealStart: 8928, idealEnd: 19046.4 },
		rem: { qualifier: "EXCELLENT", value: 23, optimalStart: 21, optimalEnd: 31, idealStart: 6249.6, idealEnd: 9225.6 },
		awakeCount: { qualifier: "EXCELLENT" },
		restlessness: { qualifier: "FAIR" },
	},
	need: { baseline: 420, actual: 420, feedback: "NO_CHANGE_NO_ADJUSTMENTS", history: "NO_CHANGE" },
	alignment: { status: "ALIGNED", start: -30, end: 390, mid: 180, last: 226 },
	restless: [[START + 3_600_000, 1]],
	heartRate: [
		[START, 51],
		[START + 3_600_000, 45],
		[END, 63],
	],
};
const SERIES = {
	date: "2026-10-04",
	sleep: NIGHT,
	sleepLevels: [
		{ start: START, end: START + 1_800_000, level: 1 },
		{ start: START + 1_800_000, end: START + 3_600_000, level: 0 },
		{ start: START + 3_600_000, end: END, level: 2 },
	],
} as unknown as DaySeries;

describe("a night", () => {
	const view = sleepDayView({ data: data(), route: route({ offset: -3 }), today: TODAY, series: SERIES });

	it("shows the score, its verdict and the headline the app showed for Oct 4", () => {
		assert.equal(view.date, "2026-10-04");
		assert.equal(view.label, "Sunday, October 4");
		assert.equal(view.state, "detail");
		assert.equal(view.score, "98");
		assert.deepEqual(
			view.stats.map((s) => s.value),
			["Excellent", "8h 16m"],
		);
		assert.deepEqual(view.insight, {
			title: "Highly restorative",
			lines: ["You had extremely restorative sleep.", "Your hard training yesterday promoted good sleep, despite the session being later in the day."],
		});
	});

	it("rates each factor, Awake/Restlessness by the worse of its parts", () => {
		assert.deepEqual(
			view.factors.map((f) => [f.title, f.detail, f.rating]),
			[
				["Duration", "8h 16m", "Excellent"],
				["Stress", "8 avg", "Excellent"],
				["Deep", "1h 53m", "Excellent"],
				["Light", "4h 31m", "Good"],
				["REM", "1h 52m", "Excellent"],
				["Awake/Restlessness", "5m • 53 Restless Moments", "Fair"],
			],
		);
	});

	it("lists the night's metrics, dashes where the watch measured nothing", () => {
		assert.deepEqual(
			view.metrics.map((m) => `${m.value}${m.unit ? ` ${m.unit}` : ""}`),
			["--", "53", "50 bpm", "47 bpm", "+66", "--", "--", "13 brpm", "8 brpm", "84 ms", "Balanced", "-0.3°"],
		);
	});

	it("draws the night from bedtime to wake time, an hour mark at each whole hour", () => {
		const t = view.timeline!;
		assert.equal(t.startLabel, "11:35 PM");
		assert.equal(t.endLabel, "7:56 AM");
		assert.equal(t.hours.length, 8);
		assert.deepEqual(
			t.bars.map((b) => b.stage),
			["light", "deep", "rem"],
		);
		assert.deepEqual(
			t.overlays.map((o) => o.id),
			["awake", "rhr"],
		);
		assert.deepEqual(view.stages?.total, "8h 16m");
	});

	it("coaches the night's need and alignment", () => {
		const c = view.coach!;
		assert.equal(c.need, "7h");
		assert.equal(c.title, "You needed a normal amount of sleep.");
		assert.equal(c.text, "You should have felt good on your normal 7 hours of sleep. Nice work staying balanced!");
		assert.deepEqual(c.adjustments, []);
		const a = c.alignment!;
		assert.equal(a.title, "Aligned");
		assert.equal(a.axisStart, -180);
		assert.deepEqual(
			a.stats.map((s) => `${s.value} ${s.unit}`),
			["11:35 PM", "11:30 PM", "7:56 AM", "6:30 AM"],
		);
		assert.match(a.text, /internal rhythm of 11:30 PM ~ 6:30 AM\./);
	});

	it("falls back to the index's summary for a night synced before the Sleep page", () => {
		const old = sleepDayView({ data: data(), route: route({ offset: -2 }), today: TODAY, series: null });
		assert.equal(old.state, "summary");
		assert.equal(old.score, "88");
		assert.equal(old.timeline, undefined);
		assert.equal(old.coach, undefined);
		assert.deepEqual(old.metrics[2], { value: "53", unit: "bpm", label: "Avg Overnight Heart Rate" });
	});

	it("is empty on a night without sleep", () => {
		const none = sleepDayView({ data: data(), route: route({ offset: -25 }), today: TODAY, series: null });
		assert.equal(none.date, "2026-09-12");
		assert.equal(none.state, "empty");
	});
});

describe("factor pages", () => {
	it("judge a stage against its optimal share", () => {
		const deep = factorView("deep", NIGHT, SERIES.sleepLevels!, "metric");
		assert.equal(deep.total, "1h 53m (23%)");
		assert.equal(deep.range?.lowLabel, "1h 19m");
		assert.equal(deep.range?.highLabel, "2h 43m");
		assert.equal(deep.range?.inRange, true);
		assert.deepEqual(deep.guidance, ["Deep sleep should be 16-33% of total sleep. Your deep sleep was 23%."]);
		const rem = factorView("rem", NIGHT, SERIES.sleepLevels!, "metric");
		assert.deepEqual(rem.guidance, ["REM sleep should be 21-31% of total sleep. Your REM sleep was 23%."]);
		const light = factorView("light", NIGHT, SERIES.sleepLevels!, "metric");
		assert.deepEqual(light.guidance, ["Light sleep should be 30-64% of total sleep. Your light sleep was 55%."]);
	});

	it("say how long and how still the night was", () => {
		const duration = factorView("duration", NIGHT, SERIES.sleepLevels!, "metric");
		assert.deepEqual(duration.guidance, ["Sleep duration of 7 hours is ideal for adults your age."]);
		const awake = factorView("awake", NIGHT, SERIES.sleepLevels!, "metric");
		assert.deepEqual(
			awake.stats.map((s) => s.value),
			["Fair", "5m", "0", "53"],
		);
		const stress = factorView("stress", NIGHT, SERIES.sleepLevels!, "metric");
		assert.deepEqual(stress.guidance, ["An ideal average stress level while sleeping is 15 or lower. Higher stress levels can negatively affect your sleep score."]);
	});
});

describe("opening the page", () => {
	it("opens on the newest night", () => {
		assert.equal(latestNightOffset(data(), TODAY), 0);
		assert.equal(latestNightOffset(data({ rows: rows.slice(0, -2) }), TODAY), -2);
		assert.equal(latestNightOffset(data({ rows: [] }), TODAY), 0);
	});
});
