import type { EnduranceBars, EnduranceCategoryId, EnduranceLegendItem, EnduranceLine, EnduranceRingSlice } from "./endurance-score-pages";
import { linePath, plotBox, r2, type ChartFrame, type PlotBox } from "./stat-charts";
import { DIAL_SIZE, dialArc } from "./stat-dial";

/**
 * The Endurance Score page's geometry, measured off the Obsidian twin (Figma
 * page 430:6128: phones 581:9 1d Score, 581:110 1d Contributors, 581:222 12w
 * Score, 582:108105 / 582:108657 12w and 1y Contributors, 582:109643 the
 * 12w −1 with a two-row legend; panes 584:1723, 584:1770, 585:1793,
 * 585:1917, 585:110129, 585:110509; the local Y Axis 579:114, X Axis
 * 579:405, Chart Dot 576:1200, Legend Item 576:1209, Stats 576:1202).
 * Offsets are from the tabs (Tabs Equal · 2, 55 tall), whose foot is y
 * 227.33 on the phone and 203 in a pane.
 *
 * - 1d: the shared Stat Dial (endurance kind) 16.01 under the tabs, the copy
 *   under it; the contributors' ring, 180 across with its centre where the
 *   dial's is, drawn in the dial's 196 box so `dialArc` draws it.
 * - The score tab's chart box is 66.84 under the tabs at any width: five
 *   gridlines 7.0 → 181.33 down it from x 52 to 29.33 short of its right
 *   edge, which is also where the points run (the axis by days, to the day
 *   after the span), a 2 pt cyan line through Ø 7.67 dots, an 8 pt dot under
 *   each period and its label on end. Avg / Max sit 16 under the box.
 * - The contributors tab's box depends on the phone's legend under it: one
 *   row, 48 under the tabs and 234.67 tall (12w); two, 48.67 and 212.67 (1y,
 *   and the 12w −1); the Stats stay 326 under the tabs. Its x frame is the
 *   range's: 12w bars 9.33 wide from x 53.33 with ½ pt gaps, 1y bars 9 wide
 *   from 54.83 (gridlines from 54.33) with ⅓ pt gaps; each segment's height
 *   is its share of the average and the gaps add to the bar, whose top is a
 *   pill. A pane keeps each range's own box and puts the legend beside it.
 *
 * Pure.
 */

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

/** Each category's colour, as the twin binds it; the two never seen are Inferred. */
export const CATEGORY_COLORS: Readonly<Record<Exclude<EnduranceCategoryId, `type-${number}`>, string>> = {
	running: "var(--color-orange)",
	gym: "var(--color-yellow)",
	cycling: "var(--color-green)",
	swimming: "var(--color-blue)",
	hiking: "var(--color-red)",
	misc: "var(--text-faint)",
	multisport: "var(--color-purple)",
};

/** A category's colour; an activity type of its own takes pink (Inferred). */
export function categoryColor(category: EnduranceCategoryId): string {
	return category.startsWith("type-") ? "var(--color-pink)" : CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS];
}

/** The score tab's line and dots (Chart Dot 576:1200: Garmin's #15AABF). */
export const LINE_COLOR = "var(--color-cyan)";

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/**
 * The 1d page, from the tabs: the dial's 196 box 16.01 under them (243.34 on
 * the phone, centre y 341.34); the copy in Paragraph 16 on a 20.11 pitch,
 * its first line box 8.47 under the dial's box (the twin's 22 pt boxes from
 * 446.86); the no-data line centred where the dial would be. In a pane the
 * copy stands in the side column, its first line 79.19 under the tabs' top
 * (226.24 + 0.95).
 */
export const DAY_LAYOUT = {
	dialTop: 16.01,
	copyGap: 8.47,
	copyLine: 20.11,
	copyTopPane: 79.19,
} as const;

/**
 * The contributors' ring: R 90, 8 wide, flat ends, its 180 box at (110.84,
 * 251.18) on the phone (316, 226.85 in a pane), so its centre is the dial's
 * less 0.16. Drawn in a 196 box like the dial's, 15.85 under the tabs. In
 * it the score in 47/57, its top 60.69 down, and the class in 16/21 at
 * 116.82; the legend 15.82 under the box (455 on the phone), its rows 14
 * tall and 21.33 apart; the list 23.67 under the legend (514). In a pane the
 * list is a card in the side column, level with the ring's top (78.85 under
 * the tabs' top).
 */
export const RING = {
	radius: 90,
	width: 8,
	top: 15.85,
	valueTop: 60.69,
	labelTop: 116.82,
	legendGap: 15.82,
	listGap: 23.67,
	listTopPane: 78.85,
} as const;

/** A slice of the ring as an arc on its centreline, in the 196 box. */
export interface RingArc {
	category: EnduranceCategoryId;
	d: string;
	color: string;
}

/** The ring's slices as stroked arcs: centreline 86, butt-ended, in `DIAL_SIZE` (196) box. */
export function ringArcs(slices: readonly EnduranceRingSlice[]): RingArc[] {
	const rc = RING.radius - RING.width / 2;
	return slices.map((s) => ({ category: s.category, d: dialArc(rc, s.from, s.to), color: categoryColor(s.category) }));
}

/** The ring's box: the dial's 196. */
export const RING_BOX = DIAL_SIZE;

/* ------------------------------------------------------------------ */
/*  The legend                                                         */
/* ------------------------------------------------------------------ */

/** The twin's Legend Item widths (Ø 12 dot, 6, Caption 11): the categories it draws. */
export const LEGEND_WIDTHS: Readonly<Partial<Record<EnduranceCategoryId, number>>> = {
	running: 61,
	cycling: 57,
	gym: 151,
	swimming: 72,
	hiking: 51,
	misc: 92,
};

/** Items 16 apart; rows 14 tall, 21.33 apart. */
export const LEGEND = { gap: 16, row: 14, pitch: 21.33 } as const;

/**
 * The widths a legend wraps at. Periods: the phone's 370 (402 less 16 a
 * side) and a pane's side column, the same. 1d: the phone breaks after Gym &
 * Fitness Equipment (228 wide) though Miscellaneous would fit in 370, so its
 * legend wraps narrower: any width from 228 to 335 does it (Inferred: 300);
 * a pane's 748 column keeps one row.
 */
export const LEGEND_WIDTH = { period: 370, day: 300 } as const;

/** An item's width: the twin's, or Caption 11's estimate for a category it never drew. */
export function legendItemWidth(item: Pick<EnduranceLegendItem, "category" | "title">): number {
	return LEGEND_WIDTHS[item.category] ?? Math.round(18 + 6.2 * item.title.length);
}

/** The legend in rows no wider than `width`, as the twin breaks them: Running, Cycling, Gym & Fitness Equipment / Swimming, Hiking, Miscellaneous. */
export function legendRows<T extends Pick<EnduranceLegendItem, "category" | "title">>(items: readonly T[], width: number): T[][] {
	const rows: T[][] = [];
	let used = 0;
	for (const item of items) {
		const w = legendItemWidth(item);
		const row = rows[rows.length - 1];
		if (row && used + LEGEND.gap + w <= width + 0.01) {
			row.push(item);
			used += LEGEND.gap + w;
		} else {
			rows.push([item]);
			used = w;
		}
	}
	return rows;
}

/** A row's width, as the twin lays it out. */
export function legendRowWidth(row: ReadonlyArray<Pick<EnduranceLegendItem, "category" | "title">>): number {
	return r2(row.reduce((sum, item, i) => sum + legendItemWidth(item) + (i ? LEGEND.gap : 0), 0));
}

/* ------------------------------------------------------------------ */
/*  The score tab's chart                                              */
/* ------------------------------------------------------------------ */

/**
 * 12w and 1y alike (581:222, 585:1793, 585:1917): the box 66.84 under the
 * tabs, 251.16 tall; gridlines and points from x 52 to 29.33 short of the
 * edge; the labels' right edge at 36.17; axis dots at 208.16, labels on end
 * centred at 230.83; Avg / Max 16 under the box (561.33 on the phone; a pane's
 * level with the top gridline, beside it).
 */
export const SCORE_FRAME: ChartFrame = {
	left: 52,
	inset: 29.33,
	gridLeft: 52,
	gridInset: 29.33,
	top: 7,
	baseline: 181.33,
	labelRight: 36.17,
	dotY: 208.16,
	labelY: 230.83,
	height: 251.16,
};

export const SCORE_LAYOUT = { offset: 66.84, statsGap: 16, pointRadius: 3.835 } as const;

export interface ScorePlot extends PlotBox {
	/** The points, joined straight in order: one path, empty for fewer than two. */
	line: string;
	points: Array<{ x: number; y: number }>;
	pointRadius: number;
}

/** The score tab's chart at `width`; for a period without a point, the bare box the no-data line sits in. */
export function scorePlot(line: EnduranceLine | null, width: number): ScorePlot {
	const ticks = line?.ticks ?? [];
	const { box, scale } = plotBox(SCORE_FRAME, width, ticks.length ? ticks : [0, 1], line?.axis ?? { dots: [], labels: [] }, line?.labels ?? []);
	const points = (line?.points ?? []).map((p) => ({ x: r2(scale.x(p.x)), y: r2(scale.y(p.value)) }));
	return {
		...box,
		grid: line ? box.grid : [],
		line: points.length > 1 ? linePath(points.map((p) => [p.x, p.y])) : "",
		points,
		pointRadius: SCORE_LAYOUT.pointRadius,
	};
}

/* ------------------------------------------------------------------ */
/*  The contributors tab's chart                                       */
/* ------------------------------------------------------------------ */

/** A range's bars across: where they run, the gridlines, the labels, a bar's width and the gaps between its segments. */
export interface BarsAcross {
	left: number;
	inset: number;
	gridLeft: number;
	gridInset: number;
	labelRight: number;
	barWidth: number;
	gap: number;
}

/** 12w (582:108111, pane 585:110153) and 1y (582:108663, pane 585:110533). */
export const BARS_ACROSS: Readonly<Record<"12w" | "1y", BarsAcross>> = {
	"12w": { left: 53.33, inset: 30.67, gridLeft: 53.33, gridInset: 30.67, labelRight: 36.17, barWidth: 9.33, gap: 0.5 },
	"1y": { left: 54.83, inset: 26.33, gridLeft: 54.33, gridInset: 26.33, labelRight: 38.17, barWidth: 9, gap: 1 / 3 },
};

/** The box down, by the phone legend's rows: its offset under the tabs, the gridlines, the axis, its height. */
export interface BarsDown {
	offset: number;
	top: number;
	baseline: number;
	dotY: number;
	labelY: number;
	height: number;
}

/**
 * One legend row (the 12w) and two (the 1y and the 12w −1). The second row
 * moves the box 0.67 down and takes 22 off it, one legend pitch in all, so
 * the Stats stay put; a third row does the same again (Inferred).
 */
const BARS_DOWN: readonly BarsDown[] = [
	{ offset: 48, top: 7, baseline: 184.17, dotY: 191.67, labelY: 214.34, height: 234.67 },
	{ offset: 48.67, top: 7, baseline: 162.33, dotY: 169.67, labelY: 192.34, height: 212.67 },
];
const ROW_DOWN = 0.67;
const ROW_SHORTER = 22;

/** The box for a phone legend of `rows` rows; a pane keeps its range's (`paneRows`). */
export function barsDown(rows: number): BarsDown {
	const n = Math.max(1, Math.round(rows));
	if (n <= BARS_DOWN.length) return BARS_DOWN[n - 1]!;
	const last = BARS_DOWN[BARS_DOWN.length - 1]!;
	const extra = n - BARS_DOWN.length;
	const less = extra * ROW_SHORTER;
	return {
		offset: r2(last.offset + extra * ROW_DOWN),
		top: last.top,
		baseline: r2(last.baseline - less),
		dotY: r2(last.dotY - less),
		labelY: r2(last.labelY - less),
		height: r2(last.height - less),
	};
}

/** A pane's box is its range's, as the twin's: the 12w's one-row box, the 1y's two-row one. */
export function paneRows(range: "12w" | "1y"): number {
	return range === "1y" ? 2 : 1;
}

/**
 * The contributors tab's vertical rhythm on the phone: the legend 6.67 under
 * the box, the Stats 22.66 under its last row (326 under the tabs whatever
 * the rows), the list 33 under the Stats. In a pane the Stats' rule is level
 * with the top gridline, the legend 22.67 under them, and the blocks 30
 * under the box, three a row 8 apart and 16 between rows.
 */
export const BARS_LAYOUT = { legendGap: 6.67, statsGap: 22.66, listGap: 33, paneLegendGap: 22.67, paneBlocksGap: 30 } as const;

/** One segment of a bar as drawn: its colour, its top and its height; the top segment is a pill (`d`). */
export interface BarRect {
	category: EnduranceCategoryId;
	color: string;
	y: number;
	height: number;
	/** The top segment's outline, its corners rounded by half the bar's width. */
	d?: string;
}

export interface BarsPlot extends PlotBox {
	bars: Array<{ date: string; x: number; width: number; radius: number; rects: BarRect[] }>;
}

/**
 * The contributors tab's chart at `width`, its box for a legend of `rows`
 * rows: each bar centred on its period's start, its segments bottom up, each
 * its share of the average in the axis' units and a gap over it, the top one
 * a pill as wide as the bar.
 */
export function barsPlot(bars: EnduranceBars | null, range: "12w" | "1y", width: number, rows: number): BarsPlot {
	const across = BARS_ACROSS[range];
	const down = barsDown(rows);
	const frame: ChartFrame = { left: across.left, inset: across.inset, gridLeft: across.gridLeft, gridInset: across.gridInset, labelRight: across.labelRight, ...down };
	const ticks = bars?.ticks ?? [];
	const { box, scale } = plotBox(frame, width, ticks.length ? ticks : [0, 1], bars?.axis ?? { dots: [], labels: [] }, bars?.labels ?? []);
	const lo = ticks.length ? Math.min(...ticks) : 0;
	const hi = ticks.length ? Math.max(...ticks) : 1;
	const unit = (frame.baseline - frame.top) / (hi - lo || 1);
	return {
		...box,
		grid: bars ? box.grid : [],
		bars: (bars?.bars ?? []).map((bar) => {
			const x = r2(scale.x(bar.x));
			const radius = across.barWidth / 2;
			const rects: BarRect[] = [];
			let y = frame.baseline;
			bar.segments.forEach((s, i) => {
				const height = (s.to - s.from) * unit;
				if (i > 0) y -= across.gap;
				y -= height;
				rects.push({ category: s.category, color: categoryColor(s.category), y: r2(y), height: r2(height) });
			});
			const top = rects[rects.length - 1];
			if (top) top.d = pillPath(x - across.barWidth / 2, top.y, across.barWidth, top.height, radius);
			return { date: bar.date, x, width: across.barWidth, radius, rects };
		}),
	};
}

/** A pill-topped rectangle as a path: square at the foot, its top corners rounded by `r` (at most half its height). */
export function pillPath(x: number, y: number, width: number, height: number, r: number): string {
	const k = Math.max(0, Math.min(r, width / 2, height));
	const right = x + width;
	const foot = y + height;
	return `M${r2(x)} ${r2(foot)}V${r2(y + k)}A${r2(k)} ${r2(k)} 0 0 1 ${r2(x + k)} ${r2(y)}H${r2(right - k)}A${r2(k)} ${r2(k)} 0 0 1 ${r2(right)} ${r2(y + k)}V${r2(foot)}Z`;
}
