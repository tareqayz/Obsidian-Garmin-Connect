import { statFor, type GlanceId, type Tone } from "../dashboard/glance";
import { healthStat } from "../dashboard/health-stats";
import { PERFORMANCE_REGISTRY } from "../dashboard/performance-stats";
import { STAT_RANGES } from "../dashboard/stats-pages";
import { cardByName, cardKey, editDistance } from "./catalog";

/**
 * Every chart a note can draw, by the name its `garmin` block's `chart:` line
 * uses: a stat page's own chart, for a day or for the 7 days, 4 weeks or year
 * ending on it. Pure.
 *
 * A chart answers to its stat's card names (`sleep`, `heart-rate`, `spo2`),
 * and takes the ranges its page has: Body Battery, HRV Status, Respiration
 * and Pulse Ox have no year. The guide, the picker and the docs list them in
 * this order.
 */

export type ChartRange = "1d" | "7d" | "4w" | "1y";

export const CHART_RANGES: readonly ChartRange[] = ["1d", "7d", "4w", "1y"];

export type ChartId =
	| "sleep"
	| "body-battery"
	| "stress"
	| "heart-rate"
	| "steps"
	| "floors"
	| "intensity-minutes"
	| "hrv-status"
	| "respiration"
	| "pulse-ox"
	| "weight";

export interface ChartEntry {
	/** The name a block's `chart:` line uses, the stat's card's own. */
	id: ChartId;
	title: string;
	/** A Lucide icon and its colour, as the stat's Home card draws them. */
	icon: string;
	tone?: Tone;
	/** The ranges its page has, in order. */
	ranges: readonly ChartRange[];
	/** One sentence: what it draws. */
	description: string;
}

/** The At a Glance card a chart takes its icon and colour from. */
function chart(id: ChartId, glance: GlanceId, title: string, ranges: readonly ChartRange[], description: string): ChartEntry {
	const stat = statFor(glance);
	return { id, title, icon: stat.icon, ...(stat.tone ? { tone: stat.tone } : {}), ranges, description };
}

const health = (id: Parameters<typeof healthStat>[0]): readonly ChartRange[] => healthStat(id)!.ranges;

export const CHARTS: readonly ChartEntry[] = [
	chart("sleep", "sleep", "Sleep", health("sleep"), "Last night’s stages, or your sleep scores."),
	chart("body-battery", "bodyBattery", "Body Battery", health("body-battery"), "The day’s Body Battery, or its daily highs and lows."),
	chart("stress", "stress", "Stress", health("stress"), "The day’s stress, or its daily averages."),
	chart("heart-rate", "heartRate", "Heart Rate", health("heart-rate"), "The day’s heart rate, or resting and high by day."),
	chart("steps", "steps", "Steps", STAT_RANGES, "Steps through the day, or daily totals against your goal."),
	chart("floors", "floors", "Floors", STAT_RANGES, "Floors through the day, or daily totals against your goal."),
	chart("intensity-minutes", "intensity", "Intensity Minutes", STAT_RANGES, "Minutes through the day, or totals against your weekly goal."),
	chart("hrv-status", "hrv", "HRV Status", PERFORMANCE_REGISTRY.get("hrv-status")!.ranges as readonly ChartRange[], "The night’s HRV, or nightly averages against your baseline."),
	chart("respiration", "respiration", "Respiration", health("respiration"), "Breaths a minute through the day, or daily averages."),
	chart("pulse-ox", "pulseOx", "Pulse Ox", health("pulse-ox"), "Blood oxygen through the day, or daily averages."),
	chart("weight", "weight", "Weight", health("weight"), "The day’s weigh-ins, or your weight over time."),
];

const BY_ID = new Map<string, ChartEntry>(CHARTS.map((c) => [c.id, c]));

/** A chart by a name its stat's card answers to: `sleep`, `Heart Rate`, `spo2`. */
export function chartByName(name: string): ChartEntry | undefined {
	return BY_ID.get(cardByName(name)?.id ?? "") ?? CHARTS.find((c) => cardKey(c.id) === cardKey(name));
}

/** The chart a mistyped name most likely meant, if one is close. */
export function closestChart(name: string): ChartEntry | undefined {
	const key = cardKey(name);
	if (!key) return undefined;
	let best: { chart: ChartEntry; distance: number } | undefined;
	for (const c of CHARTS) {
		const distance = editDistance(key, cardKey(c.id));
		if (!best || distance < best.distance) best = { chart: c, distance };
	}
	return best && best.distance <= Math.max(2, Math.floor(key.length / 3)) ? best.chart : undefined;
}

/** "1d, 7d and 4w": a chart's ranges in a sentence. */
export function rangesInWords(ranges: readonly ChartRange[]): string {
	return ranges.length < 2 ? ranges.join("") : `${ranges.slice(0, -1).join(", ")} and ${ranges[ranges.length - 1]}`;
}
