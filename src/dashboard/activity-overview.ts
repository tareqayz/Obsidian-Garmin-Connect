import { pace } from "../sync/metrics";
import type { ActivityDetail } from "../sync/activity-detail";
import { formatDistance, glyphOf, type SportGlyph, type Units } from "./activities";
import { hasRoute } from "./activity-map";
import { activityWhen, effortOf, feelLabel, primaryBenefit, type Effort, type PrimaryBenefit } from "./activity-labels";
import { categoryRoute, type Route } from "./routes";
import { duration } from "./series";

/**
 * The Overview tab as data: the map's weather chip, the date line, the name,
 * the distance and the four figures under it, the Evaluation cards, the
 * Navigation links and the device.
 *
 * Read-only, as the plugin is: the pencil, Add Notes, likes, Photo and Share
 * are left out, and Feel and Perceived Effort are shown, never edited.
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

export interface OverviewLink {
	label: string;
	icon: "medal" | "run";
	route: Route;
}

export interface OverviewView {
	map: boolean;
	weather: WeatherChip | null;
	/** "Oct 10 @ 8:19 AM". */
	when: string;
	glyph: SportGlyph;
	private: boolean;
	title: string;
	notes?: string;
	distance?: { value: string; unit: string };
	figures: OverviewFigure[];
	benefit: PrimaryBenefit | null;
	feel: string | null;
	effort: Effort | null;
	links: OverviewLink[];
	device: ActivityDetail["device"];
}

export function overviewView(detail: ActivityDetail, units: Units, today?: string): OverviewView {
	const s = detail.summary;
	const view: OverviewView = {
		map: hasRoute(detail),
		weather: weatherChip(detail, units),
		when: activityWhen(detail.start, today),
		glyph: glyphOf({ type: detail.type, typeId: detail.typeId, parentTypeId: detail.parentTypeId }),
		private: detail.privacy === "private",
		title: detail.name,
		figures: figures(detail, units),
		benefit: primaryBenefit(s.trainingEffectLabel),
		feel: feelLabel(s.directWorkoutFeel),
		effort: effortOf(s.directWorkoutRpe),
		links: links(),
		device: detail.device,
	};
	if (detail.notes) view.notes = detail.notes;
	const metres = numberOf(s.distance);
	if (metres !== undefined && metres > 0) {
		const [value, unit] = formatDistance(metres, units, 2, true).split(" ");
		view.distance = { value: value!, unit: unit! };
	}
	return view;
}

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
 * The running family's links; the page opens only for runs. The phone's third,
 * "Running Reports", has no page in the plugin and is left out (the twin's call).
 */
function links(): OverviewLink[] {
	return [
		{ label: "Running Personal Records", icon: "medal", route: { page: "records", tab: "running" } },
		{ label: "All Running Activities", icon: "run", route: categoryRoute("running") },
	];
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
