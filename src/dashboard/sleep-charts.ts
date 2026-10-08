import type { AlignmentView, CoachView, PeriodOverlay, SleepPeriodView, Stage, Timeline, TimelineOverlay, XAxis } from "./sleep-pages";
import { roundedBar } from "./stats-charts";

/**
 * Where the marks of the Sleep charts go, measured off the Figma twin of the
 * app (Obsidian / Sleep — 1d, 176:4, and 7d · 4w · 1y, 176:5).
 *
 * The values arrive worked out by `sleep-pages.ts`, every x a fraction of the
 * plot. Here they become pixels: each chart keeps the phone's insets and
 * heights and stretches its plot across whatever width the pane gives it.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

const SMALL_DOT = 1.75;
const LARGE_DOT = 4;

/* ------------------------------------------------------------------ */
/*  The night's timeline                                               */
/* ------------------------------------------------------------------ */

/**
 * - `stages`: every stage in its colour (the Duration page).
 * - `awake`: the stages faded, awake bright, restless moments as ticks (the
 *   Awake/Restlessness chip and page).
 * - `line`: the stages faded, awake fainter still, and the overlay's line.
 */
export type TimelineLook = "stages" | "awake" | "line";

export interface TimelinePlot {
	width: number;
	height: number;
	left: number;
	right: number;
	baseline: number;
	labelRight: number;
	grid: Array<{ y: number; label: string }>;
	bars: Array<{ x: number; y: number; w: number; h: number; stage: Stage }>;
	/** Restless moments: a 1pt tick each, stacked when a minute had several. */
	ticks: Array<{ x: number; y: number; h: number }>;
	line?: string;
	rightX: number;
	rightLabels: Array<{ y: number; text: string }>;
	hours: number[];
	dotY: number;
	markerY: number;
	labelY: number;
	startLabel: string;
	endLabel: string;
}

const TIMELINE = { left: 49, inset: 43, labelRight: 38, top: 12, tick: 22, tickGap: 4, dot: 9.25, marker: 7.8, label: 28.1, bottom: 36, rightGap: 12.7 };
/** The space between stage lines: the score page's chart, and the factor pages' shorter one. */
export const LEVEL = { score: 38.45, factor: 28.4 };
const LEVEL_OF: Record<Stage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };
const STAGE_LABEL = ["Awake", "REM", "Light", "Deep"];

export function timelinePlot(t: Timeline, overlay: TimelineOverlay | null, width: number, level: number): TimelinePlot {
	const f = TIMELINE;
	const left = f.left;
	const right = Math.max(left + 60, width - f.inset);
	const span = right - left;
	const baseline = f.top + 4 * level;
	const x = (fraction: number) => left + fraction * span;

	const bars = t.bars.map((b) => {
		const y = f.top + LEVEL_OF[b.stage] * level;
		return { x: r2(x(b.x0)), y: r2(y), w: r2(Math.max(0.6, (b.x1 - b.x0) * span)), h: r2(baseline - y), stage: b.stage };
	});

	const ticks: TimelinePlot["ticks"] = [];
	if (overlay?.kind === "awake") {
		for (const [at, count] of overlay.ticks ?? []) {
			const px = r2(Math.round(x(at)));
			for (let k = 0; k < Math.min(4, Math.max(1, Math.round(count))); k++) {
				ticks.push({ x: px, y: r2(baseline - (k + 1) * f.tick - k * f.tickGap), h: f.tick });
			}
		}
	}

	let line: string | undefined;
	const rightLabels: TimelinePlot["rightLabels"] = [];
	if (overlay && overlay.kind !== "awake" && overlay.axis) {
		const axis = overlay.axis;
		const lo = axis[0]!;
		const hi = axis[axis.length - 1]!;
		const y = (v: number) => baseline - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * (baseline - f.top);
		line = pathOf(overlay.points.map(([px, v]) => [x(px), v === null ? null : y(v)]));
		// Bottom first: the baseline, then the four stage lines.
		axis.forEach((_, i) => {
			const text = overlay.labels?.[i] ?? "";
			if (text) rightLabels.push({ y: r2(baseline - (i / (axis.length - 1)) * (baseline - f.top)), text });
		});
	}

	return {
		width,
		height: baseline + f.bottom,
		left,
		right: r2(right),
		baseline: r2(baseline),
		labelRight: f.labelRight,
		grid: STAGE_LABEL.map((label, k) => ({ y: r2(f.top + k * level), label })),
		bars,
		ticks,
		...(line ? { line } : {}),
		rightX: r2(right + f.rightGap),
		rightLabels,
		hours: t.hours.map((h) => r2(x(h))),
		dotY: r2(baseline + f.dot),
		markerY: r2(baseline + f.marker),
		labelY: r2(baseline + f.label),
		startLabel: t.startLabel,
		endLabel: t.endLabel,
	};
}

/** A polyline through the points, broken wherever a value is missing. */
function pathOf(points: ReadonlyArray<[number, number | null]>): string {
	let d = "";
	let pen = false;
	for (const [px, py] of points) {
		if (py === null) {
			pen = false;
			continue;
		}
		d += `${pen ? "L" : "M"}${r2(px)} ${r2(py)} `;
		pen = true;
	}
	return d.trim();
}

/* ------------------------------------------------------------------ */
/*  Sleep-time stress                                                  */
/* ------------------------------------------------------------------ */

export interface StressPlot {
	width: number;
	height: number;
	left: number;
	right: number;
	baseline: number;
	labelRight: number;
	grid: Array<{ y: number; label: string; line: boolean }>;
	/** One bar a reading, coloured by level. */
	bars: Array<{ x: number; y: number; w: number; h: number; tone: "rest" | "stress" }>;
	hours: number[];
	dotY: number;
	labelY: number;
}

const STRESS = { left: 46, inset: 35.3, labelRight: 37.7, top: 12, height: 137.2, dot: 24.4, label: 43, bottom: 51 };

export function stressPlot(points: ReadonlyArray<[number, number | null]>, hours: readonly number[], width: number): StressPlot {
	const f = STRESS;
	const right = Math.max(f.left + 60, width - f.inset);
	const span = right - f.left;
	const baseline = f.top + f.height;
	const x = (fraction: number) => f.left + fraction * span;
	const y = (v: number) => baseline - (Math.min(100, Math.max(0, v)) / 100) * f.height;
	const bars: StressPlot["bars"] = [];
	points.forEach(([px, v], i) => {
		if (v === null) return;
		const next = points[i + 1]?.[0] ?? Math.min(1, px + 0.006);
		const top = y(Math.max(v, 1));
		bars.push({ x: r2(x(px)), y: r2(top), w: r2(Math.max(0.6, (next - px) * span)), h: r2(baseline - top), tone: v > 25 ? "stress" : "rest" });
	});
	return {
		width,
		height: baseline + f.bottom,
		left: f.left,
		right: r2(right),
		baseline: r2(baseline),
		labelRight: f.labelRight,
		grid: [100, 75, 50, 25, 0].map((v) => ({ y: r2(y(v)), label: String(v), line: v > 0 })),
		bars,
		hours: hours.map((h) => r2(x(h))),
		dotY: r2(baseline + f.dot),
		labelY: r2(baseline + f.label),
	};
}

/* ------------------------------------------------------------------ */
/*  Stages ring                                                        */
/* ------------------------------------------------------------------ */

/** The ring's arcs, clockwise from twelve o'clock, a hair of gap between stages. */
export function ringArcs(segments: ReadonlyArray<{ stage: Stage; fraction: number }>, size = 166, thickness = 5.7): Array<{ d: string; stage: Stage }> {
	const gap = 0.0192;
	const r = size / 2 - thickness / 2;
	const c = size / 2;
	const out: Array<{ d: string; stage: Stage }> = [];
	let angle = -Math.PI / 2;
	const shown = segments.filter((s) => s.fraction > 0);
	for (const s of shown) {
		const sweep = s.fraction * 2 * Math.PI;
		const a0 = angle + (shown.length > 1 ? gap / 2 : 0);
		const a1 = angle + sweep - (shown.length > 1 ? gap / 2 : 0);
		angle += sweep;
		if (a1 <= a0) continue;
		if (a1 - a0 >= 2 * Math.PI - 1e-6) {
			out.push({ d: `M${r2(c)} ${r2(c - r)} A${r2(r)} ${r2(r)} 0 1 1 ${r2(c - 0.01)} ${r2(c - r)}`, stage: s.stage });
			continue;
		}
		const p = (a: number) => `${r2(c + r * Math.cos(a))} ${r2(c + r * Math.sin(a))}`;
		out.push({ d: `M${p(a0)} A${r2(r)} ${r2(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`, stage: s.stage });
	}
	return out;
}

/* ------------------------------------------------------------------ */
/*  Sleep need                                                         */
/* ------------------------------------------------------------------ */

export interface NeedPlot {
	width: number;
	start: number;
	need: number;
	baseline?: number;
	needLabel: string;
	baselineLabel?: string;
}

/** The larger of need and baseline spans the bar; the other sits in proportion. */
export function needPlot(coach: CoachView, baselineLabel: string | undefined): NeedPlot {
	const width = 190.8;
	const top = Math.max(coach.needMinutes, coach.baselineMinutes ?? 0) || 1;
	const at = (minutes: number) => r2((minutes / top) * width);
	const adjusted = coach.baselineMinutes !== undefined && coach.baselineMinutes !== coach.needMinutes;
	return {
		width,
		start: 0,
		need: at(coach.needMinutes),
		...(adjusted ? { baseline: at(coach.baselineMinutes!), ...(baselineLabel ? { baselineLabel } : {}) } : {}),
		needLabel: coach.need,
	};
}

/* ------------------------------------------------------------------ */
/*  Sleep alignment                                                    */
/* ------------------------------------------------------------------ */

export interface AlignmentPlot {
	width: number;
	left: number;
	right: number;
	last?: { x1: number; x2: number; mid: number };
	internal: { x1: number; x2: number; mid: number };
	target: { x1: number; x2: number };
	dots: Array<{ x: number; large: boolean }>;
	labels: Array<{ x: number; text: string }>;
}

/** Twelve hours across the tracks, starting six before the internal rhythm's midpoint. */
export function alignmentPlot(a: AlignmentView, width: number): AlignmentPlot {
	const left = 16;
	const right = Math.max(left + 120, width - 16);
	const perMinute = (right - left) / 720;
	const x = (minutes: number) => r2(Math.max(left, Math.min(right, left + (minutes - a.axisStart) * perMinute)));
	const dots: AlignmentPlot["dots"] = [];
	const labels: AlignmentPlot["labels"] = [];
	for (let m = 0; m <= 720; m += 30) {
		const large = m % 120 === 0;
		dots.push({ x: r2(left + m * perMinute), large });
		if (large) labels.push({ x: r2(left + m * perMinute), text: hourText(a.axisStart + m) });
	}
	const plot: AlignmentPlot = {
		width,
		left,
		right: r2(right),
		internal: { x1: x(a.internal.start), x2: x(a.internal.end), mid: x(a.internal.mid) },
		target: { x1: x(a.internal.mid - 60), x2: x(a.internal.mid + 60) },
		dots,
		labels,
	};
	if (a.last) plot.last = { x1: x(a.last.start), x2: x(a.last.end), mid: x(a.last.mid) };
	return plot;
}

function hourText(minutesFromMidnight: number): string {
	const h = ((Math.round(minutesFromMidnight / 60) % 24) + 24) % 24;
	return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

/* ------------------------------------------------------------------ */
/*  Weeks, four weeks and years                                        */
/* ------------------------------------------------------------------ */

type PeriodRange = SleepPeriodView["range"];

interface PeriodFrame {
	left: number;
	inset: number;
	labelRight: number;
	height: number;
}

/** The x axis under a period chart: dots and two dates, or a year's months on their side. */
export interface AxisPlot {
	dots: Array<{ x: number; y: number; r: number }>;
	labels: Array<{ x: number; y: number; text: string; rotated: boolean }>;
}

function axisPlot(axis: XAxis, x: (fraction: number) => number, baseline: number, months: boolean): AxisPlot {
	if (months) {
		return {
			dots: axis.dots.map((d) => ({ x: r2(x(d.x)), y: r2(baseline + 17.3), r: 3.85 })),
			labels: axis.labels.map((l) => ({ x: r2(x(l.x)), y: r2(baseline + 29), text: l.text, rotated: true })),
		};
	}
	return {
		dots: axis.dots.map((d) => ({ x: r2(x(d.x)), y: r2(baseline + 9.5), r: d.large ? LARGE_DOT : SMALL_DOT })),
		labels: axis.labels.map((l) => ({ x: r2(x(l.x)), y: r2(baseline + 23.3), text: l.text, rotated: false })),
	};
}

/** Below the plot: the dot row and dates, or the months standing up. */
const AXIS_ROOM = { days: 32, months: 52 };

export interface ScorePlot {
	width: number;
	height: number;
	left: number;
	right: number;
	baseline: number;
	labelRight: number;
	grid: Array<{ y: number; label: string }>;
	line: string;
	dots: Array<{ x: number; y: number }>;
	dotRadius: number;
	overlay?: {
		id: PeriodOverlay["id"];
		kind: PeriodOverlay["kind"];
		line?: string;
		marks: Array<{ x: number; y: number; status?: string }>;
		labels: Array<{ y: number; text: string }>;
		labelX: number;
	};
	axis: AxisPlot;
}

const SCORE_FRAME: Record<PeriodRange, PeriodFrame> = {
	"7d": { left: 54.7, inset: 50.7, labelRight: 44.3, height: 173.6 },
	"4w": { left: 54.7, inset: 50.7, labelRight: 44.3, height: 173.6 },
	"1y": { left: 47, inset: 43, labelRight: 40, height: 164.5 },
};
const PLOT_TOP = 8;

export function scorePlot(view: SleepPeriodView, overlay: PeriodOverlay | null, width: number): ScorePlot {
	const f = SCORE_FRAME[view.range];
	const right = Math.max(f.left + 60, width - f.inset);
	const span = right - f.left;
	const baseline = PLOT_TOP + f.height;
	const x = (fraction: number) => f.left + fraction * span;
	const y = (v: number) => baseline - (Math.min(100, Math.max(0, v)) / 100) * f.height;
	const points = view.score.points.filter((p): p is { x: number; value: number } => p.value !== null);
	const plot: ScorePlot = {
		width,
		height: baseline + (view.range === "1y" ? AXIS_ROOM.months : AXIS_ROOM.days),
		left: f.left,
		right: r2(right),
		baseline,
		labelRight: f.labelRight,
		grid: [100, 75, 50, 25, 0].map((v) => ({ y: r2(y(v)), label: String(v) })),
		// A night without a score breaks the line rather than bridging it.
		line: pathOf(view.score.points.map((p) => [x(p.x), p.value === null ? null : y(p.value)])),
		dots: view.score.dots ? points.map((p) => ({ x: r2(x(p.x)), y: r2(y(p.value)) })) : [],
		dotRadius: view.range === "7d" ? 4 : 2.5,
		axis: axisPlot(view.score.axis, x, baseline, view.range === "1y"),
	};
	if (overlay) {
		const lo = overlay.axis[0]!;
		const hi = overlay.axis[overlay.axis.length - 1]!;
		const oy = (v: number) => baseline - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * f.height;
		const marks = overlay.points.map((p) => ({ x: r2(x(p.x)), y: r2(oy(p.value)), ...(p.status ? { status: p.status } : {}) }));
		plot.overlay = {
			id: overlay.id,
			kind: overlay.kind,
			...(overlay.kind === "squares" ? { line: pathOf(marks.map((m) => [m.x, m.y])) } : {}),
			marks,
			labels: overlay.axis
				.map((_, i) => ({ y: r2(baseline - (i / (overlay.axis.length - 1)) * f.height), text: overlay.labels[i] ?? "" }))
				.filter((l) => l.text),
			labelX: r2(right + 13.7),
		};
	}
	return plot;
}

export interface DurationPlot {
	width: number;
	height: number;
	left: number;
	right: number;
	baseline: number;
	labelRight: number;
	grid: Array<{ y: number; label: string }>;
	bars: Array<{ kind: "met" | "need" | "duration"; d: string }>;
	axis: AxisPlot;
}

const DURATION_FRAME: Record<PeriodRange, PeriodFrame & { bar: number; reach: number }> = {
	"7d": { left: 63.3, inset: 51.7, labelRight: 43.7, height: 180, bar: 15.4, reach: 7.6 },
	"4w": { left: 63.3, inset: 51.7, labelRight: 43.7, height: 180, bar: 5, reach: 7.6 },
	"1y": { left: 55.7, inset: 51.7, labelRight: 39.7, height: 164.5, bar: 4, reach: 4.6 },
};

/**
 * Duration against need, a bar a night or week. A met need is one green bar;
 * a missed one is the need in grey with the duration in blue over it.
 */
export function durationPlot(view: SleepPeriodView, width: number): DurationPlot {
	const f = DURATION_FRAME[view.range];
	const right = Math.max(f.left + 60, width - f.inset);
	const baseline = PLOT_TOP + f.height;
	const ticks = view.duration.ticks;
	const top = ticks[ticks.length - 1] || 12;
	const x = (fraction: number) => f.left + fraction * (right - f.reach - f.left);
	const y = (hours: number) => baseline - (Math.min(top, Math.max(0, hours)) / top) * f.height;
	const r = f.bar / 2;
	const bars: DurationPlot["bars"] = [];
	for (const b of view.duration.bars) {
		const cx = x(b.x) - r;
		if (b.met || b.need === null) {
			bars.push({ kind: b.met ? "met" : "duration", d: roundedBar(cx, y(b.hours), f.bar, baseline - y(b.hours), r, "top") });
			continue;
		}
		const needTop = y(b.need);
		bars.push({ kind: "need", d: roundedBar(cx, needTop, f.bar, baseline - needTop, r, "top") });
		bars.push({ kind: "duration", d: roundedBar(cx, y(b.hours), f.bar, baseline - y(b.hours), r, "top") });
	}
	return {
		width,
		height: baseline + (view.range === "1y" ? AXIS_ROOM.months : AXIS_ROOM.days),
		left: f.left,
		right: r2(right),
		baseline,
		labelRight: f.labelRight,
		grid: ticks
			.slice(1)
			.reverse()
			.map((t) => ({ y: r2(y(t)), label: `${Number.isInteger(t) ? t : t.toFixed(1)}h` })),
		bars,
		axis: axisPlot(view.duration.axis, x, baseline, view.range === "1y"),
	};
}

export interface TimesPlot {
	width: number;
	height: number;
	left: number;
	right: number;
	bottom: number;
	labelRight: number;
	grid: Array<{ y: number; label: string }>;
	bars: Array<{ d: string; aligned: boolean }>;
	avgBed?: number;
	avgWake?: number;
	axis: AxisPlot;
}

const TIMES_FRAME: Record<PeriodRange, PeriodFrame & { bar: number }> = {
	"7d": { left: 65.3, inset: 50.3, labelRight: 54.7, height: 194.4, bar: 7.7 },
	"4w": { left: 65.3, inset: 50.3, labelRight: 54.7, height: 194.4, bar: 4 },
	"1y": { left: 62.3, inset: 50.3, labelRight: 47.3, height: 164.5, bar: 4 },
};

/** Bed to wake, a bar a night or week, on sixteen hours from the axis' top hour. */
export function timesPlot(view: SleepPeriodView, width: number): TimesPlot {
	const f = TIMES_FRAME[view.range];
	const right = Math.max(f.left + 60, width - f.inset);
	const top = PLOT_TOP;
	const bottom = top + f.height;
	const startSeconds = view.times.top * 3600;
	const x = (fraction: number) => f.left + fraction * (right - f.left);
	const yRaw = (seconds: number) => top + ((seconds - startSeconds) / (16 * 3600)) * f.height;
	const clamp = (v: number) => Math.min(bottom, Math.max(top, v));
	const bars: TimesPlot["bars"] = [];
	for (const b of view.times.bars) {
		const y1 = clamp(yRaw(b.bed));
		const y2 = clamp(yRaw(b.wake));
		if (y2 - y1 < 1) continue;
		bars.push({ d: pill(x(b.x) - f.bar / 2, y1, f.bar, y2 - y1), aligned: b.aligned });
	}
	const plot: TimesPlot = {
		width,
		height: bottom + (view.range === "1y" ? AXIS_ROOM.months : AXIS_ROOM.days),
		left: f.left,
		right: r2(right),
		bottom,
		labelRight: f.labelRight,
		grid: [0, 1, 2, 3, 4].map((k) => ({ y: r2(top + (k / 4) * f.height), label: view.times.labels[k] ?? "" })),
		bars,
		axis: axisPlot(view.times.axis, x, bottom, view.range === "1y"),
	};
	if (view.times.avgBed !== undefined) {
		const yb = yRaw(view.times.avgBed);
		if (yb >= top && yb <= bottom) plot.avgBed = r2(yb);
	}
	if (view.times.avgWake !== undefined) {
		const yw = yRaw(view.times.avgWake);
		if (yw >= top && yw <= bottom) plot.avgWake = r2(yw);
	}
	return plot;
}

/** A bar rounded at both ends. */
function pill(x: number, y: number, w: number, h: number): string {
	const r = Math.min(w / 2, h / 2);
	return (
		`M${r2(x)} ${r2(y + r)} A${r2(r)} ${r2(r)} 0 0 1 ${r2(x + w)} ${r2(y + r)} ` +
		`V${r2(y + h - r)} A${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(y + h - r)} Z`
	);
}
