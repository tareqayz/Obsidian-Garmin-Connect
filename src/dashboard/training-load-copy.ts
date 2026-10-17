import { titleCase } from "./day";
import { LOAD_FOCUS_WORDS, TRAINING_STATUS_HELP, type HelpSection } from "./training-status-copy";

/**
 * Load's words (Performance Stats, the page Training Status's Load row
 * opens), which Garmin keeps in the app rather than the API: the phone's of
 * 2026-10-11 and the web's Training Status dialogs of the same evening
 * (ref/performance-stats/training-load/README.md). What neither showed is
 * marked Inferred and left out rather than guessed.
 *
 * Pure.
 */

/** The tabs' chart titles. */
export const DAILY_TOTALS = "Daily Totals";
export const TIMELINE = "4-Week Timeline";

/** The legends', the segments' and the chip's words. */
export const OPTIMAL_RANGE = "Optimal Range";
export const ACUTE_LOAD = "Acute Load";
export const CHRONIC_LOAD = "Chronic Load";
export const LOAD_RATIO = "Load Ratio";

/**
 * Exercise Load's benefit groups, the legend's order: Anaerobic is
 * Anaerobic Capacity and Sprint, High Aerobic VO₂ Max, Threshold and Tempo,
 * Low Aerobic Base and Recovery (the web's help popovers), and Unknown
 * whatever has no benefit Garmin groups.
 */
export type LoadGroup = "anaerobic" | "highAerobic" | "lowAerobic" | "unknown";

export const LOAD_GROUPS: readonly LoadGroup[] = ["anaerobic", "highAerobic", "lowAerobic", "unknown"];

export const GROUP_LABELS: Readonly<Record<LoadGroup, string>> = {
	anaerobic: "Anaerobic",
	highAerobic: "High Aerobic",
	lowAerobic: "Low Aerobic",
	unknown: "Unknown",
};

/** The three buckets Load Focus splits a month's load into, its rows' order. */
export type FocusBucket = Exclude<LoadGroup, "unknown">;

/**
 * Load Focus's title for its phrase (`trainingBalanceFeedbackPhrase`, the
 * day file's `load_focus`): "Low Aerobic Shortage" seen on the phone and the
 * web; the other six phrases the day files hold are Training Status's words
 * for them (Inferred), and a phrase never seen is its own words.
 */
export function focusTitle(phrase: string | undefined): string | undefined {
	const key = phrase?.trim().toUpperCase();
	if (!key) return undefined;
	return LOAD_FOCUS_WORDS[key] ?? titleCase(key);
}

/**
 * Load Focus's copy under the title, by phrase, as the phone breaks it into
 * lines; the twin keeps the same lines in a pane's 370 pt column (603:16–18,
 * 609:1442–1444). AEROBIC_LOW_SHORTAGE's is the phone's three centred lines
 * and the web dialog's paragraph, word for word. The other six
 * (ANAEROBIC_SHORTAGE, AEROBIC_HIGH_FOCUS, BALANCED, AEROBIC_LOW_FOCUS,
 * ABOVE_TARGETS, AEROBIC_HIGH_SHORTAGE) are unseen: they show no copy
 * (inferred).
 */
export const FOCUS_COPY_LINES: Readonly<Record<string, readonly string[]>> = {
	AEROBIC_LOW_SHORTAGE: [
		"Try working in some more low aerobic activities",
		"like easy runs or rides. These will aid recovery",
		"and balance your higher intensity activities.",
	],
};

/** The same copy as one paragraph each. */
export const FOCUS_COPY: Readonly<Record<string, string>> = paragraphs(FOCUS_COPY_LINES);

/** Load Focus's copy for a phrase, as lines; none for a phrase whose words are unseen. */
export function focusCopyLines(phrase: string | undefined): readonly string[] | undefined {
	const key = phrase?.trim().toUpperCase();
	return key ? FOCUS_COPY_LINES[key] : undefined;
}

/** Load Focus's copy for a phrase as one paragraph. */
export function focusCopy(phrase: string | undefined): string | undefined {
	return focusCopyLines(phrase)?.join(" ");
}

function paragraphs(lines: Readonly<Record<string, readonly string[]>>): Record<string, string> {
	return Object.fromEntries(Object.entries(lines).map(([key, text]) => [key, text.join(" ")]));
}

/** What each Load Focus bar counts: the web dialog's help popovers, verbatim. */
export const FOCUS_HELP: Readonly<Record<FocusBucket, string>> = {
	anaerobic: "Activities with a primary benefit of sprint or anaerobic capacity contribute to anaerobic load.",
	highAerobic: "Activities with a primary benefit of VO₂ Max, threshold or tempo contribute to high aerobic load.",
	lowAerobic: "Activities with a primary benefit of base or recovery contribute to low aerobic load.",
};

/** Training Load's two views: the segmented control's Acute Load and Load Ratio. */
export type TrainingSegment = "acute" | "ratio";

/**
 * The copy under Training Load's status line, by `acwrStatusFeedback` and
 * view, as the phone breaks it (606:506–507, 606:951–952). FEEDBACK_2
 * (Optimal, a ratio of 0.8–1.2) is seen on the phone in both views and in
 * the web's Acute Training Load dialog; FEEDBACK_1 (Low), _3 (Optimal,
 * 1.3–1.4), _4 (High), _5 (Very High) and NONE are unseen and show none
 * (inferred).
 */
export const LOAD_COPY_LINES: Readonly<Record<TrainingSegment, Readonly<Record<string, readonly string[]>>>> = {
	acute: { FEEDBACK_2: ["Your acute load is in the optimal range to", "maintain or improve your fitness."] },
	ratio: { FEEDBACK_2: ["Your load ratio is in the optimal range to", "maintain or improve your fitness."] },
};

/** The same copy as one paragraph each. */
export const LOAD_COPY: Readonly<Record<TrainingSegment, Readonly<Record<string, string>>>> = {
	acute: paragraphs(LOAD_COPY_LINES.acute),
	ratio: paragraphs(LOAD_COPY_LINES.ratio),
};

/** The copy for a day's feedback key in a view, as lines; none for a key whose words are unseen. */
export function loadCopyLines(segment: TrainingSegment, feedback: string | undefined): readonly string[] | undefined {
	const key = feedback?.trim().toUpperCase();
	return key ? LOAD_COPY_LINES[segment][key] : undefined;
}

/** The copy for a day's feedback key in a view as one paragraph. */
export function loadCopy(segment: TrainingSegment, feedback: string | undefined): string | undefined {
	return loadCopyLines(segment, feedback)?.join(" ");
}

/**
 * The Help sheet (the nav's "Help"; the phone's sheet is unseen, so
 * Inferred): the web Training Status help's "Acute Training Load" and
 * "Training Load Focus" sections, verbatim, then what each Load Focus bar
 * counts, from the web dialog's popovers.
 */
export const LOAD_HELP: { title: string; sections: readonly HelpSection[] } = {
	title: "Load",
	sections: [
		...TRAINING_STATUS_HELP.filter((s) => s.title === "Acute Training Load" || s.title === "Training Load Focus"),
		{
			title: "Load Focus",
			parts: (["anaerobic", "highAerobic", "lowAerobic"] as const).map((bucket) => ({ heading: GROUP_LABELS[bucket], paragraphs: [FOCUS_HELP[bucket]] })),
		},
	],
};
