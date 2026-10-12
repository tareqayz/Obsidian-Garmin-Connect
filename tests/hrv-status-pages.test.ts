import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { NO_DATA, ONBOARDING_COPY, hrvCopy, statusLook } from "../src/dashboard/hrv-status-copy";
import {
	CHIP_LABEL,
	HRV_DIAL_BOUNDS,
	OVERNIGHT,
	averagesTicks,
	gaugeEnds,
	hrvAverages,
	hrvDial,
	hrvStatusView,
	linearMarker,
	markerAngle,
	nightTimeline,
	tickLabel,
	timelineTicks,
	withOvernight,
	type HrvDayView,
	type HrvPeriodView,
	type HrvStatusContext,
} from "../src/dashboard/hrv-status-pages";
import { performanceStatRoute } from "../src/dashboard/routes";
import { dialFraction } from "../src/dashboard/stat-dial";
import { HRV_DAY, HRV_STATUS_INDEX, type HrvNight, type HrvStatusRow } from "../src/sync/hrv-status-index";
import type { HrvData } from "../src/sync/metrics";

/**
 * Golden numbers from ref/performance-stats/hrv-status/README.md: the phone
 * shots of Sunday 2026-10-11 21:14–21:16, the web of 22:50 and of Thursday
 * Oct 8 01:38, and the payloads of 2026-10-11 22:29
 * (api-samples/daily-2025-10-11_2026-10-11.json, 2026-10-11.json) — the
 * spec's 55 checks (golden-hrv-status.py) that reach the page. The 7d / 4w
 * spans roll daily, so they only reproduce with today pinned.
 */
const TODAY = "2026-10-11";

/**
 * Aug 14 – Oct 11, a night a line as `hrv/daily` sent it:
 * `MM-DD weekly/night/high lowUpper/balLow/balHigh marker status feedback`,
 * "-" for null. Sep 12 has no row.
 */
const NIGHTS = `
08-14 71/80/103 72/76/92 0.0911 LOW HRV_LOW_4
08-15 71/81/118 72/76/92 0.0849 LOW HRV_LOW_5
08-16 72/81/104 71/75/91 0.1395 UNBALANCED HRV_UNBALANCED_11
08-17 75/83/117 71/75/92 0.25 BALANCED HRV_BALANCED_1
08-18 80/-/- 70/74/93 0.4079 BALANCED HRV_BALANCED_8
08-19 81/-/- 70/74/93 0.4342 BALANCED HRV_BALANCED_5
08-20 82/85/120 70/74/92 0.4722 BALANCED HRV_BALANCED_6
08-21 83/86/125 70/74/92 0.5 BALANCED HRV_BALANCED_7
08-22 84/86/129 70/74/92 0.5278 BALANCED HRV_BALANCED_8
08-23 85/83/103 70/74/92 0.5555 BALANCED HRV_BALANCED_5
08-24 82/69/95 71/74/92 0.4722 BALANCED HRV_BALANCED_2
08-25 82/82/106 70/74/92 0.4722 BALANCED HRV_BALANCED_2
08-26 81/79/110 71/75/92 0.4265 BALANCED HRV_BALANCED_2
08-27 81/81/106 71/75/92 0.4265 BALANCED HRV_BALANCED_2
08-28 80/84/112 71/75/92 0.397 BALANCED HRV_BALANCED_6
08-29 78/70/96 71/75/92 0.3382 BALANCED HRV_BALANCED_2
08-30 77/76/103 71/75/92 0.3088 BALANCED HRV_BALANCED_8
08-31 78/75/105 71/75/92 0.3382 BALANCED HRV_BALANCED_2
09-01 76/72/92 71/75/92 0.2794 BALANCED HRV_BALANCED_2
09-02 75/68/97 71/75/92 0.25 BALANCED HRV_BALANCED_2
09-03 74/73/105 71/75/92 0.2213 UNBALANCED HRV_UNBALANCED_12
09-04 72/71/100 71/75/92 0.1551 UNBALANCED HRV_UNBALANCED_12
09-05 73/81/122 71/75/92 0.2112 UNBALANCED HRV_UNBALANCED_10
09-06 75/86/102 71/75/92 0.25 BALANCED HRV_BALANCED_1
09-07 76/87/106 71/75/91 0.2812 BALANCED HRV_BALANCED_8
09-08 78/81/104 71/74/91 0.3676 BALANCED HRV_BALANCED_2
09-09 79/79/109 70/74/91 0.397 BALANCED HRV_BALANCED_6
09-10 80/77/108 70/74/91 0.4265 BALANCED HRV_BALANCED_7
09-11 80/72/92 70/74/90 0.4375 BALANCED HRV_BALANCED_3
09-13 77/67/106 70/74/91 0.3382 BALANCED HRV_BALANCED_2
09-14 76/81/110 70/74/91 0.3088 BALANCED HRV_BALANCED_7
09-15 76/85/111 71/74/91 0.3088 BALANCED HRV_BALANCED_8
09-16 74/62/75 71/75/91 0.2291 UNBALANCED HRV_UNBALANCED_10
09-17 73/-/- 71/74/90 0.2022 UNBALANCED HRV_UNBALANCED_10
09-18 72/68/86 71/74/90 0.1679 UNBALANCED HRV_UNBALANCED_12
09-19 72/71/89 71/74/90 0.1673 UNBALANCED HRV_UNBALANCED_12
09-20 73/73/101 70/74/90 0.2199 UNBALANCED HRV_UNBALANCED_12
09-21 71/70/89 70/74/90 0.1592 UNBALANCED HRV_UNBALANCED_12
09-22 70/78/109 70/74/90 0.1181 LOW HRV_LOW_5
09-23 73/82/114 70/74/90 0.2467 UNBALANCED HRV_UNBALANCED_11
09-24 75/84/110 70/74/90 0.2812 BALANCED HRV_BALANCED_4
09-25 73/58/76 70/73/90 0.25 BALANCED HRV_BALANCED_3
09-26 74/78/95 69/73/90 0.2794 BALANCED HRV_BALANCED_2
09-27 76/85/118 69/73/90 0.3382 BALANCED HRV_BALANCED_8
09-28 76/74/107 69/73/90 0.3382 BALANCED HRV_BALANCED_2
09-29 77/81/110 69/73/89 0.375 BALANCED HRV_BALANCED_2
09-30 75/72/96 69/73/89 0.3125 BALANCED HRV_BALANCED_2
10-01 76/85/124 69/73/90 0.3382 BALANCED HRV_BALANCED_2
10-02 79/80/102 69/72/90 0.4444 BALANCED HRV_BALANCED_5
10-03 80/85/111 69/72/90 0.4722 BALANCED HRV_BALANCED_6
10-04 80/84/117 69/73/90 0.4559 BALANCED HRV_BALANCED_7
10-05 82/84/108 69/73/90 0.5147 BALANCED HRV_BALANCED_8
10-06 81/80/100 69/73/90 0.4853 BALANCED HRV_BALANCED_5
10-07 84/88/107 69/73/89 0.5938 BALANCED HRV_BALANCED_6
10-08 84/89/117 69/73/90 0.5735 BALANCED HRV_BALANCED_7
10-09 84/79/98 69/73/90 0.5735 BALANCED HRV_BALANCED_8
10-10 84/86/117 69/73/90 0.5735 BALANCED HRV_BALANCED_5
10-11 84/79/105 69/73/90 0.5735 BALANCED HRV_BALANCED_6
`;

function rowsOf(text: string): HrvStatusRow[] {
	const n = (v: string | undefined) => (v === undefined || v === "-" ? null : Number(v));
	return text
		.trim()
		.split("\n")
		.map((line) => {
			const [md, figures, base, marker, status, feedback] = line.trim().split(/\s+/);
			const [weekly, night, high] = figures!.split("/");
			const [lowUpper, balLow, balHigh] = base === "-" ? [] : base!.split("/");
			return HRV_STATUS_INDEX.normalize({
				date: `2026-${md}`,
				weekly: n(weekly),
				night: n(night),
				high: n(high),
				lowUpper: n(lowUpper),
				balLow: n(balLow),
				balHigh: n(balHigh),
				marker: n(marker),
				status,
				feedback,
			})!;
		});
}

const ROWS = rowsOf(NIGHTS);
const CTX: HrvStatusContext = { today: TODAY, complete: true };
const HOUR = 3_600_000;
const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}.0`;

/** A night's `hrv/{date}`: its summary, and readings every five minutes from the first, on the watch's clock `offset` hours on. */
function nightOf(date: string, summary: NonNullable<HrvData["hrvSummary"]>, values: string, firstGmt: string, offset: number, sleepGmt: [string, string]): HrvNight {
	const t0 = Date.parse(`${firstGmt}Z`);
	const payload: HrvData = {
		hrvSummary: summary,
		hrvReadings: values.split(/\s+/).filter(Boolean).map((v, i) => ({ hrvValue: Number(v), readingTimeGMT: iso(t0 + i * 300_000), readingTimeLocal: iso(t0 + i * 300_000 + offset * HOUR) })),
		sleepStartTimestampGMT: `${sleepGmt[0]}.0`,
		sleepEndTimestampGMT: `${sleepGmt[1]}.0`,
		sleepStartTimestampLocal: iso(Date.parse(`${sleepGmt[0]}Z`) + offset * HOUR),
		sleepEndTimestampLocal: iso(Date.parse(`${sleepGmt[1]}Z`) + offset * HOUR),
	};
	return HRV_DAY.map(payload, date)!;
}

/** The phone's night, Oct 10→11: 78 readings from 00:01:41, asleep 23:58:40 → 06:31:40 at +4 h. */
const OCT_11_NIGHT = nightOf(
	"2026-10-11",
	{ weeklyAvg: 84, lastNightAvg: 79, lastNight5MinHigh: 105, baseline: { lowUpper: 69, balancedLow: 73, balancedUpper: 90, markerValue: 0.57351685 }, status: "BALANCED", feedbackPhrase: "HRV_BALANCED_6" },
	"76 95 75 70 76 80 72 74 85 102 76 71 71 70 69 73 65 65 65 79 70 70 64 71 62 66 66 63 80 80 62 61 53 80 75 92 " +
		"83 76 85 87 86 86 93 89 87 105 98 94 101 97 104 87 72 84 81 82 77 94 90 83 82 76 74 75 73 87 82 92 88 88 91 78 79 78 84 88 74 74",
	"2026-10-10T20:01:41",
	4,
	["2026-10-10T19:58:40", "2026-10-11T02:31:40"],
);

/** The web's Oct 7 (the Oct 8 capture): 120 readings from 20:56:39, asleep 20:54:19 → 06:54:19 at +3 h. */
const OCT_7_NIGHT = nightOf(
	"2026-10-07",
	{ weeklyAvg: 84, lastNightAvg: 88, lastNight5MinHigh: 107, baseline: { lowUpper: 69, balancedLow: 73, balancedUpper: 89, markerValue: 0.59375 }, status: "BALANCED", feedbackPhrase: "HRV_BALANCED_6" },
	"77 81 66 68 74 57 58 63 82 88 101 103 101 95 84 88 92 84 72 66 84 84 95 85 85 86 92 95 104 106 99 100 104 91 80 80 107 81 66 65 " +
		"76 92 83 89 83 85 83 89 95 94 90 94 81 75 78 70 93 98 95 85 82 83 93 87 84 81 84 71 77 83 69 81 79 74 84 84 81 87 71 85 " +
		"102 107 100 89 99 85 90 95 90 81 76 93 83 78 81 82 84 95 87 82 92 92 102 89 100 105 98 101 98 101 94 87 97 98 101 103 100 99 106 100",
	"2026-10-06T17:56:39",
	3,
	["2026-10-06T17:54:19", "2026-10-07T03:54:19"],
);

const day = (offset: number, ctx: Partial<HrvStatusContext> = {}, rows: readonly HrvStatusRow[] = ROWS) =>
	hrvStatusView({ range: "1d", offset }, rows, { ...CTX, ...ctx }) as HrvDayView;
const period = (range: "7d" | "4w", offset = 0, opts: { sub?: string; today?: string } = {}) =>
	hrvStatusView({ range, offset, sub: opts.sub }, ROWS, { ...CTX, today: opts.today ?? TODAY }) as HrvPeriodView;

/** y in the shots' pixels for a chart whose gridlines run `top`..`bottom` px. */
const ypx = (v: number, chart: { low: number; high: number }, top: number, bottom: number) => top + ((chart.high - v) / (chart.high - chart.low)) * (bottom - top);
const legend = (v: HrvPeriodView) => v.chart!.legend.map((l) => l.label);
const BALANCED_6 = "Balanced HRV is a sign that your body, and thus your nervous system, have had adequate time to recover.";

describe("the fixture", () => {
	it("is Aug 14 – Oct 11 as hrv/daily sent it: 58 nights, Sep 12 without a row", () => {
		assert.equal(ROWS.length, 58);
		assert.ok(!ROWS.some((r) => r.date === "2026-09-12"));
		assert.deepEqual(ROWS[ROWS.length - 1], { date: "2026-10-11", weekly: 84, night: 79, high: 105, lowUpper: 69, balLow: 73, balHigh: 90, marker: 0.5735, status: "BALANCED", feedback: "HRV_BALANCED_6" });
	});

	it("bears out Garmin's marker rule: linear on the gauge's ends at or above balancedLow", () => {
		const above = ROWS.filter((r) => r.weekly! >= r.balLow!);
		assert.equal(above.length, 44);
		// The rows keep 4 dp of Garmin's value.
		for (const row of above) assert.ok(Math.abs(linearMarker(row)! - row.marker!) <= 1e-4, `${row.date}: ${linearMarker(row)} vs ${row.marker}`);
		// Below it Garmin maps another way: only its own value places the marker.
		assert.equal(linearMarker(ROWS.find((r) => r.date === "2026-09-22")!), undefined);
	});
});

describe("1d — the phone's night (Today, Oct 11)", () => {
	const v = day(0, { night: OCT_11_NIGHT });

	it("shows 84 ms 7d Avg, Balanced, the HRV_BALANCED_6 copy, 79 ms Overnight Avg and 105 ms Highest 5-min Avg", () => {
		assert.deepEqual([v.label, v.date, v.canGoForward, v.canGoBack], ["Today", "2026-10-11", false, true]);
		assert.deepEqual([v.dial!.gauge.value, v.dial!.unit, v.dial!.gauge.label], ["84", "ms", "7d Avg"]);
		assert.deepEqual([v.status?.word, v.status?.tone], ["Balanced", "green"]);
		assert.equal(v.copy, BALANCED_6);
		assert.deepEqual(v.figures, [
			{ value: "79", unit: "ms", label: "Overnight Avg" },
			{ value: "105", unit: "ms", label: "Highest 5-min Avg" },
		]);
		assert.equal(v.title, "Nightly Timeline");
		assert.equal(v.empty, undefined);
		// Garmin's averages, never recomputed: the readings' mean, 79.59, would read 80.
		const readings = OCT_11_NIGHT.values as number[];
		assert.equal(Math.round(readings.reduce((a, b) => a + b, 0) / readings.length), 80);
	});

	it("puts the marker at Garmin's markerValue on the 300° arc: 202.05°, within the 1.5° the shot sits past it", () => {
		const dial = v.dial!;
		assert.equal(dial.gauge.at, 0.5735);
		assert.equal(dial.gauge.tone, "green");
		assert.ok(Math.abs(dial.angle! - 202.05) < 1e-9, String(dial.angle));
		assert.ok(Math.abs(dial.angle! - 203.55) < 1.6);
		// Garmin's value is (84 − 64.5) / 34 on its scale.
		assert.ok(Math.abs((84 - 64.5) / 34 - dial.gauge.at!) < 1e-4);
	});

	it("draws the bands at the measured gaps, 61.57°, 104.79° and 268.00° from straight down", () => {
		const segments = v.dial!.gauge.segments;
		assert.deepEqual(segments.map((s) => s.tone), ["red", "orange", "green", "orange"]);
		const gaps = segments.slice(1).map((s) => markerAngle(s.from));
		[61.57, 104.79, 268.0].forEach((want, i) => assert.ok(Math.abs(gaps[i]! - want) < 1e-6, `gap ${i}: ${gaps[i]}`));
		assert.deepEqual(segments.slice(1).map((s) => Math.round(s.from * 10000) / 10000), [0.1052, 0.2493, 0.7933]);
		assert.deepEqual([segments[0]!.from, segments[3]!.to], [0, 1]);
		assert.equal(dialFraction(HRV_DIAL_BOUNDS[0]!), 0);
	});

	it("knows the gauge's true ends: the web's 'Data ranges from 64 to 98' (Oct 11, Oct 10) and '65 to 97' (Oct 7)", () => {
		const range = (date: string) => {
			const ends = gaugeEnds(ROWS.find((r) => r.date === date)!)!;
			return [Math.floor(ends.low), Math.floor(ends.high)];
		};
		assert.deepEqual([v.dial!.low, v.dial!.high], [64.5, 98.5]);
		assert.deepEqual(range("2026-10-11"), [64, 98]);
		assert.deepEqual(range("2026-10-10"), [64, 98]);
		assert.deepEqual(range("2026-10-07"), [65, 97]);
	});

	it("draws the Nightly Timeline from sleep start to wake: 78 readings, gridlines 120…40, '11:58 PM' and '6:31 AM'", () => {
		const t = v.timeline!;
		assert.equal(t.state, "drawn");
		assert.equal(t.points.length, 78);
		assert.deepEqual([Math.min(...t.points.map((p) => p.value)), Math.max(...t.points.map((p) => p.value))], [53, 105]);
		assert.deepEqual(t.ticks, [120, 100, 80, 60, 40]);
		assert.deepEqual([t.start, t.end], ["11:58 PM", "6:31 AM"]);
		// The line starts at the first reading, 3:01 in, and ends at the last, 4:59 before wake.
		const window = 6 * HOUR + 33 * 60_000;
		assert.ok(Math.abs(t.points[0]!.x - 181_000 / window) < 1e-12);
		assert.ok(Math.abs(t.points[77]!.x - (window - 299_000) / window) < 1e-12);
		assert.ok(t.points.every((p, i) => i === 0 || p.x > t.points[i - 1]!.x));
	});

	it("dots every whole hour on the watch's clock: 01:00–06:00 to 1.5 px on the shot's axis, 00:00 under the sleep disc", () => {
		// The shot's plot runs x 99 → 1131.3 px (33.0 → 377.1 pt).
		const px = v.timeline!.hours.map((x) => 99 + x * (1131.3 - 99));
		assert.equal(px.length, 7);
		assert.ok(px[0]! - 99 < 9.5 * 3, `00:00 at ${px[0]} px`);
		[260, 418, 575, 733, 890, 1048].forEach((want, i) => assert.ok(Math.abs(px[i + 1]! - want) <= 1.5, `${i + 1}:00 at ${px[i + 1]!.toFixed(1)} px, not ${want}`));
	});
});

describe("1d — other nights", () => {
	it("Oct 10 (the web's 1d − 1): 84 · 86 ms · 117 ms and the HRV_BALANCED_5 copy", () => {
		const v = day(-1, { night: null });
		assert.deepEqual([v.label, v.canGoForward], ["Saturday, October 10", true]);
		assert.equal(v.dial!.gauge.value, "84");
		assert.deepEqual(v.figures.map((f) => f.value), ["86", "117"]);
		assert.equal(v.copy, "Your HRV looks good! Balanced HRV status indicates that your training load and recovery are in symmetry.");
		// Garmin had no readings that night: an empty timeline, the figures still there.
		assert.equal(v.timeline!.state, "empty");
	});

	it("Oct 7 (the web's Oct 8 capture): 84 · 88 ms · 107 ms, 120 readings, '8:54 PM' and '6:54 AM', the same copy as Oct 11", () => {
		const v = day(-1, { today: "2026-10-08", night: OCT_7_NIGHT });
		assert.equal(v.label, "Wednesday, October 7");
		assert.equal(v.dial!.gauge.value, "84");
		assert.deepEqual(v.figures.map((f) => f.value), ["88", "107"]);
		assert.equal(v.copy, BALANCED_6);
		assert.equal(v.timeline!.points.length, 120);
		assert.deepEqual([v.timeline!.start, v.timeline!.end], ["8:54 PM", "6:54 AM"]);
		// Garmin's own marker, 0.59375, wherever its baseline puts it.
		assert.equal(v.dial!.gauge.at, 0.5938);
	});

	it("a night without a row (Sep 12): Garmin's empty state, once the night says so too", () => {
		const v = day(-29, { night: null });
		assert.equal(v.date, "2026-09-12");
		assert.deepEqual(v.empty, NO_DATA);
		assert.deepEqual(v.empty, { title: "No HRV status data", text: "You have no data for this time period." });
		assert.deepEqual([v.dial, v.figures, v.timeline], [null, [], null]);
		// While the night still loads, nothing is claimed yet.
		const pending = day(-29);
		assert.equal(pending.empty, undefined);
		assert.equal(pending.timeline!.state, "pending");
	});

	it("a status without an overnight value (Sep 17): the dial and its status, '--' figures, an empty timeline", () => {
		const night = HRV_DAY.map(
			{
				hrvSummary: { weeklyAvg: 73, lastNightAvg: null, lastNight5MinHigh: null, baseline: { lowUpper: 71, balancedLow: 74, balancedUpper: 90, markerValue: 0.20222473 }, status: "UNBALANCED", feedbackPhrase: "HRV_UNBALANCED_10" },
				hrvReadings: [],
			},
			"2026-09-17",
		);
		const v = day(-24, { night });
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.at, v.dial!.gauge.tone], ["73", 0.2022, "orange"]);
		assert.deepEqual([v.status?.word, v.status?.shape], ["Unbalanced", "square"]);
		assert.deepEqual(v.figures, [
			{ value: "--", label: "Overnight Avg" },
			{ value: "--", label: "Highest 5-min Avg" },
		]);
		assert.equal(v.timeline!.state, "empty");
		// Unseen wording: the Help's own sentence for the status (Inferred).
		assert.equal(v.copy, "Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, among other factors.");
	});

	it("a LOW night just under lowUpper (Sep 22): the marker sits past the red band, so its colour says Low", () => {
		const v = day(-19, { night: null });
		assert.deepEqual([v.status?.word, v.dial!.gauge.tone, v.dial!.gauge.at], ["Low", "red", 0.1181]);
		assert.ok(v.dial!.gauge.at! > v.dial!.gauge.segments[0]!.to);
	});

	it("the index lacks the night: its own summary shows", () => {
		const v = day(0, { night: OCT_11_NIGHT }, ROWS.filter((r) => r.date !== TODAY));
		assert.deepEqual([v.dial!.gauge.value, v.status?.word, v.figures[0]!.value], ["84", "Balanced", "79"]);
	});

	it("onboarding (ONBOARDING_2, 2026-03-19): no 7-day average or marker, the Help's onboarding line, the night's figures", () => {
		const onboarding: HrvStatusRow = { date: "2026-03-19", night: 62, high: 99, lowUpper: 69, balLow: 73, balHigh: 96, status: "NONE", feedback: "ONBOARDING_2" };
		const v = hrvStatusView({ range: "1d", offset: 0 }, [onboarding], { today: "2026-03-19", complete: true, night: null }) as HrvDayView;
		assert.deepEqual([v.dial!.gauge.value, v.dial!.unit, v.dial!.gauge.at, v.status], ["--", undefined, undefined, undefined]);
		assert.equal(v.copy, ONBOARDING_COPY);
		assert.deepEqual(v.figures.map((f) => f.value), ["62", "99"]);
	});

	it("is the same dial Training Readiness's HRV Status sheet draws", () => {
		assert.deepEqual(day(0, { night: OCT_11_NIGHT }).dial, hrvDial(ROWS[ROWS.length - 1]!));
	});
});

describe("7d — Oct 5 – 11", () => {
	const v = period("7d");
	const on = period("7d", 0, { sub: OVERNIGHT });
	const chart = v.chart!;

	it("is 'Oct 5 - 11', seven Balanced dots at 82 81 84 84 84 84 84", () => {
		assert.deepEqual([v.label, v.from, v.to, v.canGoBack, v.canGoForward, v.title], ["Oct 5 - 11", "2026-10-05", "2026-10-11", true, false, "7-day Averages"]);
		assert.deepEqual(chart.points.map((p) => p.value), [82, 81, 84, 84, 84, 84, 84]);
		assert.ok(chart.points.every((p) => p.look.word === "Balanced" && p.look.shape === "circle" && p.look.tone === "green"));
		// A day's centre each, x 41.5 → 368.8 pt, 54.56 pt a day.
		chart.points.forEach((p, i) => assert.ok(Math.abs(41.5 + p.x * (368.8 - 41.5) - (41.5 + i * 54.55)) < 0.05));
	});

	it("labels four even ticks 98 87 76 64, the floor of 98.5 / 87.25 / 76 / 64.75 — rounding would print 65", () => {
		assert.deepEqual([chart.low, chart.high], [64.75, 98.5]);
		assert.deepEqual(chart.ticks, [
			{ value: 98.5, label: "98" },
			{ value: 87.25, label: "87" },
			{ value: 76, label: "76" },
			{ value: 64.75, label: "64" },
		]);
		assert.notEqual(String(Math.round(64.75)), chart.ticks[3]!.label);
	});

	it("places the dots and the band's edges within 1 px of the shot, on gridlines 929.5 → 1454.5 px", () => {
		const shot = [1185.5, 1201.5, 1154.5, 1154.5, 1154.5, 1154.5, 1154.5];
		chart.points.forEach((p, i) => assert.ok(Math.abs(ypx(p.value, chart, 929.5, 1454.5) - shot[i]!) <= 1, `${p.date}`));
		for (const [value, y] of [[90, 1062.0], [73, 1326.0], [89, 1077.0]]) assert.ok(Math.abs(ypx(value!, chart, 929.5, 1454.5) - y!) <= 1, `band edge ${value}`);
	});

	it("bands balancedLow..balancedUpper a night, one run, the top dipping to 89 on Oct 7", () => {
		assert.equal(chart.band.length, 1);
		assert.deepEqual(chart.band[0]!.map((b) => [b.low, b.high]), [[73, 90], [73, 90], [73, 89], [73, 90], [73, 90], [73, 90], [73, 90]]);
	});

	it("legends Balanced, Baseline; the chip adds Overnight Avg and the dashed line 84 80 88 89 79 86 79, the y axis unchanged", () => {
		assert.deepEqual(legend(v), ["Balanced", "Baseline"]);
		assert.deepEqual(v.chip, { label: CHIP_LABEL, on: false });
		assert.equal(chart.overnight, null);
		assert.deepEqual(on.chip, { label: "Overnight Averages", on: true });
		assert.deepEqual(legend(on), ["Balanced", "Baseline", "Overnight Avg"]);
		const line = on.chart!.overnight!;
		assert.deepEqual(line.map((p) => p.value), [84, 80, 88, 89, 79, 86, 79]);
		const shot = [1155.81, 1217.52, 1092.5, 1077.48, 1232.7, 1123.4, 1232.62];
		line.forEach((p, i) => assert.ok(Math.abs(ypx(p.value!, on.chart!, 929.5, 1454.5) - shot[i]!) <= 1.5, `vertex ${i}`));
		assert.deepEqual([on.chart!.low, on.chart!.high, on.chart!.ticks], [chart.low, chart.high, chart.ticks]);
	});

	it("has an axis dot a day, the ends large and labelled 10-05 and 10-11", () => {
		assert.deepEqual(chart.axis.dots.map((d) => d.large), [true, false, false, false, false, false, true]);
		assert.deepEqual(chart.axis.labels.map((l) => l.text), ["10-05", "10-11"]);
	});

	it("lists a card a night, newest first: Sunday / Oct 11 · 84 ms 7d Avg · 79 ms Overnight Avg; Saturday / Oct 10 · 84 · 86", () => {
		assert.equal(v.days.length, 7);
		const [first, second] = v.days;
		assert.deepEqual(first, {
			date: "2026-10-11",
			weekday: "Sunday",
			detail: "Oct 11",
			weekly: { value: "84", unit: "ms", label: "7d Avg" },
			night: { value: "79", unit: "ms", label: "Overnight Avg" },
			look: statusLook("BALANCED"),
		});
		assert.deepEqual([second!.weekday, second!.detail, second!.weekly.value, second!.night.value, second!.look?.tone], ["Saturday", "Oct 10", "84", "86", "green"]);
	});

	it("is the same chart Training Readiness's HRV Status sheet draws", () => {
		assert.deepEqual(chart, hrvAverages(ROWS, { from: "2026-10-05", to: "2026-10-11" }, false));
	});
});

describe("4w — Sep 14 – Oct 11", () => {
	const v = period("4w");
	const on = period("4w", 0, { sub: OVERNIGHT });
	const chart = v.chart!;

	it("is 'Sep 14 - Oct 11': 28 marks shaped by status — 2 circles, 6 squares, a triangle, a square, 18 circles", () => {
		assert.deepEqual([v.label, v.from, v.to], ["Sep 14 - Oct 11", "2026-09-14", "2026-10-11"]);
		const shapes = chart.points.map((p) => ({ circle: "G", square: "O", triangle: "R" })[p.look.shape]).join("");
		assert.equal(shapes, "GGOOOOOOROGGGGGGGGGGGGGGGGGG");
		assert.deepEqual(statusLook("UNBALANCED"), { status: "UNBALANCED", word: "Unbalanced", tone: "orange", shape: "square" });
		assert.deepEqual(statusLook("LOW"), { status: "LOW", word: "Low", tone: "red", shape: "triangle" });
	});

	it("runs 58 → 99.5, labelled 99 85 71 58: the bottom is Sep 25's overnight 58, counted with the chip off", () => {
		assert.deepEqual([chart.low, chart.high], [58, 99.5]);
		assert.deepEqual(chart.ticks.map((t) => t.label), ["99", "85", "71", "58"]);
		assert.equal(ROWS.find((r) => r.date === "2026-09-25")!.night, 58);
	});

	it("places the marks within 1 px of the shot, and within 1.5 px on the chip's shorter plot, the range unchanged", () => {
		const off = [1243.5, 1243.5, 1267.5, 1280.5, 1292.5, 1292.5, 1280.5, 1304.5, null, 1280.5, 1255.5, 1280.5, 1267.5, 1243.5, 1243.5, 1230.5, 1255.5, 1243.5, 1205.5, 1193.5, 1193.5, 1168.5, 1181.5, 1143.5, 1143.5, 1143.5, 1143.5, 1143.5];
		const chipOn = [1179.0, 1179.0, 1199.0, 1210.0, 1220.0, 1220.0, 1210.0, 1230.0, null, 1210.0, 1189.0, 1210.0, 1199.0, 1179.0, 1179.0, 1169.0, 1189.0, 1179.0, 1148.0, 1138.0, 1138.0, 1118.0, 1128.0, 1097.0, 1097.0, 1097.0, 1097.0, 1097.0];
		chart.points.forEach((p, i) => off[i] !== null && assert.ok(Math.abs(ypx(p.value, chart, 952.5, 1466.5) - off[i]!) <= 1, p.date));
		assert.deepEqual([on.chart!.low, on.chart!.high], [58, 99.5]);
		on.chart!.points.forEach((p, i) => chipOn[i] !== null && assert.ok(Math.abs(ypx(p.value, on.chart!, 939.5, 1364.5) - (chipOn[i]! + 0.5)) <= 1.5, p.date));
	});

	it("legends Balanced, Unbalanced, Low, Baseline, and breaks the dashed line at Sep 17", () => {
		assert.deepEqual(legend(v), ["Balanced", "Unbalanced", "Low", "Baseline"]);
		assert.deepEqual(legend(on), ["Balanced", "Unbalanced", "Low", "Baseline", "Overnight Avg"]);
		const line = on.chart!.overnight!;
		assert.equal(line.length, 28);
		assert.deepEqual(line.slice(2, 5).map((p) => p.value), [62, null, 68]);
		// Sep 17 keeps its dot.
		assert.ok(chart.points.some((p) => p.date === "2026-09-17" && p.value === 73));
	});

	it("labels its axis 09-14 and 10-11 under 28 dots", () => {
		assert.equal(chart.axis.dots.length, 28);
		assert.deepEqual(chart.axis.labels.map((l) => l.text), ["09-14", "10-11"]);
		assert.equal(v.days.length, 28);
	});
});

describe("previous periods", () => {
	it("7d − 1 is 'Sep 28 - Oct 4', Balanced only (the web's legend), 99 87 76 64 by the bottom rule (Inferred)", () => {
		const v = period("7d", -1);
		assert.deepEqual([v.label, v.canGoForward], ["Sep 28 - Oct 4", true]);
		assert.deepEqual(legend(v), ["Balanced", "Baseline"]);
		assert.deepEqual(v.chart!.ticks.map((t) => t.label), ["99", "87", "76", "64"]);
	});

	it("4w − 1 is 'Aug 17 - Sep 13', Balanced and Unbalanced (the web's legend), 102 90 77 65 by the bottom rule (Inferred)", () => {
		const v = period("4w", -1);
		assert.equal(v.label, "Aug 17 - Sep 13");
		assert.deepEqual(legend(v), ["Balanced", "Unbalanced", "Baseline"]);
		assert.deepEqual(v.chart!.ticks.map((t) => t.label), ["102", "90", "77", "65"]);
		// Sep 12 has no row: no dot and no card; the band bridges it (Inferred).
		assert.equal(v.chart!.points.length, 27);
		assert.equal(v.days.length, 27);
		assert.equal(v.chart!.band.length, 1);
		// Aug 18 and 19 have no overnight value: "--" on their cards.
		assert.deepEqual(v.days.filter((d) => d.night.value === "--").map((d) => d.detail), ["Aug 19", "Aug 18"]);
	});

	it("as the web showed them on Thursday Oct 8: 4w and 4w − 1 with Low, 7d and 7d − 1 Balanced only", () => {
		const thursday = { today: "2026-10-08" };
		assert.deepEqual([period("4w", 0, thursday).label, legend(period("4w", 0, thursday))], ["Sep 11 - Oct 8", ["Balanced", "Unbalanced", "Low", "Baseline"]]);
		assert.deepEqual([period("4w", -1, thursday).label, legend(period("4w", -1, thursday))], ["Aug 14 - Sep 10", ["Balanced", "Unbalanced", "Low", "Baseline"]]);
		assert.deepEqual([period("7d", 0, thursday).label, legend(period("7d", 0, thursday))], ["Oct 2 - 8", ["Balanced", "Baseline"]]);
		assert.deepEqual([period("7d", -1, thursday).label, legend(period("7d", -1, thursday))], ["Sep 25 - Oct 1", ["Balanced", "Baseline"]]);
	});

	it("before the history: the empty state, and no way further back once the index is whole", () => {
		const v = hrvStatusView({ range: "4w", offset: -20 }, ROWS, CTX) as HrvPeriodView;
		assert.deepEqual([v.chart, v.empty, v.days, v.canGoBack], [null, NO_DATA, [], false]);
		assert.equal((hrvStatusView({ range: "4w", offset: -20 }, ROWS, { ...CTX, complete: false }) as HrvPeriodView).canGoBack, true);
	});
});

describe("the parts", () => {
	it("ticks the Nightly Timeline every 20 ms from floor(min / 20) to ceil(max / 20)", () => {
		assert.deepEqual(timelineTicks(53, 105), [120, 100, 80, 60, 40]);
		assert.deepEqual(timelineTicks(57, 107), [120, 100, 80, 60, 40]);
		assert.deepEqual(timelineTicks(61, 79), [80, 60]);
		assert.deepEqual(timelineTicks(60, 60), [80, 60]);
	});

	it("floors a tick's label, never rounds it", () => {
		assert.deepEqual(averagesTicks(58, 99.5).map((t) => t.label), ["99", "85", "71", "58"]);
		assert.equal(averagesTicks(58, 99.5)[3]!.value, 58);
		assert.deepEqual([tickLabel(64.75), tickLabel(57.99999999999999), tickLabel(85.66666666666667)], ["64", "58", "85"]);
	});

	it("keeps the chip in the route's sub, the rest of the route as it was", () => {
		const route = performanceStatRoute("hrv-status", { range: "7d", offset: -1 });
		const on = withOvernight(route, true);
		assert.deepEqual(on, { ...route, sub: OVERNIGHT });
		assert.deepEqual(withOvernight(on, false), route);
		// 1d has no chip: it ignores it.
		assert.deepEqual(hrvStatusView({ range: "1d", offset: 0, sub: OVERNIGHT }, ROWS, { ...CTX, night: OCT_11_NIGHT }), day(0, { night: OCT_11_NIGHT }));
	});

	it("leaves the timeline pending while the night loads, and empty without readings", () => {
		assert.equal(nightTimeline(undefined).state, "pending");
		assert.equal(nightTimeline(null).state, "empty");
		assert.deepEqual(nightTimeline({ step: 300_000, values: [] }).points, []);
	});

	it("keys only the copy it has seen, and leaves NONE without a status word", () => {
		assert.equal(hrvCopy("HRV_BALANCED_6", "BALANCED"), BALANCED_6);
		assert.equal(hrvCopy("ONBOARDING_1", "NONE"), ONBOARDING_COPY);
		assert.equal(hrvCopy(undefined, undefined), undefined);
		assert.equal(statusLook("NONE"), undefined);
		assert.equal(statusLook("POOR")?.word, "Poor");
	});
});
