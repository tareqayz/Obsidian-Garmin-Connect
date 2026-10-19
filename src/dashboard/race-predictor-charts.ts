import type { RaceChart, RaceId, RacePeriodView, RaceShape } from "./race-predictor-pages";
import { linePlot, r2, type LineChartFrame, type LinePlot } from "./stat-charts";

/**
 * The Race Predictor's pace chart, measured off the Obsidian twin (Figma
 * page 430:6110: phone 4w 535:124, 6m 535:354, 1y 535:609, 4w −1 536:410,
 * Half off 536:648, 1y −1 536:850; panes 537:1353, 537:1498, 537:1655; the
 * local Y Axis 534:90, X Axis 534:232 and Chart Marker 534:233). The twin
 * is Garmin's page 56 pt higher, with the same plot.
 *
 * A chart's box starts at the foot of its "Pace" title (y 202.35 on the
 * phone, 173 in a pane) and runs down to the legend on a phone, to the axis
 * labels' foot in a pane, whose legend and chips stand beside the chart. A
 * pane's 748 pt column keeps the phone's insets and heights and stretches
 * the plot between them, so one frame a range serves both.
 *
 * - The plot, and the gridlines with it, runs from the first point to the
 *   last: 4w x 49.67 to 33 short of the box's edge (a day 11.827 pt apart on
 *   the phone, 24.642 in a pane), 6m 54.67 / 33 (a slot 62.866 / 132.066),
 *   1y 46 / 33.33 (29.333 / 60.788).
 * - Four 1 pt gridlines in equal thirds: 4w from 52.62 to 220.98 in the box
 *   (y 254.97–423.33 on the phone), 6m 51.32–220.34, 1y 64.32–225. Pace
 *   runs down the axis, the fastest on the top line, the slowest on the
 *   bottom one. The labels end at x 34.29 / 39.03 / 30.2, centred on their
 *   lines.
 * - The axis row (the twin's at y 444): 4w's day dots Ø 4.33 and its ends
 *   Ø 8.33, 6m's and 1y's slots Ø 8.33, centred 248.66 down (1y 250.66);
 *   "MM-DD" labels centred 261.48 down, 1y's on end, centred 273.48 down and
 *   0.67 pt left of their slot.
 * - The lines are 2 pt, round-capped and -joined, in the series' colour; a
 *   marker is the series' shape (`markerPath`) centred on its value, the
 *   triangle by its centroid. 4w marks each line's ends, 6m and 1y every
 *   point (the view's `marker`).
 * - The box ends where the legend starts (y 490.67 on 4w and 6m, 510.67 on
 *   1y): 288.32 pt, 1y 308.32 for its upright labels. A pane's ends at the
 *   axis labels' foot, 269.65 and 293.65 (y 442.65 and 466.65 there).
 *
 * Pure.
 */

/** A Race chart's box: `LineChartFrame`, how far 1y's upright labels sit left of their slot, and where a pane's box ends. */
export interface RaceChartFrame extends LineChartFrame {
	/** Added to an upright label's x: −0.67 on 1y. */
	uprightShift: number;
	/** The axis labels' foot: a pane's box ends there, its legend being beside the chart. */
	foot: number;
}

/** The title's foot, where the box starts, on the 402 pt phone twin: what the tests add to compare with its page. */
export const PHONE_BOX_TOP = 202.35;

const dots = (y: number) => ({ small: { y, r: 2.165 }, large: { y, r: 4.165 } });

/** The frames by range, from the title's foot, at any width. */
export const RACE_FRAMES: Readonly<Record<RacePeriodView["range"], RaceChartFrame>> = {
	// 535:124: gridlines 254.97 + 56.12k from x 49.67 to 369; the axis row at 444; the legend at 490.67.
	"4w": {
		left: 49.67,
		inset: 33,
		top: 52.62,
		baseline: 220.98,
		labelRight: 34.29,
		axisDots: dots(248.66),
		labelY: 261.48,
		pointRadius: 0,
		height: 288.32,
		uprightShift: 0,
		foot: 269.65,
	},
	// 535:354: gridlines 253.67 + 56.34k from x 54.67 to 369.
	"6m": {
		left: 54.67,
		inset: 33,
		top: 51.32,
		baseline: 220.34,
		labelRight: 39.03,
		axisDots: dots(248.66),
		labelY: 261.48,
		pointRadius: 0,
		height: 288.32,
		uprightShift: 0,
		foot: 269.65,
	},
	// 535:609: gridlines 266.67 + 53.56k from x 46 to 368.67; the slots' dots 2 pt lower, the labels on end; the legend at 510.67.
	"1y": {
		left: 46,
		inset: 33.33,
		top: 64.32,
		baseline: 225,
		labelRight: 30.2,
		axisDots: dots(250.66),
		labelY: 273.48,
		pointRadius: 0,
		height: 308.32,
		uprightShift: -0.67,
		foot: 293.65,
	},
};

/**
 * The Chart Marker's shapes (534:233), centred on the value: a circle Ø 10,
 * a square 10, a diamond 15 across, and a triangle 12 wide and 11.25 tall,
 * apex up, its centroid on the value (7.5 above it, 3.75 below).
 */
export const MARKER = { circle: 5, square: 10, diamond: 15, triangle: { width: 12, height: 11.25 } } as const;

/** A series' marker as a path, centred on (x, y). */
export function markerPath(shape: RaceShape, x: number, y: number): string {
	switch (shape) {
		case "circle": {
			const r = MARKER.circle;
			return `M${r2(x - r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x + r)} ${r2(y)}A${r} ${r} 0 1 0 ${r2(x - r)} ${r2(y)}Z`;
		}
		case "square": {
			const h = MARKER.square / 2;
			return `M${r2(x - h)} ${r2(y - h)}H${r2(x + h)}V${r2(y + h)}H${r2(x - h)}Z`;
		}
		case "diamond": {
			const h = MARKER.diamond / 2;
			return `M${r2(x)} ${r2(y - h)}L${r2(x + h)} ${r2(y)}L${r2(x)} ${r2(y + h)}L${r2(x - h)} ${r2(y)}Z`;
		}
		case "triangle": {
			const { width, height } = MARKER.triangle;
			return `M${r2(x)} ${r2(y - (height * 2) / 3)}L${r2(x + width / 2)} ${r2(y + height / 3)}H${r2(x - width / 2)}Z`;
		}
	}
}

/** One distance's line, laid out. */
export interface RacePlotLine {
	id: RaceId;
	shape: RaceShape;
	/** The points joined straight; empty for fewer than two. */
	line: string;
	points: Array<{ x: number; y: number }>;
	/** Its shape on the points that carry one. */
	markers: Array<{ x: number; y: number; d: string }>;
}

/** A Race chart at a width: `linePlot`'s box with pace labels, upright 1y labels, and a line a distance. */
export interface RacePlot extends Omit<LinePlot, "labels" | "points" | "line" | "pointRadius"> {
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	/** The lines whose chip is on, in the chips' order; drawn before every marker. */
	lines: RacePlotLine[];
}

/**
 * A range's chart at `width`, its box ending at the legend on a phone and at
 * the axis labels' foot in a pane; for a period without a prediction, the
 * bare box the no-data line sits in. `linePlot` puts larger values higher,
 * so the paces go in mirrored about their ticks' middle: the fastest lands
 * on the top line.
 */
export function racePlot(range: RacePeriodView["range"], chart: RaceChart | null, width: number, pane = false): RacePlot {
	const frame = RACE_FRAMES[range];
	const lo = chart?.ticks[0] ?? 0;
	const hi = chart?.ticks[chart.ticks.length - 1] ?? 0;
	const flip = (pace: number) => lo + hi - pace;
	const ticks = chart ? chart.ticks.map(flip) : [];
	const axis = chart?.axis ?? { dots: [], labels: [] };
	const box = linePlot(frame, width, { ticks, axis, points: [] });
	const upright = axis.labels.map((l) => l.rotated === true);
	return {
		width: box.width,
		height: pane ? frame.foot : box.height,
		left: box.left,
		right: box.right,
		top: box.top,
		baseline: box.baseline,
		labelRight: box.labelRight,
		grid: box.grid.map((g, i) => ({ ...g, label: chart?.labels[i] ?? g.label })),
		dots: box.dots,
		labels: box.labels.map((l, i) => (upright[i] ? { ...l, x: r2(l.x + frame.uprightShift), rotated: true } : { ...l, rotated: false })),
		lines: (chart?.lines ?? []).map((l) => {
			const plotted = linePlot(frame, width, { ticks, axis, points: l.points.map((p) => ({ x: p.x, value: flip(p.value) })) });
			return {
				id: l.id,
				shape: l.shape,
				line: plotted.line,
				points: plotted.points,
				markers: plotted.points.flatMap((at, i) => (l.points[i].marker ? [{ x: at.x, y: at.y, d: markerPath(l.shape, at.x, at.y) }] : [])),
			};
		}),
	};
}
