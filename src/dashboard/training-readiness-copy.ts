import { humanize } from "./day";
import type { HelpSection } from "./training-status-copy";

/**
 * Training Readiness's words, which Garmin keeps in the app rather than the
 * API: the phone's of 2026-10-11 and the web's of that evening, today's page
 * and Oct 10's (ref/performance-stats/training-readiness/README.md). What
 * neither showed is marked Inferred: an unseen title is its key in sentence
 * case, an unseen copy or sheet copy is left out rather than guessed.
 *
 * Pure.
 */

/** The page's and the sheets' fixed words. */
export const FACTORS_TITLE = "FACTORS";
export const DIAL_TOP = "100";
export const SLEEP_TIMELINE = "Sleep Timeline";
export const DAILY_SCORES = "Daily Scores";
export const DAILY_AVERAGES = "Daily Averages";
export const RELEVANT_SCORES = "Relevant Scores";
export const AVG_STRESS_LEVEL = "Avg Stress Level";

/** The level under the dial (the Help's five ratings): Poor and High seen. */
export const LEVEL_WORDS: Readonly<Record<string, string>> = {
	POOR: "Poor",
	LOW: "Low",
	MODERATE: "Moderate",
	HIGH: "High",
	PRIME: "Prime",
};

/** "Updated @ 9:41 AM • After Activity": the reading's `inputContext`. A realtime reading's words are unseen: the time alone (Inferred). */
export const CONTEXT_WORDS: Readonly<Record<string, string>> = {
	AFTER_POST_EXERCISE_RESET: "After Activity",
	AFTER_WAKEUP_RESET: "After Wake-Up",
};

/** Titles seen (`feedbackShort`): the phone's, the web's past day's, Home's card of Sep 24. */
const TITLES: Readonly<Record<string, string>> = {
	LET_YOUR_BODY_RECOVER: "Let your body recover",
	WELL_RECOVERED: "Well-recovered",
	ENERGIZED_BY_GOOD_SLEEP: "Energized by good sleep",
};

/** Copy seen (`feedbackLong`). */
const COPY: Readonly<Record<string, string>> = {
	POOR_RT_HIGH_SS_GOOD_OR_MOD: "High recovery needs from previous workouts have reduced your training readiness.",
	HIGH_RT_HIGHEST_SS_AVAILABLE: "Nice job! You are well-rested and ready for action.",
};

/** The title over the copy: the seen ones, else the key in sentence case (Inferred: LISTEN_TO_YOUR_BODY "Listen to your body"); none for UNKNOWN. */
export function readinessTitle(key: string | undefined): string | undefined {
	const k = key?.trim().toUpperCase();
	if (!k || k === "UNKNOWN") return undefined;
	return TITLES[k] ?? humanize(k);
}

/** The copy under the title: seen keys only. */
export function readinessCopy(key: string | undefined): string | undefined {
	const k = key?.trim().toUpperCase();
	return k ? COPY[k] : undefined;
}

/* ------------------------------------------------------------------ */
/*  Factors                                                            */
/* ------------------------------------------------------------------ */

/** The six factors, the cards' order. Each opens its sheet. */
export type ReadinessFactorId = "sleep" | "recovery" | "hrv" | "acute" | "sleep-history" | "stress-history";

export const FACTOR_IDS: readonly ReadinessFactorId[] = ["sleep", "recovery", "hrv", "acute", "sleep-history", "stress-history"];

export const FACTOR_TITLES: Readonly<Record<ReadinessFactorId, string>> = {
	sleep: "Sleep Score",
	recovery: "Recovery Time",
	hrv: "HRV Status",
	acute: "Acute Load",
	"sleep-history": "Recent Sleep Scores",
	"stress-history": "Recent Stress",
};

/** Garmin's band of a factor's percent (`…FactorFeedback`); `NONE` without the data. */
export type FactorFeedback = "VERY_GOOD" | "GOOD" | "MODERATE" | "POOR" | "NONE";

/**
 * A card's word by its factor's band. Seen: Sleep Score Excellent and Good,
 * Recovery Time High Need, HRV Status Balanced, Recent Sleep Scores Fair,
 * Recent Stress Low; the rest Inferred. Recovery Time says "Recovered" at 0 h
 * whatever its band (the web's 1 minute); Acute Load's word is the day's
 * Training Status row's (`LOAD_WORDS`), not its band's.
 */
export const FACTOR_WORDS: Readonly<Record<Exclude<ReadinessFactorId, "acute">, Readonly<Record<Exclude<FactorFeedback, "NONE">, string>>>> = {
	sleep: { VERY_GOOD: "Excellent", GOOD: "Good", MODERATE: "Fair", POOR: "Poor" },
	recovery: { VERY_GOOD: "Low Need", GOOD: "Low Need", MODERATE: "Moderate Need", POOR: "High Need" },
	hrv: { VERY_GOOD: "Balanced", GOOD: "Balanced", MODERATE: "Unbalanced", POOR: "Low" },
	"sleep-history": { VERY_GOOD: "Excellent", GOOD: "Good", MODERATE: "Fair", POOR: "Poor" },
	"stress-history": { VERY_GOOD: "Low", GOOD: "Low", MODERATE: "Moderate", POOR: "High" },
};

/** Recovery Time's word at 0 h. */
export const RECOVERED = "Recovered";

/**
 * A sheet's copy under its word, by the factor's band (Acute Load's by the
 * Training Status row's `acwr`): the phone's and the web's of 2026-10-11,
 * word for word. Unseen bands have none (Inferred).
 */
const SHEET_COPY: Readonly<Record<ReadinessFactorId, Readonly<Record<string, string>>>> = {
	sleep: { GOOD: "Good sleep like this helps support your training readiness." },
	recovery: { POOR: "Your high recovery needs have decreased your training readiness. You may need more time to recover." },
	hrv: { GOOD: "Balanced HRV status like this establishes a solid foundation for your training readiness both today and in the future." },
	acute: { OPTIMAL: "Your optimal training load is supporting your training readiness. Nice work!" },
	"sleep-history": {
		MODERATE: "Your fair sleep on recent nights may have a slightly negative impact on your readiness. Strive for better sleep each night to get back on track.",
	},
	"stress-history": { GOOD: "You have found a good balance between daytime stress and recovery over the last few days." },
};

/** A sheet's copy: `key` is the factor's band, or Acute Load's Training Status `acwr`. */
export function sheetCopy(id: ReadinessFactorId, key: string | undefined): string | undefined {
	const k = key?.trim().toUpperCase();
	return k ? SHEET_COPY[id][k] : undefined;
}

/* ------------------------------------------------------------------ */
/*  Help                                                               */
/* ------------------------------------------------------------------ */

/**
 * The Help sheet (title "Training Readiness"), the web dialog's verbatim
 * (`web/text-help.txt`, 2026-10-11): the phone's sheet is unseen (Inferred).
 */
export const TRAINING_READINESS_HELP: readonly HelpSection[] = [
	{
		parts: [
			{
				heading:
					"Training readiness measures factors such as sleep, recovery time, training load, stress and HRV status to determine how prepared you are to benefit from training on that day.",
				paragraphs: [
					"In addition to a numeric score that ranges from 0 to 100, you will receive a rating of prime, high, moderate, low or poor for your training readiness. This is accompanied by a feedback phrase that explains your current training readiness or provides suggestions on how to manage it.",
					"Training readiness is continuously calculated and changes dynamically on your Garmin device throughout the day. However, only your score early each morning from your Preferred Activity Tracker is displayed in Garmin Connect for that day.",
				],
			},
		],
	},
	{
		title: "Receiving a Training Readiness Score",
		parts: [
			{
				paragraphs: [
					"To receive a training readiness score, wear your Garmin device continuously for three consecutive days, including during sleep. (Some factors, such as training load and HRV status, take a bit longer to calculate accurately.) If you do not wear your device during sleep, you may still receive a training readiness rating, but you will not receive a numeric score for that day. The more frequently you wear your device, the more accurate your training readiness estimates will become over time.",
				],
				link: "Learn more about the value of consistent sleep-tracking.",
			},
		],
	},
	{
		title: "About Your Training Readiness Reading",
		parts: [
			{
				paragraphs: [
					"Training readiness can be a valuable metric as you are training for an event, or just for training in general. Ratings of prime or high may indicate that you could get a lot of benefit from training on that day. Moderate ratings mean that you are ready to train, but you may have a factor or two that is worth your attention. Low or poor ratings are an indication that it might be time to ease up a bit before challenging the body again. The dynamic feedback phrases will also provide insights on things that you can work on to improve your training readiness scores in the future.",
					"With your training readiness score, keep in mind that fatigue can sometimes be beneficial. It allows the body to recover and adapt in order to achieve even greater training benefits. Therefore, you can continue to train occasionally even if your current readiness is at a lower level.",
				],
			},
		],
	},
];
