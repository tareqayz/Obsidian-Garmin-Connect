import type {
	AcuteTrainingLoad,
	Acclimation,
	Activity,
	BodyComposition,
	DailySummary,
	FitnessAge,
	HealthSnapshot,
	HealthStatus,
	HillScore,
	RunningTolerance,
	SleepData,
	TrainingStatus,
} from "../garmin/endpoints";
import { latestValue, type DaySeries } from "./intraday";

/**
 * Garmin payloads → frontmatter properties.
 *
 * Pure: no Obsidian, no network, no clock beyond what is passed in. All the
 * fiddly decisions about units, sentinels and rounding live here so they can be
 * tested directly.
 */

export type MetricGroup =
	| "activity"
	| "heart"
	| "sleep"
	| "stress"
	| "hrv"
	| "readiness"
	| "fitness"
	| "races"
	| "respiration"
	| "spo2"
	| "body"
	| "training"
	| "workouts"
	| "intraday"
	| "health"
	| "profile";

/**
 * Display order, which is also the order properties land in a note and columns
 * in the Bases view. Grouped by what a reader is looking for rather than by
 * which endpoint happens to serve it: `respiration` and `spo2` come out of the
 * same daily summary as `activity`, and cost nothing extra.
 */
export const ALL_GROUPS: MetricGroup[] = [
	"activity",
	"heart",
	"sleep",
	"stress",
	"hrv",
	"readiness",
	"fitness",
	"races",
	"respiration",
	"spo2",
	"body",
	"training",
	"workouts",
	"intraday",
	"health",
	"profile",
];

/** Groups that need a request of their own, for the budget note in settings. */
export const FREE_GROUPS: MetricGroup[] = ["activity", "heart", "stress", "respiration", "spo2"];

/**
 * Per-day requests a group adds on its own, for the budget note in settings.
 * `intraday` is the expensive one, which is why the engine only spends it on
 * the newest few days of a run (`INTRADAY_DAYS`).
 */
export const REQUESTS_PER_DAY: Partial<Record<MetricGroup, number>> = {
	sleep: 1,
	hrv: 1,
	readiness: 1,
	fitness: 2,
	body: 1,
	training: 1,
	intraday: 4,
	health: 1,
};

/** Groups billed per sync rather than per day, for the budget note in settings. */
export const REQUESTS_PER_SYNC: Partial<Record<MetricGroup, number>> = {
	profile: 9,
};

export type PropertyValue = number | string | Array<Record<string, unknown>>;
export type Properties = Record<string, PropertyValue>;

export interface HrvData {
	hrvSummary?: {
		lastNightAvg?: number | null;
		lastNight5MinHigh?: number | null;
		status?: string | null;
		weeklyAvg?: number | null;
		/** The personal range Garmin judges `status` against. */
		baseline?: {
			lowUpper?: number | null;
			balancedLow?: number | null;
			balancedUpper?: number | null;
			markerValue?: number | null;
			[key: string]: unknown;
		} | null;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface ReadinessEntry {
	score?: number | null;
	level?: string | null;
	sleepScore?: number | null;
	/** Minutes until Garmin considers you recovered. */
	recoveryTime?: number | null;
	hrvFactorPercent?: number | null;
	sleepHistoryFactorPercent?: number | null;
	stressHistoryFactorPercent?: number | null;
	acuteLoad?: number | null;
	feedbackShort?: string | null;
	feedbackLong?: string | null;
	inputContext?: string | null;
	[key: string]: unknown;
}

export interface MaxMetricsData {
	generic?: {
		calendarDate?: string;
		vo2MaxPreciseValue?: number | null;
		vo2MaxValue?: number | null;
		fitnessAge?: number | null;
	} | null;
	cycling?: { calendarDate?: string; vo2MaxPreciseValue?: number | null; vo2MaxValue?: number | null } | null;
	heatAltitudeAcclimation?: Acclimation | null;
}

export interface RaceData {
	time5K?: number | null;
	time10K?: number | null;
	timeHalfMarathon?: number | null;
	timeMarathon?: number | null;
}

export interface EnduranceData {
	overallScore?: number | null;
	classification?: number | null;
	feedbackPhrase?: string | number | null;
	[key: string]: unknown;
}

export interface DayData {
	summary?: DailySummary | null;
	sleep?: SleepData | null;
	hrv?: HrvData | null;
	readiness?: ReadinessEntry[] | null;
	maxMetrics?: MaxMetricsData | null;
	races?: RaceData | null;
	endurance?: EnduranceData | null;
	training?: TrainingStatus | null;
	body?: BodyComposition | null;
	workouts?: Activity[] | null;
	fitnessAge?: FitnessAge | null;
	health?: HealthStatus | null;
	healthSnapshots?: HealthSnapshot[] | null;
	hillScore?: HillScore | null;
	runningTolerance?: RunningTolerance | null;
	/** The intraday payloads, already reduced. Only a couple of scalars come out of these. */
	series?: DaySeries | null;
}

export interface MapOptions {
	groups: readonly MetricGroup[];
	units: "metric" | "imperial";
	/**
	 * The day being mapped. Only needed to tell whether a "most recent"
	 * reading belongs to this day; without it those fallbacks stay off.
	 */
	date?: string;
}

/* ------------------------------------------------------------------ */
/*  Sentinels and conversions                                          */
/* ------------------------------------------------------------------ */

/**
 * Garmin reports "not measured" as a negative number on several fields —
 * `averageStressLevel: -1` is the common one. Writing -1 into a note as though
 * it were a stress score would quietly poison any chart built on it.
 */
function metric(value: unknown, { allowNegative = false } = {}): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	if (!allowNegative && value < 0) return undefined;
	return value;
}

/** Two decimals, or nothing — Garmin sends body percentages to six. */
function round2(value: number | undefined): number | undefined {
	return value === undefined ? undefined : round(value, 2);
}

function round(value: number, dp: number): number {
	const f = 10 ** dp;
	return Math.round(value * f) / f;
}

const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;
const GRAMS_PER_POUND = 453.59237;

function distance(metres: number | undefined, units: MapOptions["units"]) {
	if (metres === undefined) return undefined;
	return units === "imperial"
		? { key: "distance_mi", value: round(metres / METRES_PER_MILE, 2) }
		: { key: "distance_km", value: round(metres / 1000, 2) };
}

/** Garmin reports every body mass in grams, whatever the account's unit system. */
function mass(stem: string, grams: number | undefined, units: MapOptions["units"]) {
	if (grams === undefined) return undefined;
	return units === "imperial"
		? { key: `${stem}_lb`, value: round(grams / GRAMS_PER_POUND, 1) }
		: { key: `${stem}_kg`, value: round(grams / 1000, 1) };
}

function elevation(metres: number | undefined, units: MapOptions["units"]) {
	if (metres === undefined) return undefined;
	return units === "imperial"
		? { key: "elevation_gain_ft", value: Math.round(metres / METRES_PER_FOOT) }
		: { key: "elevation_gain_m", value: Math.round(metres) };
}

/**
 * A non-empty string, or nothing.
 *
 * Garmin's qualitative fields come back as raw enum names — `BALANCED`,
 * `PRODUCTIVE_1`. They are left exactly as sent: they are stable enough to
 * filter a Bases view on, and prettifying them here would make the property
 * unmatchable against Garmin's own vocabulary.
 */
function label(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * The first entry of one of Garmin's device-keyed maps.
 *
 * Training status arrives as `{ "<deviceId>": { … } }`. An account with a watch
 * and a bike computer has several and neither key is knowable in advance, so the
 * only stable choice is "whichever one is there".
 */
function firstEntry(map: unknown): Record<string, unknown> | undefined {
	if (!map || typeof map !== "object" || Array.isArray(map)) return undefined;
	for (const value of Object.values(map as Record<string, unknown>)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			return value as Record<string, unknown>;
		}
	}
	return undefined;
}

/**
 * The entry for the primary training device, or the first there is.
 *
 * Load balance and status both carry `primaryTrainingDevice`; honouring it is
 * what keeps a bike computer's numbers from standing in for the watch's.
 */
function primaryEntry(map: unknown): Record<string, unknown> | undefined {
	if (!map || typeof map !== "object" || Array.isArray(map)) return undefined;
	for (const value of Object.values(map as Record<string, unknown>)) {
		if (value && typeof value === "object" && (value as Record<string, unknown>).primaryTrainingDevice === true) {
			return value as Record<string, unknown>;
		}
	}
	return firstEntry(map);
}

function asObject(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/** `vigorousDaysAvg` → `vigorous_days_avg`, for keys built from Garmin's own names. */
function snake(name: string): string {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[^A-Za-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();
}

/** Seconds → minutes, for the several duration buckets Garmin reports that way. */
function minutesOf(seconds: unknown): number | undefined {
	return minutes(metric(seconds));
}

function hours(seconds: number | undefined): number | undefined {
	return seconds === undefined ? undefined : round(seconds / 3600, 2);
}

function minutes(seconds: number | undefined): number | undefined {
	return seconds === undefined ? undefined : Math.round(seconds / 60);
}

/**
 * Epoch millis → a local `YYYY-MM-DDTHH:mm` string, which Obsidian recognises as
 * a datetime property.
 *
 * Garmin also sends `*Local` variants, but those have been reported as
 * double-offset for some accounts, so the GMT field is the one to trust.
 */
export function toLocalDateTime(epochMs: number | undefined): string | undefined {
	if (typeof epochMs !== "number" || !Number.isFinite(epochMs)) return undefined;
	const d = new Date(epochMs);
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
		`T${pad(d.getHours())}:${pad(d.getMinutes())}`
	);
}

/** `"2026-09-12 07:31:00"` → `"2026-09-12"`. Garmin's local activity timestamps. */
export function localDateOf(startTimeLocal: string | undefined): string | undefined {
	if (typeof startTimeLocal !== "string") return undefined;
	const match = startTimeLocal.match(/^(\d{4}-\d{2}-\d{2})/);
	return match ? match[1] : undefined;
}

/* ------------------------------------------------------------------ */
/*  Mapping                                                            */
/* ------------------------------------------------------------------ */

export function mapDay(data: DayData, opts: MapOptions): Properties {
	const out: Properties = {};
	const groups = new Set(opts.groups);
	const set = (key: string, value: PropertyValue | undefined) => {
		// Absent stays absent: a day Garmin has no data for should not gain a
		// row of empty properties.
		if (value === undefined) return;
		out[key] = value;
	};

	const summary = data.summary ?? undefined;

	if (groups.has("activity") && summary) {
		set("steps", metric(summary.totalSteps));
		set("steps_goal", metric(summary.dailyStepGoal));
		const d = distance(metric(summary.totalDistanceMeters), opts.units);
		if (d) set(d.key, d.value);
		set("calories", metric(summary.totalKilocalories));
		set("calories_active", metric(summary.activeKilocalories));
		// What the body burns at rest. The gap between this and `calories` is the
		// part of the day you actually moved for.
		set("calories_bmr", metric(summary.bmrKilocalories));
		// Only there for accounts that log food. Absent, not zero, otherwise.
		set("calories_consumed", metric(summary.consumedKilocalories));
		set("floors", metric(summary.floorsAscended));
		set("floors_descended", metric(summary.floorsDescended));
		set("floors_goal", metric(summary.userFloorsAscendedGoal));

		const moderate = metric(summary.moderateIntensityMinutes);
		const vigorous = metric(summary.vigorousIntensityMinutes);
		set("intensity_moderate", moderate);
		set("intensity_vigorous", vigorous);
		if (moderate !== undefined || vigorous !== undefined) {
			// Garmin's own weighting: vigorous minutes count double.
			set("intensity_minutes", (moderate ?? 0) + (vigorous ?? 0) * 2);
		}
		set("intensity_goal", metric(summary.intensityMinutesGoal));

		// The day split by how hard it was. Together with sleep these four
		// account for the whole 24 hours, which is what makes them worth a
		// composition bar rather than four separate numbers.
		set("active_minutes", minutesOf(summary.activeSeconds));
		set("highly_active_minutes", minutesOf(summary.highlyActiveSeconds));
		set("sedentary_minutes", minutesOf(summary.sedentarySeconds));
	}

	if (groups.has("heart") && summary) {
		set("resting_hr", metric(summary.restingHeartRate));
		set("min_hr", metric(summary.minHeartRate));
		set("max_hr", metric(summary.maxHeartRate));
		// Garmin's own seven-day average, which moves far less than a single day
		// and is the figure its app shows as your resting rate.
		set("resting_hr_7d", metric(summary.lastSevenDaysAvgRestingHeartRate));
	}

	if (groups.has("stress") && summary) {
		set("stress_avg", metric(summary.averageStressLevel));
		set("stress_max", metric(summary.maxStressLevel));
		set("stress_qualifier", label(summary.stressQualifier));
		set("stress_rest_minutes", minutesOf(summary.restStressDuration));
		set("stress_low_minutes", minutesOf(summary.lowStressDuration));
		set("stress_medium_minutes", minutesOf(summary.mediumStressDuration));
		set("stress_high_minutes", minutesOf(summary.highStressDuration));

		set("body_battery_high", metric(summary.bodyBatteryHighestValue));
		set("body_battery_low", metric(summary.bodyBatteryLowestValue));
		set("body_battery_latest", metric(summary.bodyBatteryMostRecentValue));
		// How much went in and how much came out — the same day can end flat
		// having charged 60 and drained 60, or having done neither.
		set("body_battery_charged", metric(summary.bodyBatteryChargedValue));
		set("body_battery_drained", metric(summary.bodyBatteryDrainedValue));
	}

	if (groups.has("respiration") && summary) {
		set("respiration_avg", metric(summary.avgWakingRespirationValue));
		set("respiration_min", metric(summary.lowestRespirationValue));
		set("respiration_max", metric(summary.highestRespirationValue));
		// The big number on the app's Respiration card.
		set("respiration_latest", metric(summary.latestRespirationValue));
	}

	if (groups.has("spo2") && summary) {
		set("spo2_avg", metric(summary.averageSpo2));
		set("spo2_low", metric(summary.lowestSpo2));
		set("spo2_latest", metric(summary.latestSpo2));
	}

	if (groups.has("sleep")) {
		const dto = data.sleep?.dailySleepDTO;
		if (dto) {
			set("sleep_hours", hours(metric(dto.sleepTimeSeconds)));
			set("sleep_deep_hours", hours(metric(dto.deepSleepSeconds)));
			set("sleep_light_hours", hours(metric(dto.lightSleepSeconds)));
			set("sleep_rem_hours", hours(metric(dto.remSleepSeconds)));
			set("sleep_awake_hours", hours(metric(dto.awakeSleepSeconds)));
			set("sleep_start", toLocalDateTime(metric(dto.sleepStartTimestampGMT)));
			set("sleep_end", toLocalDateTime(metric(dto.sleepEndTimestampGMT)));

			const overall = (
				dto.sleepScores as
					| { overall?: { value?: unknown; qualifierKey?: unknown } }
					| undefined
			)?.overall;
			set("sleep_score", metric(overall?.value));
			set("sleep_quality", label(overall?.qualifierKey));

			// Each part of the score gets its own verdict. These are what the
			// app lists under the score, and what say *why* a night scored low.
			const scores = asObject(dto.sleepScores) ?? {};
			for (const [part, key] of SLEEP_SCORE_PARTS) {
				set(key, label(asObject(scores[part])?.qualifierKey));
			}
			set("sleep_feedback", label(dto.sleepScoreFeedback));
			set("sleep_insight", label(dto.sleepScoreInsight));

			// Sleep Coach. Garmin counts the need in minutes; hours is what
			// sits next to `sleep_hours` without a conversion in the reader's head.
			const need = asObject(dto.sleepNeed);
			if (need) {
				set("sleep_need_hours", hoursOfMinutes(metric(need.actual)));
				set("sleep_need_baseline_hours", hoursOfMinutes(metric(need.baseline)));
				set("sleep_need_feedback", label(need.feedback));
				set("sleep_need_training_feedback", label(need.trainingFeedback));
				set("sleep_need_history_adjustment", label(need.sleepHistoryAdjustment));
				set("sleep_need_hrv_adjustment", label(need.hrvAdjustment));
				set("sleep_need_nap_adjustment", label(need.napAdjustment));
			}
			const next = asObject(dto.nextSleepNeed) ?? asObject(data.sleep?.nextSleepNeed);
			if (next) set("sleep_need_next_hours", hoursOfMinutes(metric(next.actual)));

			// The night's own physiology, which is where a bad night shows up
			// before the score does.
			set("sleep_resting_hr", metric(dto.restingHeartRate));
			set("sleep_avg_stress", metric(dto.avgSleepStress));
			set("sleep_awake_count", metric(dto.awakeCount));
			set("sleep_restless_moments", metric(dto.restlessMomentsCount));
			set("sleep_respiration", metric(dto.averageRespirationValue));
			set("sleep_spo2", metric(dto.averageSpO2Value));
			set("sleep_spo2_low", metric(dto.lowestSpO2Value));
			// How much Body Battery the night put back. Negative is possible and
			// meaningful, so this is one of the few metrics allowed to go below zero.
			set("sleep_body_battery_change", metric(dto.bodyBatteryChange, { allowNegative: true }));
			set("nap_hours", hours(metric(dto.napTimeSeconds)));
		}
	}

	if (groups.has("hrv")) {
		const hrv = data.hrv?.hrvSummary;
		if (hrv) {
			set("hrv_avg", metric(hrv.lastNightAvg));
			set("hrv_high", metric(hrv.lastNight5MinHigh));
			set("hrv_weekly_avg", metric(hrv.weeklyAvg));
			if (typeof hrv.status === "string" && hrv.status) set("hrv_status", hrv.status);

			// Without the range, last night's number is unreadable: 38 ms is low
			// for one person and high for another.
			set("hrv_baseline_low", metric(hrv.baseline?.balancedLow ?? hrv.baseline?.lowUpper));
			set("hrv_baseline_high", metric(hrv.baseline?.balancedUpper));
		}
	}

	if (groups.has("readiness")) {
		const entry = data.readiness?.[0];
		if (entry) {
			set("training_readiness", metric(entry.score));
			if (typeof entry.level === "string" && entry.level) {
				set("training_readiness_level", entry.level);
			}
			// The inputs behind the score. When readiness is low, these say why.
			set("readiness_sleep_score", metric(entry.sleepScore));
			set("readiness_hrv_factor", metric(entry.hrvFactorPercent));
			// Garmin counts recovery in minutes; hours is what anyone reads it in.
			const recovery = metric(entry.recoveryTime);
			set("recovery_time_hours", recovery === undefined ? undefined : round(recovery / 60, 1));
			set("acute_load", metric(entry.acuteLoad));

			// The headline sentence and the six factors the app lists under the
			// score, each as Garmin's contribution percentage plus its verdict.
			set("readiness_feedback", label(entry.feedbackShort));
			set("readiness_feedback_long", label(entry.feedbackLong));
			set("readiness_context", label(entry.inputContext));
			for (const [stem, factor] of READINESS_FACTORS) {
				set(`readiness_${stem}_factor`, metric(entry[`${factor}FactorPercent`]));
				set(`readiness_${stem}_feedback`, label(entry[`${factor}FactorFeedback`]));
			}
			set("readiness_hrv_weekly_avg", metric(entry.hrvWeeklyAverage));
		}
	}

	if (groups.has("fitness")) {
		// Training status carries the latest VO2 Max too. It stands in only
		// when it is *this* day's reading, or every day of a backfill would
		// inherit one value.
		const latest = data.training?.mostRecentVO2Max;
		const fallback = latest && sameDay(latest.generic?.calendarDate, opts.date) ? latest : undefined;
		const generic = data.maxMetrics?.generic ?? fallback?.generic;
		const cycling =
			data.maxMetrics?.cycling ??
			(latest && sameDay(latest.cycling?.calendarDate, opts.date) ? latest.cycling : undefined);
		// Garmin sends both a rounded and a precise VO2 Max; the precise one is
		// what makes a trend line readable.
		set("vo2max", metric(generic?.vo2MaxPreciseValue ?? generic?.vo2MaxValue));
		set("vo2max_cycling", metric(cycling?.vo2MaxPreciseValue ?? cycling?.vo2MaxValue));

		// The fitness-age service is the source of record; max metrics only
		// sometimes carries the number and never the parts.
		const age = data.fitnessAge;
		set("fitness_age", round2(metric(age?.fitnessAge) ?? metric(generic?.fitnessAge)));
		set("fitness_age_achievable", round2(metric(age?.achievableFitnessAge)));
		set("fitness_age_previous", round2(metric(age?.previousFitnessAge)));
		set("chronological_age", metric(age?.chronologicalAge));
		// When Garmin last recalculated it, which is not every day: the app's
		// "Updated Sep 23" can sit a day or more behind the note it is in.
		set("fitness_age_updated", localDateOf(age?.lastUpdated ?? undefined));
		// Named after Garmin's own component keys, whatever they turn out to be
		// — a fixed list would silently drop a factor Garmin adds.
		for (const [name, component] of Object.entries(asObject(age?.components) ?? {})) {
			set(`fitness_age_${snake(name)}`, round2(metric(asObject(component)?.value)));
		}

		const endurance = data.endurance;
		set("endurance_score", metric(endurance?.overallScore));
		set("endurance_classification", metric(endurance?.classification));
		// A numeric phrase id (55), not an enum name — kept as sent.
		set("endurance_feedback", metric(endurance?.feedbackPhrase) ?? label(endurance?.feedbackPhrase));
		// The class boundaries the app draws the gauge with. They depend on age
		// and sex, so they are per account rather than constants.
		for (const [stem, field] of ENDURANCE_LIMITS) set(`endurance_${stem}`, metric(endurance?.[field]));

		const hill = data.hillScore;
		set("hill_score", metric(hill?.overallScore));
		set("hill_score_strength", metric(hill?.strengthScore));
		set("hill_score_endurance", metric(hill?.enduranceScore));
		set("hill_score_classification", metric(hill?.hillScoreClassificationId));
		set("hill_score_feedback", metric(hill?.hillScoreFeedbackPhraseId));

		const acclimation =
			data.maxMetrics?.heatAltitudeAcclimation ??
			(latest && sameDay(latest.heatAltitudeAcclimation?.calendarDate, opts.date)
				? latest.heatAltitudeAcclimation
				: undefined);
		if (acclimation) {
			set("heat_acclimation_pct", metric(acclimation.heatAcclimationPercentage));
			set("heat_acclimation_trend", label(acclimation.heatTrend));
			const altitude = height("altitude_acclimation", metric(acclimation.altitudeAcclimation), opts.units);
			if (altitude) set(altitude.key, altitude.value);
			set("altitude_acclimation_trend", label(acclimation.altitudeTrend));
		}
	}

	if (groups.has("body")) {
		// `totalAverage` rather than the first weigh-in: a day you stepped on the
		// scale twice should read as the day, not as whichever reading came first.
		const body = data.body?.totalAverage ?? data.body?.dateWeightList?.[0];
		if (body) {
			const weight = mass("weight", metric(body.weight), opts.units);
			if (weight) set(weight.key, weight.value);
			set("bmi", round2(metric(body.bmi)));
			set("body_fat_pct", round2(metric(body.bodyFat)));
			set("body_water_pct", round2(metric(body.bodyWater)));
			const muscle = mass("muscle_mass", metric(body.muscleMass), opts.units);
			if (muscle) set(muscle.key, muscle.value);
			const bone = mass("bone_mass", metric(body.boneMass), opts.units);
			if (bone) set(bone.key, bone.value);
		}
	}

	if (groups.has("training")) {
		const training = data.training;
		const status = primaryEntry(
			training?.mostRecentTrainingStatus?.latestTrainingStatusData ?? training?.latestTrainingStatusData,
		);
		if (status) {
			set("training_status", label(status.trainingStatusFeedbackPhrase));
			set("training_load_weekly", roundOrUndefined(metric(status.weeklyTrainingLoad)));
			set("training_status_since", label(status.sinceDate));
			set("fitness_trend", metric(status.fitnessTrend));
			set("training_load_tunnel_min", roundOrUndefined(metric(status.loadTunnelMin)));
			set("training_load_tunnel_max", roundOrUndefined(metric(status.loadTunnelMax)));
		}
		const load = (training?.acuteTrainingLoadDTO ?? asObject(status?.acuteTrainingLoadDTO)) as
			| AcuteTrainingLoad
			| undefined;
		if (load) {
			set("training_load_acute", roundOrUndefined(metric(load.dailyTrainingLoadAcute)));
			set("training_load_chronic", roundOrUndefined(metric(load.dailyTrainingLoadChronic)));
			// Acute over chronic. Garmin sends the ratio on some accounts and the
			// same thing as a percentage on others; either is worth having.
			const ratio =
				metric(load.dailyAcuteChronicWorkloadRatio) ??
				(metric(load.acwrPercent) !== undefined ? metric(load.acwrPercent)! / 100 : undefined);
			set("training_load_ratio", round2(ratio));
			set("training_load_status", label(load.acwrStatus));
			set("training_load_feedback", label(load.acwrStatusFeedback));
			// The optimal band the app draws the acute load against.
			set("training_load_optimal_min", roundOrUndefined(metric(load.minTrainingLoadChronic)));
			set("training_load_optimal_max", roundOrUndefined(metric(load.maxTrainingLoadChronic)));
		}

		// Load Focus: four weeks of load split three ways, each with its
		// target band, and one phrase naming the shortfall.
		const balance = primaryEntry(training?.mostRecentTrainingLoadBalance?.metricsTrainingLoadBalanceDTOMap);
		if (balance) {
			for (const [stem, field] of LOAD_FOCUS_BUCKETS) {
				set(`load_${stem}`, roundOrUndefined(metric(balance[field])));
				set(`load_${stem}_target_min`, roundOrUndefined(metric(balance[`${field}TargetMin`])));
				set(`load_${stem}_target_max`, roundOrUndefined(metric(balance[`${field}TargetMax`])));
			}
			set("load_focus", label(balance.trainingBalanceFeedbackPhrase));
		}

		const tolerance = data.runningTolerance;
		if (tolerance) {
			set("running_tolerance", metric(tolerance.acuteTolerance));
			set("running_tolerance_load", metric(tolerance.acuteImpactLoad));
			const d = distance(metric(tolerance.acuteDistance), opts.units);
			if (d) set(`running_tolerance_${d.key}`, d.value);
			set("running_tolerance_feedback", label(tolerance.runningToleranceFeedBackPhrase));
		}
	}

	if (groups.has("health")) {
		const health = data.health;
		if (health) {
			set("health_status_outliers", metric(health.outliersCount));
			for (const m of health.metrics ?? []) {
				const type = typeof m?.type === "string" ? m.type : "";
				// Garmin sends skin temperature twice, once per unit. Keep the one
				// the rest of the note is in.
				if (type === "SKIN_TEMP_F" && opts.units !== "imperial") continue;
				if (type === "SKIN_TEMP_C" && opts.units === "imperial") continue;
				const stem = HEALTH_STEMS[type] ?? (type ? snake(type) : "");
				if (!stem) continue;
				// Skin temperature is a deviation from baseline, so it can be negative.
				const signed = stem.startsWith("skin_temp");
				set(`health_${stem}`, round2(metric(m.value, { allowNegative: signed })));
				set(`health_${stem}_status`, label(m.status));
				// A metric still ONBOARDING reports a 0–0 baseline, which is "none yet".
				const low = metric(m.baselineLowerLimit, { allowNegative: signed });
				const high = metric(m.baselineUpperLimit, { allowNegative: signed });
				if (low !== 0 || high !== 0) {
					set(`health_${stem}_baseline_low`, round2(low));
					set(`health_${stem}_baseline_high`, round2(high));
				}
			}
		}

		// Health Snapshots: a short list, like workouts — a day has one or two.
		const snapshots = (data.healthSnapshots ?? []).map(mapSnapshot).filter((row) => Object.keys(row).length);
		if (snapshots.length) set("health_snapshots", snapshots);
	}

	if (groups.has("races")) {
		// Seconds, deliberately: a number charts and sorts, where "24:31" does
		// neither. Display formatting is the reader's layer, not the data's.
		set("race_5k", metric(data.races?.time5K));
		set("race_10k", metric(data.races?.time10K));
		set("race_half", metric(data.races?.timeHalfMarathon));
		set("race_marathon", metric(data.races?.timeMarathon));
	}

	if (groups.has("workouts")) {
		const workouts = (data.workouts ?? []).map((a) => mapWorkout(a, opts.units));
		if (workouts.length) set("workouts", workouts);
	}

	if (groups.has("intraday") && data.series) {
		// The series themselves go to the sidecar file; the note gets the one
		// number the app shows off them, the most recent heart rate.
		set("hr_latest", latestValue(data.series.heartRate));
	}

	return out;
}

const ENDURANCE_LIMITS: Array<[string, string]> = [
	["gauge_low", "gaugeLowerLimit"],
	["gauge_high", "gaugeUpperLimit"],
	["intermediate_from", "classificationLowerLimitIntermediate"],
	["trained_from", "classificationLowerLimitTrained"],
	["well_trained_from", "classificationLowerLimitWellTrained"],
	["expert_from", "classificationLowerLimitExpert"],
	["superior_from", "classificationLowerLimitSuperior"],
	["elite_from", "classificationLowerLimitElite"],
];

const HEALTH_STEMS: Record<string, string> = {
	HRV: "hrv",
	HR: "hr",
	SPO2: "spo2",
	RESPIRATION: "respiration",
	SKIN_TEMP_C: "skin_temp_c",
	SKIN_TEMP_F: "skin_temp_f",
};

const SNAPSHOT_KEYS: Record<string, string> = {
	HEART_RATE: "hr",
	RESPIRATION: "respiration",
	STRESS: "stress",
	SPO2: "spo2",
	RMSSD_HRV: "hrv",
	SDRR_HRV: "hrv_sdrr",
};

/** One Health Snapshot as a short list row: when, how long, and each average. */
function mapSnapshot(snapshot: HealthSnapshot): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	const start = snapshot.startTimestampLocal;
	if (typeof start === "string" && start) row.start = start.replace(" ", "T").slice(0, 16);
	for (const entry of snapshot.summaryTypeDataList ?? []) {
		const key = SNAPSHOT_KEYS[entry?.summaryType ?? ""];
		const avg = metric(entry?.avgValue);
		if (key && avg !== undefined) row[key] = round(avg, 1);
	}
	return row;
}

const SLEEP_SCORE_PARTS: Array<[string, string]> = [
	["totalDuration", "sleep_quality_duration"],
	["stress", "sleep_quality_stress"],
	["awakeCount", "sleep_quality_awakenings"],
	["remPercentage", "sleep_quality_rem"],
	["lightPercentage", "sleep_quality_light"],
	["deepPercentage", "sleep_quality_deep"],
	["restlessness", "sleep_quality_restlessness"],
];

/** Property stem → the prefix Garmin uses for `…FactorPercent` / `…FactorFeedback`. */
const READINESS_FACTORS: Array<[string, string]> = [
	["sleep", "sleepScore"],
	["recovery", "recoveryTime"],
	["hrv", "hrv"],
	["load", "acwr"],
	["sleep_history", "sleepHistory"],
	["stress_history", "stressHistory"],
];

const LOAD_FOCUS_BUCKETS: Array<[string, string]> = [
	["aerobic_low", "monthlyLoadAerobicLow"],
	["aerobic_high", "monthlyLoadAerobicHigh"],
	["anaerobic", "monthlyLoadAnaerobic"],
];

function sameDay(value: unknown, date: string | undefined): boolean {
	return typeof value === "string" && date !== undefined && value.slice(0, 10) === date;
}

function roundOrUndefined(value: number | undefined): number | undefined {
	return value === undefined ? undefined : Math.round(value);
}

function hoursOfMinutes(value: number | undefined): number | undefined {
	return value === undefined ? undefined : round(value / 60, 2);
}

function height(stem: string, metres: number | undefined, units: MapOptions["units"]) {
	if (metres === undefined) return undefined;
	return units === "imperial"
		? { key: `${stem}_ft`, value: Math.round(metres / METRES_PER_FOOT) }
		: { key: `${stem}_m`, value: Math.round(metres) };
}

/**
 * One activity as a frontmatter row.
 *
 * Deliberately a short row rather than everything Garmin sends: this lands
 * inside a list property in a note, and thirty keys per workout makes the
 * frontmatter unreadable for a person and slow for the metadata cache.
 */
function mapWorkout(activity: Activity, units: MapOptions["units"]): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	if (activity.activityName) row.name = activity.activityName;
	if (activity.activityType?.typeKey) row.type = activity.activityType.typeKey;
	if (activity.startTimeLocal) row.start = activity.startTimeLocal.replace(" ", "T").slice(0, 16);

	const seconds = metric(activity.duration);
	const mins = minutes(seconds);
	if (mins !== undefined) row.minutes = mins;
	// Whole minutes lose the "42:13" the app shows as an activity's total time.
	if (seconds !== undefined) row.duration_s = Math.round(seconds);

	const metres = metric(activity.distance);
	const d = distance(metres, units);
	if (d) row[d.key] = d.value;

	const calories = metric(activity.calories);
	if (calories !== undefined) row.calories = Math.round(calories);

	const hr = metric(activity.averageHR);
	if (hr !== undefined) row.avg_hr = Math.round(hr);

	const peak = metric(activity.maxHR);
	if (peak !== undefined) row.max_hr = Math.round(peak);

	const climb = elevation(metric(activity.elevationGain), units);
	if (climb) row[climb.key] = climb.value;

	const steps = metric(activity.steps);
	if (steps !== undefined) row.steps = Math.round(steps);

	// Garmin's aerobic training effect, 0-5. One number that says what the
	// session was for, which a duration and a distance do not.
	const effect = metric(activity.aerobicTrainingEffect);
	if (effect !== undefined) row.training_effect = round(effect, 1);

	// Moving time, not elapsed: a pace that counts the coffee stop is not a pace.
	const moving = metric(activity.movingDuration) ?? metric(activity.duration);
	const paceText = pace(metres, moving, units);
	if (paceText) row.pace = paceText;

	return row;
}

/**
 * Minutes per kilometre or mile, as `"5:12"`.
 *
 * A string because it belongs in a list row that nothing charts, and because
 * 5.2 minutes per km reads as neither five minutes twelve nor five twenty.
 */
export function pace(
	metres: number | undefined,
	seconds: number | undefined,
	units: MapOptions["units"],
): string | undefined {
	if (!metres || !seconds || metres <= 0 || seconds <= 0) return undefined;
	const per = units === "imperial" ? METRES_PER_MILE : 1000;
	const secondsPerUnit = seconds / (metres / per);
	// Above about 30 min/km the activity is not one anybody paces — a hike with a
	// long stop, or a distance Garmin recorded as a few metres of GPS drift.
	if (!Number.isFinite(secondsPerUnit) || secondsPerUnit > 1800) return undefined;
	const total = Math.round(secondsPerUnit);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Human labels for the canonical keys. Shared by the Bases view and the dashboard. */
export const METRIC_LABELS: Record<string, string> = {
	date: "Date",
	steps: "Steps",
	steps_goal: "Step goal",
	distance_km: "Distance (km)",
	distance_mi: "Distance (mi)",
	calories: "Calories",
	calories_active: "Active calories",
	calories_bmr: "Resting calories",
	calories_consumed: "Calories eaten",
	floors: "Floors",
	floors_descended: "Floors down",
	floors_goal: "Floor goal",
	intensity_minutes: "Intensity min",
	intensity_moderate: "Moderate min",
	intensity_vigorous: "Vigorous min",
	intensity_goal: "Intensity goal",
	active_minutes: "Active min",
	highly_active_minutes: "Highly active min",
	sedentary_minutes: "Sedentary min",
	resting_hr: "Resting HR",
	resting_hr_7d: "Resting HR (7d)",
	min_hr: "Min HR",
	max_hr: "Max HR",
	sleep_hours: "Sleep (h)",
	sleep_score: "Sleep score",
	sleep_deep_hours: "Deep (h)",
	sleep_light_hours: "Light (h)",
	sleep_rem_hours: "REM (h)",
	sleep_awake_hours: "Awake (h)",
	sleep_start: "Sleep start",
	sleep_end: "Sleep end",
	sleep_quality: "Sleep quality",
	sleep_quality_duration: "Sleep duration verdict",
	sleep_quality_stress: "Sleep stress verdict",
	sleep_quality_awakenings: "Awakenings verdict",
	sleep_quality_rem: "REM verdict",
	sleep_quality_light: "Light sleep verdict",
	sleep_quality_deep: "Deep sleep verdict",
	sleep_quality_restlessness: "Restlessness verdict",
	sleep_feedback: "Sleep feedback",
	sleep_insight: "Sleep insight",
	sleep_need_hours: "Sleep need (h)",
	sleep_need_baseline_hours: "Sleep need baseline (h)",
	sleep_need_next_hours: "Sleep need tonight (h)",
	sleep_need_feedback: "Sleep need feedback",
	sleep_need_training_feedback: "Sleep need training",
	sleep_need_history_adjustment: "Sleep need: history",
	sleep_need_hrv_adjustment: "Sleep need: HRV",
	sleep_need_nap_adjustment: "Sleep need: naps",
	sleep_resting_hr: "Sleep resting HR",
	sleep_avg_stress: "Sleep stress",
	sleep_awake_count: "Awakenings",
	sleep_restless_moments: "Restless moments",
	sleep_respiration: "Sleep respiration",
	sleep_spo2: "Sleep SpO2",
	sleep_spo2_low: "Sleep SpO2 low",
	sleep_body_battery_change: "Battery recharged",
	nap_hours: "Naps (h)",
	stress_avg: "Stress",
	stress_max: "Stress max",
	stress_qualifier: "Stress level",
	stress_rest_minutes: "Rest min",
	stress_low_minutes: "Low stress min",
	stress_medium_minutes: "Medium stress min",
	stress_high_minutes: "High stress min",
	body_battery_high: "Body battery high",
	body_battery_low: "Body battery low",
	body_battery_latest: "Body battery now",
	body_battery_charged: "Battery charged",
	body_battery_drained: "Battery drained",
	hrv_avg: "HRV",
	hrv_high: "HRV high",
	hrv_weekly_avg: "HRV weekly",
	hrv_status: "HRV status",
	hrv_baseline_low: "HRV baseline low",
	hrv_baseline_high: "HRV baseline high",
	training_readiness: "Readiness",
	training_readiness_level: "Readiness level",
	readiness_sleep_score: "Readiness sleep score",
	readiness_hrv_factor: "Readiness HRV factor",
	recovery_time_hours: "Recovery (h)",
	acute_load: "Acute load",
	readiness_feedback: "Readiness feedback",
	readiness_feedback_long: "Readiness detail",
	readiness_context: "Readiness context",
	readiness_sleep_factor: "Readiness sleep factor",
	readiness_sleep_feedback: "Readiness sleep",
	readiness_recovery_factor: "Readiness recovery factor",
	readiness_recovery_feedback: "Readiness recovery",
	readiness_hrv_feedback: "Readiness HRV",
	readiness_load_factor: "Readiness load factor",
	readiness_load_feedback: "Readiness load",
	readiness_sleep_history_factor: "Readiness sleep history factor",
	readiness_sleep_history_feedback: "Readiness sleep history",
	readiness_stress_history_factor: "Readiness stress history factor",
	readiness_stress_history_feedback: "Readiness stress history",
	readiness_hrv_weekly_avg: "Readiness HRV weekly",
	vo2max: "VO2 Max",
	vo2max_cycling: "VO2 Max (cycling)",
	fitness_age: "Fitness age",
	fitness_age_achievable: "Achievable fitness age",
	fitness_age_previous: "Previous fitness age",
	fitness_age_updated: "Fitness age updated",
	chronological_age: "Age",
	endurance_score: "Endurance score",
	endurance_classification: "Endurance class",
	endurance_feedback: "Endurance feedback",
	endurance_gauge_low: "Endurance gauge low",
	endurance_gauge_high: "Endurance gauge high",
	endurance_intermediate_from: "Endurance: intermediate from",
	endurance_trained_from: "Endurance: trained from",
	endurance_well_trained_from: "Endurance: well trained from",
	endurance_expert_from: "Endurance: expert from",
	endurance_superior_from: "Endurance: superior from",
	endurance_elite_from: "Endurance: elite from",
	hill_score: "Hill score",
	hill_score_strength: "Hill strength",
	hill_score_endurance: "Hill endurance",
	hill_score_classification: "Hill score class",
	hill_score_feedback: "Hill score feedback",
	heat_acclimation_pct: "Heat acclimation %",
	heat_acclimation_trend: "Heat trend",
	altitude_acclimation_m: "Altitude acclimation (m)",
	altitude_acclimation_ft: "Altitude acclimation (ft)",
	altitude_acclimation_trend: "Altitude trend",
	race_5k: "5K prediction",
	race_10k: "10K prediction",
	race_half: "Half marathon",
	race_marathon: "Marathon",
	respiration_avg: "Respiration",
	respiration_min: "Respiration min",
	respiration_max: "Respiration max",
	respiration_latest: "Respiration latest",
	spo2_avg: "SpO2",
	spo2_low: "SpO2 low",
	spo2_latest: "SpO2 latest",
	weight_kg: "Weight (kg)",
	weight_lb: "Weight (lb)",
	bmi: "BMI",
	body_fat_pct: "Body fat %",
	body_water_pct: "Body water %",
	muscle_mass_kg: "Muscle (kg)",
	muscle_mass_lb: "Muscle (lb)",
	bone_mass_kg: "Bone (kg)",
	bone_mass_lb: "Bone (lb)",
	training_status: "Training status",
	training_load_weekly: "Weekly load",
	training_load_acute: "Acute load (7d)",
	training_load_chronic: "Chronic load (28d)",
	training_load_ratio: "Load ratio",
	training_load_status: "Load status",
	training_load_feedback: "Load feedback",
	training_load_optimal_min: "Optimal load min",
	training_load_optimal_max: "Optimal load max",
	training_load_tunnel_min: "Load tunnel min",
	training_load_tunnel_max: "Load tunnel max",
	training_status_since: "Status since",
	fitness_trend: "Fitness trend",
	load_aerobic_low: "Low aerobic load",
	load_aerobic_low_target_min: "Low aerobic target min",
	load_aerobic_low_target_max: "Low aerobic target max",
	load_aerobic_high: "High aerobic load",
	load_aerobic_high_target_min: "High aerobic target min",
	load_aerobic_high_target_max: "High aerobic target max",
	load_anaerobic: "Anaerobic load",
	load_anaerobic_target_min: "Anaerobic target min",
	load_anaerobic_target_max: "Anaerobic target max",
	load_focus: "Load focus",
	running_tolerance: "Running tolerance",
	running_tolerance_load: "Running impact load",
	running_tolerance_distance_km: "Running tolerance distance (km)",
	running_tolerance_distance_mi: "Running tolerance distance (mi)",
	running_tolerance_feedback: "Running tolerance feedback",
	health_status_outliers: "Health status outliers",
	health_hrv: "Health: HRV",
	health_hrv_status: "Health: HRV status",
	health_hrv_baseline_low: "Health: HRV baseline low",
	health_hrv_baseline_high: "Health: HRV baseline high",
	health_hr: "Health: HR",
	health_hr_status: "Health: HR status",
	health_hr_baseline_low: "Health: HR baseline low",
	health_hr_baseline_high: "Health: HR baseline high",
	health_spo2: "Health: SpO2",
	health_spo2_status: "Health: SpO2 status",
	health_spo2_baseline_low: "Health: SpO2 baseline low",
	health_spo2_baseline_high: "Health: SpO2 baseline high",
	health_respiration: "Health: respiration",
	health_respiration_status: "Health: respiration status",
	health_respiration_baseline_low: "Health: respiration baseline low",
	health_respiration_baseline_high: "Health: respiration baseline high",
	health_skin_temp_c: "Health: skin temp (°C)",
	health_skin_temp_c_status: "Health: skin temp status",
	health_skin_temp_c_baseline_low: "Health: skin temp baseline low (°C)",
	health_skin_temp_c_baseline_high: "Health: skin temp baseline high (°C)",
	health_skin_temp_f: "Health: skin temp (°F)",
	health_skin_temp_f_status: "Health: skin temp status",
	health_skin_temp_f_baseline_low: "Health: skin temp baseline low (°F)",
	health_skin_temp_f_baseline_high: "Health: skin temp baseline high (°F)",
	health_snapshots: "Health snapshots",
	workouts: "Workouts",
	hr_latest: "Latest HR",
};

/**
 * Namespacing is the target's job, not the mapper's: a daily note needs the
 * prefix to stay out of the user's own properties, while a note in a dedicated
 * folder reads better without one.
 */
export function applyPrefix(properties: Properties, prefix: string): Properties {
	if (!prefix) return properties;
	const out: Properties = {};
	for (const [key, value] of Object.entries(properties)) out[`${prefix}${key}`] = value;
	return out;
}

/**
 * Every canonical key a set of groups can produce, in display order.
 *
 * Both distance keys are listed even though only one is ever written — the
 * caller filters to whichever unit is in play.
 */
export function keysFor(groups: readonly MetricGroup[]): string[] {
	const byGroup: Record<MetricGroup, string[]> = {
		activity: [
			"steps",
			"steps_goal",
			"distance_km",
			"distance_mi",
			"calories",
			"calories_active",
			"calories_bmr",
			"calories_consumed",
			"floors",
			"floors_descended",
			"floors_goal",
			"intensity_minutes",
			"intensity_moderate",
			"intensity_vigorous",
			"intensity_goal",
			"active_minutes",
			"highly_active_minutes",
			"sedentary_minutes",
		],
		heart: ["resting_hr", "resting_hr_7d", "min_hr", "max_hr"],
		sleep: [
			"sleep_hours",
			"sleep_score",
			"sleep_quality",
			"sleep_deep_hours",
			"sleep_light_hours",
			"sleep_rem_hours",
			"sleep_awake_hours",
			"sleep_start",
			"sleep_end",
			"sleep_resting_hr",
			"sleep_avg_stress",
			"sleep_awake_count",
			"sleep_restless_moments",
			"sleep_respiration",
			"sleep_spo2",
			"sleep_spo2_low",
			"sleep_body_battery_change",
			"nap_hours",
			"sleep_quality_duration",
			"sleep_quality_stress",
			"sleep_quality_awakenings",
			"sleep_quality_rem",
			"sleep_quality_light",
			"sleep_quality_deep",
			"sleep_quality_restlessness",
			"sleep_feedback",
			"sleep_insight",
			"sleep_need_hours",
			"sleep_need_baseline_hours",
			"sleep_need_next_hours",
			"sleep_need_feedback",
			"sleep_need_training_feedback",
			"sleep_need_history_adjustment",
			"sleep_need_hrv_adjustment",
			"sleep_need_nap_adjustment",
		],
		stress: [
			"stress_avg",
			"stress_max",
			"stress_qualifier",
			"stress_rest_minutes",
			"stress_low_minutes",
			"stress_medium_minutes",
			"stress_high_minutes",
			"body_battery_high",
			"body_battery_low",
			"body_battery_latest",
			"body_battery_charged",
			"body_battery_drained",
		],
		hrv: [
			"hrv_avg",
			"hrv_high",
			"hrv_weekly_avg",
			"hrv_status",
			"hrv_baseline_low",
			"hrv_baseline_high",
		],
		readiness: [
			"training_readiness",
			"training_readiness_level",
			"readiness_sleep_score",
			"readiness_hrv_factor",
			"recovery_time_hours",
			"acute_load",
			"readiness_feedback",
			"readiness_feedback_long",
			"readiness_context",
			"readiness_sleep_factor",
			"readiness_sleep_feedback",
			"readiness_recovery_factor",
			"readiness_recovery_feedback",
			"readiness_hrv_feedback",
			"readiness_load_factor",
			"readiness_load_feedback",
			"readiness_sleep_history_factor",
			"readiness_sleep_history_feedback",
			"readiness_stress_history_factor",
			"readiness_stress_history_feedback",
			"readiness_hrv_weekly_avg",
		],
		// `fitness_age_<component>` keys are left out: they are named after
		// whatever Garmin sends, so there is no fixed list to put here.
		fitness: [
			"vo2max",
			"vo2max_cycling",
			"fitness_age",
			"fitness_age_achievable",
			"fitness_age_previous",
			"fitness_age_updated",
			"chronological_age",
			"endurance_score",
			"endurance_classification",
			"endurance_feedback",
			"endurance_gauge_low",
			"endurance_gauge_high",
			"endurance_intermediate_from",
			"endurance_trained_from",
			"endurance_well_trained_from",
			"endurance_expert_from",
			"endurance_superior_from",
			"endurance_elite_from",
			"hill_score",
			"hill_score_strength",
			"hill_score_endurance",
			"hill_score_classification",
			"hill_score_feedback",
			"heat_acclimation_pct",
			"heat_acclimation_trend",
			"altitude_acclimation_m",
			"altitude_acclimation_ft",
			"altitude_acclimation_trend",
		],
		races: ["race_5k", "race_10k", "race_half", "race_marathon"],
		respiration: ["respiration_avg", "respiration_min", "respiration_max", "respiration_latest"],
		spo2: ["spo2_avg", "spo2_low", "spo2_latest"],
		body: [
			"weight_kg",
			"weight_lb",
			"bmi",
			"body_fat_pct",
			"body_water_pct",
			"muscle_mass_kg",
			"muscle_mass_lb",
			"bone_mass_kg",
			"bone_mass_lb",
		],
		training: [
			"training_status",
			"training_load_weekly",
			"training_load_acute",
			"training_load_chronic",
			"training_load_ratio",
			"training_load_status",
			"training_load_feedback",
			"training_load_optimal_min",
			"training_load_optimal_max",
			"training_load_tunnel_min",
			"training_load_tunnel_max",
			"training_status_since",
			"fitness_trend",
			"load_aerobic_low",
			"load_aerobic_low_target_min",
			"load_aerobic_low_target_max",
			"load_aerobic_high",
			"load_aerobic_high_target_min",
			"load_aerobic_high_target_max",
			"load_anaerobic",
			"load_anaerobic_target_min",
			"load_anaerobic_target_max",
			"load_focus",
			"running_tolerance",
			"running_tolerance_load",
			"running_tolerance_distance_km",
			"running_tolerance_distance_mi",
			"running_tolerance_feedback",
		],
		workouts: ["workouts"],
		intraday: ["hr_latest"],
		health: [
			"health_status_outliers",
			...["hrv", "hr", "spo2", "respiration", "skin_temp_c", "skin_temp_f"].flatMap((m) => [
				`health_${m}`,
				`health_${m}_status`,
				`health_${m}_baseline_low`,
				`health_${m}_baseline_high`,
			]),
			"health_snapshots",
		],
		profile: [],
	};
	const wanted = new Set(groups);
	return ALL_GROUPS.filter((g) => wanted.has(g)).flatMap((g) => byGroup[g]);
}

/**
 * The subset of each group worth a column in the generated Bases view.
 *
 * `keysFor` now returns around eighty keys, and a table eighty columns wide is
 * not a table anyone reads. Everything left out is still written to the note and
 * still queryable — this only decides what the generated view opens with.
 */
const PRIMARY: Record<MetricGroup, string[]> = {
	activity: [
		"steps",
		"distance_km",
		"distance_mi",
		"calories_active",
		"floors",
		"intensity_minutes",
	],
	heart: ["resting_hr", "max_hr"],
	sleep: ["sleep_hours", "sleep_score", "sleep_deep_hours", "sleep_rem_hours"],
	stress: ["stress_avg", "body_battery_high", "body_battery_low"],
	hrv: ["hrv_avg", "hrv_status"],
	readiness: ["training_readiness", "recovery_time_hours"],
	fitness: ["vo2max", "fitness_age", "endurance_score"],
	races: ["race_5k", "race_10k", "race_half", "race_marathon"],
	respiration: ["respiration_avg"],
	spo2: ["spo2_avg"],
	body: ["weight_kg", "weight_lb", "body_fat_pct"],
	training: ["training_status", "training_load_ratio"],
	workouts: ["workouts"],
	intraday: [],
	health: ["health_hrv_status", "health_hr_status"],
	profile: [],
};

export function primaryKeysFor(groups: readonly MetricGroup[]): string[] {
	const wanted = new Set(groups);
	return ALL_GROUPS.filter((g) => wanted.has(g)).flatMap((g) => PRIMARY[g]);
}

/** Keys whose value is a duration in seconds rather than a plain number. */
export const DURATION_KEYS = new Set(["race_5k", "race_10k", "race_half", "race_marathon"]);

/** Groups activities by the local calendar day they started on. */
export function bucketWorkoutsByDate(activities: readonly Activity[]): Map<string, Activity[]> {
	const byDate = new Map<string, Activity[]>();
	for (const activity of activities) {
		const date = localDateOf(activity.startTimeLocal);
		if (!date) continue;
		const list = byDate.get(date);
		if (list) list.push(activity);
		else byDate.set(date, [activity]);
	}
	return byDate;
}

/** Which endpoints a given set of groups actually needs. Fewer calls, fewer 429s. */
export function endpointsFor(groups: readonly MetricGroup[]) {
	const set = new Set(groups);
	return {
		// One request serves five groups: respiration and pulse ox ride along in
		// the daily summary rather than costing a call of their own.
		summary:
			set.has("activity") ||
			set.has("heart") ||
			set.has("stress") ||
			set.has("respiration") ||
			set.has("spo2"),
		sleep: set.has("sleep"),
		hrv: set.has("hrv"),
		readiness: set.has("readiness"),
		// Per-day, unlike the range endpoints below.
		endurance: set.has("fitness"),
		training: set.has("training"),
		body: set.has("body"),
		fitnessAge: set.has("fitness"),
		health: set.has("health"),
		// Four requests between them, so the engine spends them only on the
		// newest days of a run. See `INTRADAY_DAYS`.
		intraday: set.has("intraday"),
		// Range endpoints: one request each for the whole window, however long.
		maxMetrics: set.has("fitness"),
		races: set.has("races"),
		workouts: set.has("workouts"),
		hillScores: set.has("fitness"),
		runningTolerance: set.has("training"),
		healthSnapshots: set.has("health"),
	};
}
