import { GarminClient, type LoginOptions } from "./client";
import { GarminApiError, GarminAuthError } from "./errors";

/* ------------------------------------------------------------------ */
/*  Response shapes                                                    */
/* ------------------------------------------------------------------ */
/* Garmin returns large objects that change without notice. These type the
   fields a daily-note sync actually reads and leave the rest reachable. */

export interface SocialProfile {
	displayName?: string;
	fullName?: string;
	userName?: string;
	profileId?: number;
	profileImageUrlLarge?: string | null;
	profileImageUrlMedium?: string | null;
	profileImageUrlSmall?: string | null;
	[key: string]: unknown;
}

export interface DailySummary {
	calendarDate?: string;
	totalSteps?: number | null;
	dailyStepGoal?: number | null;
	totalDistanceMeters?: number | null;
	/** Metres on foot. `totalDistanceMeters` adds rides and swims; the Steps page shows this one. */
	wellnessDistanceMeters?: number | null;
	totalKilocalories?: number | null;
	activeKilocalories?: number | null;
	/** Fractional: the Floors page shows these rounded down. */
	floorsAscended?: number | null;
	floorsDescended?: number | null;
	userFloorsAscendedGoal?: number | null;
	/** False, with every count null, on a day the watch recorded nothing. */
	includesWellnessData?: boolean | null;
	minHeartRate?: number | null;
	maxHeartRate?: number | null;
	restingHeartRate?: number | null;
	averageStressLevel?: number | null;
	bodyBatteryHighestValue?: number | null;
	bodyBatteryLowestValue?: number | null;
	moderateIntensityMinutes?: number | null;
	vigorousIntensityMinutes?: number | null;
	/** The week's goal, not the day's. */
	intensityMinutesGoal?: number | null;
	privacyProtected?: boolean;
	[key: string]: unknown;
}

/**
 * One day of `/usersummary-service/stats/steps/daily`. The range endpoints
 * leave out days the watch recorded nothing, and take 28 days at most.
 */
export interface DailyStepStat {
	calendarDate?: string;
	totalSteps?: number | null;
	/** Metres on foot, as `wellnessDistanceMeters`. */
	totalDistance?: number | null;
	stepGoal?: number | null;
	[key: string]: unknown;
}

/** One day of `/usersummary-service/stats/floors/daily`, in whole floors. */
export interface DailyFloorStat {
	calendarDate?: string;
	values?: {
		wellnessFloorsAscended?: number | null;
		wellnessFloorsDescended?: number | null;
		wellnessUserFloorsAscendedGoal?: number | null;
		[key: string]: unknown;
	} | null;
	[key: string]: unknown;
}

/**
 * One night of `/sleep-service/stats/sleep/daily`, filed under the day it
 * ended on. The local times are epoch milliseconds read as local wall-clock
 * time; durations are seconds, `sleepNeed` minutes.
 */
export interface SleepStatsDay {
	calendarDate?: string;
	values?: {
		sleepScore?: number | null;
		sleepScoreQuality?: string | null;
		totalSleepTimeInSeconds?: number | null;
		deepTime?: number | null;
		lightTime?: number | null;
		remTime?: number | null;
		awakeTime?: number | null;
		sleepNeed?: number | null;
		localSleepStartTimeInMillis?: number | null;
		localSleepEndTimeInMillis?: number | null;
		avgHeartRate?: number | null;
		restingHeartRate?: number | null;
		bodyBatteryChange?: number | null;
		respiration?: number | null;
		spO2?: number | null;
		skinTempC?: number | null;
		skinTempF?: number | null;
		avgOvernightHrv?: number | null;
		hrv7dAverage?: number | null;
		hrvStatus?: string | null;
		sleepAlignmentStatus?: string | null;
		/** The optimal sleep window, minutes from the day's local midnight. */
		sleepAlignmentOswStart?: number | null;
		sleepAlignmentOswEnd?: number | null;
		[key: string]: unknown;
	} | null;
	[key: string]: unknown;
}

/** `/sleep-service/stats/sleep/daily/{start}/{end}`: 28 nights at most, nights without sleep left out. */
export interface SleepStats {
	overallStats?: Record<string, unknown> | null;
	individualStats?: SleepStatsDay[] | null;
	[key: string]: unknown;
}

/** One day of `/usersummary-service/stats/im/daily`. The goal is the week's. */
export interface DailyIntensityStat {
	calendarDate?: string;
	weeklyGoal?: number | null;
	moderateValue?: number | null;
	vigorousValue?: number | null;
	[key: string]: unknown;
}

/**
 * A day's floors in 15-minute buckets: `[startGMT, endGMT, ascended,
 * descended]` per the descriptor list. Whole floors per bucket, so they can
 * add up to a little less than the day's total.
 */
export interface FloorsChart {
	/** Midnight on the watch's clock, as a zone-less GMT string. */
	startTimestampGMT?: string | null;
	floorsValueDescriptorDTOList?: ValueDescriptor[] | null;
	floorValuesArray?: Array<Array<string | number | null>> | null;
	[key: string]: unknown;
}

/**
 * A day's intensity minutes: `[bucketEndMs, minutes]`, vigorous already
 * counted twice. The array is null on a day with none.
 */
export interface IntensityChart {
	calendarDate?: string;
	/** Midnight on the watch's clock, as a zone-less GMT string. */
	startTimestampGMT?: string | null;
	/** The week's total before this day, and after it. */
	startDayMinutes?: number | null;
	endDayMinutes?: number | null;
	weekGoal?: number | null;
	imValueDescriptorsDTOList?: ValueDescriptor[] | null;
	imValuesArray?: Array<Array<number | null>> | null;
	[key: string]: unknown;
}

export interface SleepData {
	dailySleepDTO?: {
		calendarDate?: string;
		sleepTimeSeconds?: number | null;
		deepSleepSeconds?: number | null;
		lightSleepSeconds?: number | null;
		remSleepSeconds?: number | null;
		awakeSleepSeconds?: number | null;
		sleepStartTimestampGMT?: number | null;
		sleepEndTimestampGMT?: number | null;
		sleepScores?: Record<string, unknown>;
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

export interface HeartRateData {
	calendarDate?: string;
	restingHeartRate?: number | null;
	maxHeartRate?: number | null;
	minHeartRate?: number | null;
	heartRateValues?: Array<[number, number | null]> | null;
	[key: string]: unknown;
}

/**
 * Intraday stress and Body Battery for one day.
 *
 * Both arrays are rows of numbers whose column order is given by the matching
 * descriptor list, which is why the mapper looks the column up rather than
 * assuming it: `[timestamp, stressLevel]` and
 * `[timestamp, status, bodyBatteryLevel, version]` today.
 */
export interface DailyStress {
	calendarDate?: string;
	avgStressLevel?: number | null;
	maxStressLevel?: number | null;
	stressValueDescriptorsDTOList?: ValueDescriptor[] | null;
	stressValuesArray?: Array<Array<number | string | null>> | null;
	bodyBatteryValueDescriptorsDTOList?: ValueDescriptor[] | null;
	bodyBatteryValuesArray?: Array<Array<number | string | null>> | null;
	[key: string]: unknown;
}

export interface ValueDescriptor {
	key?: string;
	index?: number;
	[key: string]: unknown;
}

/** One 15-minute bucket of the day's step chart. Times are GMT strings without a zone. */
export interface StepsChartEntry {
	startGMT?: string;
	endGMT?: string;
	steps?: number | null;
	primaryActivityLevel?: string | null;
	[key: string]: unknown;
}

/** Something that moved Body Battery: a night's sleep, a workout, a stressful stretch. */
export interface BodyBatteryEvent {
	event?: {
		eventType?: string | null;
		eventStartTimeGmt?: string | null;
		durationInMilliseconds?: number | null;
		bodyBatteryImpact?: number | null;
		feedbackType?: string | null;
		shortFeedback?: string | null;
		[key: string]: unknown;
	} | null;
	activityName?: string | null;
	activityType?: string | null;
	activityId?: number | null;
	averageStress?: number | null;
	[key: string]: unknown;
}

/** Fitness age and what it is made of. `components` values carry a `value` each. */
export interface FitnessAge {
	chronologicalAge?: number | null;
	fitnessAge?: number | null;
	achievableFitnessAge?: number | null;
	previousFitnessAge?: number | null;
	components?: Record<string, { value?: number | null; [key: string]: unknown } | null> | null;
	lastUpdated?: string | null;
	[key: string]: unknown;
}

/**
 * Heat and altitude acclimation. Rides along with VO2 Max in both places Garmin
 * sends it, and has routes of its own (`heatAltitudeAcclimation*`). Altitudes
 * in metres; trends `ACCLIMATIZING`, `ACCLIMATIZED`, `DEACCLIMATIZING` or null.
 */
export interface Acclimation {
	/** The local day the row is for: date a row by this. */
	calendarDate?: string;
	/** 0–100, whole. */
	heatAcclimationPercentage?: number | null;
	/** Null exactly when the % is 0; ACCLIMATIZING exactly when it rose. */
	heatTrend?: string | null;
	altitudeAcclimation?: number | null;
	altitudeTrend?: string | null;
	currentAltitude?: number | null;
	/**
	 * The reading before (yesterday's on 428 of 429 days), which Heat
	 * Acclimation's "Trending up from 79%." compares against.
	 */
	previousHeatAcclimationPercentage?: number | null;
	previousAltitudeAcclimation?: number | null;
	/** The days the two values were last worked out: within a day of `calendarDate`, either side. */
	heatAcclimationDate?: string | null;
	altitudeAcclimationDate?: string | null;
	[key: string]: unknown;
}

/**
 * One day of "max metrics". VO2 Max lives here, per running/cycling sub-object.
 *
 * The day is on the sub-objects (`generic.calendarDate`), not on the row —
 * reading it off the row is why VO2 Max never reached a note. See
 * `maxMetricsDate`.
 */
export interface MaxMetrics {
	calendarDate?: string;
	generic?: {
		calendarDate?: string;
		vo2MaxPreciseValue?: number | null;
		vo2MaxValue?: number | null;
		fitnessAge?: number | null;
		[key: string]: unknown;
	} | null;
	cycling?: {
		calendarDate?: string;
		vo2MaxPreciseValue?: number | null;
		vo2MaxValue?: number | null;
		[key: string]: unknown;
	} | null;
	heatAltitudeAcclimation?: Acclimation | null;
	[key: string]: unknown;
}

/** The day a max-metrics row describes, wherever Garmin put it. */
export function maxMetricsDate(row: MaxMetrics | null | undefined): string | undefined {
	const candidates = [
		row?.calendarDate,
		row?.generic?.calendarDate,
		row?.cycling?.calendarDate,
		row?.heatAltitudeAcclimation?.calendarDate,
	];
	return candidates.find((d): d is string => typeof d === "string" && ISO_DATE.test(d.slice(0, 10)))?.slice(0, 10);
}

/** Predicted finish times, in seconds. */
export interface RacePrediction {
	calendarDate?: string;
	time5K?: number | null;
	time10K?: number | null;
	timeHalfMarathon?: number | null;
	timeMarathon?: number | null;
	[key: string]: unknown;
}

/**
 * One entry of an Endurance Score contributor list: one of Garmin's sport
 * groups (`group`: 0 running, 1 cycling, 6 swimming, 8 miscellaneous) or an
 * activity type (`activityTypeId`: 3 hiking, 13 strength training, 31 stair
 * climbing, 163 yoga), the other null, and its share in percent.
 */
export interface EnduranceContributor {
	activityTypeId?: number | null;
	group?: number | null;
	contribution?: number | null;
}

export interface EnduranceScore {
	calendarDate?: string;
	/** Null while calibrating (the first two weeks). */
	overallScore?: number | null;
	/** 1 Recreational … 7 Elite; 0 while calibrating. */
	classification?: number | null;
	/** The phrase id under the dial (55); 2 while calibrating. */
	feedbackPhrase?: string | number | null;
	/** The dial's ends, and where each class starts: per account (age band and sex). */
	gaugeLowerLimit?: number | null;
	gaugeUpperLimit?: number | null;
	classificationLowerLimitIntermediate?: number | null;
	classificationLowerLimitTrained?: number | null;
	classificationLowerLimitWellTrained?: number | null;
	classificationLowerLimitExpert?: number | null;
	classificationLowerLimitSuperior?: number | null;
	classificationLowerLimitElite?: number | null;
	/** The day's top contributors: at most three entries plus group 8, the stats route's daily row entry for entry. */
	contributors?: EnduranceContributor[] | null;
	[key: string]: unknown;
}

export interface Activity {
	activityId?: number;
	activityName?: string;
	startTimeLocal?: string;
	startTimeGMT?: string;
	distance?: number | null;
	duration?: number | null;
	movingDuration?: number | null;
	elapsedDuration?: number | null;
	calories?: number | null;
	averageHR?: number | null;
	maxHR?: number | null;
	steps?: number | null;
	elevationGain?: number | null;
	elevationLoss?: number | null;
	averageSpeed?: number | null;
	maxSpeed?: number | null;
	aerobicTrainingEffect?: number | null;
	anaerobicTrainingEffect?: number | null;
	/** The primary benefit: LACTATE_THRESHOLD, VO2MAX, TEMPO, RECOVERY… */
	trainingEffectLabel?: string | null;
	/** Copy keys for the two scales, as the activity page's benefit sheet reads them. */
	aerobicTrainingEffectMessage?: string | null;
	anaerobicTrainingEffectMessage?: string | null;
	/** The activity's exercise load. */
	activityTrainingLoad?: number | null;
	vO2MaxValue?: number | null;
	averageRunningCadenceInStepsPerMinute?: number | null;
	/** Rides: the activity's best average power over 1 s … 2 h, `maxAvgPower_<seconds>`, in W. */
	excludeFromPowerCurveReports?: boolean | null;
	/** Epoch ms of the start; the list is ordered by it, newest first. */
	beginTimestamp?: number | null;
	/**
	 * `parentTypeId` is the next type up Garmin's tree: treadmill_running (18)
	 * sits under running (1), which sits under "all" (17).
	 */
	activityType?: { typeId?: number; typeKey?: string; parentTypeId?: number; [key: string]: unknown };
	/** A multisport activity. Its legs are separate activities that the list leaves out. */
	isParent?: boolean;
	/** On a multisport leg: the multisport activity it belongs to. */
	parentId?: number | null;
	[key: string]: unknown;
}

/** `/activitylist-service/activities/count`. */
export interface ActivityCount {
	/** Every activity, multisport legs included. */
	totalCount?: number;
	/** The legs, which the activity list leaves out. */
	multisportChildCount?: number;
	multisportParentCount?: number;
	nonMultisportCount?: number;
	[key: string]: unknown;
}

/**
 * `/activity-service/activity/{id}`: the summary an activity's page opens with.
 * `summaryDTO` holds the totals and averages; which keys it carries depends on
 * the sport and the sensors (a treadmill run has no elevation or GAP).
 */
export interface ActivitySummary {
	activityId?: number;
	activityName?: string;
	/** The notes the user wrote, when there are any. */
	description?: string | null;
	activityTypeDTO?: { typeId?: number; typeKey?: string; parentTypeId?: number; [key: string]: unknown };
	/** Who can see it: `private`, `subscribers`, `public`. */
	accessControlRuleDTO?: { typeId?: number; typeKey?: string; [key: string]: unknown } | null;
	timeZoneUnitDTO?: { unitKey?: string; timeZone?: string; [key: string]: unknown } | null;
	metadataDTO?: {
		/** The recording device; `deviceVersionPk` is the firmware it ran, for `deviceAppInfo()`. */
		deviceMetaDataDTO?: { deviceId?: string; deviceTypePk?: number; deviceVersionPk?: number; [key: string]: unknown } | null;
		hasPolyline?: boolean;
		hasSplits?: boolean;
		hasHrTimeInZones?: boolean;
		hasPowerTimeInZones?: boolean;
		lapCount?: number;
		/** Running power counted the wind. */
		runPowerWindDataEnabled?: boolean;
		[key: string]: unknown;
	} | null;
	summaryDTO?: ActivityStats | null;
	/** Totals per split type: `INTERVAL_ACTIVE`, `RWD_RUN`, `RWD_WALK`, `RWD_STAND`. */
	splitSummaries?: Array<{ splitType?: string; noOfSplits?: number; duration?: number; distance?: number; [key: string]: unknown }>;
	[key: string]: unknown;
}

/** An activity's or a lap's totals. Speeds in m/s, distances in m, durations in s. */
export interface ActivityStats {
	startTimeLocal?: string;
	startTimeGMT?: string;
	distance?: number | null;
	duration?: number | null;
	movingDuration?: number | null;
	elapsedDuration?: number | null;
	averageSpeed?: number | null;
	averageMovingSpeed?: number | null;
	avgGradeAdjustedSpeed?: number | null;
	maxSpeed?: number | null;
	averageHR?: number | null;
	maxHR?: number | null;
	calories?: number | null;
	bmrCalories?: number | null;
	averagePower?: number | null;
	maxPower?: number | null;
	averageRunCadence?: number | null;
	maxRunCadence?: number | null;
	/** Centimetres. */
	strideLength?: number | null;
	verticalOscillation?: number | null;
	verticalRatio?: number | null;
	groundContactTime?: number | null;
	elevationGain?: number | null;
	elevationLoss?: number | null;
	minElevation?: number | null;
	maxElevation?: number | null;
	trainingEffect?: number | null;
	anaerobicTrainingEffect?: number | null;
	trainingEffectLabel?: string | null;
	aerobicTrainingEffectMessage?: string | null;
	activityTrainingLoad?: number | null;
	beginPotentialStamina?: number | null;
	endPotentialStamina?: number | null;
	minAvailableStamina?: number | null;
	/** Impact load in metres. */
	impactLoad?: number | null;
	/** Estimated sweat loss, ml. */
	waterEstimated?: number | null;
	moderateIntensityMinutes?: number | null;
	vigorousIntensityMinutes?: number | null;
	differenceBodyBattery?: number | null;
	/** Self-evaluation as the watch stores it (Normal = 50, effort 6/10 = 60). */
	directWorkoutFeel?: number | null;
	directWorkoutRpe?: number | null;
	[key: string]: unknown;
}

/**
 * `/activity-service/activity/{id}/details`: the recorded samples. Each row of
 * `activityDetailMetrics` holds one value per `metricDescriptors` entry, at that
 * entry's `metricsIndex`. The GPS track is the lat/lon columns; `geoPolylineDTO`
 * repeats it at full rate, and is null without GPS.
 */
export interface ActivityDetails {
	activityId?: number;
	measurementCount?: number;
	metricsCount?: number;
	metricDescriptors?: Array<{ metricsIndex: number; key: string; unit?: { key?: string; factor?: number } | null }>;
	activityDetailMetrics?: Array<{ metrics: Array<number | null> }>;
	geoPolylineDTO?: { minLat?: number; maxLat?: number; minLon?: number; maxLon?: number; [key: string]: unknown } | null;
	detailsAvailable?: boolean;
	[key: string]: unknown;
}

/** `/activity-service/activity/{id}/splits`: the laps. */
export interface ActivitySplits {
	activityId?: number;
	lapDTOs?: Array<ActivityStats & { lapIndex?: number; startLatitude?: number | null; startLongitude?: number | null; endLatitude?: number | null; endLongitude?: number | null; intensityType?: string }>;
	[key: string]: unknown;
}

/** `/activity-service/activity/{id}/typedsplits`: run/walk detection and workout intervals. */
export interface ActivityTypedSplits {
	activityId?: number;
	splits?: Array<ActivityStats & { type?: string; messageIndex?: number; endTimeGMT?: string }>;
	[key: string]: unknown;
}

/** One row of `hrTimeInZones` or `powerTimeInZones`. */
export interface ActivityZone {
	zoneNumber?: number;
	secsInZone?: number | null;
	/** bpm or watts. */
	zoneLowBoundary?: number | null;
	[key: string]: unknown;
}

/** `/activity-service/activity/{id}/weather`. Every field is null when Garmin has none (indoors). Temperatures in °F. */
export interface ActivityWeather {
	issueDate?: string | null;
	temp?: number | null;
	apparentTemp?: number | null;
	relativeHumidity?: number | null;
	windDirection?: number | null;
	windDirectionCompassPoint?: string | null;
	windSpeed?: number | null;
	windGust?: number | null;
	weatherTypeDTO?: { weatherTypePk?: number | null; desc?: string | null; image?: string | null } | null;
	[key: string]: unknown;
}

/** A device model at one firmware version, from `/device-service/deviceservice/app-info/{versionPk}`. */
export interface DeviceAppInfo {
	productDisplayName?: string;
	/** "18.32". */
	versionMajorMinor?: string;
	versionString?: string;
	[key: string]: unknown;
}

export interface AcuteTrainingLoad {
	acwrPercent?: number | null;
	acwrStatus?: string | null;
	acwrStatusFeedback?: string | null;
	dailyTrainingLoadAcute?: number | null;
	dailyTrainingLoadChronic?: number | null;
	dailyAcuteChronicWorkloadRatio?: number | null;
	minTrainingLoadChronic?: number | null;
	maxTrainingLoadChronic?: number | null;
	[key: string]: unknown;
}

/**
 * Training status, load and the acute/chronic ratio.
 *
 * The per-device sub-objects are keyed by device id, which is why the mapper
 * takes whichever entry it finds rather than naming one: an account with a
 * watch and a bike computer has two, and neither key is knowable in advance.
 *
 * The status map sits under `mostRecentTrainingStatus`, and the acute load
 * inside each device entry. The top-level spellings are what this type used to
 * say — no note ever got a training property from them — and are still read as
 * a fallback in case some accounts do send them flat.
 */
export interface TrainingStatus {
	mostRecentTrainingStatus?: {
		latestTrainingStatusData?: Record<string, Record<string, unknown>> | null;
		[key: string]: unknown;
	} | null;
	latestTrainingStatusData?: Record<string, Record<string, unknown>> | null;
	mostRecentTrainingLoadBalance?: {
		metricsTrainingLoadBalanceDTOMap?: Record<string, Record<string, unknown>> | null;
		[key: string]: unknown;
	} | null;
	/** Same shape as a `maxMetrics` row: the latest VO2 Max and acclimation. */
	mostRecentVO2Max?: MaxMetrics | null;
	acuteTrainingLoadDTO?: AcuteTrainingLoad | null;
	[key: string]: unknown;
}

/** One day of scale readings. Masses are grams; `bodyFat` and `bodyWater` are percentages. */
export interface BodyCompositionEntry {
	calendarDate?: string;
	weight?: number | null;
	bmi?: number | null;
	bodyFat?: number | null;
	bodyWater?: number | null;
	boneMass?: number | null;
	muscleMass?: number | null;
	[key: string]: unknown;
}

export interface BodyComposition {
	dateWeightList?: BodyCompositionEntry[] | null;
	/** Garmin's own average for the day, which is what a multi-weigh-in day should read as. */
	totalAverage?: BodyCompositionEntry | null;
	[key: string]: unknown;
}

/** One daily Health Status verdict — HRV, HR, SpO2, respiration, skin temperature. */
export interface HealthStatusMetric {
	type?: string | null;
	value?: number | null;
	status?: string | null;
	baselineLowerLimit?: number | null;
	baselineUpperLimit?: number | null;
	percentage?: number | null;
	feedbackKey?: string | null;
	[key: string]: unknown;
}

export interface HealthStatus {
	calendarDate?: string;
	outliersCount?: number | null;
	metrics?: HealthStatusMetric[] | null;
	[key: string]: unknown;
}

/** A two-minute Health Snapshot session, with min/avg/max per measurement. */
export interface HealthSnapshot {
	calendarDate?: string;
	startTimestampGMT?: string | null;
	endTimestampGMT?: string | null;
	startTimestampLocal?: string | null;
	summaryTypeDataList?: Array<{
		summaryType?: string | null;
		minValue?: number | null;
		maxValue?: number | null;
		avgValue?: number | null;
	}> | null;
	[key: string]: unknown;
}

export interface HillScore {
	calendarDate?: string;
	overallScore?: number | null;
	strengthScore?: number | null;
	enduranceScore?: number | null;
	hillScoreClassificationId?: number | null;
	hillScoreFeedbackPhraseId?: number | null;
	primaryTrainingDevice?: boolean;
	[key: string]: unknown;
}

/** A row of `runningTolerance`, in metres whatever the account's units. */
export interface RunningTolerance {
	userProfilePK?: number;
	/** The day (daily); the week's `endOfWeek` (weekly). */
	calendarDate?: string;
	/* Daily aggregation. */
	/** Garmin's weighted sum of recent runs' impact load; it decays on rest days. */
	acuteImpactLoad?: number | null;
	/** The run distance of the 7 days ending the day. */
	acuteDistance?: number | null;
	/** The weekly tolerance on the day; it changes on some days, not only Sundays. */
	acuteTolerance?: number | null;
	/** A key: "MEDIUM_LOAD", "LOW_LOAD_1DAYS", "ABOVE_TOLERANCE" … */
	runningToleranceFeedBackPhrase?: string | null;
	/*
	 * Weekly aggregation: Sunday weeks for this account (its first day of
	 * week); startOfWeek/endOfWeek = the first and last days with a daily row
	 * inside the week and the window; calendarDate = endOfWeek;
	 * totalImpactLoad/totalDistance (metres) and tolerance = the week to date at
	 * endOfWeek, so a cut first row still holds its whole week; weekIndex =
	 * weeks since Sun 1989-12-31.
	 */
	totalImpactLoad?: number | null;
	totalDistance?: number | null;
	tolerance?: number | null;
	startOfWeek?: string;
	endOfWeek?: string;
	weekIndex?: number | null;
	[key: string]: unknown;
}

/* Performance Stats pages. */

/**
 * One day, week or month of `enduranceStats`, keyed in `groupMap` by its first
 * day. A day's average and max are its score; null without one.
 */
export interface EnduranceGroup {
	groupAverage?: number | null;
	groupMax?: number | null;
	/** The period's contributors, `contribution` in percent; empty for a day without data. */
	enduranceContributorDTOList?: EnduranceContributor[] | null;
}

export interface EnduranceStats {
	startDate?: string;
	endDate?: string;
	/** The floored mean of the groups' averages. */
	avg?: number | null;
	/** The highest day. */
	max?: number | null;
	groupMap?: Record<string, EnduranceGroup> | null;
	/** The newest scored day on or before `endDate`, with its class limits and contributors; null when there is none. */
	enduranceScoreDTO?: EnduranceScore | null;
	[key: string]: unknown;
}

/**
 * A biometric's history, as Garmin keeps it: a row for each day it changed —
 * lactate threshold heart rate (bpm) or speed (tenths of m/s, like the latest
 * value), or FTP (W).
 */
export interface BiometricChange {
	from?: string;
	until?: string;
	series?: string;
	value?: number | null;
	updatedDate?: string;
	[key: string]: unknown;
}

/**
 * One device's training status on one day, in every training status route.
 * `trainingStatus` is a code the feedback phrase spells out (`MAINTAINING_2`),
 * one to one with the phrase's prefix; seen so far: 0 no status, 1 detraining,
 * 2 unproductive, 3 overreaching, 4 maintaining, 5 recovery, 6 peaking,
 * 7 productive, 8 strained. The acute load DTO carries the acute and chronic
 * load and their ratio.
 */
export interface TrainingStatusEntry {
	calendarDate?: string;
	/** The day the status began; null on history rows. */
	sinceDate?: string | null;
	trainingStatus?: number | null;
	trainingStatusFeedbackPhrase?: string | null;
	trainingPaused?: boolean | null;
	/** Epoch ms. */
	timestamp?: number | null;
	deviceId?: number;
	primaryTrainingDevice?: boolean;
	sport?: string | null;
	acuteTrainingLoadDTO?: AcuteTrainingLoad | null;
	[key: string]: unknown;
}

/** A device the training status routes hold readings from. */
export interface RecordedDevice {
	deviceId?: number;
	deviceName?: string | null;
	imageURL?: string | null;
	[key: string]: unknown;
}

/** `trainingstatus/daily/{date}`: each device's status that day, keyed by device id. */
export interface TrainingStatusDay {
	latestTrainingStatusData?: Record<string, TrainingStatusEntry> | null;
	recordedDevices?: RecordedDevice[] | null;
	lastPrimarySyncDate?: string | null;
	[key: string]: unknown;
}

/** `trainingstatus/weekly` and `/monthly`: each device's rows, oldest first, keyed by device id. */
export interface TrainingStatusHistory {
	fromCalendarDate?: string;
	toCalendarDate?: string;
	reportData?: Record<string, TrainingStatusEntry[]> | null;
	recordedDevices?: RecordedDevice[] | null;
	[key: string]: unknown;
}

/**
 * Load focus on one device: each band's exercise load over the month to the
 * day, and its optimal range. The phrase is the copy key
 * (`AEROBIC_LOW_SHORTAGE`).
 */
export interface TrainingLoadBalanceEntry {
	calendarDate?: string;
	deviceId?: number;
	primaryTrainingDevice?: boolean;
	monthlyLoadAerobicLow?: number | null;
	monthlyLoadAerobicHigh?: number | null;
	monthlyLoadAnaerobic?: number | null;
	monthlyLoadAerobicLowTargetMin?: number | null;
	monthlyLoadAerobicLowTargetMax?: number | null;
	monthlyLoadAerobicHighTargetMin?: number | null;
	monthlyLoadAerobicHighTargetMax?: number | null;
	monthlyLoadAnaerobicTargetMin?: number | null;
	monthlyLoadAnaerobicTargetMax?: number | null;
	trainingBalanceFeedbackPhrase?: string | null;
	[key: string]: unknown;
}

/** `trainingloadbalance/latest/{date}`, keyed by device id. */
export interface TrainingLoadBalance {
	metricsTrainingLoadBalanceDTOMap?: Record<string, TrainingLoadBalanceEntry> | null;
	recordedDevices?: RecordedDevice[] | null;
	[key: string]: unknown;
}

/**
 * Running economy, lower is better: a day (`calendarDate`) or a week
 * (`startDate` to `endDate`). The ranges send every day or week of the span,
 * `score` and `classification` null where there is none.
 */
export interface RunningEconomyScore {
	calendarDate?: string;
	startDate?: string;
	endDate?: string;
	score?: number | null;
	/** `INTERMEDIATE`, `TRAINED`… */
	classification?: string | null;
	[key: string]: unknown;
}

/** The best average power held for `duration` seconds, and the ride it came from. */
export interface PowerCurvePoint {
	duration?: number;
	/** Watts; null, with no ride, for a duration no ride lasted. */
	power?: number | null;
	activityId?: number | null;
	activityDate?: string | null;
	[key: string]: unknown;
}

/** A cycling power curve: 15 durations from 1 s to 5 h. The all-time form has null dates. */
export interface PowerCurve {
	startDate?: string | null;
	/** As asked: the day after the span. */
	endDate?: string | null;
	entries?: PowerCurvePoint[] | null;
	[key: string]: unknown;
}

/** Critical swim speed over a span. No results on the recording account, so both lists' rows are unconfirmed. */
export interface CriticalSwimSpeedRange {
	from?: string;
	until?: string;
	criticalSwimSpeedDTOList?: Array<Record<string, unknown>> | null;
	aggregatedResults?: Array<Record<string, unknown>> | null;
	[key: string]: unknown;
}

/**
 * Hill score over a span of up to 401 days: the floored mean of the scored
 * days per period, keyed by the period's first day (one key, the first row's
 * day, with daily aggregation; each Monday week's Monday with weekly, even
 * before the span's start; each month's 1st with monthly), counting only the
 * span's days; the span's best day; and the days themselves, newest first.
 */
export interface HillScoreStats {
	startDate?: string;
	endDate?: string;
	/** Null for a period without a score. */
	periodAvgScore?: Record<string, number | null> | null;
	maxScore?: number | null;
	/** The days with daily and weekly aggregation; null with monthly, `[]` before the history. */
	hillScoreDTOList?: HillScore[] | null;
	[key: string]: unknown;
}

/**
 * One Training Readiness reading, from `trainingreadiness/{date}` or the
 * range route. A day has 1–11 (`inputContext`): on waking, after an activity,
 * and through the day. Times are wall-clock strings without a zone, GMT and
 * the watch's clock, whose date is always `calendarDate`; the difference
 * between them moves when the watch travels (2026-01-28 went from +4 to +3
 * mid-day), so `timestamp` orders a day's readings. Every reading of the
 * recording account's history (1,111) carries all 29 keys.
 *
 * Each of the six factors comes as a percent and Garmin's band of it
 * (`…FactorFeedback`): `VERY_GOOD`, `GOOD`, `MODERATE`, `POOR`, or `NONE`
 * (percent 0) without the data.
 */
export interface TrainingReadinessReading {
	userProfilePK?: number | null;
	/** The local calendar day, `YYYY-MM-DD`. */
	calendarDate?: string;
	/** GMT: "2026-10-11T05:41:11.0". */
	timestamp?: string | null;
	/** The watch's clock: "2026-10-11T09:41:11.0", the page's "Updated @ 9:41 AM". */
	timestampLocal?: string | null;
	deviceId?: number | null;
	/** 1–100; null while onboarding (the first four days, `level` NONE). */
	score?: number | null;
	/** `POOR` 1–24, `LOW` 25–49, `MODERATE` 50–74, `HIGH` 75–94, `PRIME` 95–100; `NONE` while onboarding. */
	level?: string | null;
	/** The title's key: `LET_YOUR_BODY_RECOVER`; `UNKNOWN` while onboarding and on a few readings without sleep. */
	feedbackShort?: string | null;
	/** The copy's key: `POOR_RT_HIGH_SS_GOOD_OR_MOD`. */
	feedbackLong?: string | null;
	/** Last night's score; null exactly when `validSleep` is false. */
	sleepScore?: number | null;
	sleepScoreFactorPercent?: number | null;
	sleepScoreFactorFeedback?: string | null;
	/** Minutes, 0 … 5,760. */
	recoveryTime?: number | null;
	recoveryTimeFactorPercent?: number | null;
	recoveryTimeFactorFeedback?: string | null;
	/** The acute:chronic load factor. */
	acwrFactorPercent?: number | null;
	acwrFactorFeedback?: string | null;
	/** The reading's own acute load; it can lag the day's Training Status row (Oct 10 07:24: 63, the row 281). */
	acuteLoad?: number | null;
	stressHistoryFactorPercent?: number | null;
	stressHistoryFactorFeedback?: string | null;
	hrvFactorPercent?: number | null;
	hrvFactorFeedback?: string | null;
	/** ms: the HRV Status row's `weeklyAvg` on most readings. */
	hrvWeeklyAverage?: number | null;
	sleepHistoryFactorPercent?: number | null;
	sleepHistoryFactorFeedback?: string | null;
	/** False when the watch saw no sleep for the reading (an overnight reading before waking). */
	validSleep?: boolean | null;
	/** `AFTER_WAKEUP_RESET`, `AFTER_POST_EXERCISE_RESET` or `UPDATE_REALTIME_VARIABLES`. */
	inputContext?: string | null;
	/** From the Preferred Activity Tracker, the one Garmin Connect shows: true on every reading seen. */
	primaryActivityTracker?: boolean | null;
	/** Why recovery moved: `NO_CHANGE_SLEEP`, `REACHED_ZERO`, `NEW_EXERCISE`…, or null. Not shown. */
	recoveryTimeChangePhrase?: string | null;
	[key: string]: unknown;
}

/* Health Stats pages. Range rows leave out days (and weeks) without data
   rather than zero-filling them, and arrive oldest first. */

/**
 * One row of a `stats/<metric>/daily` range: stress, Body Battery, heart rate
 * and fitness age. The weekly heart rate and fitness age ranges send the same
 * shape a week a row, dated by the week's first day.
 */
export interface DailyStatRow {
	calendarDate: string;
	values: Record<string, number | string | null>;
}

/** One week of the weekly stress range, dated by the week's first day. */
export interface WeeklyStatRow {
	calendarDate: string;
	value: number | null;
}

/** One day of `/usersummary-service/stats/respiration/daily`: breaths a minute, flat rather than under `values`. */
export interface RespirationStatRow {
	calendarDate: string;
	avgWakingRespiration: number | null;
	avgSleepRespiration: number | null;
}

/** One sport's heart rate zones: each zone's floor in bpm, and what they were worked out from. */
export interface HeartRateZones {
	/** `DEFAULT`, `CYCLING`, … */
	sport?: string | null;
	/** `HR_MAX`, `HRR` or `LTHR`. */
	trainingMethod?: string | null;
	zone1Floor?: number | null;
	zone2Floor?: number | null;
	zone3Floor?: number | null;
	zone4Floor?: number | null;
	zone5Floor?: number | null;
	maxHeartRateUsed?: number | null;
	restingHeartRateUsed?: number | null;
	lactateThresholdHeartRateUsed?: number | null;
	[key: string]: unknown;
}

/**
 * A day's breathing rate. `respirationValuesArray` rows are `[GMT epoch ms,
 * breaths/min]` every two minutes, with -1 and -2 for no reading; the averages
 * array is hourly `[ms, average, high, low]` per its descriptor list.
 */
export interface RespirationDay {
	calendarDate?: string;
	sleepStartTimestampGMT?: string | null;
	sleepEndTimestampGMT?: string | null;
	lowestRespirationValue?: number | null;
	highestRespirationValue?: number | null;
	avgWakingRespirationValue?: number | null;
	avgSleepRespirationValue?: number | null;
	respirationValueDescriptorsDTOList?: ValueDescriptor[] | null;
	respirationValuesArray?: Array<Array<number | null>> | null;
	respirationAveragesValueDescriptorDTOList?: Array<Record<string, unknown>> | null;
	respirationAveragesValuesArray?: Array<Array<number | null>> | null;
	[key: string]: unknown;
}

/** One night of `/hrv-service/hrv/daily`, in milliseconds, with the baseline band its status is judged against. */
export interface HrvSummary {
	calendarDate?: string;
	weeklyAvg?: number | null;
	lastNightAvg?: number | null;
	lastNight5MinHigh?: number | null;
	baseline?: {
		lowUpper?: number | null;
		balancedLow?: number | null;
		balancedUpper?: number | null;
		markerValue?: number | null;
		[key: string]: unknown;
	} | null;
	/** `BALANCED`, `UNBALANCED`, `LOW` or `NONE`. */
	status?: string | null;
	feedbackPhrase?: string | null;
	[key: string]: unknown;
}

export interface HrvRange {
	hrvSummaries?: HrvSummary[] | null;
	[key: string]: unknown;
}

/**
 * One weigh-in. Grams; `date` is the local wall clock written as epoch ms,
 * `timestampGMT` the real instant, so they differ by the zone offset of the
 * moment it was taken.
 */
export interface WeighIn {
	samplePk?: number;
	calendarDate?: string;
	date?: number | null;
	timestampGMT?: number | null;
	weight?: number | null;
	bmi?: number | null;
	bodyFat?: number | null;
	bodyWater?: number | null;
	boneMass?: number | null;
	muscleMass?: number | null;
	sourceType?: string | null;
	weightDelta?: number | null;
	[key: string]: unknown;
}

/** An average over a span of weigh-ins; `from` and `until` are epoch ms. */
export interface WeightAverage {
	from?: number | null;
	until?: number | null;
	weight?: number | null;
	bmi?: number | null;
	bodyFat?: number | null;
	bodyWater?: number | null;
	boneMass?: number | null;
	muscleMass?: number | null;
	[key: string]: unknown;
}

/** `/weight-service/weight/range`: a summary per day that has a weigh-in, newest first. */
export interface WeighInRange {
	dailyWeightSummaries?: Array<{
		summaryDate?: string;
		numOfWeightEntries?: number | null;
		minWeight?: number | null;
		maxWeight?: number | null;
		latestWeight?: WeighIn | null;
		/** Every weigh-in that day, with `includeAll=true`. */
		allWeightMetrics?: WeighIn[] | null;
		[key: string]: unknown;
	}> | null;
	totalAverage?: WeightAverage | null;
	previousDateWeight?: WeighIn | null;
	nextDateWeight?: WeighIn | null;
	[key: string]: unknown;
}

/** `/weight-service/weight/weeklyRange`: a summary per week that has a weigh-in, newest first. */
export interface WeightWeeks {
	weeklyWeightSummaries?: Array<{
		startDate?: string;
		endDate?: string;
		minWeight?: number | null;
		maxWeight?: number | null;
		averageWeight?: WeightAverage | null;
		weightDelta?: number | null;
		[key: string]: unknown;
	}> | null;
	weightAverageDTO?: WeightAverage | null;
	previousWeekAverageDTO?: WeightAverage | null;
	nextWeekAverageDTO?: WeightAverage | null;
	[key: string]: unknown;
}

/** Weight goals in effect over a span. Empty on an account without one, so the goal shape is unconfirmed. */
export interface WeightGoal {
	userGoals?: Array<Record<string, unknown>> | null;
	userGoalRanges?: unknown;
	[key: string]: unknown;
}

/** A Health Snapshot as the REST routes send it: the GraphQL fields, plus its id, zones and device. */
export interface HealthSnapshotSummary extends HealthSnapshot {
	/** An object here, a bare string in the epochs payload. */
	activityUuid?: { uuid?: string } | null;
	activityName?: string | null;
	wellnessActivityType?: string | null;
	endTimestampLocal?: string | null;
	timeInZoneList?: Array<{
		zoneNumber?: number | null;
		millisInZone?: number | null;
		zoneLowBoundary?: number | null;
		[key: string]: unknown;
	}> | null;
	deviceMetaData?: Record<string, unknown> | null;
}

/**
 * A Health Snapshot's samples, one a second: rows per `epochDescriptorDTOList`
 * (`timestamp` in GMT epoch ms, `heartRate`, `stress`, `spo2`, `respiration`).
 */
export interface HealthSnapshotEpochs {
	activityUuid?: string | null;
	epochDescriptorDTOList?: ValueDescriptor[] | null;
	epochArray?: Array<Array<number | null>> | null;
	[key: string]: unknown;
}

/**
 * A day's Pulse Ox with the altitude it was taken at. Hourly averages are
 * `[GMT epoch ms, spo2Level, monitoringEnvironmentLevel]`, the elevation series
 * `[ms, monitoringEnvironmentLevel]`, each per its own descriptor list. Every
 * SpO₂ field is null on a day without readings, while the elevation stays.
 */
export interface Spo2Acclimation {
	calendarDate?: string;
	averageSpO2?: number | null;
	lowestSpO2?: number | null;
	latestSpO2?: number | null;
	lastSevenDaysAvgSpO2?: number | null;
	avgSleepSpO2?: number | null;
	spO2SingleValuesDescriptorList?: Array<Record<string, unknown>> | null;
	spO2SingleValues?: Array<Array<number | boolean | null>> | null;
	spO2HourlyAveragesDescriptorList?: Array<Record<string, unknown>> | null;
	spO2HourlyAverages?: Array<Array<number | null>> | null;
	monitoringEnvironmentValuesDescriptorList?: Array<Record<string, unknown>> | null;
	monitoringEnvironmentValues?: Array<Array<number | null>> | null;
	[key: string]: unknown;
}

/**
 * Pulse Ox acclimation over a span. `spo2DailyAverageArray` rows are
 * `[calendarDate, average]`; the hourly and elevation arrays are `[ms, value]`.
 */
export interface AcclimationStats {
	overallSpo2Average?: number | null;
	spo2DailyAverageArray?: Array<Array<string | number | null>> | null;
	spo2HourlyAverageArray?: Array<Array<number | null>> | null;
	spo2SingleReadingValuesArray?: Array<Array<number | boolean | null>> | null;
	monitoringEnvironmentValuesArray?: Array<Array<number | null>> | null;
	[key: string]: unknown;
}

/** Blood pressure readings for one day. None on the account these were captured from, so the reading shape is unconfirmed. */
export interface BloodPressureDay {
	startDate?: string;
	endDate?: string;
	bloodPressureMeasurements?: Array<Record<string, unknown>> | null;
	totalMeasurementCount?: number | null;
	elevatedMeasurementCount?: number | null;
	[key: string]: unknown;
}

/** Blood pressure over a span, by day or by week. Summary shape unconfirmed, as for `BloodPressureDay`. */
export interface BloodPressureRange {
	from?: string;
	until?: string;
	measurementSummaries?: Array<Record<string, unknown>> | null;
	categoryStats?: Record<string, unknown> | null;
	[key: string]: unknown;
}

/** A nap. Seconds; GMT times; the offsets are the zone's, in minutes. */
export interface Nap {
	calendarDate?: string;
	napTimeSec?: number | null;
	napStartTimestampGMT?: string | null;
	napEndTimestampGMT?: string | null;
	napStartTimeOffset?: number | null;
	napEndTimeOffset?: number | null;
	napFeedback?: string | null;
	napSource?: number | null;
	[key: string]: unknown;
}

/** A Move IQ event: a stretch of walking, running or the like that was never recorded as an activity. Minutes. */
export interface DailyEvent {
	calendarDate?: string;
	startTimestampGMT?: string | null;
	endTimestampGMT?: string | null;
	startTimestampLocal?: string | null;
	endTimestampLocal?: string | null;
	duration?: number | null;
	activityType?: string | null;
	activitySubType?: string | null;
	moderateIntensityMinutes?: number | null;
	vigorousIntensityMinutes?: number | null;
	[key: string]: unknown;
}

/** Lifestyle Logging for one day: the behaviours being tracked, and the week's completion. */
export interface LifestyleLog {
	calendarDate?: string;
	dailyLogsReport?: Array<{
		behaviourId?: number;
		name?: string | null;
		/** `LIFESTYLE`, `SELF_CARE`, `SLEEP_RELATED`… */
		category?: string | null;
		/** `QUANTITY` (with `details` to pick from) or `NONE`. */
		measurementType?: string | null;
		sleepRelated?: boolean | null;
		details?: Array<{ subTypeId?: number; subTypeName?: string | null; [key: string]: unknown }> | null;
		[key: string]: unknown;
	}> | null;
	/** The seven days ending on the date. */
	completionStats?: Array<{
		calendarDate?: string;
		totalTracking?: number | null;
		completedTracking?: number | null;
		[key: string]: unknown;
	}> | null;
	[key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date, which is what Garmin's day-scoped endpoints mean. */
export function toIsoDate(date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Garmin answers a malformed date with an opaque 400, so catch it here. */
export function assertIsoDate(value: string, label = "date"): string {
	if (!ISO_DATE.test(value)) {
		throw new TypeError(`${label} must be YYYY-MM-DD, got "${value}"`);
	}
	return value;
}

/** A count that goes into the URL, such as a number of weeks or a page size. */
function assertCount(value: number, label: string): number {
	if (!Number.isInteger(value) || value < 1) {
		throw new TypeError(`${label} must be a positive integer, got ${value}`);
	}
	return value;
}

/** An id from a Garmin response, encoded so a corrupt one cannot add path segments. */
function pathId(value: string, label: string): string {
	if (!value) throw new TypeError(`${label} must not be empty`);
	return encodeURIComponent(value);
}

/** An activity id: a positive integer, so it can only ever be digits in a URL. */
function assertActivityId(id: number): number {
	if (!Number.isSafeInteger(id) || id < 1) {
		throw new TypeError(`activityId must be a positive integer, got ${id}`);
	}
	return id;
}

/** A profile id from Garmin's profile: a positive integer, or it never reaches a URL. */
function isProfilePk(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

/**
 * Typed endpoint wrappers. Extends the client so callers hold one object while
 * auth and endpoints stay in separate files.
 */
export class GarminApi extends GarminClient {
	private displayName: string | null = null;
	private fullName: string | null = null;
	private lastProfile: SocialProfile | null = null;

	/** Signing in as someone else must not inherit the previous account's URLs. */
	async login(email: string, password: string, opts: LoginOptions = {}): Promise<void> {
		await super.login(email, password, opts);
		this.displayName = null;
		this.fullName = null;
		this.lastProfile = null;
	}

	/** Cleared alongside the session so a second account cannot inherit the first's URLs. */
	async logout(): Promise<void> {
		this.displayName = null;
		this.fullName = null;
		this.lastProfile = null;
		await super.logout();
	}

	async socialProfile(): Promise<SocialProfile> {
		const profile = await this.request<SocialProfile>("/userprofile-service/socialProfile");
		if (typeof profile?.displayName === "string" && profile.displayName.trim()) {
			this.displayName = profile.displayName;
		}
		if (typeof profile?.fullName === "string") this.fullName = profile.fullName;
		if (profile && typeof profile === "object") this.lastProfile = profile;
		return profile;
	}

	/** The account's full name, once a profile has been fetched. */
	get name(): string | null {
		return this.fullName;
	}

	/** The profile as last fetched this session, or null before the first call. */
	get profile(): SocialProfile | null {
		return this.lastProfile;
	}

	/**
	 * Most wellness URLs interpolate the display name into the path. Encoding it
	 * keeps a hostile or corrupted profile response from injecting path segments.
	 */
	async requireDisplayName(): Promise<string> {
		if (!this.displayName) await this.socialProfile();
		if (!this.displayName) {
			throw new GarminApiError("Garmin profile has no display name", 200, "");
		}
		return encodeURIComponent(this.displayName);
	}

	/**
	 * The account's numeric id, `profileId` in the profile and `userProfilePk`
	 * to the few routes keyed by it. It arrives with the display name, so it
	 * costs a request only when no profile has been fetched this session.
	 */
	async requireProfilePk(): Promise<number> {
		if (!isProfilePk(this.lastProfile?.profileId)) await this.socialProfile();
		const pk = this.lastProfile?.profileId;
		if (!isProfilePk(pk)) {
			throw new GarminApiError("Garmin profile has no profile id", 200, "");
		}
		return pk;
	}

	async userSettings(): Promise<Record<string, unknown>> {
		return this.request("/userprofile-service/userprofile/user-settings");
	}

	async dailySummary(date: string): Promise<DailySummary> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		const summary = await this.request<DailySummary>(
			`/usersummary-service/usersummary/daily/${who}`,
			{ query: { calendarDate: date } },
		);
		if (summary?.privacyProtected === true) {
			throw new GarminAuthError(
				"Garmin returned a privacy-protected summary — the session is not fully authorised",
			);
		}
		return summary;
	}

	async sleep(date: string): Promise<SleepData> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		return this.request(`/wellness-service/wellness/dailySleepData/${who}`, {
			query: { date, nonSleepBufferMinutes: "60" },
		});
	}

	async heartRate(date: string): Promise<HeartRateData> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		return this.request(`/wellness-service/wellness/dailyHeartRate/${who}`, {
			query: { date },
		});
	}

	/** Intraday stress *and* Body Battery — one request serves both charts. */
	async stress(date: string): Promise<DailyStress | null> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/dailyStress/${date}`);
	}

	/** The day's steps in 15-minute buckets. */
	async stepsChart(date: string): Promise<StepsChartEntry[]> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		const data = await this.request<StepsChartEntry[] | null>(
			`/wellness-service/wellness/dailySummaryChart/${who}`,
			{ query: { date } },
		);
		return data ?? [];
	}

	/** The day's floors climbed and descended in 15-minute buckets. */
	async floorsChart(date: string): Promise<FloorsChart | null> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/floorsChartData/daily/${date}`);
	}

	/** The day's intensity minutes in 15-minute buckets, and the week's total around it. */
	async intensityMinutesChart(date: string): Promise<IntensityChart | null> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/daily/im/${date}`);
	}

	/* Daily totals over a window, as the Steps, Floors and Intensity Minutes
	   pages read them. Garmin answers 400 past 28 days. */

	async dailyStepStats(start: string, end: string): Promise<DailyStepStat[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyStepStat[] | null>(`/usersummary-service/stats/steps/daily/${start}/${end}`)) ?? [];
	}

	async dailyFloorStats(start: string, end: string): Promise<DailyFloorStat[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyFloorStat[] | null>(`/usersummary-service/stats/floors/daily/${start}/${end}`)) ?? [];
	}

	async dailyIntensityStats(start: string, end: string): Promise<DailyIntensityStat[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyIntensityStat[] | null>(`/usersummary-service/stats/im/daily/${start}/${end}`)) ?? [];
	}

	/** A night a day over a window, as the Sleep pages' 7d, 4w and 1y read them. Also 28 days at most. */
	async sleepStats(start: string, end: string): Promise<SleepStatsDay[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.request<SleepStats | null>(`/sleep-service/stats/sleep/daily/${start}/${end}`);
		return Array.isArray(data?.individualStats) ? data.individualStats : [];
	}

	/** What charged and drained Body Battery that day: sleep, workouts, stress. */
	async bodyBatteryEvents(date: string): Promise<BodyBatteryEvent[]> {
		assertIsoDate(date);
		const data = await this.request<BodyBatteryEvent[] | null>(
			`/wellness-service/wellness/bodyBattery/events/${date}`,
		);
		return data ?? [];
	}

	/** Fitness age, chronological age and the factors behind the gap. */
	async fitnessAge(date: string): Promise<FitnessAge | null> {
		assertIsoDate(date);
		return this.request(`/fitnessage-service/fitnessage/${date}`);
	}

	async bodyBattery(startDate: string, endDate = startDate): Promise<unknown[]> {
		assertIsoDate(startDate, "startDate");
		assertIsoDate(endDate, "endDate");
		return this.request("/wellness-service/wellness/bodyBattery/reports/daily", {
			query: { startDate, endDate },
		});
	}

	async hrv(date: string): Promise<Record<string, unknown> | null> {
		assertIsoDate(date);
		return this.request(`/hrv-service/hrv/${date}`);
	}

	async restingHeartRate(date: string): Promise<Record<string, unknown>> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		return this.request(`/userstats-service/wellness/daily/${who}`, {
			query: { fromDate: date, untilDate: date, metricId: "60" },
		});
	}

	/**
	 * Every Training Readiness reading of the day, newest first (1–11); [] for
	 * a day without one: a missed day, today before the watch syncs, the
	 * future. The range route's rows for the day, field for field.
	 */
	async trainingReadiness(date: string): Promise<TrainingReadinessReading[]> {
		assertIsoDate(date);
		return (await this.request<TrainingReadinessReading[] | null>(`/metrics-service/metrics/trainingreadiness/${date}`)) ?? [];
	}

	/**
	 * VO2 Max and fitness age across a range — one request for the whole window,
	 * not one per day, because the endpoint takes the range in its path.
	 */
	async maxMetrics(start: string, end = start): Promise<MaxMetrics[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.request<MaxMetrics[] | null>(
			`/metrics-service/metrics/maxmet/daily/${start}/${end}`,
		);
		return data ?? [];
	}

	/**
	 * Predicted 5K / 10K / half / marathon times across a range, also one
	 * request. A calendar year at most (end ≤ start + 1 year; 365-day chunks
	 * are safe). When the window holds any prediction, every day comes back,
	 * with null times where there is none (future days too); a window with
	 * none returns [].
	 */
	async racePredictions(start: string, end = start): Promise<RacePrediction[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const who = await this.requireDisplayName();
		const data = await this.request<RacePrediction[] | null>(
			`/metrics-service/metrics/racepredictions/daily/${who}`,
			{ query: { fromCalendarDate: start, toCalendarDate: end } },
		);
		return data ?? [];
	}

	/**
	 * Endurance score for one day: the score, its class and feedback phrase,
	 * the dial's ends and class limits, and the day's contributors. Null (HTTP
	 * 204) for a day without one: today until the watch syncs, and before the
	 * history. For many days, `enduranceStats(…, "daily")` sends a row a day.
	 */
	async enduranceScore(date: string): Promise<EnduranceScore | null> {
		assertIsoDate(date);
		return this.request("/metrics-service/metrics/endurancescore", {
			query: { calendarDate: date },
		});
	}

	/**
	 * Training status, weekly load and the acute-to-chronic ratio for one day.
	 *
	 * Garmin returns `{}` rather than 404 for a day it has nothing for, so an
	 * empty object here is "no data", not an error.
	 */
	async trainingStatus(date: string): Promise<TrainingStatus | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/trainingstatus/aggregated/${date}`);
	}

	/**
	 * Scale readings for one day: weight, BMI, body fat and the rest.
	 *
	 * `includeAll` keeps every weigh-in rather than only the first, which is what
	 * makes `totalAverage` meaningful on a day you stepped on twice.
	 */
	async bodyComposition(date: string): Promise<BodyComposition | null> {
		assertIsoDate(date);
		return this.request(`/weight-service/weight/dayview/${date}`, {
			query: { includeAll: "true" },
		});
	}

	/**
	 * Garmin's GraphQL gateway — the same one the web app uses. Several metrics
	 * have no REST route at all (Health Status, Health Snapshots, cycling
	 * ability), so this is the only way to them. Queries are sent inline, as the
	 * web app sends them; `data` is unwrapped, and GraphQL errors throw.
	 */
	async graphql<T>(query: string): Promise<T> {
		const res = await this.request<{ data?: T; errors?: Array<{ message?: string }> } | null>(
			"/graphql-gateway/graphql",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
			},
		);
		if (res?.errors?.length) {
			throw new GarminApiError(`GraphQL: ${res.errors.map((e) => e.message).join("; ")}`, 200, "");
		}
		return (res?.data ?? {}) as T;
	}

	/** Health Status for one day. */
	async healthStatus(date: string): Promise<HealthStatus | null> {
		assertIsoDate(date);
		const data = await this.graphql<{ healthStatusSummary?: HealthStatus | null }>(
			`query { healthStatusSummary(calendarDate:"${date}") { calendarDate outliersCount ` +
				"metrics { value baselineUpperLimit baselineLowerLimit status percentage feedbackKey type } } }",
		);
		return data.healthStatusSummary ?? null;
	}

	async healthSnapshots(start: string, end = start): Promise<HealthSnapshot[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.graphql<{ healthSnapshotScalar?: HealthSnapshot[] | null }>(
			`query{healthSnapshotScalar(startDate:"${start}", endDate:"${end}")}`,
		);
		return data.healthSnapshotScalar ?? [];
	}

	/**
	 * Daily hill scores across a range, up to 401 days (402 is HTTP 400): the
	 * gateway proxies `hillScoreStats`. `aggregation` shapes only the averages,
	 * not the list.
	 */
	async hillScores(start: string, end = start): Promise<HillScore[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.graphql<{ hillScoreScalar?: { hillScoreDTOList?: HillScore[] | null } | null }>(
			`query{hillScoreScalar(startDate:"${start}", endDate:"${end}", aggregation:"weekly")}`,
		);
		return data.hillScoreScalar?.hillScoreDTOList ?? [];
	}

	/**
	 * Running tolerance across a range. Both aggregations cap at 366 days
	 * (367 is HTTP 400; daily across Feb 29 too).
	 *
	 * - `daily`: one row per day with data, in no date order; days without
	 *   one are omitted; `[]` before the history (2025-08-17 here).
	 * - `weekly`: sorted Sunday weeks (the account's), weeks without runs
	 *   zero-filled, weeks without a daily row in the window left out; each
	 *   the week to date at its `endOfWeek` (see `RunningTolerance`).
	 *
	 * `aggregation=monthly` exists but returns each month's last day's
	 * week-to-date record, not month totals, so it is not offered.
	 */
	async runningTolerance(start: string, end = start, aggregation: "daily" | "weekly" = "daily"): Promise<RunningTolerance[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.request<RunningTolerance[] | null>(
			"/metrics-service/metrics/runningtolerance/stats",
			{ query: { startDate: start, endDate: end, aggregation } },
		);
		return data ?? [];
	}

	/**
	 * Endurance score over a range, 401 days a call at most (402 is HTTP 400)
	 * for every aggregation. `groupMap` is keyed by each period's first day:
	 * `daily` has a key for every calendar day of the window (that day's score
	 * as `groupAverage` and `groupMax`, its contributors; null and an empty list
	 * without data), `weekly` one per Monday week touching the window (keyed by
	 * its Monday even before the start; the account's week start is ignored),
	 * `monthly` one per calendar month. A week's or month's average is the
	 * floored mean of the window's scored days in it, its max their highest, its
	 * contributions the mean of the daily shares. `avg` is the floored mean of
	 * the groups' averages, `max` the highest day, and `enduranceScoreDTO` the
	 * newest scored day on or before `end`. The endurance-score index walks it
	 * daily; the Endurance Score page works out its weeks and months itself.
	 */
	async enduranceStats(start: string, end: string, aggregation: "daily" | "weekly" | "monthly"): Promise<EnduranceStats | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request("/metrics-service/metrics/endurancescore/stats", {
			query: { startDate: start, endDate: end, aggregation },
		});
	}

	/** Running lactate threshold heart rate over a range, a row per change. */
	async lactateThresholdHeartRateRange(start: string, end: string): Promise<BiometricChange[]> {
		return this.biometricRange("lactateThresholdHeartRate", start, end, "RUNNING");
	}

	/** Running lactate threshold speed over a range, a row per change, in tenths of m/s. */
	async lactateThresholdSpeedRange(start: string, end: string): Promise<BiometricChange[]> {
		return this.biometricRange("lactateThresholdSpeed", start, end, "RUNNING");
	}

	/** FTP over a range for one sport, a row per change. Running's is the lactate threshold power. */
	async functionalThresholdPowerRange(
		start: string,
		end: string,
		sport: "RUNNING" | "CYCLING" | "CROSS_COUNTRY_SKIING",
	): Promise<BiometricChange[]> {
		return this.biometricRange("functionalThresholdPower", start, end, sport);
	}

	private async biometricRange(
		metric: "lactateThresholdHeartRate" | "lactateThresholdSpeed" | "functionalThresholdPower",
		start: string,
		end: string,
		sport: string,
	): Promise<BiometricChange[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const data = await this.request<BiometricChange[] | null>(
			`/biometric-service/stats/${metric}/range/${start}/${end}`,
			{ query: { sport, aggregation: "daily", aggregationStrategy: "LATEST" } },
		);
		return data ?? [];
	}

	/* Performance Stats history, as the web's report pages ask for it (survey
	   2026-10-11). No range cap was seen; each route's catalogue notes give the
	   spans the web asks. */

	/** Each device's training status, acute and chronic load on one day: the Training Status page's Current view. */
	async trainingStatusDaily(date: string): Promise<TrainingStatusDay | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/trainingstatus/daily/${date}`);
	}

	/**
	 * Training status **a day**, whatever the route's name says: a row per day
	 * per device under `reportData`, each with its acute/chronic load and ratio.
	 * The Training Status 4w view, and the 28 days behind Training Readiness's
	 * acute load timeline. No cap: 3660 days return the whole history. Days
	 * without a status are left out; a span with none has `reportData` {}.
	 */
	async trainingStatusWeekly(start: string, end: string): Promise<TrainingStatusHistory | null> {
		return this.trainingStatusRange("weekly", start, end);
	}

	/**
	 * Training status **a week**, whatever the route's name says: a row on every
	 * seventh day counted from `start` (2026-05-01 gives 05-07, 05-14 …), and
	 * one for the newest day. The 6m and 1y views, 24 and 50 rows. Its rows
	 * are the weekly route's on the sampled days; the Training Status page
	 * derives them.
	 */
	async trainingStatusMonthly(start: string, end: string): Promise<TrainingStatusHistory | null> {
		return this.trainingStatusRange("monthly", start, end);
	}

	private async trainingStatusRange(route: "weekly" | "monthly", start: string, end: string): Promise<TrainingStatusHistory | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const who = await this.requireDisplayName();
		return this.request(`/metrics-service/metrics/trainingstatus/${route}/${who}`, {
			query: { fromCalendarDate: start, toCalendarDate: end },
		});
	}

	/**
	 * Load focus as of a day, per device: each band's load over the 28 days
	 * ending on the date (the web's dialog labels one day more, and steps a day
	 * at a time) and its optimal range. A date without its own record — today
	 * before the watch syncs, a future day, any day before the first — sends
	 * the map null, with no fallback to an earlier day. There is no range route.
	 */
	async trainingLoadBalance(date: string): Promise<TrainingLoadBalance | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/trainingloadbalance/latest/${date}`);
	}

	/**
	 * Heat and altitude acclimation as of a day, with the previous reading. A
	 * day without a row of its own gets the newest earlier row, dated its own
	 * day (2026-01-07 → 2026-01-04).
	 */
	async heatAltitudeAcclimation(date: string): Promise<Acclimation | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/heataltitudeacclimation/latest/${date}`);
	}

	/**
	 * Heat and altitude acclimation a day, oldest first: the Heat Acclimation
	 * index and the Training Status 4w charts. No cap: 3660 days return the
	 * whole history. Days without data are left out; today has a row from
	 * about 00:01 local, before the watch syncs.
	 */
	async heatAltitudeAcclimationDaily(start: string, end: string): Promise<Acclimation[]> {
		return this.acclimationRange("daily", start, end);
	}

	/**
	 * The same a week: a row on every seventh day counted from `start`, and one
	 * for the newest day, as `trainingStatusMonthly`. The 6m and 1y charts.
	 */
	async heatAltitudeAcclimationWeekly(start: string, end: string): Promise<Acclimation[]> {
		return this.acclimationRange("weekly", start, end);
	}

	private async acclimationRange(route: "daily" | "weekly", start: string, end: string): Promise<Acclimation[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<Acclimation[] | null>(
			`/metrics-service/metrics/heataltitudeacclimation/${route}/${start}/${end}`,
		)) ?? [];
	}

	/**
	 * The newest VO2 Max as of a day (running's under `generic`, and `cycling`)
	 * with the day's acclimation. `sport` is the VO2 Max report's running or
	 * cycling route; without it, its All route.
	 */
	async maxMetricsLatest(date: string, sport?: "running" | "cycling"): Promise<MaxMetrics | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/maxmet/latest/${date}`, sport ? { query: { sport } } : {});
	}

	/**
	 * VO2 Max a week: each of the account's weeks (Sunday to Saturday here) that
	 * has a reading gives its newest, dated on `generic`/`cycling` (the
	 * acclimation by the week's last day), then the newest day. Weeks without
	 * one are left out. The VO2 Max 4w view, and Training Status's 6m and 1y,
	 * which start on the Sunday on or before the span's first day.
	 */
	async maxMetricsWeekly(start: string, end: string, sport?: "running" | "cycling"): Promise<MaxMetrics[]> {
		return this.maxMetricsRange("weekly", start, end, sport);
	}

	/** VO2 Max a month: each month's newest reading, then the newest day. The 6m and 1y views. */
	async maxMetricsMonthly(start: string, end: string, sport?: "running" | "cycling"): Promise<MaxMetrics[]> {
		return this.maxMetricsRange("monthly", start, end, sport);
	}

	private async maxMetricsRange(
		route: "weekly" | "monthly",
		start: string,
		end: string,
		sport?: "running" | "cycling",
	): Promise<MaxMetrics[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<MaxMetrics[] | null>(
			`/metrics-service/metrics/maxmet/${route}/${start}/${end}`,
			sport ? { query: { sport } } : {},
		)) ?? [];
	}

	/** Running economy a day, every day of the span (28 for the 4w view), null where there is none. */
	async runningEconomyDaily(start: string, end: string): Promise<RunningEconomyScore[]> {
		return this.runningEconomyRange("daily", start, end);
	}

	/**
	 * Running economy a week: seven-day weeks counted from `start`, the last
	 * one running past `end`, each with null where there is none. The 12w and
	 * 1y views (53 rows for 2025-10-12 → 2026-10-11).
	 */
	async runningEconomyWeekly(start: string, end: string): Promise<RunningEconomyScore[]> {
		return this.runningEconomyRange("weekly", start, end);
	}

	private async runningEconomyRange(route: "daily" | "weekly", start: string, end: string): Promise<RunningEconomyScore[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<RunningEconomyScore[] | null>(
			`/metrics-service/metrics/runningeconomy/${route}`,
			{ query: { startDate: start, endDate: end } },
		)) ?? [];
	}

	/**
	 * The cycling power curve over a span: the best average power for 15
	 * durations, 1 s to 5 h, and the ride each came from.
	 *
	 * **`endExclusive` is the day after the span.** The web asks 2026-09-14 →
	 * 2026-10-12 for the four weeks ending 2026-10-11, and 2026-08-01 →
	 * 2026-11-01 for August to October.
	 */
	async cyclingPowerCurve(start: string, endExclusive: string): Promise<PowerCurve | null> {
		assertIsoDate(start, "start");
		assertIsoDate(endExclusive, "endExclusive");
		return this.request("/fitnessstats-service/powerCurve", {
			query: { startDate: start, endDate: endExclusive, sport: "cycling" },
		});
	}

	/** The all-time cycling power curve, behind the web's Record line and Power Records table. */
	async cyclingPowerRecords(): Promise<PowerCurve | null> {
		return this.request("/fitnessstats-service/powerCurve", { query: { sport: "cycling" } });
	}

	/**
	 * W/kg over a span, as `functionalThresholdPowerRange`'s rows. Without a
	 * sport, as the FTP page asks (always weekly), every sport comes in one
	 * payload with `series` naming each; the Running Lactate Threshold page asks
	 * `Running`, daily, weekly or monthly.
	 */
	async powerToWeightRange(
		start: string,
		end: string,
		aggregation: "daily" | "weekly" | "monthly",
		sport?: "Running" | "Cycling",
	): Promise<BiometricChange[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<BiometricChange[] | null>(
			`/biometric-service/stats/powerToWeight/range/${start}/${end}`,
			{ query: sport ? { aggregation, sport } : { aggregation } },
		)) ?? [];
	}

	/** The newest critical swim speed result as of a day; null (HTTP 204) without one. Shape unconfirmed. */
	async criticalSwimSpeedLatest(date: string): Promise<Record<string, unknown> | null> {
		assertIsoDate(date);
		return this.request(`/biometric-service/criticalSwimSpeed/latest/${date}`);
	}

	/**
	 * Critical swim speed over a span: each result for the 7d view, or
	 * `aggregation: "weekly"` for 12w and 1y, a form the web sends with a
	 * trailing slash on the path, which is kept.
	 */
	async criticalSwimSpeedRange(start: string, end: string, aggregation?: "weekly"): Promise<CriticalSwimSpeedRange | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const path = `/biometric-service/criticalSwimSpeed/range/${start}/${end}`;
		return aggregation ? this.request(`${path}/`, { query: { aggregation } }) : this.request(path);
	}

	/**
	 * Hill score by REST, as the web report's 4w (daily), 12w (weekly) and 1y
	 * (monthly) views ask for it. The plugin's page asks for none of it: it
	 * works every average out from the hill-score index, which `hillScores`
	 * (the GraphQL route to the same rows) keeps.
	 */
	async hillScoreStats(start: string, end: string, aggregation: "daily" | "weekly" | "monthly"): Promise<HillScoreStats | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request("/metrics-service/metrics/hillscore/stats", {
			query: { startDate: start, endDate: end, aggregation },
		});
	}

	/**
	 * HRV stress test results a day, the HRV Stress report's 7d and 4w. Keyed by
	 * the account's numeric id rather than its display name. Always `[]` on the
	 * recording account, so a row's shape is unconfirmed.
	 */
	async hrvStressDaily(start: string, end: string): Promise<Array<Record<string, unknown>>> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const pk = await this.requireProfilePk();
		return (await this.request<Array<Record<string, unknown>> | null>(
			`/metrics-service/internal/manualstresslevel/daily/${pk}/${start}/${end}`,
		)) ?? [];
	}

	/** The newest race predictions: the Race Predictor's Most Recent view. */
	async racePredictionsLatest(): Promise<RacePrediction | null> {
		const who = await this.requireDisplayName();
		return this.request(`/metrics-service/metrics/racepredictions/latest/${who}`);
	}

	/**
	 * Race predictions a month, dated by the month's last day (the current
	 * month's by its newest), as the 6m and 1y views plot them. A year at most,
	 * like `racePredictions`. A month without a prediction is a row of nulls
	 * dated its 1st; the values are the daily rows', so the Race Predictor
	 * derives them and does not call this.
	 */
	async racePredictionsMonthly(start: string, end: string): Promise<RacePrediction[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		const who = await this.requireDisplayName();
		return (await this.request<RacePrediction[] | null>(
			`/metrics-service/metrics/racepredictions/monthly/${who}`,
			{ query: { fromCalendarDate: start, toCalendarDate: end } },
		)) ?? [];
	}

	/**
	 * Every reading over the span, newest first, several a day. 367 days a
	 * call at most (368 is HTTP 400); a span without readings is []. History
	 * from 2025-08-02 on the recording account. Home's GraphQL
	 * trainingReadinessRangeScalar proxies this route.
	 */
	async trainingReadinessRange(start: string, end: string): Promise<TrainingReadinessReading[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<TrainingReadinessReading[] | null>(`/metrics-service/metrics/trainingreadiness/${start}/${end}`)) ?? [];
	}

	/* Current-state endpoints: one call each per sync, for the account file. */

	async lactateThreshold(): Promise<Array<Record<string, unknown>>> {
		return (await this.request<Array<Record<string, unknown>> | null>(
			"/biometric-service/biometric/latestLactateThreshold",
		)) ?? [];
	}

	/**
	 * FTP and W/kg. Without a sport Garmin returns one row per sport it has a
	 * threshold for — running, cycling and cross-country skiing — which is how
	 * the web app asks for it.
	 */
	async powerToWeight(date: string, sport?: "Running" | "Cycling"): Promise<Array<Record<string, unknown>>> {
		assertIsoDate(date);
		return (await this.request<Array<Record<string, unknown>> | null>(
			`/biometric-service/biometric/powerToWeight/latest/${date}`,
			sport ? { query: { sport } } : {},
		)) ?? [];
	}

	async runningEconomy(date: string): Promise<Record<string, unknown> | null> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/runningeconomy/latest/${date}`);
	}

	async cyclingAbility(date: string): Promise<Record<string, unknown> | null> {
		assertIsoDate(date);
		const data = await this.graphql<{ cyclingAbility?: { latest?: Record<string, unknown> | null } | null }>(
			`query { cyclingAbility(startDate: "${date}", endDate: "${date}") { latest { calendarDate ` +
				"aerobicEndurance aerobicCapacity anaerobicCapacity profileType profileTypeFeedback " +
				"aerobicEnduranceFeedback aerobicCapacityFeedback anaerobicCapacityFeedback } } }",
		);
		return data.cyclingAbility?.latest ?? null;
	}

	async lastUsedDevice(): Promise<Record<string, unknown> | null> {
		return this.request("/device-service/deviceservice/mylastused");
	}

	async trainingPlans(): Promise<Record<string, unknown> | null> {
		return this.request("/trainingplan-service/trainingplan/plans", { query: { limit: "50" } });
	}

	/** Upcoming events and races, as the app's My Day card lists them. */
	async upcomingEvents(date: string): Promise<Array<Record<string, unknown>>> {
		assertIsoDate(date);
		const data = await this.graphql<{ myDayCardEventsScalar?: { eventMyDay?: Array<Record<string, unknown>> } | null }>(
			`query{myDayCardEventsScalar(timeZone:"GMT", date:"${date}")}`,
		);
		return data.myDayCardEventsScalar?.eventMyDay ?? [];
	}

	async personalRecords(): Promise<Array<Record<string, unknown>>> {
		const who = await this.requireDisplayName();
		return (await this.request<Array<Record<string, unknown>> | null>(
			`/personalrecord-service/personalrecord/prs/${who}`,
			{ query: { includeHistory: "false" } },
		)) ?? [];
	}

	/** How many activities the account has. The list's length is `totalCount - multisportChildCount`. */
	async activityCount(): Promise<ActivityCount> {
		return (await this.request<ActivityCount | null>("/activitylist-service/activities/count")) ?? {};
	}

	async activities(start = 0, limit = 20): Promise<Activity[]> {
		if (!Number.isInteger(start) || start < 0) {
			throw new TypeError(`start must be a non-negative integer, got ${start}`);
		}
		if (!Number.isInteger(limit) || limit < 1) {
			throw new TypeError(`limit must be a positive integer, got ${limit}`);
		}
		const list = await this.request<Activity[] | null>(
			"/activitylist-service/activities/search/activities",
			{ query: { start: String(start), limit: String(limit) } },
		);
		return list ?? [];
	}

	/* One activity's page: its summary, samples, laps, zones, weather and gear,
	   each by the id the activity list gives. The page loads them when it opens. */

	async activity(id: number): Promise<ActivitySummary | null> {
		return this.request(`/activity-service/activity/${assertActivityId(id)}`);
	}

	/**
	 * The recorded samples, at most `maxChartSize` rows, and the GPS track, at most
	 * `maxPolylineSize` points. Past the cap Garmin thins the samples: a 56-minute
	 * run recorded every second (3,363) comes back as 1,694 at 2000, with the same
	 * extremes and averages, which is all a chart a few hundred points wide can
	 * show. The web asks for 10000 and gets every sample.
	 */
	async activityDetails(id: number, maxChartSize = 2000, maxPolylineSize = 4000): Promise<ActivityDetails | null> {
		assertCount(maxChartSize, "maxChartSize");
		assertCount(maxPolylineSize, "maxPolylineSize");
		return this.request(`/activity-service/activity/${assertActivityId(id)}/details`, {
			query: { maxChartSize: String(maxChartSize), maxPolylineSize: String(maxPolylineSize) },
		});
	}

	async activitySplits(id: number): Promise<ActivitySplits | null> {
		return this.request(`/activity-service/activity/${assertActivityId(id)}/splits`);
	}

	async activityTypedSplits(id: number): Promise<ActivityTypedSplits | null> {
		return this.request(`/activity-service/activity/${assertActivityId(id)}/typedsplits`);
	}

	/** Seconds in each heart rate zone, with each zone's floor in bpm. */
	async activityHrZones(id: number): Promise<ActivityZone[]> {
		return (await this.request<ActivityZone[] | null>(`/activity-service/activity/${assertActivityId(id)}/hrTimeInZones`)) ?? [];
	}

	/** Seconds in each power zone, with each zone's floor in watts. */
	async activityPowerZones(id: number): Promise<ActivityZone[]> {
		return (await this.request<ActivityZone[] | null>(`/activity-service/activity/${assertActivityId(id)}/powerTimeInZones`)) ?? [];
	}

	async activityWeather(id: number): Promise<ActivityWeather | null> {
		return this.request(`/activity-service/activity/${assertActivityId(id)}/weather`);
	}

	/** The gear (shoes, a bike) linked to the activity; often none. */
	async activityGear(id: number): Promise<Array<Record<string, unknown>>> {
		return (await this.request<Array<Record<string, unknown>> | null>("/gear-service/gear/filterGear", {
			query: { activityId: String(assertActivityId(id)) },
		})) ?? [];
	}

	/**
	 * The device an activity was recorded on, as it was then: its name and the
	 * firmware it ran (`metadataDTO.deviceMetaDataDTO.deviceVersionPk`). The
	 * device list's firmware is today's, not the activity's.
	 */
	async deviceAppInfo(versionPk: number): Promise<DeviceAppInfo | null> {
		if (!Number.isSafeInteger(versionPk) || versionPk < 1) {
			throw new TypeError(`versionPk must be a positive integer, got ${versionPk}`);
		}
		return this.request(`/device-service/deviceservice/app-info/${versionPk}`);
	}

	/* Health Stats pages: the web app's REST routes for the 7d, 4w and 1y views
	   and the 1d timeline overlays. Each range route has its own cap, and Garmin
	   answers HTTP 400 past it. */

	/** Stress a day: overall level and seconds at rest, low, medium and high. 28 days at most. */
	async stressDaily(start: string, end: string): Promise<DailyStatRow[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyStatRow[] | null>(`/usersummary-service/stats/stress/daily/${start}/${end}`)) ?? [];
	}

	/** Average stress a week for the `weeks` weeks ending on `end`. 52 weeks at most. */
	async stressWeekly(end: string, weeks = 52): Promise<WeeklyStatRow[]> {
		assertIsoDate(end, "end");
		assertCount(weeks, "weeks");
		return (await this.request<WeeklyStatRow[] | null>(`/usersummary-service/stats/stress/weekly/${end}/${weeks}`)) ?? [];
	}

	/** The day's highest and lowest Body Battery. 28 days at most. */
	async bodyBatteryDaily(start: string, end: string): Promise<DailyStatRow[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyStatRow[] | null>(`/usersummary-service/stats/bodybattery/daily/${start}/${end}`)) ?? [];
	}

	/** Resting heart rate and the day's high and low averages. 28 days at most. */
	async heartRateDaily(start: string, end: string): Promise<DailyStatRow[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyStatRow[] | null>(`/usersummary-service/stats/heartRate/daily/${start}/${end}`)) ?? [];
	}

	/** The same a week, `avgRestingHR` in place of `restingHR`. 52 weeks at most. */
	async heartRateWeekly(end: string, weeks = 52): Promise<DailyStatRow[]> {
		assertIsoDate(end, "end");
		assertCount(weeks, "weeks");
		return (await this.request<DailyStatRow[] | null>(`/usersummary-service/stats/heartRate/weekly/${end}/${weeks}`)) ?? [];
	}

	/** Heart rate zones per sport profile, with the trailing slash the web app sends. */
	async heartRateZones(): Promise<HeartRateZones[]> {
		return (await this.request<HeartRateZones[] | null>("/biometric-service/heartRateZones/")) ?? [];
	}

	/** A day's breathing rate every two minutes, with its hourly averages. */
	async respiration(date: string): Promise<RespirationDay | null> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/daily/respiration/${date}`);
	}

	/** Waking and sleeping breaths a minute a day. 31 days at most, unlike the other daily stats. */
	async respirationDaily(start: string, end: string): Promise<RespirationStatRow[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<RespirationStatRow[] | null>(`/usersummary-service/stats/respiration/daily/${start}/${end}`)) ?? [];
	}

	/** Health Status for one day by the REST route the web page uses; null (HTTP 204) on a day without one. */
	async healthStatusSummary(date: string): Promise<HealthStatus | null> {
		assertIsoDate(date);
		return this.request(`/healthstatus-service/healthstatus/summary/${date}`);
	}

	/** Health Status a day over a span, days without one left out. No cap seen up to three years. */
	async healthStatusRange(start: string, end: string): Promise<HealthStatus[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<HealthStatus[] | null>(`/healthstatus-service/healthstatus/summary/${start}/${end}`)) ?? [];
	}

	/** Overnight HRV a night with its baseline. 367 days at most; null (HTTP 204) when no night has any. */
	async hrvDaily(start: string, end: string): Promise<HrvRange | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/hrv-service/hrv/daily/${start}/${end}`);
	}

	/** Fitness age and its inputs on the days it was worked out. 29 days at most. */
	async fitnessAgeDaily(start: string, end: string): Promise<DailyStatRow[]> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<DailyStatRow[] | null>(`/fitnessage-service/stats/daily/${start}/${end}`)) ?? [];
	}

	/** Fitness age a week, without `achievableFitnessAge`. 52 weeks at most. */
	async fitnessAgeWeekly(end: string, weeks = 52): Promise<DailyStatRow[]> {
		assertIsoDate(end, "end");
		assertCount(weeks, "weeks");
		return (await this.request<DailyStatRow[] | null>(`/fitnessage-service/stats/weekly/${end}/${weeks}`)) ?? [];
	}

	/** The newest weigh-in on or before `date`, as the Weight and Fitness Age pages ask for it. */
	async weightLatest(date: string): Promise<WeighIn | null> {
		assertIsoDate(date);
		return this.request("/weight-service/weight/latest", {
			query: { date, ignorePriority: "true" },
		});
	}

	/** Health Snapshots, newest first. `start` counts from 1, so the second page of 20 is `start = 21`. */
	async healthSnapshotList(until: string, start = 1, limit = 20): Promise<HealthSnapshotSummary[]> {
		assertIsoDate(until, "until");
		assertCount(start, "start");
		assertCount(limit, "limit");
		return (await this.request<HealthSnapshotSummary[] | null>(
			"/wellnessactivity-service/activity/summary/list",
			{ query: { limit: String(limit), start: String(start), until } },
		)) ?? [];
	}

	/** One Health Snapshot. Null (HTTP 204) unless `date` is the snapshot's own calendar date. */
	async healthSnapshotDetail(date: string, uuid: string): Promise<HealthSnapshotSummary | null> {
		assertIsoDate(date);
		return this.request(`/wellnessactivity-service/activity/summary/${date}/${pathId(uuid, "uuid")}`);
	}

	/** A Health Snapshot's second-by-second samples. */
	async healthSnapshotEpochs(uuid: string): Promise<HealthSnapshotEpochs | null> {
		return this.request(`/wellnessactivity-service/activity/epoch/${pathId(uuid, "uuid")}`);
	}

	/** The day's Health Snapshots, for the 1d timeline. */
	async wellnessActivities(date: string): Promise<HealthSnapshotSummary[]> {
		assertIsoDate(date);
		return (await this.request<HealthSnapshotSummary[] | null>(`/wellnessactivity-service/activity/summary/${date}`)) ?? [];
	}

	/** Every weigh-in over a span. No cap seen up to ten years. */
	async weighIns(start: string, end: string): Promise<WeighInRange | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/weight-service/weight/range/${start}/${end}`, {
			query: { includeAll: "true" },
		});
	}

	/**
	 * Weigh-ins summarised a week. Garmin takes exactly 52 weeks: `end` must be
	 * 363 days after `start` (the web asks 2025-10-10 → 2026-10-08), and any other
	 * span is HTTP 400.
	 */
	async weightWeekly(start: string, end: string): Promise<WeightWeeks | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/weight-service/weight/weeklyRange/${start}/${end}`);
	}

	/** The weight goals in effect over a span. */
	async weightGoal(start: string, end: string): Promise<WeightGoal | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/goal-service/goal/user/effective/weightgoal/${start}/${end}`);
	}

	/** A day's Pulse Ox and the elevation it was taken at, as the Pulse Ox pages chart it. */
	async spo2Acclimation(date: string): Promise<Spo2Acclimation | null> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/daily/spo2acclimation/${date}`);
	}

	/** Pulse Ox acclimation: a daily average across the span; the hourly and elevation series cover only its newest month of readings. */
	async acclimationDaily(start: string, end: string): Promise<AcclimationStats | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request("/wellness-service/stats/daily/acclimation", {
			query: { fromDate: start, untilDate: end },
		});
	}

	/** One day's blood pressure readings. */
	async bloodPressureDay(date: string): Promise<BloodPressureDay | null> {
		assertIsoDate(date);
		return this.request(`/bloodpressure-service/bloodpressure/dayview/${date}`);
	}

	/** Blood pressure a day over a span, every reading included. No cap seen up to ten years. */
	async bloodPressureRange(start: string, end: string): Promise<BloodPressureRange | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/bloodpressure-service/bloodpressure/range/${start}/${end}`, {
			query: { includeAll: "true" },
		});
	}

	/** Blood pressure a week. Exactly 52 weeks, as for `weightWeekly`; any other span is HTTP 400. */
	async bloodPressureWeekly(start: string, end: string): Promise<BloodPressureRange | null> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return this.request(`/bloodpressure-service/bloodpressure/weeklyRange/${start}/${end}`);
	}

	/** `daily/last` over a span, which the web asks for on every page load. What a row holds is unconfirmed. */
	async bloodPressureLast(start: string, end: string): Promise<Array<Record<string, unknown>>> {
		assertIsoDate(start, "start");
		assertIsoDate(end, "end");
		return (await this.request<Array<Record<string, unknown>> | null>(
			`/bloodpressure-service/bloodpressure/daily/last/${start}/${end}`,
		)) ?? [];
	}

	/** The day's naps, for the 1d timeline. */
	async naps(date: string): Promise<Nap[]> {
		assertIsoDate(date);
		return (await this.request<Nap[] | null>(`/sleep-service/sleep/naps/${date}`, {
			query: { includeOverlaps: "true" },
		})) ?? [];
	}

	/** The day's Move IQ events, for the 1d timeline. */
	async dailyEvents(date: string): Promise<DailyEvent[]> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		return (await this.request<DailyEvent[] | null>(`/wellness-service/wellness/dailyEvents/${who}`, {
			query: { calendarDate: date },
		})) ?? [];
	}

	/** The day's recorded activities, for the 1d timeline. */
	async activitiesForDay(date: string): Promise<Activity[]> {
		assertIsoDate(date);
		const who = await this.requireDisplayName();
		return (await this.request<Activity[] | null>(`/activitylist-service/activities/fordailysummary/${who}`, {
			query: { calendarDate: date },
		})) ?? [];
	}

	/** Lifestyle Logging for one day: the behaviours tracked and the week's completion. No web page calls it. */
	async lifestyleLog(date: string): Promise<LifestyleLog | null> {
		assertIsoDate(date);
		return this.request(`/lifestylelogging-service/dailyLog/${date}`);
	}
}
