import type { DiscColour } from "./activity-types";
import { trainingEffectScales, type TrainingEffectScale } from "./activity-charts";
import { pillPath } from "./endurance-score-charts";
import { r2 } from "./stat-charts";
import type { TeChart, TeScale } from "./training-effect-pages";

/**
 * Training Effect's charts and detail page as the Obsidian twin draws them
 * (Figma page 430:6116: phones 684:33 7d, 684:118544 4w, 684:118813 and
 * 684:118933 the two runs' detail, 684:119704 the swim's, 684:119826 an
 * empty week; panes 686:1120 7d, 686:1218 4w, 686:119854 a detail). The twin
 * keeps Garmin's geometry, 56 pt higher on the page; a pane keeps the
 * phone's insets and stretches each chart across its 559 pt half.
 *
 * - A chart (Chart 683:217) is a 190 pt box: its title centred 6 pt down,
 *   the plot 27 pt in and 25 short of the right edge, 128 tall from 31, so
 *   5 is 25.6 pt a unit; the y labels centred on their values, right-aligned
 *   at 14.33; a dot a day 10 pt under the feet, the MM-DD ends 12.84 under
 *   that. The phone stacks its two charts 187.33 apart.
 * - The bars sit on a band scale with 0.3 inner padding: n slots fill the
 *   plot edge to edge, the pitch p = plot / (n − 0.3), a bar 0.7 p wide
 *   centred at 0.35 p + i p (7d 36.57 on the phone, 52.97 in a pane; 4w 8.84
 *   and 12.81). Its top is rounded by half its width or half its height,
 *   whichever is less, so a 0.2 bar is a 2.56 pt cap; its feet are square.
 *   The dots and the end labels sit on the slots' centres.
 * - The detail page's scales are the run page's (`trainingEffectScales`):
 *   16 pt in from each side of the cell, five segments with 6 pt gaps and a
 *   7.33 pt cap (66.53 each in a phone's 402, 135.73 in a pane's 748), the
 *   knob — a 20 pt disc in a 4 pt halo — at 16 + v / 5 × the span, and the
 *   value centred under it, never clamped.
 *
 * Pure.
 */

/** A chart's box (683:137; pane 686:1147), in its own coordinates. */
export const TE_CHART = {
	/** The plot: from `left` to `inset` short of the box's right edge, `top` to `baseline`. */
	left: 27,
	inset: 25,
	top: 31,
	baseline: 159,
	/** The title's line box, 16 tall, centred across the box. */
	titleTop: 6,
	/** The y labels' right edge. */
	labelRight: 14.33,
	/** The day dots' centre line, Ø 3.67 a day and 7.67 at the ends. */
	dotY: 169,
	dot: { small: 1.835, large: 3.835 },
	/** The MM-DD labels' centre. */
	labelY: 181.84,
	/** The box. */
	height: 190,
	/** The band scale's inner padding: a bar is 1 − 0.3 of its slot. */
	padding: 0.3,
} as const;

/** The page's rhythm (684:33, 684:119826; panes 686:1120, 686:1218), in points. */
export const TE_LAYOUT = {
	/** The phone's charts: the first box right under the header (at 140), the second 2.67 into its foot (at 327.33, 187.33 on). */
	chartOverlap: 2.67,
	/** The cards 20 under the charts' boxes (537.33; a pane's 358), 90 apart; the phone's band ends 8 under the last. */
	list: 20,
	listBottom: 8,
	/** The empty line in the list's place: 60 tall in a 92 pt band, 16 over its end. */
	emptyBottom: 16,
	/** A pane: the charts 32 under the header row (its rule's top, 116; the shell's body starts there), side by side 8 apart. */
	paneTop: 32,
	paneGap: 8,
} as const;

/** The detail page (684:118813; pane 686:119854), in points. */
export const TE_DETAIL = {
	/** The first header 0.33 under the bar (44.33); from 640 pt the sections 32 under it, 16 apart; a pane's two columns 8 apart. */
	top: 0.33,
	paneTop: 32,
	paneGap: 16,
	paneColumnGap: 8,
	/** A section's header band (403:49): 41.67 tall, its caps label 20.61 down and 16.35 in. */
	header: 41.67,
	/** A cell's padding: 16.51 over the title; 15 under the benefit's copy, 15.15 under a scale's. */
	cellTop: 16.51,
	benefitBottom: 15,
	scaleBottom: 15.15,
	/** The benefit's copy 7.49 under its row. */
	benefitGap: 7.49,
	/** The title's line; the scale row under it, 68.67 tall, the scale 16.82 down it. */
	title: 21,
	scaleRow: 68.67,
	scaleTop: 16.82,
	/** The knob's 28 pt box 9 above the scale's top; the value's 20 pt line 22.57 under it. */
	knob: 28,
	knobTop: -9,
	valueTop: 22.57,
	/** The related activity (683:319): 91.33 tall, 16 in on the phone; its 40 pt disc 16 in and 25.67 down, the text 68.25 in. */
	related: 91.33,
	relatedInset: 16,
	disc: { left: 16, top: 25.67, size: 40, glyph: 24 },
	text: { left: 68.25, name: 15.68, when: 40.67, subtitle: 58.34 },
} as const;

/* ------------------------------------------------------------------ */
/*  The charts                                                         */
/* ------------------------------------------------------------------ */

/** A chart at a width: the box's marks, in its own coordinates. */
export interface TePlot {
	width: number;
	height: number;
	/** The title's centre and line top. */
	title: { x: number; y: number };
	/** The plot's edges. */
	left: number;
	right: number;
	top: number;
	baseline: number;
	/** The band scale: a slot's pitch and a bar's width. */
	pitch: number;
	barWidth: number;
	/** The y labels, 5 down to 0, centred on their values. */
	ticks: Array<{ x: number; y: number; text: string }>;
	/** A bar a day with a value: its box and its outline, round-topped. */
	bars: Array<{ date: string; x: number; y: number; width: number; height: number; radius: number; d: string }>;
	/** A dot a day under the slots. */
	dots: Array<{ x: number; y: number; r: number }>;
	/** The ends' MM-DD, centred on their slots. */
	labels: Array<{ x: number; y: number; text: string }>;
}

/** A chart of `chart`'s days at `width`: the band scale across the plot, the bars `value × 128 / 5` tall. */
export function trainingEffectPlot(chart: Pick<TeChart, "ticks" | "top" | "bars" | "axis">, width: number): TePlot {
	const f = TE_CHART;
	const right = Math.max(f.left + 60, width - f.inset);
	const n = Math.max(1, chart.axis.dots.length);
	const pitch = (right - f.left) / (n - f.padding);
	const barWidth = (1 - f.padding) * pitch;
	/* `x` runs from the first slot's centre (0) to the last's (1); the first bar starts on the plot's edge. */
	const first = f.left + barWidth / 2;
	const cx = (x: number) => first + x * (n - 1) * pitch;
	const unit = (f.baseline - f.top) / (chart.top || 1);
	const y = (value: number) => f.baseline - value * unit;
	return {
		width,
		height: f.height,
		title: { x: r2(width / 2), y: f.titleTop },
		left: f.left,
		right: r2(right),
		top: f.top,
		baseline: f.baseline,
		pitch: r2(pitch),
		barWidth: r2(barWidth),
		ticks: chart.ticks.map((t) => ({ x: f.labelRight, y: r2(y(t)), text: String(t) })),
		bars: chart.bars.map((bar) => {
			const left = cx(bar.x) - barWidth / 2;
			const height = bar.value * unit;
			const radius = Math.min(barWidth / 2, height / 2);
			return {
				date: bar.date,
				x: r2(left),
				y: r2(y(bar.value)),
				width: r2(barWidth),
				height: r2(height),
				radius: r2(radius),
				d: pillPath(left, y(bar.value), barWidth, height, radius),
			};
		}),
		dots: chart.axis.dots.map((d) => ({ x: r2(cx(d.x)), y: f.dotY, r: d.large ? f.dot.large : f.dot.small })),
		labels: chart.axis.labels.map((l) => ({ x: r2(cx(l.x)), y: f.labelY, text: l.text })),
	};
}

/* ------------------------------------------------------------------ */
/*  The detail page                                                    */
/* ------------------------------------------------------------------ */

/** A scale in a cell `width` wide (402 on a phone, a pane's 748): the run page's segments and knob, and the value under the knob. */
export interface TeScaleRow extends TrainingEffectScale {
	/** The value's centre: the knob's, wherever that is. */
	value: { x: number; text: string };
}

/** The run page's scale (`trainingEffectScales`) for one of the detail page's values, at the width of its cell. */
export function teScaleRow(scale: Pick<TeScale, "label" | "value" | "colour" | "text">, width: number): TeScaleRow {
	const [drawn] = trainingEffectScales({ kind: "training-effect", id: "training-effect", title: "", help: false, figures: [], scales: [scale] }, width);
	return { ...drawn!, value: { x: drawn!.knob.x, text: scale.text } };
}

/**
 * An activity's disc in the twin's colours (683:319), from its type's disc
 * (`discOf`): a run's --color-orange, a swim's --color-blue, a ride's
 * --color-green; a sport the phone hasn't shown is a neutral disc (Inferred).
 */
export function discColour(disc: DiscColour): { fill: string; glyph: string } {
	return disc === "neutral"
		? { fill: "var(--background-modifier-border)", glyph: "var(--text-muted)" }
		: { fill: `var(--color-${disc})`, glyph: "var(--text-on-accent)" };
}

/** The bars' colour in both charts (the twin's --color-green; Garmin's #16A544). */
export const BAR_COLOUR = "var(--color-green)";
