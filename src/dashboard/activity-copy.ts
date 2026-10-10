import type { BenefitGroup } from "./activity-labels";

/**
 * This Activity's Benefit: the sheet behind the "?" on the Primary Benefit
 * card. Garmin keeps this wording in the app, not the API, so only what the
 * phone showed is here, verbatim (ref/activity-details/outdoor-run/README.md,
 * Sheets; `phone/sheets/01-activity-benefit.png`).
 *
 * The shot ends inside the last paragraph ("Your primary benefit statement
 * also explains how the …"), so the sheet keeps its sentences up to there and
 * leaves the unfinished one out rather than guess its end.
 *
 * Pure: no Obsidian import.
 */

export const BENEFIT_SHEET_TITLE = "This Activity's Benefit";

export const BENEFIT_MORE_TITLE = "More about Primary Benefit";

export const BENEFIT_MORE =
	"Along with providing aerobic and anaerobic scores, your device can also determine the primary benefit of the activity. The benefit will fall into one of the following categories:";

/** The categories, each with its benefits, in the sheet's order. The phone sets VO₂ with a subscript. */
export const BENEFIT_CATEGORIES: ReadonlyArray<{ group: BenefitGroup; benefits: readonly string[] }> = [
	{ group: "Anaerobic", benefits: ["Sprint", "Anaerobic Capacity"] },
	{ group: "High Aerobic", benefits: ["VO₂ Max", "Threshold", "Tempo"] },
	{ group: "Low Aerobic", benefits: ["Base", "Recovery"] },
];

export const BENEFIT_CLOSING =
	"By performing similar activities, you can continue to work on aspects of your training that are important to you, such as increasing endurance or speed.";

/**
 * What this activity did, by `trainingEffectLabel`. Only Threshold's is on a
 * shot; the other benefits show the sheet without it until one is captured.
 * Whether the app picks this paragraph by the label or by the finer
 * `aerobicTrainingEffectMessage` (HIGHLY_IMPROVING_LACTATE_THRESHOLD_13 here)
 * is not known (Inferred: the label).
 */
const BENEFIT_MESSAGES: Readonly<Record<string, string>> = {
	LACTATE_THRESHOLD:
		"Nice! Activities like this improve your muscular endurance and fatigue resistance, allowing you to sustain a hard effort for longer time. It increased your high aerobic training load.",
};

export function benefitMessage(label: unknown): string | null {
	return typeof label === "string" ? (BENEFIT_MESSAGES[label] ?? null) : null;
}
