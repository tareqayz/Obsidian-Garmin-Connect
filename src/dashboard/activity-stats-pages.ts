import type { ActivityDetail, ActivityGear, ActivityLap, ActivitySegment } from "../sync/activity-detail";
import { pace } from "../sync/metrics";
import { formatDistance, type Units } from "./activities";
import { primaryBenefit } from "./activity-labels";
import { duration } from "./series";

/**
 * The activity page's Stats, Laps and Gear tabs as data, from the activity's
 * file (`src/sync/activity-detail.ts`): Garmin's summary, its laps, its typed
 * splits and its gear. None of them needs the samples, so the three tabs draw
 * while the charts' samples are still loading, and after they failed.
 *
 * The rules are the phone's, measured on 2026-10-10 against an outdoor run
 * (ref/activity-details/outdoor-run), each proved by a value the alternatives
 * would show differently:
 *
 * - Distances: metres ÷ 1000 to 0.01 km (10,009 m → 10.01, a 9 m lap → 0.01).
 * - Paces: 1000 ÷ the speed in m/s, rounded to the second (335.80 s → 5:36,
 *   307.98 s → 5:08). A lap's pace is its own `averageSpeed`'s, not its time
 *   over its distance: lap 2's 343.52 s reads 5:44, where 343.48 s for 1 km
 *   would read 5:43.
 * - Speeds: m/s × 3.6 to 0.1 km/h (11.689 → 11.7).
 * - Times to the second (3,357.895 → 55:58, 3.776 → 0:04); lap times to the
 *   tenth (343.48 → 5:43.5, 2.664 → 0:02.7).
 * - Cadence, ground contact time, Exercise Load, calories and heart rate are
 *   whole (171.30 → 171, 256.90 → 257, 171.55 → 172); vertical ratio, vertical
 *   oscillation and Training Effect take one decimal (8.57 → 8.6); stride is
 *   cm ÷ 100 to two (104.16 → 1.04 m); elevation is whole, halves away from
 *   zero (-21.8 → -22).
 * - Intensity minutes total moderate + 2 × vigorous (0 + 2 × 56 = 112).
 *
 * Every decimal is rounded from the exact value, as Garmin's web rounds
 * (`toFixed`): a vertical ratio of 8.449999809 reads 8.4 there, where
 * multiplying by ten first would make it 8.5.
 *
 * A section shows only with data and no row stands in a 0 for a value Garmin
 * did not send, so a treadmill run has no Elevation, Impact Load or
 * grade-adjusted rows. Imperial reads miles, /mi, mph and feet through the
 * plugin's helpers; stride in feet, vertical oscillation in inches, step speed
 * loss in in/s and sweat loss in oz are Inferred (no imperial shots).
 *
 * What the run shows is the default. Another sport passes its `StatsSpec` and
 * `LapsSpec` (its profile's `stats` and `laps`), built from the row builders
 * and helpers exported below.
 *
 * Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

/**
 * A section: the run's are `pace`, `speed`, `timing`, `run-walk`,
 * `heart-rate`, `stamina`, `training-effect`, `power`, `running-dynamics`,
 * `impact-load`, `elevation`, `workout-intervals`, `nutrition`,
 * `respiration`, `intensity-minutes` and `body-battery`; a sport adds its own.
 */
export type StatsSectionId = string;

/**
 * The chart a row's blue waveform badge opens, as the expanded chart's id on
 * the route (`sub: "chart:<id>"`). The Overview's badges use the same ids
 * ("heart-rate", "pace"). The run's are `pace`, `gap`, `run-walk`,
 * `heart-rate`, `stamina`, `training-effect`, `power`, `cadence`,
 * `stride-length`, `vertical-ratio`, `vertical-oscillation`,
 * `ground-contact-time`, `impact-load` and `elevation`.
 */
export type StatsChartId = string;

/** A label on the left, its value on the right: "Avg Pace" · "5:36 /km". */
export interface StatsRow {
	label: string;
	/** "5:36", "Enabled", "Threshold". */
	value: string;
	/** "/km", "bpm", "%": none for times, scores and calories. */
	unit?: string;
	/** The value as the row reads it: "5:36 /km", "100%" (a percent sign takes no space). */
	text: string;
	/** A second line under the value: Primary Benefit's "(High Aerobic)". */
	sub?: string;
	/** The waveform badge after the label, and the chart it opens. */
	chart?: StatsChartId;
	/** Vigorous minutes count twice: the white "x2" disc after the value. */
	badge?: "x2";
}

export interface StatsSection {
	id: StatsSectionId;
	/** "Pace", "Run/Walk Detection": the phone sets the heading in capitals. */
	title: string;
	/** A blue HELP link at the heading's right. Its sheet is not captured yet (spec, Inferred 3). */
	help: boolean;
	rows: StatsRow[];
}

/** The nine sections whose heading has a HELP link on the phone. */
const HELP: ReadonlySet<StatsSectionId> = new Set<StatsSectionId>([
	"pace",
	"run-walk",
	"heart-rate",
	"stamina",
	"training-effect",
	"power",
	"running-dynamics",
	"impact-load",
	"nutrition",
]);

/** A section as a sport lists it: its id, its title, and its rows (none: the section is left out). */
export type StatsTableRow = readonly [id: StatsSectionId, title: string, rows: StatsRow[]];

/** The Stats tab of a sport: its profile's `stats`. The run's is `RUN_STATS`, the default. */
export interface StatsSpec {
	/** Every section the sport can show, in its order. */
	table: (detail: ActivityDetail, units: Units) => readonly StatsTableRow[];
	/** The sections whose heading has a HELP link. */
	help: readonly StatsSectionId[];
}

/**
 * The Stats tab: its sections in the sport's order (the run's by default, the
 * phone's), each only with data.
 */
export function statsView(detail: ActivityDetail, units: Units, spec: StatsSpec = RUN_STATS): StatsSection[] {
	const help = spec === RUN_STATS ? HELP : new Set(spec.help);
	return spec.table(detail, units)
		.filter(([, , rows]) => rows.length > 0)
		.map(([id, title, rows]) => ({ id, title, help: help.has(id), rows }));
}

/**
 * Sports Garmin paces: running, walking, hiking. Others (a ride opened from
 * All Activities) get speeds only (Inferred: only runs are specified). Only
 * the run's table asks; another sport's spec decides for itself.
 */
const PACED = /run|walk|hik|ruck/;

/** The run's sections in the phone's order. */
function runTable(detail: ActivityDetail, units: Units): StatsTableRow[] {
	const v: Get = (key) => numberOf(detail.summary[key]);
	const paced = !detail.type || PACED.test(detail.type);
	const sections: Array<[StatsSectionId, string, StatsRow[]]> = [
		["pace", "Pace", paced ? paceRows(v, units) : []],
		["speed", "Speed", speedRows(v, units)],
		["timing", "Timing", timingRows(v)],
		["run-walk", "Run/Walk Detection", runWalkRows(detail.segments)],
		["heart-rate", "Heart Rate", heartRateRows(v)],
		["stamina", "Stamina", staminaRows(v)],
		["training-effect", "Training Effect", trainingEffectRows(detail, v)],
		["power", "Power", powerRows(detail, v)],
		["running-dynamics", "Running Dynamics", dynamicsRows(v, units)],
		["impact-load", "Impact Load", impactLoadRows(v, units)],
		["elevation", "Elevation", elevationRows(v, units)],
		["workout-intervals", "Workout Intervals", intervalRows(detail.segments, units, paced)],
		["nutrition", "Nutrition & Hydration", nutritionRows(v, units)],
		// Treadmill only so far: the web lists it beside Nutrition & Hydration;
		// where the phone puts it is Inferred.
		["respiration", "Respiration Rate", respirationRows(v)],
		["intensity-minutes", "Intensity Minutes", intensityRows(v)],
		["body-battery", "Body Battery", bodyBatteryRows(v)],
	];
	return sections;
}

/** The run's Stats tab: its sixteen sections and the nine HELP links. */
export const RUN_STATS: StatsSpec = { table: runTable, help: [...HELP] };

/** A summary value by Garmin's key: a finite number, or undefined. */
export type Get = (key: string) => number | undefined;

/** The summary's numbers, as the row builders read them. */
export function summaryOf(detail: ActivityDetail): Get {
	return (key) => numberOf(detail.summary[key]);
}

export function paceRows(v: Get, units: Units): StatsRow[] {
	const unit = paceUnit(units);
	return rows(
		stat("Avg Pace", paceOf(v("averageSpeed"), units), unit, { chart: "pace" }),
		stat("Avg Moving Pace", paceOf(v("averageMovingSpeed"), units), unit),
		stat("Avg Grade-Adj Pace", paceOf(v("avgGradeAdjustedSpeed"), units), unit, { chart: "gap" }),
		stat("Best Pace", paceOf(v("maxSpeed"), units), unit),
	);
}

export function speedRows(v: Get, units: Units): StatsRow[] {
	const unit = units === "imperial" ? "mph" : "km/h";
	return rows(
		stat("Avg Speed", speedOf(v("averageSpeed"), units), unit),
		stat("Avg Moving Speed", speedOf(v("averageMovingSpeed"), units), unit),
		stat("Avg Grade-Adj Speed", speedOf(v("avgGradeAdjustedSpeed"), units), unit),
		stat("Max Speed", speedOf(v("maxSpeed"), units), unit),
	);
}

export function timingRows(v: Get): StatsRow[] {
	return rows(
		stat("Total Time", timeOf(v("duration"))),
		stat("Moving Time", timeOf(v("movingDuration"))),
		stat("Elapsed Time", timeOf(v("elapsedDuration"))),
	);
}

/**
 * Run, walk and idle time: each the sum of its typed splits (the summary's
 * `splitSummaries` give the same). The phone shows Idle Time 0:00 on a run
 * without any idle split; a run with no idle split at all (the treadmill's)
 * shows it the same way (Inferred: the web drops the row on both runs).
 */
export function runWalkRows(segments: readonly ActivitySegment[]): StatsRow[] {
	const detected = segments.filter((s) => s.type.startsWith("RWD_"));
	if (!detected.length) return [];
	const total = (type: string) => detected.filter((s) => s.type === type).reduce((sum, s) => sum + s.duration, 0);
	return rows(
		stat("Run Time", duration(total("RWD_RUN")), undefined, { chart: "run-walk" }),
		stat("Walk Time", duration(total("RWD_WALK"))),
		stat("Idle Time", duration(total("RWD_STAND"))),
	);
}

export function heartRateRows(v: Get): StatsRow[] {
	return rows(
		stat("Avg Heart Rate", whole(v("averageHR")), "bpm", { chart: "heart-rate" }),
		stat("Max Heart Rate", whole(v("maxHR")), "bpm"),
	);
}

export function staminaRows(v: Get): StatsRow[] {
	return rows(
		stat("Beginning Potential", whole(v("beginPotentialStamina")), "%", { chart: "stamina" }),
		stat("Ending Potential", whole(v("endPotentialStamina")), "%"),
		stat("Min Stamina", whole(v("minAvailableStamina")), "%"),
	);
}

/** Primary Benefit on two lines, "Threshold" over "(High Aerobic)"; both scores open the Training Effect chart. */
export function trainingEffectRows(detail: ActivityDetail, v: Get): StatsRow[] {
	const benefit = primaryBenefit(detail.summary.trainingEffectLabel);
	return rows(
		benefit ? { label: "Primary Benefit", value: benefit.name, text: benefit.label, ...(benefit.group ? { sub: `(${benefit.group})` } : {}) } : null,
		stat("Aerobic", decimals(v("trainingEffect"), 1), undefined, { chart: "training-effect" }),
		stat("Anaerobic", decimals(v("anaerobicTrainingEffect"), 1), undefined, { chart: "training-effect" }),
		stat("Exercise Load", whole(v("activityTrainingLoad"))),
	);
}

/** Wind Data only beside a power figure: without power there is no section to put it in. */
export function powerRows(detail: ActivityDetail, v: Get): StatsRow[] {
	const power = rows(stat("Avg Power", whole(v("averagePower")), "W", { chart: "power" }), stat("Max Power", whole(v("maxPower")), "W"));
	if (power.length && typeof detail.windData === "boolean") power.push(stat("Wind Data", detail.windData ? "Enabled" : "Disabled")!);
	return power;
}

/**
 * The phone's six rows, plus the treadmill run's GCT balance and step speed
 * loss in the web's order and format (Inferred on the phone): "49.1% L /
 * 50.9% R", "26.0 cm/s", "7.38%". The extras carry no badge (Inferred: their
 * charts are not specified).
 */
export function dynamicsRows(v: Get, units: Units): StatsRow[] {
	const imperial = units === "imperial";
	const stride = v("strideLength");
	const vo = v("verticalOscillation");
	const left = v("groundContactBalanceLeft");
	const loss = v("stepSpeedLoss");
	return rows(
		stat("Avg Run Cadence", whole(v("averageRunCadence")), "spm", { chart: "cadence" }),
		stat("Max Run Cadence", whole(v("maxRunCadence")), "spm"),
		stat(
			"Avg Stride Length",
			decimals(stride === undefined ? undefined : (stride / 100) * (imperial ? FEET_PER_METRE : 1), 2),
			imperial ? "ft" : "m",
			{ chart: "stride-length" },
		),
		stat("Avg Vertical Ratio", decimals(v("verticalRatio"), 1), "%", { chart: "vertical-ratio" }),
		stat("Avg Vertical Oscillation", decimals(vo === undefined ? undefined : imperial ? vo / CM_PER_INCH : vo, 1), imperial ? "in" : "cm", {
			chart: "vertical-oscillation",
		}),
		stat("Avg GCT Balance", left === undefined ? undefined : balance(left)),
		stat("Avg Ground Contact Time", whole(v("groundContactTime")), "ms", { chart: "ground-contact-time" }),
		stat("Avg Step Speed Loss", decimals(loss === undefined ? undefined : (loss * 100) / (imperial ? CM_PER_INCH : 1), 1), imperial ? "in/s" : "cm/s"),
		stat("Avg Step Speed Loss %", decimals(v("stepSpeedLossPercent"), 2), "%"),
	);
}

/** Left foot's share and the right's as the rest of 100: "49.1% L / 50.9% R". */
export function balance(left: number): string {
	const l = Number(left.toFixed(1));
	return `${fixed(l, 1)}% L / ${fixed(100 - l, 1)}% R`;
}

/** Impact Load beside the distance it is weighed against; none without the load (a treadmill run). */
export function impactLoadRows(v: Get, units: Units): StatsRow[] {
	const load = v("impactLoad");
	if (load === undefined) return [];
	return rows(distanceStat("Impact Load", load, units, { chart: "impact-load" }), distanceStat("Actual Distance", v("distance"), units));
}

export function elevationRows(v: Get, units: Units): StatsRow[] {
	const unit = units === "imperial" ? "ft" : "m";
	return rows(
		stat("Total Ascent", elevationOf(v("elevationGain"), units), unit, { chart: "elevation" }),
		stat("Total Descent", elevationOf(v("elevationLoss"), units), unit),
		stat("Min Elevation", elevationOf(v("minElevation"), units), unit),
		stat("Max Elevation", elevationOf(v("maxElevation"), units), unit),
	);
}

/**
 * The workout's active part, from the typed splits' INTERVAL_ACTIVE: its time,
 * its distance and the pace of its `averageSpeed`. Several active intervals (a
 * structured workout) add up, paced over their sum (Inferred: not shot).
 */
export function intervalRows(segments: readonly ActivitySegment[], units: Units, paced: boolean): StatsRow[] {
	const active = segments.filter((s) => s.type === "INTERVAL_ACTIVE");
	if (!active.length) return [];
	const seconds = active.reduce((sum, s) => sum + s.duration, 0);
	const metres = active.reduce((sum, s) => sum + s.distance, 0);
	const speed = (active.length === 1 ? active[0].speed : undefined) ?? (seconds > 0 ? metres / seconds : undefined);
	return rows(
		stat("Run Time", duration(seconds)),
		metres > 0 ? distanceStat("Run Distance", metres, units) : null,
		paced ? stat("Run Pace", paceOf(speed, units), paceUnit(units)) : null,
	);
}

/** Active calories are the total less the resting ones: 694 − 77 = 617. */
export function nutritionRows(v: Get, units: Units): StatsRow[] {
	const total = v("calories");
	const resting = v("bmrCalories");
	const sweat = v("waterEstimated");
	const imperial = units === "imperial";
	return rows(
		stat("Resting Calories", whole(resting)),
		stat("Active Calories", total !== undefined && resting !== undefined ? whole(total - resting) : undefined),
		stat("Total Calories Burned", whole(total)),
		stat("Est. Sweat Loss", whole(sweat === undefined ? undefined : imperial ? sweat / ML_PER_OUNCE : sweat), imperial ? "oz" : "ml"),
	);
}

/** The treadmill run's breathing rates, whole (35.66 → 36), as the web shows them. */
export function respirationRows(v: Get): StatsRow[] {
	return rows(
		stat("Avg Respiration Rate", whole(v("avgRespirationRate")), "brpm"),
		stat("Min Respiration Rate", whole(v("minRespirationRate")), "brpm"),
		stat("Max Respiration Rate", whole(v("maxRespirationRate")), "brpm"),
	);
}

/** Vigorous minutes count double towards the total, which the "x2" disc says. */
export function intensityRows(v: Get): StatsRow[] {
	const moderate = v("moderateIntensityMinutes");
	const vigorous = v("vigorousIntensityMinutes");
	if (moderate === undefined && vigorous === undefined) return [];
	return rows(
		stat("Moderate", whole(moderate), "min"),
		stat("Vigorous", whole(vigorous), "min", { badge: "x2" }),
		stat("Total", whole((moderate ?? 0) + 2 * (vigorous ?? 0)), "min"),
	);
}

/** Signed: "-19". A gain reads "+3" (Inferred), as the Body Battery page writes one. */
export function bodyBatteryRows(v: Get): StatsRow[] {
	const impact = v("differenceBodyBattery");
	if (impact === undefined) return [];
	const text = whole(impact)!;
	return rows(stat("Net Impact", Number(text) > 0 ? `+${text}` : text));
}

/* ------------------------------------------------------------------ */
/*  Stats in columns                                                   */
/* ------------------------------------------------------------------ */

/**
 * Heights off the Obsidian twin (Stats · Pane, Figma 414:2918): a section's
 * header band, a row, the two-line Primary Benefit row, and the gap between
 * two cards in a column.
 */
export const STATS_LAYOUT = { header: 41.67, row: 36, twoLine: 58, gap: 16 } as const;

export function sectionHeight(section: StatsSection): number {
	return section.rows.reduce<number>((height, row) => height + (row.sub !== undefined ? STATS_LAYOUT.twoLine : STATS_LAYOUT.row), STATS_LAYOUT.header);
}

/**
 * Where each column after the first starts when the sections fill `count`
 * columns in reading order: the cut whose tallest column is shortest, the
 * earliest of equals. The pane's three columns hold 5 · 4 · 6 sections of the
 * outdoor run, as the twin does; the page forces its column breaks there
 * rather than leave the split to the browser's balancing, which a third of a
 * point decides for this run.
 */
export function columnStarts(sections: readonly StatsSection[], count: number): number[] {
	const heights = sections.map(sectionHeight);
	const n = heights.length;
	const columns = Math.min(Math.max(1, Math.floor(count)), n);
	if (columns <= 1) return [];
	const span = (from: number, to: number) => heights.slice(from, to).reduce((sum, h) => sum + h, 0) + STATS_LAYOUT.gap * (to - from - 1);
	let tallestBest = Infinity;
	let startsBest: number[] = [];
	const cut = (from: number, left: number, starts: number[], tallest: number): void => {
		if (left === 1) {
			const height = Math.max(tallest, span(from, n));
			if (height < tallestBest - 1e-6) {
				tallestBest = height;
				startsBest = starts;
			}
			return;
		}
		for (let to = from + 1; to <= n - left + 1; to += 1) cut(to, left - 1, [...starts, to], Math.max(tallest, span(from, to)));
	};
	cut(0, columns, [], 0);
	return startsBest;
}

/* ------------------------------------------------------------------ */
/*  Laps                                                               */
/* ------------------------------------------------------------------ */

export interface LapsColumn {
	label: string;
	/** The grey unit under the label: "km", "min/km". */
	unit?: string;
	/** Its share of the row, in percent; each cell's text sits at its column's right edge. */
	width: number;
}

export interface LapsRow {
	/** Unique in the table: the lap's number, "total". */
	key: string;
	/** One per column, as shown: "2", "5:43.5", "1.00", "5:44". */
	cells: string[];
	/** A pool swim's rest between intervals, dimmed; the totals row, bold. A lap has none. */
	kind?: "rest" | "total";
}

export interface LapsView {
	/** The run's: Lap · Time · Distance (km) · Avg Pace (min/km). */
	columns: LapsColumn[];
	/** The run's: every lap, the short last one too, and no totals row. */
	rows: LapsRow[];
}

/** The Laps tab of a sport: its profile's `laps`. The run's is the default. */
export interface LapsSpec {
	table: (detail: ActivityDetail, units: Units) => LapsView;
	/** The header stays under the page's bar while the rows scroll, as the phone pins a pool swim's; the run's scrolls away. */
	pinnedHeader?: boolean;
}

/**
 * The run's columns' shares of the row (the twin's Lap Row, Figma 403:61):
 * their right edges sit at 12.25%, 38.37%, 66.98% and 96.01%.
 */
export const LAP_WIDTHS: readonly [lap: number, time: number, distance: number, last: number] = [12.25, 26.12, 28.61, 29.03];

export function lapsView(detail: ActivityDetail, units: Units, spec?: LapsSpec): LapsView {
	if (spec) return spec.table(detail, units);
	const imperial = units === "imperial";
	return {
		columns: [
			{ label: "Lap", width: LAP_WIDTHS[0] },
			{ label: "Time", width: LAP_WIDTHS[1] },
			{ label: "Distance", unit: imperial ? "mi" : "km", width: LAP_WIDTHS[2] },
			{ label: "Avg Pace", unit: imperial ? "min/mi" : "min/km", width: LAP_WIDTHS[3] },
		],
		rows: detail.laps.map((lap) => ({
			key: String(lap.n),
			cells: [String(lap.n), lapTime(lap.duration), distanceParts(lap.distance, units)[0], lapPace(lap, units) ?? "--"],
		})),
	};
}

/** Seconds to the tenth: "5:43.5", "0:02.7"; an hour or more "1:02:03.4" (Inferred). */
export function lapTime(seconds: number): string {
	const tenths = Math.round(Number(Math.max(0, seconds).toFixed(1)) * 10);
	const h = Math.floor(tenths / 36_000);
	const m = Math.floor((tenths % 36_000) / 600);
	const rest = `${String(Math.floor((tenths % 600) / 10)).padStart(2, "0")}.${tenths % 10}`;
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}

/** The lap's `averageSpeed` as a pace; time over distance only when Garmin sent no speed (Inferred). */
export function lapPace(lap: ActivityLap, units: Units): string | undefined {
	if (lap.speed !== undefined && lap.speed > 0) return paceOf(lap.speed, units);
	return pace(lap.distance, lap.duration, units);
}

/* ------------------------------------------------------------------ */
/*  Gear                                                               */
/* ------------------------------------------------------------------ */

export interface GearView {
	/** One row each: the name, and the type when Garmin gives one. */
	items: ActivityGear[];
	/** Nothing linked: the web's empty state, without its Add Gear button (the page is read-only). */
	empty: { title: string; text: string } | null;
}

/** The web's wording for an activity without gear (the phone's is not shot). */
export const NO_GEAR = { title: "No gear added", text: "Adding your gear to activities lets you track its use over time." } as const;

/** Gear linked to the activity. Until the gear block has loaded there is no empty state: nothing is known yet. */
export function gearView(detail: ActivityDetail): GearView {
	const loaded = detail.checked.includes("gear");
	return { items: detail.gear, empty: loaded && !detail.gear.length ? { ...NO_GEAR } : null };
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export const FEET_PER_METRE = 3.28084;
export const CM_PER_INCH = 2.54;
export const ML_PER_OUNCE = 29.5735;
export const MPH_PER_MS = 3600 / 1609.344;

export function rows(...items: Array<StatsRow | null>): StatsRow[] {
	return items.filter((row): row is StatsRow => row !== null);
}

/** A row, or null without a value. */
export function stat(label: string, value: string | undefined, unit?: string, extra: Pick<StatsRow, "chart" | "badge"> = {}): StatsRow | null {
	if (value === undefined) return null;
	const row: StatsRow = { label, value, text: unit ? `${value}${unit === "%" ? "" : " "}${unit}` : value, ...extra };
	if (unit) row.unit = unit;
	return row;
}

/** A distance row: "10.01" "km" through the plugin's `formatDistance`. */
export function distanceStat(label: string, metres: number | undefined, units: Units, extra: Pick<StatsRow, "chart"> = {}): StatsRow | null {
	if (metres === undefined) return null;
	const [value, unit] = distanceParts(metres, units);
	return stat(label, value, unit, extra);
}

/** "10.01 km" as ["10.01", "km"]. */
export function distanceParts(metres: number, units: Units): [string, string] {
	const text = formatDistance(metres, units, 2, true);
	const at = text.lastIndexOf(" ");
	return [text.slice(0, at), text.slice(at + 1)];
}

export function paceUnit(units: Units): string {
	return units === "imperial" ? "/mi" : "/km";
}

/** m/s as "5:36": the plugin's `pace` over one second's distance. */
export function paceOf(speed: number | undefined, units: Units): string | undefined {
	return speed !== undefined && speed > 0 ? pace(speed, 1, units) : undefined;
}

export function speedOf(speed: number | undefined, units: Units): string | undefined {
	return speed !== undefined && speed > 0 ? fixed(speed * (units === "imperial" ? MPH_PER_MS : 3.6), 1) : undefined;
}

export function timeOf(seconds: number | undefined): string | undefined {
	return seconds !== undefined && seconds >= 0 ? duration(seconds) : undefined;
}

/** Whole metres or feet, halves away from zero: -21.8 → "-22". */
export function elevationOf(metres: number | undefined, units: Units): string | undefined {
	return metres === undefined ? undefined : fixed(units === "imperial" ? metres * FEET_PER_METRE : metres, 0);
}

export function whole(value: number | undefined): string | undefined {
	return decimals(value, 0);
}

export function decimals(value: number | undefined, places: number): string | undefined {
	return value === undefined ? undefined : fixed(value, places);
}

/**
 * `value` to `places` decimals, rounded from its exact value with halves away
 * from zero (`toFixed`, as Garmin's web), grouped in thousands: "1,234.5".
 * Never "-0".
 */
export function fixed(value: number, places: number): string {
	let text = value.toFixed(places);
	if (/^-0(\.0+)?$/.test(text)) text = text.slice(1);
	const dot = text.indexOf(".");
	const integer = dot < 0 ? text : text.slice(0, dot);
	return integer.replace(/\B(?=(\d{3})+$)/g, ",") + (dot < 0 ? "" : text.slice(dot));
}

export function numberOf(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
