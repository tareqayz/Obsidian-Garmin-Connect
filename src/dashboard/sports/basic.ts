import type { ActivityDetail } from "../../sync/activity-detail";
import { glyphOf, type Units } from "../activities";
import { RUN_CHARTS, type CardId, type ChartsSpec } from "../activity-chart-pages";
import { distanceHero, groupLink, timeHero, type OverviewFigure, type OverviewLink } from "../activity-overview";
import {
	bodyBatteryRows,
	distanceParts,
	elevationOf,
	elevationRows,
	fixed,
	heartRateRows,
	intensityRows,
	LAP_WIDTHS,
	lapTime,
	MPH_PER_MS,
	nutritionRows,
	numberOf,
	paceOf,
	paceUnit,
	respirationRows,
	rows,
	RUN_STATS,
	speedOf,
	stat,
	summaryOf,
	timeOf,
	trainingEffectRows,
	whole,
	type Get,
	type LapsRow,
	type LapsView,
	type StatsRow,
	type StatsTableRow,
} from "../activity-stats-pages";
import type { SportProfile } from "../activity-sports";

/**
 * The basic page: every sport without a page of its own (strength, yoga,
 * cardio, the stair stepper, walking, hiking …) gets the run page's shared
 * sections, each only with data, laid out as Garmin's Stair Stepper
 * (`ref/activity-details/basic`: activity 90000000007, shots 1163–1169).
 *
 * Garmin's oddities are kept, as the plan asks: a standstill reads "0:00 /km"
 * and "0.0 km/h", and an ascent it didn't measure "-- m". A sport Garmin sends
 * no speed for at all (yoga, strength …: no shot, Inferred) drops the speed
 * and ascent figures, which would mean nothing, and its laps read Lap · Time.
 *
 * Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

/** The big figure: the distance when there is one, else the total time ("34:52"). */
function hero(detail: ActivityDetail, units: Units) {
	return distanceHero(detail, units) ?? timeHero(detail);
}

/**
 * Avg Speed, Avg Heart Rate (with its chart badge), Total Ascent and Total
 * Calories: the Stair Stepper's four. Total Ascent reads "--" when Garmin
 * sent a speed but no ascent, as the Stair Stepper's; without either, as a
 * yoga session's, it is left out (Inferred).
 */
function figures(detail: ActivityDetail, units: Units): OverviewFigure[] {
	const v = summaryOf(detail);
	const imperial = units === "imperial";
	const out: OverviewFigure[] = [];
	const speed = speedText(v("averageSpeed"), units);
	if (speed !== undefined) out.push({ value: speed, unit: imperial ? "mph" : "km/h", label: "Avg Speed" });
	const hr = whole(v("averageHR"));
	if (hr !== undefined) out.push({ value: hr, unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" });
	const ascent = elevationOf(v("elevationGain"), units);
	if (ascent !== undefined || speed !== undefined) out.push({ value: ascent ?? "--", unit: imperial ? "ft" : "m", label: "Total Ascent" });
	const kcal = v("calories");
	if (kcal !== undefined) out.push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	return out;
}

/**
 * The activity's group, drawn with the activity's own figure, as the phone
 * draws "All Gym & Fitness Equipment Activities" with the stair stepper. No
 * records row; the phone's "<Sport> Reports" is left out, as on the run's page.
 */
function links(detail: ActivityDetail): OverviewLink[] {
	return [groupLink(detail, glyphOf(detail))];
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

/** The shared sections in the phone's order, each only with data (Elevation and Respiration from the run's order, Inferred). */
function table(detail: ActivityDetail, units: Units): StatsTableRow[] {
	const v = summaryOf(detail);
	return [
		["pace", "Pace", paceRows(v, units)],
		["speed", "Speed", speedRows(v, units)],
		["timing", "Timing", timingRows(v)],
		["heart-rate", "Heart Rate", heartRateRows(v)],
		["training-effect", "Training Effect", trainingEffectRows(detail, v)],
		["elevation", "Elevation", elevationRows(v, units)],
		["nutrition", "Nutrition & Hydration", nutritionRows(v, units)],
		["respiration", "Respiration Rate", respirationRows(v)],
		["intensity-minutes", "Intensity Minutes", intensityRows(v)],
		["body-battery", "Body Battery", bodyBatteryRows(v)],
	];
}

/** Avg Pace even at a standstill ("0:00 /km"), the rest only with a pace; no chart badge, as the Stair Stepper's has none. */
function paceRows(v: Get, units: Units): StatsRow[] {
	const unit = paceUnit(units);
	return rows(
		stat("Avg Pace", paceText(v("averageSpeed"), units), unit),
		stat("Avg Moving Pace", paceOf(v("averageMovingSpeed"), units), unit),
		stat("Avg Grade-Adj Pace", paceOf(v("avgGradeAdjustedSpeed"), units), unit),
		stat("Best Pace", paceOf(v("maxSpeed"), units), unit),
	);
}

/** Avg Speed even at a standstill ("0.0 km/h"), the rest only when moving. */
function speedRows(v: Get, units: Units): StatsRow[] {
	const unit = units === "imperial" ? "mph" : "km/h";
	return rows(
		stat("Avg Speed", speedText(v("averageSpeed"), units), unit),
		stat("Avg Moving Speed", speedOf(v("averageMovingSpeed"), units), unit),
		stat("Avg Grade-Adj Speed", speedOf(v("avgGradeAdjustedSpeed"), units), unit),
		stat("Max Speed", speedOf(v("maxSpeed"), units), unit),
	);
}

/** Total and Elapsed Time; Moving Time only when there was some (the Stair Stepper's is 0 and not shown). */
function timingRows(v: Get): StatsRow[] {
	const moving = v("movingDuration");
	return rows(
		stat("Total Time", timeOf(v("duration"))),
		stat("Moving Time", moving !== undefined && moving > 0 ? timeOf(moving) : undefined),
		stat("Elapsed Time", timeOf(v("elapsedDuration"))),
	);
}

/* ------------------------------------------------------------------ */
/*  Laps                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lap · Time · Distance · Avg Speed, every lap, then the bold Total row the
 * Stair Stepper's table ends with ("0.00" km at "0.0" km/h, as Garmin's). An
 * activity Garmin sends neither a distance nor a speed for reads Lap · Time
 * only (Inferred: no shot).
 */
function laps(detail: ActivityDetail, units: Units): LapsView {
	const imperial = units === "imperial";
	const v = summaryOf(detail);
	const moving = v("averageSpeed") !== undefined || (v("distance") ?? 0) > 0;
	const out: LapsRow[] = detail.laps.map((lap) => ({
		key: String(lap.n),
		cells: [String(lap.n), lapTime(lap.duration), distanceParts(lap.distance, units)[0], speedText(lap.speed ?? speedOver(lap.distance, lap.duration), units) ?? "--"],
	}));
	if (out.length) {
		const seconds = v("duration") ?? detail.laps.reduce((sum, lap) => sum + lap.duration, 0);
		const metres = v("distance") ?? detail.laps.reduce((sum, lap) => sum + lap.distance, 0);
		const speed = v("averageSpeed") ?? speedOver(metres, seconds);
		out.push({ key: "total", kind: "total", cells: ["Total", lapTime(seconds), distanceParts(metres, units)[0], speedText(speed, units) ?? "--"] });
	}
	const columns = [
		{ label: "Lap", width: LAP_WIDTHS[0] },
		{ label: "Time", width: LAP_WIDTHS[1] },
		{ label: "Distance", unit: imperial ? "mi" : "km", width: LAP_WIDTHS[2] },
		{ label: "Avg Speed", unit: imperial ? "mph" : "km/h", width: LAP_WIDTHS[3] },
	];
	if (moving) return { columns, rows: out };
	return { columns: columns.slice(0, 2), rows: out.map((row) => ({ ...row, cells: row.cells.slice(0, 2) })) };
}

/* ------------------------------------------------------------------ */
/*  Charts                                                             */
/* ------------------------------------------------------------------ */

/** The cards of an activity that went nowhere: the Stair Stepper's three, and Elevation with data. */
const STILL: readonly CardId[] = ["heart-rate", "training-effect", "elevation", "time-in-hr-zones"];

/**
 * The run's heart-rate axis (0.98 × the least, 0.443 of the span over the
 * most) labelled by the swims' and the basic page's rule, the smallest 1, 2
 * or 5 × 10ⁿ with at most 5.5 steps: the Stair Stepper's 81.3–197.0 bpm reads
 * "200 150 100", where the run's step for four intervals would label it in
 * twenties.
 */
export const HEART_RATE_FIT: NonNullable<ChartsSpec["runOverrides"]> = {
	"heart-rate": { axis: { pad: 0.443, step: "fit" } },
	"heart-rate-zones": { axis: { pad: 0.443, step: "fit" } },
};

/**
 * Heart Rate (with its Heart Rate | Heart Rate Zones picker), Training Effect
 * and Time in Heart Rate Zones, as the Stair Stepper's; Pace and Elevation
 * only for an activity that moved and has them (Inferred: no walk shot). Its
 * zones' shares are of the activity's time: 4:08, 2:09 and 28:03 of 34:52 read
 * 11, 6 and 80%; its Zone 1 is Garmin's white (sampled at (25, 733) pt),
 * which the page draws in the theme's text colour.
 */
const CHARTS: ChartsSpec = {
	cards: (detail) => ((numberOf(detail.summary.averageSpeed) ?? 0) > 0 ? ["pace", ...STILL] : STILL),
	chips: ["pace", "heart-rate", "heart-rate-zones", "elevation"],
	pickers: { pace: RUN_CHARTS.pickers.pace, "heart-rate": RUN_CHARTS.pickers["heart-rate"] },
	zoneTotal: "duration",
	zoneColours: { hr: { 1: "text" } },
	runOverrides: HEART_RATE_FIT,
};

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/** m/s as km/h or mph to 0.1, a standstill too: Garmin's "0.0 km/h". */
function speedText(speed: number | undefined, units: Units): string | undefined {
	return speed === undefined || speed < 0 ? undefined : fixed(speed * (units === "imperial" ? MPH_PER_MS : 3.6), 1);
}

/** m/s as a pace, a standstill too: Garmin's "0:00 /km". */
function paceText(speed: number | undefined, units: Units): string | undefined {
	if (speed === undefined || speed < 0) return undefined;
	return speed === 0 ? "0:00" : paceOf(speed, units);
}

function speedOver(metres: number, seconds: number): number | undefined {
	return seconds > 0 ? metres / seconds : undefined;
}

export const BASIC: SportProfile = {
	id: "basic",
	overview: { hero, figures, links },
	stats: { table, help: RUN_STATS.help },
	laps: { table: laps, pinnedHeader: true },
	charts: CHARTS,
};
