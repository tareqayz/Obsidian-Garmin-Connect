import { formatDistance, glyphOf, typeLabel, type SportGlyph, type Units } from "../dashboard/activities";
import { activityWhen } from "../dashboard/activity-labels";
import { INDOOR, overviewView } from "../dashboard/activity-overview";
import { profileFor } from "../dashboard/activity-sports";
import { activityRoute } from "../dashboard/routes";
import { duration } from "../dashboard/series";
import type { ActivityDetail } from "../sync/activity-detail";
import type { ActivityRow } from "../sync/activity-index";
import { pace } from "../sync/metrics";
import { sportIcon } from "../ui/sport-icons";
import type { ActivityPick } from "./spec";
import type { ActivityCardView, CardFigure } from "./view";

/**
 * An activity's card in a note: its name and time, its figures, and its
 * route map once its details are in the vault. Pure.
 *
 * The details are the activity page's file, kept once the page has opened
 * (or the sync downloaded it). Without them the card has the activity
 * index's figures and says the map comes with the page.
 */

/** The activities a block shows, newest first: the day's latest, all of the day's, or one by its id. */
export function pickActivities(rows: readonly ActivityRow[], pick: ActivityPick, day: string): ActivityRow[] {
	if (pick.kind === "id") return rows.filter((r) => r.id === pick.id).slice(0, 1);
	const ofDay = rows.filter((r) => r.start.slice(0, 10) === day).sort((a, b) => b.begin - a.begin);
	return pick.kind === "latest" ? ofDay.slice(0, 1) : ofDay;
}

/** Four figures at most, as the Overview has them: the big one first. */
const FIGURES = 4;

/** The card for an activity, from its details when the vault has them, else from its index row; null with neither. */
export function activityCard(id: number, row: ActivityRow | undefined, detail: ActivityDetail | null, units: Units, today: string): ActivityCardView | null {
	if (detail) {
		const view = overviewView(detail, units, today, profileFor(detail).overview);
		const big = view.distance ? { value: `${view.distance.value} ${view.distance.unit}`, label: "Distance" } : view.hero ? figure(view.hero) : null;
		const card: ActivityCardView = {
			id,
			title: view.title,
			when: view.when,
			icon: sportIcon(view.glyph),
			figures: [...(big ? [big] : []), ...view.figures.map(figure)].slice(0, FIGURES),
			detail: view.map ? detail : null,
			route: activityRoute(id),
		};
		if (view.routeMissing) card.mapNote = MAP_NOTE;
		return card;
	}
	if (!row) return null;
	const figures: CardFigure[] = [];
	if (row.distance) figures.push({ value: formatDistance(row.distance, units, 2, true), label: "Distance" });
	if (row.duration) figures.push({ value: duration(row.duration), label: "Total Time" });
	const perUnit = /run|walk|hik/.test(row.type) ? pace(row.distance, row.duration, units) : undefined;
	if (perUnit) figures.push({ value: `${perUnit} /${units === "imperial" ? "mi" : "km"}`, label: "Avg Pace" });
	if (row.calories) figures.push({ value: String(Math.round(row.calories)), label: "Total Calories" });
	const card: ActivityCardView = {
		id,
		title: row.name ?? typeLabel(row.type),
		when: activityWhen(row.start, today),
		icon: sportIcon(glyphOf(row)),
		figures: figures.slice(0, FIGURES),
		detail: null,
		route: activityRoute(id),
	};
	if (outdoors(row)) card.mapNote = MAP_NOTE;
	return card;
}

const MAP_NOTE = "Open the activity to load its map.";

/** The sports recorded with GPS: their page has a map. A pool, a gym or a treadmill has none. */
const MAPPED: ReadonlySet<SportGlyph> = new Set(["run", "bike", "walk", "trekking", "snowflake", "link"]);

function outdoors(row: ActivityRow): boolean {
	if (INDOOR.test(row.type)) return false;
	const glyph = glyphOf(row);
	return MAPPED.has(glyph) || (glyph === "swimming" && /open_water/.test(row.type));
}

function figure(f: { value: string; unit?: string; label: string }): CardFigure {
	return { value: f.unit ? `${f.value} ${f.unit}` : f.value, label: f.label };
}
