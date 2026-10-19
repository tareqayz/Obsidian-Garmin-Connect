import type { AccountInfo } from "../sync/account";
import type { RunningEconomyRow } from "../sync/running-economy-index";
import type { Gauge, Tone } from "./gauges";
import { SHORT_MONTHS, canStepBack, dayAxis, daysBetween, daysOf, shiftMonth, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { ECONOMY_CLASS_NAMES, ECONOMY_COPY, ESTIMATE_HEADING, ESTIMATE_INTRO, ESTIMATE_STEPS, economyWord } from "./running-economy-copy";
import { shiftDate } from "./series";
import { r2, stepAxis } from "./stat-charts";
import { DIAL_END, dialAngle, segmentsFromAngles } from "./stat-dial";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { readingLabel } from "./vo2-max-pages";

/**
 * Garmin Connect's Running Economy page (Performance Stats), worked out from
 * the running economy index (`src/sync/running-economy-index.ts`) and the
 * account's latest reading (`account.json`'s `runningEconomy`). Rules measured
 * on the phone on 2026-10-11 and proved against the API
 * (ref/performance-stats/running-economy/README.md):
 *
 * - Scores are whole numbers and lower is better. Seven classes, by the help
 *   table: Recreational ≥ 225, Intermediate 215–224, Trained 205–214,
 *   Well-Trained 195–204, Expert 190–194, Superior 185–189, Elite ≤ 184.
 * - Current is the newest reading however old ("Monday, Sep 28", 13 days
 *   back): the index's newest row, or the account's when that is newer or the
 *   index has none. "Today" on the day (Inferred, as VO₂ Max). The number on
 *   the page's dial, Garmin's class under the dial ("Well-Trained", not
 *   `titleCase`'s "Well Trained") and its copy under that.
 * - The dial is linear from 235 at −150° to 180 at +150°, 5.4545° a point.
 *   Its band edges are the worse classes' lowest scores (225, 215, 205, 195,
 *   190, 185), at the elevenths of the sweep; the marker sits at
 *   (235 − score) / 55 in its class's colour (224 → −90°, the shot −90.06°),
 *   so a boundary score sits on a gap in its own class's colour. Home's
 *   270° `economyGauge` is not the page's dial.
 * - 4w plots every reading of the period at its day. 12w and 1y cut the
 *   period into 7-day blocks from its first day and plot each block's lowest
 *   score — not its mean — at the block's first day: Garmin's
 *   `runningeconomy/weekly` for the same window, on all 124 blocks seen
 *   (2026-03-28..04-03 holds 216, 217 and 218 and gives 216). A block
 *   without a reading has no point; the line joins the points straight, and
 *   nothing comes in from before the period. The phone still titles them
 *   "Weekly Averages".
 * - Avg is the plotted points' mean, rounded half up (12w's 222.5 → 223);
 *   Best is the lowest point.
 * - Points and lines take their class's colour: the line changes colour
 *   where it crosses the midpoint between two classes, a level boundary
 *   (214.5 on the 1y, seen; 224.5, 204.5 … Inferred). The legend lists the
 *   points' classes, worse first: "Intermediate", then "Trained".
 * - The y axis: five gridlines a step s apart, the smallest of 1, 2, 5, 10 …
 *   for which lo + 4s reaches the highest point, lo the largest multiple of s
 *   below the lowest (225–221, 224–220, 230–210). The x axis: 4w a dot a
 *   day, the ends labelled "M-dd" ("9-14"); 12w the block starts and the last
 *   day, the ends labelled; 1y a day axis from the 1st of the period's first
 *   month to the 1st of its last (Oct 1 → Oct 1), a dot and a name at each
 *   month start.
 *
 * Inferred (unseen on the phone): previous periods, a period without a
 * reading (the web's "You have no data for this time period."), a lone
 * point, Current without any reading (the bands, "--", and the help's
 * "Getting an Estimate"), "Today", the copy for the other six classes, the
 * colours and legend order past Intermediate and Trained, the y step past 5,
 * and a 1y block starting after the last month start (drawn past the axis'
 * end, x > 1).
 *
 * The charts' geometry is `running-economy-charts.ts`, off the Obsidian twin
 * (Figma 430:6114); the dial is `DIAL_KINDS.economy`.
 *
 * Pure.
 */

/** What the page's route says: the range and how many periods back. */
export interface RunningEconomyRoute {
	range: PeriodRange;
	offset: number;
}

/** What the view needs besides the route and the index's rows. */
export interface RunningEconomyContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** `account.json`: the latest reading, Current's fallback while the index has none (the `fitness` group off, a first sync). */
	account?: Pick<AccountInfo, "runningEconomy"> | null;
}

/** The web's line in place of a chart for a period without a reading. */
export const NO_DATA = "You have no data for this time period.";
/** The dial's number without a reading. */
export const DASH = "--";

const ECONOMY_STAT = PERFORMANCE_REGISTRY.page("running-economy")!;

/* ------------------------------------------------------------------ */
/*  Classes                                                            */
/* ------------------------------------------------------------------ */

/** Garmin's class words, worse to better: index 0 Recreational … 6 Elite. */
export const ECONOMY_WORDS: readonly string[] = ["RECREATIONAL", "INTERMEDIATE", "TRAINED", "WELL_TRAINED", "EXPERT", "SUPERIOR", "ELITE"];

/**
 * Each class's dial band and series colour, worse to better: red, orange,
 * light orange (Obsidian's yellow, Garmin's #FD9D39), green, blue, purple and
 * magenta (pink).
 */
export const ECONOMY_TONES: readonly Tone[] = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];

/** The six worse classes' lowest scores, Recreational's to Superior's: the help table, and the dial's band edges. */
export const ECONOMY_LIMITS: readonly number[] = [225, 215, 205, 195, 190, 185];

/** A score's class by the help table, 0 Recreational … 6 Elite: 224 → 1, 215 → 1, 214 → 2. */
export function economyClassIndex(score: number): number {
	return ECONOMY_LIMITS.filter((limit) => score < limit).length;
}

/** A reading's class: Garmin's word when this build knows it, else its score's. */
export function readingClassIndex(reading: { score: number; classification?: string }): number {
	const word = economyWord(reading.classification);
	const index = word === undefined ? -1 : ECONOMY_WORDS.indexOf(word);
	return index >= 0 ? index : economyClassIndex(reading.score);
}

/** A class's name, as the help table writes it: "Intermediate", "Well-Trained". */
export function economyClassNameAt(index: number): string {
	return ECONOMY_CLASS_NAMES[ECONOMY_WORDS[index]];
}

/**
 * Where the series changes colour: the midpoints between two classes' scores,
 * worse to better (224.5, 214.5, 204.5, 194.5, 189.5, 184.5). The 1y line
 * turns light orange below 214.5 (seen); the others are Inferred.
 */
export const ECONOMY_ZONE_EDGES: readonly number[] = ECONOMY_LIMITS.map((limit) => limit - 0.5);

/** The class of a value on the chart, by the zone edges: the score's own class for a whole score. */
export function economyZone(value: number): number {
	return ECONOMY_ZONE_EDGES.filter((edge) => value < edge).length;
}

/* ------------------------------------------------------------------ */
/*  The dial                                                           */
/* ------------------------------------------------------------------ */

/** The page dial's ends: linear from 235 at −150° to 180 at +150°, lower is better. */
export const ECONOMY_DIAL = { worst: 235, best: 180 } as const;

/** A score as a fraction of the dial, clamped: (235 − score) / 55, 224 → 0.2. */
export function economyAt(score: number): number {
	return Math.min(1, Math.max(0, (ECONOMY_DIAL.worst - score) / (ECONOMY_DIAL.worst - ECONOMY_DIAL.best)));
}

/** A score on the dial, degrees clockwise from 12 o'clock: 224 → −90, 215 → −40.91. */
export function economyAngle(score: number): number {
	return dialAngle(economyAt(score));
}

/** The bands' boundaries from −150° to 150°, to 2 dp: [-150, -95.45, -40.91, 13.64, 68.18, 95.45, 122.73, 150]. */
export const ECONOMY_DIAL_ANGLES: readonly number[] = [-DIAL_END, ...ECONOMY_LIMITS.map((limit) => r2(economyAngle(limit))), DIAL_END];

/** A reading as Current shows it. */
export interface EconomyReading {
	/** Its day; an account file written before the day was kept has none. */
	date?: string;
	score: number;
	/** Garmin's word: `INTERMEDIATE`. */
	classification?: string;
}

/** Current's dial. */
export interface EconomyDial {
	/** The number ("224", "--"), the bands, and the marker's place (`at`) and colour (its class's). No line inside. */
	gauge: Gauge;
	/** The marker, degrees clockwise from 12 o'clock; none without a reading. */
	angle?: number;
}

/**
 * A reading on the page's dial: the score in the middle, the marker at its
 * place on the linear scale in its class's colour — by Garmin's word, so 215
 * (Intermediate) is orange on the Intermediate/Trained gap where the band
 * under it would make it light orange. Without a reading, the bands and "--".
 */
export function economyDial(reading: Pick<EconomyReading, "score" | "classification"> | undefined): EconomyDial {
	const segments = segmentsFromAngles(ECONOMY_DIAL_ANGLES, ECONOMY_TONES);
	if (!reading) return { gauge: { value: DASH, segments } };
	const at = economyAt(reading.score);
	return { gauge: { value: String(reading.score), segments, at, tone: ECONOMY_TONES[readingClassIndex(reading)] }, angle: r2(dialAngle(at)) };
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

/** Current: the newest reading on the dial, its class and the class's copy. */
export interface EconomyCurrent {
	/** The reading's day; none without a reading. */
	date?: string;
	/** "Monday, Sep 28", "Today"; null without a reading or its day: no date line. */
	label: string | null;
	dial: EconomyDial;
	/** Under the dial: the class, "Intermediate"; without a reading, "Getting an Estimate". */
	heading: string;
	/** Under the heading: the class's copy, where it is known; without a reading, the estimate's first line. */
	copy?: string;
	/** Without a reading: the estimate's requirements, a bullet each. */
	steps?: string[];
}

/**
 * The newest reading: the index's newest row up to today, or the account's
 * (`runningeconomy/latest/{today}`, every sync) when it is newer or the index
 * has none. Both are 2026-09-28's 224 on the capture day.
 */
export function currentReading(rows: readonly RunningEconomyRow[], account: RunningEconomyContext["account"], today: string): EconomyReading | undefined {
	let newest: (EconomyReading & { date: string }) | undefined;
	for (const row of rows) {
		if (row.score === undefined || row.date > today || (newest && row.date <= newest.date)) continue;
		newest = { date: row.date, score: row.score };
		if (row.classification) newest.classification = row.classification;
	}
	const saved = account?.runningEconomy;
	if (saved?.score === undefined || (newest && !(saved.date && saved.date > newest.date))) return newest;
	const reading: EconomyReading = { score: saved.score };
	if (saved.date) reading.date = saved.date;
	if (saved.classification) reading.classification = saved.classification;
	return reading;
}

/** Current for a reading, or the "Getting an Estimate" state without one. */
export function economyCurrent(reading: EconomyReading | undefined, today: string): EconomyCurrent {
	if (!reading) return { label: null, dial: economyDial(undefined), heading: ESTIMATE_HEADING, copy: ESTIMATE_INTRO, steps: [...ESTIMATE_STEPS] };
	const index = readingClassIndex(reading);
	const current: EconomyCurrent = { label: reading.date ? readingLabel(reading.date, today) : null, dial: economyDial(reading), heading: economyClassNameAt(index) };
	if (reading.date) current.date = reading.date;
	const copy = ECONOMY_COPY[ECONOMY_WORDS[index]];
	if (copy) current.copy = copy;
	return current;
}

/* ------------------------------------------------------------------ */
/*  4w, 12w, 1y                                                        */
/* ------------------------------------------------------------------ */

/** 12w's and 1y's blocks, from the period's first day. */
export const BLOCK_DAYS = 7;

/** A block's point: its lowest reading, at its first day. */
export interface EconomyBlock {
	/** The block's first day: where it is drawn. */
	day: string;
	/** The day of the lowest reading (the first such day on a tie). */
	date: string;
	value: number;
}

/**
 * The span cut into 7-day blocks from its first day, each block with a
 * reading as its lowest score, oldest first. Garmin's
 * `runningeconomy/weekly?startDate&endDate` is exactly this for the span: its
 * last block counts only the readings up to `endDate`, and a block without a
 * reading is null there and missing here.
 */
export function economyBlocks(rows: readonly Pick<RunningEconomyRow, "date" | "score">[], span: Span): EconomyBlock[] {
	const blocks = new Map<number, EconomyBlock>();
	for (const row of rows) {
		if (row.score === undefined || row.date < span.from || row.date > span.to) continue;
		const k = Math.floor(daysBetween(span.from, row.date) / BLOCK_DAYS);
		const held = blocks.get(k);
		if (!held || row.score < held.value || (row.score === held.value && row.date < held.date)) {
			blocks.set(k, { day: shiftDate(span.from, BLOCK_DAYS * k), date: row.date, value: row.score });
		}
	}
	return [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, block]) => block);
}

/** A point of a range's line. */
export interface EconomyPoint {
	/** The reading's day (4w), or the day of its block's lowest (12w, 1y). */
	date: string;
	/** The day it is drawn at: its own on 4w, its block's first on 12w and 1y. */
	day: string;
	/** Across the plot, 0 at the axis' first day and 1 at its last. 1y's axis runs from a month's 1st to a month's 1st, so a block after the last one sits past 1. */
	x: number;
	/** The score. */
	value: number;
	/** Its class by the help table, 0 Recreational … 6 Elite, and the class's colour. */
	classIndex: number;
	tone: Tone;
}

/**
 * A class's band of the chart's values, where the line takes that class's
 * colour: between the edges halfway to the neighbouring classes' scores. The
 * line changes colour where it crosses an edge, so the boundary is level, as
 * Garmin draws it (the twin's Trained copy of the 1y line, clipped below
 * 214.5).
 */
export interface EconomyZone {
	/** 0 Recreational … 6 Elite, and its colour. */
	classIndex: number;
	tone: Tone;
	/** The band's upper edge (Trained's 214.5); null for the worst class the line reaches, whose band runs on up. */
	above: number | null;
	/** Its lower edge (Intermediate's 214.5); null for the best class the line reaches. */
	below: number | null;
}

/** A legend entry: the class's name and colour. */
export interface EconomyLegendItem {
	name: string;
	tone: Tone;
}

/** A range's line. */
export interface EconomyChart {
	points: EconomyPoint[];
	/** The classes the line passes through, worse first: the colour bands it is drawn in. */
	zones: EconomyZone[];
	/** The five gridlines' values, top first. */
	ticks: number[];
	/** The days the x axis runs: the period on 4w and 12w; the 1st of its first month to the 1st of its last on 1y. */
	axisSpan: Span;
	axis: PeriodAxis;
	/** 4w and 12w draw a dot on each point, and their legend swatches one; 1y is a bare line. */
	dots: boolean;
	/** The points' classes, worse first. */
	legend: EconomyLegendItem[];
}

/** "223" · "Avg Running Economy". */
export interface EconomyFigure {
	value: string;
	label: string;
}

/** The chart's title on each range: the phone calls the block minima "Weekly Averages" all the same. */
export const ECONOMY_TITLES: Readonly<Partial<Record<PeriodRange, string>>> = { "4w": "Daily Values", "12w": "Weekly Averages", "1y": "Weekly Averages" };

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * The y axis for a period's points, top first: five gridlines a step apart,
 * the step the smallest of 1, 2, 5, 10 … for which lo + 4·step reaches the
 * highest point, lo the largest multiple of the step below the lowest point.
 * 222–224 → 225–221; 221–224 → 224–220; 214–224 → 230–210 (1 and 2 fall
 * short). With a step of 1 this is VO₂ Max's "lowest less one".
 */
export function economyTicks(values: readonly number[]): number[] {
	if (!values.length) return [];
	const low = Math.round(Math.min(...values));
	const high = Math.max(...values);
	const ticks = (step: number) => {
		const lo = step * Math.floor((low - 1) / step);
		return [4, 3, 2, 1, 0].map((k) => lo + k * step);
	};
	for (const step of STEPS) {
		const out = ticks(step);
		if (out[0] >= high) return out;
	}
	return ticks(Math.ceil((high - low + 1) / 4));
}

/** An axis end: "9-14", "10-11", the month without its leading zero. */
export function economyAxisDay(date: string): string {
	return `${Number(date.slice(5, 7))}-${date.slice(8, 10)}`;
}

/** An axis whose labels are "MM-DD", relabelled "M-dd". */
function relabel(axis: PeriodAxis): PeriodAxis {
	return { dots: axis.dots, labels: axis.labels.map((l) => ({ ...l, text: l.text.replace(/^0/, "") })) };
}

/**
 * 1y's axis: the days from the 1st of the period's first month to the 1st of
 * its last (Oct 1, 2025 → Oct 1, 2026), a large dot at each month start with
 * its short name on end; `x` places a day on it.
 */
export function economyYearAxis(span: Span): { axisSpan: Span; axis: PeriodAxis; x: (day: string) => number } {
	const axisSpan = { from: `${span.from.slice(0, 7)}-01`, to: `${span.to.slice(0, 7)}-01` };
	const length = daysBetween(axisSpan.from, axisSpan.to);
	const x = (day: string) => (length > 0 ? daysBetween(axisSpan.from, day) / length : 0.5);
	const months: string[] = [];
	for (let month = axisSpan.from.slice(0, 7); month <= axisSpan.to.slice(0, 7); month = shiftMonth(month, 1)) months.push(`${month}-01`);
	return {
		axisSpan,
		axis: {
			dots: months.map((m) => ({ x: x(m), large: true })),
			labels: months.map((m) => ({ x: x(m), text: SHORT_MONTHS[Number(m.slice(5, 7)) - 1], rotated: true })),
		},
		x,
	};
}

/**
 * The classes a line through these values passes through, worse first, each
 * with its band's edges: every class from the highest value's to the
 * lowest's. The outer bands are left open, so nothing of the line falls
 * outside them. The 1y's: Intermediate down to 214.5, Trained below it.
 */
export function economyZones(values: readonly number[]): EconomyZone[] {
	if (!values.length) return [];
	const worst = economyZone(Math.max(...values));
	const best = economyZone(Math.min(...values));
	const zones: EconomyZone[] = [];
	for (let k = worst; k <= best; k++) {
		zones.push({
			classIndex: k,
			tone: ECONOMY_TONES[k],
			above: k === worst ? null : ECONOMY_ZONE_EDGES[k - 1],
			below: k === best ? null : ECONOMY_ZONE_EDGES[k],
		});
	}
	return zones;
}

/** The points' classes, worse first, each once. */
export function economyLegend(points: readonly Pick<EconomyPoint, "classIndex">[]): EconomyLegendItem[] {
	return [...new Set(points.map((p) => p.classIndex))].sort((a, b) => a - b).map((i) => ({ name: economyClassNameAt(i), tone: ECONOMY_TONES[i] }));
}

/** Avg (the points' mean, rounded half up) and Best (the lowest point). */
export function economyFigures(values: readonly number[]): EconomyFigure[] {
	if (!values.length) return [];
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	return [
		{ value: String(Math.round(mean)), label: "Avg Running Economy" },
		{ value: String(Math.min(...values)), label: "Best Running Economy" },
	];
}

/** A range's line for a period; null for a period without a reading. */
export function economyChart(range: PeriodRange, rows: readonly RunningEconomyRow[], span: Span): EconomyChart | null {
	const days = daysOf(span);
	const last = Math.max(1, days.length - 1);
	const point = (date: string, day: string, x: number, value: number): EconomyPoint => {
		const classIndex = economyClassIndex(value);
		return { date, day, x, value, classIndex, tone: ECONOMY_TONES[classIndex] };
	};
	let points: EconomyPoint[];
	let axis: PeriodAxis;
	let axisSpan: Span = span;
	if (range === "4w") {
		points = [...rows]
			.filter((r) => r.score !== undefined && r.date >= span.from && r.date <= span.to)
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
			.map((r) => point(r.date, r.date, daysBetween(span.from, r.date) / last, r.score!));
		axis = relabel(dayAxis(days));
	} else if (range === "1y") {
		const year = economyYearAxis(span);
		points = economyBlocks(rows, span).map((b) => point(b.date, b.day, year.x(b.day), b.value));
		axis = year.axis;
		axisSpan = year.axisSpan;
	} else {
		points = economyBlocks(rows, span).map((b) => point(b.date, b.day, daysBetween(span.from, b.day) / last, b.value));
		axis = relabel(stepAxis(days, { every: BLOCK_DAYS, count: Math.ceil(days.length / BLOCK_DAYS), labelled: "ends" }));
	}
	if (!points.length) return null;
	return {
		points,
		zones: economyZones(points.map((p) => p.value)),
		ticks: economyTicks(points.map((p) => p.value)),
		axisSpan,
		axis,
		dots: range !== "1y",
		legend: economyLegend(points),
	};
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

export interface RunningEconomyView {
	/** The period row's label ("Sep 14 - Oct 11"); null on Current, which has none. */
	label: string | null;
	/** "<": older data exists, or may while the index is still coming. Never on Current. */
	canGoBack: boolean;
	/** Current; null on a range. */
	current: EconomyCurrent | null;
	/** "Daily Values", "Weekly Averages"; none on Current or a period without a reading. */
	title?: string;
	/** A range's line; null on Current, or for a period without a reading. */
	chart: EconomyChart | null;
	/** Avg and Best Running Economy; none on Current or a period without a reading. */
	figures: EconomyFigure[];
	/** The line in the chart's place when the period has no reading; title, legend and figures are left out. */
	empty?: string;
}

/** The page, on its route's range. */
export function runningEconomyView(route: RunningEconomyRoute, rows: readonly RunningEconomyRow[], ctx: RunningEconomyContext): RunningEconomyView {
	const span = statSpan(ECONOMY_STAT, route, ctx.today);
	if (!span) {
		const current = economyCurrent(currentReading(rows, ctx.account, ctx.today), ctx.today);
		return { label: null, canGoBack: false, current, chart: null, figures: [] };
	}
	const oldest = rows.reduce<string | undefined>((min, r) => (min === undefined || r.date < min ? r.date : min), undefined);
	const chart = economyChart(route.range, rows, span);
	const view: RunningEconomyView = {
		label: statPeriodLabel(ECONOMY_STAT, route, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		current: null,
		chart,
		figures: chart ? economyFigures(chart.points.map((p) => p.value)) : [],
	};
	const title = ECONOMY_TITLES[route.range];
	if (chart && title) view.title = title;
	if (!chart) view.empty = NO_DATA;
	return view;
}
