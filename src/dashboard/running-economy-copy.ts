/**
 * Running Economy's words: Garmin's classes as its help table names them,
 * the copy under Current's class, and the help's "Getting an Estimate" for
 * an account without a reading (ref/performance-stats/running-economy/README.md,
 * the Current shot and the web's Help dialog, verbatim; the apostrophes are
 * typographic, as the shot has them).
 *
 * The payload has no phrase id, so the copy follows `classification`. Only
 * Intermediate's is known; the other six classes have none yet (Inferred).
 *
 * No imports, so `gauges.ts` can name At a Glance's class the same way.
 *
 * Pure.
 */

/**
 * Garmin's class words, worse to better, as the API sends them, and the help
 * table's names. `titleCase` would make "Well Trained" of `WELL_TRAINED`.
 */
export const ECONOMY_CLASS_NAMES: Readonly<Record<string, string>> = {
	RECREATIONAL: "Recreational",
	INTERMEDIATE: "Intermediate",
	TRAINED: "Trained",
	WELL_TRAINED: "Well-Trained",
	EXPERT: "Expert",
	SUPERIOR: "Superior",
	ELITE: "Elite",
};

/** Garmin's word as a key of `ECONOMY_CLASS_NAMES`, however it is spelled: "WELL_TRAINED", "Well-Trained", "well trained". */
export function economyWord(word: string | undefined): string | undefined {
	const key = (word ?? "").toUpperCase().replace(/[^A-Z]+/g, "_").replace(/^_|_$/g, "");
	return Object.prototype.hasOwnProperty.call(ECONOMY_CLASS_NAMES, key) ? key : undefined;
}

/** A class word as the help table names it: "Intermediate", "Well-Trained"; undefined for a word this build doesn't know. */
export function economyClassName(word: string | undefined): string | undefined {
	const key = economyWord(word);
	return key === undefined ? undefined : ECONOMY_CLASS_NAMES[key];
}

/** The copy under Current's class, by Garmin's word: Intermediate's, from the shot and the web. */
export const ECONOMY_COPY: Readonly<Record<string, string>> = {
	INTERMEDIATE:
		"Your running economy shows you have experience, but there’s also plenty of untapped potential at this level. To see improvement, continue to train consistently, and you can even consider safely bumping up your running volume where possible.",
};

/** Current without any reading: the help's "Getting an Estimate" requirements in the class's place (Inferred). */
export const ESTIMATE_HEADING = "Getting an Estimate";
export const ESTIMATE_INTRO = "For more specific guidance to get started and ensure quality data:";
export const ESTIMATE_STEPS: readonly string[] = [
	"You must already have running VO₂ Max and lactate threshold estimates.",
	"Use the Run or Track Run activity profile on your device and record your runs with a GPS signal.",
	"Track your running activities using an accessory that measures step speed loss.",
	"Expect it to take 5-7 runs of at least 30 minutes before you receive an estimate.",
	"Provide your current height and weight in your account to improve estimate accuracy.",
];
