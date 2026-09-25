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
	totalKilocalories?: number | null;
	activeKilocalories?: number | null;
	floorsAscended?: number | null;
	minHeartRate?: number | null;
	maxHeartRate?: number | null;
	restingHeartRate?: number | null;
	averageStressLevel?: number | null;
	bodyBatteryHighestValue?: number | null;
	bodyBatteryLowestValue?: number | null;
	moderateIntensityMinutes?: number | null;
	vigorousIntensityMinutes?: number | null;
	privacyProtected?: boolean;
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

/** Heat and altitude acclimation. Rides along with VO2 Max in both places Garmin sends it. */
export interface Acclimation {
	calendarDate?: string;
	heatAcclimationPercentage?: number | null;
	heatTrend?: string | null;
	altitudeAcclimation?: number | null;
	altitudeTrend?: string | null;
	currentAltitude?: number | null;
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

export interface EnduranceScore {
	calendarDate?: string;
	overallScore?: number | null;
	classification?: number | null;
	feedbackPhrase?: string | number | null;
	gaugeLowerLimit?: number | null;
	gaugeUpperLimit?: number | null;
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
	vO2MaxValue?: number | null;
	averageRunningCadenceInStepsPerMinute?: number | null;
	activityType?: { typeKey?: string; [key: string]: unknown };
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

	async trainingReadiness(date: string): Promise<unknown[]> {
		assertIsoDate(date);
		return this.request(`/metrics-service/metrics/trainingreadiness/${date}`);
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
	 * request. Garmin rejects ranges longer than a year.
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

	/** Endurance score for one day. The range form only returns weekly averages. */
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
}
