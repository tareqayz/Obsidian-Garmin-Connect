import { titleCase } from "./day";

/**
 * The words on the Training Status page that come from a Garmin key rather
 * than a number: the status, the coaching copy under it, Load Focus, the load
 * and VO₂ Max trend lines, the empty states and the Help sheet
 * (ref/performance-stats/training-status/README.md).
 *
 * Garmin sends codes and phrase keys and the app looks the wording up in its
 * own tables, which the API does not serve. Only wording read off the phone
 * or the web is keyed here: the copy of `MAINTAINING_2` (phone and web,
 * verbatim) and the Load Focus words of `AEROBIC_LOW_SHORTAGE`. The rest is
 * Inferred from Garmin's own spelling of the key, and an unknown phrase shows
 * no copy at all.
 *
 * Pure.
 */

/**
 * A status as the page colours it: `PERFORMANCE_STATUS_COLOR`'s keys
 * (src/ui/svelte/health/performance-colors.ts). Overreaching keeps its own
 * red, apart from Strained's magenta, though Home's `statusTone` merges them.
 */
export type TrainingStatusKey =
	| "productive"
	| "peaking"
	| "maintaining"
	| "recovery"
	| "unproductive"
	| "detraining"
	| "strained"
	| "overreaching"
	| "none"
	| "paused";

/** Garmin's `trainingStatus` codes (0–8), one to one with the phrase's prefix. */
export const STATUS_BY_CODE: readonly TrainingStatusKey[] = [
	"none",
	"detraining",
	"unproductive",
	"overreaching",
	"maintaining",
	"recovery",
	"peaking",
	"productive",
	"strained",
];

/** Each status as the page writes it. Paused is the Help's word; the app never showed it here (Inferred). */
export const STATUS_WORDS: Readonly<Record<TrainingStatusKey, string>> = {
	productive: "Productive",
	peaking: "Peaking",
	maintaining: "Maintaining",
	recovery: "Recovery",
	unproductive: "Unproductive",
	detraining: "Detraining",
	strained: "Strained",
	overreaching: "Overreaching",
	none: "No Status",
	paused: "Paused",
};

/** A phrase's status: its key less the copy's number (`PRODUCTIVE_10`, `DETRAINING`, `NO_STATUS_1`). */
export function statusOfPhrase(phrase: string | undefined): TrainingStatusKey | undefined {
	const prefix = phrase?.trim().toUpperCase().replace(/_\d+$/, "");
	if (!prefix) return undefined;
	const index = PHRASE_PREFIXES.indexOf(prefix);
	return index >= 0 ? STATUS_BY_CODE[index] : undefined;
}

/** `STATUS_BY_CODE` as Garmin spells it in the phrase keys. */
const PHRASE_PREFIXES = ["NO_STATUS", "DETRAINING", "UNPRODUCTIVE", "OVERREACHING", "MAINTAINING", "RECOVERY", "PEAKING", "PRODUCTIVE", "STRAINED"];

/**
 * The badge's glyph: a runner in front of three rising bars, seen in the
 * Maintaining badge on the phone and on the web. Whether it changes with the
 * status is unseen, so every status has it (Inferred).
 */
export type TrainingStatusIcon = "runner-bars";
export const STATUS_ICON: TrainingStatusIcon = "runner-bars";

/** The coaching copy under the status, by the full phrase. Only `MAINTAINING_2` was seen; 27 more keys are in the history. */
const COPY: Readonly<Record<string, string>> = {
	MAINTAINING_2:
		"Your current training load is sufficient to maintain your fitness. To see improvement, try varying the intensity of your activities between low aerobic, high aerobic and anaerobic.",
};

/** The copy for a phrase; none for a phrase whose wording is unseen. */
export function statusCopy(phrase: string | undefined): string | undefined {
	const key = phrase?.trim().toUpperCase();
	return key ? COPY[key] : undefined;
}

/**
 * Load Focus's words by `load_focus` (`trainingBalanceFeedbackPhrase`):
 * "Low Aerobic Shortage" was seen; the rest follow Garmin's key the same way
 * (Inferred), and At a Glance's Load Focus card spells the first four alike.
 */
export const LOAD_FOCUS_WORDS: Readonly<Record<string, string>> = {
	AEROBIC_LOW_SHORTAGE: "Low Aerobic Shortage",
	AEROBIC_HIGH_SHORTAGE: "High Aerobic Shortage",
	ANAEROBIC_SHORTAGE: "Anaerobic Shortage",
	AEROBIC_LOW_FOCUS: "Low Aerobic Focus",
	AEROBIC_HIGH_FOCUS: "High Aerobic Focus",
	BALANCED: "Balanced",
	ABOVE_TARGETS: "Above Targets",
};

/** "Load Focus - Low Aerobic Shortage"; none without a phrase. An unknown phrase is its own words, capitalised. */
export function loadFocusLine(phrase: string | undefined): string | undefined {
	const key = phrase?.trim().toUpperCase();
	if (!key) return undefined;
	const words = LOAD_FOCUS_WORDS[key] ?? titleCase(key);
	return words ? `Load Focus - ${words}` : undefined;
}

/** The load's word by `acwrStatus`: "Optimal" seen, the rest Inferred; none for `NONE` (No Status days). */
export const LOAD_WORDS: Readonly<Record<string, string>> = { LOW: "Low", OPTIMAL: "Optimal", HIGH: "High", VERY_HIGH: "Very High" };

/** "Based on your Running VO₂ Max Trend" for `RUNNING`; Cycling's alike (Inferred); none for `NONE` or nothing. */
export function basedOnLine(sport: string | undefined): string | undefined {
	const key = sport?.trim().toUpperCase();
	if (key === "RUNNING") return "Based on your Running VO₂ Max Trend";
	if (key === "CYCLING") return "Based on your Cycling VO₂ Max Trend";
	return undefined;
}

/** A range's empty state, the web's line (the other specs' too). */
export const NO_DATA = "You have no data for this time period.";

/** Current without any row: the Help's "Receiving Training Status" in place of the copy (Inferred). */
export const NO_STATUS_YET = {
	title: "How to Get Training Status",
	text: "To get a current status, record at least two weeks of running or cycling activities with VO2 Max data using a compatible Garmin device. Runs must be recorded outdoors with GPS tracking. Cycling can take place indoors or outdoors, but the rides must be done using a power meter.",
} as const;

/** A part of a Help section: its heading, paragraphs, a one-line list or table, and a link under it. */
export interface HelpPart {
	heading?: string;
	paragraphs: readonly string[];
	/** A list or a table the web sets as one line: the statuses, the VO₂ Max classes. */
	note?: string;
	/** A link's words; where it goes is the page's business. */
	link?: string;
}

/** One section of the Help sheet: an expanding row on the web, its parts inside. The first has no title. */
export interface HelpSection {
	title?: string;
	parts: readonly HelpPart[];
}

/**
 * The Help sheet (title "Training Status"), the web dialog's verbatim
 * (`web/text-help.txt`, 2026-10-11): the phone's sheet is unseen (Inferred).
 */
export const TRAINING_STATUS_HELP: readonly HelpSection[] = [
	{
		parts: [
			{
				paragraphs: [
					"You can use Training Status as a guide for understanding your overall training and how it is impacting your fitness.",
				],
			},
		],
	},
	{
		title: "About Your Training Status",
		parts: [
			{
				heading: "Know Where You Stand",
				paragraphs: [
					"As you track activities with your Garmin device, your Training Status will change based on your acute training load, heart rate variability (HRV) and VO₂ Max. Training Status can fall into the following categories.",
					"Each training status is accompanied by a coaching message that explains why you received the status, and what you can do to either improve or maintain it. You can also learn more about what impacts your status, such as VO₂ Max, HRV status and acute training load. Training Status is an excellent guide for keeping training on the right track.",
				],
				note: "Overreaching Peaking Productive Maintaining Recovery Strained Unproductive Detraining No Status Paused",
			},
		],
	},
	{
		title: "VO₂ Max",
		parts: [
			{
				heading: "A Window into Your Fitness",
				paragraphs: [
					"VO₂ Max is an indication of your cardiovascular fitness and should increase as your level of fitness improves. VO₂ Max is the maximum volume of oxygen (in milliliters) you can consume per minute per kilogram of body weight at your maximum performance. Your compatible Garmin device uses heart rate and exercise data to estimate your VO₂ Max.",
				],
			},
			{
				heading: "VO₂ Max & Training Status",
				paragraphs: [
					"Your dominant VO₂ Max reading is used to determine Training Status. So if you’ve had more cycling activities than runs recently, Training Status will be calculated using cycling VO₂ Max.",
					"Both heat and altitude can impact your VO₂ Max reading. You might see lower than normal VO₂ Max readings when training at altitude (800 Meters (m) or higher). Your VO₂ Max is adjusted when training in the heat, so you might not see as dramatic a decrease as you would expect.",
				],
				note: "Superior 55.4 and up Excellent 51.1 to 55.4 Good 45.4 to 51.1 Fair 41.7 to 45.4 Poor 41.7 and below",
			},
			{
				paragraphs: [
					"VO₂ Max data used with permission from The Cooper Institute®, Dallas, Texas.",
				],
				link: "The Cooper Institute®",
			},
		],
	},
	{
		title: "HRV Status",
		parts: [
			{
				heading: "Your 7-Day Average",
				paragraphs: [
					"Heart rate variability (HRV) is a statistical measure of the specific changes in time between successive heartbeats. Garmin’s HRV status measurement is taken while you sleep, and it provides a 7-day average of your HRV in comparison to your personal HRV baseline.",
				],
			},
			{
				heading: "Receiving an HRV Status",
				paragraphs: [
					"To receive an HRV baseline and HRV status, wear your compatible Garmin device while sleeping on most days for approximately 3 consecutive weeks. Your HRV baseline, which is a personalized measurement of your typical HRV ranges at night, will become more accurate over time as you continue to wear your device.",
				],
			},
			{
				heading: "HRV & Training Status",
				paragraphs: [
					"HRV status is used to calculate your Training Status because it offers an indication of how your autonomic nervous system is reacting to your training. Balanced HRV readings may indicate good training and recovery balance, greater cardiovascular fitness and resilience to stress, so they will positively impact Training Status. Unbalanced, low or poor readings may be a sign of fatigue, greater recovery needs or increased stress, so they may cause Training Status to decline.",
					"While variations in day-to-day HRV readings are normal, having a stable, consistent 7-day HRV average is the key to maintaining a balanced HRV status. Small, gradual increases in HRV can also help you maintain a balanced status and may be a sign of improving fitness. HRV readings that increase or decrease rapidly may indicate that you are training too hard and can cause an unbalanced HRV status.",
					"In some cases, HRV status can be improved over time by improving your training and recovery balance, getting regular exercise, eating a healthy diet, reducing stress and adopting other healthy habits. HRV values can vary widely based on gender, age, fitness level and even from person to person.",
				],
				link: "Learn More from Frontiers in Public Health",
			},
		],
	},
	{
		title: "Acute Training Load",
		parts: [
			{
				heading: "A Measure of Your Effort",
				paragraphs: [
					"Acute training load is a measurement of your effort that is calculated based on recent exercise load scores. It takes into account exercise duration and intensity.",
				],
			},
			{
				heading: "How We Calculate Training Load",
				paragraphs: [
					"Each activity that you track with your Garmin device receives an exercise load score, which is a measure of how much work your body has to do to recover from the activity. It’s based on excess post-exercise oxygen consumption, or EPOC. The longer or more intense the activity, the higher the score.",
					"Your acute training load number is simply a weighted sum of your recent exercise load scores. This total is then rated as low, optimal or high based on your fitness level and training history.",
				],
			},
			{
				heading: "Load Ratio",
				paragraphs: [
					"Your load ratio is a comparison of your short-term (acute) and long-term (chronic) training load. This ratio is useful for monitoring changes in your training load over time. Just as with acute training load, it’s best to keep your load ratio in an optimal range.",
				],
			},
		],
	},
	{
		title: "Training Load Focus",
		parts: [
			{
				heading: "An In-Depth Look at Your Training",
				paragraphs: [
					"Once it has a week of data, your Garmin device can determine your Training Load Focus, which is an estimate of how your training load totals measure up for the three main activity types: low aerobic, high aerobic and anaerobic. Training load focus will tell you how many of your training load “points” went to each activity type, and how close you are to the optimal range for each. We also provide a message that informs you of your overall Training Load Focus, and what you can do to change or maintain it.",
				],
			},
			{
				heading: "Using Your Focus",
				paragraphs: [
					"Once you know your focus, you can modify your activities for more effective training. For example, you can run sprints to add anaerobic exercises, or go on a long, slow bike ride to fill up your low aerobic bucket. Having a balanced Training Load Focus is ideal to prevent training monotony and optimize the effectiveness of your training.",
				],
			},
		],
	},
	{
		title: "Altitude Acclimation",
		parts: [
			{
				heading: "Reaching New Heights",
				paragraphs: [
					"Altitude acclimation measures in Meters (m) how well you are adjusting to altitude during training.",
				],
			},
			{
				heading: "Acclimation Basics",
				paragraphs: [
					"When you train at altitude (800 Meters (m) or higher), your device will record your acclimation and adjust your Training Status measurements to compensate for the altitude. For example, you may see a drop in your VO₂ Max at higher altitudes, but your Training Status will adjust based on the altitude and may continue to show “Productive,” even as you are feeling an active decrease in your fitness.",
				],
			},
			{
				heading: "How to Acclimate",
				paragraphs: [
					"To acclimate fully to a new altitude, you’ll need to spend at least 21 days there (this includes both training and rest days). Training at higher altitudes can lead to faster acclimation for lower altitudes, but it’s important to acclimate safely. To do so, stay well hydrated, avoid strenuous activities for the first several days at altitude and increase altitude gradually.",
					"Acclimation tends to occur quickly at the beginning of altitude exposure but then increases more slowly over time. Our maximum altitude acclimation measurement occurs around 4,000 Meters (m). Upon returning to lower altitude, your acclimation will begin to decline immediately and will be lost entirely in 21-28 days.",
				],
			},
		],
	},
	{
		title: "Heat Acclimation",
		parts: [
			{
				heading: "Adjusting to the Heat",
				paragraphs: [
					"Heat acclimation measures on a scale of 0-100% how well you are adjusting to heat during training.",
				],
			},
			{
				heading: "Acclimation Basics",
				paragraphs: [
					"When you train in the heat (22°C or greater), your device will record your acclimation and adjust your Training Status and VO₂ Max to compensate for the heat. Therefore, though you may feel much less fit during a hot workout, you may see only a slight decrease in VO₂ Max or even an increase.",
				],
			},
			{
				heading: "How to Acclimate",
				paragraphs: [
					"To achieve full heat acclimation, you’ll need to train in the heat for at least 4 days (non-training days do not impact heat acclimation). Acclimation occurs faster in hotter climates and when the intensity of the workout is higher. Your heat acclimation typically begins to decline after 3 days without training in the heat.",
					"Heat acclimation uses GPS and weather data from your phone to determine the activity’s temperature and humidity data. For best results, make sure your watch has a Bluetooth connection with your smartphone before you go out to run or ride.",
				],
			},
		],
	},
	{
		title: "Receiving Training Status",
		parts: [
			{
				heading: "How to Get Training Status",
				paragraphs: [
					NO_STATUS_YET.text,
					"Training Status is available for users with a compatible Garmin device. To give your training a boost, Garmin Connect will also provide Training Status when you upload qualifying activities from your other Garmin devices, as well as from the Tacx Training app or select third-party applications. If you remove your compatible device from Garmin Connect, you will not receive Training Status data related to those activities.",
					"To process Training Status data from another Garmin device, the Tacx Training app or a third-party activity, Garmin Connect must sync the activity data with your compatible device. To accomplish this, your compatible device must be powered on and fully synced to ensure that all data has been processed and your Training Status is up to date. Exercise load data from the Tacx Training app or third-party activities will be visible in your Training Status reports, but it will not be visible in your activity details.",
				],
				link: "Manage Primary Training Device",
			},
		],
	},
	{
		title: "Primary Training Device",
		parts: [
			{
				paragraphs: [
					"Your Primary Training Device will be the main source for training-related data and performance stats. This device is typically used specifically for training, but some devices can be used for both fitness and everyday wear.",
				],
			},
			{
				heading: "Setting a Device Priority",
				paragraphs: [
					"If you train with more than one Garmin device, you can set device priority to designate which of your compatible devices should be the main data source for training and performance stats. We automatically sync and consolidate data across devices, but setting a Primary Training Device helps ensure you receive optimized guidance and accurate data.",
				],
			},
		],
	},
];
