import { NO_DATA, TRAINING_STATUS_HELP, type HelpSection } from "./training-status-copy";

/**
 * The Heat Acclimation page's wording, which the API does not send: the trend
 * line under the %, the copy under it, the chart's title and key, and the
 * Help sheet. From the phone shots of 2026-10-11 and the web dialog
 * (ref/performance-stats/heat-acclimation/README.md).
 *
 * - "Trending up from 79%." is the one trend line seen. DEACCLIMATIZING's
 *   "Trending down from …%." follows the web's "Trending Up from 79%" by
 *   symmetry, and ACCLIMATIZED's "Maintaining acclimation." is Home's card
 *   sentence for that trend (both Inferred).
 * - The copy is ACCLIMATIZING's, as the phone words it ("…changes in
 *   temperature."; the web dialog says "…changes in heat."). "22°C" is a
 *   fixed threshold, the Training Status help's "22°C or greater", not a
 *   field: imperial accounts read 72°F (71.6 °F, Inferred). The other trends'
 *   copy is unseen, so they have none.
 *
 * Pure.
 */

export { NO_DATA };

/** The page's title, and the key under its chart. */
export const HEAT_ACCLIMATION = "Heat Acclimation";
/** The 7d / 4w chart's title. */
export const DAILY_PROGRESS = "Daily Progress";

/** The heat the copy names, by the account's units: 22 °C, 71.6 °F rounded (Inferred). */
export const HEAT_THRESHOLD: Readonly<Record<"metric" | "imperial", string>> = { metric: "22°C", imperial: "72°F" };

export const ACCLIMATIZING = "ACCLIMATIZING";
export const ACCLIMATIZED = "ACCLIMATIZED";
export const DEACCLIMATIZING = "DEACCLIMATIZING";

/** Home's At a Glance sentences (`glance.ts`): ACCLIMATIZED's stands on the page; the others only when the reading before is missing. */
const HOME_WORDS: Readonly<Record<string, string>> = {
	[ACCLIMATIZING]: "Improving acclimation.",
	[ACCLIMATIZED]: "Maintaining acclimation.",
	[DEACCLIMATIZING]: "Losing acclimation.",
};

const keyOf = (trend: string | undefined) => trend?.trim().toUpperCase();

/**
 * The grey line under the %, by Garmin's trend: "Trending up from 79%."
 * (seen), "Trending down from 100%." and "Maintaining acclimation."
 * (Inferred). None without a trend (0 %) or for one never seen. Without the
 * reading before, Home's words for the trend (never seen).
 */
export function trendLine(trend: string | undefined, prev: number | undefined): string | undefined {
	const key = keyOf(trend);
	if (key === ACCLIMATIZING && prev !== undefined) return `Trending up from ${prev}%.`;
	if (key === DEACCLIMATIZING && prev !== undefined) return `Trending down from ${prev}%.`;
	return key ? HOME_WORDS[key] : undefined;
}

/** The copy under the trend line: ACCLIMATIZING's, with the threshold in the account's units; none for the other trends (unseen). */
export function heatCopy(trend: string | undefined, units: "metric" | "imperial" = "metric"): string | undefined {
	if (keyOf(trend) !== ACCLIMATIZING) return undefined;
	return `Keep training outdoors at temperatures of ${HEAT_THRESHOLD[units]} or higher to continue trending up. Your training status is automatically adjusted for changes in temperature.`;
}

/**
 * The Help sheet: the Training Status help's "Heat Acclimation" section,
 * verbatim (`training-status-copy.ts`). The phone's own sheet is unseen
 * (Inferred).
 */
export const HEAT_ACCLIMATION_HELP: readonly HelpSection[] = TRAINING_STATUS_HELP.filter((section) => section.title === HEAT_ACCLIMATION);
