import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { TrainingReadinessReading } from "../src/garmin/endpoints";
import { readinessDial } from "../src/dashboard/gauges";
import { daysBetween } from "../src/dashboard/periods";
import { dialFraction, dialGeometry } from "../src/dashboard/stat-dial";
import { NO_DATA } from "../src/dashboard/training-status-copy";
import { readinessCopy, readinessTitle, type ReadinessFactorId } from "../src/dashboard/training-readiness-copy";
import {
	DOT_COLORS,
	READINESS_DIAL_ANGLES,
	factorFeedback,
	levelOfScore,
	percentBand,
	readinessAngle,
	readinessPageDial,
	trainingReadinessView,
	updatedLine,
	type AcuteSheet,
	type HrvSheet,
	type ReadinessSheet,
	type RecentSleepSheet,
	type RecentStressSheet,
	type RecoverySheet,
	type SleepScoreSheet,
	type TrainingReadinessContext,
	type TrainingReadinessView,
} from "../src/dashboard/training-readiness-pages";
import { shiftDate } from "../src/sync/day-index";
import {
	AFTER_ACTIVITY,
	REALTIME,
	TRAINING_READINESS_INDEX,
	WAKE_UP,
	readinessDayOf,
	rowsOfReadings,
	type ReadinessReading,
	type TrainingReadinessRow,
} from "../src/sync/training-readiness-index";
import type { TrainingStatusRow } from "../src/sync/training-status-index";
import { ALL, HRV, OCT_11_SERIES, SLEEP, STRESS, STRESS_FINAL, TODAY, dayReadingsOf } from "./training-readiness-fixture";
import { ROWS as STATUS } from "./training-status-fixture";

/**
 * Golden numbers from ref/performance-stats/training-readiness/README.md:
 * the phone shots of Sunday 2026-10-11 21:19–21:20, the web of 22:34–22:50
 * (today, and Oct 10 as a past day) and the payloads of 2026-10-12 — the
 * spec's 44 checks (golden-training-readiness.py) that reach the page. The
 * sheets' spans roll daily, so they only reproduce with today pinned.
 */

/** The index as the history walk leaves it on `today`: each fixture day's morning reading. */
function indexOn(today: string): TrainingReadinessRow[] {
	return rowsOfReadings(ALL)
		.map((r) => TRAINING_READINESS_INDEX.normalize(r)!)
		.filter((r) => r.date <= today)
		.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** A day's readings as `READINESS_DAY` keeps them. */
const keptOf = (date: string) => readinessDayOf(dayReadingsOf(date), date);

/** Oct 12's Training Status row once the watch synced (`ts-daily-2026-10-12.json`): 429 / 378, 1.1 OPTIMAL. */
const OCT_12_STATUS: TrainingStatusRow = { date: "2026-10-12", code: 4, phrase: "MAINTAINING_2", acute: 429, chronic: 378, ratio: 1.1, acwr: "OPTIMAL", acwrPct: 47, acwrFeedback: "FEEDBACK_2", trend: 2, trendSport: "RUNNING" };

interface Opts {
	today?: string;
	/** Undefined to leave the day's readings loading; absent for the day's kept readings. */
	readings?: readonly ReadinessReading[] | null;
	rows?: readonly TrainingReadinessRow[];
	complete?: boolean;
	ctx?: Partial<TrainingReadinessContext>;
}

/** The page `offset` days back from `today`, with every source the capture day had. */
function view(offset: number, opts: Opts = {}): TrainingReadinessView {
	const today = opts.today ?? TODAY;
	const date = shiftDate(today, offset);
	const readings = "readings" in opts ? opts.readings : keptOf(date);
	return trainingReadinessView(
		{ offset },
		{ rows: opts.rows ?? indexOn(today), complete: opts.complete ?? true, readings },
		{ today, status: [...STATUS, OCT_12_STATUS], hrv: HRV, sleep: SLEEP, stress: STRESS, series: date === "2026-10-11" ? OCT_11_SERIES : null, ...opts.ctx },
	);
}

/** The cards as the phone lists them: title, value, word, dot. */
const cards = (v: TrainingReadinessView) => v.factors.map((f) => [f.title, f.value, f.word, f.dot]);

function sheetOf<S extends ReadinessSheet>(v: TrainingReadinessView, id: ReadinessFactorId): S {
	const factor = v.factors.find((f) => f.id === id);
	assert.ok(factor, `no ${id} card`);
	return factor.sheet as S;
}

describe("Today — Sunday Oct 11 (phone and web)", () => {
	const v = view(0);

	it("shows the newest reading: 'Updated @ 9:41 AM • After Activity', 18 / 100, Poor, its title and copy", () => {
		assert.deepEqual([v.label, v.state, v.canGoBack, v.canGoForward], ["Today", "reading", true, false]);
		assert.equal(v.updated, "Updated @ 9:41 AM • After Activity");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.label], ["18", "100"]);
		assert.equal(v.level, "Poor");
		assert.equal(v.title, "Let your body recover");
		assert.equal(v.copy, "High recovery needs from previous workouts have reduced your training readiness.");
		// Not 07:36's 64, the morning reading the index keeps.
		assert.equal(v.reading?.score, 18);
	});

	it("puts the marker at 3.2 × (18 − 51) = −105.6° (shot −105.62°), red, the bands' gaps on the level boundaries", () => {
		assert.equal(v.dial!.angle, -105.6);
		assert.ok(Math.abs(v.dial!.angle! - -105.62) < 0.1);
		assert.equal(v.dial!.gauge.tone, "red");
		assert.equal(v.dial!.gauge.at, dialFraction(-105.6));
		// 3.2 × (24.5 / 49.5 / 74.5 / 94.5 − 51), against the shot's gaps.
		assert.deepEqual(READINESS_DIAL_ANGLES, [-150, -84.8, -4.8, 75.2, 139.2, 150]);
		const measured = [-84.78, -4.77, 75.3, 139.22];
		assert.ok(READINESS_DIAL_ANGLES.slice(1, 5).every((a, i) => Math.abs(a - measured[i]!) < 0.15));
		assert.deepEqual(
			v.dial!.gauge.segments.map((s) => s.tone),
			["red", "orange", "green", "blue", "purple"],
		);
		// On the page's dial (the readiness kind: 3° gaps, a halo round the marker), each gap centred on its boundary.
		const geometry = dialGeometry("readiness", v.dial!.gauge);
		assert.equal(geometry.marker?.angle, -105.6);
		for (let i = 0; i < 4; i++) assert.ok(Math.abs((geometry.bands[i]!.to + geometry.bands[i + 1]!.from) / 2 - READINESS_DIAL_ANGLES[i + 1]!) < 1e-9);
	});

	it("is not Home's dial: the web's and Home's are linear (18 → −96° on the web), the page's is not", () => {
		assert.equal(readinessDial(18).at, 0.18);
		assert.notEqual(v.dial!.gauge.at, 0.18);
		assert.ok(Math.abs(dialFraction(-105.6) - 0.148) < 1e-9);
	});

	it("lists the six factors: 89 Good · 82h High Need · 84 ms Balanced · 498 Optimal · Fair · Low, dots G R G G O G", () => {
		assert.deepEqual(cards(v), [
			["Sleep Score", "89", "Good", "green"],
			["Recovery Time", "82h", "High Need", "red"],
			["HRV Status", "84 ms", "Balanced", "green"],
			["Acute Load", "498", "Optimal", "green"],
			["Recent Sleep Scores", undefined, "Fair", "orange"],
			["Recent Stress", undefined, "Low", "green"],
		]);
		assert.deepEqual(
			v.factors.map((f) => DOT_COLORS[f.dot]),
			["#0B963F", "#E02C2C", "#0B963F", "#0B963F", "#EA670E", "#0B963F"],
		);
		// The bands behind them: sleep 88 % GOOD, recovery 10 % POOR (⌊4931 / 60⌋ = 82), HRV 90 % GOOD, acute 79 % GOOD, sleep history 66 % MODERATE, stress history 84 % GOOD.
		assert.deepEqual(
			v.factors.map((f) => f.feedback),
			["GOOD", "POOR", "GOOD", "GOOD", "MODERATE", "GOOD"],
		);
	});
});

describe("A past day — Saturday Oct 10 (the web)", () => {
	// A past day reads the index: its morning reading.
	const v = view(-1, { readings: undefined });

	it("shows the morning reading: 'Updated @ 7:24 AM • After Wake-Up' (07:24:57 truncated), 80, High, Well-recovered", () => {
		assert.deepEqual([v.label, v.state, v.canGoBack, v.canGoForward], ["Saturday, October 10", "reading", true, true]);
		assert.equal(v.updated, "Updated @ 7:24 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.tone, v.dial!.angle], ["80", "blue", 92.8]);
		assert.equal(v.level, "High");
		assert.equal(v.title, "Well-recovered");
		assert.equal(v.copy, "Nice job! You are well-rested and ready for action.");
	});

	it("lists 90 Excellent · 0h Recovered · 84 ms Balanced · 281 Low · Fair · Low, every dot green but Recent Sleep Scores", () => {
		assert.deepEqual(cards(v), [
			["Sleep Score", "90", "Excellent", "green"],
			["Recovery Time", "0h", "Recovered", "green"],
			["HRV Status", "84 ms", "Balanced", "green"],
			["Acute Load", "281", "Low", "green"],
			["Recent Sleep Scores", undefined, "Fair", "orange"],
			["Recent Stress", undefined, "Low", "green"],
		]);
	});

	it("takes Acute Load from the day's Training Status row (281 LOW), not the reading's 63; the dot from the reading (VERY_GOOD)", () => {
		assert.equal(v.reading?.acute, 63);
		const acute = v.factors.find((f) => f.id === "acute")!;
		assert.deepEqual([acute.value, acute.word, acute.feedback, acute.dot], ["281", "Low", "VERY_GOOD", "green"]);
		assert.equal(sheetOf<AcuteSheet>(v, "acute").heading, "281 - Low");
	});

	it("reads the same from the day's readings, not its newest (19:30's 26) nor its run's (09:16's 10)", () => {
		const loaded = view(-1);
		assert.deepEqual([loaded.updated, loaded.dial, cards(loaded)], [v.updated, v.dial, cards(v)]);
		// Without the index's row, the day's readings give it.
		const unwalked = view(-1, { rows: indexOn(TODAY).filter((r) => r.date !== "2026-10-10") });
		assert.deepEqual([unwalked.updated, unwalked.dial, cards(unwalked)], [v.updated, v.dial, cards(v)]);
	});
});

describe("The sheets — Oct 11", () => {
	const v = view(0);

	it("Sleep Score: Good, its copy, 89 / 100 Score, Good Quality, 6h 31m Duration, the night's hypnogram", () => {
		const s = sheetOf<SleepScoreSheet>(v, "sleep");
		assert.deepEqual([s.title, s.heading, s.copy], ["Sleep Score", "Good", "Good sleep like this helps support your training readiness."]);
		assert.deepEqual([s.score, s.outOf, s.scoreLabel], ["89", "100", "Score"]);
		assert.deepEqual(s.figures, [
			{ value: "Good", label: "Quality" },
			{ value: "6h 31m", label: "Duration" },
		]);
		assert.equal(s.chartTitle, "Sleep Timeline");
		assert.equal(s.timeline.state, "drawn");
		const t = s.timeline.timeline!;
		// Bed 23:58:40 and wake 06:31:40, truncated.
		assert.deepEqual([t.startLabel, t.endLabel], ["11:58 PM", "6:31 AM"]);
		// 18 stage runs: 9 light, 2 deep, 5 REM, 2 one-minute awakes (02:16, 03:39).
		assert.equal(t.bars.length, 18);
		const count = (stage: string) => t.bars.filter((b) => b.stage === stage).length;
		assert.deepEqual([count("light"), count("deep"), count("rem"), count("awake")], [9, 2, 5, 2]);
		// At sleepLevels' times, linear from bed to wake: the shot's edges at x 147 + 928 · t px, 1.61 px at most off.
		const measured: Record<string, Array<[number, number]>> = {
			deep: [
				[169, 250],
				[392, 439],
			],
			rem: [
				[278, 328],
				[510, 538],
				[754, 817],
				[990, 1035],
				[1054, 1075],
			],
			awake: [
				[472, 474],
				[668, 671],
			],
		};
		for (const [stage, edges] of Object.entries(measured)) {
			const bars = t.bars.filter((b) => b.stage === stage);
			bars.forEach((b, i) => {
				assert.ok(Math.abs(147 + 928 * b.x0 - edges[i]![0]) <= 1.62, `${stage} ${i} start`);
				assert.ok(Math.abs(147 + 928 * b.x1 - edges[i]![1]) <= 1.62, `${stage} ${i} end`);
			});
		}
		assert.deepEqual(
			t.bars.filter((b) => b.stage === "deep").map((b) => [b.x0, b.x1].map((x) => Math.round(x * 393 * 1e6) / 1e6)),
			[
				[10, 44],
				[104, 124],
			],
		);
		// Whole hours of the watch's clock: 00:00 (under the bed disc) to 06:00.
		assert.equal(t.hours.length, 7);
		assert.ok(Math.abs(t.hours[0]! - 80 / 23580) < 1e-12);
	});

	it("Recovery Time: 'Updated @ 9:41 AM', High Need, its copy, 82h in a full red ring", () => {
		const s = sheetOf<RecoverySheet>(v, "recovery");
		assert.deepEqual(
			[s.title, s.updated, s.heading, s.copy, s.value, s.label, s.ring],
			[
				"Recovery Time",
				"Updated @ 9:41 AM",
				"High Need",
				"Your high recovery needs have decreased your training readiness. You may need more time to recover.",
				"82h",
				"High Need",
				"red",
			],
		);
	});

	it("HRV Status: Balanced, its copy, the HRV page's dial (84 ms 7d Avg) and its 7d chart (98 87 76 64)", () => {
		const s = sheetOf<HrvSheet>(v, "hrv");
		assert.deepEqual(
			[s.heading, s.copy],
			["Balanced", "Balanced HRV status like this establishes a solid foundation for your training readiness both today and in the future."],
		);
		assert.deepEqual([s.dial!.gauge.value, s.dial!.unit, s.dial!.gauge.label], ["84", "ms", "7d Avg"]);
		assert.equal(s.chartTitle, "7-day Averages");
		// Top 90 + 17 / 2 = 98.5, bottom 69 − 17 / 4 = 64.75, labels floored.
		assert.deepEqual(
			s.chart!.ticks.map((t) => t.label),
			["98", "87", "76", "64"],
		);
		assert.deepEqual([s.chart!.high, s.chart!.low], [98.5, 64.75]);
		assert.deepEqual(
			s.chart!.points.map((p) => p.value),
			[82, 81, 84, 84, 84, 84, 84],
		);
		assert.deepEqual(
			s.chart!.axis.labels.map((l) => l.text),
			["10-05", "10-11"],
		);
	});

	it("Acute Load: '498 - Optimal', its copy, Load's 4-week timeline (1.1k / 750 / 375 / 0, 09-14 … 10-11)", () => {
		const s = sheetOf<AcuteSheet>(v, "acute");
		assert.deepEqual([s.heading, s.copy, s.chartTitle], ["498 - Optimal", "Your optimal training load is supporting your training readiness. Nice work!", "4-Week Timeline"]);
		const chart = s.chart!;
		// M = 702 (Sep 28): lines at 0, 351, 702, 1053; labels a step of ⌈1053 / 3 / 25⌉ × 25 = 375.
		assert.equal(chart.axis.top, 1053);
		assert.deepEqual(
			chart.axis.labels.map((l) => l.text),
			["1.1k", "750", "375", "0"],
		);
		assert.equal(chart.acute.length, 28);
		assert.deepEqual([chart.acute[0]!.value, chart.acute[14]!.value, chart.acute[27]!.value], [378, 702, 498]);
		assert.deepEqual(
			chart.axisX.labels.map((l) => l.text),
			["09-14", "10-11"],
		);
		// No Chronic Load chip: the band green, the acute line white.
		assert.deepEqual([chart.muted, chart.chronic], [false, undefined]);
		assert.deepEqual(
			s.legend.map((l) => l.label),
			["Optimal Range", "Acute Load"],
		);
	});

	it("Recent Sleep Scores: Fair, its copy, 88 84 94 74 53 90 89 on 0–100, the relevant 53 (Oct 9) and 90 (Oct 10)", () => {
		const s = sheetOf<RecentSleepSheet>(v, "sleep-history");
		assert.deepEqual(
			[s.heading, s.copy, s.chartTitle, s.legend],
			[
				"Fair",
				"Your fair sleep on recent nights may have a slightly negative impact on your readiness. Strive for better sleep each night to get back on track.",
				"Daily Scores",
				"Relevant Scores",
			],
		);
		assert.deepEqual(s.chart!.ticks, [100, 75, 50, 25, 0]);
		assert.deepEqual(
			s.chart!.points.map((p) => p.value),
			[88, 84, 94, 74, 53, 90, 89],
		);
		assert.deepEqual(
			s.chart!.points.map((p) => p.relevant),
			[false, false, false, false, true, true, false],
		);
		assert.deepEqual(
			s.chart!.axis.labels.map((l) => l.text),
			["10-05", "10-11"],
		);
		assert.deepEqual(s.figures, [
			{ value: "53", label: "Score - Oct 9" },
			{ value: "90", label: "Score - Oct 10" },
		]);
	});

	it("Recent Stress: Low, its copy, Stress' 7d line 22 26 27 29 33 30 32, and 28 Avg Stress Level = ⌊199 / 7⌋", () => {
		const s = sheetOf<RecentStressSheet>(v, "stress-history");
		assert.deepEqual(
			[s.heading, s.copy, s.chartTitle],
			["Low", "You have found a good balance between daytime stress and recovery over the last few days.", "Daily Averages"],
		);
		assert.deepEqual(
			s.chart!.points.map((p) => p.value),
			[22, 26, 27, 29, 33, 30, 32],
		);
		assert.deepEqual([s.chart!.from, s.chart!.to], ["2026-10-05", "2026-10-11"]);
		assert.deepEqual(
			s.chart!.axis.labels.map((l) => l.text),
			["10-05", "10-11"],
		);
		assert.deepEqual(s.figure, { value: "28", label: "Avg Stress Level" });
		// Today's level is partial: 31 once the day was over, still ⌊198 / 7⌋ = 28.
		const final = sheetOf<RecentStressSheet>(view(0, { ctx: { stress: STRESS_FINAL } }), "stress-history");
		assert.deepEqual([final.chart!.points[6]!.value, final.figure.value], [31, "28"]);
	});
});

describe("Other days the rules decide (Inferred, the spec's predictions)", () => {
	it("Oct 11 as a past day: 7:36's 64 Moderate, 'Boosted by good sleep', 32h Moderate Need (floored), 498 Optimal green", () => {
		const v = view(-1, { today: "2026-10-12" });
		assert.equal(v.updated, "Updated @ 7:36 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.level, v.title, v.copy], ["64", "Moderate", "Boosted by good sleep", undefined]);
		assert.deepEqual(cards(v).slice(0, 4), [
			["Sleep Score", "89", "Good", "green"],
			["Recovery Time", "32h", "Moderate Need", "orange"],
			["HRV Status", "84 ms", "Balanced", "green"],
			["Acute Load", "498", "Optimal", "green"],
		]);
		assert.equal(sheetOf<RecoverySheet>(v, "recovery").ring, "orange");
	});

	it("Oct 12, today once the watch synced: 6:00's 19 Poor, Acute Load from its Training Status row (429 Optimal)", () => {
		const v = view(0, { today: "2026-10-12" });
		assert.equal(v.updated, "Updated @ 6:00 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.level, v.title], ["19", "Poor", "Let your body recover"]);
		assert.deepEqual(v.factors.find((f) => f.id === "acute")!.value, "429");
		assert.deepEqual(v.factors.find((f) => f.id === "acute")!.word, "Optimal");
	});

	it("Oct 8: the wake-up 6:03's 94 High, 'Excellent recovery', Sleep Score 74 Fair — not 12:20 AM's", () => {
		const v = view(-3);
		assert.equal(v.updated, "Updated @ 6:03 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.level, v.title], ["94", "High", "Excellent recovery"]);
		assert.deepEqual(cards(v)[0], ["Sleep Score", "74", "Fair", "orange"]);
	});

	it("Sep 25 (two wake-ups): 5:33's 39 Low, 'Find time to relax', Sleep Score 42 Poor, 4h Low Need", () => {
		const v = view(-16);
		assert.equal(v.date, "2026-09-25");
		assert.equal(v.updated, "Updated @ 5:33 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.level, v.title], ["39", "Low", "Find time to relax"]);
		assert.deepEqual(cards(v).slice(0, 2), [
			["Sleep Score", "42", "Poor", "red"],
			["Recovery Time", "4h", "Low Need", "green"],
		]);
	});

	it("Home's card of Thu Sep 24, that day's newest: 12:09's 86 High, 'Energized by good sleep'", () => {
		const v = view(0, { today: "2026-09-24" });
		assert.deepEqual([v.updated, v.dial!.gauge.value, v.level, v.title], ["Updated @ 12:09 PM • After Activity", "86", "High", "Energized by good sleep"]);
	});
});

describe("Empty and edge states", () => {
	it("today before the watch syncs: the shared empty line, the stepper still there", () => {
		const v = view(0, { today: "2026-10-12", readings: null, rows: indexOn("2026-10-11") });
		assert.deepEqual([v.label, v.state, v.empty, v.canGoBack, v.canGoForward, v.factors], ["Today", "empty", NO_DATA, true, false, []]);
		assert.equal(v.dial, undefined);
	});

	it("today while its readings load: the index's morning reading stands in, else nothing until they come", () => {
		const standIn = view(0, { readings: undefined });
		assert.deepEqual([standIn.state, standIn.standIn, standIn.updated, standIn.dial!.gauge.value], ["reading", true, "Updated @ 7:36 AM • After Wake-Up", "64"]);
		// Offline, or a load that failed: the same.
		assert.deepEqual([view(0, { readings: null }).standIn, view(0, { readings: null }).dial!.gauge.value], [true, "64"]);
		// Once they are in, the newest; a past day never stands in.
		assert.equal(view(0).standIn, undefined);
		assert.equal(view(-1, { readings: undefined }).standIn, undefined);
		const pending = view(0, { today: "2026-10-12", readings: undefined, rows: indexOn("2026-10-11") });
		assert.deepEqual([pending.state, pending.empty, pending.factors], ["pending", undefined, []]);
	});

	it("a day inside the history without a reading (2026-01-07): the empty line, and stepping goes on", () => {
		const v = view(-daysBetween("2026-01-07", TODAY), { readings: null });
		assert.deepEqual([v.date, v.label, v.state, v.empty, v.canGoBack, v.canGoForward], ["2026-01-07", "Wednesday, January 7", "empty", NO_DATA, true, true]);
		// While its readings load, nothing yet.
		assert.equal(view(-daysBetween("2026-01-07", TODAY), { readings: undefined }).state, "pending");
	});

	it("stops '<' at the history's first day once the index is whole", () => {
		const first = -daysBetween("2025-08-02", TODAY);
		assert.equal(view(first).canGoBack, false);
		assert.equal(view(first, { complete: false }).canGoBack, true);
		assert.equal(view(first + 1).canGoBack, true);
	});

	it("onboarding (2025-08-03): the bands without a number or marker, no level, title or copy, every card '--' and grey", () => {
		const v = view(-1, { today: "2025-08-04", ctx: { status: [], hrv: [], sleep: [], stress: [] } });
		assert.equal(v.updated, "Updated @ 6:54 AM • After Wake-Up");
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.at, v.dial!.angle, v.dial!.gauge.segments.length], ["--", undefined, undefined, 5]);
		assert.deepEqual([v.level, v.title, v.copy], [undefined, undefined, undefined]);
		assert.deepEqual(
			v.factors.map((f) => [f.value, f.word, f.dot]),
			[
				["--", undefined, "grey"],
				["--", undefined, "grey"],
				["--", undefined, "grey"],
				["--", undefined, "grey"],
				[undefined, undefined, "grey"],
				[undefined, undefined, "grey"],
			],
		);
		assert.ok(v.factors.every((f) => f.sheet.heading === undefined && f.sheet.copy === undefined));
	});

	it("overnight before waking (Oct 8, 00:30): the 12:20 AM realtime reading, no context, Sleep Score '--'", () => {
		const overnight = keptOf("2026-10-08")!.slice(0, 1);
		const v = view(0, { today: "2026-10-08", readings: overnight, rows: indexOn("2026-10-07") });
		assert.equal(v.updated, "Updated @ 12:20 AM");
		assert.deepEqual([v.dial!.gauge.value, v.level], ["94", "High"]);
		assert.deepEqual(cards(v)[0], ["Sleep Score", "--", undefined, "grey"]);
	});

	it("a scored reading with UNKNOWN feedback: the dial and the level word, no title or copy", () => {
		const unknown: ReadinessReading = { ...keptOf("2026-10-10")![2]!, short: "UNKNOWN", long: "UNKNOWN", score: 25, level: "LOW" };
		const v = view(-1, { readings: [unknown], rows: [] });
		assert.deepEqual([v.dial!.gauge.value, v.dial!.gauge.tone, v.level, v.title, v.copy], ["25", "orange", "Low", undefined, undefined]);
	});

	it("sheets with nothing to draw: the series loading or missing, the other indexes empty", () => {
		const loading = view(0, { ctx: { series: undefined } });
		assert.equal(sheetOf<SleepScoreSheet>(loading, "sleep").timeline.state, "pending");
		const bare = view(0, { ctx: { series: null, status: [], hrv: [], sleep: [], stress: [] } });
		const sleep = sheetOf<SleepScoreSheet>(bare, "sleep");
		// The night's number falls back to the reading's; its figures wait for the sleep index.
		assert.deepEqual([sleep.score, sleep.figures.map((f) => f.value), sleep.timeline.state], ["89", ["--", "--"], "empty"]);
		assert.deepEqual([sheetOf<HrvSheet>(bare, "hrv").dial, sheetOf<HrvSheet>(bare, "hrv").chart], [null, null]);
		const acute = bare.factors.find((f) => f.id === "acute")!;
		// Without a Training Status row: the reading's own acute load, no word, the dot still the reading's.
		assert.deepEqual([acute.value, acute.word, acute.dot, (acute.sheet as AcuteSheet).heading, (acute.sheet as AcuteSheet).chart], ["498", undefined, "green", "498", null]);
		assert.deepEqual([sheetOf<RecentSleepSheet>(bare, "sleep-history").chart, sheetOf<RecentSleepSheet>(bare, "sleep-history").figures], [null, []]);
		assert.deepEqual([sheetOf<RecentStressSheet>(bare, "stress-history").chart, sheetOf<RecentStressSheet>(bare, "stress-history").figure.value], [null, "--"]);
	});

	it("sheet copy only where it was seen: Oct 10's LOW acute load and Recovered have none", () => {
		const v = view(-1);
		assert.equal(sheetOf<AcuteSheet>(v, "acute").copy, undefined);
		assert.deepEqual([sheetOf<RecoverySheet>(v, "recovery").heading, sheetOf<RecoverySheet>(v, "recovery").copy, sheetOf<RecoverySheet>(v, "recovery").ring], ["Recovered", undefined, "green"]);
		assert.equal(sheetOf<SleepScoreSheet>(v, "sleep").heading, "Excellent");
	});
});

describe("The rules", () => {
	/** Each factor's percent and band as Garmin sends them. */
	const FACTORS: Array<[ReadinessFactorId, string]> = [
		["sleep", "sleepScore"],
		["recovery", "recoveryTime"],
		["acute", "acwr"],
		["hrv", "hrv"],
		["sleep-history", "sleepHistory"],
		["stress-history", "stressHistory"],
	];

	it("a factor's band is a band of its percent: <40 POOR, 40–69 MODERATE, 70–99 GOOD (sleep 70–89), 100 VERY_GOOD (sleep 90+), 0 NONE", () => {
		let checked = 0;
		for (const r of ALL) {
			for (const [factor, key] of FACTORS) {
				const percent = r[`${key}FactorPercent`] as number;
				const band = r[`${key}FactorFeedback`] as string;
				// Garmin sends stress history's 70 both ways (9 GOOD, 6 MODERATE in the history).
				if (factor === "stress-history" && percent === 70) continue;
				assert.equal(percentBand(percent, factor), band, `${r.timestampLocal} ${key} ${percent}`);
				checked += 1;
			}
		}
		assert.ok(checked > 540);
		assert.deepEqual(
			[39, 40, 69, 70, 89, 90, 99, 100].map((p) => percentBand(p, "sleep")),
			["POOR", "MODERATE", "MODERATE", "GOOD", "GOOD", "VERY_GOOD", "VERY_GOOD", "VERY_GOOD"],
		);
		assert.deepEqual(
			[89, 90, 99, 100].map((p) => percentBand(p, "recovery")),
			["GOOD", "GOOD", "GOOD", "VERY_GOOD"],
		);
		assert.equal(percentBand(100, "stress-history"), "GOOD");
		assert.equal(percentBand(0, "hrv"), "NONE");
	});

	it("takes Garmin's band when it sends one, the percent's otherwise, NONE without either", () => {
		assert.equal(factorFeedback("GOOD", 10, "recovery"), "GOOD");
		assert.equal(factorFeedback(" moderate ", undefined, "hrv"), "MODERATE");
		assert.equal(factorFeedback(undefined, 47, "recovery"), "MODERATE");
		assert.equal(factorFeedback("SOMETHING_NEW", 95, "sleep"), "VERY_GOOD");
		assert.equal(factorFeedback(undefined, undefined, "acute"), "NONE");
	});

	it("levels are score bands: POOR 1–24, LOW 25–49, MODERATE 50–74, HIGH 75–94, PRIME 95–100 (every scored reading)", () => {
		for (const r of ALL) if (r.score !== null && r.score !== undefined) assert.equal(levelOfScore(r.score), r.level, r.timestampLocal!);
		assert.deepEqual(
			[1, 24, 25, 49, 50, 74, 75, 94, 95, 100].map(levelOfScore),
			["POOR", "POOR", "LOW", "LOW", "MODERATE", "MODERATE", "HIGH", "HIGH", "PRIME", "PRIME"],
		);
	});

	it("Garmin's sleep-score band is the sleep score's: 90+ VERY_GOOD, 80–89 GOOD, 60–79 MODERATE, under 60 POOR", () => {
		const band = (s: number) => (s >= 90 ? "VERY_GOOD" : s >= 80 ? "GOOD" : s >= 60 ? "MODERATE" : "POOR");
		const scored = ALL.filter((r: TrainingReadinessReading) => r.sleepScore !== null && r.sleepScoreFactorFeedback !== "NONE");
		assert.ok(scored.length > 60);
		for (const r of scored) assert.equal(r.sleepScoreFactorFeedback, band(r.sleepScore!), r.timestampLocal!);
	});

	it("weighs the nights before the day: Recent Sleep's percent holds all Sep 16 while last night's score moves 38 → 45", () => {
		const sep16 = dayReadingsOf("2026-09-16");
		assert.equal(sep16.length, 5);
		assert.deepEqual([...new Set(sep16.map((r) => r.sleepHistoryFactorPercent))], [55]);
		assert.deepEqual([...new Set(sep16.flatMap((r) => (r.sleepScore === null ? [] : [r.sleepScore])))].sort(), [38, 45]);
	});

	it("turns the dial 3.2° a point about 51, stopping at the sweep's ends", () => {
		assert.deepEqual(
			[18, 51, 80, 97, 4.1, 97.9].map(readinessAngle),
			[-105.6, 0, 92.8, 147.2, -150, 150],
		);
		assert.deepEqual([readinessAngle(0), readinessAngle(100), readinessAngle(98)], [-150, 150, 150]);
		// The level's colour, Prime purple.
		assert.equal(readinessPageDial(100, "PRIME").gauge.tone, "purple");
		assert.equal(readinessPageDial(60).gauge.tone, "green");
	});

	it("writes 'Updated @' truncated to the minute, with the context it knows", () => {
		assert.equal(updatedLine({ time: 581, ctx: AFTER_ACTIVITY }), "Updated @ 9:41 AM • After Activity");
		assert.equal(updatedLine({ time: 444, ctx: WAKE_UP }), "Updated @ 7:24 AM • After Wake-Up");
		assert.equal(updatedLine({ time: 1170, ctx: REALTIME }), "Updated @ 7:30 PM");
		assert.equal(updatedLine({ time: 720, ctx: WAKE_UP }, false), "Updated @ 12:00 PM");
		assert.equal(updatedLine({ ctx: WAKE_UP }), undefined);
	});

	it("floors recovery to whole hours: 4931 min 82h, 1966 min 32h, 59 min 'Recovered' at 0h", () => {
		const recovery = (minutes: number, fb: string) => view(-1, { readings: [{ ...keptOf("2026-10-10")![0]!, recovery: minutes, recoveryFb: fb }], rows: [] }).factors[1]!;
		assert.deepEqual([recovery(4931, "POOR").value, recovery(4931, "POOR").word], ["82h", "High Need"]);
		assert.deepEqual([recovery(1966, "MODERATE").value, recovery(1966, "MODERATE").word], ["32h", "Moderate Need"]);
		assert.deepEqual([recovery(59, "VERY_GOOD").value, recovery(59, "VERY_GOOD").word], ["0h", "Recovered"]);
		assert.deepEqual([recovery(60, "GOOD").value, recovery(60, "GOOD").word], ["1h", "Low Need"]);
	});

	it("titles seen keep Garmin's words, others are their key in sentence case, UNKNOWN none; copy only where seen", () => {
		assert.equal(readinessTitle("WELL_RECOVERED"), "Well-recovered");
		assert.equal(readinessTitle("LISTEN_TO_YOUR_BODY"), "Listen to your body");
		assert.equal(readinessTitle("ENERGIZED_BY_GOOD_SLEEP"), "Energized by good sleep");
		assert.equal(readinessTitle("UNKNOWN"), undefined);
		assert.equal(readinessTitle(undefined), undefined);
		assert.equal(readinessCopy("MOD_RT_MOD_SS_GOOD"), undefined);
		assert.equal(readinessCopy("HIGH_RT_HIGHEST_SS_AVAILABLE"), "Nice job! You are well-rested and ready for action.");
	});
});
