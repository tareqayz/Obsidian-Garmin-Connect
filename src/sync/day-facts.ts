import type { ChartMeta } from "./backfill";
import { isEmptySeries, mapSeries, type IntradayPayloads } from "./intraday";
import { mapDay, type DayData, type MetricGroup } from "./metrics";

/**
 * What the complete chart indexes say about a day, so the history download
 * doesn't ask a route on a day it is known to be empty: the weigh-in only on
 * weigh-in days, Health Status only on its days, HRV, readiness and training
 * status only on the days they list, and the summary, with the day's
 * timelines, only on days a summary-fed index lists. Sleep, endurance and
 * fitness age are always asked: their per-day answers carry values no index
 * lists by day.
 *
 * Seen to hold on one account, so each mask must earn its trust on yours: it
 * is only used once `AUDIT_DAYS` days it would have skipped came back empty,
 * and a day with data turns it off for the account (`tally`). Only the
 * history download masks; a routine sync or a date range asks everything.
 *
 * Pure.
 */

export type MaskRoute = "body" | "health" | "hrv" | "readiness" | "training" | "summary";

export const MASK_ROUTES: readonly MaskRoute[] = ["body", "health", "hrv", "readiness", "training", "summary"];

/**
 * The chart stores whose rows vouch for a route, each with the group that
 * keeps it. A route can be masked only when every one of them whose group is
 * on is complete; the summary's days are those any of them lists.
 */
export const MASK_STORES: Record<MaskRoute, ReadonlyArray<{ store: string; group: MetricGroup }>> = {
	body: [{ store: "index:weight", group: "body" }],
	health: [{ store: "index:health-status", group: "health" }],
	hrv: [{ store: "index:hrv-status", group: "hrv" }],
	readiness: [{ store: "index:training-readiness", group: "readiness" }],
	training: [{ store: "index:training-status", group: "training" }],
	summary: [
		{ store: "daily-stats", group: "activity" },
		{ store: "index:stress", group: "stress" },
		{ store: "index:body-battery", group: "stress" },
		{ store: "index:heart-rate", group: "heart" },
		{ store: "index:respiration", group: "respiration" },
		{ store: "index:pulse-ox", group: "spo2" },
	],
};

/** The chart stores the setup walks before you choose (`prepareHistory`): one request or a few each, and the masks they vouch for. */
export const PREPARED_STORES: readonly string[] = ["index:weight", "index:health-status", "index:hrv-status", "index:training-readiness", "index:training-status"];

/** For each route the complete indexes can vouch for, the days they list. */
export type DayFacts = Partial<Record<MaskRoute, ReadonlySet<string>>>;

/** The days each route's indexes all cover: outside them, a missing row says nothing. */
export type FactSpans = Partial<Record<MaskRoute, { from?: string; to?: string }>>;

/** What the plan and the download mask with: the facts, where they hold, and this account's verdicts. */
export interface Masks {
	facts: DayFacts;
	spans: FactSpans;
	verdicts: MaskVerdicts;
}

/** Where every one of a route's stores has walked: the latest start and the earliest end. */
export function factSpan(stores: readonly string[], charts: ReadonlyMap<string, ChartMeta | null>): { from?: string; to?: string } {
	let from: string | undefined;
	let to: string | undefined;
	for (const store of stores) {
		const meta = charts.get(store);
		if (meta?.from && (!from || meta.from > from)) from = meta.from;
		if (meta?.to && (!to || meta.to < to)) to = meta.to;
	}
	return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

/** Days a mask would have skipped that came back empty, until `AUDIT_DAYS`: then trusted. Off once one didn't. */
export type MaskVerdict = number | "trusted" | "off";
export type MaskVerdicts = Partial<Record<MaskRoute, MaskVerdict>>;

/** Empty days in a row a mask must see before it skips anything. */
export const AUDIT_DAYS = 5;

/** The stores to read for the facts: those of each route whose stores, with their group on, are all complete. */
export function factStores(groups: readonly MetricGroup[], charts: ReadonlyMap<string, ChartMeta | null>): Map<MaskRoute, string[]> {
	const out = new Map<MaskRoute, string[]>();
	for (const route of MASK_ROUTES) {
		const stores = MASK_STORES[route].filter((s) => groups.includes(s.group)).map((s) => s.store);
		if (stores.length && stores.every((store) => charts.get(store)?.complete === true)) out.set(route, stores);
	}
	return out;
}

/**
 * The routes the facts say are empty on `date`, whatever their verdict. A
 * date outside an index's span (`from`, the last day it covers) is never
 * vouched for.
 */
export function emptyRoutes(date: string, facts: DayFacts, spans?: FactSpans): Set<MaskRoute> {
	const out = new Set<MaskRoute>();
	for (const route of MASK_ROUTES) {
		const days = facts[route];
		if (!days || days.has(date)) continue;
		const span = spans?.[route];
		if (span?.from && date < span.from) continue;
		if (span?.to && date > span.to) continue;
		out.add(route);
	}
	return out;
}

/** The routes the history download leaves out on `date`: empty by the facts, with a mask trusted on this account. */
export function skippedRoutes(date: string, { facts, verdicts, spans }: Masks): Set<MaskRoute> {
	const out = new Set<MaskRoute>();
	for (const route of emptyRoutes(date, facts, spans)) if (verdicts[route] === "trusted") out.add(route);
	return out;
}

/**
 * The routes the estimate leaves out: any the facts say are empty, unless its
 * mask was turned off. A mask still being checked is reckoned trusted: the
 * few days of its check are within the estimate's error.
 */
export function plannedSkips(date: string, { facts, verdicts, spans }: Masks): Set<MaskRoute> {
	const out = new Set<MaskRoute>();
	for (const route of emptyRoutes(date, facts, spans)) if (verdicts[route] !== "off") out.add(route);
	return out;
}

/** The masked routes asked anyway on `date`, to check them: empty by the facts, with a verdict still being earned. */
export function auditedRoutes(date: string, { facts, verdicts, spans }: Masks): Set<MaskRoute> {
	const out = new Set<MaskRoute>();
	for (const route of emptyRoutes(date, facts, spans)) if (typeof (verdicts[route] ?? 0) === "number") out.add(route);
	return out;
}

/** The verdicts after some masked days were asked anyway: each empty one counts toward trust, and one with data turns the mask off. */
export function tally(verdicts: MaskVerdicts, heard: ReadonlyArray<{ route: MaskRoute; empty: boolean }>): MaskVerdicts {
	const out: MaskVerdicts = { ...verdicts };
	for (const { route, empty } of heard) {
		const now = out[route] ?? 0;
		if (now === "off" || now === "trusted") continue;
		out[route] = !empty ? "off" : now + 1 >= AUDIT_DAYS ? "trusted" : now + 1;
	}
	return out;
}

/** The payload a route's answer lands in. */
const PART: Record<MaskRoute, keyof DayData> = { body: "body", health: "health", hrv: "hrv", readiness: "readiness", training: "training", summary: "summary" };

/**
 * Whether a route's answer for a day held nothing the vault would keep: no
 * property in the day file and, for the summary, no timeline either.
 */
export function routeEmpty(route: MaskRoute, data: DayData, intraday: IntradayPayloads, opts: { groups: readonly MetricGroup[]; units: "metric" | "imperial"; date: string }): boolean {
	const part = PART[route];
	const properties = mapDay({ [part]: data[part] }, { groups: opts.groups, units: opts.units, date: opts.date });
	if (Object.keys(properties).length) return false;
	if (route !== "summary") return true;
	return isEmptySeries(mapSeries({ ...intraday, sleep: null }));
}

/** Verdicts as scan.json keeps them, or none for anything else. */
export function parseVerdicts(raw: unknown): MaskVerdicts {
	const out: MaskVerdicts = {};
	if (!raw || typeof raw !== "object") return out;
	for (const route of MASK_ROUTES) {
		const v = (raw as Record<string, unknown>)[route];
		if (v === "trusted" || v === "off") out[route] = v;
		else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < AUDIT_DAYS) out[route] = v;
	}
	return out;
}
