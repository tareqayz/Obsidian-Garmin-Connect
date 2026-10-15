import { typeLabel } from "./activities";
import { SHORT_MONTHS } from "./periods";

/**
 * Words the activity page shares across its tabs: the sport in the bar, the
 * date line, the Primary Benefit, Feel and Perceived Effort. Garmin keeps these
 * in the app's phrase tables, not the API; the ones not yet seen on the phone
 * or the web are marked Inferred.
 *
 * Pure: no Obsidian import.
 */

/** The bar's title: the sport, as Garmin names it ("Running", "Treadmill Running"). */
export function sportTitle(type: string): string {
	return type ? typeLabel(type) : "Activity";
}

/**
 * The date line and the running list's subtitle: "Oct 10 @ 8:19 AM", from the
 * local start. Another year adds it after the day (Inferred: not seen).
 */
export function activityWhen(start: string, today?: string): string {
	const month = SHORT_MONTHS[Number(start.slice(5, 7)) - 1] ?? "";
	const day = Number(start.slice(8, 10));
	const hour = Number(start.slice(11, 13));
	const minute = start.slice(14, 16);
	const h12 = hour % 12 === 0 ? 12 : hour % 12;
	const year = today && today.slice(0, 4) !== start.slice(0, 4) ? `, ${start.slice(0, 4)}` : "";
	return `${month} ${day}${year} @ ${h12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

/** The three groups the benefit sheet sorts benefits into, with their dot colours (sampled from the sheet). */
export type BenefitGroup = "Anaerobic" | "High Aerobic" | "Low Aerobic";

export const BENEFIT_COLOR: Readonly<Record<BenefitGroup, string>> = {
	Anaerobic: "#815af7",
	"High Aerobic": "#ea670e",
	"Low Aerobic": "#0b963f",
};

export interface PrimaryBenefit {
	/** "Threshold". */
	name: string;
	group: BenefitGroup | null;
	/** "Threshold (High Aerobic)". */
	label: string;
}

/**
 * `trainingEffectLabel` as the Primary Benefit card and the Stats row read it.
 * LACTATE_THRESHOLD and TEMPO are confirmed (phone and web), and VO2MAX as
 * "VO₂ Max", the 2 a subscript (Load's Exercise Load list and the web's
 * Activity List, 2026-10-11); the rest follow the benefit sheet's list
 * (Inferred).
 */
const BENEFITS: Readonly<Record<string, [string, BenefitGroup | null]>> = {
	RECOVERY: ["Recovery", "Low Aerobic"],
	AEROBIC_BASE: ["Base", "Low Aerobic"],
	TEMPO: ["Tempo", "High Aerobic"],
	LACTATE_THRESHOLD: ["Threshold", "High Aerobic"],
	VO2MAX: ["VO₂ Max", "High Aerobic"],
	ANAEROBIC_CAPACITY: ["Anaerobic Capacity", "Anaerobic"],
	SPEED: ["Sprint", "Anaerobic"],
	SPRINT: ["Sprint", "Anaerobic"],
	NO_BENEFIT: ["No Benefit", null],
};

/** A key this table doesn't know still shows, in Garmin's words title-cased: "NEW_BENEFIT" → "New Benefit". */
export function primaryBenefit(label: unknown): PrimaryBenefit | null {
	if (typeof label !== "string" || !label) return null;
	const [name, group] = BENEFITS[label] ?? [titleCase(label), null];
	return { name, group, label: group ? `${name} (${group})` : name };
}

function titleCase(key: string): string {
	return key
		.toLowerCase()
		.split(/[_\s]+/)
		.filter(Boolean)
		.map((word) => word[0]!.toUpperCase() + word.slice(1))
		.join(" ");
}

/** Feel, as the watch stores it: 0, 25, 50, 75, 100. Only Normal is confirmed. */
const FEEL: ReadonlyArray<[number, string]> = [
	[0, "Very Weak"],
	[25, "Weak"],
	[50, "Normal"],
	[75, "Strong"],
	[100, "Very Strong"],
];

export function feelLabel(value: unknown): string | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return FEEL.find(([at]) => at === value)?.[1] ?? null;
}

/**
 * Perceived Effort, stored ×10: 60 is "6/10", "Hard". 4 "Somewhat Hard" (web)
 * and 6 "Hard" (phone) are confirmed; the rest follow the CR10 scale the app's
 * slider is labelled from (Inferred).
 */
const EFFORT: readonly string[] = [
	"None",
	"Very Light",
	"Light",
	"Moderate",
	"Somewhat Hard",
	"Hard",
	"Hard",
	"Very Hard",
	"Very Hard",
	"Extremely Hard",
	"Maximum",
];

export interface Effort {
	/** 0–10. */
	value: number;
	/** "6/10". */
	score: string;
	/** "Hard". */
	label: string;
}

export function effortOf(rpe: unknown): Effort | null {
	if (typeof rpe !== "number" || !Number.isFinite(rpe)) return null;
	const value = Math.max(0, Math.min(10, Math.round(rpe / 10)));
	return { value, score: `${value}/10`, label: EFFORT[value]! };
}

/**
 * The effort dot's colour along the slider, in pairs: 1–2 blue, 3–4 green,
 * 5–6 yellow, 7–8 orange, 9–10 red. Seen on the phone: 3 green `#0b963f`, 5
 * and 6 yellow (ref/activity-details/pool-swim/README.md); the other pairs
 * are Inferred.
 */
export function effortColor(value: number): string {
	const stops: ReadonlyArray<[number, string]> = [
		[0, "#54a9fe"],
		[3, "#0b963f"],
		[5, "#f5bf2a"],
		[7, "#eb6d0f"],
		[9, "#e02c2c"],
	];
	let colour = stops[0]![1];
	for (const [at, c] of stops) if (value >= at) colour = c;
	return colour;
}
