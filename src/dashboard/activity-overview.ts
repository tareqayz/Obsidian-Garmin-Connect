import { pace } from "../sync/metrics";
import { BADGE_DESCRIPTIONS } from "./activity-copy";
import type { ActivityDetail } from "../sync/activity-detail";
import { formatDistance, glyphOf, hubOfGroup, type SportGlyph, type Units } from "./activities";
import { hasRoute } from "./activity-map";
import { activityWhen, effortOf, feelLabel, primaryBenefit, type Effort, type PrimaryBenefit } from "./activity-labels";
import { groupName, groupOf } from "./activity-types";
import { allRoute, categoryRoute, type Route } from "./routes";
import { duration } from "./series";

/**
 * The Overview tab as data: the map's weather chip, the date line, the name,
 * the distance and the four figures under it, the Evaluation cards, the
 * Navigation links, the device and its sensors, and the badges.
 *
 * Read-only, as the plugin is: the pencil, Add Notes, likes, Photo and Share
 * are left out, and Feel and Perceived Effort are shown, never edited.
 *
 * What the run shows is the default. Another sport passes its `OverviewSpec`
 * (its profile's `overview`): its big figure, its four figures and its links.
 *
 * Pure: no Obsidian import.
 */

export interface OverviewFigure {
	value: string;
	unit?: string;
	label: string;
	/** The expanded chart its badge opens. */
	chart?: string;
}

export interface WeatherChip {
	/** "31°". */
	temp: string;
	icon: "sun" | "moon" | "cloud" | "rain";
	/** The dial's number, "9". */
	wind?: string;
	/** Degrees the wind blows from: where the dial's pointer sits. */
	windFrom?: number;
}

/**
 * A Navigation row. Its icon is a sport figure; `medal` is the Personal
 * Records row, which the page draws as a trophy, as the phone does.
 */
export interface OverviewLink {
	label: string;
	icon: SportGlyph;
	route: Route;
}

/** The big figure under the name: the run's Distance ("10.01" "km"), or a basic activity's Total Time ("34:52"). */
export interface OverviewHero {
	value: string;
	unit?: string;
	label: string;
}

/** The Overview of a sport: its profile's `overview`. Each part left out is the run's. */
export interface OverviewSpec {
	/** The big figure; none at all when it returns null. */
	hero?: (detail: ActivityDetail, units: Units) => OverviewHero | null;
	/** The figures in their grid, two to a row. */
	figures?: (detail: ActivityDetail, units: Units) => OverviewFigure[];
	/** The Navigation rows. */
	links?: (detail: ActivityDetail) => OverviewLink[];
}

export interface OverviewView {
	map: boolean;
	/**
	 * An outdoor activity whose samples haven't loaded (still on their way, or
	 * the request failed): the map's place holds a note rather than closing up
	 * as it does for a treadmill run.
	 */
	routeMissing: boolean;
	weather: WeatherChip | null;
	/** "Oct 10 @ 8:19 AM". */
	when: string;
	glyph: SportGlyph;
	private: boolean;
	title: string;
	notes?: string;
	/** The run's big figure: its distance, labelled "Distance". */
	distance?: { value: string; unit: string };
	/** A sport's big figure (its spec's `hero`), in the distance's place. */
	hero?: OverviewHero;
	figures: OverviewFigure[];
	benefit: PrimaryBenefit | null;
	feel: string | null;
	effort: Effort | null;
	links: OverviewLink[];
	device: ActivityDetail["device"];
	/** The sensors under the device; only when there are any. */
	sensors?: NonNullable<ActivityDetail["sensors"]>;
	/** The Badges section's rows; only when there are any. */
	badges?: OverviewBadge[];
}

/** A badge's row: "Climber 1" over "Climb 500 feet during a cycling activity." when the app's copy is known. */
export interface OverviewBadge {
	name: string;
	description?: string;
}

export function overviewView(detail: ActivityDetail, units: Units, today?: string, spec?: OverviewSpec): OverviewView {
	const s = detail.summary;
	const map = hasRoute(detail);
	const view: OverviewView = {
		map,
		routeMissing: !map && !detail.checked.includes("samples") && (detail.hasPolyline ?? !INDOOR.test(detail.type)),
		weather: weatherChip(detail, units),
		when: activityWhen(detail.start, today),
		glyph: glyphOf({ type: detail.type, typeId: detail.typeId, parentTypeId: detail.parentTypeId }),
		private: detail.privacy === "private",
		title: detail.name,
		figures: spec?.figures ? spec.figures(detail, units) : figures(detail, units),
		benefit: primaryBenefit(s.trainingEffectLabel),
		feel: feelLabel(s.directWorkoutFeel),
		effort: effortOf(s.directWorkoutRpe),
		links: spec?.links ? spec.links(detail) : links(),
		device: detail.device,
	};
	if (detail.notes) view.notes = detail.notes;
	if (spec?.hero) {
		const hero = spec.hero(detail, units);
		if (hero) view.hero = hero;
	} else {
		const metres = numberOf(s.distance);
		if (metres !== undefined && metres > 0) {
			const [value, unit] = formatDistance(metres, units, 2, true).split(" ");
			view.distance = { value: value!, unit: unit! };
		}
	}
	if (detail.sensors?.length) view.sensors = detail.sensors;
	if (detail.badges?.length) {
		view.badges = detail.badges.map((badge) => {
			const description = badge.key ? BADGE_DESCRIPTIONS[badge.key] : undefined;
			return description ? { name: badge.name, description } : { name: badge.name };
		});
	}
	return view;
}

/** The distance as the big figure, as the run's ("10.01" "km"); none without one. */
export function distanceHero(detail: ActivityDetail, units: Units): OverviewHero | null {
	const metres = numberOf(detail.summary.distance);
	if (metres === undefined || !(metres > 0)) return null;
	const [value, unit] = formatDistance(metres, units, 2, true).split(" ");
	return { value: value!, unit: unit!, label: "Distance" };
}

/** The total time as the big figure ("34:52"), as an activity without a distance shows it. */
export function timeHero(detail: ActivityDetail): OverviewHero | null {
	const seconds = numberOf(detail.summary.duration);
	return seconds === undefined ? null : { value: duration(seconds), label: "Total Time" };
}

/**
 * Sports recorded without GPS, whose page never has a map: `treadmill_running`, `indoor_running`,
 * `virtual_run`. Only for a file that doesn't say (`hasPolyline`, from version 6).
 */
const INDOOR = /treadmill|indoor|virtual/;

/** Avg Heart Rate and Avg Pace (each with its chart badge), Total Time, Total Calories: those that have a value. */
function figures(detail: ActivityDetail, units: Units): OverviewFigure[] {
	const s = detail.summary;
	const out: OverviewFigure[] = [];
	const hr = numberOf(s.averageHR);
	if (hr !== undefined) out.push({ value: String(Math.round(hr)), unit: "bpm", label: "Avg Heart Rate", chart: "heart-rate" });
	const speed = numberOf(s.averageSpeed);
	const perUnit = speed !== undefined ? pace(speed, 1, units) : undefined;
	if (perUnit) out.push({ value: perUnit, unit: units === "imperial" ? "/mi" : "/km", label: "Avg Pace", chart: "pace" });
	const time = numberOf(s.duration);
	if (time !== undefined) out.push({ value: duration(time), label: "Total Time" });
	const kcal = numberOf(s.calories);
	if (kcal !== undefined) out.push({ value: Math.round(kcal).toLocaleString("en-US"), label: "Total Calories" });
	return out;
}

/**
 * The running family's links: its records and its category page. The phone's
 * third, "Running Reports", has no page in the plugin and is left out (the
 * twin's call); so is every sport's.
 */
function links(): OverviewLink[] {
	return [
		{ label: "Running Personal Records", icon: "medal", route: { page: "records", tab: "running" } },
		{ label: "All Running Activities", icon: "run", route: categoryRoute("running") },
	];
}

/**
 * "All <Group> Activities", by Garmin's filter group (the phone's "All Gym &
 * Fitness Equipment Activities" under a Stair Stepper): the hub's page for the
 * group, or All Activities filtered to it where the hub has none (Walking,
 * Diving…).
 */
export function groupLink(detail: ActivityDetail, icon: SportGlyph): OverviewLink {
	const group = groupOf(detail);
	const hub = hubOfGroup(group);
	return { label: `All ${groupName(group)} Activities`, icon, route: hub ? categoryRoute(hub) : allRoute({ types: [group] }) };
}

/**
 * The weather chip on the Overview map. Garmin sends °F and a wind speed the
 * phone shows ×1.852 (knots as km/h: 5 → "9"; mph would give 8). Imperial
 * shows °F and the wind in mph (Inferred).
 */
export function weatherChip(detail: ActivityDetail, units: Units): WeatherChip | null {
	const w = detail.weather;
	if (!w || w.temp === undefined || !hasRoute(detail)) return null;
	const temp = units === "imperial" ? w.temp : ((w.temp - 32) * 5) / 9;
	const chip: WeatherChip = { temp: `${Math.round(temp)}°`, icon: weatherIcon(w.desc, detail.start) };
	if (w.wind !== undefined) chip.wind = String(Math.round(units === "imperial" ? w.wind * 1.15078 : w.wind * 1.852));
	if (w.windFrom !== undefined) chip.windFrom = w.windFrom;
	return chip;
}

/** Clear by day is the sun the phone draws; the rest follow the description (Inferred). */
function weatherIcon(desc: string | undefined, start: string): WeatherChip["icon"] {
	const text = (desc ?? "").toLowerCase();
	if (/rain|shower|drizzle|storm|thunder/.test(text)) return "rain";
	if (/cloud|overcast|fog|mist|haze/.test(text)) return "cloud";
	const hour = Number(start.slice(11, 13));
	return hour >= 6 && hour < 19 ? "sun" : "moon";
}

function numberOf(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
