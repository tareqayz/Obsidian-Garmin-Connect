import type { DailyStatsRow } from "../sync/daily-stats";
import type { DaySeries } from "../sync/intraday";
import { formatDistance } from "./activities";
import { shortDate } from "./day";
import { shiftDate } from "./series";
import type { BarTone, ChartSpec, FrameId } from "./stats-charts";

/**
 * Garmin Connect's Steps, Floors and Intensity Minutes pages, worked out from
 * the daily stats index (`src/sync/daily-stats.ts`) and, for a single day,
 * that day's series file.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The rules are the app's,
 * measured against it on 2026-10-04 (ref/activities/README.md):
 *
 * - Steps averages round down, and a week's or four weeks' leave today out:
 *   Avg Daily is the days before today with data over their count, Avg Weekly
 *   the same sum over four. A year's Avg Daily is its total over the days with
 *   data, today included.
 * - Floors averages round to the nearest whole floor and divide by every day
 *   or week of the period.
 * - Intensity minutes count vigorous twice, round down, and run in weeks
 *   from Monday to Sunday, whatever day the account starts its weeks on.
 *
 * Steps and Floors look back from today: a week is the seven days ending
 * today. Intensity Minutes has a weekly goal, so its weeks are calendar weeks.
 */

export type StatId = "steps" | "floors" | "intensity";
export type StatRange = "1d" | "7d" | "4w" | "1y";
export type StatTotals = "weekly" | "monthly";
export type Units = "metric" | "imperial";

export const STAT_IDS: readonly StatId[] = ["steps", "floors", "intensity"];
export const STAT_RANGES: readonly StatRange[] = ["1d", "7d", "4w", "1y"];
export const STAT_TITLE: Record<StatId, string> = { steps: "Steps", floors: "Floors", intensity: "Intensity Minutes" };

/** What the pages read. */
export interface StatsData {
	/** Oldest first. */
	rows: DailyStatsRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
	units: Units;
	/**
	 * The day weeks start on, 0 Sunday to 6 Saturday. Monday in practice: the
	 * app counts Intensity Minutes weeks from Monday even on an account set to
	 * start its weeks on Sunday.
	 */
	weekStart: number;
	/** The day notes' calories, for days the index has none of its own. */
	calories: Readonly<Record<string, number>>;
}

export const NO_STATS: StatsData = { rows: [], complete: false, units: "metric", weekStart: 1, calories: {} };

export interface StatsRoute {
	stat: StatId;
	range: StatRange;
	/** 0 is the current period, -1 the one before. */
	offset: number;
	/** A year of steps, by the week or by the month. */
	totals: StatTotals;
}

export interface Ring {
	value: string;
	goal?: string;
	/** How far round the arc goes, 0 to 1. */
	fraction: number;
	complete: boolean;
	/** "27% of Goal", "Floors Climbed". */
	caption: string;
}

export interface StatItem {
	value: string;
	label: string;
	/** The "x2" beside vigorous minutes: they count double. */
	badge?: boolean;
}

export interface Card {
	key: string;
	title: string;
	detail?: string;
	value: string;
	/** Steps and floors days, and intensity weeks, carry a small goal ring. */
	ring?: { fraction: number; complete: boolean };
	/** A day, which opens on its own 1d page. */
	day?: string;
}

export interface TotalsRow {
	key: string;
	label: string;
	value: string;
}

export interface StatsView {
	stat: StatId;
	title: string;
	range: StatRange;
	offset: number;
	totals: StatTotals;
	/** "Today", "Sep 28 - Oct 4", "Nov 2025 - Oct 2026". */
	label: string;
	canGoBack: boolean;
	ring?: Ring;
	/** "Nice! You reached your weekly goal." */
	message?: string;
	chart: ChartSpec;
	stats: StatItem[];
	/** Steps link to their personal records. */
	records: boolean;
	cards: Card[];
	/** A year of steps, as a list of months or weeks. */
	rows: TotalsRow[];
}

export interface StatsInput {
	data: StatsData;
	route: StatsRoute;
	today: string;
	/** Series files by day, for the days `seriesDays` asked for. */
	series?: ReadonlyMap<string, DaySeries | null>;
	/** For a chart of today with no series yet: how far the day has got. */
	now?: number;
}

export function statsView(input: StatsInput): StatsView {
	switch (input.route.stat) {
		case "steps":
			return stepsView(input);
		case "floors":
			return floorsView(input);
		case "intensity":
			return intensityView(input);
	}
}

/** The days whose series files a page draws from: the day of a 1d page, the week of Intensity Minutes' 7d. */
export function seriesDays(route: StatsRoute, today: string, weekStart: number): string[] {
	if (route.range === "1d") return [shiftDate(today, Math.min(0, route.offset))];
	if (route.stat === "intensity" && route.range === "7d") {
		const from = shiftDate(weekStartOf(today, weekStart), 7 * Math.min(0, route.offset));
		return daysFrom(from, 7).filter((d) => d <= today);
	}
	return [];
}

/* ------------------------------------------------------------------ */
/*  Periods                                                            */
/* ------------------------------------------------------------------ */

interface Span {
	from: string;
	to: string;
	label: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The first day of the week `date` falls in. */
export function weekStartOf(date: string, weekStart: number): string {
	const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
	return shiftDate(date, -((dow - weekStart + 7) % 7));
}

function daysFrom(from: string, n: number): string[] {
	return Array.from({ length: n }, (_, i) => shiftDate(from, i));
}

/** "Today", "Yesterday", "Thu, Oct 1", with the year once it is not this one's. */
export function dayLabel(day: string, today: string): string {
	if (day === today) return "Today";
	if (day === shiftDate(today, -1)) return "Yesterday";
	const weekday = WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]!.slice(0, 3);
	return `${weekday}, ${shortDate(day)}${day.slice(0, 4) === today.slice(0, 4) ? "" : `, ${day.slice(0, 4)}`}`;
}

/** "Sep 28 - Oct 4", "Jan 12 - 18", with years once the period is not this year's. */
function rangeLabel(from: string, to: string, today: string): string {
	if (from.slice(0, 4) === to.slice(0, 4)) {
		const tail = to.slice(0, 4) === today.slice(0, 4) ? "" : `, ${to.slice(0, 4)}`;
		const end = from.slice(0, 7) === to.slice(0, 7) ? String(Number(to.slice(8))) : shortDate(to);
		return `${shortDate(from)} - ${end}${tail}`;
	}
	return `${shortDate(from)}, ${from.slice(0, 4)} - ${shortDate(to)}, ${to.slice(0, 4)}`;
}

/** A week in a list: "Sep 28 - Oct 4", "Sep 21 - 27". */
export function weekLabel(from: string): string {
	const to = shiftDate(from, 6);
	return from.slice(0, 7) === to.slice(0, 7) ? `${shortDate(from)} - ${Number(to.slice(8))}` : `${shortDate(from)} - ${shortDate(to)}`;
}

/** The seven or twenty-eight days ending a whole number of periods before today. */
function trailing(days: number, offset: number, today: string): Span {
	const to = shiftDate(today, days * offset);
	const from = shiftDate(to, -(days - 1));
	return { from, to, label: rangeLabel(from, to, today) };
}

/** Calendar weeks: the one holding today, or a whole number of them before it. */
function calendarWeeks(weeks: number, offset: number, today: string, weekStart: number): Span {
	const last = shiftDate(weekStartOf(today, weekStart), 7 * weeks * offset);
	const from = shiftDate(last, -7 * (weeks - 1));
	const to = shiftDate(last, 6);
	return { from, to, label: rangeLabel(from, to, today) };
}

/** A year of weeks is labelled with both years, as the app does: "Oct 6, 2025 - Oct 4, 2026". */
function yearOfWeeks(offset: number, today: string, weekStart: number): Span {
	const span = calendarWeeks(52, offset, today, weekStart);
	return { ...span, label: `${shortDate(span.from)}, ${span.from.slice(0, 4)} - ${shortDate(span.to)}, ${span.to.slice(0, 4)}` };
}

function addMonths(month: string, n: number): string {
	const [y, m] = month.split("-").map(Number);
	const t = y! * 12 + (m! - 1) + n;
	return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function lastDayOf(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return `${month}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

function roundUp(raw: number, units: ReadonlyArray<readonly [number, number]>): number {
	const unit = (units.find(([limit]) => raw <= limit) ?? units[units.length - 1]!)[1];
	return Math.max(unit, Math.ceil(raw / unit) * unit);
}

/** Four steps up from zero: a quarter of the top, rounded up to 500 under 10k, then 1,000, then 10,000. */
export function stepsTicks(max: number): number[] {
	const step = roundUp(max / 4, [
		[10_000, 500],
		[100_000, 1_000],
		[Infinity, 10_000],
	]);
	return [0, step, 2 * step, 3 * step, 4 * step];
}

/** "0", "4.5k", "356k". */
export function kLabel(value: number): string {
	return value === 0 ? "0" : `${Number((value / 1000).toFixed(1)).toLocaleString()}k`;
}

/**
 * Two steps each side of zero: half the top, rounded up to 5 under 100, then
 * 50, then 500. The goal line never sits on the top edge: 10 floors with a
 * goal of 10 draws 20/10/0, as the app does.
 */
export function floorsTicks(max: number, goal?: number): number[] {
	const units: ReadonlyArray<readonly [number, number]> = [
		[100, 5],
		[1_000, 50],
		[Infinity, 500],
	];
	let step = roundUp(max / 2, units);
	const unit = (units.find(([limit]) => max / 2 <= limit) ?? units[units.length - 1]!)[1];
	while (goal !== undefined && goal > 0 && 2 * step <= goal) step += unit;
	return [-2 * step, -step, 0, step, 2 * step];
}

/** Three steps up from zero, a third of the top (or the goal, if higher) rounded up to 50. */
export function intensityTicks(max: number, goal: number): number[] {
	const step = Math.max(50, Math.ceil(Math.max(max, goal) / 3 / 50) * 50);
	return [0, step, 2 * step, 3 * step];
}

/** A day's week-to-date total: 50-minute gridlines from below the lower of start and goal to above the higher of end and goal. */
export function intensityDayTicks(start: number, end: number, goal: number): number[] {
	const lo = Math.floor(Math.min(start, goal) / 50) * 50;
	let hi = Math.ceil(Math.max(end, goal) / 50) * 50;
	if (hi <= lo) hi = lo + 50;
	const ticks: number[] = [];
	for (let v = lo; v <= hi; v += 50) ticks.push(v);
	return ticks;
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

const whole = (n: number) => Math.round(n).toLocaleString();
const minutes = (n: number) => `${whole(n)} min`;
const percent = (value: number, goal: number) => Math.floor((value * 100) / goal);

/** "October 4". */
function longDate(day: string): string {
	return `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

function weekday(day: string): string {
	return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]!;
}

/** "9-28": the ends of a day chart. Intensity's four weeks write "09-07". */
function axisDay(day: string, padMonth = false): string {
	const month = day.slice(5, 7);
	return `${padMonth ? month : Number(month)}-${day.slice(8, 10)}`;
}

const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

type Lookup = (day: string) => DailyStatsRow | undefined;

function lookup(rows: readonly DailyStatsRow[]): Lookup {
	const byDate = new Map(rows.map((r) => [r.date, r]));
	return (day) => byDate.get(day);
}

const intensityOf = (row: DailyStatsRow | undefined) => (row?.moderate ?? 0) + 2 * (row?.vigorous ?? 0);

function sumOf(days: readonly string[], row: Lookup, value: (r: DailyStatsRow) => number | undefined): number {
	let total = 0;
	for (const day of days) {
		const r = row(day);
		total += (r && value(r)) ?? 0;
	}
	return total;
}

function header(input: StatsInput, span: Span) {
	const { route } = input;
	return {
		stat: route.stat,
		title: STAT_TITLE[route.stat],
		range: route.range,
		offset: Math.min(0, route.offset),
		totals: route.totals,
		label: span.label,
		canGoBack: input.data.rows.some((r) => r.date < span.from),
	};
}

/** Dots under a day chart: one per point, large at the two ends. */
function endDots(n: number): ChartSpec["dots"] {
	return Array.from({ length: n }, (_, i) => ({ x: n > 1 ? i / (n - 1) : 0, large: i === 0 || i === n - 1 }));
}

/** Dots and upright labels for a year: one per month, spread evenly across the plot. */
function monthMarks(from: string, to: string): Pick<ChartSpec, "dots" | "xLabels"> {
	const months: string[] = [];
	for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m, 1)) months.push(m);
	const n = months.length;
	return {
		dots: months.map((_, i) => ({ x: n > 1 ? i / (n - 1) : 0, large: true })),
		xLabels: months.map((m, i) => ({ x: n > 1 ? i / (n - 1) : 0, text: MONTH_ABBR[Number(m.slice(5)) - 1]!, rotated: true })),
	};
}

const HOUR_MS = 3_600_000;

/**
 * When Garmin's day began. A day is midnight to midnight on the watch's
 * clock, which this computer's need not share: the series file says when
 * that was, and a file written before it did falls back to local midnight
 * here, as Home's charts do.
 */
export function dayStartOf(day: string, series: DaySeries | null | undefined): number {
	const local = new Date(`${day}T00:00:00`).getTime();
	const start = series?.dayStart;
	// Anything further than half a day off is not this day's start at all.
	return start !== undefined && Math.abs(start - local) <= 14 * HOUR_MS ? start : local;
}

/** Hours into the day that started at `start`. */
function hourOf(ms: number, start: number): number {
	return (ms - start) / HOUR_MS;
}

/** When the night before `day` ended, in hours into it: the clock under a day chart. */
function wakeHour(series: DaySeries | null | undefined, start: number): number | undefined {
	let end = -Infinity;
	for (const level of series?.sleepLevels ?? []) end = Math.max(end, level.end);
	if (!Number.isFinite(end)) return undefined;
	const hour = hourOf(end, start);
	return hour > 0 && hour < 24 ? hour : undefined;
}

/** How far a day's charts run: the end of the day, or for today the newest reading. */
function untilHour(series: DaySeries | null | undefined, start: number, day: string, today: string, now: number): number {
	if (day < today) return 24;
	let latest = -Infinity;
	for (const b of series?.steps ?? []) latest = Math.max(latest, b.end);
	for (const b of series?.floors ?? []) latest = Math.max(latest, b.end);
	for (const [t] of series?.intensity ?? []) latest = Math.max(latest, t);
	const hour = hourOf(Number.isFinite(latest) ? latest : now, start);
	return Math.min(24, Math.max(0, hour));
}

/** A running total as a staircase: flat, then straight up at each reading. */
function staircase(start: number, steps: ReadonlyArray<[number, number]>, until: number, from = 0): Array<[number, number]> {
	const points: Array<[number, number]> = [[from, start]];
	let total = start;
	for (const [x, add] of [...steps].sort((a, b) => a[0] - b[0])) {
		if (x > until) break;
		points.push([x, total]);
		total += add;
		points.push([x, total]);
	}
	points.push([until, total]);
	return points;
}

function goalRing(value: number | undefined, goal: number | undefined): Card["ring"] {
	if (value === undefined) return undefined;
	if (!goal) return { fraction: 0, complete: false };
	return { fraction: Math.min(1, value / goal), complete: value >= goal };
}

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

function stepsView(input: StatsInput): StatsView {
	const { data, route, today } = input;
	const row = lookup(data.rows);
	const offset = Math.min(0, route.offset);

	if (route.range === "1d") {
		const day = shiftDate(today, offset);
		const r = row(day);
		const series = input.series?.get(day);
		const steps = r?.steps;
		const goal = r?.stepGoal;
		const calories = r?.calories ?? data.calories[day];

		const start = dayStartOf(day, series);
		const points: Array<[number, number]> = [];
		let total = 0;
		const buckets = (series?.steps ?? []).filter((b) => hourOf(b.start, start) >= 0 && hourOf(b.start, start) < 24);
		if (buckets.length) {
			points.push([0, 0]);
			for (const b of [...buckets].sort((a, z) => a.start - z.start)) {
				points.push([hourOf(b.start, start) / 24, total]);
				total += b.steps;
				points.push([Math.min(24, hourOf(b.end, start)) / 24, total]);
			}
		}
		const ticks = stepsTicks(Math.max(total, goal ?? 0, 1));
		const wake = wakeHour(series, start);

		return {
			...header(input, { from: day, to: day, label: dayLabel(day, today) }),
			ring: {
				value: steps === undefined ? "--" : whole(steps),
				...(goal ? { goal: whole(goal) } : {}),
				fraction: steps !== undefined && goal ? Math.min(1, steps / goal) : 0,
				complete: steps !== undefined && goal !== undefined && goal > 0 && steps >= goal,
				caption: steps !== undefined && goal ? `${percent(steps, goal)}% of Goal` : "",
			},
			chart: {
				frame: "steps-day",
				title: "Daily Timeline",
				ticks,
				labels: ticks.map(kLabel),
				bars: [],
				lines: points.length ? [{ points, tone: "normal", area: true }] : [],
				...(goal ? { goal } : {}),
				dots: Array.from({ length: 25 }, (_, h) => ({ x: h / 24, large: h % 4 === 0 })),
				xLabels: [],
				markers: wake !== undefined ? [{ kind: "wake", x: wake / 24 }] : [],
			},
			stats: [
				{ value: r?.distance !== undefined ? formatDistance(r.distance, data.units) : "--", label: "Distance" },
				{ value: calories !== undefined ? whole(calories) : "--", label: "Calories" },
			],
			records: false,
			cards: [],
			rows: [],
		};
	}

	if (route.range === "7d" || route.range === "4w") {
		const n = route.range === "7d" ? 7 : 28;
		const span = trailing(n, offset, today);
		const days = daysFrom(span.from, n);
		const total = sumOf(days, row, (r) => r.steps);
		const distance = sumOf(days, row, (r) => r.distance);
		// Today is still going, so the averages leave it out.
		const done = days.filter((d) => d < today && row(d)?.steps !== undefined);
		const doneTotal = sumOf(done, row, (r) => r.steps);

		const bars: ChartSpec["bars"] = [];
		let max = 1;
		days.forEach((d, i) => {
			const x = n > 1 ? i / (n - 1) : 0;
			const steps = row(d)?.steps ?? 0;
			const goal = row(d)?.stepGoal ?? 0;
			max = Math.max(max, steps, goal);
			if (goal > 0 && steps >= goal) bars.push({ x, from: 0, to: steps, tone: "green" });
			else {
				if (goal > 0) bars.push({ x, from: 0, to: goal, tone: "goal" });
				if (steps > 0) bars.push({ x, from: 0, to: steps, tone: "blue" });
			}
		});
		const ticks = stepsTicks(max);

		const stats: StatItem[] = [
			{ value: whole(total), label: "Total Steps" },
			{ value: formatDistance(distance, data.units), label: "Total Distance" },
			{ value: whole(done.length ? Math.floor(doneTotal / done.length) : 0), label: "Avg Daily" },
		];
		if (n === 28) stats.push({ value: whole(Math.floor(doneTotal / 4)), label: "Avg Weekly" });

		return {
			...header(input, span),
			chart: {
				frame: n === 7 ? "steps-7d" : "steps-4w",
				title: "Daily Totals",
				ticks,
				labels: ticks.map(kLabel),
				bars,
				lines: [],
				dots: endDots(n),
				xLabels: [
					{ x: 0, text: axisDay(span.from) },
					{ x: 1, text: axisDay(span.to) },
				],
				markers: [],
			},
			stats,
			records: true,
			cards: [...days].reverse().map((d) => {
				const r = row(d);
				const pct = r?.steps !== undefined && r.stepGoal ? ` • ${percent(r.steps, r.stepGoal)}%` : "";
				const ring = goalRing(r?.steps, r?.stepGoal);
				return {
					key: d,
					title: weekday(d),
					detail: `${longDate(d)}${pct}`,
					value: r?.steps !== undefined ? whole(r.steps) : "--",
					...(ring ? { ring } : {}),
					day: d,
				};
			}),
			rows: [],
		};
	}

	// A year, by the month or by the week.
	if (route.totals === "monthly") {
		const last = addMonths(today.slice(0, 7), 12 * offset);
		const months = Array.from({ length: 12 }, (_, i) => addMonths(last, i - 11));
		const from = `${months[0]}-01`;
		const to = lastDayOf(last);
		const span: Span = { from, to, label: `${MONTH_ABBR[Number(months[0]!.slice(5)) - 1]} ${months[0]!.slice(0, 4)} - ${MONTH_ABBR[Number(last.slice(5)) - 1]} ${last.slice(0, 4)}` };
		const length = daysBetween(from, to);
		const inYear = data.rows.filter((r) => r.date >= from && r.date <= to);
		const total = inYear.reduce((s, r) => s + (r.steps ?? 0), 0);
		const distance = inYear.reduce((s, r) => s + (r.distance ?? 0), 0);
		const withData = inYear.filter((r) => r.steps !== undefined).length;
		const monthly = months.map((m) => inYear.filter((r) => r.date.startsWith(m)).reduce((s, r) => s + (r.steps ?? 0), 0));
		const ticks = stepsTicks(Math.max(1, ...monthly));

		return {
			...header(input, span),
			chart: {
				frame: "steps-month",
				title: "Monthly Totals",
				ticks,
				labels: ticks.map(kLabel),
				bars: months.map((m, i) => ({ x: daysBetween(from, `${m}-01`) / length, from: 0, to: monthly[i]!, tone: "green" as BarTone })),
				lines: [],
				dots: months.map((m) => ({ x: daysBetween(from, `${m}-01`) / length, large: true })),
				xLabels: months.map((m) => ({ x: daysBetween(from, `${m}-01`) / length, text: MONTH_ABBR[Number(m.slice(5)) - 1]!, rotated: true })),
				markers: [],
			},
			stats: [
				{ value: whole(total), label: "Total Steps" },
				{ value: formatDistance(distance, data.units), label: "Total Distance" },
				{ value: whole(withData ? Math.floor(total / withData) : 0), label: "Avg Daily" },
				{ value: whole(Math.floor(total / 12)), label: "Avg Monthly" },
			],
			records: true,
			cards: [],
			rows: months
				.map((m, i) => ({ key: m, label: MONTHS[Number(m.slice(5)) - 1]!, value: whole(monthly[i]!) }))
				.reverse(),
		};
	}

	const span = yearOfWeeks(offset, today, data.weekStart);
	const starts = Array.from({ length: 52 }, (_, i) => shiftDate(span.from, 7 * i));
	const weekly = starts.map((w) => sumOf(daysFrom(w, 7), row, (r) => r.steps));
	const inYear = data.rows.filter((r) => r.date >= span.from && r.date <= span.to);
	const total = weekly.reduce((s, v) => s + v, 0);
	const distance = inYear.reduce((s, r) => s + (r.distance ?? 0), 0);
	const withData = inYear.filter((r) => r.steps !== undefined).length;
	const ticks = stepsTicks(Math.max(1, ...weekly));

	return {
		...header(input, span),
		chart: {
			frame: "steps-week",
			title: "Weekly Totals",
			ticks,
			labels: ticks.map(kLabel),
			bars: weekly.map((v, i) => ({ x: i / WEEK_SLOTS, from: 0, to: v, tone: "green" as BarTone })),
			lines: [],
			...monthMarks(span.from, span.to),
			markers: [],
		},
		stats: [
			{ value: whole(total), label: "Total Steps" },
			{ value: formatDistance(distance, data.units), label: "Total Distance" },
			{ value: whole(withData ? Math.floor(total / withData) : 0), label: "Avg Daily" },
			{ value: whole(Math.floor(total / 52)), label: "Avg Weekly" },
		],
		records: true,
		cards: [],
		rows: starts.map((w, i) => ({ key: w, label: weekLabel(w), value: whole(weekly[i]!) })).reverse(),
	};
}

/**
 * Where a year's 52 weekly bars sit: the app spaces them a little wider than
 * 52 slots to the plot, the last bar falling short of the right edge, which
 * the month labels reach.
 */
const WEEK_SLOTS = 51.74;

/* ------------------------------------------------------------------ */
/*  Floors                                                             */
/* ------------------------------------------------------------------ */

function floorsView(input: StatsInput): StatsView {
	const { data, route, today } = input;
	const row = lookup(data.rows);
	const offset = Math.min(0, route.offset);

	if (route.range === "1d") {
		const day = shiftDate(today, offset);
		const r = row(day);
		const series = input.series?.get(day);
		const start = dayStartOf(day, series);
		const until = untilHour(series, start, day, today, input.now ?? Date.now());
		const buckets = (series?.floors ?? []).filter((b) => hourOf(b.end, start) > 0 && hourOf(b.end, start) <= 24);
		const up = staircase(0, buckets.map((b) => [hourOf(b.end, start) / 24, b.up] as [number, number]), until / 24);
		const down = staircase(0, buckets.map((b) => [hourOf(b.end, start) / 24, -b.down] as [number, number]), until / 24);
		const climbed = up[up.length - 1]![1];
		const descended = -down[down.length - 1]![1];
		const goal = r?.floorsGoal;
		const ticks = floorsTicks(Math.max(climbed, descended, goal ?? 0, 1), goal);
		const wake = wakeHour(series, start);

		return {
			...header(input, { from: day, to: day, label: dayLabel(day, today) }),
			ring: {
				value: r?.floorsUp !== undefined ? whole(r.floorsUp) : "--",
				...(goal ? { goal: whole(goal) } : {}),
				fraction: r?.floorsUp !== undefined && goal ? Math.min(1, r.floorsUp / goal) : 0,
				complete: r?.floorsUp !== undefined && goal !== undefined && goal > 0 && r.floorsUp >= goal,
				caption: "Floors Climbed",
			},
			chart: {
				frame: "floors-day",
				title: "Daily Timeline",
				ticks,
				labels: ticks.map((t) => whole(Math.abs(t))),
				bars: [],
				lines: buckets.length
					? [
							{ points: down, tone: "faint" },
							{ points: up, tone: "normal" },
						]
					: [],
				...(goal ? { goal } : {}),
				dots: Array.from({ length: 25 }, (_, h) => ({ x: h / 24, large: h % 4 === 0 })),
				xLabels: [],
				markers: wake !== undefined ? [{ kind: "wake", x: wake / 24 }] : [],
			},
			stats: [
				{ value: r?.floorsUp !== undefined ? whole(r.floorsUp) : "--", label: "Climbed" },
				{ value: r?.floorsDown !== undefined ? whole(r.floorsDown) : "--", label: "Descended" },
			],
			records: false,
			cards: [],
			rows: [],
		};
	}

	const yearly = route.range === "1y";
	const span = yearly ? yearOfWeeks(offset, today, data.weekStart) : trailing(route.range === "7d" ? 7 : 28, offset, today);
	const slots: string[][] = yearly
		? Array.from({ length: 52 }, (_, i) => daysFrom(shiftDate(span.from, 7 * i), 7))
		: daysFrom(span.from, route.range === "7d" ? 7 : 28).map((d) => [d]);
	const ups = slots.map((days) => sumOf(days, row, (r) => r.floorsUp));
	const downs = slots.map((days) => sumOf(days, row, (r) => r.floorsDown));
	const up = ups.reduce((s, v) => s + v, 0);
	const down = downs.reduce((s, v) => s + v, 0);
	// The goal line is today's goal, or the newest one in the period.
	const goal = yearly
		? undefined
		: [...slots]
				.reverse()
				.map(([d]) => row(d!)?.floorsGoal)
				.find((g) => g !== undefined);
	const n = slots.length;
	const x = (i: number) => (yearly ? i / FLOOR_WEEK_SLOTS : n > 1 ? i / (n - 1) : 0);
	const ticks = floorsTicks(Math.max(1, ...ups, ...downs, goal ?? 0), goal);
	const per = yearly ? "Weekly" : "Daily";

	const bars: ChartSpec["bars"] = [];
	ups.forEach((v, i) => {
		if (v > 0) bars.push({ x: x(i), from: 0, to: v, tone: "blue" });
		if (downs[i]! > 0) bars.push({ x: x(i), from: 0, to: -downs[i]!, tone: "faded" });
	});

	return {
		...header(input, span),
		chart: {
			frame: (yearly ? "floors-1y" : route.range === "7d" ? "floors-7d" : "floors-4w") as FrameId,
			title: yearly ? "Weekly Totals" : "Daily Totals",
			ticks,
			labels: ticks.map((t) => whole(Math.abs(t))),
			strongZero: true,
			bars,
			lines: [],
			...(goal ? { goal } : {}),
			...(yearly
				? monthMarks(span.from, span.to)
				: {
						dots: endDots(n),
						xLabels: [
							{ x: 0, text: axisDay(span.from) },
							{ x: 1, text: axisDay(span.to) },
						],
					}),
			markers: [],
			legend: yearly ? ["climbed", "descended"] : ["climbed", "descended", "goal"],
		},
		stats: [
			{ value: whole(Math.round(up / n)), label: `${per} Avg Climbed` },
			{ value: whole(up), label: "Total Climbed" },
			{ value: whole(Math.round(down / n)), label: `${per} Avg Descended` },
			{ value: whole(down), label: "Total Descended" },
		],
		records: false,
		cards: yearly
			? slots.map((days, i) => ({ key: days[0]!, title: weekLabel(days[0]!), value: `${whole(ups[i]!)}↑` })).reverse()
			: slots
					.map(([d]) => {
						const r = row(d!);
						const ring = goalRing(r?.floorsUp, r?.floorsGoal);
						return {
							key: d!,
							title: weekday(d!),
							detail: longDate(d!),
							value: r?.floorsUp !== undefined ? `${whole(r.floorsUp)}↑` : "--",
							...(ring ? { ring } : {}),
							day: d!,
						};
					})
					.reverse(),
		rows: [],
	};
}

/** Floors' year spaces its weeks a touch wider than Steps' does, measured the same way. */
const FLOOR_WEEK_SLOTS = 51.7;

/* ------------------------------------------------------------------ */
/*  Intensity Minutes                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_INTENSITY_GOAL = 150;

function intensityView(input: StatsInput): StatsView {
	const { data, route, today } = input;
	const row = lookup(data.rows);
	const offset = Math.min(0, route.offset);
	const now = input.now ?? Date.now();
	// The goal is the week's; a day without a row borrows the newest one known.
	const latestGoal = [...data.rows].reverse().find((r) => r.intensityGoal !== undefined)?.intensityGoal ?? DEFAULT_INTENSITY_GOAL;
	const goalOf = (days: readonly string[]) =>
		[...days].reverse().map((d) => row(d)?.intensityGoal).find((g) => g !== undefined) ?? latestGoal;

	if (route.range === "1d") {
		const day = shiftDate(today, offset);
		const r = row(day);
		const series = input.series?.get(day);
		const week = daysFrom(weekStartOf(day, data.weekStart), 7);
		const before = week.filter((d) => d < day);
		const start = before.reduce((s, d) => s + intensityOf(row(d)), 0);
		const own = intensityOf(r);
		const goal = r?.intensityGoal ?? goalOf(week);
		const dayStart = dayStartOf(day, series);
		const until = untilHour(series, dayStart, day, today, now);
		const readings: Array<[number, number]> = (series?.intensity ?? [])
			.map(([t, v]) => [hourOf(t, dayStart) / 24, v ?? 0] as [number, number])
			.filter(([x]) => x >= 0 && x <= 1);
		// Without the day's readings, the day's minutes go in at its start.
		if (!readings.length && own > 0) readings.push([0, own]);
		const points = staircase(start, readings, until / 24);
		const end = points[points.length - 1]![1];
		const ticks = intensityDayTicks(start, end, goal);
		const wake = wakeHour(series, dayStart);

		return {
			...header(input, { from: day, to: day, label: dayLabel(day, today) }),
			chart: {
				frame: "intensity-day",
				title: "Daily Timeline",
				ticks,
				labels: ticks.map(String),
				bars: [],
				lines: [{ points, tone: "normal" }],
				goal,
				dots: Array.from({ length: 25 }, (_, h) => ({ x: h / 24, large: h % 4 === 0 })),
				xLabels: [0, 4, 8, 12, 16, 20, 24].map((h) => ({ x: h / 24, text: clockLabel(h) })),
				markers: [...goalCrossing(points, goal), ...(wake !== undefined ? [{ kind: "wake" as const, x: wake / 24 }] : [])],
				legend: ["weekly-goal"],
			},
			stats: [
				{ value: minutes(r?.moderate ?? 0), label: "Moderate" },
				{ value: minutes(r?.vigorous ?? 0), label: "Vigorous", badge: true },
				{ value: minutes(own), label: "Total" },
			],
			records: false,
			cards: [],
			rows: [],
		};
	}

	if (route.range === "7d") {
		const span = calendarWeeks(1, offset, today, data.weekStart);
		const week = daysFrom(span.from, 7);
		const seen = week.filter((d) => d <= today);
		const total = seen.reduce((s, d) => s + intensityOf(row(d)), 0);
		const goal = goalOf(week);
		const readings: Array<[number, number]> = [];
		seen.forEach((d, i) => {
			const series = input.series?.get(d);
			const start = dayStartOf(d, series);
			const points = (series?.intensity ?? []).filter(([t]) => hourOf(t, start) >= 0 && hourOf(t, start) <= 24);
			if (points.length) for (const [t, v] of points) readings.push([(i + hourOf(t, start) / 24) / 7, v ?? 0]);
			else if (intensityOf(row(d)) > 0) readings.push([i / 7, intensityOf(row(d))]);
		});
		const todayIndex = week.indexOf(today);
		const todaySeries = input.series?.get(today);
		const until = todayIndex >= 0 ? (todayIndex + untilHour(todaySeries, dayStartOf(today, todaySeries), today, today, now) / 24) / 7 : 1;
		const points = staircase(0, readings, until);
		const ticks = intensityTicks(total, goal);
		const met = total >= goal;

		return {
			...header(input, span),
			ring: {
				value: whole(total),
				goal: whole(goal),
				fraction: goal ? Math.min(1, total / goal) : 0,
				complete: met,
				caption: `${percent(total, goal)}% of Goal`,
			},
			...(met ? { message: "Nice! You reached your weekly goal." } : {}),
			chart: {
				frame: "intensity-week",
				title: "Weekly Timeline",
				ticks,
				labels: ticks.map(String),
				bars: [],
				lines: [{ points, tone: "normal" }],
				goal,
				dots: week.map((_, i) => ({ x: i / 7, large: true })),
				xLabels: week.map((d, i) => ({ x: i / 7, text: weekday(d).slice(0, 3) })),
				markers: goalCrossing(points, goal),
				legend: ["weekly-goal"],
			},
			stats: [
				{ value: minutes(sumOf(seen, row, (r) => r.moderate)), label: "Moderate" },
				{ value: minutes(sumOf(seen, row, (r) => r.vigorous)), label: "Vigorous", badge: true },
			],
			records: false,
			cards: dayCards(seen, row),
			rows: [],
		};
	}

	if (route.range === "4w") {
		const span = calendarWeeks(4, offset, today, data.weekStart);
		const days = daysFrom(span.from, 28);
		const seen = days.filter((d) => d <= today);
		const goal = goalOf(days);
		const lines: ChartSpec["lines"] = [];
		const markers: ChartSpec["markers"] = [];
		let max = 0;
		for (let w = 0; w < 4; w++) {
			const week = days.slice(7 * w, 7 * w + 7).filter((d) => d <= today);
			if (!week.length) continue;
			// Each day's minutes go in at its own dot; the line stops at the last day it has.
			const points: Array<[number, number]> = [[(7 * w) / 27, 0]];
			let total = 0;
			week.forEach((d, i) => {
				const x = (7 * w + i) / 27;
				points.push([x, total]);
				total += intensityOf(row(d));
				points.push([x, total]);
				if (i < week.length - 1) points.push([(7 * w + i + 1) / 27, total]);
			});
			max = Math.max(max, total);
			lines.push({ points, tone: "normal" });
			markers.push(...goalCrossing(points, goal));
		}
		const ticks = intensityTicks(max, goal);
		const sumDays = (value: (r: DailyStatsRow) => number | undefined) => sumOf(seen, row, value);

		return {
			...header(input, span),
			chart: {
				frame: "intensity-4w",
				title: "Daily Totals",
				ticks,
				labels: ticks.map(String),
				bars: [],
				lines,
				goal,
				dots: endDots(28),
				xLabels: [
					{ x: 0, text: axisDay(span.from, true) },
					{ x: 1, text: axisDay(shiftDate(span.from, 27), true) },
				],
				markers,
				vlines: [6, 13, 20, 27].map((k) => k / 27),
				legend: ["weekly-goal"],
			},
			stats: [
				{ value: minutes(Math.floor(sumDays((r) => r.moderate) / 28)), label: "Avg Daily Moderate" },
				{ value: minutes(Math.floor(sumDays((r) => r.vigorous) / 28)), label: "Avg Daily Vigorous", badge: true },
				{ value: minutes(Math.floor(seen.reduce((s, d) => s + intensityOf(row(d)), 0) / 28)), label: "Avg Daily Total" },
			],
			records: false,
			cards: dayCards(seen, row),
			rows: [],
		};
	}

	const span = yearOfWeeks(offset, today, data.weekStart);
	const weeks = Array.from({ length: 52 }, (_, i) => daysFrom(shiftDate(span.from, 7 * i), 7));
	const totals = weeks.map((days) => days.reduce((s, d) => s + intensityOf(row(d)), 0));
	const goals = weeks.map((days) => goalOf(days));
	const bars: ChartSpec["bars"] = [];
	totals.forEach((v, i) => {
		const x = i / WEEK_SLOTS;
		if (v >= goals[i]!) bars.push({ x, from: 0, to: v, tone: "green" });
		else {
			bars.push({ x, from: 0, to: goals[i]!, tone: "goal" });
			if (v > 0) bars.push({ x, from: 0, to: v, tone: "blue" });
		}
	});
	const ticks = intensityTicks(Math.max(...totals), Math.max(...goals));
	const sumYear = (value: (r: DailyStatsRow) => number | undefined) => weeks.reduce((s, days) => s + sumOf(days, row, value), 0);

	return {
		...header(input, span),
		chart: {
			frame: "intensity-1y",
			title: "Weekly Totals",
			ticks,
			labels: ticks.map(String),
			bars,
			lines: [],
			...monthMarks(span.from, span.to),
			markers: [],
		},
		stats: [
			{ value: minutes(Math.floor(sumYear((r) => r.moderate) / 52)), label: "Avg Weekly Moderate" },
			{ value: minutes(Math.floor(sumYear((r) => r.vigorous) / 52)), label: "Avg Weekly Vigorous", badge: true },
		],
		records: false,
		cards: weeks
			.map((days, i) => ({
				key: days[0]!,
				title: weekLabel(days[0]!),
				detail: `${percent(totals[i]!, goals[i]!)}% of Goal`,
				value: whole(totals[i]!),
				ring: { fraction: Math.min(1, totals[i]! / goals[i]!), complete: totals[i]! >= goals[i]! },
			}))
			.reverse(),
		rows: [],
	};
}

/** A day's minutes, newest first; a day opens on its own page. */
function dayCards(days: readonly string[], row: Lookup): Card[] {
	return [...days].reverse().map((d) => ({ key: d, title: weekday(d), detail: longDate(d), value: whole(intensityOf(row(d))), day: d }));
}

/** The check where a running total first reaches the goal. */
function goalCrossing(points: ReadonlyArray<[number, number]>, goal: number): ChartSpec["markers"] {
	if (!(goal > 0) || (points[0]?.[1] ?? 0) >= goal) return [];
	const hit = points.find(([, v]) => v >= goal);
	return hit ? [{ kind: "goal", x: hit[0], value: goal }] : [];
}

/** `0` → "12 AM", `16` → "4 PM". */
function clockLabel(hour: number): string {
	const h = hour % 24;
	return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}
