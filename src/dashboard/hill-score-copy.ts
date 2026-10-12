/**
 * Hill Score's words that Garmin keeps in the app rather than the API: the
 * feedback phrase under the dial (`hillScoreFeedbackPhraseId`) and the
 * factor sheets' copy. As the phone and the web showed them on 2026-10-11
 * (ref/performance-stats/hill-score/README.md, Rules → Copy), apostrophes
 * typographic.
 *
 * Two of the 21 phrase ids in the history are known: 42 (phone and web) and
 * 4 (web). Every day since 2025-12-18 is one of 4, 42, 43 and 44; the
 * calibrating days are 1. An id not here shows no copy (Inferred), and so
 * does a factor outside the band its copy was seen in.
 *
 * Pure.
 */

/** The feedback phrases by id. */
export const HILL_PHRASES: Readonly<Record<number, string>> = {
	4: "Your VO₂ Max looks good. You’re ready to add more hill training to your workouts.",
	42: "For very hilly areas, it’s okay to alternate between running and hiking when needed.",
};

/** The copy under the dial for a phrase id; undefined for one not captured yet. */
export function hillPhrase(id: number | undefined): string | undefined {
	return id === undefined ? undefined : HILL_PHRASES[id];
}

/** A factor's band on its sheet: Low under 30 (seen), Moderate to 69 and High from 70 (both Inferred). */
export type FactorBand = "low" | "moderate" | "high";

/** The factor sheets' copy, by factor and band: only Low has been seen, for both factors. */
export const FACTOR_COPY: Readonly<Record<"endurance" | "strength", Partial<Record<FactorBand, string>>>> = {
	endurance: { low: "Your training is lacking in hill-specific training at this stage. Try adding more hills at low intensity." },
	strength: { low: "Your training could use more intensity on the hilly stretches of your runs to improve hill strength." },
};
