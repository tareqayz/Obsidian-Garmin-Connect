import type { GlanceId } from "./glance";
import { statRegistry, type StatDef } from "./stat-registry";

/**
 * Health Stats: what the app lists under More → Health Stats, in its order.
 *
 * Every stat is listed here from the start; a stat shows up in the hub, gets
 * an "Open …" command and opens from its At a Glance card only once its page
 * is registered in `HEALTH_PAGES` (`src/ui/svelte/health/pages.ts`). Sleep is
 * listed for the hub's order but keeps its own route and page.
 *
 * Read through the shared stat registry (`stat-registry.ts`), as Performance
 * Stats is. Pure: the routes, the hub, `main.ts` and the tests all read it.
 */

export type HealthStatId =
	| "sleep"
	| "health-status"
	| "lifestyle-logging"
	| "weight"
	| "pulse-ox"
	| "pulse-ox-acclimation"
	| "respiration"
	| "heart-rate"
	| "blood-pressure"
	| "stress"
	| "body-battery"
	| "fitness-age"
	| "health-snapshot";

/** The stats on the shared `health-stat` route: every one but Sleep. */
export type HealthStatPageId = Exclude<HealthStatId, "sleep">;

export type HealthRange = "1d" | "7d" | "4w" | "1y";

export const HEALTH_RANGES: readonly HealthRange[] = ["1d", "7d", "4w", "1y"];

/** A Health stat: the shared `StatDef` on Health's four ranges, its At a Glance cards by id alone. */
export interface HealthStat<Id extends HealthStatId = HealthStatId> extends StatDef<Id> {
	/** The range control's segments, in order. A stat with one has no control. */
	ranges: readonly HealthRange[];
	defaultRange: HealthRange;
	/** At a Glance cards that open this stat's page once it is built. */
	glance?: readonly GlanceId[];
}

/*
 * Ranges are what the phone showed where a capture exists (Sleep, Health
 * Status) and all four elsewhere until the stat's spec says otherwise; a
 * builder's integration note corrects its line. Groups reuse the settings'
 * existing ones, so no vault needs a migration.
 */
const ALL: readonly HealthRange[] = HEALTH_RANGES;
const DAY: readonly HealthRange[] = ["1d"];

export const HEALTH_STATS: readonly HealthStat[] = [
	{ id: "sleep", title: "Sleep", ranges: ALL, defaultRange: "1d", group: "sleep", glance: ["sleep"] },
	// A day at a time with a day stepper; each metric opens a sheet (`sub`).
	{ id: "health-status", title: "Health Status", ranges: DAY, defaultRange: "1d", group: "health", glance: ["healthStatus"] },
	// A placeholder page until a later version: no range control, no data.
	{ id: "lifestyle-logging", title: "Lifestyle Logging", ranges: DAY, defaultRange: "1d", group: "health", glance: ["lifestyle"] },
	{ id: "weight", title: "Weight", ranges: ALL, defaultRange: "1d", group: "body", glance: ["weight"] },
	// 1d / 7d / 4w only (ref/health-stats/pulse-ox/README.md).
	{ id: "pulse-ox", title: "Pulse Ox", ranges: ["1d", "7d", "4w"], defaultRange: "1d", group: "spo2", glance: ["pulseOx"] },
	// 7d / 4w only, no day page on the phone (ref/health-stats/pulse-ox-acclimation/README.md).
	{ id: "pulse-ox-acclimation", title: "Pulse Ox Acclimation", ranges: ["7d", "4w"], defaultRange: "7d", group: "spo2" },
	// 1d / 7d / 4w only (ref/health-stats/respiration/README.md).
	{ id: "respiration", title: "Respiration", ranges: ["1d", "7d", "4w"], defaultRange: "1d", group: "respiration", glance: ["respiration"] },
	{ id: "heart-rate", title: "Heart Rate", ranges: ALL, defaultRange: "1d", group: "heart", glance: ["heartRate"] },
	{ id: "blood-pressure", title: "Blood Pressure", ranges: ALL, defaultRange: "1d", group: "body", glance: ["bloodPressure"] },
	{ id: "stress", title: "Stress", ranges: ALL, defaultRange: "1d", group: "stress", glance: ["stress"] },
	// No 1y on the phone or the web (ref/health-stats/body-battery/README.md).
	{ id: "body-battery", title: "Body Battery", ranges: ["1d", "7d", "4w"], defaultRange: "1d", group: "stress", glance: ["bodyBattery"] },
	// Current / 7d / 4w / 1y: Current is the day's computation, no stepper (ref/health-stats/fitness-age/README.md).
	{ id: "fitness-age", title: "Fitness Age", ranges: ALL, defaultRange: "1d", rangeLabels: { "1d": "Current" }, group: "fitness", glance: ["fitnessAge"] },
	// A list and a detail (`sub` = the snapshot's uuid, `date` its day); no ranges, no stepper.
	{ id: "health-snapshot", title: "Health Snapshot", ranges: DAY, defaultRange: "1d", group: "health" },
];

/** Health's registry: Sleep keeps its own route, so the hub lists it but the shared route refuses it. */
export const HEALTH_REGISTRY = statRegistry(HEALTH_STATS, { ownRoute: ["sleep"] });

/** A stat by its id, or undefined for anything else. */
export function healthStat(id: unknown): HealthStat | undefined {
	return HEALTH_REGISTRY.get(id);
}

/** A stat on the shared route — any but Sleep — by its id. */
export function pageStat(id: unknown): HealthStat<HealthStatPageId> | undefined {
	return HEALTH_REGISTRY.page(id);
}

/**
 * The stats whose page is registered, in the app's order, without Sleep:
 * what gets an "Open …" command. `registered` is `Object.keys(HEALTH_PAGES)`.
 */
export function pageStats(registered: Iterable<string>): HealthStat<HealthStatPageId>[] {
	return HEALTH_REGISTRY.pageStats(registered);
}

/** The hub's rows: Sleep, then every stat whose page is registered, in the app's order. */
export function hubStats(registered: Iterable<string>): HealthStat[] {
	return HEALTH_REGISTRY.hubStats(registered);
}

/** The registered stat an At a Glance card opens, if any. Sleep's card has its own route. */
export function glanceStat(glance: GlanceId, registered: Iterable<string>): HealthStat<HealthStatPageId> | undefined {
	return HEALTH_REGISTRY.glanceTarget(glance, registered)?.stat;
}
