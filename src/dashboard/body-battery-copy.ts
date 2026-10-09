/**
 * The Body Battery 1d page's words: the headline and sentence under the gauge
 * or ring, chosen by the day's feedback type, and the Factors rows' labels.
 *
 * Garmin sends the key and the app looks the wording up in its own table,
 * which the API does not serve. Only wording read off the phone or the web is
 * here (ref/health-stats/body-battery/README.md and its `phone/INDEX.md`),
 * each under the dynamic feedback type of the day it was read on. No tense
 * changes between today and a past day: "Today has been stressful" was read
 * on a past day.
 */

export interface BatteryFeedback {
	/** "Easy day". */
	headline: string;
	copy: string;
}

/** No feedback event yet, as on the web's Oct 8 at 01:12. */
export const NOT_ENOUGH_DATA: BatteryFeedback = {
	headline: "Not enough data",
	copy: "We didn't gather enough data to determine your battery level. Wear your device continuously for the most accurate Body Battery readings.",
};

const RELAXING = "Consider doing some yoga, meditation or another light and relaxing activity to help improve your sleep quality.";

/** By `feedbackLongType`, each with the day the phone or the web showed it on. */
const COPY: Readonly<Record<string, BatteryFeedback>> = {
	// Oct 7, on the web and the phone.
	SLEEP_PREPARATION_BALANCED_AND_INACTIVE: { headline: "Easy day", copy: `You've had an easy and low-stress day. ${RELAXING}` },
	// Sep 30, Oct 2, Oct 5 and Oct 6.
	SLEEP_PREPARATION_RECOVERING_AND_INACTIVE: { headline: "Easy day", copy: `You've had an easy day with plenty of relaxing moments. ${RELAXING}` },
	// Oct 4.
	SLEEP_PREPARATION_NOT_STRESS_DATA_AND_INACTIVE: {
		headline: "Easy day",
		copy: "Your typical bedtime is approaching. Consider doing some light activity like yoga or meditation. Taking time to relax before bedtime can help improve sleep quality.",
	},
	// Oct 1.
	SLEEP_PREPARATION_STRESSFUL_AND_INACTIVE: {
		headline: "Stressful day",
		copy: "Today has been stressful. On days like this, try to take relaxation breaks and make time for some physical activity. You can focus now on winding down before bedtime to help improve your sleep quality.",
	},
	// Oct 3.
	SLEEP_PREPARATION_STRESSFUL_AND_INTENSIVE_EXERCISE: {
		headline: "Demanding day",
		copy: "You've had a demanding day. It's important to get plenty of sleep after days like this to help your body recover from stress and exercise. Try to wind down and relax before bedtime.",
	},
	// Aug 17. The phone capitalises this one.
	SLEEP_PREPARATION_NOT_STRESS_DATA_AND_ACTIVE_AND_EXERCISE: {
		headline: "Active Day",
		copy: "You've had an active day, so remember to make time to relax as your bedtime nears. A good night's sleep is the best way to recharge.",
	},
};

/** The types that say the watch had too little to go on (inferred: none was seen on a 1d page yet). */
const NO_DATA = new Set(["NO_DATA", "EARLY_MORNING_NO_DATA"]);

/**
 * The short type a long type was made from: the long type is the short one
 * with `_AND_BB_LOW` or `_AND_BB_LOW_MORNING_AND_NOW` added, or HARD_EXERCISE
 * in place of INTENSIVE_EXERCISE (spec, feedback types).
 */
export function shortFeedbackType(type: string): string {
	return type.replace(/_AND_BB_LOW(_MORNING_AND_NOW)?$/, "").replace(/HARD_EXERCISE/g, "INTENSIVE_EXERCISE");
}

/**
 * The headline and sentence for a day's feedback type. No type, or a no-data
 * one, reads "Not enough data". A type whose wording was never read takes its
 * short type's (inferred: the suffixes add to the verdict rather than change
 * it); one without that either is null, and the page shows none rather than
 * an invented one.
 */
export function batteryFeedback(type: string | undefined): BatteryFeedback | null {
	const key = type?.trim().toUpperCase();
	if (!key || NO_DATA.has(key)) return NOT_ENOUGH_DATA;
	return COPY[key] ?? COPY[shortFeedbackType(key)] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Factors                                                            */
/* ------------------------------------------------------------------ */

/** A Factors row's label by event type, as the phone writes it; an ACTIVITY row reads the activity's name. */
const FACTOR_LABELS: Readonly<Record<string, string>> = {
	SLEEP: "Sleep",
	NAP: "Nap",
	RECOVERY: "Low Stress",
	STRESS: "High Stress",
	// Inferred: an activity without a name.
	ACTIVITY: "Activity",
};

/** A Factors row's label: "Sleep", "Low Stress", "Dubai Running". An unknown type reads as words: "Some Event". */
export function factorLabel(type: string, activity?: string): string {
	const key = type.trim().toUpperCase();
	if (key === "ACTIVITY" && activity?.trim()) return activity.trim();
	return FACTOR_LABELS[key] ?? key.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The rows the phone marks with an (i) after the label, the ones whose sheet carries a verdict: every one but Sleep. */
export function factorHasInfo(type: string): boolean {
	return type.trim().toUpperCase() !== "SLEEP";
}

/* ------------------------------------------------------------------ */
/*  Factor sheets                                                      */
/* ------------------------------------------------------------------ */

/**
 * A factor sheet's verdict under its title, by the event's short feedback, as
 * the phone's sheets read on Oct 3 – 6. An activity's sheet reads "Fitness
 * benefits" whatever its training effect. Sleep's sheet has none.
 */
const VERDICTS: Readonly<Record<string, BatteryFeedback>> = {
	RESTFUL_PERIOD: { headline: "Restful period", copy: "Restful periods in the evening can help you relax and improve your sleep quality." },
	BODY_BATTERY_RECHARGE: { headline: "Body Battery Recharge", copy: "Your restful period helped boost your Body Battery." },
	RESTFUL_NAP: { headline: "Restful nap", copy: "Your restful nap charged your Body Battery." },
	STRESSFUL_PERIOD: { headline: "Stressful period", copy: "High stress has drained your battery. Take time to relax today to help balance periods of stress." },
};
const FITNESS: BatteryFeedback = {
	headline: "Fitness benefits",
	copy: "Hard exercise like this is good for you even if it decreases your Body Battery. Do this consistently to help grow your Body Battery capacity over time.",
};

export function factorVerdict(type: string, feedback: string | undefined): BatteryFeedback | null {
	if (type.trim().toUpperCase() === "ACTIVITY") return FITNESS;
	return feedback ? VERDICTS[feedback.trim().toUpperCase()] ?? null : null;
}
