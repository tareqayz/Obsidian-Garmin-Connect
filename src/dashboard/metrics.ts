import { hoursAndMinutes } from "./series";

/**
 * What the dashboard shows, and how each measure behaves.
 *
 * Kept out of the components so the definitions are testable and there is one
 * place to add a metric.
 */

export interface TileDef {
	key: string;
	label: string;
	unit?: string;
	format?: (value: number) => string;
	/** 1 when a rise is good, -1 when a fall is good, 0 when it is neither. */
	goodDirection: 1 | -1 | 0;
}

export const TILES: TileDef[] = [
	{ key: "steps", label: "Steps", goodDirection: 1 },
	{ key: "sleep_hours", label: "Sleep", goodDirection: 1, format: hoursAndMinutes },
	{ key: "resting_hr", label: "Resting HR", unit: " bpm", goodDirection: -1 },
	{ key: "body_battery_high", label: "Body Battery", goodDirection: 1 },
	{ key: "hrv_avg", label: "HRV", unit: " ms", goodDirection: 1 },
	{ key: "training_readiness", label: "Readiness", goodDirection: 1 },
];

export interface Stage {
	key: string;
	label: string;
	/** 1-4, mapping to the validated ordinal blue steps. */
	step: number;
}

/** Ordered deep → awake, which is why they take an ordinal ramp and not hues. */
export const SLEEP_STAGES: Stage[] = [
	{ key: "sleep_deep_hours", label: "Deep", step: 1 },
	{ key: "sleep_light_hours", label: "Light", step: 2 },
	{ key: "sleep_rem_hours", label: "REM", step: 3 },
	{ key: "sleep_awake_hours", label: "Awake", step: 4 },
];

export const RANGES = [
	{ days: 30, label: "30 days" },
	{ days: 90, label: "90 days" },
	{ days: 365, label: "1 year" },
] as const;

/** Columns the table view offers, in order, when the data carries them. */
export const TABLE_KEYS = [
	...TILES.map((t) => t.key),
	...SLEEP_STAGES.map((s) => s.key),
	"distance_km",
	"distance_mi",
	"calories",
];
