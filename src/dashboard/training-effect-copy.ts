import { BENEFIT_CATEGORIES, BENEFIT_CLOSING, BENEFIT_MORE } from "./activity-copy";
import type { HelpSection } from "./training-status-copy";

/**
 * Training Effect's words (Performance Stats), which Garmin keeps in the app
 * rather than the API: the phone's of 2026-10-11 and the web's help of the
 * same evening (ref/performance-stats/training-effect/README.md). A detail
 * page's words follow the value's band, not Garmin's message keys: both
 * captured runs carry HIGHLY_IMPROVING_LACTATE_THRESHOLD_13, which the web
 * words "Highly Impacting Lactate Threshold", where the phone writes the
 * 4.0–4.9 band's "Highly Impacting Aerobic Fitness". What neither showed is
 * marked Inferred, and copy never seen is left out rather than guessed.
 *
 * Pure.
 */

/** The two training effects: the charts top to bottom, the detail page's scales. */
export type TeScaleKey = "aerobic" | "anaerobic";

export const TE_SCALES: readonly TeScaleKey[] = ["aerobic", "anaerobic"];

/** Each chart's title, and the label the run page's scales take (`TrainingEffectChart["scales"]`). */
export const SCALE_TITLES: Readonly<Record<TeScaleKey, "Aerobic" | "Anaerobic">> = { aerobic: "Aerobic", anaerobic: "Anaerobic" };

/** The detail page's grouped-list headers, in the phone's capitals. */
export const DETAIL_HEADERS = {
	benefit: "PRIMARY BENEFIT",
	aerobic: "AEROBIC",
	anaerobic: "ANAEROBIC",
	related: "RELATED ACTIVITY",
} as const;

/**
 * The bands, by a value's tenth floored (`teBand`): the web help's table
 * (Overreaching 5.0, Highly Impacting 4.0 - 4.9 … No Benefit 0.0 - 0.9) and
 * the words the web's activity page sets after a value: "4.5 Highly
 * Impacting", "0.2 No Benefit", the treadmill run's "3.7 Impacting".
 */
export const BAND_WORDS = ["No Benefit", "Some Benefit", "Maintaining", "Impacting", "Highly Impacting", "Overreaching"] as const;

/** The top band: a value of 5.0, the scale's end. */
export const TOP_BAND = BAND_WORDS.length - 1;

/**
 * The detail page's title over each scale, by band. Seen on the phone:
 * Aerobic's 4, "Highly Impacting Aerobic Fitness", and Anaerobic's 0, "No
 * Anaerobic Benefit". The rest follow those two (Inferred).
 */
export const SCALE_BAND_TITLES: Readonly<Record<TeScaleKey, readonly string[]>> = {
	aerobic: ["No Aerobic Benefit", "Some Aerobic Benefit", "Maintaining Aerobic Fitness", "Impacting Aerobic Fitness", "Highly Impacting Aerobic Fitness", "Overreaching"],
	anaerobic: ["No Anaerobic Benefit", "Some Anaerobic Benefit", "Maintaining Anaerobic Fitness", "Impacting Anaerobic Fitness", "Highly Impacting Anaerobic Fitness", "Overreaching"],
};

/**
 * The copy under a scale, by band, as the phone breaks it into lines
 * (`phone/7d/sub-detail/01-oct-11.png`). Only Aerobic's 4 and Anaerobic's 0
 * are seen; every other band shows none (TODO.md).
 */
export const SCALE_COPY_LINES: Readonly<Record<TeScaleKey, Readonly<Partial<Record<number, readonly string[]>>>>> = {
	aerobic: {
		4: ["Way to go! You should see a significant increase in", "your cardiorespiratory fitness thanks to this difficult", "aerobic activity."],
	},
	anaerobic: {
		0: ["You did not gain any anaerobic benefit from", "this activity."],
	},
};

/** A band's title over a scale: "Highly Impacting Aerobic Fitness". */
export function bandTitle(key: TeScaleKey, band: number): string {
	return SCALE_BAND_TITLES[key][Math.max(0, Math.min(TOP_BAND, band))]!;
}

/** A band's copy under a scale, as lines; none where its words are unseen. */
export function bandCopyLines(key: TeScaleKey, band: number): readonly string[] | undefined {
	return SCALE_COPY_LINES[key][band];
}

/**
 * What Training Effect is: the web help's first line, and the web's whole
 * page for a period without activities (`web/cycling-7d.png`). The phone's
 * empty period is unseen; the page puts this where the list would be
 * (Inferred).
 */
export const TE_ABOUT = "Training Effect is measured from 0 to 5 and tells you how a specific activity has impacted your overall training.";

/** A band's span as the help's table writes it: "4.0 - 4.9", "5.0". */
function bandSpan(band: number): string {
	return band === TOP_BAND ? `${band}.0` : `${band}.0 - ${band}.9`;
}

/** The help's band table on one line, the top band first, as the web sets it. */
export const BAND_TABLE = BAND_WORDS.map((word, band) => `${word} ${bandSpan(band)}`)
	.reverse()
	.join(" ");

/**
 * The Help sheet (the nav's "Help"; the phone's sheet is unseen, so
 * Inferred): the web report's help dialog (`web/text-help.txt`), verbatim.
 * Its Primary Benefit section is the run page's benefit sheet's words, whose
 * last paragraph the web completes.
 */
export const TE_HELP: { title: string; sections: readonly HelpSection[] } = {
	title: "Training Effect",
	sections: [
		{ parts: [{ paragraphs: [TE_ABOUT] }] },
		{
			title: "Using Training Effect",
			parts: [
				{
					heading: "Planning How You Train",
					paragraphs: [
						"When performed with a compatible Garmin device, each activity will generate a Training Effect score, along with a message that helps you understand how the activity impacted your fitness.",
						"In general, a higher Training Effect indicates a greater impact on your fitness, to a point. A Training Effect of 5.0 can actually be harmful if reached with regularity and without adequate rest and recovery time afterward.",
					],
					note: BAND_TABLE,
				},
				{
					paragraphs: [
						"Training Effect is developed by Garmin Ltd. in partnership with Firstbeat Technologies Ltd., a leading provider of physiological analytics for sports and well-being. The physiologists and engineers at Firstbeat have worked with athletes in the Olympics, NHL, NBA and more to provide innovative training solutions.",
					],
					link: "Firstbeat Technologies Ltd.",
				},
			],
		},
		{
			title: "Aerobic",
			parts: [
				{
					heading: "Improving over the Long Haul",
					paragraphs: [
						"Aerobic Training Effect uses your heart rate to measure how the accumulated intensity of an exercise affects your aerobic fitness. It also indicates if the workout had a maintaining or improving effect on your fitness level. Steady workouts at a moderate effort or workouts involving longer intervals (>180 sec) have a positive impact on aerobic metabolism and produce an aerobic Training Effect.",
						"If you have more than one activity in a day, Garmin Connect will display your highest aerobic Training Effect value in graphs where it appears.",
					],
				},
			],
		},
		{
			title: "Anaerobic",
			parts: [
				{
					heading: "High-Intensity Improvements",
					paragraphs: [
						"Anaerobic Training Effect uses heart rate and speed (or power) to determine how a workout affects your ability to perform at a very high intensity. Repeated high-intensity intervals of 10 to 120 seconds have an especially beneficial impact on your anaerobic capability and result in an anaerobic Training Effect.",
						"If you have more than one activity in a day, Garmin Connect will display your highest anaerobic Training Effect value in graphs where it appears.",
					],
				},
			],
		},
		{
			title: "Primary Benefit",
			parts: [
				{
					heading: "Your Activity’s Training Impact",
					paragraphs: [BENEFIT_MORE],
					note: BENEFIT_CATEGORIES.flatMap((c) => [c.group, ...c.benefits]).join(" "),
				},
				{
					paragraphs: [
						`${BENEFIT_CLOSING} Your primary benefit statement also explains how the activity affected your training load, which is a measure of your effort over the past 7 days.`,
					],
				},
			],
		},
	],
};
