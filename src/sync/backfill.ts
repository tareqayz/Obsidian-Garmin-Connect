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
 * `<dataFolder>/backfill.json` holds only whether it is paused and which
 * device runs it.
 *
 * Pure.
 */

/** A piece of the backfill, newest first within its kind. */
export type Task =
	/** The activity list, whole: first, since the walks and the activity details read it. */
	| { kind: "activities" }
	/** A chart index's history walk (`daily-stats`, `sleep` or `index:<kind>`). */
	| { kind: "walk"; store: string }
	/** Days whose details are missing, or were fetched at an older version. */
	| { kind: "days"; from: string; to: string }
	/** Activities whose page is missing, or of an older version, newest first. */
	| { kind: "details"; ids: number[] };

/** An activity on the index, as the plan reads it. */
export interface DetailCandidate {
	id: number;
	/** Its local start day. */
	date: string;
	/** A run: all an older Run details agreement downloads. */
	run: boolean;
}

/** A chart index as the vault holds it. */
export interface ChartMeta {
	complete: boolean;
	from?: string;
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
}

/**
 * Everything left to fetch, in the order it is fetched: the activity list,
 * the chart walks, then Day details newest first, then Activity details
 * newest first — only what was agreed to.
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

	for (const key of chartKeys(input.groups)) {
		if (!current.has(key)) continue;
		const store = storeOf(key)!;
		if (input.charts.get(store)?.complete) continue;
		tasks.push(store === "activities" ? { kind: "activities" } : { kind: "walk", store });
	}
	tasks.sort((a, b) => (a.kind === "activities" ? -1 : b.kind === "activities" ? 1 : 0));

	const start = historyStart(input.scan);
	const daysAt = agreedVersion(input.accepted, "days");
	if (daysAt !== undefined) {
		const from = input.dayDetails === "new" ? input.since : rangeStart(input.dayDetails, input.today, start);
		if (from && from <= input.today) {
			const range = { from, to: input.today };
			const wanted = [...gaps(input.daySpans, range), ...(daysAt >= DAY_DETAILS_VERSION ? stale(input.daySpans, range, DAY_DETAILS_VERSION) : [])];
			const days = withData(wanted, input.scan).filter((d) => !input.skip?.days?.has(d));
			for (const stretch of stretchesOf(days).reverse()) tasks.push({ kind: "days", ...stretch });
		}
	}

	const detailsAt = agreedVersion(input.accepted, ACTIVITY_DETAILS_STORE);
	const runsOnly = detailsAt === undefined;
	const agreedAt = detailsAt ?? agreedVersion(input.accepted, LEGACY_RUNS_STORE);
	if (agreedAt !== undefined) {
		const from = rangeStart(input.activityDetails, input.today, start);
		if (from) {
			const due = (id: number) => {
				const held = input.detailFiles.get(id);
				return held === undefined || (agreedAt >= ACTIVITY_DETAILS_VERSION && held !== ACTIVITY_DETAILS_VERSION);
			};
			const ids = input.activities
				.filter((a) => a.date >= from && (a.run || !runsOnly) && due(a.id) && !input.skip?.details?.has(a.id))
				.map((a) => a.id);
			if (ids.length) tasks.push({ kind: "details", ids });
		}
	}
	return tasks;
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
		const raw = JSON.parse(text) as { version?: unknown; paused?: unknown; lease?: unknown };
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

/** A saved budget's entries, those that make sense. */
function entriesOf(raw: unknown): BudgetEntries {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(e): e is { at: number; requests: number } =>
			!!e && typeof e === "object" && Number.isFinite((e as { at?: unknown }).at) && Number.isFinite((e as { requests?: unknown }).requests) && (e as { requests: number }).requests > 0,
	);
}

/* ------------------------------------------------------------------ */
/*  The hourly budget                                                  */
/* ------------------------------------------------------------------ */

/** What the budget has spent in the last hour: `[epoch ms, requests]` pairs. */
export type BudgetEntries = Array<{ at: number; requests: number }>;

/** Where a budget keeps what it spent, so a restart doesn't hand it a fresh hour. */
export interface BudgetStore {
	load(): unknown;
	save(entries: BudgetEntries): void;
}

/** Requests spent in the last hour, a unit at a time, for the budget. */
export class RequestBudget {
	private spent: BudgetEntries;

	constructor(
		private readonly perHour: () => number,
		private readonly store?: BudgetStore,
	) {
		this.spent = entriesOf(store?.load());
	}

	add(requests: number, at: number): void {
		if (requests <= 0) return;
		this.spent.push({ at, requests });
		this.store?.save(this.spent);
	}

	/** Requests spent in the hour before `now`. */
	used(now: number): number {
		const kept = this.spent.filter((entry) => now - entry.at < 3_600_000 && entry.at <= now + 60_000);
		if (kept.length !== this.spent.length) {
			this.spent = kept;
			this.store?.save(kept);
		}
		return kept.reduce((n, entry) => n + entry.requests, 0);
	}

	/** Milliseconds until a unit of `next` requests fits, 0 when it does now. */
	waitFor(next: number, now: number): number {
		let used = this.used(now);
		if (used + next <= this.perHour()) return 0;
		for (const entry of this.spent) {
			used -= entry.requests;
			if (used + next <= this.perHour()) return Math.max(0, entry.at + 3_600_000 - now);
		}
		return 0;
	}
}
