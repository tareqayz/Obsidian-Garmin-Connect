import type { HrvStressLevel } from "./hrv-stress-copy";
import type { HrvStressView } from "./hrv-stress-pages";
import { r2 } from "./stat-charts";

/**
 * The HRV Stress chart's geometry, measured off the Obsidian twin (Figma page
 * 430:6132: phones 805:9 (7d), 805:67 (4w) and the Inferred 805:164 (7d with
 * tests); the 7d pane 806:134691; the local X Axis 804:18, Y Axis 804:79 and
 * Score Bar 804:70).
 *
 * The chart's box is 193.14 pt tall at any width: page y 174.86 on the
 * phone, 9.86 under the header, and (32, 149) in a pane's 748 pt column, 33
 * under it. One frame serves both; the axis stretches between the phone's
 * insets.
 *
 * - Empty (the only state seen): "No data available" in a 16 pt box 89.56
 *   down, inset 16 from both sides; then the day axis, a dot a day centred
 *   172.47 down (Ø 4, the ends Ø 8) from x 26.83 to 25.17 short of the
 *   right edge (376.83 on the phone, 722.83 in the pane), and "MM-DD" under
 *   the end dots, centred 184.84 down. Nothing else.
 * - With tests (Inferred, 805:164): the axis moves to the y-labelled plot,
 *   x 48.83 to 32.83 short of the right edge (369.17 on the phone), as on
 *   Critical Swim Speed and FTP; five gridlines 100 … 0 centred 32.47 down,
 *   30 apart, from x 41 to 25 short of the right edge, their labels
 *   (Caption 11) right-aligned on 33.5 and centred 0.39 above them; a bar a
 *   day with a test, 17.2 wide and centred on its day, standing on the 0
 *   line, 1.2 pt a point, with a round top.
 *
 * Pure.
 */

export const HRV_STRESS_BOX = {
	height: 193.14,
	/** The empty line's 16 pt box, inset from both sides. */
	emptyTop: 89.56,
	emptyHeight: 16,
	emptyInset: 16,
	/** The day axis: its dots' centre, and the end labels'. */
	dotY: 172.47,
	labelY: 184.84,
	dot: { small: 2, large: 4 },
	/** Where the axis runs without a y axis (the empty page), and with one (Inferred). */
	bare: { left: 26.83, inset: 25.17 },
	plot: { left: 48.83, inset: 32.83 },
	/** The Inferred y axis: the 100 line's centre, 30 pt a quarter, the lines' ends, the labels' right edge and lift. */
	gridTop: 32.47,
	gridPitch: 30,
	gridLeft: 41,
	gridInset: 25,
	labelRight: 33.5,
	labelLift: 0.39,
	/** A bar: its width and how tall a point stands. */
	barWidth: 17.2,
	pointHeight: 1.2,
} as const;

/** A day's bar, laid out: its centre, top and foot, the path with its round top, and its level for the colour. */
export interface HrvStressBarPlot {
	date: string;
	x: number;
	top: number;
	bottom: number;
	path: string;
	level: HrvStressLevel;
}

export interface HrvStressPlot {
	width: number;
	height: number;
	/** The Inferred y axis: none on the empty page. */
	grid: Array<{ y: number; x1: number; x2: number }>;
	ticks: Array<{ y: number; text: string }>;
	labelRight: number;
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string }>;
	bars: HrvStressBarPlot[];
	/** The empty line's box; null once a bar draws. */
	empty: { top: number; height: number; left: number; right: number } | null;
}

/** A bar from its top to its foot, its top rounded with half its width (flattened when shorter than that). */
export function barPath(x: number, top: number, bottom: number, width: number = HRV_STRESS_BOX.barWidth): string {
	const half = width / 2;
	const height = bottom - top;
	if (height <= 0) return "";
	const ry = r2(Math.min(half, height));
	const shoulder = r2(top + ry);
	const left = r2(x - half);
	const right = r2(x + half);
	return `M${left} ${r2(bottom)} L${left} ${shoulder} A${r2(half)} ${ry} 0 0 1 ${right} ${shoulder} L${right} ${r2(bottom)} Z`;
}

/** The chart at `width`: the bare empty page, or (Inferred) the 0–100 axis and a bar a day with a test. */
export function hrvStressPlot(view: Pick<HrvStressView, "axis" | "bars" | "y">, width: number): HrvStressPlot {
	const b = HRV_STRESS_BOX;
	const labelled = view.y !== null && view.bars.length > 0;
	const run = labelled ? b.plot : b.bare;
	const right = Math.max(run.left + 60, width - run.inset);
	const x = (fraction: number) => r2(run.left + fraction * (right - run.left));
	const max = view.y?.max ?? 100;
	const zero = b.gridTop + 4 * b.gridPitch;
	const gridRight = r2(Math.max(b.gridLeft + 60, width - b.gridInset));
	const ticks = labelled ? view.y!.ticks : [];
	return {
		width,
		height: b.height,
		grid: ticks.map((_, i) => ({ y: r2(b.gridTop + i * b.gridPitch), x1: b.gridLeft, x2: gridRight })),
		ticks: ticks.map((value, i) => ({ y: r2(b.gridTop + i * b.gridPitch - b.labelLift), text: String(value) })),
		labelRight: b.labelRight,
		dots: view.axis.dots.map((d) => ({ x: x(d.x), y: b.dotY, r: d.large ? b.dot.large : b.dot.small })),
		labels: view.axis.labels.map((l) => ({ x: x(l.x), y: b.labelY, text: l.text })),
		bars: labelled
			? view.bars.map((bar) => {
					const top = zero - (Math.min(max, Math.max(0, bar.score)) / max) * (4 * b.gridPitch);
					const cx = x(bar.x);
					return { date: bar.date, x: cx, top: r2(top), bottom: r2(zero), path: barPath(cx, top, zero), level: bar.level };
				})
			: [],
		empty: labelled ? null : { top: b.emptyTop, height: b.emptyHeight, left: b.emptyInset, right: r2(width - b.emptyInset) },
	};
}
