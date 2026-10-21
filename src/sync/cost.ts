import { CHANGED_IN_6, UPGRADED_VERSION } from "./activity-detail";
import { nextChunk, RequestBudget, type BudgetOutlook, type ChartMeta, type DetailCandidate, type Task } from "./backfill";
import { shiftDate } from "./day-index";
import { DAY_INDEXES } from "./day-indexes";
import { endpointsFor, type MetricGroup } from "./metrics";
import { HOURLY_BUDGET, LATENCY, PACE, secondsPerDay, type Latency } from "./pace";
import { daysSince, historyStart, type AccountScan } from "./scan";
import { segmentWindows, STATS_WINDOW_DAYS } from "./segments";

/**
 * What the history download costs: the requests each piece of it sends, the
 * bytes it writes and the time it takes at the plugin's pace. One model for
 * the plan's units, the hourly budget's checks, the progress bar and every
 * estimate the setup, Settings and the update dialog show, so what they say
 * is what the download does.
 *
 * Pure.
 */

/** What an activity's page records, which sets how many requests it takes and how big it is. */
export type DetailProfile = "run" | "indoorRun" | "ride" | "gpsOther" | "pool" | "gym" | "other";

/**
 * Bytes a download writes. Measured 2026-10-21 on a vault of 446 days and 344
 * activities (Aug 2025 → Oct 2026); a vault that holds enough of its own
 * files is measured instead (`calibrate`).
 */
export interface SizeModel {
	/** A day's line in `days/<year>.json`, for a day with data. */
	dayFile: number;
	/** A day without data still gets a line: Garmin carries fitness age and the endurance thresholds over. */
	emptyDay: number;
	/** A day's series file with every timeline. */
	timelines: number;
	/** A series file past the days Garmin keeps timelines for (`TIMELINE_DAYS`): the steps, Body Battery's events and the night. */
	oldTimelines: number;
	/** A row on the activity list. */
	activityRow: number;
	/** An activity's page, by profile. */
	details: Record<DetailProfile, number>;
}

export const MEASURED_SIZES: SizeModel = {
	dayFile: 4_780,
	emptyDay: 1_560,
	timelines: 52_100,
	oldTimelines: 9_300,
	activityRow: 356,
	details: { run: 158_600, indoorRun: 102_200, ride: 200_600, gpsOther: 75_500, pool: 34_700, gym: 10_400, other: 121_400 },
};

/**
 * Days back Garmin still serves a day's stress, heart rate, floors and
 * intensity timelines: older days answer with the day's averages and an empty
 * timeline. Measured 2026-10-21 (Mar 1 and May 31 empty, Jun 1 on served).
 */
export const TIMELINE_DAYS = 140;

/**
 * Bytes a day of history adds to each chart index: its files' bytes over the
 * 446 days of the measured vault. Every store has one (a test checks).
 */
export const ROW_BYTES: Readonly<Record<string, number>> = {
	"daily-stats": 163,
	sleep: 256,
	stress: 87,
	"heart-rate": 58,
	"body-battery": 128,
	respiration: 45,
	"health-status": 280,
	"fitness-age": 76,
	weight: 2,
	"pulse-ox": 24,
	"blood-pressure": 0,
	"vo2-max": 19,
	"hill-score": 90,
	"hrv-status": 149,
	"race-predictions": 82,
	"training-status": 184,
	"endurance-score": 84,
	"heat-acclimation": 109,
	"training-readiness": 410,
	"running-tolerance": 95,
	"running-tolerance-weeks": 16,
	ftp: 6,
	"lactate-threshold": 5,
	"running-economy": 14,
	"critical-swim-speed": 0,
	"hrv-stress": 0,
};

/**
 * Requests an activity's page takes the first time: seven together, the
 * watch's name once the summary says which, then the weather with a GPS
 * track and the power zones and weigh-in with power (`docs/garmin-api.md`,
 * Activity details). A run is taken to have power, as the watches that record
 * runs now mostly do; a ride's row says.
 */
export function detailRequests(profile: DetailProfile, power = false): number {
	switch (profile) {
		case "run":
			return 11;
		case "indoorRun":
			return 10;
		case "ride":
			return power ? 11 : 9;
		case "gpsOther":
			return 9;
		case "pool":
		case "gym":
			return 8;
		default:
			return 10;
	}
}

/** A run saved by the version before every sport had a page: only what changed is asked again. */
export const UPGRADE_REQUESTS = CHANGED_IN_6.length;

/** The target length of a unit of the download, in seconds: a sync waiting behind one never waits longer. */
export const UNIT_SECONDS = 10;

/** Requests a day of Day details asks: the groups' day routes, and the six timelines with intraday on. */
export function requestsPerDay(groups: readonly MetricGroup[]): number {
	const w = endpointsFor(groups);
	const routes = [w.summary, w.sleep, w.hrv, w.readiness, w.endurance, w.training, w.body, w.fitnessAge, w.health].filter(Boolean).length;
	return routes + (w.intraday ? 6 : 0);
}

/** Days in a chunk of Day details: as many as fit in about `UNIT_SECONDS` at the pace. */
export function chunkDays(groups: readonly MetricGroup[]): number {
	return Math.max(1, Math.floor(UNIT_SECONDS / secondsPerDay(requestsPerDay(groups))));
}

/** Requests the whole activity list takes: the count, then a hundred a page until one comes back short. */
export function listRequests(activities: number): number {
	return 2 + Math.floor(Math.max(0, activities) / 100);
}

/* ------------------------------------------------------------------ */
/*  What a cost is worked out against                                  */
/* ------------------------------------------------------------------ */

export interface CostContext {
	today: string;
	groups: readonly MetricGroup[];
	scan: AccountScan | null;
	/** Where a history walk may stop: the scan's first day or the oldest activity, the earlier. */
	notBefore?: string;
	/** Each chart index's meta, by store. */
	charts: ReadonlyMap<string, ChartMeta | null>;
	/** The activities on the index, by id. */
	activities: ReadonlyMap<number, DetailCandidate>;
	/** How many activities start on each local day. */
	activitiesOn: ReadonlyMap<string, number>;
	/** Each downloaded activity page's version. */
	detailFiles: ReadonlyMap<number, number>;
	sizes: SizeModel;
	latency: Latency;
}

export interface CostInput {
	today: string;
	groups: readonly MetricGroup[];
	scan: AccountScan | null;
	charts: ReadonlyMap<string, ChartMeta | null>;
	/** Every activity on the index, newest first. */
	activities: readonly DetailCandidate[];
	detailFiles: ReadonlyMap<number, number>;
}

export function costContext(input: CostInput, opts: { sizes?: SizeModel; latency?: Latency } = {}): CostContext {
	const oldest = input.activities[input.activities.length - 1]?.date;
	const notBefore = [historyStart(input.scan), oldest].filter((d): d is string => !!d).sort()[0];
	const activitiesOn = new Map<string, number>();
	for (const a of input.activities) activitiesOn.set(a.date, (activitiesOn.get(a.date) ?? 0) + 1);
	return {
		today: input.today,
		groups: input.groups,
		scan: input.scan,
		...(notBefore ? { notBefore } : {}),
		charts: input.charts,
		activities: new Map(input.activities.map((a) => [a.id, a])),
		activitiesOn,
		detailFiles: input.detailFiles,
		sizes: opts.sizes ?? MEASURED_SIZES,
		latency: opts.latency ?? LATENCY,
	};
}

/* ------------------------------------------------------------------ */
/*  Units                                                              */
/* ------------------------------------------------------------------ */

/** One unit of the download, as the runner takes it, with what it costs. */
export type Unit =
	| { kind: "activities"; requests: number; bytes: number; seconds: number }
	| { kind: "walk"; stores: string[]; requests: number; bytes: number; seconds: number }
	| { kind: "days"; from: string; to: string; days: number; requests: number; bytes: number; seconds: number }
	| { kind: "details"; ids: number[]; requests: number; bytes: number; seconds: number };

/** Every unit of the plan, in the order the runner takes them. */
export function unitsOf(tasks: readonly Task[], ctx: CostContext): Unit[] {
	return consume(tasks, ctx, Infinity);
}

/** The unit the runner takes next, or null with nothing left. */
export function nextUnit(tasks: readonly Task[], ctx: CostContext): Unit | null {
	return consume(tasks, ctx, 1)[0] ?? null;
}

/**
 * The plan's units, taken as `runUnit` takes them: the activity list whole;
 * the walks `PACE.parallel` at a time, a segment each; Day details a chunk at
 * a time, newest first; activities a batch at a time (`detailBatch`).
 */
function consume(tasks: readonly Task[], ctx: CostContext, limit: number): Unit[] {
	const out: Unit[] = [];
	const queue: Task[] = tasks.map((t) => (t.kind === "days" ? { ...t } : t.kind === "details" ? { ...t, ids: [...t.ids] } : t));
	const walks = new Map<string, WalkCost>();
	const walkOf = (store: string) => {
		let walk = walks.get(store);
		if (!walk) walks.set(store, (walk = walkCost(store, ctx)));
		return walk;
	};
	const size = chunkDays(ctx.groups);

	while (queue.length && out.length < limit) {
		const task = queue[0];
		if (task.kind === "activities") {
			out.push(listUnit(ctx));
			queue.shift();
		} else if (task.kind === "walk") {
			const side = queue.filter((t): t is Extract<Task, { kind: "walk" }> => t.kind === "walk").slice(0, PACE.parallel);
			const segments = side.map((t) => ({ task: t, segment: walkOf(t.store).segments.shift() }));
			let requests = 0;
			let bytes = 0;
			let seconds = 0;
			for (const { segment } of segments) {
				if (!segment) continue;
				requests += segment.requests;
				bytes += segment.bytes;
				seconds = Math.max(seconds, segment.seconds);
			}
			out.push({ kind: "walk", stores: side.map((t) => t.store), requests, bytes, seconds: seconds + ctx.latency.overhead });
			for (const { task: walk } of segments) if (!walkOf(walk.store).segments.length) queue.splice(queue.indexOf(walk), 1);
		} else if (task.kind === "days") {
			const chunk = nextChunk(task, size);
			out.push(dayUnit(chunk.from, chunk.to, ctx));
			if (chunk.from <= task.from) queue.shift();
			else task.to = shiftDate(chunk.from, -1);
		} else {
			const ids = detailBatch(task.ids, ctx);
			task.ids.splice(0, ids.length);
			if (ids.length) out.push(detailUnit(ids, ctx));
			if (!task.ids.length) queue.shift();
		}
	}
	return out;
}

function listUnit(ctx: CostContext): Unit {
	const listed = Math.max(ctx.scan?.activities ?? 0, ctx.activities.size);
	const requests = listRequests(listed);
	return {
		kind: "activities",
		requests,
		bytes: Math.max(0, listed - ctx.activities.size) * ctx.sizes.activityRow,
		seconds: requests * ctx.latency.window + ctx.latency.overhead,
	};
}

/** A chunk of Day details: its days' requests, the activities listed by date, and the range routes once. */
export function dayUnit(from: string, to: string, ctx: CostContext): Extract<Unit, { kind: "days" }> {
	const w = endpointsFor(ctx.groups);
	const days = spanDays(from, to);
	const perDay = requestsPerDay(ctx.groups);
	let listed = 0;
	for (let date = from; date <= to; date = shiftDate(date, 1)) listed += ctx.activitiesOn.get(date) ?? 0;
	const pages = w.workouts ? 1 + Math.floor(listed / 100) : 0;
	const years = Math.ceil(days / 365);
	const ranges = [w.maxMetrics, w.races, w.hillScores, w.runningTolerance].filter(Boolean).length * years + (w.healthSnapshots ? Math.ceil(days / 28) : 0);
	const dayRequests = days * perDay;
	let bytes = 0;
	for (let date = from; date <= to; date = shiftDate(date, 1)) bytes += dayBytes(date, ctx);
	const latency = ctx.latency;
	const seconds =
		pages * latency.window + (ranges ? latency.window : 0) + Math.max(dayRequests / PACE.limits.rate, Math.ceil(days / PACE.parallel) * latency.batch) + latency.overhead;
	return { kind: "days", from, to, days, requests: dayRequests + pages + ranges, bytes, seconds };
}

/** What a day of Day details writes, weighed by how likely the scan says it has data. */
function dayBytes(date: string, ctx: CostContext): number {
	const sizes = ctx.sizes;
	const timelines = ctx.groups.includes("intraday") ? (date >= shiftDate(ctx.today, -TIMELINE_DAYS) ? sizes.timelines : sizes.oldTimelines) : 0;
	const p = dataChance(date, ctx.scan);
	return p * (sizes.dayFile + timelines) + (1 - p) * sizes.emptyDay;
}

/**
 * How likely a day has data: its week's days with data over the week's days
 * the scan could see (from the history's first day to the scan), and certain
 * past the scan or without one.
 */
function dataChance(date: string, scan: AccountScan | null): number {
	const scanned = scan?.scannedAt.slice(0, 10);
	if (!scan || !scanned || date > scanned) return 1;
	for (const [week, days] of scan.weeks) {
		const last = shiftDate(week, 6);
		if (date < week || date > last) continue;
		const from = scan.firstDay && scan.firstDay > week ? scan.firstDay : week;
		const to = scanned < last ? scanned : last;
		return Math.min(1, days / Math.max(1, spanDays(from, to)));
	}
	return 0;
}

/**
 * Activities' pages, `PACE.parallel` at a time: each by its profile, or two
 * requests and no new bytes for a run an older version saved. An activity
 * asks in two rounds, what the summary decides coming second.
 */
export function detailUnit(ids: readonly number[], ctx: CostContext): Extract<Unit, { kind: "details" }> {
	let requests = 0;
	let bytes = 0;
	for (const id of ids) {
		const cost = detailCost(id, ctx);
		requests += cost.requests;
		bytes += cost.bytes;
	}
	const rounds = Math.ceil(ids.length / PACE.parallel) * 2;
	return { kind: "details", ids: [...ids], requests, bytes, seconds: Math.max(requests / PACE.limits.rate, rounds * ctx.latency.batch) + ctx.latency.overhead };
}

/** The next activities to download together: as many from the head as fit in about `UNIT_SECONDS`, one at least. */
export function detailBatch(ids: readonly number[], ctx: CostContext): number[] {
	let n = 1;
	while (n < ids.length && detailUnit(ids.slice(0, n + 1), ctx).seconds <= UNIT_SECONDS) n += 1;
	return ids.slice(0, n);
}

function detailCost(id: number, ctx: CostContext): { requests: number; bytes: number } {
	const activity = ctx.activities.get(id);
	const profile = activity?.profile ?? "other";
	const held = ctx.detailFiles.get(id);
	if (activity?.run && held === UPGRADED_VERSION) return { requests: UPGRADE_REQUESTS, bytes: 0 };
	return { requests: detailRequests(profile, activity?.power === true), bytes: ctx.sizes.details[profile] };
}

/* ------------------------------------------------------------------ */
/*  History walks                                                      */
/* ------------------------------------------------------------------ */

interface WalkCost {
	/** Segments left, oldest last, as `walkSegment` asks them. */
	segments: Array<{ requests: number; bytes: number; seconds: number }>;
}

/** Indexes whose window asks its two routes one after the other. */
const TWO_TRIPS = new Set(["weight", "ftp", "lactate-threshold"]);

/**
 * A chart index's walk from where it holds back to the history's start: its
 * windows reach `notBefore`, then the empty ones that end it — every one of
 * them for a stat whose history reaches back that far, fewer for one that
 * started later, so an upper bound. Daily stats' windows cost three requests
 * with steps and one without, which the scan's weeks say.
 */
function walkCost(store: string, ctx: CostContext): WalkCost {
	const meta = ctx.charts.get(store);
	if (meta?.complete) return { segments: [] };
	const def = store.startsWith("index:") ? DAY_INDEXES.find((d) => `index:${d.kind}` === store) : undefined;
	const windowDays = def?.windowDays ?? STATS_WINDOW_DAYS;
	const emptyToStop = def?.emptyWindowsToStop ?? 4;
	const until = meta?.from ? shiftDate(meta.from, -1) : ctx.today;

	const windows: Array<{ start: string; end: string }> = [];
	let end = until;
	for (;;) {
		const start = shiftDate(end, -(windowDays - 1));
		windows.push({ start, end });
		if (!ctx.notBefore || start <= ctx.notBefore || windows.length > 400) break;
		end = shiftDate(start, -1);
	}
	const stats = store === "daily-stats";
	const hasData = (w: { start: string; end: string }) => (ctx.scan ? weeksWithData(ctx.scan, w.start, w.end) : true);
	// The empty windows a walk still needs past `notBefore`: daily stats' streak is known from the scan.
	let trailing = 0;
	if (stats) for (let i = windows.length - 1; i >= 0 && !hasData(windows[i]); i--) trailing += 1;
	for (let i = stats ? trailing : 0; i < emptyToStop; i++) {
		const last = windows[windows.length - 1];
		const e = shiftDate(last.start, -1);
		windows.push({ start: shiftDate(e, -(windowDays - 1)), end: e });
	}

	const perWindow = def?.requestsPerWindow ?? 1;
	const trips = def && TWO_TRIPS.has(def.kind) ? 2 : 1;
	const kind = def?.kind ?? store;
	const dataDays = ctx.scan && ctx.notBefore ? Math.max(0, daysSince(ctx.scan, ctx.notBefore) - (until < ctx.today ? daysSince(ctx.scan, shiftDate(until, 1)) : 0)) : 0;
	const bytesPerWindow = windows.length ? (dataDays * (ROW_BYTES[kind] ?? 0)) / windows.length : 0;

	const segments: WalkCost["segments"] = [];
	const per = segmentWindows(windowDays);
	for (let i = 0; i < windows.length; i += per) {
		let requests = 0;
		let roundTrips = 0;
		for (const window of windows.slice(i, i + per)) {
			const withSteps = stats && hasData(window);
			requests += stats ? (withSteps ? 3 : 1) : perWindow;
			roundTrips += stats ? (withSteps ? 2 : 1) : trips;
		}
		const count = Math.min(per, windows.length - i);
		segments.push({ requests, bytes: bytesPerWindow * count, seconds: roundTrips * ctx.latency.window });
	}
	return { segments };
}

/** Whether the scan saw data in `from..to`: a week with data overlapping it, never before the history's first day. */
function weeksWithData(scan: AccountScan, from: string, to: string): boolean {
	const lo = scan.firstDay && scan.firstDay > from ? scan.firstDay : from;
	if (lo > to) return false;
	return scan.weeks.some(([week, days]) => days > 0 && week <= to && shiftDate(week, 6) >= lo);
}

/* ------------------------------------------------------------------ */
/*  Time                                                               */
/* ------------------------------------------------------------------ */

/**
 * Seconds `units` take from `now`, run one after another as the runner runs
 * them under the hourly budget: a copy of the budget's ledger waits each one
 * out until it fits, the unit runs, and its requests join the hour.
 */
export function timeFor(units: readonly Unit[], outlook: BudgetOutlook, now: number): number {
	if (!units.length) return 0;
	let held: unknown = { entries: outlook.entries.map((e) => ({ ...e })), ...(outlook.halvedUntil !== undefined ? { halvedUntil: outlook.halvedUntil } : {}) };
	const budget = new RequestBudget(() => outlook.perHour, {
		load: () => held,
		save: (ledger) => {
			held = ledger;
		},
	});
	let at = now;
	for (const unit of units) {
		at += budget.waitFor(unit.requests, at);
		at += unit.seconds * 1000;
		budget.add(unit.requests, at);
	}
	return (at - now) / 1000;
}

/** A fresh hour: nothing spent yet. */
export function freshHour(): BudgetOutlook {
	return { entries: [], perHour: HOURLY_BUDGET };
}

export function spanDays(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
