/**
 * Critical Swim Speed's words, which Garmin keeps in the app rather than the
 * API: as the phone showed them on 2026-10-11, with no result on the account
 * (ref/performance-stats/critical-swim-speed/README.md). Current's copy is
 * the web Help's "Swimming Aerobic Threshold" paragraph word for word; the
 * phone's nav has a "⋮" where other pages have "Help", left out as on FTP,
 * so the page has no Help sheet.
 *
 * Pure.
 */

/** The nav's title, and Current's heading under the range control. */
export const CSS_TITLE = "Critical Swim Speed";

/** The number Current shows, and its date line, without a result. */
export const DASH = "--";

/** Under Current's number: "Pace (min/100m)". */
export const PACE_LABEL = "Pace (min/100m)";

/** A pace's unit: per 100 m on every view ("will always be provided as a pace per 100 meters"). */
export const PACE_UNIT = "min/100m";

/** Current's copy as the phone breaks it: six left-aligned lines. */
export const CURRENT_COPY_LINES: readonly string[] = [
	"Your critical swim speed (CSS) represents the fastest",
	"swimming pace that you can maintain without",
	"exhaustion, which is your aerobic threshold for",
	"swimming. Once you determine your CSS, you can",
	"use it to guide your training and to measure how",
	"you’re improving.",
];

/** The same copy as one paragraph: the web Help's, verbatim. */
export const CURRENT_COPY = CURRENT_COPY_LINES.join(" ");

/** The chart's title: a dot a result on 7d, a dot a 7-day block on 12w and 1y. */
export const DAILY_RESULTS = "Daily Results";
export const WEEKLY_RESULTS = "Weekly Results";

/** In the chart's frame for a period without a result. */
export const NO_CSS_DATA = "No Critical Swim Speed data";

/** The results table: its band's title, its header ("Pace" over "min/100m", "Date"). */
export const RESULTS_TITLE = "Critical Swim Speed Results";
export const RESULTS_HEADER: readonly string[] = ["Pace", "Date"];

/** The table's one row for a period without a result. */
export const EMPTY_RESULT: readonly [string, string] = ["--:--", "--"];
