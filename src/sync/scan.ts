import type { Activity, ActivityCount, DailyStepStat, WeeklyStepsRow } from "../garmin/endpoints";
import { GarminAuthError, GarminRateLimitError } from "../garmin/errors";
import { shiftDate } from "./day-index";
import { localDateOf } from "./metrics";
import { deviceUploadOf } from "./sync-state";

/**
 * Where the account's history starts and ends, in a few requests, for the
 * setup's estimates and the history walks' floor:
 *
 * - the watch's last upload (`mylastused`),
 * - the activity count and the oldest activity (the list's last row, at
 *   offset count − 1),
 * - the weeks with wellness data, 52 a request back from today until a year
 *   with none, past the oldest activity,
 * - and the first day, pinned inside its week.
 *
 * About a request a year of history, plus four. Kept in
 * `<dataFolder>/scan.json`.
 *
 * Pure: the API is handed in.
 */

/** Version of `scan.json`'s shape. */
export const SCAN_VERSION = 1;

/** What a scan asks Garmin: `GarminApi` in the plugin. */
export interface ScanSource {
	lastUsedDevice(): Promise<Record<string, unknown> | null>;
	activityCount(): Promise<ActivityCount>;
	activities(start?: number, limit?: number): Promise<Activity[]>;
	weeklySteps(end: string, weeks?: number): Promise<WeeklyStepsRow[]>;
	dailyStepStats(start: string, end: string): Promise<DailyStepStat[]>;
}

/** The account as a scan found it. */
export interface AccountScan {
	/** When the scan ran, ISO. */
	scannedAt: string;
	/** The watch's last upload, ISO, when Garmin said. */
	lastUpload?: string;
	/** The first day with wellness data. */
	firstDay?: string;
	/** Days with wellness data. */
	days: number;
	/** The weeks with data, oldest first: the week's first day and its days with data. */
	weeks: Array<[week: string, days: number]>;
	/** Activities on the list, multisport legs left out as the list leaves them. */
	activities: number;
	/** The oldest activity's local day. */
	firstActivity?: string;
	/** The weeks were walked back past the start of the history. False when a request failed first. */
	complete: boolean;
}

/** A step of the scan, for the setup's checklist. */
export type ScanStep =
	| { step: "upload"; lastUpload?: string }
	| { step: "activities"; count: number; first?: string }
	| { step: "health"; reached: string; days: number };

export interface ScanOptions {
	/** The newest day: the weeks end here. */
	today: string;
	/** For `scannedAt`. Injectable for tests. */
	now?: () => Date;
	onStep?: (step: ScanStep) => void;
	shouldStop?: () => boolean;
	/** A hard stop on the weeks walk, in years. */
	maxYears?: number;
}

export interface ScanResult {
	scan: AccountScan;
	requests: number;
	/** A 429 or a dead session: the scan stopped there, with what it had. */
	fatal?: unknown;
	/** A request that failed otherwise, by what it asked. */
	errors: string[];
}

/** Weeks a request: the route's cap. */
const WEEKS = 52;

/** Since Garmin Connect began, with room to spare. */
const MAX_YEARS = 20;

export async function scanAccount(source: ScanSource, opts: ScanOptions): Promise<ScanResult> {
	const scan: AccountScan = { scannedAt: (opts.now?.() ?? new Date()).toISOString(), days: 0, weeks: [], activities: 0, complete: false };
	const out: ScanResult = { scan, requests: 0, errors: [] };
	/** Runs one request. False when the scan must stop: a 429 or a dead session. */
	const ask = async <T>(what: string, run: () => Promise<T>, take: (value: T) => void): Promise<boolean> => {
		out.requests += 1;
		try {
			take(await run());
			return true;
		} catch (err) {
			if (err instanceof GarminRateLimitError || err instanceof GarminAuthError) {
				out.fatal = err;
				return false;
			}
			out.errors.push(`${what}: ${err instanceof Error ? err.message : String(err)}`);
			return true;
		}
	};

	if (!(await ask("last upload", () => source.lastUsedDevice(), (device) => {
		const at = deviceUploadOf(device);
		if (at) scan.lastUpload = at;
	}))) return out;
	opts.onStep?.({ step: "upload", ...(scan.lastUpload ? { lastUpload: scan.lastUpload } : {}) });

	let listed = 0;
	if (!(await ask("activity count", () => source.activityCount(), (count) => {
		const total = typeof count.totalCount === "number" ? count.totalCount : 0;
		listed = Math.max(0, total - (count.multisportChildCount ?? 0));
	}))) return out;
	scan.activities = listed;
	if (listed > 0) {
		if (!(await ask("oldest activity", () => source.activities(listed - 1, 1), (rows) => {
			const first = localDateOf(rows[0]?.startTimeLocal);
			if (first) scan.firstActivity = first;
		}))) return out;
	}
	opts.onStep?.({ step: "activities", count: listed, ...(scan.firstActivity ? { first: scan.firstActivity } : {}) });

	// Weeks with data, walked back a year a request until a year without any
	// is older than the oldest activity.
	const weeks = new Map<string, number>();
	let end = opts.today;
	for (let year = 0; year < (opts.maxYears ?? MAX_YEARS); year++) {
		if (opts.shouldStop?.()) return out;
		const start = shiftDate(end, -(WEEKS * 7 - 1));
		const failures = out.errors.length;
		let found = 0;
		if (!(await ask(`weeks to ${end}`, () => source.weeklySteps(end, WEEKS), (rows) => {
			for (const row of rows) {
				const days = row.values?.wellnessDataDaysCount ?? 0;
				if (typeof row.calendarDate !== "string" || !days || days < 1) continue;
				weeks.set(row.calendarDate, Math.min(7, days));
				found += 1;
			}
		}))) return finish(scan, weeks, out);
		// A year that failed says nothing of the years before it.
		if (out.errors.length > failures) return finish(scan, weeks, out);
		opts.onStep?.({ step: "health", reached: start, days: sum(weeks) });
		if (!found && (!scan.firstActivity || start <= scan.firstActivity)) {
			scan.complete = true;
			break;
		}
		end = shiftDate(start, -1);
	}

	// The first day sits inside the oldest week: unless the week is full, one
	// request finds it.
	const oldest = [...weeks.keys()].sort()[0];
	if (oldest) {
		scan.firstDay = oldest;
		const days = weeks.get(oldest)!;
		if (days < 7) {
			if (!(await ask("first day", () => source.dailyStepStats(oldest, shiftDate(oldest, 6)), (rows) => {
				const dates = rows
					.filter((row) => typeof row.calendarDate === "string" && typeof row.totalSteps === "number")
					.map((row) => row.calendarDate as string)
					.sort();
				if (dates[0]) scan.firstDay = dates[0];
			}))) return finish(scan, weeks, out);
		}
	}
	return finish(scan, weeks, out);
}

/** Where the account's history starts, as far as the scan knows: the earlier of its first day and its first activity. */
export function historyStart(scan: AccountScan | null | undefined): string | undefined {
	const days = [scan?.firstDay, scan?.firstActivity].filter((d): d is string => typeof d === "string").sort();
	return days[0];
}

/** Days with data from `from` on, counted from the weeks: a week straddling `from` counts its share. */
export function daysSince(scan: AccountScan, from: string): number {
	let days = 0;
	for (const [week, count] of scan.weeks) {
		const last = shiftDate(week, 6);
		if (last < from) continue;
		if (week >= from) days += count;
		else {
			// A week straddling `from` counts at most its days from `from` on.
			const inside = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
			days += Math.min(count, inside);
		}
	}
	return days;
}

/** The scan's fields, then its weeks a line each. */
export function serializeScan(scan: AccountScan): string {
	const { weeks, ...rest } = scan;
	const head = JSON.stringify({ version: SCAN_VERSION, ...rest }, null, "\t");
	const lines = weeks.map((week) => `\t\t${JSON.stringify(week)}`);
	const body = lines.length ? `[\n${lines.join(",\n")}\n\t]` : "[]";
	return `${head.slice(0, -2)},\n\t"weeks": ${body}\n}\n`;
}

/** Null when the file isn't one: the setup then scans again. */
export function parseScan(text: string): AccountScan | null {
	try {
		const raw = JSON.parse(text) as Partial<AccountScan> & { version?: unknown };
		if (!raw || raw.version !== SCAN_VERSION || typeof raw.scannedAt !== "string" || !Array.isArray(raw.weeks)) return null;
		const weeks = raw.weeks.filter(
			(w): w is [string, number] => Array.isArray(w) && typeof w[0] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(w[0]) && Number.isInteger(w[1]),
		);
		const { version: _version, ...scan } = raw;
		return {
			...(scan as AccountScan),
			weeks,
			days: typeof raw.days === "number" ? raw.days : weeks.reduce((n, [, d]) => n + d, 0),
			activities: typeof raw.activities === "number" ? raw.activities : 0,
			complete: raw.complete === true,
		};
	} catch {
		return null;
	}
}

function sum(weeks: ReadonlyMap<string, number>): number {
	let days = 0;
	for (const count of weeks.values()) days += count;
	return days;
}

function finish(scan: AccountScan, weeks: ReadonlyMap<string, number>, out: ScanResult): ScanResult {
	scan.weeks = [...weeks].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	scan.days = sum(weeks);
	if (!scan.firstDay && scan.weeks[0]) scan.firstDay = scan.weeks[0][0];
	return out;
}
