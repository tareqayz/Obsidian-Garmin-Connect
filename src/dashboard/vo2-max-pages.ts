import type { AccountInfo } from "../sync/account";
import type { Vo2MaxRow } from "../sync/vo2-max-index";
import { latestWith, num, shortDate } from "./day";
import { VO2_CLASSES, VO2_PERCENTILES, vo2Class, vo2Scale, type Gauge, type Sex, type Tone } from "./gauges";
import { canStepBack, dayAxis, daysBetween, daysOf, weekdayOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { healthStatRoute, type HealthStatRoute } from "./routes";
import type { DayRow } from "./series";
import { stepAxis, type AxisSteps } from "./stat-charts";
import { segmentsFromAngles } from "./stat-dial";
import { statPeriodLabel, statSpan } from "./stat-registry";

/**
 * Garmin Connect's VO₂ Max page (Performance Stats), worked out from the VO₂
 * max index (`src/sync/vo2-max-index.ts`), the newest chronological age in
 * the day files and the account's sex. Rules measured on the phone on
 * 2026-10-11 (ref/performance-stats/vo2-max/README.md):
 *
 * - Two tabs, "VO₂ Max" (running, `vo2`) and "Cycling" (`cycling`); every
 *   view reads only its tab's readings.
 * - Current shows the tab's newest reading however old (the cycling one is
 *   from 2025), labelled with its day: "Today", else "Wednesday, Oct 15",
 *   never with a year. It is not a day stepper: the route's offset is
 *   ignored, as `maxmet/latest/{date}` ignores its date.
 * - The dial's number is Garmin's integer (`vo2Value`: 55 for 54.9, so not
 *   floored); the class and the marker grade the precise value against the
 *   age-and-sex table (`vo2Scale`), on the page's own measured bands
 *   (`VO2_DIAL_BOUNDS`).
 * - 4w plots every reading of the period at its day; 12w and 6m cut the
 *   period into 7-day blocks from its first day and plot each block's last
 *   reading (not its highest, not its mean) at that reading's own day, which
 *   is Garmin's `maxmet/weekly` with its blocks from `{start}`. A block
 *   without a reading has no dot; the line joins the dots straight, and
 *   nothing comes in from before the period.
 * - The y axis is five whole numbers a step apart from the lowest dot's
 *   floor (58–54, 57–53, 57–53). The x axis runs from the period's first day
 *   to its last: 4w a dot a day, 12w every 7 days and the last day, 6m every
 *   36 days and the last day.
 * - Under the dial or the chart: "Your VO₂ Max is in the top 10% for your
 *   age and gender.", the tab's newest reading's, whatever the period; then
 *   "View Your Fitness Age", which opens Health Stats' Fitness Age page.
 *
 * Inferred (unseen on the phone): the Cycling tab's ranges and their empty
 * state, previous periods, the y axis past a spread of 4, the copy for Good,
 * Fair and Poor, "Yesterday", and Current without any reading.
 *
 * Pure.
 */

export type Vo2Tab = "running" | "cycling";

/** The tabs in the phone's order: the first is where the page opens. */
export const VO2_TABS: ReadonlyArray<{ id: Vo2Tab; label: string }> = [
	{ id: "running", label: "VO₂ Max" },
	{ id: "cycling", label: "Cycling" },
];

/** The web's line in place of a chart for a period without a reading. */
export const NO_DATA = "You have no data for this time period.";
/** Current without any reading of the tab's sport (Inferred: the app's own empty phrase). */
export const NO_READING = "No data available";
export const FITNESS_AGE_LINK = "View Your Fitness Age";

/** The dial: a 300° arc open at the bottom, running from 30° to 330° clockwise from straight down. */
export const VO2_DIAL = { start: 30, sweep: 300 } as const;

/**
 * The page's dial bands (twin 442:1349, kind "vo2"), as measured on both
 * Current shots: their boundaries in degrees from 12 o'clock, the gaps
 * centred 150.0°, 195.1°, 240.1° and 285.1° round from straight down. Poor
 * has 120° of the arc, the other classes 45° each. The page keeps its own:
 * At a Glance's card dial (`vo2Gauge`) owns its bands.
 */
export const VO2_DIAL_BOUNDS: readonly number[] = [-150, -30, 15, 60, 105, 150];
export const VO2_DIAL_TONES: readonly Tone[] = ["red", "orange", "green", "blue", "purple"];

/** What the page's route says: the range, how many periods back, the tab. */
export interface Vo2MaxRoute {
	range: PeriodRange;
	offset: number;
	tab?: string;
}

/** What the view needs besides the route and the index's rows. */
export interface Vo2MaxContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** The chronological age to grade for (`vo2Person`); without it there is no class. */
	age?: number;
	sex?: Sex;
}

/** One reading of a tab's sport. */
export interface Vo2Reading {
	date: string;
	/** The precise value, 1 dp: what the class, the marker and the charts use. */
	value: number;
	/** Garmin's integer: the dial's number. */
	shown: number;
}

/** Current: the tab's newest reading on the dial. */
export interface Vo2Dial {
	date: string;
	/** "Today", or "Wednesday, Oct 15". */
	label: string;
	/** The number, its class, the bands and the marker (`at`, a fraction of the arc, and its band's tone). */
	gauge: Gauge;
	/** The marker's centre, in degrees clockwise from straight down (30 at the arc's start); none without a class. */
	angle?: number;
}

export interface Vo2Point {
	date: string;
	/** Across the plot, 0 on the period's first day and 1 on its last. */
	x: number;
	value: number;
}

/** A 4w / 12w / 6m line. */
export interface Vo2Chart {
	points: Vo2Point[];
	/** The gridlines' values, top first. */
	ticks: number[];
	axis: PeriodAxis;
}

export interface Vo2MaxView {
	tab: Vo2Tab;
	/** The period row's label ("Sep 14 - Oct 11"); null on Current, which has no period row. */
	label: string | null;
	/** "<": older data exists, or may while the index is still coming. Never on Current. */
	canGoBack: boolean;
	/** Current's dial; null on a range, or without any reading. */
	dial: Vo2Dial | null;
	/** A range's line; null on Current, or for a period without a reading. */
	chart: Vo2Chart | null;
	/** The line in place of the dial or the chart when there is nothing to draw. */
	empty?: string;
	/** "Your VO₂ Max is in the top 10% for your age and gender.": the newest reading's, whatever the period. None without a class. */
	copy?: string;
	/** "View Your Fitness Age": Health Stats' Fitness Age page, opened on top. */
	link: { text: string; route: HealthStatRoute };
}

const VO2_STAT = PERFORMANCE_REGISTRY.page("vo2-max")!;

/** The tab a route names: Cycling, or the first. */
export function vo2Tab(tab: string | undefined): Vo2Tab {
	return tab === "cycling" ? "cycling" : "running";
}

/** A tab's readings, oldest first. A row with only Garmin's integer plots that; one without it shows the precise value rounded. */
export function readingsOf(rows: readonly Vo2MaxRow[], tab: Vo2Tab): Vo2Reading[] {
	const precise = tab === "cycling" ? "cycling" : "vo2";
	const integer = tab === "cycling" ? "cyclingValue" : "vo2Value";
	return rows.flatMap((row) => {
		const value = row[precise] ?? row[integer];
		return value === undefined ? [] : [{ date: row.date, value, shown: row[integer] ?? Math.round(value) }];
	});
}

/** Who a reading is graded for: the newest chronological age the day files hold up to today, and the account's sex. */
export function vo2Person(days: readonly DayRow[], account: Pick<AccountInfo, "sex"> | null | undefined, today: string): { age?: number; sex?: Sex } {
	const out: { age?: number; sex?: Sex } = {};
	const age = num(latestWith(days, today, "chronological_age"), "chronological_age");
	if (age !== undefined) out.age = age;
	if (account?.sex) out.sex = account.sex;
	return out;
}

/** Current's day: "Today", else "Wednesday, Oct 15", without a year even for last year's reading. */
export function readingLabel(date: string, today: string): string {
	return date === today ? "Today" : `${weekdayOf(date)}, ${shortDate(date)}`;
}

/**
 * A fraction of the dial as the marker's angle in degrees clockwise from
 * straight down, the spec's measure: 279.8° for 54.9, 296.25° for 57.4.
 * stat-dial.ts's `dialAngle` measures from 12 o'clock, 180° less.
 */
export function markerAngle(at: number): number {
	return VO2_DIAL.start + at * VO2_DIAL.sweep;
}

/**
 * The "top n%" a reading is in, for the copy. Its percentile is interpolated
 * between the classes' (the dial's low end 0, Fair 40, Good 60, Excellent 80,
 * Superior 95) and capped at 95; n is 100 less it, rounded up to a multiple of
 * 5. 54.9 for a man of 23 → 93.3 → 10; 57.4 → 95 → 5. Those two are what the
 * phone showed; "top 100 − the class's percentile" would have read "top 20%".
 * The other classes are Inferred.
 */
export function topPercent(value: number, scale: readonly number[]): number {
	const index = vo2Class(value, scale);
	const top = VO2_PERCENTILES.length - 1;
	let percentile = VO2_PERCENTILES[top]!;
	if (index < top) {
		const lo = scale[index]!;
		const hi = scale[index + 1]!;
		const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
		percentile = VO2_PERCENTILES[index]! + t * (VO2_PERCENTILES[index + 1]! - VO2_PERCENTILES[index]!);
	}
	return Math.max(5, Math.ceil((100 - percentile) / 5 - 1e-9) * 5);
}

/** "Your VO₂ Max is in the top 10% for your age and gender."; the Cycling tab's "Your Cycling VO₂ Max …". */
export function classCopy(tab: Vo2Tab, top: number): string {
	return `Your ${tab === "cycling" ? "Cycling " : ""}VO₂ Max is in the top ${top}% for your age and gender.`;
}

/**
 * A reading on the page's dial: Garmin's integer in the middle, the precise
 * value's class under it, and the marker placed linearly inside its class's
 * band, between the class's limits — or the scale's ends past Fair and
 * Superior. Without a scale (no age or sex) the number stands alone.
 */
export function vo2DialGauge(reading: Pick<Vo2Reading, "value" | "shown">, scale: readonly number[] | undefined): Gauge {
	const segments = segmentsFromAngles(VO2_DIAL_BOUNDS, VO2_DIAL_TONES);
	const value = String(reading.shown);
	if (!scale) return { value, segments };
	const index = vo2Class(reading.value, scale);
	const band = segments[index]!;
	const lo = scale[index]!;
	const hi = scale[index + 1]!;
	const t = Math.min(1, Math.max(0, (reading.value - lo) / (hi - lo)));
	return { value, label: VO2_CLASSES[index], segments, at: band.from + t * (band.to - band.from), tone: band.tone };
}

/** Current's dial for a reading. */
export function vo2Dial(reading: Vo2Reading, ctx: Pick<Vo2MaxContext, "today" | "age" | "sex">): Vo2Dial {
	const scale = ctx.age !== undefined && ctx.sex ? vo2Scale(ctx.age, ctx.sex) : undefined;
	const gauge = vo2DialGauge(reading, scale);
	const dial: Vo2Dial = { date: reading.date, label: readingLabel(reading.date, ctx.today), gauge };
	if (gauge.at !== undefined) dial.angle = markerAngle(gauge.at);
	return dial;
}

/**
 * 12w's and 6m's dots: the span cut into `size`-day blocks from its first
 * day, each block's last reading, at its own day. `maxmet/weekly/{start}/{end}`
 * is exactly this with the span `{start}..{end}`.
 */
export function blockReadings<T extends { date: string }>(readings: readonly T[], span: Span, size = 7): T[] {
	const last = new Map<number, T>();
	for (const reading of [...readings].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
		if (reading.date < span.from || reading.date > span.to) continue;
		last.set(Math.floor(daysBetween(span.from, reading.date) / size), reading);
	}
	return [...last.entries()].sort((a, b) => a[0] - b[0]).map(([, reading]) => reading);
}

/**
 * The y axis: five whole numbers a step apart, top first, the bottom one the
 * lowest dot's floor (4w's 54.7 → 58–54). The step is 1 in every shot; one of
 * 2 or more for dots spread over more than 4 is Inferred, so no dot falls off.
 */
export function vo2Ticks(values: readonly number[]): number[] {
	if (!values.length) return [];
	const bottom = Math.floor(Math.min(...values));
	const step = Math.max(1, Math.ceil((Math.max(...values) - bottom) / 4 - 1e-9));
	return [4, 3, 2, 1, 0].map((k) => bottom + k * step);
}

/** The x axis' days past 4w's one a day: `every` days from the first, `count` of them, then the last; the ends or all of them large and labelled. */
const X_TICKS: Partial<Record<PeriodRange, AxisSteps>> = {
	"12w": { every: 7, count: 12, labelled: "ends" },
	"6m": { every: 36, count: 5, labelled: "all" },
};

/** The x axis under a range's line, from the period's first day to its last. */
export function vo2Axis(range: PeriodRange, days: readonly string[]): PeriodAxis {
	const steps = X_TICKS[range];
	return steps ? stepAxis(days, steps) : dayAxis(days);
}

/** A range's line: 4w every reading, 12w and 6m each block's last; null for a period without one. */
export function vo2Chart(range: PeriodRange, readings: readonly Vo2Reading[], span: Span): Vo2Chart | null {
	const inSpan = readings.filter((r) => r.date >= span.from && r.date <= span.to);
	const shown = range === "4w" ? inSpan : blockReadings(inSpan, span);
	if (!shown.length) return null;
	const days = daysOf(span);
	const last = Math.max(1, days.length - 1);
	return {
		points: shown.map((r) => ({ date: r.date, x: daysBetween(span.from, r.date) / last, value: r.value })),
		ticks: vo2Ticks(shown.map((r) => r.value)),
		axis: vo2Axis(range, days),
	};
}

/** The page, on its route's range and tab. */
export function vo2MaxView(route: Vo2MaxRoute, rows: readonly Vo2MaxRow[], ctx: Vo2MaxContext): Vo2MaxView {
	const tab = vo2Tab(route.tab);
	const readings = readingsOf(rows, tab);
	const latest = readings[readings.length - 1];
	const scale = ctx.age !== undefined && ctx.sex ? vo2Scale(ctx.age, ctx.sex) : undefined;
	const view: Vo2MaxView = {
		tab,
		label: null,
		canGoBack: false,
		dial: null,
		chart: null,
		link: { text: FITNESS_AGE_LINK, route: healthStatRoute("fitness-age") },
	};
	if (latest && scale) view.copy = classCopy(tab, topPercent(latest.value, scale));
	const span = statSpan(VO2_STAT, route, ctx.today);
	if (!span) {
		if (latest) view.dial = vo2Dial(latest, ctx);
		else view.empty = NO_READING;
		return view;
	}
	view.label = statPeriodLabel(VO2_STAT, route, ctx.today);
	view.canGoBack = canStepBack(rows[0]?.date, ctx.complete, span.from);
	view.chart = vo2Chart(route.range, readings, span);
	if (!view.chart) view.empty = NO_DATA;
	return view;
}
