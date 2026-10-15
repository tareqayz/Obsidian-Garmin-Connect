import type { ActivityDetail } from "../../sync/activity-detail";
import { glyphOf, type Units } from "../activities";
import { RUN_CHARTS, type ChartsSpec, type PickerDef } from "../activity-chart-pages";
import type { MapSpec } from "../activity-map";
import { groupLink, timeHero, type OverviewFigure, type OverviewHero, type OverviewLink } from "../activity-overview";
import {
	bodyBatteryRows,
	fixed,
	heartRateRows,
	intensityRows,
	LAP_WIDTHS,
	lapTime,
	numberOf,
	nutritionRows,
	rows,
	speedOf,
	stat,
	summaryOf,
	timeOf,
	timingRows,
	trainingEffectRows,
	whole,
	type Get,
	type LapsRow,
	type LapsSpec,
	type LapsView,
	type StatsRow,
	type StatsTableRow,
} from "../activity-stats-pages";
import type { SportProfile } from "../activity-sports";
import {
	degrees,
	degreeUnit,
	fifthsAxis,
	inUnit,
	LENGTH_PACE,
	LENGTH_STROKES,
	LENGTH_SWOLF,
	perHundred,
	poolPlaces,
	SAMPLE_PACE,
	stepsAxis,
	STROKE_RATE,
	swimPace,
	swimUnit,
	TEMPERATURE,
	type SwimUnit,
} from "../swim-metrics";
import { HEART_RATE_FIT } from "./basic";

/**
 * The two swims' pages (ref/activity-details/pool-swim and open-water-swim:
 * activities 24362982767 and 20780627494, shots 1149–1162 and 1170–1181),
 * the run's five tabs with a swimmer's sections.
 *
 * - A pool swim has no map. Its laps are an "Int" table with every rest a
 *   numbered row, and its Pace, Strokes and Swolf charts are its lengths,
 *   one bar each, on both axes; its heart rate on the Distance axis is one
 *   point a length (`poolPlaces`).
 * - An open-water swim has a plain red route with the weather, and the run's
 *   areas over its samples: Pace, Strokes (its stroke rate), Temperature.
 * - Both read the pool's unit (else the page's), paces per 100, Total Time
 *   first among the figures, zones as shares of the activity's time with
 *   Garmin's white Zone 1 in the theme's text colour, heart rate labelled by
 *   the 5.5 rule, and a laps header that stays put while the rows scroll.
 *
 * The charts' own rules live in `swim-metrics.ts`. Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

/** The distance swum, whole and grouped in the swim's unit ("1,100" "m"); a swim without one shows its time. */
function hero(detail: ActivityDetail, units: Units): OverviewHero | null {
	const metres = numberOf(detail.summary.distance);
	if (metres === undefined || !(metres > 0)) return timeHero(detail);
	const unit = swimUnit(detail, units);
	return { value: fixed(inUnit(metres, unit), 0), unit, label: "Distance" };
}

/** Total Time, Avg Pace per 100 (its badge opens Pace), Avg Heart Rate (its badge) and Total Calories: the swims' order, not the run's. */
function figures(detail: ActivityDetail, units: Units): OverviewFigure[] {
	const v = summaryOf(detail);
	const unit = swimUnit(detail, units);
	const out: OverviewFigure[] = [];
	const time = timeOf(v("duration"));
	if (time !== undefined) out.push({ value: time, label: "Total Time" });
	const pace = paceOf(v("averageSpeed"), unit);
	if (pace !== undefined) out.push({ value: pace, unit: perHundred(unit), label: "Avg Pace", chart: "swim-pace" });
	const hr = whole(v("averageHR"));
	if (hr !== undefined) out.push({ value: hr, unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" });
	const kcal = v("calories");
	if (kcal !== undefined) out.push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	return out;
}

/** Swimming Personal Records, then All Swimming Activities with the activity's figure; the phone's "<Type> Reports" is left out, as on the run's page. */
function links(detail: ActivityDetail): OverviewLink[] {
	return [{ label: "Swimming Personal Records", icon: "medal", route: { page: "records", tab: "swimming" } }, groupLink(detail, glyphOf(detail))];
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

/** The sections with a HELP link: the pool's Calories has none, Nutrition & Hydration has. */
const SWIM_HELP = ["pace", "heart-rate", "training-effect", "nutrition"] as const;

/**
 * The pool's sections in the phone's order: Strokes first, Swimming Dynamics
 * holding Avg Swolf, and Calories where Garmin estimated no sweat loss. The
 * tab ends at Intensity Minutes when there is no Body Battery, as here.
 */
function poolTable(detail: ActivityDetail, units: Units): StatsTableRow[] {
	const v = summaryOf(detail);
	const unit = swimUnit(detail, units);
	return [
		["strokes", "Strokes", strokesRows(v, unit, { total: "strokes", swolf: false })],
		["pace", "Pace", paceRows(v, unit)],
		["speed", "Speed", speedRows(v, units, true)],
		["timing", "Timing", timingRows(v)],
		["heart-rate", "Heart Rate", heartRateRows(v)],
		["training-effect", "Training Effect", trainingEffectRows(detail, v)],
		["swimming-dynamics", "Swimming Dynamics", rows(stat("Avg Swolf", whole(v("averageSWOLF")), undefined, { chart: "swolf" }))],
		energy(v, units),
		["intensity-minutes", "Intensity Minutes", intensityRows(v)],
		["body-battery", "Body Battery", bodyBatteryRows(v)],
	];
}

/**
 * Open water's sections in the phone's order: Strokes after Training Effect,
 * holding Avg Swolf, and Temperature; Speed without Max Speed, though Garmin
 * sends it (its Best Pace shows it).
 */
function openWaterTable(detail: ActivityDetail, units: Units): StatsTableRow[] {
	const v = summaryOf(detail);
	const unit = swimUnit(detail, units);
	return [
		["pace", "Pace", paceRows(v, unit)],
		["speed", "Speed", speedRows(v, units, false)],
		["timing", "Timing", timingRows(v)],
		["heart-rate", "Heart Rate", heartRateRows(v)],
		["training-effect", "Training Effect", trainingEffectRows(detail, v)],
		["strokes", "Strokes", strokesRows(v, unit, { rate: "stroke-rate", swolf: true })],
		energy(v, units),
		["temperature", "Temperature", temperatureRows(v, units)],
		["intensity-minutes", "Intensity Minutes", intensityRows(v)],
		["body-battery", "Body Battery", bodyBatteryRows(v)],
	];
}

/** Paces per 100: Avg Pace (its badge opens Pace), Avg Moving Pace with one, and Best Pace, the summary's fastest. */
function paceRows(v: Get, unit: SwimUnit): StatsRow[] {
	const per = perHundred(unit);
	return rows(
		stat("Avg Pace", paceOf(v("averageSpeed"), unit), per, { chart: "swim-pace" }),
		stat("Avg Moving Pace", paceOf(v("averageMovingSpeed"), unit), per),
		stat("Best Pace", paceOf(v("maxSpeed"), unit), per),
	);
}

/** Speeds in the page's units: Avg Speed, Avg Moving Speed with one, and Max Speed where the swim shows it (the pool does, open water not). */
function speedRows(v: Get, units: Units, max: boolean): StatsRow[] {
	const unit = units === "imperial" ? "mph" : "km/h";
	return rows(
		stat("Avg Speed", speedOf(v("averageSpeed"), units), unit),
		stat("Avg Moving Speed", speedOf(v("averageMovingSpeed"), units), unit),
		max ? stat("Max Speed", speedOf(v("maxSpeed"), units), unit) : null,
	);
}

/** Where a swim's Strokes section puts its badge (and the chart it opens), and whether Avg Swolf ends it. */
interface StrokesLayout {
	/** The pool's: Total Strokes opens its Strokes bars. */
	total?: string;
	/** Open water's: Avg Stroke Rate opens its stroke rate. */
	rate?: string;
	swolf: boolean;
}

/**
 * Total Strokes, Avg Stroke Rate, Max Stroke Rate, Avg Strokes a length,
 * Avg Distance per Stroke (only above 0: the pool's is 0) and, on open
 * water, Avg Swolf; each only with Garmin's value.
 */
function strokesRows(v: Get, unit: SwimUnit, layout: StrokesLayout): StatsRow[] {
	const perLength = v("averageStrokes");
	const perStroke = v("averageStrokeDistance");
	return rows(
		stat("Total Strokes", whole(v("totalNumberOfStrokes")), undefined, layout.total ? { chart: layout.total } : {}),
		stat("Avg Stroke Rate", whole(v("averageSwimCadence")), "spm", layout.rate ? { chart: layout.rate } : {}),
		stat("Max Stroke Rate", whole(v("maxSwimCadence")), "spm"),
		stat("Avg Strokes", perLength !== undefined && perLength > 0 ? fixed(perLength, 1) : undefined, "/length"),
		stat("Avg Distance per Stroke", perStroke !== undefined && perStroke > 0 ? fixed(inUnit(perStroke, unit), 2) : undefined, unit),
		layout.swolf ? stat("Avg Swolf", whole(v("averageSWOLF"))) : null,
	);
}

/**
 * Calories: the run's Nutrition & Hydration (with its HELP) when Garmin
 * estimated a sweat loss, as open water's; else the pool's plain Calories,
 * whose total reads "Total Calories" and which has no HELP.
 */
function energy(v: Get, units: Units): StatsTableRow {
	if (v("waterEstimated") !== undefined) return ["nutrition", "Nutrition & Hydration", nutritionRows(v, units)];
	const total = v("calories");
	const resting = v("bmrCalories");
	return [
		"calories",
		"Calories",
		rows(
			stat("Resting Calories", whole(resting)),
			stat("Active Calories", total !== undefined && resting !== undefined ? whole(total - resting) : undefined),
			stat("Total Calories", whole(total)),
		),
	];
}

/** The water's temperature, whole degrees (27.96 → "28 °C"); Avg Temperature opens its chart. */
function temperatureRows(v: Get, units: Units): StatsRow[] {
	const unit = degreeUnit(units);
	const t = (key: string) => {
		const celsius = v(key);
		return celsius === undefined ? undefined : whole(degrees(celsius, units));
	};
	return rows(
		stat("Avg Temperature", t("averageTemperature"), unit, { chart: "temperature" }),
		stat("Min Temperature", t("minTemperature"), unit),
		stat("Max Temperature", t("maxTemperature"), unit),
	);
}

/* ------------------------------------------------------------------ */
/*  Laps                                                               */
/* ------------------------------------------------------------------ */

/**
 * Every lap a row, numbered in sequence, a pool's rests too: they read "0"
 * and "0:00" and are marked `rest` (the phone styles them as any other row).
 * Times to the tenth, ties up (23.75 → 0:23.8); distances whole and grouped;
 * paces per 100 from each lap's own speed. Then the bold Total: the summary's
 * time, distance and pace, which is the moving pace (1,100 m over the 19:32
 * moving: 1:46), not the time's.
 */
function lapsTable(first: string): LapsSpec["table"] {
	return (detail, units) => {
		const unit = swimUnit(detail, units);
		const out: LapsRow[] = detail.laps.map((lap) => {
			const row: LapsRow = { key: String(lap.n), cells: [String(lap.n), lapTime(lap.duration), fixed(inUnit(lap.distance, unit), 0), lapPace(lap.speed, lap.distance, lap.duration, unit)] };
			if (lap.rest) row.kind = "rest";
			return row;
		});
		if (out.length) {
			const v = summaryOf(detail);
			const seconds = v("duration") ?? detail.laps.reduce((sum, lap) => sum + lap.duration, 0);
			const metres = v("distance") ?? detail.laps.reduce((sum, lap) => sum + lap.distance, 0);
			out.push({ key: "total", kind: "total", cells: ["Total", lapTime(seconds), fixed(inUnit(metres, unit), 0), lapPace(v("averageSpeed"), metres, seconds, unit)] });
		}
		const view: LapsView = {
			columns: [
				{ label: first, width: LAP_WIDTHS[0] },
				{ label: "Time", width: LAP_WIDTHS[1] },
				{ label: "Distance", unit, width: LAP_WIDTHS[2] },
				{ label: "Avg Pace", unit: `min/100${unit}`, width: LAP_WIDTHS[3] },
			],
			rows: out,
		};
		return view;
	};
}

/** A lap's pace from its speed (time over distance without one); a rest's "0:00". */
function lapPace(speed: number | undefined, metres: number, seconds: number, unit: SwimUnit): string {
	const s = speed !== undefined && speed >= 0 ? speed : seconds > 0 ? metres / seconds : 0;
	return swimPace(s, unit) ?? "0:00";
}

/* ------------------------------------------------------------------ */
/*  Charts and map                                                     */
/* ------------------------------------------------------------------ */

/** Heart Rate's card picks Heart Rate or Heart Rate Zones, the run's sheet. */
const HEART_RATE_PICKER: Readonly<Record<string, PickerDef>> = { "heart-rate": RUN_CHARTS.pickers["heart-rate"]! };

/** The "?" the phone puts on Pace, Training Effect and the zones. */
const CHART_HELP = ["swim-pace", "training-effect", "time-in-hr-zones"];

/**
 * The pool's Charts: Pace, Strokes, Heart Rate, Training Effect, Swolf and
 * the zones, on both axes. Pace, Strokes and Swolf are its lengths' bars;
 * the samples sit on the Distance axis at their lengths' ends; the Distance
 * axis is equal fifths of the metres swum. The landscape chips (Inferred: not
 * shot) are the web's Zoom overlays, Heart Rate and its zones.
 */
const POOL_CHARTS: ChartsSpec = {
	cards: ["swim-pace", "strokes", "heart-rate", "training-effect", "swolf", "time-in-hr-zones"],
	chips: ["swim-pace", "strokes", "swolf", "heart-rate", "heart-rate-zones"],
	pickers: HEART_RATE_PICKER,
	metrics: { "swim-pace": LENGTH_PACE, strokes: LENGTH_STROKES, swolf: LENGTH_SWOLF },
	help: CHART_HELP,
	zoneTotal: "duration",
	zoneColours: { hr: { 1: "text" } },
	runOverrides: HEART_RATE_FIT,
	places: poolPlaces,
	distanceAxis: (end, units, detail) => fifthsAxis(end, swimUnit(detail, units)),
};

/**
 * Open water's Charts: Pace, Heart Rate, Training Effect, Strokes (the
 * stroke rate), Temperature and the zones, over its samples as the run's;
 * the Distance axis in metres, in nice steps. Chips as the pool's (Inferred).
 */
const OPEN_WATER_CHARTS: ChartsSpec = {
	cards: ["swim-pace", "heart-rate", "training-effect", "stroke-rate", "temperature", "time-in-hr-zones"],
	chips: ["swim-pace", "stroke-rate", "temperature", "heart-rate", "heart-rate-zones"],
	pickers: HEART_RATE_PICKER,
	metrics: { "swim-pace": SAMPLE_PACE, "stroke-rate": STROKE_RATE, temperature: TEMPERATURE },
	help: CHART_HELP,
	zoneTotal: "duration",
	zoneColours: { hr: { 1: "text" } },
	runOverrides: HEART_RATE_FIT,
	distanceAxis: (end, units, detail) => stepsAxis(end, swimUnit(detail, units)),
};

/**
 * A swim's route: one plain red line, no overlay to choose and no legend
 * (open water's; Map Settings' Data Overlay is Inferred, proposed without the
 * section). A pool swim has no route to draw.
 */
export const SWIM_ROUTE: MapSpec = {
	overlays: ["none"],
	overview: "none",
	defs: { none: { label: "None", ramp: [], legend: null } },
	base: "#ff0000",
};

/* ------------------------------------------------------------------ */

function paceOf(speed: number | undefined, unit: SwimUnit): string | undefined {
	return speed !== undefined && speed > 0 ? swimPace(speed, unit) : undefined;
}

const OVERVIEW = { hero, figures, links };

export const POOL_SWIM: SportProfile = {
	id: "pool-swim",
	overview: OVERVIEW,
	stats: { table: poolTable, help: SWIM_HELP },
	laps: { table: lapsTable("Int"), pinnedHeader: true },
	charts: POOL_CHARTS,
	map: SWIM_ROUTE,
};

export const OPEN_WATER_SWIM: SportProfile = {
	id: "open-water-swim",
	overview: OVERVIEW,
	stats: { table: openWaterTable, help: SWIM_HELP },
	laps: { table: lapsTable("Lap"), pinnedHeader: true },
	charts: OPEN_WATER_CHARTS,
	map: SWIM_ROUTE,
};
