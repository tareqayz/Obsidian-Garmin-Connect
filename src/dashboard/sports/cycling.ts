import type { ActivityDetail } from "../../sync/activity-detail";
import { categoryFor, type Units } from "../activities";
import { PACE_RAMP, ROUTE_BASE, type MapSpec } from "../activity-map";
import { distanceHero, groupLink, timeHero, type OverviewFigure, type OverviewHero, type OverviewLink } from "../activity-overview";
import type { SportProfile } from "../activity-sports";
import {
	bodyBatteryRows,
	decimals,
	distanceParts,
	elevationOf,
	elevationRows,
	fixed,
	heartRateRows,
	intensityRows,
	LAP_WIDTHS,
	lapTime,
	nutritionRows,
	rows,
	speedOf,
	staminaRows,
	stat,
	summaryOf,
	timeOf,
	timingRows,
	trainingEffectRows,
	whole,
	type Get,
	type LapsRow,
	type LapsView,
	type StatsRow,
	type StatsSectionId,
	type StatsTableRow,
} from "../activity-stats-pages";
import { balanceShares, degrees, RIDE_CHARTS } from "../cycling-metrics";
import { POWER_RAMP } from "./cycling-palette";

/**
 * A ride's page (ref/activity-details/road-cycling/README.md; road cycling
 * 90000000033 with Rally power pedals, shots 1106–1147): the power-coloured
 * map, Distance over Total Time · Avg Speed · Total Ascent · Avg Power, the
 * sixteen Stats sections, Lap · Time · Distance · Avg Speed with a Total row,
 * and the twenty Charts cards (`cycling-metrics.ts`). Every cycling type
 * (`sportOf`) gets it, each section, row, card and figure only with data, so
 * a ride without a power meter loses Power, the cycling dynamics and the
 * power map (Inferred: not shot).
 *
 * The phone's rounding (the spec's "Rules"): speeds to 0.1 km/h, times to the
 * second and laps to the tenth, watts and degrees whole (67.5° → 68°),
 * Intensity Factor to three places and TSS to one, Work in kJ from Garmin's
 * kcal (125.536 × 4.1868 → 526), L/R Balance each side whole (49.27 → 49),
 * the position times' shares rounded (98.96 → 99%), pedal strokes grouped
 * (4,427).
 *
 * Pure: no Obsidian import.
 */

/* ------------------------------------------------------------------ */
/*  Overview                                                           */
/* ------------------------------------------------------------------ */

/** Distance, or the total time for a ride without one (an indoor ride with no speed sensor). */
function hero(detail: ActivityDetail, units: Units): OverviewHero | null {
	return distanceHero(detail, units) ?? timeHero(detail);
}

/**
 * Total Time (no badge), Avg Speed, Total Ascent and Avg Power, each badge
 * opening its chart. A ride without power shows Avg Heart Rate in Avg Power's
 * place (Inferred: not shot).
 */
function figures(detail: ActivityDetail, units: Units): OverviewFigure[] {
	const v = summaryOf(detail);
	const imperial = units === "imperial";
	const out: OverviewFigure[] = [];
	const time = timeOf(v("duration"));
	if (time !== undefined) out.push({ value: time, label: "Total Time" });
	const speed = speedOf(v("averageSpeed"), units);
	if (speed !== undefined) out.push({ value: speed, unit: imperial ? "mph" : "km/h", label: "Avg Speed", chart: "speed" });
	const ascent = elevationOf(v("elevationGain"), units);
	if (ascent !== undefined) out.push({ value: ascent, unit: imperial ? "ft" : "m", label: "Total Ascent", chart: "elevation" });
	const power = whole(v("averagePower"));
	const hr = whole(v("averageHR"));
	if (power !== undefined) out.push({ value: power, unit: "W", label: "Avg Power", chart: "power" });
	else if (hr !== undefined) out.push({ value: hr, unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" });
	return out;
}

/**
 * The cycling records and "All Cycling Activities" (the hub's cycling page, by
 * Garmin's filter group, as every sport's group link); "Road Cycling Reports"
 * is left out (no Reports page).
 */
function links(detail: ActivityDetail): OverviewLink[] {
	return [{ label: "Cycling Personal Records", icon: "medal", route: { page: "records", tab: "cycling" } }, groupLink(detail, categoryFor("cycling").glyph)];
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

/** Garmin's `totalWork` is in kcal; the phone shows kJ. */
const KJ_PER_KCAL = 4.1868;

/** The sixteen sections, top to bottom; no Pace on a ride. */
function table(detail: ActivityDetail, units: Units): StatsTableRow[] {
	const v = summaryOf(detail);
	return [
		["speed", "Speed", speedSection(v, units)],
		["timing", "Timing", timingRows(v)],
		["heart-rate", "Heart Rate", heartRateRows(v)],
		["stamina", "Stamina", staminaRows(v)],
		["training-effect", "Training Effect", trainingEffectRows(detail, v)],
		["power", "Power", powerSection(detail, v)],
		["nutrition", "Nutrition & Hydration", nutritionRows(v, units)],
		["cadence", "Cadence", cadenceSection(v)],
		["elevation", "Elevation", elevationRows(v, units)],
		["cd-time-in-position", "Cycling Dynamics - Time in Position", positionTimeSection(detail, v)],
		["cd-power-in-position", "Cycling Dynamics - Power in Position", positionPowerSection(v)],
		["cd-pp", "Cycling Dynamics - PP", phaseSection(v)],
		["cd-avg-pco", "Cycling Dynamics - Avg PCO", offsetSection(v)],
		["pedal-strokes", "Pedal Strokes", rows(stat("Total Pedal Strokes", whole(v("totalNumberOfStrokes"))))],
		["intensity-minutes", "Intensity Minutes", intensityRows(v)],
		["body-battery", "Body Battery", bodyBatteryRows(v)],
	];
}

/** The seven headings with a HELP link. */
const STATS_HELP: readonly StatsSectionId[] = ["heart-rate", "stamina", "training-effect", "nutrition", "cd-time-in-position", "cd-pp", "cd-avg-pco"];

/** Avg Speed (with its badge), Avg Moving Speed and Max Speed: a ride has no grade-adjusted speed. */
function speedSection(v: Get, units: Units): StatsRow[] {
	const unit = units === "imperial" ? "mph" : "km/h";
	return rows(
		stat("Avg Speed", speedOf(v("averageSpeed"), units), unit, { chart: "speed" }),
		stat("Avg Moving Speed", speedOf(v("averageMovingSpeed"), units), unit),
		stat("Max Speed", speedOf(v("maxSpeed"), units), unit),
	);
}

/**
 * The ride's nine power rows, from its power meter; none without one. Each
 * side's balance is rounded from the summary's own (49.27 / 50.73), FTP is
 * the setting the ride was recorded with (274 W, not today's).
 */
function powerSection(detail: ActivityDetail, v: Get): StatsRow[] {
	if (v("averagePower") === undefined && v("maxPower") === undefined) return [];
	const shares = balanceShares(detail);
	const work = v("totalWork");
	return rows(
		stat("Avg Power", whole(v("averagePower")), "W", { chart: "power" }),
		stat("Max Power", whole(v("maxPower")), "W"),
		stat("Max Avg Power (20 min.)", whole(v("maxPowerTwentyMinutes")), "W"),
		stat("L/R Balance", shares ? `${fixed(shares.left, 0)}% L / ${fixed(shares.right, 0)}% R` : undefined, undefined, { chart: "lr-balance" }),
		stat("Normalized Power (NP)", whole(v("normalizedPower")), "W"),
		stat("Intensity Factor (IF)", decimals(v("intensityFactor"), 3)),
		stat("Training Stress Score (TSS)", decimals(v("trainingStressScore"), 1)),
		stat("FTP Setting", whole(v("functionalThresholdPower")), "W"),
		stat("Work", work === undefined ? undefined : fixed(work * KJ_PER_KCAL, 0), "kJ"),
	);
}

function cadenceSection(v: Get): StatsRow[] {
	return rows(stat("Avg Bike Cadence", whole(v("averageBikeCadence")), "rpm", { chart: "bike-cadence" }), stat("Max Bike Cadence", whole(v("maxBikeCadence")), "rpm"));
}

/**
 * Seated and standing time, each with its share of their sum rounded
 * ("56:45 • 99%"; floored it would read 98). The badge opens Position, which
 * needs the ride's position events.
 */
function positionTimeSection(detail: ActivityDetail, v: Get): StatsRow[] {
	const seated = v("seatedTime");
	const standing = v("standingTime");
	const total = (seated ?? 0) + (standing ?? 0);
	if (!(total > 0)) return [];
	const line = (seconds: number | undefined) => (seconds === undefined ? undefined : `${timeOf(seconds)} • ${Math.round((100 * seconds) / total)}%`);
	const chart = detail.positions?.length ? { chart: "position" } : {};
	return rows(stat("Total Seated Time", line(seated), undefined, chart), stat("Total Standing Time", line(standing)));
}

function positionPowerSection(v: Get): StatsRow[] {
	return rows(
		stat("Avg Seated Power", whole(v("averageSeatedPower")), "W"),
		stat("Max Seated Power", whole(v("maxSeatedPower")), "W"),
		stat("Avg Standing Power", whole(v("averageStandingPower")), "W"),
		stat("Max Standing Power", whole(v("maxStandingPower")), "W"),
	);
}

/** "11° - 218°": each end whole. */
function arc(start: number | undefined, end: number | undefined): string | undefined {
	return start === undefined || end === undefined ? undefined : `${degrees(start)} - ${degrees(end)}`;
}

function angle(value: number | undefined): string | undefined {
	return value === undefined ? undefined : degrees(value);
}

/** The power phases and their peaks, each pedal's arc and its length; the left's two open their charts. */
function phaseSection(v: Get): StatsRow[] {
	return rows(
		stat("L Power Phase", arc(v("leftPowerPhaseStart"), v("leftPowerPhaseEnd")), undefined, { chart: "pp-start" }),
		stat("R Power Phase", arc(v("rightPowerPhaseStart"), v("rightPowerPhaseEnd"))),
		stat("L Power Phase Arc Length", angle(v("leftPowerPhaseArcLength"))),
		stat("R Power Phase Arc Length", angle(v("rightPowerPhaseArcLength"))),
		stat("L Peak Power Phase", arc(v("leftPowerPhasePeakStart"), v("leftPowerPhasePeakEnd")), undefined, { chart: "peak-pp-start" }),
		stat("R Peak Power Phase", arc(v("rightPowerPhasePeakStart"), v("rightPowerPhasePeakEnd"))),
		stat("L Peak Power Phase Arc Length", angle(v("leftPowerPhasePeakArcLength"))),
		stat("R Peak Power Phase Arc Length", angle(v("rightPowerPhasePeakArcLength"))),
	);
}

/** Each pedal's platform centre offset in whole mm, "0 mm" too (the Platform Offset card shows "--" for 0); mm in imperial too (Inferred). */
function offsetSection(v: Get): StatsRow[] {
	return rows(
		stat("L PCO", whole(v("leftPlatformCenterOffset")), "mm", { chart: "left-pco" }),
		stat("R PCO", whole(v("rightPlatformCenterOffset")), "mm", { chart: "right-pco" }),
	);
}

/* ------------------------------------------------------------------ */
/*  Laps                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lap · Time · Distance · Avg Speed, every lap from its own average speed
 * (lap 6's 7.091 m/s reads 25.5), then the bold Total row from the summary
 * (57:21.3, 27.51, 28.8).
 */
function laps(detail: ActivityDetail, units: Units): LapsView {
	const imperial = units === "imperial";
	const speed = (ms: number | undefined) => speedOf(ms, units) ?? "--";
	const out: LapsRow[] = detail.laps.map((lap) => ({
		key: String(lap.n),
		cells: [String(lap.n), lapTime(lap.duration), distanceParts(lap.distance, units)[0], speed(lap.speed ?? over(lap.distance, lap.duration))],
	}));
	if (out.length) {
		const v = summaryOf(detail);
		const seconds = v("duration") ?? detail.laps.reduce((sum, lap) => sum + lap.duration, 0);
		const metres = v("distance") ?? detail.laps.reduce((sum, lap) => sum + lap.distance, 0);
		out.push({ key: "total", kind: "total", cells: ["Total", lapTime(seconds), distanceParts(metres, units)[0], speed(v("averageSpeed") ?? over(metres, seconds))] });
	}
	return {
		columns: [
			{ label: "Lap", width: LAP_WIDTHS[0] },
			{ label: "Time", width: LAP_WIDTHS[1] },
			{ label: "Distance", unit: imperial ? "mi" : "km", width: LAP_WIDTHS[2] },
			{ label: "Avg Speed", unit: imperial ? "mph" : "km/h", width: LAP_WIDTHS[3] },
		],
		rows: out,
	};
}

function over(metres: number, seconds: number): number | undefined {
	return seconds > 0 ? metres / seconds : undefined;
}

/* ------------------------------------------------------------------ */
/*  Map                                                                */
/* ------------------------------------------------------------------ */

/**
 * The ride's map: Power on the Overview and the full map it opens, the route
 * coloured by each sample's power zone, the ride's own floors (seven colours,
 * "Less Power" … "More Power"). Map Settings' list is Inferred (not shot):
 * None, Speed, Heart Rate, Power, Elevation; Speed binned as the run's value
 * overlays are and worded "Slower" … "Faster", Heart Rate and Elevation the
 * run's.
 */
export const RIDE_MAP: MapSpec = {
	overlays: ["none", "speed", "heart-rate", "power", "elevation"],
	overview: "power",
	defs: {
		none: { label: "None", ramp: PACE_RAMP, legend: null },
		speed: {
			label: "Speed",
			ramp: PACE_RAMP,
			legend: { low: "Slower", high: "Faster" },
			values: { column: "speed", average: "averageSpeed", best: "maxSpeed", positive: true },
		},
		"heart-rate": { label: "Heart Rate", ramp: PACE_RAMP, legend: { low: "Lower", high: "Higher" } },
		power: { label: "Power", ramp: POWER_RAMP, legend: { low: "Less Power", high: "More Power" }, zones: { column: "power", scale: "power" } },
		elevation: { label: "Elevation", ramp: PACE_RAMP, legend: { low: "Lower", high: "Higher" } },
	},
	base: ROUTE_BASE,
};

export const CYCLING: SportProfile = {
	id: "cycling",
	overview: { hero, figures, links },
	stats: { table, help: STATS_HELP },
	laps: { table: laps },
	charts: RIDE_CHARTS,
	map: RIDE_MAP,
};
