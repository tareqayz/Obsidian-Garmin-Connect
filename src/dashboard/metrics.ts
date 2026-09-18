import { ALL_GROUPS, keysFor } from "../sync/metrics";
import { compact, duration, hoursAndMinutes } from "./series";

/**
 * What the dashboard shows, and how each measure behaves.
 *
 * Kept out of the components so the definitions are testable and there is one
 * place to add a metric.
 */

/**
 * The panes the dashboard is divided into.
 *
 * With four times as many metrics as it started with, one flat grid stopped
 * being a dashboard and became a wall. Sections are ordered the way a morning
 * read goes: what you did, how you slept, how recovered you are, where your
 * fitness is heading, and what your body weighs.
 */
export type SectionId = "activity" | "sleep" | "recovery" | "fitness" | "body";

export const SECTIONS: Array<{ id: SectionId; title: string }> = [
	{ id: "activity", title: "Activity" },
	{ id: "sleep", title: "Sleep" },
	{ id: "recovery", title: "Recovery and stress" },
	{ id: "fitness", title: "Fitness and training" },
	{ id: "body", title: "Body" },
];

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
		key: "sleep_score",
		label: "Sleep score",
		goodDirection: 1,
		info:
			"Garmin's verdict on the night out of 100, from duration, stages, restlessness and " +
			"overnight stress. A long night can still score poorly, which is the point of having it.",
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
		key: "stress_avg",
		label: "Stress",
		goodDirection: -1,
		info:
			"Garmin's average stress for the day, 0-100, from heart rate variability. It reads " +
			"physiological load rather than mood — a hard training session raises it as surely as " +
			"a hard day does.",
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
		key: "weight_kg",
		label: "Weight",
		unit: " kg",
		goodDirection: 0,
		info:
			"From a connected scale or a manual entry. Only present on days something was recorded, " +
			"so the sparkline joins weigh-ins rather than showing a daily line.",
	},
	{
		key: "weight_lb",
		label: "Weight",
		unit: " lb",
		goodDirection: 0,
		info:
			"From a connected scale or a manual entry. Only present on days something was recorded, " +
			"so the sparkline joins weigh-ins rather than showing a daily line.",
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
	section: SectionId;
}

/**
 * Goal rings, for the measures Garmin gives a target for.
 *
 * Only these three: a ring is a strong piece of ink and it earns it only when
 * there is a real threshold behind it, not merely a number worth watching.
 */
export const GOALS: Array<{ key: string; goalKey: string; label: string }> = [
	{ key: "steps", goalKey: "steps_goal", label: "Steps" },
	{ key: "intensity_minutes", goalKey: "intensity_goal", label: "Intensity min" },
	{ key: "floors", goalKey: "floors_goal", label: "Floors" },
];

/** A whole split into ordered parts, drawn as one bar rather than a chart. */
export interface CompositionDef {
	id: string;
	title: string;
	subtitle: string;
	info: string;
	section: SectionId;
	unit: string;
	parts: Array<{ key: string; label: string; step: number }>;
}

export const COMPOSITIONS: CompositionDef[] = [
	{
		id: "day_breakdown",
		title: "How the day was spent",
		subtitle: "Minutes, most recent day",
		section: "activity",
		unit: "m",
		info:
			"Garmin classifies every waking minute by intensity. Highly active is what it counts " +
			"as vigorous, active as moderate, and sedentary is everything else you were awake for. " +
			"One bar rather than four numbers because the question is proportion, not size.",
		parts: [
			{ key: "highly_active_minutes", label: "Highly active", step: 1 },
			{ key: "active_minutes", label: "Active", step: 2 },
			{ key: "sedentary_minutes", label: "Sedentary", step: 4 },
		],
	},
	{
		id: "stress_bands",
		title: "Stress through the day",
		subtitle: "Minutes in each band, most recent day",
		section: "recovery",
		unit: "m",
		info:
			"How long Garmin measured you in each stress band. Rest is the part that matters most: " +
			"a day with a high average and plenty of rest reads very differently from one with a " +
			"middling average and none.",
		parts: [
			{ key: "stress_rest_minutes", label: "Rest", step: 4 },
			{ key: "stress_low_minutes", label: "Low", step: 3 },
			{ key: "stress_medium_minutes", label: "Medium", step: 2 },
			{ key: "stress_high_minutes", label: "High", step: 1 },
		],
	},
	{
		id: "sleep_mix",
		title: "Sleep mix",
		subtitle: "Hours by stage, most recent night",
		section: "sleep",
		unit: "h",
		info:
			"The last night's stages as proportions of the whole. The stacked chart above shows how " +
			"this moves over time; this shows what one night actually looked like.",
		parts: [
			{ key: "sleep_deep_hours", label: "Deep", step: 1 },
			{ key: "sleep_light_hours", label: "Light", step: 2 },
			{ key: "sleep_rem_hours", label: "REM", step: 3 },
			{ key: "sleep_awake_hours", label: "Awake", step: 4 },
		],
	},
];

/**
 * What the calendar card can show.
 *
 * One switchable card rather than a heatmap per metric: a year of squares is a
 * lot of ink, and repeating it eight times would drown everything around it.
 */
export const HEATMAP_METRICS: Array<{
	key: string;
	label: string;
	unit?: string;
	format?: (value: number) => string;
}> = [
	{ key: "steps", label: "Steps", format: compact },
	{ key: "sleep_hours", label: "Sleep", format: hoursAndMinutes },
	{ key: "sleep_score", label: "Sleep score" },
	{ key: "resting_hr", label: "Resting HR", unit: " bpm" },
	{ key: "hrv_avg", label: "HRV", unit: " ms" },
	{ key: "training_readiness", label: "Readiness" },
	{ key: "stress_avg", label: "Stress" },
	{ key: "body_battery_high", label: "Body Battery" },
	{ key: "intensity_minutes", label: "Intensity min" },
	{ key: "calories_active", label: "Active calories", format: compact },
];

export const CARDS: Record<string, CardDef> = {
	steps: {
		id: "steps",
		section: "activity",
		title: "Steps",
		subtitle: "Daily total",
		info: "Total steps per day. The dashed line is the step goal Garmin last reported.",
	},
	sleep: {
		id: "sleep",
		section: "sleep",
		title: "Sleep",
		subtitle: "Hours by stage",
		info:
			"Time in each sleep stage, stacked to the night's total. The four shades are one " +
			"colour stepped light to dark because the stages are an ordered scale, not four " +
			"unrelated categories.",
	},
	resting_hr: {
		id: "resting_hr",
		section: "recovery",
		title: "Resting heart rate",
		subtitle: "bpm",
		info:
			"Daily resting heart rate. Read the direction of travel over weeks rather than any " +
			"single day — one bad night moves it.",
	},
	hrv: {
		id: "hrv",
		section: "recovery",
		title: "HRV",
		subtitle: "Overnight average, ms",
		info:
			"Overnight heart rate variability. Your own baseline is what matters; comparing the " +
			"number to someone else's says very little.",
	},
	battery: {
		id: "battery",
		section: "recovery",
		title: "Body Battery",
		subtitle: "Daily low to high",
		info:
			"The band spans each day's lowest and highest Body Battery. A band that stays high " +
			"and narrow means you neither drained nor recharged much.",
	},
	readiness: {
		id: "readiness",
		section: "recovery",
		title: "Training readiness",
		subtitle: "Score out of 100",
		info: "Garmin's daily readiness score, combining sleep, recovery time, HRV and recent load.",
	},
	vo2max: {
		id: "vo2max",
		section: "fitness",
		title: "VO2 Max",
		subtitle: "ml/kg/min",
		info:
			"Estimated maximum oxygen uptake. It only updates after a qualifying outdoor run, so " +
			"the line holds flat between activities rather than moving every day.",
	},
	endurance: {
		id: "endurance",
		section: "fitness",
		title: "Endurance score",
		subtitle: "Garmin endurance score",
		info:
			"Built from VO2 Max and the volume of your longer activities. It moves slowly, and " +
			"sustained aerobic work moves it more than single hard sessions.",
	},
	race_5k: {
		id: "race_5k",
		section: "fitness",
		title: "5K prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_10k: {
		id: "race_10k",
		section: "fitness",
		title: "10K prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_half: {
		id: "race_half",
		section: "fitness",
		title: "Half marathon prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},
	race_marathon: {
		id: "race_marathon",
		section: "fitness",
		title: "Marathon prediction",
		subtitle: "Predicted finish time",
		info: RACE_INFO,
	},

	calendar: {
		id: "calendar",
		section: "activity",
		title: "Calendar",
		subtitle: "One square per day",
		info:
			"Every day in the range, darker for larger. The shading is by quartile rather than " +
			"an even split of the range, so one extraordinary day does not wash out the rest. " +
			"Outlined squares are days with nothing synced — on a health log the gaps are as " +
			"much of the answer as the values.",
	},
	distance: {
		id: "distance",
		section: "activity",
		title: "Distance",
		subtitle: "Daily total",
		info: "Everything Garmin counted as distance covered, walking and running together.",
	},
	calories: {
		id: "calories",
		section: "activity",
		title: "Active calories",
		subtitle: "Beyond resting burn",
		info:
			"Calories burned above what your body would have used lying still. The plain total " +
			"Garmin shows includes that resting burn, which barely moves day to day and hides " +
			"the part you influenced.",
	},
	intensity: {
		id: "intensity",
		section: "activity",
		title: "Intensity minutes",
		subtitle: "Weighted, against the weekly goal",
		info:
			"Moderate minutes count once and vigorous minutes twice, which is Garmin's own " +
			"weighting and the WHO's. The dashed line is the goal Garmin last reported.",
	},
	floors: {
		id: "floors",
		section: "activity",
		title: "Floors climbed",
		subtitle: "Daily total",
		info: "Flights of stairs, as the barometric altimeter counted them.",
	},
	workouts: {
		id: "workouts",
		section: "activity",
		title: "Activities",
		subtitle: "Newest first",
		info:
			"Every activity Garmin recorded in the range. These have always been synced into the " +
			"notes; this is where they are finally legible.",
	},
	sleep_score: {
		id: "sleep_score",
		section: "sleep",
		title: "Sleep score",
		subtitle: "Out of 100",
		info:
			"Garmin's overall verdict on the night, combining duration, stages, restlessness and " +
			"overnight stress. It is finalised some hours after you wake, so the most recent " +
			"figure can still change.",
	},
	sleep_respiration: {
		id: "sleep_respiration",
		section: "sleep",
		title: "Sleep respiration",
		subtitle: "Breaths per minute",
		info:
			"Average breathing rate through the night. It is very stable for a given person, so a " +
			"few breaths above your own normal is worth noticing — it tends to rise with illness, " +
			"alcohol and altitude.",
	},
	sleep_spo2: {
		id: "sleep_spo2",
		section: "sleep",
		title: "Overnight SpO2",
		subtitle: "Blood oxygen, %",
		info:
			"Average blood oxygen saturation while asleep, from the wrist sensor. Wrist pulse " +
			"oximetry is noisy — read the trend, not a single night, and never treat it as a " +
			"medical measurement.",
	},
	sleep_battery: {
		id: "sleep_battery",
		section: "sleep",
		title: "Overnight recharge",
		subtitle: "Body Battery gained while asleep",
		info:
			"How much Body Battery the night put back. This is the number that separates a long " +
			"night from a restorative one: eight hours that recharge 20 points and eight that " +
			"recharge 60 are not the same night.",
	},
	sleep_restless: {
		id: "sleep_restless",
		section: "sleep",
		title: "Restlessness",
		subtitle: "Restless moments per night",
		info: "How often Garmin registered movement during the night. Lower is calmer sleep.",
	},
	stress: {
		id: "stress",
		section: "recovery",
		title: "Stress",
		subtitle: "Daily average, 0-100",
		info:
			"Garmin's stress estimate from heart rate variability. It measures physiological load, " +
			"not mood: a hard session and a hard day both push it up.",
	},
	recovery_time: {
		id: "recovery_time",
		section: "recovery",
		title: "Recovery time",
		subtitle: "Hours until fully recovered",
		info:
			"How long Garmin thinks you need before another hard session. It is set by your last " +
			"activity and counts down, so the sawtooth is the shape to expect.",
	},
	respiration: {
		id: "respiration",
		section: "recovery",
		title: "Respiration",
		subtitle: "Waking average, breaths per minute",
		info: "Average breathing rate while awake. Like the overnight figure, your own normal is the baseline that matters.",
	},
	spo2: {
		id: "spo2",
		section: "recovery",
		title: "Pulse ox",
		subtitle: "Blood oxygen, %",
		info:
			"Blood oxygen saturation measured through the day where the watch took readings. Wrist " +
			"pulse oximetry is approximate and is not a medical measurement.",
	},
	training_load: {
		id: "training_load",
		section: "fitness",
		title: "Training load",
		subtitle: "Acute against chronic",
		info:
			"Acute load is roughly the last week of training; chronic is roughly the last month. " +
			"Acute well above chronic means you are building faster than you are absorbing, and " +
			"well below means you are detraining. The two on one axis is the only way to read it.",
	},
	load_ratio: {
		id: "load_ratio",
		section: "fitness",
		title: "Load ratio",
		subtitle: "Acute ÷ chronic",
		info:
			"The same two numbers as one figure. The shaded band is the 0.8-1.3 range usually " +
			"treated as productive: below it you are losing fitness, above it injury risk climbs.",
	},
	fitness_age: {
		id: "fitness_age",
		section: "fitness",
		title: "Fitness age",
		subtitle: "Years",
		info:
			"Garmin's estimate of the age your fitness corresponds to, from VO2 Max, activity and " +
			"body composition. It moves slowly and downward is the good direction.",
	},
	weight: {
		id: "weight",
		section: "body",
		title: "Weight",
		subtitle: "From connected scales or manual entries",
		info:
			"Only present on days a weight was recorded, so expect gaps unless you weigh daily. " +
			"The line joins the days that have data rather than interpolating across the ones that " +
			"do not.",
	},
	body_fat: {
		id: "body_fat",
		section: "body",
		title: "Body fat",
		subtitle: "Percent",
		info:
			"Bioimpedance from a connected scale. It is sensitive to hydration and time of day, so " +
			"the week-to-week direction is worth more than any single reading.",
	},
	bmi: {
		id: "bmi",
		section: "body",
		title: "BMI",
		subtitle: "Body mass index",
		info: "Weight against height. A population statistic rather than a personal one, and blind to how much of the weight is muscle.",
	},
};

export const RANGES = [
	{ days: 30, label: "30 days" },
	{ days: 90, label: "90 days" },
	{ days: 365, label: "1 year" },
] as const;

/**
 * Columns the table view offers, in order, when the data carries them.
 *
 * Taken from the sync's own key list rather than written out again, so a metric
 * can never be mapped into a note and then be missing from the table — which is
 * exactly what happened every time this was a hand-maintained array.
 */
export const TABLE_KEYS = keysFor(ALL_GROUPS).filter((key) => key !== "workouts");

/** Race predictions are seconds on the wire and times on screen. */
export function formatFor(key: string): (value: number) => string {
	if (key.startsWith("race_")) return duration;
	if (key === "sleep_hours" || key === "nap_hours") return hoursAndMinutes;
	return (v) => String(Math.round(v * 100) / 100);
}
