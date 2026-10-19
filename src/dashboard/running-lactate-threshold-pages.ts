import type { AccountInfo } from "../sync/account";
import type { FtpRow } from "../sync/ftp-index";
import type { LactateThresholdRow } from "../sync/lactate-threshold-index";
import { SHORT_MONTHS, addMonths, axisDay, canStepBack, dayAxis, daysBetween, daysOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { CHART_TITLE, CURRENT_COPY, CURRENT_COPY_LINES, CURRENT_TITLE, ltHelp, type HelpReadings } from "./running-lactate-threshold-copy";
import { duration, shiftDate } from "./series";
import type { ChipRule } from "./stat-controls";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { NO_DATA, type HelpSection } from "./training-status-copy";

/**
 * Garmin Connect's Running Lactate Threshold page (Performance Stats), worked
 * out from the lactate threshold index (`src/sync/lactate-threshold-index.ts`:
 * heart rate and speed), the FTP index's running power (`ftp-index.ts`:
 * `running`, `runningWkg`) and `account.json`. Rules measured on the phone on
 * 2026-10-11 and proved against the web and the API
 * (ref/performance-stats/running-lactate-threshold/README.md):
 *
 * - Current is the account's latest values, however old, with no date and
 *   no "Based On": heart rate as sent ("182 bpm"); pace from the speed,
 *   1000 ÷ speed rounded half up to the second (268.658 s → "4:29 /km";
 *   flooring gives 4:28); power in whole watts ("354 W"); W/kg to 2 dp
 *   ("5.21 W/kg"). A 2 × 2 grid filled row by row: Heart Rate, Pace, Power,
 *   Power (W/kg), each with its series' glyph. It is not a day stepper.
 * - 4w, 12w and 1y draw heart rate on the left axis, always, and the chip's
 *   series on the right: Pace (inverted, the fastest at the top, linear in
 *   s/km), Power (W) or Power (W/kg). The chips are single-select with one
 *   always on; the title stays "Heart Rate".
 * - Points are change rows, each plotted at its own day with a marker
 *   (circle, square, triangle, diamond), joined straight: 4w every row of
 *   the period; 12w each 7-day block's last row, blocks from the period's
 *   first day; 1y each calendar month's last row inside the period. Heart
 *   rate and the chip's series are picked separately, each from its own
 *   rows. Nothing is carried in from before the period, nothing runs on to
 *   today: a lone point is a lone marker.
 * - Each y axis has five gridlines a, a + s, …, a + 4s from its own points:
 *   lo and hi padded ±2.5 when flat, else 5 % of the range each side; s the
 *   first of 1, 2, 5 × 10ᵏ (at least 5 for bpm, s/km and W, 1 for W/kg) for
 *   which a = ⌊lo / s⌋·s reaches hi with a + 4s. That gives all twelve of the
 *   phone's axes, "195 … 175" to "10 8 6 4 2" (one flat W/kg) and "420 … 340".
 * - The x axis: 4w a dot a day with "MM-DD" ends; 12w a large dot on each of
 *   the 12 block starts and on today, "MM-DD" on end; 1y 13 large dots at
 *   today − 12 months + k, the month's name on end, the first 2 days left of
 *   the period's first day.
 *
 * Inferred (unseen on the phone):
 *
 * - 12w's block-last rule: no block of the shots holds two rows, so "the
 *   block's last" (Garmin's weekly route) can't be told from "every row";
 *   12w −1's Jun 29 – Jul 5 block (185, then 184) would show it.
 * - Each range opens on Pace (`movedRoute`); a period step keeps the chip.
 * - Previous periods by the registry's default spans; "<" while either
 *   index is still coming or holds a row before the period.
 * - Empty states: a series without a point leaves its side unlabelled
 *   (y null) while the other draws; neither one is the web's "You have no
 *   data for this time period."; Current's "--" for a value it lacks.
 * - Imperial: pace a mile, the same rules on s/mi (Current "7:12 /mi").
 * - The Help sheet: the web dialog's, with Current's numbers.
 *
 * The chart's geometry is `running-lactate-threshold-charts.ts`, off the
 * Obsidian twin (Figma page 430:6126).
 *
 * Pure.
 */

/** The page's series: heart rate, always on the left, and the three the chips put on the right. */
export type LtSeriesId = "hr" | "pace" | "power" | "wkg";

/** A chip: the right-hand series. */
export type LtChipId = Exclude<LtSeriesId, "hr">;

/** A series' glyph: `ShapeMarker`'s shapes. */
export type LtShape = "circle" | "square" | "triangle" | "diamond";

/** The settings' units: pace a kilometre, or a mile. */
export type LtUnits = "metric" | "imperial";

export interface LtSeriesDef {
	id: LtSeriesId;
	/** As the legend, the chips and Current name it. */
	label: string;
	/** Its glyph on Current, on the chart, in the legend. */
	shape: LtShape;
	/** The least step its y axis takes: 5 bpm, 5 s, 5 W, 1 W/kg. */
	minStep: number;
	/** Pace: the fastest, the smallest value, at the top. */
	inverted: boolean;
}

/**
 * The four series. Garmin colours heart rate #EE3E3E, pace #1976D2 and both
 * powers #CC1DC1; the twin binds them to the theme's colours.
 */
export const LT_SERIES: Readonly<Record<LtSeriesId, LtSeriesDef>> = {
	hr: { id: "hr", label: "Heart Rate", shape: "circle", minStep: 5, inverted: false },
	pace: { id: "pace", label: "Pace", shape: "square", minStep: 5, inverted: true },
	power: { id: "power", label: "Power", shape: "triangle", minStep: 5, inverted: false },
	wkg: { id: "wkg", label: "Power (W/kg)", shape: "diamond", minStep: 1, inverted: false },
};

/** The chips in the phone's order: "Pace" · "Power" · "Power (W/kg)". */
export const LT_CHIPS: readonly LtChipId[] = ["pace", "power", "wkg"];

/** How the chips behave: one on at a time, and one always on. `StatChips` takes it as is. */
export const LT_CHIP_RULE: Required<ChipRule> = { multi: false, required: true };

/** The number in a Current cell without a value (Inferred). */
export const DASH = "--";

export const METRES_PER_MILE = 1609.344;

/** 12w's blocks, from the period's first day. */
export const BLOCK_DAYS = 7;

/** A flat series is padded this much each way before its axis is cut: the shots allow (2, 3.21]. */
export const FLAT_PAD = 2.5;

/** Any other is padded this share of its range each side: the shots allow (0, 5.18 %]. */
export const RANGE_PAD = 0.05;

/* ------------------------------------------------------------------ */
/*  The route: the chip                                                */
/* ------------------------------------------------------------------ */

/** The chip a route's `sub` names: Power or Power (W/kg), else Pace. */
export function ltChip(sub: string | undefined): LtChipId {
	return sub === "power" || sub === "wkg" ? sub : "pace";
}

/** The route on a chip: the chips' tap. Pace has no `sub`; the range and the period stay. */
export function withLtChip<R extends { sub?: string }>(route: R, chip: LtChipId): R {
	const { sub: _sub, ...rest } = route;
	return (chip === "pace" ? rest : { ...rest, sub: chip }) as R;
}

/**
 * Where the shell's range control and steppers move the page: a period step
 * keeps the chip, a range switch opens on Pace (Inferred: the first 12w and
 * 1y shots show Pace, though the shot before each was on W/kg). The shell
 * keeps `sub` itself, so the page drops it as it moves (FTP's way).
 */
export function movedRoute<R extends { range: string; sub?: string }>(from: { range: string }, next: R): R {
	return next.range !== from.range ? withLtChip(next, "pace") : next;
}

/* ------------------------------------------------------------------ */
/*  Paces                                                              */
/* ------------------------------------------------------------------ */

/** A speed's pace, seconds a kilometre or a mile, unrounded: 3.7222118 m/s → 268.658 s/km. */
export function paceOf(speed: number, units: LtUnits): number {
	return (units === "imperial" ? METRES_PER_MILE : 1000) / speed;
}

/** A pace's words: m:ss, rounded half up to the second (268.658 → "4:29"; 431.97 s/mi → "7:12"). */
export function paceText(seconds: number): string {
	return duration(seconds);
}

/** The pace's unit after the number: "/km" or "/mi". */
export function paceUnit(units: LtUnits): string {
	return units === "imperial" ? "/mi" : "/km";
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

/** What Current reads of `account.json`: the latest threshold, and the running power with its W/kg. */
export type LtAccount = Pick<AccountInfo, "lactateThreshold" | "ftp">;

/** A cell of Current's grid: "182" "bpm", glyph, "Heart Rate". */
export interface LtCell {
	id: LtSeriesId;
	/** "182", "4:29", "354", "5.21"; "--" without a value (Inferred). */
	value: string;
	/** "bpm", "/km" (or "/mi"), "W", "W/kg". */
	unit: string;
	label: string;
	shape: LtShape;
}

const cell = (id: LtSeriesId, value: string, unit: string): LtCell => ({ id, value, unit, label: LT_SERIES[id].label, shape: LT_SERIES[id].shape });

/**
 * Current's four cells, row by row: the account's latest threshold heart
 * rate and pace (from its speed: account.json's 3.722 m/s gives 4:29 as the
 * route's 3.7222118 does) and the running power and W/kg Garmin keeps with
 * the FTPs. No date and no staleness: the newest values, however old.
 */
export function currentCells(account: LtAccount | null | undefined, units: LtUnits = "metric"): LtCell[] {
	const lt = account?.lactateThreshold;
	const power = account?.ftp?.running;
	const speed = lt?.speed;
	return [
		cell("hr", lt?.heartRate !== undefined ? String(lt.heartRate) : DASH, "bpm"),
		cell("pace", speed !== undefined && speed > 0 ? paceText(paceOf(speed, units)) : DASH, paceUnit(units)),
		cell("power", power?.watts !== undefined ? String(Math.round(power.watts)) : DASH, "W"),
		cell("wkg", power?.wattsPerKg !== undefined ? power.wattsPerKg.toFixed(2) : DASH, "W/kg"),
	];
}

/** Current's numbers as the Help's sentence words them: "182 bpm", "4:29 /km", "354 Watts". */
export function helpReadings(cells: readonly LtCell[]): HelpReadings {
	const of = (id: LtSeriesId) => cells.find((c) => c.id === id)!;
	return {
		heartRate: `${of("hr").value} bpm`,
		pace: `${of("pace").value} ${of("pace").unit}`,
		power: `${of("power").value} Watts`,
	};
}

/** The Help sheet, its "About Your Readings" from the account's Current. */
export function runningLactateThresholdHelp(account: LtAccount | null | undefined, units: LtUnits = "metric"): { title: string; sections: readonly HelpSection[] } {
	return ltHelp(helpReadings(currentCells(account, units)));
}

export interface LtCurrentView {
	range: "1d";
	/** Current has no period row. */
	label: null;
	canGoBack: false;
	/** "Your current threshold". */
	title: string;
	/** The copy as one paragraph, and as the two lines the page sets it in. */
	copy: string;
	copyLines: readonly string[];
	/** Heart Rate, Pace, Power, Power (W/kg): the 2 × 2 grid, row by row. */
	cells: LtCell[];
}

/** Current, from the account alone: nothing is fetched on view. */
export function currentView(account: LtAccount | null | undefined, units: LtUnits = "metric"): LtCurrentView {
	return {
		range: "1d",
		label: null,
		canGoBack: false,
		title: CURRENT_TITLE,
		copy: CURRENT_COPY,
		copyLines: CURRENT_COPY_LINES,
		cells: currentCells(account, units),
	};
}

/* ------------------------------------------------------------------ */
/*  Points                                                             */
/* ------------------------------------------------------------------ */

/** A dated value of one series, before a period picks its points. */
export interface LtValue {
	date: string;
	value: number;
}

/** What the indexes hold for the page. */
export interface LtData {
	/** The lactate threshold index's rows: heart rate and speed. */
	lt: readonly LactateThresholdRow[];
	/** The FTP index's rows: `running` and `runningWkg` are this page's power. */
	power: readonly FtpRow[];
}

/**
 * A series' values, oldest first, as plotted: bpm as sent, pace unrounded
 * (seconds a km, or a mile), W whole, W/kg to 4 dp. A row without the
 * series' value gives none.
 */
export function seriesValues(id: LtSeriesId, data: LtData, units: LtUnits = "metric"): LtValue[] {
	const out: LtValue[] = [];
	if (id === "hr" || id === "pace") {
		for (const row of data.lt) {
			if (id === "hr" && row.hr !== undefined) out.push({ date: row.date, value: row.hr });
			if (id === "pace" && row.speed !== undefined && row.speed > 0) out.push({ date: row.date, value: paceOf(row.speed, units) });
		}
	} else {
		for (const row of data.power) {
			const value = id === "power" ? row.running : row.runningWkg;
			if (value !== undefined) out.push({ date: row.date, value });
		}
	}
	return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** How a range picks its points: every row, each 7-day block's last, each calendar month's last. */
export type LtPick = "every" | "block" | "month";

/** 4w every row; 12w each block's last; 1y each month's last. */
export const RANGE_PICK: Readonly<Record<LtRange, LtPick>> = { "4w": "every", "12w": "block", "1y": "month" };

/** A point of a series. */
export interface LtPoint {
	/** The row's day: every point is drawn at its own day. */
	date: string;
	/** Across the plot: 0 on the period's first day, 1 on its last. */
	x: number;
	value: number;
}

/**
 * A period's points of one series, at their own days: `every` row in the
 * span; the last row of each 7-day `block` counted from the span's first
 * day (Garmin's weekly route over the same window); the last row of each
 * calendar `month` inside the span (Garmin's monthly, clipped to the window
 * at both ends). Nothing comes in from before the span.
 */
export function pickPoints(pick: LtPick, values: readonly LtValue[], span: Span): LtPoint[] {
	const last = Math.max(1, daysBetween(span.from, span.to));
	const inSpan = [...values]
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
		.filter((v) => v.date >= span.from && v.date <= span.to && Number.isFinite(v.value));
	let picked: LtValue[] = inSpan;
	if (pick !== "every") {
		const keyOf = (date: string) => (pick === "block" ? String(Math.floor(daysBetween(span.from, date) / BLOCK_DAYS)) : date.slice(0, 7));
		const lastOf = new Map<string, LtValue>();
		for (const v of inSpan) lastOf.set(keyOf(v.date), v);
		picked = [...lastOf.values()];
	}
	return picked.map((v) => ({ date: v.date, x: daysBetween(span.from, v.date) / last, value: v.value }));
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/** A y axis: five gridlines a, a + s, …, a + 4s. */
export interface LtYAxis {
	/** a, the lowest gridline's value. */
	min: number;
	/** s. */
	step: number;
	/** a + 4s. */
	max: number;
	/** The gridlines' values, top first: a + 4s … a; pace a … a + 4s, the fastest at the top. */
	ticks: number[];
	/** Their labels, top first: "195" … "175", "4:25" … "4:45", "10" … "2". */
	labels: string[];
}

const STEPS = [1, 2, 5];
/** Floating-point slack when a + 4s meets the padded top exactly. */
const EPS = 1e-9;

/**
 * The step: the first of 1, 2, 5 × 10ᵏ, `least` or more, for which
 * a = ⌊lo / s⌋·s reaches `hi` with a + 4s. [179.5, 184.5] → 5;
 * [2.71, 7.71] → 1 fails (2 + 4 < 7.71), so 2; [240.06, 274.28] → 5 fails,
 * so 10; [348.05, 390.95] → 10 fails (at 380), so 20.
 */
export function axisStep(lo: number, hi: number, least: number): number {
	for (let k = 0; ; k++) {
		for (const m of STEPS) {
			const s = m * 10 ** k;
			if (s < least) continue;
			if (Math.floor(lo / s) * s + 4 * s >= hi - EPS) return s;
		}
	}
}

/**
 * A series' y axis from the values it plots: lo and hi padded ±2.5 when
 * flat, else 5 % of the range each side (12w's 350–354 W → 345, where no pad
 * would give 350), then five gridlines a step apart from ⌊lo / s⌋·s. Null
 * without a value: that side of the chart has no labels.
 */
export function ltYAxis(id: LtSeriesId, values: readonly number[]): LtYAxis | null {
	const finite = values.filter((v) => Number.isFinite(v));
	if (!finite.length) return null;
	const series = LT_SERIES[id];
	let lo = Math.min(...finite);
	let hi = Math.max(...finite);
	if (lo === hi) {
		lo -= FLAT_PAD;
		hi += FLAT_PAD;
	} else {
		const pad = RANGE_PAD * (hi - lo);
		lo -= pad;
		hi += pad;
	}
	const step = axisStep(lo, hi, series.minStep);
	const min = Math.floor(lo / step) * step;
	const up = [0, 1, 2, 3, 4].map((k) => min + k * step);
	const ticks = series.inverted ? up : up.reverse();
	return { min, step, max: min + 4 * step, ticks, labels: ticks.map((t) => (id === "pace" ? paceText(t) : String(t))) };
}

/** A value's place on its axis: 0 at the top gridline, 1 at the bottom one (pace's fastest at the top). */
export function yFraction(axis: LtYAxis, value: number): number {
	const top = axis.ticks[0];
	const bottom = axis.ticks[axis.ticks.length - 1];
	const at = (value - top) / (bottom - top);
	// The top gridline's own value is 0, not the −0 a falling axis divides into.
	return at === 0 ? 0 : at;
}

/** The ranges with a chart. */
export type LtRange = "4w" | "12w" | "1y";

/**
 * The x axis, x 0 on the period's first day and 1 on its last: 4w a dot a
 * day, the ends large and labelled "MM-DD"; 12w a large dot on each 7-day
 * block's first day and on the last day, "07-20" … "10-05" "10-11", on end;
 * 1y a large dot at the last day − 12 months + k (k = 0…12), the month's
 * short name on end, the first falling before the period (x −2/363 on
 * 2026-10-11; −3/363 when the year back holds a Feb 29).
 */
export function ltXAxis(range: LtRange, span: Span): PeriodAxis {
	const days = daysOf(span);
	if (range === "4w") return dayAxis(days);
	const last = Math.max(1, days.length - 1);
	const x = (day: string) => daysBetween(span.from, day) / last;
	let marks: Array<{ day: string; text: string }>;
	if (range === "1y") {
		marks = Array.from({ length: 13 }, (_, k) => addMonths(span.to, k - 12)).map((day) => ({ day, text: SHORT_MONTHS[Number(day.slice(5, 7)) - 1] }));
	} else {
		const starts = Array.from({ length: Math.ceil(days.length / BLOCK_DAYS) }, (_, k) => shiftDate(span.from, BLOCK_DAYS * k));
		if (starts[starts.length - 1] !== span.to) starts.push(span.to);
		marks = starts.map((day) => ({ day, text: axisDay(day) }));
	}
	return {
		dots: marks.map((m) => ({ x: x(m.day), large: true })),
		labels: marks.map((m) => ({ x: x(m.day), text: m.text, rotated: true })),
	};
}

/* ------------------------------------------------------------------ */
/*  The chart                                                          */
/* ------------------------------------------------------------------ */

/** A series as the chart draws it. */
export interface LtLine {
	id: LtSeriesId;
	label: string;
	shape: LtShape;
	/** Oldest first: a marker on each, consecutive ones joined straight. */
	points: LtPoint[];
	/** Its side's axis; null without a point in the period, the side then unlabelled (Inferred). */
	y: LtYAxis | null;
}

export interface LtChart {
	/** Heart rate, on the left axis, with every chip. */
	left: LtLine;
	/** The chip's series, on the right axis. */
	right: LtLine;
	axis: PeriodAxis;
}

function lineOf(id: LtSeriesId, pick: LtPick, data: LtData, span: Span, units: LtUnits): LtLine {
	const series = LT_SERIES[id];
	const points = pickPoints(pick, seriesValues(id, data, units), span);
	return { id, label: series.label, shape: series.shape, points, y: ltYAxis(id, points.map((p) => p.value)) };
}

/** A range's chart for a chip; null when neither heart rate nor the chip's series has a point in the period. */
export function ltChart(range: LtRange, chip: LtChipId, data: LtData, span: Span, units: LtUnits = "metric"): LtChart | null {
	const pick = RANGE_PICK[range];
	const left = lineOf("hr", pick, data, span, units);
	const right = lineOf(chip, pick, data, span, units);
	if (!left.points.length && !right.points.length) return null;
	return { left, right, axis: ltXAxis(range, span) };
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

/** What the page's route says: the range, how many periods back, and the chip (`sub`). */
export interface LtRoute {
	range: PeriodRange;
	offset: number;
	sub?: string;
}

/** What the view needs besides the route and the indexes' rows. */
export interface LtContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** Each index's meta says it holds the whole history. */
	complete: { lt: boolean; power: boolean };
	/** `account.json`: Current's four numbers. */
	account?: LtAccount | null;
	/** Pace a kilometre, or a mile (Inferred). */
	units?: LtUnits;
}

/** A chip under the chart. */
export interface LtChipView {
	id: LtChipId;
	label: string;
	on: boolean;
}

/** A legend item: a series' glyph and name. */
export interface LtKey {
	id: LtSeriesId;
	label: string;
	shape: LtShape;
}

export interface LtPeriodView {
	range: LtRange;
	span: Span;
	/** "Sep 14 - Oct 11", "Jul 20 - Oct 11", "Oct 13, 2025 - Oct 11, 2026". */
	label: string;
	canGoBack: boolean;
	/** "Heart Rate", whichever chip is on. */
	title: string;
	/** The chip that is on: `StatChips`' `selected` is `[chip]`. */
	chip: LtChipId;
	chips: LtChipView[];
	/** Heart Rate, then the chip's series. */
	legend: LtKey[];
	/** The pace's unit, which the chart doesn't show: a kilometre, or a mile. */
	units: LtUnits;
	/** Null when neither series has a point in the period. */
	chart: LtChart | null;
	/** The line in the chart's place then; the legend and the chips stay. */
	empty?: string;
}

export type RunningLactateThresholdView = LtCurrentView | LtPeriodView;

/** The registry's Running Lactate Threshold: its ranges, on the default spans (4w 28 days, 12w 84, 1y 364). */
const LT_STAT = PERFORMANCE_REGISTRY.page("running-lactate-threshold")!;

/** The oldest day of the given rows, or none. */
function oldestOf(dates: Iterable<string>): string | undefined {
	let min: string | undefined;
	for (const date of dates) if (min === undefined || date < min) min = date;
	return min;
}

/** The page, on its route's range and chip: Current, or a period's chart. */
export function runningLactateThresholdView(route: LtRoute, data: LtData, ctx: LtContext): RunningLactateThresholdView {
	const units = ctx.units ?? "metric";
	if (route.range === "1d") return currentView(ctx.account, units);
	const range: LtRange = route.range === "12w" || route.range === "1y" ? route.range : "4w";
	const period = { range, offset: route.offset };
	const span = statSpan(LT_STAT, period, ctx.today)!;
	const chip = ltChip(route.sub);
	const ltOldest = oldestOf(data.lt.filter((r) => r.hr !== undefined || r.speed !== undefined).map((r) => r.date));
	const powerOldest = oldestOf(data.power.filter((r) => r.running !== undefined || r.runningWkg !== undefined).map((r) => r.date));
	const view: LtPeriodView = {
		range,
		span,
		label: statPeriodLabel(LT_STAT, period, ctx.today),
		// "<" stops once both indexes are whole and neither holds a row before the period.
		canGoBack: canStepBack(ltOldest, ctx.complete.lt, span.from) || canStepBack(powerOldest, ctx.complete.power, span.from),
		title: CHART_TITLE,
		chip,
		chips: LT_CHIPS.map((id) => ({ id, label: LT_SERIES[id].label, on: id === chip })),
		legend: (["hr", chip] as const).map((id) => ({ id, label: LT_SERIES[id].label, shape: LT_SERIES[id].shape })),
		units,
		chart: ltChart(range, chip, data, span, units),
	};
	if (!view.chart) view.empty = NO_DATA;
	return view;
}
