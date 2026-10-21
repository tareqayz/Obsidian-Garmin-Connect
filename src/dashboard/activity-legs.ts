import type { ActivityDetail } from "../sync/activity-detail";
import { categoryOf, glyphOf, type SportGlyph } from "./activities";
import { activityType } from "./activity-types";

/**
 * A multisport's legs (ref/activity-details/multisport: activity 20789902324,
 * shots 1208–1214): swim, transition, ride, transition, run, each an activity
 * with its own page. The summary names them (`legs`: ids and types, in race
 * order) and the laps hold their totals, one lap a leg; the two are read side
 * by side here, for the parent page's Activity Legs rows and its map.
 *
 * Pure: no Obsidian import.
 */

/** How a leg is drawn on the map: its colour's slot (`LEG_COLOURS`). */
export type LegKind = "swim" | "ride" | "run" | "transition" | "other";

export interface Leg {
	/** The leg's own activity: its page. */
	id: number;
	/** Garmin's typeKey: `open_water_swimming`, `transition_v2`, … */
	type: string;
	typeId?: number;
	parentTypeId?: number;
	kind: LegKind;
	glyph: SportGlyph;
	/** Seconds on the multisport's clock where the leg began; unknown without its lap. */
	start?: number;
	/** Seconds. */
	duration?: number;
	/** Metres. */
	distance?: number;
	/** m/s. */
	speed?: number;
	calories?: number;
}

/** The legs in race order, each with its lap's totals when the laps line up with them. */
export function legsOf(detail: Pick<ActivityDetail, "legs" | "laps">): Leg[] {
	const refs = detail.legs ?? [];
	return refs.map((ref, i) => {
		const known = activityType({ type: ref.type });
		const typed = { type: ref.type, typeId: known?.id, parentTypeId: known?.parent };
		const leg: Leg = { id: ref.id, type: ref.type, kind: kindOf(typed), glyph: glyphOf(typed) };
		if (known) {
			leg.typeId = known.id;
			if (known.parent !== undefined) leg.parentTypeId = known.parent;
		}
		const lap = detail.laps.length === refs.length ? detail.laps[i] : undefined;
		if (lap) {
			if (lap.start !== undefined) leg.start = lap.start;
			leg.duration = lap.duration;
			leg.distance = lap.distance;
			if (lap.speed !== undefined) leg.speed = lap.speed;
			if (lap.calories !== undefined) leg.calories = lap.calories;
		}
		return leg;
	});
}

function kindOf(typed: { type: string; typeId?: number; parentTypeId?: number }): LegKind {
	if (/transition/i.test(typed.type)) return "transition";
	switch (categoryOf(typed)) {
		case "swimming":
			return "swim";
		case "cycling":
			return "ride";
		case "running":
			return "run";
		default:
			return "other";
	}
}

/**
 * The legs' route colours, sampled off the phone's full map
 * (`phone/map/01-full-zoomed`): the swim magenta, the ride red, the run the
 * pace ramp's second blue, a transition Run/Walk's idle yellow. A leg of
 * another sport takes the plain route's blue (Inferred).
 */
export const LEG_COLOURS: Readonly<Record<Exclude<LegKind, "other">, string>> = {
	swim: "#d42fc2",
	ride: "#e02c2c",
	run: "#1976d2",
	transition: "#f5bf2a",
};

/** The ramp a legs overlay paints with: a slot a kind, in `LEG_SLOTS`' order. */
export const LEG_RAMP: readonly string[] = [LEG_COLOURS.swim, LEG_COLOURS.ride, LEG_COLOURS.run, LEG_COLOURS.transition];
const LEG_SLOTS: Readonly<Record<LegKind, number | null>> = { swim: 0, ride: 1, run: 2, transition: 3, other: null };

/**
 * Which leg a moment on the multisport's clock falls in: the last to have
 * begun by then. Before the first leg's start, the first; without starts, none.
 */
export function legAt(legs: readonly Leg[], clock: number): number | null {
	let at: number | null = null;
	legs.forEach((leg, i) => {
		if (leg.start === undefined) return;
		if (at === null || leg.start <= clock) at = i;
	});
	return at;
}

/** A leg's slot in `LEG_RAMP`, or null for a sport without a colour of its own. */
export function legSlot(leg: Leg): number | null {
	return LEG_SLOTS[leg.kind];
}
