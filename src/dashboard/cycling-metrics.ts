import type { ActivityDetail } from "../sync/activity-detail";
import { POWER_DURATIONS, type ActivityRow } from "../sync/activity-index";
import type { Units } from "./activities";
import {
	clockMap,
	distanceAxis,
	RUN_CHARTS,
	timeAxis,
	type CardId,
	type ChartColour,
	type ChartContext,
	type ChartFigure,
	type ChartKey,
	type ChartMetric,
	type ChartPicker,
	type ChartsSpec,
	type CustomCardDef,
	type CustomChart,
	type LaneSet,
	type MetricDef,
	type PickerDef,
	type RunMetric,
	type RunOverride,
	type XAxis,
	type YAxis,
} from "./activity-chart-pages";
import { fixed, MPH_PER_MS } from "./activity-stats-pages";
import { axisDuration, INTERVAL_LENGTH, RECORD_WORD } from "./cycling-power-curve-copy";
import { powerCurve } from "./cycling-power-curve-pages";
import { duration } from "./series";

/**
 * A ride's Charts tab as data (ref/activity-details/road-cycling/README.md,
 * "Charts" and "Profile table"; activity 24706138262): its twenty cards in
 * the phone's order, the charts of samples the run doesn't have (Speed, bike
 * Cadence, L/R Balance, the power phases, the platform centre offsets,
 * Position), its pickers, its seven power zones, and its own cards: Position,
 * Time in Position, Power Phase and Balance, Platform Offset and the Power
 * Curve. `cycling-activity-charts.ts` places the own cards.
 *
 * The rules are the spec's, each proved on the captured ride:
 *
 * - Area charts run 0:00 to the last sample's timer time (57:20); the dot
 *   charts from the first to the last sample where every series has a value
 *   (L/R 0:12–57:05, the power phases 0:18–57:05: both pedals, the left alone
 *   starting at 0:11, the right at 0:16; PCO 0:11–57:05).
 * - Speed, Power and Cadence share a top of max + 0.428 × (max − min) (their
 *   landscape labels pin it to [0.4272, 0.4284)); Heart Rate's is 0.46 (its
 *   labels 99 125 150 176 202 hold for 0.457–0.464; the run's 0.443 would give
 *   99 124 150 175 201; Inferred, as the spec leaves it unresolved);
 *   Elevation's measured 0.42 (labels the same as the run's 0.405).
 * - Power's labels step 200 (the smallest 1, 2 or 5 × 10ⁿ with at most 5.5
 *   steps, as the swims'), where the run's nice step would give 100.
 * - Performance Condition is bounded at ±(its largest |value| + 1): ±4 on the
 *   ride's -3 … +2.
 * - The angle and offset charts have fixed windows, the angle growing down;
 *   samples outside the window are not drawn (Power Phase: Start shows one
 *   left sample at 108° nowhere).
 * - Zone shares are floored, of the activity's time (the swims' and the Stair
 *   Stepper's rule; the ride's zones give the same floors of their own sum).
 * - Position is on the clock: its axis runs 0 to the summary's duration
 *   (57:21) and the stretches sit at their clock time, the 78 s pause not
 *   closed, the last burst past the axis' end not drawn (Garmin's own
 *   placement, kept 1:1). Time in Position's shares are rounded (98.96 → 99).
 * - The Power Curve's This Activity is the ride's index row (its best power
 *   by duration); its Record the index's all-time best over every power ride,
 *   this one too; 14 durations without 20 s; W/kg over the ride's weigh-in.
 *
 * Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Rules                                                              */
/* ------------------------------------------------------------------ */

/** Speed's, Power's and Cadence's top: max + 0.428 × (max − min). */
export const RIDE_PAD = 0.428;
/** Heart Rate's (Inferred within 0.457–0.464). */
export const RIDE_HR_PAD = 0.46;
/** Elevation's, measured (18.39 ± 0.1 m on the ride). */
export const RIDE_ELEVATION_PAD = 0.42;

/** The rider positions Garmin records: 1 standing and 3 its transition draw Standing; 0, 2 Seated. */
const STANDING: ReadonlySet<number> = new Set([1, 3]);

/** The Power Curve's durations: the 15 without 20 s, as the phone's axis has them. */
export const CURVE_SECONDS: readonly number[] = POWER_DURATIONS.filter((s) => s !== 20);

/* ------------------------------------------------------------------ */
/*  Charts of samples                                                  */
/* ------------------------------------------------------------------ */

function column(detail: ActivityDetail, name: string): ReadonlyArray<number | null> {
	return detail.samples[name] ?? [];
}

const has = (detail: ActivityDetail, name: string) => column(detail, name).some(isNumber);

function speedIn(ms: number, units: Units): number {
	return ms * (units === "imperial" ? MPH_PER_MS : 3.6);
}

const speedUnit = (units: Units) => (units === "imperial" ? "mph" : "km/h");

function figure(value: string | undefined, label: string, unit?: string): ChartFigure[] {
	if (value === undefined) return [];
	return [unit ? { value, unit, label } : { value, label }];
}

/** Speed: an area in the Pace blue, 28.8 and 43.6 km/h. */
const SPEED: MetricDef = {
	title: "Speed",
	has: (d) => column(d, "speed").some((v) => isNumber(v) && v > 0),
	values: (d, units) => column(d, "speed").map((v) => (isNumber(v) ? speedIn(v, units) : null)),
	mark: "area",
	fill: "pace",
	accent: "blue",
	axis: { pad: RIDE_PAD },
	average: { value: (d, units) => mapped(num(d.summary.averageSpeed), (v) => speedIn(v, units)) },
	figures: (d, units) => [
		...figure(mapped(num(d.summary.averageSpeed), (v) => fixed(speedIn(v, units), 1)), "Average", speedUnit(units)),
		...figure(mapped(num(d.summary.maxSpeed), (v) => fixed(speedIn(v, units), 1)), "Maximum", speedUnit(units)),
	],
};

/** Cadence: the bike's, an area in the Stamina orange from 0 (coasting keeps its zeros), 81 and 103 rpm. */
const BIKE_CADENCE: MetricDef = {
	title: "Cadence",
	has: (d) => column(d, "bikeCadence").some((v) => isNumber(v) && v > 0),
	values: (d) => column(d, "bikeCadence").map((v) => (isNumber(v) ? v : null)),
	mark: "area",
	fill: "stamina",
	accent: "orange",
	axis: { pad: RIDE_PAD },
	average: { value: (d) => num(d.summary.averageBikeCadence) },
	figures: (d) => [...figure(whole(d.summary.averageBikeCadence), "Average", "rpm"), ...figure(whole(d.summary.maxBikeCadence), "Maximum", "rpm")],
};

/** Each side's share of the power, whole: 49.27 → "49", 50.73 → "51"; one side alone gives the other. */
export function balanceShares(detail: ActivityDetail): { left: number; right: number } | null {
	const left = num(detail.summary.leftBalance);
	const right = num(detail.summary.rightBalance);
	if (left === undefined && right === undefined) return null;
	return { left: left ?? 100 - right!, right: right ?? 100 - left! };
}

/** L/R Balance: the right pedal's share as dots, 100% L at the top, 50/50 halfway, 100% R at the bottom. */
const LR_BALANCE: MetricDef = {
	title: "L/R Balance",
	has: (d) => has(d, "balanceRight"),
	values: (d) => column(d, "balanceRight").map((v) => (isNumber(v) ? v : null)),
	mark: "dots",
	colour: "purple",
	accent: "purple",
	// Its labels ("100% L") are wider than a number's.
	frame: "balance",
	yAxis: () => ({
		bottom: 100,
		top: 0,
		labels: [
			{ value: 0, text: "100% L" },
			{ value: 50, text: "50/50" },
			{ value: 100, text: "100% R" },
		],
	}),
	keepLabels: true,
	trim: true,
	figures: (d) => {
		const shares = balanceShares(d);
		if (!shares) return [];
		return [
			{ value: fixed(shares.left, 0), unit: "%", label: "Left Balance" },
			{ value: fixed(shares.right, 0), unit: "%", label: "Right Balance" },
		];
	},
};

/** An angle chart's window: its top and bottom (the angle grows down the plot) and its labels, top first. */
interface AngleWindow {
	top: number;
	bottom: number;
	labels: ReadonlyArray<readonly [value: number, text: string]>;
	/** Angles past BDC read as before TDC: 357° is -3°, so the window runs 270 … 90 through TDC. */
	wrap?: boolean;
}

const PHASE_START: AngleWindow = {
	top: -90,
	bottom: 90,
	wrap: true,
	labels: [
		[-90, "270"],
		[-45, "315"],
		[0, "TDC 0"],
		[45, "45"],
		[90, "90"],
	],
};
const PHASE_END: AngleWindow = {
	top: 135,
	bottom: 315,
	labels: [
		[135, "135"],
		[180, "BDC 180"],
		[225, "225"],
		[270, "270"],
		[315, "315"],
	],
};
const PEAK_START: AngleWindow = {
	top: 0,
	bottom: 135,
	labels: [
		[0, "TDC 0"],
		[45, "45"],
		[90, "90"],
		[135, "135"],
	],
};
const PEAK_END: AngleWindow = {
	top: 45,
	bottom: 180,
	labels: [
		[45, "45"],
		[90, "90"],
		[135, "135"],
		[180, "BDC 180"],
	],
};

/** The power phase charts' key, under the axis title: the dial's left green, the right's blue. */
export const PEDAL_KEY: readonly ChartKey[] = [
	{ label: "Left", colour: "pedal-left", kind: "dot" },
	{ label: "Right", colour: "pedal-right", kind: "dot" },
];

/** The value where both columns have one, else null: the samples a two-pedal chart's axis spans. */
function both(a: ReadonlyArray<number | null>, b: ReadonlyArray<number | null>): Array<number | null> {
	return a.map((v, i) => (isNumber(v) && isNumber(b[i]) ? v : null));
}

/**
 * A power phase chart: the left pedal's angles and the right's as dots (left
 * green, right blue), on a fixed window; its axis spans the samples where
 * both pedals have one. Angles outside the window are not drawn. Its frame:
 * the phase's or the peak's, the End's with wider labels ("BDC 180").
 */
function phaseChart(
	title: string,
	chip: string | undefined,
	card: CardId | undefined,
	columns: readonly [string, string],
	window: AngleWindow,
	frame: "phase" | "phase-wide" | "peak" | "peak-wide",
): MetricDef {
	const lo = Math.min(window.top, window.bottom);
	const hi = Math.max(window.top, window.bottom);
	const angle = (v: number) => (window.wrap && v >= 180 ? v - 360 : v);
	const drawn = (values: ReadonlyArray<number | null>) =>
		values.map((v) => {
			if (!isNumber(v)) return null;
			const a = angle(v);
			return a >= lo && a <= hi ? a : null;
		});
	const def: MetricDef = {
		title,
		has: (d) => has(d, columns[0]) && has(d, columns[1]),
		values: (d) => both(column(d, columns[0]), column(d, columns[1])),
		series: (d) => [
			{ values: drawn(column(d, columns[0])), colour: "green" },
			{ values: drawn(column(d, columns[1])), colour: "pedal-right" },
		],
		trim: true,
		keepLabels: true,
		mark: "dots",
		accent: "pedal-left",
		frame,
		yAxis: () => ({ bottom: window.bottom, top: window.top, labels: window.labels.map(([value, text]) => ({ value, text })) }),
		figures: () => [],
		decorate: (chart) => {
			chart.legend = [...PEDAL_KEY];
		},
	};
	if (chip) def.chip = chip;
	if (card) def.card = card;
	return def;
}

/**
 * A platform centre offset: dots on a fixed ±30 mm window labelled every 15,
 * the summary's average as a white dashed line over them (text-normal, full weight). The right pedal's runs upside
 * down (-30 at the top), as the phone and the web draw it.
 */
function offsetChart(title: string, columnName: string, averageKey: string, colour: ChartColour, upsideDown: boolean): MetricDef {
	const steps = [30, 15, 0, -15, -30];
	return {
		title,
		has: (d) => has(d, columnName),
		values: (d) => column(d, columnName).map((v) => (isNumber(v) ? v : null)),
		mark: "dots",
		colour,
		accent: colour,
		frame: "offset",
		yAxis: (): YAxis =>
			upsideDown
				? { bottom: 30, top: -30, labels: [...steps].reverse().map((value) => ({ value, text: String(value) })) }
				: { bottom: -30, top: 30, labels: steps.map((value) => ({ value, text: String(value) })) },
		keepLabels: true,
		trim: true,
		average: { value: (d) => num(d.summary[averageKey]), dashed: true, strong: true },
		figures: () => [],
	};
}

/* ------------------------------------------------------------------ */
/*  Position                                                           */
/* ------------------------------------------------------------------ */

export type PositionLane = "standing" | "seated";

/** Position's lanes, top to bottom: Standing on the plot's top line, Seated halfway down. */
export const POSITION_LANES: LaneSet["lanes"] = [
	{ id: "standing", label: "Standing", colour: "standing" },
	{ id: "seated", label: "Seated", colour: "deep-orange" },
];

/** Position's key, which the landscape overlay shows (the card shows none). */
export const POSITION_KEY: readonly ChartKey[] = [
	{ label: "Seated", colour: "deep-orange", kind: "dot" },
	{ label: "Standing", colour: "standing", kind: "dot" },
];

/** A stretch of riding in one position, in seconds on the clock. */
export interface PositionSpan {
	from: number;
	to: number;
	lane: PositionLane;
}

/**
 * The ride cut into seated and standing stretches on the clock: each event
 * holds until the next, Seated before the first, the last until the clock's
 * end (the elapsed time). Neighbours in the same lane join: standing 1571 →
 * 1577 → 1578 is one stretch.
 */
export function positionSpans(detail: ActivityDetail): PositionSpan[] {
	const events = [...(detail.positions ?? [])].filter((e) => isNumber(e.at)).sort((a, b) => a.at - b.at);
	if (!events.length) return [];
	const end = Math.max(num(detail.summary.elapsedDuration) ?? 0, num(detail.summary.duration) ?? 0, events.at(-1)!.at);
	const spans: PositionSpan[] = [];
	const push = (from: number, to: number, lane: PositionLane) => {
		if (!(to > from)) return;
		const last = spans.at(-1);
		if (last && last.lane === lane && last.to === from) last.to = to;
		else spans.push({ from, to, lane });
	};
	push(0, events[0]!.at, "seated");
	events.forEach((event, i) => push(event.at, events[i + 1]?.at ?? end, STANDING.has(event.position) ? "standing" : "seated"));
	return spans;
}

/**
 * Position's lanes on the card's axis: on the Time axis the clock from 0 to
 * the summary's duration (all six ticks, 57:21), the stretches at their clock
 * time and cut at the axis' end; on the Distance axis each clock time at the
 * distance ridden by then (Inferred: not shot). Null without positions.
 */
export function positionLanes(ctx: Pick<ChartContext, "detail" | "axis" | "units" | "end">): (LaneSet & { x: XAxis }) | null {
	const spans = positionSpans(ctx.detail);
	if (!spans.length) return null;
	const time = ctx.axis === "time";
	const end = time ? (num(ctx.detail.summary.duration) ?? ctx.end) : ctx.end;
	if (!(end > 0)) return null;
	const place = time ? (clock: number) => clock : clockMap(ctx.detail, "distance");
	const bars: LaneSet["bars"] = [];
	for (const span of spans) {
		const from = clamp01(place(span.from) / end);
		const to = clamp01(place(span.to) / end);
		if (to > from) bars.push({ from, to, lane: span.lane });
	}
	return { lanes: POSITION_LANES, bars, x: time ? timeAxis(0, end) : distanceAxis(end, ctx.units) };
}

/** Position as a chart of lanes: the landscape's base or overlay (the card is the sport's own, below). */
const POSITION: MetricDef = {
	title: "Position",
	has: (d) => (d.positions?.length ?? 0) > 0,
	values: () => [],
	mark: "lanes",
	accent: "deep-orange",
	figures: () => [],
	lanes: (ctx) => positionLanes(ctx),
	decorate: (chart) => {
		chart.legend = [...POSITION_KEY];
	},
};

/* ------------------------------------------------------------------ */
/*  The metrics and pickers                                            */
/* ------------------------------------------------------------------ */

/** The ride's charts of samples the run doesn't have, by id (the Stats and Overview badges open the same ids). */
export const CYCLING_METRICS: Readonly<Record<ChartMetric, MetricDef>> = {
	speed: SPEED,
	"bike-cadence": BIKE_CADENCE,
	"lr-balance": LR_BALANCE,
	"pp-start": phaseChart("Power Phase: Start", "Power Phase Start", undefined, ["ppStartL", "ppStartR"], PHASE_START, "phase"),
	"pp-end": phaseChart("Power Phase: End", "Power Phase End", undefined, ["ppEndL", "ppEndR"], PHASE_END, "phase-wide"),
	"peak-pp-start": phaseChart("Peak Power Phase Start", undefined, "pp-start", ["pppStartL", "pppStartR"], PEAK_START, "peak"),
	"peak-pp-end": phaseChart("Peak Power Phase End", undefined, "pp-end", ["pppEndL", "pppEndR"], PEAK_END, "peak-wide"),
	"left-pco": offsetChart("Left Platform Center Offset", "pcoL", "leftPlatformCenterOffset", "red", false),
	"right-pco": offsetChart("Right Platform Center Offset", "pcoR", "rightPlatformCenterOffset", "orange", true),
	position: POSITION,
};

/**
 * The pickers on the cards' titles: Heart Rate's (the run's), each Power
 * Phase card's normal or peak phase (Inferred wording and keys: one picker a
 * card, as the web's menus), and the Power Curve's W or W/kg.
 */
export const CYCLING_PICKERS: Readonly<Record<CardId, PickerDef>> = {
	"heart-rate": RUN_CHARTS.pickers["heart-rate"]!,
	"pp-start": {
		key: "ppStart",
		title: "Power Phase",
		options: [
			{ value: "pp-start", metric: "pp-start" },
			{ value: "peak-pp-start", metric: "peak-pp-start" },
		],
	},
	"pp-end": {
		key: "ppEnd",
		title: "Power Phase",
		options: [
			{ value: "pp-end", metric: "pp-end" },
			{ value: "peak-pp-end", metric: "peak-pp-end" },
		],
	},
	// The Power Curve is the ride's own card: its choices are its unit, not charts of samples.
	"power-curve": {
		key: "curve",
		title: "Power Curve",
		options: [
			{ value: "w", metric: "w" },
			{ value: "wkg", metric: "wkg" },
		],
	},
};

/**
 * What the ride draws differently on the run's own charts: Power titled
 * "Power" with no W/kg picker, on its own axis and frame, in its overlay
 * pink; the ride's pads on Heart Rate and Elevation; Performance Condition
 * at ±(its largest value + 1), its overlay labelled as its card ("+4 +2 0
 * -2 -4"); Stamina's overlay with its key, in #f98925. Its overlay's 0–102
 * axis (labels 0 26 51 76 102, where the card runs 0–100) is not kept
 * (Inferred: the spec leaves it unexplained).
 */
export const RIDE_OVERRIDES: Readonly<Partial<Record<RunMetric, RunOverride>>> = {
	power: { title: "Power", axis: { pad: RIDE_PAD, step: "fit" }, accent: "power-line", frame: "chart" },
	"heart-rate": { axis: { pad: RIDE_HR_PAD } },
	"heart-rate-zones": { axis: { pad: RIDE_HR_PAD } },
	elevation: { axis: { pad: RIDE_ELEVATION_PAD } },
	"performance-condition": { axis: { reach: 1 }, keepLabels: true },
	stamina: { accent: "stamina-line", keepKey: true },
};

/* ------------------------------------------------------------------ */
/*  Zones                                                              */
/* ------------------------------------------------------------------ */

/** The seven power zones' names (the phone sets VO₂ with a subscript). */
export const POWER_ZONE_NAMES: Readonly<Record<number, string>> = {
	1: "Active Recovery",
	2: "Endurance",
	3: "Tempo",
	4: "Threshold",
	5: "VO₂ Max",
	6: "Anaerobic",
	7: "Neuromuscular",
};

/**
 * Their bars: Z1 white, Z2 blue, Z4 yellow, Z5 orange as shot; Z3 green, Z6
 * red and Z7 purple Inferred. Zone 1's white is the theme's text colour, as
 * the twin draws the phone's white lines, so it shows on a light theme too.
 */
export const POWER_ZONE_COLOURS: Readonly<Record<number, ChartColour>> = {
	1: "text",
	2: "zone-2",
	3: "zone-3",
	4: "yellow",
	5: "deep-orange",
	6: "power-zone-6",
	7: "power-zone-7",
};

/* ------------------------------------------------------------------ */
/*  The ride's own cards                                               */
/* ------------------------------------------------------------------ */

/** Position's card: Standing and Seated lanes on the clock (see `positionLanes`). */
export type PositionData = LaneSet & { x: XAxis };

/** A row of Time in Position: "Standing" over its bar, "0:36" and "1%" at its right. */
export interface PositionShare {
	lane: PositionLane;
	label: string;
	/** Rounded to the second. */
	time: string;
	/** Rounded, not floored: 98.96 → "99%". */
	percent: string;
	/** The bar's fill, 0 … 1: the rounded share. */
	fill: number;
	colour: ChartColour;
}

export interface TimeInPositionData {
	/** Standing first, then Seated. */
	rows: PositionShare[];
}

/** One pedal's dial: the power phase and its peak as arcs, clockwise from TDC in degrees. */
export interface PedalDial {
	side: "left" | "right";
	/** "LEFT", in the dial's middle. */
	label: string;
	phase: { start: number; end: number; colour: ChartColour } | null;
	peak: { start: number; end: number; colour: ChartColour } | null;
	/** "49" over "Left Balance", under the dial. */
	balance: { value: string; unit: string; label: string } | null;
}

/** A block of the key under the dials: a colour square and a title, then two values. */
export interface PhaseKey {
	title: string;
	colour: ChartColour;
	/** "11°" over "Avg PP" over "Start". */
	values: Array<{ value: string; label: string; sub: string }>;
}

export interface PowerPhaseData {
	dials: PedalDial[];
	/** Read in rows of two: L Power Phase, R Power Phase, L Peak Power Phase, R Peak Power Phase. */
	keys: PhaseKey[];
}

/** One pedal of Platform Offset. */
export interface PlatformPedal {
	side: "left" | "right";
	label: string;
	/** Under the pedal in red: "-9 mm", or "--" for an average of 0 or none (Garmin's own "--" for 0, kept 1:1). */
	value: string;
	/** The average line's offset in mm, toward "+" (outboard); 0 draws it on the centre, null draws none. */
	offset: number | null;
	/** Which side of the pedal its "+" is on: outboard. */
	plus: "left" | "right";
}

export interface PlatformOffsetData {
	pedals: PlatformPedal[];
	/** Squares, not dots: "Center" grey, "Average" red. */
	keys: Array<{ label: string; colour: ChartColour }>;
}

/** A duration with a value on a curve: its place across the plot (0 … 1) and its watts or W/kg. */
export interface CurveVertex {
	seconds: number;
	x: number;
	value: number;
}

export interface PowerCurveData {
	unit: "W" | "W/kg";
	/** "Compare this activity’s power to your power curve." */
	subtitle: string;
	/** The y axis' top, and its gridlines' values and labels, top first. */
	top: number;
	ticks: Array<{ value: number; text: string }>;
	/** The 14 durations' dots and labels on end ("1 sec" … "5 hr"), in equal steps. */
	durations: Array<{ seconds: number; x: number; label: string }>;
	/** The Record drawn first, This Activity over it; each ends at its last duration with a value. */
	record: CurveVertex[];
	activity: CurveVertex[];
	axisTitle: string;
	keys: ChartKey[];
}

/** Position's card. */
const positionCard: CustomCardDef = (ctx) => {
	const lanes = positionLanes(ctx);
	return lanes ? { title: "Position", figures: [], plot: "position", data: lanes satisfies PositionData } : null;
};

/** Time in Position: the summary's standing and seated times, each a rounded share of their sum (the timer time). */
export function timeInPosition(detail: ActivityDetail): TimeInPositionData | null {
	const standing = num(detail.summary.standingTime);
	const seated = num(detail.summary.seatedTime);
	if (standing === undefined && seated === undefined) return null;
	const total = (standing ?? 0) + (seated ?? 0);
	if (!(total > 0)) return null;
	const row = (lane: PositionLane, label: string, seconds: number, colour: ChartColour): PositionShare => {
		const share = Math.round((100 * seconds) / total);
		return { lane, label, time: duration(seconds), percent: `${share}%`, fill: share / 100, colour };
	};
	return { rows: [row("standing", "Standing", standing ?? 0, "standing"), row("seated", "Seated", seated ?? 0, "deep-orange")] };
}

const timeInPositionCard: CustomCardDef = (ctx) => {
	const data = timeInPosition(ctx.detail);
	// Its rows are the zone tables', and so is its title's place.
	return data ? { title: "Time in Position", figures: [], plot: "time-in-position", data, head: "zones" } : null;
};

/** "11°": whole degrees, halves up (67.5 → 68). */
export function degrees(value: number): string {
	return `${fixed(value, 0)}°`;
}

/** Power Phase and Balance: a dial a pedal from the summary's averages, and the key's four blocks. */
export function powerPhase(detail: ActivityDetail): PowerPhaseData | null {
	const v = (key: string) => num(detail.summary[key]);
	const arc = (start: number | undefined, end: number | undefined, colour: ChartColour) => (start !== undefined && end !== undefined ? { start, end, colour } : null);
	const shares = balanceShares(detail);
	const dial = (side: "left" | "right", prefix: "left" | "right", phase: ChartColour, peak: ChartColour): PedalDial => ({
		side,
		label: side.toUpperCase(),
		phase: arc(v(`${prefix}PowerPhaseStart`), v(`${prefix}PowerPhaseEnd`), phase),
		peak: arc(v(`${prefix}PowerPhasePeakStart`), v(`${prefix}PowerPhasePeakEnd`), peak),
		balance: shares ? { value: fixed(side === "left" ? shares.left : shares.right, 0), unit: "%", label: side === "left" ? "Left Balance" : "Right Balance" } : null,
	});
	const dials = [dial("left", "left", "pedal-left", "peak-left"), dial("right", "right", "pedal-right", "peak-right")];
	if (dials.every((d) => !d.phase && !d.peak)) return null;
	const key = (title: string, colour: ChartColour, start: number | undefined, end: number | undefined, label: string): PhaseKey | null =>
		start !== undefined && end !== undefined
			? {
					title,
					colour,
					values: [
						{ value: degrees(start), label, sub: "Start" },
						{ value: degrees(end), label, sub: "End" },
					],
				}
			: null;
	const keys = [
		key("L Power Phase", "pedal-left", v("leftPowerPhaseStart"), v("leftPowerPhaseEnd"), "Avg PP"),
		key("R Power Phase", "pedal-right", v("rightPowerPhaseStart"), v("rightPowerPhaseEnd"), "Avg PP"),
		// "Avg PPP" is readable on the shot; the second line is cut off (Inferred: as the power phase's).
		key("L Peak Power Phase", "peak-left", v("leftPowerPhasePeakStart"), v("leftPowerPhasePeakEnd"), "Avg PPP"),
		key("R Peak Power Phase", "peak-right", v("rightPowerPhasePeakStart"), v("rightPowerPhasePeakEnd"), "Avg PPP"),
	].filter((k): k is PhaseKey => k !== null);
	return { dials, keys };
}

const powerPhaseCard: CustomCardDef = (ctx) => {
	const data = powerPhase(ctx.detail);
	return data ? { title: "Power Phase and Balance", figures: [], plot: "power-phase-balance", data } : null;
};

/** Platform Offset: each pedal's average offset, "+" outboard (the left pedal's on its left). */
export function platformOffset(detail: ActivityDetail): PlatformOffsetData | null {
	const left = num(detail.summary.leftPlatformCenterOffset);
	const right = num(detail.summary.rightPlatformCenterOffset);
	if (left === undefined && right === undefined) return null;
	const pedal = (side: "left" | "right", mm: number | undefined): PlatformPedal => ({
		side,
		label: side === "left" ? "Left Pedal" : "Right Pedal",
		value: mm === undefined || Math.round(mm) === 0 ? "--" : `${fixed(mm, 0)} mm`,
		offset: mm === undefined ? null : mm,
		plus: side,
	});
	return {
		pedals: [pedal("left", left), pedal("right", right)],
		keys: [
			{ label: "Center", colour: "centre" },
			{ label: "Average", colour: "red" },
		],
	};
}

const platformOffsetCard: CustomCardDef = (ctx) => {
	const data = platformOffset(ctx.detail);
	return data ? { title: "Platform Offset", figures: [], plot: "platform-offset", data } : null;
};

/** The line under the Power Curve's title. */
export const CURVE_SUBTITLE = "Compare this activity’s power to your power curve.";

/**
 * The Power Curve in watts or in W/kg: the ride's own best power by duration
 * (its index row) over the all-time Record of every power ride in the index.
 * W runs 0 to 100·⌈max / 100⌉ in quarters (687 → 0 175 350 525 700); W/kg 0
 * to 5·⌈max / 5⌉ in fives (10.1 → 0 5 10 15), both over the ride's weigh-in
 * (687 ÷ 68.0 = 10.1, not the record ride's own weight). Null without the
 * ride's own curve, or for W/kg without a weigh-in.
 */
export function powerCurveData(detail: ActivityDetail, rows: readonly ActivityRow[], unit: "W" | "W/kg"): PowerCurveData | null {
	const own = rows.find((r) => r.id === detail.id)?.power;
	const kg = detail.weightKg ?? 0;
	if (!own || (unit === "W/kg" && !(kg > 0))) return null;
	const per = (watts: number) => (unit === "W/kg" ? watts / kg : watts);
	const record = powerCurve(rows);
	const recordAt = new Map(record.flatMap((p) => (p ? [[p.seconds, p.watts] as const] : [])));
	const durations = CURVE_SECONDS.map((seconds, i) => ({ seconds, x: i / (CURVE_SECONDS.length - 1), label: axisDuration(seconds) }));
	const curve = (watts: (seconds: number) => number | undefined): CurveVertex[] =>
		durations.flatMap((d) => {
			const w = watts(d.seconds);
			return w !== undefined && w > 0 ? [{ seconds: d.seconds, x: d.x, value: per(w) }] : [];
		});
	const activity = curve((s) => num(own[String(s)]));
	if (!activity.length) return null;
	const recordCurve = curve((s) => recordAt.get(s));
	const max = Math.max(0, ...activity.map((v) => v.value), ...recordCurve.map((v) => v.value));
	const step = unit === "W" ? 100 : 5;
	const top = Math.max(step, step * Math.ceil(max / step - 1e-9));
	const ticks =
		unit === "W"
			? [4, 3, 2, 1, 0].map((k) => ({ value: (top * k) / 4, text: plainNumber((top * k) / 4) }))
			: Array.from({ length: top / step + 1 }, (_, i) => top - i * step).map((value) => ({ value, text: String(value) }));
	return {
		unit,
		subtitle: CURVE_SUBTITLE,
		top,
		ticks,
		durations,
		record: recordCurve,
		activity,
		axisTitle: INTERVAL_LENGTH,
		keys: [
			{ label: "This Activity", colour: "blue", kind: "dot" },
			{ label: RECORD_WORD, colour: "record-key", kind: "dot" },
		],
	};
}

const CURVE_TITLES = { W: "Power Curve (W)", "W/kg": "Power Curve (W/kg)" } as const;

/** The Power Curve card, with its W | W/kg picker when the ride has a weigh-in (one choice is no picker). */
const powerCurveCard: CustomCardDef = (ctx, pick) => {
	const rows = ctx.extras.rows ?? [];
	const perKg = pick === "wkg" ? powerCurveData(ctx.detail, rows, "W/kg") : null;
	const data = perKg ?? powerCurveData(ctx.detail, rows, "W");
	if (!data) return null;
	const card: Omit<CustomChart, "kind" | "id" | "help"> = { title: CURVE_TITLES[data.unit], figures: [], plot: "power-curve", data };
	if ((ctx.detail.weightKg ?? 0) > 0) {
		const picker: ChartPicker = {
			key: CYCLING_PICKERS["power-curve"]!.key,
			options: [
				{ value: "w", label: CURVE_TITLES.W },
				{ value: "wkg", label: CURVE_TITLES["W/kg"] },
			],
			chosen: data.unit === "W/kg" ? "wkg" : "w",
		};
		card.picker = picker;
	}
	return card;
};

/** The ride's own cards, by id: `CustomChart.plot` names the Svelte plot that draws each (`activity/cycling/plots.ts`). */
export const CYCLING_CARDS: Readonly<Record<CardId, CustomCardDef>> = {
	position: positionCard,
	"time-in-position": timeInPositionCard,
	"power-phase-balance": powerPhaseCard,
	"platform-offset": platformOffsetCard,
	"power-curve": powerCurveCard,
};

/* ------------------------------------------------------------------ */
/*  The tab                                                            */
/* ------------------------------------------------------------------ */

/** The twenty cards, top to bottom, as the phone lists them; each only with data. */
export const RIDE_CARDS: readonly CardId[] = [
	"elevation",
	"speed",
	"power",
	"heart-rate",
	"stamina",
	"performance-condition",
	"training-effect",
	"bike-cadence",
	"lr-balance",
	"position",
	"time-in-position",
	"power-phase-balance",
	"pp-start",
	"pp-end",
	"platform-offset",
	"left-pco",
	"right-pco",
	"time-in-hr-zones",
	"time-in-power-zones",
	"power-curve",
];

/** The landscape chips' pool: every chart of samples the ride offers (the view sorts them by name and leaves out its base). */
export const RIDE_CHIPS: readonly ChartMetric[] = [
	"elevation",
	"bike-cadence",
	"heart-rate",
	"heart-rate-zones",
	"lr-balance",
	"left-pco",
	"peak-pp-end",
	"peak-pp-start",
	"performance-condition",
	"position",
	"power",
	"pp-end",
	"pp-start",
	"right-pco",
	"speed",
	"stamina",
];

/** The cards with a "?" on their title. */
export const RIDE_HELP: readonly CardId[] = [
	"stamina",
	"performance-condition",
	"training-effect",
	"position",
	"time-in-position",
	"power-phase-balance",
	"platform-offset",
	"time-in-hr-zones",
	"time-in-power-zones",
];

/** A ride's Charts tab: its profile's `charts`. */
export const RIDE_CHARTS: ChartsSpec = {
	cards: RIDE_CARDS,
	chips: RIDE_CHIPS,
	pickers: CYCLING_PICKERS,
	metrics: CYCLING_METRICS,
	custom: CYCLING_CARDS,
	help: RIDE_HELP,
	zoneNames: { power: POWER_ZONE_NAMES },
	zoneColours: { power: POWER_ZONE_COLOURS },
	zoneTotal: "duration",
	runOverrides: RIDE_OVERRIDES,
};

/* ------------------------------------------------------------------ */
/*  Numbers                                                            */
/* ------------------------------------------------------------------ */

function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function num(value: unknown): number | undefined {
	return isNumber(value) ? value : undefined;
}

function whole(value: unknown): string | undefined {
	const n = num(value);
	return n === undefined ? undefined : fixed(n, 0);
}

function mapped<T>(value: number | undefined, f: (v: number) => T): T | undefined {
	return value === undefined ? undefined : f(value);
}

/** A tick's label: whole when it is, else to two places with no trailing zeros. */
function plainNumber(value: number): string {
	return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
