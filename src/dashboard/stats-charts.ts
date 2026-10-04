/**
 * Where the marks of the Steps, Floors and Intensity Minutes charts go,
 * measured off the app and the Figma twin.
 *
 * A chart arrives as a `ChartSpec`: its values, already worked out by
 * `stats-pages.ts`, with every x a fraction of the plot's width. Here they
 * become pixels. Each chart keeps the app's insets and heights and stretches
 * across whatever width the pane gives it, so a pane draws the phone's chart
 * wider rather than a different chart. A chart's own y starts 44pt below the
 * top of its title, where the app's chart frame starts.
 */

export type FrameId =
	| "steps-day"
	| "steps-7d"
	| "steps-4w"
	| "steps-month"
	| "steps-week"
	| "floors-day"
	| "floors-7d"
	| "floors-4w"
	| "floors-1y"
	| "intensity-day"
	| "intensity-week"
	| "intensity-4w"
	| "intensity-1y";

export type BarTone = "blue" | "green" | "goal" | "faded";

export type LegendKey = "climbed" | "descended" | "goal" | "weekly-goal";

export interface ChartSpec {
	frame: FrameId;
	/** "Daily Timeline", "Daily Totals", "Monthly Totals"… */
	title: string;
	/** Gridline values, lowest first. The first sits on the plot's floor, the last on its ceiling. */
	ticks: number[];
	labels: string[];
	/** Floors draw their zero line darker than the rest: bars grow both ways from it. */
	strongZero?: boolean;
	/** `x` is the bar's centre; a bar runs from one value to another, zero to a total or down from it. */
	bars: Array<{ x: number; from: number; to: number; tone: BarTone }>;
	lines: Array<{ points: Array<[number, number]>; tone: "normal" | "faint"; area?: boolean }>;
	goal?: number;
	dots: Array<{ x: number; large: boolean }>;
	xLabels: Array<{ x: number; text: string; rotated?: boolean }>;
	markers: Array<{ kind: "goal"; x: number; value: number } | { kind: "wake"; x: number }>;
	/** Week ends, drawn as hairlines up the plot. */
	vlines?: number[];
	legend?: LegendKey[];
}

interface Frame {
	/** The plot's left edge, and its gap to the chart's right edge. */
	left: number;
	inset: number;
	/** The first and last gridline. */
	bottom: number;
	top: number;
	/** The y labels' right edge. */
	labelRight: number;
	dotY: number;
	/** The centre of the x labels, upright or rotated. */
	labelY: number;
	/** Everything the chart draws, down to whatever follows it. */
	height: number;
	bar: number;
	grid: number;
	goalDash: [number, number];
	goalWidth: number;
	lineWidth: number;
	/** The goal line runs between the outer bars' edges rather than the plot's. */
	goalOverBars?: boolean;
}

const STEPS_LINE = { grid: 0.5, goalDash: [6.7, 4.6] as [number, number], goalWidth: 1.5, lineWidth: 1.8 };
const FLOORS_LINE = { grid: 0.5, goalDash: [7.2, 4.4] as [number, number], goalWidth: 1.5, lineWidth: 1.5 };
const IM_LINE = { grid: 1, goalDash: [4.7, 4.6] as [number, number], goalWidth: 1.2, lineWidth: 2 };

const FRAMES: Record<FrameId, Frame> = {
	"steps-day": { left: 34, inset: 15.3, top: 11.75, bottom: 225.05, labelRight: 27.5, dotY: 238.5, labelY: 0, height: 260, bar: 0, ...STEPS_LINE },
	"steps-7d": { left: 57.2, inset: 33.2, top: 12.75, bottom: 251.75, labelRight: 33.5, dotY: 262, labelY: 274.7, height: 304.3, bar: 17.2, ...STEPS_LINE },
	"steps-4w": { left: 44.3, inset: 19.3, top: 13.25, bottom: 251.95, labelRight: 34.3, dotY: 262, labelY: 274.7, height: 304.4, bar: 4.2, ...STEPS_LINE },
	"steps-month": { left: 56.3, inset: 24.3, top: 11.55, bottom: 236.55, labelRight: 41, dotY: 243.1, labelY: 266.3, height: 304.3, bar: 18.5, ...STEPS_LINE },
	"steps-week": { left: 53.7, inset: 25.7, top: 11.55, bottom: 236.55, labelRight: 41, dotY: 243.1, labelY: 266.3, height: 304.3, bar: 4, ...STEPS_LINE },
	"floors-day": { left: 43.3, inset: 29, top: 38.25, bottom: 187.95, labelRight: 26.7, dotY: 223.8, labelY: 0, height: 240, bar: 0, ...FLOORS_LINE, goalDash: [6.7, 4.6] },
	"floors-7d": { left: 57.8, inset: 38.7, top: 32.35, bottom: 221.15, labelRight: 31.5, dotY: 233.7, labelY: 246.4, height: 256.4, bar: 17, ...FLOORS_LINE, goalOverBars: true },
	"floors-4w": { left: 44, inset: 25, top: 32.35, bottom: 221.15, labelRight: 31.5, dotY: 233.7, labelY: 246.4, height: 257.4, bar: 4, ...FLOORS_LINE, goalOverBars: true },
	"floors-1y": { left: 49, inset: 52, top: 23.25, bottom: 207.25, labelRight: 31.5, dotY: 215.7, labelY: 238, height: 257.4, bar: 3.7, ...FLOORS_LINE },
	"intensity-day": { left: 42, inset: 36, top: 22.1, bottom: 123.5, labelRight: 36, dotY: 156.4, labelY: 173.4, height: 208, bar: 0, ...IM_LINE },
	"intensity-week": { left: 43, inset: 30, top: 21.9, bottom: 150.9, labelRight: 36.5, dotY: 163.7, labelY: 176.4, height: 208, bar: 0, ...IM_LINE },
	"intensity-4w": { left: 42.8, inset: 35.2, top: 22, bottom: 159, labelRight: 36.5, dotY: 173.7, labelY: 186.4, height: 208, bar: 0, ...IM_LINE, goalWidth: 1.6 },
	"intensity-1y": { left: 53.3, inset: 25.7, top: 22.4, bottom: 162.7, labelRight: 40, dotY: 179, labelY: 201.4, height: 239.4, bar: 4, ...IM_LINE },
};

const SMALL_DOT = 1.75;
const LARGE_DOT = 4;

export interface Plot {
	width: number;
	height: number;
	gridWidth: number;
	grid: Array<{ y: number; x1: number; x2: number; strong: boolean }>;
	yLabels: Array<{ x: number; y: number; text: string }>;
	vlines: Array<{ x: number; y1: number; y2: number }>;
	bars: Array<{ d: string; tone: BarTone }>;
	areas: string[];
	lines: Array<{ d: string; tone: "normal" | "faint" }>;
	lineWidth: number;
	goal?: { y: number; x1: number; x2: number; dash: string; width: number };
	dots: Array<{ cx: number; cy: number; r: number }>;
	xLabels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
	markers: Array<{ kind: "goal" | "wake"; cx: number; cy: number }>;
}

/** The chart's height before it is laid out, so the page can reserve it. */
export function plotHeight(frame: FrameId): number {
	return FRAMES[frame].height;
}

export function plotFor(spec: ChartSpec, width: number): Plot {
	const f = FRAMES[spec.frame];
	const right = Math.max(f.left + 40, width - f.inset);
	const lo = spec.ticks[0] ?? 0;
	const hi = spec.ticks[spec.ticks.length - 1] ?? 1;
	const span = hi - lo || 1;
	const x = (t: number) => f.left + t * (right - f.left);
	const y = (v: number) => f.bottom - ((Math.min(hi, Math.max(lo, v)) - lo) / span) * (f.bottom - f.top);
	const r1 = (n: number) => Math.round(n * 100) / 100;

	const grid = spec.ticks.map((t) => ({ y: r1(y(t)), x1: f.left, x2: r1(right), strong: Boolean(spec.strongZero && t === 0) }));
	const yLabels = spec.ticks.map((t, i) => ({ x: f.labelRight, y: r1(y(t)), text: spec.labels[i] ?? String(t) }));

	const bars = spec.bars
		.filter((b) => b.to !== b.from)
		.map((b) => {
			const cx = x(b.x);
			const y1 = y(Math.max(b.from, b.to));
			const y2 = y(Math.min(b.from, b.to));
			// Up from zero rounds at the top; down from it, at the bottom.
			const end = b.to >= b.from ? "top" : "bottom";
			return { d: roundedBar(cx - f.bar / 2, y1, f.bar, y2 - y1, f.bar / 2, end), tone: b.tone };
		});

	const areas: string[] = [];
	const lines: Plot["lines"] = [];
	for (const line of spec.lines) {
		if (!line.points.length) continue;
		const pts = line.points.map(([t, v]) => `${r1(x(t))} ${r1(y(v))}`);
		const d = `M${pts.join(" L")}`;
		lines.push({ d, tone: line.tone });
		if (line.area) {
			const first = line.points[0]!;
			const last = line.points[line.points.length - 1]!;
			areas.push(`${d} L${r1(x(last[0]))} ${r1(y(lo))} L${r1(x(first[0]))} ${r1(y(lo))} Z`);
		}
	}

	let goal: Plot["goal"];
	if (spec.goal !== undefined && spec.goal >= lo && spec.goal <= hi) {
		const reach = f.goalOverBars ? f.bar / 2 : 0;
		goal = { y: r1(y(spec.goal)), x1: r1(f.left - reach), x2: r1(right + reach), dash: f.goalDash.join(" "), width: f.goalWidth };
	}

	const dots = spec.dots.map((d) => ({ cx: r1(x(d.x)), cy: f.dotY, r: d.large ? LARGE_DOT : SMALL_DOT }));
	const xLabels = spec.xLabels.map((l) => ({ x: r1(x(l.x)), y: f.labelY, text: l.text, rotated: l.rotated === true }));
	const markers = spec.markers.map((m) =>
		m.kind === "wake" ? { kind: "wake" as const, cx: r1(x(m.x)), cy: f.dotY } : { kind: "goal" as const, cx: r1(x(m.x)), cy: r1(y(m.value)) },
	);
	const vlines = (spec.vlines ?? []).map((t) => ({ x: r1(x(t)), y1: f.top, y2: f.bottom }));

	return {
		width,
		height: f.height,
		gridWidth: f.grid,
		grid,
		yLabels,
		vlines,
		bars,
		areas,
		lines,
		lineWidth: f.lineWidth,
		...(goal ? { goal } : {}),
		dots,
		xLabels,
		markers,
	};
}

/** A bar square at one end and fully round at the other, the way the app draws them. */
export function roundedBar(x: number, y: number, w: number, h: number, r: number, end: "top" | "bottom"): string {
	const n = (v: number) => Math.round(v * 100) / 100;
	const radius = Math.max(0, Math.min(r, w / 2, h));
	if (radius === 0) return `M${n(x)} ${n(y)} h${n(w)} v${n(h)} h${n(-w)} Z`;
	if (end === "top") {
		return (
			`M${n(x)} ${n(y + h)} V${n(y + radius)} A${n(radius)} ${n(radius)} 0 0 1 ${n(x + radius)} ${n(y)} ` +
			`H${n(x + w - radius)} A${n(radius)} ${n(radius)} 0 0 1 ${n(x + w)} ${n(y + radius)} V${n(y + h)} Z`
		);
	}
	return (
		`M${n(x)} ${n(y)} V${n(y + h - radius)} A${n(radius)} ${n(radius)} 0 0 0 ${n(x + radius)} ${n(y + h)} ` +
		`H${n(x + w - radius)} A${n(radius)} ${n(radius)} 0 0 0 ${n(x + w)} ${n(y + h - radius)} V${n(y)} Z`
	);
}
