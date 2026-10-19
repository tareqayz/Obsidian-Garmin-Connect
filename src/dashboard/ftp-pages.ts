import type { AccountInfo, FtpLatest, FtpSport } from "../sync/account";
import { WKG_COLUMN, type FtpRow } from "../sync/ftp-index";
import { readingDate } from "./day";
import { MEASUREMENT_SHEET, type FtpHelpSheet } from "./ftp-copy";
import { FTP_CLASSES, ftpGauge, type Gauge, type Sex, type Tone } from "./gauges";
import { SHORT_MONTHS, addMonths, canStepBack, dayAxis, dayLabel, daysBetween, daysOf, type PeriodAxis, type PeriodRange, type Span } from "./periods";
import { PERFORMANCE_REGISTRY } from "./performance-stats";
import { shiftDate } from "./series";
import { r2 } from "./stat-charts";
import { DIAL_END, dialAngle, segmentsFromAngles } from "./stat-dial";
import { statPeriodLabel, statSpan } from "./stat-registry";
import { massText, unitOf, type WeightUnits } from "./weight-pages";

/**
 * Garmin Connect's FTP page (Performance Stats), worked out from the FTP
 * index (`src/sync/ftp-index.ts`) and the account's latest FTP
 * (`account.json`'s `ftp`, `sex`). Rules measured on the phone on 2026-10-11
 * and proved against the API (ref/performance-stats/ftp/README.md):
 *
 * - Two tabs, Cycling and Cross Country Skiing; every view reads only its
 *   tab's sport. The ranges have a Watts | W/kg control (the route's `sub`),
 *   which changes the series and the title only.
 * - Current is `powerToWeight/latest`, as the account sync keeps it: the date
 *   line is the newer of the FTP and the weigh-in (`dayLabel`), the number
 *   the W/kg to 2 dp, rounded (4.0294 → "4.03"), its class graded with `>=`
 *   against Garmin's table (`ftpGauge`), and "Based On" the FTP with its own
 *   date and the weight to 1 dp with its own ("Oct 13, 2025", "Oct 8").
 *   Cross Country Skiing shows watts, not a dial.
 * - An FTP more than a year old is Garmin's "No … FTP data in the past year":
 *   no dial, "--" over the tab's unit word, a link, no Based On. The
 *   account's `isStale`, or 365 days since the FTP's day, judged against
 *   today, so the cycling FTP of 2025-10-13 goes stale on 2026-10-13 between
 *   two account syncs too.
 * - The page's dial is linear from 0 to 6 W/kg over 300°, its bands edged at
 *   the classes' printed upper ends, 2.22 / 2.78 / 3.92 / 5.04 (−39°, −11°,
 *   46°, 102°), the marker at −150 + 50·v in its band's colour. Home's
 *   `ftpGauge` (270°) is not the page's dial.
 * - The ranges plot change points, not a step line. 4w plots every row of
 *   the period at its day; 12w and 1y cut the period into 7-day blocks from
 *   its first day and plot each block's last row at the block's first day.
 *   Dots are joined straight; nothing comes in from before the period, and a
 *   period without a row is the web's "You have no data for this time
 *   period.". W/kg rows keep their own day's weight (1y's 4.0774, then
 *   4.0294).
 * - The y axis pads a unit past the rounded data — Watts
 *   [50⌊min/50⌋ − 50, 50⌈max/50⌉ + 50], W/kg [⌊min⌋ − 1, ⌈max⌉ + 1] — its
 *   five gridlines at the quarters, and its labels apart from them: hi, then
 *   a step of ⌈range/4⌉ down while above lo, then lo, each at its own value
 *   ("350 312 274 236 200", "6 5 4 3"). The x axis: 4w a dot a day with
 *   "MM-DD" ends; 12w the blocks' first days, "M-dd"; 1y the first day each
 *   month on, its month's name.
 *
 * Inferred (unseen on the phone, drawn on the twin): Cycling once stale,
 * Cross Country Skiing with a fresh FTP (its watts, no Based On), no weigh-in
 * ever (the watts, as Cross Country Skiing shows them), the women's dial, the
 * link's sheet, imperial weight, the Cross Country Skiing ranges, previous
 * periods, the empty period, a floor below 0 (clamped), and each range
 * opening on Watts (`movedRoute`).
 *
 * The charts' geometry is `ftp-charts.ts`, off the Obsidian twin (Figma
 * 430:6120).
 *
 * Pure.
 */

export type FtpTab = "cycling" | "xc";

/** The tabs in the phone's order: the first is where the page opens. */
export const FTP_TABS: ReadonlyArray<{ id: FtpTab; label: string }> = [
	{ id: "cycling", label: "Cycling" },
	{ id: "xc", label: "Cross Country Skiing" },
];

/** The tab a route names: Cross Country Skiing, or the first. */
export function ftpTab(tab: string | undefined): FtpTab {
	return tab === "xc" ? "xc" : "cycling";
}

const SPORT_NAMES: Readonly<Record<FtpTab, string>> = { cycling: "Cycling", xc: "Cross Country Skiing" };
/** Where `account.json` keeps each tab's FTP. */
const ACCOUNT_SPORT: Readonly<Record<FtpTab, FtpSport>> = { cycling: "cycling", xc: "xcSkiing" };

/** The ranges' segmented control. */
export type FtpUnit = "watts" | "wkg";

/** The route's `sub` on W/kg; Watts has none. */
export const WKG_SUB = "wkg";

/** The control's segments, and the chart's title for each. */
export const FTP_UNITS: ReadonlyArray<{ id: FtpUnit; label: string; title: string }> = [
	{ id: "watts", label: "Watts", title: "Watts" },
	{ id: "wkg", label: "W/kg", title: "Watts Per Kilogram" },
];

/** The unit a route's `sub` names: W/kg, else Watts. */
export function ftpUnit(sub: string | undefined): FtpUnit {
	return sub === WKG_SUB ? "wkg" : "watts";
}

/** The route on a unit: the control's tap. The tab and the period stay. */
export function withFtpUnit<R extends { sub?: string }>(route: R, unit: FtpUnit): R {
	const { sub: _sub, ...rest } = route;
	return (unit === "wkg" ? { ...rest, sub: WKG_SUB } : rest) as R;
}

/**
 * Where the shell's range control and steppers move the page: a period step
 * keeps the unit, a range switch opens on Watts (Inferred: the 12w and 1y
 * shots that follow a W/kg one show Watts). The shell keeps `sub` itself, so
 * the page drops it as it moves (Running Tolerance's way); a tab keeps it.
 */
export function movedRoute<R extends { range: string; sub?: string }>(from: { range: string }, next: R): R {
	return next.range !== from.range ? withFtpUnit(next, "watts") : next;
}

/** The web's line in place of a chart for a period without a row. */
export const NO_DATA = "You have no data for this time period.";
/** The number on Current without a fresh FTP. */
export const DASH = "--";

/** Current without a fresh FTP: "No Cross Country Skiing FTP data in the past year". */
export function noFtpLine(tab: FtpTab): string {
	return `No ${SPORT_NAMES[tab]} FTP data in the past year`;
}

/** The link under it: "Learn how to update your Cross Country Skiing FTP". */
export function updateLinkText(tab: FtpTab): string {
	return `Learn how to update your ${SPORT_NAMES[tab]} FTP`;
}

/** The link's longest line, in characters: the phone breaks after "…your Cross Country" (38) and keeps "…your Cycling FTP" (36) whole. */
export const LINK_LINE = 38;

/**
 * The link as the phone sets it, left-aligned lines in a block centred on
 * the page: words greedily, `max` characters a line at most. Explicit lines
 * keep the block as wide as its longest line, which CSS can't do for a
 * wrapped one.
 */
export function linkLines(text: string, max = LINK_LINE): string[] {
	const lines: string[] = [];
	for (const word of text.split(" ").filter(Boolean)) {
		const last = lines[lines.length - 1];
		if (last !== undefined && last.length + 1 + word.length <= max) lines[lines.length - 1] = `${last} ${word}`;
		else lines.push(word);
	}
	return lines;
}

/* ------------------------------------------------------------------ */
/*  Current                                                            */
/* ------------------------------------------------------------------ */

/** Days after which an FTP is "no data in the past year". */
export const STALE_DAYS = 365;

/**
 * Whether Garmin calls a sport's FTP out of date: its `isStale` when the
 * account last synced, or 365 days since the FTP's day — the day the account
 * was last worked out from, for a file written before `ftpDate` was kept.
 * 2025-10-13's FTP is fresh on 2026-10-12 and stale on 2026-10-13.
 */
export function ftpStale(entry: Pick<FtpLatest, "date" | "ftpDate" | "stale"> | undefined, today: string): boolean {
	if (entry?.stale === true) return true;
	const since = entry?.ftpDate ?? entry?.date;
	return since !== undefined && daysBetween(since, today) >= STALE_DAYS;
}

/**
 * The page dial's scale: its top and the classes' printed upper ends
 * (Untrained, Fair, Good, Excellent), where the bands meet. The men's top is
 * the web gauge's "Data ranges from 0 to 6"; the women's dial is Inferred,
 * on Garmin's women's table and `ftpGauge`'s top for it (4.3 × 6 / 5.05).
 */
export const FTP_DIAL: Readonly<Record<Sex, { top: number; edges: readonly number[] }>> = {
	male: { top: 6, edges: [2.22, 2.78, 3.92, 5.04] },
	female: { top: (4.3 * 6) / 5.05, edges: [1.89, 2.35, 3.32, 4.29] },
};
export const FTP_DIAL_TONES: readonly Tone[] = ["red", "orange", "green", "blue", "purple"];

/** A W/kg on the page's dial, degrees clockwise from 12 o'clock: −150 + 50·v for men, 4.03 → 51.5. */
export function ftpAngle(wattsPerKg: number, sex: Sex = "male"): number {
	return dialAngle(wattsPerKg / FTP_DIAL[sex].top);
}

/** The bands' boundaries, from −150° to 150°: [-150, -39, -11, 46, 102, 150] for men. */
export function ftpDialAngles(sex: Sex = "male"): number[] {
	return [-DIAL_END, ...FTP_DIAL[sex].edges.map((edge) => r2(ftpAngle(edge, sex))), DIAL_END];
}

/** Current's dial. */
export interface FtpDial {
	/** "4.03", "Excellent" (none without the account's sex), the bands, and the marker's place and tone. */
	gauge: Gauge;
	/** The marker, degrees clockwise from 12 o'clock. */
	angle: number;
}

/**
 * A W/kg on the page's dial: the value to 2 dp, rounded, its class graded
 * as At a Glance grades it (`ftpGauge`: `>=` against the table's lower ends,
 * 2.23 / 2.79 / 3.93 / 5.05 for men), and the marker in the class's band.
 * Without the sex the bands are the men's and the class is left off.
 */
export function ftpDial(wattsPerKg: number, sex: Sex | undefined): FtpDial {
	const scale = sex ?? "male";
	const shown = Math.round(wattsPerKg * 100) / 100;
	const graded = ftpGauge(shown, scale).label!;
	const at = Math.min(1, Math.max(0, shown / FTP_DIAL[scale].top));
	const gauge: Gauge = {
		value: shown.toFixed(2),
		segments: segmentsFromAngles(ftpDialAngles(scale), FTP_DIAL_TONES),
		at,
		tone: FTP_DIAL_TONES[FTP_CLASSES.indexOf(graded)],
	};
	if (sex) gauge.label = graded;
	return { gauge, angle: r2(dialAngle(at)) };
}

/** A "Based On" row: "Cycling FTP" · "274 W" · "Oct 13, 2025". */
export interface FtpBasis {
	label: string;
	value: string;
	/** "Oct 8" this year, "Oct 13, 2025" before it; none from a file written before the day was kept. */
	date?: string;
}

/** Current, for the tab's sport. */
export interface FtpCurrent {
	/** "Cycling (W/kg)", "Cross Country Skiing Power". */
	title: string;
	/** "Thursday, October 8"; without a fresh FTP, "No Cycling FTP data in the past year". */
	line: string;
	/** The day the line names: the newer of the FTP's and the weigh-in's. None without a fresh FTP. */
	date?: string;
	/** Garmin's out-of-date state: no fresh FTP for the sport, or none at all. */
	stale: boolean;
	/** A fresh cycling FTP with its W/kg. */
	dial: FtpDial | null;
	/** In the dial's place otherwise: the number ("--", "111") over its unit word ("W/kg", "Watts"). */
	figure: { value: string; unit: string } | null;
	/** With the dial only: the FTP with its own date, then the weight behind the W/kg with its own. */
	basedOn: FtpBasis[];
	/** "Learn how to update your Cross Country Skiing FTP", its lines, and the sheet it opens. Only without a fresh FTP. */
	link?: { text: string; lines: string[]; sheet: FtpHelpSheet };
}

/** What the view needs besides the route and the index's rows. */
export interface FtpContext {
	/** The real today, `YYYY-MM-DD`. */
	today: string;
	/** The index's meta says it holds the whole history. */
	complete: boolean;
	/** `account.json`: each sport's latest FTP, and the sex the class is graded for. */
	account?: Pick<AccountInfo, "ftp" | "sex"> | null;
	/** The weight's unit: kg, or lb (Inferred). */
	units?: WeightUnits;
}

/**
 * Current for a tab: the cycling W/kg on the dial with its Based On, the
 * skiing watts on their own (the twin's fresh skiing FTP has no Based On),
 * or the out-of-date state either way.
 */
export function ftpCurrent(tab: FtpTab, ctx: FtpContext): FtpCurrent {
	const entry = ctx.account?.ftp?.[ACCOUNT_SPORT[tab]];
	const wkg = tab === "cycling" ? entry?.wattsPerKg : undefined;
	if (!entry || entry.watts === undefined || ftpStale(entry, ctx.today)) {
		const text = updateLinkText(tab);
		return {
			title: tab === "cycling" ? "Cycling (W/kg)" : "Cross Country Skiing Power",
			line: noFtpLine(tab),
			stale: true,
			dial: null,
			figure: { value: DASH, unit: tab === "cycling" ? "W/kg" : "Watts" },
			basedOn: [],
			link: { text, lines: linkLines(text), sheet: MEASUREMENT_SHEET },
		};
	}
	const day = entry.date ?? entry.ftpDate;
	const current: FtpCurrent = {
		// A cycling FTP without a weigh-in to divide it by shows its watts, as skiing does (Inferred).
		title: wkg !== undefined ? "Cycling (W/kg)" : `${SPORT_NAMES[tab]} Power`,
		line: day ? dayLabel(day, ctx.today) : "",
		stale: false,
		dial: null,
		figure: null,
		basedOn: [],
	};
	if (day) current.date = day;
	if (wkg === undefined) {
		current.figure = { value: String(entry.watts), unit: "Watts" };
		return current;
	}
	current.dial = ftpDial(wkg, ctx.account?.sex);
	const ftp: FtpBasis = { label: `${SPORT_NAMES[tab]} FTP`, value: `${entry.watts} W` };
	if (entry.ftpDate) ftp.date = readingDate(entry.ftpDate, ctx.today);
	current.basedOn.push(ftp);
	if (entry.weight !== undefined) {
		const units = ctx.units ?? "metric";
		const weight: FtpBasis = { label: "Weight", value: `${massText(entry.weight * 1000, units)} ${unitOf(units)}` };
		if (entry.weightDate) weight.date = readingDate(entry.weightDate, ctx.today);
		current.basedOn.push(weight);
	}
	return current;
}

/* ------------------------------------------------------------------ */
/*  4w, 12w, 1y                                                        */
/* ------------------------------------------------------------------ */

/** 12w's and 1y's blocks, from the period's first day. */
export const BLOCK_DAYS = 7;

/** A tab's column for a unit: `cycling`, `cyclingWkg`, `xc`, `xcWkg`. */
export function ftpColumn(tab: FtpTab, unit: FtpUnit): "cycling" | "cyclingWkg" | "xc" | "xcWkg" {
	return unit === "wkg" ? WKG_COLUMN[tab] : tab;
}

/** A dot of a range's line. */
export interface FtpPoint {
	/** The row's day. */
	date: string;
	/** The day it is drawn on: its own on 4w, its block's first on 12w and 1y. */
	day: string;
	/** Across the plot: 0 on the period's first day, 1 on its last. */
	x: number;
	/** W as Garmin sent it, or W/kg to 4 dp, unrounded further. */
	value: number;
}

/** The y axis: gridlines and labels apart, each at its own value. */
export interface FtpYAxis {
	lo: number;
	hi: number;
	/** The five gridlines, top first: the quarters of [lo, hi]. */
	grid: number[];
	/** Top first: hi, a step of ⌈(hi − lo) / 4⌉ down while above lo, then lo. */
	labels: Array<{ value: number; text: string }>;
}

/** A range's line. */
export interface FtpChart {
	points: FtpPoint[];
	y: FtpYAxis;
	axis: PeriodAxis;
}

/**
 * A period's dots for a column: 4w every row at its day; 12w and 1y each
 * 7-day block's last row from the period's first day, at the block's first
 * day — Garmin's weekly route for the same window.
 */
export function ftpPoints(range: PeriodRange, rows: readonly FtpRow[], column: keyof Omit<FtpRow, "date">, span: Span): FtpPoint[] {
	const last = Math.max(1, daysBetween(span.from, span.to));
	const inSpan = [...rows]
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
		.filter((r) => r.date >= span.from && r.date <= span.to && r[column] !== undefined);
	if (range === "4w") return inSpan.map((r) => ({ date: r.date, day: r.date, x: daysBetween(span.from, r.date) / last, value: r[column]! }));
	const blocks = new Map<number, FtpRow>();
	for (const row of inSpan) blocks.set(Math.floor(daysBetween(span.from, row.date) / BLOCK_DAYS), row);
	return [...blocks.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([block, row]) => ({ date: row.date, day: shiftDate(span.from, BLOCK_DAYS * block), x: (BLOCK_DAYS * block) / last, value: row[column]! }));
}

/**
 * The y axis for a period's values: a unit (50 W, 1 W/kg) past the rounded
 * data each way, never below 0. 274 W → [200, 350], labels 350 312 274 236
 * 200; 4.03–4.08 W/kg → [3, 6], labels 6 5 4 3; 1.63–1.65 → [0, 3].
 */
export function ftpYAxis(values: readonly number[], unit: FtpUnit): FtpYAxis {
	const u = unit === "wkg" ? 1 : 50;
	const lo = Math.max(0, u * Math.floor(Math.min(...values) / u) - u);
	const hi = u * Math.ceil(Math.max(...values) / u) + u;
	const step = Math.ceil((hi - lo) / 4);
	const above = [0, 1, 2, 3].map((i) => hi - i * step).filter((v) => v > lo);
	return {
		lo,
		hi,
		grid: [4, 3, 2, 1, 0].map((k) => lo + (k * (hi - lo)) / 4),
		labels: [...above, lo].map((value) => ({ value, text: String(value) })),
	};
}

/** A 12w block's label: "7-20", "8-03", "10-05". */
export function blockLabel(day: string): string {
	return `${Number(day.slice(5, 7))}-${day.slice(8, 10)}`;
}

/**
 * The x axis, from the period's first day to its last: 4w a dot a day, the
 * ends large and labelled "MM-DD"; 12w a large dot on each block's first day,
 * "7-20" … "10-05"; 1y one on the period's first day each month on, Oct …
 * Sep. Rotated labels on 12w and 1y.
 */
export function ftpXAxis(range: PeriodRange, span: Span): PeriodAxis {
	const days = daysOf(span);
	if (range === "4w") return dayAxis(days);
	const last = Math.max(1, days.length - 1);
	const marks =
		range === "1y"
			? Array.from({ length: 12 }, (_, k) => addMonths(span.from, k)).map((day) => ({ day, text: SHORT_MONTHS[Number(day.slice(5, 7)) - 1] }))
			: Array.from({ length: Math.ceil(days.length / BLOCK_DAYS) }, (_, k) => shiftDate(span.from, BLOCK_DAYS * k)).map((day) => ({ day, text: blockLabel(day) }));
	const x = (day: string) => daysBetween(span.from, day) / last;
	return {
		dots: marks.map((m) => ({ x: x(m.day), large: true })),
		labels: marks.map((m) => ({ x: x(m.day), text: m.text, rotated: true })),
	};
}

/** A range's line for a tab and unit; null for a period without a row. */
export function ftpChart(range: PeriodRange, rows: readonly FtpRow[], tab: FtpTab, unit: FtpUnit, span: Span): FtpChart | null {
	const points = ftpPoints(range, rows, ftpColumn(tab, unit), span);
	if (!points.length) return null;
	return { points, y: ftpYAxis(points.map((p) => p.value), unit), axis: ftpXAxis(range, span) };
}

/* ------------------------------------------------------------------ */
/*  The page                                                           */
/* ------------------------------------------------------------------ */

/** What the page's route says: the range, how many periods back, the tab, and the unit (`sub`). */
export interface FtpRoute {
	range: PeriodRange;
	offset: number;
	tab?: string;
	sub?: string;
}

export interface FtpView {
	tab: FtpTab;
	/** The period row's label ("Sep 14 - Oct 11"); null on Current, which has none. */
	label: string | null;
	/** "<": older data exists, or may while the index is still coming. Never on Current. */
	canGoBack: boolean;
	/** Current; null on a range. */
	current: FtpCurrent | null;
	/** A range's unit, the Watts | W/kg control's segments and the chart's title ("Watts", "Watts Per Kilogram"); none on Current. */
	unit?: FtpUnit;
	segments?: Array<{ id: FtpUnit; label: string; on: boolean }>;
	title?: string;
	/** A range's line; null on Current, or for a period without a row. */
	chart: FtpChart | null;
	/** The line in the chart's place when the period has no row. */
	empty?: string;
}

const FTP_STAT = PERFORMANCE_REGISTRY.page("ftp")!;

/** The page, on its route's range, tab and unit. */
export function ftpView(route: FtpRoute, rows: readonly FtpRow[], ctx: FtpContext): FtpView {
	const tab = ftpTab(route.tab);
	const span = statSpan(FTP_STAT, route, ctx.today);
	if (!span) return { tab, label: null, canGoBack: false, current: ftpCurrent(tab, ctx), chart: null };
	const unit = ftpUnit(route.sub);
	const oldest = rows.reduce<string | undefined>((min, r) => (min === undefined || r.date < min ? r.date : min), undefined);
	const view: FtpView = {
		tab,
		label: statPeriodLabel(FTP_STAT, route, ctx.today),
		canGoBack: canStepBack(oldest, ctx.complete, span.from),
		current: null,
		unit,
		segments: FTP_UNITS.map((u) => ({ id: u.id, label: u.label, on: u.id === unit })),
		title: FTP_UNITS.find((u) => u.id === unit)!.title,
		chart: ftpChart(route.range, rows, tab, unit, span),
	};
	if (!view.chart) view.empty = NO_DATA;
	return view;
}
