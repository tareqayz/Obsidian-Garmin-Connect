/**
 * Cycling Power Curve's words (Performance Stats), which Garmin keeps in the
 * app rather than the API: the phone's of 2026-10-11 21:23–21:24, verbatim
 * (ref/performance-stats/cycling-power-curve/README.md). The 1y empty line
 * is Inferred from the title's words. The web words its own lines
 * differently ("4 weeks", "12 months", a full stop, "1 sec" table rows) and
 * is not followed.
 *
 * Pure.
 */

/** The page's ranges, as the registry lists them. */
export type PowerCurveRange = "4w" | "3m" | "1y";

/**
 * Each range's words: the chart's title ("4 Week"), the empty line's
 * ("4 week") and the legend's ("4 Weeks"; 1y's is "1 year", lower case, as
 * the phone writes it).
 */
const RANGE_WORDS: Readonly<Record<PowerCurveRange, { title: string; empty: string; legend: string }>> = {
	"4w": { title: "4 Week", empty: "4 week", legend: "4 Weeks" },
	"3m": { title: "3 Month", empty: "3 month", legend: "3 Months" },
	"1y": { title: "1 Year", empty: "1 year", legend: "1 year" },
};

/** The chart's title: "4 Week Cycling Power Curve". */
export function curveTitle(range: PowerCurveRange): string {
	return `${RANGE_WORDS[range].title} Cycling Power Curve`;
}

/**
 * The line under the title for a period without a ride with power: "There is
 * no 4 week power data for this period". Seen on 4w and 3m; 1y's is Inferred.
 */
export function emptyLine(range: PowerCurveRange): string {
	return `There is no ${RANGE_WORDS[range].empty} power data for this period`;
}

/** The legend's word for the period's curve: "4 Weeks", "3 Months", "1 year". */
export function legendWord(range: PowerCurveRange): string {
	return RANGE_WORDS[range].legend;
}

/** The legend's word for the all-time curve. */
export const RECORD_WORD = "Record";

/** The x axis' title, under its labels. */
export const INTERVAL_LENGTH = "Interval Length";

/** The records table's title band. */
export const RECORDS_TITLE = "Cycling Power Records";

/** The records table's header row. */
export const RECORDS_HEADERS = ["Peak", "Watts", "Date"] as const;

/** The largest whole unit a duration is written in: 3600 s is "1 hr", 1800 s "30 min", 30 s "30 sec". */
const UNITS = [
	{ seconds: 3600, short: "hr", long: "hour" },
	{ seconds: 60, short: "min", long: "minute" },
	{ seconds: 1, short: "sec", long: "second" },
] as const;

function unitOf(seconds: number): (typeof UNITS)[number] {
	return UNITS.find((u) => seconds >= u.seconds && seconds % u.seconds === 0) ?? UNITS[2];
}

/** A duration under the x axis: "1 sec", "30 sec", "1 min", "2 hr". */
export function axisDuration(seconds: number): string {
	const unit = unitOf(seconds);
	return `${seconds / unit.seconds} ${unit.short}`;
}

/** A duration in the records table's Peak column: "1 second", "2 seconds", "1 minute", "5 hours". */
export function peakDuration(seconds: number): string {
	const unit = unitOf(seconds);
	const n = seconds / unit.seconds;
	return `${n} ${unit.long}${n === 1 ? "" : "s"}`;
}

/**
 * The explainer under the table (`4w/03-scroll-2.png`): two paragraphs,
 * verbatim. The web's differs in three places ("maximum power", "activity
 * history", "The power curve").
 */
export const POWER_CURVE_EXPLAINER: readonly string[] = [
	"Your power curve provides a snapshot of the maximum cycling power that you have produced (vertical axis) at a given time interval (horizontal axis). We search your ride history to find these best efforts. The background curve shows your best-ever power output at the different time intervals, while the foreground curve can display your best effort over the previous 4 weeks, 3 months or year.",
	"The Power Curve is useful for setting power-based targets in interval training. By matching the interval time with your maximum power output for that time range, you can set realistic training goals.",
];
