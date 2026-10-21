import { planBackfill, type BudgetOutlook, type PlanInput, type Task } from "./backfill";
import { costContext, freshHour, ROW_BYTES, timeFor, unitsOf, type CostContext, type SizeModel, type Unit } from "./cost";
import { rangeStart, type ConsentKey, type DataSetId } from "./datasets";
import { shiftDate } from "./day-index";
import { DAY_INDEXES } from "./day-indexes";
import type { Latency } from "./pace";
import { daysSince, historyStart } from "./scan";

/**
 * How much a choice of data sets stores and how long its download takes, for
 * the setup, Settings → History and the update dialog: the plan the download
 * would run (`planBackfill`), costed a unit at a time as the download runs
 * it, through the same hourly budget (`cost.ts`). Every figure is an
 * estimate, shown as "about".
 *
 * Pure.
 */

export interface EstimateInput extends PlanInput {
	/** Bytes per day and per activity: measured, or the vault's own (`calibrate`). */
	sizes?: SizeModel;
	latency?: Latency;
	/** The hour as it stands (`RequestBudget.outlook`); a fresh one without it. */
	budget?: BudgetOutlook;
	/** Epoch ms the download would start at. */
	now?: number;
}

export interface SetEstimate {
	id: DataSetId;
	/** Days, or activities, to fetch; for Charts & trends, the days of history with data. */
	units: number;
	bytes: number;
	requests: number;
	seconds: number;
	/** What keeping every new day, or activity, adds a year. */
	bytesPerYear: number;
}

export interface Estimate {
	sets: SetEstimate[];
	bytes: number;
	requests: number;
	seconds: number;
	bytesPerYear: number;
	/** The biggest single file the choice keeps: Obsidian Sync's Standard plan takes 5 MB a file. */
	largestFile: number;
}

const SETS: readonly DataSetId[] = ["charts", "day-details", "activity-details"];

export function estimate(input: EstimateInput): Estimate {
	const ctx = contextOf(input);
	const units = unitsOf(planBackfill(input), ctx);
	const outlook = input.budget ?? freshHour();
	const now = input.now ?? Date.now();
	const sets = SETS.map((id): SetEstimate => {
		const mine = units.filter((unit) => setOf(unit) === id);
		return {
			id,
			units: unitCount(id, mine, input),
			bytes: Math.round(sum(mine, (u) => u.bytes)),
			requests: sum(mine, (u) => u.requests),
			// A set alone, as if the others were done.
			seconds: timeFor(mine, outlook, now),
			bytesPerYear: Math.round(perYear(id, input, ctx)),
		};
	});
	const activitiesPerYear = lastYear(input).length;
	return {
		sets,
		bytes: sum(sets, (s) => s.bytes),
		requests: sum(sets, (s) => s.requests),
		// The budget holds across the whole download, not set by set.
		seconds: timeFor(units, outlook, now),
		bytesPerYear: sum(sets, (s) => s.bytesPerYear),
		largestFile: Math.max(365 * ctx.sizes.dayFile, activitiesPerYear * ctx.sizes.activityRow),
	};
}

/**
 * What agreeing to `keys` adds to the download over what is agreed already:
 * a line of the update dialog, or its picked lines together, timed as one.
 */
export function estimateDelta(input: EstimateInput, keys: readonly ConsentKey[]): { requests: number; bytes: number; seconds: number } {
	const before = planBackfill(input);
	const after = planBackfill({ ...input, accepted: [...new Set([...input.accepted, ...keys])] });
	const units = unitsOf(added(before, after), contextOf(input));
	return {
		requests: sum(units, (u) => u.requests),
		bytes: Math.round(sum(units, (u) => u.bytes)),
		seconds: timeFor(units, input.budget ?? freshHour(), input.now ?? Date.now()),
	};
}

function contextOf(input: EstimateInput): CostContext {
	return costContext(input, { ...(input.sizes ? { sizes: input.sizes } : {}), ...(input.latency ? { latency: input.latency } : {}) });
}

function setOf(unit: Unit): DataSetId {
	return unit.kind === "days" ? "day-details" : unit.kind === "details" ? "activity-details" : "charts";
}

function unitCount(id: DataSetId, units: readonly Unit[], input: EstimateInput): number {
	if (id === "day-details") return sum(units, (u) => (u.kind === "days" ? u.days : 0));
	if (id === "activity-details") return sum(units, (u) => (u.kind === "details" ? u.ids.length : 0));
	const start = historyStart(input.scan);
	return start && input.scan ? daysSince(input.scan, start) : 0;
}

/** What a year of new days, or activities, adds to a set. */
function perYear(id: DataSetId, input: EstimateInput, ctx: CostContext): number {
	const on = new Set(input.groups);
	if (id === "day-details") return 365 * (ctx.sizes.dayFile + (on.has("intraday") ? ctx.sizes.timelines : 0));
	if (id === "activity-details") {
		if (!rangeStart(input.activityDetails, input.today, historyStart(input.scan)) || !on.has("workouts")) return 0;
		return sum(lastYear(input), (a) => ctx.sizes.details[a.profile]);
	}
	let row = 0;
	if (on.has("activity")) row += ROW_BYTES["daily-stats"] ?? 0;
	if (on.has("sleep")) row += ROW_BYTES.sleep ?? 0;
	for (const def of DAY_INDEXES) if (on.has(def.group)) row += ROW_BYTES[def.kind] ?? 0;
	return 365 * row + (on.has("workouts") ? lastYear(input).length * ctx.sizes.activityRow : 0);
}

function lastYear(input: EstimateInput) {
	const from = shiftDate(input.today, -364);
	return input.activities.filter((a) => a.date >= from);
}

/** The tasks of `after` that `before` lacks: whole lists and walks, and the days and activities on their own. */
function added(before: readonly Task[], after: readonly Task[]): Task[] {
	const listed = before.some((t) => t.kind === "activities");
	const walks = new Set(before.flatMap((t) => (t.kind === "walk" ? [t.store] : [])));
	const days = new Set(before.flatMap((t) => (t.kind === "days" ? datesOf(t.from, t.to) : [])));
	const ids = new Set(before.flatMap((t) => (t.kind === "details" ? t.ids : [])));
	const out: Task[] = [];
	for (const task of after) {
		if (task.kind === "activities") {
			if (!listed) out.push(task);
		} else if (task.kind === "walk") {
			if (!walks.has(task.store)) out.push(task);
		} else if (task.kind === "days") {
			for (const stretch of stretchesOf(datesOf(task.from, task.to).filter((d) => !days.has(d))).reverse()) out.push({ kind: "days", ...stretch });
		} else {
			const fresh = task.ids.filter((id) => !ids.has(id));
			if (fresh.length) out.push({ kind: "details", ids: fresh });
		}
	}
	return out;
}

function datesOf(from: string, to: string): string[] {
	const out: string[] = [];
	for (let date = from; date <= to; date = shiftDate(date, 1)) out.push(date);
	return out;
}

/** Consecutive days as stretches, oldest first. */
function stretchesOf(days: readonly string[]): Array<{ from: string; to: string }> {
	const out: Array<{ from: string; to: string }> = [];
	for (const date of days) {
		const last = out[out.length - 1];
		if (last && shiftDate(last.to, 1) === date) last.to = date;
		else out.push({ from: date, to: date });
	}
	return out;
}

function sum<T>(items: readonly T[], of: (item: T) => number): number {
	return items.reduce((total, item) => total + of(item), 0);
}

/** "≈ 3.9 MB", "≈ 640 KB", "< 1 KB". */
export function formatBytes(bytes: number): string {
	if (bytes < 1_000) return bytes > 0 ? "< 1 KB" : "0 KB";
	if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
	if (bytes < 10_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
	if (bytes < 1_000_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
	return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

/** "under a minute", "about 4 minutes", "about 2.5 hours". */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return "under a minute";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
	const hours = seconds / 3600;
	if (hours < 1.25) return "about 1 hour";
	if (hours < 10) return `about ${Math.round(hours * 2) / 2} hours`;
	return `about ${Math.round(hours)} hours`;
}
