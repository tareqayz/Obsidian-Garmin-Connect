import type { ActivityDetail, ActivityLap, ZoneTime } from "../sync/activity-detail";
import type { ActivityRow } from "../sync/activity-index";
import { pace } from "../sync/metrics";
import { formatDistance, type Units } from "./activities";
import type { ActivityAxis, ActivityRoute } from "./routes";
import { duration } from "./series";
import { CYCLING_COLOURS, CYCLING_FILLS } from "./sports/cycling-palette";
import { SWIM_COLOURS, SWIM_FILLS } from "./sports/swim-palette";

/**
 * The activity page's Charts tab as data, and its full-screen (landscape)
 * chart: which cards the activity has, in the phone's order, each card's
 * title for its picker's choice, its figures, its samples on the Time or
 * Distance axis, its y axis with the phone's bounds and labels, and its marks'
 * colours by name. `activity-charts.ts` places all of it.
 *
 * The rules are the spec's (ref/activity-details/outdoor-run/README.md, "Rules"),
 * each proved on the captured run; the ones the shots could not settle are
 * marked Inferred where they are applied. Values arrive as Garmin sent them and
 * are rounded once, here.
 *
 * What the run draws is the default. Another sport passes its `ChartsSpec`
 * (its profile's `charts`): its cards in its order, its pickers and chips, and
 * a `MetricDef` for every chart of samples the run doesn't have. Each lookup
 * below asks the run's own table or switch first and the spec's metrics after,
 * so the run's sixteen charts are drawn by exactly the code that drew them
 * before sports had specs.
 *
 * Pure: no Obsidian, no DOM.
 */

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

/**
 * A colour a mark, a band, a key or a label takes, by name: the run's (the
 * core ones) and the sports' palettes (`sports/*-palette.ts`). The page maps
 * the names to its theme; `CHART_COLOURS` keeps Garmin's own, sampled off the
 * phone. The sports' names come off their merged palettes, so a sport with
 * none of its own (an empty palette) adds no `never` to the union.
 */
const SPORT_COLOURS = { ...CYCLING_COLOURS, ...SWIM_COLOURS };
export type ChartColour = CoreColour | keyof typeof SPORT_COLOURS;

export type CoreColour =
	| "blue"
	| "green"
	| "orange"
	| "red"
	| "purple"
	| "yellow"
	| "grey"
	| "lavender"
	| "white"
	/** The theme's text colour, where Garmin's white would vanish on a light theme (a Zone 1 bar). */
	| "text"
	/** The Heart Rate Zones line's low end (an Inferred stop). */
	| "sky"
	/** The heart-rate overlay's line and labels. */
	| "crimson"
	/** The cadence overlay's labels. */
	| "deep-orange"
	| "zone-1"
	| "zone-2"
	| "zone-3"
	| "zone-4"
	| "zone-5"
	/** A seven-zone scale's top two (a ride's power zones). */
	| "zone-6"
	| "zone-7";

const CORE_COLOURS: Readonly<Record<CoreColour, string>> = {
	blue: "#54a9fe",
	green: "#60d275",
	orange: "#fd9d39",
	red: "#e02c2c",
	purple: "#d42fc2",
	yellow: "#f5bf2a",
	grey: "#6c6c6c",
	lavender: "#aa8dfc",
	white: "#ffffff",
	// A CSS value, not a hex: paint it as HTML (a zone bar, a key), where var() always resolves.
	text: "var(--text-normal)",
	sky: "#3994ef",
	crimson: "#ff0035",
	"deep-orange": "#ea670e",
	// The twin's zone fills (406:1707–1709, 407:700; the shots sample #1975d0 and #e8660e). Zone 1
	// and Zone 5 had no time on the captured run: grey (the scale's) and red are Inferred.
	"zone-1": "#6c6c6c",
	"zone-2": "#1976d2",
	"zone-3": "#0b963f",
	"zone-4": "#ea670e",
	"zone-5": "#e02c2c",
	// Inferred: no shot has time in a zone above 5 yet (the ride's power zones 6 and 7 read 0%);
	// Garmin's purple and a deep purple, until the ride's spec samples them.
	"zone-6": "#d42fc2",
	"zone-7": "#815af7",
};

export const CHART_COLOURS: Readonly<Record<ChartColour, string>> = { ...CORE_COLOURS, ...SPORT_COLOURS };

/** An area's, a block's or a step's fill: a vertical gradient over the plot. The sports' palettes add theirs. */
const SPORT_FILLS = { ...CYCLING_FILLS, ...SWIM_FILLS };
export type ChartFill = CoreFill | keyof typeof SPORT_FILLS;

export type CoreFill = "pace" | "heart-rate" | "elevation" | "power" | "stamina" | "impact" | "performance";

/**
 * Garmin's fills, top of the plot to its bottom (fit residual under one level).
 * Grade-Adjusted Pace and the Lap Average Pace blocks share Pace's. Performance
 * Condition's grey was sampled between 0 and +1 only; its ends are extrapolated
 * (Inferred). With an overlay on, the landscape's primary shows at half opacity,
 * which is what the phone's dimmed fills are (#874646 is #ff8d8d at 50%).
 */
const CORE_FILLS: Readonly<Record<CoreFill, readonly [top: string, bottom: string]>> = {
	pace: ["#58adff", "#1976d2"],
	"heart-rate": ["#ff8d8d", "#e02c2c"],
	elevation: ["#83ea8b", "#0d9840"],
	power: ["#feaae1", "#d430c2"],
	stamina: ["#fd9d39", "#ea680f"],
	impact: ["#aa8dfc", "#aa8dfc"],
	performance: ["#7b7b7b", "#272727"],
};

export const CHART_FILLS: Readonly<Record<ChartFill, readonly [top: string, bottom: string]>> = { ...CORE_FILLS, ...SPORT_FILLS };

/** The landscape primary's opacity while an overlay is on. */
export const DIM_OPACITY = 0.5;

/* ------------------------------------------------------------------ */
/*  Charts and cards                                                   */
/* ------------------------------------------------------------------ */

/**
 * A chart of samples a card or the landscape view draws: one of the run's
 * sixteen (`RunMetric`), or one a sport's spec defines (`ChartsSpec.metrics`).
 * The ids are the ones the Stats and Overview badges open (`chart:<id>`)
 * where they overlap.
 */
export type ChartMetric = string;

/** The run's charts of samples. */
export type RunMetric =
	| "pace"
	| "gap"
	| "lap-pace"
	| "heart-rate"
	| "heart-rate-zones"
	| "elevation"
	| "power"
	| "power-per-kg"
	| "stamina"
	| "performance-condition"
	| "cadence"
	| "stride-length"
	| "vertical-ratio"
	| "vertical-oscillation"
	| "ground-contact-time"
	| "impact-load";

/** The run's charts of samples, in the landscape chips' pool: the run's chips. */
export const CHART_METRICS: readonly RunMetric[] = [
	"pace",
	"gap",
	"lap-pace",
	"heart-rate",
	"heart-rate-zones",
	"elevation",
	"power",
	"power-per-kg",
	"stamina",
	"performance-condition",
	"cadence",
	"stride-length",
	"vertical-ratio",
	"vertical-oscillation",
	"ground-contact-time",
	"impact-load",
];

/** What the landscape view opens as its primary: a chart of samples, Run/Walk or Training Effect. */
export type ExpandedChartId = string;

/** The bases a landscape chart may have besides a chart of samples: they have no value axis to overlay. */
const OTHER_BASES: readonly string[] = ["run-walk", "training-effect"];

/** Each of the run's charts' title, as the card, the picker, the landscape title and its chips read it. */
export const CHART_TITLES: Readonly<Record<RunMetric | "run-walk" | "training-effect", string>> = {
	pace: "Pace",
	gap: "Grade-Adjusted Pace",
	"lap-pace": "Lap Average Pace",
	"heart-rate": "Heart Rate",
	"heart-rate-zones": "Heart Rate Zones",
	elevation: "Elevation",
	power: "Power (W)",
	"power-per-kg": "Power (W/kg)",
	stamina: "Stamina",
	"performance-condition": "Performance Condition",
	cadence: "Cadence",
	"stride-length": "Stride Length",
	"vertical-ratio": "Vertical Ratio",
	"vertical-oscillation": "Vertical Oscillation",
	"ground-contact-time": "Ground Contact Time",
	"impact-load": "Impact Load Factor",
	"run-walk": "Run/Walk",
	"training-effect": "Training Effect",
};

/**
 * A chart's title: the run's, a sport's metric's, or undefined for an id
 * neither knows (a Stats badge then names its row instead).
 */
export function chartTitle(id: string, spec?: ChartsSpec): string | undefined {
	return own(spec?.runOverrides, id)?.title ?? own<string>(CHART_TITLES, id) ?? specMetric(spec, id)?.title;
}

/** The run's Charts tab's cards, top to bottom, as the phone lists them. */
export const CARD_IDS = [
	"pace",
	"heart-rate",
	"training-effect",
	"elevation",
	"power",
	"stamina",
	"performance-condition",
	"cadence",
	"stride-length",
	"vertical-ratio",
	"vertical-oscillation",
	"ground-contact-time",
	"impact-load",
	"run-walk",
	"time-in-hr-zones",
	"time-in-power-zones",
] as const;
export type RunCardId = (typeof CARD_IDS)[number];
/** A card: one of the run's, or a sport's own (a custom plot, a chart of its samples). */
export type CardId = string;

/**
 * The cards with a "?" at the right of their title on the phone. The spec
 * proposes leaving the icons out until their sheets' copy is captured; the
 * page decides. A sport's spec may list its own (`ChartsSpec.help`).
 */
const HELP: ReadonlySet<CardId> = new Set<RunCardId>([
	"pace",
	"training-effect",
	"stamina",
	"performance-condition",
	"cadence",
	"vertical-ratio",
	"vertical-oscillation",
	"ground-contact-time",
	"impact-load",
	"run-walk",
	"time-in-hr-zones",
	"time-in-power-zones",
]);

/** A figure under a card's title: "5:36" "/km" over "Average". */
export interface ChartFigure {
	value: string;
	unit?: string;
	label: string;
	/** A dot before the label, Training Effect's. */
	dot?: ChartColour;
}

/** A picker on a card's title ("Pace ⌄"): the route's `picks` key it sets and its choices. */
export interface ChartPicker {
	key: string;
	options: Array<{ value: string; label: string }>;
	chosen: string;
}

/**
 * A card's picker as a sport defines it: the key its choice is kept under in
 * the route's `picks`, the phone sheet's title, and its choices in the
 * sheet's order, each the chart of samples it draws. Choices the activity
 * has no data for are left out; one left is no picker.
 */
export interface PickerDef {
	key: string;
	/** "Pace", "Heart Rate", "Power": the phone's sheet title (Obsidian's menu on a desktop has none). */
	title: string;
	options: ReadonlyArray<{ value: string; metric: ChartMetric }>;
}

export interface ChartKey {
	label: string;
	colour: ChartColour;
	/** A dot, or a short line (Stamina's Potential). */
	kind: "dot" | "dash";
}

interface CardBase {
	id: CardId;
	title: string;
	picker?: ChartPicker;
	help: boolean;
	figures: ChartFigure[];
}

/** Samples on a chart: x as a share of the axis (0 … 1), y in the chart's unit or null for no value. */
export interface ChartPoints {
	x: number[];
	y: Array<number | null>;
}

export interface YAxis {
	/** The values at the plot's bottom and top. A pace axis runs the other way: its bottom is the slow end. */
	bottom: number;
	top: number;
	/** Top of the plot first. */
	labels: Array<{ value: number; text: string }>;
}

export interface XAxis {
	/** `at` is a share of the plot's width. */
	ticks: Array<{ at: number; text: string }>;
	title: string;
}

/** How a chart of samples draws: `lanes` is a chart of bars in lanes, not of values (a ride's Position). */
export type SeriesMark = "area" | "line" | "dots" | "steps" | "blocks" | "lanes";

/** Lanes across a chart, with bars rising from its bottom: a ride's Position, Standing over Seated. */
export interface LaneSet {
	/** Top to bottom. */
	lanes: Array<{ id: string; label: string; colour: ChartColour }>;
	/** Each bar's span on x (0 … 1) and its lane's id. */
	bars: Array<{ from: number; to: number; lane: string }>;
}

/** A chart of samples: Pace and the other plots. */
export interface SeriesChart extends CardBase {
	kind: "series";
	metric: ChartMetric;
	mark: SeriesMark;
	/** For an area, steps or blocks. */
	fill?: ChartFill;
	/** The stride dots' one colour. */
	colour?: ChartColour;
	points: ChartPoints;
	/** Dots: each point's band colour, by index. */
	colours?: Array<ChartColour | null>;
	/** A line coloured by its value (Heart Rate Zones): colour stops by value, low to high. */
	stops?: Array<{ value: number; colour: ChartColour }>;
	/** Lap Average Pace: one block per lap, its span on x and its pace. */
	blocks?: Array<{ from: number; to: number; value: number }>;
	/** Stamina's Potential: a white line over the area. */
	line?: ChartPoints;
	/** The summary's average, solid or dashed (the dot charts'); strong draws it at full weight. */
	average?: { value: number; dashed: boolean; strong?: boolean };
	/** A fixed white line: Performance Condition's 0, Impact Load Factor's 1.0. */
	reference?: number;
	/** Where an area closes: Performance Condition's steps close on 0; the rest on the plot's bottom. */
	base?: number;
	y: YAxis;
	x: XAxis;
	legend?: ChartKey[];
	/** A sport's chart's frame (its `MetricDef.frame`); the run's charts are framed by their metric. */
	frame?: ChartFrameName;
	/** A chart of lanes (`mark: "lanes"`): its lanes and bars, in place of points. */
	lanes?: LaneSet;
}

/**
 * The card frames `activity-charts.ts` keeps: the usual one, Pace's, the
 * forced labels', Power's and Stamina's; a ride's L/R Balance, Power Phase
 * (and its peak, each with its End's wider labels) and platform offset ones.
 */
export type ChartFrameName = "chart" | "pace" | "forced" | "power" | "stamina" | "balance" | "phase" | "phase-wide" | "peak" | "peak-wide" | "offset";

export interface TrainingEffectChart extends CardBase {
	kind: "training-effect";
	scales: Array<{ label: "Aerobic" | "Anaerobic"; value: number; colour: ChartColour }>;
}

export type RunWalkLane = "run" | "walk" | "idle";

export interface RunWalkChart extends CardBase {
	kind: "run-walk";
	/** Top to bottom: Idle, Walk, Run. */
	lanes: Array<{ lane: RunWalkLane; label: string; colour: ChartColour }>;
	/** Each segment's span on x; a bar rises from the plot's bottom to its lane's line. */
	bars: Array<{ from: number; to: number; lane: RunWalkLane }>;
	x: XAxis;
	legend: ChartKey[];
}

export interface ZoneRow {
	zone: number;
	/** "Zone 5". */
	title: string;
	/** "> 183 bpm", "163 - 183 bpm"; empty without the zones' floors. */
	range: string;
	/** "Maximum". */
	name: string;
	/** "41:33". */
	time: string;
	/** "74%". */
	percent: string;
	/** The bar's fill, 0 … 1: the floored percentage. */
	fill: number;
	colour: ChartColour;
}

export interface ZonesChart extends CardBase {
	kind: "zones";
	/** The top zone first. */
	rows: ZoneRow[];
}

/**
 * A card a sport draws itself: `plot` names the Svelte plot that draws it
 * (`CARD_PLOTS` in `ui/svelte/activity/charts/kinds.ts`), `data` is whatever
 * that plot needs (a ride's power curve, its position lanes).
 */
export interface CustomChart extends CardBase {
	kind: "custom";
	plot: string;
	data: unknown;
	/** Its title set as the zone tables' are, lower under the band: a ride's Time in Position. */
	head?: "zones";
}

export type ChartCard = SeriesChart | TrainingEffectChart | RunWalkChart | ZonesChart | CustomChart;

export interface ChartsTabView {
	axis: ActivityAxis;
	/** Empty without samples: the tab shows its loading or empty state. */
	cards: ChartCard[];
}

/** What the Charts tab reads off the route. */
export type ChartsRoute = Pick<ActivityRoute, "axis" | "picks">;

/* ------------------------------------------------------------------ */
/*  A sport's charts                                                   */
/* ------------------------------------------------------------------ */

/**
 * A chart of samples a sport has and the run doesn't, field by field what the
 * run's tables and switches below say about each of theirs. A spec can't
 * redefine one of the run's sixteen: those ids are the run's code.
 */
export interface MetricDef {
	/** The card's, the picker's, the landscape title's and the chips' name: "Power (W)". */
	title: string;
	/** The card a landscape view of it is framed as (a picker's other choices share their card); its own id by default. */
	card?: CardId;
	/** Whether the activity has what it draws. */
	has: (detail: ActivityDetail) => boolean;
	/** The samples in the chart's unit, one per sample, null where there is none. */
	values: (detail: ActivityDetail, units: Units) => Array<number | null>;
	/** An area, a line, dots (whose time axis starts at their first value), steps or blocks. */
	mark: SeriesMark;
	/** An area's, steps' or blocks' gradient. */
	fill?: ChartFill;
	/** Dots in one colour, without bands (Stride Length's blue). */
	colour?: ChartColour;
	/** Its colour as the landscape overlay: the line and the right labels. */
	accent: ChartColour;
	/** The y axis by the run's rules (`pad`, `times`, `floor`, `fixed`, `forced`); none is a plot from 0.98 × the least value to the most. */
	axis?: AxisRule;
	/** A y axis of its own, which wins over `axis`: a pace axis, fast at the top. */
	yAxis?: (detail: ActivityDetail, units: Units, values: ReadonlyArray<number | null>) => YAxis;
	/** The card's y labels; by default at most one decimal, no trailing zeros. */
	labels?: (value: number) => string;
	/** The landscape overlay's right labels; by default whole numbers, half-even. */
	overlayLabels?: (value: number) => string;
	/** A pace: as an overlay it shows its top label only, as the run's paces do. */
	pace?: boolean;
	/**
	 * The summary's average as a line, in the chart's unit: solid for an area,
	 * dashed for dots. Strong: 0.67 pt at full text-normal over the dots
	 * rather than the run's 0.5 at 80 % (a ride's platform centre offsets,
	 * 953:180931).
	 */
	average?: { value: (detail: ActivityDetail, units: Units) => number | undefined; dashed?: boolean; strong?: boolean };
	/** The figures under the card's title. */
	figures: (detail: ActivityDetail, units: Units) => ChartFigure[];
	/** Dot colours by band, cut in Garmin's own unit; `raw` turns a value in the chart's unit back into it. */
	bands?: { cuts: readonly number[]; colours: readonly ChartColour[]; raw?: (value: number, units: Units) => number };
	/** The card's frame in `activity-charts.ts`; the usual one by default. */
	frame?: ChartFrameName;
	/** Anything more the chart carries: a reference line, a second line, a legend, blocks. `start` is where its time axis starts. */
	decorate?: (chart: SeriesChart, ctx: ChartContext, start: number) => void;
	/** The chips' and the landscape title's name where it differs from the card's: "Power Phase Start" for "Power Phase: Start". */
	chip?: string;
	/**
	 * Dots in more than one series, each in its own colour and drawn in turn
	 * (a ride's left and right pedals). `values` then holds a value only where
	 * every series has one: the time axis spans those samples.
	 */
	series?: (detail: ActivityDetail, units: Units) => ReadonlyArray<{ values: ReadonlyArray<number | null>; colour: ChartColour }>;
	/** Dots: the card's time axis ends at the last sample with a value, as it starts at the first (a ride's 57:05 where its samples run to 57:20). */
	trim?: boolean;
	/** As a landscape overlay, its card's own labels rather than five even ones: L/R Balance's "100% L · 50/50 · 100% R". */
	keepLabels?: boolean;
	/** A chart of lanes rather than values (a ride's Position): its lanes and bars on an axis of its own, or null without any. */
	lanes?: (ctx: ChartContext) => (LaneSet & { x: XAxis }) | null;
}

/**
 * A card a sport builds itself, from the context and the route's choice for
 * its picker (when the spec gives the card one): its title, figures, picker,
 * plot and data, or null without data. Its kind, id and "?" are the tab's (the
 * card's id in the spec, the spec's `help` list).
 */
export type CustomCardDef = (ctx: ChartContext, pick: string | undefined) => Omit<CustomChart, "kind" | "id" | "help"> | null;

/**
 * The Charts tab of a sport: its profile's `charts`. The run's is `RUN_CHARTS`,
 * the default everywhere.
 */
export interface ChartsSpec {
	/** The cards, top to bottom (each shown only with data); or a function of the activity, for cards that need more than data to show. */
	cards: readonly CardId[] | ((detail: ActivityDetail) => readonly CardId[]);
	/** The charts of samples the landscape view offers as chips and opens from a badge, each only with data. */
	chips: readonly ChartMetric[];
	/** The cards with a picker on their title, by card id. */
	pickers: Readonly<Record<CardId, PickerDef>>;
	/** Charts of samples the run doesn't have, by id. */
	metrics?: Readonly<Record<ChartMetric, MetricDef>>;
	/** Cards the sport draws itself, by card id. */
	custom?: Readonly<Record<CardId, CustomCardDef>>;
	/** The cards with a "?" on their title; the run's list by default. */
	help?: readonly CardId[];
	/** Each zone's name by its number, per scale; the run's names by default. */
	zoneNames?: Partial<Record<ZoneKind, Readonly<Record<number, string>>>>;
	/** A zone bar's colour by its number, per scale; `zone-<n>` by default. */
	zoneColours?: Partial<Record<ZoneKind, Readonly<Record<number, ChartColour>>>>;
	/**
	 * What a zone's share is of: the zones' own sum (the run's, the default),
	 * or the activity's time (`duration`), as the Stair Stepper's 11 / 6 / 80%
	 * show, its zones' 34:20 being short of its 34:52.
	 */
	zoneTotal?: "zones" | "duration";
	/**
	 * What a sport draws differently on one of the run's own charts: a ride's
	 * Power titled "Power" on its own axis, the basic page's heart rate labelled
	 * in fifties. The run's code draws the rest.
	 */
	runOverrides?: Readonly<Partial<Record<RunMetric, RunOverride>>>;
	/**
	 * Where the samples sit on an axis, and where it ends, for a sport whose
	 * samples don't say: a pool swim's carry no distance, so the sample that
	 * closes each length sits at the distance swum by then. Undefined (for the
	 * axis, or no hook) is the samples' own time or distance, as the run's. The
	 * y axis of a chart on placed samples spans the samples placed.
	 */
	places?: (detail: ActivityDetail, axis: ActivityAxis) => AxisPlaces | undefined;
	/** The Distance axis' ticks and title for its end in metres: a swim's metres; the run's km or miles by default. */
	distanceAxis?: (end: number, units: Units, detail: ActivityDetail) => XAxis;
}

/** A sport's places for the samples on an axis (`ChartsSpec.places`): one per sample, null for none; and the axis' end. */
export interface AxisPlaces {
	at: ReadonlyArray<number | null>;
	end: number;
}

/** A sport's title, y axis, overlay colour or card frame for one of the run's charts. */
export interface RunOverride {
	title?: string;
	axis?: AxisRule;
	/** Its colour as a landscape overlay: a ride's Power line #ed79d5, where the run's is Garmin's purple. */
	accent?: ChartColour;
	/** Its card's frame: a ride's Power in the usual one, where the run's sits higher (`activity-charts.ts`). */
	frame?: ChartFrameName;
	/** As a landscape overlay, its card's own labels (a ride's Performance Condition: "+4 +2 0 -2 -4"). */
	keepLabels?: boolean;
	/** As a landscape overlay, its card's key under the axis title (a ride's Stamina: "● Stamina — Potential"). */
	keepKey?: boolean;
}

/** The two zone scales a page draws. */
export type ZoneKind = "hr" | "power";

/** What a card or a chart is drawn from besides the activity: the activity index and today. */
export interface ChartExtras {
	/** The activity index (a ride's power curve compares the ride with the record). */
	rows?: readonly ActivityRow[];
	/** `YYYY-MM-DD`. */
	today?: string;
}

/* ------------------------------------------------------------------ */
/*  Rules                                                              */
/* ------------------------------------------------------------------ */

/** The time axis' ticks: the start, the end and four between, equally spaced. */
export const TICKS = 6;
/** Labels within this share of the plot's height past either end are still drawn (6 of 137 pt). */
export const LABEL_SLACK = 6 / 137;
/** Every bottom sits at 0.98 × the series' minimum; a pace axis' fast end at 0.98 × the best pace. */
const BOTTOM = 0.98;

export interface AxisRule {
	/** top = max + pad × (max − min). */
	pad?: number;
	/** top = times × max. */
	times?: number;
	/** A bottom that stays put (Impact Load Factor's 0). */
	floor?: number;
	/** Bounds that never move: Stamina's 0–100, Performance Condition's ±3. */
	fixed?: readonly [bottom: number, top: number];
	/** Five labels in equal steps from bottom to top, rounded half-even, rather than nice ones. */
	forced?: boolean;
	/**
	 * The labels' step: the run's nice step for about four intervals by
	 * default; `fit`, the smallest 1, 2 or 5 × 10ⁿ with at most 5.5 steps in the
	 * range, as the swims' and the basic page's charts show (100 / 150 / 200).
	 */
	step?: "fit";
	/** Bounds at ±(the largest |value|, whole, + reach): a ride's Performance Condition (reach 1). */
	reach?: number;
}

type PaceMetric = "pace" | "gap" | "lap-pace";

/**
 * The y axes the spec measured. The top's padding comes in two clusters, 0.443
 * (heart rate, cadence, stride: the overlays' labels pin [0.441, 0.445]) and
 * 0.405 (elevation, vertical oscillation, ground contact time: GCT pins
 * [0.400, 0.411]); why they differ is unknown (Inferred). So are Power's top at
 * 1.66 × its max (≈735 W for 442) and Impact Load Factor's at 2 × its max.
 */
const AXES: Readonly<Record<Exclude<RunMetric, PaceMetric>, AxisRule>> = {
	"heart-rate": { pad: 0.443 },
	"heart-rate-zones": { pad: 0.443 },
	elevation: { pad: 0.405 },
	power: { times: 1.66 },
	"power-per-kg": { times: 1.66 },
	stamina: { fixed: [0, 100] },
	// Fixed and symmetric (Inferred), widened to whole units when a value runs past ±3.
	"performance-condition": { fixed: [-3, 3] },
	cadence: { pad: 0.443 },
	"stride-length": { pad: 0.443 },
	"vertical-ratio": { pad: 0, forced: true },
	"vertical-oscillation": { pad: 0.405 },
	"ground-contact-time": { pad: 0.405, forced: true },
	"impact-load": { floor: 0, times: 2 },
};

/** Stride's labels step 0.5 m where its range predicts 0.2: the one exception to the nice steps (Inferred). */
const STRIDE_STEP_M = 0.5;

/** The charts drawn as dots: their time axis starts at their first sample with a value. */
const DOT_METRICS: ReadonlySet<ChartMetric> = new Set<RunMetric>(["cadence", "stride-length", "vertical-ratio", "vertical-oscillation", "ground-contact-time"]);

/** Their average line is dashed; the areas' is solid. */
const AVERAGE: Partial<Record<RunMetric, "solid" | "dashed">> = {
	pace: "solid",
	gap: "solid",
	"lap-pace": "solid",
	"heart-rate": "solid",
	"heart-rate-zones": "solid",
	power: "solid",
	"power-per-kg": "solid",
	cadence: "dashed",
	"stride-length": "dashed",
	"vertical-ratio": "dashed",
	"vertical-oscillation": "dashed",
	"ground-contact-time": "dashed",
};

/**
 * Garmin's running-dynamics colour zones, proved on the run's dots (the older
 * GCT table: 245 ms is green). A value at a cut takes the band above it; cuts
 * between the documented ranges sit midway (the VR green/orange cut, 8.6 or
 * 8.65, could not be told apart). Bands no sample reached are Garmin's
 * documented values (Inferred). In Garmin's units, whatever the page's.
 */
const BANDS: Readonly<Partial<Record<RunMetric, { cuts: readonly number[]; colours: readonly ChartColour[] }>>> = {
	// spm: < 153 red, 153–163 orange, 164–173 green, 174–183 blue, > 183 purple.
	cadence: { cuts: [152.5, 163.5, 173.5, 183.5], colours: ["red", "orange", "green", "blue", "purple"] },
	// ms: < 208 purple, 208–240 blue, 241–272 green, 273–305 orange, > 305 red.
	"ground-contact-time": { cuts: [207.5, 240.5, 272.5, 305.5], colours: ["purple", "blue", "green", "orange", "red"] },
	// cm: < 6.4 purple, 6.4–8.1 blue, 8.2–9.7 green, 9.8–11.5 orange, > 11.5 red.
	"vertical-oscillation": { cuts: [6.4, 8.15, 9.75, 11.55], colours: ["purple", "blue", "green", "orange", "red"] },
	// %: < 6.1 purple, 6.1–7.4 blue, 7.5–8.6 green, 8.7–10.1 orange, > 10.1 red.
	"vertical-ratio": { cuts: [6.1, 7.45, 8.65, 10.15], colours: ["purple", "blue", "green", "orange", "red"] },
};

/** Training Effect's scale: five segments, grey, grey, blue, green, orange, then a red cap at 5. */
export const TE_SEGMENTS: readonly ChartColour[] = ["grey", "grey", "blue", "green", "orange"];
export const TE_CAP: ChartColour = "red";
export const TE_MAX = 5;

const HR_ZONE_NAMES: Readonly<Record<number, string>> = { 1: "Warm Up", 2: "Easy", 3: "Aerobic", 4: "Threshold", 5: "Maximum" };
// Zone 1's "Easy" is web-confirmed; the phone's shot ends above it.
const POWER_ZONE_NAMES: Readonly<Record<number, string>> = { 1: "Easy", 2: "Moderate", 3: "Tempo", 4: "Long Interval", 5: "Short Interval" };

const METRES_PER_MILE = 1609.344;
const FEET_PER_METRE = 3.28084;
const CM_PER_FOOT = 30.48;
const CM_PER_INCH = 2.54;

/* ------------------------------------------------------------------ */
/*  The run's lookups, then the spec's                                 */
/* ------------------------------------------------------------------ */

const RUN_METRICS: ReadonlySet<string> = new Set<string>(CHART_METRICS);

export function isRunMetric(metric: string): metric is RunMetric {
	return RUN_METRICS.has(metric);
}

/** A spec's entry by id: its own, never one an object inherits (`constructor`). */
function own<T>(record: Readonly<Record<string, T>> | undefined, id: string): T | undefined {
	return record && Object.prototype.hasOwnProperty.call(record, id) ? record[id] : undefined;
}

/** A sport's definition of a chart the run doesn't have; never one of the run's sixteen. */
function specMetric(spec: ChartsSpec | undefined, metric: ChartMetric): MetricDef | undefined {
	return isRunMetric(metric) ? undefined : own(spec?.metrics, metric);
}

function titleOf(metric: ChartMetric, spec: ChartsSpec): string {
	return chartTitle(metric, spec) ?? metric;
}

function helpOf(id: CardId, spec: ChartsSpec): boolean {
	return spec.help ? spec.help.includes(id) : HELP.has(id);
}

function isDots(metric: ChartMetric, spec: ChartsSpec): boolean {
	return DOT_METRICS.has(metric) || specMetric(spec, metric)?.mark === "dots";
}

function averageStyle(metric: ChartMetric, spec: ChartsSpec): "solid" | "dashed" | undefined {
	if (isRunMetric(metric)) return AVERAGE[metric];
	const average = specMetric(spec, metric)?.average;
	return average ? (average.dashed ? "dashed" : "solid") : undefined;
}

function bandsOf(metric: ChartMetric, spec: ChartsSpec): MetricDef["bands"] {
	return isRunMetric(metric) ? BANDS[metric] : specMetric(spec, metric)?.bands;
}

function accentOf(metric: ChartMetric, spec: ChartsSpec): ChartColour {
	return isRunMetric(metric) ? (own(spec.runOverrides, metric)?.accent ?? ACCENT[metric]) : (specMetric(spec, metric)?.accent ?? "blue");
}

/** A chart's name on its chip and in the landscape title: its card's, or the sport's chip word for it. */
function chipTitleOf(metric: ChartMetric, spec: ChartsSpec): string {
	return specMetric(spec, metric)?.chip ?? titleOf(metric, spec);
}

/* ------------------------------------------------------------------ */
/*  The tab                                                            */
/* ------------------------------------------------------------------ */

/**
 * The Charts tab: every card the activity has data for, in the sport's
 * order (the run's by default, the phone's), each with the picker choice the
 * route keeps (or the first one it has).
 */
export function chartsTabView(detail: ActivityDetail, route: ChartsRoute, units: Units, spec: ChartsSpec = RUN_CHARTS, extras: ChartExtras = {}): ChartsTabView {
	const ctx = contextOf(detail, route.axis, units, spec, extras);
	if (!ctx) return { axis: route.axis, cards: [] };
	const cards: ChartCard[] = [];
	for (const id of cardsOf(spec, detail)) {
		const card = cardOf(ctx, id, route);
		if (card) cards.push(card);
	}
	return { axis: route.axis, cards };
}

/** A spec's cards for this activity. */
export function cardsOf(spec: ChartsSpec, detail: ActivityDetail): readonly CardId[] {
	return typeof spec.cards === "function" ? spec.cards(detail) : spec.cards;
}

/** The charts of samples the activity has data for, among the sport's chips. */
export function availableMetrics(detail: ActivityDetail, spec: ChartsSpec = RUN_CHARTS): ChartMetric[] {
	return spec.chips.filter((m) => hasMetric(detail, m, spec));
}

/** A card by its spec: a sport's own plot, a card with a picker, or one of the kinds every sport shares. */
function cardOf(ctx: Context, id: CardId, route: ChartsRoute): ChartCard | null {
	const picker = own(ctx.spec.pickers, id);
	const pick = picker ? own(route.picks, picker.key) : undefined;
	const custom = own(ctx.spec.custom, id);
	if (custom) {
		const card = custom(ctx, pick);
		return card && { kind: "custom", id, help: helpOf(id, ctx.spec), ...card };
	}
	if (picker) return pickerCard(ctx, id, picker, pick);
	switch (id) {
		case "training-effect":
			return trainingEffect(ctx);
		case "run-walk":
			return runWalk(ctx);
		case "time-in-hr-zones":
			return zones(ctx, "hr");
		case "time-in-power-zones":
			return zones(ctx, "power");
		default:
			return seriesChart(ctx, id, id);
	}
}

type PickerOption = PickerDef["options"][number];

const PACE_OPTIONS: ReadonlyArray<PickerOption> = [
	{ value: "pace", metric: "pace" },
	{ value: "gap", metric: "gap" },
	{ value: "lap-pace", metric: "lap-pace" },
];
const HEART_OPTIONS: ReadonlyArray<PickerOption> = [
	{ value: "heart-rate", metric: "heart-rate" },
	{ value: "zones", metric: "heart-rate-zones" },
];
const POWER_OPTIONS: ReadonlyArray<PickerOption> = [
	{ value: "watts", metric: "power" },
	{ value: "per-kg", metric: "power-per-kg" },
];

/**
 * The run's Charts tab: its sixteen cards in the phone's order, its sixteen
 * charts of samples as the chips, and its three pickers (keys `pace`, `heart`
 * and `power`, the values `routes.ts` folds old routes in with).
 */
export const RUN_CHARTS: ChartsSpec = {
	cards: CARD_IDS,
	chips: CHART_METRICS,
	pickers: {
		pace: { key: "pace", title: "Pace", options: PACE_OPTIONS },
		"heart-rate": { key: "heart", title: "Heart Rate", options: HEART_OPTIONS },
		power: { key: "power", title: "Power", options: POWER_OPTIONS },
	},
};

/** A card with a picker: the options the activity has data for; the route's choice, or the first. */
function pickerCard(ctx: Context, id: CardId, picker: PickerDef, wanted: string | undefined): SeriesChart | null {
	const options = picker.options.filter((o) => hasMetric(ctx.detail, o.metric, ctx.spec));
	if (!options.length) return null;
	const chosen = options.find((o) => o.value === wanted) ?? options[0];
	const chart = seriesChart(ctx, id, chosen.metric);
	if (!chart) return null;
	// One choice left is no choice: no "⌄".
	if (options.length > 1) chart.picker = { key: picker.key, options: options.map((o) => ({ value: o.value, label: titleOf(o.metric, ctx.spec) })), chosen: chosen.value };
	return chart;
}

/* ------------------------------------------------------------------ */
/*  Series charts                                                      */
/* ------------------------------------------------------------------ */

/** What every card of the tab is drawn from: a `MetricDef`'s `decorate` and a sport's custom cards get it too. */
export interface ChartContext {
	detail: ActivityDetail;
	axis: ActivityAxis;
	units: Units;
	/** Each sample's place on the axis: timer seconds or metres; null where unknown. */
	at: Array<number | null>;
	/** The axis' end: the last sample's time or distance. */
	end: number;
	/** The sport's charts. */
	spec: ChartsSpec;
	extras: ChartExtras;
	/** The sport placed the samples itself (`ChartsSpec.places`): each chart's y axis spans the samples placed. */
	placed?: boolean;
}

type Context = ChartContext;

function contextOf(detail: ActivityDetail, axis: ActivityAxis, units: Units, spec: ChartsSpec, extras: ChartExtras): Context | null {
	const own = spec.places?.(detail, axis);
	if (own) return own.end > 0 ? { detail, axis, units, at: [...own.at], end: own.end, spec, extras, placed: true } : null;
	const at = (axis === "distance" ? detail.samples.distance : detail.samples.time) ?? [];
	let end = -Infinity;
	for (const v of at) if (isNumber(v) && v > end) end = v;
	if (!(end > 0)) return null;
	return { detail, axis, units, at, end, spec, extras };
}

interface SeriesOptions {
	/** The landscape view runs every chart from 0, its dot charts too. */
	fromZero?: boolean;
}

/** One chart of samples, or null when the activity has none for it. */
function seriesChart(ctx: Context, id: CardId, metric: ChartMetric, opts: SeriesOptions = {}): SeriesChart | null {
	if (!hasMetric(ctx.detail, metric, ctx.spec)) return null;
	const def = specMetric(ctx.spec, metric);
	if (def?.lanes) return laneChart(ctx, id, metric, def);
	const values = valuesOf(ctx.detail, metric, ctx.units, ctx.spec);
	const dots = ctx.axis === "time" && isDots(metric, ctx.spec) && !opts.fromZero;
	const start = dots ? firstAt(ctx.at, values) : 0;
	// A sport's dots may end their axis at their last value too; the run's run to the activity's end.
	const end = dots && def?.trim ? lastAt(ctx.at, values, ctx.end) : ctx.end;
	const series = def?.series?.(ctx.detail, ctx.units);
	const drawn = series?.map((s) => valued(upTo(pointsOf(ctx.at, s.values, start, end))));
	const points = drawn ? joined(drawn) : def?.trim ? upTo(pointsOf(ctx.at, values, start, end)) : pointsOf(ctx.at, values, start, ctx.end);
	const chart: SeriesChart = {
		kind: "series",
		id,
		metric,
		title: titleOf(metric, ctx.spec),
		help: helpOf(id, ctx.spec),
		figures: figuresOf(ctx.detail, metric, ctx.units, ctx.spec),
		mark: markOf(metric, ctx.spec),
		points,
		y: yAxisOf(ctx.detail, metric, ctx.units, ctx.placed ? placedOnly(ctx.at, values) : values, ctx.spec),
		x: ctx.axis === "time" ? timeAxis(start, end) : distanceTicks(ctx),
	};
	const fill = fillOf(metric, ctx.spec);
	if (fill) chart.fill = fill;
	const average = averageOf(ctx.detail, metric, ctx.units, ctx.spec);
	if (average !== undefined) {
		chart.average = { value: average, dashed: averageStyle(metric, ctx.spec) === "dashed" };
		if (specMetric(ctx.spec, metric)?.average?.strong) chart.average.strong = true;
	}
	const bands = bandsOf(metric, ctx.spec);
	if (bands) chart.colours = points.y.map((v) => (v === null ? null : bandOf(bands, rawOf(metric, v, ctx.units, ctx.spec))));
	// Each series' dots in its own colour, in the order drawn.
	if (drawn && series) chart.colours = drawn.flatMap((p, i) => p.x.map(() => series[i].colour));
	switch (metric) {
		case "stride-length":
			chart.colour = "blue";
			break;
		case "heart-rate-zones":
			chart.stops = zoneStops(ctx.detail.hrZones) ?? [];
			break;
		case "lap-pace":
			chart.blocks = lapBlocks(ctx, ctx.detail.laps);
			break;
		case "stamina": {
			const potential = ctx.detail.samples.potential;
			if (potential && potential.some(isNumber)) chart.line = pointsOf(ctx.at, potential, start, ctx.end);
			chart.legend = [
				{ label: "Stamina", colour: "orange", kind: "dot" },
				{ label: "Potential", colour: "white", kind: "dash" },
			];
			break;
		}
		case "performance-condition":
			chart.reference = 0;
			chart.base = 0;
			break;
		case "impact-load":
			// A fixed white line at 1.0, not at the run's average 1.06 (Inferred: the shot's line sits at 1.01).
			chart.reference = 1;
			break;
		default: {
			if (def?.colour) chart.colour = def.colour;
			if (def?.frame) chart.frame = def.frame;
			def?.decorate?.(chart, ctx, start);
			break;
		}
	}
	const frame = isRunMetric(metric) ? own(ctx.spec.runOverrides, metric)?.frame : undefined;
	if (frame) chart.frame = frame;
	return chart;
}

/**
 * A chart of lanes (a sport's `MetricDef.lanes`): no values, no value axis,
 * its bars on an axis of its own (a ride's Position is on the clock, to the
 * summary's duration).
 */
function laneChart(ctx: Context, id: CardId, metric: ChartMetric, def: MetricDef): SeriesChart | null {
	const lanes = def.lanes?.(ctx);
	if (!lanes) return null;
	const chart: SeriesChart = {
		kind: "series",
		id,
		metric,
		title: titleOf(metric, ctx.spec),
		help: helpOf(id, ctx.spec),
		figures: def.figures(ctx.detail, ctx.units),
		mark: "lanes",
		points: { x: [], y: [] },
		y: { bottom: 0, top: 1, labels: [] },
		x: lanes.x,
		lanes: { lanes: lanes.lanes, bars: lanes.bars },
	};
	if (def.frame) chart.frame = def.frame;
	def.decorate?.(chart, ctx, 0);
	return chart;
}

/** The last sample with a value and a place on the axis; `fallback` without one. */
export function lastAt(at: ReadonlyArray<number | null>, values: ReadonlyArray<number | null>, fallback: number): number {
	for (let i = Math.min(at.length, values.length) - 1; i >= 0; i -= 1) {
		const a = at[i];
		if (values[i] !== null && values[i] !== undefined && isNumber(a)) return a;
	}
	return fallback;
}

/** The points up to the axis' end: a series' dots past its last shared sample are off the plot. */
function upTo(points: ChartPoints): ChartPoints {
	const keep = points.x.map((x) => x <= 1 + 1e-9);
	if (keep.every(Boolean)) return points;
	return { x: points.x.filter((_, i) => keep[i]), y: points.y.filter((_, i) => keep[i]) };
}

/** Only the points with a value: dots in several series keep no gaps, as their order is no longer the samples'. */
function valued(points: ChartPoints): ChartPoints {
	const keep = points.y.map((y) => y !== null);
	return { x: points.x.filter((_, i) => keep[i]), y: points.y.filter((_, i) => keep[i]) };
}

/** Several series' points as one list, each series after the last. */
function joined(parts: readonly ChartPoints[]): ChartPoints {
	return { x: parts.flatMap((p) => p.x), y: parts.flatMap((p) => p.y) };
}

function markOf(metric: ChartMetric, spec: ChartsSpec): SeriesMark {
	if (DOT_METRICS.has(metric)) return "dots";
	if (metric === "heart-rate-zones") return "line";
	if (metric === "performance-condition") return "steps";
	if (metric === "lap-pace") return "blocks";
	return specMetric(spec, metric)?.mark ?? "area";
}

function fillOf(metric: ChartMetric, spec: ChartsSpec): ChartFill | undefined {
	switch (metric) {
		case "pace":
		case "gap":
		case "lap-pace":
			return "pace";
		case "heart-rate":
			return "heart-rate";
		case "elevation":
			return "elevation";
		case "power":
		case "power-per-kg":
			return "power";
		case "stamina":
			return "stamina";
		case "impact-load":
			return "impact";
		case "performance-condition":
			return "performance";
		default:
			return specMetric(spec, metric)?.fill;
	}
}

/** Whether the activity has what the chart draws: the run's charts by their columns, a sport's by its `MetricDef`. */
export function hasMetric(detail: ActivityDetail, metric: ChartMetric, spec: ChartsSpec = RUN_CHARTS): boolean {
	const s = detail.samples;
	const has = (column: string) => (s[column] ?? []).some(isNumber);
	switch (metric) {
		case "pace":
			return has("speed");
		case "gap":
			return has("gap");
		case "lap-pace":
			return detail.laps.some((lap) => (lap.speed ?? 0) > 0);
		case "heart-rate":
			return has("hr");
		case "heart-rate-zones":
			return has("hr") && zoneStops(detail.hrZones) !== null;
		case "elevation":
			return has("elevation");
		case "power":
			return has("power");
		case "power-per-kg":
			return has("power") && (detail.weightKg ?? 0) > 0;
		case "stamina":
			return has("stamina");
		case "performance-condition":
			return has("performance");
		case "cadence":
			return (s.cadence ?? []).some((v) => isNumber(v) && v > 0);
		case "stride-length":
			return has("stride");
		case "vertical-ratio":
			return has("vr");
		case "vertical-oscillation":
			return has("vo");
		case "ground-contact-time":
			return has("gct");
		case "impact-load":
			// The treadmill's constant 0.5 still draws, as the web does (Inferred for the phone).
			return has("impact");
		default:
			return specMetric(spec, metric)?.has(detail) ?? false;
	}
}

/** The samples in the chart's unit: pace as seconds per km or mile, stride in metres or feet. */
function valuesOf(detail: ActivityDetail, metric: ChartMetric, units: Units, spec: ChartsSpec): Array<number | null> {
	const map = (column: string, f: (v: number) => number | null) => (detail.samples[column] ?? []).map((v) => (isNumber(v) ? f(v) : null));
	switch (metric) {
		case "pace":
		case "lap-pace":
			return map("speed", (v) => paceOf(v, units));
		case "gap":
			return map("gap", (v) => paceOf(v, units));
		case "heart-rate":
		case "heart-rate-zones":
			return map("hr", (v) => v);
		case "elevation":
			return map("elevation", (v) => (units === "imperial" ? v * FEET_PER_METRE : v));
		case "power":
			return map("power", (v) => v);
		case "power-per-kg":
			return map("power", (v) => v / (detail.weightKg ?? 1));
		case "stamina":
			return map("stamina", (v) => v);
		case "performance-condition":
			return map("performance", (v) => v);
		case "cadence":
			// A 0 spm sample is the watch between steps: no dot, and no say in the axis.
			return map("cadence", (v) => (v > 0 ? v : null));
		case "stride-length":
			return map("stride", (v) => (units === "imperial" ? v / CM_PER_FOOT : v / 100));
		case "vertical-ratio":
			return map("vr", (v) => v);
		case "vertical-oscillation":
			return map("vo", (v) => (units === "imperial" ? v / CM_PER_INCH : v));
		case "ground-contact-time":
			return map("gct", (v) => v);
		case "impact-load":
			return map("impact", (v) => v);
		default:
			return specMetric(spec, metric)?.values(detail, units) ?? [];
	}
}

/** A value back in Garmin's unit, where the dot bands are defined. */
function rawOf(metric: ChartMetric, value: number, units: Units, spec: ChartsSpec): number {
	if (isRunMetric(metric)) return metric === "vertical-oscillation" && units === "imperial" ? value * CM_PER_INCH : value;
	const raw = specMetric(spec, metric)?.bands?.raw;
	return raw ? raw(value, units) : value;
}

/** Seconds per km or mile at `speed` m/s; a stop is infinitely slow, drawn at the slow end. */
function paceOf(speed: number, units: Units): number {
	if (!(speed > 0)) return Infinity;
	return (units === "imperial" ? METRES_PER_MILE : 1000) / speed;
}

/** The values of the samples with a place on the axis; the rest none. */
function placedOnly(at: ReadonlyArray<number | null>, values: ReadonlyArray<number | null>): Array<number | null> {
	return values.map((v, i) => (isNumber(at[i]) ? v : null));
}

/** Values on the axis from `start` to `end`: each sample's place as a share of it, and its value or null. */
export function pointsOf(at: ReadonlyArray<number | null>, values: ReadonlyArray<number | null>, start: number, end: number): ChartPoints {
	const span = end - start || 1;
	const x: number[] = [];
	const y: Array<number | null> = [];
	for (let i = 0; i < at.length; i += 1) {
		const a = at[i];
		if (!isNumber(a) || a < start) continue;
		x.push((a - start) / span);
		const v = values[i];
		y.push(v === undefined || v === null || Number.isNaN(v) ? null : v);
	}
	return { x, y };
}

/**
 * Where the dot charts' time axis starts: their first sample with a value. The
 * phone's Stride, VR and GCT start at 0:09, their first sample in what it
 * fetched; the plugin's 2,000-row payload has it at 0:08, so its axis reads
 * 0:08 (the spec's suggestion, Inferred).
 */
export function firstAt(at: ReadonlyArray<number | null>, values: ReadonlyArray<number | null>): number {
	for (let i = 0; i < values.length; i += 1) {
		const a = at[i];
		if (values[i] !== null && values[i] !== undefined && isNumber(a)) return a;
	}
	return 0;
}

function bandOf(bands: { cuts: readonly number[]; colours: readonly ChartColour[] }, value: number): ChartColour {
	let i = 0;
	while (i < bands.cuts.length && value >= bands.cuts[i]) i += 1;
	return bands.colours[i];
}

/* ------------------------------------------------------------------ */
/*  Axes                                                               */
/* ------------------------------------------------------------------ */

/**
 * The time axis: six ticks at `round(t0 + k × (T − t0) / 5)`, "m:ss" (an hour
 * or more "h:mm:ss", Inferred), T the last sample's timer time. `drawn` keeps
 * the first few of the six (Run/Walk draws five).
 */
export function timeAxis(start: number, end: number, drawn = TICKS): XAxis {
	const ticks: XAxis["ticks"] = [];
	for (let k = 0; k < drawn; k += 1) {
		const at = k / (TICKS - 1);
		ticks.push({ at, text: duration(Math.round(start + at * (end - start))) });
	}
	return { ticks, title: "Time (h:m:s)" };
}

/**
 * The distance axis: nice steps from 0 to the last sample, two decimals
 * (Inferred over equal divisions truncated to 0.01: on the 10.009 km run both
 * read 0.00 … 10.00 and the 0.3 pt between them cannot be seen).
 */
export function distanceAxis(metres: number, units: Units): XAxis {
	const length = units === "imperial" ? metres / METRES_PER_MILE : metres / 1000;
	const step = niceStep(length / (TICKS - 1));
	const ticks: XAxis["ticks"] = [];
	for (let k = 0; k * step <= length + 1e-9; k += 1) {
		const value = round(k * step, 6);
		ticks.push({ at: length > 0 ? value / length : 0, text: value.toFixed(2) });
	}
	return { ticks, title: units === "imperial" ? "Distance (mi)" : "Distance (km)" };
}

/** The Distance axis of a chart: the sport's own ticks (a swim's metres), or the run's. */
function distanceTicks(ctx: Pick<Context, "detail" | "end" | "units" | "spec">): XAxis {
	return ctx.spec.distanceAxis?.(ctx.end, ctx.units, ctx.detail) ?? distanceAxis(ctx.end, ctx.units);
}

/** A nice step for `raw`: 1, 2 or 5 × 10ⁿ, rounding at 1.5, 3 and 7. */
export function niceStep(raw: number): number {
	if (!(raw > 0) || !Number.isFinite(raw)) return 1;
	const exp = Math.floor(Math.log10(raw));
	const f = raw / 10 ** exp;
	const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
	return Number((nice * 10 ** exp).toPrecision(12));
}

/** The chart's y axis: its bounds by the spec's rule for it (or a sport's own axis), and its labels. */
function yAxisOf(detail: ActivityDetail, metric: ChartMetric, units: Units, values: ReadonlyArray<number | null>, spec: ChartsSpec): YAxis {
	if (metric === "pace" || metric === "gap" || metric === "lap-pace") return paceAxis(detail, metric, units);
	const def = specMetric(spec, metric);
	if (def?.yAxis) return def.yAxis(detail, units, values);
	const override = isRunMetric(metric) ? own(spec.runOverrides, metric)?.axis : undefined;
	const rule: AxisRule = override ?? (isRunMetric(metric) ? AXES[metric as Exclude<RunMetric, PaceMetric>] : (def?.axis ?? {}));
	const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
	const min = finite.length ? Math.min(...finite) : 0;
	const max = finite.length ? Math.max(...finite) : 1;
	let bottom: number;
	let top: number;
	if (rule.reach !== undefined) {
		const reach = Math.ceil(Math.max(Math.abs(min), Math.abs(max))) + rule.reach;
		[bottom, top] = [-reach, reach];
	} else if (rule.fixed) {
		[bottom, top] = rule.fixed;
		// Performance Condition past ±3 widens the axis rather than leave the plot.
		const reach = Math.ceil(Math.max(Math.abs(min), Math.abs(max)));
		if (metric === "performance-condition" && reach > top) [bottom, top] = [-reach, reach];
	} else {
		bottom = rule.floor ?? BOTTOM * min;
		top = rule.times !== undefined ? rule.times * max : max + (rule.pad ?? 0) * (max - min);
		if (!(top > bottom)) top = bottom + 1;
	}
	const text = labelFormat(metric, spec);
	if (rule.forced) return { bottom, top, labels: forcedLabels(bottom, top, text) };
	const step = rule.step === "fit" ? fitStep(top - bottom) : metric === "stride-length" && units === "metric" ? STRIDE_STEP_M : undefined;
	return { bottom, top, labels: niceLabels(bottom, top, text, step) };
}

/** The smallest 1, 2 or 5 × 10ⁿ that cuts `range` into at most 5.5 steps. */
export function fitStep(range: number): number {
	if (!(range > 0) || !Number.isFinite(range)) return 1;
	for (let exp = Math.floor(Math.log10(range / 5.5)) - 1; ; exp += 1) {
		for (const f of [1, 2, 5]) {
			const step = Number((f * 10 ** exp).toPrecision(12));
			if (range / step <= 5.5) return step;
		}
	}
}

/**
 * Pace axes, fast at the top. Pace and Grade-Adjusted Pace: the fast end at
 * 0.98 × the best pace, the slow end three times as far past the average.
 * Lap Average Pace: 0.98 × the fastest lap and 1.02 × the slowest.
 */
function paceAxis(detail: ActivityDetail, metric: PaceMetric, units: Units): YAxis {
	let fast: number;
	let slow: number;
	if (metric === "lap-pace") {
		const paces = lapPaces(detail.laps, units);
		fast = BOTTOM * Math.min(...paces);
		slow = 1.02 * Math.max(...paces);
	} else {
		const best = paceOf(bestSpeed(detail, metric) ?? 0, units);
		const average = paceOf(averageSpeed(detail, metric) ?? 0, units);
		fast = BOTTOM * best;
		slow = fast + 3 * (average - fast);
	}
	if (!Number.isFinite(fast) || !Number.isFinite(slow) || !(slow > fast)) {
		fast = Number.isFinite(fast) ? fast : 0;
		slow = fast + 60;
	}
	return { bottom: slow, top: fast, labels: niceLabels(slow, fast, (v) => duration(v)) };
}

/**
 * Multiples of a nice step for about four intervals; one within `LABEL_SLACK`
 * past either end still shows (Pace's 5:00 sits 2 pt above its plot). Top of
 * the plot first.
 */
export function niceLabels(bottom: number, top: number, text: (v: number) => string, fixedStep?: number): YAxis["labels"] {
	const lo = Math.min(bottom, top);
	const hi = Math.max(bottom, top);
	const range = hi - lo;
	const step = fixedStep ?? niceStep(range / 4);
	const slack = LABEL_SLACK * range;
	const out: YAxis["labels"] = [];
	for (let k = Math.ceil((lo - slack) / step - 1e-9); k * step <= hi + slack + 1e-9; k += 1) {
		const value = round(k * step, 9);
		out.push({ value, text: text(value) });
	}
	// A pace axis keeps its smallest value on top.
	return top >= bottom ? out.reverse() : out;
}

/** Five labels in equal steps from bottom to top, rounded half-even like iOS's NumberFormatter; top first. */
export function forcedLabels(bottom: number, top: number, text: (v: number) => string): YAxis["labels"] {
	const out: YAxis["labels"] = [];
	for (let k = 4; k >= 0; k -= 1) {
		const value = bottom + (k * (top - bottom)) / 4;
		out.push({ value, text: text(value) });
	}
	return out;
}

/** How a chart's y labels read. */
function labelFormat(metric: ChartMetric, spec: ChartsSpec): (v: number) => string {
	switch (metric) {
		case "performance-condition":
			return (v) => {
				const n = Math.round(v);
				return n > 0 ? `+${n}` : n === 0 ? "0" : String(n);
			};
		case "vertical-ratio":
		case "ground-contact-time":
			return (v) => plain(roundHalfEven(v, 0), 0);
		case "stride-length":
		case "power-per-kg":
			return (v) => plain(v, 2);
		default:
			return specMetric(spec, metric)?.labels ?? ((v) => plain(v, 1));
	}
}

/** A number with at most `places` decimals and no trailing zeros: "1.5", "1", "-10". */
export function plain(value: number, places: number): string {
	const digits = round(value, places).toFixed(places);
	const text = digits.includes(".") ? digits.replace(/\.?0+$/, "") : digits;
	return text === "-0" ? "0" : text;
}

/* ------------------------------------------------------------------ */
/*  Figures, averages and the special marks                            */
/* ------------------------------------------------------------------ */

function figuresOf(detail: ActivityDetail, metric: ChartMetric, units: Units, spec: ChartsSpec): ChartFigure[] {
	const s = detail.summary;
	const out: ChartFigure[] = [];
	const push = (value: string | undefined, label: string, unit?: string) => {
		if (value === undefined) return;
		out.push(unit ? { value, unit, label } : { value, label });
	};
	switch (metric) {
		case "pace":
		case "gap":
		case "lap-pace": {
			const perUnit = units === "imperial" ? "/mi" : "/km";
			push(paceText(averageSpeed(detail, metric), units), "Average", perUnit);
			push(paceText(bestSpeed(detail, metric), units), "Best", perUnit);
			break;
		}
		case "heart-rate":
		case "heart-rate-zones":
			push(whole(s.averageHR), "Average", "bpm");
			push(whole(s.maxHR), "Maximum", "bpm");
			break;
		case "elevation": {
			// Rounded half away from zero: -21.8 m reads -22 (round vs floor is Inferred: no positive elevation shot).
			const height = (v: unknown) => {
				const m = num(v);
				return m === undefined ? undefined : String(roundHalfAway(units === "imperial" ? m * FEET_PER_METRE : m));
			};
			const unit = units === "imperial" ? "ft" : "m";
			push(height(s.minElevation), "Minimum", unit);
			push(height(s.maxElevation), "Maximum", unit);
			break;
		}
		case "power":
			push(whole(s.averagePower), "Average", "W");
			push(whole(s.maxPower), "Maximum", "W");
			break;
		case "power-per-kg": {
			// Watts over the day's weigh-in, two decimals (web-confirmed: 294 W → 4.32 at 68.0 kg).
			const kg = detail.weightKg ?? 0;
			const per = (v: unknown) => {
				const w = num(v);
				return w === undefined || !(kg > 0) ? undefined : fixed(w / kg, 2);
			};
			push(per(s.averagePower), "Average", "W/kg");
			push(per(s.maxPower), "Maximum", "W/kg");
			break;
		}
		case "stamina":
			push(whole(s.beginPotentialStamina), "Beginning Potential", "%");
			push(whole(s.endPotentialStamina), "Ending Potential", "%");
			break;
		case "performance-condition":
			break;
		case "cadence":
			push(whole(s.averageRunCadence), "Average", "spm");
			push(whole(s.maxRunCadence), "Maximum", "spm");
			break;
		case "stride-length": {
			const cm = num(s.strideLength);
			if (cm !== undefined) push(fixed(units === "imperial" ? cm / CM_PER_FOOT : cm / 100, 2), "Average", units === "imperial" ? "ft" : "m");
			break;
		}
		case "vertical-ratio": {
			const ratio = num(s.verticalRatio);
			if (ratio !== undefined) push(fixed(ratio, 1), "Average", "%");
			break;
		}
		case "vertical-oscillation": {
			const cm = num(s.verticalOscillation);
			if (cm !== undefined) push(fixed(units === "imperial" ? cm / CM_PER_INCH : cm, 1), "Average", units === "imperial" ? "in" : "cm");
			break;
		}
		case "ground-contact-time":
			push(whole(s.groundContactTime), "Average", "ms");
			break;
		case "impact-load": {
			const load = num(s.impactLoad);
			if (load !== undefined) out.push(distanceFigure(load, units, "Impact Load"));
			const metres = num(s.distance);
			if (metres !== undefined) out.push(distanceFigure(metres, units, "Actual Distance"));
			break;
		}
		default:
			out.push(...(specMetric(spec, metric)?.figures(detail, units) ?? []));
			break;
	}
	return out;
}

/** "10.59" "km": metres to 0.01 km (or mile), as the activity rows write distances. */
function distanceFigure(metres: number, units: Units, label: string): ChartFigure {
	const [value, unit] = formatDistance(metres, units, 2, true).split(" ");
	return { value: value, unit: unit, label };
}

/** The line at the summary's average, in the chart's unit. */
function averageOf(detail: ActivityDetail, metric: ChartMetric, units: Units, spec: ChartsSpec): number | undefined {
	if (!averageStyle(metric, spec)) return undefined;
	const s = detail.summary;
	switch (metric) {
		case "pace":
		case "gap":
		case "lap-pace": {
			const speed = averageSpeed(detail, metric);
			return speed !== undefined && speed > 0 ? paceOf(speed, units) : undefined;
		}
		case "heart-rate":
		case "heart-rate-zones":
			return num(s.averageHR);
		case "power":
			return num(s.averagePower);
		case "power-per-kg": {
			const w = num(s.averagePower);
			const kg = detail.weightKg ?? 0;
			return w !== undefined && kg > 0 ? w / kg : undefined;
		}
		case "cadence":
			return num(s.averageRunCadence);
		case "stride-length": {
			const cm = num(s.strideLength);
			return cm === undefined ? undefined : units === "imperial" ? cm / CM_PER_FOOT : cm / 100;
		}
		case "vertical-ratio":
			return num(s.verticalRatio);
		case "vertical-oscillation": {
			const cm = num(s.verticalOscillation);
			return cm === undefined ? undefined : units === "imperial" ? cm / CM_PER_INCH : cm;
		}
		case "ground-contact-time":
			return num(s.groundContactTime);
		default:
			return specMetric(spec, metric)?.average?.value(detail, units);
	}
}

/** The average a pace chart reads: the summary's (Garmin's own), or the samples' mean without one. */
function averageSpeed(detail: ActivityDetail, metric: PaceMetric): number | undefined {
	const summary = num(detail.summary[metric === "gap" ? "avgGradeAdjustedSpeed" : "averageSpeed"]);
	if (summary !== undefined && summary > 0) return summary;
	const values = (detail.samples[metric === "gap" ? "gap" : "speed"] ?? []).filter((v): v is number => isNumber(v) && v > 0);
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

/**
 * The best a pace chart reads: Pace the summary's `maxSpeed` (the fastest
 * sample), Grade-Adjusted Pace its fastest sample (no summary key holds it),
 * Lap Average Pace the fastest lap.
 */
function bestSpeed(detail: ActivityDetail, metric: PaceMetric): number | undefined {
	if (metric === "lap-pace") {
		const speeds = detail.laps.map((lap) => lap.speed ?? 0).filter((v) => v > 0);
		return speeds.length ? Math.max(...speeds) : undefined;
	}
	const summary = metric === "pace" ? num(detail.summary.maxSpeed) : undefined;
	if (summary !== undefined && summary > 0) return summary;
	const values = (detail.samples[metric === "gap" ? "gap" : "speed"] ?? []).filter(isNumber);
	return values.length ? Math.max(...values) : undefined;
}

function paceText(speed: number | undefined, units: Units): string | undefined {
	return speed !== undefined && speed > 0 ? pace(speed, 1, units) : undefined;
}

/** The laps' paces from their own average speed (lap 2's 5:44 proves it is not time ÷ distance). */
function lapPaces(laps: readonly ActivityLap[], units: Units): number[] {
	return laps.filter((lap) => (lap.speed ?? 0) > 0).map((lap) => paceOf(lap.speed!, units));
}

/** One block per lap, as wide as its time (or distance) and as high as its pace. */
export function lapBlocks(ctx: Pick<Context, "axis" | "end" | "units">, laps: readonly ActivityLap[]): NonNullable<SeriesChart["blocks"]> {
	const out: NonNullable<SeriesChart["blocks"]> = [];
	let at = 0;
	for (const lap of laps) {
		const from = at;
		at += ctx.axis === "distance" ? lap.distance : lap.duration;
		if ((lap.speed ?? 0) > 0) out.push({ from: clamp01(from / ctx.end), to: clamp01(at / ctx.end), value: paceOf(lap.speed!, ctx.units) });
	}
	return out;
}

/**
 * The Heart Rate Zones line's colour stops, by bpm, from the zones' floors
 * (Inferred: fitted to the shot's colours, 132 bpm teal, 142 green, 150–168
 * blending to orange by 175; the floors alone run ahead of the shot from 150).
 */
export function zoneStops(zones: readonly ZoneTime[]): Array<{ value: number; colour: ChartColour }> | null {
	const floors = [1, 2, 3, 4, 5].map((n) => zones.find((z) => z.zone === n)?.floor);
	if (!floors.every(isNumber)) return null;
	const [f1, f2, f3, f4, f5] = floors as [number, number, number, number, number];
	return [
		{ value: f1, colour: "sky" },
		{ value: f2, colour: "blue" },
		{ value: f3, colour: "green" },
		{ value: (f4 + f5) / 2, colour: "orange" },
		{ value: f5, colour: "orange" },
		{ value: f5 + (f5 - f4) / 2, colour: "red" },
	];
}

/* ------------------------------------------------------------------ */
/*  Training Effect, Run/Walk, zones                                   */
/* ------------------------------------------------------------------ */

function trainingEffect(ctx: Pick<Context, "detail" | "spec">): TrainingEffectChart | null {
	const aerobic = num(ctx.detail.summary.trainingEffect);
	if (aerobic === undefined) return null;
	const anaerobic = num(ctx.detail.summary.anaerobicTrainingEffect);
	const scales: TrainingEffectChart["scales"] = [];
	const figures: ChartFigure[] = [];
	const add = (label: "Aerobic" | "Anaerobic", raw: number | undefined) => {
		if (raw === undefined) return;
		// The knob and its colour follow the number shown: 4.3000002 reads 4.3.
		const value = round(Math.max(0, Math.min(TE_MAX, raw)), 1);
		const colour = teColour(value);
		scales.push({ label, value, colour });
		figures.push({ value: value.toFixed(1), label, dot: colour });
	};
	add("Aerobic", aerobic);
	add("Anaerobic", anaerobic);
	return { kind: "training-effect", id: "training-effect", title: "Training Effect", help: helpOf("training-effect", ctx.spec), figures, scales };
}

/** A value's segment colour: [0, 2) grey, [2, 3) blue, [3, 4) green, [4, 5) orange, 5 red (4.0 sits inside orange). */
export function teColour(value: number): ChartColour {
	if (value >= TE_MAX) return TE_CAP;
	return TE_SEGMENTS[Math.max(0, Math.min(TE_SEGMENTS.length - 1, Math.floor(value)))];
}

const LANES: RunWalkChart["lanes"] = [
	{ lane: "idle", label: "Idle", colour: "yellow" },
	{ lane: "walk", label: "Walk", colour: "green" },
	{ lane: "run", label: "Run", colour: "blue" },
];
const LANE_OF: Readonly<Record<string, RunWalkLane>> = { RWD_RUN: "run", RWD_WALK: "walk", RWD_STAND: "idle" };

interface RunWalkOptions {
	/** The landscape view runs its axis to the last sample and draws all six ticks, as its other charts do (Inferred). */
	landscape?: boolean;
}

/**
 * Run/Walk: Garmin's run/walk detection. Time mode runs to the summary's
 * duration (3,360.82 s gives 33:36 where 3,361 gives 33:37) and draws only the
 * first five ticks (why the last goes is unknown; Inferred). Segments are on
 * the clock: the samples map them to timer time or distance, so the pause
 * takes no width, nor do the zero-length segments inside it.
 */
function runWalk(ctx: Context, opts: RunWalkOptions = {}): RunWalkChart | null {
	const segments = ctx.detail.segments.filter((s) => LANE_OF[s.type]);
	if (!segments.length) return null;
	const total = (lane: RunWalkLane) => segments.filter((s) => LANE_OF[s.type] === lane).reduce((sum, s) => sum + s.duration, 0);
	const time = ctx.axis === "time";
	const end = time && !opts.landscape ? (num(ctx.detail.summary.duration) ?? ctx.end) : ctx.end;
	const map = clockMap(ctx.detail, time ? "time" : "distance");
	const bars: RunWalkChart["bars"] = [];
	for (const s of segments) {
		const from = clamp01(map(s.start) / end);
		const to = clamp01(map(s.end) / end);
		if (to > from) bars.push({ from, to, lane: LANE_OF[s.type] });
	}
	return {
		kind: "run-walk",
		id: "run-walk",
		title: "Run/Walk",
		help: helpOf("run-walk", ctx.spec),
		figures: [
			{ value: duration(total("run")), label: "Run Time" },
			{ value: duration(total("walk")), label: "Walk Time" },
		],
		lanes: LANES,
		bars,
		x: time ? timeAxis(0, end, opts.landscape ? TICKS : TICKS - 1) : distanceTicks({ ...ctx, end }),
		legend: [
			{ label: "Run", colour: "blue", kind: "dot" },
			{ label: "Walk", colour: "green", kind: "dot" },
			{ label: "Idle", colour: "yellow", kind: "dot" },
		],
	};
}

/** A clock second (since the start, pauses included) as timer time or distance, between the samples either side. */
export function clockMap(detail: ActivityDetail, column: "time" | "distance"): (clock: number) => number {
	const clock = detail.samples.clock ?? [];
	const value = detail.samples[column] ?? [];
	const pairs: Array<[number, number]> = [];
	for (let i = 0; i < clock.length; i += 1) {
		const c = clock[i];
		const v = value[i];
		if (isNumber(c) && isNumber(v)) pairs.push([c, v]);
	}
	return (at) => {
		if (!pairs.length) return column === "time" ? at : 0;
		if (at <= pairs[0][0]) return pairs[0][1];
		for (let i = 1; i < pairs.length; i += 1) {
			const [c1, v1] = pairs[i];
			if (at <= c1) {
				const [c0, v0] = pairs[i - 1];
				return c1 > c0 ? v0 + ((at - c0) / (c1 - c0)) * (v1 - v0) : v1;
			}
		}
		return pairs[pairs.length - 1][1];
	};
}

/**
 * Time in zones: the top zone first; "floor - next floor − 1 unit", "> floor −
 * 1" on top; the time to the second; the share floored, of the zones' sum (the
 * run's: its duration gives the same floors; Inferred) or of the activity's
 * time when the spec says so, and the bar filled to the floored share. Five
 * zones or seven (a ride's power), each named and coloured by the spec, the
 * run's names and `zone-<n>` by default.
 */
function zones(ctx: Context, kind: ZoneKind): ZonesChart | null {
	const list = kind === "hr" ? ctx.detail.hrZones : ctx.detail.powerZones;
	if (!list.length) return null;
	const names = ctx.spec.zoneNames?.[kind] ?? (kind === "hr" ? HR_ZONE_NAMES : POWER_ZONE_NAMES);
	const colours = ctx.spec.zoneColours?.[kind];
	const unit = kind === "hr" ? "bpm" : "Watts";
	const zoned = list.reduce((a, z) => a + z.seconds, 0);
	const sum = ctx.spec.zoneTotal === "duration" ? (num(ctx.detail.summary.duration) ?? zoned) : zoned;
	const rows: ZoneRow[] = [...list]
		.sort((a, b) => b.zone - a.zone)
		.map((z) => {
			const next = list.find((n) => n.zone === z.zone + 1)?.floor;
			const range = typeof z.floor !== "number" ? "" : typeof next === "number" ? `${z.floor} - ${next - 1} ${unit}` : `> ${z.floor - 1} ${unit}`;
			const share = sum > 0 ? Math.floor((100 * z.seconds) / sum + 1e-9) : 0;
			return {
				zone: z.zone,
				title: `Zone ${z.zone}`,
				range,
				name: names[z.zone] ?? "",
				time: duration(z.seconds),
				percent: `${share}%`,
				fill: share / 100,
				colour: colours?.[z.zone] ?? (`zone-${Math.max(1, Math.min(7, z.zone))}` as ChartColour),
			};
		});
	const id: CardId = kind === "hr" ? "time-in-hr-zones" : "time-in-power-zones";
	return { kind: "zones", id, title: kind === "hr" ? "Time in Heart Rate Zones" : "Time in Power Zones", help: helpOf(id, ctx.spec), figures: [], rows };
}

/* ------------------------------------------------------------------ */
/*  The landscape (expanded) chart                                     */
/* ------------------------------------------------------------------ */

/**
 * The full-screen chart a route's `sub` opens: `chart:<base>`, with an overlay
 * `chart:<base>:<overlay>`, swapped `chart:<base>:<overlay>:swap`. The base is
 * the chart it was opened for (a Stats or Overview badge, `chart:<id>`): its
 * chips list the others, and stay put when the swap button puts the overlay on
 * the left axis.
 */
export interface ExpandedChartRef {
	base: ExpandedChartId;
	overlay: ChartMetric | null;
	swapped: boolean;
}

/**
 * A route's `sub` as a landscape chart, checked against the sport's charts of
 * samples (`ids`, its spec's chips; the run's by default): a base or an
 * overlay the sport doesn't chart reads as none.
 */
export function readChartSub(sub: string | undefined, ids: readonly ChartMetric[] = CHART_METRICS): ExpandedChartRef | null {
	if (!sub) return null;
	const isMetric = (value: string | undefined): value is ChartMetric => value !== undefined && ids.includes(value);
	const [head, base, overlay, swap, ...rest] = sub.split(":");
	if (head !== "chart" || rest.length || base === undefined || !(isMetric(base) || OTHER_BASES.includes(base))) return null;
	if (swap !== undefined && swap !== "swap") return null;
	if (overlay === undefined || !isMetric(overlay) || overlay === base) return { base, overlay: null, swapped: false };
	return { base, overlay, swapped: swap === "swap" };
}

export function chartSub(ref: ExpandedChartRef): string {
	if (!ref.overlay) return `chart:${ref.base}`;
	return `chart:${ref.base}:${ref.overlay}${ref.swapped ? ":swap" : ""}`;
}

export type OverlayMark = "line" | "dots" | "steps" | "zones" | "lanes";

/** The overlay on the right axis, in its own colour. */
export interface OverlaySeries {
	metric: ChartMetric;
	mark: OverlayMark;
	/** The line's colour and the right labels'. */
	colour: ChartColour;
	points: ChartPoints;
	/** Dots' band colours, or each dot's series colour; zones' colour stops. */
	colours?: Array<ChartColour | null>;
	stops?: Array<{ value: number; colour: ChartColour }>;
	/** The chart's own axis, labelled with five even values; a pace overlay with its top one only; lanes with none. */
	y: YAxis;
	/** Lanes along the plot's bottom (a ride's Position), in place of points. */
	lanes?: LaneSet;
	/** A sport's chart's key, under the axis title: a ride's Left and Right, Seated and Standing. */
	legend?: ChartKey[];
	/** An axis of its own the landscape then runs on: Position's, on the clock to the summary's duration. */
	x?: XAxis;
}

export interface ExpandedChartView {
	/** "Heart Rate", "Heart Rate & Cadence", swapped "Cadence & Heart Rate". */
	title: string;
	ref: ExpandedChartRef;
	/**
	 * The left axis: a chart of samples drawn as its card draws it, from 0 on
	 * the time axis; or the Run/Walk lanes, or Training Effect's scales, which
	 * a Stats badge opens too (their full-screen form is Inferred).
	 */
	primary: SeriesChart | RunWalkChart | TrainingEffectChart;
	/** With an overlay on, an area primary dims and loses its solid average line; dots keep theirs. */
	dim: boolean;
	secondary: OverlaySeries | null;
	/** Every other chart of samples the activity has, alphabetical; each chip's route `sub`. */
	chips: Array<{ metric: ChartMetric; label: string; selected: boolean; sub: string }>;
	/** The swap button's `sub`; null when there is nothing to swap. */
	swap: string | null;
	/** Null for Training Effect, which has no time axis. */
	x: XAxis | null;
}

/**
 * The overlays' colours (their line and right labels): heart rate #ff0035,
 * Grade-Adjusted Pace #54a9fe, elevation and GCT #60d275, cadence #ea670e,
 * as shot; the rest Inferred.
 */
const ACCENT: Readonly<Record<RunMetric, ChartColour>> = {
	pace: "blue",
	gap: "blue",
	"lap-pace": "blue",
	"heart-rate": "crimson",
	"heart-rate-zones": "crimson",
	elevation: "green",
	power: "purple",
	"power-per-kg": "purple",
	stamina: "orange",
	"performance-condition": "grey",
	cadence: "deep-orange",
	"stride-length": "blue",
	"vertical-ratio": "green",
	"vertical-oscillation": "green",
	"ground-contact-time": "green",
	"impact-load": "lavender",
};

/**
 * The landscape chart a route's `sub` opens, among the sport's charts (its
 * spec's chips; the run's by default). `extras` as for `chartsTabView`.
 */
export function expandedChartView(
	detail: ActivityDetail,
	route: Pick<ActivityRoute, "axis" | "sub">,
	units: Units,
	spec: ChartsSpec = RUN_CHARTS,
	extras: ChartExtras = {},
): ExpandedChartView | null {
	const ref = readChartSub(route.sub, spec.chips);
	const ctx = contextOf(detail, route.axis, units, spec, extras);
	if (!ref || !ctx) return null;
	if (ref.base === "training-effect") {
		// No overlay, no chips: the two scales, full-screen (Inferred: not shot).
		const te = trainingEffect(ctx);
		return te ? { title: te.title, ref: { base: ref.base, overlay: null, swapped: false }, primary: te, dim: false, secondary: null, chips: [], swap: null, x: null } : null;
	}
	const overlay = ref.overlay && hasMetric(detail, ref.overlay, spec) ? ref.overlay : null;
	// Run/Walk's lanes have no value axis to move to the right: it never swaps (Inferred).
	const swapped = overlay !== null && ref.swapped && ref.base !== "run-walk";
	let primary: SeriesChart | RunWalkChart | null;
	let right: ChartMetric | null;
	if (ref.base === "run-walk") {
		primary = runWalk(ctx, { landscape: true });
		right = overlay;
	} else {
		if (!hasMetric(detail, ref.base, spec)) return null;
		const left = swapped ? overlay : ref.base;
		primary = seriesChart(ctx, cardFor(left, spec), left, { fromZero: true });
		right = swapped ? ref.base : overlay;
	}
	if (!primary) return null;
	const dim = right !== null && (primary.kind === "run-walk" || primary.mark !== "dots");
	if (dim && primary.kind === "series" && primary.average && !primary.average.dashed) delete primary.average;
	const now: ExpandedChartRef = { base: ref.base, overlay, swapped };
	const chips = availableMetrics(detail, spec)
		.filter((m) => m !== ref.base)
		.map((metric) => ({
			metric,
			label: chipTitleOf(metric, spec),
			selected: metric === overlay,
			// Tapping the chip on again clears it (Inferred); another chip starts unswapped.
			sub: chartSub(metric === overlay ? { base: ref.base, overlay: null, swapped: false } : { base: ref.base, overlay: metric, swapped: false }),
		}))
		.sort((a, b) => a.label.localeCompare(b.label, "en"));
	const leftTitle = primary.kind === "run-walk" ? primary.title : chipTitleOf(primary.metric, spec);
	const secondary = right ? overlaySeries(ctx, right) : null;
	return {
		title: right ? `${leftTitle} & ${chipTitleOf(right, spec)}` : leftTitle,
		ref: now,
		primary,
		dim,
		secondary,
		chips,
		swap: overlay && ref.base !== "run-walk" ? chartSub({ ...now, swapped: !swapped }) : null,
		// An overlay on an axis of its own runs the landscape on it: Position's 57:21 where the samples end at 57:20.
		x: secondary?.x ?? primary.x,
	};
}

function overlaySeries(ctx: Context, metric: ChartMetric): OverlaySeries | null {
	const chart = seriesChart(ctx, cardFor(metric, ctx.spec), metric, { fromZero: true });
	if (!chart) return null;
	const def = specMetric(ctx.spec, metric);
	if (chart.mark === "lanes") {
		// Lanes have no value axis: no right labels.
		const lanes: OverlaySeries = { metric, mark: "lanes", colour: accentOf(metric, ctx.spec), points: chart.points, y: { bottom: 0, top: 1, labels: [] }, x: chart.x };
		if (chart.lanes) lanes.lanes = chart.lanes;
		if (chart.legend) lanes.legend = chart.legend;
		return lanes;
	}
	const zoned = metric === "heart-rate-zones" || (def !== undefined && chart.stops !== undefined);
	const mark: OverlayMark = chart.mark === "dots" ? "dots" : zoned ? "zones" : chart.mark === "steps" || chart.mark === "blocks" ? "steps" : "line";
	const pacey = metric === "pace" || metric === "gap" || metric === "lap-pace" || def?.pace === true;
	const override = isRunMetric(metric) ? own(ctx.spec.runOverrides, metric) : undefined;
	// A fixed window keeps its own labels where five even ones would miss them (Peak Power Phase's 0 45 90 135).
	const keep = def ? def.keepLabels : override?.keepLabels;
	const all = keep ? chart.y.labels : forcedLabels(chart.y.bottom, chart.y.top, pacey ? (v) => duration(v) : forcedFormat(metric, ctx.spec));
	// A pace overlay shows only its top label ("4:13"): unexplained, as shot.
	const y: YAxis = { bottom: chart.y.bottom, top: chart.y.top, labels: pacey ? all.slice(0, 1) : all };
	const points = (metric === "lap-pace" || def !== undefined) && chart.blocks ? blockSteps(chart.blocks) : chart.points;
	const out: OverlaySeries = { metric, mark, colour: accentOf(metric, ctx.spec), points, y };
	if (chart.colours) out.colours = chart.colours;
	if (chart.stops) out.stops = chart.stops;
	// A sport's chart keeps its key as an overlay (the ride's Left and Right); the run's overlays stay as they were.
	if ((def || override?.keepKey) && chart.legend) out.legend = chart.legend;
	return out;
}

/** The overlays' right labels: whole numbers rounded half-even, with decimals where the unit is small. */
function forcedFormat(metric: ChartMetric, spec: ChartsSpec): (v: number) => string {
	if (metric === "stride-length" || metric === "power-per-kg") return (v) => roundHalfEven(v, 2).toFixed(2);
	if (metric === "impact-load") return (v) => roundHalfEven(v, 1).toFixed(1);
	return specMetric(spec, metric)?.overlayLabels ?? ((v) => plain(roundHalfEven(v, 0), 0));
}

/** Blocks as a step line: each block's value held across its span. */
export function blockSteps(blocks: NonNullable<SeriesChart["blocks"]>): ChartPoints {
	const x: number[] = [];
	const y: Array<number | null> = [];
	for (const b of blocks) {
		x.push(b.from, b.to);
		y.push(b.value, b.value);
	}
	return { x, y };
}

/** The card a chart belongs to. */
function cardFor(metric: ChartMetric, spec: ChartsSpec): CardId {
	switch (metric) {
		case "gap":
		case "lap-pace":
			return "pace";
		case "heart-rate-zones":
			return "heart-rate";
		case "power-per-kg":
			return "power";
		default:
			return specMetric(spec, metric)?.card ?? metric;
	}
}

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
	return n === undefined ? undefined : String(Math.round(n));
}

function fixed(value: number, places: number): string {
	return round(value, places).toFixed(places);
}

function round(value: number, places: number): number {
	const f = 10 ** places;
	return Math.round(value * f) / f;
}

/** Half away from zero: -21.8 m reads -22, and -21.5 too. */
export function roundHalfAway(value: number): number {
	return Math.sign(value) * Math.round(Math.abs(value)) + 0;
}

/** Half to even, as iOS's NumberFormatter rounds: 252.5 → 252, 151.5 → 152. */
export function roundHalfEven(value: number, places = 0): number {
	const f = 10 ** places;
	const x = value * f;
	const r = Math.round(x);
	if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) return (r - 1) / f;
	return r / f;
}

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}
