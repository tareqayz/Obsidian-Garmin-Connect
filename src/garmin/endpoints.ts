import { GarminClient } from "./client";
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

export interface Activity {
	activityId?: number;
	activityName?: string;
	startTimeLocal?: string;
	startTimeGMT?: string;
	distance?: number | null;
	duration?: number | null;
	calories?: number | null;
	averageHR?: number | null;
	activityType?: { typeKey?: string; [key: string]: unknown };
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

	/** Signing in as someone else must not inherit the previous account's URLs. */
	async login(email: string, password: string): Promise<void> {
		await super.login(email, password);
		this.displayName = null;
		this.fullName = null;
	}

	/** Cleared alongside the session so a second account cannot inherit the first's URLs. */
	async logout(): Promise<void> {
		this.displayName = null;
		this.fullName = null;
		await super.logout();
	}

	async socialProfile(): Promise<SocialProfile> {
		const profile = await this.request<SocialProfile>("/userprofile-service/socialProfile");
		if (typeof profile?.displayName === "string" && profile.displayName.trim()) {
			this.displayName = profile.displayName;
		}
		if (typeof profile?.fullName === "string") this.fullName = profile.fullName;
		return profile;
	}

	/** The account's full name, once a profile has been fetched. */
	get name(): string | null {
		return this.fullName;
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

	async stress(date: string): Promise<Record<string, unknown>> {
		assertIsoDate(date);
		return this.request(`/wellness-service/wellness/dailyStress/${date}`);
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
