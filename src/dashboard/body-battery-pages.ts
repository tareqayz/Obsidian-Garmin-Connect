import type { BatteryRow } from "../sync/body-battery-index";
import type { BodyBatteryMarker } from "../sync/intraday";
import { STRESS_DAY_KEY, batteryDayIn, type StressDay } from "../sync/stress-index";
import { batteryFeedback, factorHasInfo, factorLabel, type BatteryFeedback } from "./body-battery-copy";
import {
	canStepBack,
	cardDate,
	dayAxis,
	dayLabel,
	dayOf,
	daysOf,
	meanOf,
	offsetOfDay,
	periodLabel,
	periodOf,
	spread,
	weekdayOf,
	type PeriodAxis,
	type PeriodRange,
	type PeriodRoute,
	type Rounding,
} from "./periods";
import { dayLength, duration, timelineOf, type StressTimeline } from "./stress-pages";

/**
 * Garmin Connect's Body Battery page, worked out from the Body Battery index
 * (`src/sync/body-battery-index.ts`) and, for one day, that day's readings,
 * events and night.
 *
 * Pure. Dates are local `YYYY-MM-DD` strings. The periods, their labels and
 * the cards that switch them are the shared ones (`periods.ts`); the rules
 * here are Body Battery's, measured on 2026-10-08
 * (ref/health-stats/body-battery/README.md and its `phone/INDEX.md`):
 *
 * - 1d, 7d and 4w; neither the phone nor the web has a 1y.
 * - A day's high and low are Garmin's, never derived from the curve. Today
 *   counts, partial.
 * - Today shows a gauge filled to the newest level; a past day a ring with
 *   its high and low. Both have the Charged and Drained tiles, "--" for 0.
 * - The copy follows the day's dynamic feedback type, not the end-of-day one.
 * - 7d and 4w draw a low-to-high bar with a dot at each end a day, nothing on
 *   a day without data, and list a card a day, newest first, "--" on a day
 *   without data. Neither shows an average: the view's averages round half
 *   up, the rule `stats/bodybattery/weekly` follows on all 104 of its values.
 */

/** Body Battery pages through three ranges on the shared route. */
export type BatteryRange = Exclude<PeriodRange, "1y">;
export type BatteryRoute = PeriodRoute;

/** Means round half up (floor fits the weekly route on 59 values of 104). */
const ROUNDING: Rounding = "round";

/** What the pages read. */
export interface BatteryData {
	/** The Body Battery index, oldest first. */
	rows: readonly BatteryRow[];
	/** Whether the index holds the whole history yet. */
	complete: boolean;
}

export const NO_BATTERY: BatteryData = { rows: [], complete: false };

export interface BatteryInput {
	data: BatteryData;
	route: BatteryRoute;
	today: string;
	/**
	 * 1d: the day's readings, `stressDayIn(series)`: undefined while they load,
	 * null once Garmin had none. The curve comes out of them through
	 * `batteryDayIn`, the stress bars under it as the Stress page draws them.
	 */
	readings?: StressDay | null;
	/** 1d: the day's events, the series file's `bodyBatteryEvents`: undefined while they load. */
	events?: readonly BodyBatteryMarker[] | null;
	/**
	 * 1d: the night that ended on the day, from the sleep index: seconds asleep,
	 * the Sleep row's duration, and when it ended, seconds from the day's
	 * midnight, the timeline's wake marker.
	 */
	sleep?: { seconds?: number; wake?: number } | null;
}

export type BatteryView = BatteryDayView | BatteryPeriodView;

export function batteryView(input: BatteryInput): BatteryView {
	return input.route.range === "1d" ? batteryDayView(input) : batteryPeriodView(input);
}

const DASH = "--";
/** The gauge's and the chart's scale. */
export const MAX_LEVEL = 100;
/** The gauge's segments, each a quarter of the scale. */
const SEGMENTS = 4;

function byDate(rows: readonly BatteryRow[]): Map<string, BatteryRow> {
	return new Map(rows.map((r) => [r.date, r]));
}

/** Older data exists, or may: the index is still fetching its history. */
function canGoBack(data: BatteryData, from: string): boolean {
	return canStepBack(data.rows[0]?.date, data.complete, from);
}

const text = (value: number | undefined) => (value !== undefined ? String(value) : DASH);

/* ------------------------------------------------------------------ */
/*  1d                                                                 */
/* ------------------------------------------------------------------ */

/** Today's gauge: four 25-point segments open at the bottom, filled from the first to the newest level. */
export interface BatteryGauge {
	/** The newest level, "--" without one. */
	value: string;
	/** The scale's top, printed under the value. */
	max: string;
	/** Each segment's fill, 0..1, in drawing order: 25 fills exactly the first. */
	segments: number[];
}

/** A past day's ring: its high over "High", its low over "Low". */
export interface BatteryRing {
	high: string;
	low: string;
	/** In colour for a day with data; the phone's grey outline without. */
	filled: boolean;
}

export interface BatteryTile {
	/** "+18", "-73"; "--" for 0 or none. */
	value: string;
	label: "Charged" | "Drained";
}

/** A Factors row: "Sleep · 9h 59m · +55". */
export interface BatteryFactor {
	/** Garmin's event type: SLEEP, NAP, RECOVERY, STRESS, ACTIVITY. */
	type: string;
	/** "Sleep", "Nap", "Low Stress", "High Stress", or the activity's name. */
	label: string;
	/** An (i) after the label. */
	info: boolean;
	/** "9h 59m", "36m". */
	duration: string;
	/** "+55", "-6"; empty when the row shows none. */
	impact: string;
	/** The arrow beside the impact. */
	trend?: "up" | "down";
	/** When the event began, epoch ms, and how long Garmin says it ran: for the row's sheet. */
	start?: number;
	minutes?: number;
	/** Garmin's short feedback (RESTFUL_PERIOD, RESTFUL_NAP…), the sheet's verdict. */
	feedback?: string;
	activityId?: number;
}

/**
 * The 1d timeline: the Stress page's bars, runs, hour dots and wake marker
 * (`timelineOf`), with the Body Battery curve over them. `state` is `drawn`
 * once there is a curve or a stress reading to draw.
 */
export interface BatteryTimeline extends StressTimeline {
	/** The level a step, `x0..x1` across the day; a step without a reading is left out, and the line breaks there. */
	curve: Array<{ x0: number; x1: number; level: number; estimated?: true }>;
}

export interface BatteryDayView {
	range: "1d";
	date: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** Today: the gauge. */
	gauge?: BatteryGauge;
	/** A past day: the ring. */
	ring?: BatteryRing;
	/** The headline and sentence; null for a feedback type whose wording is not known yet. */
	feedback: BatteryFeedback | null;
	/** The type the copy was looked up by, when the day has one. */
	feedbackType?: string;
	/** Charged, Drained. */
	tiles: BatteryTile[];
	timeline: BatteryTimeline;
	/** Newest first. Empty while the events load and on a day without any: no Factors section. */
	factors: BatteryFactor[];
}

export function batteryDayView(input: BatteryInput): BatteryDayView {
	const date = dayOf(input.route, input.today);
	const row = byDate(input.data.rows).get(date);
	const timeline = batteryTimelineOf(input.readings, input.sleep?.wake);
	const view: BatteryDayView = {
		range: "1d",
		date,
		label: dayLabel(date, input.today),
		canGoBack: canGoBack(input.data, date),
		canGoForward: date < input.today,
		feedback: batteryFeedback(row?.feedback),
		tiles: [
			{ value: signed(row?.charged, "+"), label: "Charged" },
			{ value: signed(row?.drained, "-"), label: "Drained" },
		],
		timeline,
		factors: factorsOf(input.events, input.sleep?.seconds),
	};
	if (row?.feedback) view.feedbackType = row.feedback;
	if (date < input.today) view.ring = ringOf(row);
	else view.gauge = gaugeOf(row?.latest ?? timeline.curve[timeline.curve.length - 1]?.level);
	return view;
}

/** A tile's figure: "+18" charged, "-73" drained, and "--" for a day it never moved, as the web shows today's 0. */
export function signed(value: number | undefined, sign: "+" | "-"): string {
	return value === undefined || value === 0 ? DASH : `${sign}${value}`;
}

/** The gauge at `level`: each 25-point segment filled as far as the level reaches into it. */
export function gaugeOf(level: number | undefined): BatteryGauge {
	const quarter = MAX_LEVEL / SEGMENTS;
	return {
		value: text(level),
		max: String(MAX_LEVEL),
		segments: Array.from({ length: SEGMENTS }, (_, k) => (level === undefined ? 0 : Math.min(1, Math.max(0, (level - k * quarter) / quarter)))),
	};
}

/** The ring of a day's row: its high and low, grey and "--" for a day without data. */
export function ringOf(row: Pick<BatteryRow, "high" | "low"> | null | undefined): BatteryRing {
	return { high: text(row?.high), low: text(row?.low), filled: row?.high !== undefined || row?.low !== undefined };
}

/**
 * The 1d timeline from the day's readings: undefined while they load, null
 * once Garmin had none. The curve's steps follow the stress bars' (three
 * minutes from the watch's midnight, over the day's real length); a MODELED
 * step is estimated. ADJUSTED and RESET steps, round a clock change, draw as
 * measured until the phone shows how they look.
 */
export function batteryTimelineOf(readings: StressDay | null | undefined, wake?: number): BatteryTimeline {
	const base = timelineOf(readings, wake);
	const curve: BatteryTimeline["curve"] = [];
	const battery = readings ? batteryDayIn({ extra: { [STRESS_DAY_KEY]: readings } }) : null;
	if (readings && battery) {
		const length = dayLength(readings);
		const estimated = battery.runs.filter((r) => r.status === "MODELED");
		for (let i = 0; i < battery.levels.length; i++) {
			const level = battery.levels[i] ?? null;
			const x0 = (i * battery.step) / length;
			if (x0 >= 1) break;
			if (level === null) continue;
			const step: BatteryTimeline["curve"][number] = { x0, x1: Math.min(1, ((i + 1) * battery.step) / length), level };
			if (estimated.some((r) => i >= r.from && i < r.to)) step.estimated = true;
			curve.push(step);
		}
	}
	const state = readings === undefined ? "pending" : curve.length || base.state === "drawn" ? "drawn" : "empty";
	return { ...base, state, curve };
}

/**
 * The Factors rows, newest first, as the phone lists them: the night that
 * ended on the day, which began the evening before, comes last.
 *
 * - An event Garmin gave no feedback (NONE) is not listed, unless it is the
 *   night, which never has any: Oct 1's two late naps at 0 were left out.
 * - A Sleep row gives the night's sleep time, not the event's window (Oct 7:
 *   9h 59m, where the event ran 10h 0m), falling back on the window without
 *   the night.
 * - The impact is signed, with an arrow. A Low Stress row that did not raise
 *   the battery shows none (Oct 2's −1), nor does a row that changed nothing
 *   (inferred).
 */
export function factorsOf(events: readonly BodyBatteryMarker[] | null | undefined, sleepSeconds?: number): BatteryFactor[] {
	const listed = (events ?? []).filter(
		(e): e is BodyBatteryMarker & { type: string } =>
			typeof e?.type === "string" && e.type.trim() !== "" && (e.type.trim().toUpperCase() === "SLEEP" || e.feedback?.trim().toUpperCase() !== "NONE"),
	);
	return listed
		.map((event, i) => ({ event, i }))
		.sort((a, b) => (b.event.start ?? -Infinity) - (a.event.start ?? -Infinity) || a.i - b.i)
		.map(({ event }) => factorOf(event, sleepSeconds));
}

function factorOf(event: BodyBatteryMarker & { type: string }, sleepSeconds: number | undefined): BatteryFactor {
	const type = event.type.trim().toUpperCase();
	const seconds = type === "SLEEP" && sleepSeconds !== undefined ? sleepSeconds : event.minutes !== undefined ? event.minutes * 60 : undefined;
	const impact = event.impact;
	const shown = impact !== undefined && impact !== 0 && !(type === "RECOVERY" && impact < 0);
	const factor: BatteryFactor = {
		type,
		label: factorLabel(type, event.activity),
		info: factorHasInfo(type),
		duration: seconds !== undefined ? duration(seconds) : DASH,
		impact: shown ? (impact > 0 ? `+${impact}` : String(impact)) : "",
	};
	if (shown) factor.trend = impact > 0 ? "up" : "down";
	if (event.start !== undefined) factor.start = event.start;
	if (event.minutes !== undefined) factor.minutes = event.minutes;
	if (event.feedback !== undefined) factor.feedback = event.feedback;
	if (event.activityId !== undefined) factor.activityId = event.activityId;
	return factor;
}

/* ------------------------------------------------------------------ */
/*  7d and 4w                                                          */
/* ------------------------------------------------------------------ */

/** A day's column: `x` across the plot (0..1), its high and low; neither on a day without data, which draws nothing. */
export interface BatteryColumn {
	date: string;
	x: number;
	high?: number;
	low?: number;
}

export interface BatteryDayCard {
	date: string;
	/** "Thursday". */
	weekday: string;
	/** "October 8", or "October 22, 2025" in another year. */
	detail: string;
	/** "63" over "High" and "25" over "Low"; "--" on a day without data. */
	high: string;
	low: string;
	/** The 1d page the card switches to. */
	offset: number;
}

export interface BatteryPeriodView {
	range: "7d" | "4w";
	from: string;
	to: string;
	label: string;
	canGoBack: boolean;
	canGoForward: boolean;
	/** "Daily Values". */
	title: string;
	/** One a day, oldest first, today's partial day included. */
	columns: BatteryColumn[];
	/** 7d: every day's dot labelled with its weekday; 4w: the shared axis, its ends labelled "MM-DD". */
	axis: PeriodAxis;
	/** Not on the phone or the web: the rounded means of the highs and of the lows, over the days with data. */
	averages: { high?: number; low?: number };
	/** Not on the phone or the web either: the period's highest high and lowest low. */
	highest?: number;
	lowest?: number;
	/** A card a day, newest first. */
	days: BatteryDayCard[];
}

/** 7d and 4w; a route on any other range than 7d reads as 4w. */
export function batteryPeriodView(input: BatteryInput): BatteryPeriodView {
	const { data, route, today } = input;
	const range = route.range === "7d" || route.range === "1d" ? "7d" : "4w";
	const span = periodOf(range, route.offset, today);
	const days = daysOf(span);
	const rows = byDate(data.rows);
	const columns = days.map((date, i): BatteryColumn => {
		const row = rows.get(date);
		const column: BatteryColumn = { date, x: spread(i, days.length) };
		if (row?.high !== undefined) column.high = row.high;
		if (row?.low !== undefined) column.low = row.low;
		return column;
	});
	const highs = columns.flatMap((c) => (c.high !== undefined ? [c.high] : []));
	const lows = columns.flatMap((c) => (c.low !== undefined ? [c.low] : []));
	const view: BatteryPeriodView = {
		range,
		from: span.from,
		to: span.to,
		label: periodLabel(span.from, span.to, today),
		canGoBack: canGoBack(data, span.from),
		canGoForward: route.offset < 0,
		title: "Daily Values",
		columns,
		axis: range === "7d" ? weekdayAxis(days) : dayAxis(days),
		averages: {},
		days: [...columns].reverse().map((c) => ({
			date: c.date,
			weekday: weekdayOf(c.date),
			detail: cardDate(c.date, today),
			high: text(c.high),
			low: text(c.low),
			offset: offsetOfDay(c.date, today),
		})),
	};
	const avgHigh = meanOf(highs, ROUNDING);
	const avgLow = meanOf(lows, ROUNDING);
	if (avgHigh !== undefined) view.averages.high = avgHigh;
	if (avgLow !== undefined) view.averages.low = avgLow;
	if (highs.length) view.highest = Math.max(...highs);
	if (lows.length) view.lowest = Math.min(...lows);
	return view;
}

/** 7d's axis: a large dot under every day's column, each labelled with its weekday, "Fri" … "Thu". */
export function weekdayAxis(days: readonly string[]): PeriodAxis {
	const n = days.length;
	return {
		dots: days.map((_, i) => ({ x: spread(i, n), large: true })),
		labels: days.map((date, i) => ({ x: spread(i, n), text: weekdayOf(date).slice(0, 3) })),
	};
}
