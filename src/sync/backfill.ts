import type { DetailProfile } from "./cost";
import { gaps, stale, type DateRange, type Span } from "./coverage";
import {
	ACTIVITY_DETAILS_STORE,
	ACTIVITY_DETAILS_VERSION,
	chartKeys,
	DAY_DETAILS_VERSION,
	LEGACY_RUNS_STORE,
	parseConsentKey,
	rangeStart,
	type ActivityDetailsRange,
	type ConsentKey,
	type DayDetailsRange,
} from "./datasets";
import { shiftDate } from "./day-index";
import type { MetricGroup } from "./metrics";
import { historyStart, type AccountScan } from "./scan";

/**
 * The backfill: what the vault still lacks of the data sets the user agreed
 * to, fetched in the background a unit at a time.
 *
 * Nothing is kept of the plan itself: `planBackfill` works it out again from
 * what the vault holds (the coverage, the chart indexes' metas) and what was
 * agreed to (the consent ledger), so a backfill cut short — Obsidian closed,
 * a 429, another device — carries on where the files say it stopped.
 * `<dataFolder>/backfill.json` holds only whether it is paused, which device
 * runs it, how far it has got (`progress`) and the date ranges queued for it
 * (`ranges`).
 *
 * Pure.
 */

/** A piece of the backfill, newest first within its kind. */
export type Task =
	/** The activity list, whole: first, since the walks and the activity details read it. */
	| { kind: "activities" }
	/** A chart index's history walk (`daily-stats`, `sleep` or `index:<kind>`). */
	| { kind: "walk"; store: string }
	/** Days whose details are missing, or were fetched at an older version; or a range you asked for (`range`, its id), every day of it. */
	| { kind: "days"; from: string; to: string; range?: string }
	/** Activities whose page is missing, or of an older version, newest first. */
	| { kind: "details"; ids: number[] };

/** An activity on the index, as the plan reads it. */
export interface DetailCandidate {
	id: number;
	/** Its local start day. */
	date: string;
	/** A run: all an older Run details agreement downloads. */
	run: boolean;
	/** What its page records, for what downloading it costs (`cost.ts`). */
	profile: DetailProfile;
	/** It recorded power: its page asks the power zones and a weigh-in too. */
	power?: boolean;
}

/** A chart index as the vault holds it. */
export interface ChartMeta {
	complete: boolean;
	from?: string;
	/** The last day it covers: past it, its rows say nothing (`day-facts.ts`). */
	to?: string;
}

export interface PlanInput {
	today: string;
	groups: readonly MetricGroup[];
	accepted: readonly ConsentKey[];
	dayDetails: DayDetailsRange;
	activityDetails: ActivityDetailsRange;
	scan: AccountScan | null;
	/** The day coverage's spans. */
	daySpans: readonly Span[];
	/** The chart indexes' metas, by store (`activities`, `daily-stats`, `sleep`, `index:<kind>`); absent when the index has none. */
	charts: ReadonlyMap<string, ChartMeta | null>;
	/** Every activity on the index, newest first. */
	activities: readonly DetailCandidate[];
	/** Each downloaded activity's file version. */
	detailFiles: ReadonlyMap<number, number>;
	/** The day the setup finished: where "New days only" starts. */
	since?: string;
	/** Days and activities that failed this session, left for the next. */
	skip?: { days?: ReadonlySet<string>; details?: ReadonlySet<number> };
	/** The date ranges waiting for the download (`backfill.json`). */
	ranges?: readonly QueuedRange[];
}

/**
 * Everything left to fetch, in the order it is fetched: the activity list,
 * the chart walks, the queued date ranges, then Day details and Activity
 * details era by era (`ERAS`), each era's days before its activities — only
 * what was agreed to. Day details end yesterday: today keeps changing until
 * it ends, and the routine sync keeps it current.
 *
 * - A chart index is walked once its key at today's version is agreed to: a
 *   version bump reads as no index at all, a whole history to fetch again.
 * - Missing days and activities are fetched under any version of their key
 *   agreed to — they come back in today's shape — and those held at an older
 *   version only once today's key is agreed to. Gaps under an agreed key
 *   are never asked about.
 * - Run details, the set before every sport had a page: agreed to and
 *   Activity details not, it keeps fetching the runs of the range, as before.
 */
export function planBackfill(input: PlanInput): Task[] {
	const tasks: Task[] = [];
	const current = new Set(input.accepted);
	/** Day details and activity details by era (`ERAS`), each era's days first: recent history arrives first. */
	const eras: Task[][] = Array.from({ length: ERAS.length + 1 }, () => []);

	for (const key of chartKeys(input.groups)) {
		if (!current.has(key)) continue;
		const store = storeOf(key)!;
		if (input.charts.get(store)?.complete) continue;
		tasks.push(store === "activities" ? { kind: "activities" } : { kind: "walk", store });
	}
	tasks.sort((a, b) => (a.kind === "activities" ? -1 : b.kind === "activities" ? 1 : 0));

	const start = historyStart(input.scan);
	const daysAt = agreedVersion(input.accepted, "days");
	const yesterday = shiftDate(input.today, -1);
	if (daysAt !== undefined) {
		const from = input.dayDetails === "new" ? input.since : rangeStart(input.dayDetails, input.today, start);
		if (from && from <= yesterday) {
			const range = { from, to: yesterday };
			const wanted = [...gaps(input.daySpans, range), ...(daysAt >= DAY_DETAILS_VERSION ? stale(input.daySpans, range, DAY_DETAILS_VERSION) : [])];
			const days = withData(wanted, input.scan).filter((d) => !input.skip?.days?.has(d));
			for (const stretch of stretchesOf(days).reverse()) {
				for (const piece of splitAtEras(stretch, input.today)) eras[eraOf(piece.to, input.today)].push({ kind: "days", ...piece });
			}
		}
	}

	const detailsAt = agreedVersion(input.accepted, ACTIVITY_DETAILS_STORE);
	const runsOnly = detailsAt === undefined;
	const agreedAt = detailsAt ?? agreedVersion(input.accepted, LEGACY_RUNS_STORE);
	// With Workouts off an activity's page loads nothing (`loadActivity`): none is planned.
	if (agreedAt !== undefined && input.groups.includes("workouts")) {
		const from = rangeStart(input.activityDetails, input.today, start);
		if (from) {
			const due = (id: number) => {
				const held = input.detailFiles.get(id);
				return held === undefined || (agreedAt >= ACTIVITY_DETAILS_VERSION && held !== ACTIVITY_DETAILS_VERSION);
			};
			const byEra = eras.map((): number[] => []);
			for (const a of input.activities) {
				if (a.date >= from && (a.run || !runsOnly) && due(a.id) && !input.skip?.details?.has(a.id)) byEra[eraOf(a.date, input.today)].push(a.id);
			}
			byEra.forEach((ids, era) => {
				if (ids.length) eras[era].push({ kind: "details", ids });
			});
		}
	}
	// The ranges asked for, after the walks and ahead of the eras: someone is waiting on them.
	const asked: Task[] = [];
	for (const r of input.ranges ?? []) if (r.next >= r.from) asked.push({ kind: "days", from: r.from, to: r.next, range: r.at });
	for (const era of [asked, ...eras]) tasks.push(...era);
	return tasks;
}

/**
 * Recent history first: the history download takes the last 90 days' days
 * and activities, then back to a year, then the rest. Days back from today.
 */
export const ERAS = [90, 365] as const;

/** Which era a day falls in: 0 for the last 90 days, `ERAS.length` past the last. */
export function eraOf(date: string, today: string): number {
	const at = ERAS.findIndex((days) => date >= shiftDate(today, -days));
	return at < 0 ? ERAS.length : at;
}

/** A stretch of days cut where it crosses from one era into the next, newest first. */
function splitAtEras(range: DateRange, today: string): DateRange[] {
	const out: DateRange[] = [];
	let to = range.to;
	while (to >= range.from) {
		const era = eraOf(to, today);
		// The era's oldest day, or the stretch's start if that comes first.
		const eraStart = era < ERAS.length ? shiftDate(today, -ERAS[era]) : range.from;
		const from = eraStart > range.from ? eraStart : range.from;
		out.push({ from, to });
		to = shiftDate(from, -1);
	}
	return out;
}

/** The newest version of a store agreed to, if any. */
function agreedVersion(accepted: readonly ConsentKey[], store: string): number | undefined {
	let best: number | undefined;
	for (const key of accepted) {
		const parsed = parseConsentKey(key);
		if (parsed?.store === store && (best === undefined || parsed.version > best)) best = parsed.version;
	}
	return best;
}

/** The store a key names: `index:stress@1` → `index:stress`. */
function storeOf(key: ConsentKey): string | undefined {
	return parseConsentKey(key)?.store;
}

/**
 * The days of the ranges the account has data for, by the scan's weeks.
 * Days after the scan are kept: it could not see them.
 */
function withData(ranges: readonly DateRange[], scan: AccountScan | null): string[] {
	const out: string[] = [];
	const scanned = scan?.scannedAt.slice(0, 10);
	const weeks = scan ? new Set(scan.weeks.filter(([, days]) => days > 0).map(([week]) => week)) : null;
	const weekStarts = scan ? scan.weeks.map(([week]) => week).sort() : [];
	const inWeekWithData = (date: string) => {
		// The week a date falls in: the latest week start on or before it.
		let lo = 0;
		let hi = weekStarts.length - 1;
		let found: string | undefined;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (weekStarts[mid] <= date) {
				found = weekStarts[mid];
				lo = mid + 1;
			} else hi = mid - 1;
		}
		return found !== undefined && shiftDate(found, 6) >= date && weeks!.has(found);
	};
	for (const range of ranges) {
		for (let date = range.from; date <= range.to; date = shiftDate(date, 1)) {
			if (!weeks || (scanned && date > scanned) || inWeekWithData(date)) out.push(date);
		}
	}
	return [...new Set(out)].sort();
}

/** Consecutive days as ranges, oldest first. */
function stretchesOf(days: readonly string[]): DateRange[] {
	const out: DateRange[] = [];
	for (const date of days) {
		const last = out[out.length - 1];
		if (last && shiftDate(last.to, 1) === date) last.to = date;
		else out.push({ from: date, to: date });
	}
	return out;
}

/** The newest `size` days of a days task: the next chunk. */
export function nextChunk(task: { from: string; to: string }, size: number): { from: string; to: string } {
	const from = shiftDate(task.to, -(Math.max(1, size) - 1));
	return { from: from < task.from ? task.from : from, to: task.to };
}

/* ------------------------------------------------------------------ */
/*  backfill.json                                                      */
/* ------------------------------------------------------------------ */

export const BACKFILL_FILE_VERSION = 1;

/** Why a backfill stopped until something changes. */
export type PauseReason = "user" | "sign-in" | "rate-limit" | "blocked" | "error";

export interface BackfillState {
	/** Set while paused. A 429, a bot check's refusal or an error pauses until `until`; a sign-in until one; the user until they resume. */
	paused?: { reason: PauseReason; until?: string };
	/** The device running it, and when it last finished a unit. */
	lease?: Lease;
	/**
	 * Requests the download has spent since it started (`since`, ISO), kept
	 * with the lease so its progress carries over a restart, or to another
	 * device. An older build drops it on its next write: the bar starts over.
	 */
	progress?: { done: number; since: string };
	/**
	 * Date ranges you asked for that were too long to sync at once, oldest
	 * asked first (`SyncRunner.queueRange`): the download takes them after
	 * its walks. An older build drops them on its next write.
	 */
	ranges?: QueuedRange[];
}

/** A date range waiting for the download. */
export interface QueuedRange {
	from: string;
	to: string;
	/** The newest day still to fetch: it walks back from `to` to `from`. */
	next: string;
	/** When it was asked for, ISO: also its id. */
	at: string;
}

export interface Lease {
	device: string;
	/** A name a person recognises: "Mac", "iPhone". */
	label: string;
	/** ISO. */
	heartbeat: string;
}

/** A lease older than this is taken over: the device holding it went away mid-backfill. */
export const LEASE_MS = 10 * 60_000;

export function serializeBackfill(state: BackfillState): string {
	return `${JSON.stringify({ version: BACKFILL_FILE_VERSION, ...state }, null, "\t")}\n`;
}

export function parseBackfill(text: string): BackfillState {
	try {
		const raw = JSON.parse(text) as { version?: unknown; paused?: unknown; lease?: unknown; progress?: unknown; ranges?: unknown };
		if (!raw || raw.version !== BACKFILL_FILE_VERSION) return {};
		const out: BackfillState = {};
		const paused = raw.paused as { reason?: unknown; until?: unknown } | undefined;
		if (paused && ["user", "sign-in", "rate-limit", "blocked", "error"].includes(paused.reason as string)) {
			out.paused = { reason: paused.reason as PauseReason, ...(typeof paused.until === "string" ? { until: paused.until } : {}) };
		}
		const lease = raw.lease as Partial<Lease> | undefined;
		if (lease && typeof lease.device === "string" && typeof lease.label === "string" && typeof lease.heartbeat === "string") {
			out.lease = { device: lease.device, label: lease.label, heartbeat: lease.heartbeat };
		}
		const progress = raw.progress as { done?: unknown; since?: unknown } | undefined;
		if (progress && typeof progress.done === "number" && Number.isFinite(progress.done) && progress.done >= 0 && typeof progress.since === "string") {
			out.progress = { done: Math.round(progress.done), since: progress.since };
		}
		const day = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
		const ranges = (Array.isArray(raw.ranges) ? (raw.ranges as Array<Partial<Record<keyof QueuedRange, unknown>>>) : []).filter(
			(r): r is QueuedRange => !!r && day(r.from) && day(r.to) && day(r.next) && typeof r.at === "string" && r.from <= r.to,
		);
		if (ranges.length) out.ranges = ranges.map(({ from, to, next, at }) => ({ from, to, next, at }));
		return out;
	} catch {
		return {};
	}
}

/** Whether another device runs the backfill now: its lease is fresh. */
export function heldElsewhere(state: BackfillState, device: string, now: number): Lease | null {
	const lease = state.lease;
	if (!lease || lease.device === device) return null;
	const at = Date.parse(lease.heartbeat);
	return Number.isFinite(at) && now - at < LEASE_MS ? lease : null;
}

/** Whether a pause still holds at `now`. A user's pause and a sign-in's hold until lifted. */
export function stillPaused(state: BackfillState, now: number): boolean {
	const paused = state.paused;
	if (!paused) return false;
	if (!paused.until) return true;
	const until = Date.parse(paused.until);
	return !Number.isFinite(until) || now < until;
}

/** How long to wait after the `n`th 429 in a row: 5 minutes, doubling, at most an hour. */
export function rateLimitWait(n: number): number {
	return Math.min(60, 5 * 2 ** Math.max(0, n - 1)) * 60_000;
}

/**
 * How long to wait after the `n`th refusal in a row from Garmin's edge (a bot
 * check's 403): half an hour, doubling, at most twelve. Asking again soon is
 * what keeps a block in place.
 */
export function blockedWait(n: number): number {
	return Math.min(720, 30 * 2 ** Math.max(0, n - 1)) * 60_000;
}
