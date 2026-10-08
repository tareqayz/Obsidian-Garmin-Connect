/**
 * The sentence under the Stress 1d ring, chosen by the daily summary's
 * `stressQualifier` and whether the day is today.
 *
 * Garmin sends the key and the app looks the wording up in its own table,
 * which the API does not serve. Only the wording read off the app or the web
 * is here (ref/health-stats/stress/README.md, Anatomy → 1d). A day whose
 * qualifier has no wording yet, or whose qualifier the index never saw (a
 * history window carries none), gets the web's own neutral sentence about the
 * level instead of an invented one.
 */

interface Copy {
	today: string;
	past: string;
}

const UNKNOWN = "More measured time is needed to determine stress balance.";

const COPY: Readonly<Record<string, Copy>> = {
	BALANCED: {
		today: "You have enough restful moments today to balance out your stress reactions.",
		past: "You had enough restful moments on this day to balance out your stress reactions.",
	},
	CALM: {
		// The present tense is inferred from BALANCED's pair; the phone showed the past one.
		today: "You have many restful moments today. This will help keep you energized.",
		past: "You had many restful moments on this day. This will help keep you energized.",
	},
	// Seen today on the web; a past day is inferred to read the same.
	UNKNOWN: { today: UNKNOWN, past: UNKNOWN },
};

/** The qualifiers whose wording is known. */
export const KNOWN_QUALIFIERS: readonly string[] = Object.keys(COPY);

/**
 * The copy line. By the qualifier when its wording is known, so a day still
 * short of measured time reads UNKNOWN's sentence even with a level; then the
 * web's "Your stress level was 27 out of 100."; then UNKNOWN's sentence for a
 * day without a level at all.
 */
export function stressCopy(qualifier: string | undefined, level: number | undefined, isToday: boolean): string {
	const copy = qualifier ? COPY[qualifier.trim().toUpperCase()] : undefined;
	if (copy) return isToday ? copy.today : copy.past;
	if (level !== undefined) return `Your stress level ${isToday ? "is" : "was"} ${level} out of 100.`;
	return UNKNOWN;
}
