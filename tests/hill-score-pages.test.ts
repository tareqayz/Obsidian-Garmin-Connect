import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FACTOR_COPY, HILL_PHRASES } from "../src/dashboard/hill-score-copy";
import {
	DASH,
	HILL_TICKS,
	dayCardOpens,
	factorGauge,
	factorWord,
	hillClassOf,
	hillDialGauge,
	hillScoreView,
	hillVo2Reading,
	monthOfSub,
	monthPoints,
	monthSub,
	stepMonthSub,
	vo2Factor,
	weekPoints,
	type HillDayView,
	type HillPeriodView,
	type HillScoreContext,
	type HillScoreRoute,
} from "../src/dashboard/hill-score-pages";
import { shiftMonth } from "../src/dashboard/periods";
import { performanceStatRoute } from "../src/dashboard/routes";
import { dialAngle, dialGeometry } from "../src/dashboard/stat-dial";
import { NO_DATA, NO_READING } from "../src/dashboard/vo2-max-pages";
import type { HillScoreRow } from "../src/sync/hill-score-index";
import type { Vo2MaxRow } from "../src/sync/vo2-max-index";

/**
 * Golden numbers from ref/performance-stats/hill-score/README.md: the phone
 * shots of Sunday 2026-10-11 21:28–21:29, the web report of 23:04, and the
 * whole history as `hillscore/stats` sent it at 00:04–00:17 on Oct 12
 * (api-samples/: 436 days, every one with a row, none differing between
 * fetches). The 4w and 12w windows roll daily, so they only reproduce with
 * today pinned.
 */
const TODAY = "2026-10-11";

/**
 * Daily `score`, run-length from each line's first day (– = calibrating, no
 * score): the spec's fixture, every day present from 2025-08-02 to today.
 */
const SCORES: ReadonlyArray<readonly [string, string]> = [
	["2025-08-02", "–×14 47×2 60 65 70 72×2 74 72×2 73×2 75×4"],
	["2025-09-01", "76×3 75 74×3 73×4 72×4 71 70 71×2 69 72×5 71 72 71 70×2"],
	["2025-10-01", "70×2 69×5 68×4 66×5 65×4 64×4 63×3 62×3 61"],
	["2025-11-01", "61×3 60×9 58×3 57×3 56×8 55×2 54×2"],
	["2025-12-01", "54×3 53×4 52×3 51×5 50×2 49×3 48×3 47×2 46×4 45×2"],
	["2026-01-01", "44×2 43×6 42×2 41×4 39×10 38 37×6"],
	["2026-02-01", "37×7 36×2 37 36×2 35 34×5 33×5 32×5"],
	["2026-03-01", "32×3 33 32×16 31×3 32×2 31×6"],
	["2026-04-01", "31×21 32×3 33×4 32×2"],
	["2026-05-01", "33 34×15 33×11 34×2 32×2"],
	["2026-06-01", "32×7 31×5 30×4 29 30×9 29×4"],
	["2026-07-01", "29×2 31×4 30×17 29×6 28×2"],
	["2026-08-01", "28×5 29 28×14 27×2 26×9"],
	["2026-09-01", "27×3 26×2 28×4 29×21"],
	["2026-10-01", "29×11"],
];

/** Days with every field, `date score/strength/endurance/classId/phraseId`: the last 28, and the days the phone to-do names. */
const DETAIL = [
	"2025-08-16 47/52/31/2/4 · 2025-09-04 75/70/75/4/20 · 2025-12-17 50/46/30/3/12",
	"2026-09-14 29/11/7/2/43 · 2026-09-15 29/11/7/2/43 · 2026-09-16 29/11/7/2/43 · 2026-09-17 29/11/7/2/43 · 2026-09-18 29/11/7/2/43 · 2026-09-19 29/11/7/2/44 · 2026-09-20 29/11/7/2/4",
	"2026-09-21 29/10/7/2/42 · 2026-09-22 29/11/7/2/43 · 2026-09-23 29/11/7/2/44 · 2026-09-24 29/11/7/2/4 · 2026-09-25 29/11/7/2/42 · 2026-09-26 29/11/7/2/43 · 2026-09-27 29/12/7/2/44",
	"2026-09-28 29/14/7/2/4 · 2026-09-29 29/14/7/2/42 · 2026-09-30 29/14/7/2/43 · 2026-10-01 29/14/7/2/44 · 2026-10-02 29/14/7/2/4 · 2026-10-03 29/14/7/2/42 · 2026-10-04 29/14/7/2/43",
	"2026-10-05 29/14/7/2/44 · 2026-10-06 29/14/7/2/4 · 2026-10-07 29/14/7/2/42 · 2026-10-08 29/14/7/2/43 · 2026-10-09 29/14/6/2/44 · 2026-10-10 29/14/6/2/4 · 2026-10-11 29/14/7/2/42",
];

const next = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

function historyRows(): HillScoreRow[] {
	const rows = new Map<string, HillScoreRow>();
	for (const [start, runs] of SCORES) {
		let date = start;
		for (const run of runs.split(" ")) {
			const [value, times] = run.split("×");
			for (let k = 0; k < Number(times ?? 1); k++) {
				// Garmin's class agrees with the help table's limits on all 422 scored days.
				const score = Number(value);
				rows.set(date, value === "–" ? { date, classId: 0, phraseId: 1 } : { date, score, classId: 1 + [25, 50, 70, 85, 95].filter((l) => score >= l).length });
				date = next(date);
			}
		}
	}
	for (const line of DETAIL) {
		for (const item of line.split(" · ")) {
			const [date, fields] = item.split(" ");
			const [score, strength, endurance, classId, phraseId] = fields!.split("/").map(Number);
			rows.set(date!, { date: date!, score, strength, endurance, classId, phraseId });
		}
	}
	return [...rows.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

const ROWS = historyRows();

/** The vo2-max index's running readings around the days below, `day=precise`, with Garmin's integer after a slash where it is not the rounded value. */
const VO2: Vo2MaxRow[] = "2025-08-03=52.9 2025-08-08=54.6 2025-08-11=54.1 2025-09-03=55.7 2025-12-13=57.7 2026-09-12=55.5/55 2026-09-28=54.8 2026-10-03=54.9 2026-10-10=54.8 2026-10-11=54.9"
	.split(" ")
	.map((item) => {
		const [date, value] = item.split("=");
		const [vo2, shown] = value!.split("/").map(Number);
		return { date: date!, vo2: vo2!, vo2Value: shown ?? Math.round(vo2!) };
	});

/** A man of 23, as the VO₂ Max page grades him. */
const CTX: HillScoreContext = { today: TODAY, complete: true, vo2: VO2, age: 23, sex: "male" };

const day = (offset: number, ctx: HillScoreContext = CTX, rows: readonly HillScoreRow[] = ROWS) => hillScoreView({ range: "1d", offset }, rows, ctx) as HillDayView;
const period = (route: HillScoreRoute, ctx: HillScoreContext = CTX, rows: readonly HillScoreRow[] = ROWS) => hillScoreView(route, rows, ctx) as HillPeriodView;
const values = (v: HillPeriodView) => v.chart?.points.map((p) => p.value) ?? [];
const figures = (v: HillPeriodView) => v.figures.map((f) => `${f.value} ${f.label}`);
const near = (a: number, b: number, within: number, what: string) => assert.ok(Math.abs(a - b) <= within, `${what}: ${a}, the shot's ${b}`);

describe("the fixture", () => {
	it("is the history the samples hold: 436 days from 2025-08-02, the first 14 calibrating, the first score 47 on Aug 16", () => {
		assert.equal(ROWS.length, 436);
		assert.deepEqual([ROWS[0]!.date, ROWS[ROWS.length - 1]!.date], ["2025-08-02", TODAY]);
		assert.equal(ROWS.filter((r) => r.score === undefined).length, 14);
		assert.deepEqual(ROWS.find((r) => r.score !== undefined), { date: "2025-08-16", score: 47, strength: 52, endurance: 31, classId: 2, phraseId: 4 });
	});
});

describe("1d — Today, 2026-10-11", () => {
	const v = day(0);

	it("shows 29 over 100, Challenger and phrase 42's copy", () => {
		assert.deepEqual([v.label, v.state, v.date], ["Today", "scored", TODAY]);
		assert.deepEqual([v.gauge!.value, v.gauge!.label, v.gauge!.tone], ["29", "100", "orange"]);
		assert.equal(v.classWord, "Challenger");
		assert.equal(v.copy, "For very hilly areas, it’s okay to alternate between running and hiking when needed.");
		assert.deepEqual([v.canGoBack, v.canGoForward, v.empty], [true, false, undefined]);
	});

	it("puts the marker at 29/100 on the linear dial: −63.0°, measured −62.97°", () => {
		assert.equal(v.gauge!.at, 0.29);
		near(dialAngle(v.gauge!.at!), -62.97, 0.05, "marker");
		const g = dialGeometry("hill", v.gauge);
		near(g.marker!.angle, -62.97, 0.05, "drawn marker");
		assert.equal(g.marker!.tone, "orange");
	});

	it("draws six bands with the gaps centred where the shot has them, not at the class limits", () => {
		const g = dialGeometry("hill", v.gauge);
		const gaps = g.bands.slice(1).map((b, i) => (g.bands[i]!.to + b.from) / 2);
		assert.deepEqual(gaps.map((a) => Number(a.toFixed(2))), [-72, 4.55, 64.5, 108, 135]);
		assert.deepEqual(g.bands.map((b) => b.tone), ["red", "orange", "green", "blue", "purple", "pink"]);
		// On the score scale: 26, 51.5, 71.5, 86 and 95, where the help table says 25, 50, 70, 85, 95.
		assert.deepEqual(v.gauge!.segments.slice(1).map((s) => Number((s.from * 100).toFixed(2))), [26, 51.52, 71.5, 86, 95]);
	});

	it("lists the FACTORS: Hill Endurance 7 Low, Hill Strength 14 Low, VO₂ Max 55 Excellent", () => {
		assert.deepEqual(
			v.factors.map((f) => [f.key, f.title, f.detail, f.rating]),
			[
				["endurance", "Hill Endurance", "7", "Low"],
				["strength", "Hill Strength", "14", "Low"],
				["vo2", "VO₂ Max", "55", "Excellent"],
			],
		);
	});

	it("opens each factor's half sheet: the three-band dial, its word and copy", () => {
		const [endurance, strength, vo2] = v.factors.map((f) => f.sheet!);
		assert.deepEqual([endurance!.title, endurance!.gauge.value, endurance!.gauge.label, endurance!.gauge.tone], ["Hill Endurance", "7", "Low", "orange"]);
		assert.equal(endurance!.copy, "Your training is lacking in hill-specific training at this stage. Try adding more hills at low intensity.");
		assert.deepEqual([strength!.title, strength!.gauge.value, strength!.gauge.label, strength!.gauge.tone], ["Hill Strength", "14", "Low", "orange"]);
		assert.equal(strength!.copy, "Your training could use more intensity on the hilly stretches of your runs to improve hill strength.");
		// Markers at value / 100: −129.0° and −108.0°, measured −128.9° and −108.06°.
		near(dialAngle(endurance!.gauge.at!), -128.9, 0.15, "endurance marker");
		near(dialAngle(strength!.gauge.at!), -108.06, 0.1, "strength marker");
		// Bands split at 30 and 70: −60° and 60°.
		assert.deepEqual(dialGeometry("hill", endurance!.gauge).bands.map((b) => [b.tone, Number(b.from.toFixed(2)), Number(b.to.toFixed(2))]), [
			["orange", -150, -60.95],
			["yellow", -59.05, 59.05],
			["green", 60.95, 150],
		]);
		assert.deepEqual([vo2!.title, vo2!.gauge.value, vo2!.gauge.label, vo2!.gauge.tone], ["VO₂ Max", "55", "Excellent", "blue"]);
		assert.equal(vo2!.copy, "Your VO₂ Max is in the top 10% for your age and gender.");
	});

	it("draws the VO₂ sheet with the VO₂ Max page's dial: its bands, and its marker 3.2° short of the shot's 102.98°", () => {
		const vo2 = v.factors[2]!.sheet!.gauge;
		const g = dialGeometry("hill", vo2);
		// No separators on the hill ring: the gaps show the sheet.
		assert.equal(g.separators, undefined);
		const gaps = g.bands.slice(1).map((b, i) => (g.bands[i]!.to + b.from) / 2);
		assert.deepEqual(gaps.map((a) => Number(a.toFixed(2))), [-30, 15, 60, 105]);
		// The VO₂ page's in-band placement, Inferred there too: 99.77° for 54.9.
		near(g.marker!.angle, 99.77, 0.01, "VO₂ marker");
		near(g.marker!.angle, 102.98, 3.3, "VO₂ marker against the shot");
	});
});

describe("1d — other days", () => {
	it("Oct 10, the web's 1d-prev: 29 Challenger, phrase 4's copy, Endurance 6 Low, Strength 14 Low, VO₂ 55 Excellent", () => {
		const v = day(-1);
		assert.deepEqual([v.label, v.gauge!.value, v.classWord, v.canGoForward], ["Saturday, October 10", "29", "Challenger", true]);
		assert.equal(v.copy, "Your VO₂ Max looks good. You’re ready to add more hill training to your workouts.");
		assert.deepEqual(v.factors.map((f) => `${f.detail} ${f.rating}`), ["6 Low", "14 Low", "55 Excellent"]);
	});

	it("reads VO₂ as Garmin's 1d route does: the newest running reading on or before the day, Garmin's integer", () => {
		// Garmin's own 1d payloads: 2025-08-10 → Aug 8's 54.6 / 55; 2026-09-12 → 55.5 / 55; 10-05 → 10-03's 54.9 / 55; 10-10 → 54.8; 10-11 → 54.9.
		const cases: Array<[string, number, number, string]> = [
			["2025-08-10", 54.6, 55, "2025-08-08"],
			["2026-09-12", 55.5, 55, "2026-09-12"],
			["2026-10-05", 54.9, 55, "2026-10-03"],
			["2026-10-10", 54.8, 55, "2026-10-10"],
			["2026-10-11", 54.9, 55, "2026-10-11"],
		];
		for (const [date, value, shown, from] of cases) assert.deepEqual(hillVo2Reading(VO2, date), { date: from, value, shown }, date);
		assert.equal(hillVo2Reading(VO2, "2025-08-02"), undefined);
		assert.equal(day(-29).factors[2]!.detail, "55");
	});

	it("a phrase without captured copy shows none, and the class word follows Garmin's id (Dec 17, 2025: 50, Trained)", () => {
		const v = hillScoreView({ range: "1d", offset: -298 }, ROWS, CTX) as HillDayView;
		assert.equal(v.date, "2025-12-17");
		assert.deepEqual([v.gauge!.value, v.classWord, v.copy], ["50", "Trained", undefined]);
		// The marker sits at 0.0°, inside the drawn orange band, while the class is Trained (Inferred colour).
		assert.equal(dialAngle(v.gauge!.at!), 0);
		assert.equal(v.gauge!.tone, "orange");
		// 30–69 is Moderate (Inferred), with no copy seen.
		assert.deepEqual(v.factors.slice(0, 2).map((f) => [f.detail, f.rating, f.sheet!.copy]), [["30", "Moderate", undefined], ["46", "Moderate", undefined]]);
		assert.equal(v.factors[0]!.sheet!.gauge.tone, "yellow");
	});

	it("Sep 4, 2025: 75, Skilled — Garmin's class 4 since the help table renamed Well-Trained", () => {
		const v = hillScoreView({ range: "1d", offset: -402 }, ROWS, CTX) as HillDayView;
		assert.equal(v.date, "2025-09-04");
		assert.deepEqual([v.gauge!.value, v.classWord, v.gauge!.tone], ["75", "Skilled", "blue"]);
		assert.deepEqual(v.factors.slice(0, 2).map((f) => `${f.detail} ${f.rating}`), ["75 High", "70 High"]);
		assert.equal(v.label, "Thursday, September 4, 2025");
	});
});

describe("4w — Sep 14 - Oct 11", () => {
	const v = period({ range: "4w", offset: 0 });

	it("plots 28 days at 29, a dot a day, the ends labelled", () => {
		assert.deepEqual([v.range, v.label, v.span.from, v.span.to], ["4w", "Sep 14 - Oct 11", "2026-09-14", TODAY]);
		assert.deepEqual(values(v), Array(28).fill(29));
		assert.deepEqual([v.chart!.points[0]!.x, v.chart!.points[27]!.x], [0, 1]);
		assert.equal(v.chart!.dots, true);
		assert.deepEqual(v.chart!.ticks, [100, 75, 50, 25, 0]);
		assert.equal(v.chart!.axis.dots.length, 28);
		assert.deepEqual(v.chart!.axis.labels, [{ x: 0, text: "09-14" }, { x: 1, text: "10-11" }]);
	});

	it("figures Avg 29 and Max 29; lists the days newest first, each with its class", () => {
		assert.deepEqual(figures(v), ["29 Avg Score", "29 Max Score"]);
		assert.equal(v.days.length, 28);
		assert.deepEqual(
			v.days.slice(0, 4).map((d) => [d.weekday, d.detail, d.value, d.word, d.offset]),
			[
				["Sunday", "October 11", "29", "Challenger", 0],
				["Saturday", "October 10", "29", "Challenger", -1],
				["Friday", "October 9", "29", "Challenger", -2],
				["Thursday", "October 8", "29", "Challenger", -3],
			],
		);
		// The web's table with Show More: Oct 11 … Oct 2, all 29.
		assert.deepEqual(v.days.slice(0, 10).map((d) => `${d.date.slice(5)} ${d.value}`).join(" · "), "10-11 29 · 10-10 29 · 10-09 29 · 10-08 29 · 10-07 29 · 10-06 29 · 10-05 29 · 10-04 29 · 10-03 29 · 10-02 29");
		assert.deepEqual([v.months, v.canGoBack, v.canGoForward], [[], true, false]);
	});

	it("the web's 4w-prev, Aug 17 - Sep 13: Avg 27, Sep 13 … Sep 9 29 29 29 29 28", () => {
		const prev = period({ range: "4w", offset: -1 });
		assert.equal(prev.label, "Aug 17 - Sep 13");
		assert.equal(prev.figures[0]!.value, "27");
		assert.deepEqual(prev.days.slice(0, 5).map((d) => d.value), ["29", "29", "29", "29", "28"]);
		assert.equal(prev.canGoForward, true);
	});
});

describe("12w — Jul 20 - Oct 11", () => {
	const v = period({ range: "12w", offset: 0 });

	it("plots each Monday week's floored mean in its slot, labelled with its Monday on end", () => {
		assert.equal(v.label, "Jul 20 - Oct 11");
		// Floored, never rounded: the raw means are 29.57 28.43 28.14 28.0 27.43 26.0 26.71 28.57 29 29 29 29.
		assert.deepEqual(values(v), [29, 28, 28, 28, 27, 26, 26, 28, 29, 29, 29, 29]);
		assert.deepEqual(
			v.chart!.axis.labels.map((l) => l.text).join(" "),
			"07-20 07-27 08-03 08-10 08-17 08-24 08-31 09-07 09-14 09-21 09-28 10-05",
		);
		assert.ok(v.chart!.axis.labels.every((l) => l.rotated) && v.chart!.axis.dots.every((d) => d.large));
		// Twelve slots, evenly spaced: the phone's 28.97 pt apart.
		assert.deepEqual(v.chart!.points.map((p) => Number((p.x * 11).toFixed(6))), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
		assert.equal(v.chart!.dots, true);
	});

	it("figures Avg 28 (336 / 12) and Max 30 (Jul 20–23); lists its 84 days, not its weeks", () => {
		assert.deepEqual(figures(v), ["28 Avg Score", "30 Max Score"]);
		assert.equal(v.days.length, 84);
		assert.deepEqual(v.days.slice(0, 3).map((d) => `${d.weekday} ${d.detail} ${d.value} ${d.word}`), [
			"Sunday October 11 29 Challenger",
			"Saturday October 10 29 Challenger",
			"Friday October 9 29 Challenger",
		]);
	});

	it("the web's 12w table and 12w-prev (Apr 27 - Jul 19): the newest weeks first", () => {
		assert.deepEqual(values(v).reverse().slice(0, 5), [29, 29, 29, 29, 28]);
		const prev = period({ range: "12w", offset: -1 });
		assert.equal(prev.label, "Apr 27 - Jul 19");
		assert.deepEqual(values(prev).reverse().slice(0, 5), [30, 30, 29, 29, 29]);
	});
});

describe("1y — Nov 2025 - Oct 2026", () => {
	const v = period({ range: "1y", offset: 0 });

	it("plots each calendar month's floored mean at its 1st, a line without dots", () => {
		assert.deepEqual([v.label, v.span.from, v.span.to], ["Nov 2025 - Oct 2026", "2025-11-01", TODAY]);
		// Raw 57.8 49.81 40.13 34.64 31.74 31.43 33.48 30.47 29.74 27.39 28.47 29.0: rounding would give 58, 35 and 30.
		assert.deepEqual(values(v), [57, 49, 40, 34, 31, 31, 33, 30, 29, 27, 28, 29]);
		assert.equal(v.chart!.dots, false);
		assert.deepEqual(v.chart!.axis.labels.map((l) => l.text).join(" "), "Nov Dec Jan Feb Mar Apr May Jun Jul Aug Sep Oct");
		assert.ok(v.chart!.axis.labels.every((l) => l.rotated));
	});

	it("spaces the months by their days, as the phone's line does (1.015 pt a day, Feb → Mar the short step)", () => {
		const SLOTS = [35.83, 66.5, 97.83, 129.5, 157.83, 189.17, 219.83, 251.17, 281.5, 313.17, 344.5, 374.83];
		v.chart!.points.forEach((p, i) => near(35.83 + p.x * (374.83 - 35.83), SLOTS[i]!, 0.6, `slot ${i}`));
		assert.deepEqual(v.chart!.axis.dots.map((d) => d.x), v.chart!.points.map((p) => p.x));
	});

	it("figures Avg 34, the floor of the points' 418 / 12 (not the days' 35), and Max 61 (Nov 1–3), not the top point", () => {
		assert.deepEqual(figures(v), ["34 Avg Score", "61 Max Score"]);
	});

	it("lists the months newest first, '29 Avg' over the class for 29; a card opens its month page", () => {
		assert.equal(v.days.length, 0);
		assert.equal(v.months.length, 12);
		assert.deepEqual(
			v.months.slice(0, 4).map((m) => [m.title, m.value, m.word]),
			[
				["October 2026", "29 Avg", "Challenger"],
				["September 2026", "28 Avg", "Challenger"],
				["August 2026", "27 Avg", "Challenger"],
				["July 2026", "29 Avg", "Challenger"],
			],
		);
		// The web's 1y table goes on: Jun 30.
		assert.equal(v.months[4]!.value, "30 Avg");
		assert.deepEqual(v.months[0]!.route, performanceStatRoute("hill-score", { range: "1y", offset: 0, sub: "month:2026-10" }));
		assert.equal(v.months[11]!.route.sub, "month:2025-11");
	});

	it("1y −1, Nov 2024 - Oct 2025: Aug 68, Sep 72, Oct 65, the months before the history without a point; Avg 68, Max 76", () => {
		const prev = period({ range: "1y", offset: -1 });
		assert.equal(prev.label, "Nov 2024 - Oct 2025");
		assert.deepEqual(prev.chart!.points.map((p) => [p.date, p.value]), [["2025-08-01", 68], ["2025-09-01", 72], ["2025-10-01", 65]]);
		assert.deepEqual(figures(prev), ["68 Avg Score", "76 Max Score"]);
		assert.deepEqual(prev.months.map((m) => m.value), ["65 Avg", "72 Avg", "68 Avg"]);
		assert.deepEqual(prev.months.map((m) => m.word), ["Trained", "Skilled", "Trained"]);
		// The history starts inside it: "<" stops once the index is complete.
		assert.deepEqual([prev.canGoBack, period({ range: "1y", offset: -1 }, { ...CTX, complete: false }).canGoBack], [false, true]);
	});
});

describe("the month page", () => {
	const march = period({ range: "1y", offset: 0, sub: "month:2026-03" });

	it("March 2026: 31 daily dots, Avg 31 (31.74 floored), Max 33 (Mar 4), its days newest first", () => {
		assert.deepEqual([march.range, march.label, march.month, march.span.from, march.span.to], ["month", "March 2026", "2026-03", "2026-03-01", "2026-03-31"]);
		assert.deepEqual(values(march).join(" "), "32 32 32 33 " + Array(16).fill(32).join(" ") + " 31 31 31 32 32 31 31 31 31 31 31");
		assert.deepEqual(march.chart!.axis.labels.map((l) => l.text), ["03-01", "03-31"]);
		assert.deepEqual(figures(march), ["31 Avg Score", "33 Max Score"]);
		assert.deepEqual(
			march.days.slice(0, 4).map((d) => `${d.weekday} ${d.detail} ${d.value} ${d.word}`),
			["Tuesday March 31 31 Challenger", "Monday March 30 31 Challenger", "Sunday March 29 31 Challenger", "Saturday March 28 31 Challenger"],
		);
		assert.deepEqual([march.canGoBack, march.canGoForward, march.months], [true, true, []]);
	});

	it("steps a month at a time through its sub-page, never past this month", () => {
		assert.equal(monthSub(shiftMonth(march.month!, -1)), "month:2026-02");
		assert.deepEqual([stepMonthSub("2026-03", -1), stepMonthSub("2026-03", 1), stepMonthSub("2026-01", -1)], ["month:2026-02", "month:2026-04", "month:2025-12"]);
		assert.deepEqual([monthOfSub("month:2026-03"), monthOfSub("month:2026-13"), monthOfSub("vo2"), monthOfSub(undefined)], ["2026-03", undefined, undefined, undefined]);
		const october = period({ range: "1y", offset: 0, sub: "month:2026-10" });
		// This month so far (Inferred): Oct 1–11, no ">".
		assert.deepEqual([october.label, october.span.to, october.canGoForward, october.days.length], ["October 2026", TODAY, false, 11]);
		assert.equal(period({ range: "1y", offset: 0, sub: "month:2027-01" }).month, "2026-10");
	});

	it("opens a day card's 1d on top, without the month's sub-page; 4w and 12w move in place", () => {
		const card = march.days[0]!;
		assert.deepEqual(dayCardOpens("month", card), { go: performanceStatRoute("hill-score", { range: "1d", offset: -194 }) });
		assert.equal("sub" in (dayCardOpens("month", card) as { go: object }).go, false);
		assert.deepEqual(dayCardOpens("4w", { offset: -3 }), { move: { range: "1d", offset: -3 } });
		assert.deepEqual(dayCardOpens("12w", { offset: 0 }), { move: { range: "1d", offset: 0 } });
	});

	it("August 2025, the history's first month: its scored days only, and no '<' once the index is complete", () => {
		const august = period({ range: "1y", offset: -1, sub: "month:2025-08" });
		assert.equal(values(august).length, 16);
		assert.deepEqual(figures(august), ["68 Avg Score", "75 Max Score"]);
		assert.equal(august.days.length, 16);
		assert.equal(august.canGoBack, false);
		assert.equal(period({ range: "1y", offset: -1, sub: "month:2025-09" }).canGoBack, true);
	});
});

describe("Garmin's own averages, rebuilt from the days", () => {
	const scores = new Map(ROWS.filter((r) => r.score !== undefined).map((r) => [r.date, r.score!]));

	it("weekly: all 58 Monday weeks of 2025-09-06 → 2026-10-11, the first counting only Sep 6–7 (74, where the whole week gives 75)", () => {
		const weekly =
			"74 72 70 71 69 68 65 63 61 60 58 56 55 53 51 49 46 44 42 39 38 37 36 35 33 32 32 32 31 31 31 31 31 32 33 34 33 33 33 32 30 29 29 29 30 30 29 28 28 28 27 26 26 28 29 29 29 29";
		const { points } = weekPoints({ from: "2025-09-06", to: TODAY }, scores);
		assert.deepEqual(points.map((p) => p.value).join(" "), weekly);
		assert.deepEqual([points[0]!.date, points[57]!.date], ["2025-09-01", "2026-10-05"]);
		// A Tuesday start keys its first week by the Monday before it, as Garmin does.
		const tuesday = weekPoints({ from: "2026-07-21", to: TODAY }, scores).points;
		assert.deepEqual([tuesday[0]!.date, tuesday.map((p) => p.value).join(" ")], ["2026-07-20", "29 28 28 28 27 26 26 28 29 29 29 29"]);
	});

	it("monthly: 2025-09-26 → 2026-10-31, September counting only its last five days (70, where the month gives 72)", () => {
		const { points } = monthPoints({ from: "2025-09-26", to: "2026-10-31" }, scores);
		assert.deepEqual(points.map((p) => p.value).join(" "), "70 65 57 49 40 34 31 31 33 30 29 27 28 29");
	});
});

describe("classes, words and dials", () => {
	it("grades a score by the help table: Recreational 1-24 … Elite 95-100", () => {
		assert.deepEqual(
			[1, 24, 25, 49, 50, 69, 70, 84, 85, 94, 95, 100].map(hillClassOf),
			["Recreational", "Recreational", "Challenger", "Challenger", "Trained", "Trained", "Skilled", "Skilled", "Expert", "Expert", "Elite", "Elite"],
		);
	});

	it("colours the marker by the drawn band, which is not the class at 25, 50–51, 70–71 and 85 (Inferred)", () => {
		assert.deepEqual([25, 26, 50, 51, 52, 70, 71, 72, 85, 86, 95].map((s) => hillDialGauge(s).tone), [
			"red",
			"orange",
			"orange",
			"orange",
			"green",
			"green",
			"green",
			"blue",
			"blue",
			"purple",
			"pink",
		]);
		assert.deepEqual(hillDialGauge(undefined), { value: DASH, label: "100", segments: hillDialGauge(29).segments });
	});

	it("words a factor Low under 30, then Moderate and High (Inferred), its marker linear", () => {
		assert.deepEqual([0, 29, 30, 69, 70, 100].map(factorWord), ["Low", "Low", "Moderate", "Moderate", "High", "High"]);
		assert.deepEqual([factorGauge(7).at, factorGauge(30).tone, factorGauge(70).tone], [0.07, "yellow", "green"]);
		assert.deepEqual(Object.keys(HILL_PHRASES).map(Number), [4, 42]);
		assert.deepEqual(Object.keys(FACTOR_COPY.endurance), ["low"]);
	});

	it("leaves the VO₂ card's word, marker and copy off without an age and a sex, and the card bare without a reading", () => {
		const reading = { date: TODAY, value: 54.9, shown: 55 };
		const bare = vo2Factor(reading, {});
		assert.deepEqual([bare.detail, bare.rating, bare.sheet!.gauge.value, bare.sheet!.gauge.at, bare.sheet!.copy], ["55", "", "55", undefined, undefined]);
		assert.deepEqual(vo2Factor(undefined, CTX), { key: "vo2", title: "VO₂ Max", detail: DASH, rating: "", sheet: null });
	});
});

describe("empty and edge states", () => {
	it("today before the watch syncs (00:17 on Oct 12): no row, no dial, the no-data line and '<'", () => {
		const v = day(0, { ...CTX, today: "2026-10-12" });
		assert.deepEqual([v.label, v.state, v.gauge, v.factors, v.empty, v.canGoBack, v.canGoForward], ["Today", "none", null, [], NO_READING, true, false]);
	});

	it("4w and 12w on that Monday: the series stop at yesterday; 12w's part weeks at both ends", () => {
		const ctx = { ...CTX, today: "2026-10-12" };
		const fourWeeks = period({ range: "4w", offset: 0 }, ctx);
		assert.equal(fourWeeks.label, "Sep 15 - Oct 12");
		assert.equal(fourWeeks.chart!.points.length, 27);
		assert.equal(fourWeeks.chart!.points[26]!.x, 26 / 27);
		assert.equal(fourWeeks.days[0]!.date, TODAY);
		const twelveWeeks = period({ range: "12w", offset: 0 }, ctx);
		assert.equal(twelveWeeks.label, "Jul 21 - Oct 12");
		// Jul 20's week counts Jul 21–26; Oct 12's has no score yet.
		assert.equal(twelveWeeks.chart!.axis.dots.length, 13);
		assert.deepEqual([twelveWeeks.chart!.points[0]!.date, twelveWeeks.chart!.points.length], ["2026-07-20", 12]);
	});

	it("a calibrating day (2025-08-10): the bands without a number or a marker, no class, phrase 1 unknown; VO₂ from Aug 8", () => {
		const v = hillScoreView({ range: "1d", offset: -427 }, ROWS, CTX) as HillDayView;
		assert.equal(v.date, "2025-08-10");
		assert.deepEqual([v.state, v.gauge!.value, v.gauge!.label, v.gauge!.at, v.classWord, v.copy], ["calibrating", DASH, "100", undefined, undefined, undefined]);
		assert.equal(dialGeometry("hill", v.gauge).marker, undefined);
		assert.deepEqual(v.factors.map((f) => [f.detail, f.rating, f.sheet === null]), [
			[DASH, "", true],
			[DASH, "", true],
			["55", "Excellent", false],
		]);
	});

	it("a day before the history: no row; '<' stops there once the index is complete", () => {
		const v = hillScoreView({ range: "1d", offset: -436 }, ROWS, CTX) as HillDayView;
		assert.deepEqual([v.date, v.state, v.empty, v.canGoBack], ["2025-08-01", "none", NO_READING, false]);
		assert.equal((hillScoreView({ range: "1d", offset: -435 }, ROWS, CTX) as HillDayView).canGoBack, false);
	});

	it("calibrating days give no points or cards: a period of them alone is empty", () => {
		const calibrating = ROWS.filter((r) => r.date <= "2025-08-15");
		const v = period({ range: "1y", offset: -1, sub: "month:2025-08" }, CTX, calibrating);
		assert.deepEqual([v.chart, v.empty, figures(v), v.days], [null, NO_DATA, [`${DASH} Avg Score`, `${DASH} Max Score`], []]);
	});

	it("no hill score ever: every view shows the no-data line, '<' only while the index may still be coming", () => {
		const none = { ...CTX, complete: true };
		assert.deepEqual([day(0, none, []).empty, day(0, none, []).canGoBack], [NO_READING, false]);
		for (const range of ["4w", "12w", "1y"] as const) {
			const v = period({ range, offset: 0 }, none, []);
			assert.deepEqual([v.chart, v.empty, v.days, v.months, v.canGoBack], [null, NO_DATA, [], [], false], range);
		}
		assert.equal(period({ range: "4w", offset: 0 }, { ...CTX, complete: false }, []).canGoBack, true);
	});

	it("keeps the y axis 0–100 on every range", () => {
		assert.deepEqual(HILL_TICKS, [100, 75, 50, 25, 0]);
		for (const route of [{ range: "4w", offset: 0 }, { range: "12w", offset: 0 }, { range: "1y", offset: 0 }, { range: "1y", offset: 0, sub: "month:2026-03" }] as const) {
			assert.deepEqual(period(route).chart!.ticks, [100, 75, 50, 25, 0]);
		}
	});
});
