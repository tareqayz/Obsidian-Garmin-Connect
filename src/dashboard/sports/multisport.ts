import { pace } from "../../sync/metrics";
import type { ActivityDetail } from "../../sync/activity-detail";
import { formatDistance, type Units } from "../activities";
import { LEG_RAMP, legsOf, type Leg } from "../activity-legs";
import { ROUTE_BASE, type MapSpec } from "../activity-map";
import { distanceHero, groupLink, timeHero, type OverviewFigure, type OverviewLeg, type OverviewLink } from "../activity-overview";
import { sportTitle } from "../activity-labels";
import { elevationOf, fixed, MPH_PER_MS, numberOf, summaryOf, timeOf } from "../activity-stats-pages";
import type { SportProfile } from "../activity-sports";
import { inUnit, perHundred, swimPace, swimUnit } from "../swim-metrics";
import { duration } from "../series";
import { BASIC } from "./basic";
import { SWIM_ROUTE } from "./swimming";

/**
 * A multisport's page (ref/activity-details/multisport: activity 20789902324,
 * "Salalah Multisport", shots 1208–1214): the Overview alone, without the
 * tabs, and in it the whole race. The map draws every leg in its colour and
 * pins where each began; the figures are the race's Total Time and Total
 * Calories; Activity Legs lists the legs under Evaluation, each opening its
 * own page, a transition with its calories where the others have a pace or
 * a speed.
 *
 * The legs come from the summary's children and the laps, one a leg
 * (`activity-legs.ts`): no request of their own. A leg's page is its sport's,
 * titled "Multisport - <sport>"; a transition's is the basic page with its
 * own figures and a plain route (`TRANSITION`).
 *
 * Pure: no Obsidian import.
 */

/** The distance, else the time: "112.85" "km". */
function hero(detail: ActivityDetail, units: Units) {
	return distanceHero(detail, units) ?? timeHero(detail);
}

/** Total Time and Total Calories: the phone's two. */
function figures(detail: ActivityDetail): OverviewFigure[] {
	const out: OverviewFigure[] = [];
	const time = numberOf(detail.summary.duration);
	if (time !== undefined) out.push({ value: duration(time), label: "Total Time" });
	const kcal = numberOf(detail.summary.calories);
	if (kcal !== undefined) out.push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	return out;
}

/** "All Multisport Activities"; "Multisport Reports" is left out, as every sport's Reports. */
function links(detail: ActivityDetail): OverviewLink[] {
	return [groupLink(detail, "link")];
}

/** The legs as the phone lists them: "Open Water Swimming", "1,836 m", "42:01 • 2:17 /100m". */
export function legRows(detail: ActivityDetail, units: Units): OverviewLeg[] {
	return legsOf(detail).map((leg) => {
		const row: OverviewLeg = { id: leg.id, glyph: leg.glyph, title: sportTitle(leg.type) };
		const distance = legDistance(leg, units);
		if (distance) row.distance = distance;
		const line = [leg.duration !== undefined ? duration(leg.duration) : undefined, legRate(leg, units)].filter(Boolean).join(" • ");
		if (line) row.line = line;
		return row;
	});
}

/** A swim's in whole metres (or yards), grouped; the rest to 0.01 km or mi. */
function legDistance(leg: Leg, units: Units): string | undefined {
	if (leg.distance === undefined) return undefined;
	if (leg.kind === "swim") {
		const unit = swimUnit({}, units);
		return `${fixed(inUnit(leg.distance, unit), 0)} ${unit}`;
	}
	return formatDistance(leg.distance, units, 2, true);
}

/**
 * What follows the time: a transition's calories, a swim's pace per 100, a
 * run's pace, a ride's speed; any other leg its speed (Inferred).
 */
function legRate(leg: Leg, units: Units): string | undefined {
	const imperial = units === "imperial";
	if (leg.kind === "transition") return leg.calories !== undefined ? `${Math.round(leg.calories).toLocaleString("en-US")} Calories` : undefined;
	const speed = leg.speed ?? (leg.distance !== undefined && leg.duration ? leg.distance / leg.duration : undefined);
	if (speed === undefined || !(speed > 0)) return undefined;
	if (leg.kind === "swim") {
		const unit = swimUnit({}, units);
		const per = swimPace(speed, unit);
		return per ? `${per} ${perHundred(unit)}` : undefined;
	}
	if (leg.kind === "run") {
		const per = pace(speed, 1, units);
		return per ? `${per} ${imperial ? "/mi" : "/km"}` : undefined;
	}
	return `${fixed(speed * (imperial ? MPH_PER_MS : 3.6), 1)} ${imperial ? "mph" : "km/h"}`;
}

/**
 * The race's route, each leg in its colour over the dark outline, as the
 * phone's map draws it; no other overlay, so Map Settings has no Data Overlay
 * (Inferred: the sheet wasn't shot).
 */
export const MULTISPORT_MAP: MapSpec = {
	overlays: ["legs"],
	overview: "legs",
	defs: {
		none: { label: "None", ramp: [], legend: null },
		legs: { label: "Legs", ramp: LEG_RAMP, legend: null, legs: true },
	},
	base: ROUTE_BASE,
};

export const MULTISPORT: SportProfile = {
	id: "multisport",
	overview: { hero, figures, links, legs: legRows },
	map: MULTISPORT_MAP,
};

/* ------------------------------------------------------------------ */
/*  A transition's page                                                */
/* ------------------------------------------------------------------ */

/**
 * Total Time, Avg Speed, Total Ascent and Total Calories (shot 1212): the
 * basic page's four with the time in place of the heart rate, which Garmin
 * sends (127 bpm) and the phone leaves out.
 */
function transitionFigures(detail: ActivityDetail, units: Units): OverviewFigure[] {
	const v = summaryOf(detail);
	const imperial = units === "imperial";
	const out: OverviewFigure[] = [];
	const time = timeOf(v("duration"));
	if (time !== undefined) out.push({ value: time, label: "Total Time" });
	const speed = v("averageSpeed");
	if (speed !== undefined && speed >= 0) out.push({ value: fixed(speed * (imperial ? MPH_PER_MS : 3.6), 1), unit: imperial ? "mph" : "km/h", label: "Avg Speed" });
	out.push({ value: elevationOf(v("elevationGain"), units) ?? "--", unit: imperial ? "ft" : "m", label: "Total Ascent" });
	const kcal = v("calories");
	if (kcal !== undefined) out.push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	return out;
}

/**
 * A transition: the basic page (its Stats, Laps and Charts, its distance as
 * the big figure), with its own figures and the plain red route the phone
 * draws (#ff0000, as open water's), no pace colours and no legend.
 */
export const TRANSITION: SportProfile = {
	...BASIC,
	id: "transition",
	overview: { ...BASIC.overview, figures: transitionFigures },
	map: SWIM_ROUTE,
};
