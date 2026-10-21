import { ACTIVITY_DETAILS_KEY, chartKeys, DAY_DETAILS_KEY, type ActivityDetailsRange, type ConsentKey, type DayDetailsRange } from "../sync/datasets";
import { estimateDelta, type Estimate, type EstimateInput } from "../sync/estimate";
import { debtItems, pendingItems, type DebtInput } from "../sync/debt";
import type { MetricGroup } from "../sync/metrics";
import type { ScanResult } from "../sync/scan";

/**
 * The setup wizard: Sign in → Scan → the recommendation, with Advanced
 * options a step off it. Which view shows, where Back goes, and what Start
 * agrees to.
 *
 * Pure: the wizard's component holds the state and calls these.
 */

/** The card above Home: finish the setup, sign in again, or no data on this device. */
/** `this-device`: set up and holding data, but not signed in here: a device that reads what another syncs. */
export type SetupCardKind = "finish" | "signed-out" | "this-device" | "no-data";

/** What the Scan view shows: the scan running, an account with nothing on it, or an error to try again from. */
export type ScanView = "scanning" | "empty" | "error";

export type SetupFlow = { step: "signin" } | { step: "scan"; view: ScanView } | { step: "recommend" } | { step: "advanced" };

export interface Choices {
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
}

/**
 * What the setup recommends: all of it. The fallback defaults in
 * `datasets.ts` stay narrow, because they also stand in for a saved range
 * that can't be read; this is only ever chosen on purpose.
 */
export const RECOMMENDED: Choices = { dayDetails: "all", activityDetails: "all" };

/** Signed in already, the setup starts with the scan. */
export function startFlow(signedIn: boolean): SetupFlow {
	return signedIn ? { step: "scan", view: "scanning" } : { step: "signin" };
}

/**
 * Where a scan leaves the wizard: the recommendation, an empty account, or an
 * error to try again from — a scan stopped by a 429 or a dead session found
 * too little to go on.
 */
export function afterScan(result: Pick<ScanResult, "scan" | "fatal"> | null): SetupFlow {
	if (!result || result.fatal) return { step: "scan", view: "error" };
	const { scan } = result;
	if (!scan.days && !scan.activities) return { step: "scan", view: "empty" };
	return { step: "recommend" };
}

/** Back from Advanced options to the recommendation; nowhere else has a Back. */
export function back(flow: SetupFlow): SetupFlow {
	return flow.step === "advanced" ? { step: "recommend" } : flow;
}

export function isRecommended(choices: Choices): boolean {
	return choices.dayDetails === RECOMMENDED.dayDetails && choices.activityDetails === RECOMMENDED.activityDetails;
}

const DAYS_KEPT: Record<DayDetailsRange, string> = { new: "new days only", "30d": "last 30 days", "90d": "last 90 days", "1y": "last year", all: "all history" };
const ACTIVITIES_KEPT: Record<ActivityDetailsRange, string> = {
	opened: "activities you open",
	"90d": "activities from the last 90 days",
	"1y": "activities from the last year",
	all: "all activities",
};

/** "last 90 days · activities you open": what a vault set up before keeps, for a setup run again. */
export function keptLabel(choices: Choices): string {
	return `${DAYS_KEPT[choices.dayDetails]} · ${ACTIVITIES_KEPT[choices.activityDetails]}`;
}

/** What the vault holds already, and the estimates over it, once a scan is in. */
export interface Prepared {
	/** Days of details, and activities with their page, already in the vault. */
	held: { days: number; activities: number; bytes: number };
	estimate: (choices: Choices) => Estimate;
}

/** What starting the download agrees to: every chart index, and the Day details and Activity details as chosen. */
export function agreement(groups: readonly MetricGroup[]): { accepted: ConsentKey[]; deferred: ConsentKey[] } {
	return { accepted: [...chartKeys(groups), DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY], deferred: [] };
}

/** A line of the update dialog: a store this version can fill in, and what it adds. */
export interface UpdateLine {
	key: string;
	title: string;
	detail: string;
	bytes: number;
	seconds: number;
}

/** What picked lines add together, as one download. */
export type UpdateTotal = (keys: readonly string[]) => { bytes: number; seconds: number };

/**
 * What the data sets offer that hasn't been agreed to — every item with
 * something to fetch, or only those not put off yet — as dialog lines, priced
 * from one read of the vault.
 */
export function updateLinesOf(input: DebtInput & EstimateInput, only: "pending" | "all"): UpdateLine[] {
	const items = only === "pending" ? pendingItems(input) : debtItems(input);
	return items.map((item) => {
		const { bytes, seconds } = estimateDelta(input, [item.key]);
		return { key: item.key, title: item.title, detail: item.detail, bytes, seconds };
	});
}
