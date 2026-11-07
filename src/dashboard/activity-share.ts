import type { ActivityDetail } from "../sync/activity-detail";
import { glyphOf, type SportGlyph, type Units } from "./activities";
import { baseOf, overlayFor, overviewOverlay, rampOf, routeBounds, routeEnds, routePoints, routeRuns, type LatLon } from "./activity-map";
import { activityWhen, sportTitle } from "./activity-labels";
import { profileFor } from "./activity-sports";
import { distanceParts, fixed, numberOf, speedOf, whole } from "./activity-stats-pages";
import { duration } from "./series";
import { inUnit, perHundred, swimPace, swimUnit } from "./swim-metrics";

/**
 * Share Activity, as data: Garmin's phone flow turns an activity into an
 * image (its name, date and sport, its figures and, in some templates, its
 * route) in one of three aspect ratios, for the system share sheet or a file.
 *
 * Each sport shares five figures, A to E, and each template places them:
 * Rings puts A, B and C in its rings and D and E under them, Topographic B
 * big with A and C, then D and E, TRANSPARENT A, B and C (spec:
 * ref/share/README.md, from Garmin's saved images of a hike, a run, a ride,
 * a pool swim and yoga; every other sport's five are Inferred).
 *
 * Pure: no Obsidian import.
 */

export type ShareRatioId = "9:16" | "4:5" | "1:1";

export interface ShareRatio {
	id: ShareRatioId;
	/** Garmin's list item: "Full Portrait (9:16)". */
	label: string;
	/** The image's size in pixels: Garmin's layout, drawn at 1080 wide. */
	width: number;
	height: number;
}

/** "Choose an aspect ratio", in Garmin's order; the first is ticked to start with. */
export const SHARE_RATIOS: readonly ShareRatio[] = [
	{ id: "9:16", label: "Full Portrait (9:16)", width: 1080, height: 1920 },
	{ id: "4:5", label: "Vertical (4:5)", width: 1080, height: 1350 },
	{ id: "1:1", label: "Square (1:1)", width: 1080, height: 1080 },
];

export const DEFAULT_RATIO: ShareRatioId = "9:16";

export function ratioOf(id: ShareRatioId): ShareRatio {
	return SHARE_RATIOS.find((r) => r.id === id) ?? SHARE_RATIOS[0];
}

/** One of the image's figures: "6.14" "km" "Distance". A figure the activity hasn't got reads "--". */
export interface ShareFigure {
	value: string;
	unit?: string;
	label: string;
}

/** A stretch of the route in one colour. */
export interface ShareRun {
	color: string;
	points: LatLon[];
}

export interface ShareRoute {
	/** Every GPS point, in order. */
	points: LatLon[];
	/** The route coloured as the Overview's map colours it (the run's pace). */
	runs: ShareRun[];
	start: LatLon;
	end: LatLon;
}

export interface ShareView {
	id: number;
	/** The activity's name, else its sport: "Blat Hiking". */
	title: string;
	/** The date line: "Mar 4 @ 9:22 AM". */
	when: string;
	/** The local start date, "2026-03-04": the file's name ends with it. */
	date: string;
	glyph: SportGlyph;
	/** The sport's five figures, A to E (`SHARE_SETS`). */
	figures: ShareFigure[];
	/** Total Time, which the Map template always shows beside B. */
	time: ShareFigure;
	/** The route, when the activity has GPS. */
	route: ShareRoute | null;
}

export type ShareFigureId = "time" | "distance" | "pace" | "speed" | "hr" | "maxHr" | "ascent" | "calories" | "power" | "respiration";

/**
 * Each sport's five, as Garmin's images have them:
 * - on foot (hiking, walking): Total Time, Distance, Avg Pace; Total Ascent, Total Calories;
 * - a run: Avg Heart Rate, Distance, Avg Pace; Total Time, Total Calories;
 * - a ride: Total Time, Distance, Avg Speed; Total Ascent, Avg Power;
 * - a swim: Total Time, Distance, Avg Pace per 100; Avg Heart Rate, Total Calories;
 * - yoga: Avg Heart Rate, Total Time, Avg Respiration Rate; Total Poses (which the
 *   plugin doesn't keep: Max Heart Rate, Inferred), Total Calories.
 * The last two are Inferred: a session without a distance, and any other sport.
 */
export const SHARE_SETS = {
	foot: ["time", "distance", "pace", "ascent", "calories"],
	run: ["hr", "distance", "pace", "time", "calories"],
	ride: ["time", "distance", "speed", "ascent", "power"],
	swim: ["time", "distance", "pace", "hr", "calories"],
	yoga: ["hr", "time", "respiration", "maxHr", "calories"],
	gym: ["hr", "time", "calories", "maxHr", "respiration"],
	other: ["time", "distance", "speed", "ascent", "calories"],
} as const satisfies Record<string, readonly ShareFigureId[]>;

export type ShareSetId = keyof typeof SHARE_SETS;

/** The set an activity shares, by its sport's figure and whether it has a distance. */
export function shareSetOf(detail: ActivityDetail): ShareSetId {
	switch (glyphOf(detail)) {
		case "trekking":
		case "walk":
			return "foot";
		case "run":
		case "treadmill":
			return "run";
		case "bike":
			return "ride";
		case "swimming":
			return "swim";
		case "yoga":
		case "stretching":
			return "yoga";
		default:
			return (numberOf(detail.summary.distance) ?? 0) > 0 ? "other" : "gym";
	}
}

export function shareView(detail: ActivityDetail, units: Units, today?: string): ShareView {
	return {
		id: detail.id,
		title: detail.name.trim() || sportTitle(detail.type),
		when: activityWhen(detail.start, today),
		date: detail.start.slice(0, 10),
		glyph: glyphOf(detail),
		figures: SHARE_SETS[shareSetOf(detail)].map((id) => shareFigure(detail, id, units)),
		time: shareFigure(detail, "time", units),
		route: shareRoute(detail),
	};
}

const LABELS: Readonly<Record<ShareFigureId, string>> = {
	time: "Total Time",
	distance: "Distance",
	pace: "Avg Pace",
	speed: "Avg Speed",
	hr: "Avg Heart Rate",
	maxHr: "Max Heart Rate",
	ascent: "Total Ascent",
	calories: "Total Calories",
	power: "Avg Power",
	respiration: "Avg Respiration Rate",
};

/** One figure as Garmin writes it: "6.14" "km", "27:27" "/km", "161" "bpm", "868". */
export function shareFigure(detail: ActivityDetail, id: ShareFigureId, units: Units): ShareFigure {
	const label = LABELS[id];
	const found = figureValue(detail, id, units);
	return found ? { ...found, label } : { value: "--", label };
}

function figureValue(detail: ActivityDetail, id: ShareFigureId, units: Units): Omit<ShareFigure, "label"> | undefined {
	const v = (key: string) => numberOf(detail.summary[key]);
	const imperial = units === "imperial";
	const swim = glyphOf(detail) === "swimming";
	const speed = v("averageSpeed");
	switch (id) {
		case "time": {
			const seconds = v("duration");
			return seconds !== undefined && seconds > 0 ? { value: duration(seconds) } : undefined;
		}
		case "distance": {
			const metres = v("distance");
			if (metres === undefined || !(metres > 0)) return undefined;
			if (swim) {
				const unit = swimUnit(detail, units);
				return { value: fixed(inUnit(metres, unit), 0), unit };
			}
			const [value, unit] = distanceParts(metres, units);
			return { value, unit };
		}
		case "pace": {
			if (swim) {
				const unit = swimUnit(detail, units);
				const pace = speed !== undefined && speed > 0 ? swimPace(speed, unit) : undefined;
				return pace ? { value: pace, unit: perHundred(unit) } : undefined;
			}
			const pace = paceText(speed, units);
			return pace ? { value: pace, unit: imperial ? "/mi" : "/km" } : undefined;
		}
		case "speed": {
			const fast = speedOf(speed, units);
			return fast ? { value: fast, unit: imperial ? "mph" : "km/h" } : undefined;
		}
		case "hr":
			return withUnit(whole(v("averageHR")), "bpm");
		case "maxHr":
			return withUnit(whole(v("maxHR")), "bpm");
		case "ascent": {
			const metres = v("elevationGain");
			return metres === undefined ? undefined : { value: fixed(imperial ? metres * 3.28084 : metres, 0), unit: imperial ? "ft" : "m" };
		}
		case "calories": {
			const kcal = v("calories");
			return kcal === undefined ? undefined : { value: Math.round(kcal).toLocaleString("en-US") };
		}
		case "power":
			return withUnit(whole(v("averagePower")), "W");
		case "respiration":
			return withUnit(whole(v("avgRespirationRate")), "brpm");
	}
}

function withUnit(value: string | undefined, unit: string): Omit<ShareFigure, "label"> | undefined {
	return value === undefined ? undefined : { value, unit };
}

/**
 * The average pace, "27:27", however slow: a share image shows a slow hike's
 * pace where the plugin's day figures stop at 30 min/km. An hour or more per
 * unit reads "1:02:03".
 */
export function paceText(speed: number | undefined, units: Units): string | undefined {
	if (speed === undefined || !Number.isFinite(speed) || speed <= 0) return undefined;
	const per = units === "imperial" ? 1609.344 : 1000;
	const seconds = per / speed;
	return seconds < 360_000 ? duration(seconds) : undefined;
}

function shareRoute(detail: ActivityDetail): ShareRoute | null {
	const points = routePoints(detail);
	const ends = routeEnds(points);
	if (!ends || !routeBounds(points)) return null;
	const profile = profileFor(detail);
	const overlay = overlayFor(detail, overviewOverlay(profile.map), profile.map);
	const ramp = rampOf(overlay, profile.map);
	const base = baseOf(profile.map);
	const runs = routeRuns(detail, overlay, profile.map).map((run) => ({
		color: run.bucket === null ? base : (ramp[run.bucket] ?? base),
		points: run.points,
	}));
	return { points: points.map((p) => p.at), runs, start: ends.start, end: ends.end };
}

/** Characters a file name can't hold on one system or another, or that Obsidian links trip on. */
const UNSAFE = /[\\/:*?"<>|#^[\]]/g;

/** "Blat Hiking 2026-03-04.png": the activity's name and day. */
export function shareFileName(view: Pick<ShareView, "title" | "date">): string {
	const printable = Array.from(view.title, (ch) => (ch.charCodeAt(0) < 32 ? " " : ch)).join("");
	const name = printable.replace(UNSAFE, " ").replace(/\s+/g, " ").trim().slice(0, 80).trim() || "Activity";
	return `${name} ${view.date}.png`;
}
