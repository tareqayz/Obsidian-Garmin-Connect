import { ACTIVITY_DETAILS_KEY, chartKeys, DAY_DETAILS_KEY, type ActivityDetailsRange, type ConsentKey, type DayDetailsRange } from "../sync/datasets";
import type { Estimate } from "../sync/estimate";
import type { MetricGroup } from "../sync/metrics";
import type { ScanResult } from "../sync/scan";
import type { SyncSpeed } from "../sync/speed";

/**
 * The setup wizard's steps: Sign in → Scan → Choose → Start. Which one shows,
 * where Back goes, and what Start agrees to.
 *
 * Pure: the wizard's component holds the state and calls these.
 */

export type SetupStep = "signin" | "scan" | "choose" | "start";

/** The card above Home: finish the setup, sign in again, or no data on this device. */
/** `this-device`: set up and holding data, but not signed in here: a device that reads what another syncs. */
export type SetupCardKind = "finish" | "signed-out" | "this-device" | "no-data";

export const SETUP_STEPS: ReadonlyArray<{ step: SetupStep; label: string }> = [
	{ step: "signin", label: "Sign in" },
	{ step: "scan", label: "Scan" },
	{ step: "choose", label: "Choose" },
	{ step: "start", label: "Start" },
];

/** What the Scan step shows. */
export type ScanView = "scanning" | "result" | "empty" | "error";

export interface SetupFlow {
	step: SetupStep;
	scan: ScanView;
}

/** Signed in already, the setup starts with the scan. */
export function startFlow(signedIn: boolean): SetupFlow {
	return signedIn ? { step: "scan", scan: "scanning" } : { step: "signin", scan: "scanning" };
}

/**
 * Where a scan leaves the wizard: its result, an empty account, or an error
 * to try again from — a scan stopped by a 429 or a dead session found too
 * little to go on.
 */
export function afterScan(result: Pick<ScanResult, "scan" | "fatal"> | null): SetupFlow {
	if (!result || result.fatal) return { step: "scan", scan: "error" };
	const { scan } = result;
	if (!scan.days && !scan.activities) return { step: "scan", scan: "empty" };
	return { step: "scan", scan: "result" };
}

/** Continue from a step. */
export function next(flow: SetupFlow): SetupFlow {
	if (flow.step === "signin") return { step: "scan", scan: "scanning" };
	if (flow.step === "scan") return { step: "choose", scan: flow.scan };
	return { step: "start", scan: flow.scan };
}

/** Back from a step: never into a scan that is still running, nor to a sign-in already done. */
export function back(flow: SetupFlow, signedIn: boolean): SetupFlow {
	if (flow.step === "start") return { step: "choose", scan: flow.scan };
	if (flow.step === "choose") return { step: "scan", scan: flow.scan };
	if (flow.step === "scan" && !signedIn) return { step: "signin", scan: flow.scan };
	return flow;
}

/** How the step indicator draws a step. */
export function stepState(flow: SetupFlow, step: SetupStep): "done" | "current" | "todo" {
	const at = SETUP_STEPS.findIndex((s) => s.step === flow.step);
	const index = SETUP_STEPS.findIndex((s) => s.step === step);
	return index < at ? "done" : index === at ? "current" : "todo";
}

export interface Choices {
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
}

/** What the vault holds already, and the estimates over it, once a scan is in. */
export interface Prepared {
	/** Days of details, and activities with their page, already in the vault. */
	held: { days: number; activities: number; bytes: number };
	estimate: (choices: Choices, speed: SyncSpeed) => Estimate;
}

/** What starting the download agrees to: every chart index, and the Day details and Activity details as chosen. */
export function agreement(groups: readonly MetricGroup[]): { accepted: ConsentKey[]; deferred: ConsentKey[] } {
	return { accepted: [...chartKeys(groups), DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY], deferred: [] };
}

/**
 * "Keep new days only": no history at all. New days are kept, and the chart
 * indexes are put off rather than left unasked, so no update dialog lists
 * them; Settings → Data offers them.
 */
export function newDaysOnly(groups: readonly MetricGroup[]): { choices: Choices; accepted: ConsentKey[]; deferred: ConsentKey[] } {
	return { choices: { dayDetails: "new", activityDetails: "opened" }, accepted: [DAY_DETAILS_KEY, ACTIVITY_DETAILS_KEY], deferred: chartKeys(groups) };
}

/** A line of the update dialog: a store this version can fill in, and what it costs. */
export interface UpdateLine {
	key: string;
	title: string;
	detail: string;
	requests: number;
	bytes: number;
	seconds: number;
}
