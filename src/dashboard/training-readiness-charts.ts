import type { Tone } from "./gauges";
import type { PeriodAxis } from "./periods";
import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";
import type { TimelineFrame } from "./training-load-charts";
import { SLEEP_SCORE_TICKS, type FactorDot, type RecentSleepChart } from "./training-readiness-pages";

/**
 * Training Readiness's geometry, measured off the Obsidian twin (Figma
 * 430:6106): the day 652:51 (past day 652:244, no reading 652:445), its six
 * sheets 654:195 / 654:444 / 654:564 / 654:766 / 654:1009 / 654:1224 (and
 * Recovered 654:1414) at 402 pt, and the pane 656:1616 at 1190 pt.
 *
 * - The page: the shell's header (the compact stepper alone: 109 pt on the
 *   phone, 117 with its rule in a pane), then the gaps below, each from the
 *   foot of the box above it. The dial is the shared Stat Dial's readiness
 *   kind; the cards are the shared Factor Cards.
 * - A sheet is the shared bottom sheet (`SheetModal`: a 56 pt header, 402
 *   pt wide, a pane's dialog too), its body in the twin's sheet-content
 *   coordinates (0 under the header). Its charts are the other pages', in
 *   the sheet's frames: the Sleep page's hypnogram at 48 pt a level without
 *   its Deep line, the HRV page's 7-day chart as it is, Load's acute
 *   timeline 1.288 times as tall (`ACUTE_SHEET_FRAME`), Stress's 7d line
 *   as it is; Recent Sleep Scores' line is its own (`recentSleepPlot`).
 *
 * Copy runs on the phone's pitch: 17.77 pt on the page, 22 on a sheet. A
 * CSS line box centres its glyphs, so a paragraph starts half the
 * difference from the twin's 20 pt text frames lower: 1.115 on the page, a
 * point higher on a sheet. It wraps at its column's width, where the twin
 * keeps the phone's own breaks: the same lines for every copy seen.
 *
 * Pure.
 */

/**
 * The shell's header foot: the bar (44), the stepper's 22 pt row 25.86 under
 * it and 17.14 more; in a pane, the 72 pt row whose last point is its rule
 * (the twin draws the rule under the row, at 116, so its content starts a
 * point lower than the shell's: the pane's gaps below count from 116).
 */
export const HEADER = { phone: 109, pane: 116 } as const;

/**
 * The day's rhythm, each gap from the foot of the box above.
 *
 * - Phone (652:51): "Updated" 11.06 under the header, the dial 13.77 under
 *   it, the level 10.11 under the dial (its centre 0.83 right of the
 *   page's), the title 15.57 lower, the copy 7.4 under the title on a
 *   17.77 pt pitch, FACTORS 29.33 under the copy and the cards 13.6 under
 *   FACTORS, 90 apart; 35 under the last.
 * - Pane (656:1616): the dial 23.35 under the shell's header (22.35 under
 *   the twin's rule), centred in the 748 pt column with the level under it;
 *   "Updated" 30.09 under the header in the 370 pt column (its cap level
 *   with the ring's top), the title 12 under it; FACTORS 32 under the
 *   level, the cards three a row; 32 under them.
 * - No reading (652:445): the line centred on the dial's centre, 128.83
 *   under the header (the pane's 111.35, Inferred).
 */
export const READINESS_LAYOUT = {
	phone: { updated: 11.06, dial: 13.77, level: 10.11, levelShift: 0.83, title: 15.57, copy: 7.4, copyLine: 17.77, factors: 29.33, cards: 13.6, bottom: 35, empty: 128.83 },
	pane: { dial: 23.35, updated: 30.09, title: 12, factors: 32, bottom: 32, empty: 111.35 },
	/** The boxes the gaps run between. */
	box: { updated: 16, dial: 196, level: 24, title: 22, factorsLabel: 16, card: 74, cardGap: 16, empty: 20 },
} as const;

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

/** A factor card's dot as the twin binds it; NONE's grey is the faint text (Inferred). */
export const DOT_COLOR: Readonly<Record<FactorDot, string>> = {
	green: "var(--color-green)",
	orange: "var(--color-orange)",
	red: "var(--color-red)",
	grey: "var(--text-faint)",
};

/** The Recovery Time ring's colour: the card's dot as a dial tone; none for NONE's grey, which draws no ring (Inferred). */
export function ringTone(dot: FactorDot): Tone | undefined {
	return dot === "grey" ? undefined : dot;
}

/* ------------------------------------------------------------------ */
/*  The sheets                                                         */
/* ------------------------------------------------------------------ */

/**
 * The sheets' rhythm in their content box (the sheet's top and its 56 pt
 * header above it), each gap from the foot of the box above. The status
 * word sits 23.87 under the header (Recovery Time's 27.63 under "Updated
 * @", itself 21.9 under the header); the copy 15.35 under the word on a
 * 22 pt pitch. Then:
 *
 * - Sleep Score (654:195): the score 35.84 under the copy, "100" 2.34 into
 *   its box, "Score" 5.5 under that, the figures' rules 50.11 lower, the
 *   chart's title 9.21 under them and the hypnogram's box 38.46 under the
 *   title (Sleep's chart starts 2 above it, at its own 12 pt top: 36.46);
 *   the legend 13.67 under the chart.
 * - Recovery Time (654:444, 654:1414): the ring 25.12 under the copy, or
 *   25.8 under the word without one.
 * - HRV Status (654:564): the HRV page's dial 24.88 under the copy, its
 *   chart's title 16.41 under the dial (the chart keeps its own 41.49 to
 *   the box), the legend 19.67 under the box.
 * - Acute Load (654:766): the title 14.65 under the copy, the box 49.13
 *   under the title, the legend 8.67 under it.
 * - Recent Sleep Scores (654:1009): the title 24.32 under the copy, the
 *   box 39.46 under it with the legend at its foot, the figures 38 under
 *   the legend.
 * - Recent Stress (654:1224): Stress's chart, title and all, 35.33 under
 *   the copy (its top line on the twin's, its 0 line 0.43 high), the
 *   figure 1.16 into the chart's box, which runs past its labels.
 *
 * 25 pt under the last box, and a phone's home indicator.
 */
export const SHEET_LAYOUT = {
	status: 23.87,
	copy: 15.35,
	copyLine: 22,
	bottom: 25,
	sleep: { score: 35.84, outOf: -2.34, label: 5.5, figures: 50.11, title: 9.21, chart: 36.46, legend: 13.67 },
	recovery: { updated: 21.9, status: 27.63, ring: 25.12, ringAfterStatus: 25.8 },
	hrv: { dial: 24.88, chart: 16.41, legend: 19.67 },
	acute: { title: 14.65, chart: 49.13, legend: 8.67 },
	scores: { title: 24.32, chart: 39.46, figures: 38 },
	stress: { chart: 35.33, figure: -1.16 },
} as const;

/** The sheets' fixed boxes: the status word, "Updated @", the score's three lines, a figure row, the charts' titles and legends. */
export const SHEET_BOX = { status: 22, updated: 16, score: 42, outOf: 21, scoreLabel: 20, figures: 67, title: 22, hrvTitle: 24, hrvToBox: 41.49, legend: 16, dial: 196 } as const;

/** The Sleep Score sheet's hypnogram: the Sleep page's chart at 48 pt a level, its Awake, REM and Light lines (no Deep line). */
export const SLEEP_SHEET = { level: 48, lines: 3, top: 12 } as const;

/**
 * The Acute Load sheet's 4-Week Timeline (Sheet Chart 650:279): Load's
 * frame stretched 1.288 times — lines at 20.17 / 75.83 / 131.5 / 187.17 for
 * 1053, the labels' right edge 36.5 — its days where Load has them (51.9 to
 * 32.77 short of the edge), the dot row at 215, the labels at 227.97, and
 * 237 to the legend's gap.
 */
export const ACUTE_SHEET_FRAME: TimelineFrame = {
	left: 51.9,
	inset: 32.77,
	gridLeft: 44,
	gridInset: 25,
	top: 20.17,
	baseline: 187.17,
	labelRight: 36.5,
	dotY: 215,
	labelY: 227.97,
	height: 237,
};

/**
 * Recent Sleep Scores' Daily Scores (Sheet Chart 650:362, the line
 * 654:1098): 0–100 on a fixed axis, 1.8167 pt a point up from the 0 line's
 * centre at 191.5 (100 at 9.83); the nights 49.5 apart from 54.5 to 351.5,
 * the gridlines from 54.33 to 351.67, the labels' right edge 44.6; the day
 * dots at 200.67 and their labels at 214; the legend 241.33 down.
 */
export const SCORES_FRAME: ChartFrame = {
	left: 54.5,
	inset: 50.5,
	gridLeft: 54.33,
	gridInset: 50.33,
	top: 9.83,
	baseline: 191.5,
	labelRight: 44.6,
	dotY: 200.67,
	labelY: 214,
	height: 241.33,
};

/** The line's 2 pt stroke and the 8 pt dots: --text-faint, the two relevant nights --color-purple. */
export const SCORES_MARKS = { line: 2, dot: 4 } as const;

export interface ScoresPlot extends PlotBox {
	/** Through every night with a score, broken where one has none. */
	line: string;
	/** A dot a night with a score; `relevant` draws purple. */
	points: Array<{ x: number; y: number; relevant: boolean }>;
}

const NO_AXIS: PeriodAxis = { dots: [], labels: [] };

/** The Daily Scores chart at `width`; without a chart, its gridlines and labels alone. */
export function recentSleepPlot(chart: RecentSleepChart | null, width: number): ScoresPlot {
	const { box, scale } = plotBox(SCORES_FRAME, width, chart?.ticks ?? SLEEP_SCORE_TICKS, chart?.axis ?? NO_AXIS);
	if (!chart) return { ...box, line: "", points: [] };
	return {
		...box,
		line: linePath(chart.points.map((p) => [scale.x(p.x), p.value === null ? null : scale.y(p.value)])),
		points: chart.points.flatMap((p) => (p.value === null ? [] : [{ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)), relevant: p.relevant }])),
	};
}
