/**
 * The words on the Sleep pages that come from a Garmin key rather than a
 * number: the score's verdicts, the night's headline, the sleep need and
 * alignment messages.
 *
 * Garmin sends keys (`POSITIVE_HIGHLY_RECOVERING`) and the app looks them up
 * in its own phrase tables, which the API does not serve. The keys seen on
 * this account carry the app's wording, read off its screens; any other key
 * falls back to a plain reading of the key itself, so a new one still shows
 * something sensible rather than nothing.
 */

/** EXCELLENT → "Excellent". */
export function qualifierText(key: string | undefined): string | undefined {
	return key ? humanizeKey(key) : undefined;
}

/** Garmin's verdicts, worst first, so two can be compared. */
const RANK = ["POOR", "FAIR", "GOOD", "EXCELLENT"];

/** The lower of two verdicts: Awake/Restlessness is judged on both its parts. */
export function worseQualifier(a: string | undefined, b: string | undefined): string | undefined {
	if (!a) return b;
	if (!b) return a;
	return RANK.indexOf(a) <= RANK.indexOf(b) ? a : b;
}

interface Headline {
	title: string;
	sentence?: string;
}

/**
 * The night's headline, by `sleepScoreFeedback`: only keys whose wording was
 * read off the app. Others get their key, read plainly, as the title.
 */
const FEEDBACK: Record<string, Headline> = {
	POSITIVE_HIGHLY_RECOVERING: { title: "Highly restorative", sentence: "You had extremely restorative sleep." },
};

/** Lines under the headline, by `sleepScoreInsight` or `sleepScorePersonalizedInsight`: only wording seen in the app. */
const INSIGHT: Record<string, string> = {
	HARD_EXERCISE_POS_EXCELLENT_OR_GOOD_SLEEP_HARD_CLOSE_BED: "Your hard training yesterday promoted good sleep, despite the session being later in the day.",
};

/** The headline and the lines under it, or undefined when the night has no feedback at all. */
export function headline(feedback: string | undefined, insight: string | undefined, personal: string | undefined): { title: string; lines: string[] } | undefined {
	const known = feedback ? FEEDBACK[feedback] : undefined;
	const title = known?.title ?? (feedback ? humanizeKey(feedback.replace(/^(POSITIVE|NEGATIVE)_/, "")) : undefined);
	const lines = [known?.sentence, sentenceOf(insight), sentenceOf(personal)].filter((l): l is string => Boolean(l));
	if (!title) return lines.length ? { title: "", lines } : undefined;
	return { title, lines };
}

function sentenceOf(key: string | undefined): string | undefined {
	if (!key) return undefined;
	return INSIGHT[key];
}

/**
 * The Sleep Coach's message for a night's need, by `sleepNeed.feedback`. The
 * normal-need wording is the app's; the adjusted wording is the Figma
 * design's, since this account has no adjusted night on record.
 */
export function needMessage(
	feedback: string | undefined,
	minutes: { need: number; baseline?: number },
	reason: string | undefined,
): { title: string; text: string } {
	const f = feedback ?? "";
	const baseline = minutes.baseline;
	const diff = baseline !== undefined ? Math.abs(minutes.need - baseline) : 0;
	if (baseline !== undefined && diff > 0 && (f.includes("DECREASED") || f.includes("INCREASED") || minutes.need !== baseline)) {
		const less = minutes.need < baseline;
		return {
			title: less ? "You need a little less sleep tonight." : "You need a little more sleep tonight.",
			text: `${reason ?? "Your recent sleep and activity"}, so your sleep need is ${spokenMinutes(diff)} ${less ? "below" : "above"} your ${hoursAdjective(baseline)} baseline.`,
		};
	}
	return {
		title: "You needed a normal amount of sleep.",
		text: `You should have felt good on your normal ${spokenHours(baseline ?? minutes.need)} of sleep. Nice work staying balanced!`,
	};
}

/** Why the need moved, by the adjustment that moved it. */
export function needReason(factor: "history" | "hrv" | "training" | "nap", key: string): string {
	const down = key.includes("DECREAS");
	switch (factor) {
		case "history":
			return down ? "You’ve had good sleep duration recently" : "You’ve had short sleep recently";
		case "hrv":
			return down ? "Your HRV status is balanced" : "Your HRV status is low";
		case "training":
			return down ? "Your recent activity was light" : "Your recent activity was hard";
		case "nap":
			return "You napped recently";
	}
}

/** 30 → "30 minutes", 60 → "1 hour", 90 → "1 hour 30 minutes". */
function spokenMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	const hours = h ? `${h} hour${h === 1 ? "" : "s"}` : "";
	const mins = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
	return [hours, mins].filter(Boolean).join(" ") || "0 minutes";
}

/** 420 → "7 hours", 450 → "7 hours 30 minutes". */
function spokenHours(minutes: number): string {
	return spokenMinutes(minutes);
}

/** 420 → "7-hour", 450 → "7h 30m". */
function hoursAdjective(minutes: number): string {
	return minutes % 60 === 0 ? `${minutes / 60}-hour` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export type NeedFactor = "history" | "hrv" | "training" | "nap";

export const NEED_FACTOR_TITLE: Record<NeedFactor, string> = {
	history: "Sleep History",
	hrv: "HRV Status",
	training: "Recent Activity",
	nap: "Naps",
};

/** What a need adjustment did, by its key: DECREASING, INCREASING, … */
export function adjustmentText(key: string): string {
	if (key.includes("DECREAS")) return "Decreasing your sleep need";
	if (key.includes("INCREAS")) return "Increasing your sleep need";
	return humanizeKey(key);
}

/** The Sleep History sheet's message. */
export function historyMessage(key: string | undefined): string {
	if (key?.includes("DECREAS")) return "You’ve had good sleep duration recently that’s decreasing your sleep need. Keep doing what you’re doing.";
	if (key?.includes("INCREAS")) return "You’ve had short sleep recently that’s increasing your sleep need. Try to get to bed a little earlier.";
	return "Your recent sleep duration has kept your sleep need steady.";
}

/** Sleep alignment: the big word, the line under it, and the paragraph. */
export function alignmentText(status: string | undefined, window: string): { title: string; subtitle: string; text: string } {
	switch (status) {
		case "ALIGNED":
			return {
				title: "Aligned",
				subtitle: "With Internal Rhythm",
				text: `Your sleep was aligned with your internal rhythm of ${window}. Your optimal sleep schedule serves as a long-term target for your sleep patterns over time.`,
			};
		case "AHEAD":
			return {
				title: "Ahead",
				subtitle: "Of Internal Rhythm",
				text: `Your sleep was ahead of your internal rhythm of ${window}. Going to bed closer to your optimal bedtime keeps your sleep aligned.`,
			};
		case "BEHIND":
			return {
				title: "Behind",
				subtitle: "Internal Rhythm",
				text: `Your sleep was behind your internal rhythm of ${window}. Going to bed closer to your optimal bedtime keeps your sleep aligned.`,
			};
		default:
			return { title: status ? humanizeKey(status) : "—", subtitle: "Internal Rhythm", text: `Your internal rhythm is ${window}.` };
	}
}

/** `HIGHLY_RECOVERING` → "Highly recovering", `BALANCED` → "Balanced". */
export function humanizeKey(key: string): string {
	const words = key.toLowerCase().replace(/_/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}
