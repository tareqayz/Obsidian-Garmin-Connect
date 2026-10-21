import type { RangeEstimate } from "../sync/estimate";
import { historyStart, type AccountScan } from "../sync/scan";
import { sizeAndTime } from "./sync-copy";

/**
 * Sync a date range…'s rules and words: which days a pair of dates syncs, why
 * a pair can't, and the outcome card's lines. Dates are ISO days, as the date
 * fields give them. The history's start is where the account's data begins,
 * once a complete scan found it: the range starts there at the earliest.
 *
 * Pure.
 */

/** Garmin Connect holds nothing older for anyone: the fields' floor without a scan. */
export const EARLIEST = "2010-01-01";

/** What the dialog prices ranges with: the vault, read once when it opens. */
export interface RangeQuote {
	/** The history's first day, once a complete scan found it. */
	start?: string;
	price(from: string, to: string): RangeEstimate;
}

export type RangeCheck =
	/** The days to sync: as picked, held to the history and to today. `atStart` when they reach back to the history's first day. */
	| { ok: true; from: string; to: string; atStart: boolean }
	/** Nothing to sync. `message` says why, unless a field is still empty; `field` is the one at fault. */
	| { ok: false; message?: string; field?: "from" | "to" };

/**
 * Where the account's history starts: the scan's first day, or the oldest
 * activity if it is older. Only once a scan walked back past the start: one
 * cut short knows only where it stopped.
 */
export function historyFloor(scan: AccountScan | null, oldestActivity: string | undefined): string | undefined {
	if (!scan?.complete) return undefined;
	return [historyStart(scan), oldestActivity].filter((d): d is string => d !== undefined).sort()[0];
}

/** Whether `from`..`to` can sync, and which days it covers. `start` is the history's first day, if known. */
export function checkRange(from: string, to: string, today: string, start: string | undefined, dayText: (date: string) => string): RangeCheck {
	if (!isDay(from) || !isDay(to)) return { ok: false };
	if (to < from) return { ok: false, message: "The end date is before the start.", field: "to" };
	if (from > today) return { ok: false, message: "The start date is after today.", field: "from" };
	const first = start ?? EARLIEST;
	if (to < first) return { ok: false, message: `Garmin has nothing before ${dayText(first)}.`, field: "to" };
	return { ok: true, from: from < first ? first : from, to: to > today ? today : to, atStart: start !== undefined && from <= start };
}

/** The card's title: what the button does. */
export function outcomeTitle(estimate: RangeEstimate): string {
	return estimate.background ? "Downloads in the background" : "Syncs now";
}

/** "12 days · ≈ 540 KB · under a minute". */
export function outcomeMeta(estimate: RangeEstimate): string {
	return `${spanText(estimate.days)} · ${sizeAndTime(estimate.bytes, estimate.seconds)}`;
}

/** The note under the card when the range reaches back to the history's first day. */
export function historyNote(start: string, dayText: (date: string) => string): string {
	return `Your Garmin history starts ${dayText(start)}.`;
}

/** "12 days", "5 months", "2 years": days for two months, months for two years, then years. */
export function spanText(days: number): string {
	if (days < 60) return days === 1 ? "1 day" : `${days} days`;
	if (days < 730) return `${Math.round(days / 30.44)} months`;
	return `${Math.round(days / 365.25)} years`;
}

function isDay(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
