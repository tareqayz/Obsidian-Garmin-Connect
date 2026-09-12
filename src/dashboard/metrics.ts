import { duration, hoursAndMinutes } from "./series";

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
	/** Shown behind the tile's info button. What it is and how to read it. */
	info: string;
}

export const TILES: TileDef[] = [
	{
		key: "steps",
		label: "Steps",
		goodDirection: 1,
		info: "Total steps Garmin recorded for the day.",
	},
	{
		key: "sleep_hours",
		label: "Sleep",
		goodDirection: 1,
		format: hoursAndMinutes,
		info:
			"Total time asleep. Garmin finalises a night some hours after you wake, so the most " +
			"recent figure can still change — which is why the sync covers several days, not one.",
	},
	{
		key: "resting_hr",
		label: "Resting HR",
		unit: " bpm",
		goodDirection: -1,
		info:
			"The lowest sustained heart rate for the day, usually measured while you sleep. It " +
			"tends to drift down as fitness improves and up with fatigue, illness or alcohol — " +
			"which is why a fall is shown as the good direction here.",
	},
	{
		key: "body_battery_high",
		label: "Body Battery",
		goodDirection: 1,
		info:
			"Garmin's 0-100 estimate of available energy, built from heart rate variability, " +
			"stress and activity. It charges while you rest and drains as you exert yourself. " +
			"The tile shows the day's peak; the chart shows the full low-to-high range.",
	},
	{
		key: "hrv_avg",
		label: "HRV",
		unit: " ms",
		goodDirection: 1,
		info:
			"Average variation between heartbeats overnight, in milliseconds. Higher generally " +
			"means better recovered, but absolute values vary enormously between people — your " +
			"own trend is the part worth reading.",
	},
	{
		key: "training_readiness",
		label: "Readiness",
		goodDirection: 1,
		info:
			"Garmin's 0-100 estimate of how ready you are to train, combining sleep, recovery " +
			"time, HRV and recent training load.",
	},
	{
		key: "vo2max",
		label: "VO2 Max",
		goodDirection: 1,
		info:
			"Garmin's estimate of the maximum oxygen your body can use, in ml/kg/min. It is " +
			"derived from heart rate against pace during runs, so it only updates after a " +
			"qualifying outdoor activity — expect a flat line between runs rather than daily movement.",
	},
	{
		key: "endurance_score",
		label: "Endurance",
		goodDirection: 1,
		info:
			"Garmin's endurance score, built from your VO2 Max and the volume of your longer " +
			"activities. It moves slowly and rewards sustained aerobic work rather than single hard efforts.",
	},
	{
		key: "race_5k",
		label: "5K prediction",
		goodDirection: -1,
		format: duration,
		info:
			"Garmin's predicted 5K finish time, from your VO2 Max and training history. It assumes " +
			"a flat course and good conditions, and tends to be optimistic if you have not " +
			"actually raced the distance. Stored as seconds so it can be charted; shown as time.",
	},
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

const RACE_INFO =
	"Garmin's predicted finish time from your VO2 Max and training history. It assumes a flat " +
	"course and good conditions, and tends to be optimistic if you have not actually raced the " +
	"distance. Each distance gets its own chart: their scales differ by an order of magnitude, " +
	"and sharing one axis would flatten the shorter ones into a straight line.";

/** Title, subtitle and info for each chart card. */
export interface CardDef {
	id: string;
	title: string;
	subtitle: string;
	info: string;
}

export const CARDS: Record<string, CardDef> = {
	steps: {
		id: "steps",
		title: "Steps",
		subtitle: "Daily total",
		info: "Total steps per day. The dashed line is the step goal Garmin last reported.",
	},
	sleep: {
		id: "sleep",
		title: "Sleep",
		subtitle: "Hours by stage",
		info:
			"Time in each sleep stage, stacked to the night's total. The four shades are one " +
			"colour stepped light to dark because the stages are an ordered scale, not four " +
			"unrelated categories.",
	},
	resting_hr: {
		id: "resting_hr",
		title: "Resting heart rate",
		subtitle: "bpm",
		info:
			"Daily resting heart rate. Read the direction of travel over weeks rather than any " +
			"single day — one bad night moves it.",
	},
	hrv: {
		id: "hrv",
		title: "HRV",
		subtitle: "Overnight average, ms",
		info:
			"Overnight heart rate variability. Your own baseline is what matters; comparing the " +
			"number to someone else's says very little.",
	},
	battery: {
		id: "battery",
		title: "Body Battery",
		subtitle: "Daily low to high",
		info:
			"The band spans each day's lowest and highest Body Battery. A band that stays high " +
			"and narrow means you neither drained nor recharged much.",
	},
	readiness: {
		id: "readiness",
		title: "Training readiness",
		subtitle: "Score out of 100",
		info: "Garmin's daily readiness score, combining sleep, recovery time, HRV and recent load.",
	},
	vo2max: {
		id: "vo2max",
		title: "VO2 Max",
		subtitle: "ml/kg/min",
		info:
			"Estimated maximum oxygen uptake. It only updates after a qualifying outdoor run, so " +
			"the line holds flat between activities rather than moving every day.",
	},
	endurance: {
		id: "endurance",
		title: "Endurance score",
		subtitle: "Garmin endurance score",
		info:
			"Built from VO2 Max and the volume of your longer activities. It moves slowly, and " +
			"sustained aerobic work moves it more than single hard sessions.",
	},
	race_5k: {
		id: "race_5k",
		title: "5K prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_10k: {
		id: "race_10k",
		title: "10K prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_half: {
		id: "race_half",
		title: "Half marathon prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_marathon: {
		id: "race_marathon",
		title: "Marathon prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
};

export const RANGES = [
	{ days: 30, label: "30 days" },
	{ days: 90, label: "90 days" },
	{ days: 365, label: "1 year" },
] as const;

/** Columns the table view offers, in order, when the data carries them. */
export const TABLE_KEYS = [
	...TILES.map((t) => t.key),
	...SLEEP_STAGES.map((s) => s.key),
	"vo2max_cycling",
	"fitness_age",
	"race_10k",
	"race_half",
	"race_marathon",
	"distance_km",
	"distance_mi",
	"calories",
];

/** Race predictions are seconds on the wire and times on screen. */
export function formatFor(key: string): (value: number) => string {
	if (key.startsWith("race_")) return duration;
	if (key === "sleep_hours") return hoursAndMinutes;
	return (v) => String(Math.round(v * 100) / 100);
}
