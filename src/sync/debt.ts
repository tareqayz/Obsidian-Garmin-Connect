import { gaps, stale, type Span } from "./coverage";
import {
	chartKeys,
	consentKey,
	dataSet,
	DAY_DETAILS_VERSION,
	parseConsentKey,
	rangeStart,
	RUN_DETAILS_VERSION,
	type ConsentKey,
	type DataSetId,
	type DayDetailsRange,
	type RunDetailsRange,
} from "./datasets";
import { dayIndex } from "./day-indexes";
import type { ChartMeta } from "./backfill";
import type { MetricGroup } from "./metrics";
import { daysSince, historyStart, type AccountScan } from "./scan";

/**
 * What an update offers: the stores at today's version that the user has
 * not said yes or "later" to, and that have something to fetch — a chart
 * index never walked, Day details saved by an older version, runs whose
 * page is missing or older.
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
	runDetails: RunDetailsRange;
	/** The day the setup finished: where "New days only" starts. */
	since?: string;
	scan: AccountScan | null;
	daySpans: readonly Span[];
	charts: ReadonlyMap<string, ChartMeta | null>;
	/** The runs on the activity index. */
	runs: ReadonlyArray<{ id: number; date: string }>;
	runFiles: ReadonlyMap<number, number>;
}

/** One line of the update dialog. */
export interface DebtItem {
	key: ConsentKey;
	set: DataSetId;
	title: string;
	/** "new", or what this version adds. */
	detail: string;
	/** For Charts & trends, the store walked; for Day details the days to fetch; for Run details the runs. */
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

	const runsKey = consentKey("runs", RUN_DETAILS_VERSION);
	if (!accepted.has(runsKey)) {
		const from = rangeStart(input.runDetails, input.today, start);
		if (from) {
			const older = agreedBefore(input.accepted, "runs");
			const due = input.runs.filter((run) => {
				if (run.date < from) return false;
				const held = input.runFiles.get(run.id);
				return older ? held !== undefined && held !== RUN_DETAILS_VERSION : held !== RUN_DETAILS_VERSION;
			});
			if (due.length) {
				out.push({
					key: runsKey,
					set: "run-details",
					title: "Run details",
					detail: older ? `${plural(due.length, "run")} saved by an older version` : plural(due.length, "run"),
					store: "runs",
					units: due.length,
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

function plural(n: number, word: string): string {
	return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

function lower(text: string): string {
	return text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, "");
}
