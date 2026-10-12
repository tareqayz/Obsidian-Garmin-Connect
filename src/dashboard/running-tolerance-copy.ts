import type { HelpPart, HelpSection } from "./training-status-copy";

/**
 * Running Tolerance's words that Garmin keeps in the app rather than the API:
 * the title and copy for each feedback phrase key under the ring
 * (`runningToleranceFeedBackPhrase`), and the Help sheet, as the phone and
 * the web showed them on 2026-10-11
 * (ref/performance-stats/running-tolerance/README.md, Rules → Copy and
 * Inferred 9; the phone's Help is unseen, Inferred to match the web's).
 *
 * Eight keys were sent from 2025-08-17 to 2026-10-12; only MEDIUM_LOAD's
 * words were on a screen. The key cannot be told from the load's share of the
 * tolerance (MEDIUM_LOAD spans 0.27 to 1.16), so the page always shows
 * Garmin's; a key not here shows no title and no copy (Inferred).
 *
 * Pure.
 */

/** What the page writes under the ring for a phrase key. */
export interface TolerancePhrase {
	/** "Medium impact load". */
	title: string;
	/** The paragraph under it. */
	copy: string;
}

/** The phrase keys seen in the daily rows, 2025-08-17 → 2026-10-12. */
export const TOLERANCE_PHRASE_KEYS = [
	"MEDIUM_LOAD",
	"LOW_LOAD_1DAYS",
	"LOW_LOAD_7DAYS",
	"LOW_LOAD_14DAYS",
	"LOW_LOAD_28DAYS",
	"HIGH_LOAD",
	"HIGH_LOAD_WAS_ABOVE_TOLERANCE",
	"ABOVE_TOLERANCE",
] as const;

/** The phrases whose words are known. The other seven keys' are unseen (Inferred 4). */
export const TOLERANCE_PHRASES: Readonly<Record<string, TolerancePhrase>> = {
	MEDIUM_LOAD: {
		title: "Medium impact load",
		copy: "Your impact load is within a good range. If you want to build tolerance, focus on increasing running distance or intensity gradually over time.",
	},
};

/** The title and copy for a phrase key; undefined for one not captured yet. */
export function tolerancePhrase(key: string | undefined): TolerancePhrase | undefined {
	return key === undefined ? undefined : TOLERANCE_PHRASES[key];
}

/** A part of a Help section: the web sets a smaller heading under some parts' headings. */
export interface ToleranceHelpPart extends HelpPart {
	subheading?: string;
}

export interface ToleranceHelpSection extends HelpSection {
	parts: readonly ToleranceHelpPart[];
}

/** The Help sheet's title. */
export const TOLERANCE_HELP_TITLE = "Running Tolerance";

/** The paragraph over the sections. */
export const TOLERANCE_HELP_INTRO =
	"Running tolerance tracks your capacity to handle the real impact running has on your body and provides insights to help you train smarter and stay healthy.";

/**
 * The Help sheet's three sections, each an expanding row on the web,
 * verbatim from its dialog (`web/text-help.txt`; "than can" is Garmin's).
 */
export const TOLERANCE_HELP: readonly ToleranceHelpSection[] = [
	{
		title: "About Running Tolerance",
		parts: [
			{
				heading: "What Is Running Tolerance?",
				subheading: "Running is a high-impact activity than can put a lot of stress on the body.",
				paragraphs: [
					"The running tolerance feature quantifies your biomechanical load accumulation using relevant data from your compatible Garmin device to determine your personal threshold for how much training you can tolerate while balancing risk of injury with performance gains. The threshold is represented as your weekly tolerance, a value for you to compare your actual impact load against.",
				],
			},
		],
	},
	{
		title: "Weekly Tolerance",
		parts: [
			{
				heading: "Weekly Running Tolerance",
				subheading: "Your weekly tolerance limit is based on individual running habits and fitness level.",
				paragraphs: [
					"The more you run and the fitter you are, the higher your running tolerance will be. You could increase your tolerance by running more, but you also must be careful not to ramp up your volume too quickly as that increases the risk of injury. Therein lies the value of running tolerance: When you know your tolerance limit, you can make better short- and long-term training decisions.",
				],
			},
			{
				heading: "Know Your Limits",
				paragraphs: [
					"With running tolerance, you can see the influence of individual runs, as well as the cumulative effects of your weekly and monthly mileage. All of this provides a path for smarter loading strategies, helping you know when to adjust your training load to balance injury risk with making performance gains.",
				],
			},
		],
	},
	{
		title: "What Is Impact Load?",
		parts: [
			{
				heading: "Understanding Impact Load",
				subheading: "Impact load miles or kilometers represent how strenuous a run is compared to your baseline mile or kilometer.",
				paragraphs: ["One baseline mile or kilometer is roughly equivalent to one mile or kilometer of running at an easy intensity on a normal, flat surface."],
			},
			{
				heading: "Impact Load and Actual Distance",
				paragraphs: [
					"Impact load considers factors like running intensity, whether you’re running uphill or downhill and your running dynamics to calculate the cumulative impact of a run. For example, if your 5-kilometer run has an impact load of 8 baseline Kilometers (km), the actual strain experienced during the run would be equal to running 8 Kilometers (km) at your baseline level. Similarly, if you ran 5 Kilometers (km) at an easy intensity on flat, normal ground, impact load would accumulate at the same rate as the actual distance.",
					"The impact load factor chart within an individual run activity represents the scale at which impact load accrues more or less compared to your baseline distance due to changes in speed, grade, terrain, etc. during your run.",
				],
			},
			{
				heading: "Acute Impact Load",
				paragraphs: [
					"Acute impact load is a weighted sum that represents your current biomechanical load accumulation based on your recent running activities. It helps quantify your most recent training and the amount of strain placed on your body. Your acute impact load is a helpful indicator for the capacity you have to run that day, particularly in the context of your weekly running tolerance. For example, if you go a few days without running, your cumulative strain will decrease as you’ve had time to recover, bringing down your acute impact load and giving you more headroom to run.",
					"Viewing impact load by training week or within your weekly totals provides a calendar-week measure of the cumulative impact load from your running activities. This metric is not a weighted calculation and can differ from your acute impact load. Monitoring your impact load week over longer periods of time can help you assess how your running tolerance and training are progressing.",
				],
			},
		],
	},
];
