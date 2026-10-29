import { statFor, type GlanceId } from "../dashboard/glance";
import type { FocusId } from "../dashboard/home";

/**
 * Every card a note can show, by the name its `garmin` block uses. Pure.
 *
 * The cards are Home's: a big card is an In Focus card, a small one an At a
 * Glance card, and five stats have both (Sleep, Body Battery, Steps, Training
 * Readiness, Training Status). A card keeps its Home size: one of those five
 * is big unless the block says `size: small`. The cards that are only ever a
 * prompt on Home (blood pressure, critical swim speed, hydration, lifestyle,
 * nutrition) aren't here: they have nothing of a day to show.
 *
 * The guide, the picker and the docs list them in this order.
 */

export type CardCategory = "day" | "sleep" | "activity" | "heart" | "training" | "body";

export const CATEGORIES: ReadonlyArray<{ id: CardCategory; title: string }> = [
	{ id: "day", title: "The whole day" },
	{ id: "sleep", title: "Sleep and recovery" },
	{ id: "activity", title: "Activity" },
	{ id: "heart", title: "Heart and stress" },
	{ id: "training", title: "Training and fitness" },
	{ id: "body", title: "Body" },
];

export interface CardEntry {
	/** The name a block's `show:` line uses: `sleep`, `heart-rate`. */
	id: string;
	/** `focus` and `glance` are Home's cards; `activities` the day's list; `day` all of Home for the day. */
	kind: "focus" | "glance" | "activities" | "day";
	/** The In Focus card it draws big. */
	focus?: FocusId;
	/** The At a Glance card it draws small. */
	glance?: GlanceId;
	title: string;
	/** A Lucide icon, as its Home card draws it. */
	icon: string;
	category: CardCategory;
	/** One sentence: what the card shows. */
	description: string;
	/** Other names it answers to: Home's own ids, mostly. */
	aliases: readonly string[];
}

/** A small card, titled and drawn as Home's At a Glance card. */
function glance(id: string, card: GlanceId, category: CardCategory, description: string, aliases: string[] = []): CardEntry {
	const stat = statFor(card);
	return { id, kind: "glance", glance: card, title: stat.title, icon: stat.icon, category, description, aliases: [card, ...aliases] };
}

/** A stat with both: big by default, small with `size: small`. */
function both(id: string, focus: FocusId, card: GlanceId, category: CardCategory, description: string, aliases: string[] = []): CardEntry {
	return { ...glance(id, card, category, description, aliases), kind: "focus", focus };
}

export const CARDS: readonly CardEntry[] = [
	{ id: "day", kind: "day", title: "Whole day", icon: "calendar", category: "day", description: "Your Home for that day: In Focus, activities and At a Glance.", aliases: ["home"] },
	{ id: "activities", kind: "activities", title: "Activities", icon: "activity", category: "day", description: "That day’s activities and Health Snapshots.", aliases: ["today", "workouts"] },

	both("sleep", "sleep", "sleep", "sleep", "Last night’s score, time asleep and stages.", ["sleep-score"]),
	both("body-battery", "bodyBattery", "bodyBattery", "sleep", "Energy charged and drained through the day."),
	glance("hrv-status", "hrv", "sleep", "Overnight HRV against your baseline."),
	both("training-readiness", "readiness", "readiness", "sleep", "How ready you are for a hard workout."),
	glance("health-status", "healthStatus", "sleep", "Overnight vitals against your baseline."),
	glance("respiration", "respiration", "sleep", "Breaths a minute, awake and asleep."),
	glance("pulse-ox", "pulseOx", "sleep", "Blood oxygen, latest and averages.", ["spo2"]),

	both("steps", "steps", "steps", "activity", "Steps against your goal, through the day."),
	{ id: "activity-week", kind: "focus", focus: "activities", title: "All Activities", icon: "activity", category: "activity", description: "Your activities over the past week.", aliases: ["all-activities"] },
	glance("intensity-minutes", "intensity", "activity", "This week’s intensity minutes against your goal."),
	glance("calories", "calories", "activity", "Calories burned, active and resting."),
	glance("floors", "floors", "activity", "Floors climbed against your goal."),
	glance("last-activity", "lastActivity", "activity", "Your latest activity on or before the day."),

	glance("heart-rate", "heartRate", "heart", "Resting and current heart rate."),
	glance("stress", "stress", "heart", "Average stress and how the day split."),

	both("training-status", "trainingStatus", "trainingStatus", "training", "Your training status and load focus."),
	glance("training-load", "trainingLoad", "training", "Acute load against your optimal range."),
	glance("load-focus", "loadFocus", "training", "Four weeks of load by intensity."),
	glance("vo2-max", "vo2max", "training", "Your running VO₂ Max."),
	glance("cycling-vo2-max", "cyclingVo2", "training", "Your cycling VO₂ Max."),
	glance("endurance-score", "endurance", "training", "Your endurance score and level."),
	glance("hill-score", "hillScore", "training", "Your hill score and level."),
	glance("fitness-age", "fitnessAge", "training", "Your fitness age."),
	glance("heat-acclimation", "heat", "training", "How used you are to the heat."),
	glance("altitude-acclimation", "altitude", "training", "How used you are to altitude."),
	glance("running-tolerance", "runningTolerance", "training", "How much running load you can take this week."),
	glance("running-economy", "runningEconomy", "training", "Your latest running economy."),
	glance("lactate-threshold", "lactateThreshold", "training", "Your latest lactate threshold."),
	glance("cycling-ftp", "cyclingFtp", "training", "Your latest cycling FTP.", ["ftp"]),
	glance("xc-ski-ftp", "xcSkiFtp", "training", "Your latest XC skiing FTP."),
	glance("cycling-ability", "cyclingAbility", "training", "Your latest cycling ability."),

	glance("weight", "weight", "body", "Your latest weigh-in on or before the day."),
];

/** A name as `show:` reads it: case, spaces, dashes and underscores don't count. */
export function cardKey(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_KEY = new Map<string, CardEntry>();
for (const card of CARDS) for (const name of [card.id, ...card.aliases]) BY_KEY.set(cardKey(name), card);

export function cardByName(name: string): CardEntry | undefined {
	return BY_KEY.get(cardKey(name));
}

/** The card a mistyped name most likely meant, if one is close. */
export function closestCard(name: string): CardEntry | undefined {
	const key = cardKey(name);
	if (!key) return undefined;
	let best: { card: CardEntry; distance: number } | undefined;
	for (const card of CARDS) {
		for (const candidate of [card.id, ...card.aliases]) {
			const distance = editDistance(key, cardKey(candidate));
			if (!best || distance < best.distance) best = { card, distance };
		}
	}
	return best && best.distance <= Math.max(2, Math.floor(key.length / 3)) ? best.card : undefined;
}

/** Levenshtein distance: the edits that turn one word into the other. */
export function editDistance(a: string, b: string): number {
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const next = [i];
		for (let j = 1; j <= b.length; j++) next.push(Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
		prev = next;
	}
	return prev[b.length];
}
