import type { HelpSection } from "./training-status-copy";

/**
 * HRV Stress's words, which Garmin keeps in the app rather than the API: the
 * phone's empty line (2026-10-11, no test on the account) and the Help
 * dialog as the web writes it (ref/performance-stats/hrv-stress/README.md,
 * web/text-help.txt; the phone's Help sheet was not shot, Inferred to
 * match).
 *
 * Pure.
 */

/** The nav's title and the Help sheet's. */
export const HRV_STRESS_TITLE = "HRV Stress";

/** A period without a test: the phone's line, no full stop (Blood Pressure's too). */
export const NO_DATA_AVAILABLE = "No data available";

/** A level of the Help's table. */
export type HrvStressLevel = "low" | "moderate" | "high" | "very-high";

/**
 * The Help's table, "HRV Stress" · "Score", lowest first: Low 1-34, Moderate
 * 35-69, High 70-89, Very High 90-100. Lower is readier for hard training.
 */
export const HRV_STRESS_LEVELS: ReadonlyArray<{ id: HrvStressLevel; label: string; min: number; max: number; text: string }> = [
	{ id: "low", label: "Low", min: 1, max: 34, text: "1-34" },
	{ id: "moderate", label: "Moderate", min: 35, max: 69, text: "35-69" },
	{ id: "high", label: "High", min: 70, max: 89, text: "70-89" },
	{ id: "very-high", label: "Very High", min: 90, max: 100, text: "90-100" },
];

/** The table on one line, as the other Help sheets set theirs. */
export const LEVEL_TABLE = HRV_STRESS_LEVELS.map((l) => `${l.label} ${l.text}`).join(" ");

/** The Help sheet: the web dialog's, verbatim, its table as one line (`note`). */
export const HRV_STRESS_HELP: { title: string; sections: readonly HelpSection[] } = {
	title: HRV_STRESS_TITLE,
	sections: [
		{ parts: [{ paragraphs: ["The HRV Stress test gives you a baseline stress reading to determine if your body is ready for training."] }] },
		{
			title: "What Is HRV Stress?",
			parts: [
				{
					heading: "A One-Time Stress Reading",
					paragraphs: [
						"HRV stress is a stress score that is based on heart-rate variability. Heart rate variability is simply the natural variation in time that occurs between each heartbeat. Knowing your HRV stress level can help you decide if your body is ready for a tough training program.",
					],
				},
			],
		},
		{
			title: "About Your Readings",
			parts: [
				{
					heading: "Using Your HRV Stress Reading",
					paragraphs: [
						"If you’re considering a challenging training program, then an HRV stress test may be a good first step to determine if you’re prepared. The stress generated from training, sleep, nutrition and general life can all take their toll on your performance.",
						"HRV stress is rated on a scale of 0 to 100. In general, lower HRV stress scores indicate a greater preparedness for high-impact training.",
					],
					note: LEVEL_TABLE,
				},
			],
		},
		{
			title: "How to Get a Measurement",
			parts: [
				{
					heading: "Receiving a Reading",
					paragraphs: [
						"To perform a HRV stress test, you’ll need a compatible device and a Garmin chest heart rate monitor that’s paired with the device. Follow the instructions on your device or in your device owner’s manual to conduct the test.",
						"We recommend that you measure your HRV stress level daily at approximately the same time and under the same conditions to better compare results from day to day.",
					],
				},
			],
		},
	],
};
