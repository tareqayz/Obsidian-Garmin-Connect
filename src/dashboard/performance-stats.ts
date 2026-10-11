import type { PeriodRange } from "./periods";
import { statRegistry, type StatDef } from "./stat-registry";

/**
 * Performance Stats: what the app lists under More → Performance Stats, in
 * its order, then the two pages it opens only from Training Status (Load and
 * Heat Acclimation, `hub: false`).
 *
 * As with Health Stats, a stat shows up in the hub, gets an "Open …" command
 * and opens from its At a Glance card only once its page is registered in
 * `PERFORMANCE_PAGES`. Cycling Ability is listed for the hub's order but has
 * no page yet, so it is neither routed nor shown (ref/performance-stats).
 *
 * Ranges are the phone's (2026-10-11 shots). "Current" is 1d, labelled as
 * Fitness Age labels it. The `spans` are placeholders from the shots until
 * each stat's spec proves its rule; a builder's integration note corrects
 * its line. Groups reuse the settings' existing ones, so no vault needs a
 * migration.
 *
 * Pure: the routes, the hub, `main.ts` and the tests all read it.
 */

export type PerformanceStatId =
	| "training-status"
	| "training-readiness"
	| "hrv-status"
	| "race-predictor"
	| "vo2-max"
	| "running-economy"
	| "training-effect"
	| "cycling-power-curve"
	| "ftp"
	| "cycling-ability"
	| "critical-swim-speed"
	| "running-tolerance"
	| "running-lactate-threshold"
	| "endurance-score"
	| "hill-score"
	| "hrv-stress"
	| "training-load"
	| "heat-acclimation";

/** The stats on the shared `performance-stat` route: every one but Cycling Ability, which has no page. */
export type PerformanceStatPageId = Exclude<PerformanceStatId, "cycling-ability">;

export type PerformanceStat<Id extends PerformanceStatId = PerformanceStatId> = StatDef<Id>;

const CURRENT: Partial<Record<PeriodRange, string>> = { "1d": "Current" };

export const PERFORMANCE_STATS: readonly PerformanceStat[] = [
	// Current: the status, its load focus and the rows that open VO₂ Max, HRV Status, Load and Heat Acclimation.
	{ id: "training-status", title: "Training Status", ranges: ["1d", "4w", "12w", "6m"], defaultRange: "1d", rangeLabels: CURRENT, group: "training", glance: ["trainingStatus"] },
	// A day at a time with a day stepper, no range control; each factor opens a sheet (`sub`).
	{ id: "training-readiness", title: "Training Readiness", ranges: ["1d"], defaultRange: "1d", group: "readiness", glance: ["readiness"] },
	{ id: "hrv-status", title: "HRV Status", ranges: ["1d", "7d", "4w"], defaultRange: "1d", group: "hrv", glance: ["hrv"] },
	// 6m and 1y draw a point on each month end and today: May 31 - Oct 11.
	{
		id: "race-predictor",
		title: "Race Predictor",
		ranges: ["1d", "4w", "6m", "1y"],
		defaultRange: "1d",
		rangeLabels: CURRENT,
		group: "races",
		spans: { "6m": { monthEnds: 6 }, "1y": { monthEnds: 12 } },
	},
	{
		id: "vo2-max",
		title: "VO₂ Max",
		ranges: ["1d", "4w", "12w", "6m"],
		defaultRange: "1d",
		rangeLabels: CURRENT,
		rangeControl: "wide",
		tabs: ["running", "cycling"],
		tabLabels: { running: "VO₂ Max", cycling: "Cycling" },
		group: "fitness",
		glance: ["vo2max", { id: "cyclingVo2", tab: "cycling" }],
	},
	{ id: "running-economy", title: "Running Economy", ranges: ["1d", "4w", "12w", "1y"], defaultRange: "1d", rangeLabels: CURRENT, group: "fitness", glance: ["runningEconomy"] },
	{ id: "training-effect", title: "Training Effect", ranges: ["7d", "4w"], defaultRange: "7d", rangeControl: "wide", group: "workouts" },
	// 3m and 1y count months back from today: Jul 12 - Oct 11, Oct 12, 2025 - Oct 11, 2026.
	{
		id: "cycling-power-curve",
		title: "Cycling Power Curve",
		ranges: ["4w", "3m", "1y"],
		defaultRange: "4w",
		group: "workouts",
		spans: { "3m": { months: 3 }, "1y": { months: 12 } },
	},
	{
		id: "ftp",
		title: "FTP",
		ranges: ["1d", "4w", "12w", "1y"],
		defaultRange: "1d",
		rangeLabels: CURRENT,
		tabs: ["cycling", "xc"],
		tabLabels: { cycling: "Cycling", xc: "Cross Country Skiing" },
		group: "fitness",
		glance: [
			{ id: "cyclingFtp", tab: "cycling" },
			{ id: "xcSkiFtp", tab: "xc" },
		],
	},
	// Left out for now: no page, so the hub hides it (TODO.md).
	{ id: "cycling-ability", title: "Cycling Ability", ranges: ["1d"], defaultRange: "1d", group: "profile" },
	{ id: "critical-swim-speed", title: "Critical Swim Speed", ranges: ["1d", "7d", "12w", "1y"], defaultRange: "1d", rangeLabels: CURRENT, group: "workouts", glance: ["criticalSwimSpeed"] },
	// Weekly totals in Sunday-to-Saturday weeks, this one so far the last: Jul 26 - Oct 11, Oct 19, 2025 - Oct 11, 2026.
	{
		id: "running-tolerance",
		title: "Running Tolerance",
		ranges: ["1d", "12w", "1y"],
		defaultRange: "1d",
		rangeLabels: CURRENT,
		group: "training",
		glance: ["runningTolerance"],
		spans: { "12w": { weeks: 12, weekStart: 0 }, "1y": { weeks: 52, weekStart: 0 } },
	},
	{
		id: "running-lactate-threshold",
		title: "Running Lactate Threshold",
		ranges: ["1d", "4w", "12w", "1y"],
		defaultRange: "1d",
		rangeLabels: CURRENT,
		group: "fitness",
		glance: ["lactateThreshold"],
	},
	{
		id: "endurance-score",
		title: "Endurance Score",
		ranges: ["1d", "12w", "1y"],
		defaultRange: "1d",
		tabs: ["score", "contributors"],
		tabLabels: { score: "Endurance Score", contributors: "Top Contributors" },
		group: "fitness",
		glance: ["endurance"],
	},
	// 1y in calendar months, "Nov 2025 - Oct 2026"; a month card opens its month (`sub`).
	{
		id: "hill-score",
		title: "Hill Score",
		ranges: ["1d", "4w", "12w", "1y"],
		defaultRange: "1d",
		group: "fitness",
		glance: ["hillScore"],
		spans: { "1y": { months: 12, calendar: true } },
	},
	{ id: "hrv-stress", title: "HRV Stress", ranges: ["7d", "4w"], defaultRange: "7d", group: "hrv" },
	// Opened from Training Status, and from the Load Focus and Training Load cards on their tabs.
	{
		id: "training-load",
		title: "Load",
		ranges: ["4w"],
		defaultRange: "4w",
		tabs: ["focus", "exercise", "training"],
		tabLabels: { focus: "Load Focus", exercise: "Exercise Load", training: "Training Load" },
		hub: false,
		group: "training",
		glance: [
			{ id: "loadFocus", tab: "focus" },
			{ id: "trainingLoad", tab: "training" },
		],
	},
	// Opened from Training Status and its At a Glance card.
	{ id: "heat-acclimation", title: "Heat Acclimation", ranges: ["1d", "7d", "4w"], defaultRange: "1d", hub: false, group: "fitness", glance: ["heat"] },
];

/** Performance's registry: Cycling Ability has no page, so it is neither routed nor in the hub. */
export const PERFORMANCE_REGISTRY = statRegistry(PERFORMANCE_STATS, { noPage: ["cycling-ability"] });
