import { gaps, stale, type Span } from "./coverage";
import {
	ACTIVITY_DETAILS_KEY,
	ACTIVITY_DETAILS_STORE,
	ACTIVITY_DETAILS_VERSION,
	chartKeys,
	consentKey,
	dataSet,
	DAY_DETAILS_VERSION,
	LEGACY_RUNS_STORE,
	parseConsentKey,
	rangeStart,
	type ActivityDetailsRange,
	type ConsentKey,
	type DataSetId,
	type DayDetailsRange,
} from "./datasets";
import { dayIndex } from "./day-indexes";
import type { ChartMeta, DetailCandidate } from "./backfill";
import type { MetricGroup } from "./metrics";
import { daysSince, historyStart, type AccountScan } from "./scan";

/**
 * What an update offers: the stores at today's version that the user has
 * not said yes or "later" to, and that have something to fetch — a chart
 * index never walked, Day details saved by an older version, activities
 * whose page is missing or older.
 *
 * A store agreed to at an older version still fills its gaps without
 * asking (see `planBackfill`); only what it held at that version is asked
 * about again.
 *
 * Pure.
 */

export interface DebtInput {
	today: string;
	groups: readonly MetricGroup[];
	accepted: readonly ConsentKey[];
	deferred: readonly ConsentKey[];
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
	/** The day the setup finished: where "New days only" starts. */
	since?: string;
	scan: AccountScan | null;
	daySpans: readonly Span[];
	charts: ReadonlyMap<string, ChartMeta | null>;
	/** Every activity on the index. */
	activities: readonly DetailCandidate[];
	detailFiles: ReadonlyMap<number, number>;
}

/** One line of the update dialog. */
export interface DebtItem {
	key: ConsentKey;
	set: DataSetId;
	title: string;
	/** "new", or what this version adds. */
	detail: string;
	/** For Charts & trends, the store walked; for Day details the days to fetch; for Activity details the activities. */
	store: string;
	units: number;
}

/** Everything with something to fetch that has not been agreed to at today's version, deferred items included. */
export function debtItems(input: DebtInput): DebtItem[] {
	const out: DebtItem[] = [];
	const accepted = new Set(input.accepted);
	const start = historyStart(input.scan);

	for (const key of chartKeys(input.groups)) {
		if (accepted.has(key)) continue;
		const store = parseConsentKey(key)!.store;
		const meta = input.charts.get(store);
		if (meta?.complete) continue;
		const older = agreedBefore(input.accepted, store);
		out.push({
			key,
			set: "charts",
			title: chartTitle(store),
			detail: older ? "updated: fetched again" : "new",
			store,
			units: start ? daysSince(input.scan!, start) : 0,
		});
	}

	const daysKey = consentKey("days", DAY_DETAILS_VERSION);
	if (!accepted.has(daysKey)) {
		const from = input.dayDetails === "new" ? input.since : rangeStart(input.dayDetails, input.today, start);
		if (from && from <= input.today) {
			const range = { from, to: input.today };
			const older = agreedBefore(input.accepted, "days");
			// Gaps fill under an older agreement already: only what an older version saved is asked about.
			const missing = older ? [] : gaps(input.daySpans, range);
			const old = stale(input.daySpans, range, DAY_DETAILS_VERSION);
			const units = count(missing) + count(old);
			if (units) {
				const change = dataSet("day-details").changes[DAY_DETAILS_VERSION]?.summary;
				out.push({
					key: daysKey,
					set: "day-details",
					title: "Day details",
					detail: old.length && !missing.length ? `${plural(count(old), "day")} saved by an older version${change ? `: ${lower(change)}` : ""}` : plural(units, "day"),
					store: "days",
					units,
				});
			}
		}
	}

	if (!accepted.has(ACTIVITY_DETAILS_KEY)) {
		const from = rangeStart(input.activityDetails, input.today, start);
		if (from) {
			// Gaps fill under an older agreement already: an older Activity details one for
			// every sport, Run details' for runs. Only what an older version saved is asked about.
			const older = agreedBefore(input.accepted, ACTIVITY_DETAILS_STORE);
			const runs = agreedBefore(input.accepted, LEGACY_RUNS_STORE);
			let missing = 0;
			let old = 0;
			for (const activity of input.activities) {
				if (activity.date < from) continue;
				const held = input.detailFiles.get(activity.id);
				if (held === ACTIVITY_DETAILS_VERSION) continue;
				if (held !== undefined) old += 1;
				else if (!older && !(runs && activity.run)) missing += 1;
			}
			if (missing + old) {
				const change = dataSet("activity-details").changes[ACTIVITY_DETAILS_VERSION]?.summary;
				const oldText = `${missing ? `${old.toLocaleString("en-US")}` : plural(old, "activity", "activities")} saved by an older version`;
				out.push({
					key: ACTIVITY_DETAILS_KEY,
					set: "activity-details",
					title: "Activity details",
					detail: [
						...(missing ? [plural(missing, "activity", "activities")] : []),
						...(old ? [missing || !change ? oldText : `${oldText}: ${lower(change)}`] : []),
					].join(" · "),
					store: ACTIVITY_DETAILS_STORE,
					units: missing + old,
				});
			}
		}
	}
	return out;
}

/** The items to ask about: those not put off with Later already. */
export function pendingItems(input: DebtInput): DebtItem[] {
	const deferred = new Set(input.deferred);
	return debtItems(input).filter((item) => !deferred.has(item.key));
}

/** A store's history, as a person reads it. */
export function chartTitle(store: string): string {
	if (store === "activities") return "Activity history";
	if (store === "daily-stats") return "Steps, floors and intensity history";
	if (store === "sleep") return "Sleep history";
	const def = dayIndex(store.replace(/^index:/, ""));
	const title = def?.title ?? store;
	return `${title.charAt(0).toUpperCase()}${title.slice(1)} history`;
}

function agreedBefore(accepted: readonly ConsentKey[], store: string): boolean {
	return accepted.some((key) => parseConsentKey(key)?.store === store);
}

function count(ranges: ReadonlyArray<{ from: string; to: string }>): number {
	return ranges.reduce((n, r) => n + Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1, 0);
}

function plural(n: number, word: string, many = `${word}s`): string {
	return `${n.toLocaleString("en-US")} ${n === 1 ? word : many}`;
}

function lower(text: string): string {
	return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, "");
}
