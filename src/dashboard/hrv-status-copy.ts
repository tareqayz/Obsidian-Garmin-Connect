import type { Tone } from "./gauges";

/**
 * The words on the HRV Status page that come from a Garmin key rather than a
 * number: the status, its colour and chart mark, the sentence under it, the
 * empty state and the Help sheet (ref/performance-stats/hrv-status/README.md).
 *
 * Garmin sends `status` and `feedbackPhrase` keys and the app looks the
 * wording up in its own table, which the API does not serve. Only wording
 * read off the phone or the web is keyed here: `HRV_BALANCED_6` (phone and
 * web) and `HRV_BALANCED_5` (web). Any other key gets a sentence of the Help
 * sheet's own for its status (Inferred), so a night still reads sensibly.
 *
 * Pure.
 */

/** A status's word, colour and its mark on the 7-day Averages chart. */
export interface HrvStatusLook {
	status: string;
	word: string;
	tone: Tone;
	shape: "circle" | "square" | "triangle";
}

/**
 * The statuses in the legend's order. BALANCED, UNBALANCED and LOW as seen;
 * POOR is named in the Help but never sent to this account: its word is the
 * Help's, its colour and mark Inferred.
 */
export const HRV_STATUSES: readonly HrvStatusLook[] = [
	{ status: "BALANCED", word: "Balanced", tone: "green", shape: "circle" },
	{ status: "UNBALANCED", word: "Unbalanced", tone: "orange", shape: "square" },
	{ status: "LOW", word: "Low", tone: "red", shape: "triangle" },
	{ status: "POOR", word: "Poor", tone: "red", shape: "triangle" },
];

/** A status as the page shows it; none for `NONE` (onboarding) or a key it does not know. */
export function statusLook(status: string | undefined): HrvStatusLook | undefined {
	const key = status?.trim().toUpperCase();
	return HRV_STATUSES.find((s) => s.status === key);
}

/** The Help's onboarding sentence: the line for a night without a status yet (Inferred). */
export const ONBOARDING_COPY =
	"To receive an HRV baseline and HRV status, wear your compatible Garmin device while sleeping on most days for approximately 3 consecutive weeks.";

/** Wording read off the app, by `feedbackPhrase`. */
const COPY: Readonly<Record<string, string>> = {
	HRV_BALANCED_5: "Your HRV looks good! Balanced HRV status indicates that your training load and recovery are in symmetry.",
	HRV_BALANCED_6: "Balanced HRV is a sign that your body, and thus your nervous system, have had adequate time to recover.",
};

/** The Help's sentences about a reading, for the keys whose wording is unseen (Inferred). */
const BY_STATUS: Readonly<Record<string, string>> = {
	BALANCED:
		"Balanced HRV readings may indicate positive signs of health such as good training and recovery balance, greater cardiovascular fitness and more resilience to stress.",
	UNBALANCED: "Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, among other factors.",
	LOW: "Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, among other factors.",
	POOR: "Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, among other factors.",
};

/**
 * The sentence under the status: the app's own for a key it was seen with,
 * the Help's onboarding line while onboarding, else the Help's sentence for
 * the status. None for a night with neither.
 */
export function hrvCopy(feedback: string | undefined, status: string | undefined): string | undefined {
	const key = feedback?.trim().toUpperCase();
	if (key && COPY[key]) return COPY[key];
	if (key?.startsWith("ONBOARDING") || status?.trim().toUpperCase() === "NONE") return ONBOARDING_COPY;
	return status ? BY_STATUS[status.trim().toUpperCase()] : undefined;
}

/** The web's empty state, in place of the dial or the chart: a night or a period without a row. */
export const NO_DATA = { title: "No HRV status data", text: "You have no data for this time period." } as const;

/** The Help sheet (title "HRV Status"), from the web's dialog, verbatim. Its two links are `link`. */
export const HRV_HELP: ReadonlyArray<{ heading?: string; paragraphs: readonly string[]; link?: string }> = [
	{
		paragraphs: [
			"Heart rate variability (HRV) is a statistical measure of the specific changes in time between successive heartbeats. Garmin's HRV status measurement is taken while you sleep, and it provides a 7-day average of your HRV in comparison to your personal HRV baseline.",
		],
	},
	{
		heading: "Receiving an HRV Status",
		paragraphs: [
			"To receive an HRV baseline and HRV status, wear your compatible Garmin device while sleeping on most days for approximately 3 consecutive weeks. Your HRV baseline, which is a personalized measurement of your typical HRV ranges at night, will become more accurate over time as you continue to wear your device.",
		],
		link: "Learn more about the value of consistent sleep-tracking.",
	},
	{
		paragraphs: [
			"After you sync your device, you will receive a timeline of your HRV in Garmin Connect for each period of sleep, as well as an assessment of whether your 7-day HRV average is balanced, unbalanced or low compared to your baseline. HRV status can also be rated as poor if it is well below normal ranges for your age. Over time, Garmin Connect generates 7-day and 4-week HRV status reports to help you recognize trends.",
		],
	},
	{
		heading: "About Your HRV Status Reading",
		paragraphs: [
			"HRV status offers an indication of how your autonomic nervous system is reacting to your environment, both physically and psychologically. Balanced HRV readings may indicate positive signs of health such as good training and recovery balance, greater cardiovascular fitness and more resilience to stress. Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, among other factors.",
			"While variations in day-to-day HRV readings are normal, having a stable, consistent 7-day HRV average is the key to maintaining a balanced HRV status. Small, gradual increases in HRV can also help you maintain a balanced status and may be a sign of improving fitness. HRV readings that increase or decrease rapidly may indicate that you are training too hard and can cause an unbalanced HRV status.",
			"In some cases, HRV status can be improved over time by improving your training and recovery balance, getting regular exercise, eating a healthy diet, reducing stress and adopting other healthy habits. HRV values can vary widely based on gender, age, fitness level and even from person to person.",
		],
		link: "Learn More from Frontiers in Public Health",
	},
];
