import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ENDURANCE_HELP, ENDURANCE_PHRASES, HELP_CLASSES_INTRO, endurancePhrase } from "../src/dashboard/endurance-score-copy";
import {
	DASH,
	ENDURANCE_TABS,
	RING_GAP,
	contributorTicks,
	contributorsOf,
	enduranceClassWord,
	enduranceDialGauge,
	enduranceFigures,
	enduranceHelp,
	endurancePeriods,
	enduranceScaleOf,
	enduranceScoreView,
	enduranceTab,
	enduranceTypesOf,
	percentText,
	placeOf,
	scoreTicks,
	sharesOf,
	type EnduranceContributors,
	type EnduranceDayView,
	type EndurancePeriodView,
	type EnduranceScoreContext,
	type EnduranceScoreRoute,
} from "../src/dashboard/endurance-score-pages";
import { ENDURANCE_CLASSES } from "../src/dashboard/gauges";
import type { DayRow } from "../src/dashboard/series";
import { dialAngle, dialGeometry } from "../src/dashboard/stat-dial";
import { NO_DATA, NO_READING } from "../src/dashboard/vo2-max-pages";
import type { EnduranceScoreRow } from "../src/sync/endurance-score-index";
import { enduranceRows } from "./endurance-score-fixture";

/**
 * Golden numbers from ref/performance-stats/endurance-score/README.md: the
 * phone shots of Sunday 2026-10-11 21:27–21:28, the web report of 23:03, and
 * the whole history as the daily stats route sent it at 05:30 on Oct 12
 * (`golden-endurance-score.py`: 99 checks; `rebuild.py`: 169 of 169 of
 * Garmin's weekly and monthly groups). The 12w and 1y windows roll daily, so
 * they only reproduce with today pinned.
 */
const TODAY = "2026-10-11";

const ROWS = enduranceRows();

/** The scale the day files hold (`endurance_*`) on every synced day, 2026-09-21 → 10-11; it never changed. */
const SCALE_VALUES = {
	endurance_gauge_low: 3570,
	endurance_gauge_high: 10560,
	endurance_intermediate_from: 5100,
	endurance_trained_from: 5800,
	endurance_well_trained_from: 6600,
	endurance_expert_from: 7300,
	endurance_superior_from: 8100,
	endurance_elite_from: 8800,
};
const DAYS: DayRow[] = ROWS.filter((r) => r.date >= "2026-09-21").map((r) => ({ date: r.date, values: { endurance_score: r.score!, endurance_classification: r.classId!, endurance_feedback: r.phraseId!, ...SCALE_VALUES } }));

const CTX: EnduranceScoreContext = { today: TODAY, complete: true, days: DAYS };

const COPY_55 = "Your endurance score has remained stable over the last four weeks. Focus on gradual increases in training frequency, volume and number of long workouts to improve.";

const day = (offset: number, tab = "score", ctx: EnduranceScoreContext = CTX, rows: readonly EnduranceScoreRow[] = ROWS) =>
	enduranceScoreView({ range: "1d", offset, tab }, rows, ctx) as EnduranceDayView;
const period = (route: EnduranceScoreRoute, ctx: EnduranceScoreContext = CTX, rows: readonly EnduranceScoreRow[] = ROWS) => enduranceScoreView(route, rows, ctx) as EndurancePeriodView;
const values = (v: EndurancePeriodView) => v.line?.points.map((p) => p.value) ?? [];
const figures = (v: Pick<EndurancePeriodView, "figures">) => v.figures.map((f) => `${f.value} ${f.label}`);
const list = (rows: EnduranceContributors["rows"]) => rows.map((r) => `${r.sub ? "  " : ""}${r.name} ${r.text}`);
const block = (v: EndurancePeriodView, title: string) => list(v.blocks.find((b) => b.title === title)!.rows);
const near = (a: number, b: number, within: number, what: string) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a}, the shot's ${b}`);
const byDate = new Map(ROWS.map((r) => [r.date, r]));

describe("the fixture", () => {
	it("is the history the samples hold: 436 days from 2025-08-02, 14 calibrating with Miscellaneous 100, the first score 6,830 on Aug 16", () => {
		assert.equal(ROWS.length, 436);
		assert.deepEqual([ROWS[0]!.date, ROWS[ROWS.length - 1]!.date], ["2025-08-02", TODAY]);
		assert.equal(ROWS.filter((r) => r.score === undefined).length, 14);
		assert.ok(ROWS.filter((r) => r.score === undefined).every((r) => r.contrib === "g8:100"));
		assert.deepEqual(ROWS.find((r) => r.score !== undefined), { date: "2025-08-16", score: 6830, contrib: "g0:88.89 g6:11.11 g8:0" });
		assert.deepEqual(byDate.get(TODAY), { date: TODAY, score: 6413, classId: 3, phraseId: 55, contrib: "g0:93.54 t31:2.37 t13:2.06 g8:2.03" });
	});
});

describe("1d — Today, 2026-10-11, Endurance Score", () => {
	const v = day(0);

	it("shows 6,413, Trained and phrase 55's copy", () => {
		assert.deepEqual([v.label, v.state, v.date, v.tab], ["Today", "scored", TODAY, "score"]);
		assert.deepEqual([v.value, v.classWord, v.copy], ["6,413", "Trained", COPY_55]);
		assert.deepEqual([v.gauge!.value, v.gauge!.label, v.gauge!.tone], ["6,413", "Trained", "yellow"]);
		assert.deepEqual([v.canGoBack, v.canGoForward, v.empty, v.wantsDay], [true, false, undefined, false]);
	});

	it("puts the marker on the linear dial from 3,570 to 10,560: 0.4067 → −27.98°, measured −28.03°", () => {
		near(v.gauge!.at!, 2843 / 6990, 1e-12, "at");
		near(dialAngle(v.gauge!.at!), -28.03, 0.06, "marker");
		const g = dialGeometry("endurance", v.gauge);
		near(g.marker!.angle, -27.98, 0.005, "drawn marker");
		assert.equal(g.marker!.tone, "yellow");
	});

	it("puts the six gaps at the class limits, within 0.09° of the shot's gap centres", () => {
		const g = dialGeometry("endurance", v.gauge);
		const gaps = g.bands.slice(1).map((b, i) => (g.bands[i]!.to + b.from) / 2);
		// The linear map: −84.33 / −54.29 / −19.96 / 10.09 / 44.42 / 74.46.
		assert.deepEqual(gaps.map((a) => Number(a.toFixed(2))), [-84.33, -54.29, -19.96, 10.09, 44.42, 74.46]);
		[-84.36, -54.29, -19.92, 10.03, 44.42, 74.55].forEach((m, i) => near(gaps[i]!, m, 0.09, `gap ${i}`));
		assert.deepEqual(g.bands.map((b) => b.tone), ["red", "orange", "yellow", "green", "blue", "purple", "pink"]);
		assert.deepEqual([g.bands[0]!.from, g.bands[6]!.to], [-150, 150]);
	});
});

describe("1d — Today, Top Contributors", () => {
	const v = day(0, "contributors");

	it("lists Running 93.54% · Gym & Fitness Equipment 4.43% · Stair Stepper 2.37% · Strength Training 2.06% · Miscellaneous 2.03%", () => {
		assert.equal(v.tab, "contributors");
		assert.deepEqual(list(v.rows), ["Running 93.54%", "Gym & Fitness Equipment 4.43%", "  Stair Stepper 2.37%", "  Strength Training 2.06%", "Miscellaneous 2.03%"]);
		assert.deepEqual(v.rows.map((r) => r.category), ["running", "gym", "gym", "gym", "misc"]);
		// The number in the ring and the class under it.
		assert.deepEqual([v.value, v.classWord], ["6,413", "Trained"]);
	});

	it("runs the ring clockwise from 12 o'clock, share × 360° less half a 3.45° gap at each end", () => {
		assert.equal(RING_GAP, 3.45);
		assert.deepEqual(v.ring.map((s) => s.category), ["running", "gym", "misc"]);
		const measured: Array<[number, number]> = [
			[1.77, 335.0],
			[338.48, 351.07],
			[354.44, 358.22],
		];
		v.ring.forEach((s, i) => {
			near(s.from, measured[i]![0], 0.11, `slice ${i} start`);
			near(s.to, measured[i]![1], 0.11, `slice ${i} end`);
		});
		assert.deepEqual(v.ring.map((s) => [Number(s.from.toFixed(3)), Number(s.to.toFixed(3))]), [
			[1.725, 335.019],
			[338.469, 350.967],
			[354.417, 358.275],
		]);
	});

	it("keys the ring with Running, Gym & Fitness Equipment, Miscellaneous", () => {
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Gym & Fitness Equipment", "Miscellaneous"]);
	});
});

describe("1d — other days", () => {
	it("Oct 10, the web's 1d-prev: 6,401 Trained, phrase 55's copy", () => {
		const v = day(-1);
		assert.deepEqual([v.label, v.value, v.classWord, v.copy, v.canGoForward], ["Saturday, October 10", "6,401", "Trained", COPY_55, true]);
		assert.deepEqual(list(day(-1, "contributors").rows), ["Running 93.15%", "Gym & Fitness Equipment 4.69%", "  Stair Stepper 2.51%", "  Strength Training 2.18%", "Miscellaneous 2.16%"]);
	});

	it("Oct 5, phrase 63: no copy captured, the dial and class still shown", () => {
		const v = day(-6);
		assert.deepEqual([v.date, v.value, v.classWord, v.copy, v.wantsDay], ["2026-10-05", "6,416", "Trained", undefined, false]);
	});

	it("a day the history walk brought: the class from the score and the scale, the phrase once the day's payload loads", () => {
		// 2026-03-20: 7,080, class 4, phrase 55 (probe-day-2026-03-20.json); the row holds the score and list alone.
		const bare = day(-205);
		assert.equal(bare.date, "2026-03-20");
		assert.deepEqual([bare.value, bare.classWord, bare.copy, bare.wantsDay], ["7,080", "Well-Trained", undefined, true]);
		const loaded = day(-205, "score", { ...CTX, day: { classId: 4, phraseId: 55 } });
		assert.deepEqual([loaded.copy, loaded.wantsDay], [COPY_55, false]);
		// Loaded with nothing (offline, or Garmin had nothing): no copy, and nothing more to ask.
		assert.deepEqual([day(-205, "score", { ...CTX, day: null }).copy, day(-205, "score", { ...CTX, day: null }).wantsDay], [undefined, false]);
	});

	it("words each class by Garmin's id, else 1 + the limits at or below the score: Jul 20 6,620, Oct 23, 2025 8,582", () => {
		assert.deepEqual([day(-83).date, day(-83).classWord], ["2026-07-20", "Well-Trained"]);
		assert.deepEqual([day(-353).date, day(-353).value, day(-353).classWord, day(-353).gauge!.tone], ["2025-10-23", "8,582", "Superior", "purple"]);
		const scale = enduranceScaleOf(DAYS, TODAY)!;
		const word = (score: number) => enduranceClassWord({ score }, scale);
		assert.deepEqual(
			[1, 5099, 5100, 5799, 5800, 6599, 6600, 7299, 7300, 8099, 8100, 8799, 8800, 10560].map(word),
			["Recreational", "Recreational", "Intermediate", "Intermediate", "Trained", "Trained", "Well-Trained", "Well-Trained", "Expert", "Expert", "Superior", "Superior", "Elite", "Elite"],
		);
		assert.deepEqual([enduranceClassWord({ score: 6413, classId: 4 }, scale), enduranceClassWord({ score: 6413 }), enduranceClassWord({ classId: 0 }, scale)], ["Well-Trained", undefined, undefined]);
		assert.deepEqual(ENDURANCE_CLASSES, ["Recreational", "Intermediate", "Trained", "Well-Trained", "Expert", "Superior", "Elite"]);
	});

	it("reads the scale from the day files: the newest on or before the day, else the newest at all; else the day's payload; else even sevenths", () => {
		const scale = { low: 3570, high: 10560, limits: [5100, 5800, 6600, 7300, 8100, 8800] };
		assert.deepEqual(enduranceScaleOf(DAYS, TODAY), scale);
		// A day before the day files began takes the newest scale.
		assert.deepEqual(enduranceScaleOf(DAYS, "2025-10-23"), scale);
		assert.equal(enduranceScaleOf([], TODAY), undefined);
		const fromBlock = day(0, "score", { today: TODAY, complete: true, day: { ...scale, phraseId: 55 } });
		assert.equal(fromBlock.gauge!.at, day(0).gauge!.at);
		// No scale at all: seven even bands, the marker in the middle of Garmin's class.
		const bare = day(0, "score", { today: TODAY, complete: true });
		assert.deepEqual(bare.gauge!.segments.map((s) => Number(s.from.toFixed(4))), [0, 1, 2, 3, 4, 5, 6].map((i) => Number((i / 7).toFixed(4))));
		assert.deepEqual([bare.gauge!.at, bare.gauge!.label, bare.classWord], [2.5 / 7, "Trained", "Trained"]);
	});

	it("a Miscellaneous of 0 (2026-09-12): the row reads 0%, the ring has no slice for it", () => {
		const v = day(-29, "contributors");
		assert.equal(v.date, "2026-09-12");
		assert.deepEqual(list(v.rows), ["Running 94.19%", "Gym & Fitness Equipment 5.81%", "  Stair Stepper 3.11%", "  Strength Training 2.7%", "Miscellaneous 0%"]);
		assert.deepEqual(v.ring.map((s) => s.category), ["running", "gym"]);
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Gym & Fitness Equipment", "Miscellaneous"]);
	});

	it("a hiking and swimming day (2025-09-07): Running, Hiking, Swimming, then Miscellaneous; the legend in the fixed order", () => {
		const v = day(-399, "contributors");
		assert.equal(v.date, "2025-09-07");
		assert.deepEqual(list(v.rows), ["Running 73.41%", "Hiking 14.76%", "Swimming 8.1%", "Miscellaneous 3.73%"]);
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Swimming", "Hiking", "Miscellaneous"]);
	});
});

describe("12w — Jul 20 - Oct 11, Endurance Score", () => {
	const v = period({ range: "12w", offset: 0 });

	it("plots each Monday week's floored mean at its Monday: Garmin's weekly groups", () => {
		assert.deepEqual([v.range, v.tab, v.label, v.span.from, v.span.to], ["12w", "score", "Jul 20 - Oct 11", "2026-07-20", TODAY]);
		assert.deepEqual(values(v), [6592, 6527, 6494, 6491, 6429, 6394, 6345, 6382, 6381, 6379, 6411, 6408]);
		// Floored, not rounded: 6,527.71 shows 6,527. The pixel reads sit 1.1–3.3 above (the reading's bias).
		const dots = [6594.9, 6528.1, 6497.1, 6492.3, 6430.4, 6397.0, 6346.9, 6385.0, 6382.7, 6380.3, 6413.7, 6411.3];
		values(v).forEach((value, i) => near(dots[i]! - value, 2.2, 1.2, `week ${i}`));
	});

	it("scales the axis by days from Jul 20 to Oct 12: x = 52.0 + 26.73k on the phone; Mondays on end", () => {
		v.line!.points.forEach((p, k) => near(52.0 + p.x * (372.67 - 52.0), 52.0 + 26.73 * k, 0.33, `week ${k}`));
		assert.equal(v.line!.points[11]!.x, 77 / 84);
		assert.equal(
			v.line!.axis.labels.map((l) => l.text).join(" "),
			"07-20 07-27 08-03 08-10 08-17 08-24 08-31 09-07 09-14 09-21 09-28 10-05",
		);
		assert.ok(v.line!.axis.labels.every((l) => l.rotated) && v.line!.axis.dots.every((d) => d.large));
		assert.deepEqual(v.line!.axis.dots.map((d) => d.x), v.line!.points.map((p) => p.x));
	});

	it("ticks 7,092 / 6,780 / 6,469 / 6,157 / 5,845: the lowest − 500 to the highest + 500, half up", () => {
		assert.deepEqual(v.line!.labels, ["7,092", "6,780", "6,469", "6,157", "5,845"]);
		assert.deepEqual(v.line!.ticks, [7092, 6780.25, 6468.5, 6156.75, 5845]);
	});

	it("figures Avg 6,436 (77,233 / 12) and Max 6,620 (Jul 20)", () => {
		assert.deepEqual(figures(v), ["6,436 Avg Score", "6,620 Max Score"]);
		assert.equal(byDate.get("2026-07-20")!.score, 6620);
	});

	it("the web's 12w table, newest first: Oct 5-11 6,408 … Aug 3-9 6,494", () => {
		assert.deepEqual(values(v).reverse().slice(0, 10).map((n) => n.toLocaleString("en-US")), ["6,408", "6,411", "6,379", "6,381", "6,382", "6,345", "6,394", "6,429", "6,491", "6,494"]);
		assert.deepEqual([v.canGoBack, v.canGoForward, v.empty], [true, false, undefined]);
	});
});

describe("12w — Top Contributors", () => {
	const v = period({ range: "12w", offset: 0, tab: "contributors" });

	it("ticks 7,100 / 5,325 / 3,550 / 1,775 / 0: round((6,592 + 500) / 100) × 100", () => {
		assert.equal(v.tab, "contributors");
		assert.deepEqual(v.bars!.labels, ["7,100", "5,325", "3,550", "1,775", "0"]);
		assert.deepEqual(v.bars!.ticks, [7100, 5325, 3550, 1775, 0]);
		// Both tabs show the same figures.
		assert.deepEqual(figures(v), ["6,436 Avg Score", "6,620 Max Score"]);
	});

	it("stacks each week's average from Miscellaneous up to Running, each its share of the average, centred on the Monday", () => {
		assert.equal(v.bars!.bars.length, 12);
		v.bars!.bars.forEach((bar, k) => {
			near(53.33 + bar.x * (371.33 - 53.33), 53.33 + 26.5 * k, 0.01, `bar ${k}`);
			assert.equal(bar.value, values(v)[k]);
			// The shares sum to 100, so the stack tops out at the average.
			near(bar.segments[bar.segments.length - 1]!.to, bar.value, 0.01, `bar ${k} top`);
		});
		const oct5 = v.bars!.bars[11]!;
		assert.deepEqual(oct5.segments.map((s) => s.category), ["misc", "gym", "running"]);
		// Oct 5-11: Miscellaneous 2.1414% and Gym 4.6443% of 6,408.
		near(oct5.segments[0]!.to, (14.99 / 7 / 100) * 6408, 1e-9, "Oct 5 misc");
		near(oct5.segments[1]!.to - oct5.segments[1]!.from, ((17.41 + 15.1) / 7 / 100) * 6408, 1e-9, "Oct 5 gym");
		// Jul 20-26 has Yoga and Stair Stepper under Gym, and a Misc near 0.
		assert.deepEqual(v.bars!.bars[0]!.segments.map((s) => s.category), ["misc", "gym", "running"]);
	});

	it("keys the bars Running, Gym & Fitness Equipment, Miscellaneous", () => {
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Gym & Fitness Equipment", "Miscellaneous"]);
	});

	it("lists the weeks newest first, each its mean daily shares: Oct 5 - 11, Sep 28 - Oct 4, Sep 21 - 27, Sep 14 - 20", () => {
		assert.equal(v.blocks.length, 12);
		assert.deepEqual(v.blocks.slice(0, 4).map((b) => b.title), ["Oct 5 - 11", "Sep 28 - Oct 4", "Sep 21 - 27", "Sep 14 - 20"]);
		assert.deepEqual(block(v, "Oct 5 - 11").slice(0, 4), ["Running 93.21%", "Gym & Fitness Equipment 4.64%", "  Stair Stepper 2.49%", "  Strength Training 2.16%"]);
		assert.deepEqual(block(v, "Sep 28 - Oct 4"), ["Running 93.3%", "Gym & Fitness Equipment 4.58%", "  Stair Stepper 2.45%", "  Strength Training 2.13%", "Miscellaneous 2.11%"]);
		assert.deepEqual(block(v, "Sep 21 - 27"), ["Running 92.54%", "Gym & Fitness Equipment 5.11%", "  Stair Stepper 2.74%", "  Strength Training 2.37%", "Miscellaneous 2.35%"]);
		assert.equal(block(v, "Sep 14 - 20")[0], "Running 92.47%");
		assert.equal(v.blocks[11]!.title, "Jul 20 - 26");
	});

	it("rounds a category's raw sum, not its rounded rows: Oct 5 - 11's Gym 2.4871 + 2.1571 = 4.6443 → 4.64%, not 4.65%", () => {
		const gym = v.blocks[0]!.rows.filter((r) => r.category === "gym");
		near(gym[0]!.share, 32.51 / 7, 1e-9, "Gym");
		assert.deepEqual(gym.map((r) => r.text), ["4.64%", "2.49%", "2.16%"]);
		assert.equal(Number((2.49 + 2.16).toFixed(2)), 4.65);
	});
});

describe("1y — Oct 13, 2025 - Oct 11, 2026", () => {
	const score = period({ range: "1y", offset: 0 });
	const v = period({ range: "1y", offset: 0, tab: "contributors" });

	it("averages each calendar month's days inside the span: Garmin's monthly groups, October 2025 from Oct 13", () => {
		assert.deepEqual([v.label, v.span.from, v.span.to], ["Oct 13, 2025 - Oct 11, 2026", "2025-10-13", TODAY]);
		assert.deepEqual(values(v), [8522, 8216, 7796, 7431, 7254, 7028, 7136, 7168, 6864, 6679, 6454, 6377, 6409]);
		assert.deepEqual(v.line!.points[0]!.date, "2025-10-01");
	});

	it("figures Avg 7,179, the floor of the months' 93,334 / 13, not the days' 7,177; Max 8,582 (2025-10-23), not the top point 8,522", () => {
		assert.deepEqual(figures(v), ["7,179 Avg Score", "8,582 Max Score"]);
		const days = ROWS.filter((r) => r.date >= "2025-10-13" && r.score !== undefined).map((r) => r.score!);
		assert.equal(Math.floor(days.reduce((a, b) => a + b, 0) / days.length), 7177);
	});

	it("ticks 9,000 / 6,750 / 4,500 / 2,250 / 0: 9,022 rounds down, which rules out ceil and the best day's 9,082", () => {
		assert.deepEqual(v.bars!.labels, ["9,000", "6,750", "4,500", "2,250", "0"]);
	});

	it("puts a bar a month at its 1st on an axis by days from Oct 1, 2025 to Oct 12, 2026 (0.8546 pt a day)", () => {
		const measured = [54.83, 81.5, 107.0, 133.5, 159.83, 183.83, 210.17, 235.83, 262.17, 287.83, 314.17, 340.83, 366.33];
		assert.equal(v.bars!.bars.length, 13);
		v.bars!.bars.forEach((bar, i) => near(54.33 + bar.x * (375.67 - 54.33), measured[i]!, 0.75, `month ${i}`));
		assert.equal(v.bars!.bars[12]!.x, 365 / 376);
		assert.equal(v.bars!.axis.labels.map((l) => l.text).join(" "), "Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
		assert.ok(v.bars!.axis.labels.every((l) => l.rotated));
	});

	it("stacks Oct–Dec 2025 grey, blue, green, orange; Jan and Feb grey, dark orange, blue, orange; Mar and Apr grey, dark orange, red, orange; May grey, red, dark orange, orange", () => {
		const stacks = v.bars!.bars.slice(0, 8).map((b) => b.segments.map((s) => s.category).join(" "));
		assert.deepEqual(stacks, [
			"misc swimming cycling running",
			"misc swimming cycling running",
			"misc swimming cycling running",
			"misc gym swimming running",
			"misc gym swimming running",
			"misc gym hiking running",
			"misc gym hiking running",
			"misc hiking gym running",
		]);
		// March folds Swimming's 1.12% into Miscellaneous: 6.48% × 7,028 = 455 (the shot reads 444; 5.36% alone would be 377).
		const march = v.bars!.bars[5]!;
		near(march.segments[0]!.to, 455, 1, "March misc");
	});

	it("keys the bars in the fixed order, not by first appearance: Running, Cycling, Gym & Fitness Equipment, Swimming, Hiking, Miscellaneous", () => {
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Cycling", "Gym & Fitness Equipment", "Swimming", "Hiking", "Miscellaneous"]);
	});

	it("lists the months newest first: the bare name this year, the name and year before it", () => {
		assert.equal(v.blocks.length, 13);
		assert.deepEqual(
			v.blocks.map((b) => b.title),
			["October", "September", "August", "July", "June", "May", "April", "March", "February", "January", "December 2025", "November 2025", "October 2025"],
		);
		assert.deepEqual(block(v, "October").slice(0, 3), ["Running 93.27%", "Gym & Fitness Equipment 4.61%", "  Stair Stepper 2.47%"]);
		assert.deepEqual(block(v, "February"), ["Running 69.77%", "Swimming 18.89%", "Gym & Fitness Equipment 7.03%", "  Strength Training 6.65%", "  Yoga 0.38%", "Miscellaneous 4.3%"]);
		assert.deepEqual(block(v, "December 2025").slice(1), ["Cycling 18.87%", "Swimming 14.25%", "Miscellaneous 3.89%"]);
		assert.deepEqual(block(v, "November 2025"), ["Running 61.42%", "Cycling 29.85%", "Swimming 7.7%", "Miscellaneous 1.02%"]);
		assert.deepEqual(block(v, "October 2025"), ["Running 60.58%", "Cycling 25.89%", "Swimming 8.16%", "Miscellaneous 5.36%"]);
	});

	it("keeps three categories: January folds Cycling's 0.39% into Miscellaneous (4.88%), which still comes after Gym's 4.4%", () => {
		assert.deepEqual(block(v, "January"), ["Running 68.66%", "Swimming 22.05%", "Gym & Fitness Equipment 4.4%", "  Yoga 4.4%", "Miscellaneous 4.88%"]);
		// Yoga stays under Gym in February because the category is kept, at 0.38%.
		assert.ok(block(v, "February").includes("  Yoga 0.38%"));
	});

	it("the Endurance Score tab (Inferred): the 13 monthly points, ticks 9,022 / 8,236 / 7,450 / 6,663 / 5,877, Avg 7,179, Max 8,582", () => {
		assert.deepEqual(values(score), values(v));
		assert.deepEqual(score.line!.labels, ["9,022", "8,236", "7,450", "6,663", "5,877"]);
		assert.deepEqual(figures(score), ["7,179 Avg Score", "8,582 Max Score"]);
		assert.equal(score.line!.axis.labels.map((l) => l.text).join(" "), "Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
	});
});

describe("previous periods (Inferred on the phone; the web's 12w-prev)", () => {
	it("12w −1, Apr 27 - Jul 19: Avg 6,964, not the days' 6,965; Max 7,261; the newest weeks 6,687 6,768 6,799 6,738 6,808", () => {
		const v = period({ range: "12w", offset: -1 });
		assert.deepEqual([v.label, v.canGoForward], ["Apr 27 - Jul 19", true]);
		assert.deepEqual(values(v), [7189, 7251, 7187, 7125, 7083, 7060, 6884, 6808, 6738, 6799, 6768, 6687]);
		assert.deepEqual(figures(v), ["6,964 Avg Score", "7,261 Max Score"]);
		assert.deepEqual(values(v).reverse().slice(0, 5), [6687, 6768, 6799, 6738, 6808]);
		assert.deepEqual(v.line!.labels, ["7,751", "7,360", "6,969", "6,578", "6,187"]);
		assert.deepEqual(v.bars!.labels, ["7,800", "5,850", "3,900", "1,950", "0"]);
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Gym & Fitness Equipment", "Hiking", "Miscellaneous"]);
		// The Gym category with one child: the phone names the category, as its 1y list does.
		assert.deepEqual(block(v, "Jul 13 - 19"), ["Running 93.35%", "Gym & Fitness Equipment 4.82%", "  Stair Stepper 4.82%", "Miscellaneous 1.83%"]);
		assert.deepEqual(block(v, "Apr 27 - May 3"), ["Running 84.46%", "Hiking 6.94%", "Gym & Fitness Equipment 4.32%", "  Stair Stepper 4.32%", "Miscellaneous 4.28%"]);
	});

	it("1y −1, Oct 14, 2024 - Oct 12, 2025: three months with data (Aug 7,273, Sep 8,131, Oct 1–12 8,424); Avg 7,942, Max 8,476", () => {
		const v = period({ range: "1y", offset: -1, tab: "contributors" });
		assert.equal(v.label, "Oct 14, 2024 - Oct 12, 2025");
		assert.deepEqual(v.line!.points.map((p) => [p.date, p.value]), [["2025-08-01", 7273], ["2025-09-01", 8131], ["2025-10-01", 8424]]);
		assert.deepEqual(figures(v), ["7,942 Avg Score", "8,476 Max Score"]);
		assert.deepEqual(v.line!.labels, ["8,924", "8,386", "7,849", "7,311", "6,773"]);
		assert.deepEqual(v.bars!.labels, ["8,900", "6,675", "4,450", "2,225", "0"]);
		// Every month keeps its dot and label, the nine empty ones too (Inferred).
		assert.equal(v.bars!.axis.dots.length, 13);
		assert.equal(v.bars!.bars.length, 3);
		assert.deepEqual(v.legend.map((l) => l.title), ["Running", "Cycling", "Swimming", "Hiking", "Miscellaneous"]);
		assert.deepEqual(v.blocks.map((b) => b.title), ["October 2025", "September 2025", "August 2025"]);
		assert.deepEqual(block(v, "October 2025"), ["Running 64.74%", "Cycling 19.92%", "Swimming 4.19%", "Miscellaneous 11.16%"]);
		assert.deepEqual(block(v, "September 2025"), ["Running 69.27%", "Hiking 11.77%", "Cycling 8.66%", "Miscellaneous 10.29%"]);
		// August's calibrating days count as Miscellaneous 100%: 46.67%.
		assert.deepEqual(block(v, "August 2025"), ["Running 38.38%", "Hiking 10.9%", "Swimming 4.05%", "Miscellaneous 46.67%"]);
		// The history starts inside it: "<" stops once the index is complete.
		assert.deepEqual([v.canGoBack, period({ range: "1y", offset: -1 }, { ...CTX, complete: false }).canGoBack], [false, true]);
	});

	it("1d −1 is Saturday, October 10, and '<' steps a day back", () => {
		assert.equal(day(-1).label, "Saturday, October 10");
		assert.equal(day(-1).canGoBack, true);
	});
});

describe("Garmin's own groups, rebuilt from the days", () => {
	const byDay = new Map(ROWS.map((r) => [r.date, r]));
	const averages = (from: string, to: string, unit: "week" | "month") => endurancePeriods({ from, to }, byDay, unit).map((p) => p.average ?? null);

	it("weekly, 401 days from Saturday 2025-09-06: 58 weeks, the first keyed 2025-09-01 and counting Sep 6–7; avg 7,285, max 8,582", () => {
		const periods = endurancePeriods({ from: "2025-09-06", to: TODAY }, byDay, "week");
		assert.equal(periods.length, 58);
		assert.deepEqual([periods[0]!.key, periods[57]!.key], ["2025-09-01", "2026-10-05"]);
		assert.equal(periods[0]!.average, Math.floor((7800 + 7791) / 2));
		assert.deepEqual(figures({ figures: enduranceFigures(periods) }), ["7,285 Avg Score", "8,582 Max Score"]);
	});

	it("monthly, the same 401 days: 14 months; avg 7,250, max 8,582", () => {
		const periods = endurancePeriods({ from: "2025-09-06", to: TODAY }, byDay, "month");
		assert.equal(periods.length, 14);
		assert.deepEqual(figures({ figures: enduranceFigures(periods) }), ["7,250 Avg Score", "8,582 Max Score"]);
	});

	it("the 12w's week of Oct 5: each entry's mean over the days with a list, as `stats-weekly` sends it", () => {
		const oct5 = endurancePeriods({ from: "2026-07-20", to: TODAY }, byDay, "week")[11]!;
		assert.deepEqual([oct5.key, oct5.average, oct5.max], ["2026-10-05", 6408, 6416]);
		const sent: Record<string, number> = { t31: 2.4871428, g0: 93.21429, t13: 2.1571429, g8: 2.1414285 };
		for (const [key, share] of Object.entries(sent)) near(oct5.shares.get(key)!, share, 1e-4, key);
	});

	it("a calibrating day counts in its month: August 2025's Miscellaneous 46.6673%, 14 days of it at 100", () => {
		const august = endurancePeriods({ from: "2025-08-01", to: "2025-08-31" }, byDay, "month")[0]!;
		near(august.shares.get("g8")!, 46.6673, 1e-4, "August misc");
		assert.equal(august.average, 7273);
	});

	it("a partial month counts its days inside the window only: November 2025 from Nov 2 is 8,208, the whole month 8,216", () => {
		assert.deepEqual(averages("2025-11-02", "2025-11-30", "month"), [8208]);
		assert.deepEqual(averages("2025-11-01", "2025-11-30", "month"), [8216]);
	});

	it("the web's 1y, Nov 2, 2025 - Oct 31, 2026: Avg 7,067, Max 8,464, Oct 6,409 … Jan 7,431", () => {
		const periods = endurancePeriods({ from: "2025-11-02", to: "2026-10-31" }, byDay, "month");
		assert.deepEqual(figures({ figures: enduranceFigures(periods) }), ["7,067 Avg Score", "8,464 Max Score"]);
		assert.deepEqual(periods.map((p) => p.average).reverse().slice(0, 10), [6409, 6377, 6454, 6679, 6864, 7168, 7136, 7028, 7254, 7431]);
	});

	it("the web's 1y-prev, Nov 2, 2024 - Oct 31, 2025: Avg 7,962 (23,888 / 3), Max 8,582; Oct 8,484, Sep 8,131, Aug 7,273, Jul --, Jun --", () => {
		const periods = endurancePeriods({ from: "2024-11-02", to: "2025-10-31" }, byDay, "month");
		assert.deepEqual(figures({ figures: enduranceFigures(periods) }), ["7,962 Avg Score", "8,582 Max Score"]);
		assert.deepEqual(periods.map((p) => p.average ?? DASH).reverse().slice(0, 5), [8484, 8131, 7273, DASH, DASH]);
		assert.equal(periods.filter((p) => p.average === undefined).length, 9);
	});

	it("legends: the top three categories of every period with a list, unioned, Miscellaneous always", () => {
		const legend = (from: string, to: string, unit: "week" | "month") =>
			new Set(
				endurancePeriods({ from, to }, byDay, unit)
					.map((p) => contributorsOf(p.shares))
					.filter((c) => c.rows.length)
					.flatMap((c) => [...c.kept.map((k) => k.title), "Miscellaneous"]),
			);
		assert.deepEqual(legend("2026-07-20", TODAY, "week"), new Set(["Running", "Gym & Fitness Equipment", "Miscellaneous"]));
		// The web names the lone Gym child (Stair Stepper) here; the phone names the category.
		assert.deepEqual(legend("2026-04-27", "2026-07-19", "week"), new Set(["Running", "Hiking", "Gym & Fitness Equipment", "Miscellaneous"]));
		assert.deepEqual(legend("2025-11-02", "2026-10-31", "month"), new Set(["Running", "Cycling", "Swimming", "Gym & Fitness Equipment", "Hiking", "Miscellaneous"]));
		assert.deepEqual(legend("2024-11-02", "2025-10-31", "month"), new Set(["Running", "Hiking", "Swimming", "Cycling", "Miscellaneous"]));
	});
});

describe("contributors, words and axes", () => {
	it("writes a share half up to two decimals, trailing zeros dropped, no space before %", () => {
		assert.deepEqual(
			[93.3, 7.7, 4.4, 2.4871, 92.5386, 0, 100, 0.005, 2.375, 46.6673].map(percentText),
			["93.3%", "7.7%", "4.4%", "2.49%", "92.54%", "0%", "100%", "0.01%", "2.38%", "46.67%"],
		);
	});

	it("names Garmin's groups and the types seen; files an unseen type by the activity index (Inferred), else as Miscellaneous", () => {
		assert.deepEqual(
			[placeOf("g", 0), placeOf("g", 1), placeOf("g", 6), placeOf("g", 8), placeOf("g", 5)].map((p) => `${p.category} ${p.title}`),
			["running Running", "cycling Cycling", "swimming Swimming", "misc Miscellaneous", "misc Miscellaneous"],
		);
		assert.deepEqual(
			[3, 13, 31, 163].map((id) => placeOf("t", id)),
			[
				{ category: "hiking", title: "Hiking" },
				{ category: "gym", title: "Gym & Fitness Equipment", sub: "Strength Training" },
				{ category: "gym", title: "Gym & Fitness Equipment", sub: "Stair Stepper" },
				{ category: "gym", title: "Gym & Fitness Equipment", sub: "Yoga" },
			],
		);
		const types = enduranceTypesOf([
			{ type: "indoor_rowing", typeId: 15, parentTypeId: 29 },
			{ type: "walking", typeId: 9, parentTypeId: 17 },
			{ type: "treadmill_running", typeId: 18, parentTypeId: 1 },
			{ type: "tennis", typeId: 230, parentTypeId: 219 },
			{ type: "running", parentTypeId: 17 },
		]);
		assert.deepEqual(placeOf("t", 15, types), { category: "gym", title: "Gym & Fitness Equipment", sub: "Indoor Rowing" });
		assert.deepEqual(placeOf("t", 9, types), { category: "type-9", title: "Walking" });
		assert.deepEqual(placeOf("t", 18, types), { category: "running", title: "Running" });
		assert.deepEqual([placeOf("t", 230, types).category, placeOf("t", 999, types).category, placeOf("t", 15).category], ["misc", "misc", "misc"]);
	});

	it("keeps three categories by share, folds the rest, puts Miscellaneous last, and orders the legend Running … Hiking, other types, Miscellaneous", () => {
		const types = enduranceTypesOf([{ type: "walking", typeId: 9, parentTypeId: 17 }]);
		const c = contributorsOf(sharesOf(["g0:50 t9:20 t3:15 g1:10 g8:5"]), types);
		assert.deepEqual(list(c.rows), ["Running 50%", "Walking 20%", "Hiking 15%", "Miscellaneous 15%"]);
		assert.deepEqual(c.kept.map((k) => k.category), ["running", "type-9", "hiking"]);
		const view = enduranceScoreView({ range: "1d", offset: 0, tab: "contributors" }, [{ date: TODAY, score: 6413, contrib: "g0:50 t9:20 t3:15 g1:10 g8:5" }], { ...CTX, activities: [{ type: "walking", typeId: 9, parentTypeId: 17 }] }) as EnduranceDayView;
		assert.deepEqual(view.legend.map((l) => l.category), ["running", "hiking", "type-9", "misc"]);
		// A tie between categories goes to the legend's order.
		assert.deepEqual(contributorsOf(sharesOf(["g6:30 g1:30 g0:30 g8:10"])).kept.map((k) => k.category), ["running", "cycling", "swimming"]);
	});

	it("averages shares over the days with a list: a day without one is no day; a day without the entry counts 0", () => {
		const shares = sharesOf(["g0:90 t31:10", undefined, "g0:100", ""]);
		assert.deepEqual([...shares], [["g0", 95], ["t31", 5]]);
		assert.deepEqual([...sharesOf([undefined])], []);
		assert.deepEqual(contributorsOf(new Map()), { kept: [], misc: 0, rows: [] });
	});

	it("ticks five even steps on both tabs; a single point still spans 1,000", () => {
		assert.deepEqual(scoreTicks([6413]), { ticks: [6913, 6663, 6413, 6163, 5913], labels: ["6,913", "6,663", "6,413", "6,163", "5,913"] });
		assert.deepEqual(contributorTicks([6413]).labels, ["6,900", "5,175", "3,450", "1,725", "0"]);
		// A tie at the hundred rounds up (Inferred).
		assert.equal(contributorTicks([6550]).ticks[0], 7100);
	});

	it("names the tabs as the phone does, and opens on the first", () => {
		assert.deepEqual(ENDURANCE_TABS.map((t) => `${t.id} ${t.label}`), ["score Endurance Score", "contributors Top Contributors"]);
		assert.deepEqual([enduranceTab("contributors"), enduranceTab("score"), enduranceTab(undefined), enduranceTab("other")], ["contributors", "score", "score", "score"]);
	});

	it("words the Help as the web does: the newest score, its class and who the scale is for, then the class table from the account's limits", () => {
		const help = enduranceHelp(ROWS, { today: TODAY, days: DAYS, age: 23, sex: "male" });
		assert.equal(help.title, "Endurance Score");
		assert.equal(help.heading, "Your endurance score is 6,413, which is trained for men ages 20-29.");
		assert.deepEqual(help.classes.map((c) => `${c.name} ${c.range}`), [
			"Elite 8,800 and above",
			"Superior 8,100 - 8,799",
			"Expert 7,300 - 8,099",
			"Well-Trained 6,600 - 7,299",
			"Trained 5,800 - 6,599",
			"Intermediate 5,100 - 5,799",
			"Recreational 1 - 5,099",
		]);
		// Before the watch syncs, the newest score is yesterday's; without an age and a sex, no "for …".
		assert.equal(enduranceHelp(ROWS, { today: "2026-10-12", days: DAYS }).heading, "Your endurance score is 6,413, which is trained.");
		assert.equal(enduranceHelp(ROWS, { today: "2026-07-20", days: DAYS, age: 31, sex: "female" }).heading, "Your endurance score is 6,620, which is well-trained for women ages 30-39.");
		const bare = enduranceHelp([], { today: TODAY });
		assert.deepEqual([bare.heading, bare.classes, bare.sections.length], [undefined, [], 5]);
	});

	it("knows phrase 55's copy alone, and the Help's sections", () => {
		assert.deepEqual(Object.keys(ENDURANCE_PHRASES).map(Number), [55]);
		assert.deepEqual([endurancePhrase(55), endurancePhrase(63), endurancePhrase(undefined)], [COPY_55, undefined, undefined]);
		assert.ok(HELP_CLASSES_INTRO.endsWith("one of the following categories:"));
		assert.deepEqual(ENDURANCE_HELP.map((s) => s.heading ?? ""), ["", "Receiving an endurance score", "Calculating your endurance score", "Endurance score contributors", "About your endurance score"]);
		assert.equal(ENDURANCE_HELP[2]!.list!.length, 4);
	});
});

describe("empty and edge states", () => {
	it("today before the watch syncs (05:33 on Oct 12): no row; the no-data line on both tabs and '<'", () => {
		const ctx = { ...CTX, today: "2026-10-12" };
		for (const tab of ["score", "contributors"]) {
			const v = day(0, tab, ctx);
			assert.deepEqual([v.label, v.state, v.gauge, v.value, v.ring, v.rows, v.legend, v.empty, v.canGoBack, v.canGoForward, v.wantsDay], ["Today", "none", null, undefined, [], [], [], NO_READING, true, false, false]);
		}
	});

	it("12w and 1y on that Monday: rolling spans, the current week and month their scored days so far", () => {
		const ctx = { ...CTX, today: "2026-10-12" };
		const twelve = period({ range: "12w", offset: 0 }, ctx);
		assert.equal(twelve.label, "Jul 21 - Oct 12");
		// Jul 20's week counts Jul 21–26; Oct 12's week has a dot and no point yet.
		assert.equal(twelve.line!.axis.dots.length, 13);
		assert.deepEqual([twelve.line!.points[0]!.date, twelve.line!.points.length], ["2026-07-20", 12]);
		assert.equal(twelve.line!.points[0]!.value, Math.floor((6609 + 6598 + 6590 + 6585 + 6576 + 6566) / 6));
		assert.equal(twelve.blocks[0]!.title, "Oct 5 - 11");
		const year = period({ range: "1y", offset: 0 }, ctx);
		assert.equal(year.label, "Oct 14, 2025 - Oct 12, 2026");
		assert.equal(values(year)[12], 6409);
	});

	it("a calibrating day (2025-08-10): the bands without a number or marker, no class; the ring Miscellaneous 100% without a number", () => {
		const v = day(-427);
		assert.equal(v.date, "2025-08-10");
		assert.deepEqual([v.state, v.gauge!.value, v.gauge!.at, v.gauge!.label, v.value, v.classWord, v.copy], ["calibrating", DASH, undefined, undefined, undefined, undefined, undefined]);
		assert.equal(dialGeometry("endurance", v.gauge).marker, undefined);
		assert.equal(v.gauge!.segments.length, 7);
		const c = day(-427, "contributors");
		assert.deepEqual(list(c.rows), ["Miscellaneous 100%"]);
		assert.deepEqual(c.ring, [{ category: "misc", from: RING_GAP / 2, to: 360 - RING_GAP / 2 }]);
		assert.deepEqual(c.legend.map((l) => l.title), ["Miscellaneous"]);
		// As the day sync writes it: class 0 and phrase 2, whose copy is not captured.
		const synced = enduranceScoreView({ range: "1d", offset: -427 }, [{ date: "2025-08-10", classId: 0, phraseId: 2, contrib: "g8:100" }], CTX) as EnduranceDayView;
		assert.deepEqual([synced.state, synced.classWord, synced.copy, synced.wantsDay], ["calibrating", undefined, undefined, false]);
	});

	it("a calibrating week has a list block and no point or bar (Inferred)", () => {
		const v = period({ range: "12w", offset: 0, tab: "contributors" }, { ...CTX, today: "2025-08-10" });
		assert.deepEqual([v.line, v.bars, v.empty, figures(v)], [null, null, NO_DATA, [`${DASH} Avg Score`, `${DASH} Max Score`]]);
		assert.deepEqual(v.blocks.map((b) => [b.title, list(b.rows).join(" · ")]), [
			["Aug 4 - 10", "Miscellaneous 100%"],
			["Jul 28 - Aug 3", "Miscellaneous 100%"],
		]);
		assert.deepEqual(v.legend.map((l) => l.title), ["Miscellaneous"]);
	});

	it("a day before the history: no row; '<' stops there once the index is complete", () => {
		const v = day(-436);
		assert.deepEqual([v.date, v.state, v.empty, v.canGoBack], ["2025-08-01", "none", NO_READING, false]);
		assert.equal(day(-435).canGoBack, false);
		assert.equal(day(-434).canGoBack, true);
	});

	it("no endurance score ever: every view shows its no-data line, '<' only while the index may still be coming", () => {
		assert.deepEqual([day(0, "score", CTX, []).empty, day(0, "score", CTX, []).canGoBack], [NO_READING, false]);
		for (const range of ["12w", "1y"] as const) {
			const v = period({ range, offset: 0 }, CTX, []);
			assert.deepEqual([v.line, v.bars, v.empty, v.blocks, v.legend, figures(v), v.canGoBack], [null, null, NO_DATA, [], [], [`${DASH} Avg Score`, `${DASH} Max Score`], false], range);
		}
		assert.equal(period({ range: "12w", offset: 0 }, { ...CTX, complete: false }, []).canGoBack, true);
	});

	it("a route on a range the page does not have reads as 12w", () => {
		assert.equal(period({ range: "4w", offset: 0 }).range, "12w");
	});

	it("the dial for a score off the scale pins its marker to the end", () => {
		const scale = enduranceScaleOf(DAYS, TODAY);
		assert.deepEqual([enduranceDialGauge(2000, scale).at, enduranceDialGauge(12000, scale).at], [0, 1]);
		assert.deepEqual([enduranceDialGauge(12000, scale).label, enduranceDialGauge(12000, scale).value], ["Elite", "12,000"]);
	});
});
