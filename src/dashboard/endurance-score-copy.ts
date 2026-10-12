/**
 * Endurance Score's words that Garmin keeps in the app rather than the API:
 * the feedback phrase under the dial (`feedbackPhrase`) and the Help sheet,
 * as the phone and the web showed them on 2026-10-11
 * (ref/performance-stats/endurance-score/README.md, Rules → Copy and
 * Inferred 11; the phone's Help is unseen, Inferred to match the web's).
 *
 * One of the twelve phrase ids sampled is known: 55, on the phone, the web
 * and the web's Oct 10. The phrase follows the four-week trend, not the class
 * (55 comes with classes 3 and 4). An id not here shows no copy (Inferred).
 *
 * Pure.
 */

/** The feedback phrases by id. */
export const ENDURANCE_PHRASES: Readonly<Record<number, string>> = {
	55: "Your endurance score has remained stable over the last four weeks. Focus on gradual increases in training frequency, volume and number of long workouts to improve.",
};

/** The copy under the dial for a phrase id; undefined for one not captured yet. */
export function endurancePhrase(id: number | undefined): string | undefined {
	return id === undefined ? undefined : ENDURANCE_PHRASES[id];
}

/** A part of the Help sheet: an optional heading over its paragraphs, and a bulleted list. */
export interface EnduranceHelpSection {
	heading?: string;
	paragraphs: readonly string[];
	list?: readonly string[];
}

/** The Help sheet's title. */
export const HELP_TITLE = "Endurance Score";

/** The paragraph over the class table. */
export const HELP_CLASSES_INTRO =
	"Endurance score is an indication of your ability to sustain physical activity for an extended period of time. Your endurance score can fall into one of the following categories:";

/**
 * The Help sheet after the class table, verbatim from the web's dialog: a
 * paragraph, then four sections the web folds under their headings.
 */
export const ENDURANCE_HELP: readonly EnduranceHelpSection[] = [
	{
		paragraphs: [
			"This rating is accompanied by feedback that explains how your current endurance score is trending based on your previous four weeks of data and provides suggestions on how to maintain or improve it.",
		],
	},
	{
		heading: "Receiving an endurance score",
		paragraphs: [
			"To receive an endurance score, track your activities for two weeks using a compatible Garmin watch. All recorded activity types are factored into your estimate, but aerobic activities especially help contribute to your score. The estimate becomes more accurate as you track more activities.",
		],
	},
	{
		heading: "Calculating your endurance score",
		paragraphs: [
			"It takes time and regular, consistent effort to develop and reinforce your endurance base. The peak benefits of endurance training, however, can be lost during a relatively short period of inactivity or by doing fewer endurance-building activities. As a result, both long- and short-term training perspectives are factored into your endurance score calculation to reliably reflect your current estimate.",
			"Your longer duration activities carry special consideration when calculating endurance score, and they boost your estimate more than shorter activities will. Individual activities influence your score through the broader context of your overall activity history, which better informs how your exercise patterns support your capacity for endurance.",
			"Activity impact is based on the following factors:",
		],
		list: [
			"Activity duration and intensity",
			"Speed and power (when available)",
			"VO₂ max (a measure of the volume of oxygen you are consuming at peak performance)",
			"Age, gender, BMI and activity level (when VO₂ max is not available)",
		],
	},
	{
		heading: "Endurance score contributors",
		paragraphs: [
			"We surface your top three contributing activity types based on which categories have impacted your endurance score the most. Your endurance score should translate broadly across different types of activities. However, keep in mind that your estimate may be more specific to the types of activities you perform the most. For example, if you swim a lot and rarely cycle, your endurance score will be more indicative of what you can achieve in the pool rather than on a bike.",
		],
	},
	{
		heading: "About your endurance score",
		paragraphs: [
			"Endurance score is a valuable metric for monitoring your progress over time. This can help you optimize your fitness and training moving forward. The dynamic feedback phrases will also provide insights on things that you can work on to improve your endurance score in the future.",
		],
	},
];
