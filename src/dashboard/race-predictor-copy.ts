/**
 * Race Predictor's words, which Garmin keeps in the app rather than the API:
 * Current's heading and copy as the phone showed them on 2026-10-11 (the web's
 * Most Recent has the same words), and the Help dialog as the web writes it
 * (ref/performance-stats/race-predictor/README.md; the phone's Help is
 * unseen, Inferred to match).
 *
 * Pure.
 */

/** Current's heading, under the runner. */
export const CURRENT_TITLE = "Your Predictions";

/**
 * Current's copy as the phone breaks it, four lines centred; the twin keeps
 * the same four in a pane's 370 pt column (535:41–44, 537:1314–1317).
 */
export const CURRENT_COPY_LINES: readonly string[] = [
	"Based on your current performance, we predict",
	"that you can complete these race distances with",
	"the following times. The more runs you track, the",
	"more accurate the predictions will become.",
];

/** The same copy as one paragraph. */
export const CURRENT_COPY = CURRENT_COPY_LINES.join(" ");

/** The chart's title on 4w, 6m and 1y; no unit appears anywhere on the chart. */
export const CHART_TITLE = "Pace";

/** A part of the Help sheet: an optional heading over its paragraphs. */
export interface HelpSection {
	heading?: string;
	paragraphs: readonly string[];
}

/** The Help sheet, verbatim from the web's dialog (the web writes "5K", "10K" here). */
export const RACE_HELP: { title: string; sections: readonly HelpSection[] } = {
	title: "Race Predictor",
	sections: [
		{
			paragraphs: [
				"Race Predictor uses your training history and VO₂ Max to predict your performance in popular race distances.",
				"As you record outdoor runs with your Garmin device, you will begin to receive predictions for 5K, 10K, half marathon and marathon race distances. Your watch analyzes several weeks of training data to refine the estimates. The more runs you track, the more accurate the predictions will become. The predictions are based on ideal conditions and do not factor in weather, course difficulty and other variables.",
			],
		},
		{
			heading: "Race Predictor in Garmin Connect",
			paragraphs: [
				"In Garmin Connect, you can view your current race predictions and also track how predictions change over time. This can be a valuable tool for monitoring your training and making adjustments to achieve peak performance for upcoming races.",
			],
		},
	],
};
