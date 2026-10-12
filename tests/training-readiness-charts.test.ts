import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { averagesFrame, averagesPlot } from "../src/dashboard/hrv-status-charts";
import { timelinePlot } from "../src/dashboard/sleep-charts";
import { PANE_COLUMN, PHONE } from "../src/dashboard/stat-charts";
import { DIAL_SIZE, dialGeometry } from "../src/dashboard/stat-dial";
import { linePlot } from "../src/dashboard/stress-charts";
import { ACUTE_FRAME, acutePlot } from "../src/dashboard/training-load-charts";
import {
	ACUTE_SHEET_FRAME,
	DOT_COLOR,
	HEADER,
	READINESS_LAYOUT,
	SCORES_FRAME,
	SHEET_BOX,
	SHEET_LAYOUT,
	SLEEP_SHEET,
	recentSleepPlot,
	ringTone,
} from "../src/dashboard/training-readiness-charts";
import {
	trainingReadinessView,
	type AcuteSheet,
	type HrvSheet,
	type ReadinessSheet,
	type RecentSleepSheet,
	type RecentStressSheet,
	type SleepScoreSheet,
	type TrainingReadinessView,
} from "../src/dashboard/training-readiness-pages";
import type { ReadinessFactorId } from "../src/dashboard/training-readiness-copy";
import { TRAINING_READINESS_INDEX, readinessDayOf, rowsOfReadings } from "../src/sync/training-readiness-index";
import { ALL, HRV, OCT_11_SERIES, SLEEP, STRESS, TODAY, dayReadingsOf } from "./training-readiness-fixture";
import { ROWS as STATUS } from "./training-status-fixture";

/**
 * Training Readiness's geometry against the Obsidian twin (Figma 430:6106):
 * the day 652:51 and the past day 652:244 at 402 pt, the pane 656:1616 at
 * 1190, and the six sheets 654:195 / 654:444 / 654:564 / 654:766 /
 * 654:1009 / 654:1224 with Recovered 654:1414, their positions in the
 * sheet's content box (0 under the 56 pt header, the twin's y less 117).
 * The other pages' charts in the sheets are checked in the sheets' boxes.
 */

const near = (actual: number, expected: number, tolerance: number, what: string) =>
	assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected} (±${tolerance})`);
const nearAll = (actual: readonly number[], expected: readonly number[], tolerance: number, what: string) => {
	assert.equal(actual.length, expected.length, `${what}: count`);
	actual.forEach((a, i) => near(a, expected[i]!, tolerance, `${what} ${i}`));
};

const INDEX = rowsOfReadings(ALL)
	.map((r) => TRAINING_READINESS_INDEX.normalize(r)!)
	.filter((r) => r.date <= TODAY)
	.sort((a, b) => (a.date < b.date ? -1 : 1));

function view(offset = 0): TrainingReadinessView {
	const date = offset === 0 ? TODAY : "2026-10-10";
	return trainingReadinessView(
		{ offset },
		{ rows: INDEX, complete: true, readings: readinessDayOf(dayReadingsOf(date), date) },
		{ today: TODAY, status: STATUS, hrv: HRV, sleep: SLEEP, stress: STRESS, series: offset === 0 ? OCT_11_SERIES : null },
	);
}

function sheet<S extends ReadinessSheet>(id: ReadinessFactorId, offset = 0): S {
	return view(offset).factors.find((f) => f.id === id)!.sheet as S;
}

/** A paragraph's CSS line box from the twin's first 20 pt text frame: the glyphs share a centre. */
const lineBox = (frameTop: number, line: number) => frameTop + (20 - line) / 2;

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

/** The phone's boxes, header included, for a copy of `lines` lines. */
function phoneBoxes(lines: number) {
	const L = READINESS_LAYOUT.phone;
	const B = READINESS_LAYOUT.box;
	const updated = HEADER.phone + L.updated;
	const dial = updated + B.updated + L.dial;
	const level = dial + B.dial + L.level;
	const title = level + B.level + L.title;
	const copy = title + B.title + L.copy;
	const factors = copy + lines * L.copyLine + L.factors;
	const first = factors + B.factorsLabel + L.cards;
	return { updated, dial, level, title, copy, factors, cards: [0, 1, 2, 3, 4, 5].map((k) => first + k * (B.card + B.cardGap)) };
}

describe("the day on the phone (652:51, 652:244)", () => {
	it("stacks the twin's boxes: Updated 120.06, the dial 149.83, the level 355.94, the title 395.51, FACTORS 489.73, cards 519.33 + 90k", () => {
		const b = phoneBoxes(2);
		nearAll([b.updated, b.dial, b.level, b.title], [120.06, 149.83, 355.94, 395.51], 0.01, "boxes");
		// The copy's 17.77 pt lines centre on the twin's 20 pt frames at 423.79 and 441.56.
		near(b.copy, lineBox(423.79, 17.77), 0.01, "copy");
		near(b.copy + 17.77, lineBox(441.56, 17.77), 0.01, "copy line 2");
		near(b.factors, 489.73, 0.06, "FACTORS");
		nearAll(b.cards, [519.33, 609.33, 699.33, 789.33, 879.33, 969.33], 0.06, "cards");
	});

	it("moves FACTORS up a line for a one-line copy (the past day: 472.06, cards 501.66)", () => {
		const b = phoneBoxes(1);
		near(b.factors, 472.06, 0.06, "FACTORS");
		near(b.cards[0]!, 501.66, 0.06, "first card");
	});

	it("puts the no-reading line where the dial's centre would be (652:445: 237.83)", () => {
		const L = READINESS_LAYOUT;
		near(HEADER.phone + L.phone.empty, 237.83, 0.01, "line");
		near(HEADER.phone + L.phone.empty + L.box.empty / 2, phoneBoxes(2).dial + 98, 0.01, "dial centre");
	});

	it("places the marker for 18 at −105.6° on the readiness dial: the twin's (120.09, 270.42); 80 at 92.8° (284.9, 251.93)", () => {
		const today = view(0).dial!;
		const marker = dialGeometry("readiness", today.gauge).marker!;
		assert.equal(DIAL_SIZE, 196);
		// The dial's frame at (103, 149.83); the twin's 24 pt marker at (5.09, 108.59) inside it.
		near(103 + marker.x, 103 + 5.09 + 12, 0.02, "18 x");
		near(149.83 + marker.y, 149.83 + 108.59 + 12, 0.02, "18 y");
		assert.deepEqual([marker.r, marker.outline, marker.tone], [8, 4, "red"]);
		const past = dialGeometry("readiness", view(-1).dial!.gauge).marker!;
		near(103 + past.x, 272.9 + 12, 0.02, "80 x");
		near(149.83 + past.y, 239.93 + 12, 0.02, "80 y");
		assert.equal(past.tone, "blue");
	});

	it("binds the factor dots and the Recovery ring to the theme's colours", () => {
		assert.deepEqual(
			view(0).factors.map((f) => DOT_COLOR[f.dot]),
			["var(--color-green)", "var(--color-red)", "var(--color-green)", "var(--color-green)", "var(--color-orange)", "var(--color-green)"],
		);
		assert.deepEqual([ringTone("red"), ringTone("green"), ringTone("grey")], ["red", "green", undefined]);
	});
});

describe("the day in a pane (656:1616)", () => {
	const L = READINESS_LAYOUT;
	const dial = HEADER.pane + L.pane.dial;
	const level = dial + L.box.dial + L.phone.level;
	const updated = HEADER.pane + L.pane.updated;
	const title = updated + L.box.updated + L.pane.title;
	const factors = level + L.box.level + L.pane.factors;
	const cards = factors + L.box.factorsLabel + L.phone.cards;

	it("centres the dial in the 748 pt column, 139.35 down, its level at 345.46", () => {
		assert.equal(PANE_COLUMN, 748);
		assert.equal(32 + PANE_COLUMN / 2 - 98, 308);
		nearAll([dial, level], [139.35, 345.46], 0.01, "main");
	});

	it("sets Updated, the title and the copy in the 370 pt column at x 788: 146.09, 174.09, 202.37", () => {
		assert.equal(32 + PANE_COLUMN + 8, 788);
		nearAll([updated, title], [146.09, 174.09], 0.01, "side");
		near(title + L.box.title + L.phone.copy, lineBox(202.37, 17.77), 0.01, "copy");
	});

	it("lays the cards three a row at x 32 / 410 / 788, y 431.06 and 521.06, under FACTORS at 401.46", () => {
		near(factors, 401.46, 0.01, "FACTORS");
		nearAll([cards, cards + 90], [431.06, 521.06], 0.01, "rows");
		assert.deepEqual([32, 32 + 370 + 8, 32 + 2 * (370 + 8)], [32, 410, 788]);
	});
});

/* ------------------------------------------------------------------ */
/*  The sheets' rhythm                                                 */
/* ------------------------------------------------------------------ */

describe("the sheets' rhythm (content box, the twin's y − 117)", () => {
	const S = SHEET_LAYOUT;
	const B = SHEET_BOX;
	const status = S.status;
	const copy = (statusTop: number) => statusTop + B.status + S.copy;
	const copyEnd = (statusTop: number, lines: number) => copy(statusTop) + lines * S.copyLine;

	it("sets the word at 23.87 and the copy's 22 pt lines on the twin's frames (62.22, 84.22, 106.22)", () => {
		near(status, 23.87, 0, "status");
		nearAll([0, 1, 2].map((k) => copy(status) + k * S.copyLine), [62.22, 84.22, 106.22].map((t) => lineBox(t, 22)), 0.01, "copy lines");
	});

	it("Sleep Score: 89 at 141.06, 100 at 180.72, Score at 207.22, the rules at 277.33, the title at 353.54, the levels from 424 to the base 616, the key at 665.67", () => {
		const L = S.sleep;
		const score = copyEnd(status, 2) + L.score;
		const outOf = score + B.score + L.outOf;
		const label = outOf + B.outOf + L.label;
		const figures = label + B.scoreLabel + L.figures;
		const title = figures + B.figures + L.title;
		const svg = title + B.title + L.chart;
		nearAll([score, outOf, label, figures, title], [141.06, 180.72, 207.22, 277.33, 353.54], 0.01, "boxes");
		// Sleep's chart starts at its own 12 pt top: Awake at 424, the base 4 levels of 48 lower.
		nearAll([svg + SLEEP_SHEET.top, svg + SLEEP_SHEET.top + 4 * SLEEP_SHEET.level], [424, 616], 0.01, "levels");
		near(svg + SLEEP_SHEET.top + 4 * SLEEP_SHEET.level + 36 + L.legend, 665.67, 0.01, "key");
	});

	it("Recovery Time: Updated at 21.9, the word at 65.53, the copy from 103.89, the ring at 194; Recovered's at 113.33", () => {
		const L = S.recovery;
		const word = L.updated + B.updated + L.status;
		near(word, 65.53, 0.01, "word");
		near(copy(word), lineBox(103.89, 22), 0.015, "copy");
		near(copyEnd(word, 3) + L.ring, 194, 0.01, "ring");
		near(word + B.status + L.ringAfterStatus, 113.33, 0.01, "Recovered's ring");
	});

	it("HRV Status: the dial at 152.1, the chart's title at 364.51 and its box at 430, the key at 686.67", () => {
		const L = S.hrv;
		const dial = copyEnd(status, 3) + L.dial;
		const title = dial + B.dial + L.chart;
		const box = title + B.hrvTitle + B.hrvToBox;
		nearAll([dial, title, box], [152.1, 364.51, 430], 0.01, "boxes");
		near(box + averagesFrame("7d").height + L.legend, 686.67, 0.01, "key");
	});

	it("Acute Load: the title at 119.87, the box at 191, the key at 436.67", () => {
		const L = S.acute;
		const title = copyEnd(status, 2) + L.title;
		const box = title + B.title + L.chart;
		nearAll([title, box, box + ACUTE_SHEET_FRAME.height + L.legend], [119.87, 191, 436.67], 0.01, "boxes");
	});

	it("Recent Sleep Scores: the title at 151.54, the box at 213, the key at 454.33, the figures at 508.33", () => {
		const L = S.scores;
		const title = copyEnd(status, 3) + L.title;
		const box = title + B.title + L.chart;
		const key = box + SCORES_FRAME.height;
		nearAll([title, box, key, key + B.legend + L.figures], [151.54, 213, 454.33, 508.33], 0.01, "boxes");
	});

	it("Recent Stress: Stress's chart 0.68 under the twin's title (139.87), its top line on the twin's, the figure at 486.33", () => {
		const L = S.stress;
		const caption = copyEnd(status, 2) + L.chart;
		near(caption, 139.87 + 0.68, 0.01, "title");
		// Stress's frame (stress-charts.ts): the top line 52.94 under its 22 pt title, the box 324.94 tall.
		const canvas = caption + 22;
		near(canvas + 52.94, 207 + 8.24 + 0.25, 0.01, "top line");
		near(canvas + 324.94 + L.figure, 486.33, 0.01, "figure");
	});
});

/* ------------------------------------------------------------------ */
/*  The sheets' charts                                                 */
/* ------------------------------------------------------------------ */

describe("Sleep Score's hypnogram: the Sleep page's chart at 48 a level (654:195)", () => {
	const t = sheet<SleepScoreSheet>("sleep").timeline.timeline!;
	const p = timelinePlot(t, null, PHONE, SLEEP_SHEET.level);
	/** The chart's top in the content box: 412, Awake's line at 424. */
	const top = 412;

	it("draws the 18 runs from 49 at their stage's level down to the base, the night ending 0.67 past the twin's 358.33", () => {
		assert.equal(p.bars.length, 18);
		near(p.left, 49, 0, "left");
		near(p.right, 358.33, 0.68, "right");
		nearAll(
			[...new Set(p.bars.map((b) => top + b.y))].sort((a, b) => a - b),
			[424, 472, 520, 568],
			0.01,
			"levels",
		);
		assert.ok(p.bars.every((b) => Math.abs(top + b.y + b.h - 616) < 0.01));
	});

	it("puts the deep, REM and awake runs where the twin has them, 0.7 at most off (Garmin's pixels, not its times)", () => {
		const twin: Record<string, Array<[number, number]>> = {
			deep: [
				[56.33, 83.33],
				[130.67, 146.33],
			],
			rem: [
				[92.67, 109.33],
				[170, 179.33],
				[251.33, 272.33],
				[330, 345],
				[351.33, 358.33],
			],
			awake: [
				[157.33, 158],
				[222.67, 223.67],
			],
		};
		for (const [stage, runs] of Object.entries(twin)) {
			const bars = p.bars.filter((b) => b.stage === stage);
			nearAll(
				bars.map((b) => b.x),
				runs.map((r) => r[0]),
				0.7,
				`${stage} starts`,
			);
			nearAll(
				bars.map((b) => b.x + b.w),
				runs.map((r) => r[1]),
				0.7,
				`${stage} ends`,
			);
		}
	});

	it("draws the Awake, REM and Light lines alone, an hour's dot on 625.33, the discs on 623.83, the times on 643.67", () => {
		assert.equal(SLEEP_SHEET.lines, 3);
		nearAll(
			p.grid.slice(0, SLEEP_SHEET.lines).map((g) => top + g.y),
			[424.33, 472.33, 520.33],
			0.34,
			"lines",
		);
		near(top + p.dotY, 625.33, 0.1, "hour dots");
		nearAll(
			p.hours.slice(1),
			[97.5, 144.83, 192.17, 239.5, 286.83, 334.17],
			0.3,
			"hours",
		);
		near(top + p.markerY, 623.83, 0.05, "discs");
		near(top + p.labelY, 643.67, 0.45, "times");
		assert.deepEqual([p.startLabel, p.endLabel], ["11:58 PM", "6:31 AM"]);
	});
});

describe("HRV Status's 7-day Averages, the HRV page's chart as it is (654:564)", () => {
	const s = sheet<HrvSheet>("hrv");
	const p = averagesPlot(s.chart, "7d", PHONE);
	const box = 430;

	it("draws the gridlines from 41.33 to 368.67 at 439.83 / 498.17 / 556.5 / 614.83, labelled 98 87 76 64", () => {
		nearAll(
			p.grid.map((g) => box + g.y),
			[439.83, 498.17, 556.5, 614.83],
			0.015,
			"lines",
		);
		assert.deepEqual(
			p.grid.map((g) => [g.x1, g.x2, g.label]),
			[
				[41.33, 368.67, "98"],
				[41.33, 368.67, "87"],
				[41.33, 368.67, "76"],
				[41.33, 368.67, "64"],
			],
		);
	});

	it("puts the nights' dots on the twin's (654:655–661), 0.25 at most off", () => {
		const twin = [
			[41.5, 525.17],
			[95.83, 530.5],
			[150.5, 514.83],
			[205.17, 514.83],
			[259.83, 514.83],
			[314.5, 514.83],
			[368.83, 514.83],
		];
		nearAll(
			p.points.map((pt) => pt.x),
			twin.map((t) => t[0]!),
			0.25,
			"x",
		);
		nearAll(
			p.points.map((pt) => box + pt.y),
			twin.map((t) => t[1]!),
			0.25,
			"y",
		);
		assert.ok(p.points.every((pt) => pt.shape === "circle" && pt.tone === "green"));
	});

	it("keeps the HRV page's day axis: dots on 647, the labels on 659.93", () => {
		assert.ok(p.dots.every((d) => Math.abs(box + d.y - 647.005) < 0.01));
		nearAll(
			p.labels.map((l) => box + l.y),
			[659.93, 659.93],
			0.01,
			"labels",
		);
	});
});

describe("Acute Load's 4-Week Timeline, Load's in a box 1.288 times as tall (654:766)", () => {
	const s = sheet<AcuteSheet>("acute");
	const p = acutePlot(s.chart!, PHONE, ACUTE_SHEET_FRAME);
	const box = 191;

	it("stretches Load's frame 1.288 times: its 129.67 pt span to 167", () => {
		near((ACUTE_SHEET_FRAME.baseline - ACUTE_SHEET_FRAME.top) / (ACUTE_FRAME.baseline - ACUTE_FRAME.top), 1.288, 0.001, "stretch");
		assert.deepEqual([ACUTE_SHEET_FRAME.left, ACUTE_SHEET_FRAME.inset, ACUTE_SHEET_FRAME.gridLeft, ACUTE_SHEET_FRAME.gridInset], [ACUTE_FRAME.left, ACUTE_FRAME.inset, ACUTE_FRAME.gridLeft, ACUTE_FRAME.gridInset]);
	});

	it("draws the twin's lines (211.17 / 266.83 / 322.5 / 378.17) and labels 1.1k / 750 / 375 / 0 at their own values", () => {
		nearAll(
			p.grid.map((g) => box + g.y),
			[211.17, 266.83, 322.5, 378.17],
			0.015,
			"lines",
		);
		assert.deepEqual(
			p.grid.map((g) => [g.x1, g.x2]),
			Array(4).fill([44, 377]),
		);
		assert.deepEqual(
			p.ticks.map((t) => t.text),
			["1.1k", "750", "375", "0"],
		);
		// The twin's 12 pt label boxes centre on 199.33, 259, 318.5 and 377.67.
		nearAll(
			p.ticks.map((t) => box + t.y),
			[199.33, 259, 318.5, 377.67],
			0.5,
			"labels",
		);
	});

	it("puts the 28 acute dots on the twin's line (654:855), 0.02 at most off", () => {
		const twin =
			"51.90,318.219 63.65,299.029 75.41,297.123 87.16,310.930 98.91,322.508 110.66,321.709 122.42,332.656 134.17,343.590 145.92,327.414 " +
			"157.68,307.272 169.43,318.695 181.18,296.338 192.94,307.916 204.69,293.633 216.44,266.832 228.20,283.330 239.95,298.720 251.70,313.943 " +
			"263.45,329.321 275.21,308.701 286.96,321.709 298.71,334.871 310.47,344.543 322.22,354.228 333.97,361.518 345.72,364.853 357.48,333.609 369.23,299.184";
		const points = twin.split(" ").map((xy) => xy.split(",").map(Number) as [number, number]);
		nearAll(
			p.points.map((pt) => pt.x),
			points.map((pt) => pt[0]),
			0.02,
			"x",
		);
		nearAll(
			p.points.map((pt) => box + pt.y),
			points.map((pt) => pt[1]),
			0.02,
			"y",
		);
		// The band starts on Sep 14's 0.8 × and 1.5 × 403: 322.4 → y 327.04, 604.5 → 282.3, as the twin's.
		assert.ok(p.band.startsWith(`M51.9 ${(282.3 - box).toFixed(2).replace(/\.?0+$/, "")}`), p.band.slice(0, 30));
	});

	it("keeps Load's day axis: 28 dots on 406, the labels 09-14 and 10-11 on 418.97", () => {
		assert.equal(p.dots.length, 28);
		assert.ok(p.dots.every((d) => box + d.y === 406));
		assert.deepEqual(
			p.labels.map((l) => [l.text, box + l.y]),
			[
				["09-14", 418.97],
				["10-11", 418.97],
			],
		);
		nearAll(
			p.labels.map((l) => l.x),
			[51.83, 369.17],
			0.1,
			"label x",
		);
	});
});

describe("Recent Sleep Scores' Daily Scores (654:1009, line 654:1098)", () => {
	const s = sheet<RecentSleepSheet>("sleep-history");
	const p = recentSleepPlot(s.chart, PHONE);
	const box = 213;

	it("runs 0–100 at 1.8167 pt a point, gridlines on the twin's within 0.17", () => {
		near((SCORES_FRAME.baseline - SCORES_FRAME.top) / 100, 1.8167, 0.0001, "scale");
		nearAll(
			p.grid.map((g) => box + g.y),
			[223, 268.17, 313.83, 359.17, 404.5],
			0.17,
			"lines",
		);
		assert.deepEqual(
			p.grid.map((g) => [g.label, g.x1, g.x2]),
			[
				["100", 54.33, 351.67],
				["75", 54.33, 351.67],
				["50", 54.33, 351.67],
				["25", 54.33, 351.67],
				["0", 54.33, 351.67],
			],
		);
	});

	it("puts the 7 nights on the twin's (88 84 94 74 53 90 89), the relevant two purple", () => {
		const twin = [
			[54.67, 244.63],
			[104.17, 251.897],
			[153.67, 233.73],
			[203.17, 270.064],
			[252.67, 308.215],
			[302.17, 240.997],
			[351.67, 242.814],
		];
		nearAll(
			p.points.map((pt) => pt.x),
			twin.map((t) => t[0]!),
			0.18,
			"x",
		);
		nearAll(
			p.points.map((pt) => box + pt.y),
			twin.map((t) => t[1]!),
			0.02,
			"y",
		);
		assert.deepEqual(
			p.points.map((pt) => pt.relevant),
			[false, false, false, false, true, true, false],
		);
		assert.ok(p.line.startsWith("M54.5 31.63"), p.line.slice(0, 20));
	});

	it("draws the day dots on 413.67 (8 pt at the ends, 3.5 between) and 10-05 / 10-11 on 427", () => {
		assert.deepEqual(
			p.dots.map((d) => [Math.round((box + d.y) * 100) / 100, d.r]),
			[[413.67, 4], [413.67, 1.75], [413.67, 1.75], [413.67, 1.75], [413.67, 1.75], [413.67, 1.75], [413.67, 4]],
		);
		nearAll(
			p.dots.map((d) => d.x),
			[54.5, 103.83, 153.5, 202.83, 252.5, 302.17, 351.5],
			0.34,
			"dot x",
		);
		assert.deepEqual(
			p.labels.map((l) => [l.text, l.x, box + l.y]),
			[
				["10-05", 54.5, 427],
				["10-11", 351.5, 427],
			],
		);
	});

	it("draws the axis alone without a score in the week", () => {
		const empty = recentSleepPlot(null, PHONE);
		assert.deepEqual([empty.grid.length, empty.points.length, empty.line, empty.dots.length], [5, 0, "", 0]);
	});
});

describe("Recent Stress's Daily Averages, Stress's 7d line as it is (654:1224)", () => {
	const s = sheet<RecentStressSheet>("stress-history");
	const p = linePlot(s.chart!, PHONE);
	/** Stress's box under its title, 0.68 under the twin's: 139.87 + 0.68 + 22. */
	const box = 139.87 + 0.68 + 22;

	it("puts the 7 days on the twin's (22 26 27 29 33 30 32), within 0.8 (Stress's 0.43 pt shorter scale and its plot's right edge)", () => {
		const twin = [
			[46.33, 357.203],
			[100.11, 349.936],
			[153.89, 348.119],
			[207.67, 344.486],
			[261.45, 337.219],
			[315.23, 342.669],
			[369.01, 339.036],
		];
		nearAll(
			p.points.map((pt) => pt.x),
			twin.map((t) => t[0]!),
			0.8,
			"x",
		);
		nearAll(
			p.points.map((pt) => box + pt.y),
			twin.map((t) => t[1]!),
			0.4,
			"y",
		);
		assert.deepEqual([p.lineWidth, p.pointRadius], [2, 4]);
	});

	it("keeps its 0.5 pt lines on the twin's centres (215.49 … 397.17) within 0.43, labels 100 … 0", () => {
		nearAll(
			p.grid.map((g) => box + g.y),
			[215.49, 260.83, 306.17, 351.83, 397.17],
			0.44,
			"lines",
		);
		assert.deepEqual(
			p.grid.map((g) => g.label),
			["100", "75", "50", "25", "0"],
		);
	});
});

describe("Recovery Time's ring (654:444)", () => {
	it("is the whole 300° sweep in the card's colour, its caps on the twin's (56.5, 169.88), no marker", () => {
		const s = view(0).factors.find((f) => f.id === "recovery")!.sheet;
		assert.equal(s.id, "recovery");
		const tone = ringTone(s.id === "recovery" ? s.ring : "grey")!;
		const g = dialGeometry("recovery", { segments: [{ from: 0, to: 1, tone }] });
		assert.deepEqual(
			g.bands.map((b) => [b.from, b.to, b.tone]),
			[[-150, 150, "red"]],
		);
		nearAll(
			g.caps.flatMap((c) => [c.x, c.y]),
			[56.5, 169.88, 139.5, 169.88],
			0.01,
			"caps",
		);
		assert.equal(g.marker, undefined);
	});
});
