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
 * image (its name, date and sport, three figures and, in some templates, its
 * route) in one of three aspect ratios, for the system share sheet or a file.
 *
 * The figures are Garmin's share figures, not the Overview's: a hike shares
 * TOTAL TIME, DISTANCE and AVG PACE (the issue #44 shot of Garmin's
 * TRANSPARENT image). The other sports' three are Inferred until their shots.
 *
 * Pure: no Obsidian import.
 */

export type ShareRatioId = "9:16" | "4:5" | "1:1";

export interface ShareRatio {
	id: ShareRatioId;
	/** Garmin's list item: "Full Portrait (9:16)". */
	label: string;
	/** The image's size in pixels (Inferred: 1080 wide, until Garmin's saved images say). */
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

/** One of the image's figures: "6.14" "km" "Distance". */
export interface ShareStat {
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
	/** Three figures, or fewer when the activity has fewer. */
	stats: ShareStat[];
	/** The route, when the activity has GPS. */
	route: ShareRoute | null;
}

/** How many figures an image shows. */
export const SHARE_STATS = 3;

/** Sports Garmin paces rather than times by speed: on foot. */
const PACED: ReadonlySet<SportGlyph> = new Set<SportGlyph>(["run", "treadmill", "trekking", "walk"]);

export function shareView(detail: ActivityDetail, units: Units, today?: string): ShareView {
	return {
		id: detail.id,
		title: detail.name.trim() || sportTitle(detail.type),
		when: activityWhen(detail.start, today),
		date: detail.start.slice(0, 10),
		glyph: glyphOf(detail),
		stats: shareStats(detail, units),
		route: shareRoute(detail),
	};
}

/**
 * The image's three figures, Total Time first:
 * - on foot (runs, walks, hikes): Distance and Avg Pace, as the hike's;
 * - a swim: Distance in the pool's unit and Avg Pace per 100 (Inferred);
 * - anything else with a distance: Distance and Avg Speed (Inferred);
 * - without a distance: Total Calories and Avg Heart Rate (Inferred).
 * A figure the activity hasn't got is skipped, and the next one in
 * Calories, Avg Heart Rate, Total Ascent fills its place.
 */
export function shareStats(detail: ActivityDetail, units: Units): ShareStat[] {
	const v = (key: string) => numberOf(detail.summary[key]);
	const glyph = glyphOf(detail);
	const swim = glyph === "swimming";
	const out: ShareStat[] = [];
	const push = (stat: ShareStat | undefined) => {
		if (stat && out.length < SHARE_STATS && !out.some((s) => s.label === stat.label)) out.push(stat);
	};

	const seconds = v("duration");
	if (seconds !== undefined && seconds > 0) push({ value: duration(seconds), label: "Total Time" });

	const metres = v("distance");
	const speed = v("averageSpeed");
	if (metres !== undefined && metres > 0) {
		if (swim) {
			const unit = swimUnit(detail, units);
			push({ value: fixed(inUnit(metres, unit), 0), unit, label: "Distance" });
			const pace = speed !== undefined && speed > 0 ? swimPace(speed, unit) : undefined;
			if (pace) push({ value: pace, unit: perHundred(unit), label: "Avg Pace" });
		} else {
			const [value, unit] = distanceParts(metres, units);
			push({ value, unit, label: "Distance" });
			if (PACED.has(glyph)) {
				const pace = paceText(speed, units);
				if (pace) push({ value: pace, unit: units === "imperial" ? "/mi" : "/km", label: "Avg Pace" });
			} else {
				const fast = speedOf(speed, units);
				if (fast) push({ value: fast, unit: units === "imperial" ? "mph" : "km/h", label: "Avg Speed" });
			}
		}
	}

	const kcal = v("calories");
	if (kcal !== undefined && kcal > 0) push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	const hr = whole(v("averageHR"));
	if (hr !== undefined) push({ value: hr, unit: "bpm", label: "Avg Heart Rate" });
	const ascent = v("elevationGain");
	if (ascent !== undefined && ascent > 0) {
		push({ value: fixed(units === "imperial" ? ascent * 3.28084 : ascent, 0), unit: units === "imperial" ? "ft" : "m", label: "Total Ascent" });
	}
	return out;
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
