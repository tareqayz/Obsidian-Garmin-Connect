import type { HelpSection } from "./training-status-copy";

/**
 * Running Lactate Threshold's words, which Garmin keeps in the app rather
 * than the API: Current's heading and copy as the phone showed them on
 * 2026-10-11 (the web's Most Recent has the same words), the chart's title,
 * and the Help dialog as the web writes it
 * (ref/performance-stats/running-lactate-threshold/README.md, web/text-help.txt;
 * the phone's Help sheet is unseen, Inferred to match).
 *
 * Pure.
 */

/** Current's heading, under the runner. */
export const CURRENT_TITLE = "Your current threshold";

/** Current's copy as the phone breaks it, two lines centred. */
export const CURRENT_COPY_LINES: readonly string[] = [
	"Based on our most recent estimates, you reach",
	"running lactate threshold at these levels.",
];

/** The same copy as one paragraph. */
export const CURRENT_COPY = CURRENT_COPY_LINES.join(" ");

/** The chart's title on 4w, 12w and 1y, whichever chip is on: heart rate is always drawn. */
export const CHART_TITLE = "Heart Rate";

/** The Help sheet's title. */
export const HELP_TITLE = "Running Lactate Threshold";

/** Current's numbers as the Help's sentence words them: "182 bpm", "4:29 /km", "354 Watts". */
export interface HelpReadings {
	heartRate: string;
	pace: string;
	power: string;
}

/**
 * "Currently, you reach your running lactate threshold when your heart rate
 * during activity is 182 bpm, your pace reaches 4:29 /km and your running
 * power is 354 Watts." Power is "Watts" here, and there is no W/kg.
 */
export function readingsSentence(readings: HelpReadings): string {
	return (
		"Currently, you reach your running lactate threshold when your heart rate during activity is " +
		`${readings.heartRate}, your pace reaches ${readings.pace} and your running power is ${readings.power}.`
	);
}

/**
 * The Help sheet, the web dialog's verbatim with Current's numbers in "About
 * Your Readings". The dialog's last three lines are a bulleted list; they are
 * kept as paragraphs here.
 */
export function ltHelp(readings: HelpReadings): { title: string; sections: readonly HelpSection[] } {
	return {
		title: HELP_TITLE,
		sections: [
			{
				parts: [
					{
						paragraphs: [
							"When training, it’s good to know your limits. The pace, heart rate and power at which you reach your running lactate threshold (LT) are critical metrics for understanding those limits.",
						],
					},
				],
			},
			{
				title: "About Your Readings",
				parts: [
					{
						heading: "Your Lactate Threshold",
						paragraphs: [
							readingsSentence(readings),
							"For continued improvement, the goal is to see your heart rate and power go up and your pace go down over time.",
						],
					},
				],
			},
			{
				title: "What Is LT?",
				parts: [
					{
						heading: "Your Training Limit",
						paragraphs: [
							"Lactate threshold is a valuable measurement for determining your endurance capabilities. It identifies the exercise intensity level at which lactate starts to accumulate in the bloodstream faster than the body can remove it. This can result in rapid fatigue, feelings of nausea, fast breathing, burning muscles and stomach pain.",
							"Normally, there is some level of lactate in your bloodstream. During an activity of increasing pace, heart rate or power, lactate levels begin to build and at a certain point will increase rapidly, negatively impacting performance. The point in your run when this occurs is your lactate threshold.",
						],
					},
					{
						heading: "LT & Training",
						paragraphs: [
							"To help you understand your running lactate threshold better, your Garmin device provides an estimate of the heart rate, pace and power level at which you reach it. Once you know the metrics at which you reach your LT, you can:",
							"Set the proper pace for sustained endurance workouts.",
							"Personalize heart rate or power zones for more effective training.",
							"Monitor progress and seek to improve existing endurance limits.",
						],
					},
				],
			},
		],
	};
}
